import { db, auth } from '../firebase-config.js';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- STATE ---
let currentFollowupId = null;
let saveTimeout = null;

window.autoSaveFollowupNotes = (id, text) => {
    const status = document.getElementById('fu-save-status');
    if (status) {
        status.innerText = 'Saving...';
        status.style.opacity = '1';
        status.className = 'text-xs text-muted';
    }

    if (saveTimeout) clearTimeout(saveTimeout);

    saveTimeout = setTimeout(async () => {
        try {
            await updateDoc(doc(db, "leads", id), {
                notes: text,
                updated_at: new Date().toISOString()
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

// --- INITIALIZATION ---
export async function initFollowup() {
    console.log('Initializing Follow-up Module...');

    const container = document.getElementById('view-followup');
    container.innerHTML = `
        <div style="display:grid; grid-template-columns: 350px 1fr; gap:1rem; height: calc(100vh - 80px);">
            
            <!-- LEFT: List -->
            <div class="card" style="display:flex; flex-direction:column; padding:0; overflow:hidden;">
                <div style="padding:1rem; border-bottom:1px solid var(--border);">
                    <div class="text-h text-gold" style="margin:0;">Follow-up List</div>
                </div>
                
                <!-- Filters -->
                <div style="padding:0.5rem; display:flex; gap:5px; overflow-x:auto;">
                     <button class="btn btn-sm btn-primary fu-filter" data-status="ALL">All</button>
                     <button class="btn btn-sm fu-filter" data-status="INTERESTED">Interested</button>
                     <button class="btn btn-sm fu-filter" data-status="CALLBACK">Call Back</button>
                     <button class="btn btn-sm fu-filter" data-status="NOT_INTERESTED">Not Interested</button>
                </div>

                <div id="fu-lead-list" style="flex:1; overflow-y:auto;">
                    <div class="text-center text-muted mt-3">Loading follow-ups...</div>
                </div>
            </div>

            <!-- RIGHT: Workspace -->
            <div id="fu-workspace" class="card" style="display:flex; flex-direction:column; padding:0; overflow:hidden; position:relative;">
                <div style="padding:2rem; text-align:center; color:var(--text-muted); margin-top:10%;">
                    <span class="material-icons" style="font-size:3rem; opacity:0.5;">checklist_rtl</span>
                    <p>Select a lead to view details</p>
                </div>
            </div>

        </div>
    `;

    loadFollowupLeads('ALL');
    setupFilterListeners();
}

async function loadFollowupLeads(statusFilter) {
    const list = document.getElementById('fu-lead-list');
    list.innerHTML = '<div class="text-center text-muted mt-3"><div class="spinner-border"></div></div>';

    const user = auth.currentUser;
    if (!user) {
        list.innerHTML = `<div class="text-center text-danger p-3">Please sign in.</div>`;
        return;
    }

    // 1. Get current agent ID
    let currentAgentId = null;
    try {
        const teamQuery = query(collection(db, "team"), where("email", "==", user.email));
        const teamSnap = await getDocs(teamQuery);
        if (!teamSnap.empty) currentAgentId = teamSnap.docs[0].id;
    } catch (e) {
        console.error("Error fetching team profile:", e);
    }

    // 2. Query for leads not in the initial cold call "pool" (i.e., they have been acted upon)
    // We are looking for statuses: INTERESTED, CALLBACK, NOT_INTERESTED
    // If the user wants "All", we include all 3.

    let targetStatuses = [];
    if (statusFilter === 'ALL') {
        targetStatuses = ['INTERESTED', 'CALLBACK', 'NOT_INTERESTED'];
    } else {
        targetStatuses = [statusFilter];
    }

    // Firestore 'in' has a max of 10 values
    let q = query(
        collection(db, "leads"),
        where("status", "in", targetStatuses)
    );

    const snapshot = await getDocs(q);
    let leads = [];
    snapshot.forEach(doc => {
        const d = doc.data();
        d.id = doc.id;
        leads.push(d);
    });

    // 3. Filter by Agent
    if (currentAgentId) {
        leads = leads.filter(l => l.assigned_agent_id === currentAgentId);
    } else {
        leads = [];
    }

    if (leads.length === 0) {
        list.innerHTML = `<div class="text-center text-muted p-3">No leads found in this category.</div>`;
        return;
    }

    list.innerHTML = leads.map(l => {
        let statusColor = 'text-muted';
        if (l.status === 'INTERESTED') statusColor = 'text-success';
        if (l.status === 'CALLBACK') statusColor = 'text-warning';
        if (l.status === 'NOT_INTERESTED') statusColor = 'text-danger';

        return `
        <div class="cc-list-item" onclick="selectFollowupLead('${l.id}')">
            <div style="font-weight:bold;">${l.business_name}</div>
            <div class="text-xs ${statusColor}" style="margin-top:2px;">${l.status.replace('_', ' ')}</div>
            <div class="text-xs text-muted">${l.city || ''}</div>
        </div>
        `;
    }).join('');
}

function setupFilterListeners() {
    document.querySelectorAll('.fu-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.fu-filter').forEach(b => b.classList.remove('btn-primary'));
            e.target.classList.add('btn-primary');
            loadFollowupLeads(e.target.dataset.status);
        });
    });
}

window.selectFollowupLead = async (id) => {
    currentFollowupId = id;
    const workspace = document.getElementById('fu-workspace');
    workspace.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-gold"></div></div>';

    try {
        const docRef = doc(db, "leads", id);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
            workspace.innerHTML = '<div class="text-center p-4 text-danger">Lead not found.</div>';
            return;
        }
        const data = snap.data();

        workspace.innerHTML = `
            <div style="padding:2rem; overflow-y:auto; height:100%;">
                
                <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
                    <div>
                        <h2 class="text-h text-gold">${data.business_name}</h2>
                        <div class="text-muted text-sm">${data.address || 'No Address'} | ${data.city || 'No City'}</div>
                    </div>
                    <div>
                         <span class="badge ${getStatusBadgeClass(data.status)}">${data.status}</span>
                    </div>
                </div>

                <div class="card" style="margin-bottom:1rem;">
                    <div class="text-xs text-muted uppercase mb-2">Contact Info</div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <div>
                            <div class="text-xs text-muted">Phone</div>
                            <div>${data.phone || '--'}</div>
                        </div>
                        <div>
                            <div class="text-xs text-muted">Email</div>
                            <div>${data.email || '--'}</div>
                        </div>
                         <div>
                            <div class="text-xs text-muted">Website</div>
                            <div><a href="${data.website}" target="_blank" class="text-gold">${data.website || '--'}</a></div>
                        </div>
                         <div>
                            <div class="text-xs text-muted">Decision Maker</div>
                            <div>${data.dm_name || '--'}</div>
                        </div>
                    </div>
                </div>

                <div class="card" style="margin-bottom:1rem; background:#000; border:1px solid var(--border);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div class="text-xs text-muted uppercase mb-2">Last Notes</div>
                        <span id="fu-save-status" class="text-xs text-muted" style="font-style:italic; opacity:0;">Saved</span>
                    </div>
                    <textarea class="form-input" rows="5" style="width:100%; border:none; background:transparent; resize:none; font-size:0.95rem; line-height:1.5; outline:none;" 
                        placeholder="Add notes..."
                        oninput="autoSaveFollowupNotes('${id}', this.value)">${data.notes || ''}</textarea>
                </div>

                <div class="text-h text-sm uppercase text-muted mb-2">Actions</div>
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-primary" onclick="window.open('tel:${data.phone}')">Call Now</button>
                    <button class="btn" onclick="window.open('mailto:${data.email}')">Email</button>
                    <!-- Potential to move back to queue or change status -->
                </div>

            </div>
        `;

    } catch (e) {
        console.error(e);
        workspace.innerHTML = `<div class="text-center p-4 text-danger">Error: ${e.message}</div>`;
    }
};

function getStatusBadgeClass(status) {
    if (status === 'INTERESTED') return 'badge-success'; // assuming css exists or defaults
    if (status === 'CALLBACK') return 'badge-warning';
    if (status === 'NOT_INTERESTED') return 'badge-danger';
    return 'badge-secondary';
}
