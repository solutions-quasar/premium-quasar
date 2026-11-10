/**
 * Messaging Platform — self-service channel connection (client portal "Connect" tab).
 * Facebook Login for Business (Pages + Instagram), WhatsApp Embedded Signup, Gmail OAuth.
 * Talks to /api/mp/projects/:projectId/connect/* (see erp/backend/messaging-platform/connect.js).
 */

const isEn = () => { try { return (localStorage.getItem('erp_lang') || 'en') !== 'fr'; } catch (_) { return true; } };
const L = (fr, en) => (isEn() ? en : fr);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TYPES = {
    facebook: { label: 'Messenger', icon: 'chat', color: '#0084ff' },
    instagram: { label: 'Instagram', icon: 'photo_camera', color: '#e1306c' },
    whatsapp: { label: 'WhatsApp', icon: 'forum', color: '#25d366' },
    email: { get label() { return L('Courriel', 'Email'); }, icon: 'mail', color: '#ea4335' },
    sms: { label: 'SMS', icon: 'sms', color: '#dfa53a' }
};
const SUPPORT_EMAIL = 'info@solutionsquasar.ca';

const STYLES = `
.mpc { display:flex; flex-direction:column; gap:14px; }
.mpc-head { display:flex; align-items:flex-start; gap:12px; }
.mpc-title { font-weight:700; font-size:1.05rem; }
.mpc-dim { color:var(--text-dim, var(--text-muted, #94a3b8)); font-size:.8rem; line-height:1.45; }
.mpc-tiles { display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); gap:10px; }
.mpc-tile { display:flex; flex-direction:column; gap:10px; padding:14px; border-radius:12px; background:rgba(0,0,0,.2); border:1px solid var(--border, #2d3139); }
.mpc-tile-top { display:flex; align-items:center; gap:10px; }
.mpc-ico { width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.mpc-btn { border:0; border-radius:9px; padding:9px 12px; font-weight:700; font-size:.82rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; }
.mpc-btn:disabled { opacity:.45; cursor:not-allowed; }
.mpc-btn.ghost { background:transparent; color:inherit; border:1px solid var(--border, #2d3139); }
.mpc-list { display:flex; flex-direction:column; border:1px solid var(--border, #2d3139); border-radius:12px; overflow:hidden; }
.mpc-row { display:flex; align-items:center; gap:12px; padding:10px 14px; border-top:1px solid var(--border, #2d3139); }
.mpc-row:first-child { border-top:0; }
.mpc-chip { font-size:.7rem; padding:2px 8px; border-radius:20px; white-space:nowrap; }
.mpc-chip.ok { color:#3ecf8e; background:#3ecf8e14; border:1px solid #3ecf8e55; }
.mpc-chip.warn { color:#f5a524; background:#f5a52414; border:1px solid #f5a52455; }
.mpc-note { padding:10px 12px; border-radius:10px; font-size:.82rem; display:flex; gap:8px; align-items:flex-start; }
.mpc-note.ok { background:#3ecf8e14; border:1px solid #3ecf8e55; }
.mpc-note.err { background:#ef444414; border:1px solid #ef444455; }
.mpc-note.info { background:rgba(223,165,58,.08); border:1px solid rgba(223,165,58,.3); }
.mpc-modal { position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,.8); display:flex; align-items:center; justify-content:center; padding:20px; }
.mpc-modal > div { width:min(520px, 100%); max-height:90vh; overflow-y:auto; background:var(--bg-card, #121418); border:1px solid rgba(223,165,58,.4); border-radius:14px; padding:18px; }
.mpc-check { display:flex; align-items:center; gap:10px; padding:9px 0; border-top:1px solid var(--border, #2d3139); cursor:pointer; }
`;

