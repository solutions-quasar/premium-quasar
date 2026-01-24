import { db, auth } from './firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const API_BASE = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : '';

import { initDashboard } from './modules/dashboard.js';
import { initCRM, addClient } from './modules/crm.js';
import { initCalendar } from './modules/calendar.js';
import { initSales } from './modules/sales.js';
import { initLeads } from './modules/leads.js';
import { initLeadHunter } from './modules/leadhunter.js';
import { initColdCall } from './modules/coldcall.js';
import { initFollowup } from './modules/followup.js';
import { initAccount } from './modules/account.js';
import { initTeam } from './modules/team.js';
import { initAiAgents } from './modules/ai_agents.js?v=999';

function initAuth() {
    const loginView = document.getElementById('login-view');
    const appView = document.getElementById('app');
    const form = document.getElementById('login-form');

    // UI Elements
    const togglePwdBtn = document.getElementById('toggle-password-btn');
    const pwdInput = document.getElementById('login-password');
    const rememberEmailCheckbox = document.getElementById('remember-email');
    const stayConnectedCheckbox = document.getElementById('stay-connected');

    // 1. Toggle Password Visibility
    if (togglePwdBtn && pwdInput) {
        togglePwdBtn.addEventListener('click', () => {
            const type = pwdInput.getAttribute('type') === 'password' ? 'text' : 'password';
            pwdInput.setAttribute('type', type);
            togglePwdBtn.innerText = type === 'password' ? 'visibility' : 'visibility_off';
        });
    }

    // 2. Pre-fill Email if Saved
    const savedEmail = localStorage.getItem('saved_email');
    if (savedEmail) {
        document.getElementById('login-email').value = savedEmail;
        if (rememberEmailCheckbox) rememberEmailCheckbox.checked = true;
    }

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
        // Do not clear email if remember me is checked, but maybe clear password
        document.getElementById('login-password').value = '';
        if (!rememberEmailCheckbox || !rememberEmailCheckbox.checked) {
            document.getElementById('login-email').value = '';
        }
        window.removeEventListener('hashchange', handleRoute);
    };

    // Real-time Auth Listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('User authenticated:', user.email);
            // Save token for external pages (like report.html)
            const token = await user.getIdToken();
            localStorage.setItem('authToken', token);
            unlock();
        } else {
            console.log('User signed out.');
            localStorage.removeItem('authToken');
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

        // Save Email Logic
        if (rememberEmailCheckbox && rememberEmailCheckbox.checked) {
            localStorage.setItem('saved_email', email);
        } else {
            localStorage.removeItem('saved_email');
        }

        // Persistence Logic
        const persistenceType = (stayConnectedCheckbox && stayConnectedCheckbox.checked) ? browserLocalPersistence : browserSessionPersistence;

        try {
            await setPersistence(auth, persistenceType);
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
    const logoutBtn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'LOGOUT' || el.textContent.trim() === 'Logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showLogoutConfirmation();
        });
    }

    // Forgot Password Logic
    const forgotLink = document.getElementById('forgot-password-link');
    if (forgotLink) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            showForgotPasswordModal();
        });
    }
}

window.showForgotPasswordModal = () => {
    let host = document.getElementById('modal-container');
    if (!host) {
        host = document.createElement('div');
        host.id = 'modal-container';
        document.body.appendChild(host);
    }
    const currentEmail = document.getElementById('login-email').value || '';

    host.innerHTML = `
        <div class="crm-modal-overlay" style="z-index:9999;" onclick="document.getElementById('modal-container').innerHTML=''">
            <div class="crm-modal-content" style="max-width:400px; padding:2rem;" onclick="event.stopPropagation()">
                <div class="text-h mb-2">Reset Password</div>
                <p class="text-muted text-sm mb-4">Enter your email address to receive a reset link.</p>
                <input type="email" id="reset-email-input" class="form-input mb-4" placeholder="Enter your email" value="${currentEmail}">
                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
                    <button class="btn btn-primary" onclick="handlePasswordReset()">Send Link</button>
                </div>
            </div>
        </div>
    `;
};

// Toast Notification Utility
window.showToast = (message, type = 'normal') => {
    // Remove existing
    const existing = document.querySelector('.crm-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `crm-toast ${type}`;

    let icon = 'info';
    if (type === 'success') icon = 'check_circle';
    if (type === 'error') icon = 'error';

    toast.innerHTML = `<span class="material-icons" style="color:var(--${type === 'normal' ? 'gold' : type})">${icon}</span> ${message}`;

    document.body.appendChild(toast);

    // Animate In
    requestAnimationFrame(() => toast.classList.add('show'));

    // Auto Dismiss
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

window.handlePasswordReset = async () => {
    const email = document.getElementById('reset-email-input').value;
    if (!email) {
        showToast("Please enter an email address.", "error");
        return;
    }

    // UI Feedback
    const btn = document.querySelector('#modal-container .btn-primary');
    const originalText = btn.innerText;
    btn.innerText = 'Sending...';
    btn.disabled = true;

    try {
        // Use Backend for Custom HTML Email (Premium Look)
        const response = await fetch(`${API_BASE}/api/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || "Failed to send reset email.");
        }

        showToast("Secure reset link sent to " + email, "success");
        document.getElementById('modal-container').innerHTML = '';
    } catch (error) {
        console.error("Reset Error:", error);
        showToast(error.message, "error");
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.performLogout = async () => {
    try {
        await signOut(auth);
        window.location.reload(); // Clean refresh
    } catch (error) {
        console.error("Logout Error:", error);
    }
};

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
    '#followup': initFollowup,
    '#account': initAccount,
    '#team': initTeam,
    '#ai-agents': initAiAgents
};

// State
let currentHash = '';
let activeBaseHash = '';

// Init
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
});

function handleRoute() {
    const rawHash = window.location.hash || '#dashboard';
    const baseHash = rawHash.split('?')[0]; // Ignore query params

    currentHash = rawHash;

    // Determine target view ID using baseHash
    let viewId = 'view-' + baseHash.replace('#', '');

    // Special Case: If we are just changing params on the same view (e.g. closing a modal), 
    // we don't want to re-init everything.
    const isSameView = (baseHash === activeBaseHash);
    activeBaseHash = baseHash;

    // Hide all views
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));

    const viewEl = document.getElementById(viewId);
    if (viewEl) {
        viewEl.classList.add('active');

        // Only init module if view changed
        if (!isSameView) {
            const loadFunc = routes[baseHash];
            if (loadFunc) loadFunc();
        }
    }

    // Update Bottom Nav & Sidebar (using baseHash for matching)
    const allLinks = document.querySelectorAll('.nav-link, .nav-item');
    allLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href && href.split('?')[0] === baseHash) link.classList.add('active');
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
