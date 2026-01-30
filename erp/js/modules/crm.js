import { db } from '../firebase-config.js';
import { collection, query, orderBy, getDocs, addDoc, where, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

window.openCRMDetail = async (json) => {
    const client = JSON.parse(decodeURIComponent(json));
    const host = document.getElementById('crm-modal-host');

    // Show loading state first
    host.innerHTML = `
        <div style="position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center;">
            <div class="text-gold">Loading...</div>
        </div>
    `;

    // Fetch Financials
    const [quotes, invoices] = await Promise.all([
        fetchClientDocs('quotes', client.name),
        fetchClientDocs('invoices', client.name)
    ]);

    const totalRevenue = invoices
        .filter(inv => inv.status === 'Paid')
        .reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);

    host.innerHTML = `
        <div style="position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.8); display: flex; flex-direction: column;">
            <div style="width: 100%; height: 100%; background: var(--bg-body); display: flex; flex-direction: column; overflow: hidden;" onclick="event.stopPropagation()">
                
                <!-- HEADER -->
                <div style="flex: 0 0 auto; padding: 1rem 2rem; border-bottom: 1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:var(--bg-body);">
                    <div style="display:flex; align-items:center; gap:15px;">
                        <div class="avatar" style="width:40px; height:40px; border-radius:50%; background:var(--gold); color:black; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:1.2rem;">
                            ${client.name.charAt(0)}
                        </div>
                        <div>
                            <div class="text-h" style="font-size:1.2rem; margin:0;">${client.name}</div>
                            <div class="text-xs text-muted">ID: ${client.id}</div>
                        </div>
                    </div>
                    <button class="icon-btn" onclick="document.getElementById('crm-modal-host').innerHTML=''"><span class="material-icons">close</span></button>
                </div>

                <!-- BODY -->
                <div style="flex: 1; min-height: 0; overflow-y: auto; padding: 2rem; display: flex; flex-direction: column; gap: 30px;">
                    
                    <!-- Top Summary Stats -->
                     <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:20px;">
                        <div class="card" style="text-align:center; padding:1.5rem;">
                            <div class="text-muted text-xs uppercase">Lifetime Revenue</div>
                            <div class="text-gold text-h" style="font-size:1.5rem;">$${totalRevenue.toFixed(2)}</div>
                        </div>
                        <div class="card" style="text-align:center; padding:1.5rem;">
                            <div class="text-muted text-xs uppercase">Total Invoices</div>
                            <div class="text-white text-h" style="font-size:1.5rem;">${invoices.length}</div>
                        </div>
                        <div class="card" style="text-align:center; padding:1.5rem;">
                            <div class="text-muted text-xs uppercase">Total Quotes</div>
                            <div class="text-white text-h" style="font-size:1.5rem;">${quotes.length}</div>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 2fr; gap:30px; align-items:start;">
                        
                        <!-- LEFT COL: Info -->
                        <div class="card" style="padding:2rem;">
                            <h3 class="text-gold" style="margin-top:0; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:20px;">Company Info</h3>
                            
                            <div class="form-group">
                                <label class="form-label">Company Name</label>
                                <input type="text" id="edit-company" class="form-input" value="${client.company || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Email</label>
                                <input type="email" id="edit-email" class="form-input" value="${client.email || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Phone</label>
                                <input type="text" id="edit-phone" class="form-input" value="${client.phone || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Address</label>
                                <input type="text" id="edit-address" class="form-input" value="${client.address || ''}" placeholder="Street Address">
                            </div>
                            <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; gap:10px;">
                                <div class="form-group">
                                    <label class="form-label">City</label>
                                    <input type="text" id="edit-city" class="form-input" value="${client.city || ''}" placeholder="City">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">State</label>
                                    <input type="text" id="edit-state" class="form-input" value="${client.state || ''}" placeholder="State">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Zip</label>
                                    <input type="text" id="edit-zip" class="form-input" value="${client.zip || ''}" placeholder="Zip">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Status</label>
                                <select id="edit-status" class="form-input">
                                    <option value="Active" ${client.status === 'Active' ? 'selected' : ''}>Active</option>
                                    <option value="Lead" ${client.status === 'Lead' ? 'selected' : ''}>Lead</option>
                                    <option value="Inactive" ${client.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
                                </select>
                            </div>

                             <button class="btn btn-primary btn-block" style="margin-top:20px;" onclick="saveClientChanges('${client.id}')">
                                Save Changes
                            </button>
                        </div>

                        <!-- RIGHT COL: Financials -->
                        <div style="display:flex; flex-direction:column; gap:20px;">
                            
                            <!-- Invoices List -->
                            <div class="card" style="padding:0; overflow:hidden;">
                                <div style="padding:15px 20px; background:rgba(255,255,255,0.03); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                                    <div class="text-h" style="font-size:1rem;">Invoices</div>
                                    <span class="text-muted text-xs">${invoices.length} found</span>
                                </div>
                                <div style="max-height:300px; overflow-y:auto;">
                                    ${invoices.length > 0 ? invoices.map(inv => `
                                        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 20px; border-bottom:1px solid var(--border);">
                                            <div>
                                                <div style="font-weight:bold;">#${inv.number}</div>
                                                <div class="text-xs text-muted">${new Date(inv.createdAt).toLocaleDateString()}</div>
                                            </div>
                                            <div style="text-align:right;">
                                                <div class="text-gold">$${parseFloat(inv.total).toFixed(2)}</div>
                                                <span class="badge-status status-${inv.status.toLowerCase()}" style="font-size:10px; padding:2px 6px;">${inv.status}</span>
                                            </div>
                                        </div>
                                    `).join('') : '<div style="padding:20px; text-align:center; color:var(--text-muted);">No invoices found</div>'}
                                </div>
                            </div>

                            <!-- Quotes List -->
                            <div class="card" style="padding:0; overflow:hidden;">
                                <div style="padding:15px 20px; background:rgba(255,255,255,0.03); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                                    <div class="text-h" style="font-size:1rem;">Quotes</div>
                                    <span class="text-muted text-xs">${quotes.length} found</span>
                                </div>
                                <div style="max-height:300px; overflow-y:auto;">
                                    ${quotes.length > 0 ? quotes.map(q => `
                                        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 20px; border-bottom:1px solid var(--border);">
                                            <div>
                                                <div style="font-weight:bold;">#${q.number}</div>
                                                <div class="text-xs text-muted">${new Date(q.createdAt).toLocaleDateString()}</div>
                                            </div>
                                            <div style="text-align:right;">
                                                <div class="text-gold">$${parseFloat(q.total).toFixed(2)}</div>
                                                <span class="badge-status status-${q.status.toLowerCase()}" style="font-size:10px; padding:2px 6px;">${q.status}</span>
                                            </div>
                                        </div>
                                    `).join('') : '<div style="padding:20px; text-align:center; color:var(--text-muted);">No quotes found</div>'}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                <!-- FOOTER -->
                <div style="flex: 0 0 auto; padding: 1rem 2rem; border-top: 1px solid var(--border); background: var(--bg-card); text-align:right;">
                     <button class="btn btn-sm" onclick="document.getElementById('crm-modal-host').innerHTML=''">Close</button>
                </div>
            </div>
        </div>
    `;
};

async function fetchClientDocs(collectionName, clientName) {
    if (!clientName) return [];
    try {
        const q = query(collection(db, collectionName), where("clientName", "==", clientName), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const docs = [];
        snap.forEach(d => docs.push({ ...d.data(), id: d.id }));
        return docs;
    } catch (e) {
        console.error(`Error fetching ${collectionName}:`, e);
        // Fallback if index missing or error
        return [];
    }
}

window.saveClientChanges = async (id) => {
    const company = document.getElementById('edit-company').value;
    const email = document.getElementById('edit-email').value;
    const phone = document.getElementById('edit-phone').value;
    const address = document.getElementById('edit-address').value;
    const city = document.getElementById('edit-city').value;
    const state = document.getElementById('edit-state').value;
    const zip = document.getElementById('edit-zip').value;
    const status = document.getElementById('edit-status').value;

    try {
        await updateDoc(doc(db, "clients", id), {
            company, email, phone, address, city, state, zip, status,
            updatedAt: new Date().toISOString()
        });
        window.showToast("Client updated successfully", "success");
        loadClients(); // Refresh background list

        // Optional: Close modal or visual feedback on button
    } catch (e) {
        console.error("Error updating client:", e);
        window.showToast("Error updating client", "error");
    }
}

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
