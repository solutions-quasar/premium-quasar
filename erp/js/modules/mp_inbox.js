/**
 * Messaging Platform (clients) — project inbox + channel management UI.
 * Used in the AI Agents module (ERP staff). Separate from the Quasar SMS & Social Inbox (sms.js).
 * Talks only to /api/mp/* (see erp/backend/messaging-platform).
 */

const CHANNELS = {
    facebook: { label: 'Messenger', icon: 'chat', color: '#0084ff', idLabel: 'ID de la Page Facebook', tokenLabel: 'Jeton d\'accès de la Page (EAA…)' },
    instagram: { label: 'Instagram', icon: 'photo_camera', color: '#e1306c', idLabel: 'ID du compte Instagram professionnel', tokenLabel: 'Jeton Instagram (IGAA…) ou jeton de Page' },
    whatsapp: { label: 'WhatsApp', icon: 'forum', color: '#25d366', idLabel: 'phone_number_id WhatsApp', tokenLabel: 'Jeton permanent (utilisateur système)' },
    sms: { label: 'SMS', icon: 'sms', color: '#dfa53a', idLabel: 'Numéro Twilio (+15551234567)', tokenLabel: null }
};

const PUBLIC_BASE = 'https://quasar-erp-b26d5.web.app';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// In-app notifications (no browser popups): ERP toast, console fallback
const toast = (msg, type = 'normal') => {
    if (window.showToast) window.showToast(esc(msg), type);
    else console.log(`[Messagerie] ${msg}`);
};
const confirmInApp = (message, onConfirm) => {
    if (window.showConfirmModal) window.showConfirmModal({ title: 'Confirmation', message: esc(message), confirmText: 'Supprimer', onConfirm });
    else onConfirm();
};
const fmtTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay ? d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' });
};

/**
 * @param {HTMLElement} container
 * @param {object} opts { projectId, apiBase, getToken, agents: [{id,name}], isStaff }
 */
