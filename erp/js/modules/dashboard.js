import { db } from '../firebase-config.js';
import { collection, query, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function initDashboard() {
    const container = document.getElementById('view-dashboard');

    container.innerHTML = `
        <div class="stat-grid">
            <div class="card stat-card">
                <div class="stat-val text-gold">12</div>
                <div class="stat-label">Calls Made</div>
            </div>
            <div class="card stat-card">
                <div class="stat-val text-green">2</div>
                <div class="stat-label">Meetings</div>
            </div>
        </div>

        <div class="card" id="active-call-card">
            <div class="text-h text-gold">Cold Call Center</div>
            <div id="call-content" style="min-height: 150px; display: flex; align-items: center; justify-content: center; flex-direction: column;">
                <p class="text-muted">Ready to start?</p>
                <button class="btn btn-primary" id="btn-start-call">Start Dialing Session</button>
            </div>
        </div>

        <div class="card">
            <div class="text-h">Recent Activity</div>
            <div id="dashboard-activity">
                 <div class="list-item">
                    <div class="item-content">
                        <div class="item-title">Call with John Doe</div>
                        <div class="item-subtitle">No Answer</div>
                    </div>
                    <span class="text-muted text-sm">10m ago</span>
                 </div>
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
