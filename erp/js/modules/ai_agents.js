import { db, auth } from '../firebase-config.js';
// FR/EN text for the client Messaging links (follows the ERP EN/FR toggle)
const mpL = (fr, en) => { try { return (localStorage.getItem('erp_lang') || 'en') !== 'fr' ? en : fr; } catch (_) { return fr; } };
import { collection, query, where, orderBy, limit, onSnapshot, getDocs, getDoc, addDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIG ---
const API_BASE = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : '';

async function getAuthToken() {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken();
}

// --- STATE ---
let activeProjectId = null;
let currentProject = null;
let projectVerified = null; // true when the client's own Firebase database is connected (advanced tools, memories)
let isCallActive = false; // Track call state

// --- INIT ---
export async function initAiAgents() {
    console.log('Initializing AI Agents Module...');
    const container = document.getElementById('view-ai-agents');

    container.innerHTML = `
        <style>
            /* Responsive layout driven by the space the module really gets (ERP sidebar open or not):
               side by side when wide, stacked on tablets and phones. */
            .aia-root { container-type:inline-size; container-name:aia; height:100%; }
            .aia-layout { display:flex; height:100%; gap:20px; min-width:0; }
            .aia-projects { width:300px; flex-shrink:0; display:flex; flex-direction:column; background:var(--bg-card); border:1px solid var(--border); border-radius:12px; height:calc(100vh - 140px); }
            .aia-main { flex:1; min-width:0; display:flex; flex-direction:column; background:var(--bg-card); border:1px solid var(--border); border-radius:12px; height:calc(100vh - 140px); container-type:inline-size; container-name:aiamain; }
            #ai-agent-header { padding:1.5rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
            .aia-title { min-width:0; flex:1 1 220px; }
            .aia-title .text-h { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            .aia-tabs { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
            .aia-tabs .btn { display:inline-flex; flex-direction:row; align-items:center; gap:6px; white-space:nowrap; }
            #ai-agent-content { flex:1; padding:2rem; overflow-y:auto; min-width:0; }
            .aia-intro { display:flex; align-items:flex-start; gap:10px; padding:10px 14px; margin-bottom:1rem; border:1px solid rgba(223,165,58,.25); border-radius:10px; background:rgba(223,165,58,.06); color:var(--text-muted); font-size:.85rem; line-height:1.45; }
            .aia-intro .material-icons { color:var(--gold); font-size:1.2rem; }
            .aia-card { background:var(--bg-dark); border:1px solid var(--border); border-radius:12px; padding:1.25rem; margin-bottom:1rem; }
            .aia-card-title { font-weight:700; font-size:1rem; margin-bottom:4px; }
            .aia-help { color:var(--text-muted); font-size:.8rem; line-height:1.45; margin-bottom:.9rem; }
            .aia-chip { display:inline-flex; align-items:center; gap:4px; font-size:.72rem; font-weight:700; padding:2px 8px; border-radius:20px; border:1px solid var(--border); color:var(--text-muted); white-space:nowrap; }
            .aia-settings-body { display:flex; flex-direction:column; }
            .aia-settings-body #set-portal-title, .aia-settings-body #set-portal-title ~ div { order:1; }
            .aia-settings-body #resend-settings-form + hr { order:4; }
            .aia-settings-body #set-email-title, .aia-settings-body #resend-settings-form { order:5; }
            .aia-settings-body #settings-form + hr { order:9; }
            .aia-settings-body #settings-form { order:10; }
            @container aia (max-width: 1150px) {
                .aia-projects { width:230px; }
                .aia-layout { gap:14px; }
            }
            @container aia (max-width: 900px) {
                .aia-layout { flex-direction:column; height:auto; }
                .aia-projects { width:auto; height:auto; max-height:230px; }
                .aia-projects > div:first-child { padding:.9rem 1rem !important; }
                .aia-main { height:auto; min-height:calc(100vh - 140px); }
            }
            /* Narrow main panel: one row of tabs that scrolls sideways instead of wrapping into a stack */
            @container aiamain (max-width: 900px) {
                #ai-agent-header { padding:1rem; }
                .aia-tabs { width:100%; flex-wrap:nowrap; overflow-x:auto; padding-bottom:4px; -webkit-overflow-scrolling:touch; scrollbar-width:thin; scrollbar-color:var(--border) transparent; }
                .aia-tabs .btn, .aia-tabs .icon-btn { flex-shrink:0; }
                #ai-agent-content { padding:1rem; }
            }
            @container aiamain (max-width: 520px) {
                #ai-agent-content { padding:.75rem; }
                .aia-tabs .btn { padding:8px 12px; font-size:.78rem; }
            }
        </style>
        <div class="aia-root">
        <div class="aia-layout">
            <!-- Left Panel: Projects -->
            <div class="aia-projects">
                <div style="padding: 1.5rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                    <span class="text-h" style="font-size:1.1rem; margin:0;">${mpL('Projets clients', 'Client projects')}</span>
                    <button class="icon-btn text-gold" onclick="openProjectModal()"><span class="material-icons">add</span></button>
                </div>
                <div id="ai-project-list" style="flex:1; overflow-y:auto; padding: 10px;">
                    <div class="text-center text-muted text-sm mt-4">${mpL('Chargement…', 'Loading…')}</div>
                </div>
            </div>

            <!-- Right Panel: Agents -->
            <div class="aia-main">
                <div id="ai-agent-header">
                    <div>
                        <div class="text-h" style="margin:0;">${mpL('Choisissez un projet', 'Pick a project')}</div>
                        <div class="text-sm text-muted">${mpL('Un projet = un client : ses agents, sa messagerie, son téléphone, son forfait.', 'One project = one client: their agents, messaging, phone and plan.')}</div>
                    </div>
                </div>
                
                <div id="ai-agent-content">
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-muted);">
                        <span class="material-icons" style="font-size:4rem; margin-bottom:1rem; opacity:0.5;">smart_toy</span>
                        <div>${mpL('Choisissez ou créez un projet à gauche.', 'Pick or create a project on the left.')}</div>
                    </div>
                </div>
            </div>
        </div>

        </div>

        <!-- Modals Container -->
        <div id="ai-modal-host"></div>
    `;

    renderProjectList();

    // --- DEEP LINKING SUPPORT ---
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
    const urlProjectId = params.get('projectId');
    const urlAgentId = params.get('agentId');

    if (urlProjectId) {
        try {
            const projSnap = await getDoc(doc(db, "ai_projects", urlProjectId));
            if (projSnap.exists()) {
                const projData = { id: projSnap.id, ...projSnap.data() };
                const projJson = encodeURIComponent(JSON.stringify(projData)).replace(/'/g, "%27");

                setTimeout(async () => {
                    await window.selectProject(urlProjectId, projJson);

                    // Back from the Google sign-in of a client Gmail channel
                    const gmailResult = params.get('gmail');
                    if (gmailResult) {
                        const msg = gmailResult === 'connected'
                            ? `${mpL('Gmail connecté', 'Gmail connected')} : ${params.get('email') || ''}`
                            : `${mpL('Connexion Gmail impossible', 'Gmail connection failed')} : ${params.get('message') || mpL('erreur inconnue', 'unknown error')}`;
                        if (window.showToast) window.showToast(msg.replace(/[<>&]/g, ''), gmailResult === 'connected' ? 'success' : 'error');
                        const clean = `${window.location.pathname}${window.location.search}#ai-agents?projectId=${urlProjectId}`;
                        if (window.history.replaceState) window.history.replaceState(null, '', clean);
                        window.showProjectTab('messaging', 'channels');
                    }

                    if (urlAgentId) {
                        const agentSnap = await getDoc(doc(db, "ai_agents", urlAgentId));
                        if (agentSnap.exists()) {
                            const agentData = { id: agentSnap.id, ...agentSnap.data() };
                            const agentJson = encodeURIComponent(JSON.stringify(agentData)).replace(/'/g, "%27");
                            window.openAgentModal(agentJson);
                        }
                    }
                }, 300);
            }
        } catch (e) { console.error("[DeepLink] Error:", e); }
    }
}

// --- PROJECT LOGIC ---

async function renderProjectList() {
    const listEl = document.getElementById('ai-project-list');
    try {
        const q = query(collection(db, "ai_projects"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            listEl.innerHTML = `
                <div class="text-center text-muted text-sm" style="padding:2rem;">
                    ${mpL('Aucun projet pour l\'instant.', 'No projects yet.')}<br>
                    <a href="#" onclick="openProjectModal()" style="color:var(--gold);">${mpL('Créer un projet', 'Create one')}</a>
                </div>`;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const isActive = activeProjectId === doc.id;
            const projectJson = encodeURIComponent(JSON.stringify({ id: doc.id, ...data })).replace(/'/g, "%27");

            html += `
                <div class="nav-item ${isActive ? 'active' : ''}" 
                     style="cursor:pointer; border-radius:8px; margin-bottom:5px; padding:12px;"
                     onclick="selectProject('${doc.id}', '${projectJson}')">
                    <div style="flex:1; overflow:hidden;">
                        <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${data.name}</div>
                        <div class="text-muted text-sm" style="font-size:0.75rem;">${data.clientName || mpL('Client inconnu', 'Unknown client')}</div>
                    </div>
                    <span class="material-icons text-muted" style="font-size:1.2rem;">chevron_right</span>
                </div>
            `;
        });
        listEl.innerHTML = html;

    } catch (e) {
        console.error("Error loading projects:", e);
        listEl.innerHTML = `<div class="text-danger text-center p-3">${mpL('Impossible de charger les projets', 'Error loading projects')}</div>`;
    }
}

window.selectProject = async (id, json) => {
    activeProjectId = id;
    currentProject = JSON.parse(decodeURIComponent(json));

    // Update hash for deep linking using replaceState to avoid triggering hashchange loops
    const newUrl = `${window.location.pathname}${window.location.search}#ai-agents?projectId=${id}`;
    if (window.history.replaceState) window.history.replaceState(null, '', newUrl);

    renderProjectList();

    // Verify Backend Connection
    const token = await getAuthToken();
    let connStatus = '<span class="status-badge" style="background:#555; color:white;">Checking...</span>';

    try {
        const res = await fetch(`${API_BASE}/api/projects/${id}/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        projectVerified = !!data.verified;
        // Only matters for the advanced tools: most clients don't need their own database
        connStatus = data.verified
            ? `<span class="status-badge status-client" title="${mpL('La base de données du client est connectée : outils avancés disponibles.', 'The client\'s database is connected: advanced tools available.')}">${mpL('Base client connectée', 'Client DB connected')}</span>`
            : '';
    } catch (e) {
        projectVerified = null;
        connStatus = `<span class="status-badge status-lead">${mpL('Serveur injoignable', 'Server offline')}</span>`;
    }

    const header = document.getElementById('ai-agent-header');
    header.innerHTML = `
        <div class="aia-title">
            <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                <div class="text-h" style="margin:0;">${currentProject.name}</div>
                <span style="flex-shrink:0;">${connStatus}</span>
            </div>
            <div class="text-sm text-muted">${mpL('Client', 'Client')} : ${currentProject.clientName}</div>
        </div>
        <div class="aia-tabs">
            ${Object.entries(PROJECT_TABS()).map(([k, t]) => `
            <button class="btn" id="ai-tab-${k}" onclick="showProjectTab('${k}')" title="${t.intro.replace(/"/g, '&quot;')}">
                <span class="material-icons" style="font-size:1.1rem;">${t.icon}</span> ${t.label}
            </button>`).join('')}
        </div>
    `;
    window.showProjectTab('agents');
};

// Final prompt of an agent on the client Messaging Platform (platform rules + agent + tools + channel)
window.agent_showPromptPreview = async (agentId) => {
    if (!activeProjectId || !agentId) return;
    const { showPromptPreview } = await import('./mp_inbox.js?v=20261111');
    showPromptPreview({ apiBase: API_BASE, getToken: getAuthToken, projectId: activeProjectId, agentId, channel: 'sms' });
};

// AI questionnaire that writes the agent's instructions (layer 2) into the form
window.agent_openPromptGenerator = async (agentId) => {
    if (!activeProjectId) return;
    let initialBrief = {};
    if (agentId) {
        try {
            const snap = await getDoc(doc(db, "ai_agents", agentId));
            initialBrief = snap.exists() ? (snap.data().promptBrief || {}) : {};
        } catch (e) { console.warn('[PromptGenerator] Could not load brief:', e.message); }
    }
    if (!initialBrief.businessName && currentProject?.clientName) initialBrief.businessName = currentProject.name || '';
    if (!initialBrief.agentName) initialBrief.agentName = document.getElementById('ag-name')?.value || '';
    const { openPromptGenerator } = await import('./mp_inbox.js?v=20261111');
    openPromptGenerator({
        apiBase: API_BASE, getToken: getAuthToken, projectId: activeProjectId, agentId, initialBrief,
        onUse: (text) => {
            const ta = document.getElementById('ag-personality');
            if (ta) { ta.value = text; ta.dispatchEvent(new Event('input', { bubbles: true })); }
        }
    });
};

// Project tabs, in the order a client is set up. Each tab opens with a one-line explanation.
const PROJECT_TABS = () => ({
    agents: { icon: 'smart_toy', label: mpL('Agents', 'Agents'), intro: mpL('Les assistants IA de ce client : ce qu\'ils savent, comment ils se comportent et où ils répondent.', 'This client\'s AI assistants: what they know, how they behave and where they answer.') },
    messaging: { icon: 'forum', label: mpL('Messagerie', 'Messaging'), intro: mpL('La boîte de réception du client, ses canaux connectés (Messenger, Instagram, WhatsApp, courriel, SMS) et l\'intégration dans d\'autres apps.', 'The client\'s inbox, connected channels (Messenger, Instagram, WhatsApp, email, SMS) and embedding in other apps.') },
    voice: { icon: 'support_agent', label: mpL('Téléphone', 'Phone'), intro: mpL('L\'agent vocal : numéro de téléphone, où vont les alertes, heures de rendez-vous et appels reçus.', 'The voice agent: phone number, where alerts go, booking hours and received calls.') },
    billing: { icon: 'workspace_premium', label: mpL('Forfait', 'Plan'), intro: mpL('L\'offre de ce client, son abonnement, sa consommation et ses factures. C\'est le seul endroit où se règlent les prix.', 'This client\'s offer, subscription, usage and invoices. This is the only place where prices are set.') },
    settings: { icon: 'settings', label: mpL('Réglages', 'Settings'), intro: mpL('Accès du client à son portail, adresse d\'envoi des courriels et, en option, connexion à la base de données du client.', 'Client portal access, sending email address and, optionally, the connection to the client\'s own database.') }
});
const tabIntro = (tab) => { const t = PROJECT_TABS()[tab]; return t ? `<div class="aia-intro"><span class="material-icons">${t.icon}</span><span>${t.intro}</span></div>` : ''; };

let currentProjectTab = 'agents';
window.showProjectTab = async (tab, subTab = null) => {
    if (!activeProjectId) return;
    if (!PROJECT_TABS()[tab]) tab = 'agents';
    currentProjectTab = tab;
    Object.keys(PROJECT_TABS()).forEach(t => {
        const b = document.getElementById(`ai-tab-${t}`);
        if (b) {
            b.style.background = t === tab ? 'rgba(223, 165, 58, 0.15)' : 'transparent';
            b.style.border = `1px solid ${t === tab ? 'var(--gold)' : 'var(--border)'}`;
        }
    });
    const contentEl = document.getElementById('ai-agent-content');
    if (tab === 'agents') return renderAgentList(activeProjectId);
    if (tab === 'settings') {
        contentEl.innerHTML = tabIntro('settings') + '<div id="aia-settings"></div>';
        return renderSettingsTab(contentEl.querySelector('#aia-settings'));
    }
    if (tab === 'voice') {
        contentEl.innerHTML = tabIntro('voice') + '<div id="vc-project"></div>';
        try {
            const { renderVoice } = await import('./voice_ui.js?v=20261111');
            renderVoice(contentEl.querySelector('#vc-project'), { projectId: activeProjectId, apiBase: API_BASE, getToken: getAuthToken, isStaff: true });
        } catch (e) {
            contentEl.innerHTML = `<div class="text-danger">${e.message}</div>`;
        }
        return;
    }
    if (tab === 'billing') {
        contentEl.innerHTML = tabIntro('billing') + '<div id="bl-project"></div><div style="height:28px;"></div><div id="bl-catalog"></div>';
        try {
            const { renderProjectBilling, renderCatalogEditor } = await import('./billing_ui.js?v=20261111');
            renderProjectBilling(contentEl.querySelector('#bl-project'), { projectId: activeProjectId, apiBase: API_BASE, getToken: getAuthToken, isStaff: true });
            renderCatalogEditor(contentEl.querySelector('#bl-catalog'), { apiBase: API_BASE, getToken: getAuthToken });
        } catch (e) {
            contentEl.innerHTML = `<div class="text-danger">${e.message}</div>`;
        }
        return;
    }

    // Messaging: the inbox fills the remaining height under the explanation
    contentEl.innerHTML = `<div class="text-center text-muted">${mpL('Chargement de la messagerie…', 'Loading messaging…')}</div>`;
    try {
        const projectId = activeProjectId;
        const snap = await getDocs(query(collection(db, "ai_agents"), where("projectId", "==", projectId)));
        if (projectId !== activeProjectId || currentProjectTab !== 'messaging') return; // changed while loading
        const agents = snap.docs.map(d => ({ id: d.id, name: d.data().name || d.id }));
        contentEl.innerHTML = tabIntro('messaging') + '<div id="aia-mp" style="height:calc(100% - 60px); min-height:520px;"></div>';
        const { renderProjectMessaging } = await import('./mp_inbox.js?v=20261111');
        renderProjectMessaging(contentEl.querySelector('#aia-mp'), { projectId, apiBase: API_BASE, getToken: getAuthToken, agents, isStaff: true, initialTab: subTab || 'inbox' });
    } catch (e) {
        console.error('[Messaging] Load error:', e);
        contentEl.innerHTML = `<div class="text-danger">${mpL('Impossible de charger la messagerie', 'Could not load messaging')} : ${e.message}</div>`;
    }
};

// Guided agent creation and the per-project setup checklist (agent_wizard.js)
window.agent_openWizard = async () => {
    if (!activeProjectId) return;
    const { openAgentWizard } = await import('./agent_wizard.js?v=20261112');
    openAgentWizard({ projectId: activeProjectId, project: currentProject, apiBase: API_BASE, getToken: getAuthToken, onDone: () => renderAgentList(activeProjectId) });
};
window.agent_renderSetup = async () => {
    const el = document.getElementById('aia-setup');
    if (!el || !activeProjectId) return;
    const { renderSetupChecklist } = await import('./agent_wizard.js?v=20261112');
    renderSetupChecklist(el, {
        projectId: activeProjectId, apiBase: API_BASE, getToken: getAuthToken,
        onAction: async (action) => {
            if (action === 'wizard') return window.agent_openWizard();
            if (['messaging', 'voice', 'billing', 'settings'].includes(action)) return window.showProjectTab(action, action === 'messaging' ? 'channels' : null);
            const [kind, id] = action.split(':');
            const snap = await getDoc(doc(db, "ai_agents", id));
            if (!snap.exists()) return;
            window.openAgentModal(encodeURIComponent(JSON.stringify({ id, ...snap.data() })).replace(/'/g, "%27"));
            const tab = { 'agent-test': 'test', 'agent-knowledge': 'knowledge', 'agent-channels': 'channels' }[kind];
            if (tab) setTimeout(() => window.agent_switchTab(tab), 150);
        }
    });
};

// Messaging channels of the project, used to show where each agent answers (staff route)
async function loadProjectChannels(projectId) {
    try {
        const token = await getAuthToken();
        const res = await fetch(`${API_BASE}/api/mp/projects/${projectId}/channels`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        return data.success ? (data.channels || []) : [];
    } catch (_) { return []; }
}
const CHANNEL_META = { facebook: ['Messenger', '#0084ff', 'chat'], instagram: ['Instagram', '#e1306c', 'photo_camera'], whatsapp: ['WhatsApp', '#25d366', 'chat_bubble'], sms: ['SMS', '#f5a524', 'sms'], email: [mpL('Courriel', 'Email'), '#ea4335', 'mail'] };
const channelChip = (c) => { const [label, color, icon] = CHANNEL_META[c.type] || [c.type, '#888', 'forum']; return `<span class="aia-chip" style="color:${color}; border-color:${color}55; background:${color}14;"><span class="material-icons" style="font-size:.85rem;">${icon}</span>${label}</span>`; };
// --- AGENT LOGIC ---

async function renderAgentList(projectId) {
    const contentEl = document.getElementById('ai-agent-content');
    contentEl.innerHTML = `<div class="text-center text-muted">${mpL('Chargement des agents…', 'Loading agents…')}</div>`;

    try {
        const [snapshot, channels] = await Promise.all([
            getDocs(query(collection(db, "ai_agents"), where("projectId", "==", projectId))),
            loadProjectChannels(projectId)
        ]);
        // The user switched to another tab while agents were loading
        if (currentProjectTab !== 'agents' || projectId !== activeProjectId) return;

        const toolbar = `
            ${tabIntro('agents')}
            <div id="aia-setup"></div>
            <div style="display:flex; justify-content:flex-end; align-items:center; gap:12px; margin-bottom:1rem; flex-wrap:wrap;">
                <a href="#" class="text-xs text-muted" style="text-decoration:underline;" onclick="event.preventDefault(); openAgentModal();">${mpL('Créer sans le guide', 'Create without the guide')}</a>
                <button class="btn btn-primary" onclick="window.agent_openWizard()"><span class="material-icons" style="font-size:1.1rem; vertical-align:text-bottom;">auto_fix_high</span> ${mpL('Nouvel agent (guidé)', 'New agent (guided)')}</button>
            </div>`;
        // Setup checklist above the agents (loaded in the background)
        setTimeout(() => window.agent_renderSetup?.(), 0);

        if (snapshot.empty) {
            contentEl.innerHTML = toolbar + `
                <div style="text-align:center; padding-top:3rem;">
                    <div style="background:var(--bg-dark); width:80px; height:80px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem auto;">
                        <span class="material-icons text-muted" style="font-size:3rem;">smart_toy</span>
                    </div>
                    <div class="text-h mb-2">${mpL('Aucun agent pour ce client', 'No agent for this client yet')}</div>
                    <p class="text-muted text-sm mb-4">${mpL('Le parcours guidé vous pose les bonnes questions, écran par écran, puis crée et teste l\'agent avec vous.', 'The guide asks you the right questions, screen by screen, then creates and tests the agent with you.')}</p>
                    <button class="btn btn-primary" onclick="window.agent_openWizard()">${mpL('Créer un agent avec le guide', 'Create an agent with the guide')}</button>
                </div>`;
            return;
        }

        let html = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:20px;">';
        snapshot.forEach(doc => {
            const agent = doc.data();
            const agentJson = encodeURIComponent(JSON.stringify({ id: doc.id, ...agent })).replace(/'/g, "%27");
            const used = channels.filter(c => c.agentId === doc.id);
            const where = [
                ...used.map(channelChip),
                ...(agent.vapiAssistantId ? [`<span class="aia-chip" style="color:#a855f7; border-color:#a855f755; background:#a855f714;"><span class="material-icons" style="font-size:.85rem;">call</span>${mpL('Téléphone', 'Phone')}</span>`] : [])
            ];
            html += `
                <div class="card" style="margin:0; transition:transform 0.2s; cursor:pointer;" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='translateY(0)'" onclick="openAgentModal('${agentJson}')">
                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:1rem;">
                        <div style="background:rgba(223, 165, 58, 0.1); width:50px; height:50px; border-radius:12px; display:flex; align-items:center; justify-content:center; color:var(--gold);">
                            <span class="material-icons">smart_toy</span>
                        </div>
                        <div class="status-badge ${agent.active ? 'status-client' : 'status-lead'}">${agent.active ? mpL('Actif', 'Live') : mpL('Brouillon', 'Draft')}</div>
                    </div>
                    <div class="text-h" style="font-size:1.1rem;">${agent.name}</div>
                    <div class="text-xs text-muted" style="margin:6px 0 4px;">${mpL('Répond sur', 'Answers on')}</div>
                    <div style="display:flex; gap:6px; flex-wrap:wrap; min-height:24px;">${where.length ? where.join('') : `<span class="text-xs text-muted">${mpL('Aucun canal pour l\'instant', 'No channel yet')}</span>`}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; padding-top:10px; margin-top:12px; border-top:1px solid var(--border);">
                        <span class="text-xs text-muted">${mpL('Modifié le', 'Updated')} ${new Date(agent.updatedAt || Date.now()).toLocaleDateString()}</span>
                        <span class="material-icons text-muted" style="font-size:1.2rem;">arrow_forward</span>
                    </div>
                </div>`;
        });
        html += '</div>';
        contentEl.innerHTML = toolbar + html;

    } catch (e) {
        console.error("Error loading agents:", e);
        contentEl.innerHTML = `<div class="text-danger">${mpL('Impossible de charger les agents.', 'Failed to load agents.')}</div>`;
    }
}
// --- MODALS ---

window.openProjectModal = async () => {
    // Only for Creation, for settings see openProjectSettings

    let clientsHtml = `<option value="">${mpL('Choisir un client', 'Select a client')}</option>`;
    try {
        const q = query(collection(db, "clients"));
        const snap = await getDocs(q);
        snap.forEach(doc => {
            clientsHtml += `<option value="${doc.id}">${doc.data().name} (${doc.data().company})</option>`;
        });
    } catch (e) { console.error(e); }

    const host = document.getElementById('ai-modal-host');
    host.innerHTML = `
        <div class="crm-modal-overlay" onclick="document.getElementById('ai-modal-host').innerHTML=''">
            <div class="crm-modal-content" onclick="event.stopPropagation()">
                <div class="crm-modal-header">
                    <div class="text-h">${mpL('Nouveau projet client', 'New client project')}</div>
                    <button class="icon-btn" onclick="document.getElementById('ai-modal-host').innerHTML=''"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body">
                    <form id="new-project-form">
                        <div class="form-group">
                            <label class="form-label">${mpL('Nom du projet', 'Project name')}</label>
                            <input type="text" id="proj-name" class="form-input" placeholder="${mpL('ex. Garage Leblanc', 'e.g. Leblanc Garage')}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Client</label>
                            <select id="proj-client" class="form-input" required>
                                ${clientsHtml}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea id="proj-desc" class="form-input" rows="3" placeholder="${mpL('À quoi sert ce projet…', 'What this project is for…')}"></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary btn-block mt-3">${mpL('Créer le projet', 'Create project')}</button>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.getElementById('new-project-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.innerText = mpL('Création…', 'Creating…');

        try {
            const name = document.getElementById('proj-name').value;
            const clientSelect = document.getElementById('proj-client');
            const clientId = clientSelect.value;
            const clientName = clientSelect.options[clientSelect.selectedIndex].text;
            const desc = document.getElementById('proj-desc').value;

            await addDoc(collection(db, "ai_projects"), {
                name, clientId, clientName, description: desc, createdAt: new Date().toISOString()
            });

            document.getElementById('ai-modal-host').innerHTML = '';
            renderProjectList();
            window.showToast(mpL('Projet créé.', 'Project created.'), 'success');
        } catch (err) {
            console.error(err);
            window.showToast(err.message, 'error');
            btn.disabled = false;
        }
    }
};

// Settings tab (was a pop-up): client portal access, sending email, client database (advanced)
window.openProjectSettings = () => window.showProjectTab('settings');
async function renderSettingsTab(host) {
    if (!activeProjectId) return;

    host.innerHTML = `
        <div class="aia-card" style="max-width:760px;">
                <div class="aia-settings-body">
                    <form id="settings-form">
                        <div class="aia-card-title">${mpL('Base de données du client (avancé, optionnel)', 'Client database (advanced, optional)')}</div>
                        <div class="aia-help">${mpL('Seulement si le client a sa propre application Firebase et que l\'agent doit y lire ou écrire (outils automatiques, mémoires). La plupart des clients n\'en ont pas besoin.', 'Only if the client has their own Firebase app and the agent must read or write in it (automatic tools, memories). Most clients don\'t need this.')} ${projectVerified ? `<strong style="color:var(--success);">${mpL('Connectée.', 'Connected.')}</strong>` : ''}</div>
                        <div class="form-group">
                            <label class="form-label">${mpL('Clé de compte de service (JSON)', 'Service account key (JSON)')}</label>
                            <div style="border: 2px dashed var(--border); padding:2rem; text-align:center; border-radius:8px; cursor:pointer;" onclick="document.getElementById('sa-file').click()">
                                <span class="material-icons" style="font-size:2rem; color:var(--text-muted);">upload_file</span>
                                <div class="text-sm text-muted mt-2">${mpL('Cliquez pour choisir le fichier JSON', 'Click to pick the JSON file')}</div>
                                <div id="file-name" class="text-gold mt-2 font-bold"></div>
                            </div>
                            <input type="file" id="sa-file" accept=".json" style="display:none" onchange="document.getElementById('file-name').innerText = this.files[0].name">
                            <div class="text-xs text-muted mt-2">${mpL('Firebase › Paramètres du projet › Comptes de service › Générer une clé privée.', 'Firebase › Project settings › Service accounts › Generate private key.')}</div>
                        </div>

                        <button type="submit" class="btn btn-primary btn-block mt-3">${mpL('Envoyer et vérifier', 'Upload and verify')}</button>
                    </form>

                    <hr style="border:0; border-top:1px solid #333; margin:2rem 0;">

                    <div id="set-email-title"><div class="aia-card-title">${mpL('Courriel d\'envoi', 'Sending email')}</div><div class="aia-help">${mpL('L\'adresse depuis laquelle l\'agent envoie des courriels au nom du client (service Resend). Facultatif.', 'The address the agent sends emails from on the client\'s behalf (Resend service). Optional.')}</div></div>
                    <form id="resend-settings-form">
                        <div class="form-group mb-3">
                            <label class="form-label">${mpL('Clé API Resend', 'Resend API key')}</label>
                            <input type="password" id="proj-resend-key" class="form-input" value="${currentProject?.resendApiKey || ''}" placeholder="re_...">
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                            <div class="form-group">
                                <label class="form-label">${mpL('Nom de l\'expéditeur', 'Sender name')}</label>
                                <input type="text" id="proj-resend-name" class="form-input" value="${currentProject?.resendFromName || 'AI Assistant'}" placeholder="e.g. Quasar Team">
                            </div>
                            <div class="form-group">
                                <label class="form-label">${mpL('Adresse d\'envoi', 'Sender email')}</label>
                                <input type="text" id="proj-resend-email" class="form-input" value="${currentProject?.resendFromEmail || ''}" placeholder="e.g. info@client.com">
                            </div>
                        </div>
                        <div class="bg-darker p-3 rounded mt-2 text-xs text-muted" style="border:1px solid var(--border);">
                             <span class="text-gold font-bold">${mpL('Important', 'Important')} :</span> ${mpL('le domaine doit être vérifié dans Resend, sinon les courriels ne partent que vers votre propre adresse.', 'the domain must be verified in Resend, otherwise emails only go to your own address.')}
                        </div>
                        <button type="submit" class="btn btn-secondary btn-block mt-3">${mpL('Enregistrer le courriel', 'Save email settings')}</button>
                    </form>

                    <hr style="border:0; border-top:1px solid #333; margin:2rem 0;">

                    <div id="set-portal-title"><div class="aia-card-title">${mpL('Accès au portail client', 'Client portal access')}</div><div class="aia-help">${mpL('Le portail permet au client de voir ses messages, connecter ses comptes, gérer son téléphone et son abonnement. Envoyez-lui une invitation : il choisit lui-même son mot de passe.', 'The portal lets the client see their messages, connect their accounts, manage their phone line and subscription. Send an invitation: they choose their own password.')}</div></div>
                    
                    <!-- Invitation Section -->
                    <div class="form-group mb-4" style="padding: 1.5rem; background: rgba(223, 165, 58, 0.05); border-radius: 12px; border: 1px solid rgba(223, 165, 58, 0.2);">
                        <div class="text-sm font-bold mb-3 text-gold">${mpL('Invitation (recommandé)', 'Invitation (recommended)')}</div>
                        <p class="text-muted mb-3" style="font-size:.8rem; line-height:1.45;">${mpL('Le client reçoit un courriel pour choisir son mot de passe et entrer dans son portail.', 'The client gets an email to choose their password and enter their portal.')}</p>
                        
                        <div class="form-group">
                            <label class="form-label">${mpL('Courriel du client', 'Client email')}</label>
                            <input type="email" id="proj-client-email" class="form-input" value="${currentProject?.portalEmail || ''}" placeholder="client@example.com">
                        </div>
                        
                        <button id="btn-invite-client" class="btn btn-primary btn-block mt-3" style="background:var(--gold); color:#000;">
                            <span class="material-icons" style="font-size:1.1rem; vertical-align:middle; margin-right:5px;">mail</span>
                            ${mpL('Envoyer l\'invitation', 'Send the invitation')}
                        </button>
                    </div>

                    <!-- Manual Override Accordeon-style -->
                    <div style="border-top:1px solid var(--border); padding-top:1rem; margin-top:2rem;">
                         <div class="text-xs font-bold text-muted mb-3">${mpL('ACCÈS MANUEL (vous choisissez le mot de passe)', 'MANUAL ACCESS (you set the password)')}</div>
                         <div id="portal-setup-form">
                            <div class="form-group">
                                <label class="form-label">${mpL('Mot de passe', 'Password')}</label>
                                <div style="display:flex; gap:10px;">
                                    <input type="password" id="proj-client-pass" class="form-input" placeholder="••••••••">
                                    <button id="btn-save-client-user" class="btn btn-secondary" style="white-space:nowrap;">${mpL('Donner l\'accès', 'Grant access')}</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="form-group mt-3">
                        <label class="form-label">${mpL('Lien du portail', 'Portal link')}</label>
                        <div style="display:flex; gap:10px;">
                            <input type="text" id="proj-portal-url" class="form-input" readonly value="${window.location.origin}/portal.html" style="background:var(--bg-dark); color:var(--text-muted); font-size:0.8rem;">
                            <button id="btn-copy-portal" class="btn btn-sm" style="background:#333;"><span class="material-icons" style="font-size:1.2rem;">content_copy</span></button>
                        </div>
                        <div class="text-xs text-muted mt-2">${mpL('À donner au client : il s\'y connecte avec son courriel et son mot de passe.', 'Give it to the client: they sign in with their email and password.')}</div>
                    </div>
                </div>
        </div>
    `;

    document.getElementById('btn-copy-portal').onclick = () => {
        const url = document.getElementById('proj-portal-url');
        url.select();
        document.execCommand('copy');
        window.showToast(mpL('Lien copié.', 'Link copied.'), "success");
    };

    document.getElementById('btn-invite-client').onclick = async () => {
        const email = document.getElementById('proj-client-email').value;
        if (!email) return window.showToast(mpL('Le courriel du client est requis.', 'Client email is required.'), "error");

        const btn = document.getElementById('btn-invite-client');
        btn.disabled = true;
        btn.innerText = mpL('Envoi…', 'Sending…');

        try {
            const token = await getAuthToken();
            const res = await fetch(`${API_BASE}/api/projects/${activeProjectId}/invite-client`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ email })
            });

            const data = await res.json();
            if (data.success) {
                window.showToast(mpL('Invitation envoyée.', 'Invitation sent.'), "success");
            } else {
                throw new Error(data.error || "Failed to send invitation");
            }
        } catch (e) {
            console.error(e);
            window.showToast(e.message, "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<span class="material-icons" style="font-size:1.1rem; vertical-align:middle; margin-right:5px;">mail</span> ${mpL('Envoyer l\'invitation', 'Send the invitation')}`;
        }
    };

    document.getElementById('btn-save-client-user').onclick = async () => {
        const email = document.getElementById('proj-client-email').value;
        const password = document.getElementById('proj-client-pass').value;
        if (!email || !password) return window.showToast(mpL('Courriel et mot de passe requis.', 'Email and password are required.'), "error");

        const btn = document.getElementById('btn-save-client-user');
        btn.disabled = true;
        btn.innerText = mpL('Traitement…', 'Processing…');

        try {
            const token = await getAuthToken();
            const res = await fetch(`${API_BASE}/api/projects/${activeProjectId}/portal-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (data.success) {
                window.showToast(data.message, "success");
                currentProject.portalEmail = email; // Sync local state
            } else {
                throw new Error(data.error || "Failed to grant access");
            }
        } catch (e) {
            console.error(e);
            window.showToast(e.message, "error");
        } finally {
            btn.disabled = false;
            btn.innerText = mpL('Donner l\'accès', 'Grant access');
        }
    };

    document.getElementById('settings-form').onsubmit = async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('sa-file');
        if (!fileInput.files.length) return window.showToast(mpL('Choisissez un fichier.', 'Please select a file.'), "error");

        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.innerText = mpL('Envoi…', 'Uploading…');

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const jsonContent = JSON.parse(evt.target.result);
                const token = await getAuthToken();

                const res = await fetch(`${API_BASE}/api/projects/${activeProjectId}/credentials`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ key: jsonContent })
                });

                const data = await res.json();
                if (data.success && data.verified) {
                    window.showToast(mpL('Base du client connectée.', 'Client database connected.'), "success");
                    selectProject(activeProjectId, encodeURIComponent(JSON.stringify(currentProject))); // Refresh
                } else {
                    throw new Error("Verification failed. Check your JSON key.");
                }

            } catch (err) {
                console.error(err);
                window.showToast(err.message, 'error');
                btn.disabled = false;
                btn.innerText = mpL('Envoyer et vérifier', 'Upload and verify');
            }
        };
        reader.readAsText(fileInput.files[0]);
    };

    document.getElementById('resend-settings-form').onsubmit = async (e) => {
        e.preventDefault();
        const settings = {
            resendApiKey: document.getElementById('proj-resend-key').value.trim(),
            resendFromName: document.getElementById('proj-resend-name').value.trim(),
            resendFromEmail: document.getElementById('proj-resend-email').value.trim()
        };

        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.innerText = mpL('Enregistrement…', 'Saving…');

        try {
            const token = await getAuthToken();
            const res = await fetch(`${API_BASE}/api/projects/${activeProjectId}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(settings)
            });

            const data = await res.json();
            if (data.success) {
                window.showToast(mpL('Courriel enregistré.', 'Email settings saved.'), "success");
                Object.assign(currentProject, settings); // Sync local state
            } else {
                throw new Error(data.error || "Failed to save settings");
            }
        } catch (err) {
            console.error(err);
            window.showToast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerText = mpL('Enregistrer le courriel', 'Save email settings');
        }
    };
}
window.openAgentModal = (agentJson = null) => {
    const agent = agentJson ? JSON.parse(decodeURIComponent(agentJson)) : null;
    const isEdit = !!agent;
    const host = document.getElementById('ai-modal-host');

    let knowledgeBase = agent?.knowledgeBase || [];
    let tools = agent?.tools || {}; // Default tools (empty, relying on discovery)
    let activeTab = 'general';
    // Website chat widget appearance, edited in the "Where it answers" tab and saved with the agent
    const widget = { color: agent?.color || '#dfa53a', toggleIcon: agent?.toggleIcon || 'chat', welcome: agent?.welcomeMessage || mpL('Bonjour ! Comment puis-je vous aider ?', 'Hello! How can I help you today?'), avatar: agent?.avatarUrl || '' };
    const WIDGET_BASE = 'https://quasar-erp-b26d5.web.app';
    const widgetSnippet = (id) => `<!-- Quasar Chat Widget -->\n<script\n    src="${WIDGET_BASE}/chat-widget.js"\n    data-agent-id="${id}"\n    data-api-base="${WIDGET_BASE}"\n></script>`;

    // Assign global helpers
    window.agent_closeModal = () => {
        const modalHost = document.getElementById('ai-modal-host');
        if (modalHost) modalHost.innerHTML = '';
        if (activeProjectId) {
            const newUrl = `${window.location.pathname}${window.location.search}#ai-agents?projectId=${activeProjectId}`;
            if (window.history.replaceState) window.history.replaceState(null, '', newUrl);
        }
    };

    if (agent && agent.id) {
        const newUrl = `${window.location.pathname}${window.location.search}#ai-agents?projectId=${activeProjectId}&agentId=${agent.id}`;
        if (window.history.replaceState) window.history.replaceState(null, '', newUrl);
    }

    // Editor tabs: behaviour, knowledge, where it answers, test, advanced
    const EDITOR_TABS = ['general', 'knowledge', 'channels', 'test', 'advanced'];
    window.agent_switchTab = (tab) => {
        activeTab = tab;
        EDITOR_TABS.forEach(t => {
            const el = document.getElementById(`agt-${t}`);
            if (el) el.style.display = t === tab ? (t === 'test' ? 'flex' : 'block') : 'none';
        });
        document.querySelectorAll('.agt-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        if (tab === 'knowledge') window.agent_loadMemories();
        if (tab === 'channels') window.agent_loadChannels();
        if (tab === 'test' && agent) window.agent_loadChatHistory();
        if (tab === 'advanced') { loadTools(); if (agent) window.agent_loadLogs(); }
    };
    const sessionId = agent ? `erp_session_${agent.id}` : `erp_session_new_${Date.now()}`;
    let chatHistory = [];
    let historyLoaded = false;

    window.agent_loadChatHistory = async () => {
        if (historyLoaded) return;
        const container = document.getElementById('chat-messages');
        container.innerHTML = `<div class="text-center text-xs text-muted py-3">${mpL('Chargement de l\'historique…', 'Loading history…')}</div>`;

        try {
            const sessionRef = doc(db, "conversations", sessionId);
            const snap = await getDoc(sessionRef);
            if (snap.exists()) {
                const data = snap.data();
                if (data.messages) {
                    chatHistory = data.messages;
                    container.innerHTML = '';
                    chatHistory.forEach(m => {
                        const div = document.createElement('div');
                        div.className = m.role === 'user' ? 'chat-msg user' : 'chat-msg assistant';
                        div.innerText = m.content || (m.role === 'assistant' ? "[Action Performed]" : "");
                        if (div.innerText) container.appendChild(div);
                    });
                }
            } else {
                container.innerHTML = `<div class="chat-msg system">${mpL('Écrivez un message pour tester l\'agent.', 'Type a message to test the agent.')}</div>`;
            }
            historyLoaded = true;
        } catch (e) {
            console.error("History Load Error:", e);
            container.innerHTML = `<div class="text-danger text-xs text-center p-2">${mpL('Historique indisponible.', 'Failed to load history.')}</div>`;
        }
        container.scrollTop = container.scrollHeight;
    };

    window.agent_sendChatMessage = async () => {
        const input = document.getElementById('chat-input');
        const msg = input.value.trim();
        if (!msg) return;

        const container = document.getElementById('chat-messages');

        // Add User Message UI
        const userDiv = document.createElement('div');
        userDiv.className = 'chat-msg user';
        userDiv.innerText = msg;
        container.appendChild(userDiv);
        input.value = '';
        container.scrollTop = container.scrollHeight;

        // Add Loading...
        const aiDiv = document.createElement('div');
        aiDiv.className = 'chat-msg assistant';
        aiDiv.innerHTML = `<span class="material-icons rotating" style="font-size:1rem;">sync</span> ${mpL('Réflexion…', 'Thinking…')}`;
        container.appendChild(aiDiv);
        container.scrollTop = container.scrollHeight;

        try {
            const token = await getAuthToken();
            const res = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    projectId: activeProjectId,
                    agentId: agent?.id,
                    sessionId: sessionId,
                    messages: [{ role: "user", content: msg }]
                })
            });
            const json = await res.json();
            if (json.success) {
                aiDiv.innerText = json.message;
                chatHistory = json.history.filter(m => m.role !== 'system'); // Sync history
                if (agent?.id && !agent.testedAt) { agent.testedAt = new Date().toISOString(); updateDoc(doc(db, "ai_agents", agent.id), { testedAt: agent.testedAt }).catch(() => { }); } // setup checklist
            } else {
                aiDiv.innerText = mpL('Erreur : ', 'Error: ') + (json.error || mpL('pas de réponse', 'no response'));
                aiDiv.style.color = "var(--danger)";
            }
        } catch (e) {
            aiDiv.innerText = mpL('Serveur injoignable.', 'Error connecting to server.');
            aiDiv.style.color = "var(--danger)";
        }
        container.scrollTop = container.scrollHeight;
    };

    window.agent_loadMemories = async () => {
        const container = document.getElementById('memories-list');
        if (!container) return;
        // Memories live in the client's own database: nothing to show without it
        if (projectVerified === false) {
            container.innerHTML = `<div class="text-muted p-4 text-sm">${mpL('Les mémoires sont enregistrées dans la base de données du client, qui n\'est pas connectée pour ce projet (Réglages › Base de données du client). Utilisez plutôt les fiches ci-dessus.', 'Memories are stored in the client\'s own database, which is not connected for this project (Settings › Client database). Use the cards above instead.')}</div>`;
            return;
        }
        container.innerHTML = `<div class="text-sm text-muted p-4">${mpL('Chargement des mémoires…', 'Loading memories…')}</div>`;
        try {
            const token = await getAuthToken();
            const res = await fetch(`${API_BASE}/api/tools/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    toolName: 'search_memories',
                    args: { query: '' },
                    projectId: agent?.projectId || activeProjectId
                })
            });
            const json = await res.json();
            if (json.success && json.result.success) {
                const memories = json.result.memories;
                if (!memories || memories.length === 0) {
                    container.innerHTML = `<div class="text-center p-5 text-muted">${mpL('Aucune mémoire pour l\'instant. L\'agent en crée quand on lui demande de retenir quelque chose.', 'No memories yet. The agent creates some when asked to remember something.')}</div>`;
                } else {
                    container.innerHTML = memories.map(m => `
                        <div class="kb-item" style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="flex:1;">
                                <div style="font-size:0.9rem;">${m.text}</div>
                                <div style="font-size:0.7rem; color:var(--gold); margin-top:4px;">
                                    ${(m.tags || []).map(t => `#${t}`).join(' ')} 
                                    <span style="color:var(--text-muted); margin-left:10px;">• ${new Date(m.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <button type="button" class="icon-btn text-danger" onclick="window.agent_deleteMemory('${m.id}')"><span class="material-icons" style="font-size:1.1rem;">delete</span></button>
                        </div>
                    `).join('');
                }
            } else {
                container.innerHTML = `<div class="text-danger p-4">${mpL('Impossible de lire les mémoires.', 'Failed to fetch memories.')}</div>`;
            }
        } catch (e) {
            console.error(e);
            container.innerHTML = `<div class="text-danger p-4">${mpL('Erreur de chargement des mémoires.', 'Error loading memories.')}</div>`;
        }
    };

    window.agent_deleteMemory = async (memoryId) => {
        if (!await erpConfirm(mpL('Supprimer cette mémoire ? L\'agent oubliera ce fait.', 'Delete this memory? The agent will forget this fact.'))) return;
        try {
            const token = await getAuthToken();
            const res = await fetch(`${API_BASE}/api/tools/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    toolName: 'delete_memory',
                    args: { id: memoryId },
                    projectId: agent?.projectId || activeProjectId
                })
            });
            const json = await res.json();
            if (json.success && json.result.success) {
                window.showToast(mpL('Mémoire supprimée.', 'Memory removed.'), "success");
                window.agent_loadMemories();
            } else {
                throw new Error("Deletion failed");
            }
        } catch (e) {
            console.error(e);
            window.showToast(mpL('Suppression impossible.', 'Failed to delete memory.'), "error");
        }
    };

    // Per-agent pricing was removed: prices are set in the project's Plan tab (Stripe)
    window.agent_loadLogs = async () => {
        const container = document.getElementById('logs-container');
        if (!container) return;

        // Unsubscribe from previous listener to avoid stacking socket streams
        if (window.agent_logsUnsubscribe) {
            try { window.agent_logsUnsubscribe(); } catch (e) { }
            window.agent_logsUnsubscribe = null;
        }

        container.innerHTML = `<div class="text-sm text-muted p-4">${mpL('Connexion au journal…', 'Connecting to the log…')}</div>`;
        try {
            const targetProjectId = agent?.projectId || activeProjectId;

            // Modular Firestore v9+ Query Syntax
            const q = query(
                collection(db, "logs"),
                where("projectId", "==", targetProjectId),
                orderBy("timestamp", "desc"),
                limit(50)
            );

            window.agent_logsUnsubscribe = onSnapshot(q, (snapshot) => {
                if (snapshot.empty) {
                    container.innerHTML = `<div class="text-center p-5 text-muted">${mpL('Aucune entrée pour l\'instant.', 'No entries yet.')}</div>`;
                    return;
                }

                const logs = [];
                snapshot.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));

                container.innerHTML = logs.map(l => {
                    const isError = l.result === 'Error' || (l.data && (l.data.error || l.data.status === 'Error'));
                    const dataPretty = l.data ? `<pre style="margin:5px 0 0 0; font-size:0.75rem; background:#222; padding:8px; border-radius:4px; max-height:150px; overflow:auto; border:1px solid #444;">${JSON.stringify(l.data, null, 2)}</pre>` : "";
                    const resultPretty = l.message ? `<div style="color:${isError ? 'var(--danger)' : 'var(--gold)'}; font-size:0.75rem; margin-top:4px; font-style:italic;">${l.message}</div>` : "";
                    const actionName = l.action || 'Log';

                    // Handle Firestore Timestamp formatting
                    const tsRaw = l.timestamp;
                    const dateObj = tsRaw?.toDate ? tsRaw.toDate() : (tsRaw ? new Date(tsRaw) : new Date());

                    return `
                        <div style="padding:10px; border-bottom:1px solid #333; font-family:monospace;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 4px;">
                                <div>
                                    <span style="color:var(--gold); font-weight:bold;">[${actionName}]</span>
                                    <span style="color:${isError ? 'var(--danger)' : 'var(--success)'}; margin-left:8px; font-size:0.75rem; border:1px solid ${isError ? 'rgba(220,53,69,0.3)' : 'rgba(40,167,69,0.3)'}; padding:1px 4px; border-radius:3px;">${l.result || 'OK'}</span>
                                </div>
                                <span style="font-size:0.7rem; color:var(--text-muted);">${dateObj.toLocaleTimeString()}</span>
                            </div>
                            ${dataPretty}
                            ${resultPretty}
                        </div>
                    `;
                }).join('');
            }, err => {
                console.error("Logs Stream Error:", err);
                container.innerHTML = `<div class="text-danger p-4">Stream Error: ${err.message}</div>`;
            });

        } catch (e) {
            console.error("Live logs init error:", e);
            container.innerHTML = `<div class="text-danger p-4">${mpL('Journal indisponible.', 'Error loading the log.')}</div>`;
        }
    };

    // Re-rendering the modal must keep what was typed in the other tabs
    const keepTyped = () => {
        const v = (id) => document.getElementById(id)?.value;
        const c = (id) => document.getElementById(id)?.checked;
        return { name: v('ag-name'), personality: v('ag-personality'), model: v('ag-model'), active: c('ag-active'), voice: c('ag-voice-enabled'), greeting: v('ag-voice-greeting'), max: v('ag-max-messages') };
    };
    const restoreTyped = (s) => {
        const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
        const chk = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };
        set('ag-name', s.name); set('ag-personality', s.personality); set('ag-model', s.model); set('ag-voice-greeting', s.greeting); set('ag-max-messages', s.max);
        chk('ag-active', s.active); chk('ag-voice-enabled', s.voice);
    };
    window.agent_addKB = () => {
        const s = keepTyped();
        knowledgeBase.push({ topic: '', content: '' });
        renderModal();
        setTimeout(() => { restoreTyped(s); window.agent_switchTab('knowledge'); }, 50);
    };

    window.agent_removeKB = async (index) => {
        if (!await erpConfirm(mpL('Retirer cette fiche ?', 'Remove this card?'))) return;
        const s = keepTyped();
        knowledgeBase.splice(index, 1);
        renderModal();
        setTimeout(() => { restoreTyped(s); window.agent_switchTab('knowledge'); }, 50);
    };

    window.agent_updateKB = (index, field, value) => {
        if (knowledgeBase[index]) {
            knowledgeBase[index][field] = value;
        }
    };

    window.agent_toggleTool = (toolName) => {
        tools[toolName] = !tools[toolName];
    };

    window.agent_testTool = (toolName) => {
        openToolTestModal(toolName);
    };

    // "Where it answers": messaging channels that use this agent
    window.agent_loadChannels = async () => {
        const box = document.getElementById('ag-mp-channels');
        if (!box) return;
        if (!agent) { box.innerHTML = `<div class="text-sm text-muted">${mpL('Enregistrez d\'abord l\'agent, puis choisissez-le sur un canal dans Messagerie › Canaux.', 'Save the agent first, then pick it on a channel in Messaging › Channels.')}</div>`; return; }
        box.innerHTML = `<div class="text-sm text-muted">${mpL('Chargement…', 'Loading…')}</div>`;
        const channels = await loadProjectChannels(activeProjectId);
        const mine = channels.filter(c => c.agentId === agent.id);
        const others = channels.filter(c => c.agentId !== agent.id);
        box.innerHTML = `
            ${mine.length ? mine.map(c => `<div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-top:1px solid var(--border);">${channelChip(c)}<span class="text-sm" style="flex:1;">${c.label || c.externalId || ''}</span><span class="text-xs" style="color:${c.aiEnabled === false ? 'var(--danger)' : 'var(--success)'};">${c.aiEnabled === false ? mpL('IA coupée', 'AI off') : mpL('IA active', 'AI on')}</span></div>`).join('')
                : `<div class="text-sm text-muted">${mpL('Cet agent ne répond encore sur aucun canal de messagerie.', 'This agent does not answer on any messaging channel yet.')}</div>`}
            ${others.length ? `<div class="text-xs text-muted" style="margin-top:8px;">${mpL(`${others.length} autre(s) canal(aux) du projet utilisent un autre agent ou aucun.`, `${others.length} other project channel(s) use another agent or none.`)}</div>` : ''}
            <a href="#" class="text-sm" style="color:var(--gold); display:inline-block; margin-top:10px;" onclick="event.preventDefault(); window.agent_closeModal(); window.showProjectTab('messaging', 'channels');">${mpL('Gérer les canaux (Messagerie › Canaux)', 'Manage channels (Messaging › Channels)')} →</a>`;
    };

    window.agent_copyWidgetCode = () => {
        const code = document.getElementById('ag-w-code')?.value || '';
        navigator.clipboard.writeText(code).then(() => window.showToast(mpL('Code copié', 'Code copied'), 'success')).catch(() => { });
        // Ticks "Website bubble" in the setup checklist
        if (agent?.id) updateDoc(doc(db, "ai_agents", agent.id), { widgetCodeCopiedAt: new Date().toISOString() }).catch(() => { });
    };
    window.agent_previewWidget = () => {
        if (!agent) return;
        const params = new URLSearchParams({ agentId: agent.id, preview: 'true', title: document.getElementById('ag-name')?.value || agent.name, color: widget.color, welcome: widget.welcome, vapiId: agent.vapiAssistantId || '', toggleIcon: widget.toggleIcon, avatar: widget.avatar.startsWith('data:') ? '' : widget.avatar });
        window.open(`${WIDGET_BASE}/erp/test-widget.html?${params.toString()}`, '_blank');
    };
    window.agent_widgetChanged = () => {
        const color = document.getElementById('ag-w-color')?.value;
        if (color) { widget.color = color; const t = document.getElementById('ag-w-color-text'); if (t) t.value = color; }
        widget.welcome = document.getElementById('ag-w-welcome')?.value ?? widget.welcome;
        widget.toggleIcon = document.querySelector('input[name="ag-w-icon"]:checked')?.value || widget.toggleIcon;
    };
    window.agent_widgetAvatar = (input) => {
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > 300 * 1024) return window.showToast(mpL('Image trop lourde (300 Ko max).', 'Image too large (300 KB max).'), 'error');
        const reader = new FileReader();
        reader.onload = (e) => {
            widget.avatar = e.target.result;
            const p = document.getElementById('ag-w-avatar-preview');
            if (p) p.innerHTML = `<img src="${widget.avatar}" style="width:100%; height:100%; object-fit:cover;">`;
        };
        reader.readAsDataURL(file);
    };
    // --- TOOL LOADING ---
    let availableTools = [];
    const loadTools = async () => {
        const toolsContainer = document.getElementById('tools-container');
        if (!toolsContainer) {
            console.warn("[loadTools] tools-container not found yet.");
            return;
        }
        // Automatic tools read the client's own database: explain instead of failing when it isn't connected
        if (projectVerified === false) {
            toolsContainer.innerHTML = `<div class="text-sm text-muted">${mpL('Aucune base de données client connectée : pas d\'outils automatiques pour ce projet. C\'est normal pour la plupart des clients. Pour en ajouter, connectez la base dans Réglages › Base de données du client.', 'No client database connected: no automatic tools for this project. This is normal for most clients. To add some, connect the database in Settings › Client database.')}</div>`;
            return;
        }
        toolsContainer.innerHTML = `<div class="text-sm text-muted">${mpL('Analyse de la base du client…', 'Scanning the client database…')}</div>`;

        try {
            const token = await getAuthToken();
            // 1. Discover Real Tools from Backend
            const res = await fetch(`${API_BASE}/api/projects/${activeProjectId}/discover`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                method: 'POST'
            });
            const json = await res.json();

            if (json.success) {
                availableTools = json.tools;
                renderTools();
            } else {
                toolsContainer.innerHTML = `<div class="text-danger text-sm">${mpL('Impossible de lire la base du client', 'Could not read the client database')} : ${json.error || res.status}</div>`;
            }
        } catch (e) {
            console.error(e);
            toolsContainer.innerHTML = `<div class="text-danger text-sm">${mpL('Serveur injoignable.', 'Server unreachable.')}</div>`;
        }
    };
    // Expose for onclick
    window.loadTools = loadTools;

    const renderTools = () => {
        const toolsContainer = document.getElementById('tools-container');
        if (!toolsContainer) return;

        let html = '';
        availableTools.forEach(t => {
            const key = t.function.name;
            const isChecked = tools[key] !== false; // Default true if new, unless explicitly false
            // Update state object if new
            if (tools[key] === undefined) tools[key] = true;

            html += renderToolRow(key, key, t.function.description, isChecked);
        });
        toolsContainer.innerHTML = html;
    };

    // Tools are loaded when the Advanced tab is opened


    const renderModal = () => {
        const usesLegacyMeta = !!(agent?.facebookPageId || agent?.facebookAccessToken || agent?.instagramAccountId || agent?.instagramAccessToken);
        const tabBtn = (key, label, icon) => `<button type="button" class="agt-tab-btn ${activeTab === key ? 'active' : ''}" data-tab="${key}" onclick="window.agent_switchTab('${key}')"><span class="material-icons">${icon}</span>${label}</button>`;
        const section = (title, help, body) => `<div class="aia-card"><div class="aia-card-title">${title}</div>${help ? `<div class="aia-help">${help}</div>` : ''}${body}</div>`;
        const model = agent?.model || 'gpt-4o-mini';
        const icons = [['chat', mpL('Bulle', 'Bubble')], ['robot', mpL('Robot', 'Robot')], ['sparkles', mpL('Étincelles', 'Sparkles')], ['question', mpL('Question', 'Question')]];
        host.innerHTML = `
            <div class="crm-modal-overlay" onclick="window.agent_closeModal()">
                <div class="crm-modal-content agt-modal" onclick="event.stopPropagation()">

                    <div class="crm-modal-header" style="border-bottom:none; padding-bottom:0;">
                        <div class="text-h">${isEdit ? mpL('Modifier l\'agent', 'Edit agent') : mpL('Nouvel agent', 'New agent')}</div>
                        <button class="icon-btn" onclick="window.agent_closeModal()"><span class="material-icons">close</span></button>
                    </div>

                    <div class="agt-tabs">
                        ${tabBtn('general', mpL('Comportement', 'Behaviour'), 'psychology')}
                        ${tabBtn('knowledge', mpL('Connaissances', 'Knowledge'), 'menu_book')}
                        ${tabBtn('channels', mpL('Où il répond', 'Where it answers'), 'hub')}
                        ${tabBtn('test', mpL('Tester', 'Test'), 'play_circle')}
                        ${tabBtn('advanced', mpL('Avancé', 'Advanced'), 'tune')}
                    </div>

                    <div class="crm-modal-body" style="padding-top:0;">
                        <form id="agent-form">

                            <!-- BEHAVIOUR -->
                            <div id="agt-general" style="display:${activeTab === 'general' ? 'block' : 'none'};">
                                <div class="aia-help">${mpL('Qui est l\'agent et comment il parle. Ces instructions servent partout : messagerie, widget du site et téléphone.', 'Who the agent is and how it talks. These instructions are used everywhere: messaging, website widget and phone.')}</div>
                                <div class="agt-grid">
                                    <div class="form-group">
                                        <label class="form-label">${mpL('Nom de l\'agent', 'Agent name')}</label>
                                        <input type="text" id="ag-name" class="form-input" value="${agent?.name || ''}" required placeholder="${mpL('ex. Assistant du Garage Leblanc', 'e.g. Leblanc Garage assistant')}">
                                        <div class="text-xs text-muted mt-1">${mpL('Affiché aux clients dans le widget du site.', 'Shown to customers in the website widget.')}</div>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${mpL('Modèle d\'IA', 'AI model')}</label>
                                        <select id="ag-model" class="form-input">
                                            ${[['gpt-4o-mini', mpL('GPT-4o mini : rapide et économique (recommandé)', 'GPT-4o mini: fast and cheap (recommended)')], ['gpt-4.1-mini', 'GPT-4.1 mini'], ['gpt-4o', mpL('GPT-4o : plus intelligent, plus cher', 'GPT-4o: smarter, more expensive')]].concat([['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o'].includes(model) ? [] : [[model, model]]]).filter(x => x.length).map(([v, l]) => `<option value="${v}" ${v === model ? 'selected' : ''}>${l}</option>`).join('')}
                                        </select>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${mpL('Instructions', 'Instructions')}</label>
                                    <textarea id="ag-personality" class="form-input" rows="16" placeholder="${mpL('Tu es l\'assistant de…', 'You are the assistant of…')}">${agent?.personality || (mpL('Tu es l\'assistant de ', 'You are a helpful assistant for ') + (currentProject?.clientName || mpL('notre entreprise', 'our company')) + '.')}</textarea>
                                    <div class="text-xs text-muted mt-1">${mpL('Le rôle, le ton, ce qu\'il doit faire ou éviter. Les règles de sécurité et de canal sont ajoutées automatiquement.', 'Role, tone, what to do or avoid. Safety and channel rules are added automatically.')}
                                        <a href="#" style="color:var(--gold); margin-left:8px;" onclick="event.preventDefault(); window.agent_openPromptGenerator(${agent?.id ? `'${agent.id}'` : 'null'})"><span class="material-icons" style="font-size:.9rem; vertical-align:text-bottom;">auto_awesome</span> ${mpL('Générer avec l\'IA', 'Generate with AI')}</a>
                                        ${agent?.id ? `<a href="#" style="color:var(--gold); margin-left:8px;" onclick="event.preventDefault(); window.agent_showPromptPreview('${agent.id}')"><span class="material-icons" style="font-size:.9rem; vertical-align:text-bottom;">visibility</span> ${mpL('Voir le prompt final', 'View final prompt')}</a>` : ''}
                                    </div>
                                </div>
                                <label class="form-label-checkbox">
                                    <input type="checkbox" id="ag-active" class="custom-checkbox" ${agent?.active ? 'checked' : ''}>
                                    ${mpL('Agent actif (il répond pour de vrai)', 'Agent live (it really answers)')}
                                </label>
                            </div>

                            <!-- KNOWLEDGE -->
                            <div id="agt-knowledge" style="display:${activeTab === 'knowledge' ? 'block' : 'none'};">
                                ${section(mpL('Ce que vous lui apprenez', 'What you teach it'), mpL('Des fiches courtes : horaires, prix, services, politique de remboursement… L\'agent s\'en sert pour répondre juste.', 'Short cards: opening hours, prices, services, refund policy… The agent uses them to answer accurately.'), `
                                    <div style="text-align:right; margin-bottom:10px;"><button type="button" class="btn btn-sm" onclick="window.agent_addKB()"><span class="material-icons" style="font-size:1rem; vertical-align:text-bottom;">add</span> ${mpL('Ajouter une fiche', 'Add a card')}</button></div>
                                    <div id="kb-list">${knowledgeBase.length === 0 ? `<div class="text-center text-muted text-sm" style="padding:1.5rem;">${mpL('Aucune fiche pour l\'instant.', 'No cards yet.')}</div>` : ''}</div>`)}
                                ${section(mpL('Ce qu\'il a retenu', 'What it remembered'), mpL('Faits notés par l\'agent pendant les conversations. Supprimez ceux qui sont faux.', 'Facts the agent noted during conversations. Delete the wrong ones.'), `
                                    <div style="text-align:right; margin-bottom:10px;"><button type="button" class="btn btn-sm" onclick="window.agent_loadMemories()"><span class="material-icons" style="font-size:1rem; vertical-align:middle;">refresh</span></button></div>
                                    <div id="memories-list" style="max-height:340px; overflow-y:auto; border:1px solid var(--border); border-radius:8px; background:var(--bg-card);"></div>`)}
                            </div>

                            <!-- WHERE IT ANSWERS -->
                            <div id="agt-channels" style="display:${activeTab === 'channels' ? 'block' : 'none'};">
                                ${section(mpL('Messagerie', 'Messaging'), mpL('Messenger, Instagram, WhatsApp, courriel et SMS : chaque canal connecté choisit l\'agent qui y répond.', 'Messenger, Instagram, WhatsApp, email and SMS: each connected channel picks the agent that answers there.'), `<div id="ag-mp-channels"></div>`)}
                                ${section(mpL('Téléphone', 'Phone'), mpL('L\'agent répond aussi aux appels. Le numéro, les alertes et les heures se règlent dans l\'onglet Téléphone du projet.', 'The agent also answers calls. The number, alerts and hours are set in the project\'s Phone tab.'), `
                                    <label class="form-label-checkbox" style="color:var(--gold);">
                                        <input type="checkbox" id="ag-voice-enabled" class="custom-checkbox" ${agent?.vapiAssistantId ? 'checked' : ''}>
                                        ${mpL('Activer la voix pour cet agent', 'Turn voice on for this agent')}
                                    </label>
                                    <div class="form-group" style="margin-top:12px;">
                                        <label class="form-label">${mpL('Première phrase au téléphone', 'First sentence on the phone')}</label>
                                        <input type="text" id="ag-voice-greeting" class="form-input" value="${(agent?.firstMessage || 'Hello, how can I help you today?').replace(/"/g, '&quot;')}">
                                        <div class="text-xs text-muted mt-1">${mpL('En anglais par défaut, comme la voix.', 'English by default, like the voice.')}</div>
                                    </div>
                                    <a href="#" class="text-sm" style="color:var(--gold);" onclick="event.preventDefault(); window.agent_closeModal(); window.showProjectTab('voice');">${mpL('Numéro et appels (onglet Téléphone)', 'Number and calls (Phone tab)')} →</a>`)}
                                ${section(mpL('Widget sur le site web', 'Website widget'), mpL('Une bulle de discussion sur le site du client. Collez le code une fois : les changements faits ici s\'appliquent tout seuls.', 'A chat bubble on the client\'s website. Paste the code once: changes made here apply automatically.'), `
                                    <div class="agt-grid">
                                        <div class="form-group">
                                            <label class="form-label">${mpL('Couleur', 'Colour')}</label>
                                            <div style="display:flex; gap:8px;"><input type="color" id="ag-w-color" value="${widget.color}" oninput="window.agent_widgetChanged()" style="width:48px; height:42px; padding:2px; border:1px solid var(--border); border-radius:8px; background:none;"><input type="text" id="ag-w-color-text" class="form-input" value="${widget.color}" readonly style="font-family:monospace;"></div>
                                        </div>
                                        <div class="form-group">
                                            <label class="form-label">${mpL('Icône du bouton', 'Button icon')}</label>
                                            <div style="display:flex; gap:6px; flex-wrap:wrap;">${icons.map(([v, l]) => `<label class="aia-chip" style="cursor:pointer; padding:6px 10px;"><input type="radio" name="ag-w-icon" value="${v}" ${widget.toggleIcon === v ? 'checked' : ''} onchange="window.agent_widgetChanged()"> ${l}</label>`).join('')}</div>
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${mpL('Message d\'accueil de la bulle', 'Bubble welcome message')}</label>
                                        <input type="text" id="ag-w-welcome" class="form-input" value="${widget.welcome.replace(/"/g, '&quot;')}" oninput="window.agent_widgetChanged()">
                                    </div>
                                    <div class="form-group" style="display:flex; align-items:center; gap:12px;">
                                        <div id="ag-w-avatar-preview" style="width:48px; height:48px; border-radius:50%; border:2px solid var(--gold); overflow:hidden; background:#111; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${widget.avatar ? `<img src="${widget.avatar}" style="width:100%; height:100%; object-fit:cover;">` : '<span class="material-icons" style="color:#555;">person</span>'}</div>
                                        <input type="file" id="ag-w-avatar-file" accept="image/*" style="display:none;" onchange="window.agent_widgetAvatar(this)">
                                        <button type="button" class="btn btn-sm" onclick="document.getElementById('ag-w-avatar-file').click()">${mpL('Changer la photo', 'Change photo')}</button>
                                    </div>
                                    ${isEdit ? `
                                    <label class="form-label">${mpL('Code à coller sur le site (une seule fois)', 'Code to paste on the website (once)')}</label>
                                    <textarea id="ag-w-code" class="form-input" rows="6" readonly style="font-family:monospace; font-size:.8rem;">${widgetSnippet(agent.id).replace(/</g, '&lt;')}</textarea>
                                    <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
                                        <button type="button" class="btn btn-sm" onclick="window.agent_copyWidgetCode()"><span class="material-icons" style="font-size:1rem; vertical-align:text-bottom;">content_copy</span> ${mpL('Copier le code', 'Copy code')}</button>
                                        <button type="button" class="btn btn-sm" onclick="window.agent_previewWidget()"><span class="material-icons" style="font-size:1rem; vertical-align:text-bottom;">visibility</span> ${mpL('Aperçu', 'Preview')}</button>
                                    </div>` : `<div class="text-sm text-muted">${mpL('Le code apparaît ici après l\'enregistrement de l\'agent.', 'The code shows here once the agent is saved.')}</div>`}`)}
                            </div>

                            <!-- TEST -->
                            <div id="agt-test" style="display:${activeTab === 'test' ? 'flex' : 'none'}; flex-direction:column; gap:12px; min-height:420px;">
                                ${isEdit ? `
                                <div class="aia-help" style="margin:0;">${mpL('Parlez à l\'agent comme un client. Enregistrez d\'abord vos changements pour les tester.', 'Talk to the agent like a customer. Save your changes first to test them.')}</div>
                                <div id="chat-messages" style="flex:1; min-height:300px; overflow-y:auto; padding:1rem; background:var(--bg-dark); border-radius:8px; border:1px solid var(--border); display:flex; flex-direction:column; gap:10px;"></div>
                                <div style="display:flex; gap:10px;">
                                    <input type="text" id="chat-input" class="form-input" placeholder="${mpL('Écrivez un message…', 'Type a message…')}" onkeydown="if(event.key==='Enter'){ event.preventDefault(); window.agent_sendChatMessage(); }">
                                    <button type="button" class="btn btn-primary" onclick="window.agent_sendChatMessage()">${mpL('Envoyer', 'Send')}</button>
                                </div>
                                ${agent.vapiAssistantId ? `<div><button type="button" id="btn-test-live" class="btn" style="border:1px solid var(--success); color:var(--success);" onclick="testAgentLive('${agent.vapiAssistantId}')"><span class="material-icons" style="font-size:1.2rem; vertical-align:text-bottom;">mic</span> ${mpL('Tester la voix (micro)', 'Test the voice (microphone)')}</button></div>` : ''}`
                : `<div class="text-muted text-sm" style="padding:2rem; text-align:center;">${mpL('Enregistrez l\'agent pour pouvoir le tester.', 'Save the agent to test it.')}</div>`}
                            </div>

                            <!-- ADVANCED -->
                            <div id="agt-advanced" style="display:${activeTab === 'advanced' ? 'block' : 'none'};">
                                <div class="aia-help">${mpL('Réglages techniques. Vous n\'en avez généralement pas besoin.', 'Technical settings. You usually don\'t need them.')}</div>
                                ${section(mpL('Limite anti-abus', 'Abuse limit'), mpL('Nombre maximum de réponses de l\'agent par personne et par jour.', 'Maximum number of agent replies per person per day.'), `
                                    <input type="number" id="ag-max-messages" class="form-input" style="max-width:160px;" value="${agent?.maxMessagesPerDay || 50}" min="1">`)}
                                ${section(mpL('Outils automatiques', 'Automatic tools'), mpL('Actions que l\'agent peut faire dans la base de données du client (chercher, créer, modifier des fiches). Seulement si la base du client est connectée dans Réglages.', 'Actions the agent can take in the client\'s database (search, create, update records). Only when the client database is connected in Settings.'), `
                                    <div style="text-align:right; margin-bottom:8px;"><button type="button" class="btn btn-sm" onclick="loadTools()"><span class="material-icons" style="font-size:1rem; vertical-align:text-bottom;">refresh</span> ${mpL('Relire la base', 'Rescan')}</button></div>
                                    <div id="tools-container" style="background:var(--bg-card); padding:1rem; border-radius:8px; border:1px solid var(--border); min-height:60px;"></div>`)}
                                ${isEdit ? section(mpL('Journal technique', 'Technical log'), mpL('Dernières actions exécutées par le serveur pour ce projet (pour le dépannage).', 'Latest actions run by the server for this project (for troubleshooting).'), `
                                    <div style="text-align:right; margin-bottom:8px;"><button type="button" class="btn btn-sm" onclick="window.agent_loadLogs()"><span class="material-icons" style="font-size:1rem; vertical-align:middle;">refresh</span></button></div>
                                    <div id="logs-container" style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; max-height:360px; overflow-y:auto;"></div>`) : ''}
                                ${isEdit ? section(mpL('Identifiants', 'Identifiers'), '', `<div class="text-xs text-muted" style="font-family:monospace; line-height:1.8;">Agent : ${agent.id}<br>Vapi : ${agent.vapiAssistantId || '-'}</div>`) : ''}
                                <div id="ag-legacy-meta" style="display:${usesLegacyMeta ? 'block' : 'none'};">
                                    ${section(mpL('Intégration Meta de la boîte Quasar (ancienne)', 'Quasar inbox Meta integration (legacy)'), mpL('Utilisé seulement par la boîte privée de Quasar. Les clients connectent Facebook et Instagram dans Messagerie › Canaux.', 'Only used by Quasar\'s private inbox. Clients connect Facebook and Instagram in Messaging › Channels.'), `
                                    <div class="agt-grid">
                                        <div class="form-group"><label class="form-label">Facebook Page ID</label><input type="text" id="ag-fb-page-id" class="form-input" value="${agent?.facebookPageId || ''}"></div>
                                        <div class="form-group"><label class="form-label">Facebook Access Token</label><input type="password" id="ag-fb-token" class="form-input" value="${agent?.facebookAccessToken ? '••••••••••••••••' : ''}"></div>
                                        <div class="form-group"><label class="form-label">Instagram Account ID</label><input type="text" id="ag-ig-account-id" class="form-input" value="${agent?.instagramAccountId || ''}"></div>
                                        <div class="form-group"><label class="form-label">Instagram Access Token</label><input type="password" id="ag-ig-token" class="form-input" value="${agent?.instagramAccessToken ? '••••••••••••••••' : ''}"></div>
                                    </div>`)}
                                </div>
                                ${!usesLegacyMeta ? `<a href="#" class="text-xs" style="color:var(--text-muted); text-decoration:underline;" onclick="event.preventDefault(); document.getElementById('ag-legacy-meta').style.display='block'; this.remove();">${mpL('Afficher l\'intégration Meta de la boîte Quasar', 'Show the Quasar inbox Meta integration')}</a>` : ''}
                            </div>

                            <div class="agt-footer">
                                ${isEdit ? `<button type="button" class="btn text-danger" onclick="deleteAgent('${agent.id}')" style="border:none; background:none; margin-right:auto;">${mpL('Supprimer', 'Delete')}</button>` : ''}
                                <button type="button" class="btn" onclick="window.agent_closeModal()">${mpL('Annuler', 'Cancel')}</button>
                                <button type="submit" class="btn btn-primary">${isEdit ? mpL('Enregistrer', 'Save') : mpL('Créer l\'agent', 'Create agent')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            <style>
                .agt-modal { width:min(1100px, 96vw); height:94vh; max-width:none; max-height:none; display:flex; flex-direction:column; }
                .agt-tabs { display:flex; gap:4px; padding:0 1.5rem; border-bottom:1px solid var(--border); margin-bottom:1.25rem; overflow-x:auto; scrollbar-width:thin; }
                .agt-tab-btn { display:inline-flex; align-items:center; gap:6px; background:none; border:none; color:var(--text-muted); padding:12px 12px; border-bottom:2px solid transparent; cursor:pointer; font-weight:600; white-space:nowrap; flex-shrink:0; }
                .agt-tab-btn .material-icons { font-size:1.1rem; }
                .agt-tab-btn.active { color:var(--gold); border-bottom-color:var(--gold); }
                .agt-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:15px; }
                .agt-footer { display:flex; justify-content:flex-end; align-items:center; gap:10px; margin-top:1.5rem; border-top:1px solid var(--border); padding-top:1rem; position:sticky; bottom:0; background:var(--bg-card); }
                .kb-item { background:var(--bg-card); padding:10px; border-radius:8px; margin-bottom:10px; border:1px solid var(--border); }
                .chat-msg { padding: 10px 14px; border-radius: 12px; max-width: 80%; font-size: 0.9rem; line-height: 1.4; }
                .chat-msg.user { align-self: flex-end; background: var(--gold); color: black; border-bottom-right-radius: 2px; }
                .chat-msg.assistant { align-self: flex-start; background: #333; color: white; border-bottom-left-radius: 2px; }
                .chat-msg.system { align-self: center; background: none; color: var(--text-muted); font-size: 0.8rem; text-align: center; font-style: italic; }
                .rotating { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                @media (max-width: 700px) { .agt-modal { width:100vw; height:100dvh; border-radius:0; } .agt-tabs { padding:0 .75rem; } }
            </style>
        `;
        if (knowledgeBase.length > 0) {
            setTimeout(() => {
                const list = document.getElementById('kb-list');
                if (list) {
                    list.innerHTML = knowledgeBase.map((item, index) => `
                        <div class="kb-item">
                            <input type="text" class="form-input mb-2" placeholder="${mpL('Sujet (ex. Heures d\'ouverture)', 'Topic (e.g. Opening hours)')}" value="${item.topic}" onchange="window.agent_updateKB(${index}, 'topic', this.value)" style="font-weight:bold;">
                            <textarea class="form-input" rows="3" placeholder="${mpL('Contenu…', 'Content…')}" onchange="window.agent_updateKB(${index}, 'content', this.value)">${item.content}</textarea>
                            <div style="text-align:right; margin-top:5px;">
                                <button type="button" class="icon-btn text-danger" title="${mpL('Retirer la fiche', 'Remove card')}" onclick="window.agent_removeKB(${index})"><span class="material-icons">delete</span></button>
                            </div>
                        </div>
                    `).join('');
                }
            }, 0);
        }

        setTimeout(() => {
            const form = document.getElementById('agent-form');
            if (form) {
                form.onsubmit = handleAgentSubmit;
            } else {
                console.warn("[renderModal] agent-form not found for onsubmit binding.");
            }
        }, 100);
    };

    const handleAgentSubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = mpL('Enregistrement…', 'Saving…');

        try {
            const val = (id) => document.getElementById(id)?.value;
            const name = val('ag-name').trim();
            const personality = val('ag-personality');
            const model = val('ag-model') || 'gpt-4o-mini';
            const voiceEnabled = !!document.getElementById('ag-voice-enabled')?.checked;
            const type = voiceEnabled ? "Vapi Voice Agent" : "Text Chatbot";
            const active = !!document.getElementById('ag-active')?.checked;
            const maxMessagesPerDay = parseInt(val('ag-max-messages')) || 50;
            const firstMessage = (val('ag-voice-greeting') || '').trim() || 'Hello, how can I help you today?';
            window.agent_widgetChanged();

            // Legacy Meta fields (Quasar private inbox only): keep stored tokens when the field shows the mask
            const keepToken = (input, stored) => input === '••••••••••••••••' ? (stored || null) : (input || null);
            const facebookPageId = val('ag-fb-page-id')?.trim() || null;
            const facebookAccessToken = keepToken(val('ag-fb-token')?.trim(), agent?.facebookAccessToken);
            const instagramAccountId = val('ag-ig-account-id')?.trim() || null;
            const instagramAccessToken = keepToken(val('ag-ig-token')?.trim(), agent?.instagramAccessToken);

            // System prompt = instructions + knowledge cards
            let finalSystemPrompt = personality;
            if (knowledgeBase.length > 0) {
                finalSystemPrompt += "\n\n### KNOWLEDGE BASE ###\nUse the following information to answer questions accurately:\n";
                knowledgeBase.forEach(kb => {
                    if (kb.topic && kb.content) finalSystemPrompt += `\n[${kb.topic.toUpperCase()}]: ${kb.content}\n`;
                });
            }

            const token = await getAuthToken();
            const call = async (url, method, body) => {
                const res = await fetch(`${API_BASE}${url}`, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
                const json = await res.json().catch(() => ({}));
                if (!res.ok || json.success === false) throw new Error(json.error || `HTTP ${res.status}`);
                return json;
            };

            let vapiAssistantId = agent?.vapiAssistantId || null;
            if (voiceEnabled && !vapiAssistantId) {
                vapiAssistantId = (await call('/api/vapi/create-agent', 'POST', { name, type, prompt: finalSystemPrompt, model })).data.id;
            }

            const data = {
                name, type, personality, prompt: finalSystemPrompt, knowledgeBase, tools, model,
                vapiAssistantId, active, projectId: activeProjectId, updatedAt: new Date().toISOString(),
                maxMessagesPerDay,
                facebookPageId, facebookAccessToken, instagramAccountId, instagramAccessToken,
                // Website widget
                color: widget.color, toggleIcon: widget.toggleIcon, welcomeMessage: widget.welcome, avatarUrl: widget.avatar,
                // Phone
                firstMessage
            };

            let agentId = agent?.id;
            if (isEdit) {
                await updateDoc(doc(db, "ai_agents", agent.id), data);
            } else {
                data.createdAt = new Date().toISOString();
                agentId = (await addDoc(collection(db, "ai_agents"), data)).id;
            }

            // Keep the Vapi assistant in sync (prompt, tools, model, first sentence, server URL for this project)
            if (voiceEnabled && vapiAssistantId) {
                try {
                    await call(`/api/vapi/update-agent/${vapiAssistantId}`, 'PATCH', { name, type, prompt: finalSystemPrompt, tools, projectId: activeProjectId });
                    await call(`/api/vapi/update-agent-config/${vapiAssistantId}`, 'PATCH', { name, model, firstMessage, firstMessageMode: agent?.firstMessageMode || 'assistant-speaks-first' });
                } catch (vErr) {
                    window.showToast(`${mpL('Agent enregistré, mais la voix n\'a pas été mise à jour', 'Agent saved, but the voice was not updated')} : ${vErr.message}`, 'error');
                }
            }

            window.showToast(isEdit ? mpL('Agent enregistré.', 'Agent saved.') : mpL('Agent créé.', 'Agent created.'), 'success');
            window.agent_closeModal();
            renderAgentList(activeProjectId);

        } catch (err) {
            console.error(err);
            window.showToast(`${mpL('Erreur', 'Error')} : ${err.message}`, 'error');
            btn.innerText = originalText;
            btn.disabled = false;
        }
    };
    renderModal();
};

function renderToolRow(key, title, desc, checked) {
    return `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
         <label class="form-label-checkbox" style="margin-bottom:0; flex:1;">
            <input type="checkbox" class="custom-checkbox" ${checked ? 'checked' : ''} onchange="window.agent_toggleTool('${key}')"> 
            <span style="color:var(--text); font-weight:600;">${title}</span>
            <div style="margin-left:auto; font-size:0.75rem; color:var(--text-muted); padding-left:25px;">${desc}</div>
        </label>
        <button type="button" class="btn btn-sm" style="border:1px solid var(--border); margin-left:10px;" onclick="window.agent_testTool('${key}')">
            Test ⚡
        </button>
    </div >
    `;
}

window.openToolTestModal = (toolName) => {
    // Defines generic args based on tool name for easy testing
    let defaultArgs = '{}';

    const modalHtml = `
    <div class="crm-modal-overlay" id="tool-test-overlay">
        <div class="crm-modal-content" style="max-width: 500px;" onclick="event.stopPropagation()">
            <div class="crm-modal-header">
                <div class="text-h">${mpL('Tester l\'outil', 'Test tool')} : ${toolName}</div>
                <button class="icon-btn" onclick="document.getElementById('tool-test-overlay').remove()"><span class="material-icons">close</span></button>
            </div>
            <div class="crm-modal-body">
                <div class="form-group">
                    <label class="form-label">${mpL('Paramètres (JSON)', 'Arguments (JSON)')}</label>
                    <textarea id="test-args" class="form-input" rows="5" style="font-family:monospace;">${defaultArgs}</textarea>
                </div>
                <div id="test-output" style="background:#111; color:#0f0; padding:10px; border-radius:4px; font-family:monospace; font-size:0.8rem; display:none; white-space:pre-wrap;"></div>
                <button class="btn btn-primary btn-block mt-3" onclick="runToolTest('${toolName}')">${mpL('Lancer le test', 'Run test')}</button>
            </div>
        </div>
        </div >
    `;

    // Append to body/host
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHtml;
    document.body.appendChild(tempDiv.firstElementChild);
};

window.runToolTest = async (toolName) => {
    const btn = document.querySelector('#tool-test-overlay .btn-primary');
    const output = document.getElementById('test-output');
    const argsVal = document.getElementById('test-args').value;

    btn.disabled = true;
    btn.innerText = mpL('Test en cours…', 'Running…');
    output.style.display = 'block';
    output.innerText = mpL('Appel du serveur…', 'Calling the server…');

    try {
        const token = await getAuthToken();
        const res = await fetch(`${API_BASE}/api/tools/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                toolName,
                args: JSON.parse(argsVal),
                projectId: activeProjectId // ISOLATION
            })
        });
        const data = await res.json();
        output.innerText = JSON.stringify(data, null, 2);
    } catch (e) {
        output.innerText = "Error: " + e.message;
    }
    btn.disabled = false;
    btn.innerText = mpL('Lancer le test', 'Run test');
};

