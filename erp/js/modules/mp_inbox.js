import { tip, bindTips } from './mp_help.js';

/**
 * Messaging Platform (clients) — project inbox + channel management UI.
 * Used in the AI Agents module (ERP staff). Separate from the Quasar SMS & Social Inbox (sms.js).
 * Talks only to /api/mp/* (see erp/backend/messaging-platform).
 */

// Language follows the ERP EN/FR toggle (localStorage 'erp_lang', same default as translationService).
const isEn = () => { try { return (localStorage.getItem('erp_lang') || 'en') !== 'fr'; } catch (_) { return false; } };
const L = (fr, en) => (isEn() ? en : fr);
const LOCALE = () => (isEn() ? 'en-CA' : 'fr-CA');

// Text fields are getters so they follow the current language.
const CHANNELS = {
    facebook: {
        label: 'Messenger', icon: 'chat', color: '#0084ff',
        get tagline() { return L('Messages de la Page Facebook', 'Facebook Page messages'); },
        get idLabel() { return L('ID de la Page Facebook', 'Facebook Page ID'); },
        get idPlaceholder() { return L('ex. 1220358074484046', 'e.g. 1220358074484046'); },
        get tokenLabel() { return L('Jeton d\'accès de la Page', 'Page access token'); },
        tokenPlaceholder: 'EAA…',
        get help() {
            return isEn() ? [
                'In the Meta app "Quasar Messaging Platform": Use cases › Messenger › Messenger API settings.',
                'Section "Generate access tokens": the ID is under the Page name, the token via "Generate".',
                'On the same row, add the "messages" and "message_echoes" subscriptions.'
            ] : [
                'Dans l\'app Meta « Quasar Messaging Platform » : Cas d\'utilisation › Messenger › Paramètres de Messenger API.',
                'Section « Générez des tokens d\'accès » : l\'ID est sous le nom de la Page, le jeton via « Générer ».',
                'Sur la même ligne, ajoutez les abonnements « messages » et « message_echoes ».'
            ];
        }
    },
    instagram: {
        label: 'Instagram', icon: 'photo_camera', color: '#e1306c',
        get tagline() { return L('Messages directs Instagram', 'Instagram direct messages'); },
        get idLabel() { return L('ID du compte Instagram professionnel', 'Instagram professional account ID'); },
        get idPlaceholder() { return L('ex. 17841400000000000', 'e.g. 17841400000000000'); },
        get tokenLabel() { return L('Jeton Instagram', 'Instagram token'); },
        get tokenPlaceholder() { return L('IGAA… (ou jeton de Page EAA…)', 'IGAA… (or EAA… Page token)'); },
        get help() {
            return isEn() ? [
                'In the clients\' Meta app: Use cases › Instagram › API setup with Instagram login.',
                'Add the account, then "Generate token": the account ID is shown next to it.',
                'Subscribe the account to the "messages" field and turn on "Allow access to messages" in the Instagram app.'
            ] : [
                'Dans l\'app Meta clients : Cas d\'utilisation › Instagram › Configuration de l\'API avec connexion Instagram.',
                'Ajoutez le compte, puis « Générer un token » : l\'ID du compte est affiché à côté.',
                'Abonnez le compte au champ « messages » et activez « Autoriser l\'accès aux messages » dans l\'app Instagram.'
            ];
        }
    },
    whatsapp: {
        label: 'WhatsApp', icon: 'forum', color: '#25d366',
        get tagline() { return L('Numéro WhatsApp Business', 'WhatsApp Business number'); },
        idLabel: 'Phone Number ID',
        get idPlaceholder() { return L('ex. 1389043390962434', 'e.g. 1389043390962434'); },
        get tokenLabel() { return L('Jeton permanent (utilisateur système)', 'Permanent token (system user)'); },
        tokenPlaceholder: 'EAA…',
        get help() {
            return isEn() ? [
                'A number that belongs to the client (never Quasar\'s).',
                'The Phone Number ID is under WhatsApp › API Setup.',
                'Permanent token: Business Manager › System users, with the app and the WhatsApp account assigned.'
            ] : [
                'Un numéro propre au client (jamais celui de Quasar).',
                'Le Phone Number ID est dans WhatsApp › Configuration de l\'API.',
                'Jeton permanent : Business Manager › Utilisateurs système, avec l\'app et le compte WhatsApp assignés.'
            ];
        }
    },
    email: {
        get label() { return L('Courriel', 'Email'); }, icon: 'mail', color: '#ea4335',
        get tagline() { return L('Boîte Gmail / Google Workspace', 'Gmail / Google Workspace inbox'); },
        get idLabel() { return L('Adresse Gmail', 'Gmail address'); },
        get idPlaceholder() { return L('connectée via Google', 'connected via Google'); },
        tokenLabel: null, oauth: true,
        get help() {
            return isEn() ? [
                'Click "Connect Gmail": the Google window opens; choose the client\'s mailbox and accept.',
                'Only new inbox emails are imported (no history), every 2 minutes. Promotions, social and notification emails are ignored.',
                'Replies are sent from this address, in the same thread.',
                'AI replies are off by default for email: turn them on only once the agent is properly configured.'
            ] : [
                'Cliquez sur « Connecter Gmail » : la fenêtre de Google s\'ouvre, choisissez la boîte du client et acceptez.',
                'Seuls les nouveaux courriels de la boîte de réception sont importés (pas l\'historique), toutes les 2 minutes. Promotions, réseaux sociaux et notifications sont ignorés.',
                'Les réponses partent de cette adresse, dans le même fil de discussion.',
                'Réponse IA désactivée par défaut sur le courriel : activez-la seulement si l\'agent est bien configuré.'
            ];
        }
    },
    sms: {
        label: 'SMS', icon: 'sms', color: '#dfa53a',
        get tagline() { return L('Numéro de texto Twilio', 'Twilio texting number'); },
        get idLabel() { return L('Numéro Twilio', 'Twilio number'); },
        idPlaceholder: '+15551234567',
        tokenLabel: null,
        get help() {
            return isEn() ? [
                'A Twilio number dedicated to the client (never Quasar\'s number).',
                'After saving, paste the webhook URL shown into Twilio › Phone Numbers › the number › "A message comes in" (HTTP POST).'
            ] : [
                'Un numéro Twilio dédié au client (jamais le numéro de Quasar).',
                'Après l\'enregistrement, copiez l\'adresse du webhook affichée dans Twilio › Phone Numbers › le numéro › « A message comes in » (HTTP POST).'
            ];
        }
    }
};

