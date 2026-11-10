/**
 * Messaging Platform (clients) — self-service channel connection (client portal + ERP).
 *
 *  - Facebook Login for Business  → the client picks its Pages (+ linked Instagram accounts);
 *    we subscribe each Page to the CLIENT Meta app and save the channels with Page tokens.
 *  - WhatsApp Embedded Signup     → the client creates/picks its WABA + number in Meta's window;
 *    we exchange the code for a business token, subscribe the app to the WABA and register the number.
 *
 * Never touches the private Quasar app: everything uses the client app (MP_META_APP_ID / MP_META_APP_SECRET).
 *
 * Env:
 *   MP_META_APP_ID            client Meta app id (default: Quasar Messaging Platform)
 *   MP_META_APP_SECRET        client app secret (first value of the comma list is used)
 *   MP_META_FB_CONFIG_ID      Facebook Login for Business configuration (Pages + Instagram)
 *   MP_META_WA_CONFIG_ID      WhatsApp Embedded Signup configuration
 *   MP_BLOCKED_META_IDS       comma list of Page / Instagram / WABA ids that must never be connected
 */
const crypto = require('crypto');
const axios = require('axios');
const core = require('./core');
const { db } = require('../firebase-admin');

const GRAPH = 'https://graph.facebook.com/v21.0';
const DEFAULT_APP_ID = '1167936292588657';
// Shared WhatsApp test account (also used by the private Quasar inbox): never subscribe it to the client app.
const ALWAYS_BLOCKED = ['1092204263808720'];

function blockedIds() {
    return new Set([...ALWAYS_BLOCKED, ...String(process.env.MP_BLOCKED_META_IDS || '').split(',').map(s => s.trim()).filter(Boolean)]);
}
const isBlockedMetaId = (id) => blockedIds().has(String(id || ''));

function appCredentials() {
    const appId = process.env.MP_META_APP_ID || DEFAULT_APP_ID;
    const secret = String(process.env.MP_META_APP_SECRET || '').split(',')[0].trim();
    if (!secret) throw new Error('MP_META_APP_SECRET manquant sur le serveur.');
    return { appId, secret };
}

/** Public settings the browser needs to open Meta's windows. */
function publicConfig() {
    return {
        appId: process.env.MP_META_APP_ID || DEFAULT_APP_ID,
        graphVersion: 'v21.0',
        fbConfigId: process.env.MP_META_FB_CONFIG_ID || null,
        waConfigId: process.env.MP_META_WA_CONFIG_ID || null
    };
}

const metaError = (err, fallback) => {
    const e = new Error(err.response?.data?.error?.message || err.message || fallback);
    e.metaError = err.response?.data?.error;
    return e;
};

/** Default agent for a self-connected channel: the project's only agent, if there is exactly one. */
async function defaultAgentId(projectId) {
    const snap = await db.collection('ai_agents').where('projectId', '==', projectId).limit(2).get();
    return snap.size === 1 ? snap.docs[0].id : null;
}

// ---------- Facebook / Instagram ----------

async function longLivedUserToken(userToken) {
    const { appId, secret } = appCredentials();
    try {
        const r = await axios.get(`${GRAPH}/oauth/access_token`, {
            params: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: secret, fb_exchange_token: userToken }
        });
        return r.data.access_token;
    } catch (err) { throw metaError(err, 'Jeton Facebook invalide.'); }
}

async function fetchPages(userToken) {
    try {
        const r = await axios.get(`${GRAPH}/me/accounts`, {
            params: { fields: 'id,name,access_token,instagram_business_account{id,username,name}', limit: 100, access_token: userToken }
        });
        return r.data?.data || [];
    } catch (err) { throw metaError(err, 'Impossible de lire vos Pages Facebook.'); }
}

/** Pages the person granted, without tokens (for the picker). */
async function listMetaAssets(userToken) {
    const pages = await fetchPages(userToken);
    return pages.map(p => ({
        id: p.id,
        name: p.name,
        blocked: isBlockedMetaId(p.id),
        instagram: p.instagram_business_account ? {
            id: p.instagram_business_account.id,
            username: p.instagram_business_account.username || p.instagram_business_account.name || '',
            blocked: isBlockedMetaId(p.instagram_business_account.id)
        } : null
    }));
}