// ... (Existing Vapi helpers: testAgentLive, startVapiSession, deleteAgent - keep them same) 
window.testAgentLive = async (assistantId) => {
    if (!assistantId) return window.showToast(mpL('La voix n\'est pas activée pour cet agent.', 'Voice is not turned on for this agent.'), "error");
    const btn = document.getElementById('btn-test-live');

    // 1. Check if call is active 
    if (isCallActive && vapiInstance) {
        vapiInstance.stop();
        return;
    }

    // 0. Immediate UI Feedback
    if (btn) {
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = `<span class="material-icons rotating">sync</span> ${mpL('Préparation…', 'Starting…')}`;
        btn.disabled = true;
    }

    try {
        console.log("Fetching Public Key...");
        const token = await getAuthToken();
        const res = await fetch(`${API_BASE}/api/vapi/public-key`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();

        if (!json.success) throw new Error(json.error || "Failed to fetch key");

        const publicKey = json.publicKey;
        console.log("Got Key. Starting Vapi Session...");
        startVapiSession(assistantId, publicKey);

    } catch (e) {
        console.error(e);
        window.showToast(mpL('Démarrage impossible : ', 'Setup failed: ') + e.message, 'error');
        if (btn) {
            btn.innerHTML = `<span class="material-icons" style="font-size:1.2rem; vertical-align:text-bottom;">mic</span> ${mpL('Tester la voix (micro)', 'Test the voice (microphone)')}`;
            btn.disabled = false;
        }
    }
};

// --- DELETE AGENT ---
window.deleteAgent = async (id) => {
    if (!await erpConfirm(mpL('Supprimer cet agent ? Cette action est définitive.', 'Delete this agent? This cannot be undone.'))) return;
    try {
        // 1. Get Agent to find Vapi ID
        const agentRef = doc(db, "ai_agents", id);
        const agentSnap = await getDoc(agentRef);
        if (agentSnap.exists()) {
            const data = agentSnap.data();
            if (data.vapiAssistantId) {
                // 2. Delete from Vapi
                const token = await getAuthToken();
                try {
                    await fetch(`${API_BASE}/api/vapi/delete-agent/${data.vapiAssistantId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                } catch (vapiErr) {
                    console.warn("Vapi Delete Failed (might be already deleted):", vapiErr);
                }
            }
        }

        // 3. Delete from Firestore
        await deleteDoc(agentRef);
        document.getElementById('ai-modal-host').innerHTML = '';
        renderAgentList(activeProjectId);
        window.showToast(mpL('Agent supprimé.', 'Agent deleted.'), 'normal');
    } catch (e) {
        window.showToast(e.message, 'error');
    }
};

// --- EMBED CODE MODAL ---


let vapiInstance = null;

async function startVapiSession(assistantId, publicKey) {
    try {
        if (!vapiInstance) {
            console.log("Importing Vapi SDK...");
            const module = await import('https://esm.sh/@vapi-ai/web');
            const Vapi = module.default || module.Vapi;

            if (!Vapi) throw new Error("Vapi class not found in module");

            console.log("SDK Imported. Initializing...");
            vapiInstance = new Vapi(publicKey);
        }

        const btn = document.getElementById('btn-test-live');
        if (btn) {
            btn.innerHTML = `<span class="material-icons rotating">sync</span> ${mpL('Connexion…', 'Connecting…')}`;
            btn.disabled = true;
        }

        vapiInstance.start(assistantId);

        if (!vapiInstance._hasListeners) {
            vapiInstance.on('call-start', () => {
                console.log("Call Started");
                isCallActive = true;
                window.showToast(mpL('Appel de test connecté.', 'Test call connected.'), "success");
                const btn = document.getElementById('btn-test-live');
                if (btn) {
                    btn.innerHTML = `<span class="material-icons">stop</span> ${mpL('Raccrocher', 'Hang up')}`;
                    btn.style.borderColor = 'var(--danger)';
                    btn.style.color = 'var(--danger)';
                    btn.disabled = false;
                }
            });

            vapiInstance.on('call-end', () => {
                console.log("Call Ended");
                isCallActive = false;
                window.showToast(mpL('Appel terminé.', 'Call ended.'), "normal");
                resetLiveButton();
            });

            vapiInstance.on('error', (e) => {
                console.error("Vapi Error:", e);
                isCallActive = false;
                window.showToast("Vapi Error: " + (e.message || JSON.stringify(e)), "error");
                resetLiveButton();
            });
            vapiInstance._hasListeners = true;
        }

    } catch (error) {
        console.error("Vapi Session Error:", error);
        isCallActive = false;
        window.showToast(mpL('Erreur au démarrage de l\'appel : ', 'Error starting the call: ') + error.message, 'error');
        resetLiveButton();
    }
}

function resetLiveButton() {
    const btn = document.getElementById('btn-test-live');
    if (btn) {
        btn.innerHTML = `<span class="material-icons" style="font-size:1.2rem; vertical-align:text-bottom;">mic</span> ${mpL('Tester la voix (micro)', 'Test the voice (microphone)')}`;
        btn.style.borderColor = 'var(--success)';
        btn.style.color = 'var(--success)';
        btn.disabled = false;
    }
}