const PUBLIC_BASE = 'https://quasar-erp-b26d5.web.app';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// In-app notifications (no browser popups): ERP toast, or a small built-in one (client portal)
const toast = (msg, type = 'normal') => {
    if (window.showToast) return window.showToast(esc(msg), type);
    let box = document.getElementById('mp-toasts');
    if (!box) {
        box = document.createElement('div');
        box.id = 'mp-toasts';
        box.style.cssText = 'position:fixed; left:50%; transform:translateX(-50%); bottom:calc(84px + env(safe-area-inset-bottom, 0px)); z-index:10001; display:flex; flex-direction:column; gap:8px; width:min(420px, calc(100vw - 32px)); pointer-events:none;';
        document.body.appendChild(box);
    }
    const color = type === 'error' ? '#ef4444' : type === 'success' ? '#3ecf8e' : '#dfa53a';
    const t = document.createElement('div');
    t.style.cssText = `background:#12141A; color:#fff; border:1px solid ${color}; border-left:4px solid ${color}; border-radius:10px; padding:10px 14px; font-size:.85rem; box-shadow:0 8px 24px rgba(0,0,0,.5);`;
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), type === 'error' ? 6000 : 3500);
};
const confirmInApp = (message, onConfirm) => {
    if (window.showConfirmModal) window.showConfirmModal({ title: 'Confirmation', message: esc(message), confirmText: L('Supprimer', 'Delete'), onConfirm });
    else onConfirm();
};
const fmtTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay ? d.toLocaleTimeString(LOCALE(), { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(LOCALE(), { month: 'short', day: 'numeric' });
};
// Coloured "WhatsApp / Messenger / …" label so the channel is obvious at a glance
const channelPill = (type) => {
    const ch = CHANNELS[type] || CHANNELS.sms;
    return `<span class="mp-ch-pill" style="color:${ch.color}; background:${ch.color}1a; border-color:${ch.color}55;"><span class="material-icons">${ch.icon}</span>${ch.label}</span>`;
};
const initials = (name) => String(name || '?').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '#';
const smsWebhookUrl = (c) => c.webhookKey ? `${PUBLIC_BASE}/api/mp/sms/twilio/${c.webhookKey}` : '';

/**
 * In-app modal: business questionnaire → AI-generated agent instructions (layer 2).
 * onUse(prompt) receives the reviewed text (the caller puts it in the agent form).
 */
export function openPromptGenerator({ apiBase, getToken, projectId, agentId = null, initialBrief = {}, onUse }) {
    document.getElementById('mp-gen-modal')?.remove();
    const FIELDS = [
        ['businessName', L('Nom de l\'entreprise *', 'Business name *'), 'input', L('ex. Ben\'s Small Engines', 'e.g. Ben\'s Small Engines')],
        ['activity', L('Activité *', 'Activity *'), 'input', L('ex. Réparation de tondeuses, souffleuses et VTT', 'e.g. Lawn mower, snowblower and ATV repair')],
        ['agentName', L('Nom de l\'assistant', 'Assistant name'), 'input', L('ex. Jose Luis', 'e.g. Jose Luis')],
        ['location', L('Adresse / zone desservie', 'Address / service area'), 'input', L('ex. 123 rue Main, Moncton (NB) · Grand Moncton', 'e.g. 123 Main St, Moncton (NB) · Greater Moncton')],
        ['contact', L('Téléphone, courriel, site web', 'Phone, email, website'), 'input', L('ex. 506 555-1234 · info@… · www…', 'e.g. 506 555-1234 · info@… · www…')],
        ['hours', L('Horaires', 'Opening hours'), 'textarea', L('ex. Lun-ven 8h-17h · Sam 9h-12h · Fermé dim', 'e.g. Mon-Fri 8am-5pm · Sat 9am-12pm · Closed Sun')],
        ['services', L('Services et produits', 'Services and products'), 'textarea', L('Un service par ligne', 'One service per line')],
        ['prices', L('Prix et tarifs', 'Prices and rates'), 'textarea', L('ex. Changement d\'huile tondeuse : 45 $ · Diagnostic : 30 $', 'e.g. Mower oil change: $45 · Diagnostic: $30')],
        ['booking', L('Rendez-vous / commandes', 'Appointments / orders'), 'textarea', L('ex. Sur rendez-vous seulement ; l\'équipe rappelle pour confirmer', 'e.g. By appointment only; the team calls back to confirm')],
        ['policies', L('Politiques', 'Policies'), 'textarea', L('Garantie, paiement, annulation, délais…', 'Warranty, payment, cancellation, lead times…')],
        ['faq', L('Questions fréquentes', 'Frequently asked questions'), 'textarea', L('Q : … R : …', 'Q: … A: …')],
        ['tone', L('Ton', 'Tone'), 'input', L('ex. Amical, tutoiement interdit, phrases courtes', 'e.g. Friendly, polite, short sentences')],
        ['languages', L('Langues', 'Languages'), 'input', L('ex. Français et anglais', 'e.g. French and English')],
        ['extra', L('Autres consignes', 'Other instructions'), 'textarea', L('Tout ce que l\'assistant doit savoir ou éviter', 'Anything the assistant must know or avoid')]
    ];
    const overlay = document.createElement('div');
    overlay.id = 'mp-gen-modal';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,.8); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:24px;';
    overlay.innerHTML = `
        <div style="width:min(980px, 100%); max-height:92vh; display:flex; flex-direction:column; background:#12141A; border:1px solid rgba(223,165,58,.4); border-radius:14px; overflow:hidden;">
            <div style="display:flex; align-items:center; gap:10px; padding:14px 18px; border-bottom:1px solid var(--border, #2a2d36);">
                <span class="material-icons" style="color:var(--gold);">auto_awesome</span>
                <div style="flex:1;">
                    <div style="font-weight:700;">${L('Générer les instructions de l\'agent avec l\'IA', 'Generate the agent\'s instructions with AI')}</div>
                    <div style="font-size:.75rem; color:var(--text-muted);">${L('L\'IA n\'utilise que ce que vous écrivez ici. Ce que vous laissez vide, l\'agent dira qu\'il doit le vérifier avec l\'équipe.', 'The AI only uses what you write here. Anything left empty, the agent will say it needs to check with the team.')}</div>
                </div>
                <button id="mp-gen-close" style="background:transparent; border:0; color:var(--text-muted); cursor:pointer;" title="${L('Fermer', 'Close')}"><span class="material-icons">close</span></button>
            </div>
            <div id="mp-gen-body" style="overflow-y:auto; padding:16px 18px;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px 16px;">
                    ${FIELDS.map(([k, label, type, ph]) => `
                        <label style="display:flex; flex-direction:column; gap:4px; ${type === 'textarea' ? 'grid-column:span 1;' : ''}">
                            <span style="font-size:.78rem; font-weight:600;">${label}</span>
                            ${type === 'textarea'
                                ? `<textarea data-k="${k}" class="form-input" rows="3" placeholder="${esc(ph)}" style="resize:vertical;">${esc(initialBrief[k] || '')}</textarea>`
                                : `<input data-k="${k}" class="form-input" placeholder="${esc(ph)}" value="${esc(initialBrief[k] || '')}">`}
                        </label>`).join('')}
                </div>
            </div>
            <div style="display:flex; gap:10px; align-items:center; padding:12px 18px; border-top:1px solid var(--border, #2a2d36);">
                <span id="mp-gen-status" style="font-size:.78rem; color:var(--text-muted); flex:1;"></span>
                <button class="btn" id="mp-gen-back" style="display:none;">${L('Modifier les réponses', 'Edit answers')}</button>
                <button class="btn btn-primary" id="mp-gen-go">${L('Générer', 'Generate')}</button>
                <button class="btn btn-primary" id="mp-gen-use" style="display:none;">${L('Utiliser ces instructions', 'Use these instructions')}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const q = (s) => overlay.querySelector(s);
    const close = () => overlay.remove();
    q('#mp-gen-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const formHtml = q('#mp-gen-body').innerHTML;
    let brief = { ...initialBrief };

    const readBrief = () => {
        overlay.querySelectorAll('[data-k]').forEach(el => { brief[el.dataset.k] = el.value.trim(); });
        return brief;
    };
    const showForm = () => {
        q('#mp-gen-body').innerHTML = formHtml;
        overlay.querySelectorAll('[data-k]').forEach(el => { el.value = brief[el.dataset.k] || ''; });
        q('#mp-gen-go').style.display = ''; q('#mp-gen-use').style.display = 'none'; q('#mp-gen-back').style.display = 'none';
        q('#mp-gen-status').textContent = '';
    };

    q('#mp-gen-back').addEventListener('click', showForm);
    q('#mp-gen-go').addEventListener('click', async () => {
        readBrief();
        if (!brief.businessName || !brief.activity) { toast(L('Indiquez au moins le nom de l\'entreprise et son activité.', 'Enter at least the business name and its activity.'), 'error'); return; }
        const go = q('#mp-gen-go');
        go.disabled = true; go.textContent = L('Génération…', 'Generating…');
        q('#mp-gen-status').textContent = L('L\'IA rédige les instructions (10 à 20 secondes)…', 'The AI is writing the instructions (10 to 20 seconds)…');
        try {
            const token = await getToken();
            const res = await fetch(`${apiBase}/api/mp/projects/${projectId}/generate-prompt`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ brief, agentId })
            });
            const d = await res.json();
            if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
            q('#mp-gen-body').innerHTML = `
                <div style="font-size:.78rem; color:var(--text-muted); margin-bottom:8px;">${L('Relisez et corrigez si besoin. Les règles de la plateforme et les consignes d\'outils sont ajoutées automatiquement à l\'envoi.', 'Review and correct if needed. Platform rules and tool instructions are added automatically when messages are sent.')}</div>
                <textarea id="mp-gen-result" class="form-input" style="width:100%; min-height:52vh; resize:vertical; font-size:.85rem; line-height:1.5;">${esc(d.prompt)}</textarea>`;
            go.style.display = 'none'; q('#mp-gen-use').style.display = ''; q('#mp-gen-back').style.display = '';
            q('#mp-gen-status').textContent = agentId ? L('Vos réponses sont enregistrées dans l\'agent pour une prochaine génération.', 'Your answers are saved in the agent for next time.') : '';
        } catch (e) {
            toast(`${L('Génération impossible', 'Generation failed')} : ${e.message}`, 'error');
            q('#mp-gen-status').textContent = '';
        } finally {
            go.disabled = false; go.textContent = L('Générer', 'Generate');
        }
    });
    q('#mp-gen-use').addEventListener('click', () => {
        const text = q('#mp-gen-result')?.value.trim();
        if (!text) return;
        onUse?.(text);
        close();
        toast(L('Instructions insérées : cliquez sur « Save Changes » pour enregistrer l\'agent.', 'Instructions inserted: click "Save Changes" to save the agent.'), 'success');
    });
}

/**
 * In-app modal showing the final prompt an agent receives (all layers).
 * Exported so the agent form (ai_agents.js) can open it too.
 */
export async function showPromptPreview({ apiBase, getToken, projectId, agentId, channel = 'sms' }) {
    document.getElementById('mp-prompt-modal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'mp-prompt-modal';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,.8); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:24px;';
    overlay.innerHTML = `
        <div style="width:min(900px, 100%); max-height:90vh; display:flex; flex-direction:column; background:#12141A; border:1px solid rgba(223,165,58,.4); border-radius:14px; overflow:hidden;">
            <div style="display:flex; align-items:center; gap:10px; padding:14px 18px; border-bottom:1px solid var(--border, #2a2d36);">
                <span class="material-icons" style="color:var(--gold);">visibility</span>
                <div style="flex:1;">
                    <div style="font-weight:700;">${L('Prompt final de l\'agent', 'Agent\'s final prompt')}</div>
                    <div id="mp-pp-meta" style="font-size:.75rem; color:var(--text-muted);">${L('Chargement…', 'Loading…')}</div>
                </div>
                <select id="mp-pp-channel" class="form-input" style="width:auto;">
                    ${Object.entries(CHANNELS).map(([k, v]) => `<option value="${k}" ${k === channel ? 'selected' : ''}>${v.label}</option>`).join('')}
                </select>
                <button id="mp-pp-close" style="background:transparent; border:0; color:var(--text-muted); cursor:pointer;" title="${L('Fermer', 'Close')}"><span class="material-icons">close</span></button>
            </div>
            <div id="mp-pp-body" style="overflow-y:auto; padding:16px 18px;"></div>
        </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#mp-pp-close').addEventListener('click', close);
    document.addEventListener('keydown', function onEsc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); } });

    const LAYER_STYLE = {
        rules: { title: L('1 · Règles de la plateforme (communes, prioritaires)', '1 · Platform rules (shared, take priority)'), color: '#dfa53a' },
        agent: { title: L('2 · Instructions de l\'agent', '2 · Agent instructions'), color: '#3ecf8e' },
        tools: { title: L('3 · Outils (généré automatiquement)', '3 · Tools (generated automatically)'), color: '#60a5fa' },
        channel: { title: L('4 · Canal et date (généré à chaque message)', '4 · Channel and date (generated for each message)'), color: '#c084fc' }
    };
    const load = async (ch) => {
        const body = overlay.querySelector('#mp-pp-body');
        body.innerHTML = `<div style="color:var(--text-muted);">${L('Chargement…', 'Loading…')}</div>`;
        try {
            const token = await getToken();
            const res = await fetch(`${apiBase}/api/mp/projects/${projectId}/agents/${agentId}/prompt-preview?channel=${ch}`, { headers: { Authorization: `Bearer ${token}` } });
            const d = await res.json();
            if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
            overlay.querySelector('#mp-pp-meta').textContent = `${L('Modèle', 'Model')} ${d.model} · ${d.mode === 'full' ? L('agent complet (outils + mémoires du projet)', 'full agent (tools + project memories)') : L('prompt seulement (projet sans clé Firebase : aucun outil)', 'prompt only (project without a Firebase key: no tools)')}`;
            body.innerHTML = Object.entries(LAYER_STYLE).map(([k, s]) => `
                <div style="margin-bottom:14px; border-left:3px solid ${s.color}; padding-left:12px;">
                    <div style="font-size:.75rem; font-weight:700; color:${s.color}; margin-bottom:4px;">${s.title}</div>
                    <pre style="white-space:pre-wrap; word-break:break-word; margin:0; font-size:.8rem; line-height:1.45; color:var(--text-main, #fff); font-family:inherit;">${esc(d.layers[k])}</pre>
                </div>`).join('') +
                `<div style="font-size:.75rem; color:var(--text-muted);">${L('Un rappel final anti-invention est ajouté à la fin du prompt.', 'A final "do not invent" reminder is added at the end of the prompt.')}</div>`;
        } catch (e) {
            body.innerHTML = `<div class="text-danger">${esc(e.message)}</div>`;
        }
    };
    overlay.querySelector('#mp-pp-channel').addEventListener('change', (e) => load(e.target.value));
    load(channel);
}