async function connectMetaAssets({ projectId, userToken, pageIds = [], instagramIds = [] }) {
    if (!userToken) throw new Error('Connexion Facebook requise.');
    if (!pageIds.length && !instagramIds.length) throw new Error('Choisissez au moins une Page ou un compte Instagram.');
    // Page tokens obtained from a long-lived user token do not expire
    const longToken = await longLivedUserToken(userToken);
    const pages = await fetchPages(longToken);
    const agentId = await defaultAgentId(projectId);
    const results = [];

    for (const page of pages) {
        const wantPage = pageIds.includes(page.id);
        const ig = page.instagram_business_account;
        const wantIg = ig && instagramIds.includes(ig.id);
        if (!wantPage && !wantIg) continue;
        if (isBlockedMetaId(page.id) || (wantIg && isBlockedMetaId(ig.id))) {
            results.push({ name: page.name, ok: false, error: 'Ce compte ne peut pas être relié à la messagerie clients.' });
            continue;
        }
        try {
            // Messenger and Instagram DMs both arrive through the Page subscription
            await axios.post(`${GRAPH}/${page.id}/subscribed_apps`, null, {
                params: { subscribed_fields: 'messages,message_echoes', access_token: page.access_token }
            });
        } catch (err) {
            results.push({ name: page.name, ok: false, error: metaError(err).message });
            continue;
        }
        const save = async (type, externalId, label) => {
            try {
                const existing = await core.getChannel(type, externalId);
                const ch = await core.saveChannel(projectId, {
                    type, externalId, label, accessToken: page.access_token,
                    agentId: existing?.agentId || agentId,
                    aiEnabled: existing ? existing.aiEnabled !== false : !!agentId,
                    active: true
                });
                results.push({ type, name: label, ok: true, channel: core.publicChannel(ch) });
            } catch (e) {
                results.push({ type, name: label, ok: false, error: e.message });
            }
        };
        if (wantPage) await save('facebook', page.id, page.name);
        if (wantIg) await save('instagram', ig.id, ig.username ? `@${ig.username}` : (ig.name || page.name));
    }
    return results;
}

// ---------- WhatsApp Embedded Signup ----------

async function connectWhatsApp({ projectId, code, wabaId, phoneNumberId }) {
    wabaId = String(wabaId || '').replace(/[^\d]/g, '');
    phoneNumberId = String(phoneNumberId || '').replace(/[^\d]/g, '');
    if (!code || !wabaId || !phoneNumberId) throw new Error('Inscription WhatsApp incomplète : recommencez depuis le bouton « Connecter WhatsApp ».');
    if (isBlockedMetaId(wabaId) || isBlockedMetaId(phoneNumberId)) throw new Error('Ce compte WhatsApp ne peut pas être relié à la messagerie clients.');

    const { appId, secret } = appCredentials();
    let token;
    try {
        const r = await axios.get(`${GRAPH}/oauth/access_token`, { params: { client_id: appId, client_secret: secret, code } });
        token = r.data.access_token;
    } catch (err) { throw metaError(err, 'Code Meta invalide ou expiré.'); }

    // The number must belong to the WABA the token was granted for
    let phone;
    try {
        const r = await axios.get(`${GRAPH}/${wabaId}/phone_numbers`, {
            params: { fields: 'id,display_phone_number,verified_name', access_token: token }
        });
        phone = (r.data?.data || []).find(p => p.id === phoneNumberId);
    } catch (err) { throw metaError(err, 'Compte WhatsApp inaccessible.'); }
    if (!phone) throw new Error('Ce numéro n\'appartient pas au compte WhatsApp autorisé.');

    try {
        await axios.post(`${GRAPH}/${wabaId}/subscribed_apps`, null, { params: { access_token: token } });
    } catch (err) { throw metaError(err, 'Abonnement du compte WhatsApp impossible.'); }

    // New numbers must be registered for Cloud API; an already registered number returns an error we can ignore
    const pin = String(crypto.randomInt(100000, 999999));
    let registerWarning = null;
    try {
        await axios.post(`${GRAPH}/${phoneNumberId}/register`, { messaging_product: 'whatsapp', pin }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
        registerWarning = metaError(err).message;
        console.warn(`[MP Connect] WhatsApp register ${phoneNumberId}: ${registerWarning}`);
    }

    const existing = await core.getChannel('whatsapp', phoneNumberId);
    const agentId = existing?.agentId || await defaultAgentId(projectId);
    const ch = await core.saveChannel(projectId, {
        type: 'whatsapp', externalId: phoneNumberId, wabaId, accessToken: token,
        label: [phone.verified_name, phone.display_phone_number].filter(Boolean).join(' · '),
        agentId, aiEnabled: existing ? existing.aiEnabled !== false : !!agentId, active: true
    });
    if (!registerWarning) await db.collection('mp_channels').doc(ch.id).set({ registrationPin: pin }, { merge: true });
    return { channel: core.publicChannel(ch), registerWarning };
}

module.exports = { publicConfig, listMetaAssets, connectMetaAssets, connectWhatsApp, isBlockedMetaId };
