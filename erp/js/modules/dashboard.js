import { db } from '../firebase-config.js';
import { collection, query, where, limit, getDocs, addDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { t } from '../services/translationService.js';

export async function initDashboard() {
    console.log('Initializing Dashboard...');
    const container = document.getElementById('view-dashboard');

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
            <div>
                <div class="text-h text-gold" style="margin-bottom: 0.2rem;">${t('dash_title')}</div>
                <a href="#cashflow" class="text-xs text-muted" style="text-decoration:none; display:flex; align-items:center;">
                    <span class="material-icons" style="font-size:0.9rem; margin-right:4px;">settings</span> ${t('dash_manage_transactions')}
                </a>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn btn-primary btn-sm" style="background: var(--success); color: white;" onclick="openQuickRevenueModal()">
                    <span class="material-icons" style="font-size:1.1rem; margin-right:5px;">add_chart</span> ${t('dash_quick_revenue')}
                </button>
                <button class="btn btn-primary btn-sm" style="background: var(--danger); color: white;" onclick="openQuickExpenseModal()">
                    <span class="material-icons" style="font-size:1.1rem; margin-right:5px;">receipt</span> ${t('dash_quick_expense')}
                </button>
            </div>
        </div>
        
        <!-- Cashflow Metrics -->
        <div class="stat-grid" id="dashboard-stats">
            <div class="card stat-card">
                <div class="stat-val text-muted">...</div>
                <div class="stat-label">${t('dash_net_cashflow')}</div>
            </div>
            <div class="card stat-card">
                <div class="stat-val text-muted">...</div>
                <div class="stat-label">${t('dash_revenue_month')}</div>
            </div>
            <div class="card stat-card">
                <div class="stat-val text-muted">...</div>
                <div class="stat-label">${t('dash_total_revenue')}</div>
            </div>
            <div class="card stat-card">
                <div class="stat-val text-muted">...</div>
                <div class="stat-label">${t('dash_total_expenses')}</div>
            </div>
        </div>

        <div style="margin-bottom: 2rem;">
            <!-- Website Leads Widget -->
            <div class="card" style="margin-bottom:0; border-left: 3px solid var(--gold);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                    <div class="text-h text-gold" style="margin-bottom:0;">${t('dash_website_leads')}</div>
                    <button class="btn btn-sm btn-secondary" onclick="window.location.hash='#leads'">${t('dash_view_all')}</button>
                </div>
                <div id="website-leads-list">
                    <div class="text-muted text-sm p-3 text-center">${t('dash_checking_leads')}</div>
                </div>
            </div>
        </div>

        <!-- Weekly Portrait -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
            <!-- Upcoming Events -->
            <div class="card">
                <div class="text-h text-info">${t('dash_upcoming_events')}</div>
                <div id="dashboard-events">
                    <div class="text-muted text-sm p-3">${t('dash_no_events')}</div>
                </div>
                <button class="btn btn-block" style="margin-top: 1rem; border-color: var(--border); background: transparent;" onclick="window.location.hash='#calendar'">${t('dash_view_calendar')}</button>
            </div>

            <!-- Unpaid Invoices -->
            <div class="card">
                <div class="text-h text-danger">${t('dash_due_invoices')}</div>
                <div id="unpaid-invoices-list">
                    <div class="text-muted text-sm p-3">${t('dash_no_invoices')}</div>
                </div>
                <button class="btn btn-block" style="margin-top: 1rem; border-color: var(--border); background: transparent;" onclick="window.location.hash='#sales'">${t('dash_manage_invoices')}</button>
            </div>

        </div>

        <!-- Quick Expense Modal Host -->
        <div id="dashboard-modal-host"></div>
    `;


    // Load Dynamic Data
    refreshDashboardData();
}

async function refreshDashboardData() {
    const statsContainer = document.getElementById('dashboard-stats');
    const invoiceList = document.getElementById('unpaid-invoices-list');

    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // 1. Fetch Revenue (Paid Invoices)
        const invoicesSnap = await getDocs(collection(db, "invoices"));
        let totalRevenue = 0;
        let monthlyRevenue = 0;
        let dueInvoicesHtml = '';
        let dueCount = 0;

        invoicesSnap.forEach(doc => {
            const data = doc.data();
            const amount = parseFloat(data.total) || 0;
            const dateStr = data.createdAt;

            if (data.status === 'Paid') {
                totalRevenue += amount;
                if (dateStr >= startOfMonth) monthlyRevenue += amount;
            } else if (data.status === 'Sent' || data.status === 'Draft') {
                if (dueCount < 2) {
                    dueInvoicesHtml += `
                        <div class="list-item" style="padding: 10px 0; background: none; border-color: rgba(255,255,255,0.05);">
                            <div class="item-content">
                                <div class="item-title" style="font-size: 0.9rem;">#${data.number || 'INV'}</div>
                                <div class="item-subtitle ${data.status === 'Sent' ? 'text-warning' : 'text-muted'}">${data.status}</div>
                            </div>
                            <div class="text-h" style="font-size:1rem;">$${amount.toFixed(0)}</div>
                        </div>
                    `;
                    dueCount++;
                }
            }
        });

        // 2. Fetch Manual Revenue
        const manualRevSnap = await getDocs(collection(db, "manual_revenue"));
        manualRevSnap.forEach(doc => {
            const data = doc.data();
            const amount = parseFloat(data.amount) || 0;
            const dateStr = data.date || data.createdAt;
            totalRevenue += amount;
            if (dateStr >= startOfMonth) monthlyRevenue += amount;
        });

        if (dueInvoicesHtml) invoiceList.innerHTML = dueInvoicesHtml;

        // 3. Calculate Total Expenses
        let totalExpenses = 0;
        const allExpensesSnap = await getDocs(collection(db, "expenses"));
        allExpensesSnap.forEach(doc => {
            totalExpenses += parseFloat(doc.data().amount) || 0;
        });

        // 4. Fetch New Website Leads
        const websiteLeadsList = document.getElementById('website-leads-list');
        const webLeadsSnap = await getDocs(query(collection(db, "leads"), where("status", "==", "NEW"), limit(5)));

        // Also fetch count for stat card if it exists
        const allNewLeadsSnap = await getDocs(query(collection(db, "leads"), where("status", "==", "NEW")));
        const activeLeads = allNewLeadsSnap.size;

        if (websiteLeadsList) {
            if (webLeadsSnap.empty) {
                websiteLeadsList.innerHTML = `<div class="text-muted text-xs p-2 text-center">${t('dash_no_website_leads')}</div>`;
            } else {
                let webLeadsHtml = '';
                webLeadsSnap.forEach(doc => {
                    const data = doc.data();
                    const date = (data.created_at || data.createdAt) ? new Date(data.created_at || data.createdAt).toLocaleDateString() : 'New';
                    const name = data.business_name || data.name || data.company || 'Anonymous';
                    const sub = data.city || data.email || '';

                    webLeadsHtml += `
                        <div class="list-item" style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); cursor:pointer;" onclick="window.location.hash='#leads?id=${doc.id}'">
                            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                                <div>
                                    <div class="text-sm font-bold text-gold">${name}</div>
                                    <div class="text-xs text-muted">${sub} ${data.category ? '• ' + data.category : ''}</div>
                                </div>
                                <div class="text-xs text-muted">${date}</div>
                            </div>
                        </div>
                    `;
                });
                websiteLeadsList.innerHTML = webLeadsHtml;
            }
        }

        // 5. Fetch Recurring and Calculate Projections
        const recurringSnap = await getDocs(collection(db, "recurring_transactions"));
        recurringSnap.forEach(doc => {
            const data = doc.data();
            const amount = parseFloat(data.amount) || 0;
            const start = new Date(data.startDate || data.createdAt);

            // Calculate months difference
            const monthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());

            if (monthsDiff >= 0) {
                const totalOccurrences = monthsDiff + 1;
                if (data.type === 'income') {
                    totalRevenue += amount * totalOccurrences;
                    monthlyRevenue += amount;
                } else {
                    totalExpenses += amount * totalOccurrences;
                }
            }
        });

        // Update Stat Cards
        const netCashflow = totalRevenue - totalExpenses;
        const fmt = (v) => v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        statsContainer.innerHTML = `
            <div class="card stat-card destaque" style="background: linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(0,0,0,0) 100%); border: 1px solid var(--gold);">
                <div class="stat-val ${netCashflow >= 0 ? 'text-gold' : 'text-danger'}" style="font-size: 2rem;">$${fmt(netCashflow)}</div>
                <div class="stat-label" style="color: var(--gold); font-weight: 600;">${t('dash_net_cashflow')}</div>
            </div>
            <div class="card stat-card">
                <div class="stat-val text-green">$${fmt(monthlyRevenue)}</div>
                <div class="stat-label">${t('dash_revenue_month')}</div>
            </div>
            <div class="card stat-card">
                <div class="stat-val text-green">$${fmt(totalRevenue)}</div>
                <div class="stat-label">${t('dash_total_revenue')}</div>
            </div>
            <div class="card stat-card">
                <div class="stat-val text-danger">$${fmt(totalExpenses)}</div>
                <div class="stat-label">${t('dash_total_expenses')}</div>
            </div>
        `;

    } catch (e) {
        console.error("Dashboard Refresh Error:", e);
    }
}

window.openQuickRevenueModal = () => {
    const host = document.getElementById('dashboard-modal-host');
    host.innerHTML = `
        <div class="crm-modal-overlay" onclick="document.getElementById('dashboard-modal-host').innerHTML=''">
            <div class="crm-modal-content" style="max-width:400px; border-top: 3px solid var(--success);" onclick="event.stopPropagation()">
                <div class="crm-modal-header">
                    <div class="text-h">${t('dash_record_revenue')}</div>
                    <button class="icon-btn" onclick="document.getElementById('dashboard-modal-host').innerHTML=''"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body">
                    <div class="form-group">
                        <label class="form-label">${t('dash_description')}</label>
                        <input type="text" id="rev-desc" class="form-input" placeholder="${t('dash_description')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${t('dash_amount')}</label>
                        <input type="number" id="rev-amount" class="form-input" placeholder="0.00">
                    </div>
                    <div class="form-group mt-2">
                        <label class="form-label-checkbox">
                            <input type="checkbox" id="rev-recurring" class="custom-checkbox"> Make Recurring Monthly
                        </label>
                    </div>
                    <button class="btn btn-primary btn-block mt-3" style="background: var(--success); color: white;" onclick="saveQuickRevenue()">Save Revenue</button>
                </div>
            </div>
        </div>
    `;
};

window.saveQuickRevenue = async () => {
    const description = document.getElementById('rev-desc').value;
    const amount = parseFloat(document.getElementById('rev-amount').value);
    const isRecurring = document.getElementById('rev-recurring').checked;

    if (!description || !amount) {
        alert("Please fill in description and amount");
        return;
    }

    try {
        const collectionName = isRecurring ? "recurring_transactions" : "manual_revenue";
        await addDoc(collection(db, collectionName), {
            description,
            amount,
            type: 'income',
            date: new Date().toISOString(),
            startDate: new Date().toISOString(),
            createdAt: new Date().toISOString()
        });

        document.getElementById('dashboard-modal-host').innerHTML = '';
        if (window.showToast) window.showToast(isRecurring ? "Recurring revenue set" : "Revenue recorded", "success");
        refreshDashboardData();

    } catch (e) {
        console.error(e);
        alert("Error saving revenue: " + e.message);
    }
};

window.openQuickExpenseModal = () => {
    const host = document.getElementById('dashboard-modal-host');
    host.innerHTML = `
        <div class="crm-modal-overlay" onclick="document.getElementById('dashboard-modal-host').innerHTML=''">
            <div class="crm-modal-content" style="max-width:400px;" onclick="event.stopPropagation()">
                <div class="crm-modal-header">
                    <div class="text-h">Record Expense</div>
                    <button class="icon-btn" onclick="document.getElementById('dashboard-modal-host').innerHTML=''"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body">
                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <input type="text" id="exp-desc" class="form-input" placeholder="e.g. Server Hosting">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Amount ($)</label>
                        <input type="number" id="exp-amount" class="form-input" placeholder="0.00">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Category</label>
                        <select id="exp-cat" class="form-input" style="background:var(--bg-dark); color:white;">
                            <option value="Tools">Tools/Software</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Salary">Salary</option>
                            <option value="Rent">Rent/Office</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div class="form-group mt-2">
                        <label class="form-label-checkbox">
                            <input type="checkbox" id="exp-recurring" class="custom-checkbox"> Make Recurring Monthly
                        </label>
                    </div>
                    <button class="btn btn-primary btn-block mt-3" onclick="saveQuickExpense()">Save Expense</button>
                </div>
            </div>
        </div>
    `;
};

window.saveQuickExpense = async () => {
    const description = document.getElementById('exp-desc').value;
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const category = document.getElementById('exp-cat').value;
    const isRecurring = document.getElementById('exp-recurring').checked;

    if (!description || !amount) {
        alert("Please fill in description and amount");
        return;
    }

    try {
        const collectionName = isRecurring ? "recurring_transactions" : "expenses";
        await addDoc(collection(db, collectionName), {
            description,
            amount,
            category,
            type: 'expense',
            date: new Date().toISOString(),
            startDate: new Date().toISOString(),
            createdAt: new Date().toISOString()
        });

        document.getElementById('dashboard-modal-host').innerHTML = ''; // Close
        if (window.showToast) window.showToast(isRecurring ? "Recurring expense set" : "Expense recorded", "success");
        refreshDashboardData(); // Reload stats

    } catch (e) {
        console.error(e);
        alert("Error saving expense: " + e.message);
    }
};

async function loadNextLead() {
    const content = document.getElementById('call-content');
    content.innerHTML = '<span class="text-gold">Finding next lead...</span>';

    try {
        const q = query(collection(db, "clients"), where("status", "==", "Lead"), limit(1));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            content.innerHTML = `
                <p>No new leads found.</p>
                <button class="btn" onclick="initDashboard()">Back</button>
            `;
            return;
        }

        const lead = querySnapshot.docs[0].data();

        content.innerHTML = `
            <div class="text-h text-center">${lead.name}</div>
            <div class="text-muted text-center" style="margin-bottom: 1rem;">${lead.company} • ${lead.title}</div>
            <div class="text-center text-gold" style="font-size: 1.5rem; margin-bottom: 1rem;">${lead.phone}</div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%;">
                <button class="btn" onclick="alert('Logged: No Answer'); initDashboard()">No Answer</button>
                <button class="btn btn-primary" onclick="alert('Logged: Booked!'); initDashboard()">Meeting Booked</button>
            </div>
        `;

    } catch (e) {
        console.error(e);
        content.innerHTML = '<span class="text-danger">Error fetching lead.</span>';
    }
}