export function renderProjectMessaging(container, opts) {
    const state = { ...opts, tab: 'inbox', conversations: [], channels: [], activeConvId: null, poll: null };

    const api = async (path, { method = 'GET', body } = {}) => {
        const token = await state.getToken();
        const res = await fetch(`${state.apiBase}/api/mp/projects/${state.projectId}${path}`, {
            method,
            headers: { 'Authorization': `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    };

    // Stop polling when the container is replaced (project/tab change)
    const stopIfDetached = () => {
        if (!document.body.contains(container) || !container.querySelector('#mp-root')) {
            clearInterval(state.poll);
            return true;
        }
        return false;
    };

    container.innerHTML = `
        <div id="mp-root" style="display:flex; flex-direction:column; height:100%; gap:12px;">
            <div style="display:flex; gap:8px; align-items:center;">
                <button class="btn mp-tab" data-tab="inbox"><span class="material-icons" style="font-size:1.1rem; vertical-align:text-bottom;">inbox</span> Boîte de réception</button>
                ${state.isStaff ? `<button class="btn mp-tab" data-tab="channels"><span class="material-icons" style="font-size:1.1rem; vertical-align:text-bottom;">hub</span> Canaux</button>` : ''}
                <span class="text-xs text-muted" style="margin-left:auto;">Plateforme Messagerie clients — séparée de la boîte Quasar</span>
            </div>
            <div id="mp-body" style="flex:1; min-height:0;"></div>
        </div>`;

    container.querySelectorAll('.mp-tab').forEach(b => b.addEventListener('click', () => { state.tab = b.dataset.tab; render(); }));

    function setTabStyles() {
        container.querySelectorAll('.mp-tab').forEach(b => {
            const on = b.dataset.tab === state.tab;
            b.style.background = on ? 'var(--gold)' : 'transparent';
            b.style.color = on ? '#000' : 'var(--text-main, #fff)';
            b.style.border = '1px solid var(--border)';
        });
    }

    async function render() {
        setTabStyles();
        clearInterval(state.poll);
        if (state.tab === 'channels') return renderChannels();
        return renderInbox();
    }

    // ---------------- INBOX ----------------

    async function renderInbox() {
        const body = container.querySelector('#mp-body');
        body.innerHTML = `
            <div style="display:flex; gap:12px; height:100%; min-height:420px;">
                <div style="width:320px; display:flex; flex-direction:column; border:1px solid var(--border); border-radius:10px; overflow:hidden;">
                    <div style="padding:10px; border-bottom:1px solid var(--border);">
                        <input id="mp-search" class="form-input" placeholder="Chercher un contact ou un message…" style="width:100%;">
                    </div>
                    <div id="mp-conv-list" style="flex:1; overflow-y:auto;"><div class="text-muted text-sm" style="padding:1rem;">Chargement…</div></div>
                </div>
                <div id="mp-thread" style="flex:1; display:flex; flex-direction:column; border:1px solid var(--border); border-radius:10px; overflow:hidden;">
                    <div style="margin:auto; color:var(--text-muted); text-align:center;">
                        <span class="material-icons" style="font-size:3rem; opacity:.5;">forum</span>
                        <div>Sélectionnez une conversation</div>
                    </div>
                </div>
            </div>`;
        body.querySelector('#mp-search').addEventListener('input', renderConvList);
        await loadConversations();
        if (state.activeConvId) openConversation(state.activeConvId);
        state.poll = setInterval(async () => {
            if (stopIfDetached() || state.tab !== 'inbox') return;
            await loadConversations(true);
            if (state.activeConvId) openConversation(state.activeConvId, true);
        }, 10000);
    }

    async function loadConversations(silent = false) {
        try {
            const data = await api('/conversations');
            state.conversations = data.conversations || [];
            renderConvList();
        } catch (e) {
            if (!silent) container.querySelector('#mp-conv-list').innerHTML = `<div class="text-danger text-sm" style="padding:1rem;">${esc(e.message)}</div>`;
        }
    }

    function renderConvList() {
        const list = container.querySelector('#mp-conv-list');
        if (!list) return;
        const q = (container.querySelector('#mp-search')?.value || '').toLowerCase();
        const items = state.conversations.filter(c => !q || `${c.contactName || ''} ${c.contactId} ${c.lastMessage || ''}`.toLowerCase().includes(q));
        if (!items.length) {
            list.innerHTML = `<div class="text-muted text-sm" style="padding:1rem;">${state.conversations.length ? 'Aucun résultat.' : 'Aucune conversation pour l\'instant. Configurez un canal dans l\'onglet « Canaux ».'}</div>`;
            return;
        }
        list.innerHTML = items.map(c => {
            const ch = CHANNELS[c.channel] || CHANNELS.sms;
            const active = c.id === state.activeConvId;
            return `
                <div class="mp-conv" data-id="${esc(c.id)}" style="padding:10px 12px; border-bottom:1px solid var(--border); cursor:pointer; ${active ? 'background:rgba(223,165,58,.12);' : ''}">
                    <div style="display:flex; justify-content:space-between; gap:6px;">
                        <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.unread ? '<span style="color:var(--gold);">●</span> ' : ''}${esc(c.contactName || c.contactId)}</strong>
                        <span class="text-xs text-muted">${fmtTime(c.lastMessageAt)}</span>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center; margin-top:3px;">
                        <span style="font-size:.7rem; padding:1px 6px; border-radius:6px; background:${ch.color}22; color:${ch.color};">${ch.label}</span>
                        ${c.aiEnabled === false ? '<span class="text-xs text-muted">IA off</span>' : ''}
                    </div>
                    <div class="text-sm text-muted" style="margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.lastAuthor && c.lastAuthor !== 'user' ? 'Vous : ' : ''}${esc(c.lastMessage || '')}</div>
                </div>`;
        }).join('');
        list.querySelectorAll('.mp-conv').forEach(el => el.addEventListener('click', () => openConversation(el.dataset.id)));
    }

    async function openConversation(convId, silent = false) {
        state.activeConvId = convId;
        const thread = container.querySelector('#mp-thread');
        if (!thread) return;
        let conv;
        try {
            conv = (await api(`/conversations/${encodeURIComponent(convId)}`)).conversation;
        } catch (e) {
            if (!silent) thread.innerHTML = `<div class="text-danger" style="padding:1rem;">${esc(e.message)}</div>`;
            return;
        }
        const local = state.conversations.find(c => c.id === convId);
        if (local) local.unread = false;
        renderConvList();

        // Keep a draft being typed across refreshes
        const draft = thread.querySelector('#mp-reply')?.value || '';
        const ch = CHANNELS[conv.channel] || CHANNELS.sms;
        const msgs = (conv.messages || []).map(m => {
            if (m.role === 'system') return `<div class="text-xs" style="text-align:center; color:var(--danger, #e55); margin:6px 0;">${esc(m.content)}</div>`;
            const mine = m.role === 'assistant';
            const who = m.author === 'ai' ? `🤖 IA${m.dryRun ? ' (simulation, non envoyé)' : ''}` : (m.author === 'human' ? (m.senderName || 'Vous') : esc(conv.contactName || 'Client'));
            return `
                <div style="display:flex; justify-content:${mine ? 'flex-end' : 'flex-start'}; margin:6px 0;">
                    <div style="max-width:70%; padding:8px 12px; border-radius:10px; background:${mine ? 'rgba(223,165,58,.15)' : 'var(--bg-dark)'}; border:1px solid var(--border);">
                        <div class="text-xs text-muted" style="margin-bottom:3px;">${esc(who)} · ${fmtTime(m.timestamp)}</div>
                        <div style="white-space:pre-wrap; word-break:break-word;">${esc(m.content)}</div>
                    </div>
                </div>`;
        }).join('');

        thread.innerHTML = `
            <div style="padding:12px 14px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:10px;">
                <div style="flex:1;">
                    <div class="text-h" style="margin:0; font-size:1rem;">${esc(conv.contactName || conv.contactId)}</div>
                    <div class="text-xs text-muted">${ch.label} · ${esc(conv.contactId)}${conv.optedOut ? ' · <span style="color:var(--danger,#e55);">désabonné (STOP)</span>' : ''}</div>
                </div>
                <label class="text-sm" style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="mp-ai-toggle" ${conv.aiEnabled !== false ? 'checked' : ''} ${conv.optedOut ? 'disabled' : ''}> Réponse IA
                </label>
            </div>
            <div id="mp-msgs" style="flex:1; overflow-y:auto; padding:12px 14px;">${msgs || '<div class="text-muted text-sm">Aucun message.</div>'}</div>
            <div style="padding:10px; border-top:1px solid var(--border); display:flex; gap:8px;">
                <textarea id="mp-reply" class="form-input" rows="2" style="flex:1; resize:vertical;" placeholder="Répondre via ${ch.label}…" ${conv.optedOut ? 'disabled' : ''}></textarea>
                <button id="mp-send" class="btn btn-primary" ${conv.optedOut ? 'disabled' : ''}><span class="material-icons" style="vertical-align:text-bottom;">send</span></button>
            </div>`;

        const box = thread.querySelector('#mp-msgs');
        box.scrollTop = box.scrollHeight;
        const reply = thread.querySelector('#mp-reply');
        reply.value = draft;

        thread.querySelector('#mp-ai-toggle').addEventListener('change', async (e) => {
            try {
                await api(`/conversations/${encodeURIComponent(convId)}`, { method: 'PATCH', body: { aiEnabled: e.target.checked } });
                const c = state.conversations.find(x => x.id === convId);
                if (c) c.aiEnabled = e.target.checked;
                renderConvList();
                toast(e.target.checked ? 'Réponse IA activée pour cette conversation.' : 'Réponse IA désactivée pour cette conversation.', 'success');
            } catch (err) { toast(err.message, 'error'); e.target.checked = !e.target.checked; }
        });

        const send = async () => {
            const text = reply.value.trim();
            if (!text) return;
            const btn = thread.querySelector('#mp-send');
            btn.disabled = true;
            try {
                await api(`/conversations/${encodeURIComponent(convId)}/reply`, { method: 'POST', body: { text } });
                reply.value = '';
                await openConversation(convId);
                loadConversations(true);
            } catch (err) {
                toast(`Envoi impossible : ${err.message}`, 'error');
            } finally { btn.disabled = false; }
        };
        thread.querySelector('#mp-send').addEventListener('click', send);
        reply.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    }

    // ---------------- CHANNELS ----------------

    async function renderChannels() {
        const body = container.querySelector('#mp-body');
        body.innerHTML = `<div class="text-muted">Chargement des canaux…</div>`;
        try {
            state.channels = (await api('/channels')).channels || [];
        } catch (e) {
            body.innerHTML = `<div class="text-danger">${esc(e.message)}</div>`;
            return;
        }
        const agentName = (id) => state.agents.find(a => a.id === id)?.name || (id ? 'Agent introuvable' : '— aucun (pas de réponse IA)');

        const rows = state.channels.map(c => {
            const ch = CHANNELS[c.type];
            const smsUrl = c.type === 'sms' && c.webhookKey ? `${PUBLIC_BASE}/api/mp/sms/twilio/${c.webhookKey}` : null;
            return `
                <div class="card" style="margin:0 0 10px 0; padding:12px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="material-icons" style="color:${ch.color};">${ch.icon}</span>
                        <div style="flex:1;">
                            <strong>${esc(c.label || ch.label)}</strong> <span class="text-xs text-muted">${ch.label} · ${esc(c.externalId)}</span>
                            <div class="text-xs text-muted">Agent : ${esc(agentName(c.agentId))} · IA ${c.aiEnabled ? 'activée' : 'désactivée'} · ${c.active ? 'actif' : 'inactif'} · ${c.type === 'sms' ? (c.hasTwilioCredentials ? 'identifiants Twilio du client' : 'compte Twilio Quasar') : (c.hasToken ? 'jeton enregistré' : '<span style="color:var(--danger,#e55);">jeton manquant</span>')}</div>
                        </div>
                        <button class="btn mp-sim" data-id="${esc(c.id)}" title="Simuler un message entrant">Simuler</button>
                        ${c.type !== 'sms' ? `<button class="btn mp-test" data-id="${esc(c.id)}">Tester</button>` : ''}
                        <button class="btn mp-edit" data-id="${esc(c.id)}">Modifier</button>
                        <button class="icon-btn mp-del" data-id="${esc(c.id)}" title="Supprimer"><span class="material-icons" style="color:var(--danger,#e55);">delete</span></button>
                    </div>
                    ${smsUrl ? `<div class="text-xs" style="margin-top:8px;">Webhook Twilio (« A message comes in », HTTP POST) : <code style="user-select:all;">${esc(smsUrl)}</code></div>` : ''}
                </div>`;
        }).join('');

        body.innerHTML = `
            <div style="display:flex; gap:16px; align-items:flex-start; overflow-y:auto; height:100%;">
                <div style="flex:1;">
                    <div class="text-h" style="font-size:1rem;">Canaux de ce projet</div>
                    <p class="text-sm text-muted">Chaque canal (Page, compte Instagram, numéro WhatsApp ou SMS) est relié à un agent qui répond automatiquement.</p>
                    ${rows || '<div class="text-muted text-sm">Aucun canal configuré.</div>'}
                    <div class="card" style="margin-top:14px; padding:12px;">
                        <div class="text-sm"><strong>Webhook Meta (app Meta des clients)</strong></div>
                        <div class="text-xs text-muted">URL de rappel : <code style="user-select:all;">${PUBLIC_BASE}/api/mp/webhook/meta</code> · jeton de vérification : variable <code>MP_META_VERIFY_TOKEN</code></div>
                    </div>
                </div>
                <form id="mp-channel-form" class="card" style="width:360px; margin:0; padding:14px;">
                    <div class="text-h" id="mp-form-title" style="font-size:1rem;">Ajouter un canal</div>
                    <label class="text-sm">Type</label>
                    <select id="mp-f-type" class="form-input" style="width:100%; margin-bottom:8px;">
                        ${Object.entries(CHANNELS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
                    </select>
                    <label class="text-sm" id="mp-f-id-label">ID</label>
                    <input id="mp-f-id" class="form-input" style="width:100%; margin-bottom:8px;" required>
                    <label class="text-sm">Nom affiché (optionnel)</label>
                    <input id="mp-f-label" class="form-input" style="width:100%; margin-bottom:8px;" placeholder="ex. Page Clinique ABC">
                    <label class="text-sm">Agent qui répond</label>
                    <select id="mp-f-agent" class="form-input" style="width:100%; margin-bottom:8px;">
                        <option value="">— aucun (boîte seulement)</option>
                        ${state.agents.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}
                    </select>
                    <div id="mp-f-token-wrap">
                        <label class="text-sm" id="mp-f-token-label">Jeton</label>
                        <input id="mp-f-token" class="form-input" type="password" autocomplete="off" style="width:100%; margin-bottom:8px;" placeholder="Laisser vide pour conserver l'actuel">
                    </div>
                    <div id="mp-f-twilio-wrap" style="display:none;">
                        <label class="text-sm">Twilio Account SID du client (optionnel)</label>
                        <input id="mp-f-tsid" class="form-input" style="width:100%; margin-bottom:8px;" placeholder="AC… (vide = compte Twilio Quasar)">
                        <label class="text-sm">Twilio Auth Token du client (optionnel)</label>
                        <input id="mp-f-ttoken" class="form-input" type="password" autocomplete="off" style="width:100%; margin-bottom:8px;">
                    </div>
                    <label class="text-sm" style="display:flex; gap:6px; align-items:center; margin:6px 0;"><input type="checkbox" id="mp-f-ai" checked> Réponses IA automatiques</label>
                    <label class="text-sm" style="display:flex; gap:6px; align-items:center; margin:6px 0 12px;"><input type="checkbox" id="mp-f-active" checked> Canal actif</label>
                    <div style="display:flex; gap:8px;">
                        <button type="submit" class="btn btn-primary" style="flex:1;">Enregistrer</button>
                        <button type="button" id="mp-f-reset" class="btn">Nouveau</button>
                    </div>
                </form>
            </div>`;

        const form = body.querySelector('#mp-channel-form');
        const typeSel = form.querySelector('#mp-f-type');
        const syncType = () => {
            const ch = CHANNELS[typeSel.value];
            form.querySelector('#mp-f-id-label').textContent = ch.idLabel;
            form.querySelector('#mp-f-token-wrap').style.display = ch.tokenLabel ? '' : 'none';
            form.querySelector('#mp-f-token-label').textContent = ch.tokenLabel || '';
            form.querySelector('#mp-f-twilio-wrap').style.display = typeSel.value === 'sms' ? '' : 'none';
        };
        typeSel.addEventListener('change', syncType);
        syncType();

        const resetForm = () => {
            form.reset();
            form.querySelector('#mp-form-title').textContent = 'Ajouter un canal';
            typeSel.disabled = false;
            form.querySelector('#mp-f-id').disabled = false;
            syncType();
        };
        form.querySelector('#mp-f-reset').addEventListener('click', resetForm);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                type: typeSel.value,
                externalId: form.querySelector('#mp-f-id').value.trim(),
                label: form.querySelector('#mp-f-label').value.trim() || null,
                agentId: form.querySelector('#mp-f-agent').value || null,
                accessToken: form.querySelector('#mp-f-token').value.trim() || undefined,
                twilioAccountSid: form.querySelector('#mp-f-tsid').value.trim() || undefined,
                twilioAuthToken: form.querySelector('#mp-f-ttoken').value.trim() || undefined,
                aiEnabled: form.querySelector('#mp-f-ai').checked,
                active: form.querySelector('#mp-f-active').checked
            };
            try {
                await api('/channels', { method: 'POST', body: payload });
                toast('Canal enregistré.', 'success');
                renderChannels();
            } catch (err) { toast(err.message, 'error'); }
        });

        body.querySelectorAll('.mp-edit').forEach(b => b.addEventListener('click', () => {
            const c = state.channels.find(x => x.id === b.dataset.id);
            if (!c) return;
            form.querySelector('#mp-form-title').textContent = 'Modifier le canal';
            typeSel.value = c.type; typeSel.disabled = true;
            const idInput = form.querySelector('#mp-f-id');
            idInput.value = c.externalId; idInput.disabled = true;
            form.querySelector('#mp-f-label').value = c.label || '';
            form.querySelector('#mp-f-agent').value = c.agentId || '';
            form.querySelector('#mp-f-ai').checked = c.aiEnabled;
            form.querySelector('#mp-f-active').checked = c.active;
            syncType();
        }));

        body.querySelectorAll('.mp-del').forEach(b => b.addEventListener('click', () => {
            confirmInApp('Supprimer ce canal ? Les conversations existantes sont conservées.', async () => {
                try {
                    await api(`/channels/${encodeURIComponent(b.dataset.id)}`, { method: 'DELETE' });
                    toast('Canal supprimé.', 'success');
                    renderChannels();
                } catch (err) { toast(err.message, 'error'); }
            });
        }));

        body.querySelectorAll('.mp-test').forEach(b => b.addEventListener('click', async () => {
            b.disabled = true;
            try {
                const r = await api(`/channels/${encodeURIComponent(b.dataset.id)}/test`, { method: 'POST' });
                toast(r.account ? `Jeton valide : ${r.account.name || ''} (${r.account.id})` : (r.info || 'OK'), 'success');
            } catch (err) { toast(`Jeton invalide : ${err.message}`, 'error'); }
            finally { b.disabled = false; }
        }));

        // Simulation: inline field under the channel card; the result opens in the inbox
        body.querySelectorAll('.mp-sim').forEach(b => b.addEventListener('click', () => {
            const card = b.closest('.card');
            const open = card.querySelector('.mp-sim-row');
            if (open) { open.remove(); return; }
            const row = document.createElement('div');
            row.className = 'mp-sim-row';
            row.style.cssText = 'display:flex; gap:8px; margin-top:10px;';
            row.innerHTML = `
                <input class="form-input" style="flex:1;" value="Bonjour, quels sont vos horaires ?" placeholder="Message entrant à simuler">
                <button class="btn btn-primary">Simuler</button>`;
            card.appendChild(row);
            const input = row.querySelector('input');
            const go = row.querySelector('button');
            input.focus(); input.select();
            const run = async () => {
                const text = input.value.trim();
                if (!text) return;
                go.disabled = true; go.textContent = 'IA en cours…';
                try {
                    const r = await api('/simulate', { method: 'POST', body: { channelId: b.dataset.id, text } });
                    const ch = state.channels.find(x => x.id === b.dataset.id);
                    if (!r.replied) toast(`Message enregistré, pas de réponse IA (${r.reason || r.error || 'IA désactivée ou aucun agent'}).`);
                    else toast('Réponse IA générée (simulation, non envoyée).', 'success');
                    state.activeConvId = ch ? `${ch.type}_simulation` : null;
                    state.tab = 'inbox';
                    render();
                } catch (err) {
                    toast(err.message, 'error');
                    go.disabled = false; go.textContent = 'Simuler';
                }
            };
            go.addEventListener('click', run);
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
        }));
    }

    render();
}
