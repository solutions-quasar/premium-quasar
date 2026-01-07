import { db, auth } from './firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { initDashboard } from './modules/dashboard.js';
import { initCRM, addClient } from './modules/crm.js';
import { initCalendar } from './modules/calendar.js';
import { initSales } from './modules/sales.js';
import { initLeads } from './modules/leads.js';
import { initLeadHunter } from './modules/leadhunter.js';
import { initColdCall } from './modules/coldcall.js';
import { initAccount } from './modules/account.js';
import { initTeam } from './modules/team.js';

function initAuth() {
    const loginView = document.getElementById('login-view');
    const appView = document.getElementById('app');
    const form = document.getElementById('login-form');

    const unlock = () => {
        loginView.classList.remove('active');
        appView.style.display = '';

        // Default to dashboard if no specific route
        if (!window.location.hash || window.location.hash === '#') {
            window.location.hash = '#dashboard';
        }

        handleRoute();
        setupUI();
        window.addEventListener('hashchange', handleRoute);
    };

    const lock = () => {
        loginView.classList.add('active');
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        window.removeEventListener('hashchange', handleRoute);
    };

    // Real-time Auth Listener
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log('User authenticated:', user.email);
            unlock();
        } else {
            console.log('User signed out.');
            lock();
        }
    });

    // Login Handler
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button');
        const originalText = btn.innerText;
        btn.innerText = 'Verifying...';
        btn.disabled = true;

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged will handle the unlock
            btn.innerText = originalText;
            btn.disabled = false;
        } catch (error) {
            console.error("Login Error:", error.code, error.message);
            alert('Login Failed: ' + error.message);
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });

    // Logout Logic
    // We attach this globally since the logout button might be in the sidebar (always present)
    // or inside the modal
}

window.performLogout = async () => {
    try {
        await signOut(auth);
        window.location.reload(); // Clean refresh
    } catch (error) {
        console.error("Logout Error:", error);
    }
};


// --- SIDEBAR TOGGLE LOGIC ---
window.toggleSidebar = () => {
    document.body.classList.toggle('sidebar-collapsed');
    const isCollapsed = document.body.classList.contains('sidebar-collapsed');
    localStorage.setItem('sidebar_collapsed', isCollapsed);
    updateSidebarIcon(isCollapsed);

    // JS Brute Force: Hide text nodes to guarantee centering
    document.querySelectorAll('.nav-item').forEach(el => {
        if (isCollapsed) {
            // Save original text if not already saved
            if (!el.dataset.originalText) {
                // Get text node only (excluding icon)
                const text = Array.from(el.childNodes)
                    .filter(node => node.nodeType === 3 && node.textContent.trim().length > 0)
                    .map(node => node.textContent.trim())
                    .join('');
                el.dataset.originalText = text;
            }
            // Remove text nodes, leaving only the icon
            Array.from(el.childNodes).forEach(node => {
                if (node.nodeType === 3) node.remove(); // Remove text nodes
            });
        } else {
            // Restore text
            if (el.dataset.originalText && el.querySelectorAll('.material-icons').length > 0) {
                // Check if text already exists to prevent duplication
                const hasText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
                if (!hasText) {
                    el.appendChild(document.createTextNode(' ' + el.dataset.originalText));
                }
            }
        }
    });
};

function updateSidebarIcon(collapsed) {
    const icon = document.getElementById('sidebar-toggle-icon');
    if (icon) icon.innerText = collapsed ? 'chevron_right' : 'chevron_left';

    // Run text hiding logic on init if needed
    if (collapsed) {
        document.querySelectorAll('.nav-item').forEach(el => {
            if (!el.dataset.originalText) {
                const text = Array.from(el.childNodes)
                    .filter(node => node.nodeType === 3)
                    .map(node => node.textContent)
                    .join('').trim();
                if (text) el.dataset.originalText = text;
            }
            Array.from(el.childNodes).forEach(node => {
                if (node.nodeType === 3) node.remove();
            });
        });
    }
}

// Init Sidebar State
const savedSidebarState = localStorage.getItem('sidebar_collapsed');
if (savedSidebarState === 'true') {
    document.body.classList.add('sidebar-collapsed');
    updateSidebarIcon(true);
} else {
    // Ensure text is captured on first load even if expanded
    setTimeout(() => {
        document.querySelectorAll('.nav-item').forEach(el => {
            const text = Array.from(el.childNodes)
                .filter(node => node.nodeType === 3)
                .map(node => node.textContent)
                .join('').trim();
            if (text) el.dataset.originalText = text;
        });
    }, 500);
}
// --- END SIDEBAR LOGIC ---

