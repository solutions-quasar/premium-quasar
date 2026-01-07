import { db } from '../firebase-config.js';
import { collection, getDocs, addDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function initTeam() {
    console.log('Initializing Sales Team Module...');

    const container = document.getElementById('view-team');
    container.innerHTML = `
        <div class="top-actions" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <div class="text-h text-gold">Sales Team</div>
            <button class="btn btn-primary" onclick="openAddMemberModal()">Add Member</button>
        </div>

        <div id="team-list" class="grid-container" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap:1rem;">
             <div class="text-center text-muted" style="grid-column: 1/-1;">Loading team...</div>
        </div>
        
        <!-- Modal Container -->
        <div id="team-modal-container"></div>
    `;

    renderTeamList();
}

async function renderTeamList() {
    const list = document.getElementById('team-list');

    try {
        const snap = await getDocs(collection(db, "team"));
        if (snap.empty) {
            list.innerHTML = `<div class="text-center text-muted p-4" style="grid-column: 1/-1;">No team members found. Add one to get started.</div>`;
            return;
        }

        let html = '';
        snap.forEach(doc => {
            const m = doc.data();
            html += `
                <div class="card" style="text-align:center;">
                    <div style="width:60px; height:60px; background:var(--bg-dark); border-radius:50%; margin:0 auto 1rem auto; display:flex; align-items:center; justify-content:center; border:2px solid var(--gold); font-size:1.5rem; color:var(--gold);">
                        ${m.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="text-h" style="font-size:1.1rem;">${m.name}</div>
                    <div class="text-sm text-muted mb-3">${m.role || 'Sales Representative'}</div>
                    <div class="text-xs text-muted mb-3">${m.email}</div>
                    
                    <button class="btn btn-sm btn-block" style="border-color:var(--danger); color:var(--danger);" onclick="deleteMember('${doc.id}')">Remove</button>
                </div>
            `;
        });
        list.innerHTML = html;

    } catch (e) {
        console.error(e);
        list.innerHTML = `<div class="text-danger">Error loading team.</div>`;
    }
}

window.openAddMemberModal = () => {
    const host = document.getElementById('team-modal-container');
    host.innerHTML = `
        <div class="crm-modal-overlay" onclick="document.getElementById('team-modal-container').innerHTML=''">
            <div class="crm-modal-content" style="max-width:400px;" onclick="event.stopPropagation()">
                <div class="crm-modal-header">
                    <div class="text-h">Add Team Member</div>
                    <button class="icon-btn" onclick="document.getElementById('team-modal-container').innerHTML=''"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body">
                    <div class="form-group">
                        <label class="form-label">Full Name</label>
                        <input type="text" id="tm-name" class="form-input" placeholder="e.g. John Doe">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email Address</label>
                        <input type="email" id="tm-email" class="form-input" placeholder="john@quasar.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Role</label>
                        <select id="tm-role" class="form-input" style="background:var(--bg-dark); color:white;">
                            <option value="Sales Representative">Sales Representative</option>
                            <option value="Sales Manager">Sales Manager</option>
                        </select>
                    </div>
                    <button class="btn btn-primary btn-block mt-3" onclick="saveNewMember()">Add Member</button>
                </div>
            </div>
        </div>
    `;
};

window.saveNewMember = async () => {
    const name = document.getElementById('tm-name').value;
    const email = document.getElementById('tm-email').value;
    const role = document.getElementById('tm-role').value;

    if (!name || !email) {
        alert('Please fill in all fields');
        return;
    }

    try {
        await addDoc(collection(db, "team"), {
            name,
            email,
            role,
            created_at: new Date().toISOString()
        });
        document.getElementById('team-modal-container').innerHTML = ''; // Close
        renderTeamList(); // Refresh
    } catch (e) {
        console.error(e);
        alert('Error adding member: ' + e.message);
    }
};

window.deleteMember = async (id) => {
    if (confirm('Remove this user from the team?')) {
        await deleteDoc(doc(db, "team", id));
        renderTeamList();
    }
};

// Helper for Leads Module to fetch team for dropdown
export async function getTeamDropdownOptions(selectedId = null) {
    const snap = await getDocs(collection(db, "team"));
    if (snap.empty) return '<option value="">No Team Members Found</option>';

    let options = '<option value="">-- Select Agent --</option>';
    snap.forEach(doc => {
        const m = doc.data();
        const selected = selectedId === doc.id ? 'selected' : '';
        options += `<option value="${doc.id}" ${selected}>${m.name}</option>`;
    });
    return options;
}
