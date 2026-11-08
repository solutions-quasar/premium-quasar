/**
 * Gmail → Boîte Omnicanale
 * -----------------------------------------------------------------------------
 * Récupère les nouveaux courriels de la boîte de réception Gmail et les place
 * dans la collection `conversations` (channel: 'email'), à côté de SMS,
 * WhatsApp, Instagram et Messenger. Permet aussi de répondre dans le même fil.
 *
 * Connexion OAuth séparée de Google Calendar (jetons dans settings/gmail_inbox_config)
 * pour ne pas forcer la reconnexion du calendrier.
 *
 * Synchronisation : Gmail History API, appelée par le cron `sequenceWorker`
 * (toutes les 2 min) + bouton « Synchroniser » dans l'inbox.
 */
const { google } = require('googleapis');
const { db } = require('./firebase-admin');
const { getOAuthClient } = require('./google-auth');

const CONFIG_DOC = () => db.collection('settings').doc('gmail_inbox_config');

const GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email'
];

// Libellés Gmail ignorés (pubs, réseaux sociaux, notifications automatiques, etc.)
const SKIP_LABELS = new Set([
    'SENT', 'DRAFT', 'SPAM', 'TRASH',
    'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS'
]);

const MAX_PER_SYNC = 25;

function getRedirectUri(serverUrl) {
    return `${serverUrl}/api/integrations/gmail/callback`;
}

function getAuthUrl(serverUrl, returnTo = null) {
    const client = getOAuthClient(getRedirectUri(serverUrl));
    const state = Buffer.from(JSON.stringify({ returnTo })).toString('base64url');
    return client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: GMAIL_SCOPES,
        state
    });
}

async function handleCallback(code, serverUrl) {
    const client = getOAuthClient(getRedirectUri(serverUrl));
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: client });
    const profile = await gmail.users.getProfile({ userId: 'me' });

    // On démarre la synchro « à partir de maintenant » (pas d'import de tout l'historique)
    await CONFIG_DOC().set({
        tokens,
        email: profile.data.emailAddress,
        historyId: profile.data.historyId,
        connectedAt: new Date().toISOString(),
        lastSyncAt: null,
        lastError: null
    }, { merge: true });

    return { email: profile.data.emailAddress };
}

async function getStatus() {
    const snap = await CONFIG_DOC().get();
    if (!snap.exists || !snap.data().tokens?.refresh_token) return { connected: false };
    const d = snap.data();
    return {
        connected: true,
        email: d.email || null,
        connectedAt: d.connectedAt || null,
        lastSyncAt: d.lastSyncAt || null,
        lastError: d.lastError || null
    };
}

async function disconnect() {
    await CONFIG_DOC().delete();
    return { success: true };
}

async function getGmailClient() {
    const snap = await CONFIG_DOC().get();
    if (!snap.exists || !snap.data().tokens) return null;
    const cfg = snap.data();

    const client = getOAuthClient();
    client.setCredentials(cfg.tokens);
    client.on('tokens', async (newTokens) => {
        const merged = { ...cfg.tokens, ...newTokens };
        await CONFIG_DOC().update({ tokens: merged }).catch(() => { });
    });

    return { gmail: google.gmail({ version: 'v1', auth: client }), cfg };
}

// ---------- Parsing helpers ----------

function header(headers, name) {
    const h = (headers || []).find(x => x.name.toLowerCase() === name.toLowerCase());
    return h ? h.value : '';
}

function parseAddress(raw) {
    // "Jean Tremblay <jean@exemple.com>" → { name, email }
    const m = String(raw || '').match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
    return { name: '', email: String(raw || '').trim().toLowerCase() };
}

