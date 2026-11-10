/**
 * Messaging Platform (clients) — HTTP routes, mounted under /api/mp.
 *
 * Separate from the private Quasar inbox (/api/webhook/meta, /api/sms/*):
 *   GET/POST /api/mp/webhook/meta              Meta webhook of the CLIENT Meta app
 *   POST     /api/mp/sms/twilio/:webhookKey    Twilio inbound SMS for a client number
 *   /api/mp/projects/:projectId/...            Inbox + channel management (auth)
 *
 * Env:
 *   MP_META_VERIFY_TOKEN      verify token for the client Meta app webhook
 *   MP_META_APP_SECRET        app secret(s) of the client Meta app (comma separated)
 *   MP_META_ALLOW_UNSIGNED    "true" to accept unsigned webhooks (local tests only)
 *   MP_PUBLIC_BASE_URL        public base URL used for Twilio signature checks
 */
const crypto = require('crypto');
const express = require('express');
const twilio = require('twilio');
const core = require('./core');
const promptLayers = require('./prompt');
const { db } = require('../firebase-admin');
const gmail = require('./gmail');

// Local dev uses http://localhost:<port>; production uses the public hosting URL
function serverUrlFor(req) {
    const host = req.get('host') || '';
    if (/localhost|127\.0\.0\.1/.test(host)) return `http://${host}`;
    return process.env.MP_PUBLIC_BASE_URL || process.env.SERVER_URL || 'https://quasar-erp-b26d5.web.app';
}

const DEFAULT_BASE_URL = 'https://quasar-erp-b26d5.web.app';

// ---------- Security helpers ----------

function verifyMetaSignature(req) {
    const secrets = (process.env.MP_META_APP_SECRET || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!secrets.length) {
        if (process.env.MP_META_ALLOW_UNSIGNED === 'true') return true;
        console.error('[MP Meta] MP_META_APP_SECRET manquant : webhook refusé.');
        return false;
    }
    const signature = req.get('x-hub-signature-256') || '';
    if (!signature.startsWith('sha256=') || !req.rawBody) return false;
    const received = Buffer.from(signature.slice(7), 'hex');
    return secrets.some(secret => {
        const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest();
        return expected.length === received.length && crypto.timingSafeEqual(expected, received);
    });
}

/** ERP staff can access every project; portal clients only their own. */
function canAccessProject(user, projectId) {
    if (!user) return false;
    if (user.role === 'client') return user.projectId === projectId;
    return true;
}

function requireProjectAccess(req, res, next) {
    if (!canAccessProject(req.user, req.params.projectId)) {
        return res.status(403).json({ success: false, error: 'Accès refusé à ce projet.' });
    }
    next();
}

function requireStaff(req, res, next) {
    if (req.user?.role === 'client') {
        return res.status(403).json({ success: false, error: 'Réservé à l\'administrateur.' });
    }
    next();
}

// ---------- Meta parsing (copied from Quasar, kept independent) ----------

function describeWhatsAppMessage(m) {
    const cap = (o) => o?.caption ? ` ${o.caption}` : '';
    switch (m.type) {
        case 'text': return { text: m.text?.body || '', isRealText: true };
        case 'button': return { text: m.button?.text || '', isRealText: true };
        case 'interactive': return { text: m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '', isRealText: true };
        case 'image': return { text: `[📷 Photo]${cap(m.image)}`, isRealText: !!m.image?.caption };
        case 'video': return { text: `[🎬 Vidéo]${cap(m.video)}`, isRealText: !!m.video?.caption };
        case 'document': return { text: `[📄 Document${m.document?.filename ? ' : ' + m.document.filename : ''}]${cap(m.document)}`, isRealText: !!m.document?.caption };
        case 'audio': return { text: m.audio?.voice ? '[🎤 Message vocal]' : '[🎵 Audio]', isRealText: false };
        case 'sticker': return { text: '[Autocollant]', isRealText: false };
        case 'location': return { text: `[📍 Position] https://maps.google.com/?q=${m.location?.latitude},${m.location?.longitude}`, isRealText: false };
        case 'contacts': return { text: `[👤 Contact partagé : ${m.contacts?.[0]?.name?.formatted_name || ''}]`, isRealText: false };
        case 'reaction': return { text: '', isRealText: false };
        default: return { text: '[Message non pris en charge — voir WhatsApp]', isRealText: false };
    }
}

