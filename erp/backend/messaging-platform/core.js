/**
 * Messaging Platform (clients) — data model and inbound pipeline.
 *
 * Fully separate from the private Quasar inbox:
 *   - channels:      mp_channels/{type}_{externalId}            (admin only, holds tokens)
 *   - conversations: ai_projects/{projectId}/mp_conversations/{type}_{contactId}
 *   - dedup:         mp_webhook_events/{eventId}
 * No prospecting logic (sequences, leads, audits) runs here.
 */
const crypto = require('crypto');
const OpenAI = require('openai');
const { db } = require('../firebase-admin');
const providers = require('./providers');
const { buildPrompt } = require('./prompt');
const gmail = require('./gmail');

const CHANNEL_TYPES = ['facebook', 'instagram', 'whatsapp', 'sms', 'email'];
const MAX_MESSAGES = 100;
const CHANNEL_LABELS = { facebook: 'Messenger', instagram: 'Instagram', whatsapp: 'WhatsApp', sms: 'SMS', email: 'Courriel' };
const OPT_OUT = /^\s*(stop|arret|arrêt|unsubscribe|desabonner|désabonner)\s*$/i;

let deps = { processAiChat: null };
function setDeps(d) { deps = { ...deps, ...d }; }

const nowIso = () => new Date().toISOString();
const channelId = (type, externalId) => `${type}_${String(externalId).trim()}`;
const conversationsRef = (projectId) => db.collection('ai_projects').doc(projectId).collection('mp_conversations');

// ---------- Channels ----------

async function getChannel(type, externalId) {
    if (!externalId) return null;
    const snap = await db.collection('mp_channels').doc(channelId(type, externalId)).get();
    if (!snap.exists) return null;
    const ch = { id: snap.id, ...snap.data() };
    return ch.active === false ? null : ch;
}

