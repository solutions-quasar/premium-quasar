import { db } from '../firebase-config.js';
import { collection, query, getDocs, deleteDoc, doc, orderBy, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { t } from '../services/translationService.js';
import { erpConfirm } from '../services/uiService.js';

export async function initCashflow() {
    const container = document.getElementById('view-cashflow');
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
            <div class="text-h text-gold" style="margin-bottom:0;">${t('cf_title')}</div>
            <div style="display:flex; gap:10px;">
                <button class="btn btn-primary btn-sm" style="background: var(--success); color: white;" onclick="openCfAddRevenueModal()">
                    <span class="material-icons" style="font-size:1.1rem; margin-right:5px;">add_chart</span> ${t('cf_add_revenue')}
                </button>
                <button class="btn btn-primary btn-sm" style="background: var(--danger); color: white;" onclick="openCfAddExpenseModal()">
                    <span class="material-icons" style="font-size:1.1rem; margin-right:5px;">receipt</span> ${t('cf_add_expense')}
                </button>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem;">
            <!-- Manual Revenue -->
            <div class="card">
                <div class="text-h text-green mb-3">${t('cf_manual_revenue')}</div>
                <div id="list-manual-revenue" class="transaction-list">
                    <div class="text-muted p-3">${t('cf_loading')}</div>
                </div>
            </div>

            <!-- Expenses -->
            <div class="card">
                <div class="text-h text-danger mb-3">${t('cf_all_expenses')}</div>
                <div id="list-expenses" class="transaction-list">
                    <div class="text-muted p-3">${t('cf_loading')}</div>
                </div>
            </div>

            <!-- Recurring Items -->
            <div class="card">
                <div class="text-h text-info mb-3">${t('cf_recurring_items')}</div>
                <div id="list-recurring" class="transaction-list">
                    <div class="text-muted p-3">${t('cf_loading')}</div>
                </div>
            </div>
        </div>

        <div id="cf-modal-host"></div>

        <style>
            .transaction-list { max-height: 500px; overflow-y: auto; }
            .tran-item { 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                padding: 10px; 
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            .tran-item:hover { background: rgba(255,255,255,0.02); }
            .tran-info { flex: 1; }
            .tran-title { font-weight: 500; font-size: 0.9rem; }
            .tran-meta { font-size: 0.75rem; color: var(--text-muted); }
            .tran-amount { font-weight: bold; margin: 0 15px; }
        </style>
    `;

    loadAllTransactions();
}

async function loadAllTransactions() {
    await Promise.all([
        renderTransactionList('manual_revenue', 'list-manual-revenue', 'text-green'),
        renderTransactionList('expenses', 'list-expenses', 'text-danger'),
        renderTransactionList('recurring_transactions', 'list-recurring', 'text-info')
    ]);
}

async function renderTransactionList(collectionName, elementId, amountClass) {
    const list = document.getElementById(elementId);
    try {
        const q = query(collection(db, collectionName), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);

        if (snap.empty) {
            list.innerHTML = `<div class="text-muted p-3 text-sm">${t('cf_no_entries')}</div>`;
            return;
        }

        let html = '';
        snap.forEach(d => {
            const data = d.data();
            const dateStr = data.date ? new Date(data.date).toLocaleDateString() : 'Active';
            html += `
                <div class="tran-item">
                    <div class="tran-info">
                        <div class="tran-title">${data.description}</div>
                        <div class="tran-meta">${data.category || ''} ${dateStr}</div>
                    </div>
                    <div class="tran-amount ${amountClass}">${data.type === 'expense' ? '-' : ''}$${parseFloat(data.amount).toLocaleString()}</div>
                    <button class="icon-btn text-danger" onclick="deleteTransaction('${collectionName}', '${d.id}')">
                        <span class="material-icons" style="font-size:1.1rem;">delete</span>
                    </button>
                </div>
            `;
        });
        list.innerHTML = html;
    } catch (e) {
        console.error(e);
        list.innerHTML = `<div class="text-danger p-3 text-xs">${t('cf_error_loading')}</div>`;
    }
}

window.deleteTransaction = async (coll, id) => {
    if (!await erpConfirm(t('cf_delete_confirm'))) return;
    try {
        await deleteDoc(doc(db, coll, id));
        if (window.showToast) window.showToast(t('cf_delete_success'), "success");
        loadAllTransactions();
    } catch (e) {
        alert(t('cf_delete_error') + ": " + e.message);
    }
};

window.openCfAddRevenueModal = () => {
    const host = document.getElementById('cf-modal-host');
    host.innerHTML = `
        <div class="crm-modal-overlay" onclick="document.getElementById('cf-modal-host').innerHTML=''">
            <div class="crm-modal-content" style="max-width:400px; border-top: 3px solid var(--success);" onclick="event.stopPropagation()">
                <div class="crm-modal-header">
                    <div class="text-h">${t('cf_add_revenue')}</div>
                    <button class="icon-btn" onclick="document.getElementById('cf-modal-host').innerHTML=''"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body">
                    <div class="form-group">
                        <label class="form-label">${t('cf_description')}</label>
                        <input type="text" id="cf-rev-desc" class="form-input" placeholder="e.g. Cash Sale">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${t('cf_amount')}</label>
                        <input type="number" id="cf-rev-amount" class="form-input" placeholder="0.00">
                    </div>
                    <div class="form-group mt-2">
                        <label class="form-label-checkbox">
                            <input type="checkbox" id="cf-rev-recurring" class="custom-checkbox"> ${t('cf_make_recurring')}
                        </label>
                    </div>
                    <button class="btn btn-primary btn-block mt-3" style="background: var(--success); color: white;" onclick="saveCfRevenue()">${t('cf_save_revenue')}</button>
                </div>
            </div>
        </div>
    `;
};

window.saveCfRevenue = async () => {
    const description = document.getElementById('cf-rev-desc').value;
    const amount = parseFloat(document.getElementById('cf-rev-amount').value);
    const isRecurring = document.getElementById('cf-rev-recurring').checked;

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

        document.getElementById('cf-modal-host').innerHTML = '';
        if (window.showToast) window.showToast(t('cf_revenue_recorded'), "success");
        loadAllTransactions();

    } catch (e) {
        console.error(e);
        alert("Error saving revenue: " + e.message);
    }
};

window.openCfAddExpenseModal = () => {
    const host = document.getElementById('cf-modal-host');
    host.innerHTML = `
        <div class="crm-modal-overlay" onclick="document.getElementById('cf-modal-host').innerHTML=''">
            <div class="crm-modal-content" style="max-width:400px; border-top: 3px solid var(--danger);" onclick="event.stopPropagation()">
                <div class="crm-modal-header">
                    <div class="text-h">${t('cf_add_expense')}</div>
                    <button class="icon-btn" onclick="document.getElementById('cf-modal-host').innerHTML=''"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body">
                    <div class="form-group">
                        <label class="form-label">${t('cf_description')}</label>
                        <input type="text" id="cf-exp-desc" class="form-input" placeholder="e.g. Office Supplies">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${t('cf_amount')}</label>
                        <input type="number" id="cf-exp-amount" class="form-input" placeholder="0.00">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${t('cf_category')}</label>
                        <select id="cf-exp-cat" class="form-input" style="background:var(--bg-dark); color:white;">
                            <option value="Tools">${t('cf_cat_tools')}</option>
                            <option value="Marketing">${t('cf_cat_marketing')}</option>
                            <option value="Salary">${t('cf_cat_salary')}</option>
                            <option value="Rent">${t('cf_cat_rent')}</option>
                            <option value="Other">${t('cf_cat_other')}</option>
                        </select>
                    </div>
                    <div class="form-group mt-2">
                        <label class="form-label-checkbox">
                            <input type="checkbox" id="cf-exp-recurring" class="custom-checkbox"> ${t('cf_make_recurring')}
                        </label>
                    </div>
                    <button class="btn btn-primary btn-block mt-3" style="background: var(--danger); color: white;" onclick="saveCfExpense()">${t('cf_save_expense')}</button>
                </div>
            </div>
        </div>
    `;
};

window.saveCfExpense = async () => {
    const description = document.getElementById('cf-exp-desc').value;
    const amount = parseFloat(document.getElementById('cf-exp-amount').value);
    const category = document.getElementById('cf-exp-cat').value;
    const isRecurring = document.getElementById('cf-exp-recurring').checked;

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

        document.getElementById('cf-modal-host').innerHTML = '';
        if (window.showToast) window.showToast(t('cf_expense_recorded'), "success");
        loadAllTransactions();

    } catch (e) {
        console.error(e);
        alert("Error saving expense: " + e.message);
    }
};
