import { db } from '../firebase-config.js';
import { collection, query, orderBy, getDocs, addDoc, where, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { t } from '../services/translationService.js';

// --- INIT ---
export async function initCRM() {
    console.log('Initializing CRM...');
    const container = document.getElementById('view-crm');
    if (!container) return;

    container.innerHTML = `
        <div class="view-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
            <div>
                <div class="text-h text-gold" style="font-size: 1.5rem; display:flex; align-items:center; gap:10px;">
                    <span class="material-icons" style="font-size: 1.8rem;">groups</span> 
                    <span data-i18n="crm_title">${t('crm_title')}</span>
                </div>
                <div class="text-sm text-muted">Manage your client relationships and financials.</div>
            </div>
            <button class="btn btn-primary" id="btn-add-client" style="display:flex; align-items:center; gap:5px; flex-shrink:0;">
                <span class="material-icons">person_add</span> <span data-i18n="crm_new_client">${t('crm_new_client')}</span>
            </button>
        </div>

        <div class="form-group" style="margin-bottom: 1.5rem;">
            <div style="position:relative;">
                <input type="text" id="crm-search" class="form-input" placeholder="${t('crm_search_placeholder')}" style="padding-left: 40px;">
                <span class="material-icons text-muted" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:20px;">search</span>
            </div>
        </div>

        <div id="client-list" class="crm-grid" style="display: flex; flex-direction: column; gap: 10px;">
            <div class="text-center text-muted" style="padding: 2rem;">
                <span class="material-icons rotating" style="color:var(--gold);">refresh</span>
                <p>${t('crm_loading')}</p>
            </div>
        </div>
        
        <!-- Modal Container for CRM -->
        <div id="crm-modal-host"></div>
    `;

    loadClients();

    // Event Listeners
    document.getElementById('crm-search').addEventListener('input', (e) => handleSearch(e));
    document.getElementById('btn-add-client').addEventListener('click', () => openNewClientModal());
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
        if (!listContainer) return;

        if (querySnapshot.empty) {
            listContainer.innerHTML = `
                <div class="card p-5 text-center border-dashed" style="opacity: 0.6; border-color: var(--border);">
                    <span class="material-icons text-muted" style="font-size: 3rem; margin-bottom: 1rem;">person_off</span>
                    <div class="text-h text-muted">${t('crm_no_clients')}</div>
                </div>`;
            return;
        }

        listContainer.innerHTML = '';
        querySnapshot.forEach((docSnap) => {
            const client = docSnap.data();
            const clientJson = encodeURIComponent(JSON.stringify({ ...client, id: docSnap.id }));

            const card = document.createElement('div');
            card.className = 'card client-item clickable';
            card.style.cssText = `display:flex; justify-content:space-between; align-items:center; padding: 1rem 1.5rem; transition: transform 0.2s;`;
            card.onclick = () => openCRMDetail(clientJson);
            card.onmouseover = () => { card.style.transform = 'translateX(5px)'; card.style.background = 'var(--bg-card-hover)'; };
            card.onmouseout = () => { card.style.transform = 'translateX(0)'; card.style.background = 'var(--bg-card)'; };

            card.innerHTML = `
                <div style="display:flex; align-items:center; gap: 15px;">
                    <div class="avatar" style="width:42px; height:42px; border-radius:50%; background:rgba(223, 165, 58, 0.1); color:var(--gold); display:flex; align-items:center; justify-content:center; font-weight:bold; border: 1px solid rgba(223, 165, 58, 0.2);">
                        ${(client.name || '?').charAt(0)}
                    </div>
                    <div>
                        <div class="text-h" style="font-size:1rem; margin:0; color:var(--text-main); font-weight:600;">${client.name}</div>
                        <div class="text-sm text-muted">${client.company} <span style="opacity:0.5; margin: 0 4px;">•</span> ${client.email || t('crm_no_email')}</div>
                    </div>
                </div>
                <div class="badge ${client.status === 'Active' ? 'badge-gold' : (client.status === 'Lead' ? 'badge-blue' : 'badge-grey')}" style="padding: 4px 12px; font-size: 11px;">
                    ${client.status === 'Active' ? t('crm_status_active') : (client.status === 'Lead' ? t('crm_status_prospect') : (client.status === 'Inactive' ? t('crm_status_inactive') : client.status))}
                </div>
            `;
            listContainer.appendChild(card);
        });

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
        <div class="crm-modal-overlay" style="z-index: 10000; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
            <div class="text-gold" style="display:flex; align-items:center; gap:10px;">
                <span class="material-icons rotating">refresh</span> ${t('btn_loading')}
            </div>
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
        <div class="crm-modal-overlay" style="z-index: 10000; background: rgba(0,0,0,0.85); display: flex; flex-direction: column; backdrop-filter: blur(4px);" onclick="if(event.target === this) document.getElementById('crm-modal-host').innerHTML=''">
            <div style="width: 100%; height: 100%; background: var(--bg-dark); display: flex; flex-direction: column; overflow: hidden;" onclick="event.stopPropagation()">
                
                <!-- HEADER -->
                <div style="flex: 0 0 auto; padding: 1.5rem 2.5rem; border-bottom: 1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:var(--bg-card);">
                    <div style="display:flex; align-items:center; gap:20px;">
                        <div class="avatar" style="width:50px; height:50px; border-radius:12px; background:var(--gold); color:black; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:1.4rem; box-shadow: 0 4px 15px rgba(223, 165, 58, 0.3);">
                            ${(client.name || '?').charAt(0)}
                        </div>
                        <div>
                            <h2 class="text-h" style="font-size:1.5rem; margin:0; color:var(--text-main);">${client.name}</h2>
                            <div class="text-xs text-muted font-mono" style="opacity:0.6;">UUID: ${client.id}</div>
                        </div>
                    </div>
                    <button class="icon-btn" onclick="document.getElementById('crm-modal-host').innerHTML=''"><span class="material-icons">close</span></button>
                </div>

                <!-- BODY -->
                <div style="flex: 1; min-height: 0; overflow-y: auto; padding: 2.5rem; display: flex; flex-direction: column; gap: 30px;">
                    
                    <!-- Top Summary Stats -->
                     <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:25px;">
                        <div class="card" style="text-align:center; padding:1.8rem; background: linear-gradient(135deg, rgba(223, 165, 58, 0.05), transparent); border: 1px solid rgba(223, 165, 58, 0.1);">
                            <div class="text-muted text-xs uppercase tracking-widest mb-1">${t('crm_lifetime_revenue')}</div>
                            <div class="text-gold text-h" style="font-size:2rem;">$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div class="card" style="text-align:center; padding:1.8rem; background: rgba(255,255,255,0.02);">
                            <div class="text-muted text-xs uppercase tracking-widest mb-1">${t('crm_total_invoices')}</div>
                            <div class="text-white text-h" style="font-size:2rem;">${invoices.length}</div>
                        </div>
                        <div class="card" style="text-align:center; padding:1.8rem; background: rgba(255,255,255,0.02);">
                            <div class="text-muted text-xs uppercase tracking-widest mb-1">${t('crm_total_quotes')}</div>
                            <div class="text-white text-h" style="font-size:2rem;">${quotes.length}</div>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 2fr; gap:40px; align-items:start;">
                        
                        <!-- LEFT COL: Info -->
                        <div class="card" style="padding:2rem; background: rgba(255,255,255,0.015);">
                            <div class="text-gold font-bold mb-4" style="display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--border); padding-bottom:12px; font-size: 1.1rem;">
                                <span class="material-icons" style="font-size:20px;">contact_page</span> ${t('crm_company_info')}
                            </div>
                            
                            <div class="form-group mb-4">
                                <label class="form-label text-xs uppercase text-muted tracking-wider">${t('crm_name')}</label>
                                <input type="text" id="edit-name" class="form-input" value="${client.name || ''}" placeholder="Full Name">
                            </div>

                            <div class="form-group mb-4">
                                <label class="form-label text-xs uppercase text-muted tracking-wider">${t('crm_company_name')}</label>
                                <input type="text" id="edit-company" class="form-input" value="${client.company || ''}" placeholder="Company Name">
                            </div>
                            <div class="form-group mb-4">
                                <label class="form-label text-xs uppercase text-muted tracking-wider">${t('crm_email')}</label>
                                <input type="email" id="edit-email" class="form-input" value="${client.email || ''}" placeholder="email@example.com">
                            </div>
                            <div class="form-group mb-4">
                                <label class="form-label text-xs uppercase text-muted tracking-wider">${t('crm_phone')}</label>
                                <input type="text" id="edit-phone" class="form-input" value="${client.phone || ''}" placeholder="+1...">
                            </div>
                            <div class="form-group mb-4">
                                <label class="form-label text-xs uppercase text-muted tracking-wider">${t('crm_address')}</label>
                                <input type="text" id="edit-address" class="form-input" value="${client.address || ''}" placeholder="Street Address">
                            </div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;" class="mb-4">
                                <div class="form-group">
                                    <label class="form-label text-xs uppercase text-muted tracking-wider">${t('crm_city')}</label>
                                    <input type="text" id="edit-city" class="form-input" value="${client.city || ''}">
                                </div>
                                <div class="form-group">
                                    <label class="form-label text-xs uppercase text-muted tracking-wider">${t('crm_state')}</label>
                                    <input type="text" id="edit-state" class="form-input" value="${client.state || ''}">
                                </div>
                            </div>
                            <div class="form-group mb-4">
                                <label class="form-label text-xs uppercase text-muted tracking-wider">Status</label>
                                <select id="edit-status" class="form-input" style="background:var(--bg-dark); border:1px solid var(--border); color:var(--text-main);">
                                    <option value="Active" ${client.status === 'Active' ? 'selected' : ''}>${t('crm_status_active')}</option>
                                    <option value="Lead" ${client.status === 'Lead' ? 'selected' : ''}>${t('crm_status_prospect')}</option>
                                    <option value="Inactive" ${client.status === 'Inactive' ? 'selected' : ''}>${t('crm_status_inactive')}</option>
                                </select>
                            </div>

                             <button class="btn btn-primary btn-block" style="margin-top:20px; font-weight:bold; letter-spacing:1px;" id="btn-save-client" onclick="saveClientChanges('${client.id}')">
                                <span class="material-icons" style="font-size:18px;">save</span> ${t('btn_save').toUpperCase()}
                            </button>
                        </div>

                        <!-- RIGHT COL: Financials -->
                        <div style="display:flex; flex-direction:column; gap:30px;">
                            
                            <!-- Invoices List -->
                            <div class="card" style="padding:0; overflow:hidden; border: 1px solid var(--border);">
                                <div style="padding:15px 25px; background:rgba(255,255,255,0.03); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                                    <div class="text-h" style="font-size:1.1rem; display:flex; align-items:center; gap:8px;">
                                        <span class="material-icons text-gold" style="font-size:20px;">receipt</span> ${t('crm_invoices')}
                                    </div>
                                    <span class="badge badge-grey" style="font-size:10px;">${invoices.length} ${t('crm_found')}</span>
                                </div>
                                <div style="max-height:350px; overflow-y:auto; background: rgba(0,0,0,0.1);">
                                    ${invoices.length > 0 ? invoices.map(inv => `
                                        <div style="display:flex; justify-content:space-between; align-items:center; padding:15px 25px; border-bottom:1px solid var(--border); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                                            <div>
                                                <div style="font-weight:bold; color:var(--text-main);">#${inv.number}</div>
                                                <div class="text-xs text-muted">${new Date(inv.createdAt).toLocaleDateString()}</div>
                                            </div>
                                            <div style="text-align:right;">
                                                <div class="text-gold font-bold" style="font-size:1.1rem;">$${parseFloat(inv.total).toFixed(2)}</div>
                                                <span class="badge-status status-${inv.status.toLowerCase()}" style="font-size:9px; padding:2px 8px; border-radius:4px;">${inv.status}</span>
                                            </div>
                                        </div>
                                    `).join('') : `<div style="padding:40px; text-align:center; color:var(--text-muted); font-style:italic;">${t('crm_no_invoices')}</div>`}
                                </div>
                            </div>

                            <!-- Quotes List -->
                            <div class="card" style="padding:0; overflow:hidden; border: 1px solid var(--border);">
                                <div style="padding:15px 25px; background:rgba(255,255,255,0.03); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                                    <div class="text-h" style="font-size:1.1rem; display:flex; align-items:center; gap:8px;">
                                        <span class="material-icons text-info" style="font-size:20px;">description</span> ${t('crm_quotes')}
                                    </div>
                                    <span class="badge badge-grey" style="font-size:10px;">${quotes.length} ${t('crm_found')}</span>
                                </div>
                                <div style="max-height:350px; overflow-y:auto; background: rgba(0,0,0,0.1);">
                                    ${quotes.length > 0 ? quotes.map(q => `
                                        <div style="display:flex; justify-content:space-between; align-items:center; padding:15px 25px; border-bottom:1px solid var(--border); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                                            <div>
                                                <div style="font-weight:bold; color:var(--text-main);">#${q.number}</div>
                                                <div class="text-xs text-muted">${new Date(q.createdAt).toLocaleDateString()}</div>
                                            </div>
                                            <div style="text-align:right;">
                                                <div class="text-gold font-bold" style="font-size:1.1rem;">$${parseFloat(q.total).toFixed(2)}</div>
                                                <span class="badge-status status-${q.status.toLowerCase()}" style="font-size:9px; padding:2px 8px; border-radius:4px;">${q.status}</span>
                                            </div>
                                        </div>
                                    `).join('') : `<div style="padding:40px; text-align:center; color:var(--text-muted); font-style:italic;">${t('crm_no_quotes')}</div>`}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                <!-- FOOTER -->
                <div style="flex: 0 0 auto; padding: 1.5rem 2.5rem; border-top: 1px solid var(--border); background: var(--bg-card); text-align:right;">
                     <button class="btn btn-secondary" style="padding: 10px 25px;" onclick="document.getElementById('crm-modal-host').innerHTML=''">${t('btn_cancel')}</button>
                </div>
            </div>
        </div>
    `;
};

window.openNewClientModal = () => {
    const host = document.getElementById('crm-modal-host');
    host.innerHTML = `
        <div class="crm-modal-overlay" style="z-index: 10000; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);" onclick="if(event.target === this) document.getElementById('crm-modal-host').innerHTML=''">
            <div class="card" style="width: 500px; max-width: 95vw; background: var(--bg-dark); padding: 0; box-shadow: 0 25px 50px rgba(0,0,0,0.5); overflow: hidden;" onclick="event.stopPropagation()">
                <div style="padding: 20px 25px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: var(--bg-card);">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="material-icons text-gold">person_add</span>
                        <h2 class="text-h" style="margin:0; font-size:1.2rem;">${t('crm_new_client')}</h2>
                    </div>
                    <button class="icon-btn" onclick="document.getElementById('crm-modal-host').innerHTML=''"><span class="material-icons">close</span></button>
                </div>

                <form id="new-client-form" onsubmit="handleNewClientSubmit(event)" style="padding: 25px; display: flex; flex-direction: column; gap: 15px;">
                    <div class="form-group">
                        <label class="form-label text-xs uppercase text-muted tracking-wider">${t('crm_name')} *</label>
                        <input type="text" id="new-client-name" class="form-input" required placeholder="John Doe">
                    </div>
                    <div class="form-group">
                        <label class="form-label text-xs uppercase text-muted tracking-wider">${t('crm_company_name')} *</label>
                        <input type="text" id="new-client-company" class="form-input" required placeholder="Acme Inc.">
                    </div>
                    <div class="form-group">
                        <label class="form-label text-xs uppercase text-muted tracking-wider">${t('crm_email')}</label>
                        <input type="email" id="new-client-email" class="form-input" placeholder="john@example.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label text-xs uppercase text-muted tracking-wider">${t('crm_phone')}</label>
                        <input type="text" id="new-client-phone" class="form-input" placeholder="+1...">
                    </div>
                    <div class="form-group">
                        <label class="form-label text-xs uppercase text-muted tracking-wider">Initial Status</label>
                        <select id="new-client-status" class="form-input" style="background:var(--bg-dark); border:1px solid var(--border); color:var(--text-main);">
                            <option value="Lead">${t('crm_status_prospect')}</option>
                            <option value="Active">${t('crm_status_active')}</option>
                        </select>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px;">
                        <button type="button" class="btn btn-secondary" onclick="document.getElementById('crm-modal-host').innerHTML=''">Cancel</button>
                        <button type="submit" class="btn btn-primary" id="btn-save-new-client">
                            <span class="material-icons" style="font-size:18px;">check</span> Create Client
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
};

window.handleNewClientSubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-client-name').value;
    const company = document.getElementById('new-client-company').value;
    const email = document.getElementById('new-client-email').value;
    const phone = document.getElementById('new-client-phone').value;
    const status = document.getElementById('new-client-status').value;

    const btn = document.getElementById('btn-save-new-client');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons rotating">refresh</span> Creating...';

    try {
        await addDoc(collection(db, "clients"), {
            name, company, email, phone, status,
            createdAt: new Date().toISOString()
        });
        window.showToast(t('crm_add_success'), "success");
        document.getElementById('crm-modal-host').innerHTML = '';
        loadClients();
    } catch (error) {
        console.error("Error creating client:", error);
        window.showToast(t('crm_add_error'), "error");
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons">check</span> Create Client';
    }
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
        return [];
    }
}

window.saveClientChanges = async (id) => {
    const name = document.getElementById('edit-name').value;
    const company = document.getElementById('edit-company').value;
    const email = document.getElementById('edit-email').value;
    const phone = document.getElementById('edit-phone').value;
    const address = document.getElementById('edit-address').value;
    const city = document.getElementById('edit-city').value;
    const state = document.getElementById('edit-state').value;
    const status = document.getElementById('edit-status').value;

    const btn = document.getElementById('btn-save-client');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons rotating">refresh</span> SAVING...';

    try {
        await updateDoc(doc(db, "clients", id), {
            name, company, email, phone, address, city, state, status,
            updatedAt: new Date().toISOString()
        });
        window.showToast(t('crm_save_success'), "success");
        loadClients();
        document.getElementById('crm-modal-host').innerHTML = '';
    } catch (e) {
        console.error("Error updating client:", e);
        window.showToast(t('crm_save_error'), "error");
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

export async function addClient(clientData) {
    try {
        await addDoc(collection(db, "clients"), {
            ...clientData,
            createdAt: new Date().toISOString()
        });
        loadClients();
        return true;
    } catch (e) {
        console.error("Error adding client: ", e);
        return false;
    }
}