async function getChannelById(id) {
    const snap = await db.collection('mp_channels').doc(id).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function getChannelByWebhookKey(key) {
    if (!key) return null;
    const snap = await db.collection('mp_channels').where('webhookKey', '==', key).limit(1).get();
    if (snap.empty) return null;
    const ch = { id: snap.docs[0].id, ...snap.docs[0].data() };
    return ch.active === false ? null : ch;
}

/** Public view of a channel: never exposes tokens. */
function publicChannel(ch, { withWebhookKey = false } = {}) {
    const out = {
        id: ch.id,
        projectId: ch.projectId,
        agentId: ch.agentId || null,
        type: ch.type,
        externalId: ch.externalId,
        label: ch.label || null,
        active: ch.active !== false,
        aiEnabled: ch.aiEnabled !== false,
        hasToken: !!(ch.accessToken || ch.gmailTokens?.refresh_token),
        hasTwilioCredentials: !!(ch.twilioAccountSid && ch.twilioAuthToken),
        lastSyncAt: ch.lastSyncAt || null,
        lastError: ch.lastError || null,
        wabaId: ch.wabaId || null,
        createdAt: ch.createdAt || null,
        updatedAt: ch.updatedAt || null
    };
    if (withWebhookKey && ch.webhookKey) out.webhookKey = ch.webhookKey;
    return out;
}

async function listChannels(projectId) {
    const snap = await db.collection('mp_channels').where('projectId', '==', projectId).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function saveChannel(projectId, input) {
    const type = String(input.type || '').toLowerCase();
    if (!CHANNEL_TYPES.includes(type)) throw new Error(`Type de canal invalide : ${type}`);
    let externalId = String(input.externalId || '').trim();
    if (type === 'sms') externalId = externalId.replace(/[^\d+]/g, '');
    if (type === 'email') externalId = externalId.toLowerCase();
    if (!externalId) throw new Error('Identifiant du canal requis (ID de Page, ID Instagram, phone_number_id ou numéro).');

    const id = channelId(type, externalId);
    const ref = db.collection('mp_channels').doc(id);
    const existing = await ref.get();
    if (existing.exists && existing.data().projectId !== projectId) {
        throw new Error('Ce canal est déjà relié à un autre projet.');
    }
    // A Gmail channel is created by the Google sign-in flow only (it needs OAuth tokens)
    if (type === 'email' && !existing.exists) {
        throw new Error('Utilisez « Connecter Gmail » pour ajouter une adresse courriel.');
    }

    const data = {
        projectId,
        type,
        externalId,
        agentId: input.agentId || null,
        label: input.label || null,
        active: input.active !== false,
        aiEnabled: input.aiEnabled !== false,
        updatedAt: nowIso()
    };
    if (input.accessToken) data.accessToken = String(input.accessToken).trim();
    if (input.twilioAccountSid) data.twilioAccountSid = String(input.twilioAccountSid).trim();
    if (input.twilioAuthToken) data.twilioAuthToken = String(input.twilioAuthToken).trim();
    if (type === 'whatsapp' && input.wabaId !== undefined) data.wabaId = String(input.wabaId || '').replace(/[^\d]/g, '') || null;
    if (!existing.exists) {
        data.createdAt = nowIso();
        if (type === 'sms') data.webhookKey = crypto.randomBytes(24).toString('hex');
    }
    await ref.set(data, { merge: true });
    return getChannelById(id);
}

async function deleteChannel(projectId, id) {
    const ch = await getChannelById(id);
    if (!ch || ch.projectId !== projectId) throw new Error('Canal introuvable.');
    await db.collection('mp_channels').doc(id).delete();
}

// ---------- Conversations ----------

async function claimEvent(eventId) {
    try {
        await db.collection('mp_webhook_events').doc(eventId).create({ timestamp: nowIso() });
        return true;
    } catch (e) {
        if (e.code === 6) return false; // ALREADY_EXISTS
        console.warn('[MP Dedup] Could not claim event:', e.message);
        return true;
    }
}

/** Appends a message in a transaction; skips a messageId already in the thread. */
async function appendMessage(projectId, convId, message, fields = {}) {
    const ref = conversationsRef(projectId).doc(convId);
    // Firestore rejects undefined values
    Object.keys(message).forEach(k => message[k] === undefined && delete message[k]);
    Object.keys(fields).forEach(k => fields[k] === undefined && delete fields[k]);
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const history = snap.exists ? (snap.data().messages || []) : [];
        const dupIndex = message.messageId ? history.findIndex(m => m.messageId === message.messageId) : -1;
        if (dupIndex !== -1) {
            // The Meta echo of our own send can arrive before we record it: keep the real author.
            const dup = history[dupIndex];
            if (dup.senderName?.startsWith('Depuis l\'app') && message.author !== dup.author) {
                history[dupIndex] = { ...dup, author: message.author, senderName: message.senderName || null };
                tx.set(ref, { ...fields, messages: history, lastAuthor: message.author }, { merge: true });
            } else if (Object.keys(fields).length) {
                tx.set(ref, fields, { merge: true });
            }
            return false;
        }
        history.push(message);
        tx.set(ref, {
            ...fields,
            lastMessage: String(message.content || '').slice(0, 200),
            lastMessageAt: message.timestamp || nowIso(),
            lastAuthor: message.author,
            messages: history.slice(-MAX_MESSAGES),
            updatedAt: nowIso()
        }, { merge: true });
        return true;
    });
}

// ---------- AI ----------

async function generateReply({ projectId, agentId, channelType, history }) {
    const agentSnap = await db.collection('ai_agents').doc(agentId).get();
    if (!agentSnap.exists) throw new Error(`Agent ${agentId} introuvable.`);
    const agent = agentSnap.data();
    const agentProject = agent.knowledgeBase?.projectId || agent.projectId;
    if (agentProject && agentProject !== projectId) throw new Error('Agent rattaché à un autre projet.');
    if (agent.active === false) return null;

    const messages = history
        .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content)
        .slice(-12)
        .map(m => ({ role: m.role, content: String(m.content) }));
    if (!messages.length) return null;

    // Projects with their own Firebase get the full agent (tools + memories) via processAiChat.
    // No sessionId is passed, so nothing is written to the Quasar `conversations` collection.
    const projectSnap = await db.collection('ai_projects').doc(projectId).get();
    const project = projectSnap.exists ? projectSnap.data() : {};
    const canUseFullAgent = !!(project.serviceAccountKey && deps.processAiChat);

    if (canUseFullAgent) {
        try {
            const { context } = await buildPrompt({ agent, channelType, fullAgent: true, timeZone: project.timeZone });
            const result = await deps.processAiChat({ agentId, messages, clientContext: context });
            if (result?.message) return result.message;
        } catch (e) {
            console.warn(`[MP AI] Full agent failed for project ${projectId}, falling back to prompt only:`, e.message);
        }
    }

    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY manquant.');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { full } = await buildPrompt({ agent, channelType, fullAgent: false, timeZone: project.timeZone });
    const completion = await openai.chat.completions.create({
        model: agent.knowledgeBase?.model || agent.model || 'gpt-4o-mini',
        temperature: 0.3,
        messages: [{ role: 'system', content: full }, ...messages]
    });
    return completion.choices[0]?.message?.content || null;
}

