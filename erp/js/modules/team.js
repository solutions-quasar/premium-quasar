import { db } from '../firebase-config.js';
import { collection, getDocs, addDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { t } from '../services/translationService.js';
import { erpConfirm } from '../services/uiService.js';

export async function initTeam() {
    console.log('Initializing Sales Team Module...');

    const container = document.getElementById('view-team');
    container.innerHTML = `
        <div class="top-actions" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <div class="text-h text-gold">${t('team_title')}</div>
            <button class="btn btn-primary" onclick="openAddMemberModal()">${t('team_add_member')}</button>
        </div>

        <div id="team-list" class="grid-container" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap:1rem;">
             <div class="text-center text-muted" style="grid-column: 1/-1;">${t('team_loading')}</div>
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
            list.innerHTML = `<div class="text-center text-muted p-4" style="grid-column: 1/-1;">${t('team_no_members')}</div>`;
            return;
        }

        let html = '';
        snap.forEach(doc => {
            const m = doc.data();
            html += `
                <div class="card" style="text-align:center; cursor:pointer;" onclick="openEditMemberModal('${doc.id}')">
                    <div style="width:60px; height:60px; background:var(--bg-dark); border-radius:50%; margin:0 auto 1rem auto; display:flex; align-items:center; justify-content:center; border:2px solid var(--gold); font-size:1.5rem; color:var(--gold);">
                        ${m.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="text-h" style="font-size:1.1rem;">${m.name}</div>
                    <div class="text-sm text-muted mb-3">${m.role || t('team_role_default')}</div>
                    <div class="text-xs text-muted mb-3">${m.email}</div>
                    
                    <button class="btn btn-sm btn-block" style="border-color:var(--danger); color:var(--danger);" onclick="event.stopPropagation(); deleteMember('${doc.id}')">${t('team_remove')}</button>
                </div>
            `;
        });
        list.innerHTML = html;

    } catch (e) {
        console.error(e);
        list.innerHTML = `<div class="text-danger">${t('team_error_loading')}</div>`;
    }
}

window.openAddMemberModal = (id = null, m = null) => {
    const host = document.getElementById('team-modal-container');
    host.innerHTML = `
        <div class="crm-modal-overlay" onclick="document.getElementById('team-modal-container').innerHTML=''">
            <div class="crm-modal-content" style="max-width:400px;" onclick="event.stopPropagation()">
                <div class="crm-modal-header">
                    <div class="text-h">${id ? 'Edit Team Member' : t('team_add_title')}</div>
                    <button class="icon-btn" onclick="document.getElementById('team-modal-container').innerHTML=''"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body">
                    <div class="form-group">
                        <label class="form-label" for="tm-name">${t('team_full_name')}</label>
                        <input type="text" id="tm-name" class="form-input" placeholder="e.g. John Doe" value="${m?.name || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="tm-email">${t('team_email')}</label>
                        <input type="email" id="tm-email" class="form-input" placeholder="john@quasar.com" value="${m?.email || ''}">
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <div class="form-group">
                            <label class="form-label" for="tm-role">${t('team_role')}</label>
                            <select id="tm-role" class="form-input" style="background:var(--bg-dark); color:white;">
                                <option value="Sales Representative" ${m?.role === 'Sales Representative' ? 'selected' : ''}>${t('team_role_default')}</option>
                                <option value="Sales Manager" ${m?.role === 'Sales Manager' ? 'selected' : ''}>${t('team_role_manager')}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Voice PIN</label>
                            <input type="text" id="tm-pin" class="form-input" placeholder="1234" maxlength="6" value="${m?.voicePin || ''}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Voice Phone (E.164)</label>
                        <input type="text" id="tm-phone" class="form-input" placeholder="+1514..." value="${m?.voicePhone || ''}">
                        <div class="text-xs text-muted mt-1">Used for AI recognition when calling.</div>
                    </div>
                    <button class="btn btn-primary btn-block mt-3" onclick="saveMember('${id || ''}')">${id ? 'Save Changes' : t('team_add_member')}</button>
                </div>
            </div>
        </div>
    `;
};

window.openEditMemberModal = async (id) => {
    // We already have some logic to render list, but let's fetch fresh doc
    const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const snap = await getDoc(doc(db, "team", id));
    if (snap.exists()) {
        window.openAddMemberModal(id, snap.data());
    }
};

window.saveMember = async (id) => {
    const name = document.getElementById('tm-name').value;
    const email = document.getElementById('tm-email').value;
    const role = document.getElementById('tm-role').value;
    const voicePin = document.getElementById('tm-pin').value;
    const voicePhone = document.getElementById('tm-phone').value;

    if (!name || !email) {
        alert(t('team_fill_required'));
        return;
    }

    try {
        const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const data = {
            name, email, role, voicePin, voicePhone,
            updated_at: new Date().toISOString()
        };

        if (id) {
            await updateDoc(doc(db, "team", id), data);
        } else {
            data.created_at = new Date().toISOString();
            await addDoc(collection(db, "team"), data);
        }

        document.getElementById('team-modal-container').innerHTML = ''; // Close
        renderTeamList(); // Refresh
    } catch (e) {
        console.error(e);
        alert('Error saving member: ' + e.message);
    }
};

window.saveNewMember = () => window.saveMember();

window.deleteMember = async (id) => {
    if (await erpConfirm(t('team_remove_confirm'))) {
        await deleteDoc(doc(db, "team", id));
        renderTeamList();
    }
};

// Helper for Leads Module to fetch team for dropdown
export async function getTeamDropdownOptions(selectedId = null) {
    const snap = await getDocs(collection(db, "team"));
    if (snap.empty) return `<option value="">${t('team_no_members_found')}</option>`;

    let options = `<option value="">${t('team_select_agent')}</option>`;
    snap.forEach(doc => {
        const m = doc.data();
        const selected = selectedId === doc.id ? 'selected' : '';
        options += `<option value="${doc.id}" ${selected}>${m.name}</option>`;
    });
    return options;
}
