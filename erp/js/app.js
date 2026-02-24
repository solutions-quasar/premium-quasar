import { db, auth } from './firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const API_BASE = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : '';

// Imports with versioning removed for stability in this step
// Imports with versioning removed for stability in this step
// Imports
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
import { initAiAgents } from './modules/ai_agents.js';
import { initEmails } from './modules/emails.js';
import { initCashflow } from './modules/cashflow.js';
import { initAutomations } from './modules/automations.js';
import { initDemos } from './modules/demos.js';
import { applyTranslations, setLanguage, t } from './services/translationService.js';

// --- UTILS ---

function hideSplash() {
    const splash = document.getElementById('splash-view');
    if (splash) {
        splash.classList.remove('active');
        // Extra security: hide it completely after transition
        setTimeout(() => splash.style.display = 'none', 600);
    }
}

// --- AUTH LOGIC ---

function initAuth() {
    console.log("Premium Quasar: Initializing Auth Handlers...");
    const form = document.getElementById('login-form');
    const togglePwdBtn = document.getElementById('toggle-password-btn');
    const pwdInput = document.getElementById('login-password');
    const rememberEmailCheckbox = document.getElementById('remember-email');
    const stayConnectedCheckbox = document.getElementById('stay-connected');

    if (togglePwdBtn && pwdInput) {
        togglePwdBtn.onclick = () => {
            const type = pwdInput.getAttribute('type') === 'password' ? 'text' : 'password';
            pwdInput.setAttribute('type', type);
            togglePwdBtn.innerText = type === 'password' ? 'visibility' : 'visibility_off';
        };
    }

    const savedEmail = localStorage.getItem('saved_email');
    if (savedEmail && document.getElementById('login-email')) {
        document.getElementById('login-email').value = savedEmail;
        if (rememberEmailCheckbox) rememberEmailCheckbox.checked = true;
    }

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = 'AUTHENTICATING...';
            btn.disabled = true;

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            if (rememberEmailCheckbox && rememberEmailCheckbox.checked) {
                localStorage.setItem('saved_email', email);
            } else {
                localStorage.removeItem('saved_email');
            }

            const persistenceType = (stayConnectedCheckbox && stayConnectedCheckbox.checked) ? browserLocalPersistence : browserSessionPersistence;

            try {
                await setPersistence(auth, persistenceType);
                await signInWithEmailAndPassword(auth, email, password);
            } catch (error) {
                console.error("Login Error:", error.message);
                alert('Authentication Failed: ' + error.message);
                btn.innerText = originalText;
                btn.disabled = false;
            }
        };
    }

    // Forgot Password
    const forgotLink = document.getElementById('forgot-password-link');
    if (forgotLink) {
        forgotLink.onclick = (e) => {
            e.preventDefault();
            showForgotPasswordModal();
        };
    }
}

async function startApp() {
    console.log("Premium Quasar: Starting App...");

    // Fail-safe: Hide splash even if auth hangs for some reason (e.g. network)
    const splashTimeout = setTimeout(() => {
        console.warn("Premium Quasar: Auth Timeout - Forcing Splash Dismissal");
        hideSplash();
    }, 8000);

    onAuthStateChanged(auth, async (user) => {
        clearTimeout(splashTimeout);
        const loginView = document.getElementById('login-view');
        const appView = document.getElementById('app');

        applyTranslations(); // Apply initial translations based on saved language

        if (user) {
            console.log('Premium Quasar: Session Verified for', user.email);
            const token = await user.getIdToken();
            localStorage.setItem('authToken', token);

            hideSplash();
            if (loginView) loginView.classList.remove('active');

            if (appView) {
                appView.style.display = 'flex';
                if (!window.location.hash || window.location.hash === '#') {
                    window.location.hash = '#dashboard';
                }
                handleRoute();
                setupUI();

                window.removeEventListener('hashchange', handleRoute);
                window.addEventListener('hashchange', handleRoute);
            }
        } else {
            console.log('Premium Quasar: No Active Session');
            hideSplash();
            if (loginView) loginView.classList.add('active');
            if (appView) appView.style.display = 'none';
        }
    });
}

