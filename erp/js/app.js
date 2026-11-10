import { db, auth } from './firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const IS_LOCALHOST = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');
const LOCAL_API_BASE = 'http://localhost:5000';
const PROD_API_BASE = 'https://quasar-erp-b26d5.web.app';
const API_BASE = IS_LOCALHOST ? LOCAL_API_BASE : '';
let localBackendUnavailable = false;

export async function erpApiFetch(path, options = {}) {
    if (!IS_LOCALHOST) {
        return fetch(path, options);
    }
    if (!localBackendUnavailable) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1800);
            const resp = await fetch(`${LOCAL_API_BASE}${path}`, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return resp;
        } catch (_) {
            localBackendUnavailable = true;
        }
    }
    return fetch(`${PROD_API_BASE}${path}`, options);
}
window.erpApiFetch = erpApiFetch;

// Imports with versioning removed for stability in this step
// Imports with versioning removed for stability in this step
// Imports
import { initDashboard } from './modules/dashboard.js?v=2';
import { initCRM, addClient } from './modules/crm.js';
import { initCalendar } from './modules/calendar.js?v=36';
import { initSales } from './modules/sales.js?v=2';
import { initLeads, cleanupLeadsRealtime } from './modules/leads.js?v=72';
import { initSms } from './modules/sms.js?v=97';
import { initLeadHunter } from './modules/leadhunter.js?v=43';
import { initColdCall } from './modules/coldcall.js?v=2';
import { initFollowup } from './modules/followup.js';
import { initAccount } from './modules/account.js?v=3';
import { initTeam } from './modules/team.js?v=2';
import { initAiAgents } from './modules/ai_agents.js';
import { initEmails } from './modules/emails.js?v=2';
import { initCashflow } from './modules/cashflow.js?v=2';
import { initAutomations } from './modules/automations.js?v=3';
import { initDemos } from './modules/demos.js?v=2';
import { initWorkspace, cleanupWorkspaceRealtime } from './modules/workspace.js?v=84';
import { openSequencesConfigModal, initProspectionView } from './modules/sequences.js?v=66';
import { openAuditConfigModal } from './modules/audit.js?v=48';
import { applyTranslations, setLanguage, t, getCurrentLanguage } from './services/translationService.js?v=73';
import { initProspectionAlertService } from './services/prospectionAlertService.js?v=66';

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
                window.showToast('Échec de connexion : ' + error.message, 'error');
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

            // Populate sidebar user profile dynamically
            const dispName = user.displayName || localStorage.getItem('erp_user_display_name') || (user.email ? user.email.split('@')[0] : 'Admin');
            const initials = dispName.split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase() || 'QU';
            const nameEl = document.querySelector('.drawer-footer .user-name');
            const avatarEl = document.querySelector('.drawer-footer .user-avatar');
            if (nameEl) { nameEl.removeAttribute('data-i18n'); nameEl.textContent = dispName; }
            if (avatarEl) avatarEl.textContent = initials;

            hideSplash();
            if (loginView) loginView.classList.remove('active');

            if (appView) {
                appView.style.display = 'flex';
                if (!window.location.hash || window.location.hash === '#') {
                    window.location.hash = '#dashboard';
                }
                handleRoute();
                setupUI();
                initProspectionAlertService(db);

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
    '#workspace': initWorkspace,
    '#calendar': initCalendar,
    '#sales': initSales,
    '#prospection': initProspectionView,
    '#leads': initLeads,
    '#sms': initSms,
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

const MODULE_TITLES = {
    '': { fr: 'Tableau de Bord', en: 'Dashboard' },
    '#dashboard': { fr: 'Tableau de Bord', en: 'Dashboard' },
    '#crm': { fr: 'Clients', en: 'Clients' },
    '#workspace': { fr: 'Notion', en: 'Notion' },
    '#prospection': { fr: 'Réglages IA', en: 'AI Settings' },
    '#leads': { fr: 'Pipeline Leads', en: 'Pipeline Leads' },
    '#sms': { fr: 'Boîte SMS & Réseaux', en: 'SMS & Social Inbox' },
    '#leadhunter': { fr: 'Chasseur de Leads', en: 'Lead Hunter' },
    '#coldcall': { fr: 'Cold Call & Suivis', en: 'Cold Call' },
    '#followup': { fr: 'Suivis', en: 'Follow-ups' },
    '#calendar': { fr: 'Calendrier', en: 'Calendar' },
    '#sales': { fr: 'Facture / Devis', en: 'Invoice / Quote' },
    '#cashflow': { fr: 'Trésorerie', en: 'Cashflow' },
    '#demos': { fr: 'Démos Web', en: 'Web Demos' },
    '#team': { fr: 'Équipe', en: 'Team' },
    '#emails': { fr: 'Modèles de Courriel', en: 'Email Templates' },
    '#ai-agents': { fr: 'Agents IA', en: 'AI Agents' },
    '#automations': { fr: 'Automations', en: 'Automations' },
    '#account': { fr: 'Mon Compte', en: 'My Account' }
};

export function updateDocumentTitle(customTitle = null) {
    const lang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : (localStorage.getItem('erp_lang') || 'fr'));
    const rawHash = window.location.hash || '#dashboard';
    const baseHash = rawHash.split('?')[0] || '#dashboard';

    let moduleName = customTitle;
    if (!moduleName) {
        const titleDef = MODULE_TITLES[baseHash];
        if (titleDef) {
            moduleName = titleDef[lang] || titleDef['fr'] || titleDef['en'];
        } else {
            const activeNav = document.querySelector(`.nav-item[href="${baseHash}"]`);
            if (activeNav) {
                moduleName = activeNav.innerText.trim();
            } else {
                const cleaned = baseHash.replace('#', '').replace(/[-_]/g, ' ');
                moduleName = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
            }
        }
    }

    if (moduleName) {
        document.title = `${moduleName} · Premium Quasar ERP`;
    } else {
        document.title = 'Premium Quasar ERP';
    }
}