function describeMetaMessage(msg) {
    if (!msg || msg.is_deleted) return { text: '', isRealText: false };
    const parts = [];
    if (msg.reply_to?.story) parts.push('[↩️ Réponse à votre story]');
    for (const a of msg.attachments || []) {
        const url = a.payload?.url ? ` ${a.payload.url}` : '';
        const map = { image: '[📷 Photo]', video: '[🎬 Vidéo]', file: '[📄 Fichier]', story_mention: '[📣 Mention dans une story]', share: '[🔗 Publication partagée]', ig_reel: '[🔗 Reel partagé]', reel: '[🔗 Reel partagé]' };
        if (a.type === 'audio') parts.push('[🎤 Message vocal]');
        else if (a.type === 'location') parts.push('[📍 Position]');
        else parts.push(`${map[a.type] || `[Pièce jointe : ${a.type}]`}${url}`);
    }
    if (msg.is_unsupported) parts.push('[Message non pris en charge — voir l\'application]');
    if (msg.text) parts.push(msg.text);
    return { text: parts.join('\n').trim(), isRealText: !!msg.text };
}

async function processMetaPayload(body) {
    const jobs = [];

    if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry || []) {
            for (const change of entry.changes || []) {
                const value = change.value || {};
                if (!value.messages?.length) continue; // statuses, etc.
                const channel = await core.getChannel('whatsapp', value.metadata?.phone_number_id);
                if (!channel) {
                    console.warn(`[MP Meta] No client channel for WhatsApp phone_number_id ${value.metadata?.phone_number_id}`);
                    continue;
                }
                const contactName = value.contacts?.[0]?.profile?.name || null;
                for (const m of value.messages) {
                    const { text, isRealText } = describeWhatsAppMessage(m);
                    if (!text) continue;
                    jobs.push(core.handleInbound({
                        channel, contactId: m.from, text, isRealText, messageId: m.id, contactName,
                        timestamp: m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : null
                    }));
                }
            }
        }
    } else if (body.object === 'page' || body.object === 'instagram') {
        const type = body.object === 'instagram' ? 'instagram' : 'facebook';
        for (const entry of body.entry || []) {
            const channel = await core.getChannel(type, entry.id);
            if (!channel) {
                console.warn(`[MP Meta] No client channel for ${type} ${entry.id}`);
                continue;
            }
            for (const ev of entry.messaging || []) {
                const msg = ev.message;
                if (!msg) continue; // reads, reactions, postbacks
                const { text, isRealText } = describeMetaMessage(msg);
                if (!text) continue;
                if (msg.is_echo) {
                    jobs.push(core.handleEcho({ channel, contactId: String(ev.recipient?.id), text, messageId: msg.mid }));
                } else {
                    jobs.push(core.handleInbound({
                        channel, contactId: String(ev.sender?.id), text, isRealText, messageId: msg.mid,
                        timestamp: ev.timestamp ? new Date(Number(ev.timestamp)).toISOString() : null
                    }));
                }
            }
        }
    }

    const results = await Promise.allSettled(jobs);
    results.filter(r => r.status === 'rejected').forEach(r => console.error('[MP Meta] Job failed:', r.reason?.message || r.reason));
}

// ---------- Router ----------

