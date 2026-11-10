/**
 * Messaging Platform (clients) — Gmail per project.
 *
 * Separate from the Quasar Gmail inbox (gmail-inbox-service.js, settings/gmail_inbox_config):
 *   - OAuth callback: /api/mp/gmail/callback (must be an authorized redirect URI of the Google OAuth client)
 *   - tokens + sync cursor stored on the channel: mp_channels/email_<address>
 *   - emails land in ai_projects/{projectId}/mp_conversations/email_<sender>
 * Sync runs from the sequenceWorker cron (every 2 min) and on demand.
 */
const crypto = require('crypto');
const { google } = require('googleapis');
const { db } = require('../firebase-admin');
const { getOAuthClient } = require('../google-auth');

const GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email'
];
const SKIP_LABELS = new Set(['SENT', 'DRAFT', 'SPAM', 'TRASH', 'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS']);
const MAX_PER_SYNC = 25;
const DEFAULT_SERVER = 'https://quasar-erp-b26d5.web.app';

const redirectUri = (serverUrl) => `${serverUrl || process.env.SERVER_URL || DEFAULT_SERVER}/api/mp/gmail/callback`;
const stateSecret = () => process.env.MP_STATE_SECRET || process.env.GOOGLE_CLIENT_SECRET || 'mp-gmail-state';

// ---------- Signed OAuth state (prevents attaching a mailbox to another project) ----------

function signState(payload) {
    const body = Buffer.from(JSON.stringify({ ...payload, ts: Date.now() })).toString('base64url');
    const sig = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
    return `${body}.${sig}`;
}

function readState(state) {
    const [body, sig] = String(state || '').split('.');
    if (!body || !sig) throw new Error('État OAuth invalide.');
    const expected = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error('État OAuth invalide.');
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (Date.now() - data.ts > 30 * 60 * 1000) throw new Error('Lien de connexion expiré, recommencez.');
    return data;
}

// ---------- OAuth ----------

function getAuthUrl({ projectId, agentId = null, aiEnabled = false, label = null, returnTo = null, serverUrl }) {
    const client = getOAuthClient(redirectUri(serverUrl));
    return client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: GMAIL_SCOPES,
        state: signState({ projectId, agentId, aiEnabled: !!aiEnabled, label, returnTo })
    });
}

/** Exchanges the code and creates/updates the project's email channel. */
async function handleCallback({ code, state, serverUrl }) {
    const s = readState(state);
    const client = getOAuthClient(redirectUri(serverUrl));
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: client });
    const { data: profile } = await gmail.users.getProfile({ userId: 'me' });
    const email = String(profile.emailAddress || '').toLowerCase();
    if (!email) throw new Error('Adresse Gmail introuvable.');

    const id = `email_${email}`;
    const ref = db.collection('mp_channels').doc(id);
    const existing = await ref.get();
    if (existing.exists && existing.data().projectId !== s.projectId) {
        throw new Error(`${email} est déjà relié à un autre projet.`);
    }
    if (!tokens.refresh_token && !existing.data()?.gmailTokens?.refresh_token) {
        throw new Error('Google n\'a pas fourni de jeton permanent. Retirez l\'accès de l\'app dans votre compte Google, puis reconnectez.');
    }
    const now = new Date().toISOString();
    await ref.set({
        projectId: s.projectId,
        type: 'email',
        externalId: email,
        label: s.label || existing.data()?.label || null,
        agentId: s.agentId || existing.data()?.agentId || null,
        aiEnabled: existing.exists ? existing.data().aiEnabled !== false : !!s.aiEnabled,
        active: true,
        gmailTokens: { ...(existing.data()?.gmailTokens || {}), ...tokens },
        historyId: profile.historyId, // sync starts from now: no import of the whole mailbox
        lastSyncAt: null,
        lastError: null,
        updatedAt: now,
        ...(existing.exists ? {} : { createdAt: now })
    }, { merge: true });
    return { email, projectId: s.projectId, returnTo: s.returnTo || null };
}

function gmailFor(channel) {
    const client = getOAuthClient();
    client.setCredentials(channel.gmailTokens || {});
    client.on('tokens', (t) => {
        db.collection('mp_channels').doc(channel.id)
            .set({ gmailTokens: { ...(channel.gmailTokens || {}), ...t } }, { merge: true }).catch(() => { });
    });
    return google.gmail({ version: 'v1', auth: client });
}

// ---------- Parsing (copied from the Quasar Gmail service, kept independent) ----------

