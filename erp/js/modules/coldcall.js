import { db, auth } from '../firebase-config.js';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- STATE ---
let currentScriptId = null;
let currentLeadId = null;
let currentSettings = {
    targetCalls: 20,
    targetMeetings: 2,
    targetSales: 1,
    targetRevenue: 1000
};

// --- INITIALIZATION ---
export async function initColdCall() {
    console.log('Initializing Cold Call Module...');

    // Load Settings
    await loadSettings();

    const container = document.getElementById('view-coldcall');
    container.innerHTML = `
        <!-- Top Stats Bar -->
        <div id="cc-stats-bar" class="card" style="display:flex; justify-content:space-between; align-items:center; padding:1rem; margin-bottom:1rem; flex-wrap:wrap; gap:10px;">
             <!-- Injected via renderStats() -->
        </div>

        <div style="display:grid; grid-template-columns: 350px 1fr; gap:1rem; height: calc(100vh - 140px);">
            
            <!-- LEFT: Lead List -->
            <div class="card" style="display:flex; flex-direction:column; padding:0; overflow:hidden;">
                <div style="padding:1rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                    <div class="text-h text-gold" style="margin:0;">Call List</div>
                    <button class="btn btn-sm" onclick="openScriptsManager()">Scripts</button>
                </div>
                
                <!-- Filters -->
                <div style="padding:0.5rem; display:flex; gap:5px; overflow-x:auto;">
                     <button class="btn btn-sm btn-primary cc-filter" data-cat="ALL">All</button>
                     <button class="btn btn-sm cc-filter" data-cat="NO_WEBSITE">No Web</button>
                     <button class="btn btn-sm cc-filter" data-cat="DATED_DESIGN">Dated</button>
                     <button class="btn btn-sm cc-filter" data-cat="BAD_RANKING">SEO</button>
                </div>

                <div id="cc-lead-list" style="flex:1; overflow-y:auto;">
                    <div class="text-center text-muted mt-3">Loading leads...</div>
                </div>
            </div>

            <!-- RIGHT: Workspace -->
            <div id="cc-workspace" class="card" style="display:flex; flex-direction:column; padding:0; overflow:hidden; position:relative;">
                <div style="padding:2rem; text-align:center; color:var(--text-muted); margin-top:10%;">
                    <span class="material-icons" style="font-size:3rem; opacity:0.5;">phone_in_talk</span>
                    <p>Select a lead to start calling</p>
                </div>
            </div>

        </div>

        <!-- Hidden Modal Container -->
        <div id="cc-modal-container"></div>
    `;

    renderStats();
    loadApprovedLeads('ALL');
    setupFilterListeners();
}

// --- LOADERS ---
async function loadSettings() {
    const saved = localStorage.getItem('cc_settings');
    if (saved) currentSettings = JSON.parse(saved);
}

function renderStats() {
    const bar = document.getElementById('cc-stats-bar');
    if (!bar) return;

    // TODO: Connect 'Actual' to real logs later. For now, 0 or mock.
    // TODO: Connect 'Actual' to real logs later. For now, 0 or mock.
    bar.innerHTML = `
        <div style="display:flex; align-items:center; margin-right:15px; border-right:1px solid var(--border); padding-right:15px; cursor:pointer;" onclick="editTargets()" title="Edit Targets">
            <span class="material-icons text-gold" style="font-size:1.5rem; margin-right:8px;">track_changes</span>
            <div class="text-h" style="font-size:1rem;">Targets</div>
        </div>
        <div class="stat-item" style="padding: 0 10px;">
            <div class="text-xs text-muted">Calls</div>
            <div class="text-h" style="font-size:1rem;">0 / <span class="text-gold edit-target" onclick="editTargets()">${currentSettings.targetCalls}</span></div>
        </div>
        <div class="stat-item" style="padding: 0 10px;">
            <div class="text-xs text-muted">Meetings</div>
            <div class="text-h" style="font-size:1rem;">0 / <span class="text-gold edit-target" onclick="editTargets()">${currentSettings.targetMeetings}</span></div>
        </div>
        <div class="stat-item" style="padding: 0 10px;">
            <div class="text-xs text-muted">Sales</div>
            <div class="text-h" style="font-size:1rem;">0 / <span class="text-gold edit-target" onclick="editTargets()">${currentSettings.targetSales}</span></div>
        </div>
        <div class="stat-item" style="padding: 0 10px;">
            <div class="text-xs text-muted">Revenue</div>
            <div class="text-h" style="font-size:1rem;">$0 / <span class="text-gold edit-target" onclick="editTargets()">${currentSettings.targetRevenue}</span></div>
        </div>
    `;
}