// Router Map
const routes = {
    '': initDashboard, // Default
    '#dashboard': initDashboard,
    '#crm': initCRM,
    '#calendar': initCalendar,
    '#sales': initSales,
    '#leads': initLeads,
    '#leadhunter': initLeadHunter,
    '#coldcall': initColdCall,
    '#account': initAccount,
    '#team': initTeam
};

// State
let currentHash = '';

// Init
// Init
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
});


function showLogoutConfirmation() {
    // Create modal host if needed
    let host = document.getElementById('modal-container');
    if (!host) {
        host = document.createElement('div');
        host.id = 'modal-container';
        document.body.appendChild(host);
    }

    host.innerHTML = `
        <div class="crm-modal-overlay" style="z-index:9999;" onclick="document.getElementById('modal-container').innerHTML=''">
            <div class="crm-modal-content" style="max-width:400px; text-align:center; padding:2rem;" onclick="event.stopPropagation()">
                <div style="margin-bottom:1rem;">
                    <span class="material-icons text-gold" style="font-size:3rem;">logout</span>
                </div>
                <div class="text-h mb-2">Disconnect Session?</div>
                <p class="text-muted text-sm mb-4">You will be returned to the secure authentication screen.</p>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <button class="btn" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
                    <button class="btn" style="background:var(--danger); border-color:var(--danger);" onclick="performLogout()">Logout</button>
                </div>
            </div>
        </div>
    `;
}

window.performLogout = () => {
    localStorage.removeItem('quasar_session');
    window.location.reload();
};

function handleRoute() {
    currentHash = window.location.hash || '#dashboard'; // Default
    if (currentHash === '') currentHash = '#dashboard';

    // Hide all views
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));

    // Determine target view ID
    let viewId = 'view-' + currentHash.replace('#', '');
    const viewEl = document.getElementById(viewId);

    if (viewEl) {
        viewEl.classList.add('active');
        // Init module if exists
        const loadFunc = routes[currentHash];
        if (loadFunc) loadFunc();
    }

    // Update Bottom Nav & Sidebar
    const allLinks = document.querySelectorAll('.nav-link, .nav-item');
    allLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === currentHash) link.classList.add('active');
    });

    closeDrawer();
}

function setupUI() {
    // Drawer Toggles
    const drawer = document.getElementById('drawer');
    const overlay = document.getElementById('drawer-overlay');
    const menuBtn = document.getElementById('menu-btn');
    const closeBtn = document.getElementById('close-drawer');

    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            if (window.innerWidth >= 1024) return; // Ignore on desktop
            drawer.classList.add('open');
            overlay.classList.add('active');
        });
    }

    const closeDrawerFunc = () => {
        drawer.classList.remove('open');
        overlay.classList.remove('active');
    };

    if (closeBtn) {
        closeBtn.addEventListener('click', closeDrawerFunc);
    }

    if (overlay) {
        overlay.addEventListener('click', closeDrawerFunc);
    }

    // FAB Toggle
    const fabBtn = document.getElementById('main-fab');
    const fabOptions = document.getElementById('fab-options');
    const fabOverlay = document.getElementById('fab-overlay');

    fabBtn.addEventListener('click', () => {
        fabOptions.classList.toggle('open');
        fabOverlay.classList.toggle('active');
        fabBtn.style.transform = fabOptions.classList.contains('open') ? 'rotate(45deg)' : 'rotate(0)';
    });

    // Close FAB on overlay click
    fabOverlay.addEventListener('click', () => {
        fabOptions.classList.remove('open');
        fabOverlay.classList.remove('active');
        fabBtn.style.transform = 'rotate(0)';
    });
}

function closeDrawer() {
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawer-overlay').classList.remove('active');
}

// Pseudo Seeder
async function seedDemoData() {
    const clients = [
        { name: 'John Smith', company: 'Tech Globals', title: 'CTO', status: 'Lead', phone: '555-0101' },
        { name: 'Sarah Connor', company: 'SkyNet Systems', title: 'Director', status: 'Prospect', phone: '555-0102' },
        { name: 'Michael Ross', company: 'Pearson Specter', title: 'Partner', status: 'Client', phone: '555-0103' },
        { name: 'Jessica Day', company: 'New Girl LLC', title: 'Teacher', status: 'Lead', phone: '555-0104' }
    ];

    for (const c of clients) {
        await addClient(c);
    }
}
