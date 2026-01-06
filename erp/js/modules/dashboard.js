import { db } from '../firebase-config.js';
import { collection, query, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function initDashboard() {
    const container = document.getElementById('view-dashboard');

    container.innerHTML = `
        <div class="text-h text-gold" style="margin-bottom: 1.5rem;">Weekly Overview</div>
        
        <!-- Summary Metrics -->
        <div class="stat-grid">
            <div class="card stat-card">
                <div class="stat-val text-green">$12,450</div>
                <div class="stat-label">Revenue (Week)</div>
            </div>
            <div class="card stat-card">
                <div class="stat-val text-gold">8</div>
                <div class="stat-label">Active Leads</div>
            </div>
            <div class="card stat-card">
                <div class="stat-val">24</div>
                <div class="stat-label">Calls Made</div>
            </div>
            <div class="card stat-card">
                <div class="stat-val text-info">3</div>
                <div class="stat-label">Meetings Set</div>
            </div>
        </div>

        <!-- Leads to Review Widget -->
        <div class="card" onclick="window.location.hash='#leads'" style="cursor: pointer; border-left: 3px solid var(--gold);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div class="text-h text-gold">Leads to Review</div>
                    <div class="text-muted text-sm">3 New Candidates Found</div>
                </div>
                <div class="text-h">3</div>
            </div>
        </div>

        <!-- Weekly Portrait -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
            
            <!-- Cold Call Target -->
            <div class="card" style="text-align: center;">
                <div class="text-h text-muted">Call Target</div>
                <div class="circle-chart" style="background: conic-gradient(var(--gold) 0% 65%, rgba(255,255,255,0.05) 0% 100%); margin: 1.5rem auto;">
                    <div class="circle-inner">
                        <span class="text-h text-gold">65%</span>
                    </div>
                </div>
                <div class="text-sm text-muted">65 / 100 Calls</div>
                <p class="text-sm" style="margin-top: 1rem;">You are on track to hit your weekly goal.</p>
            </div>

            <!-- Upcoming Events -->
            <div class="card">
                <div class="text-h text-info">Upcoming Events</div>
                <div class="list-item" style="padding: 10px 0; background: none; border-color: rgba(255,255,255,0.05);">
                    <div class="item-avatar" style="width:32px; height:32px; font-size:0.8rem; background: rgba(49, 204, 236, 0.2); color: var(--info);">TD</div>
                    <div class="item-content">
                        <div class="item-title" style="font-size: 0.9rem;">Demo with TechCorp</div>
                        <div class="item-subtitle">Today, 2:00 PM</div>
                    </div>
                </div>
                <div class="list-item" style="padding: 10px 0; background: none; border-color: rgba(255,255,255,0.05);">
                    <div class="item-avatar" style="width:32px; height:32px; font-size:0.8rem; background: rgba(255, 255, 255, 0.1); color: white;">TM</div>
                    <div class="item-content">
                        <div class="item-title" style="font-size: 0.9rem;">Team Sync</div>
                        <div class="item-subtitle">Tomorrow, 10:00 AM</div>
                    </div>
                </div>
                <button class="btn btn-block" style="margin-top: 1rem; border-color: var(--border); background: transparent;" onclick="window.location.hash='#calendar'">View Calendar</button>
            </div>

            <!-- Unpaid Invoices -->
            <div class="card">
                <div class="text-h text-danger">Due Invoices</div>
                <div class="list-item" style="padding: 10px 0; background: none; border-color: rgba(255,255,255,0.05);">
                    <div class="item-content">
                        <div class="item-title" style="font-size: 0.9rem;">#INV-009</div>
                        <div class="item-subtitle text-danger">Overdue (2 days)</div>
                    </div>
                    <div class="text-h" style="font-size:1rem;">$1,200</div>
                </div>
                <div class="list-item" style="padding: 10px 0; background: none; border-color: rgba(255,255,255,0.05);">
                    <div class="item-content">
                        <div class="item-title" style="font-size: 0.9rem;">#INV-012</div>
                        <div class="item-subtitle text-warning">Due Tomorrow</div>
                    </div>
                    <div class="text-h" style="font-size:1rem;">$3,450</div>
                </div>
                <button class="btn btn-block" style="margin-top: 1rem; border-color: var(--border); background: transparent;" onclick="window.location.hash='#sales'">Manage Invoices</button>
            </div>

        </div>

        <!-- Active Call Widget -->
        <div class="card" id="active-call-card">
            <div class="text-h text-gold">Cold Call Center</div>
            <div id="call-content" style="min-height: 150px; display: flex; align-items: center; justify-content: center; flex-direction: column;">
                <p class="text-muted">Ready to make some sales?</p>
                <button class="btn btn-primary" id="btn-start-call" style="min-width: 200px;">Start Dialing Session</button>
            </div>
        </div>
    `;

    document.getElementById('btn-start-call').addEventListener('click', loadNextLead);
}

async function loadNextLead() {
    const content = document.getElementById('call-content');
    content.innerHTML = '<span class="text-gold">Finding next lead...</span>';

    try {
        // Find a 'Lead' status client
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
