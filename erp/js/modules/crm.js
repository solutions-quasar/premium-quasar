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

    // Search listener (Fuzzy)
    document.getElementById('crm-search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const items = document.querySelectorAll('.client-item');

        items.forEach(item => {
            if (term.length === 0) {
                item.style.display = 'flex';
                return;
            }

            const text = item.innerText.toLowerCase();

            // 1. Exact Substring Match (Fast & Obvious)
            if (text.includes(term)) {
                item.style.display = 'flex';
                return;
            }

            // 2. Fuzzy Match for Typos
            // Split text into words (Name, Company, Title)
            const words = text.split(/[\s•]+/); // Split by space or bullet

            // Check if ANY word in the text resembles the search term
            const isMatch = words.some(word => {
                // Skip if length diff is too big
                if (Math.abs(word.length - term.length) > 3) return false;

                // Allow 1 typo for short words, 2 for longer
                const maxDist = term.length > 4 ? 2 : 1;
                return getLevenshteinDistance(term, word) <= maxDist;
            });

            item.style.display = isMatch ? 'flex' : 'none';
        });
    });
}

// Helper: Levenshtein Distance for Fuzzy Search
function getLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    )
                );
            }
        }
    }
    return matrix[b.length][a.length]; // Return distance
    return matrix[b.length][a.length]; // Return distance
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
