import { db, auth } from '../firebase-config.js';
import { collection, query, where, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, addDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { t } from '../services/translationService.js';
import { erpConfirm } from '../services/uiService.js';

// Global State
let currentTab = 'quotes'; // 'quotes' | 'invoices'

const API_BASE = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : '';

// --- INIT ---
export async function initSales() {
    console.log('Initializing Sales Module...');
    const container = document.getElementById('view-sales');

    // Inject local styles if not exists
    if (!document.getElementById('sales-styles')) {
        const style = document.createElement('style');
        style.id = 'sales-styles';
        style.innerHTML = `
            .tab-btn {
                background: transparent;
                border: none;
                color: var(--text-muted);
                padding: 10px 20px;
                cursor: pointer;
                font-size: 1rem;
                border-bottom: 2px solid transparent;
                transition: all 0.3s;
                font-weight: 500;
            }
            .tab-btn:hover { color: var(--text-main); }
            .tab-btn.active {
                color: var(--gold);
                border-bottom-color: var(--gold);
            }
            .sales-item {
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                padding: 1.2rem;
                border-bottom: 1px solid var(--border);
                background: var(--bg-card);
                cursor: pointer;
                transition: all 0.2s;
            }
            .sales-item:first-child { border-top-left-radius: 12px; border-top-right-radius: 12px; }
            .sales-item:last-child { border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; border-bottom: none; }
            .sales-item:hover {
                background: var(--bg-card-hover);
                padding-left: 1.5rem; /* Slide effect */
            }
            .badge-status {
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 0.75rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .status-draft { background: rgba(255, 255, 255, 0.1); color: var(--text-muted); }
            .status-sent { background: rgba(49, 204, 236, 0.15); color: var(--info); }
            .status-accepted { background: rgba(33, 186, 69, 0.15); color: var(--success); }
            .status-paid { background: rgba(33, 186, 69, 0.25); color: #21BA45; border: 1px solid #21BA45; }
            .status-rejected { background: rgba(193, 0, 21, 0.15); color: var(--danger); }
            
            /* PDF Preview Styles */
            .pdf-preview-container {
                background: white; 
                color: black; 
                padding: 40px; 
                font-family: 'Helvetica', sans-serif;
                margin: 0 auto;
                max-width: 800px;
                box-shadow: 0 0 50px rgba(0,0,0,0.5);
            }
        `;
        document.head.appendChild(style);
    }

    container.innerHTML = `
        <div class="top-actions" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
            <div class="text-h text-gold" style="font-size: 1.5rem; display:flex; align-items:center; gap:10px;">
                <span class="material-icons" style="font-size: 1.8rem;">receipt_long</span> <span data-i18n="sales_title">Sales & Billing</span>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn btn-primary" onclick="openSalesEditor('new')" style="display:flex; align-items:center; gap:5px;">
                    <span class="material-icons">add</span> ${t('sales_new_quote')}
                </button>
            </div>
        </div>

        <div class="tabs-container" style="display:flex; gap:1rem; margin-bottom:1.5rem; border-bottom: 1px solid var(--border);">
            <button class="tab-btn ${currentTab === 'quotes' ? 'active' : ''}" id="tab-quotes" onclick="switchSalesTab('quotes')">${t('sales_quotes')}</button>
            <button class="tab-btn ${currentTab === 'invoices' ? 'active' : ''}" id="tab-invoices" onclick="switchSalesTab('invoices')">${t('sales_invoices')}</button>
            <button class="tab-btn ${currentTab === 'settings' ? 'active' : ''}" id="tab-settings" onclick="switchSalesTab('settings')">${t('sales_settings')}</button>
        </div>

        <div id="sales-list-container">
            <div class="text-center text-muted" style="padding: 3rem;">${t('sales_loading')}</div>
        </div>

        <div id="sales-modal-host"></div>
    `;

    // Load Settings First (Async but don't block render of list)
    loadSalesSettings().then(() => {
        if (currentTab !== 'settings') loadSalesList();
        else renderSalesSettings();
    });

    // Check for payment redirect feedback
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    if (urlParams.get('payment') === 'success') {
        window.showToast("Payment Successful! Invoice updated.", "success");
        // Clear params to avoid double toast
        window.location.hash = window.location.hash.split('?')[0];
    } else if (urlParams.get('payment') === 'cancelled') {
        window.showToast("Payment cancelled.", "normal");
        window.location.hash = window.location.hash.split('?')[0];
    }
}

// Global Settings State
window.salesSettings = {
    snippets: {},
    paymentInfo: '',
    taxId: ''
};

window.switchSalesTab = (tab) => {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    if (tab === 'settings') {
        renderSalesSettings();
    } else {
        loadSalesList();
    }
}

async function loadSalesSettings() {
    try {
        const docSnap = await getDoc(doc(db, 'settings', 'sales'));
        if (docSnap.exists()) {
            window.salesSettings = docSnap.data();

            // Ensure snippets are populated if empty or missing
            // We use spread to ensure we don't overwrite if they partially exist (though simple check is better)
            // If the user has NO snippets, we load defaults.
            if (!window.salesSettings.snippets || Object.keys(window.salesSettings.snippets).length === 0) {
                window.salesSettings.snippets = { ...SALES_SNIPPETS_DEFAULT };
            }
        } else {
            // Defaults
            window.salesSettings.snippets = { ...SALES_SNIPPETS_DEFAULT };
            window.salesSettings.paymentInfo = "Please make checks payable to Premium Quasar Inc.";
        }
    } catch (e) {
        console.error("Error loading settings", e);
    }
}

function renderSalesSettings() {
    const container = document.getElementById('sales-list-container');
    container.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; max-width:1000px; margin:0 auto;">
            
            <!-- Default Settings -->
            <div class="card">
                <h3 class="text-gold" style="margin-top:0;">Invoice Defaults</h3>
                <div class="form-group">
                    <label class="form-label">Payment Instructions / Footer Text</label>
                    <textarea id="setting-payment" class="form-input" rows="4" onchange="saveSalesSettings()">${window.salesSettings.paymentInfo || ''}</textarea>
                </div>
                 <div class="form-group">
                    <label class="form-label">Tax ID / Business Number</label>
                    <input type="text" id="setting-tax" class="form-input" value="${window.salesSettings.taxId || ''}" onchange="saveSalesSettings()">
                </div>
            </div>

            <!-- Snippets Manager -->
            <div class="card" style="display: flex; flex-direction: column;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h3 class="text-gold" style="margin:0;">Snippets Library</h3>
                    <button class="btn btn-sm" onclick="addSnippet()">+ Add New</button>
                </div>
                <div id="snippets-list" style="flex: 1; max-height:500px; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
                    ${Object.entries(window.salesSettings.snippets || {}).map(([key, val]) => `
                        <div style="background:var(--bg-dark); padding:10px; border-radius:4px; border:1px solid var(--border);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                                <div style="font-weight:bold;">${key}</div>
                                <button class="text-danger icon-btn" onclick="deleteSnippet('${key}')"><span class="material-icons" style="font-size:16px;">delete</span></button>
                            </div>
                            <div style="font-size:12px; color:var(--text-muted); white-space:pre-wrap;">${val.substring(0, 100)}${val.length > 100 ? '...' : ''}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

window.saveSalesSettings = async () => {
    window.salesSettings.paymentInfo = document.getElementById('setting-payment').value;
    window.salesSettings.taxId = document.getElementById('setting-tax').value;

    try {
        await setDoc(doc(db, 'settings', 'sales'), window.salesSettings);
        window.showToast("Settings Saved", "success");
    } catch (e) {
        console.error(e);
    }
};

window.addSnippet = async () => {
    const key = prompt("Enter Snippet Title (e.g. 'Intro'):");
    if (!key) return;
    const val = prompt("Enter Snippet Content:", "...");
    if (!val) return;

    if (!window.salesSettings.snippets) window.salesSettings.snippets = {};
    window.salesSettings.snippets[key] = val;
    renderSalesSettings();
    await saveSalesSettingsFull();
}

window.deleteSnippet = async (key) => {
    if (!await erpConfirm('Delete this snippet?')) return;
    delete window.salesSettings.snippets[key];
    renderSalesSettings();
    await saveSalesSettingsFull();
}

window.saveSalesSettingsFull = async () => {
    try {
        await setDoc(doc(db, 'settings', 'sales'), window.salesSettings);
    } catch (e) { console.error(e); }
}

async function loadSalesList() {
    const listContainer = document.getElementById('sales-list-container');
    listContainer.innerHTML = `<div class="text-center text-muted" style="padding: 3rem; display:flex; flex-direction:column; align-items:center; gap:10px;"><span class="material-icons rotating">refresh</span> ${t('sales_loading')}</div>`;

    try {
        const q = query(collection(db, currentTab), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            listContainer.innerHTML = `
                <div class="text-center text-muted" style="padding: 4rem; opacity: 0.6;">
                    <span class="material-icons" style="font-size: 3rem; margin-bottom: 1rem;">description</span>
                    <br>
                    ${t('sales_no_items')}
                </div>`;
            return;
        }

        let html = '<div class="card" style="padding:0; overflow:hidden;">';
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;
            const itemJson = encodeURIComponent(JSON.stringify({ ...data, id }));

            // Format Currency
            const total = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.total || 0);
            const date = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'N/A';

            html += `
                <div class="sales-item" onclick="openSalesEditor('${itemJson}')">
                    <div style="display:flex; align-items:center; gap:15px;">
                        <div style="width:45px; height:45px; border-radius:8px; background: rgba(223, 165, 58, 0.1); color: var(--gold); display:flex; align-items:center; justify-content:center;">
                            <span class="material-icons">${currentTab === 'quotes' ? 'request_quote' : 'receipt'}</span>
                        </div>
                        <div>
                            <div class="text-h" style="font-size:1rem; margin:0;">${data.clientName || 'Unknown Client'}</div>
                            <div class="text-sm text-muted">#${data.number || id.substr(0, 6).toUpperCase()} • ${date}</div>
                        </div>
                    </div>
                    
                    <div style="text-align:right;">
                        <div class="text-gold" style="font-weight:bold; font-size:1.1rem; margin-bottom:4px;">${total}</div>
                        <span class="badge-status status-${data.status.toLowerCase()}">${data.status}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        listContainer.innerHTML = html;

    } catch (e) {
        console.error(e);
        listContainer.innerHTML = `<div class="text-danger text-center p-4">${t('sales_error_loading')}: ${e.message}</div>`;
    }
}

// --- CONSTANTS ---

const SALES_SNIPPETS_DEFAULT = {
    "Révisions": "Nombre de révisions incluses + tarif révision supplémentaire",
    "Délais & Conditions": "Délais conditionnels à la réception : logo, textes, liste de services/prix, photos, accès domaine",
    "Hors Périmètre": "Hors périmètre explicite (e-commerce complet, multi-langue, pub, CRM, blog, etc.)",
    "Frais Récurrents": "Récurrents séparés (hébergement/maintenance) + taxes applicables",
    "Integration Réservation": "Réservation en ligne (intégration complète)",
    "Paiement en Ligne": "Paiement/dépôt en ligne + politique + tests",
    "Formulaires Santé": "Formulaires santé/consentement + sécurisation + acheminement",
    "GMB Création": "Google Business Profile (création/optimisation)",
    "Photos Pro": "Photos pro / retouches avant-après + optimisation web",
    "Maintenance Mensuelle": "Maintenance mensuelle (mises à jour, sauvegardes, petites modifs)",
    "Gestion Projet": "Gestion de projet + 1 appel brief + 1 appel livraison",
    "SEO Local Base": "SEO local de base + indexation",
    "Analytics": "Configuration Analytics + suivi des clics (tel, réserver)",
    "Loi 25": "Politique de confidentialité + consentement (formulaire / prise de RDV) – mention “aligné Loi 25” (sans prétendre conseil juridique)",
    "Politique Annulation": "Politique d’annulation / no-show (affichée clairement)",
    "Politique Cookies": "Politique cookies (si tracking/analytics)",
    "Mentions Légales": "Mentions légales : résultats variables, infos non médicales (selon services)",
    "Opt SEO Local": "Optimisation SEO local : ville/quartier, services + “clinique esthétique”, “massage thérapeutique”",
    "Opt GMB": "Google Business Profile (option mais très rentable) : optimisation, catégories, services, photos",
    "Tech SEO": "Données structurées LocalBusiness/Service, balises, vitesse, indexation Search Console",
    "Détails Réservation": "Réservation en ligne (outil choisi ou intégration) : services, durées, employés, disponibilités",
    "Règles Dépôt": "Dépôt / paiement en ligne (option) + règles : annulation, no-show, retard",
    "Form Prise Info": "Formulaire de prise d’info / consentement (option) :",
    "Questionnaire Santé": "Questionnaire santé (massage / esthétique), contre-indications, consentement éclairé",
    "Reçus Masso": "Reçus (massage thérapeutique) : mentionner si la clinique fournit des reçus et comment c’est géré (outil / process)",
    "UX Mobile": "Boutons rapides mobile : Appeler / Itinéraire / Réserver",
    "Structure Hero": "Hero : promesse + 1 CTA principal (“Réserver”) + 1 CTA secondaire (“Appeler”)",
    "Structure Services": "Services (cartes claires par service) :",
    "Détails Services": "Durée, prix “à partir de”, zones, pour qui, contre-indications (résumé), résultats attendus réalistes",
    "Forfaits": "Forfaits / abonnements : packs de séances, cures, “membership” (si vous en vendez)",
    "Cartes Cadeaux": "Cartes-cadeaux : achat + conditions (expiration, non remboursable, transfert, etc.)",
    "Section Équipe": "Équipe / certifications : bios courtes, formations, approche, années d’expérience (si fourni)",
    "Preuves Confiance": "Preuves de confiance : avis, avant/après (si applicable), certifications, politiques",
    "Section FAQ": "FAQ : douleur, fréquence, préparation, annulation, reçus d’assurance (massage)",
    "Section Contact": "Contact : adresse, stationnement, heures, Google Maps, zones desservies"
};

// --- LISTENERS ---

window.saveAsTemplate = async () => {
    const name = prompt("Enter a name for this template:");
    if (!name) return;

    const item = {
        name,
        items: window.currentSalesItems,
        notes: document.getElementById('sales-notes').value,
        createdAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "quote_templates"), item);
        window.showToast("Template saved!", "success");
    } catch (e) {
        console.error(e);
        window.showToast("Error saving template", "error");
    }
};