const STYLES = `
#mp-root { --mp-radius: 12px; display:flex; flex-direction:column; height:100%; gap:14px; }
#mp-root .mp-topbar { display:flex; gap:8px; align-items:center; }
#mp-root .mp-seg { display:inline-flex; background:var(--bg-dark); border:1px solid var(--border); border-radius:10px; padding:3px; gap:3px; }
#mp-root .mp-seg button { background:transparent; border:0; color:var(--text-muted); padding:8px 14px; border-radius:8px; cursor:pointer; font-weight:600; display:flex; align-items:center; gap:6px; }
#mp-root .mp-seg button.on { background:var(--gold); color:#000; }
#mp-root .mp-seg .material-icons { font-size:1.1rem; }
#mp-root .mp-badge-count { background:var(--gold); color:#000; border-radius:10px; padding:0 7px; font-size:.7rem; font-weight:700; }
#mp-root .mp-seg button.on .mp-badge-count { background:#000; color:var(--gold); }
#mp-root .mp-muted { color:var(--text-muted); }
#mp-root .mp-ico { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
#mp-root .mp-chip { display:inline-flex; align-items:center; gap:4px; font-size:.72rem; padding:2px 8px; border-radius:20px; border:1px solid var(--border); color:var(--text-muted); white-space:nowrap; }
#mp-root .mp-chip.ok { color:#3ecf8e; border-color:#3ecf8e55; background:#3ecf8e14; }
#mp-root .mp-chip.warn { color:#f5a524; border-color:#f5a52455; background:#f5a52414; }
#mp-root .mp-chip.off { color:var(--text-muted); }
#mp-root .mp-chip .material-icons { font-size:.85rem; }
#mp-root .mp-iconbtn { background:transparent; border:1px solid var(--border); color:var(--text-muted); width:34px; height:34px; border-radius:9px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
#mp-root .mp-iconbtn:hover { color:var(--gold); border-color:var(--gold); }
#mp-root .mp-iconbtn.danger:hover { color:#ef4444; border-color:#ef4444; }
#mp-root .mp-iconbtn .material-icons { font-size:1.15rem; }
#mp-root .mp-list { background:var(--bg-dark); border:1px solid var(--border); border-radius:var(--mp-radius); overflow:hidden; }
#mp-root .mp-list-head, #mp-root .mp-row-main { display:grid; grid-template-columns:minmax(220px, 2fr) minmax(130px, 1fr) minmax(130px, 1fr) 90px 120px 170px; gap:12px; align-items:center; padding:10px 16px; }
#mp-root .mp-list-head { font-size:.7rem; text-transform:uppercase; letter-spacing:.04em; color:var(--text-muted); border-bottom:1px solid var(--border); }
#mp-root .mp-card { border-bottom:1px solid var(--border); position:relative; }
#mp-root .mp-card:last-child { border-bottom:0; }
#mp-root .mp-card:hover { background:rgba(255,255,255,.02); }
#mp-root .mp-card::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--mp-accent); }
#mp-root .mp-card.paused .mp-row-main { opacity:.55; }
#mp-root .mp-card .mp-sim-row, #mp-root .mp-card .mp-extra { padding:0 16px 12px 68px; }
#mp-root .mp-actions { display:flex; gap:6px; justify-content:flex-end; }
@media (max-width: 1100px) { #mp-root .mp-list-head { display:none; } #mp-root .mp-row-main { grid-template-columns:1fr auto; } #mp-root .mp-row-main > .mp-col-opt { display:none; } }
#mp-root .mp-switch { position:relative; width:36px; height:20px; flex-shrink:0; }
#mp-root .mp-switch input { opacity:0; width:0; height:0; }
#mp-root .mp-switch span { position:absolute; inset:0; background:#444; border-radius:20px; cursor:pointer; transition:.2s; }
#mp-root .mp-switch span::before { content:''; position:absolute; width:14px; height:14px; left:3px; top:3px; background:#fff; border-radius:50%; transition:.2s; }
#mp-root .mp-switch input:checked + span { background:var(--gold); }
#mp-root .mp-switch input:checked + span::before { transform:translateX(16px); }
#mp-root .mp-copy { display:flex; gap:6px; align-items:center; background:var(--bg-card); border:1px dashed var(--border); border-radius:8px; padding:6px 8px; }
#mp-root .mp-copy code { flex:1; font-size:.72rem; word-break:break-all; color:var(--text-main, #fff); }
#mp-root .mp-tile { background:var(--bg-dark); border:1px solid var(--border); border-radius:var(--mp-radius); padding:18px; cursor:pointer; text-align:left; color:inherit; display:flex; flex-direction:column; gap:10px; transition:.15s; }
#mp-root .mp-tile:hover { border-color:var(--mp-accent); transform:translateY(-2px); }
#mp-root .mp-tiles { display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:12px; }
#mp-root .mp-panel { background:var(--bg-dark); border:1px solid var(--border); border-radius:var(--mp-radius); padding:20px; }
#mp-root .mp-field { display:flex; flex-direction:column; gap:5px; margin-bottom:14px; }
#mp-root .mp-field label { font-size:.8rem; font-weight:600; }
#mp-root .mp-field small { color:var(--text-muted); font-size:.72rem; }
#mp-root .mp-help { background:rgba(223,165,58,.06); border:1px solid rgba(223,165,58,.25); border-radius:10px; padding:12px 14px; font-size:.8rem; }
#mp-root .mp-help ol { margin:6px 0 0 18px; padding:0; color:var(--text-muted); }
#mp-root .mp-help li { margin:4px 0; }
#mp-root .mp-filters { display:flex; gap:6px; flex-wrap:wrap; padding:10px; border-bottom:1px solid var(--border); }
#mp-root .mp-filters button { background:transparent; border:1px solid var(--border); color:var(--text-muted); border-radius:20px; padding:3px 10px; font-size:.75rem; cursor:pointer; }
#mp-root .mp-filters button.on { border-color:var(--gold); color:var(--gold); background:rgba(223,165,58,.1); }
#mp-root .mp-avatar { width:38px; height:38px; border-radius:50%; background:var(--bg-card); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:.8rem; position:relative; flex-shrink:0; }
#mp-root .mp-avatar .mp-dot { position:absolute; right:-3px; bottom:-3px; width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid var(--bg-card); }
#mp-root .mp-avatar .mp-dot .material-icons { font-size:.6rem; color:#fff; }
#mp-root .mp-conv { display:flex; gap:10px; padding:11px 12px; border-bottom:1px solid var(--border); cursor:pointer; }
#mp-root .mp-ch-pill { display:inline-flex; align-items:center; gap:3px; font-size:.66rem; font-weight:700; padding:1px 7px 1px 5px; border-radius:20px; border:1px solid; flex-shrink:0; white-space:nowrap; }
#mp-root .mp-ch-pill .material-icons { font-size:.8rem; }
#mp-root .mp-filters button .material-icons { font-size:.85rem; vertical-align:-2px; margin-right:2px; }
#mp-root .mp-conv:hover { background:rgba(255,255,255,.03); }
#mp-root .mp-conv.active { background:rgba(223,165,58,.1); box-shadow:inset 3px 0 0 var(--gold); }
#mp-root details.mp-tech summary { cursor:pointer; color:var(--text-muted); font-size:.8rem; }
#mp-root .mp-inbox { display:flex; gap:14px; height:100%; min-height:420px; }
#mp-root .mp-pane-list { width:340px; flex-shrink:0; }
#mp-root .mp-back { display:none; }
@media (max-width: 760px) {
  #mp-root .mp-topbar > span { display:none; }
  #mp-root .mp-inbox { gap:0; }
  #mp-root .mp-pane-list { width:100%; }
  #mp-root .mp-pane-thread { display:none !important; }
  #mp-root .mp-inbox.has-thread .mp-pane-list { display:none !important; }
  #mp-root .mp-inbox.has-thread .mp-pane-thread { display:flex !important; }
  #mp-root .mp-back { display:inline-flex; }
}
`;

/**
 * @param {HTMLElement} container
 * @param {object} opts { projectId, apiBase, getToken, agents: [{id,name}], isStaff }
 */
