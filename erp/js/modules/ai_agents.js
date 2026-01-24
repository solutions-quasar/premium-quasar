import { db } from '../firebase-config.js';
import { collection, query, where, getDocs, getDoc, addDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIG ---
const API_BASE = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : '';

// --- STATE ---
let activeProjectId = null;
let currentProject = null;
let isCallActive = false; // Track call state

// --- INIT ---
export async function initAiAgents() {
    console.log('Initializing AI Agents Module...');
    const container = document.getElementById('view-ai-agents');

    container.innerHTML = `
        <div style="display:flex; height: 100%; gap: 20px;">
            <!-- Left Panel: Projects -->
            <div style="width: 300px; display:flex; flex-direction:column; background:var(--bg-card); border:1px solid var(--border); border-radius:12px; height: calc(100vh - 140px);">
                <div style="padding: 1.5rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                    <span class="text-h" style="font-size:1.1rem; margin:0;">Projects</span>
                    <button class="icon-btn text-gold" onclick="openProjectModal()"><span class="material-icons">add</span></button>
                </div>
                <div id="ai-project-list" style="flex:1; overflow-y:auto; padding: 10px;">
                    <div class="text-center text-muted text-sm mt-4">Loading...</div>
                </div>
            </div>

            <!-- Right Panel: Agents -->
            <div style="flex:1; display:flex; flex-direction:column; background:var(--bg-card); border:1px solid var(--border); border-radius:12px; height: calc(100vh - 140px);">
                <div id="ai-agent-header" style="padding: 1.5rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div class="text-h" style="margin:0;">Select a Project</div>
                        <div class="text-sm text-muted">Manage your AI workforce</div>
                    </div>
                </div>
                
                <div id="ai-agent-content" style="flex:1; padding: 2rem; overflow-y:auto;">
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-muted);">
                        <span class="material-icons" style="font-size:4rem; margin-bottom:1rem; opacity:0.5;">smart_toy</span>
                        <div>Select or create a project to view agents</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modals Container -->
        <div id="ai-modal-host"></div>
    `;

    renderProjectList();
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
                    No projects found.<br>
                    <a href="#" onclick="openProjectModal()" style="color:var(--gold);">Create one</a>
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
                        <div class="text-muted text-sm" style="font-size:0.75rem;">${data.clientName || 'Unknown Client'}</div>
                    </div>
                    <span class="material-icons text-muted" style="font-size:1.2rem;">chevron_right</span>
                </div>
            `;
        });
        listEl.innerHTML = html;

    } catch (e) {
        console.error("Error loading projects:", e);
        listEl.innerHTML = '<div class="text-danger text-center p-3">Error loading projects</div>';
    }
}

window.selectProject = async (id, json) => {
    activeProjectId = id;
    currentProject = JSON.parse(decodeURIComponent(json));
    renderProjectList();

    // Verify Backend Connection
    const token = await getAuthToken();
    let connStatus = '<span class="status-badge" style="background:#555; color:white;">Checking...</span>';

    try {
        const res = await fetch(`${API_BASE}/api/projects/${id}/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.verified) {
            connStatus = '<span class="status-badge status-client">🟢 DB Connected</span>';
        } else {
            connStatus = '<span class="status-badge status-lead" onclick="openProjectSettings()" style="cursor:pointer;">🔴 No Auth Key</span>';
        }
    } catch (e) {
        connStatus = '<span class="status-badge status-lead">Backend Offline</span>';
    }

    const header = document.getElementById('ai-agent-header');
    header.innerHTML = `
        <div>
            <div style="display:flex; align-items:center; gap:10px;">
                <div class="text-h" style="margin:0;">${currentProject.name}</div>
                ${connStatus}
            </div>
            <div class="text-sm text-muted">Client: ${currentProject.clientName}</div>
        </div>
        <div>
             <button class="btn btn-primary" onclick="openAgentModal()">
                <span class="material-icons" style="font-size:1.2rem; vertical-align:text-bottom; margin-right:5px;">add</span>
                New Agent
            </button>
            <button class="icon-btn text-muted" title="Project Settings" onclick="openProjectSettings()"><span class="material-icons">settings</span></button>
        </div>
    `;
    renderAgentList(id);
};

// --- AGENT LOGIC ---