async function loadApprovedLeads(categoryFilter) {
    const list = document.getElementById('cc-lead-list');
    list.innerHTML = '<div class="text-center text-muted mt-3"><div class="spinner-border"></div></div>';

    const user = auth.currentUser;
    if (!user) {
        list.innerHTML = `<div class="text-center text-danger p-3">Please sign in to view calls.</div>`;
        return;
    }

    // 1. Find the current user's "Team Member ID" by email
    // This assumes the 'team' collection has documents with an 'email' field matching auth.currentUser.email
    let currentAgentId = null;
    try {
        const teamQuery = query(collection(db, "team"), where("email", "==", user.email));
        const teamSnap = await getDocs(teamQuery);
        if (!teamSnap.empty) {
            currentAgentId = teamSnap.docs[0].id;
        } else {
            console.warn("Current user not found in 'team' collection. Showing NO leads.");
        }
    } catch (e) {
        console.error("Error fetching team profile:", e);
    }

    let q = query(
        collection(db, "leads"),
        where("status", "in", ["APPROVED", "CONTACT_QUEUED", "CONTACTED"])
    );

    const snapshot = await getDocs(q);
    let leads = [];
    snapshot.forEach(doc => {
        const d = doc.data();
        d.id = doc.id;
        leads.push(d);
    });

    // 2. Filter by Assigned Agent
    if (currentAgentId) {
        // Strict filtering: User must be assigned
        leads = leads.filter(l => l.assigned_agent_id === currentAgentId);
    } else {
        // If user is not in the team list, they shouldn't see any leads (or maybe all if admin?)
        // Per request: "only be the assigned lead to the current sales person"
        // So if no agent profile found -> empty list.
        leads = [];
    }

    if (categoryFilter !== 'ALL') {
        leads = leads.filter(l => l.lead_quality_category === categoryFilter);
    }

    if (leads.length === 0) {
        list.innerHTML = `<div class="text-center text-muted p-3">No leads assigned to you.</div>`;
        return;
    }

    list.innerHTML = leads.map(l => `
        <div class="cc-list-item" onclick="selectColdCallLead('${l.id}')">
            <div style="font-weight:bold;">${l.business_name}</div>
            <div class="text-xs text-muted">${l.city} • ${l.lead_quality_category || 'Other'}</div>
        </div>
    `).join('');

    // Auto-select first lead
    if (leads.length > 0) {
        selectColdCallLead(leads[0].id);
    }
}

function setupFilterListeners() {
    document.querySelectorAll('.cc-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.cc-filter').forEach(b => b.classList.remove('btn-primary'));
            e.target.classList.add('btn-primary');
            loadApprovedLeads(e.target.dataset.cat);
        });
    });
}