// --- ROUTING ---

const routes = {
    '': initDashboard,
    '#dashboard': initDashboard,
    '#crm': initCRM,
    '#calendar': initCalendar,
    '#sales': initSales,
    '#leads': initLeads,
    '#leadhunter': initLeadHunter,
    '#coldcall': initColdCall,
    '#followup': initFollowup,
    '#automations': initAutomations,
    '#account': initAccount,
    '#team': initTeam,
    '#ai-agents': initAiAgents,
    '#emails': initEmails,
    '#cashflow': initCashflow,
    '#demos': initDemos
};

let activeBaseHash = '';

function handleRoute() {
    const rawHash = window.location.hash || '#dashboard';
    const baseHash = rawHash.split('?')[0] || '#dashboard';

    console.log(`[Router] Navigating to: ${baseHash} (Raw: ${rawHash})`);

    let viewId = 'view-' + baseHash.replace('#', '');
    const isSameView = (baseHash === activeBaseHash);
    activeBaseHash = baseHash;

    // Hide all views
    document.querySelectorAll('.view').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });

    const viewEl = document.getElementById(viewId);
    if (viewEl) {
        console.log(`[Router] Activating View Element: ${viewId}`);
        viewEl.classList.add('active');
        viewEl.style.display = 'block';

        const loadFunc = routes[baseHash];
        if (loadFunc) {
            console.log(`[Router] Initializing Module for: ${baseHash}`);
            loadFunc();
        } else {
            console.warn(`[Router] No init function for: ${baseHash}`);
        }
    } else {
        console.error(`[Router] View not found: ${viewId}`);
        // Fallback to dashboard if view missing
        if (baseHash !== '#dashboard') {
            window.location.hash = '#dashboard';
        }
    }

    // Update Nav Links
    const allLinks = document.querySelectorAll('.nav-link, .nav-item');
    allLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href && href.split('?')[0] === baseHash) link.classList.add('active');
    });

    closeDrawer();
}

// --- UI UTILS ---

function setupUI() {
    const drawer = document.getElementById('drawer');
    const overlay = document.getElementById('drawer-overlay');
    const menuBtn = document.getElementById('menu-btn');
    const closeBtn = document.getElementById('close-drawer');

    if (menuBtn && !menuBtn.dataset.init) {
        menuBtn.onclick = () => {
            if (window.innerWidth >= 1024) return;
            drawer.classList.add('open');
            overlay.classList.add('active');
        };
        menuBtn.dataset.init = 'true';
    }

    const closeDrawerFunc = () => {
        if (drawer) drawer.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    };

    if (closeBtn) closeBtn.onclick = closeDrawerFunc;
    if (overlay) overlay.onclick = closeDrawerFunc;

    const fabBtn = document.getElementById('main-fab');
    const fabOptions = document.getElementById('fab-options');
    const fabOverlay = document.getElementById('fab-overlay');

    if (fabBtn && !fabBtn.dataset.init) {
        fabBtn.onclick = () => {
            if (fabOptions) fabOptions.classList.toggle('open');
            if (fabOverlay) fabOverlay.classList.toggle('active');
            fabBtn.style.transform = (fabOptions && fabOptions.classList.contains('open')) ? 'rotate(45deg)' : 'rotate(0)';
        };
        fabBtn.dataset.init = 'true';
    }

    if (fabOverlay) {
        fabOverlay.onclick = () => {
            if (fabOptions) fabOptions.classList.remove('open');
            fabOverlay.classList.remove('active');
            if (fabBtn) fabBtn.style.transform = 'rotate(0)';
        };
    }
}

function closeDrawer() {
    const d = document.getElementById('drawer');
    const o = document.getElementById('drawer-overlay');
    if (d) d.classList.remove('open');
    if (o) o.classList.remove('active');
}