function createRouter({ verifyToken }) {
    const router = express.Router();

    // Meta webhook verification (client Meta app)
    router.get('/webhook/meta', (req, res) => {
        const expected = (process.env.MP_META_VERIFY_TOKEN || '').trim();
        if (expected && req.query['hub.mode'] === 'subscribe' && (req.query['hub.verify_token'] || '').trim() === expected) {
            return res.status(200).send(req.query['hub.challenge']);
        }
        res.sendStatus(403);
    });

    router.post('/webhook/meta', async (req, res) => {
        if (!verifyMetaSignature(req)) {
            console.warn('[MP Meta] Invalid signature — rejected.');
            return res.sendStatus(403);
        }
        try {
            await processMetaPayload(req.body || {});
        } catch (e) {
            console.error('[MP Meta] Processing error:', e.message);
        }
        res.sendStatus(200);
    });

    // Twilio inbound SMS. The webhook key in the URL identifies the channel;
    // the Twilio signature is also checked when the channel has its own auth token.
    router.post('/sms/twilio/:webhookKey', async (req, res) => {
        const channel = await core.getChannelByWebhookKey(req.params.webhookKey).catch(() => null);
        if (!channel || channel.type !== 'sms') return res.sendStatus(404);

        const authToken = channel.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN;
        if (authToken) {
            const url = `${process.env.MP_PUBLIC_BASE_URL || DEFAULT_BASE_URL}/api/mp/sms/twilio/${req.params.webhookKey}`;
            if (!twilio.validateRequest(authToken, req.get('x-twilio-signature') || '', url, req.body || {})) {
                console.warn(`[MP SMS] Invalid Twilio signature for channel ${channel.id}`);
                return res.sendStatus(403);
            }
        }

        const { From, Body, MessageSid, NumMedia } = req.body || {};
        if (From) {
            const media = Number(NumMedia || 0) > 0 ? '[📷 Pièce jointe MMS]' : '';
            const text = [media, Body].filter(Boolean).join('\n').trim();
            if (text) {
                await core.handleInbound({ channel, contactId: From, text, isRealText: !!Body, messageId: MessageSid })
                    .catch(e => console.error('[MP SMS] Inbound failed:', e.message));
            }
        }
        res.type('text/xml').send('<Response></Response>');
    });

    // ----- Authenticated inbox API -----
    const auth = [verifyToken, requireProjectAccess];

    router.get('/projects/:projectId/conversations', auth, async (req, res) => {
        try {
            const snap = await core.conversationsRef(req.params.projectId).orderBy('lastMessageAt', 'desc').limit(200).get();
            const conversations = snap.docs.map(d => {
                const { messages, ...rest } = d.data();
                return { id: d.id, ...rest, messageCount: (messages || []).length };
            });
            res.json({ success: true, conversations });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    router.get('/projects/:projectId/conversations/:convId', auth, async (req, res) => {
        try {
            const ref = core.conversationsRef(req.params.projectId).doc(req.params.convId);
            const snap = await ref.get();
            if (!snap.exists) return res.status(404).json({ success: false, error: 'Conversation introuvable.' });
            if (snap.data().unread) await ref.set({ unread: false }, { merge: true });
            res.json({ success: true, conversation: { id: snap.id, ...snap.data(), unread: false } });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    router.post('/projects/:projectId/conversations/:convId/reply', auth, async (req, res) => {
        const text = String(req.body?.text || '').trim();
        if (!text) return res.status(400).json({ success: false, error: 'Message vide.' });
        try {
            const messageId = await core.sendManualReply({ projectId: req.params.projectId, convId: req.params.convId, text, user: req.user });
            res.json({ success: true, messageId });
        } catch (e) {
            res.status(400).json({ success: false, error: e.message });
        }
    });

    router.patch('/projects/:projectId/conversations/:convId', auth, async (req, res) => {
        try {
            const update = {};
            if (typeof req.body?.aiEnabled === 'boolean') update.aiEnabled = req.body.aiEnabled;
            if (typeof req.body?.unread === 'boolean') update.unread = req.body.unread;
            if (typeof req.body?.contactName === 'string') update.contactName = req.body.contactName.trim().slice(0, 120);
            if (!Object.keys(update).length) return res.status(400).json({ success: false, error: 'Rien à modifier.' });
            await core.conversationsRef(req.params.projectId).doc(req.params.convId).set(update, { merge: true });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // ----- Channel management (ERP staff only: holds provider tokens) -----
    const staff = [verifyToken, requireStaff];

    router.get('/projects/:projectId/channels', staff, async (req, res) => {
        try {
            const channels = await core.listChannels(req.params.projectId);
            res.json({ success: true, channels: channels.map(c => core.publicChannel(c, { withWebhookKey: true })) });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    router.post('/projects/:projectId/channels', staff, async (req, res) => {
        try {
            const ch = await core.saveChannel(req.params.projectId, req.body || {});
            res.json({ success: true, channel: core.publicChannel(ch, { withWebhookKey: true }) });
        } catch (e) {
            res.status(400).json({ success: false, error: e.message });
        }
    });

    router.delete('/projects/:projectId/channels/:channelId', staff, async (req, res) => {
        try {
            await core.deleteChannel(req.params.projectId, req.params.channelId);
            res.json({ success: true });
        } catch (e) {
            res.status(400).json({ success: false, error: e.message });
        }
    });

    // Test a channel's token against the Graph API
    router.post('/projects/:projectId/channels/:channelId/test', staff, async (req, res) => {
        try {
            const ch = await core.getChannelById(req.params.channelId);
            if (!ch || ch.projectId !== req.params.projectId) return res.status(404).json({ success: false, error: 'Canal introuvable.' });
            if (ch.type === 'sms') return res.json({ success: true, info: 'Canal SMS : envoyez un SMS au numéro pour tester.' });
            if (ch.type === 'email') {
                // "Test" on a Gmail channel = sync now
                const { imported } = await core.syncEmailChannel(ch);
                return res.json({ success: true, info: `Gmail synchronisé : ${imported} nouveau(x) courriel(s).` });
            }
            const me = await require('./providers').inspectMetaToken(ch.accessToken);
            res.json({ success: true, account: me });
        } catch (e) {
            res.status(400).json({ success: false, error: e.response?.data?.error?.message || e.message });
        }
    });

    // ----- Gmail per project -----
    // Returns the Google sign-in URL; the signed state carries the project, agent and return page.
    router.get('/projects/:projectId/gmail/auth-url', staff, (req, res) => {
        try {
            const url = gmail.getAuthUrl({
                projectId: req.params.projectId,
                agentId: req.query.agentId || null,
                aiEnabled: req.query.aiEnabled === 'true',
                label: req.query.label || null,
                returnTo: req.query.returnTo || null,
                serverUrl: serverUrlFor(req)
            });
            res.json({ success: true, url });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // Google redirects here (no ERP session): the state signature identifies the project.
    router.get('/gmail/callback', async (req, res) => {
        const back = (returnTo, params) => {
            const target = returnTo && /^https?:\/\//.test(returnTo) ? returnTo : `${DEFAULT_BASE_URL}/erp/index.html#ai-agents`;
            const sep = target.includes('?') ? '&' : (target.includes('#') ? '?' : '?');
            return `${target}${sep}${params}`;
        };
        let returnTo = null;
        try {
            if (req.query.error) throw new Error(`Google : ${req.query.error}`);
            const r = await gmail.handleCallback({ code: req.query.code, state: req.query.state, serverUrl: serverUrlFor(req) });
            returnTo = r.returnTo;
            res.redirect(back(returnTo, `gmail=connected&email=${encodeURIComponent(r.email)}`));
        } catch (e) {
            console.error('[MP Gmail] Callback error:', e.message);
            res.redirect(back(returnTo, `gmail=error&message=${encodeURIComponent(e.message)}`));
        }
    });

    // ----- Platform rules (layer 1, shared by all client agents) -----
    router.get('/platform/prompt', staff, async (req, res) => {
        try {
            res.json({ success: true, ...(await promptLayers.getPlatformRules()) });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    router.put('/platform/prompt', staff, async (req, res) => {
        try {
            const { rules, reset } = req.body || {};
            if (!reset && (!rules || String(rules).trim().length < 20)) {
                return res.status(400).json({ success: false, error: 'Les règles sont vides ou trop courtes.' });
            }
            if (rules && String(rules).length > 20000) return res.status(400).json({ success: false, error: 'Règles trop longues (20 000 caractères max).' });
            await promptLayers.setPlatformRules(reset ? null : rules, req.user);
            res.json({ success: true, ...(await promptLayers.getPlatformRules()) });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // Final prompt an agent receives on a channel (all layers assembled)
    router.get('/projects/:projectId/agents/:agentId/prompt-preview', staff, async (req, res) => {
        try {
            const preview = await core.previewPrompt({
                projectId: req.params.projectId,
                agentId: req.params.agentId,
                channelType: core.CHANNEL_TYPES.includes(req.query.channel) ? req.query.channel : 'sms'
            });
            res.json({ success: true, ...preview });
        } catch (e) {
            res.status(400).json({ success: false, error: e.message });
        }
    });

    // Generate an agent's own instructions (layer 2) from a business brief.
    // The brief is saved on the agent (promptBrief) so it can be edited and regenerated later;
    // the generated text is only returned: the user reviews it and saves the agent from the ERP.
    router.post('/projects/:projectId/generate-prompt', staff, async (req, res) => {
        try {
            const { brief, agentId } = req.body || {};
            const { projectId } = req.params;
            let agent = null;
            if (agentId) {
                const snap = await db.collection('ai_agents').doc(agentId).get();
                if (!snap.exists) return res.status(404).json({ success: false, error: 'Agent introuvable.' });
                agent = snap.data();
                const agentProject = agent.knowledgeBase?.projectId || agent.projectId;
                if (agentProject && agentProject !== projectId) return res.status(403).json({ success: false, error: 'Agent rattaché à un autre projet.' });
            }
            const projectSnap = await db.collection('ai_projects').doc(projectId).get();
            const fullAgent = !!projectSnap.data()?.serviceAccountKey;
            const tools = Object.entries(agent?.tools || {}).filter(([, on]) => on === true).map(([n]) => n);
            const result = await promptLayers.generateAgentPrompt({ brief, fullAgent, tools });
            if (agentId) {
                await db.collection('ai_agents').doc(agentId).set({ promptBrief: result.brief, promptBriefUpdatedAt: new Date().toISOString() }, { merge: true });
            }
            res.json({ success: true, prompt: result.prompt, brief: result.brief, mode: fullAgent ? 'full' : 'prompt' });
        } catch (e) {
            res.status(400).json({ success: false, error: e.message });
        }
    });

    // Simulate an inbound message (records the AI reply without sending it)
    router.post('/projects/:projectId/simulate', staff, async (req, res) => {
        try {
            const { channelId, text, contactId } = req.body || {};
            const ch = await core.getChannelById(channelId);
            if (!ch || ch.projectId !== req.params.projectId) return res.status(404).json({ success: false, error: 'Canal introuvable.' });
            if (!text) return res.status(400).json({ success: false, error: 'Texte requis.' });
            const result = await core.handleInbound({
                channel: ch,
                contactId: contactId || 'simulation',
                contactName: 'Simulation',
                text: String(text),
                messageId: `sim_${Date.now()}`,
                dryRun: true
            });
            res.json({ success: true, ...result });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    return router;
}

/** Mounts the client messaging platform on the Express app. */
function mountMessagingPlatform(app, { verifyToken, processAiChat }) {
    core.setDeps({ processAiChat });
    app.use('/api/mp', createRouter({ verifyToken }));
    console.log('[Messaging Platform] Routes mounted on /api/mp');
}

module.exports = { mountMessagingPlatform, syncAllEmailChannels: core.syncAllEmailChannels };