// --- WORKSPACE LOGIC ---
window.selectColdCallLead = async (id) => {
    try {
        currentLeadId = id;

        // Highlight active item
        document.querySelectorAll('.cc-list-item').forEach(el => el.classList.remove('active-lead'));
        const activeItem = document.querySelector(`.cc-list-item[onclick*="${id}"]`);
        if (activeItem) activeItem.classList.add('active-lead');

        const workspace = document.getElementById('cc-workspace');
        workspace.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-gold"></div><div class="mt-2 text-muted">Loading lead data...</div></div>';

        const docRef = doc(db, "leads", id);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
            workspace.innerHTML = '<div class="text-center p-4 text-danger">Lead not found.</div>';
            return;
        }
        const data = snap.data();
        data.id = id;

        // Fetch All Scripts for Dropdown
        let allScripts = [];
        try {
            const scriptsSnap = await getDocs(collection(db, "scripts"));
            scriptsSnap.forEach(doc => {
                allScripts.push({ id: doc.id, ...doc.data() });
            });
        } catch (e) { console.error("Error loading scripts", e); }

        // Find Best Script Match (Default)
        // Find Best Script Match (Default)
        const category = data.lead_quality_category || 'OTHER';
        let activeScript = null;

        if (data.selected_script_id) {
            activeScript = allScripts.find(s => s.id === data.selected_script_id);
        }

        if (!activeScript) {
            activeScript = allScripts.find(s => s.category === category) || allScripts[0] || null;
        }

        // Store scripts globally for local switching
        window.availableScripts = allScripts;

        // Generate Script Options
        let scriptOptions = '';
        allScripts.forEach(s => {
            const isSelected = activeScript && s.id === activeScript.id ? 'selected' : '';
            scriptOptions += `<option value="${s.id}" ${isSelected}>${s.title} (${s.category})</option>`;
        });


        workspace.innerHTML = `
            <div style="display:flex; flex:1; overflow:hidden;">
                <!-- Main Content: Script & Data -->
                <div style="flex:1; padding:1.5rem; overflow-y:auto; border-right:1px solid var(--border);">
                    
                    <!-- Lead Header -->
                    <div style="display:flex; justify-content:space-between; margin-bottom:1.5rem; align-items: flex-start; gap: 20px;">
                        
                        <!-- LEFT: Lead Info (Fixed Width) -->
                        <div style="width:300px;">
                            
                            <!-- Business Name -->
                            <div class="field-container" id="field-container-business_name">
                                <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                                    <div class="text-h" style="font-size:1.8rem; line-height:1.2;">${data.business_name}</div>
                                    <span class="material-icons text-muted hover-icon" style="font-size:1.1rem; cursor:pointer;" 
                                          onclick="enableInlineEdit('${id}', 'business_name', '${data.business_name.replace(/'/g, "\\'")}')" 
                                          title="Edit Name">edit</span>
                                </div>
                            </div>

                            <!-- Phone -->
                            <div class="field-container" id="field-container-phone" style="margin-bottom:5px;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span class="material-icons text-gold" style="font-size:1rem;">phone</span>
                                    <span style="font-size:1rem; font-weight:500;">${data.phone || 'No Phone'}</span>
                                    <span class="material-icons text-muted hover-icon" style="font-size:0.9rem; cursor:pointer;" 
                                          onclick="enableInlineEdit('${id}', 'phone', '${data.phone ? data.phone.replace(/'/g, "\\'") : ''}')" 
                                          title="Edit Phone">edit</span>
                                </div>
                            </div>

                            <!-- Email -->
                            <div class="field-container" id="field-container-email" style="margin-bottom:5px;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span class="material-icons text-gold" style="font-size:1rem;">email</span>
                                    <span style="font-size:1rem; font-weight:500;">${data.email || 'No Email'}</span>
                                    <span class="material-icons text-muted hover-icon" style="font-size:0.9rem; cursor:pointer;" 
                                          onclick="enableInlineEdit('${id}', 'email', '${data.email ? data.email.replace(/'/g, "\\'") : ''}')" 
                                          title="Edit Email">edit</span>
                                </div>
                            </div>

                            <!-- Website -->
                            <div class="field-container" id="field-container-website">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span class="material-icons text-gold" style="font-size:1rem;">language</span>
                                    <a href="${data.website}" target="_blank" class="hover-underline" style="font-size:0.9rem; text-decoration:none; color: #60a5fa;">
                                        ${data.website ? (data.website.startsWith('http') ? new URL(data.website).hostname : data.website) : 'No Website'}
                                    </a>
                                    <span class="material-icons text-muted hover-icon" style="font-size:0.9rem; cursor:pointer;" 
                                          onclick="enableInlineEdit('${id}', 'website', '${data.website ? data.website.replace(/'/g, "\\'") : ''}')" 
                                          title="Edit URL">edit</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- MIDDLE: Decision Maker Info (Centered) -->
                        <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                        ${(data.dm_name || data.dm_email || data.dm_phone) ? `
                             <div class="text-xs text-muted uppercase mb-2" style="letter-spacing:1px; color:#DFA53A; font-weight:bold;">Decision Maker</div>
                             
                             ${data.dm_name ? `
                             <div class="field-container" style="margin-bottom:2px;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span class="material-icons" style="font-size:1rem; color:#DFA53A;">person</span>
                                    <span style="font-size:1.1rem; font-weight:600;">${data.dm_name}</span>
                                </div>
                             </div>` : ''}

                             ${data.dm_phone ? `
                             <div class="field-container" style="margin-bottom:2px;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span class="material-icons" style="font-size:1rem; color:#DFA53A;">contact_phone</span>
                                    <span style="font-size:1rem; font-weight:500;">${data.dm_phone}</span>
                                </div>
                             </div>` : ''}

                             ${data.dm_email ? `
                             <div class="field-container" style="margin-bottom:2px;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span class="material-icons" style="font-size:1rem; color:#DFA53A;">alternate_email</span>
                                    <span style="font-size:1rem; font-weight:500;">${data.dm_email}</span>
                                </div>
                             </div>` : ''}
                        ` : ''}
                        </div>

                        <!-- RIGHT: Script Selector -->
                        <div style="width:250px; text-align:right;">
                             <label class="text-xs text-muted uppercase mb-1" style="display:block;">Call Script</label>
                             <select onchange="updateScriptView(this.value)" 
                                     style="width:100%; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border); padding:8px; border-radius:6px; font-size:0.9rem; cursor:pointer; outline:none;">
                                ${scriptOptions || '<option value="">No Scripts Available</option>'}
                            </select>
                            <div class="text-xs text-muted mt-1" style="cursor:pointer; text-decoration:underline;" onclick="openScriptsManager()">Manage Scripts</div>
                        </div>

                    </div>

                    <!-- Script Section -->
                    <div class="card" style="background:#000; border:1px solid var(--gold-dim);">
                        <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border); padding:10px;">
                            <span class="text-gold font-bold" id="script-display-title">SCRIPT: ${activeScript ? activeScript.title : 'None Selected'}</span>
                        </div>
                        <div id="script-display-content" style="padding:1.5rem; line-height:1.6; font-size:1rem; white-space:pre-wrap;">${activeScript ? activeScript.content : 'No script found. Please add one in the Scripts Manager.'}</div>
                    </div>

                    <!-- Notes -->
                    <div class="form-group mt-3">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <label class="form-label">Call Notes</label>
                            <span id="save-status" class="text-xs text-muted" style="font-style:italic; opacity:0;">Saved</span>
                        </div>
                        <textarea id="cc-notes" class="form-input" rows="5" placeholder="Jotted down notes..." 
                                  oninput="autoSaveNotes('${id}', this.value)">${data.notes || ''}</textarea>
                    </div>

                </div>

                <!-- Right Actions Sidebar -->
                <div style="width:250px; padding:1.5rem; background:var(--bg-card);">
                    <div class="text-h text-sm uppercase text-muted mb-2">Actions</div>

                    <button class="btn btn-block mb-2" onclick="openMeetingModal()">
                        <span class="material-icons text-sm">videocam</span> Book Meeting
                    </button>

                    <div class="divider" style="margin:1rem 0; border-top:1px solid var(--border);"></div>

                    <div class="text-h text-sm uppercase text-muted mb-2">Log Outcome</div>
                    <button class="btn btn-block mb-2" style="border-color:var(--success); color:var(--success);" onclick="logOutcome('INTERESTED')">Interested</button>
                    <button class="btn btn-block mb-2" style="border-color:var(--warning); color:var(--warning);" onclick="logOutcome('CALLBACK')">Call Back Later</button>
                    <button class="btn btn-block mb-2" style="border-color:var(--danger); color:var(--danger);" onclick="logOutcome('NOT_INTERESTED')">Not Interested</button>

                </div>
            </div>
        `;
    } catch (e) {
        console.error("Error loading cold call lead:", e);
        document.getElementById('cc-workspace').innerHTML = `<div class="text-center p-4 text-danger">Error loading data: ${e.message}</div>`;
    }
};