window.setERPTitle = (title) => {
    updateDocumentTitle(title);
};

window.addEventListener('languageChanged', () => {
    updateDocumentTitle();
});

let activeBaseHash = '';

function handleRoute() {
    const rawHash = window.location.hash || '#dashboard';
    const baseHash = rawHash.split('?')[0] || '#dashboard';

    console.log(`[Router] Navigating to: ${baseHash} (Raw: ${rawHash})`);

    // Dynamically update browser tab title with active module name displayed first
    updateDocumentTitle();

    let viewId = 'view-' + baseHash.replace('#', '');
    const isSameView = (baseHash === activeBaseHash);

    // Teardown leads listener when leaving leads module
    if (activeBaseHash === '#leads' && baseHash !== '#leads') {
        cleanupLeadsRealtime();
    }

    // Teardown workspace realtime & presence when leaving workspace module
    if (activeBaseHash === '#workspace' && baseHash !== '#workspace') {
        cleanupWorkspaceRealtime();
    }

    // Teardown SMS thread open state (restore bottom nav) when leaving SMS module
    if (baseHash !== '#sms') {
        document.body.classList.remove('sms-thread-open');
    }

    if (isSameView) {
        // Staying within the same module (only query parameters changed, e.g. #leads?filter=...&id=...)
        // Do not hide views or re-initialize the module DOM!
        return;
    }

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

    const closeDrawerFunc = () => {
        if (drawer) drawer.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
        if (menuBtn) menuBtn.classList.remove('active');
    };

    if (menuBtn && !menuBtn.dataset.init) {
        menuBtn.onclick = (e) => {
            if (e) e.preventDefault();
            if (window.innerWidth >= 1024) return;
            const isOpen = drawer && drawer.classList.contains('open');
            if (isOpen) {
                closeDrawerFunc();
            } else {
                if (drawer) drawer.classList.add('open');
                if (overlay) overlay.classList.add('active');
                menuBtn.classList.add('active');
            }
        };
        menuBtn.dataset.init = 'true';
    }

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
    const m = document.getElementById('menu-btn');
    if (d) d.classList.remove('open');
    if (o) o.classList.remove('active');
    if (m) m.classList.remove('active');
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

window.showConfirmModal = ({ title = 'Confirmation', message, confirmText = 'Confirmer', cancelText = 'Annuler', onConfirm, onCancel }) => {
    const existing = document.getElementById('app-native-confirm-modal');
    if (existing) existing.remove();

    const modalHtml = `
    <div id="app-native-confirm-modal" class="crm-modal-overlay" style="z-index:9999; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.85); position:fixed; top:0; left:0; width:100vw; height:100vh; backdrop-filter:blur(8px);">
        <div class="crm-modal-content" style="width:90%; max-width:440px; background:#12141A; border:1px solid rgba(223,165,58,0.4); border-radius:14px; padding:24px; box-shadow:0 20px 60px rgba(0,0,0,0.9); text-align:center;">
            <div style="width:48px; height:48px; border-radius:50%; background:rgba(223,165,58,0.15); border:1px solid var(--gold); display:inline-flex; align-items:center; justify-content:center; color:var(--gold); margin-bottom:14px;">
                <span class="material-icons" style="font-size:26px;">help_outline</span>
            </div>
            <h4 style="margin:0 0 10px 0; color:var(--text-main); font-size:1.15rem; font-weight:700;">${title}</h4>
            <div style="color:var(--text-muted); font-size:0.9rem; line-height:1.5; margin-bottom:22px;">${message}</div>
            <div style="display:flex; justify-content:center; gap:12px;">
                <button class="btn btn-secondary" id="app-confirm-cancel-btn" style="padding:8px 20px;">${cancelText}</button>
                <button class="btn btn-primary" id="app-confirm-ok-btn" style="padding:8px 20px; font-weight:700;">${confirmText}</button>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('app-confirm-cancel-btn').onclick = () => {
        document.getElementById('app-native-confirm-modal')?.remove();
        if (typeof onCancel === 'function') onCancel();
    };
    document.getElementById('app-confirm-ok-btn').onclick = () => {
        document.getElementById('app-native-confirm-modal')?.remove();
        if (typeof onConfirm === 'function') onConfirm();
    };
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

    const lang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : (localStorage.getItem('erp_lang') || 'fr'));
    const isFr = lang !== 'en';
    const currentLoginEmail = document.getElementById('login-email')?.value?.trim() || '';

    host.innerHTML = `
        <div class="crm-modal-overlay" style="z-index:9999; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.82); backdrop-filter:blur(8px);" onclick="document.getElementById('modal-container').innerHTML=''">
            <div class="crm-modal-content" style="max-width:420px; width:92%; padding:2rem; border:1px solid rgba(223,165,58,0.35); border-radius:14px;" onclick="event.stopPropagation()">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                    <span class="material-icons text-gold" style="font-size:24px;">lock_reset</span>
                    <div class="text-h" style="margin:0; font-size:1.15rem;">${isFr ? 'Réinitialiser le mot de passe' : 'Reset Password'}</div>
                </div>
                <p class="text-muted text-sm mb-4" style="line-height:1.5;">
                    ${isFr ? 'Entrez votre courriel administrateur pour recevoir un lien sécurisé de réinitialisation.' : 'Enter your administrator email to receive a secure reset link.'}
                </p>
                <input type="email" id="reset-email-input" class="form-input mb-4" placeholder="${isFr ? 'Adresse courriel (ex: nom@solutionsquasar.ca)' : 'Email Address'}" value="${currentLoginEmail}">
                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">${isFr ? 'Annuler' : 'Cancel'}</button>
                    <button class="btn btn-primary" id="btn-send-reset-link" onclick="handlePasswordReset()">${isFr ? 'Envoyer le lien' : 'Send Link'}</button>
                </div>
            </div>
        </div>`;

    setTimeout(() => document.getElementById('reset-email-input')?.focus(), 50);
};

window.handlePasswordReset = async () => {
    const emailInput = document.getElementById('reset-email-input');
    const btn = document.getElementById('btn-send-reset-link');
    const lang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : (localStorage.getItem('erp_lang') || 'fr'));
    const isFr = lang !== 'en';
    const email = (emailInput?.value || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
        return window.showToast(isFr ? "Veuillez entrer une adresse courriel valide." : "Please enter a valid email.", "error");
    }

    if (btn) {
        btn.disabled = true;
        btn.innerText = isFr ? "Envoi en cours..." : "Sending...";
    }

    try {
        const res = await erpApiFetch(`/api/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, lang })
        });
        const data = await res.json();
        if (data.success) {
            window.showToast(isFr ? `✓ Lien de réinitialisation envoyé à ${email} !` : `✓ Reset link sent to ${email}!`, "success");
            document.getElementById('modal-container').innerHTML = '';
        } else {
            throw new Error(data.error || (isFr ? "Échec de l'envoi du lien." : "Failed to send reset link."));
        }
    } catch (e) {
        try {
            await sendPasswordResetEmail(auth, email);
            window.showToast(isFr ? `✓ Lien de réinitialisation envoyé à ${email} !` : `✓ Reset link sent to ${email}!`, "success");
            document.getElementById('modal-container').innerHTML = '';
        } catch (fbErr) {
            window.showToast(e.message || fbErr.message, "error");
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = isFr ? "Envoyer le lien" : "Send Link";
        }
    }
};

// --- BOOTSTRAP ---

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    startApp();
    autoExpandNavGroup();
});

window.addEventListener('hashchange', autoExpandNavGroup);
