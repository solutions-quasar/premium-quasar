/**
 * Messaging Platform (clients) — outbound providers.
 * Self-contained copies of the Quasar send helpers, so changes here never affect
 * the private Quasar inbox (server.js / twilio-service.js).
 */
const axios = require('axios');
const twilio = require('twilio');

const GRAPH_VERSION = 'v21.0';

function graphHostFor(token) {
    return String(token || '').startsWith('IG') ? 'graph.instagram.com' : 'graph.facebook.com';
}

function wrapMetaError(err, fallback) {
    const details = err.response?.data?.error || { message: err.message };
    const e = new Error(details.message || fallback);
    e.metaError = details;
    return e;
}

/** Messenger / Instagram DM. Returns Meta's message id. */
async function sendMetaDM({ token, recipientId, text }) {
    if (!token) throw new Error('Aucun jeton Meta configuré pour ce canal.');
    try {
        const res = await axios.post(`https://${graphHostFor(token)}/${GRAPH_VERSION}/me/messages`, {
            recipient: { id: recipientId },
            messaging_type: 'RESPONSE',
            message: { text }
        }, { headers: { Authorization: `Bearer ${token}` } });
        return res.data?.message_id || null;
    } catch (err) {
        const e = wrapMetaError(err, 'Erreur API Meta');
        const me = e.metaError || {};
        if ([2018278, 2534022].includes(me.error_subcode)) {
            e.message = "Plus de 24 h depuis le dernier message du client : Meta refuse les messages libres.";
        }
        throw e;
    }
}

/** WhatsApp Cloud API text message. Returns the wamid. */
async function sendWhatsApp({ token, phoneNumberId, to, text }) {
    if (!token || !phoneNumberId) throw new Error('Jeton ou phone_number_id WhatsApp manquant pour ce canal.');
    try {
        const res = await axios.post(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: String(to).replace(/[^\d]/g, ''),
            type: 'text',
            text: { preview_url: false, body: text }
        }, { headers: { Authorization: `Bearer ${token}` } });
        return res.data?.messages?.[0]?.id || null;
    } catch (err) {
        const e = wrapMetaError(err, 'Erreur API WhatsApp');
        if (e.metaError?.code === 131047) {
            e.message = "Plus de 24 h depuis le dernier message du client : WhatsApp exige un modèle de message approuvé.";
        }
        throw e;
    }
}

/** WhatsApp approved template message (business-initiated, outside the 24 h window). */
async function sendWhatsAppTemplate({ token, phoneNumberId, to, name, language = 'en_US', bodyParams = [] }) {
    if (!token || !phoneNumberId) throw new Error('Jeton ou phone_number_id WhatsApp manquant pour ce canal.');
    const template = { name, language: { code: language } };
    if (bodyParams.length) template.components = [{ type: 'body', parameters: bodyParams.map(t => ({ type: 'text', text: String(t) })) }];
    try {
        const res = await axios.post(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
            messaging_product: 'whatsapp', to: String(to).replace(/[^\d]/g, ''), type: 'template', template
        }, { headers: { Authorization: `Bearer ${token}` } });
        return res.data?.messages?.[0]?.id || null;
    } catch (err) {
        throw wrapMetaError(err, 'Erreur API WhatsApp');
    }
}