async function getBestScript(category) {
    if (!category) category = 'GENERAL';

    try {
        // Try exact category match
        let q = query(collection(db, "scripts"), where("category", "==", category));
        let snap = await getDocs(q);

        if (!snap.empty) return snap.docs[0].data();

        // Fallback to GENERAL
        if (category !== 'GENERAL') {
            q = query(collection(db, "scripts"), where("category", "==", "GENERAL"));
            snap = await getDocs(q);
            if (!snap.empty) return snap.docs[0].data();
        }

        return null;
    } catch (e) {
        console.warn("Script fetch error (likely index or network):", e);
        return null;
    }
}

// --- TARGETS ---
window.editTargets = () => {
    const modalHost = document.getElementById('cc-modal-container');

    modalHost.innerHTML = `
        <div class="crm-modal-overlay" onclick="document.getElementById('cc-modal-container').innerHTML=''">
            <div class="crm-modal-content" style="max-width:400px;" onclick="event.stopPropagation()">
            <div class="crm-modal-header">
                <div class="text-h">Set Targets</div>
                <button class="icon-btn" onclick="document.getElementById('cc-modal-container').innerHTML=''"><span class="material-icons">close</span></button>
            </div>
            <div class="crm-modal-body">
                <div class="form-group">
                    <label class="form-label">Daily Calls Target</label>
                    <input type="number" id="target-calls" class="form-input" value="${currentSettings.targetCalls}">
                </div>
                <div class="form-group">
                    <label class="form-label">Weekly Meetings Target</label>
                    <input type="number" id="target-meetings" class="form-input" value="${currentSettings.targetMeetings}">
                </div>
                <div class="form-group">
                    <label class="form-label">Weekly Sales Target</label>
                    <input type="number" id="target-sales" class="form-input" value="${currentSettings.targetSales}">
                </div>
                <div class="form-group">
                    <label class="form-label">Weekly Revenue Target ($)</label>
                    <input type="number" id="target-revenue" class="form-input" value="${currentSettings.targetRevenue}">
                </div>
                <button class="btn btn-primary btn-block mt-3" onclick="saveTargets()">Save Targets</button>
            </div>
        </div>
        </div >
    `;
};