async function renderAgentList(projectId) {
    const contentEl = document.getElementById('ai-agent-content');
    contentEl.innerHTML = '<div class="text-center text-muted">Loading agents...</div>';

    try {
        const q = query(collection(db, "ai_agents"), where("projectId", "==", projectId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            contentEl.innerHTML = `
                <div style="text-align:center; padding-top:4rem;">
                    <div style="background:var(--bg-dark); width:80px; height:80px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem auto;">
                         <span class="material-icons text-muted" style="font-size:3rem;">record_voice_over</span>
                    </div>
                    <div class="text-h mb-2">No Agents Yet</div>
                    <p class="text-muted text-sm mb-4">Create your first AI Voice Agent for this project.</p>
                    <button class="btn btn-primary" onclick="openAgentModal()">Create Agent</button>
                </div>
            `;
            return;
        }

        let html = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:20px;">';

        snapshot.forEach(doc => {
            const agent = doc.data();
            const agentJson = encodeURIComponent(JSON.stringify({ id: doc.id, ...agent })).replace(/'/g, "%27");

            html += `
                <div class="card" style="margin:0; transition:transform 0.2s; cursor:pointer;" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'" onclick="openAgentModal('${agentJson}')">
                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:1rem;">
                        <div style="background:rgba(223, 165, 58, 0.1); width:50px; height:50px; border-radius:12px; display:flex; align-items:center; justify-content:center; color:var(--gold);">
                            <span class="material-icons">support_agent</span>
                        </div>
                        <div class="status-badge ${agent.active ? 'status-client' : 'status-lead'}">
                            ${agent.active ? 'Live' : 'Draft'}
                        </div>
                    </div>
                    <div class="text-h" style="font-size:1.1rem;">${agent.name}</div>
                    <div class="text-sm text-muted mb-3">${agent.type || 'Vapi Voice Agent'}</div>
                    
                    <div style="background:var(--bg-dark); padding:10px; border-radius:6px; font-family:monospace; font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem; overflow:hidden; text-overflow:ellipsis;">
                        ID: ${agent.vapiAssistantId || 'Not Configured'}
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; padding-top:10px; border-top:1px solid var(--border);">
                        <span class="text-xs text-muted">Updated: ${new Date(agent.updatedAt || Date.now()).toLocaleDateString()}</span>
                        <span class="material-icons text-muted" style="font-size:1.2rem;">arrow_forward</span>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        contentEl.innerHTML = html;

    } catch (e) {
        console.error("Error loading agents:", e);
        contentEl.innerHTML = '<div class="text-danger">Failed to load agents.</div>';
    }
}

// --- HELPER: Get Token ---
async function getAuthToken() {
    return localStorage.getItem('authToken');
}

// --- MODALS ---

window.openProjectModal = async () => {
    // Only for Creation, for settings see openProjectSettings

    let clientsHtml = '<option value="">Select Client</option>';
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
                    <div class="text-h">New AI Project</div>
                    <button class="icon-btn" onclick="document.getElementById('ai-modal-host').innerHTML=''"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body">
                    <form id="new-project-form">
                        <div class="form-group">
                            <label class="form-label">Project Name</label>
                            <input type="text" id="proj-name" class="form-input" placeholder="e.g. Reception Desk Alpha" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Client</label>
                            <select id="proj-client" class="form-input" required>
                                ${clientsHtml}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea id="proj-desc" class="form-input" rows="3" placeholder="Purpose of this deployment..."></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary btn-block mt-3">Create Project</button>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.getElementById('new-project-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.innerText = "Creating...";

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
            window.showToast('Project created successfully', 'success');
        } catch (err) {
            console.error(err);
            window.showToast(err.message, 'error');
            btn.disabled = false;
        }
    }
};

window.openProjectSettings = async () => {
    if (!activeProjectId) return;

    const host = document.getElementById('ai-modal-host');
    host.innerHTML = `
        <div class="crm-modal-overlay" onclick="document.getElementById('ai-modal-host').innerHTML=''">
            <div class="crm-modal-content" onclick="event.stopPropagation()">
                <div class="crm-modal-header">
                    <div class="text-h">Project Settings</div>
                    <button class="icon-btn" onclick="document.getElementById('ai-modal-host').innerHTML=''"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body">
                    <form id="settings-form">
                        <div class="form-group">
                            <label class="form-label">Firebase Credentials (Service Account)</label>
                            <div style="border: 2px dashed var(--border); padding:2rem; text-align:center; border-radius:8px; cursor:pointer;" onclick="document.getElementById('sa-file').click()">
                                <span class="material-icons" style="font-size:2rem; color:var(--text-muted);">upload_file</span>
                                <div class="text-sm text-muted mt-2">Click to upload json</div>
                                <div id="file-name" class="text-gold mt-2 font-bold"></div>
                            </div>
                            <input type="file" id="sa-file" accept=".json" style="display:none" onchange="document.getElementById('file-name').innerText = this.files[0].name">
                            <div class="text-xs text-muted mt-2">Required for Backend DB Access</div>
                        </div>

                        <button type="submit" class="btn btn-primary btn-block mt-3">Upload & Verify</button>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.getElementById('settings-form').onsubmit = async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('sa-file');
        if (!fileInput.files.length) return window.showToast("Please select a file", "error");

        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.innerText = "Uploading...";

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
                    window.showToast("Connected to Firebase successfully", "success");
                    document.getElementById('ai-modal-host').innerHTML = '';
                    selectProject(activeProjectId, encodeURIComponent(JSON.stringify(currentProject))); // Refresh
                } else {
                    throw new Error("Verification failed. Check your JSON key.");
                }

            } catch (err) {
                console.error(err);
                window.showToast(err.message, 'error');
                btn.disabled = false;
                btn.innerText = "Upload & Verify";
            }
        };
        reader.readAsText(fileInput.files[0]);
    };
};

window.openAgentModal = (agentJson = null) => {
    const agent = agentJson ? JSON.parse(decodeURIComponent(agentJson)) : null;
    const isEdit = !!agent;
    const host = document.getElementById('ai-modal-host');

    let knowledgeBase = agent?.knowledgeBase || [];
    let tools = agent?.tools || { createLead: true, checkAvailability: true, bookAppointment: true }; // Default tools
    let activeTab = 'general';

    // Assign global helpers
    window.agent_switchTab = (tab) => {
        activeTab = tab;
        document.getElementById('tab-general').style.display = tab === 'general' ? 'block' : 'none';
        document.getElementById('tab-knowledge').style.display = tab === 'knowledge' ? 'block' : 'none';
        document.getElementById('tab-tools').style.display = tab === 'tools' ? 'block' : 'none';
        const tabChat = document.getElementById('tab-chat');
        if (tabChat) tabChat.style.display = tab === 'chat' ? 'flex' : 'none';

        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        if (tab === 'general') document.querySelectorAll('.tab-btn')[0].classList.add('active');
        if (tab === 'knowledge') document.querySelectorAll('.tab-btn')[1].classList.add('active');
        if (tab === 'tools') document.querySelectorAll('.tab-btn')[2].classList.add('active');
        if (tab === 'chat') {
            const btns = document.querySelectorAll('.tab-btn');
            if (btns[3]) btns[3].classList.add('active');
        }
    };

    let chatHistory = [];
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
        aiDiv.innerHTML = '<span class="material-icons rotating" style="font-size:1rem;">sync</span> Thinking...';
        container.appendChild(aiDiv);
        container.scrollTop = container.scrollHeight;

        try {
            const token = await getAuthToken();
            const res = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    projectId: activeProjectId,
                    agentId: agent.id,
                    messages: [...chatHistory, { role: "user", content: msg }]
                })
            });
            const json = await res.json();
            if (json.success) {
                aiDiv.innerText = json.message;
                chatHistory = json.history.filter(m => m.role !== 'system'); // Sync history
            } else {
                aiDiv.innerText = "Error: " + (json.error || "Failed to get response");
                aiDiv.style.color = "var(--danger)";
            }
        } catch (e) {
            aiDiv.innerText = "Error connecting to server.";
            aiDiv.style.color = "var(--danger)";
        }
        container.scrollTop = container.scrollHeight;
    };

    window.agent_addKB = () => {
        knowledgeBase.push({ topic: '', content: '' });
        renderModal();
        setTimeout(() => window.agent_switchTab('knowledge'), 50);
    };

    window.agent_removeKB = (index) => {
        if (!confirm("Remove this document?")) return;
        knowledgeBase.splice(index, 1);
        renderModal();
        setTimeout(() => window.agent_switchTab('knowledge'), 50);
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

    window.agent_showEmbedCode = (id) => {
        const prodUrl = 'https://quasar-erp-b26d5.web.app';
        const currentApiBase = API_BASE || prodUrl;

        let cfg = {
            title: 'AI Assistant',
            color: '#dfa53a',
            welcome: 'Hello! How can I help you today?',
            vapiId: '',
            toggleIcon: 'chat',
            voiceHint: true
        };

        // Fetch config from DB
        getDoc(doc(db, "ai_agents", id)).then(snap => {
            if (snap.exists()) {
                const d = snap.data();
                if (d.name) cfg.title = d.name;
                if (d.color) cfg.color = d.color;
                if (d.welcomeMessage) cfg.welcome = d.welcomeMessage;
                if (d.vapiAssistantId) cfg.vapiId = d.vapiAssistantId;
                if (d.toggleIcon) cfg.toggleIcon = d.toggleIcon;

                // Update UI if open
                if (document.getElementById('emb-title')) {
                    document.getElementById('emb-title').value = cfg.title;
                    document.getElementById('emb-color').value = cfg.color;
                    document.getElementById('emb-color-text').value = cfg.color;
                    document.getElementById('emb-welcome').value = cfg.welcome;
                    document.getElementById('emb-vapi').value = cfg.vapiId;

                    const radio = document.querySelector(`input[name="emb-icon"][value="${cfg.toggleIcon}"]`);
                    if (radio) radio.checked = true;
                }
            }
        });

        const generateSnippet = () => {
            return `<!-- Quasar Chat Widget -->
<script 
    src="${currentApiBase}/chat-widget.js" 
    data-agent-id="${id}"
    data-api-base="${currentApiBase}"
></script>`.trim();
        };

        const host = document.getElementById('ai-modal-host');
        const overlay = document.createElement('div');
        overlay.className = 'crm-modal-overlay';
        overlay.style.zIndex = '999999';

        overlay.innerHTML = `
            <div class="crm-modal-content" style="max-width:700px;" onclick="event.stopPropagation()">
                <div class="crm-modal-header">
                    <div class="text-h">Embed & Customize Widget</div>
                    <button class="icon-btn" onclick="this.closest('.crm-modal-overlay').remove()"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body">
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                        
                        <!-- Left: Customization -->
                        <div>
                            <div class="text-sm font-bold mb-3 text-gold">Appearance</div>
                            
                            <div class="form-group">
                                <label class="form-label">Widget Title</label>
                                <input type="text" id="emb-title" class="form-input" value="${cfg.title}">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Primary Color</label>
                                <div style="display:flex; gap:10px;">
                                    <input type="color" id="emb-color" class="form-input" style="padding:2px; width:50px;" value="${cfg.color}">
                                    <input type="text" id="emb-color-text" class="form-input" value="${cfg.color}">
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Toggle Icon</label>
                                <div style="display:flex; gap:10px; margin-top:5px; flex-wrap:wrap;">
                                    <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-size:0.9rem;">
                                        <input type="radio" name="emb-icon" value="chat" checked> Chat
                                    </label>
                                    <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-size:0.9rem;">
                                        <input type="radio" name="emb-icon" value="robot"> Robot
                                    </label>
                                    <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-size:0.9rem;">
                                        <input type="radio" name="emb-icon" value="sparkles"> Sparkles
                                    </label>
                                    <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-size:0.9rem;">
                                        <input type="radio" name="emb-icon" value="question"> ?
                                    </label>
                                </div>
                            </div>
                        </div>

                        <!-- Right: Content & Voice -->
                        <div>
                            <div class="text-sm font-bold mb-3 text-gold">Content & Voice</div>

                            <div class="form-group">
                                <label class="form-label">Welcome Message</label>
                                <input type="text" id="emb-welcome" class="form-input" value="${cfg.welcome}">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Vapi Assistant ID</label>
                                <input type="text" id="emb-vapi" class="form-input" placeholder="Optional (Enable Voice)" value="${cfg.vapiId}">
                            </div>
                            
                            <!-- Save Button -->
                            <button id="btn-save-config" class="btn btn-secondary btn-sm mt-3" style="width:100%;">
                                <span class="material-icons" style="font-size:1rem;">save</span> Save Config to Cloud
                            </button>
                            <div id="save-status" class="text-xs text-center mt-2 text-muted" style="height:1.2rem;"></div>
                        </div>
                    </div>

                    <hr style="border:0; border-top:1px solid #333; margin:20px 0;">

                    <div class="form-group">
                        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:5px;">
                            <label class="form-label">Universal Embed Code</label>
                            <button id="btn-preview" class="btn btn-sm" style="background:#334; border:1px solid #556;">
                                <span class="material-icons" style="font-size:1rem; vertical-align:middle; margin-right:4px;">visibility</span> Preview
                            </button>
                        </div>
                        <p class="text-xs text-muted mb-2">
                            Paste this code <b>once</b>. Future design changes will update automatically.
                        </p>
                        <textarea id="emb-code" class="form-input" rows="5" readonly style="font-family:monospace; font-size:0.8rem; background:#111; color:#0f0;">${generateSnippet()}</textarea>
                    </div>

                    <button class="btn btn-primary btn-block mt-3" onclick="navigator.clipboard.writeText(document.getElementById('emb-code').value); this.innerText='Copied!'">
                        <span class="material-icons" style="font-size:1rem; vertical-align:text-bottom; margin-right:5px;">content_copy</span>
                        Copy to Clipboard
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // --- HANDLERS ---
        const updateState = () => {
            cfg.title = document.getElementById('emb-title').value;
            cfg.color = document.getElementById('emb-color').value;
            document.getElementById('emb-color-text').value = cfg.color;
            cfg.welcome = document.getElementById('emb-welcome').value;
            cfg.vapiId = document.getElementById('emb-vapi').value;

            const selectedIcon = document.querySelector('input[name="emb-icon"]:checked');
            if (selectedIcon) cfg.toggleIcon = selectedIcon.value;

            document.getElementById('emb-code').value = generateSnippet();
        };

        const saveToCloud = async () => {
            const btn = document.getElementById('btn-save-config');
            const status = document.getElementById('save-status');

            btn.innerHTML = 'Saving...';
            btn.disabled = true;

            try {
                // Update Firestore
                await updateDoc(doc(db, "ai_agents", id), {
                    name: cfg.title,
                    color: cfg.color,
                    welcomeMessage: cfg.welcome,
                    vapiAssistantId: cfg.vapiId,
                    toggleIcon: cfg.toggleIcon
                });

                status.innerText = "Saved! Live widget updated.";
                status.style.color = "#4caf50";
                setTimeout(() => status.innerText = "", 3000);
            } catch (e) {
                console.error(e);
                status.innerText = "Error saving config.";
                status.style.color = "#ff4444";
            } finally {
                btn.innerHTML = '<span class="material-icons" style="font-size:1rem;">save</span> Save Config to Cloud';
                btn.disabled = false;
            }
        };

        const openPreview = () => {
            const params = new URLSearchParams({
                agentId: id,
                preview: 'true',
                title: cfg.title,
                color: cfg.color,
                welcome: cfg.welcome,
                vapiId: cfg.vapiId,
                toggleIcon: cfg.toggleIcon
            });
            window.open(`${currentApiBase}/erp/test-widget.html?${params.toString()}`, '_blank');
        };

        document.getElementById('emb-title').oninput = updateState;
        document.getElementById('emb-color').oninput = updateState;
        document.getElementById('emb-color-text').oninput = () => {
            cfg.color = document.getElementById('emb-color-text').value;
            document.getElementById('emb-color').value = cfg.color;
        };
        document.getElementById('emb-welcome').oninput = updateState;
        document.getElementById('emb-vapi').oninput = updateState;
        document.querySelectorAll('input[name="emb-icon"]').forEach(r => r.onchange = updateState);

        document.getElementById('btn-save-config').onclick = saveToCloud;
        document.getElementById('btn-preview').onclick = openPreview;

        overlay.onclick = (e) => {
            if (e.target === overlay) overlay.remove();
        };
    };

    // --- TOOL LOADING ---
    let availableTools = [];
    const loadTools = async () => {
        const toolsContainer = document.getElementById('tools-container');
        toolsContainer.innerHTML = '<div class="text-sm text-muted">Scanning project schema...</div>';

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
                toolsContainer.innerHTML = '<div class="text-danger">Failed to load tools.</div>';
            }
        } catch (e) {
            console.error(e);
            toolsContainer.innerHTML = '<div class="text-danger">Failed to scan schema. Ensure backend is running.</div>';
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

    // Trigger load immediately if modal is opening
    setTimeout(loadTools, 100);


    const renderModal = () => {
        host.innerHTML = `
            <div class="crm-modal-overlay" onclick="document.getElementById('ai-modal-host').innerHTML=''">
                <div class="crm-modal-content" style="width: 95vw; height: 95vh; max-width: none; max-height: none; display: flex; flex-direction: column;" onclick="event.stopPropagation()">
                    
                    <div class="crm-modal-header" style="border-bottom:none; padding-bottom:0;">
                        <div class="text-h">${isEdit ? 'Edit Agent' : 'New Agent'}</div>
                        <button class="icon-btn" onclick="document.getElementById('ai-modal-host').innerHTML=''"><span class="material-icons">close</span></button>
                    </div>

                    <!-- Tabs -->
                    <div style="display:flex; gap:20px; padding: 0 1.5rem; border-bottom:1px solid var(--border); margin-bottom:1.5rem;">
                        <button class="tab-btn ${activeTab === 'general' ? 'active' : ''}" onclick="window.agent_switchTab('general')">General</button>
                        <button class="tab-btn ${activeTab === 'knowledge' ? 'active' : ''}" onclick="window.agent_switchTab('knowledge')">Knowledge Base</button>
                        <button class="tab-btn ${activeTab === 'tools' ? 'active' : ''}" onclick="window.agent_switchTab('tools')">Tools <span style="font-size:0.6rem; background:var(--gold); color:black; padding:1px 4px; border-radius:4px;">AUTO</span></button>
                        ${isEdit ? `<button class="tab-btn ${activeTab === 'chat' ? 'active' : ''}" onclick="window.agent_switchTab('chat')">Chat Agent ⚡</button>` : ''}
                    </div>

                    <div class="crm-modal-body" style="padding-top:0;">
                        <form id="agent-form">
                            
                            <!-- GENERAL TAB -->
                            <div id="tab-general" style="display:${activeTab === 'general' ? 'block' : 'none'};">
                                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
                                    <div class="form-group">
                                        <label class="form-label">Agent Name</label>
                                        <input type="text" id="ag-name" class="form-input" value="${agent?.name || ''}" required placeholder="Virtual Assistant">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Type</label>
                                        <select id="ag-type" class="form-input">
                                            <option value="Vapi Voice Agent" selected>Vapi Voice Agent</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">System Personality / Instructions</label>
                                    <textarea id="ag-personality" class="form-input" rows="3" placeholder="You are a helpful assistant...">${agent?.personality || 'You are a helpful assistant for ' + (currentProject?.clientName || 'our company') + '.'}</textarea>
                                    <div class="text-xs text-muted mt-1">Define the agent's core behavior and tone here.</div>
                                </div>
                                <div class="form-group">
                                     <label class="form-label-checkbox">
                                        <input type="checkbox" id="ag-active" class="custom-checkbox" ${agent?.active ? 'checked' : ''}> 
                                        Set Active (Live)
                                    </label>
                                </div>
                            </div>

                            <!-- KNOWLEDGE TAB -->
                            <div id="tab-knowledge" style="display:${activeTab === 'knowledge' ? 'block' : 'none'}; height:300px; overflow-y:auto;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                                    <div class="text-sm text-muted">Add documents to train your agent.</div>
                                    <button type="button" class="btn btn-sm" onclick="window.agent_addKB()"><span class="material-icons">add</span> Add Doc</button>
                                </div>
                                
                                <div id="kb-list">
                                    ${knowledgeBase.length === 0 ? `<div class="text-center text-muted" style="padding:2rem;">No knowledge documents yet.</div>` : ''}
                                </div>
                            </div>

                            <!-- TOOLS TAB -->
                            <div id="tab-tools" style="display:${activeTab === 'tools' ? 'block' : 'none'};">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                                     <p class="text-muted text-sm" style="margin:0;">These tools were auto-discovered from your project database.</p>
                                     <button type="button" class="btn btn-sm" style="font-size:0.7rem;" onclick="loadTools()"><span class="material-icons" style="font-size:1rem; vertical-align:text-bottom;">refresh</span> Refresh Schema</button>
                                </div>
                                
                                <div id="tools-container" style="background:var(--bg-dark); padding:1rem; border-radius:8px; border:1px solid var(--border); min-height:100px;">
                                    <!-- Dynamic Tools Rendered Here -->
                                </div>
                                
                                <div class="alert alert-info mt-3" style="font-size:0.8rem; background:rgba(49, 204, 236, 0.1); padding:10px; border-radius:6px;">
                                    <span class="material-icons" style="font-size:1rem; vertical-align:text-bottom;">info</span>
                                    Tools are generated based on your Firestore collections.
                                </div>
                            </div>

                            <!-- CHAT TAB -->
                            <div id="tab-chat" style="display:${activeTab === 'chat' ? 'flex' : 'none'}; flex-direction:column; height:450px;">
                                <div id="chat-messages" style="flex:1; overflow-y:auto; padding:1rem; background:var(--bg-dark); border-radius:8px; border:1px solid var(--border); margin-bottom:1rem; display:flex; flex-direction:column; gap:10px;">
                                    <div class="chat-msg system">
                                        Hello! I am your AI agent. How can I help you today?
                                    </div>
                                </div>
                                <div style="display:flex; gap:10px;">
                                    <input type="text" id="chat-input" class="form-input" placeholder="Type a message..." onkeydown="if(event.key==='Enter'){ event.preventDefault(); window.agent_sendChatMessage(); }">
                                    <button type="button" class="btn btn-primary" onclick="window.agent_sendChatMessage()">Send</button>
                                </div>
                            </div>

                            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:2rem; border-top:1px solid var(--border); padding-top:1rem;">
                                ${isEdit ? `<button type="button" class="btn" title="Get Embed Code" onclick="window.agent_showEmbedCode('${agent.id}')"><span class="material-icons" style="font-size:1.2rem; vertical-align:text-bottom;">code</span></button>` : ''}
                                ${isEdit ? `<button type="button" id="btn-test-live" class="btn" style="border:1px solid var(--success); color:var(--success);" onclick="testAgentLive('${agent.vapiAssistantId}')"><span class="material-icons" style="font-size:1.2rem; vertical-align:text-bottom;">mic</span> Test Live</button>` : ''}
                                ${isEdit ? `<button type="button" class="btn text-danger" onclick="deleteAgent('${agent.id}')" style="border:none; background:none;">Delete</button>` : ''}
                                <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create Agent'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            <style>
                .tab-btn { background:none; border:none; color:var(--text-muted); padding:10px 0; border-bottom:2px solid transparent; cursor:pointer; font-weight:600; }
                .tab-btn.active { color:var(--gold); border-bottom-color:var(--gold); }
                .kb-item { background:var(--bg-dark); padding:10px; border-radius:8px; margin-bottom:10px; border:1px solid var(--border); }
                
                .chat-msg { padding: 10px 14px; border-radius: 12px; max-width: 80%; font-size: 0.9rem; line-height: 1.4; }
                .chat-msg.user { align-self: flex-end; background: var(--gold); color: black; border-bottom-right-radius: 2px; }
                .chat-msg.assistant { align-self: flex-start; background: #333; color: white; border-bottom-left-radius: 2px; }
                .chat-msg.system { align-self: center; background: none; color: var(--text-muted); font-size: 0.8rem; text-align: center; font-style: italic; }
                
                .rotating { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
            </style>
        `;

        if (knowledgeBase.length > 0) {
            setTimeout(() => {
                const list = document.getElementById('kb-list');
                if (list) {
                    list.innerHTML = knowledgeBase.map((item, index) => `
                        <div class="kb-item">
                            <input type="text" class="form-input mb-2" placeholder="Topic (e.g. Refund Policy)" value="${item.topic}" onchange="window.agent_updateKB(${index}, 'topic', this.value)" style="font-weight:bold;">
                            <textarea class="form-input" rows="3" placeholder="Content..." onchange="window.agent_updateKB(${index}, 'content', this.value)">${item.content}</textarea>
                            <div style="text-align:right; margin-top:5px;">
                                <button type="button" class="icon-btn text-danger" title="Remove Document" onclick="window.agent_removeKB(${index})"><span class="material-icons">delete</span></button>
                            </div>
                        </div>
                    `).join('');
                }
            }, 0);
        }

        setTimeout(() => document.getElementById('agent-form').onsubmit = handleAgentSubmit, 0);
    };

    const handleAgentSubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "Processing...";

        try {
            const name = document.getElementById('ag-name').value;
            const personality = document.getElementById('ag-personality').value;
            const type = document.getElementById('ag-type').value;
            const active = document.getElementById('ag-active').checked;

            // Construct System Prompt
            let finalSystemPrompt = personality;
            if (knowledgeBase.length > 0) {
                finalSystemPrompt += "\n\n### KNOWLEDGE BASE ###\nUse the following information to answer questions accurately:\n";
                knowledgeBase.forEach(kb => {
                    if (kb.topic && kb.content) {
                        finalSystemPrompt += `\n[${kb.topic.toUpperCase()}]: ${kb.content}\n`;
                    }
                });
            }

            let vapiAssistantId = isEdit ? agent.vapiAssistantId : null;

            if (!isEdit) {
                // CREATE
                const token = await getAuthToken();
                const res = await fetch(`${API_BASE}/api/vapi/create-agent`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ name, type, prompt: finalSystemPrompt })
                });

                const json = await res.json();
                if (!json.success) throw new Error(json.error || "Backend creation failed");
                vapiAssistantId = json.data.id;
            }

            const data = {
                name, type, personality, prompt: finalSystemPrompt, knowledgeBase, tools,
                vapiAssistantId, active, projectId: activeProjectId, updatedAt: new Date().toISOString()
            };

            if (isEdit) {
                // UPDATE including Tools and Project ID for Isolation
                const token = await getAuthToken();
                await fetch(`${API_BASE}/api/vapi/update-agent/${agent.vapiAssistantId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        name,
                        type,
                        prompt: finalSystemPrompt,
                        tools: tools,
                        projectId: activeProjectId // !!! CRITICAL FOR ISOLATION !!!
                    })
                });

                await updateDoc(doc(db, "ai_agents", agent.id), data);
                window.showToast('Agent updated.', 'success');
            } else {
                data.createdAt = new Date().toISOString();
                await addDoc(collection(db, "ai_agents"), data);
                window.showToast('Agent created & trained', 'success');
            }

            document.getElementById('ai-modal-host').innerHTML = '';
            renderAgentList(activeProjectId);

        } catch (err) {
            console.error(err);
            window.showToast("Error: " + err.message, 'error');
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
    if (toolName === 'createLead') defaultArgs = '{\n  "name": "John Tester",\n  "email": "test@example.com",\n  "phone": "1234567890"\n}';
    if (toolName === 'checkAvailability') defaultArgs = '{\n  "date": "2026-02-01"\n}';
    if (toolName === 'bookAppointment') defaultArgs = '{\n  "name": "John Tester",\n  "date": "2026-02-01",\n  "time": "14:00"\n}';

    const modalHtml = `
    <div class="crm-modal-overlay" id="tool-test-overlay">
        <div class="crm-modal-content" style="max-width: 500px;" onclick="event.stopPropagation()">
            <div class="crm-modal-header">
                <div class="text-h">Test Tool: ${toolName}</div>
                <button class="icon-btn" onclick="document.getElementById('tool-test-overlay').remove()"><span class="material-icons">close</span></button>
            </div>
            <div class="crm-modal-body">
                <div class="form-group">
                    <label class="form-label">Arguments (JSON)</label>
                    <textarea id="test-args" class="form-input" rows="5" style="font-family:monospace;">${defaultArgs}</textarea>
                </div>
                <div id="test-output" style="background:#111; color:#0f0; padding:10px; border-radius:4px; font-family:monospace; font-size:0.8rem; display:none; white-space:pre-wrap;"></div>
                <button class="btn btn-primary btn-block mt-3" onclick="runToolTest('${toolName}')">Run Test</button>
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
    btn.innerText = "Running...";
    output.style.display = 'block';
    output.innerText = "Calling Backend...";

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
    btn.innerText = "Run Test";
};

// ... (Existing Vapi helpers: testAgentLive, startVapiSession, deleteAgent - keep them same) 
window.testAgentLive = async (assistantId) => {
    if (!assistantId) return window.showToast("No Assistant ID found", "error");
    const btn = document.getElementById('btn-test-live');

    // 1. Check if call is active 
    if (isCallActive && vapiInstance) {
        vapiInstance.stop();
        return;
    }

    // 0. Immediate UI Feedback
    if (btn) {
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = '<span class="material-icons rotating">sync</span> Init...';
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
        window.showToast("Setup Failed: " + e.message, 'error');
        if (btn) {
            btn.innerHTML = '<span class="material-icons" style="font-size:1.2rem; vertical-align:text-bottom;">mic</span> Test Live';
            btn.disabled = false;
        }
    }
};

// --- DELETE AGENT ---
window.deleteAgent = async (id) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;
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
        window.showToast('Agent deleted', 'normal');
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
            btn.innerHTML = '<span class="material-icons rotating">sync</span> Connecting...';
            btn.disabled = true;
        }

        vapiInstance.start(assistantId);

        if (!vapiInstance._hasListeners) {
            vapiInstance.on('call-start', () => {
                console.log("Call Started");
                isCallActive = true;
                window.showToast("Live Session Connected!", "success");
                const btn = document.getElementById('btn-test-live');
                if (btn) {
                    btn.innerHTML = '<span class="material-icons">stop</span> Stop Call';
                    btn.style.borderColor = 'var(--danger)';
                    btn.style.color = 'var(--danger)';
                    btn.disabled = false;
                }
            });

            vapiInstance.on('call-end', () => {
                console.log("Call Ended");
                isCallActive = false;
                window.showToast("Session Ended", "normal");
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
        window.showToast("Error starting voice session: " + error.message, 'error');
        resetLiveButton();
    }
}

function resetLiveButton() {
    const btn = document.getElementById('btn-test-live');
    if (btn) {
        btn.innerHTML = '<span class="material-icons" style="font-size:1.2rem; vertical-align:text-bottom;">mic</span> Test Live';
        btn.style.borderColor = 'var(--success)';
        btn.style.color = 'var(--success)';
        btn.disabled = false;
    }
}
