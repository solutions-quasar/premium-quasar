export async function initSales() {
    const container = document.getElementById('view-sales');
    container.innerHTML = `
        <div class="card">
            <div class="text-h text-gold" style="display:flex; justify-content:space-between;">
                Invoices
                <span class="text-sm text-muted">Total: $5,700</span>
            </div>
            <div id="invoice-list">
                 <div class="list-item" onclick="openInvoiceDetail('INV-001', 'Tech Corp', 4500, 'Due Jan 15')">
                    <div class="item-content">
                        <div class="item-title">#INV-001 - Tech Corp</div>
                        <div class="item-subtitle">Due Jan 15, 2026</div>
                    </div>
                    <div class="text-gold">$4,500.00</div>
                </div>
                 <div class="list-item" onclick="openInvoiceDetail('INV-002', 'Example Inc', 1200, 'Paid')">
                    <div class="item-content">
                        <div class="item-title">#INV-002 - Example Inc</div>
                        <div class="item-subtitle">Paid</div>
                    </div>
                    <div class="text-green">$1,200.00</div>
                </div>
            </div>
        </div>
        <button class="btn btn-primary btn-block">Create New Invoice</button>
        <div id="sales-modal-host"></div>
    `;
}

window.openInvoiceDetail = (id, client, amount, status) => {
    const host = document.getElementById('sales-modal-host');
    host.innerHTML = `
        <div class="crm-modal-overlay" onclick="document.getElementById('sales-modal-host').innerHTML=''">
            <div class="crm-modal-content" onclick="event.stopPropagation()">
                <div class="crm-modal-header">
                    <div class="text-h">Invoice Details</div>
                    <button class="icon-btn" onclick="document.getElementById('sales-modal-host').innerHTML=''"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body">
                    <div class="form-group">
                         <label class="form-label">Invoice ID</label>
                         <input type="text" class="form-input" value="${id}" readonly>
                    </div>
                    <div class="form-group">
                         <label class="form-label">Client</label>
                         <input type="text" class="form-input" value="${client}">
                    </div>
                    <div class="form-group">
                         <label class="form-label">Amount ($)</label>
                         <input type="number" class="form-input" value="${amount}">
                    </div>
                    <div class="form-group">
                         <label class="form-label">Status</label>
                         <input type="text" class="form-input" value="${status}">
                    </div>
                    <button class="btn btn-primary btn-block" onclick="alert('Saved!'); document.getElementById('sales-modal-host').innerHTML=''">Save Changes</button>
                </div>
            </div>
        </div>
    `;
}