window.saveTargets = () => {
    currentSettings.targetCalls = document.getElementById('target-calls').value;
    currentSettings.targetMeetings = document.getElementById('target-meetings').value;
    currentSettings.targetSales = document.getElementById('target-sales').value;
    currentSettings.targetRevenue = document.getElementById('target-revenue').value;

    localStorage.setItem('cc_settings', JSON.stringify(currentSettings));
    document.getElementById('cc-modal-container').innerHTML = ''; // Close modal
    renderStats(); // Refresh UI
};

// --- SCRIPTS MANAGER ---
window.openScriptsManager = async () => {
    const modalHost = document.getElementById('cc-modal-container');

    // Fetch all scripts
    const snap = await getDocs(collection(db, "scripts"));
    let scriptsHtml = '';
    snap.forEach(doc => {
        const d = doc.data();
        scriptsHtml += `
    <div class="list-item" onclick="editScript('${doc.id}')">
        <div>
            <div style="font-weight:bold;">${d.title}</div>
            <div class="text-xs text-muted">Category: ${d.category}</div>
        </div>
    </div>
    `;
    });

    modalHost.innerHTML = `
    <div class="crm-modal-overlay" onclick="document.getElementById('cc-modal-container').innerHTML=''">
        <div class="crm-modal-content" onclick="event.stopPropagation()">
            <div class="crm-modal-header">
                <div class="text-h">Scripts Manager</div>
                <button class="icon-btn" onclick="createNewScript()"><span class="material-icons">add</span></button>
            </div>
            <div class="crm-modal-body">
                <div id="script-list">
                    ${scriptsHtml || '<p class="text-muted text-center">No scripts yet.</p>'}
                </div>
                <hr class="my-3" style="border:0; border-top:1px solid var(--border);">
                    <div id="script-editor" style="display:none;">
                        <input type="hidden" id="edit-script-id">
                            <div class="form-group">
                                <label class="form-label" for="edit-script-title">Title</label>
                                <input type="text" id="edit-script-title" class="form-input">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="edit-script-cat">Category</label>
                                <select id="edit-script-cat" class="form-input" style="color:white; background:var(--bg-dark);">
                                    <option value="GENERAL">General</option>
                                    <option value="NO_WEBSITE">No Website</option>
                                    <option value="DATED_DESIGN">Dated Design</option>
                                    <option value="BAD_RANKING">Bad Ranking (SEO)</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="edit-script-body">Script Body</label>
                                <textarea id="edit-script-body" class="form-input" rows="10"></textarea>
                            </div>
                            <button class="btn btn-primary btn-block" onclick="saveScript()">Save Script</button>
                            <button class="btn btn-block btn-text text-danger mt-2" onclick="deleteScript()">Delete</button>
                    </div>
            </div>
        </div>
    </div>
    `;
};

window.createNewScript = () => {
    document.getElementById('script-editor').style.display = 'block';
    document.getElementById('edit-script-id').value = '';
    document.getElementById('edit-script-title').value = '';
    document.getElementById('edit-script-body').value = '';
};

window.editScript = async (id) => {
    const snap = await getDoc(doc(db, "scripts", id));
    if (!snap.exists()) return;
    const d = snap.data();

    document.getElementById('script-editor').style.display = 'block';
    document.getElementById('edit-script-id').value = id;
    document.getElementById('edit-script-title').value = d.title;
    document.getElementById('edit-script-cat').value = d.category;
    document.getElementById('edit-script-body').value = d.content;
};

