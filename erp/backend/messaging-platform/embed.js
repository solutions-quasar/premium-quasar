/**
 * Messaging Platform — embeddable inbox for other apps (widget / iframe).
 *
 * 1. In the ERP, staff creates an integration key for a project: qmp_live_<keyId>_<secret>.
 *    Only a SHA-256 hash is stored (mp_embed_keys/{keyId}); the key is shown once.
 * 2. The other app's BACKEND exchanges the key for a short-lived session token
 *    (POST /api/mp/embed/session). The key never goes to a browser.
 * 3. The app's frontend loads /embed/sdk.js and mounts the inbox; the iframe calls the inbox API
 *    with the session token (Bearer emb_…), limited to that project's inbox.
 */
const crypto = require('crypto');
const { db } = require('../firebase-admin');

const KEYS = () => db.collection('mp_embed_keys');
const DEFAULT_TTL = 60 * 60;          // 1 h
const MAX_TTL = 12 * 60 * 60;         // 12 h
let signingSecret = null;

/** HMAC secret for session tokens: env first, else one generated once and kept in Firestore. */
async function getSigningSecret() {
    if (process.env.MP_EMBED_SECRET) return process.env.MP_EMBED_SECRET;
    if (signingSecret) return signingSecret;
    const ref = db.collection('mp_settings').doc('embed');
    signingSecret = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists && snap.data().secret) return snap.data().secret;
        const secret = crypto.randomBytes(48).toString('hex');
        tx.set(ref, { secret, createdAt: new Date().toISOString() });
        return secret;
    });
    return signingSecret;
}

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const fromB64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// ---------- Integration keys (staff) ----------

async function createKey(projectId, { label, user }) {
    const keyId = crypto.randomBytes(6).toString('hex');
    const secret = crypto.randomBytes(24).toString('hex');
    await KEYS().doc(keyId).set({
        projectId, hash: sha256(secret), label: String(label || '').slice(0, 80) || null,
        createdAt: new Date().toISOString(), createdBy: user?.email || null, revoked: false, lastUsedAt: null
    });
    return { id: keyId, key: `qmp_live_${keyId}_${secret}` };
}

async function listKeys(projectId) {
    const snap = await KEYS().where('projectId', '==', projectId).get();
    return snap.docs.map(d => {
        const k = d.data();
        return { id: d.id, label: k.label, createdAt: k.createdAt, createdBy: k.createdBy, lastUsedAt: k.lastUsedAt, revoked: !!k.revoked, preview: `qmp_live_${d.id}_••••` };
    }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function revokeKey(projectId, keyId) {
    const ref = KEYS().doc(keyId);
    const snap = await ref.get();
    if (!snap.exists || snap.data().projectId !== projectId) throw new Error('Clé introuvable.');
    await ref.set({ revoked: true, revokedAt: new Date().toISOString() }, { merge: true });
}

/** Returns the project of a valid, non-revoked key, or throws. */
async function checkKey(rawKey) {
    const m = /^qmp_live_([a-f0-9]{12})_([a-f0-9]{48})$/.exec(String(rawKey || '').trim());
    if (!m) throw new Error('Clé d\'intégration invalide.');
    const snap = await KEYS().doc(m[1]).get();
    const k = snap.exists ? snap.data() : null;
    const ok = k && !k.revoked && crypto.timingSafeEqual(Buffer.from(k.hash, 'hex'), Buffer.from(sha256(m[2]), 'hex'));
    if (!ok) throw new Error('Clé d\'intégration invalide ou révoquée.');
    KEYS().doc(m[1]).set({ lastUsedAt: new Date().toISOString() }, { merge: true }).catch(() => { });
    return { projectId: k.projectId, keyId: m[1] };
}

// ---------- Session tokens ----------

async function createSession({ projectId, keyId = null, userName = null, ttl = DEFAULT_TTL }) {
    const exp = Math.floor(Date.now() / 1000) + Math.min(Math.max(60, Number(ttl) || DEFAULT_TTL), MAX_TTL);
    const payload = b64url(JSON.stringify({ p: projectId, k: keyId, n: userName ? String(userName).slice(0, 80) : null, exp }));
    const sig = b64url(crypto.createHmac('sha256', await getSigningSecret()).update(payload).digest());
    return { token: `emb_${payload}.${sig}`, expiresAt: new Date(exp * 1000).toISOString() };
}

async function verifySession(token) {
    const m = /^emb_([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(token || ''));
    if (!m) return null;
    const expected = crypto.createHmac('sha256', await getSigningSecret()).update(m[1]).digest();
    const got = fromB64url(m[2]);
    if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return null;
    let data;
    try { data = JSON.parse(fromB64url(m[1]).toString('utf8')); } catch (_) { return null; }
    if (!data.p || !data.exp || data.exp * 1000 < Date.now()) return null;
    // A revoked key also ends the sessions it created
    if (data.k) {
        const k = await KEYS().doc(data.k).get();
        if (!k.exists || k.data().revoked) return null;
    }
    return { projectId: data.p, userName: data.n || null };
}

module.exports = { createKey, listKeys, revokeKey, checkKey, createSession, verifySession };
