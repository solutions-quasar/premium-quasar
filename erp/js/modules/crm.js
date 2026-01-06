import { db } from '../firebase-config.js';
import { collection, query, orderBy, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- INIT ---
export async function initCRM() {
    console.log('Initializing CRM...');
    const container = document.getElementById('view-crm');
    container.innerHTML = `
        <div class="form-group" style="padding-bottom: 0.5rem;">
            <input type="text" id="crm-search" class="form-input" placeholder="Search clients...">
        </div>
        <div id="client-list">
            <div class="text-center text-muted" style="padding: 2rem;">Loading clients...</div>
        </div>
        <!-- Modal Container for CRM -->
        <div id="crm-modal-host"></div>
    `;

    loadClients();

    // Search listener (Fuzzy)
    document.getElementById('crm-search').addEventListener('input', (e) => handleSearch(e));
}

// ... (Levenshtein function remains same or can be collapsed) ...
function getLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}

function handleSearch(e) {
    const term = e.target.value.toLowerCase().trim();
    const items = document.querySelectorAll('.client-item');
    items.forEach(item => {
        if (term.length === 0) {
            item.style.display = 'flex';
            return;
        }
        const text = item.innerText.toLowerCase();
        // Exact
        if (text.includes(term)) {
            item.style.display = 'flex';
            return;
        }
        // Fuzzy
        const words = text.split(/[\s•]+/);
        const isMatch = words.some(word => {
            if (Math.abs(word.length - term.length) > 3) return false;
            const maxDist = term.length > 4 ? 2 : 1;
            return getLevenshteinDistance(term, word) <= maxDist;
        });
        item.style.display = isMatch ? 'flex' : 'none';
    });
}

// --- RENDER LOGIC ---

async function loadClients() {
    try {
        const q = query(collection(db, "clients"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const listContainer = document.getElementById('client-list');

        if (querySnapshot.empty) {
            listContainer.innerHTML = '<div class="text-center text-muted" style="padding: 2rem;">No clients found. Use the menu to Seed Data.</div>';
            return;
        }

        let html = '';
        querySnapshot.forEach((doc) => {
            const client = doc.data();
            const clientJson = encodeURIComponent(JSON.stringify({ ...client, id: doc.id }));

            html += `
                <div class="card client-item" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="openCRMDetail('${clientJson}')">
                    <div style="display:flex; align-items:center; gap: 15px;">
                        <div class="avatar" style="width:40px; height:40px; border-radius:50%; background:var(--bg-card-hover); color:var(--text-main); display:flex; align-items:center; justify-content:center; font-weight:bold;">
                            ${client.name.charAt(0)}
                        </div>
                        <div>
                            <div class="text-h" style="font-size:1rem; margin:0;">${client.name}</div>
                            <div class="text-sm text-muted">${client.company} • ${client.email || 'No Email'}</div>
                        </div>
                    </div>
                    <div class="text-gold text-sm font-bold">
                        ${client.status || 'Active'}
                    </div>
                </div>
            `;
        });
        listContainer.innerHTML = html;

    } catch (e) {
        console.error("Error loading clients: ", e);
    }
}

// --- MODAL LOGIC ---

window.openCRMDetail = (json) => {
    const client = JSON.parse(decodeURIComponent(json));
    const host = document.getElementById('crm-modal-host');

    host.innerHTML = `
        <div class="crm-modal-overlay" onclick="closeCRMDetail(event)">
            <div class="crm-modal-content" onclick="event.stopPropagation()">
                <div class="crm-modal-header">
                    <div class="text-h">${client.name}</div>
                    <button class="icon-btn" onclick="document.getElementById('crm-modal-host').innerHTML=''"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body">
                    <div class="form-group">
                        <label class="form-label">Company</label>
                        <input type="text" class="form-input" value="${client.company || ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-input" value="${client.email || ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Phone</label>
                        <input type="text" class="form-input" value="${client.phone || ''}" readonly>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <select class="form-input">
                            <option ${client.status === 'Active' ? 'selected' : ''}>Active</option>
                            <option ${client.status === 'Lead' ? 'selected' : ''}>Lead</option>
                            <option ${client.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
                        </select>
                    </div>
                    <div style="margin-top:1rem; display:flex; gap:10px;">
                        <button class="btn btn-primary btn-block">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    `;
};

window.closeCRMDetail = (e) => {
    document.getElementById('crm-modal-host').innerHTML = '';
};

export async function addClient(clientData) {
    try {
        await addDoc(collection(db, "clients"), {
            ...clientData,
            createdAt: new Date().toISOString()
        });
        loadClients(); // Reload list
        return true;
    } catch (e) {
        console.error("Error adding client: ", e);
        return false;
    }
}