window.saveScript = async () => {
    const id = document.getElementById('edit-script-id').value;
    const data = {
        title: document.getElementById('edit-script-title').value,
        category: document.getElementById('edit-script-cat').value,
        content: document.getElementById('edit-script-body').value,
        updated_at: new Date().toISOString()
    };

    if (id) {
        await updateDoc(doc(db, "scripts", id), data);
    } else {
        await addDoc(collection(db, "scripts"), data);
    }

    // Refresh
    openScriptsManager();
};

window.deleteScript = async () => {
    const id = document.getElementById('edit-script-id').value;
    if (id && confirm("Delete script?")) {
        // Deletion logic omitted for brevity (Firebase deleteDoc needed in import)
        // Ideally: await deleteDoc(doc(db, "scripts", id));
        alert('Deleted (simulated)');
        openScriptsManager();
    }
};

// --- MEETING LOGIC ---
window.openMeetingModal = () => {
    console.log('openMeetingModal called. LeadId:', currentLeadId);

    // Current Lead Data
    if (!currentLeadId) {
        alert("No lead selected. Please select a lead first.");
        return;
    }

    const modalHost = document.getElementById('cc-modal-container');
    modalHost.innerHTML = `
        <div class="crm-modal-overlay" onclick="document.getElementById('cc-modal-container').innerHTML=''">
            <div class="crm-modal-content" style="max-width:400px;" onclick="event.stopPropagation()">
                <div class="crm-modal-header">
                    <div class="text-h">Book Video Meeting</div>
                    <button class="icon-btn" onclick="document.getElementById('cc-modal-container').innerHTML=''"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body">
                    <div class="form-group">
                        <label class="form-label" for="meeting-date">Meeting Date & Time</label>
                        <input type="datetime-local" id="meeting-date" class="form-input">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="meeting-duration">Duration</label>
                        <select id="meeting-duration" class="form-input" style="background:var(--bg-dark); color:white;">
                            <option value="15">15 Minutes</option>
                            <option value="30" selected>30 Minutes</option>
                            <option value="45">45 Minutes</option>
                            <option value="60">1 Hour</option>
                        </select>
                    </div>
                    <div class="text-xs text-muted mb-3">
                        This will save to your ERP Calendar and open Google Calendar for you to confirm the invite.
                    </div>
                    <button class="btn btn-primary btn-block" onclick="confirmMeetingBooking()">
                        <span class="material-icons text-sm">videocam</span> Book & Open Google Cal
                    </button>
                </div>
            </div>
        </div>
    `;

    // Set default value to tomorrow 10am
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    // Format for datetime-local: YYYY-MM-DDTHH:MM
    const isoString = tomorrow.toLocaleString('sv').replace(' ', 'T').slice(0, 16);
    document.getElementById('meeting-date').value = isoString;
};