export function renderProjectMessaging(container, opts) {
    const state = {
        ...opts, tab: opts.initialTab || 'inbox', conversations: [], channels: [], activeConvId: null, poll: null,
        filter: 'all', wizard: null // { step: 'type'|'form'|'done', type, editing, saved }
    };

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

    // ---------- In-app modal ----------
    const openModal = (title, icon, html, width = 640) => {
        document.getElementById('mp-modal')?.remove();
        const ov = document.createElement('div');
        ov.id = 'mp-modal';
        ov.style.cssText = 'position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,.8); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:20px;';
        ov.innerHTML = `
            <div style="width:min(${width}px, 100%); max-height:92vh; display:flex; flex-direction:column; background:#12141A; border:1px solid rgba(223,165,58,.4); border-radius:14px; overflow:hidden;">
                <div style="display:flex; align-items:center; gap:10px; padding:14px 18px; border-bottom:1px solid var(--border, #2a2d36);">
                    <span class="material-icons" style="color:var(--gold);">${icon}</span>
                    <div style="flex:1; font-weight:700;">${title}</div>
                    <button data-close style="background:transparent; border:0; color:var(--text-muted); cursor:pointer;" title="${L('Fermer', 'Close')}"><span class="material-icons">close</span></button>
                </div>
                <div data-body style="overflow-y:auto; padding:16px 18px;">${html}</div>
            </div>`;
        document.body.appendChild(ov);
        const close = () => ov.remove();
        ov.querySelector('[data-close]').addEventListener('click', close);
        ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
        return { el: ov, body: ov.querySelector('[data-body]'), close };
    };
    const field = (label, inner, hint = '') => `
        <label style="display:flex; flex-direction:column; gap:5px; margin-bottom:12px;">
            <span style="font-size:.8rem; font-weight:600;">${label}</span>${inner}
            ${hint ? `<small style="color:var(--text-muted); font-size:.72rem;">${hint}</small>` : ''}
        </label>`;
    const varCount = (text) => (String(text || '').match(/\{\{\d+\}\}/g) || []).length;
    const fillVars = (text, params) => String(text || '').replace(/\{\{(\d+)\}\}/g, (m, n) => params[Number(n) - 1] || m);

    // ---------- New message (business-initiated) ----------
    async function openNewMessage() {
        try { if (!state.channels.length) await loadChannels(); } catch (_) { }
        const order = { whatsapp: 0, sms: 1, email: 2 };
        const usable = state.channels.filter(c => c.type in order && c.active).sort((a, b) => order[a.type] - order[b.type]);
        if (!usable.length) { toast(L('Aucun canal WhatsApp, SMS ou courriel actif dans ce projet.', 'No active WhatsApp, SMS or email channel in this project.'), 'error'); return; }
        const m = openModal(L('Nouveau message', 'New message'), 'edit_square', `
            <div style="font-size:.8rem; font-weight:600; margin-bottom:6px;">${L('Envoyer par', 'Send via')}</div>
            <input type="hidden" data-f="channel" value="${esc(usable[0].id)}">
            <div data-tiles style="display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:8px; margin-bottom:14px;">
                ${usable.map(c => `<button type="button" data-tile="${esc(c.id)}" style="display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:10px; cursor:pointer; text-align:left; background:transparent; color:inherit; border:2px solid var(--border, #2a2d36);">
                    <span class="material-icons" style="color:${CHANNELS[c.type].color};">${CHANNELS[c.type].icon}</span>
                    <span style="display:flex; flex-direction:column; min-width:0;"><strong style="font-size:.85rem;">${CHANNELS[c.type].label}</strong><small style="color:var(--text-muted); font-size:.72rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(c.label || c.externalId)}</small></span>
                </button>`).join('')}
            </div>
            ${field(L('Destinataire', 'Recipient'), `<input class="form-input" data-f="to" placeholder="+1 506 555-1234">`, '', )}
            <div data-wa style="display:none; margin-bottom:12px;">
                <div style="display:flex; gap:16px; font-size:.82rem;">
                    <label style="display:flex; gap:6px; align-items:center; cursor:pointer;"><input type="radio" name="mp-mode" value="template" checked> ${L('Modèle approuvé', 'Approved template')}</label>
                    <label style="display:flex; gap:6px; align-items:center; cursor:pointer;"><input type="radio" name="mp-mode" value="text"> ${L('Texte libre', 'Free-form text')}</label>
                </div>
                <small style="color:var(--text-muted); font-size:.72rem;">${L('WhatsApp exige un modèle approuvé pour écrire en premier ou après 24 h sans message du client.', 'WhatsApp requires an approved template to start a conversation or after 24 h without a message from the customer.')}</small>
            </div>
            <div data-tpl style="display:none;">
                ${field(L('Modèle', 'Template'), `<select class="form-input" data-f="template"><option value="">${L('Chargement…', 'Loading…')}</option></select>`)}
                <div data-params></div>
                <div data-preview style="display:none; margin-bottom:12px; padding:10px 12px; border-radius:10px; background:rgba(37,211,102,.08); border:1px solid rgba(37,211,102,.3); white-space:pre-wrap; font-size:.85rem;"></div>
            </div>
            <div data-text>${field('Message', `<textarea class="form-input" data-f="text" rows="4" style="resize:vertical;"></textarea>`)}</div>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button class="btn" data-close-btn>${L('Annuler', 'Cancel')}</button>
                <button class="btn btn-primary" data-send><span class="material-icons" style="font-size:1.1rem; vertical-align:text-bottom;">send</span> ${L('Envoyer', 'Send')}</button>
            </div>`, 560);
        const q = (s) => m.body.querySelector(s);
        q('[data-close-btn]').addEventListener('click', m.close);
        let templates = [];
        const current = () => usable.find(c => c.id === q('[data-f=channel]').value);
        const mode = () => current().type === 'whatsapp' ? m.body.querySelector('input[name=mp-mode]:checked').value : 'text';
        const tplBody = (t) => (t?.components || []).find(c => c.type === 'BODY')?.text || '';
        const renderParams = () => {
            const t = templates.find(x => `${x.name}|${x.language}` === q('[data-f=template]').value);
            const n = varCount(tplBody(t));
            q('[data-params]').innerHTML = Array.from({ length: n }, (_, i) => field(`Variable {{${i + 1}}}`, `<input class="form-input" data-param="${i}">`)).join('');
            const upd = () => {
                const params = [...m.body.querySelectorAll('[data-param]')].map(i => i.value.trim());
                const p = q('[data-preview]');
                p.style.display = t ? '' : 'none';
                p.textContent = fillVars(tplBody(t), params);
            };
            m.body.querySelectorAll('[data-param]').forEach(i => i.addEventListener('input', upd));
            upd();
        };
        const sync = async () => {
            const ch = current();
            const isWa = ch.type === 'whatsapp';
            m.body.querySelectorAll('[data-tile]').forEach(b => {
                const on = b.dataset.tile === ch.id;
                b.style.borderColor = on ? CHANNELS[ch.type].color : 'var(--border, #2a2d36)';
                b.style.background = on ? 'rgba(255,255,255,.05)' : 'transparent';
            });
            q('[data-send]').innerHTML = `<span class="material-icons" style="font-size:1.1rem; vertical-align:text-bottom;">send</span> ${L('Envoyer par', 'Send via')} ${CHANNELS[ch.type].label}`;
            q('[data-wa]').style.display = isWa ? '' : 'none';
            q('[data-f=to]').placeholder = ch.type === 'email' ? L('client@exemple.com', 'customer@example.com') : '+1 506 555-1234';
            const tplMode = mode() === 'template';
            q('[data-tpl]').style.display = tplMode ? '' : 'none';
            q('[data-text]').style.display = tplMode ? 'none' : '';
            if (isWa && tplMode) {
                try {
                    // Text templates only (media headers and carousels need extra parameters)
                    templates = (await api(`/channels/${encodeURIComponent(ch.id)}/templates`)).templates.filter(t =>
                        t.status === 'APPROVED' &&
                        !(t.components || []).some(c => c.type === 'CAROUSEL' || (c.type === 'HEADER' && c.format && c.format !== 'TEXT')));
                    q('[data-f=template]').innerHTML = templates.length
                        ? templates.map(t => `<option value="${esc(t.name)}|${esc(t.language)}">${esc(t.name)} (${esc(t.language)})</option>`).join('')
                        : `<option value="">${L('Aucun modèle approuvé', 'No approved template')}</option>`;
                } catch (e) {
                    q('[data-f=template]').innerHTML = `<option value="">${esc(e.message)}</option>`;
                    templates = [];
                }
                renderParams();
            }
        };
        m.body.querySelectorAll('[data-tile]').forEach(b => b.addEventListener('click', () => { q('[data-f=channel]').value = b.dataset.tile; sync(); }));
        m.body.querySelectorAll('input[name=mp-mode]').forEach(r => r.addEventListener('change', sync));
        q('[data-f=template]').addEventListener('change', renderParams);
        sync();

        q('[data-send]').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const ch = current();
            const to = q('[data-f=to]').value.trim();
            if (!to) { toast(L('Indiquez le destinataire.', 'Enter the recipient.'), 'error'); return; }
            const payload = { channelId: ch.id, to };
            if (mode() === 'template') {
                const [name, language] = (q('[data-f=template]').value || '').split('|');
                if (!name) { toast(L('Choisissez un modèle approuvé.', 'Choose an approved template.'), 'error'); return; }
                const params = [...m.body.querySelectorAll('[data-param]')].map(i => i.value.trim());
                if (params.some(p => !p)) { toast(L('Remplissez toutes les variables du modèle.', 'Fill in all the template variables.'), 'error'); return; }
                const t = templates.find(x => x.name === name && x.language === language);
                payload.template = { name, language, params, preview: fillVars(tplBody(t), params) };
            } else {
                payload.text = q('[data-f=text]').value.trim();
                if (!payload.text) { toast(L('Le message est vide.', 'The message is empty.'), 'error'); return; }
            }
            btn.disabled = true;
            try {
                const r = await api('/messages', { method: 'POST', body: payload });
                m.close();
                toast(L('Message envoyé.', 'Message sent.'), 'success');
                state.activeConvId = r.convId;
                await loadConversations(true);
                openConversation(r.convId);
            } catch (err) { toast(`${L('Envoi impossible', 'Could not send')} : ${err.message}`, 'error'); btn.disabled = false; }
        });
    }

    // ---------- WhatsApp templates ----------
    async function openTemplates(c) {
        const m = openModal(`${L('Modèles WhatsApp', 'WhatsApp templates')} · ${esc(c.label || c.externalId)}`, 'description', `<div class="mp-muted">${L('Chargement…', 'Loading…')}</div>`, 860);
        const STATUS = {
            APPROVED: ['ok', L('Approuvé', 'Approved')], PENDING: ['warn', L('En examen', 'In review')], REJECTED: ['warn', L('Refusé', 'Rejected')],
            PAUSED: ['off', L('En pause', 'Paused')], DISABLED: ['off', L('Désactivé', 'Disabled')]
        };
        const render = async () => {
            let list = [];
            let err = '';
            try { list = (await api(`/channels/${encodeURIComponent(c.id)}/templates`)).templates; } catch (e) { err = e.message; }
            m.body.innerHTML = `
                <div style="display:grid; grid-template-columns:minmax(0, 1.2fr) minmax(0, 1fr); gap:18px;">
                    <div>
                        <div style="font-weight:700; margin-bottom:8px;">${L('Modèles du compte', 'Account templates')}</div>
                        ${err ? `<div style="color:#f5a524; font-size:.85rem;">${esc(err)}</div>` : ''}
                        ${!err && !list.length ? `<div class="mp-muted" style="font-size:.85rem;">${L('Aucun modèle.', 'No templates.')}</div>` : ''}
                        ${list.map(t => {
                            const [cls, label] = STATUS[t.status] || ['off', t.status];
                            const body = (t.components || []).find(x => x.type === 'BODY')?.text || '';
                            return `<div style="border:1px solid var(--border); border-radius:10px; padding:10px 12px; margin-bottom:8px;">
                                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                                    <strong style="font-size:.85rem;">${esc(t.name)}</strong>
                                    <span class="mp-chip ${cls}" style="font-size:.7rem;">${label}</span>
                                    <span class="mp-muted" style="font-size:.72rem;">${esc(t.category)} · ${esc(t.language)}</span>
                                </div>
                                <div style="font-size:.8rem; margin-top:6px; white-space:pre-wrap; color:var(--text-muted);">${esc(body)}</div>
                                ${t.rejected_reason && t.rejected_reason !== 'NONE' ? `<div style="font-size:.72rem; color:#f5a524; margin-top:4px;">${L('Motif', 'Reason')} : ${esc(t.rejected_reason)}</div>` : ''}
                            </div>`;
                        }).join('')}
                    </div>
                    <form data-create>
                        <div style="font-weight:700; margin-bottom:8px;">${L('Créer un modèle', 'Create a template')}</div>
                        ${field(L('Nom', 'Name'), `<input class="form-input" name="name" placeholder="${L('confirmation_rendez_vous', 'appointment_confirmation')}" required>`, L('Lettres minuscules, chiffres et _ uniquement.', 'Lowercase letters, numbers and _ only.'))}
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                            ${field(L('Catégorie', 'Category'), `<select class="form-input" name="category"><option value="UTILITY">${L('Utilitaire', 'Utility')}</option><option value="MARKETING">Marketing</option></select>`)}
                            ${field(L('Langue', 'Language'), `<select class="form-input" name="language">${isEn()
                                ? '<option value="en_US">English (US)</option><option value="en">English</option><option value="fr">French</option><option value="fr_CA">French (Canada)</option>'
                                : '<option value="fr">Français</option><option value="fr_CA">Français (Canada)</option><option value="en_US">Anglais (É.-U.)</option><option value="en">Anglais</option>'}</select>`)}
                        </div>
                        ${field(L('Texte', 'Text'), `<textarea class="form-input" name="body" rows="4" style="resize:vertical;" placeholder="${L('Bonjour {{1}}, votre rendez-vous est confirmé le {{2}}.', 'Hi {{1}}, your appointment is confirmed for {{2}}.')}" required></textarea>`, L('Variables : {{1}}, {{2}}… Meta examine chaque modèle (quelques minutes à 24 h).', 'Variables: {{1}}, {{2}}… Meta reviews each template (a few minutes to 24 h).'))}
                        <div data-examples></div>
                        <button class="btn btn-primary" type="submit" style="width:100%;">${L('Créer le modèle', 'Create template')}</button>
                    </form>
                </div>`;
            const form = m.body.querySelector('[data-create]');
            const bodyEl = form.querySelector('[name=body]');
            const renderExamples = () => {
                const n = varCount(bodyEl.value);
                const prev = [...form.querySelectorAll('[data-ex]')].map(i => i.value);
                form.querySelector('[data-examples]').innerHTML = Array.from({ length: n }, (_, i) =>
                    field(`${L('Exemple pour', 'Example for')} {{${i + 1}}}`, `<input class="form-input" data-ex value="${esc(prev[i] || '')}" required>`)).join('');
            };
            bodyEl.addEventListener('input', renderExamples);
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = form.querySelector('button[type=submit]');
                btn.disabled = true;
                try {
                    const r = await api(`/channels/${encodeURIComponent(c.id)}/templates`, {
                        method: 'POST',
                        body: {
                            name: form.querySelector('[name=name]').value,
                            category: form.querySelector('[name=category]').value,
                            language: form.querySelector('[name=language]').value,
                            body: bodyEl.value, examples: [...form.querySelectorAll('[data-ex]')].map(i => i.value.trim())
                        }
                    });
                    toast(L(`Modèle envoyé à Meta pour examen (statut : ${r.template?.status || 'PENDING'}).`, `Template submitted to Meta for review (status: ${r.template?.status || 'PENDING'}).`), 'success');
                    render();
                } catch (err) { toast(`${L('Création impossible', 'Could not create')} : ${err.message}`, 'error'); btn.disabled = false; }
            });
        };
        render();
    }

    const copyText = async (text) => {
        try { await navigator.clipboard.writeText(text); toast(L('Copié dans le presse-papiers.', 'Copied to clipboard.'), 'success'); }
        catch (_) { toast(L('Copie impossible : sélectionnez le texte manuellement.', 'Could not copy: select the text manually.'), 'error'); }
    };

    container.innerHTML = `
        <style>${STYLES}</style>
        <div id="mp-root">
            <div class="mp-topbar" ${state.isStaff ? "" : "style=\"display:none;\""}>
                <div class="mp-seg">
                    <button data-tab="inbox"><span class="material-icons">inbox</span> ${L('Boîte de réception', 'Inbox')} <span class="mp-badge-count" id="mp-unread" style="display:none;"></span></button>
                    ${state.isStaff ? `<button data-tab="channels"><span class="material-icons">hub</span> ${L('Canaux', 'Channels')} <span class="mp-badge-count" id="mp-ch-count" style="display:none;"></span></button>` : ''}
                    ${state.isStaff ? `<button data-tab="rules" title="${L('Règles communes à tous les agents clients', 'Rules shared by all client agents')}"><span class="material-icons">gavel</span> ${L('Règles IA', 'AI rules')}</button>` : ''}
                </div>
                ${state.isStaff ? `<span class="mp-muted" style="margin-left:auto; font-size:.75rem;">${L('Messagerie clients · séparée de la boîte Quasar', 'Client messaging · separate from the Quasar inbox')}</span>` : ''}
            </div>
            <div id="mp-body" style="flex:1; min-height:0;"></div>
        </div>`;

    container.querySelectorAll('.mp-seg button').forEach(b => b.addEventListener('click', () => {
        state.tab = b.dataset.tab;
        state.wizard = null;
        render();
    }));

    function setTabStyles() {
        container.querySelectorAll('.mp-seg button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
    }

    function setCount(id, n) {
        const el = container.querySelector(id);
        if (!el) return;
        el.style.display = n ? '' : 'none';
        el.textContent = n || '';
    }

    async function render() {
        setTabStyles();
        clearInterval(state.poll);
        if (state.tab === 'channels') return renderChannels();
        if (state.tab === 'rules') return renderRules();
        return renderInbox();
    }

    // =====================================================================
    // PLATFORM RULES (layer 1, shared by every client agent)
    // =====================================================================

    const platformApi = async (method = 'GET', body) => {
        const token = await state.getToken();
        const res = await fetch(`${state.apiBase}/api/mp/platform/prompt`, {
            method,
            headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    };

    async function renderRules() {
        const body = container.querySelector('#mp-body');
        body.innerHTML = `<div class="mp-muted">${L('Chargement des règles…', 'Loading rules…')}</div>`;
        let d;
        try { d = await platformApi(); }
        catch (e) { body.innerHTML = `<div class="text-danger">${esc(e.message)}</div>`; return; }

        const fmtDate = (iso) => iso ? new Date(iso).toLocaleString(LOCALE(), { dateStyle: 'medium', timeStyle: 'short' }) : '';
        body.innerHTML = `
            <div style="display:grid; grid-template-columns:minmax(0, 1fr) 300px; gap:16px; height:100%; min-height:0;">
                <div class="mp-panel" style="display:flex; flex-direction:column; min-height:0;">
                    <div style="display:flex; align-items:flex-start; gap:10px; margin-bottom:10px;">
                        <div style="flex:1;">
                            <div style="font-size:1.05rem; font-weight:700;">${L('Règles IA de la plateforme', 'Platform AI rules')}</div>
                            <div class="mp-muted" style="font-size:.8rem;">${L('Communes à <strong>tous les agents clients</strong> et prioritaires sur leurs instructions. Ne s\'appliquent pas à la boîte Quasar.', 'Shared by <strong>all client agents</strong> and take priority over their instructions. They do not apply to the Quasar inbox.')}</div>
                        </div>
                        <span class="mp-chip ${d.isDefault ? 'off' : 'ok'}">${d.isDefault ? L('Règles par défaut', 'Default rules') : `Version ${d.version}`}</span>
                    </div>
                    <textarea id="mp-rules" class="form-input" style="flex:1; min-height:340px; resize:vertical; font-size:.85rem; line-height:1.5;">${esc(d.rules)}</textarea>
                    <div style="display:flex; gap:10px; align-items:center; margin-top:12px;">
                        <button class="btn btn-primary" id="mp-rules-save">${L('Enregistrer pour tous les agents', 'Save for all agents')}</button>
                        <button class="btn" id="mp-rules-reset" ${d.isDefault ? 'disabled' : ''}>${L('Restaurer les règles par défaut', 'Restore default rules')}</button>
                        <span class="mp-muted" style="font-size:.75rem; margin-left:auto;">${d.updatedAt ? `${L('Modifié le', 'Updated')} ${fmtDate(d.updatedAt)}${d.updatedBy ? ` ${L('par', 'by')} ${esc(d.updatedBy)}` : ''}` : ''}</span>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:12px; min-height:0; overflow-y:auto;">
                    <div class="mp-help">
                        <div style="font-weight:700; margin-bottom:6px;">${L('Comment le prompt est assemblé', 'How the prompt is built')}</div>
                        <ol>${isEn() ? `
                            <li><strong>These rules</strong> (shared, take priority)</li>
                            <li>The <strong>agent's instructions</strong></li>
                            <li>The available <strong>tools</strong> (automatic)</li>
                            <li>The <strong>channel and date</strong> (automatic)</li>` : `
                            <li><strong>Ces règles</strong> (communes, prioritaires)</li>
                            <li>Les <strong>instructions de l'agent</strong></li>
                            <li>Les <strong>outils</strong> disponibles (automatique)</li>
                            <li>Le <strong>canal et la date</strong> (automatique)</li>`}
                        </ol>
                        <div class="mp-muted" style="margin-top:6px;">${L('Un rappel anti-invention est ajouté à la fin. Le bouton 👁 d\'un canal montre le prompt final complet.', 'A "do not invent" reminder is added at the end. A channel\'s 👁 button shows the complete final prompt.')}</div>
                    </div>
                    <div class="mp-panel" style="padding:14px;">
                        <div style="font-weight:700; margin-bottom:8px;">${L('Historique', 'History')}</div>
                        ${d.history.length ? d.history.map((h, i) => `
                            <div style="display:flex; align-items:center; gap:8px; padding:6px 0; border-top:${i ? '1px solid var(--border)' : '0'};">
                                <div style="flex:1; font-size:.75rem;">
                                    <div>Version ${h.version}</div>
                                    <div class="mp-muted">${fmtDate(h.updatedAt)}${h.updatedBy ? ` · ${esc(h.updatedBy)}` : ''}</div>
                                </div>
                                <button class="mp-iconbtn mp-rules-load" data-i="${i}" title="${L('Charger cette version dans l\'éditeur', 'Load this version in the editor')}"><span class="material-icons">history</span></button>
                            </div>`).join('') : `<div class="mp-muted" style="font-size:.8rem;">${L('Aucune version précédente.', 'No previous version.')}</div>`}
                    </div>
                </div>
            </div>`;

        const ta = body.querySelector('#mp-rules');
        body.querySelector('#mp-rules-save').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            try {
                await platformApi('PUT', { rules: ta.value });
                toast(L('Règles enregistrées : elles s\'appliquent à tous les agents clients dès le prochain message.', 'Rules saved: they apply to all client agents from the next message.'), 'success');
                renderRules();
            } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
        });
        body.querySelector('#mp-rules-reset').addEventListener('click', () => {
            if (window.showConfirmModal) {
                window.showConfirmModal({
                    title: L('Restaurer les règles par défaut', 'Restore default rules'),
                    message: L('Les règles actuelles seront remplacées par les règles par défaut pour tous les agents clients. La version actuelle reste dans l\'historique.', 'The current rules will be replaced by the default rules for all client agents. The current version stays in the history.'),
                    confirmText: L('Restaurer', 'Restore'),
                    onConfirm: async () => {
                        try { await platformApi('PUT', { reset: true }); toast(L('Règles par défaut restaurées.', 'Default rules restored.'), 'success'); renderRules(); }
                        catch (err) { toast(err.message, 'error'); }
                    }
                });
            }
        });
        body.querySelectorAll('.mp-rules-load').forEach(b => b.addEventListener('click', () => {
            ta.value = d.history[Number(b.dataset.i)].rules;
            ta.focus();
            toast(L('Version chargée dans l\'éditeur : cliquez sur « Enregistrer » pour l\'appliquer.', 'Version loaded in the editor: click "Save" to apply it.'));
        }));
    }

    // =====================================================================
    // INBOX
    // =====================================================================

    async function renderInbox() {
        const body = container.querySelector('#mp-body');
        body.innerHTML = `
            <div class="mp-inbox ${state.activeConvId ? 'has-thread' : ''}">
                <div class="mp-pane-list" style="display:flex; flex-direction:column; border:1px solid var(--border); border-radius:12px; overflow:hidden; background:var(--bg-dark);">
                    <div style="padding:10px; border-bottom:1px solid var(--border); display:flex; gap:8px;">
                        <input id="mp-search" class="form-input" placeholder="${L('Rechercher un contact ou un message…', 'Search a contact or a message…')}" style="flex:1; min-width:0;">
                        ${state.isStaff ? `<button class="mp-iconbtn" id="mp-new-msg" title="${L('Nouveau message', 'New message')}" style="width:40px; height:40px; color:var(--gold); border-color:var(--gold);"><span class="material-icons">edit_square</span></button>` : ''}
                    </div>
                    <div class="mp-filters" id="mp-filters"></div>
                    <div id="mp-conv-list" style="flex:1; overflow-y:auto;"><div class="mp-muted" style="padding:1rem; font-size:.85rem;">${L('Chargement…', 'Loading…')}</div></div>
                </div>
                <div id="mp-thread" class="mp-pane-thread" style="flex:1; display:flex; flex-direction:column; border:1px solid var(--border); border-radius:12px; overflow:hidden; background:var(--bg-dark);">
                    ${emptyThread()}
                </div>
            </div>`;
        body.querySelector('#mp-search').addEventListener('input', renderConvList);
        body.querySelector('#mp-new-msg')?.addEventListener('click', openNewMessage);
        await loadConversations();
        if (state.activeConvId) openConversation(state.activeConvId);
        state.poll = setInterval(async () => {
            if (stopIfDetached() || state.tab !== 'inbox') return;
            await loadConversations(true);
            if (state.activeConvId) openConversation(state.activeConvId, true);
        }, 10000);
    }

    function emptyThread() {
        return `
            <div style="margin:auto; color:var(--text-muted); text-align:center; padding:2rem;">
                <span class="material-icons" style="font-size:3.2rem; opacity:.4;">forum</span>
                <div style="margin-top:6px;">${L('Sélectionnez une conversation', 'Select a conversation')}</div>
            </div>`;
    }

    async function loadConversations(silent = false) {
        try {
            const data = await api('/conversations');
            state.conversations = data.conversations || [];
            setCount('#mp-unread', state.conversations.filter(c => c.unread).length);
            renderFilters();
            renderConvList();
        } catch (e) {
            if (!silent) container.querySelector('#mp-conv-list').innerHTML = `<div class="text-danger" style="padding:1rem; font-size:.85rem;">${esc(e.message)}</div>`;
        }
    }

    function renderFilters() {
        const el = container.querySelector('#mp-filters');
        if (!el) return;
        const counts = state.conversations.reduce((a, c) => { a[c.channel] = (a[c.channel] || 0) + 1; return a; }, {});
        const types = Object.keys(CHANNELS).filter(t => counts[t]);
        if (!types.length) { el.style.display = 'none'; return; }
        el.style.display = '';
        el.innerHTML = [
            `<button data-f="all" class="${state.filter === 'all' ? 'on' : ''}">${L('Tous', 'All')} · ${state.conversations.length}</button>`,
            ...types.map(t => `<button data-f="${t}" class="${state.filter === t ? 'on' : ''}" style="${state.filter === t ? `border-color:${CHANNELS[t].color}; color:${CHANNELS[t].color}; background:${CHANNELS[t].color}1a;` : ''}"><span class="material-icons" style="color:${CHANNELS[t].color};">${CHANNELS[t].icon}</span>${CHANNELS[t].label} · ${counts[t]}</button>`),
            `<button data-f="unread" class="${state.filter === 'unread' ? 'on' : ''}">${L('Non lus', 'Unread')}</button>`
        ].join('');
        el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { state.filter = b.dataset.f; renderFilters(); renderConvList(); }));
    }

    function renderConvList() {
        const list = container.querySelector('#mp-conv-list');
        if (!list) return;
        const q = (container.querySelector('#mp-search')?.value || '').toLowerCase();
        const items = state.conversations.filter(c =>
            (state.filter === 'all' || (state.filter === 'unread' ? c.unread : c.channel === state.filter)) &&
            (!q || `${c.contactName || ''} ${c.contactId} ${c.lastMessage || ''}`.toLowerCase().includes(q)));
        if (!items.length) {
            list.innerHTML = state.conversations.length
                ? `<div class="mp-muted" style="padding:1.2rem; font-size:.85rem;">${L('Aucun résultat.', 'No results.')}</div>`
                : `<div style="padding:2rem 1.2rem; text-align:center;">
                        <span class="material-icons mp-muted" style="font-size:2.4rem; opacity:.5;">mark_chat_unread</span>
                        <div style="margin:8px 0 4px; font-weight:600;">${L('Aucune conversation', 'No conversations')}</div>
                        <div class="mp-muted" style="font-size:.8rem;">${L('Les messages reçus sur les canaux du projet apparaîtront ici.', 'Messages received on the project\'s channels will appear here.')}</div>
                        ${state.isStaff ? `<button class="btn btn-primary" id="mp-go-channels" style="margin-top:12px;">${L('Connecter un canal', 'Connect a channel')}</button>` : ''}
                   </div>`;
            list.querySelector('#mp-go-channels')?.addEventListener('click', () => { state.tab = 'channels'; render(); });
            return;
        }
        list.innerHTML = items.map(c => {
            const ch = CHANNELS[c.channel] || CHANNELS.sms;
            const name = c.contactName || c.contactId;
            return `
                <div class="mp-conv ${c.id === state.activeConvId ? 'active' : ''}" data-id="${esc(c.id)}">
                    <div class="mp-avatar" style="border:2px solid ${ch.color}; background:${ch.color}1f;">${esc(initials(name))}<span class="mp-dot" style="background:${ch.color};"><span class="material-icons">${ch.icon}</span></span></div>
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; justify-content:space-between; gap:6px; align-items:baseline;">
                            <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; ${c.unread ? '' : 'font-weight:500;'}">${esc(name)}</strong>
                            <span class="mp-muted" style="font-size:.7rem; flex-shrink:0;">${fmtTime(c.lastMessageAt)}</span>
                        </div>
                        <div style="display:flex; gap:6px; align-items:center; margin-top:3px;">
                            ${channelPill(c.channel)}
                            <div class="mp-muted" style="flex:1; font-size:.8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; ${c.unread ? 'color:var(--text-main,#fff);' : ''}">${c.lastAuthor === 'ai' ? '🤖 ' : (c.lastAuthor === 'human' ? L('Vous : ', 'You: ') : '')}${esc(c.lastMessage || '')}</div>
                            ${(c.aiEnabled === false || c.ai?.channel === false) ? `<span class="mp-chip off" title="${L('Réponse IA désactivée', 'AI reply off')}">${L('IA off', 'AI off')}</span>` : ''}
                            ${c.unread ? '<span style="width:8px; height:8px; border-radius:50%; background:var(--gold); flex-shrink:0;"></span>' : ''}
                        </div>
                    </div>
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
        if (local && local.unread) {
            local.unread = false;
            setCount('#mp-unread', state.conversations.filter(c => c.unread).length);
        }
        renderConvList();

        // Keep a draft being typed, the scroll position and an open help bubble across refreshes
        const draft = thread.querySelector('#mp-reply')?.value || '';
        const openTip = thread.querySelector('.mp-tip')?.dataset.for || null;
        const prevBox = thread.querySelector('#mp-msgs');
        const wasAtBottom = !prevBox || prevBox.scrollHeight - prevBox.scrollTop - prevBox.clientHeight < 40;
        const ch = CHANNELS[conv.channel] || CHANNELS.sms;
        const name = conv.contactName || conv.contactId;
        // Effective AI state: the channel (agent + switch) first, then this contact
        const aiChannelOn = conv.ai ? conv.ai.channel !== false : true;
        const aiOn = aiChannelOn && conv.aiEnabled !== false && !conv.optedOut;
        const whereToEnable = state.isStaff ? L('dans l\'onglet Canaux', 'in the Channels tab') : L('dans l\'onglet Connect', 'in the Connect tab');
        const aiReason = conv.optedOut ? L('Ce contact s\'est désabonné (STOP) : aucun message automatique.', 'This contact unsubscribed (STOP): no automatic messages.')
            : conv.ai?.reason === 'no_agent' ? (state.isStaff ? L('Aucun agent n\'est assigné à ce canal : choisissez-en un dans l\'onglet Canaux.', 'No agent is assigned to this channel: pick one in the Channels tab.') : L('Aucun assistant IA n\'est encore configuré pour ce canal. L\'équipe Quasar s\'en occupe.', 'No AI assistant is set up for this channel yet. The Quasar team takes care of it.'))
            : conv.ai?.reason === 'channel_off' ? L(`Les réponses IA sont désactivées pour tout le canal ${ch.label}. Activez-les ${whereToEnable}.`, `AI replies are turned off for the whole ${ch.label} channel. Turn them on ${whereToEnable}.`)
            : L('Vous avez désactivé l\'IA pour ce contact : vous répondez vous-même.', 'You turned AI off for this contact: you reply yourself.');
        const replyHelp = {
            facebook: L('Répondez librement dans les 24 h qui suivent le dernier message du client. Après 24 h, Meta bloque les messages libres.', 'Reply freely within 24 h of the customer\'s last message. After 24 h, Meta blocks free-form messages.'),
            instagram: L('Répondez librement dans les 24 h qui suivent le dernier message du client. Après 24 h, Meta bloque les messages libres.', 'Reply freely within 24 h of the customer\'s last message. After 24 h, Meta blocks free-form messages.'),
            whatsapp: L('Texte libre possible dans les 24 h qui suivent le dernier message du client. Après, WhatsApp exige un modèle approuvé.', 'Free-form text works within 24 h of the customer\'s last message. After that, WhatsApp requires an approved template.'),
            sms: L('Le client reçoit un texto de votre numéro. S\'il répond STOP, il est désabonné automatiquement.', 'The customer gets a text from your number. If they reply STOP, they are unsubscribed automatically.'),
            email: L('La réponse part de votre adresse Gmail, dans le même fil de discussion.', 'The reply is sent from your Gmail address, in the same thread.')
        }[conv.channel] || '';

        const msgs = (conv.messages || []).map(m => {
            if (m.role === 'system') return `<div style="text-align:center; margin:10px 0;"><span class="mp-chip warn">${esc(m.content)}</span></div>`;
            const mine = m.role === 'assistant';
            const who = m.author === 'ai' ? `🤖 ${L('IA', 'AI')}${m.dryRun ? L(' · simulation, non envoyé', ' · simulation, not sent') : ''}` : (m.author === 'human' ? (m.senderName || L('Vous', 'You')) : name);
            return `
                <div style="display:flex; justify-content:${mine ? 'flex-end' : 'flex-start'}; margin:8px 0;">
                    <div style="max-width:72%;">
                        <div class="mp-muted" style="font-size:.7rem; margin:0 4px 3px; text-align:${mine ? 'right' : 'left'};">${esc(who)} · ${fmtTime(m.timestamp)}</div>
                        <div style="padding:9px 13px; border-radius:${mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px'}; background:${mine ? (m.author === 'ai' ? 'rgba(223,165,58,.16)' : 'rgba(62,207,142,.12)') : 'var(--bg-card)'}; border:1px solid ${mine ? (m.author === 'ai' ? 'rgba(223,165,58,.35)' : 'rgba(62,207,142,.3)') : 'var(--border)'}; white-space:pre-wrap; word-break:break-word; ${m.dryRun ? 'border-style:dashed;' : ''}">${esc(m.content)}</div>
                    </div>
                </div>`;
        }).join('');

        thread.innerHTML = `
            <div data-tip-host style="padding:12px 16px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <button class="mp-iconbtn mp-back" id="mp-back" title="${L('Retour aux conversations', 'Back to conversations')}"><span class="material-icons">arrow_back</span></button>
                <div class="mp-avatar" style="border:2px solid ${ch.color}; background:${ch.color}1f;">${esc(initials(name))}<span class="mp-dot" style="background:${ch.color};"><span class="material-icons">${ch.icon}</span></span></div>
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(name)}</div>
                    <div style="display:flex; align-items:center; gap:6px; margin-top:2px; min-width:0;">${channelPill(conv.channel)}<span class="mp-muted" style="font-size:.72rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(conv.contactId)}</span></div>
                </div>
                ${conv.optedOut ? `<span class="mp-chip warn"><span class="material-icons">block</span>${L('Désabonné (STOP)', 'Unsubscribed (STOP)')}</span>` : ''}
                <div style="display:flex; align-items:center; gap:8px;">
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:.8rem;">
                        <span class="mp-muted">${L('Réponse IA', 'AI reply')}</span>
                        <span class="mp-switch"><input type="checkbox" id="mp-ai-toggle" ${conv.aiEnabled !== false && aiChannelOn ? 'checked' : ''} ${conv.optedOut || !aiChannelOn ? 'disabled' : ''}><span></span></span>
                    </label>
                    ${tip(L('Activé : votre assistant IA répond automatiquement aux nouveaux messages de ce contact. Désactivé : vous répondez vous-même. Vous pouvez reprendre la main à tout moment.', 'On: your AI assistant automatically replies to new messages from this contact. Off: you reply yourself. You can take over at any time.'))}
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; padding:8px 16px; font-size:.78rem; border-bottom:1px solid var(--border); background:${aiOn ? 'rgba(62,207,142,.07)' : 'rgba(245,165,36,.08)'}; color:${aiOn ? '#3ecf8e' : '#f5a524'};">
                <span class="material-icons" style="font-size:1rem;">${aiOn ? 'smart_toy' : 'person'}</span>
                <span style="flex:1;">${aiOn ? L('L\'assistant IA répond automatiquement à ce contact.', 'The AI assistant replies to this contact automatically.') : `<strong>${L('IA désactivée', 'AI is off')}</strong> · ${esc(aiReason)}`}</span>
            </div>
            <div id="mp-msgs" style="flex:1; overflow-y:auto; padding:14px 18px;">${msgs || `<div class="mp-muted" style="font-size:.85rem;">${L('Aucun message.', 'No messages.')}</div>`}</div>
            <div data-tip-host style="padding:10px 12px; border-top:1px solid var(--border); display:flex; gap:8px; align-items:flex-end;">
                ${replyHelp ? `<div style="align-self:center;">${tip(replyHelp)}</div>` : ''}
                <textarea id="mp-reply" class="form-input" rows="2" style="flex:1; resize:none;" placeholder="${conv.optedOut ? L('Ce contact s\'est désabonné', 'This contact has unsubscribed') : `${L('Répondre via', 'Reply via')} ${ch.label}…`}" ${conv.optedOut ? 'disabled' : ''}></textarea>
                <button id="mp-send" class="btn btn-primary" style="height:44px;" ${conv.optedOut ? 'disabled' : ''} title="${L('Envoyer', 'Send')}"><span class="material-icons" style="vertical-align:middle;">send</span></button>
            </div>`;

        container.querySelector('.mp-inbox')?.classList.add('has-thread');
        thread.querySelector('#mp-back').addEventListener('click', () => {
            state.activeConvId = null;
            container.querySelector('.mp-inbox')?.classList.remove('has-thread');
            thread.innerHTML = emptyThread();
            renderConvList();
        });

        bindTips(thread);
        if (openTip) [...thread.querySelectorAll('.mp-tip-btn')].find(b => b.dataset.tip === openTip)?.click();
        const box = thread.querySelector('#mp-msgs');
        if (wasAtBottom) box.scrollTop = box.scrollHeight;
        else if (prevBox) box.scrollTop = prevBox.scrollTop;
        const reply = thread.querySelector('#mp-reply');
        reply.value = draft;

        thread.querySelector('#mp-ai-toggle').addEventListener('change', async (e) => {
            try {
                await api(`/conversations/${encodeURIComponent(convId)}`, { method: 'PATCH', body: { aiEnabled: e.target.checked } });
                const c = state.conversations.find(x => x.id === convId);
                if (c) c.aiEnabled = e.target.checked;
                renderConvList();
                openConversation(convId, true);
                toast(e.target.checked ? L('Réponse IA activée pour ce contact.', 'AI reply turned on for this contact.') : L('Réponse IA désactivée : vous répondez manuellement.', 'AI reply turned off: you reply manually.'), 'success');
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
                toast(`${L('Envoi impossible', 'Could not send')} : ${err.message}`, 'error');
            } finally { btn.disabled = false; }
        };
        thread.querySelector('#mp-send').addEventListener('click', send);
        reply.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    }

    // =====================================================================
    // CHANNELS
    // =====================================================================

    async function loadChannels() {
        state.channels = (await api('/channels')).channels || [];
        setCount('#mp-ch-count', state.channels.length);
    }

    async function renderChannels() {
        const body = container.querySelector('#mp-body');
        if (state.wizard) return renderWizard();
        body.innerHTML = `<div class="mp-muted">${L('Chargement des canaux…', 'Loading channels…')}</div>`;
        try { await loadChannels(); }
        catch (e) { body.innerHTML = `<div class="text-danger">${esc(e.message)}</div>`; return; }

        if (!state.channels.length) {
            body.innerHTML = `
                <div style="max-width:820px; margin:0 auto; padding-top:1rem; overflow-y:auto; height:100%;">
                    <div style="text-align:center; margin-bottom:1.5rem;">
                        <div style="font-size:1.2rem; font-weight:700;">${L('Connectez le premier canal de ce client', 'Connect this client\'s first channel')}</div>
                        <div class="mp-muted" style="font-size:.85rem; margin-top:4px;">${L('Chaque message reçu arrive dans la boîte de réception et l\'agent IA peut y répondre.', 'Every message received lands in the inbox, and the AI agent can reply to it.')}</div>
                    </div>
                    ${typeTiles()}
                </div>`;
            bindTiles(body);
            return;
        }

        const agentName = (id) => state.agents.find(a => a.id === id)?.name;
        const cards = state.channels.map(c => {
            const ch = CHANNELS[c.type];
            const agent = agentName(c.agentId);
            const credOk = c.type === 'sms' ? true : (c.type === 'email' ? c.hasToken && !c.lastError : c.hasToken);
            const credLabel = c.type === 'sms' ? (c.hasTwilioCredentials ? L('Twilio du client', 'Client\'s Twilio') : 'Twilio Quasar')
                : c.type === 'email' ? (!c.hasToken ? L('À reconnecter', 'Reconnect needed') : (c.lastError ? L('Erreur de synchro', 'Sync error') : L('Gmail connecté', 'Gmail connected')))
                : (c.hasToken ? L('Jeton enregistré', 'Token saved') : L('Jeton manquant', 'Token missing'));
            const smsUrl = c.type === 'sms' ? smsWebhookUrl(c) : '';
            return `
                <div class="mp-card ${c.active ? '' : 'paused'}" style="--mp-accent:${ch.color};" data-id="${esc(c.id)}">
                    <div class="mp-row-main">
                        <div style="display:flex; gap:12px; align-items:center; min-width:0;">
                            <div class="mp-ico" style="background:${ch.color}1f; color:${ch.color};"><span class="material-icons">${ch.icon}</span></div>
                            <div style="min-width:0;">
                                <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(c.label || ch.label)}</div>
                                <div class="mp-muted" style="font-size:.75rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ch.label} · ${esc(c.externalId)}</div>
                            </div>
                        </div>
                        <div class="mp-col-opt"><span class="mp-chip ${agent ? 'ok' : 'warn'}"><span class="material-icons">smart_toy</span>${agent ? esc(agent) : L('Aucun agent', 'No agent')}</span></div>
                        <div class="mp-col-opt"><span class="mp-chip ${credOk ? 'ok' : 'warn'}"><span class="material-icons">${credOk ? 'key' : 'key_off'}</span>${credLabel}</span></div>
                        <div class="mp-col-opt"><span class="mp-chip ${c.active ? 'ok' : 'off'}">${c.active ? L('Actif', 'Active') : L('En pause', 'Paused')}</span></div>
                        <label class="mp-col-opt" style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:.8rem;" title="${L('L\'agent répond automatiquement aux messages de ce canal', 'The agent automatically replies to messages on this channel')}">
                            <span class="mp-switch"><input type="checkbox" class="mp-quick-ai" ${c.aiEnabled ? 'checked' : ''} ${agent ? '' : 'disabled'}><span></span></span>
                            <span class="mp-muted">${c.aiEnabled ? L('Activée', 'On') : L('Désactivée', 'Off')}</span>
                        </label>
                        <div class="mp-actions">
                            ${smsUrl ? `<button class="mp-iconbtn mp-copy-btn" data-copy="${esc(smsUrl)}" title="${L('Copier le webhook Twilio (« A message comes in », HTTP POST)', 'Copy the Twilio webhook ("A message comes in", HTTP POST)')}"><span class="material-icons">link</span></button>` : ''}
                            ${c.type === 'whatsapp' ? `<button class="mp-iconbtn mp-templates" title="${L('Modèles WhatsApp', 'WhatsApp templates')}"><span class="material-icons">description</span></button>` : ''}
                            ${agent ? `<button class="mp-iconbtn mp-prompt" title="${L('Voir le prompt final de l\'agent sur ce canal', 'View the agent\'s final prompt on this channel')}"><span class="material-icons">visibility</span></button>` : ''}
                            <button class="mp-iconbtn mp-sim" title="${L('Simuler un message entrant', 'Simulate an incoming message')}"><span class="material-icons">play_arrow</span></button>
                            ${c.type === 'email' ? `<button class="mp-iconbtn mp-test" title="${L('Synchroniser Gmail maintenant', 'Sync Gmail now')}"><span class="material-icons">sync</span></button>`
                                : c.type !== 'sms' ? `<button class="mp-iconbtn mp-test" title="${L('Vérifier le jeton', 'Check the token')}"><span class="material-icons">verified</span></button>` : ''}
                            <button class="mp-iconbtn mp-edit" title="${L('Modifier', 'Edit')}"><span class="material-icons">edit</span></button>
                            <button class="mp-iconbtn danger mp-del" title="${L('Supprimer', 'Delete')}"><span class="material-icons">delete_outline</span></button>
                        </div>
                    </div>
                </div>`;
        }).join('');

        body.innerHTML = `
            <div style="overflow-y:auto; height:100%; padding-right:4px;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
                    <div style="flex:1;">
                        <div style="font-size:1.05rem; font-weight:700;">${L('Canaux connectés', 'Connected channels')}</div>
                        <div class="mp-muted" style="font-size:.8rem;">${L('Les messages reçus sur ces canaux arrivent dans la boîte de réception du projet.', 'Messages received on these channels land in the project\'s inbox.')}</div>
                    </div>
                    <button class="btn btn-primary" id="mp-add"><span class="material-icons" style="font-size:1.1rem; vertical-align:text-bottom;">add</span> ${L('Connecter un canal', 'Connect a channel')}</button>
                </div>
                <div class="mp-list">
                    <div class="mp-list-head"><div>${L('Canal', 'Channel')}</div><div>Agent</div><div>${L('Connexion', 'Connection')}</div><div>${L('Statut', 'Status')}</div><div>${L('Réponses IA', 'AI replies')}</div><div style="text-align:right;">Actions</div></div>
                    ${cards}
                </div>
                <details class="mp-tech" style="margin-top:20px;">
                    <summary>${L('Informations techniques', 'Technical information')}</summary>
                    <div class="mp-panel" style="margin-top:10px; font-size:.8rem;">
                        <div style="font-weight:600; margin-bottom:6px;">${L('Webhook de l\'app Meta des clients (« Quasar Messaging Platform »)', 'Webhook of the clients\' Meta app ("Quasar Messaging Platform")')}</div>
                        <div class="mp-copy"><code>${PUBLIC_BASE}/api/mp/webhook/meta</code><button class="mp-iconbtn mp-copy-btn" data-copy="${PUBLIC_BASE}/api/mp/webhook/meta" title="${L('Copier', 'Copy')}"><span class="material-icons">content_copy</span></button></div>
                        <div class="mp-muted" style="margin-top:6px;">${L('Jeton de vérification : variable <code>MP_META_VERIFY_TOKEN</code> du backend.', 'Verify token: backend variable <code>MP_META_VERIFY_TOKEN</code>.')}</div>
                    </div>
                </details>
            </div>`;

        body.querySelector('#mp-add').addEventListener('click', () => { state.wizard = { step: 'type' }; renderWizard(); });
        body.querySelectorAll('.mp-copy-btn').forEach(b => b.addEventListener('click', () => copyText(b.dataset.copy)));

        body.querySelectorAll('.mp-card').forEach(card => {
            const c = state.channels.find(x => x.id === card.dataset.id);
            if (!c) return;

            card.querySelector('.mp-quick-ai').addEventListener('change', async (e) => {
                try {
                    await saveChannel({ ...channelPayload(c), aiEnabled: e.target.checked });
                    c.aiEnabled = e.target.checked;
                    const lbl = e.target.closest('label')?.querySelector('.mp-muted');
                    if (lbl) lbl.textContent = e.target.checked ? L('Activée', 'On') : L('Désactivée', 'Off');
                    toast(e.target.checked ? L('Réponses IA activées sur ce canal.', 'AI replies turned on for this channel.') : L('Réponses IA désactivées sur ce canal.', 'AI replies turned off for this channel.'), 'success');
                } catch (err) { toast(err.message, 'error'); e.target.checked = !e.target.checked; }
            });

            card.querySelector('.mp-edit').addEventListener('click', () => {
                state.wizard = { step: 'form', type: c.type, editing: c };
                renderWizard();
            });

            card.querySelector('.mp-del').addEventListener('click', () => {
                confirmInApp(L(`Supprimer le canal « ${c.label || CHANNELS[c.type].label} » ? Les conversations existantes sont conservées.`, `Delete the channel "${c.label || CHANNELS[c.type].label}"? Existing conversations are kept.`), async () => {
                    try {
                        await api(`/channels/${encodeURIComponent(c.id)}`, { method: 'DELETE' });
                        toast(L('Canal supprimé.', 'Channel deleted.'), 'success');
                        renderChannels();
                    } catch (err) { toast(err.message, 'error'); }
                });
            });

            card.querySelector('.mp-test')?.addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                btn.disabled = true;
                try {
                    const r = await api(`/channels/${encodeURIComponent(c.id)}/test`, { method: 'POST' });
                    toast(r.account ? `${L('Jeton valide', 'Valid token')} · ${r.account.name || ''}` : (r.info || 'OK'), 'success');
                    if (c.type === 'email') renderChannels();
                } catch (err) {
                    toast(`${c.type === 'email' ? L('Synchronisation impossible', 'Sync failed') : L('Jeton invalide', 'Invalid token')} : ${err.message}`, 'error');
                    if (c.type === 'email') renderChannels();
                }
                finally { btn.disabled = false; }
            });

            card.querySelector('.mp-sim').addEventListener('click', () => toggleSimulation(card, c));
            card.querySelector('.mp-templates')?.addEventListener('click', () => openTemplates(c));
            card.querySelector('.mp-prompt')?.addEventListener('click', () => showPromptPreview({
                apiBase: state.apiBase, getToken: state.getToken, projectId: state.projectId, agentId: c.agentId, channel: c.type
            }));
        });
    }

    function toggleSimulation(card, c) {
        const open = card.querySelector('.mp-sim-row');
        if (open) { open.remove(); return; }
        const row = document.createElement('div');
        row.className = 'mp-sim-row';
        row.innerHTML = `
            <div class="mp-muted" style="font-size:.72rem; margin-bottom:4px;">${L('Message de test (la réponse IA est enregistrée, sans être envoyée)', 'Test message (the AI reply is saved, not sent)')}</div>
            <div style="display:flex; gap:8px;">
                <input class="form-input" style="flex:1;" value="${L('Bonjour, quels sont vos horaires ?', 'Hi, what are your opening hours?')}">
                <button class="btn btn-primary">${L('Tester', 'Test')}</button>
            </div>`;
        card.appendChild(row);
        const input = row.querySelector('input');
        const go = row.querySelector('button');
        input.focus(); input.select();
        const run = async () => {
            const text = input.value.trim();
            if (!text) return;
            go.disabled = true; go.textContent = L('IA…', 'AI…');
            try {
                const r = await api('/simulate', { method: 'POST', body: { channelId: c.id, text } });
                if (!r.replied) toast(`${L('Message enregistré, pas de réponse IA', 'Message saved, no AI reply')} (${r.reason || r.error || L('IA désactivée ou aucun agent', 'AI off or no agent')}).`);
                else toast(L('Réponse IA générée (simulation, non envoyée).', 'AI reply generated (simulation, not sent).'), 'success');
                state.activeConvId = `${c.type}_simulation`;
                state.tab = 'inbox';
                render();
            } catch (err) {
                toast(err.message, 'error');
                go.disabled = false; go.textContent = L('Tester', 'Test');
            }
        };
        go.addEventListener('click', run);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
    }

    const channelPayload = (c) => ({
        type: c.type, externalId: c.externalId, label: c.label || null, agentId: c.agentId || null,
        ...(c.type === 'whatsapp' ? { wabaId: c.wabaId || null } : {}),
        aiEnabled: c.aiEnabled, active: c.active
    });
    const saveChannel = async (payload) => (await api('/channels', { method: 'POST', body: payload })).channel;

    // ---------- Add / edit wizard ----------

    function typeTiles() {
        return `<div class="mp-tiles">${Object.entries(CHANNELS).map(([k, v]) => `
            <button type="button" class="mp-tile" data-type="${k}" style="--mp-accent:${v.color};">
                <div class="mp-ico" style="background:${v.color}1f; color:${v.color};"><span class="material-icons">${v.icon}</span></div>
                <div style="font-weight:700;">${v.label}</div>
                <div class="mp-muted" style="font-size:.78rem;">${v.tagline}</div>
            </button>`).join('')}</div>`;
    }

    function bindTiles(root) {
        root.querySelectorAll('.mp-tile').forEach(t => t.addEventListener('click', () => {
            state.wizard = { step: 'form', type: t.dataset.type };
            renderWizard();
        }));
    }

    function wizardHeader(title, subtitle) {
        return `
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:18px;">
                <button class="mp-iconbtn" id="mp-wz-back" title="${L('Retour', 'Back')}"><span class="material-icons">arrow_back</span></button>
                <div>
                    <div style="font-size:1.05rem; font-weight:700;">${title}</div>
                    ${subtitle ? `<div class="mp-muted" style="font-size:.8rem;">${subtitle}</div>` : ''}
                </div>
            </div>`;
    }

    function renderWizard() {
        const body = container.querySelector('#mp-body');
        const wz = state.wizard;
        const back = (to) => body.querySelector('#mp-wz-back').addEventListener('click', to);

        if (wz.step === 'type') {
            body.innerHTML = `<div style="max-width:820px; margin:0 auto; overflow-y:auto; height:100%;">
                ${wizardHeader(L('Connecter un canal', 'Connect a channel'), L('Étape 1 sur 2 · choisissez le type de canal', 'Step 1 of 2 · choose the channel type'))}
                ${typeTiles()}
            </div>`;
            back(() => { state.wizard = null; renderChannels(); });
            bindTiles(body);
            return;
        }

        const ch = CHANNELS[wz.type];
        const ed = wz.editing;

        if (wz.step === 'done') {
            const c = wz.saved;
            const url = c.type === 'sms' ? smsWebhookUrl(c) : '';
            body.innerHTML = `<div style="max-width:640px; margin:0 auto; overflow-y:auto; height:100%;">
                <div class="mp-panel" style="text-align:center;">
                    <div class="mp-ico" style="margin:0 auto 10px; width:56px; height:56px; background:#3ecf8e1f; color:#3ecf8e;"><span class="material-icons" style="font-size:2rem;">check_circle</span></div>
                    <div style="font-size:1.1rem; font-weight:700;">${ch.label} ${ed ? L('mis à jour', 'updated') : L('connecté', 'connected')}</div>
                    <div class="mp-muted" style="font-size:.85rem; margin-top:4px;">${esc(c.label || c.externalId)}</div>
                </div>
                ${url ? `
                <div class="mp-panel" style="margin-top:14px;">
                    <div style="font-weight:700; margin-bottom:4px;">${L('Dernière étape : brancher le numéro dans Twilio', 'Last step: connect the number in Twilio')}</div>
                    <div class="mp-muted" style="font-size:.8rem; margin-bottom:10px;">Twilio › Phone Numbers › ${esc(c.externalId)} › Messaging › "A message comes in" › Webhook, ${L('méthode HTTP POST', 'HTTP POST method')}.</div>
                    <div class="mp-copy"><code>${esc(url)}</code><button class="mp-iconbtn mp-copy-btn" data-copy="${esc(url)}" title="${L('Copier', 'Copy')}"><span class="material-icons">content_copy</span></button></div>
                </div>` : `
                <div class="mp-panel" style="margin-top:14px;">
                    <div style="font-weight:700; margin-bottom:4px;">${L('À vérifier côté Meta', 'To check in Meta')}</div>
                    <div class="mp-muted" style="font-size:.8rem;">${L('Le compte doit être abonné au champ « messages » dans l\'app « Quasar Messaging Platform » (jamais dans l\'app Quasar).', 'The account must be subscribed to the "messages" field in the "Quasar Messaging Platform" app (never in the Quasar app).')}</div>
                </div>`}
                <div style="display:flex; gap:10px; justify-content:center; margin-top:16px;">
                    <button class="btn" id="mp-wz-sim">${L('Tester avec un message simulé', 'Test with a simulated message')}</button>
                    <button class="btn btn-primary" id="mp-wz-finish">${L('Terminer', 'Done')}</button>
                </div>
            </div>`;
            body.querySelectorAll('.mp-copy-btn').forEach(b => b.addEventListener('click', () => copyText(b.dataset.copy)));
            body.querySelector('#mp-wz-finish').addEventListener('click', () => { state.wizard = null; renderChannels(); });
            body.querySelector('#mp-wz-sim').addEventListener('click', async () => {
                state.wizard = null;
                await renderChannels();
                const card = container.querySelector(`.mp-card[data-id="${CSS.escape(c.id)}"]`);
                if (card) toggleSimulation(card, state.channels.find(x => x.id === c.id) || c);
            });
            return;
        }

        // step 'form'
        body.innerHTML = `<div style="max-width:900px; margin:0 auto; overflow-y:auto; height:100%;">
            ${wizardHeader(ed ? `${L('Modifier', 'Edit')} · ${esc(ed.label || ch.label)}` : `${L('Connecter', 'Connect')} ${ch.label}`, ed ? '' : L('Étape 2 sur 2 · informations du compte', 'Step 2 of 2 · account details'))}
            <div style="display:grid; grid-template-columns:minmax(0, 1.4fr) minmax(0, 1fr); gap:16px; align-items:start;">
                <form id="mp-wz-form" class="mp-panel" style="--mp-accent:${ch.color};">
                    <div style="display:flex; gap:10px; align-items:center; margin-bottom:16px;">
                        <div class="mp-ico" style="background:${ch.color}1f; color:${ch.color};"><span class="material-icons">${ch.icon}</span></div>
                        <div style="font-weight:700;">${ch.label}</div>
                    </div>
                    ${ch.oauth && !ed ? `
                    <div class="mp-help" style="margin-bottom:14px;">${L('L\'adresse sera celle du compte Google choisi à l\'étape suivante.', 'The address will be the one of the Google account chosen in the next step.')}</div>` : `
                    <div class="mp-field">
                        <label>${ch.idLabel}</label>
                        <input id="mp-f-id" class="form-input" placeholder="${esc(ch.idPlaceholder)}" value="${esc(ed?.externalId || '')}" ${ed ? 'disabled' : 'required'}>
                        ${ed ? `<small>${L('L\'identifiant ne peut pas être modifié. Supprimez le canal pour en changer.', 'The ID cannot be changed. Delete the channel to use another one.')}</small>` : ''}
                    </div>`}
                    <div class="mp-field">
                        <label>${L('Nom affiché', 'Display name')} <span class="mp-muted" style="font-weight:400;">(${L('optionnel', 'optional')})</span></label>
                        <input id="mp-f-label" class="form-input" placeholder="${L('ex. Page Clinique ABC', 'e.g. ABC Clinic Page')}" value="${esc(ed?.label || '')}">
                    </div>
                    <div class="mp-field">
                        <label>${L('Agent qui répond', 'Replying agent')}</label>
                        <select id="mp-f-agent" class="form-input">
                            <option value="">${L('Aucun : boîte de réception seulement', 'None: inbox only')}</option>
                            ${state.agents.map(a => `<option value="${esc(a.id)}" ${(ed ? ed.agentId === a.id : state.agents.length === 1) ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
                        </select>
                        ${state.agents.length ? '' : `<small>${L('Ce projet n\'a pas encore d\'agent : créez-en un dans l\'onglet Agents pour activer les réponses IA.', 'This project has no agent yet: create one in the Agents tab to turn on AI replies.')}</small>`}
                    </div>
                    ${ch.oauth ? (ed ? `
                    <div class="mp-field">
                        <label>${L('Connexion Google', 'Google connection')}</label>
                        <div class="mp-muted" style="font-size:.8rem;">${ed.hasToken ? `${L('Connectée · dernière synchro', 'Connected · last sync')} : ${ed.lastSyncAt ? new Date(ed.lastSyncAt).toLocaleString(LOCALE()) : L('jamais', 'never')}` : L('Non connectée', 'Not connected')}${ed.lastError ? `<br><span style="color:#f5a524;">${L('Erreur', 'Error')} : ${esc(ed.lastError)}</span>` : ''}</div>
                        <button type="button" class="btn" id="mp-f-reconnect" style="margin-top:6px; align-self:flex-start;">${L('Reconnecter Gmail', 'Reconnect Gmail')}</button>
                    </div>` : '') : ch.tokenLabel ? `
                    <div class="mp-field">
                        <label>${ch.tokenLabel}</label>
                        <input id="mp-f-token" class="form-input" type="password" autocomplete="off" placeholder="${ed?.hasToken ? L('Jeton enregistré · laisser vide pour le conserver', 'Token saved · leave empty to keep it') : esc(ch.tokenPlaceholder)}" ${ed?.hasToken ? '' : 'required'}>
                    </div>
                    ${wz.type === 'whatsapp' ? `
                    <div class="mp-field">
                        <label>${L('ID du compte WhatsApp Business (WABA)', 'WhatsApp Business Account ID (WABA)')}</label>
                        <input id="mp-f-waba" class="form-input" placeholder="${L('ex.', 'e.g.')} 1092204263808720" value="${esc(ed?.wabaId || '')}">
                        <small>${L('Nécessaire pour les modèles de message. Visible dans WhatsApp › Configuration de l\'API (« ID du compte WhatsApp Business »).', 'Required for message templates. Shown in WhatsApp › API Setup ("WhatsApp Business Account ID").')}</small>
                    </div>` : ''}` : `
                    <details style="margin-bottom:14px;">
                        <summary class="mp-muted" style="cursor:pointer; font-size:.8rem;">${L('Utiliser le compte Twilio du client (optionnel)', 'Use the client\'s Twilio account (optional)')}</summary>
                        <div class="mp-field" style="margin-top:10px;">
                            <label>Account SID</label>
                            <input id="mp-f-tsid" class="form-input" placeholder="${L('AC… (vide = compte Twilio Quasar)', 'AC… (empty = Quasar Twilio account)')}">
                        </div>
                        <div class="mp-field">
                            <label>Auth Token</label>
                            <input id="mp-f-ttoken" class="form-input" type="password" autocomplete="off">
                        </div>
                    </details>`}
                    <div style="display:flex; flex-direction:column; gap:10px; margin:6px 0 18px;">
                        <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:.85rem;">
                            <span class="mp-switch"><input type="checkbox" id="mp-f-ai" ${ed ? (ed.aiEnabled ? 'checked' : '') : (ch.oauth ? '' : 'checked')}><span></span></span> ${L('L\'agent répond automatiquement', 'The agent replies automatically')}
                        </label>
                        <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:.85rem;">
                            <span class="mp-switch"><input type="checkbox" id="mp-f-active" ${ed ? (ed.active ? 'checked' : '') : 'checked'}><span></span></span> ${L('Canal actif', 'Channel active')}
                        </label>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button type="submit" class="btn btn-primary" style="flex:1;">${ed ? L('Enregistrer', 'Save') : (ch.oauth ? L('Connecter Gmail', 'Connect Gmail') : `${L('Connecter', 'Connect')} ${ch.label}`)}</button>
                        <button type="button" class="btn" id="mp-wz-cancel">${L('Annuler', 'Cancel')}</button>
                    </div>
                </form>
                <div class="mp-help">
                    <div style="font-weight:700; display:flex; gap:6px; align-items:center;"><span class="material-icons" style="font-size:1.1rem; color:var(--gold);">tips_and_updates</span> ${L('Où trouver ces informations ?', 'Where to find this information?')}</div>
                    <ol>${ch.help.map(h => `<li>${esc(h)}</li>`).join('')}</ol>
                </div>
            </div>
        </div>`;

        back(() => { state.wizard = ed ? null : { step: 'type' }; ed ? renderChannels() : renderWizard(); });
        body.querySelector('#mp-wz-cancel').addEventListener('click', () => { state.wizard = null; renderChannels(); });
        // Gmail: send the user to Google; the callback brings them back to this page
        const startGmailOAuth = async (btn) => {
            const f = (id) => body.querySelector(id);
            btn.disabled = true;
            try {
                const params = new URLSearchParams({
                    agentId: f('#mp-f-agent').value || '',
                    aiEnabled: String(f('#mp-f-ai').checked),
                    label: f('#mp-f-label').value.trim(),
                    returnTo: window.location.href.split('&gmail=')[0]
                });
                const { url } = await api(`/gmail/auth-url?${params}`);
                window.location.href = url;
            } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
        };
        body.querySelector('#mp-f-reconnect')?.addEventListener('click', (e) => startGmailOAuth(e.currentTarget));

        body.querySelector('#mp-wz-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const f = (id) => body.querySelector(id);
            const btn = e.submitter || f('button[type=submit]');
            if (ch.oauth && !ed) return startGmailOAuth(btn);
            const payload = {
                type: wz.type,
                externalId: ed ? ed.externalId : f('#mp-f-id').value.trim(),
                label: f('#mp-f-label').value.trim() || null,
                agentId: f('#mp-f-agent').value || null,
                accessToken: f('#mp-f-token')?.value.trim() || undefined,
                wabaId: f('#mp-f-waba') ? f('#mp-f-waba').value.trim() : undefined,
                twilioAccountSid: f('#mp-f-tsid')?.value.trim() || undefined,
                twilioAuthToken: f('#mp-f-ttoken')?.value.trim() || undefined,
                aiEnabled: f('#mp-f-ai').checked,
                active: f('#mp-f-active').checked
            };
            btn.disabled = true;
            try {
                const saved = await saveChannel(payload);
                await loadChannels();
                state.wizard = { step: 'done', type: wz.type, editing: ed, saved };
                renderWizard();
            } catch (err) {
                toast(err.message, 'error');
                btn.disabled = false;
            }
        });
        if (!ed) body.querySelector('#mp-f-id')?.focus();
    }

    render();
    // Show channel count on the tab from the start
    if (state.isStaff) loadChannels().catch(() => { });

    // Re-render in the new language when the ERP EN/FR toggle is used
    const onLang = () => {
        window.removeEventListener('languageChanged', onLang);
        clearInterval(state.poll);
        if (document.body.contains(container) && container.querySelector('#mp-root')) {
            renderProjectMessaging(container, { ...opts, initialTab: state.tab });
        }
    };
    window.addEventListener('languageChanged', onLang);
}
