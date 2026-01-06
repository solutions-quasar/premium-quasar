export async function initSales() {
    const container = document.getElementById('view-sales');
    container.innerHTML = `
        <div class="card">
            <div class="text-h text-gold" style="display:flex; justify-content:space-between;">
                Invoices
                <span class="text-sm text-muted">Total: $12,450</span>
            </div>
            <div id="invoice-list">
                 <div class="list-item">
                    <div class="item-content">
                        <div class="item-title">#INV-001 - Tech Corp</div>
                        <div class="item-subtitle">Due Jan 15, 2026</div>
                    </div>
                    <div class="text-gold">$4,500.00</div>
                </div>
                 <div class="list-item">
                    <div class="item-content">
                        <div class="item-title">#INV-002 - Example Inc</div>
                        <div class="item-subtitle">Paid</div>
                    </div>
                    <div class="text-green">$1,200.00</div>
                </div>
            </div>
        </div>
        <button class="btn btn-primary btn-block">Create New Invoice</button>
    `;
}