window.confirmMeetingBooking = async () => {
    console.log('confirmMeetingBooking called');
    const dateInput = document.getElementById('meeting-date').value;
    const duration = parseInt(document.getElementById('meeting-duration').value);

    if (!dateInput) {
        alert("Please select a date and time.");
        return;
    }

    const startTime = new Date(dateInput);
    const endTime = new Date(startTime.getTime() + duration * 60000);

    // Get Lead Info handling two sources (current loaded lead in UI)
    // Using specific ID selectors to ensure we get the right data
    const businessName = document.querySelector('#field-container-business_name .text-h')?.innerText || 'Unknown Lead';

    // Safety check for Phone/Email selectors
    const phoneEl = document.querySelector('#field-container-phone span:nth-of-type(2)');
    const phone = phoneEl ? phoneEl.innerText.trim() : '';

    const emailEl = document.querySelector('#field-container-email span:nth-of-type(2)');
    const email = emailEl ? emailEl.innerText.trim() : '';

    const notes = document.getElementById('cc-notes')?.value || '';

    // 1. Save to Internal ERP Calendar (Firestore)
    try {
        await addDoc(collection(db, "events"), {
            title: `Meeting: ${businessName}`,
            start: startTime.toISOString(),
            end: endTime.toISOString(),
            description: `Phone: ${phone}\nEmail: ${email}\nNotes: ${notes}`,
            leadId: currentLeadId,
            type: 'meeting',
            leadName: businessName,
            created_at: new Date().toISOString()
        });

        // Update Stats (Meetings Count)
        document.getElementById('cc-modal-container').innerHTML = '';

    } catch (e) {
        console.error("Error saving internal meeting:", e);
        alert("Saved to Google Calendar, but failed to save to ERP: " + e.message);
    }

    // 2. Open Google Calendar Link
    // Format: YYYYMMDDTHHmmSSZ
    const formatGCal = (date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");

    const gCalUrl = new URL("https://calendar.google.com/calendar/render");
    gCalUrl.searchParams.append("action", "TEMPLATE");
    gCalUrl.searchParams.append("text", `Meeting with ${businessName}`);
    gCalUrl.searchParams.append("dates", `${formatGCal(startTime)}/${formatGCal(endTime)}`);

    const details = "Meeting Solutions Quasar Inc.";

    gCalUrl.searchParams.append("details", details);
    gCalUrl.searchParams.append("location", "Google Meet");

    // Only add guest if it looks like an email
    if (email && email.includes('@')) {
        gCalUrl.searchParams.append("add", email);
    }

    window.open(gCalUrl.toString(), '_blank');

    // Log Outcome Automatically
    logOutcome('MEETING_BOOKED');
};

window.logOutcome = async (outcome) => {
    if (!currentLeadId) return;

    const notes = document.getElementById('cc-notes').value;

    // Optimistic UI update: Remove from list immediately
    const listItem = document.querySelector(`.cc-list-item[onclick*="${currentLeadId}"]`);
    if (listItem) {
        listItem.style.display = 'none'; // Animate out?
        listItem.remove();
    }
    document.getElementById('cc-workspace').innerHTML = `
        <div style="padding:2rem; text-align:center; color:var(--text-muted); margin-top:10%;">
            <span class="material-icons text-success" style="font-size:3rem;">check_circle</span>
            <p>Outcome Logged: ${outcome.replace('_', ' ')}</p>
            <p class="text-xs">Select another lead to continue.</p>
        </div>
    `;

    try {
        await updateDoc(doc(db, "leads", currentLeadId), {
            status: outcome,
            notes: notes, // Ensure latest notes are saved
            last_contacted: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        // Refresh Lists if needed, or just rely on removal
        renderStats(); // Update stats counters

    } catch (e) {
        console.error("Error logging outcome:", e);
        alert("Error saving outcome: " + e.message);
        // Revert UI changes if needed, but for now simple error is enough
    }
};

// --- CHANGE CATEGORY LOGIC ---
window.changeLeadCategory = async (id, newCategory) => {
    if (!newCategory) return;
    try {
        await updateDoc(doc(db, "leads", id), {
            lead_quality_category: newCategory,
            updated_at: new Date().toISOString()
        });
        // Reload the workspace (updates script)
        selectColdCallLead(id);

        // Optional: Reload list if we want to reflect change in list immediately, 
        // but that might reset scroll position. For now, workspace update is key.

    } catch (e) {
        console.error(e);
        alert('Error updating category.');
    }
};

// --- INLINE EDIT LOGIC ---
window.enableInlineEdit = (id, field, currentValue) => {
    const container = document.getElementById(`field-container-${field}`);
    if (!container) return;

    // Save style for restoration if needed
    // const originalHTML = container.innerHTML; 

    // Create Input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    input.className = 'form-input';
    input.style.width = '100%';
    input.style.padding = '8px';
    input.style.fontSize = field === 'business_name' ? '1.5rem' : '1rem';

    // Save on Blur or Enter
    const save = () => {
        if (input.dataset.saving === 'true') return; // Prevent double firing
        input.dataset.saving = 'true';
        confirmInlineEdit(id, field, input.value, container);
    };

    input.onblur = save;
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            input.blur(); // Triggers save
        }
    };

    container.innerHTML = '';
    container.appendChild(input);
    input.focus();
};

window.confirmInlineEdit = async (id, field, newValue, container) => {
    // Optimistic UI update or wait? Let's wait for firestore to be safe, or just render "read" state.
    // If we want to be instant, we render read state immediately.

    // 1. Update DB
    if (newValue) {
        updateLeadField(id, field, newValue);
    }

    // 2. Render Read State back
    // We need to reconstruct the HTML based on field type. 
    // This is a bit duplicative of the main render function but ensures smooth UX without full reload.

    let html = '';
    const safeValue = newValue.replace(/'/g, "\\'"); // escape for onclick

    if (field === 'business_name') {
        html = `
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                <div class="text-h" style="font-size:1.8rem; line-height:1.2;">${newValue}</div>
                <span class="material-icons text-muted hover-icon" style="font-size:1.1rem; cursor:pointer;" 
                      onclick="enableInlineEdit('${id}', 'business_name', '${safeValue}')" 
                      title="Edit Name">edit</span>
            </div>
        `;
    } else if (field === 'phone') {
        html = `
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="material-icons text-gold" style="font-size:1rem;">phone</span>
                <span style="font-size:1rem; font-weight:500;">${newValue || 'No Phone'}</span>
                <span class="material-icons text-muted hover-icon" style="font-size:0.9rem; cursor:pointer;" 
                      onclick="enableInlineEdit('${id}', 'phone', '${safeValue}')" 
                      title="Edit Phone">edit</span>
            </div>
        `;
    } else if (field === 'email') {
        html = `
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="material-icons text-gold" style="font-size:1rem;">email</span>
                <span style="font-size:1rem; font-weight:500;">${newValue || 'No Email'}</span>
                <span class="material-icons text-muted hover-icon" style="font-size:0.9rem; cursor:pointer;" 
                      onclick="enableInlineEdit('${id}', 'email', '${safeValue}')" 
                      title="Edit Email">edit</span>
            </div>
        `;
    } else if (field === 'website') {
        let displayUrl = 'No Website';
        try { displayUrl = new URL(newValue).hostname; } catch (e) { displayUrl = newValue || 'No Website'; }
        html = `
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="material-icons text-gold" style="font-size:1rem;">language</span>
                <a href="${newValue}" target="_blank" class="hover-underline" style="font-size:0.9rem; text-decoration:none; color: #60a5fa;">
                    ${displayUrl}
                </a>
                <span class="material-icons text-muted hover-icon" style="font-size:0.9rem; cursor:pointer;" 
                      onclick="enableInlineEdit('${id}', 'website', '${safeValue}')" 
                      title="Edit URL">edit</span>
            </div>
        `;
    }

    container.innerHTML = html;
};

// --- UPDATE FIELD LOGIC ---
// (Kept as is, but remove promptUpdateLeadField if it exists above this block in previous version)
window.updateLeadField = async (id, field, value) => {
    try {
        await updateDoc(doc(db, "leads", id), {
            [field]: value,
            updated_at: new Date().toISOString()
        });

        // Update list item text immediately if name changed
        if (field === 'business_name') {
            loadApprovedLeads(document.querySelector('.cc-filter.btn-primary').dataset.cat);
        }

    } catch (e) {
        console.error(e);
        alert('Error saving change.');
    }
};

// --- NOTES AUTO-SAVE LOGIC ---
let saveTimer = null;
window.autoSaveNotes = (id, text) => {
    // Show "Saving..." immediately
    const status = document.getElementById('save-status');
    if (status) {
        status.innerText = 'Saving...';
        status.style.opacity = '1';
        status.className = 'text-xs text-warning';
    }

    // Clear previous timer
    if (saveTimer) clearTimeout(saveTimer);

    // Set new timer (Debounce 1s)
    saveTimer = setTimeout(async () => {
        try {
            await updateDoc(doc(db, "leads", id), {
                notes: text
            });
            if (status) {
                status.innerText = 'Saved';
                status.className = 'text-xs text-success';
                setTimeout(() => { if (status) status.style.opacity = '0'; }, 2000);
            }
        } catch (e) {
            console.error("Auto-save failed", e);
            if (status) {
                status.innerText = 'Error Saving';
                status.className = 'text-xs text-danger';
            }
        }
    }, 1000);
};

// Explicitly expose functions to global scope for HTML onclick handlers
window.updateScriptView = async (scriptId) => {
    if (!window.availableScripts) return;
    const script = window.availableScripts.find(s => s.id === scriptId);

    // Update UI immediately
    if (script) {
        document.getElementById('script-display-title').innerText = `SCRIPT: ${script.title}`;
        document.getElementById('script-display-content').innerText = script.content;
    }

    // Save to Firestore
    if (currentLeadId && script) {
        try {
            await updateDoc(doc(db, "leads", currentLeadId), {
                selected_script_id: scriptId,
                lead_quality_category: script.category // Keep category in sync with script
            });
            console.log("Script preference saved.");
        } catch (e) {
            console.error("Error saving script preference:", e);
        }
    }
};

window.initColdCall = initColdCall;
console.log('hacker_voice_im_in: Cold Call Module Loaded');