window.toggleSidebar = () => {
    document.body.classList.toggle('sidebar-collapsed');
    const isCollapsed = document.body.classList.contains('sidebar-collapsed');
    localStorage.setItem('sidebar_collapsed', isCollapsed);
    if (window.updateSidebarIcon) window.updateSidebarIcon(isCollapsed);

    document.querySelectorAll('.nav-item').forEach(el => {
        if (isCollapsed) {
            if (!el.dataset.originalText) {
                const text = Array.from(el.childNodes)
                    .filter(node => node.nodeType === 3 && node.textContent.trim().length > 0)
                    .map(node => node.textContent.trim())
                    .join('');
                el.dataset.originalText = text;
            }
            Array.from(el.childNodes).forEach(node => {
                if (node.nodeType === 3) node.remove();
            });
        } else {
            if (el.dataset.originalText) {
                const hasText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
                if (!hasText) {
                    el.appendChild(document.createTextNode(' ' + el.dataset.originalText));
                }
            }
        }
    });
};

window.updateSidebarIcon = (collapsed) => {
    const icon = document.getElementById('sidebar-toggle-icon');
    if (icon) icon.innerText = collapsed ? 'chevron_right' : 'chevron_left';
};

// Sidebar Init (IIFE)
(function () {
    const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (isCollapsed) {
        document.body.classList.add('sidebar-collapsed');
    }
    // Set global language handler
    window.erpSetLanguage = (lang) => {
        setLanguage(lang);
    };
})();

// Nav Group Toggle
window.toggleNavGroup = (groupId) => {
    const group = document.getElementById(groupId);
    if (!group) return;

    const isOpen = group.classList.contains('open');

    // Close others? (Optional, but usually cleaner)
    // document.querySelectorAll('.nav-group').forEach(g => g.classList.remove('open'));

    if (!isOpen) {
        group.classList.add('open');
    } else {
        group.classList.remove('open');
    }
};

// Auto-expand group if active item is inside
function autoExpandNavGroup() {
    const hash = window.location.hash || '#dashboard';
    const activeLink = document.querySelector(`.nav-item[href="${hash}"]`);
    if (activeLink) {
        const group = activeLink.closest('.nav-group');
        if (group) {
            group.classList.add('open');
        }
    }
}

// Toasts & Modals
window.showToast = (message, type = 'normal') => {
    const existing = document.querySelector('.crm-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `crm-toast ${type}`;
    let icon = type === 'success' ? 'check_circle' : (type === 'error' ? 'error' : 'info');
    toast.innerHTML = `<span class="material-icons" style="color:var(--${type === 'normal' ? 'gold' : type})">${icon}</span> ${message}`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

window.performLogout = async () => {
    try {
        await signOut(auth);
        window.location.reload();
    } catch (error) {
        console.error("Logout Error:", error);
    }
};

window.showForgotPasswordModal = () => {
    let host = document.getElementById('modal-container') || document.createElement('div');
    host.id = 'modal-container';
    if (!host.parentElement) document.body.appendChild(host);

    host.innerHTML = `
        <div class="crm-modal-overlay" style="z-index:9999;" onclick="document.getElementById('modal-container').innerHTML=''">
            <div class="crm-modal-content" style="max-width:400px; padding:2rem;" onclick="event.stopPropagation()">
                <div class="text-h mb-2">Reset Password</div>
                <p class="text-muted text-sm mb-4">Enter your email for a secure reset link.</p>
                <input type="email" id="reset-email-input" class="form-input mb-4" placeholder="Email Address">
                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
                    <button class="btn btn-primary" onclick="handlePasswordReset()">Send Link</button>
                </div>
            </div>
        </div>`;
};

window.handlePasswordReset = async () => {
    const email = document.getElementById('reset-email-input').value;
    if (!email) return window.showToast("Enter email", "error");
    try {
        const res = await fetch(`${API_BASE}/api/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.success) {
            window.showToast("Reset link sent", "success");
            document.getElementById('modal-container').innerHTML = '';
        } else throw new Error(data.error);
    } catch (e) { window.showToast(e.message, "error"); }
};

// --- BOOTSTRAP ---

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    startApp();
    autoExpandNavGroup();
});

window.addEventListener('hashchange', autoExpandNavGroup);
