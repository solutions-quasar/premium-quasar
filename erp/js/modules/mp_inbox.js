/**
 * Messaging Platform (clients) — project inbox + channel management UI.
 * Used in the AI Agents module (ERP staff). Separate from the Quasar SMS & Social Inbox (sms.js).
 * Talks only to /api/mp/* (see erp/backend/messaging-platform).
 */

const CHANNELS = {
    facebook: {
        label: 'Messenger', icon: 'chat', color: '#0084ff',
        tagline: 'Messages de la Page Facebook',
        idLabel: 'ID de la Page Facebook', idPlaceholder: 'ex. 1220358074484046',
        tokenLabel: 'Jeton d\'accès de la Page', tokenPlaceholder: 'EAA…',
        help: [
            'Dans l\'app Meta « Quasar Messaging Platform » : Cas d\'utilisation › Messenger › Paramètres de Messenger API.',
            'Section « Générez des tokens d\'accès » : l\'ID est sous le nom de la Page, le jeton via « Générer ».',
            'Sur la même ligne, ajoutez les abonnements « messages » et « message_echoes ».'
        ]
    },
    instagram: {
        label: 'Instagram', icon: 'photo_camera', color: '#e1306c',
        tagline: 'Messages directs Instagram',
        idLabel: 'ID du compte Instagram professionnel', idPlaceholder: 'ex. 17841400000000000',
        tokenLabel: 'Jeton Instagram', tokenPlaceholder: 'IGAA… (ou jeton de Page EAA…)',
        help: [
            'Dans l\'app Meta clients : Cas d\'utilisation › Instagram › Configuration de l\'API avec connexion Instagram.',
            'Ajoutez le compte, puis « Générer un token » : l\'ID du compte est affiché à côté.',
            'Abonnez le compte au champ « messages » et activez « Autoriser l\'accès aux messages » dans l\'app Instagram.'
        ]
    },
    whatsapp: {
        label: 'WhatsApp', icon: 'forum', color: '#25d366',
        tagline: 'Numéro WhatsApp Business',
        idLabel: 'Phone Number ID', idPlaceholder: 'ex. 1389043390962434',
        tokenLabel: 'Jeton permanent (utilisateur système)', tokenPlaceholder: 'EAA…',
        help: [
            'Un numéro propre au client (jamais celui de Quasar).',
            'Le Phone Number ID est dans WhatsApp › Configuration de l\'API.',
            'Jeton permanent : Business Manager › Utilisateurs système, avec l\'app et le compte WhatsApp assignés.'
        ]
    },
    email: {
        label: 'Courriel', icon: 'mail', color: '#ea4335',
        tagline: 'Boîte Gmail / Google Workspace',
        idLabel: 'Adresse Gmail', idPlaceholder: 'connectée via Google',
        tokenLabel: null, oauth: true,
        help: [
            'Cliquez sur « Connecter Gmail » : la fenêtre de Google s\'ouvre, choisissez la boîte du client et acceptez.',
            'Seuls les nouveaux courriels de la boîte de réception sont importés (pas l\'historique), toutes les 2 minutes. Promotions, réseaux sociaux et notifications sont ignorés.',
            'Les réponses partent de cette adresse, dans le même fil de discussion.',
            'Réponse IA désactivée par défaut sur le courriel : activez-la seulement si l\'agent est bien configuré.'
        ]
    },
    sms: {
        label: 'SMS', icon: 'sms', color: '#dfa53a',
        tagline: 'Numéro de texto Twilio',
        idLabel: 'Numéro Twilio', idPlaceholder: '+15551234567',
        tokenLabel: null,
        help: [
            'Un numéro Twilio dédié au client (jamais le numéro de Quasar).',
            'Après l\'enregistrement, copiez l\'adresse du webhook affichée dans Twilio › Phone Numbers › le numéro › « A message comes in » (HTTP POST).'
        ]
    }
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
const initials = (name) => String(name || '?').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '#';
const smsWebhookUrl = (c) => c.webhookKey ? `${PUBLIC_BASE}/api/mp/sms/twilio/${c.webhookKey}` : '';

/**
 * In-app modal: business questionnaire → AI-generated agent instructions (layer 2).
 * onUse(prompt) receives the reviewed text (the caller puts it in the agent form).
 */
export function openPromptGenerator({ apiBase, getToken, projectId, agentId = null, initialBrief = {}, onUse }) {
    document.getElementById('mp-gen-modal')?.remove();
    const FIELDS = [
        ['businessName', 'Nom de l\'entreprise *', 'input', 'ex. Ben\'s Small Engines'],
        ['activity', 'Activité *', 'input', 'ex. Réparation de tondeuses, souffleuses et VTT'],
        ['agentName', 'Nom de l\'assistant', 'input', 'ex. Jose Luis'],
        ['location', 'Adresse / zone desservie', 'input', 'ex. 123 rue Main, Moncton (NB) · Grand Moncton'],
        ['contact', 'Téléphone, courriel, site web', 'input', 'ex. 506 555-1234 · info@… · www…'],
        ['hours', 'Horaires', 'textarea', 'ex. Lun-ven 8h-17h · Sam 9h-12h · Fermé dim'],
        ['services', 'Services et produits', 'textarea', 'Un service par ligne'],
        ['prices', 'Prix et tarifs', 'textarea', 'ex. Changement d\'huile tondeuse : 45 $ · Diagnostic : 30 $'],
        ['booking', 'Rendez-vous / commandes', 'textarea', 'ex. Sur rendez-vous seulement ; l\'équipe rappelle pour confirmer'],
        ['policies', 'Politiques', 'textarea', 'Garantie, paiement, annulation, délais…'],
        ['faq', 'Questions fréquentes', 'textarea', 'Q : … R : …'],
        ['tone', 'Ton', 'input', 'ex. Amical, tutoiement interdit, phrases courtes'],
        ['languages', 'Langues', 'input', 'ex. Français et anglais'],
        ['extra', 'Autres consignes', 'textarea', 'Tout ce que l\'assistant doit savoir ou éviter']
    ];
    const overlay = document.createElement('div');
    overlay.id = 'mp-gen-modal';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,.8); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:24px;';
    overlay.innerHTML = `
        <div style="width:min(980px, 100%); max-height:92vh; display:flex; flex-direction:column; background:#12141A; border:1px solid rgba(223,165,58,.4); border-radius:14px; overflow:hidden;">
            <div style="display:flex; align-items:center; gap:10px; padding:14px 18px; border-bottom:1px solid var(--border, #2a2d36);">
                <span class="material-icons" style="color:var(--gold);">auto_awesome</span>
                <div style="flex:1;">
                    <div style="font-weight:700;">Générer les instructions de l'agent avec l'IA</div>
                    <div style="font-size:.75rem; color:var(--text-muted);">L'IA n'utilise que ce que vous écrivez ici. Ce que vous laissez vide, l'agent dira qu'il doit le vérifier avec l'équipe.</div>
                </div>
                <button id="mp-gen-close" style="background:transparent; border:0; color:var(--text-muted); cursor:pointer;" title="Fermer"><span class="material-icons">close</span></button>
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
                <button class="btn" id="mp-gen-back" style="display:none;">Modifier les réponses</button>
                <button class="btn btn-primary" id="mp-gen-go">Générer</button>
                <button class="btn btn-primary" id="mp-gen-use" style="display:none;">Utiliser ces instructions</button>
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
        if (!brief.businessName || !brief.activity) { toast('Indiquez au moins le nom de l\'entreprise et son activité.', 'error'); return; }
        const go = q('#mp-gen-go');
        go.disabled = true; go.textContent = 'Génération…';
        q('#mp-gen-status').textContent = 'L\'IA rédige les instructions (10 à 20 secondes)…';
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
                <div style="font-size:.78rem; color:var(--text-muted); margin-bottom:8px;">Relisez et corrigez si besoin. Les règles de la plateforme et les consignes d'outils sont ajoutées automatiquement à l'envoi.</div>
                <textarea id="mp-gen-result" class="form-input" style="width:100%; min-height:52vh; resize:vertical; font-size:.85rem; line-height:1.5;">${esc(d.prompt)}</textarea>`;
            go.style.display = 'none'; q('#mp-gen-use').style.display = ''; q('#mp-gen-back').style.display = '';
            q('#mp-gen-status').textContent = agentId ? 'Vos réponses sont enregistrées dans l\'agent pour une prochaine génération.' : '';
        } catch (e) {
            toast(`Génération impossible : ${e.message}`, 'error');
            q('#mp-gen-status').textContent = '';
        } finally {
            go.disabled = false; go.textContent = 'Générer';
        }
    });
    q('#mp-gen-use').addEventListener('click', () => {
        const text = q('#mp-gen-result')?.value.trim();
        if (!text) return;
        onUse?.(text);
        close();
        toast('Instructions insérées : cliquez sur « Save Changes » pour enregistrer l\'agent.', 'success');
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
                    <div style="font-weight:700;">Prompt final de l'agent</div>
                    <div id="mp-pp-meta" style="font-size:.75rem; color:var(--text-muted);">Chargement…</div>
                </div>
                <select id="mp-pp-channel" class="form-input" style="width:auto;">
                    ${Object.entries(CHANNELS).map(([k, v]) => `<option value="${k}" ${k === channel ? 'selected' : ''}>${v.label}</option>`).join('')}
                </select>
                <button id="mp-pp-close" style="background:transparent; border:0; color:var(--text-muted); cursor:pointer;" title="Fermer"><span class="material-icons">close</span></button>
            </div>
            <div id="mp-pp-body" style="overflow-y:auto; padding:16px 18px;"></div>
        </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#mp-pp-close').addEventListener('click', close);
    document.addEventListener('keydown', function onEsc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); } });

    const LAYER_STYLE = {
        rules: { title: '1 · Règles de la plateforme (communes, prioritaires)', color: '#dfa53a' },
        agent: { title: '2 · Instructions de l\'agent', color: '#3ecf8e' },
        tools: { title: '3 · Outils (généré automatiquement)', color: '#60a5fa' },
        channel: { title: '4 · Canal et date (généré à chaque message)', color: '#c084fc' }
    };
    const load = async (ch) => {
        const body = overlay.querySelector('#mp-pp-body');
        body.innerHTML = '<div style="color:var(--text-muted);">Chargement…</div>';
        try {
            const token = await getToken();
            const res = await fetch(`${apiBase}/api/mp/projects/${projectId}/agents/${agentId}/prompt-preview?channel=${ch}`, { headers: { Authorization: `Bearer ${token}` } });
            const d = await res.json();
            if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
            overlay.querySelector('#mp-pp-meta').textContent = `Modèle ${d.model} · ${d.mode === 'full' ? 'agent complet (outils + mémoires du projet)' : 'prompt seulement (projet sans clé Firebase : aucun outil)'}`;
            body.innerHTML = Object.entries(LAYER_STYLE).map(([k, s]) => `
                <div style="margin-bottom:14px; border-left:3px solid ${s.color}; padding-left:12px;">
                    <div style="font-size:.75rem; font-weight:700; color:${s.color}; margin-bottom:4px;">${s.title}</div>
                    <pre style="white-space:pre-wrap; word-break:break-word; margin:0; font-size:.8rem; line-height:1.45; color:var(--text-main, #fff); font-family:inherit;">${esc(d.layers[k])}</pre>
                </div>`).join('') +
                `<div style="font-size:.75rem; color:var(--text-muted);">Un rappel final anti-invention est ajouté à la fin du prompt.</div>`;
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
                    <button data-close style="background:transparent; border:0; color:var(--text-muted); cursor:pointer;" title="Fermer"><span class="material-icons">close</span></button>
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
        const usable = state.channels.filter(c => ['whatsapp', 'sms', 'email'].includes(c.type) && c.active);
        if (!usable.length) { toast('Aucun canal WhatsApp, SMS ou courriel actif dans ce projet.', 'error'); return; }
        const m = openModal('Nouveau message', 'edit_square', `
            ${field('Canal', `<select class="form-input" data-f="channel">${usable.map(c => `<option value="${esc(c.id)}">${CHANNELS[c.type].label} · ${esc(c.label || c.externalId)}</option>`).join('')}</select>`)}
            ${field('Destinataire', `<input class="form-input" data-f="to" placeholder="+1 506 555-1234">`, '', )}
            <div data-wa style="display:none; margin-bottom:12px;">
                <div style="display:flex; gap:16px; font-size:.82rem;">
                    <label style="display:flex; gap:6px; align-items:center; cursor:pointer;"><input type="radio" name="mp-mode" value="template" checked> Modèle approuvé</label>
                    <label style="display:flex; gap:6px; align-items:center; cursor:pointer;"><input type="radio" name="mp-mode" value="text"> Texte libre</label>
                </div>
                <small style="color:var(--text-muted); font-size:.72rem;">WhatsApp exige un modèle approuvé pour écrire en premier ou après 24 h sans message du client.</small>
            </div>
            <div data-tpl style="display:none;">
                ${field('Modèle', `<select class="form-input" data-f="template"><option value="">Chargement…</option></select>`)}
                <div data-params></div>
                <div data-preview style="display:none; margin-bottom:12px; padding:10px 12px; border-radius:10px; background:rgba(37,211,102,.08); border:1px solid rgba(37,211,102,.3); white-space:pre-wrap; font-size:.85rem;"></div>
            </div>
            <div data-text>${field('Message', `<textarea class="form-input" data-f="text" rows="4" style="resize:vertical;"></textarea>`)}</div>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button class="btn" data-close-btn>Annuler</button>
                <button class="btn btn-primary" data-send><span class="material-icons" style="font-size:1.1rem; vertical-align:text-bottom;">send</span> Envoyer</button>
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
            q('[data-wa]').style.display = isWa ? '' : 'none';
            q('[data-f=to]').placeholder = ch.type === 'email' ? 'client@exemple.com' : '+1 506 555-1234';
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
                        : '<option value="">Aucun modèle approuvé</option>';
                } catch (e) {
                    q('[data-f=template]').innerHTML = `<option value="">${esc(e.message)}</option>`;
                    templates = [];
                }
                renderParams();
            }
        };
        q('[data-f=channel]').addEventListener('change', sync);
        m.body.querySelectorAll('input[name=mp-mode]').forEach(r => r.addEventListener('change', sync));
        q('[data-f=template]').addEventListener('change', renderParams);
        sync();

        q('[data-send]').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const ch = current();
            const to = q('[data-f=to]').value.trim();
            if (!to) { toast('Indiquez le destinataire.', 'error'); return; }
            const payload = { channelId: ch.id, to };
            if (mode() === 'template') {
                const [name, language] = (q('[data-f=template]').value || '').split('|');
                if (!name) { toast('Choisissez un modèle approuvé.', 'error'); return; }
                const params = [...m.body.querySelectorAll('[data-param]')].map(i => i.value.trim());
                if (params.some(p => !p)) { toast('Remplissez toutes les variables du modèle.', 'error'); return; }
                const t = templates.find(x => x.name === name && x.language === language);
                payload.template = { name, language, params, preview: fillVars(tplBody(t), params) };
            } else {
                payload.text = q('[data-f=text]').value.trim();
                if (!payload.text) { toast('Le message est vide.', 'error'); return; }
            }
            btn.disabled = true;
            try {
                const r = await api('/messages', { method: 'POST', body: payload });
                m.close();
                toast('Message envoyé.', 'success');
                state.activeConvId = r.convId;
                await loadConversations(true);
                openConversation(r.convId);
            } catch (err) { toast(`Envoi impossible : ${err.message}`, 'error'); btn.disabled = false; }
        });
    }

    // ---------- WhatsApp templates ----------
    async function openTemplates(c) {
        const m = openModal(`Modèles WhatsApp · ${esc(c.label || c.externalId)}`, 'description', '<div class="mp-muted">Chargement…</div>', 860);
        const STATUS = { APPROVED: ['ok', 'Approuvé'], PENDING: ['warn', 'En examen'], REJECTED: ['warn', 'Refusé'], PAUSED: ['off', 'En pause'], DISABLED: ['off', 'Désactivé'] };
        const render = async () => {
            let list = [];
            let err = '';
            try { list = (await api(`/channels/${encodeURIComponent(c.id)}/templates`)).templates; } catch (e) { err = e.message; }
            m.body.innerHTML = `
                <div style="display:grid; grid-template-columns:minmax(0, 1.2fr) minmax(0, 1fr); gap:18px;">
                    <div>
                        <div style="font-weight:700; margin-bottom:8px;">Modèles du compte</div>
                        ${err ? `<div style="color:#f5a524; font-size:.85rem;">${esc(err)}</div>` : ''}
                        ${!err && !list.length ? '<div class="mp-muted" style="font-size:.85rem;">Aucun modèle.</div>' : ''}
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
                                ${t.rejected_reason && t.rejected_reason !== 'NONE' ? `<div style="font-size:.72rem; color:#f5a524; margin-top:4px;">Motif : ${esc(t.rejected_reason)}</div>` : ''}
                            </div>`;
                        }).join('')}
                    </div>
                    <form data-create>
                        <div style="font-weight:700; margin-bottom:8px;">Créer un modèle</div>
                        ${field('Nom', `<input class="form-input" name="name" placeholder="confirmation_rendez_vous" required>`, 'Lettres minuscules, chiffres et _ uniquement.')}
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                            ${field('Catégorie', `<select class="form-input" name="category"><option value="UTILITY">Utilitaire</option><option value="MARKETING">Marketing</option></select>`)}
                            ${field('Langue', `<select class="form-input" name="language"><option value="fr">Français</option><option value="fr_CA">Français (Canada)</option><option value="en_US">Anglais (É.-U.)</option><option value="en">Anglais</option></select>`)}
                        </div>
                        ${field('Texte', `<textarea class="form-input" name="body" rows="4" style="resize:vertical;" placeholder="Bonjour {{1}}, votre rendez-vous est confirmé le {{2}}." required></textarea>`, 'Variables : {{1}}, {{2}}… Meta examine chaque modèle (quelques minutes à 24 h).')}
                        <div data-examples></div>
                        <button class="btn btn-primary" type="submit" style="width:100%;">Créer le modèle</button>
                    </form>
                </div>`;
            const form = m.body.querySelector('[data-create]');
            const bodyEl = form.querySelector('[name=body]');
            const renderExamples = () => {
                const n = varCount(bodyEl.value);
                const prev = [...form.querySelectorAll('[data-ex]')].map(i => i.value);
                form.querySelector('[data-examples]').innerHTML = Array.from({ length: n }, (_, i) =>
                    field(`Exemple pour {{${i + 1}}}`, `<input class="form-input" data-ex value="${esc(prev[i] || '')}" required>`)).join('');
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
                    toast(`Modèle envoyé à Meta pour examen (statut : ${r.template?.status || 'PENDING'}).`, 'success');
                    render();
                } catch (err) { toast(`Création impossible : ${err.message}`, 'error'); btn.disabled = false; }
            });
        };
        render();
    }

    const copyText = async (text) => {
        try { await navigator.clipboard.writeText(text); toast('Copié dans le presse-papiers.', 'success'); }
        catch (_) { toast('Copie impossible : sélectionnez le texte manuellement.', 'error'); }
    };

    container.innerHTML = `
        <style>${STYLES}</style>
        <div id="mp-root">
            <div class="mp-topbar">
                <div class="mp-seg">
                    <button data-tab="inbox"><span class="material-icons">inbox</span> Boîte de réception <span class="mp-badge-count" id="mp-unread" style="display:none;"></span></button>
                    ${state.isStaff ? `<button data-tab="channels"><span class="material-icons">hub</span> Canaux <span class="mp-badge-count" id="mp-ch-count" style="display:none;"></span></button>` : ''}
                    ${state.isStaff ? `<button data-tab="rules" title="Règles communes à tous les agents clients"><span class="material-icons">gavel</span> Règles IA</button>` : ''}
                </div>
                ${state.isStaff ? `<span class="mp-muted" style="margin-left:auto; font-size:.75rem;">Messagerie clients · séparée de la boîte Quasar</span>` : ''}
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
        body.innerHTML = '<div class="mp-muted">Chargement des règles…</div>';
        let d;
        try { d = await platformApi(); }
        catch (e) { body.innerHTML = `<div class="text-danger">${esc(e.message)}</div>`; return; }

        const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' }) : '';
        body.innerHTML = `
            <div style="display:grid; grid-template-columns:minmax(0, 1fr) 300px; gap:16px; height:100%; min-height:0;">
                <div class="mp-panel" style="display:flex; flex-direction:column; min-height:0;">
                    <div style="display:flex; align-items:flex-start; gap:10px; margin-bottom:10px;">
                        <div style="flex:1;">
                            <div style="font-size:1.05rem; font-weight:700;">Règles IA de la plateforme</div>
                            <div class="mp-muted" style="font-size:.8rem;">Communes à <strong>tous les agents clients</strong> et prioritaires sur leurs instructions. Ne s'appliquent pas à la boîte Quasar.</div>
                        </div>
                        <span class="mp-chip ${d.isDefault ? 'off' : 'ok'}">${d.isDefault ? 'Règles par défaut' : `Version ${d.version}`}</span>
                    </div>
                    <textarea id="mp-rules" class="form-input" style="flex:1; min-height:340px; resize:vertical; font-size:.85rem; line-height:1.5;">${esc(d.rules)}</textarea>
                    <div style="display:flex; gap:10px; align-items:center; margin-top:12px;">
                        <button class="btn btn-primary" id="mp-rules-save">Enregistrer pour tous les agents</button>
                        <button class="btn" id="mp-rules-reset" ${d.isDefault ? 'disabled' : ''}>Restaurer les règles par défaut</button>
                        <span class="mp-muted" style="font-size:.75rem; margin-left:auto;">${d.updatedAt ? `Modifié le ${fmtDate(d.updatedAt)}${d.updatedBy ? ` par ${esc(d.updatedBy)}` : ''}` : ''}</span>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:12px; min-height:0; overflow-y:auto;">
                    <div class="mp-help">
                        <div style="font-weight:700; margin-bottom:6px;">Comment le prompt est assemblé</div>
                        <ol>
                            <li><strong>Ces règles</strong> (communes, prioritaires)</li>
                            <li>Les <strong>instructions de l'agent</strong></li>
                            <li>Les <strong>outils</strong> disponibles (automatique)</li>
                            <li>Le <strong>canal et la date</strong> (automatique)</li>
                        </ol>
                        <div class="mp-muted" style="margin-top:6px;">Un rappel anti-invention est ajouté à la fin. Le bouton 👁 d'un canal montre le prompt final complet.</div>
                    </div>
                    <div class="mp-panel" style="padding:14px;">
                        <div style="font-weight:700; margin-bottom:8px;">Historique</div>
                        ${d.history.length ? d.history.map((h, i) => `
                            <div style="display:flex; align-items:center; gap:8px; padding:6px 0; border-top:${i ? '1px solid var(--border)' : '0'};">
                                <div style="flex:1; font-size:.75rem;">
                                    <div>Version ${h.version}</div>
                                    <div class="mp-muted">${fmtDate(h.updatedAt)}${h.updatedBy ? ` · ${esc(h.updatedBy)}` : ''}</div>
                                </div>
                                <button class="mp-iconbtn mp-rules-load" data-i="${i}" title="Charger cette version dans l'éditeur"><span class="material-icons">history</span></button>
                            </div>`).join('') : '<div class="mp-muted" style="font-size:.8rem;">Aucune version précédente.</div>'}
                    </div>
                </div>
            </div>`;

        const ta = body.querySelector('#mp-rules');
        body.querySelector('#mp-rules-save').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            try {
                await platformApi('PUT', { rules: ta.value });
                toast('Règles enregistrées : elles s\'appliquent à tous les agents clients dès le prochain message.', 'success');
                renderRules();
            } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
        });
        body.querySelector('#mp-rules-reset').addEventListener('click', () => {
            if (window.showConfirmModal) {
                window.showConfirmModal({
                    title: 'Restaurer les règles par défaut',
                    message: 'Les règles actuelles seront remplacées par les règles par défaut pour tous les agents clients. La version actuelle reste dans l\'historique.',
                    confirmText: 'Restaurer',
                    onConfirm: async () => {
                        try { await platformApi('PUT', { reset: true }); toast('Règles par défaut restaurées.', 'success'); renderRules(); }
                        catch (err) { toast(err.message, 'error'); }
                    }
                });
            }
        });
        body.querySelectorAll('.mp-rules-load').forEach(b => b.addEventListener('click', () => {
            ta.value = d.history[Number(b.dataset.i)].rules;
            ta.focus();
            toast('Version chargée dans l\'éditeur : cliquez sur « Enregistrer » pour l\'appliquer.');
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
                        <input id="mp-search" class="form-input" placeholder="Rechercher un contact ou un message…" style="flex:1; min-width:0;">
                        ${state.isStaff ? `<button class="mp-iconbtn" id="mp-new-msg" title="Nouveau message" style="width:40px; height:40px; color:var(--gold); border-color:var(--gold);"><span class="material-icons">edit_square</span></button>` : ''}
                    </div>
                    <div class="mp-filters" id="mp-filters"></div>
                    <div id="mp-conv-list" style="flex:1; overflow-y:auto;"><div class="mp-muted" style="padding:1rem; font-size:.85rem;">Chargement…</div></div>
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
                <div style="margin-top:6px;">Sélectionnez une conversation</div>
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
            `<button data-f="all" class="${state.filter === 'all' ? 'on' : ''}">Tous · ${state.conversations.length}</button>`,
            ...types.map(t => `<button data-f="${t}" class="${state.filter === t ? 'on' : ''}">${CHANNELS[t].label} · ${counts[t]}</button>`),
            `<button data-f="unread" class="${state.filter === 'unread' ? 'on' : ''}">Non lus</button>`
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
                ? `<div class="mp-muted" style="padding:1.2rem; font-size:.85rem;">Aucun résultat.</div>`
                : `<div style="padding:2rem 1.2rem; text-align:center;">
                        <span class="material-icons mp-muted" style="font-size:2.4rem; opacity:.5;">mark_chat_unread</span>
                        <div style="margin:8px 0 4px; font-weight:600;">Aucune conversation</div>
                        <div class="mp-muted" style="font-size:.8rem;">Les messages reçus sur les canaux du projet apparaîtront ici.</div>
                        ${state.isStaff ? `<button class="btn btn-primary" id="mp-go-channels" style="margin-top:12px;">Connecter un canal</button>` : ''}
                   </div>`;
            list.querySelector('#mp-go-channels')?.addEventListener('click', () => { state.tab = 'channels'; render(); });
            return;
        }
        list.innerHTML = items.map(c => {
            const ch = CHANNELS[c.channel] || CHANNELS.sms;
            const name = c.contactName || c.contactId;
            return `
                <div class="mp-conv ${c.id === state.activeConvId ? 'active' : ''}" data-id="${esc(c.id)}">
                    <div class="mp-avatar">${esc(initials(name))}<span class="mp-dot" style="background:${ch.color};"><span class="material-icons">${ch.icon}</span></span></div>
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; justify-content:space-between; gap:6px; align-items:baseline;">
                            <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; ${c.unread ? '' : 'font-weight:500;'}">${esc(name)}</strong>
                            <span class="mp-muted" style="font-size:.7rem; flex-shrink:0;">${fmtTime(c.lastMessageAt)}</span>
                        </div>
                        <div style="display:flex; gap:6px; align-items:center; margin-top:2px;">
                            <div class="mp-muted" style="flex:1; font-size:.8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; ${c.unread ? 'color:var(--text-main,#fff);' : ''}">${c.lastAuthor === 'ai' ? '🤖 ' : (c.lastAuthor === 'human' ? 'Vous : ' : '')}${esc(c.lastMessage || '')}</div>
                            ${c.aiEnabled === false ? '<span class="mp-chip off" title="Réponse IA désactivée">IA off</span>' : ''}
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

        // Keep a draft being typed (and scroll position) across refreshes
        const draft = thread.querySelector('#mp-reply')?.value || '';
        const prevBox = thread.querySelector('#mp-msgs');
        const wasAtBottom = !prevBox || prevBox.scrollHeight - prevBox.scrollTop - prevBox.clientHeight < 40;
        const ch = CHANNELS[conv.channel] || CHANNELS.sms;
        const name = conv.contactName || conv.contactId;

        const msgs = (conv.messages || []).map(m => {
            if (m.role === 'system') return `<div style="text-align:center; margin:10px 0;"><span class="mp-chip warn">${esc(m.content)}</span></div>`;
            const mine = m.role === 'assistant';
            const who = m.author === 'ai' ? `🤖 IA${m.dryRun ? ' · simulation, non envoyé' : ''}` : (m.author === 'human' ? (m.senderName || 'Vous') : name);
            return `
                <div style="display:flex; justify-content:${mine ? 'flex-end' : 'flex-start'}; margin:8px 0;">
                    <div style="max-width:72%;">
                        <div class="mp-muted" style="font-size:.7rem; margin:0 4px 3px; text-align:${mine ? 'right' : 'left'};">${esc(who)} · ${fmtTime(m.timestamp)}</div>
                        <div style="padding:9px 13px; border-radius:${mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px'}; background:${mine ? (m.author === 'ai' ? 'rgba(223,165,58,.16)' : 'rgba(62,207,142,.12)') : 'var(--bg-card)'}; border:1px solid ${mine ? (m.author === 'ai' ? 'rgba(223,165,58,.35)' : 'rgba(62,207,142,.3)') : 'var(--border)'}; white-space:pre-wrap; word-break:break-word; ${m.dryRun ? 'border-style:dashed;' : ''}">${esc(m.content)}</div>
                    </div>
                </div>`;
        }).join('');

        thread.innerHTML = `
            <div style="padding:12px 16px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:12px;">
                <button class="mp-iconbtn mp-back" id="mp-back" title="Retour aux conversations"><span class="material-icons">arrow_back</span></button>
                <div class="mp-avatar">${esc(initials(name))}<span class="mp-dot" style="background:${ch.color};"><span class="material-icons">${ch.icon}</span></span></div>
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:700;">${esc(name)}</div>
                    <div class="mp-muted" style="font-size:.75rem;">${ch.label} · ${esc(conv.contactId)}</div>
                </div>
                ${conv.optedOut ? '<span class="mp-chip warn"><span class="material-icons">block</span>Désabonné (STOP)</span>' : ''}
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:.8rem;" title="L'IA répond automatiquement aux nouveaux messages de ce contact">
                    <span class="mp-muted">Réponse IA</span>
                    <span class="mp-switch"><input type="checkbox" id="mp-ai-toggle" ${conv.aiEnabled !== false ? 'checked' : ''} ${conv.optedOut ? 'disabled' : ''}><span></span></span>
                </label>
            </div>
            <div id="mp-msgs" style="flex:1; overflow-y:auto; padding:14px 18px;">${msgs || '<div class="mp-muted" style="font-size:.85rem;">Aucun message.</div>'}</div>
            <div style="padding:10px 12px; border-top:1px solid var(--border); display:flex; gap:8px; align-items:flex-end;">
                <textarea id="mp-reply" class="form-input" rows="2" style="flex:1; resize:none;" placeholder="${conv.optedOut ? 'Ce contact s\'est désabonné' : `Répondre via ${ch.label}…`}" ${conv.optedOut ? 'disabled' : ''}></textarea>
                <button id="mp-send" class="btn btn-primary" style="height:44px;" ${conv.optedOut ? 'disabled' : ''} title="Envoyer"><span class="material-icons" style="vertical-align:middle;">send</span></button>
            </div>`;

        container.querySelector('.mp-inbox')?.classList.add('has-thread');
        thread.querySelector('#mp-back').addEventListener('click', () => {
            state.activeConvId = null;
            container.querySelector('.mp-inbox')?.classList.remove('has-thread');
            thread.innerHTML = emptyThread();
            renderConvList();
        });

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
                toast(e.target.checked ? 'Réponse IA activée pour ce contact.' : 'Réponse IA désactivée : vous répondez manuellement.', 'success');
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
        body.innerHTML = `<div class="mp-muted">Chargement des canaux…</div>`;
        try { await loadChannels(); }
        catch (e) { body.innerHTML = `<div class="text-danger">${esc(e.message)}</div>`; return; }

        if (!state.channels.length) {
            body.innerHTML = `
                <div style="max-width:820px; margin:0 auto; padding-top:1rem; overflow-y:auto; height:100%;">
                    <div style="text-align:center; margin-bottom:1.5rem;">
                        <div style="font-size:1.2rem; font-weight:700;">Connectez le premier canal de ce client</div>
                        <div class="mp-muted" style="font-size:.85rem; margin-top:4px;">Chaque message reçu arrive dans la boîte de réception et l'agent IA peut y répondre.</div>
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
            const credLabel = c.type === 'sms' ? (c.hasTwilioCredentials ? 'Twilio du client' : 'Twilio Quasar')
                : c.type === 'email' ? (!c.hasToken ? 'À reconnecter' : (c.lastError ? 'Erreur de synchro' : 'Gmail connecté'))
                : (c.hasToken ? 'Jeton enregistré' : 'Jeton manquant');
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
                        <div class="mp-col-opt"><span class="mp-chip ${agent ? 'ok' : 'warn'}"><span class="material-icons">smart_toy</span>${agent ? esc(agent) : 'Aucun agent'}</span></div>
                        <div class="mp-col-opt"><span class="mp-chip ${credOk ? 'ok' : 'warn'}"><span class="material-icons">${credOk ? 'key' : 'key_off'}</span>${credLabel}</span></div>
                        <div class="mp-col-opt"><span class="mp-chip ${c.active ? 'ok' : 'off'}">${c.active ? 'Actif' : 'En pause'}</span></div>
                        <label class="mp-col-opt" style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:.8rem;" title="L'agent répond automatiquement aux messages de ce canal">
                            <span class="mp-switch"><input type="checkbox" class="mp-quick-ai" ${c.aiEnabled ? 'checked' : ''} ${agent ? '' : 'disabled'}><span></span></span>
                            <span class="mp-muted">${c.aiEnabled ? 'Activée' : 'Désactivée'}</span>
                        </label>
                        <div class="mp-actions">
                            ${smsUrl ? `<button class="mp-iconbtn mp-copy-btn" data-copy="${esc(smsUrl)}" title="Copier le webhook Twilio (« A message comes in », HTTP POST)"><span class="material-icons">link</span></button>` : ''}
                            ${c.type === 'whatsapp' ? `<button class="mp-iconbtn mp-templates" title="Modèles WhatsApp"><span class="material-icons">description</span></button>` : ''}
                            ${agent ? `<button class="mp-iconbtn mp-prompt" title="Voir le prompt final de l'agent sur ce canal"><span class="material-icons">visibility</span></button>` : ''}
                            <button class="mp-iconbtn mp-sim" title="Simuler un message entrant"><span class="material-icons">play_arrow</span></button>
                            ${c.type === 'email' ? `<button class="mp-iconbtn mp-test" title="Synchroniser Gmail maintenant"><span class="material-icons">sync</span></button>`
                                : c.type !== 'sms' ? `<button class="mp-iconbtn mp-test" title="Vérifier le jeton"><span class="material-icons">verified</span></button>` : ''}
                            <button class="mp-iconbtn mp-edit" title="Modifier"><span class="material-icons">edit</span></button>
                            <button class="mp-iconbtn danger mp-del" title="Supprimer"><span class="material-icons">delete_outline</span></button>
                        </div>
                    </div>
                </div>`;
        }).join('');

        body.innerHTML = `
            <div style="overflow-y:auto; height:100%; padding-right:4px;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
                    <div style="flex:1;">
                        <div style="font-size:1.05rem; font-weight:700;">Canaux connectés</div>
                        <div class="mp-muted" style="font-size:.8rem;">Les messages reçus sur ces canaux arrivent dans la boîte de réception du projet.</div>
                    </div>
                    <button class="btn btn-primary" id="mp-add"><span class="material-icons" style="font-size:1.1rem; vertical-align:text-bottom;">add</span> Connecter un canal</button>
                </div>
                <div class="mp-list">
                    <div class="mp-list-head"><div>Canal</div><div>Agent</div><div>Connexion</div><div>Statut</div><div>Réponses IA</div><div style="text-align:right;">Actions</div></div>
                    ${cards}
                </div>
                <details class="mp-tech" style="margin-top:20px;">
                    <summary>Informations techniques</summary>
                    <div class="mp-panel" style="margin-top:10px; font-size:.8rem;">
                        <div style="font-weight:600; margin-bottom:6px;">Webhook de l'app Meta des clients (« Quasar Messaging Platform »)</div>
                        <div class="mp-copy"><code>${PUBLIC_BASE}/api/mp/webhook/meta</code><button class="mp-iconbtn mp-copy-btn" data-copy="${PUBLIC_BASE}/api/mp/webhook/meta" title="Copier"><span class="material-icons">content_copy</span></button></div>
                        <div class="mp-muted" style="margin-top:6px;">Jeton de vérification : variable <code>MP_META_VERIFY_TOKEN</code> du backend.</div>
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
                    if (lbl) lbl.textContent = e.target.checked ? 'Activée' : 'Désactivée';
                    toast(e.target.checked ? 'Réponses IA activées sur ce canal.' : 'Réponses IA désactivées sur ce canal.', 'success');
                } catch (err) { toast(err.message, 'error'); e.target.checked = !e.target.checked; }
            });

            card.querySelector('.mp-edit').addEventListener('click', () => {
                state.wizard = { step: 'form', type: c.type, editing: c };
                renderWizard();
            });

            card.querySelector('.mp-del').addEventListener('click', () => {
                confirmInApp(`Supprimer le canal « ${c.label || CHANNELS[c.type].label} » ? Les conversations existantes sont conservées.`, async () => {
                    try {
                        await api(`/channels/${encodeURIComponent(c.id)}`, { method: 'DELETE' });
                        toast('Canal supprimé.', 'success');
                        renderChannels();
                    } catch (err) { toast(err.message, 'error'); }
                });
            });

            card.querySelector('.mp-test')?.addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                btn.disabled = true;
                try {
                    const r = await api(`/channels/${encodeURIComponent(c.id)}/test`, { method: 'POST' });
                    toast(r.account ? `Jeton valide · ${r.account.name || ''}` : (r.info || 'OK'), 'success');
                    if (c.type === 'email') renderChannels();
                } catch (err) {
                    toast(c.type === 'email' ? `Synchronisation impossible : ${err.message}` : `Jeton invalide : ${err.message}`, 'error');
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
            <div class="mp-muted" style="font-size:.72rem; margin-bottom:4px;">Message de test (la réponse IA est enregistrée, sans être envoyée)</div>
            <div style="display:flex; gap:8px;">
                <input class="form-input" style="flex:1;" value="Bonjour, quels sont vos horaires ?">
                <button class="btn btn-primary">Tester</button>
            </div>`;
        card.appendChild(row);
        const input = row.querySelector('input');
        const go = row.querySelector('button');
        input.focus(); input.select();
        const run = async () => {
            const text = input.value.trim();
            if (!text) return;
            go.disabled = true; go.textContent = 'IA…';
            try {
                const r = await api('/simulate', { method: 'POST', body: { channelId: c.id, text } });
                if (!r.replied) toast(`Message enregistré, pas de réponse IA (${r.reason || r.error || 'IA désactivée ou aucun agent'}).`);
                else toast('Réponse IA générée (simulation, non envoyée).', 'success');
                state.activeConvId = `${c.type}_simulation`;
                state.tab = 'inbox';
                render();
            } catch (err) {
                toast(err.message, 'error');
                go.disabled = false; go.textContent = 'Tester';
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
                <button class="mp-iconbtn" id="mp-wz-back" title="Retour"><span class="material-icons">arrow_back</span></button>
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
                ${wizardHeader('Connecter un canal', 'Étape 1 sur 2 · choisissez le type de canal')}
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
                    <div style="font-size:1.1rem; font-weight:700;">${ch.label} ${ed ? 'mis à jour' : 'connecté'}</div>
                    <div class="mp-muted" style="font-size:.85rem; margin-top:4px;">${esc(c.label || c.externalId)}</div>
                </div>
                ${url ? `
                <div class="mp-panel" style="margin-top:14px;">
                    <div style="font-weight:700; margin-bottom:4px;">Dernière étape : brancher le numéro dans Twilio</div>
                    <div class="mp-muted" style="font-size:.8rem; margin-bottom:10px;">Twilio › Phone Numbers › ${esc(c.externalId)} › Messaging › « A message comes in » › Webhook, méthode HTTP POST.</div>
                    <div class="mp-copy"><code>${esc(url)}</code><button class="mp-iconbtn mp-copy-btn" data-copy="${esc(url)}" title="Copier"><span class="material-icons">content_copy</span></button></div>
                </div>` : `
                <div class="mp-panel" style="margin-top:14px;">
                    <div style="font-weight:700; margin-bottom:4px;">À vérifier côté Meta</div>
                    <div class="mp-muted" style="font-size:.8rem;">Le compte doit être abonné au champ « messages » dans l'app « Quasar Messaging Platform » (jamais dans l'app Quasar).</div>
                </div>`}
                <div style="display:flex; gap:10px; justify-content:center; margin-top:16px;">
                    <button class="btn" id="mp-wz-sim">Tester avec un message simulé</button>
                    <button class="btn btn-primary" id="mp-wz-finish">Terminer</button>
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
            ${wizardHeader(ed ? `Modifier · ${esc(ed.label || ch.label)}` : `Connecter ${ch.label}`, ed ? '' : 'Étape 2 sur 2 · informations du compte')}
            <div style="display:grid; grid-template-columns:minmax(0, 1.4fr) minmax(0, 1fr); gap:16px; align-items:start;">
                <form id="mp-wz-form" class="mp-panel" style="--mp-accent:${ch.color};">
                    <div style="display:flex; gap:10px; align-items:center; margin-bottom:16px;">
                        <div class="mp-ico" style="background:${ch.color}1f; color:${ch.color};"><span class="material-icons">${ch.icon}</span></div>
                        <div style="font-weight:700;">${ch.label}</div>
                    </div>
                    ${ch.oauth && !ed ? `
                    <div class="mp-help" style="margin-bottom:14px;">L'adresse sera celle du compte Google choisi à l'étape suivante.</div>` : `
                    <div class="mp-field">
                        <label>${ch.idLabel}</label>
                        <input id="mp-f-id" class="form-input" placeholder="${esc(ch.idPlaceholder)}" value="${esc(ed?.externalId || '')}" ${ed ? 'disabled' : 'required'}>
                        ${ed ? '<small>L\'identifiant ne peut pas être modifié. Supprimez le canal pour en changer.</small>' : ''}
                    </div>`}
                    <div class="mp-field">
                        <label>Nom affiché <span class="mp-muted" style="font-weight:400;">(optionnel)</span></label>
                        <input id="mp-f-label" class="form-input" placeholder="ex. Page Clinique ABC" value="${esc(ed?.label || '')}">
                    </div>
                    <div class="mp-field">
                        <label>Agent qui répond</label>
                        <select id="mp-f-agent" class="form-input">
                            <option value="">Aucun : boîte de réception seulement</option>
                            ${state.agents.map(a => `<option value="${esc(a.id)}" ${(ed ? ed.agentId === a.id : state.agents.length === 1) ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
                        </select>
                        ${state.agents.length ? '' : '<small>Ce projet n\'a pas encore d\'agent : créez-en un dans l\'onglet Agents pour activer les réponses IA.</small>'}
                    </div>
                    ${ch.oauth ? (ed ? `
                    <div class="mp-field">
                        <label>Connexion Google</label>
                        <div class="mp-muted" style="font-size:.8rem;">${ed.hasToken ? `Connectée · dernière synchro : ${ed.lastSyncAt ? new Date(ed.lastSyncAt).toLocaleString('fr-CA') : 'jamais'}` : 'Non connectée'}${ed.lastError ? `<br><span style="color:#f5a524;">Erreur : ${esc(ed.lastError)}</span>` : ''}</div>
                        <button type="button" class="btn" id="mp-f-reconnect" style="margin-top:6px; align-self:flex-start;">Reconnecter Gmail</button>
                    </div>` : '') : ch.tokenLabel ? `
                    <div class="mp-field">
                        <label>${ch.tokenLabel}</label>
                        <input id="mp-f-token" class="form-input" type="password" autocomplete="off" placeholder="${ed?.hasToken ? 'Jeton enregistré · laisser vide pour le conserver' : esc(ch.tokenPlaceholder)}" ${ed?.hasToken ? '' : 'required'}>
                    </div>
                    ${wz.type === 'whatsapp' ? `
                    <div class="mp-field">
                        <label>ID du compte WhatsApp Business (WABA)</label>
                        <input id="mp-f-waba" class="form-input" placeholder="ex. 1092204263808720" value="${esc(ed?.wabaId || '')}">
                        <small>Nécessaire pour les modèles de message. Visible dans WhatsApp › Configuration de l'API (« ID du compte WhatsApp Business »).</small>
                    </div>` : ''}` : `
                    <details style="margin-bottom:14px;">
                        <summary class="mp-muted" style="cursor:pointer; font-size:.8rem;">Utiliser le compte Twilio du client (optionnel)</summary>
                        <div class="mp-field" style="margin-top:10px;">
                            <label>Account SID</label>
                            <input id="mp-f-tsid" class="form-input" placeholder="AC… (vide = compte Twilio Quasar)">
                        </div>
                        <div class="mp-field">
                            <label>Auth Token</label>
                            <input id="mp-f-ttoken" class="form-input" type="password" autocomplete="off">
                        </div>
                    </details>`}
                    <div style="display:flex; flex-direction:column; gap:10px; margin:6px 0 18px;">
                        <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:.85rem;">
                            <span class="mp-switch"><input type="checkbox" id="mp-f-ai" ${ed ? (ed.aiEnabled ? 'checked' : '') : (ch.oauth ? '' : 'checked')}><span></span></span> L'agent répond automatiquement
                        </label>
                        <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:.85rem;">
                            <span class="mp-switch"><input type="checkbox" id="mp-f-active" ${ed ? (ed.active ? 'checked' : '') : 'checked'}><span></span></span> Canal actif
                        </label>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button type="submit" class="btn btn-primary" style="flex:1;">${ed ? 'Enregistrer' : (ch.oauth ? 'Connecter Gmail' : `Connecter ${ch.label}`)}</button>
                        <button type="button" class="btn" id="mp-wz-cancel">Annuler</button>
                    </div>
                </form>
                <div class="mp-help">
                    <div style="font-weight:700; display:flex; gap:6px; align-items:center;"><span class="material-icons" style="font-size:1.1rem; color:var(--gold);">tips_and_updates</span> Où trouver ces informations ?</div>
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
}
