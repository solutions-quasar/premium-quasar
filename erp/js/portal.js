import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { erpAlert } from './services/uiService.js';

const firebaseConfig = {
    apiKey: "AIzaSyB84uWdhZK08M6PNpL0PtB9sfa26EfmjCQ",
    authDomain: "quasar-erp-b26d5.firebaseapp.com",
    projectId: "quasar-erp-b26d5",
    storageBucket: "quasar-erp-b26d5.firebasestorage.app",
    messagingSenderId: "317018641428",
    appId: "1:317018641428:web:abcc068eec07827c140301"
};

// INITIALIZE INDEPENDENT APP FOR PORTAL
// This prevents sharing the same 'localStorage' key with ERP Admin
const portalApp = initializeApp(firebaseConfig, "portal_app");
const db = getFirestore(portalApp);
const auth = getAuth(portalApp);

const apiBase = window.location.hostname.includes('localhost') ? 'http://localhost:5000' : '';

// 1. STATE
let currentProjectId = null;
let projectData = null;

// 2. AUTH OBSERVER
onAuthStateChanged(auth, async (user) => {
    console.log("[Portal] Auth State Changed:", user ? user.email : "No User");

    if (user) {
        // Logged in
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${apiBase}/api/public/portal/session`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                currentProjectId = data.projectId;
                projectData = data.projectData;
                showDashboard();
            } else {
                // If it's not a valid portal session, we log out ONLY the portal app
                console.warn("[Portal] Invalid session detected, logging out portal instance.");
                signOut(auth);
                showLoginOrSetup();
            }
        } catch (e) {
            console.error("[Portal] Session Error:", e);
            signOut(auth);
            showLoginOrSetup();
        }
    } else {
        // Logged out
        showLoginOrSetup();
    }
});

const showLoginOrSetup = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('invite');

    if (inviteToken) {
        await verifyInvitation(inviteToken);
    } else {
        showLogin();
    }
};

const verifyInvitation = async (token) => {
    try {
        const res = await fetch(`${apiBase}/api/public/portal/verify-invite/${token}`);
        const data = await res.json();

        if (data.success) {
            showSetup(data.email, data.projectName, token);
        } else {
            await erpAlert(data.error || "Invalid invitation");
            showLogin();
        }
    } catch (e) {
        console.error(e);
        showLogin();
    }
};

const showLogin = () => {
    const loginView = document.getElementById('portal-login');
    const setupView = document.getElementById('portal-setup');
    const appView = document.getElementById('portal-app');
    const rememberCheckbox = document.getElementById('remember-email');
    const emailInput = document.getElementById('login-email');

    loginView.style.display = 'flex';
    setupView.style.display = 'none';
    appView.style.display = 'none';
    document.body.style.alignItems = 'center';

    // Auto-fill email if remembered
    const savedEmail = localStorage.getItem('portal_remembered_email');
    if (savedEmail && emailInput) {
        emailInput.value = savedEmail;
        if (rememberCheckbox) rememberCheckbox.checked = true;
    }

    // 3. LOGIN LOGIC
    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        const email = emailInput.value;
        const pass = document.getElementById('login-pass').value;
        const btnText = document.getElementById('btn-text');
        const loader = document.getElementById('btn-loader');
        const errorEl = document.getElementById('login-error');

        // Handle Remember Email
        if (rememberCheckbox && rememberCheckbox.checked) {
            localStorage.setItem('portal_remembered_email', email);
        } else {
            localStorage.removeItem('portal_remembered_email');
        }

        btnText.style.display = 'none';
        loader.style.display = 'inline-block';
        errorEl.style.display = 'none';

        try {
            // Explicitly set persistence for the portal
            await setPersistence(auth, browserLocalPersistence);
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (err) {
            console.error(err);
            errorEl.innerText = "Invalid email or password.";
            errorEl.style.display = 'block';
            btnText.style.display = 'inline-block';
            loader.style.display = 'none';
        }
    };
};

const showSetup = (email, projectName, token) => {
    document.getElementById('portal-login').style.display = 'none';
    document.getElementById('portal-setup').style.display = 'flex';
    document.getElementById('portal-app').style.display = 'none';
    document.body.style.alignItems = 'center';

    document.getElementById('setup-email').value = email;
    document.getElementById('setup-welcome').innerHTML = `Welcome <strong>${projectName}</strong>! Setup your password to access your AI workforce.`;

    document.getElementById('setup-form').onsubmit = async (e) => {
        e.preventDefault();
        const pass = document.getElementById('setup-pass').value;
        const confirm = document.getElementById('setup-pass-confirm').value;

        if (pass !== confirm) {
            await erpAlert("Passwords do not match.");
            return;
        }
        if (pass.length < 6) {
            await erpAlert("Password must be at least 6 characters.");
            return;
        }

        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.innerText = "Securing Account...";

        try {
            const setupRes = await fetch(`${apiBase}/api/public/portal/setup-account`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password: pass })
            });
            const setupData = await setupRes.json();

            if (setupData.success) {
                // Auto Login
                await setPersistence(auth, browserLocalPersistence);
                await signInWithEmailAndPassword(auth, email, pass);
                // Auth observer will handle the rest
            } else {
                throw new Error(setupData.error);
            }
        } catch (err) {
            await erpAlert(err.message);
            btn.disabled = false;
            btn.innerText = "Secure Account & Enter";
        }
    };
};

// 4. DASHBOARD LOGIC
const showDashboard = async () => {
    document.getElementById('portal-login').style.display = 'none';
    document.getElementById('portal-app').style.display = 'flex';
    document.body.style.alignItems = 'flex-start';

    document.getElementById('project-name').innerText = projectData.name;

    // Update Google Status
    const gcalStatus = document.getElementById('gcal-status');
    if (projectData.googleTokens) {
        gcalStatus.innerHTML = '<span class="status-badge status-client">Connected</span>';
    }

    loadAgents();
    refreshUnreadBadge();
    // Back from Google after connecting Gmail: open the Connect tab; back from Stripe: the Subscription tab
    if (new URLSearchParams(window.location.search).has('gmail')) window.switchTab('integrations');
    if (new URLSearchParams(window.location.search).has('billing')) window.switchTab('subscription');
    clearInterval(badgeTimer);
    badgeTimer = setInterval(refreshUnreadBadge, 60000);
};

// Messages: the client Messaging Platform inbox (same module as the ERP, client mode: no channel settings)
let messagesMounted = false;
const mountMessages = async () => {
    const el = document.getElementById('tab-messages');
    if (!el || !currentProjectId) return;
    try {
        const { renderProjectMessaging } = await import('./modules/mp_inbox.js?v=20261110');
        renderProjectMessaging(el, {
            projectId: currentProjectId,
            apiBase,
            getToken: () => auth.currentUser.getIdToken(),
            agents: [],
            isStaff: false
        });
        messagesMounted = true;
    } catch (e) {
        console.error('[Portal] Messages load error:', e);
        el.innerHTML = '<div class="portal-card" style="text-align:center;">Impossible de charger les messages.</div>';
    }
};

// Unread badge on the Messages tab (refreshed every minute)
const refreshUnreadBadge = async () => {
    const badge = document.getElementById('nav-msg-badge');
    if (!badge || !auth.currentUser || !currentProjectId) return;
    try {
        const token = await auth.currentUser.getIdToken();
        const res = await fetch(`${apiBase}/api/mp/projects/${currentProjectId}/conversations`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        const n = (data.conversations || []).filter(c => c.unread).length;
        badge.textContent = n;
        badge.style.display = n ? '' : 'none';
        document.getElementById('menu-fab')?.classList.toggle('has-unread', n > 0);
    } catch (_) { /* badge is optional */ }
};
let badgeTimer = null;

// Subscription tab: plan, usage, add-ons, invoices (Stripe)
const mountBilling = async () => {
    const el = document.getElementById('billing-root');
    if (!el || !currentProjectId) return;
    try {
        const { renderProjectBilling } = await import('./modules/billing_ui.js?v=20261110');
        renderProjectBilling(el, { projectId: currentProjectId, apiBase, getToken: () => auth.currentUser.getIdToken(), isStaff: false });
    } catch (e) {
        console.error('[Portal] Billing load error:', e);
    }
};

// Connect tab: messaging channels the client links itself (Facebook/Instagram, WhatsApp, Gmail)
let connectMounted = false;
const mountConnect = async () => {
    const el = document.getElementById('mp-connect');
    if (!el || !currentProjectId) return;
    connectMounted = true;
    try {
        const { renderChannelConnect } = await import('./modules/mp_connect.js?v=20261110');
        renderChannelConnect(el, { projectId: currentProjectId, apiBase, getToken: () => auth.currentUser.getIdToken() });
    } catch (e) {
        connectMounted = false;
        console.error('[Portal] Connect load error:', e);
    }
};

// Side menu: floating burger toggles it; closes on navigation, overlay tap or Escape
window.togglePortalMenu = (open) => {
    const isOpen = typeof open === 'boolean' ? open : !document.body.classList.contains('menu-open');
    document.body.classList.toggle('menu-open', isOpen);
    const fab = document.getElementById('menu-fab');
    fab?.setAttribute('aria-expanded', String(isOpen));
    const icon = fab?.querySelector('.material-icons');
    if (icon) icon.textContent = isOpen ? 'close' : 'menu';
};
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.togglePortalMenu(false); });

window.switchTab = (tab) => {
    window.togglePortalMenu(false);
    document.getElementById('tab-dashboard').style.display = tab === 'dashboard' ? 'block' : 'none';
    document.getElementById('tab-integrations').style.display = tab === 'integrations' ? 'block' : 'none';
    const msg = document.getElementById('tab-messages');
    if (msg) msg.style.display = tab === 'messages' ? 'block' : 'none';
    if (tab === 'messages' && !messagesMounted) mountMessages();
    if (tab === 'integrations' && !connectMounted) mountConnect();
    const subTab = document.getElementById('tab-subscription');
    if (subTab) subTab.style.display = tab === 'subscription' ? 'block' : 'none';
    if (tab === 'subscription') mountBilling();

    // Update Nav UI
    document.querySelectorAll('.nav-link').forEach(el => {
        const isTarget = el.getAttribute('onclick')?.includes(tab);
        el.classList.toggle('active', !!isTarget);
    });
};

const loadAgents = async () => {
    const agentList = document.getElementById('agent-list');
    const q = query(collection(db, "ai_agents"), where("projectId", "==", currentProjectId));
    const snap = await getDocs(q);

    if (snap.empty) {
        agentList.innerHTML = `
            <div class="portal-card" style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem;">
                <span class="material-icons" style="font-size: 3rem; color: var(--text-dim); opacity: 0.3;">smart_toy</span>
                <p class="mt-3">No agents are active for your account yet.</p>
            </div>
        `;
        return;
    }

    let html = '';
    snap.forEach(doc => {
        const agent = doc.data();
        html += `
            <div class="portal-card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem;">
                    <div style="background:rgba(223, 165, 58, 0.1); width:48px; height:48px; border-radius:14px; display:flex; align-items:center; justify-content:center; color:var(--gold);">
                        <span class="material-icons">graphic_eq</span>
                    </div>
                    <span class="status-badge ${agent.active ? 'badge-live' : 'badge-draft'}">${agent.active ? 'Active' : 'Draft'}</span>
                </div>
                <div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">${agent.name}</div>
                <div style="font-size: 0.85rem; color: var(--text-dim); line-height: 1.5; min-height: 3rem;">
                    ${agent.welcomeMessage || 'Voice Assistant ready to help your customers.'}
                </div>
                <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size: 0.7rem; color: var(--text-dim);">Vapi AI Agent</span>
                    <span class="material-icons" style="font-size: 1.2rem; color: var(--gold);">bolt</span>
                </div>
            </div>
        `;
    });
    agentList.innerHTML = html;
};

// 5. GOOGLE INTEGRATION
window.connectGoogle = async () => {
    try {
        const res = await fetch(`${apiBase}/api/integrations/google/auth-url?projectId=${currentProjectId}`);
        const data = await res.json();
        if (data.url) {
            window.location.href = data.url;
        }
    } catch (e) {
        await erpAlert("Failed to start Google connection.");
    }
};

window.logout = () => {
    signOut(auth).then(() => window.location.reload());
};