window.loadTemplate = async () => {
    const q = query(collection(db, "quote_templates"));
    const snap = await getDocs(q);

    if (snap.empty) return alert("No templates found.");

    let msg = "Type the ID of the template to load:\n";
    const templates = {};
    snap.forEach(doc => {
        templates[doc.id] = doc.data();
        msg += `- ${doc.data().name} [ID: ${doc.id}]\n`;
    });

    const id = prompt(msg);
    if (id && templates[id]) {
        const t = templates[id];
        window.currentSalesItems = t.items;
        document.getElementById('sales-notes').value = t.notes || '';
        renderSalesItems();
    } else if (id) {
        alert("Invalid ID");
    }
};

window.injectSnippet = (index) => {
    const modalId = 'snippet-picker-modal';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: var(--bg-card); padding: 20px; border: 1px solid var(--border);
    z-index: 10000; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5); border-radius: 8px;
    width: 400px; max-height: 80vh; overflow-y: auto;
    `;

    // Use current settings snippets or default
    const snippets = window.salesSettings.snippets || SALES_SNIPPETS_DEFAULT;

    let html = '<h3 class="text-gold" style="margin-top:0;">Select Snippet</h3><div style="display:grid; gap:10px;">';
    for (let key in snippets) {
        html += `<button class="btn btn-sm" onclick="applySnippet(${index}, '${key}')" style="text-align:left;">${key}</button>`;
    }
    html += '</div><button class="btn btn-sm text-danger mt-3" onclick="this.parentElement.remove()">Cancel</button>';

    modal.innerHTML = html;
    document.body.appendChild(modal);
}

window.applySnippet = (index, key) => {
    const snippets = window.salesSettings.snippets || SALES_SNIPPETS_DEFAULT;
    const text = snippets[key];
    const textarea = document.querySelector(`.item-desc-input[data-index="${index}"]`);
    if (textarea) {
        const currentVal = textarea.value;
        textarea.value = currentVal ? currentVal + '\n\n' + text : text;
        updateLineItem(index, 'desc', textarea.value, false);
        // Auto resize
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    }
    const modal = document.getElementById('snippet-picker-modal');
    if (modal) modal.remove();
}


window.openSalesEditor = (data) => {
    let item = {};
    const isNew = data === 'new';

    if (!isNew) {
        item = JSON.parse(decodeURIComponent(data));
    } else {
        item = {
            id: null,
            clientName: '',
            clientCompany: '',
            clientEmail: '',
            clientPhone: '',
            clientAddress: '',
            clientCity: '',
            number: `${currentTab === 'quotes' ? 'Q' : 'INV'}-${Date.now().toString().slice(-6)}`,
            items: [{ desc: 'Service / Product', qty: 1, price: 0 }],
            status: 'Draft',
            total: 0,
            status: 'Draft',
            total: 0,
            taxes: [
                { name: 'TPS', rate: 5.000 },
                { name: 'TVQ', rate: 9.975 }
            ]
        };
    }

    const host = document.getElementById('sales-modal-host');

    // Split View Layout
    host.innerHTML = `
        <div style="position: fixed; inset: 0; z-index: 10000; background: var(--bg-dark); display: flex; align-items: center; justify-content: center;">
            <div style="width: 100vw; height: 100vh; background: var(--bg-dark); display: flex; overflow: hidden;">
                
                <!-- LEFT SIDEBAR: Client & Settings -->
                <div style="width: 350px; background: var(--bg-card); border-right: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0;">
                    
                    <!-- Sidebar Header -->
                    <div style="padding: 1.5rem; border-bottom: 1px solid var(--border);">
                        <div class="text-xs text-gold uppercase tracking-widest font-bold mb-1">Configuration</div>
                        <h2 class="text-h text-xl m-0">${isNew ? t('sales_new_quote').split(' ')[0] : t('sales_edit')} ${currentTab === 'quotes' ? t('sales_quotes').slice(0, -1) : t('sales_invoices').slice(0, -1)}</h2>
                    </div>

                    <!-- Sidebar Content -->
                    <div style="flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 20px;">
                        
                        <!-- Client Section -->
                        <div>
                             <div class="text-xs text-muted uppercase font-bold mb-3">${t('sales_doc_client')}</div>
                             
                             <div class="form-group" style="position:relative;">
                                <label class="form-label text-xs">${t('sales_client')}</label>
                                <input type="text" id="sales-client" class="form-input" value="${item.clientName}" placeholder="Search Client..." autocomplete="off">
                                <span class="material-icons text-muted" style="position:absolute; right:12px; top:32px; font-size:16px; pointer-events:none;">search</span>
                                <!-- Search Results -->
                                <div id="sales-client-search-results" style="display:none; position:absolute; top:calc(100% + 5px); left:0; width:100%; background:var(--bg-card); border:1px solid var(--border); border-radius:4px; max-height:200px; overflow-y:auto; z-index:100; box-shadow:0 10px 30px rgba(0,0,0,0.5);"></div>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label text-xs">Company</label>
                                <input type="text" id="sales-company" class="form-input" value="${item.clientCompany || ''}" placeholder="Company Name">
                            </div>

                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                                <div class="form-group">
                                    <label class="form-label text-xs">Email</label>
                                    <input type="text" id="sales-email" class="form-input" value="${item.clientEmail || ''}">
                                </div>
                                <div class="form-group">
                                    <label class="form-label text-xs">Phone</label>
                                    <input type="text" id="sales-phone" class="form-input" value="${item.clientPhone || ''}">
                                </div>
                            </div>

                             <div class="form-group">
                                <label class="form-label text-xs">Address</label>
                                <input type="text" id="sales-address" class="form-input" value="${item.clientAddress || ''}" placeholder="Street Address">
                            </div>
                             <div class="form-group">
                                <label class="form-label text-xs">City/State/Zip</label>
                                <input type="text" id="sales-city" class="form-input" value="${item.clientCity || ''}" placeholder="Location">
                            </div>
                        </div>

                        <div style="height:1px; background:var(--border); margin: 0 -1.5rem;"></div>

                        <!-- Settings Section -->
                        <div>
                            <div class="text-xs text-muted uppercase font-bold mb-3">${t('sales_doc_details')}</div>
                            
                            <div class="form-group">
                                <label class="form-label text-xs">${t('sales_number')}</label>
                                <input type="text" id="sales-number" class="form-input font-mono" value="${item.number}">
                            </div>

                            <div class="form-group">
                                <label class="form-label text-xs">${t('sales_status')}</label>
                                <select id="sales-status" class="form-input">
                                    <option value="Draft" ${item.status === 'Draft' ? 'selected' : ''}>Draft</option>
                                    <option value="Sent" ${item.status === 'Sent' ? 'selected' : ''}>Sent</option>
                                    <option value="Accepted" ${item.status === 'Accepted' ? 'selected' : ''}>Accepted</option>
                                    <option value="Paid" ${item.status === 'Paid' ? 'selected' : ''}>Paid</option>
                                    <option value="Rejected" ${item.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                                </select>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- RIGHT MAIN: Editor Area -->
                <div style="flex: 1; display: flex; flex-direction: column; background: var(--bg-dark);">
                    
                    <!-- Top Toolbar -->
                    <div style="padding: 1rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: var(--bg-dark);">
                        <div class="text-muted text-sm">
                            <span class="material-icons" style="font-size:16px; vertical-align:middle; margin-right:5px;">calendar_today</span>
                            ${new Date().toLocaleDateString()}
                        </div>
                        <div style="display:flex; gap:10px;">
                            ${!isNew ? `
                                <button class="btn btn-sm" onclick="salesGeneratePDF()" title="Preview Document">
                                    <span class="material-icons">visibility</span> ${t('sales_pdf')}
                                </button>
                                ${currentTab === 'quotes' ? `
                                <button class="btn btn-sm btn-primary" onclick="salesConvertToInvoice('${item.id}')" title="Convert to Invoice" style="background:var(--success); border:none; color:white;">
                                    <span class="material-icons">transform</span> ${t('sales_convert')}
                                </button>
                                ` : ''}
                                <button class="btn btn-sm" onclick="salesSendEmail()" title="Email">
                                    <span class="material-icons">send</span> ${t('sales_send')}
                                </button>
                                ${currentTab === 'invoices' && item.status !== 'Paid' ? `
                                <button class="btn btn-sm" onclick="salesGeneratePaymentLink('${item.id}', ${item.total}, '${item.clientName}', '${item.clientEmail}', '${item.number}')" style="background:var(--gold-dark); border:none; color:white;">
                                    <span class="material-icons">credit_card</span> ${t('sales_pay_link')}
                                </button>
                                ` : ''}
                                <div style="width:1px; background:var(--border); margin:0 5px;"></div>
                                <button class="btn btn-sm text-danger" onclick="salesDeleteItem('${item.id}')">
                                    <span class="material-icons">delete</span>
                                </button>
                            ` : ''}
                            <button class="icon-btn" onclick="document.getElementById('sales-modal-host').innerHTML=''">
                                <span class="material-icons">close</span>
                            </button>
                        </div>
                    </div>

                    <!-- Items Editor (Scrollable) -->
                    <div style="flex: 1; overflow-y: auto; padding: 2rem 0;">
                        
                        <div style="width: 100%; margin: 0 auto;">
                            <!-- Items Table Header -->
                            <div style="display: grid; grid-template-columns: 50px 4fr 1fr 1.5fr 1.5fr 40px; gap: 15px; padding-bottom: 10px; border-bottom: 1px solid var(--border); margin-bottom: 15px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; font-weight: bold;">
                                <div>#</div>
                                <div>${t('sales_item_desc')}</div>
                                <div>${t('sales_item_qty')}</div>
                                <div style="text-align:right;">${t('sales_item_price')}</div>
                                <div style="text-align:right;">${t('sales_item_total')}</div>
                                <div></div>
                            </div>

                            <!-- Items Container -->
                            <div id="sales-items-container" style="margin-bottom: 30px;"></div>

                            <button class="btn btn-secondary btn-sm" onclick="salesAddItem()" style="margin-bottom: 40px;">
                                + ${t('sales_add_item')}
                            </button>

                            <!-- Footer Section (Notes & Totals) -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; border-top: 1px solid var(--border); padding-top: 30px;">
                                <div>
                                    <label class="form-label text-xs uppercase font-bold text-muted">${t('sales_doc_notes')}</label>
                                    <textarea id="sales-notes" class="form-input" rows="4" placeholder="${t('sales_doc_notes')}...">${item.notes || ''}</textarea>
                                </div>
                                <div style="text-align: right;">
                                    <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:1.1rem;">
                                        <span class="text-muted">${t('sales_subtotal')}</span>
                                        <span class="text-white" id="sales-subtotal-display">$0.00</span>
                                    </div>
                                    <div id="sales-taxes-container" style="margin-bottom:10px;">
                                        <!-- Taxes will be rendered here -->
                                    </div>
                                    <div style="text-align:right; margin-bottom:10px;">
                                        <button class="btn btn-sm btn-secondary" onclick="salesAddTax()">+ ${t('sales_add_tax')}</button>
                                    </div>
                                    <div style="display:flex; justify-content:space-between; margin-bottom:20px; font-size:1.5rem; font-weight:bold; color:var(--gold); border-top: 1px solid var(--border); padding-top: 10px;">
                                        <span>${t('sales_grand_total')}</span>
                                        <span id="sales-total-display">$0.00</span>
                                    </div>
                                    
                                    <button class="btn btn-primary btn-block btn-lg" onclick="salesSaveItem('${item.id || ''}')">
                                        <span class="material-icons" style="margin-right:8px;">check</span> 
                                        ${t('sales_save')}
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    `;

    // Store items in memory for editing
    window.currentSalesItems = item.items || [];

    // Initialize Taxes (Migration from old taxRate if needed)
    if (!item.taxes) {
        if (item.taxRate !== undefined) {
            item.taxes = [{ name: 'Tax', rate: item.taxRate }];
        } else {
            item.taxes = [
                { name: 'TPS', rate: 5.000 },
                { name: 'TVQ', rate: 9.975 }
            ];
        }
    }
    window.currentSalesTaxes = item.taxes;

    renderSalesItems();

    // Attach Search Listener
    const input = document.getElementById('sales-client');
    const resultsContainer = document.getElementById('sales-client-search-results');

    input.addEventListener('input', async (e) => {
        const term = e.target.value.toLowerCase();
        if (term.length < 2) {
            resultsContainer.style.display = 'none';
            return;
        }

        const q = query(collection(db, "clients"));
        const snap = await getDocs(q);

        const matches = [];
        snap.forEach(doc => {
            const c = doc.data();
            const name = c.name.toLowerCase();

            // 1. Exact/Includes
            if (name.includes(term)) {
                matches.push(c);
            } else {
                // 2. Fuzzy (Levenshtein)
                // Allow 1 typo for short strings, 2 for longer
                const maxDist = term.length > 4 ? 2 : 1;
                if (getLevenshteinDistance(term, name) <= maxDist) {
                    matches.push(c);
                }
            }
        });

        if (matches.length > 0) {
            resultsContainer.innerHTML = '';
            matches.forEach(c => {
                const div = document.createElement('div');
                div.style.cssText = 'padding:10px; border-bottom:1px solid var(--border); cursor:pointer; background:var(--bg-card);';
                div.onmouseover = () => div.style.background = 'var(--bg-card-hover)';
                div.onmouseout = () => div.style.background = 'var(--bg-card)';
                div.innerHTML = `<div style="font-weight:bold;">${c.name}</div><div class="text-xs text-muted">${c.company || ''}</div>`;
                div.onclick = () => {
                    input.value = c.name;
                    document.getElementById('sales-company').value = c.company || '';
                    document.getElementById('sales-email').value = c.email || '';
                    document.getElementById('sales-phone').value = c.phone || '';
                    document.getElementById('sales-address').value = c.address || '';

                    // Format Location
                    let loc = c.city || '';
                    if (c.state) loc += `, ${c.state}`;
                    if (c.zip) loc += ` ${c.zip}`;
                    document.getElementById('sales-city').value = loc;
                    resultsContainer.style.display = 'none';
                };
                resultsContainer.appendChild(div);
            });
            resultsContainer.style.display = 'block';
        } else {
            resultsContainer.style.display = 'none';
        }
    });

    // Close search on click outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.style.display = 'none';
        }
    });

    // Escape key to close
    document.addEventListener('keydown', function closeOnEsc(e) {
        if (e.key === 'Escape') {
            document.getElementById('sales-modal-host').innerHTML = '';
            document.removeEventListener('keydown', closeOnEsc);
        }
    });
}

// --- HELPERS ---
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

window.renderSalesItems = (shouldFocusIndex = -1, focusField = '') => {
    const container = document.getElementById('sales-items-container');
    const totalDisplay = document.getElementById('sales-total-display');

    if (!container) return;

    let html = '';
    let total = 0;

    window.currentSalesItems.forEach((line, index) => {
        const lineTotal = (parseFloat(line.qty) || 0) * (parseFloat(line.price) || 0);
        total += lineTotal;

        html += `
            <div style="display:grid; grid-template-columns: 50px 4fr 1fr 1.5fr 1.5fr 40px; gap:10px; align-items:start; margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
                <div style="padding-top:32px; color:var(--text-muted); font-size:0.9rem; font-weight:bold; text-align:center;">${index + 1}</div>
                <div class="form-group" style="margin:0; position:relative;">
                    <label class="form-label text-xs">${t('sales_item_desc')}</label>
                    <textarea class="form-input item-desc-input" data-index="${index}" rows="2" style="font-family:inherit; min-height:60px;" oninput="updateLineItem(${index}, 'desc', this.value, false)">${line.desc}</textarea>
                    <button class="btn btn-sm" onclick="injectSnippet(${index})" title="Insert Snippet" style="position:absolute; right:5px; top:28px; padding:2px 8px; font-size:10px; background:var(--bg-card); border:1px solid var(--border);">
                        <span class="material-icons" style="font-size:14px;">auto_fix_high</span>
                    </button>
                </div>
                <div class="form-group" style="margin:0;">
                    <label class="form-label text-xs">${t('sales_item_qty')}</label>
                    <input type="number" class="form-input item-qty-input" data-index="${index}" value="${line.qty}" step="1" oninput="updateLineItem(${index}, 'qty', this.value, true)">
                </div>
                <div class="form-group" style="margin:0;">
                     <label class="form-label text-xs">${t('sales_item_price')} ($)</label>
                    <input type="number" class="form-input item-price-input" data-index="${index}" value="${line.price}" step="0.01" oninput="updateLineItem(${index}, 'price', this.value, true)">
                </div>
                 <div class="form-group" style="margin:0; text-align:right;">
                    <label class="form-label text-xs">${t('sales_item_total')}</label>
                    <div style="padding:12px 0; color:var(--text-main); font-weight:bold;" id="total-${index}">$${lineTotal.toFixed(2)}</div>
                </div>
                <button class="icon-btn text-danger" onclick="removeSalesItem(${index})" style="margin-bottom:5px; margin-top: 25px;">
                    <span class="material-icons" style="font-size:20px;">delete</span>
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
    updateTotalDisplay();

    if (shouldFocusIndex >= 0 && focusField) {
        const input = container.querySelector(`.item-${focusField}-input[data-index="${shouldFocusIndex}"]`);
        if (input) {
            input.focus();
            const val = input.value;
            input.value = '';
            input.value = val;
        }
    }
}