// Facebook JS SDK, loaded once; FB.login must then run directly in the click handler (popup blockers).
let fbPromise = null;
function loadFacebookSdk(appId, version) {
    if (window.FB) return Promise.resolve(window.FB);
    if (fbPromise) return fbPromise;
    fbPromise = new Promise((resolve, reject) => {
        window.fbAsyncInit = () => {
            window.FB.init({ appId, autoLogAppEvents: false, xfbml: false, version });
            resolve(window.FB);
        };
        const s = document.createElement('script');
        s.src = 'https://connect.facebook.net/en_US/sdk.js';
        s.async = true; s.defer = true; s.crossOrigin = 'anonymous';
        s.onerror = () => { fbPromise = null; reject(new Error('Facebook SDK')); };
        document.head.appendChild(s);
    });
    return fbPromise;
}

/**
 * @param {HTMLElement} container
 * @param {{ projectId: string, apiBase: string, getToken: () => Promise<string> }} opts
 */
export function renderChannelConnect(container, opts) {
    const state = { config: null, channels: [], fb: null, confirmDelete: null };

    const api = async (path, { method = 'GET', body } = {}) => {
        const token = await opts.getToken();
        const res = await fetch(`${opts.apiBase}/api/mp/projects/${opts.projectId}/connect${path}`, {
            method,
            headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    };

    const notice = (type, html) => {
        const el = container.querySelector('#mpc-notice');
        if (!el) return;
        el.innerHTML = html ? `<div class="mpc-note ${type}"><span class="material-icons" style="font-size:1.1rem;">${type === 'ok' ? 'check_circle' : type === 'err' ? 'error' : 'info'}</span><div>${html}</div></div>` : '';
    };

    // Back from Google (Gmail): the callback adds ?gmail=connected|error to the portal URL
    const params = new URLSearchParams(window.location.search);
    const gmailResult = params.get('gmail');
    const gmailEmail = params.get('email') || '';
    if (gmailResult) {
        ['gmail', 'email', 'message'].forEach(k => params.delete(k));
        const q = params.toString();
        window.history.replaceState(null, '', `${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`);
    }

    container.innerHTML = `
        <style>${STYLES}</style>
        <div class="mpc">
            <div class="mpc-head">
                <div style="flex:1;">
                    <div class="mpc-title">${L('Canaux de messagerie', 'Messaging channels')}</div>
                    <div class="mpc-dim">${L('Connectez vos comptes : les messages de vos clients arrivent dans l\'onglet Messages et votre assistant IA peut y répondre.', 'Connect your accounts: your customers\' messages arrive in the Messages tab and your AI assistant can reply.')}</div>
                </div>
            </div>
            <div id="mpc-notice"></div>
            <div class="mpc-tiles" id="mpc-tiles"><div class="mpc-dim">${L('Chargement…', 'Loading…')}</div></div>
            <div id="mpc-connected"></div>
        </div>`;

    if (gmailResult === 'connected') notice('ok', `${L('Gmail connecté', 'Gmail connected')} : <strong>${esc(gmailEmail)}</strong>`);
    if (gmailResult === 'error') notice('err', L('La connexion Gmail n\'a pas abouti. Réessayez.', 'The Gmail connection did not complete. Please try again.'));

    function tile(type, title, desc, btnHtml) {
        const t = TYPES[type];
        return `
            <div class="mpc-tile">
                <div class="mpc-tile-top">
                    <div class="mpc-ico" style="background:${t.color}1f; color:${t.color};"><span class="material-icons">${t.icon}</span></div>
                    <div style="min-width:0;"><div style="font-weight:700;">${title}</div><div class="mpc-dim">${desc}</div></div>
                </div>
                ${btnHtml}
            </div>`;
    }

    function renderTiles() {
        const c = state.config || {};
        const soon = `<button class="mpc-btn ghost" disabled>${L('Bientôt disponible', 'Coming soon')}</button>`;
        container.querySelector('#mpc-tiles').innerHTML = [
            tile('facebook', 'Facebook & Instagram', L('Messenger de votre Page et messages directs Instagram', 'Your Page\'s Messenger and Instagram direct messages'),
                c.fbConfigId ? `<button class="mpc-btn" id="mpc-fb" style="background:#1877f2; color:#fff;"><span class="material-icons" style="font-size:1.1rem;">facebook</span> ${L('Continuer avec Facebook', 'Continue with Facebook')}</button>` : soon),
            tile('whatsapp', 'WhatsApp Business', L('Votre numéro WhatsApp, créé ou relié dans la fenêtre de Meta', 'Your WhatsApp number, created or linked in Meta\'s window'),
                c.waConfigId ? `<button class="mpc-btn" id="mpc-wa" style="background:#25d366; color:#000;"><span class="material-icons" style="font-size:1.1rem;">forum</span> ${L('Connecter WhatsApp', 'Connect WhatsApp')}</button>` : soon),
            tile('email', 'Gmail', L('Votre boîte Gmail ou Google Workspace', 'Your Gmail or Google Workspace inbox'),
                `<button class="mpc-btn" id="mpc-gmail" style="background:#fff; color:#000;"><span class="material-icons" style="font-size:1.1rem; color:#ea4335;">mail</span> ${L('Connecter Gmail', 'Connect Gmail')}</button>`),
            tile('sms', L('Texto (SMS)', 'Text messages (SMS)'), L('Un numéro texto dédié, fourni par notre équipe', 'A dedicated texting number, set up by our team'),
                `<a class="mpc-btn ghost" style="text-decoration:none;" href="mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(L('Demande de numéro texto', 'Texting number request'))}"><span class="material-icons" style="font-size:1.1rem;">sms</span> ${L('Demander un numéro', 'Request a number')}</a>`)
        ].join('');
        container.querySelector('#mpc-fb')?.addEventListener('click', connectFacebook);
        container.querySelector('#mpc-wa')?.addEventListener('click', connectWhatsApp);
        container.querySelector('#mpc-gmail')?.addEventListener('click', connectGmail);
    }

    function renderConnected() {
        const el = container.querySelector('#mpc-connected');
        if (!state.channels.length) {
            el.innerHTML = `<div class="mpc-dim">${L('Aucun canal connecté pour le moment.', 'No channel connected yet.')}</div>`;
            return;
        }
        el.innerHTML = `
            <div style="font-weight:700; margin-bottom:8px;">${L('Canaux connectés', 'Connected channels')}</div>
            <div class="mpc-list">${state.channels.map(ch => {
                const t = TYPES[ch.type] || TYPES.sms;
                const ok = ch.type === 'sms' || (ch.hasToken && !ch.lastError);
                const confirming = state.confirmDelete === ch.id;
                return `
                    <div class="mpc-row">
                        <div class="mpc-ico" style="width:32px; height:32px; background:${t.color}1f; color:${t.color};"><span class="material-icons" style="font-size:1.1rem;">${t.icon}</span></div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(ch.label || ch.externalId)}</div>
                            <div class="mpc-dim">${t.label}${ch.active ? '' : ` · ${L('en pause', 'paused')}`}</div>
                        </div>
                        <span class="mpc-chip ${ok ? 'ok' : 'warn'}">${ok ? L('Connecté', 'Connected') : L('À reconnecter', 'Reconnect needed')}</span>
                        <button class="mpc-btn ghost" data-del="${esc(ch.id)}" style="padding:6px 10px; ${confirming ? 'color:#ef4444; border-color:#ef4444;' : ''}" title="${L('Déconnecter', 'Disconnect')}">
                            ${confirming ? L('Confirmer', 'Confirm') : '<span class="material-icons" style="font-size:1.05rem;">link_off</span>'}
                        </button>
                    </div>`;
            }).join('')}</div>`;
        el.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
            const id = b.dataset.del;
            if (state.confirmDelete !== id) { state.confirmDelete = id; renderConnected(); return; }
            state.confirmDelete = null;
            b.disabled = true;
            try {
                await api(`/channels/${encodeURIComponent(id)}`, { method: 'DELETE' });
                notice('ok', L('Canal déconnecté. Vos conversations sont conservées.', 'Channel disconnected. Your conversations are kept.'));
                await load();
            } catch (e) { notice('err', esc(e.message)); b.disabled = false; }
        }));
    }

    async function load() {
        try {
            const d = await api('');
            state.config = d.config;
            state.channels = d.channels || [];
            renderTiles();
            renderConnected();
            if (d.config.fbConfigId || d.config.waConfigId) {
                loadFacebookSdk(d.config.appId, d.config.graphVersion).then(FB => { state.fb = FB; }).catch(() => {
                    notice('err', L('Impossible de charger Facebook. Désactivez le bloqueur de publicités pour ce site, puis rechargez la page.', 'Facebook could not be loaded. Turn off your ad blocker for this site, then reload the page.'));
                });
            }
        } catch (e) {
            container.querySelector('#mpc-tiles').innerHTML = `<div class="mpc-note err">${esc(e.message)}</div>`;
        }
    }

    // ---------- Facebook & Instagram ----------
    function connectFacebook() {
        if (!state.fb) { notice('info', L('Facebook se charge encore, réessayez dans un instant.', 'Facebook is still loading, try again in a moment.')); return; }
        notice('', '');
        state.fb.login((resp) => {
            const token = resp?.authResponse?.accessToken;
            if (!token) { notice('info', L('Connexion Facebook annulée.', 'Facebook connection cancelled.')); return; }
            pickMetaAssets(token);
        }, { config_id: state.config.fbConfigId });
    }

    async function pickMetaAssets(userToken) {
        notice('info', L('Lecture de vos Pages…', 'Reading your Pages…'));
        let pages;
        try { pages = (await api('/meta/assets', { method: 'POST', body: { userToken } })).pages; }
        catch (e) { notice('err', esc(e.message)); return; }
        notice('', '');
        if (!pages.length) {
            notice('err', L('Aucune Page autorisée. Relancez « Continuer avec Facebook » et cochez votre Page.', 'No Page was granted. Click "Continue with Facebook" again and select your Page.'));
            return;
        }
        const linked = new Set(state.channels.map(c => c.externalId));
        const row = (kind, id, label, sub, blocked) => `
            <label class="mpc-check" style="${blocked ? 'opacity:.5; cursor:not-allowed;' : ''}">
                <input type="checkbox" data-kind="${kind}" value="${esc(id)}" ${blocked ? 'disabled' : 'checked'}>
                <span class="material-icons" style="color:${TYPES[kind].color};">${TYPES[kind].icon}</span>
                <span style="flex:1;"><strong>${esc(label)}</strong><br><span class="mpc-dim">${sub}${linked.has(id) ? ` · ${L('déjà connecté', 'already connected')}` : ''}</span></span>
            </label>`;
        const ov = document.createElement('div');
        ov.className = 'mpc-modal';
        ov.innerHTML = `<div>
            <div class="mpc-title" style="margin-bottom:4px;">${L('Choisissez les comptes à connecter', 'Choose the accounts to connect')}</div>
            <div class="mpc-dim" style="margin-bottom:10px;">${L('Les messages de ces comptes arriveront dans votre onglet Messages.', 'Messages from these accounts will arrive in your Messages tab.')}</div>
            ${pages.map(p => row('facebook', p.id, p.name, 'Messenger', p.blocked) + (p.instagram ? row('instagram', p.instagram.id, p.instagram.username ? `@${p.instagram.username}` : p.name, 'Instagram', p.instagram.blocked) : '')).join('')}
            <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:14px;">
                <button class="mpc-btn ghost" data-cancel>${L('Annuler', 'Cancel')}</button>
                <button class="mpc-btn" data-ok style="background:var(--gold, #dfa53a); color:#000;">${L('Connecter', 'Connect')}</button>
            </div>
        </div>`;
        (container.querySelector('.mpc') || container).appendChild(ov);
        ov.querySelector('[data-cancel]').addEventListener('click', () => ov.remove());
        ov.querySelector('[data-ok]').addEventListener('click', async (e) => {
            const picked = (kind) => [...ov.querySelectorAll(`input[data-kind=${kind}]:checked`)].map(i => i.value);
            const body = { userToken, pageIds: picked('facebook'), instagramIds: picked('instagram') };
            if (!body.pageIds.length && !body.instagramIds.length) return;
            e.currentTarget.disabled = true;
            e.currentTarget.textContent = L('Connexion…', 'Connecting…');
            try {
                const { results } = await api('/meta', { method: 'POST', body });
                ov.remove();
                const ok = results.filter(r => r.ok), ko = results.filter(r => !r.ok);
                notice(ko.length ? 'err' : 'ok', [
                    ok.length ? `${L('Connecté', 'Connected')} : ${ok.map(r => `<strong>${esc(r.name)}</strong>`).join(', ')}` : '',
                    ...ko.map(r => `${esc(r.name)} : ${esc(r.error)}`)
                ].filter(Boolean).join('<br>'));
                await load();
            } catch (err) {
                ov.remove();
                notice('err', esc(err.message));
            }
        });
    }

    // ---------- WhatsApp Embedded Signup ----------
    function connectWhatsApp() {
        if (!state.fb) { notice('info', L('Facebook se charge encore, réessayez dans un instant.', 'Facebook is still loading, try again in a moment.')); return; }
        notice('', '');
        let session = null;
        const onMessage = (event) => {
            let host = '';
            try { host = new URL(event.origin).hostname; } catch (_) { return; }
            if (!host.endsWith('facebook.com')) return;
            try {
                const d = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                if (d?.type === 'WA_EMBEDDED_SIGNUP') session = d;
            } catch (_) { /* other Facebook messages */ }
        };
        window.addEventListener('message', onMessage);
        state.fb.login((resp) => {
            const code = resp?.authResponse?.code;
            if (!code) {
                window.removeEventListener('message', onMessage);
                notice('info', L('Inscription WhatsApp annulée.', 'WhatsApp signup cancelled.'));
                return;
            }
            finishWhatsApp(code, () => session).finally(() => window.removeEventListener('message', onMessage));
        }, {
            config_id: state.config.waConfigId,
            response_type: 'code',
            override_default_response_type: true,
            extras: { setup: {}, featureType: '', sessionInfoVersion: '3' }
        });
    }

    async function finishWhatsApp(code, getSession) {
        notice('info', L('Finalisation de la connexion WhatsApp…', 'Finishing the WhatsApp connection…'));
        // The session message (WABA + number ids) can arrive just after the login callback
        for (let i = 0; i < 20 && !getSession()?.data?.phone_number_id; i++) await new Promise(r => setTimeout(r, 250));
        const data = getSession()?.data || {};
        if (!data.phone_number_id || !data.waba_id) {
            notice('err', L('Meta n\'a pas transmis le numéro WhatsApp. Recommencez et allez jusqu\'au bout de la fenêtre Meta.', 'Meta did not return the WhatsApp number. Start again and complete every step of Meta\'s window.'));
            return;
        }
        try {
            const r = await api('/whatsapp', { method: 'POST', body: { code, wabaId: data.waba_id, phoneNumberId: data.phone_number_id } });
            notice('ok', `${L('WhatsApp connecté', 'WhatsApp connected')} : <strong>${esc(r.channel?.label || data.phone_number_id)}</strong>`);
            await load();
        } catch (e) { notice('err', esc(e.message)); }
    }

    // ---------- Gmail ----------
    async function connectGmail(e) {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
            const back = `${window.location.origin}${window.location.pathname}`;
            const { url } = await api(`/gmail/auth-url?returnTo=${encodeURIComponent(back)}`);
            window.location.href = url;
        } catch (err) { notice('err', esc(err.message)); btn.disabled = false; }
    }

    load();
}