/** Final prompt an agent receives on a channel, for the ERP preview. */
async function previewPrompt({ projectId, agentId, channelType = 'sms' }) {
    const agentSnap = await db.collection('ai_agents').doc(agentId).get();
    if (!agentSnap.exists) throw new Error('Agent introuvable.');
    const agent = agentSnap.data();
    const agentProject = agent.knowledgeBase?.projectId || agent.projectId;
    if (agentProject && agentProject !== projectId) throw new Error('Agent rattaché à un autre projet.');
    const projectSnap = await db.collection('ai_projects').doc(projectId).get();
    const project = projectSnap.exists ? projectSnap.data() : {};
    const fullAgent = !!(project.serviceAccountKey && deps.processAiChat);
    const built = await buildPrompt({ agent, channelType, fullAgent, timeZone: project.timeZone });
    return {
        mode: fullAgent ? 'full' : 'prompt',
        model: agent.knowledgeBase?.model || agent.model || 'gpt-4o-mini',
        // In full mode processAiChat puts the agent prompt (+ memories) first, then the platform layers
        prompt: fullAgent ? `${built.base}\n\n[+ mémoires pertinentes, si trouvées]${built.context}` : built.full,
        layers: built.layers
    };
}

// ---------- Sending ----------

async function sendOnChannel(channel, contactId, text, conv = {}) {
    switch (channel.type) {
        case 'email':
            return gmail.sendEmail({ channel, to: contactId, text, conv });
        case 'facebook':
        case 'instagram':
            return providers.sendMetaDM({ token: channel.accessToken, recipientId: contactId, text });
        case 'whatsapp':
            return providers.sendWhatsApp({ token: channel.accessToken, phoneNumberId: channel.externalId, to: contactId, text });
        case 'sms':
            return providers.sendSms({ channel, to: contactId, text });
        default:
            throw new Error(`Canal non pris en charge : ${channel.type}`);
    }
}

// ---------- Inbound pipeline ----------

/**
 * Records an inbound message and, if allowed, answers with the project's agent.
 * @param {object} p
 * @param {object} p.channel     mp_channels doc
 * @param {string} p.contactId   PSID / IGSID / phone number
 * @param {string} p.text
 * @param {boolean} p.isRealText false for media without caption, stickers, etc. (no AI reply)
 * @param {string} p.messageId   provider message id (dedup)
 * @param {string} [p.contactName]
 * @param {boolean} [p.dryRun]   record the AI reply without sending it (tests)
 */