/** Message templates of a WhatsApp Business Account. */
async function listWhatsAppTemplates({ token, wabaId }) {
    if (!wabaId) throw new Error('ID du compte WhatsApp Business (WABA) manquant : ajoutez-le dans le canal.');
    try {
        const res = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`, {
            params: { fields: 'name,status,category,language,components,rejected_reason', limit: 100 },
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.data?.data || [];
    } catch (err) {
        throw wrapMetaError(err, 'Erreur API WhatsApp');
    }
}

/** Creates a text template (body with optional {{1}} variables + examples). Meta reviews it. */
async function createWhatsAppTemplate({ token, wabaId, name, category, language, body, examples = [] }) {
    if (!wabaId) throw new Error('ID du compte WhatsApp Business (WABA) manquant : ajoutez-le dans le canal.');
    const bodyComponent = { type: 'BODY', text: body };
    if (examples.length) bodyComponent.example = { body_text: [examples.map(String)] };
    try {
        const res = await axios.post(`https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`, {
            name, category, language, components: [bodyComponent]
        }, { headers: { Authorization: `Bearer ${token}` } });
        return res.data; // { id, status, category }
    } catch (err) {
        throw wrapMetaError(err, 'Erreur API WhatsApp');
    }
}

/** Twilio client for a channel: its own credentials first, then the server's. */
function twilioClientFor(channel) {
    if (channel.twilioAccountSid && channel.twilioAuthToken) {
        return twilio(channel.twilioAccountSid, channel.twilioAuthToken);
    }
    const sid = process.env.TWILIO_ACCOUNT_SID;
    if (process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET && sid) {
        return twilio(process.env.TWILIO_API_KEY_SID, process.env.TWILIO_API_KEY_SECRET, { accountSid: sid });
    }
    if (sid && process.env.TWILIO_AUTH_TOKEN) return twilio(sid, process.env.TWILIO_AUTH_TOKEN);
    throw new Error('Aucun identifiant Twilio disponible pour ce canal.');
}

/** SMS via Twilio. channel.externalId is the sending number (E.164). Returns the SID. */
async function sendSms({ channel, to, text }) {
    const client = twilioClientFor(channel);
    const msg = await client.messages.create({ from: channel.externalId, to, body: text });
    return msg.sid;
}

/** Display name of a Messenger / Instagram user (best effort). */
async function getMetaProfile({ token, userId, type }) {
    if (!token) return null;
    try {
        const fields = type === 'instagram' ? 'name,username' : 'first_name,last_name';
        const res = await axios.get(`https://${graphHostFor(token)}/${GRAPH_VERSION}/${userId}`, {
            params: { fields },
            headers: { Authorization: `Bearer ${token}` }
        });
        const p = res.data || {};
        if (type === 'instagram') return p.name || (p.username ? `@${p.username}` : null);
        return p.first_name ? `${p.first_name} ${p.last_name || ''}`.trim() : null;
    } catch (_) {
        return null;
    }
}

/**
 * Checks a token against the Graph API; returns the account it belongs to.
 * Facebook tokens go through debug_token (works with pages_messaging only);
 * Instagram Login tokens (IG…) through graph.instagram.com/me.
 */
async function inspectMetaToken(token) {
    if (!token) throw new Error('Aucun jeton enregistré pour ce canal.');
    if (String(token).startsWith('IG')) {
        const res = await axios.get(`https://graph.instagram.com/${GRAPH_VERSION}/me`, {
            params: { fields: 'user_id,username' },
            headers: { Authorization: `Bearer ${token}` }
        });
        return { id: res.data.user_id || res.data.id, name: res.data.username ? `@${res.data.username}` : '' };
    }
    const res = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/debug_token`, {
        params: { input_token: token, access_token: token }
    });
    const d = res.data?.data || {};
    if (!d.is_valid) throw new Error(d.error?.message || 'Jeton invalide ou expiré.');
    const expires = d.expires_at ? new Date(d.expires_at * 1000).toLocaleDateString('fr-CA') : 'jamais';
    return {
        id: d.profile_id || d.user_id || '',
        name: `${d.type === 'PAGE' ? 'Page' : d.type || 'Jeton'}, app ${d.app_id}, expire : ${expires}, permissions : ${(d.scopes || []).join(', ')}`
    };
}

module.exports = {
    sendMetaDM, sendWhatsApp, sendSms, getMetaProfile, inspectMetaToken,
    sendWhatsAppTemplate, listWhatsAppTemplates, createWhatsAppTemplate
};