function decodeB64(data) {
    return Buffer.from(String(data || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function findPart(payload, mime) {
    if (!payload) return null;
    if (payload.mimeType === mime && payload.body?.data) return payload.body.data;
    for (const p of payload.parts || []) {
        const found = findPart(p, mime);
        if (found) return found;
    }
    return null;
}

function htmlToText(html) {
    return String(html || '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

// Retire la partie citée (« Le ... a écrit : », « On ... wrote: », lignes « > »)
function stripQuoted(text) {
    const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    const out = [];
    for (const line of lines) {
        if (/^\s*(Le |On ).{5,200}(a écrit|wrote)\s*:\s*$/i.test(line)) break;
        if (/^-{2,}\s*(Original Message|Message d'origine)/i.test(line)) break;
        if (/^\s*>/.test(line)) continue;
        out.push(line);
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function extractBody(payload) {
    const plain = findPart(payload, 'text/plain');
    if (plain) return stripQuoted(decodeB64(plain));
    const html = findPart(payload, 'text/html');
    if (html) return stripQuoted(htmlToText(decodeB64(html)));
    if (payload?.body?.data) return stripQuoted(decodeB64(payload.body.data));
    return '';
}

// ---------- Ingestion ----------

async function ingestMessage(gmail, messageId, myEmail) {
    const { data: msg } = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
    const labels = msg.labelIds || [];
    if (!labels.includes('INBOX') || labels.some(l => SKIP_LABELS.has(l))) return false;

    // Déduplication (même collection que les webhooks Meta)
    try {
        await db.collection('webhook_events').doc(`gmail_${messageId}`).create({
            timestamp: new Date().toISOString(),
            source: 'email'
        });
    } catch (dupErr) {
        if (dupErr.code === 6) return false; // déjà traité
        throw dupErr;
    }

    const headers = msg.payload?.headers || [];
    const from = parseAddress(header(headers, 'From'));
    if (!from.email || from.email === (myEmail || '').toLowerCase()) return false;

    const subject = header(headers, 'Subject') || '(sans objet)';
    const messageIdHeader = header(headers, 'Message-ID') || header(headers, 'Message-Id');
    const references = header(headers, 'References');
    const body = extractBody(msg.payload) || msg.snippet || '';
    const sentAt = msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : new Date().toISOString();

    const sessionId = `email_${msg.threadId}`;
    const convRef = db.collection('conversations').doc(sessionId);
    const convDoc = await convRef.get();
    const history = convDoc.exists ? (convDoc.data().messages || []) : [];

    // Lien avec un lead / client existant via le courriel
    let leadId = convDoc.exists ? convDoc.data().leadId || null : null;
    let clientId = convDoc.exists ? convDoc.data().clientId || null : null;
    let clientName = convDoc.exists ? convDoc.data().clientName : null;
    let companyName = convDoc.exists ? convDoc.data().companyName : null;
    if (!convDoc.exists) {
        try {
            const leadSnap = await db.collection('crm_leads').where('email', '==', from.email).limit(1).get();
            if (!leadSnap.empty) {
                const ld = leadSnap.docs[0].data();
                leadId = leadSnap.docs[0].id;
                clientName = ld.name || ld.contact_name || null;
                companyName = ld.company || ld.business_name || null;
            } else {
                const clientSnap = await db.collection('clients').where('email', '==', from.email).limit(1).get();
                if (!clientSnap.empty) {
                    const cd = clientSnap.docs[0].data();
                    clientId = clientSnap.docs[0].id;
                    clientName = cd.name || cd.displayName || null;
                    companyName = cd.company || null;
                }
            }
        } catch (e) {
            console.warn('[Gmail Inbox] Contact lookup error:', e.message);
        }
    }

    history.push({
        role: 'user',
        author: 'user',
        content: `${subject}\n\n${body}`.slice(0, 8000),
        subject,
        channel: 'email',
        timestamp: sentAt,
        messageId: messageIdHeader || messageId,
        gmailMessageId: messageId
    });
    history.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

    await convRef.set({
        sessionId,
        channel: 'email',
        senderId: from.email,
        senderEmail: from.email,
        clientName: clientName || from.name || from.email,
        companyName: companyName || null,
        leadId: leadId || null,
        clientId: clientId || null,
        subject,
        gmailThreadId: msg.threadId,
        lastMessageIdHeader: messageIdHeader || null,
        lastReferences: [references, messageIdHeader].filter(Boolean).join(' ').trim() || null,
        unread: true,
        aiEnabled: false, // pas de réponse IA automatique sur les courriels
        updatedAt: new Date().toISOString(),
        messages: history.slice(-50)
    }, { merge: true });

    return true;
}

/**
 * Récupère les nouveaux courriels depuis le dernier historyId.
 * Appelé par le cron toutes les 2 minutes et par POST /api/gmail-inbox/sync.
 */
async function syncInbox() {
    const ctx = await getGmailClient();
    if (!ctx) return { skipped: true, reason: 'Gmail non connecté' };
    const { gmail, cfg } = ctx;

    let imported = 0;
    try {
        const ids = new Set();
        let newHistoryId = cfg.historyId;

        try {
            let pageToken;
            do {
                const { data } = await gmail.users.history.list({
                    userId: 'me',
                    startHistoryId: cfg.historyId,
                    historyTypes: ['messageAdded'],
                    labelId: 'INBOX',
                    pageToken
                });
                (data.history || []).forEach(h => (h.messagesAdded || []).forEach(m => ids.add(m.message.id)));
                if (data.historyId) newHistoryId = data.historyId;
                pageToken = data.nextPageToken;
            } while (pageToken && ids.size < 200);
        } catch (e) {
            // historyId expiré (> ~7 jours) → on se rabat sur les courriels du dernier jour
            if (e.code === 404 || e.response?.status === 404) {
                const { data } = await gmail.users.messages.list({ userId: 'me', q: 'in:inbox newer_than:1d', maxResults: MAX_PER_SYNC });
                (data.messages || []).forEach(m => ids.add(m.id));
                const profile = await gmail.users.getProfile({ userId: 'me' });
                newHistoryId = profile.data.historyId;
            } else {
                throw e;
            }
        }

        for (const id of Array.from(ids).slice(0, MAX_PER_SYNC)) {
            try {
                if (await ingestMessage(gmail, id, cfg.email)) imported++;
            } catch (e) {
                console.error(`[Gmail Inbox] Message ${id} error:`, e.message);
            }
        }

        await CONFIG_DOC().update({
            historyId: newHistoryId,
            lastSyncAt: new Date().toISOString(),
            lastError: null
        });
        if (imported) console.log(`[Gmail Inbox] ${imported} nouveau(x) courriel(s) importé(s).`);
        return { success: true, imported };
    } catch (e) {
        console.error('[Gmail Inbox] Sync error:', e.message);
        await CONFIG_DOC().update({ lastError: e.message, lastSyncAt: new Date().toISOString() }).catch(() => { });
        throw e;
    }
}

// ---------- Réponse ----------

function encodeHeaderUtf8(value) {
    return /[^\x20-\x7E]/.test(value) ? `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=` : value;
}

/**
 * Répond dans le même fil Gmail (In-Reply-To / References / threadId).
 */
async function sendReply(conv, text) {
    const ctx = await getGmailClient();
    if (!ctx) throw new Error("Gmail n'est pas connecté. Connectez-le depuis la boîte omnicanale.");
    const { gmail, cfg } = ctx;

    const to = conv.senderEmail || conv.senderId;
    if (!to) throw new Error('Adresse courriel du destinataire manquante.');

    const baseSubject = conv.subject || '';
    const subject = /^re\s*:/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject}`.trim();

    const lines = [
        `From: ${cfg.email}`,
        `To: ${to}`,
        `Subject: ${encodeHeaderUtf8(subject)}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: base64'
    ];
    if (conv.lastMessageIdHeader) lines.push(`In-Reply-To: ${conv.lastMessageIdHeader}`);
    if (conv.lastReferences) lines.push(`References: ${conv.lastReferences}`);

    const raw = lines.join('\r\n') + '\r\n\r\n' + Buffer.from(text, 'utf8').toString('base64');
    const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const { data } = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encoded, threadId: conv.gmailThreadId || undefined }
    });

    // Évite de réimporter notre propre réponse (elle est aussi filtrée par SENT)
    await db.collection('webhook_events').doc(`gmail_${data.id}`).set({ timestamp: new Date().toISOString(), source: 'email_sent' }).catch(() => { });

    return { success: true, messageId: data.id, subject };
}

module.exports = {
    getAuthUrl,
    handleCallback,
    getStatus,
    disconnect,
    syncInbox,
    sendReply
};
