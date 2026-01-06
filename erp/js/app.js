import { initDashboard } from './modules/dashboard.js';
import { initCRM, addClient } from './modules/crm.js';
import { initCalendar } from './modules/calendar.js';
import { initSales } from './modules/sales.js';
import { initLeads } from './modules/leads.js';
import { initLeadHunter } from './modules/leadhunter.js';

// Router Map
const routes = {
    '': initDashboard, // Default
    '#dashboard': initDashboard,
    '#crm': initCRM,
    '#calendar': initCalendar,
    '#sales': initSales,
    '#leads': initLeads,
    '#leadhunter': initLeadHunter
};

// State
let currentHash = '';

// Init
document.addEventListener('DOMContentLoaded', () => {
    handleRoute();
    setupUI();
    window.addEventListener('hashchange', handleRoute);
});

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