async function handleInbound({ channel, contactId, text, isRealText = true, messageId = null, contactName = null, timestamp = null, dryRun = false, extraFields = {} }) {
    const projectId = channel.projectId;
    const convId = `${channel.type}_${contactId}`;
    const ref = conversationsRef(projectId).doc(convId);

    if (messageId && !(await claimEvent(`${channel.type}_${messageId}`))) {
        console.log(`[MP] Duplicate ${channel.type} event ${messageId} ignored.`);
        return { duplicate: true };
    }

    const snap = await ref.get();
    const existing = snap.exists ? snap.data() : {};

    let name = existing.contactName || contactName || null;
    if (!name && (channel.type === 'facebook' || channel.type === 'instagram')) {
        name = await providers.getMetaProfile({ token: channel.accessToken, userId: contactId, type: channel.type });
    }

    const optOut = channel.type === 'sms' && OPT_OUT.test(text);
    await appendMessage(projectId, convId, {
        role: 'user',
        author: 'user',
        content: text,
        messageId,
        timestamp: timestamp || nowIso()
    }, {
        projectId,
        channelId: channel.id,
        channel: channel.type,
        contactId: String(contactId),
        contactName: name || existing.contactName || null,
        unread: true,
        lastCustomerMessageAt: nowIso(),
        ...extraFields, // e.g. email thread: subject, gmailThreadId, Message-ID headers
        ...(optOut ? { optedOut: true, aiEnabled: false } : {}),
        ...(snap.exists ? {} : { createdAt: nowIso(), aiEnabled: !optOut })
    });
    console.log(`[MP] ${channel.type} message recorded for project ${projectId} (${convId})`);

    // AI reply gates
    if (!isRealText || optOut) return { recorded: true, replied: false };
    if (channel.aiEnabled === false || existing.aiEnabled === false || existing.optedOut) return { recorded: true, replied: false };
    if (!channel.agentId) return { recorded: true, replied: false, reason: 'no_agent' };

    // Flood guard: no AI reply past 6 customer messages in 2 minutes
    const fresh = await ref.get();
    const history = fresh.data()?.messages || [];
    const since = Date.now() - 2 * 60 * 1000;
    const burst = history.filter(m => m.role === 'user' && Date.parse(m.timestamp) > since).length;
    if (burst > 6) {
        console.warn(`[MP] Flood guard: ${burst} messages in 2 min on ${convId}, AI paused for this message.`);
        return { recorded: true, replied: false, reason: 'rate_limited' };
    }

    let reply;
    try {
        reply = await generateReply({ projectId, agentId: channel.agentId, channelType: channel.type, history });
    } catch (e) {
        console.error(`[MP AI] Reply generation failed for ${convId}:`, e.message);
        return { recorded: true, replied: false, error: e.message };
    }
    if (!reply) return { recorded: true, replied: false };

    let sentId = null;
    if (!dryRun) {
        try {
            sentId = await sendOnChannel(channel, contactId, reply, fresh.data() || {});
        } catch (e) {
            console.error(`[MP] Send failed on ${convId}:`, e.message);
            await appendMessage(projectId, convId, {
                role: 'system', author: 'system', content: `Échec de l'envoi de la réponse IA : ${e.message}`, timestamp: nowIso()
            });
            return { recorded: true, replied: false, error: e.message };
        }
    }
    await appendMessage(projectId, convId, {
        role: 'assistant',
        author: 'ai',
        content: reply,
        messageId: sentId,
        ...(dryRun ? { dryRun: true } : {}),
        timestamp: nowIso()
    });
    return { recorded: true, replied: true, reply };
}

/** Message you sent from the native app (Instagram / Messenger echo). */
async function handleEcho({ channel, contactId, text, messageId }) {
    const convId = `${channel.type}_${contactId}`;
    const snap = await conversationsRef(channel.projectId).doc(convId).get();
    if (!snap.exists) return;
    await appendMessage(channel.projectId, convId, {
        role: 'assistant',
        author: 'human',
        senderName: `Depuis l'app ${CHANNEL_LABELS[channel.type]}`,
        content: text,
        messageId,
        timestamp: nowIso()
    });
}