window.renderSalesTaxes = () => {
    const container = document.getElementById('sales-taxes-container');
    if (!container) return;

    let html = '';
    let subtotal = 0;
    window.currentSalesItems.forEach(line => {
        subtotal += (parseFloat(line.qty) || 0) * (parseFloat(line.price) || 0);
    });

    window.currentSalesTaxes.forEach((tax, index) => {
        const amount = subtotal * (parseFloat(tax.rate) / 100);
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; font-size:1rem;">
                <div style="display:flex; align-items:center; gap:5px; flex:1; justify-content:flex-end;">
                    <input type="text" class="form-input" value="${tax.name}" placeholder="Name" style="width:60px; padding:4px 8px; font-size:0.9rem; text-align:right;" oninput="updateTaxLine(${index}, 'name', this.value)">
                    <input type="number" class="form-input" value="${tax.rate}" style="width:70px; padding:4px 8px; font-size:0.9rem; text-align:right;" step="0.001" oninput="updateTaxLine(${index}, 'rate', this.value)">
                    <span class="text-muted" style="font-size:0.8rem;">%</span>
                </div>
                <div style="width:100px; text-align:right; display:flex; align-items:center; justify-content:flex-end; gap:10px;">
                    <span class="text-muted">$${amount.toFixed(2)}</span>
                    <button class="icon-btn text-danger" onclick="removeSalesTax(${index})" style="padding:0;"><span class="material-icons" style="font-size:16px;">close</span></button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

window.updateTotalDisplay = () => {
    let subtotal = 0;
    window.currentSalesItems.forEach(line => {
        subtotal += (parseFloat(line.qty) || 0) * (parseFloat(line.price) || 0);
    });

    // Calculate Taxes
    let totalTax = 0;
    if (window.currentSalesTaxes) {
        window.currentSalesTaxes.forEach(tax => {
            const taxAmount = subtotal * ((parseFloat(tax.rate) || 0) / 100);
            totalTax += taxAmount;
        });
    }

    const total = subtotal + totalTax;

    const totalDisplay = document.getElementById('sales-total-display');
    const subtotalDisplay = document.getElementById('sales-subtotal-display');

    const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

    if (totalDisplay) totalDisplay.innerText = fmt.format(total);
    if (subtotalDisplay) subtotalDisplay.innerText = fmt.format(subtotal);

    renderSalesTaxes();
}

window.updateTaxLine = (index, field, value) => {
    window.currentSalesTaxes[index][field] = value;
    updateTotalDisplay(); // Re-render taxes to update dollar amounts
}

window.salesAddTax = () => {
    window.currentSalesTaxes.push({ name: 'Tax', rate: 0 });
    updateTotalDisplay();
}

window.removeSalesTax = (index) => {
    window.currentSalesTaxes.splice(index, 1);
    updateTotalDisplay();
}

window.updateLineItem = (index, field, value, shouldRenderTotal = false) => {
    window.currentSalesItems[index][field] = value;
    if (shouldRenderTotal) {
        const line = window.currentSalesItems[index];
        const lineTotal = (parseFloat(line.qty) || 0) * (parseFloat(line.price) || 0);
        const lineTotalEl = document.getElementById(`total-${index}`);
        if (lineTotalEl) lineTotalEl.innerText = `$${lineTotal.toFixed(2)}`;
        updateTotalDisplay();
    }
}

window.salesAddItem = () => {
    window.currentSalesItems.push({ desc: '', qty: 1, price: 0 });
    renderSalesItems();
}

window.removeSalesItem = (index) => {
    window.currentSalesItems.splice(index, 1);
    renderSalesItems();
}

window.salesDeleteItem = async (id) => {
    if (!id || !await erpConfirm('Are you sure you want to delete this?')) return;
    try {
        await deleteDoc(doc(db, currentTab, id));
        document.getElementById('sales-modal-host').innerHTML = '';
        loadSalesList();
        window.showToast(`${currentTab === 'quotes' ? 'Quote' : 'Invoice'} deleted`, 'normal');
    } catch (e) {
        window.showToast(e.message, 'error');
    }
}

window.salesSaveItem = async (id) => {
    const clientName = document.getElementById('sales-client').value;
    const clientCompany = document.getElementById('sales-company').value;
    const clientEmail = document.getElementById('sales-email').value;
    const clientPhone = document.getElementById('sales-phone').value;
    const clientAddress = document.getElementById('sales-address').value;
    const clientCity = document.getElementById('sales-city').value;
    const number = document.getElementById('sales-number').value;
    const status = document.getElementById('sales-status').value;
    const notes = document.getElementById('sales-notes').value;

    if (!clientName) return window.showToast("Client Name is required", "error");

    let subtotal = 0;
    window.currentSalesItems.forEach(i => {
        subtotal += (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0);
    });

    let totalTax = 0;
    window.currentSalesTaxes.forEach(tax => {
        totalTax += subtotal * ((parseFloat(tax.rate) || 0) / 100);
    });
    const total = subtotal + totalTax;

    const payload = {
        clientName,
        clientCompany,
        clientEmail,
        clientPhone,
        clientAddress,
        clientCity,
        number,
        status,
        notes,
        items: window.currentSalesItems,
        taxes: window.currentSalesTaxes,
        subtotal,
        total,
        updatedAt: new Date().toISOString()
    };

    try {
        if (id) {
            await updateDoc(doc(db, currentTab, id), payload);
        } else {
            payload.createdAt = new Date().toISOString();
            await addDoc(collection(db, currentTab), payload);
        }
        document.getElementById('sales-modal-host').innerHTML = '';
        window.showToast('Saved Successfully', 'success');
        loadSalesList();
    } catch (e) {
        window.showToast(e.message, 'error');
        console.error(e);
    }
}

window.salesSendEmail = () => {
    const email = document.getElementById('sales-email').value;
    const subject = `${currentTab === 'quotes' ? 'Quote' : 'Invoice'} #${document.getElementById('sales-number').value}`;
    const body = `Hi,\n\nPlease find attached the ${currentTab === 'quotes' ? 'quote' : 'invoice'} for your review.\n\nThank you.`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// --- NEW PDF STRATEGY ---
window.salesGeneratePDF = () => {
    // 1. Gather Data
    const item = {
        type: currentTab,
        date: new Date().toISOString(),
        clientName: document.getElementById('sales-client').value,
        clientCompany: document.getElementById('sales-company').value,
        clientAddress: document.getElementById('sales-address').value,
        clientCity: document.getElementById('sales-city').value,
        clientEmail: document.getElementById('sales-email').value,
        clientPhone: document.getElementById('sales-phone').value,
        number: document.getElementById('sales-number').value,
        status: document.getElementById('sales-status').value,
        notes: document.getElementById('sales-notes').value,
        items: window.currentSalesItems,
        taxes: window.currentSalesTaxes,
        // Calculate totals dynamically to be safe
        total: document.getElementById('sales-total-display').innerText.replace(/[^0-9.-]+/g, ""),
        paymentInfo: window.salesSettings.paymentInfo,
        taxId: window.salesSettings.taxId
    };

    // 2. Save to LocalStorage
    localStorage.setItem('currentQuoteToPrint', JSON.stringify(item));

    // 3. Open New Tab
    window.open('quote_view.html', '_blank');
}

window.salesConvertToInvoice = async (quoteId) => {
    if (!await erpConfirm("Create a new Invoice from this Quote?")) return;

    try {
        const quoteSnap = await getDoc(doc(db, 'quotes', quoteId));
        if (!quoteSnap.exists()) throw new Error("Quote not found");

        const quoteData = quoteSnap.data();

        // Prepare Invoice Data
        const invoiceData = {
            ...quoteData,
            number: 'INV-' + Date.now().toString().slice(-6),
            status: 'Draft', // Reset status
            createdAt: new Date().toISOString(),
            convertedFrom: quoteId
        };
        delete invoiceData.id; // ensure new ID

        // Create Invoice
        const invRef = await addDoc(collection(db, 'invoices'), invoiceData);

        // Close Modal and Switch Tab
        document.getElementById('sales-modal-host').innerHTML = '';
        window.switchSalesTab('invoices'); // Switch to Invoices tab

        // Optional: Open the new invoice
        const newInvSnap = await getDoc(invRef);
        const itemJson = encodeURIComponent(JSON.stringify({ ...newInvSnap.data(), id: newInvSnap.id }));
        openSalesEditor(itemJson);

        window.showToast("Converted to Invoice successfully!", "success");

    } catch (e) {
        console.error(e);
        window.showToast("Error converting to invoice", "error");
    }
}

window.salesGeneratePaymentLink = async (invoiceId, amount, clientName, clientEmail, number) => {
    const token = localStorage.getItem('authToken');
    if (!token) return window.showToast("Unauthorized", "error");

    try {
        const btn = event.target.closest('button');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<span class="material-icons rotating">refresh</span> Generating...';
        btn.disabled = true;

        const response = await fetch(`${API_BASE}/api/sales/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ invoiceId, amount, clientName, clientEmail, number })
        });

        const data = await response.json();
        btn.innerHTML = originalHtml;
        btn.disabled = false;

        if (data.success && data.url) {
            // Open in new tab
            window.open(data.url, '_blank');
            window.showToast("Checkout link opened", "success");
        } else {
            throw new Error(data.error || "Failed to generate link");
        }
    } catch (e) {
        console.error(e);
        window.showToast(e.message, "error");
    }
};
