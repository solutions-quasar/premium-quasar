import { db } from '../firebase-config.js';
import { collection, query, orderBy, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
    `;

    loadClients();

    // Search listener
    document.getElementById('crm-search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const items = document.querySelectorAll('.client-item');
        items.forEach(item => {
            const text = item.innerText.toLowerCase();
            item.style.display = text.includes(term) ? 'flex' : 'none';
        });
    });
}

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
            const data = doc.data();
            const initials = data.name.substring(0, 2).toUpperCase();

            html += `
                <div class="list-item client-item" onclick="alert('Client Details: ${data.name}')">
                    <div class="item-avatar">${initials}</div>
                    <div class="item-content">
                        <div class="item-title">${data.name}</div>
                        <div class="item-subtitle">${data.company || ''} • ${data.title || ''}</div>
                    </div>
                    <div class="status-badge status-${data.status.toLowerCase()}">${data.status}</div>
                </div>
            `;
        });

        listContainer.innerHTML = html;

    } catch (e) {
        console.error("Error loading clients: ", e);
        document.getElementById('client-list').innerHTML = '<div class="text-center text-danger">Error loading data. Check console.</div>';
    }
}

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