const header = (headers, name) => (headers || []).find(x => x.name.toLowerCase() === name.toLowerCase())?.value || '';
function parseAddress(raw) {
    const m = String(raw || '').match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
    return { name: '', email: String(raw || '').trim().toLowerCase() };
}
const decodeB64 = (d) => Buffer.from(String(d || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
function findPart(p, mime) {
    if (!p) return null;
    if (p.mimeType === mime && p.body?.data) return p.body.data;
    for (const c of p.parts || []) { const f = findPart(c, mime); if (f) return f; }
    return null;
}
const htmlToText = (h) => String(h || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h\d)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
function stripQuoted(text) {
    const out = [];
    for (const line of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
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

// ---------- Sync ----------

/** New inbox messages of one email channel since its history cursor. Calls onMessage for each. */
async function syncChannel(channel, onMessage) {
    const gmail = gmailFor(channel);
    const ref = db.collection('mp_channels').doc(channel.id);
    let imported = 0;
    try {
        const ids = new Set();
        let newHistoryId = channel.historyId;
        try {
            let pageToken;
            do {
                const { data } = await gmail.users.history.list({ userId: 'me', startHistoryId: channel.historyId, historyTypes: ['messageAdded'], labelId: 'INBOX', pageToken });
                (data.history || []).forEach(h => (h.messagesAdded || []).forEach(m => ids.add(m.message.id)));
                if (data.historyId) newHistoryId = data.historyId;
                pageToken = data.nextPageToken;
            } while (pageToken && ids.size < 200);
        } catch (e) {
            if (e.code === 404 || e.response?.status === 404 || !channel.historyId) {
                const { data } = await gmail.users.messages.list({ userId: 'me', q: 'in:inbox newer_than:1d', maxResults: MAX_PER_SYNC });
                (data.messages || []).forEach(m => ids.add(m.id));
                newHistoryId = (await gmail.users.getProfile({ userId: 'me' })).data.historyId;
            } else throw e;
        }

        for (const id of Array.from(ids).slice(0, MAX_PER_SYNC)) {
            try {
                const { data: msg } = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
                const labels = msg.labelIds || [];
                if (!labels.includes('INBOX') || labels.some(l => SKIP_LABELS.has(l))) continue;
                const h = msg.payload?.headers || [];
                const from = parseAddress(header(h, 'From'));
                if (!from.email || from.email === channel.externalId) continue;
                if (/^(no-?reply|mailer-daemon|postmaster)@/i.test(from.email)) continue;
                const subject = header(h, 'Subject') || '(sans objet)';
                const messageIdHeader = header(h, 'Message-ID') || header(h, 'Message-Id');
                const body = extractBody(msg.payload) || msg.snippet || '';
                await onMessage({
                    contactId: from.email,
                    contactName: from.name || null,
                    text: `${subject}\n\n${body}`.slice(0, 8000),
                    messageId: id,
                    timestamp: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : null,
                    threadFields: {
                        subject,
                        gmailThreadId: msg.threadId,
                        lastMessageIdHeader: messageIdHeader || null,
                        lastReferences: [header(h, 'References'), messageIdHeader].filter(Boolean).join(' ').trim() || null
                    }
                });
                imported++;
            } catch (e) {
                console.error(`[MP Gmail] Message ${id} (${channel.externalId}) error:`, e.message);
            }
        }
        await ref.set({ historyId: newHistoryId, lastSyncAt: new Date().toISOString(), lastError: null }, { merge: true });
        return { imported };
    } catch (e) {
        const msg = e.response?.data?.error_description || e.message;
        await ref.set({ lastSyncAt: new Date().toISOString(), lastError: msg }, { merge: true }).catch(() => { });
        throw new Error(msg);
    }
}

// ---------- Reply ----------

const encodeHeader = (v) => /[^\x20-\x7E]/.test(v) ? `=?UTF-8?B?${Buffer.from(v, 'utf8').toString('base64')}?=` : v;

/** Replies in the same Gmail thread as the conversation. Returns the Gmail message id. */
async function sendEmail({ channel, to, text, conv = {} }) {
    if (!channel.gmailTokens) throw new Error('Gmail n\'est pas connecté pour ce canal.');
    const gmail = gmailFor(channel);
    const base = conv.subject || '';
    const subject = /^re\s*:/i.test(base) ? base : `Re: ${base}`.trim();
    const lines = [
        `From: ${channel.externalId}`,
        `To: ${to}`,
        `Subject: ${encodeHeader(subject || 'Re:')}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: base64'
    ];
    if (conv.lastMessageIdHeader) lines.push(`In-Reply-To: ${conv.lastMessageIdHeader}`);
    if (conv.lastReferences) lines.push(`References: ${conv.lastReferences}`);
    const raw = lines.join('\r\n') + '\r\n\r\n' + Buffer.from(text, 'utf8').toString('base64');
    const { data } = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: Buffer.from(raw).toString('base64url'), threadId: conv.gmailThreadId || undefined }
    });
    return data.id;
}

module.exports = { getAuthUrl, handleCallback, syncChannel, sendEmail, redirectUri };