/** Manual reply from the inbox (ERP admin or client portal). */
async function sendManualReply({ projectId, convId, text, user }) {
    const ref = conversationsRef(projectId).doc(convId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Conversation introuvable.');
    const conv = snap.data();
    if (conv.optedOut) throw new Error('Ce contact s\'est désabonné (STOP).');
    const channel = await getChannelById(conv.channelId);
    if (!channel || channel.projectId !== projectId) throw new Error('Canal de la conversation introuvable.');
    const sentId = await sendOnChannel(channel, conv.contactId, text, conv);
    await appendMessage(projectId, convId, {
        role: 'assistant',
        author: 'human',
        senderName: user?.email || null,
        content: text,
        messageId: sentId,
        timestamp: nowIso()
    }, { unread: false });
    return sentId;
}

/**
 * Business-initiated message from the ERP ("Nouveau message"): free text, or a WhatsApp
 * template (required outside the 24 h customer-service window). Recorded in the inbox.
 */
async function startOutbound({ projectId, channelId: chId, to, text, template, user }) {
    const channel = await getChannelById(chId);
    if (!channel || channel.projectId !== projectId) throw new Error('Canal introuvable.');
    if (channel.active === false) throw new Error('Ce canal est en pause.');
    if (['facebook', 'instagram'].includes(channel.type)) {
        throw new Error('Messenger et Instagram n\'autorisent pas à écrire en premier : le client doit vous écrire d\'abord.');
    }
    let contactId = String(to || '').trim();
    if (!contactId) throw new Error('Destinataire requis.');
    if (channel.type === 'whatsapp') contactId = contactId.replace(/[^\d]/g, '');
    if (channel.type === 'sms') contactId = '+' + contactId.replace(/[^\d]/g, '');
    if (channel.type === 'email') contactId = contactId.toLowerCase();

    const convId = `${channel.type}_${contactId}`;
    const ref = conversationsRef(projectId).doc(convId);
    const snap = await ref.get();
    if (snap.exists && snap.data().optedOut) throw new Error('Ce contact s\'est désabonné (STOP).');

    let sentId;
    let content;
    if (template?.name) {
        if (channel.type !== 'whatsapp') throw new Error('Les modèles ne concernent que WhatsApp.');
        sentId = await providers.sendWhatsAppTemplate({
            token: channel.accessToken, phoneNumberId: channel.externalId, to: contactId,
            name: template.name, language: template.language || 'en_US', bodyParams: template.params || []
        });
        content = template.preview || `[Modèle WhatsApp : ${template.name}]`;
    } else {
        const body = String(text || '').trim();
        if (!body) throw new Error('Message vide.');
        sentId = await sendOnChannel(channel, contactId, body, snap.exists ? snap.data() : {});
        content = body;
    }

    await appendMessage(projectId, convId, {
        role: 'assistant', author: 'human', senderName: user?.email || null,
        content, messageId: sentId, timestamp: nowIso()
    }, {
        projectId, channelId: channel.id, channel: channel.type, contactId,
        unread: false,
        ...(snap.exists ? {} : { createdAt: nowIso(), aiEnabled: true, contactName: null })
    });
    return { convId, messageId: sentId };
}

async function getWhatsAppChannel(projectId, chId) {
    const channel = await getChannelById(chId);
    if (!channel || channel.projectId !== projectId || channel.type !== 'whatsapp') throw new Error('Canal WhatsApp introuvable.');
    return channel;
}

async function listWhatsAppTemplates(projectId, chId) {
    const ch = await getWhatsAppChannel(projectId, chId);
    return providers.listWhatsAppTemplates({ token: ch.accessToken, wabaId: ch.wabaId });
}

async function createWhatsAppTemplate(projectId, chId, input) {
    const ch = await getWhatsAppChannel(projectId, chId);
    const name = String(input.name || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    if (!name) throw new Error('Nom du modèle requis (lettres minuscules, chiffres, _).');
    const body = String(input.body || '').trim();
    if (!body) throw new Error('Texte du modèle requis.');
    const category = ['UTILITY', 'MARKETING', 'AUTHENTICATION'].includes(input.category) ? input.category : 'UTILITY';
    const varCount = (body.match(/\{\{\d+\}\}/g) || []).length;
    const examples = (input.examples || []).slice(0, varCount);
    if (varCount && examples.length < varCount) throw new Error(`Donnez un exemple pour chacune des ${varCount} variables {{n}}.`);
    return providers.createWhatsAppTemplate({ token: ch.accessToken, wabaId: ch.wabaId, name, category, language: input.language || 'fr', body, examples });
}

/** Imports new emails of one Gmail channel (or all of them) into the project inboxes. */
async function syncEmailChannel(channel) {
    return gmail.syncChannel(channel, (m) => handleInbound({
        channel,
        contactId: m.contactId,
        contactName: m.contactName,
        text: m.text,
        messageId: m.messageId,
        timestamp: m.timestamp,
        extraFields: m.threadFields
    }));
}

async function syncAllEmailChannels() {
    const snap = await db.collection('mp_channels').where('type', '==', 'email').get();
    let imported = 0;
    for (const d of snap.docs) {
        const ch = { id: d.id, ...d.data() };
        if (ch.active === false || !ch.gmailTokens) continue;
        try { imported += (await syncEmailChannel(ch)).imported; }
        catch (e) { console.error(`[MP Gmail] Sync failed for ${ch.externalId}:`, e.message); }
    }
    if (imported) console.log(`[MP Gmail] ${imported} new email(s) imported.`);
    return { channels: snap.size, imported };
}

module.exports = {
    startOutbound,
    listWhatsAppTemplates,
    createWhatsAppTemplate,
    syncEmailChannel,
    syncAllEmailChannels,
    CHANNEL_TYPES,
    setDeps,
    channelId,
    conversationsRef,
    getChannel,
    getChannelById,
    getChannelByWebhookKey,
    publicChannel,
    listChannels,
    saveChannel,
    deleteChannel,
    handleInbound,
    handleEcho,
    sendManualReply,
    previewPrompt
};
