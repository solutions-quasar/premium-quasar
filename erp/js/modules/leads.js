import { db, auth } from '../firebase-config.js';
import { collection, query, where, getDocs, getDoc, updateDoc, doc, addDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { triggerWorkflowForLead } from './automations.js';
import { getTeamDropdownOptions } from './team.js';
import { LeadFilterService } from '../services/LeadFilterService.js';
import { t } from '../services/translationService.js';
import Fuse from 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.mjs';

const API_BASE = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : '';

// Monitor hash changes to handle browser "Back" and "Forward" buttons
window.addEventListener('hashchange', () => {
    const hash = window.location.hash;

    // 1. Clean route (Close Overlay)
    // Close Overlay if not in detail mode
    if (!hash.startsWith('#leads?id=')) {
        const overlay = document.getElementById('lead-detail-overlay');
        if (overlay) overlay.innerHTML = '';
        if (hash === '#leads') return;
    }

    // 2. ID route (Open Overlay)
    // This supports "Forward" button navigation
    if (hash.startsWith('#leads?id=')) {
        const id = hash.split('id=')[1];
        if (window.allLeadsCache) {
            const lead = window.allLeadsCache.find(l => l.id === id);
            if (lead) {
                // Determine if we are already seeing this lead to prevent redraw flicker?
                // For now, simple redraw is safer.
                openLeadDetail(lead);
            }
        }
    }
});

const escapeHtml = (text) => {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

// Init Leads Module
export async function initLeads() {
    console.log('Initializing Leads Module...');
    const container = document.getElementById('view-leads');

    container.innerHTML = `
        <div class="top-actions" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <div style="display:flex; align-items:center; gap:15px;">
                <div class="text-h text-gold">${t('leads_title')}</div>
                <input type="text" id="lead-search-input" class="form-input" placeholder="${t('leads_search_placeholder')}" style="width:250px; padding:6px 12px; font-size:0.9rem;" onkeyup="handleLeadSearch(this.value)">
            </div>
            <div style="display:flex; gap:10px; align-items:center;">
                <button class="btn btn-primary" onclick="openNewLeadModal()" style="display:flex; align-items:center; gap:5px;">
                    <span class="material-icons">add</span> ${t('leads_new_lead')}
                </button>
                <!-- View Toggles -->
                <div class="view-toggle">
                    <div class="view-toggle-btn active" id="btn-view-grid" onclick="setViewMode('grid')"><span class="material-icons" style="font-size:1.2rem;">grid_view</span></div>
                    <div class="view-toggle-btn" id="btn-view-list" onclick="setViewMode('list')"><span class="material-icons" style="font-size:1.2rem;">view_list</span></div>
                </div>
                <button class="btn btn-secondary" onclick="openImportModal()" style="display:flex; align-items:center; gap:5px;">
                    <span class="material-icons" style="font-size:1.1rem;">upload_file</span> ${t('leads_import_csv')}
                </button>
                <input type="file" id="csv-file-input" style="display:none;" accept=".csv" onchange="handleCSVImport(this)">
                <button class="btn" onclick="window.location.hash='#leadhunter'">${t('leads_go_to_hunter')}</button>
            </div>
        </div>

        <!-- Smart Filter Bar -->
        <div class="smart-filter-bar" style="margin-bottom:1rem;">
            <select id="smart-filter-industry" onchange="applySmartFilters()">
                <option value="ALL">${t('leads_all_industries')}</option>
            </select>
            <select id="smart-filter-region" onchange="applySmartFilters()">
                <option value="ALL">${t('leads_all_regions')}</option>
            </select>
            <select id="smart-filter-pain" onchange="applySmartFilters()">
                <option value="ALL">${t('leads_all_pain_points')}</option>
            </select>
            <div class="smart-filter-stats" id="smart-filter-count">
                ${t('leads_loading_filters')}
            </div>
        </div>

        <!-- Filter Tabs -->
        <div style="display:flex; gap:1rem; margin-bottom:1rem; overflow-x:auto; padding-bottom:5px;">
            <button class="btn btn-sm active-filter" data-filter="NEW">${t('leads_status_new')}</button>
            <button class="btn btn-sm" data-filter="APPROVED">${t('leads_status_approved')}</button>
            <button class="btn btn-sm" data-filter="CONTACTED">${t('leads_status_contacted')}</button>
            <button class="btn btn-sm" data-filter="AUDITED">${t('leads_status_audited')}</button>
            <button class="btn btn-sm" data-filter="ALL">${t('leads_status_all')}</button>
        </div>

        <div id="leads-list-container">
            <div class="text-center text-muted" style="padding: 2rem;">${t('leads_fetching')}</div>
        </div>

    `;

    // Add filter listeners
    const buttons = container.querySelectorAll('button[data-filter]');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            buttons.forEach(b => b.classList.remove('btn-primary'));
            buttons.forEach(b => b.classList.remove('active-filter'));
            e.target.classList.add('btn-primary');
            e.target.classList.add('active-filter');
            loadLeads(e.target.dataset.filter);
        });
    });

    // Default load - check if deep linked
    let initialFilter = 'NEW';
    const hash = window.location.hash;
    if (hash.includes('?id=')) {
        initialFilter = 'ALL'; // Switch to ALL to ensure the lead is found
    }

    const initialBtn = Array.from(buttons).find(b => b.dataset.filter === initialFilter) || buttons[0];

    // Initial fetch
    await loadLeads(initialBtn.dataset.filter);

    // Sync UI
    buttons.forEach(b => b.classList.remove('btn-primary', 'active-filter', 'active'));
    initialBtn.classList.add('btn-primary', 'active-filter');

    // Auto-open if ID in URL
    if (hash.startsWith('#leads?id=')) {
        const id = hash.split('id=')[1];
        const lead = window.allLeadsCache.find(l => l.id === id);
        if (lead) openLeadDetail(lead);
    }
}

// Global state for view mode
let currentViewMode = 'grid';
window.setViewMode = (mode) => {
    currentViewMode = mode;
    document.getElementById('btn-view-grid').className = `view-toggle-btn ${mode === 'grid' ? 'active' : ''}`;
    document.getElementById('btn-view-list').className = `view-toggle-btn ${mode === 'list' ? 'active' : ''}`;
    // Reload list with new class
    const container = document.getElementById('leads-grid-wrapper');
    if (container) container.className = mode === 'grid' ? 'leads-grid' : 'leads-list';
};

window.allLeadsCache = []; // Store leads for client-side search

// Global state for Fuse instance
let fuseInstance = null;

window.handleLeadSearch = (query) => {
    if (!query) {
        renderLeads(window.allLeadsCache);
        return;
    }

    // Initialize Fuse if not already done or if data changed (we'll just re-init here for simplicity or init in loadLeads)
    // To keep it simple and reactive to cache changes without complex state management, 
    // we can init it here. For 100-1000 items it's very fast.
    const options = {
        keys: [
            'business_name',
            'city',
            'category',
            'discovered_query',
            'notes'
        ],
        threshold: 0.4, // 0.0 requires perfect match, 1.0 matches anything. 0.4 is a good balance.
        ignoreLocation: true // Find matches anywhere in the string
    };

    const fuse = new Fuse(window.allLeadsCache, options);
    const results = fuse.search(query);
    const filtered = results.map(r => r.item);

    renderLeads(filtered);
};

function renderLeads(leads) {
    const listContainer = document.getElementById('leads-list-container');

    if (leads.length === 0) {
        listContainer.innerHTML = `
            <div class="card" style="text-align:center; padding:3rem;">
                <div class="text-h text-muted">${t('leads_no_leads')}</div>
                <p class="text-sm text-muted">${t('leads_adjust_search')}</p>
            </div>
        `;
        return;
    }

    let html = '';
    leads.forEach((data) => {
        // Pain Signals Badges
        let badges = '';
        if (data.pain_signals && data.pain_signals.length > 0) {
            badges = data.pain_signals.map(s => `<span class="badge badge-danger">${s.replace(/_/g, ' ')}</span>`).join('');
        }

        // Audit Badge
        if (data.lastAudit) {
            const score = data.lastAudit.score !== undefined ? data.lastAudit.score : '?';
            const color = score > 70 ? 'success' : (score > 40 ? 'gold' : 'danger');
            badges += `<span class="badge" style="border:1px solid var(--${color}); color:var(--${color}); background:rgba(0,0,0,0.3); display:inline-flex; align-items:center; gap:4px; padding: 2px 6px;" title="AI Audit Score: ${score}">
                <span class="material-icons" style="font-size:14px;">psychology</span> <strong style="font-size:0.8rem;">${score}</strong>
             </span>`;
        }

        html += `
            <div class="lead-card card" onclick="openLeadDetail('${data.id}')" style="display:flex; flex-direction:column; gap:0.5rem; border-left: 3px solid ${getStatusColor(data.status)}; cursor:pointer;">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div>
                        <div class="text-h" style="font-size:1.1rem;">${escapeHtml(data.business_name)}</div>
                        <div class="text-sm text-muted">${escapeHtml(data.category || 'Business')} • ${escapeHtml(data.city || '')}</div>
                    </div>
                    <div class="text-gold" style="font-weight:bold; min-width:80px; text-align:right;">${data.google_rating || '-'} ★ <span class="text-muted text-sm">(${data.google_reviews_count || 0})</span></div>
                </div>
                
                <div style="display:flex; gap:5px; flex-wrap:wrap; margin: 0.5rem 0;">
                    ${badges}
                    ${data.status === 'NEW' ? `<span class="badge status-new">NEW</span>` : ''}
                </div>

                 <!-- Mini Info -->
                <div class="text-xs text-muted" style="margin-bottom:0.5rem;">
                     ${t('leads_found_via')}: "${escapeHtml(data.discovered_query || 'N/A')}"
                </div>

                <div style="margin-top:auto; display:flex; gap:10px; justify-content: space-between; align-items:center;">
                     <div style="display:flex; gap:5px;" onclick="event.stopPropagation()">
                        ${renderActionButtons(data.id, data.status)}
                     </div>
                </div>
            </div>
        `;
    });

    listContainer.innerHTML = `
        <div id="leads-grid-wrapper" class="${currentViewMode === 'grid' ? 'leads-grid' : 'leads-list'}">
            ${html}
        </div>
    `;
}

async function loadLeads(statusFilter) {
    const listContainer = document.getElementById('leads-list-container');
    listContainer.innerHTML = `<div class="text-center text-muted mt-4">${t('leads_fetching')}</div>`;

    // reset search input
    const searchInput = document.getElementById('lead-search-input');
    if (searchInput) searchInput.value = '';

    try {
        let q;
        if (statusFilter === 'ALL' || statusFilter === 'AUDITED') {
            q = query(collection(db, "leads"));
        } else {
            q = query(collection(db, "leads"), where("status", "==", statusFilter));
        }

        const querySnapshot = await getDocs(q);

        // Cache data
        window.allLeadsCache = [];
        querySnapshot.forEach(docSnap => {
            const data = { ...docSnap.data(), id: docSnap.id };
            if (statusFilter === 'AUDITED') {
                // Filter client side for audited leads
                if (data.lastAudit) {
                    window.allLeadsCache.push(data);
                }
            } else {
                window.allLeadsCache.push(data);
            }
        });

        // Client-side Sort (Newest First)
        window.allLeadsCache.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
            const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
            return dateB - dateA;
        });

        renderLeads(window.allLeadsCache);

        // Init Smart Filters
        if (typeof populateSmartFilters === 'function') {
            populateSmartFilters();
        }

    } catch (e) {
        console.error(e);

        listContainer.innerHTML = `<div class="text-danger">${t('leads_error_loading')}</div>`;
    }
}

// --- DETAIL VIEW LOGIC ---

window.openLeadDetail = async (data) => {
    let lead;
    if (typeof data === 'object' && data !== null) {
        lead = data;
    } else if (typeof data === 'string') {
        if (window.allLeadsCache) {
            lead = window.allLeadsCache.find(l => l.id === data);
        }
        if (!lead) {
            try {
                lead = JSON.parse(decodeURIComponent(data));
            } catch (e) { }
        }
    }

    if (!lead) return;
    const overlay = document.getElementById('lead-detail-overlay');

    // Website URL or Fallback for Iframe
    // Note: Many sites block iframe (X-Frame-Options). We handle this by showing a message if it fails, or just linking out.
    // For "Preview", we can try to show it.
    // Verify we intend to start the timer (in case user navigated away fast)
    startLoadTimer();

    // Push State to allow Back Button support
    // We use pushState so it doesn't trigger hashchange immediately
    // But if user clicks BACK, it goes to #leads, triggering the close logic.
    if (!window.location.hash.includes('?id=')) {
        history.pushState({ leadId: lead.id }, '', `#leads?id=${lead.id}`);
    }

    const siteUrl = lead.website && lead.website.startsWith('http') ? lead.website : '';

    // Auto-detect Mixed Content (HTTPS dashboard trying to load HTTP site)
    const isMixedContent = window.location.protocol === 'https:' && siteUrl.startsWith('http:');
    let previewSrc = siteUrl;

    // Microlink Helper
    const getMicrolinkUrl = (targetUrl, width, isMobile) => {
        return `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&screenshot=true&meta=false&embed=screenshot.url&viewport.width=${width}&viewport.height=800&viewport.isMobile=${isMobile}`;
    };

    if (isMixedContent) {
        // Fallback to screenshot immediately to prevent "white page" block
        // Default to mobile width (375px) AND mobile User Agent
        previewSrc = getMicrolinkUrl(siteUrl, 375, true);
    }
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(lead.business_name + ' ' + lead.city)}`;

    // ... (rest of function) ...

    // ...



    // Set Global Audit for Popup access
    if (lead.lastAudit) {
        window.lastAuditReport = {
            ...lead.lastAudit,
            leadId: lead.id,
            reportPdfUrl: lead.reportPdfUrl || null // Include stored PDF URL if available
        };
    } else {
        window.lastAuditReport = null;
    }

    overlay.innerHTML = `
        <div class="detail-overlay" style="flex-direction: row; padding:0;">
            
            <!-- 1. FULL HEIGHT SIDEBAR (Left) -->
            <div class="detail-sidebar" id="lead-sidebar" style="background: var(--bg-card); border-right: 1px solid var(--border); overflow-y: auto; display: flex; flex-direction: column; z-index: 20; height: 100vh;">
                
                <!-- MOVED: Identity Section from Header (Optional overlap or just standard sidebar) -->
                <!-- Or keeping sidebar content as is, just physically 100% height -->

                <!-- SECTION 1: IDENTITY -->
                <div style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border);">
                    <div class="form-group" style="margin-bottom: 8px;">
                        <label class="form-label">${t('leads_business_name')}</label>
                        <input type="text" id="edit-business-name" class="form-input" value="${escapeHtml(lead.business_name)}" style="font-weight: 600; border-color: rgba(223, 165, 58, 0.2); padding: 8px 12px; font-size: 1rem;">
                    </div>
                    <div style="display: flex; gap: 15px; margin-top: 5px;">
                        <div style="flex: 1;">
                            <div class="text-xs text-muted mb-0.5">${t('leads_source_query')}</div>
                            <div class="text-sm font-bold truncate" title="${escapeHtml(lead.discovered_query || 'N/A')}">
                                <span class="material-icons" style="font-size: 14px; color: var(--gold); margin-right: 4px;">search</span>
                                ${escapeHtml(lead.discovered_query || 'N/A')}
                            </div>
                        </div>
                        <div style="flex: 1;">
                            <div class="text-xs text-muted mb-0.5">${t('leads_result_type')}</div>
                            <div class="text-sm font-bold" style="color: var(--warning);">
                                <span class="material-icons" style="font-size: 14px; margin-right: 4px;">visibility_off</span>
                                ${t('leads_page_2')}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SECTION 1.5: PAIN POINTS (EDITABLE) -->
                <div style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border);">
                    <div class="text-xs text-muted uppercase tracking-wider mb-2 font-bold" style="letter-spacing: 1px;">${t('leads_pain_points')}</div>
                    <div id="sidebar-pain-selector" style="display:flex; flex-wrap:wrap; gap:5px;">
                        ${['NO_WEBSITE', 'BAD_DESIGN', 'BAD_SEO', 'SLOW_SPEED', 'OTHER'].map(p => {
        const isSelected = lead.pain_signals && lead.pain_signals.includes(p) ? 'selected' : '';
        const label = p.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()).replace('Seo', 'SEO');
        return `<div class="pain-chip ${isSelected}" onclick="togglePain(this, '${p}')" data-value="${p}" style="font-size: 0.75rem; padding: 4px 10px;">${label}</div>`;
    }).join('')}
                    </div>
                </div>

                <!-- SECTION 2: CONTACT INTELLIGENCE -->
                <div style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border);">
                    <div class="form-group" style="margin-bottom: 8px;">
                        <div style="display:flex; align-items:center; gap:8px; background: rgba(0,0,0,0.2); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border);">
                            <span class="material-icons text-muted" style="font-size:1rem;">location_on</span>
                            <input type="text" id="edit-address" class="form-input" style="border:none; background:transparent; padding:4px; font-size: 0.9rem;" value="${escapeHtml(lead.address || '')}" placeholder="${t('leads_company_address')}">
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 8px;">
                        <div style="display:flex; align-items:center; gap:8px; background: rgba(0,0,0,0.2); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border);">
                            <span class="material-icons text-muted" style="font-size:1rem;">language</span>
                            <input type="text" id="edit-website" class="form-input" style="border:none; background:transparent; padding:4px; font-size: 0.9rem;" value="${escapeHtml(lead.website || '')}" placeholder="${t('leads_official_website')}">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                        <div style="display:flex; align-items:center; gap:8px; background: rgba(0,0,0,0.2); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border);">
                            <span class="material-icons text-muted" style="font-size:1rem;">location_city</span>
                            <input type="text" id="edit-city" class="form-input" style="border:none; background:transparent; padding:4px; font-size: 0.85rem;" value="${escapeHtml(lead.city || '')}" placeholder="${t('leads_city')}">
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; background: rgba(0,0,0,0.2); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border);">
                            <span class="material-icons text-muted" style="font-size:1rem;">map</span>
                            <input type="text" id="edit-state" class="form-input" style="border:none; background:transparent; padding:4px; font-size: 0.85rem;" value="${escapeHtml(lead.state || '')}" placeholder="${t('leads_state_prov')}">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div style="display:flex; align-items:center; gap:8px; background: rgba(0,0,0,0.2); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border);">
                            <span class="material-icons text-muted" style="font-size:1rem;">phone</span>
                            <input type="text" id="edit-phone" class="form-input" style="border:none; background:transparent; padding:4px; font-size: 0.85rem;" value="${escapeHtml(lead.phone || '')}" placeholder="${t('leads_phone')}">
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; background: rgba(0,0,0,0.2); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border);">
                            <span class="material-icons text-muted" style="font-size:1rem;">email</span>
                            <input type="text" id="edit-email" class="form-input" style="border:none; background:transparent; padding:4px; font-size: 0.85rem;" value="${escapeHtml(lead.email || '')}" placeholder="${t('leads_public_email')}">
                        </div>
                    </div>
                </div>

                <!-- SECTION 3: DECISION MAKER -->
                <div style="padding: 1rem; border-bottom: 1px solid var(--border); background: rgba(223, 165, 58, 0.02);">
                    <div class="text-xs text-gold uppercase tracking-wider mb-2 font-bold" style="letter-spacing: 1px;">${t('leads_governance')}</div>
                    
                    <div class="form-group" style="margin-bottom: 6px;">
                        <div style="display:flex; align-items:center; gap:8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <span class="material-icons text-gold" style="font-size:0.9rem; opacity: 0.7;">person</span>
                            <input type="text" id="edit-dm-name" class="form-input" style="border:none; background:transparent; padding:4px; font-size: 0.9rem;" value="${escapeHtml(lead.dm_name || '')}" placeholder="${t('leads_contact_name')}">
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 6px;">
                        <div style="display:flex; align-items:center; gap:8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <span class="material-icons text-gold" style="font-size:0.9rem; opacity: 0.7;">alternate_email</span>
                            <input type="text" id="edit-dm-email" class="form-input" style="border:none; background:transparent; padding:4px; font-size: 0.9rem;" value="${escapeHtml(lead.dm_email || '')}" placeholder="${t('leads_direct_email')}">
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="material-icons text-gold" style="font-size:0.9rem; opacity: 0.7;">contact_phone</span>
                            <input type="text" id="edit-dm-phone" class="form-input" style="border:none; background:transparent; padding:4px; font-size: 0.9rem;" value="${escapeHtml(lead.dm_phone || '')}" placeholder="${t('leads_direct_phone')}">
                        </div>
                    </div>

                    <!-- ASSIGNED AGENT SELECTOR -->
                        <div style="margin-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 1rem;">
                        <div class="text-xs text-muted uppercase tracking-wider mb-2 font-bold" style="letter-spacing: 1px;">${t('leads_assigned_agent')}</div>
                        <select id="edit-assigned-agent" class="form-input" style="background: rgba(0,0,0,0.2); border: 1px solid var(--border); font-size: 0.9rem;">
                            ${await getTeamDropdownOptions(lead.assigned_agent_id)}
                        </select>
                    </div>


                </div>

                <!-- SECTION 4: STRATEGIC NOTES -->
                <div style="padding: 1rem; border-bottom: 1px solid var(--border);">
                        <div class="text-xs text-muted uppercase tracking-wider mb-2 font-bold" style="letter-spacing: 1px;">${t('leads_strategic_notes')}</div>
                        <textarea id="edit-notes" class="form-input" rows="3" style="font-size: 0.85rem; background: rgba(0,0,0,0.15); border-style: dashed; padding: 8px;" placeholder="${t('leads_notes_placeholder')}">${escapeHtml(lead.notes || '')}</textarea>
                </div>

                <!-- PERFORMANCE & AUDIT -->
                <div style="padding: 1rem; border-bottom: 1px solid var(--border); background: rgba(49, 204, 236, 0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                        <div class="text-xs text-info uppercase tracking-wider font-bold" style="letter-spacing: 1px;">${t('leads_seo_performance')}</div>
                        <div class="text-xs text-muted">${t('leads_load_time')}: <strong id="load-time-display" style="color:var(--info);">-</strong></div>
                    </div>

                    <div id="seo-report-container">
                            ${lead.lastAudit ? `
                            <div style="display:flex; align-items:center; gap:15px; margin-bottom:1rem;">
                                <div class="seo-score-circle" style="width:60px; height:60px; font-size:1.2rem; background: conic-gradient(var(--${lead.lastAudit.score > 70 ? 'success' : 'warning'}) 0% ${lead.lastAudit.score}%, rgba(255,255,255,0.1) 0% 100%);">
                                    <span style="font-weight:bold;">${lead.lastAudit.score}</span>
                                </div>
                                <div>
                                        <div class="text-h" style="font-size:1.1rem;">${t('leads_ai_audit_saved')}</div>
                                        <div class="text-xs text-muted">${t('leads_audited_at')}: ${lead.lastAudit.timestamp}</div>
                                </div>
                            </div>
                            <button class="btn btn-primary btn-block btn-sm" onclick="openAuditPopup()">${t('leads_view_report')}</button>
                            <div class="text-center" style="margin-top:0.5rem;"><a href="javascript:void(0)" class="text-xs text-muted" onclick="runDeepAudit('${lead.website}', '${lead.id}')">${t('leads_run_new_audit')}</a></div>
                            ` : `
                                <div style="background: rgba(0,0,0,0.2); border: 1px dashed var(--info); padding: 10px; border-radius: 8px; text-align: center;">
                                <span class="material-icons text-info" style="font-size: 1.5rem; margin-bottom: 5px;">analytics</span>
                                <p class="text-muted text-xs mb-2">${t('leads_no_audit')}</p>
                                <button class="btn btn-block btn-sm" style="border-color: var(--info); color: var(--info); font-weight: bold; background: rgba(49, 204, 236, 0.1); font-size: 0.7rem;" onclick="runDeepAudit('${lead.website}', '${lead.id}')">
                                    <span class="material-icons" style="font-size: 12px; margin-right: 4px;">psychology</span>
                                    ${t('leads_run_deep_audit')}
                                </button>
                                </div>
                            `}
                    </div>
                </div>

                <!-- ACTIONS MATRIX (STICKY BOTTOM) -->
                <div style="padding: 1rem; background: var(--bg-dark); position: sticky; bottom: 0; z-index: 10; border-top: 1px solid var(--border);">
                    <div id="lead-actions-row" style="display:flex; gap:8px;">
                        <button class="btn btn-sm" onclick="sendLeadToSelf('${lead.id}')" title="Send info to my phone" style="background:rgba(255,255,255,0.05); border:1px solid var(--border); padding: 0 8px;">
                            <span class="material-icons" style="font-size:18px;">smartphone</span>
                        </button>
                        
                        ${lead.email ?
            `<button class="btn btn-sm btn-secondary" onclick="openEmailComposer(document.getElementById('edit-email').value, document.getElementById('edit-business-name').value)" style="flex:1; display: flex; align-items:center; justify-content:center; gap: 4px; font-size: 0.75rem;">
                                <span class="material-icons" style="font-size:14px;">send</span> COMPOSE
                                </button>`
            : ''}
                        
                        <button class="btn btn-sm btn-primary" style="flex:1.5; box-shadow: 0 4px 15px rgba(223, 165, 58, 0.2); font-size: 0.75rem;" onclick="saveLeadDetails('${lead.id}')">SAVE UPDATES</button>
                    </div>
                </div>

            </div>

            <!-- 2. RESIZER -->
            <div class="detail-resizer" id="sidebar-resizer" style="height: 100vh;"></div>

            <!-- 3. RIGHT PANE (Header + Preview) -->
            <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; height: 100vh; position: relative;">
                
                <!-- HEADER (Now specific to right pane) -->
                <div class="detail-header" style="height: auto; min-height: 50px; flex-shrink: 0; flex-direction: column; justify-content:center; gap: 8px; padding: 12px 20px;">
                    <!-- ROW 1: Identity (Simplified) & Close -->
                    <div style="display:flex; justify-content:space-between; align-items: center;">
                        <div style="display:flex; align-items:center; gap: 12px; overflow:hidden; flex: 1;">
                                <div class="text-h truncate" style="font-size:1.15rem; margin:0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(lead.business_name)}">${escapeHtml(lead.business_name)}</div>
                                
                                <div style="display:flex; gap:8px; align-items:center; flex-shrink: 0;">
                                <select id="edit-lead-status" class="badge status-${lead.status ? lead.status.toLowerCase() : 'new'}" style="font-size:0.7rem; padding: 2px 20px 2px 6px; font-weight:bold; border: 1px solid rgba(255,255,255,0.2); appearance: menulist; cursor:pointer;" onchange="this.className='badge status-'+this.value.toLowerCase();">
                                    <option value="NEW" ${lead.status === 'NEW' ? 'selected' : ''}>NEW</option>
                                    <option value="INTERESTED" ${lead.status === 'INTERESTED' ? 'selected' : ''}>INTERESTED</option>
                                    <option value="CALLBACK" ${lead.status === 'CALLBACK' ? 'selected' : ''}>CALLBACK</option>
                                    <option value="NOT_INTERESTED" ${lead.status === 'NOT_INTERESTED' ? 'selected' : ''}>NOT INTERESTED</option>
                                    <option value="CLIENT" ${lead.status === 'CLIENT' ? 'selected' : ''}>CLIENT</option>
                                    <option value="REJECTED" ${lead.status === 'REJECTED' ? 'selected' : ''}>REJECTED</option>
                                </select>
                                ${lead.google_page_rank ? `<span class="badge" style="background:rgba(255,255,255,0.05); color:var(--text-muted); border:1px solid var(--border); font-size:0.7rem; padding: 2px 6px;">Page ${lead.google_page_rank}</span>` : ''}
                                <a href="${googleSearchUrl}" target="_blank" class="text-xs text-gold hover-underline" style="display:flex; align-items:center; gap:3px;">
                                    <span class="material-icons" style="font-size:13px;">open_in_new</span> ${t('leads_verify_rank')}
                                </a>
                                </div>
                        </div>
                        
                        <button class="btn icon-btn" style="background:transparent; color:var(--text-muted); padding:4px;" onclick="window.location.hash='#leads'">
                            <span class="material-icons">close</span>
                        </button>
                    </div>

                    <!-- ROW 2: Actions (Compact) - Only if needed in header too, or assume sidebar handles "Approve/Reject" if it was there? -->
                    <!-- The user originally wanted Approve/Reject visibly. Let's keep them here for convenience or remove if redundant. -->
                    <!-- Keeping them here as "Top/Quick Actions" is good UX. -->
                    ${lead.status === 'NEW' || lead.lastAudit ? `
                    <div style="display:flex; justify-content:space-between; align-items:center; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 8px;">
                            <!-- Left: Audit Action -->
                            <div>
                            ${lead.lastAudit ? `
                                <button class="btn btn-sm btn-info" onclick="openAuditPopup()" style="display:inline-flex; align-items:center; gap:4px; border-color:var(--info); font-weight:bold; padding: 2px 10px; font-size: 0.7rem;">
                                    <span class="material-icons" style="font-size:14px;">auto_awesome</span> VIEW AI AUDIT
                                </button>
                            ` : ''}
                            </div>

                            <!-- Right: Workflow Actions -->
                        ${lead.status === 'NEW' ? `
                            <div style="display:flex; align-items:center; gap:10px;">
                                    <div style="display:flex; gap:6px;">
                                    <button class="btn btn-sm btn-success" onclick="approveWithSelectedPain('${lead.id}')" style="padding: 2px 12px; font-size: 0.75rem; display:flex; align-items:center;">
                                        <span class="material-icons" style="font-size:14px; margin-right:3px;">check</span> APPROVE
                                    </button>
                                    <button class="btn btn-sm" style="border-color:var(--danger); color:var(--danger); padding: 2px 10px; font-size: 0.75rem;" onclick="updateLeadStatus('${lead.id}', 'REJECTED')">Reject</button>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    ` : ''}
                </div>

                <div class="detail-main" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                    
                    <!-- NEW: PREVIEW HEADER -->
                    <div style="padding: 10px 20px; border-bottom: 1px solid var(--border); background: var(--bg-dark); display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="material-icons text-gold" style="font-size: 1.2rem;">language</span>
                            <span class="text-sm font-bold uppercase tracking-widest" style="color: var(--text-main);">Live Website Insight</span>
                        </div>
                        ${siteUrl ? `<div class="text-xs text-muted truncate" style="max-width: 300px; font-family: monospace; opacity: 0.6;">${siteUrl}</div>` : ''}
                    </div>
                    <!-- DEVICE TOOLBAR -->
                    <div id="device-toolbar" class="preview-toolbar" style="display: ${siteUrl ? 'flex' : 'none'};">
                        <div class="device-btn active" onclick="setPreviewMode('mobile', this)"><span class="material-icons">smartphone</span> ${t('leads_mobile')}</div>
                        <div class="device-btn" onclick="setPreviewMode('tablet', this)"><span class="material-icons">tablet</span> ${t('leads_tablet')}</div>
                        <div class="device-btn" onclick="setPreviewMode('desktop', this)"><span class="material-icons">laptop</span> ${t('leads_desktop')}</div>
                        
                        <div class="dev-slider-group">
                                <span class="text-xs text-muted">${t('leads_width')}:</span>
                                <input type="range" class="dev-slider" min="320" max="1600" value="375" oninput="setCustomWidth(this.value)">
                                <span class="text-xs text-gold" id="width-display">375px</span>
                        </div>
                        
                        <div style="flex:1;"></div>

                        <!-- Explicit Blocked Help Button -->
                        <div class="device-btn" style="border-color:var(--danger); color:var(--danger);" onclick="toggleScreenshotMode('${siteUrl}')" title="${t('leads_site_blocked')}">
                            <span class="material-icons">broken_image</span> <span class="desktop-only text-xs ml-1">${t('leads_site_blocked')}</span>
                        </div>

                        <div class="device-btn" onclick="toggleScreenshotMode('${siteUrl}')" title="${t('leads_screenshot')}">
                            <span class="material-icons">image</span> <span class="desktop-only text-xs ml-1">${t('leads_screenshot')}</span>
                        </div>

                        <div class="device-btn" onclick="window.open('${siteUrl}', '_blank')" title="Open External">
                            <span class="material-icons">open_in_new</span>
                        </div>

                        <div class="device-btn" style="margin-left:5px;" onclick="reloadPreview()" title="Force Reload">
                            <span class="material-icons">refresh</span>
                        </div>
                    </div>

                    ${siteUrl ?
            `<div class="preview-container">
                            <div class="preview-frame-wrapper preview-mode-mobile" id="iframe-wrapper" style="width: 375px;">
                                <iframe src="${previewSrc}" class="preview-frame" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" onload="finishLoadTimer()" onerror="this.src='about:blank'; this.nextElementSibling.style.display='flex'"></iframe>
                                <div style="display:none; position:absolute; top:0; left:0; right:0; bottom:0; background:var(--bg-dark); align-items:center; justify-content:center; flex-direction:column; color:white;">
                                    <p>This website prevents embedding.</p>
                                    <a href="${siteUrl}" target="_blank" class="btn btn-primary">Open in New Tab</a>
                                </div>
                            </div>
                            </div>`
            :
            `<div style="display:flex; align-items:center; justify-content:center; height:100%; color: var(--text-muted);">
                            ${t('leads_no_preview')}
                        </div>`
        }
                </div>
            </div>
            <!-- Audit Modal Host -->
            <div id="audit-modal-host"></div>
        </div>
    `;

    // Initialize Resizer Logic
    initSidebarResizer();
};

function initSidebarResizer() {
    const resizer = document.getElementById("sidebar-resizer");
    const sidebar = document.getElementById("lead-sidebar");

    if (!resizer || !sidebar) return;

    let isResizing = false;

    resizer.addEventListener("mousedown", (e) => {
        isResizing = true;
        document.body.style.cursor = "col-resize";
        resizer.classList.add("resizing");
        e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
        if (!isResizing) return;

        // Calculate new width: mouse position minus sidebar offset left
        let newWidth = e.clientX - sidebar.getBoundingClientRect().left;

        // Constraints
        if (newWidth < 300) newWidth = 300;
        if (newWidth > 600) newWidth = 600;

        sidebar.style.width = `${newWidth}px`;
    });

    document.addEventListener("mouseup", () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = "default";
            resizer.classList.remove("resizing");
        }
    });
}

// --- TIMER LOGIC ---

window.startLoadTimer = () => {
    window.previewLoadStart = Date.now();
    const display = document.getElementById('load-time-display');
    if (display) {
        display.innerText = 'Loading...';
        display.style.color = 'var(--text-muted)';
    }
};

window.finishLoadTimer = () => {
    if (!window.previewLoadStart) return;
    const duration = Date.now() - window.previewLoadStart;
    const display = document.getElementById('load-time-display');
    if (display) {
        display.innerText = (duration / 1000).toFixed(2) + 's';
        display.style.fontWeight = 'bold';
        if (duration < 1000) display.style.color = 'var(--success)';
        else if (duration < 3000) display.style.color = 'var(--gold)';
        else display.style.color = 'var(--danger)';
    }
};

window.setPreviewSrc = (url, tabEl, type) => {
    // Update active tab
    document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
    tabEl.classList.add('active');

    // Toggle toolbar visibility (only show for website)
    const toolbar = document.getElementById('device-toolbar');
    if (toolbar) toolbar.style.display = type === 'website' ? 'flex' : 'none';

    // Reset to Desktop mode when switching tabs? Optional, but safer.
    if (type !== 'website') {
        setPreviewMode('desktop', null);
    }

    // Update iframe
    const frame = document.querySelector('.preview-frame');
    if (frame) {
        if (type === 'website') startLoadTimer();
        frame.src = url;
    }
};

window.reloadPreview = () => {
    const frame = document.querySelector('.preview-frame');
    if (frame && frame.src) {
        startLoadTimer();
        try {
            const url = new URL(frame.src);
            url.searchParams.set('erp_reload', Date.now()); // Cache buster
            frame.src = url.toString();
        } catch (e) {
            frame.src = frame.src; // Fallback simple reload
        }
    }
};

window.setCustomWidth = (val) => {
    const wrapper = document.getElementById('iframe-wrapper');
    const display = document.getElementById('width-display');

    // Deselect buttons
    document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));

    if (wrapper) {
        wrapper.className = 'preview-frame-wrapper preview-mode-custom';
        wrapper.style.width = val + 'px';
        if (display) display.innerText = val + 'px';
    }
};

window.setPreviewMode = (mode, btnEl) => {
    // Update Active Buttons
    if (btnEl) {
        document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
        btnEl.classList.add('active');
    } else {
        // Find desktop button and activate it if btnEl is null (reset)
        const desktopBtn = document.querySelectorAll('.device-btn')[2];
        if (desktopBtn) {
            document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
            desktopBtn.classList.add('active');
        }
    }

    // Update Wrapper Class & Reset Inline Width
    const wrapper = document.getElementById('iframe-wrapper');
    const display = document.getElementById('width-display');
    const slider = document.querySelector('.dev-slider');

    if (wrapper) {
        wrapper.style.width = ''; // Clear custom inline width
        wrapper.className = `preview-frame-wrapper preview-mode-${mode}`;

        let widthVal = '100%';
        let pixelWidth = 1200; // default for slider

        if (mode === 'mobile') { widthVal = '375px'; pixelWidth = 375; }
        if (mode === 'tablet') { widthVal = '768px'; pixelWidth = 768; }

        if (display) display.innerText = widthVal;

        // Sync slider
        if (slider) {
            slider.value = pixelWidth;
        }

        // --- RELOAD SCREENSHOT IF ACTIVE ---
        // If we are viewing a screenshot (mShots), we must reload it with the new width 
        // so the server renders the correct responsiveness.
        const frame = document.querySelector('.preview-frame');
        if (frame && frame.src.includes('mshots')) {
            // Parse the original site URL from the mshots URL
            // Format: .../v1/ENCODED_URL?w=...
            try {
                const parts = frame.src.split('/v1/');
                if (parts.length > 1) {
                    const baseUrlAndQuery = parts[1];
                    const encodedTarget = baseUrlAndQuery.split('?')[0]; // Just the url part

                    // Construct new mShots URL with new width
                    const newScreenshotUrl = `https://s0.wordpress.com/mshots/v1/${encodedTarget}?w=${pixelWidth}&h=900`;

                    console.log('Reloading Screenshot for Device Width:', pixelWidth);
                    frame.src = newScreenshotUrl;

                    if (window.startLoadTimer) window.startLoadTimer();
                }
            } catch (e) {
                console.warn("Failed to update screenshot width", e);
            }
        }
    }
};

window.toggleScreenshotMode = (url) => {
    const wrapper = document.getElementById('iframe-wrapper');
    const frame = document.querySelector('.preview-frame');

    if (frame && wrapper && url) {
        startLoadTimer();
        // WordPress mShots API
        let screenshotUrl = `https://s0.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1280&h=960`;

        if (frame.src.includes('mshots')) {
            // Revert to Live
            console.log('Reverting to Live Iframe');
            frame.src = url;
        } else {
            // Switch to Screenshot
            console.log('Switching to Screenshot Mode');
            frame.src = screenshotUrl;
        }

        // Brief timeout to "finish" loading since mshots is fast or returns immediately
        setTimeout(finishLoadTimer, 1500);
    }
};


// --- ACTION LOGIC ---

// Global variable to store last audit report
window.lastAuditReport = null;

// Helper to get API Key
function getOpenAIKey() {
    let key = localStorage.getItem('openai_api_key');
    if (!key) {
        key = prompt("Enter your OpenAI API Key to enable Deep SEO Audits:");
        if (key) localStorage.setItem('openai_api_key', key);
    }
    return key;
}

window.runDeepAudit = async (url, leadId) => {
    const container = document.getElementById('seo-report-container');
    if (!url) {
        container.innerHTML = '<p class="text-danger">Cannot audit: No URL provided.</p>';
        return;
    }

    // 1. Get Credentials
    const apiKey = getOpenAIKey();
    if (!apiKey) {
        container.innerHTML = '<p class="text-warning">Audit Cancelled: No API Key provided.</p>';
        return;
    }

    container.innerHTML = `
        <div class="text-center">
            <div class="spinner-border text-gold" role="status" style="width: 1.5rem; height: 1.5rem; border-width: 0.15em;"></div>
            <p class="text-gold blink text-xs mt-2" id="audit-status-text">Analyzing Site...</p>
        </div>
    `;

    try {
        const statusText = document.getElementById('audit-status-text');

        // 2. Fetch Website Content (with Multi-Proxy Fallback)
        let htmlContent = "";
        try {
            // Try Proxy 1: AllOrigins (Primary)
            const proxy1 = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            const resp1 = await fetch(proxy1);
            const data1 = await resp1.json();
            if (data1.contents) htmlContent = data1.contents;
        } catch (e) {
            console.warn("Primary proxy failed, trying fallback...", e);
        }

        if (!htmlContent) {
            try {
                // Try Proxy 2: Corsproxy.io (Fallback)
                const proxy2 = `https://corsproxy.io/?${encodeURIComponent(url)}`;
                const resp2 = await fetch(proxy2);
                htmlContent = await resp2.text();
            } catch (e) {
                console.error("Secondary proxy failed.", e);
            }
        }

        if (!htmlContent) throw new Error("Could not reach website. The site may be blocking access or the audit service is busy. Please try again in a moment.");

        // Extract & Truncate Head (Title, Meta, etc are critical for SEO)
        const headMatch = htmlContent.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
        let head = headMatch ? headMatch[1] : '';
        head = head.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
        head = head.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "");
        head = head.substring(0, 3000); // 3k chars is enough for meta tags

        // Extract & Truncate Body
        const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        let body = bodyMatch ? bodyMatch[1] : htmlContent;
        body = body.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
        body = body.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "");
        body = body.substring(0, 7000); // 7k chars of main content

        const cleanHtml = (`<head>${head}</head><body>${body}</body>`).replace(/\s+/g, ' ').trim();

        // 3. Send to OpenAI
        if (statusText) statusText.innerText = "Analyzing with AI...";

        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o", // Upgraded to latest flagship model
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: `You are an expert SEO, UX, and Full-Stack Developer Auditor. Analyze the provided HTML from ${url}. 
                        Your mission is to provide an ELITE technical analysis and a blueprint for a total rebuild.
                        
                        Return a JSON object with this EXACT structure:
                        {
                            "score": number (0-100),
                            "executive_summary": "A 2-3 sentence summary in plain English for a non-technical business owner explaining exactly why their site is losing money/leads.",
                            "issues": [
                                { "type": "critical"|"warning"|"success", "icon": "error"|"warning"|"check_circle", "title": "short title", "desc": "short description" }
                            ],
                            "fixes": ["fix 1", "fix 2"],
                            "tech_stack": ["Detected technology 1", "Technology 2"],
                            "performance": { "fcp_estimate": "e.g. 2.4s", "dom_complexity": "Low|Medium|High", "mobile_score": 0-100 },
                            "seo_technical": { "h1_found": boolean, "og_tags": boolean, "schema": boolean },
                            "search_visibility": "Top 10 | Page 2+ | Invisible",
                            "rebuild_prompt": "A detailed MASTER PROMPT for a CLI. Requirements: 1) Language: Plain HTML/CSS/Vanilla JS only (no frameworks), 2) Structure: One script.js with a single CONFIG object for all content, 3) UX: Mobile-first (320px first), tap targets >=44px, no horizontal scroll, 4) Design: Modern, elegant, and industry-specific color palette (CLI chooses), HD images (no stock), 5) Sections: Top Bar, Hero, Services, Reviews, Why Us, Contact Form, Map, Footer, 6) Primary CTA: 'Book a Strategy Call'. The prompt should be ready to generate a full premium site."
                        }
                        Be strict. Your generated 'rebuild_prompt' must act as a 'Pragmatic Web Designer' persona, focusing on speed, reliability, and extreme premium aesthetics without using complex dependencies. Estimate their 'search_visibility' based on the presence of H1s, meta titles, and technical crawlability.`
                    },
                    {
                        role: "user",
                        content: `Analyze this website code excerpt: \n\n ${cleanHtml}`
                    }
                ]
            })
        });

        if (!aiResponse.ok) {
            const err = await aiResponse.json();
            throw new Error("OpenAI Error: " + (err.error?.message || aiResponse.statusText));
        }

        const aiJson = await aiResponse.json();
        const content = aiJson.choices[0].message.content;
        const report = JSON.parse(content);

        // Add metadata
        report.url = url;
        report.timestamp = new Date().toLocaleString();
        report.leadId = leadId; // Include leadId for PDF saving
        window.lastAuditReport = report;

        // --- NEW: Save to Firebase ---
        if (leadId) {
            await updateDoc(doc(db, "leads", leadId), {
                lastAudit: report
            });
            // Update cache
            if (window.allLeadsCache) {
                const cached = window.allLeadsCache.find(l => l.id === leadId);
                if (cached) cached.lastAudit = report;
            }
        }

        // 4. Render
        const score = report.score;
        container.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px; margin-bottom:1rem;">
                <div class="seo-score-circle" style="width:60px; height:60px; font-size:1.2rem; background: conic-gradient(var(--${score > 70 ? 'success' : 'warning'}) 0% ${score}%, rgba(255,255,255,0.1) 0% 100%);">
                    <span style="font-weight:bold;">${score}</span>
                </div>
                <div>
                     <div class="text-h" style="font-size:1.1rem;">AI Audit Complete</div>
                     <div class="text-xs text-muted">${report.issues.length} Issues Found</div>
                </div>
            </div>
            
            <button class="btn btn-primary btn-block btn-sm" onclick="openAuditPopup()">View Full Report</button>
            <div class="text-center" style="margin-top:0.5rem;"><a href="javascript:void(0)" class="text-xs text-muted" onclick="runDeepAudit('${url}', '${leadId}')">Run Again</a></div>
        `;

        // Automatically open the report for the user "right away"
        openAuditPopup();

    } catch (e) {
        console.error(e);
        container.innerHTML = `<p class="text-danger text-sm">Error: ${e.message}</p>`;
    }
};

window.openAuditPopup = () => {
    let report = window.lastAuditReport;
    if (!report) return;

    const host = document.getElementById('audit-modal-host');

    const issuesHtml = report.issues.map(i => `
        <div style="display:flex; gap:12px; margin-bottom:12px; padding:12px; background:rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius:12px;">
            <div style="width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:rgba(${i.type === 'critical' ? '244,67,54' : (i.type === 'warning' ? '255,152,0' : '76,175,80')}, 0.1);">
                <span class="material-icons" style="font-size:20px; color:var(--${i.type === 'critical' ? 'danger' : (i.type === 'warning' ? 'warning' : 'success')})">${i.icon}</span>
            </div>
            <div style="flex:1;">
                <div style="font-weight:bold; font-size:1rem; color:var(--text-main);">${i.title}</div>
                <div class="text-sm text-muted" style="line-height:1.4;">${i.desc}</div>
            </div>
        </div>
    `).join('');

    const fixesHtml = report.fixes.map(f => `
        <div style="display:flex; align-items:flex-start; gap:10px; margin-bottom:8px;">
            <span class="material-icons text-success" style="font-size:16px; margin-top:2px;">check_circle</span>
            <span class="text-sm" style="color:var(--text-main);">${f}</span>
        </div>
    `).join('');

    host.innerHTML = `
        <div class="crm-modal-overlay" style="z-index:9999; backdrop-filter: blur(12px); background: rgba(0,0,0,0.85);" onclick="document.getElementById('audit-modal-host').innerHTML=''">
            <div class="crm-modal-content" style="max-width:900px; padding:0; overflow:hidden; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); border-radius:24px;" onclick="event.stopPropagation()">
                
                <!-- HEADER WITH SCORE -->
                <div id="pdf-header" style="padding: 2.5rem; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-bottom: 1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:25px;">
                        <div class="seo-score-circle" style="width:100px; height:100px; font-size:2rem; margin:0; position:relative; background: conic-gradient(var(--${report.score > 70 ? 'success' : 'warning'}) 0% ${report.score}%, rgba(255,255,255,0.05) 0% 100%);">
                            <span style="font-weight:bold; z-index:2; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">${report.score}</span>
                            <div style="position:absolute; inset:6px; background:#0f172a; border-radius:50%; z-index:1;"></div>
                        </div>
                        <div>
                            <div class="text-h" style="font-size:1.6rem; letter-spacing:1px; color:white;">TECHNICAL INTELLIGENCE REPORT</div>
                            <div class="text-sm text-info" style="font-family:monospace; opacity:0.9;">Analyze Target: ${report.url}</div>
                            <div style="display:flex; gap:10px; margin-top:10px;">
                                ${(report.tech_stack || []).map(t => `<span class="badge" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); font-size:0.65rem;">${t}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="crm-modal-body" id="pdf-content" style="padding:2.5rem; max-height:75vh; overflow-y:auto; background: #0f172a;">
                    
                    <!-- EXECUTIVE SUMMARY -->
                    <div style="margin-bottom:30px; padding:20px; background:rgba(255,255,255,0.03); border-left:4px solid var(--gold); border-radius:0 15px 15px 0;">
                        <div class="text-gold uppercase font-bold text-xs tracking-widest mb-2">Executive Summary for Business Owner</div>
                        <p style="color:var(--text-main); font-size:1.05rem; line-height:1.6; font-style:italic;">
                            "${report.executive_summary || 'This website faces significant challenges in user engagement and search visibility, primarily due to outdated technical architecture and non-responsive design fragments.'}"
                        </p>
                    </div>

                    <!-- TECH SPECS ROW -->
                    <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:12px; margin-bottom:30px;">
                        <div class="card" style="padding:15px; background:rgba(255,255,255,0.02); text-align:center; border:1px solid rgba(255,255,255,0.05);">
                            <div class="text-xs text-muted uppercase mb-1">Load Speed</div>
                            <div class="text-gold font-bold" style="font-size:1.1rem;">${report.performance?.fcp_estimate || 'N/A'}</div>
                        </div>
                        <div class="card" style="padding:15px; background:rgba(255,255,255,0.02); text-align:center; border:1px solid rgba(255,255,255,0.05);">
                            <div class="text-xs text-muted uppercase mb-1">DOM Depth</div>
                            <div class="text-info font-bold" style="font-size:1.1rem;">${report.performance?.dom_complexity || 'Medium'}</div>
                        </div>
                        <div class="card" style="padding:15px; background:rgba(255,255,255,0.02); text-align:center; border:1px solid rgba(255,255,255,0.05);">
                            <div class="text-xs text-muted uppercase mb-1">Search Page</div>
                            <div class="text-warning font-bold" style="font-size:1.1rem;">${report.search_visibility || 'Page 2+'}</div>
                        </div>
                        <div class="card" style="padding:15px; background:rgba(255,255,255,0.02); text-align:center; border:1px solid rgba(255,255,255,0.05);">
                            <div class="text-xs text-muted uppercase mb-1">SEO Tags</div>
                            <div class="${report.seo_technical?.og_tags ? 'text-success' : 'text-danger'} font-bold" style="font-size:1.1rem;">${report.seo_technical?.og_tags ? 'DETECTED' : 'MISSING'}</div>
                        </div>
                        <div class="card" style="padding:15px; background:rgba(255,255,255,0.02); text-align:center; border:1px solid rgba(255,255,255,0.05);">
                            <div class="text-xs text-muted uppercase mb-1">Schema</div>
                            <div class="${report.seo_technical?.schema ? 'text-success' : 'text-danger'} font-bold" style="font-size:1.1rem;">${report.seo_technical?.schema ? 'ACTIVE' : 'INACTIVE'}</div>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:30px;">
                        <!-- LEFT COLUMN: FINDINGS -->
                        <div>
                             <div class="text-sm font-bold uppercase tracking-widest mb-4" style="color:var(--text-muted); display:flex; align-items:center; gap:8px;">
                                <span class="material-icons" style="font-size:18px; color:var(--gold);">visibility</span> Strategic Findings
                            </div>
                            ${issuesHtml}
                            
                            <div class="text-sm font-bold uppercase tracking-widest mt-6 mb-4" style="color:var(--text-muted); display:flex; align-items:center; gap:8px;">
                                <span class="material-icons" style="font-size:18px; color:var(--success);">build</span> Recommended Fixes
                            </div>
                            <div style="background: rgba(76, 175, 80, 0.03); border: 1px solid rgba(76, 175, 80, 0.1); padding:20px; border-radius:15px;">
                                ${fixesHtml}
                            </div>
                        </div>

                        <!-- RIGHT COLUMN: REBUILD BLUEPRINT -->
                        <div id="pdf-rebuild-col" style="display:flex; flex-direction:column; gap:20px;">
                            <div style="background: linear-gradient(135deg, rgba(223, 165, 58, 0.1) 0%, rgba(223, 165, 58, 0) 100%); border: 1px solid rgba(223, 165, 58, 0.2); padding:2rem; border-radius:24px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                                    <div class="text-h text-gold" style="font-size:1.1rem; display:flex; align-items:center; gap:10px;">
                                        <span class="material-icons">code</span> CLI REBUILD BLUEPRINT
                                    </div>
                                    <button class="btn btn-xs btn-secondary" onclick="copyRebuildPrompt()">
                                        <span class="material-icons" style="font-size:14px; margin-right:4px;">content_copy</span> COPY
                                    </button>
                                </div>
                                <p class="text-xs text-muted mb-4" style="line-height:1.6;">Use the prompt below in your AI CLI tools to instantly generate a premium, modernized version of this website.</p>
                                <div id="rebuild-prompt-text" style="background:rgba(0,0,0,0.3); padding:15px; border-radius:12px; font-family:monospace; font-size:0.75rem; color:var(--text-main); line-height:1.5; border:1px solid rgba(255,255,255,0.05); max-height:300px; overflow-y:auto; word-break:break-word;">
                                    ${report.rebuild_prompt || 'Generating CLI blueprint...'}
                                </div>
                            </div>
                            
                            <div style="background:var(--bg-dark); border:1px solid var(--border); padding:1.5rem; border-radius:20px; display:flex; align-items:center; gap:15px;">
                                <span class="material-icons text-info" style="font-size:32px;">rocket_launch</span>
                                <div>
                                    <div class="text-xs text-info uppercase font-bold">Sales Strategy</div>
                                    <div class="text-xs text-muted" style="line-height:1.4;">"I noticed your current site is built on <strong>${report.tech_stack?.[0] || 'older tech'}</strong>. We can migrate you to a <strong>Next.js</strong> architecture today for zero downtime."</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="padding:1.5rem; background:#0f172a; border-top:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
                     <div style="display:flex; gap:10px;">
                         <button class="btn btn-secondary btn-sm" onclick="downloadAuditPDF()" style="display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.05); border-color:rgba(255,255,255,0.1);">
                             <span class="material-icons">download_for_offline</span> DOWNLOAD PDF
                         </button>
                         <button class="btn btn-sm" onclick="openFullReportPage()" style="display:flex; align-items:center; gap:10px; background:rgba(223, 165, 58, 0.1); border-color:var(--gold); color:var(--gold);">
                             <span class="material-icons">open_in_new</span> OPEN FULL REPORT PAGE
                         </button>
                     </div>
                     <div style="display:flex; gap:10px;">
                        <button class="icon-btn" style="background:rgba(255,255,255,0.05); padding:8px;" onclick="document.getElementById('audit-modal-host').innerHTML=''"><span class="material-icons">close</span></button>
                        <button class="btn btn-primary btn-sm" style="min-width:150px; border-radius:10px;" onclick="document.getElementById('audit-modal-host').innerHTML=''">Done</button>
                     </div>
                </div>
            </div>
        </div>
    `;
};

// Open the full report page (report.html) with the audit data
window.openFullReportPage = () => {
    const report = window.lastAuditReport;
    if (!report) {
        alert('No audit report available. Please run an audit first.');
        return;
    }

    // Save the report to localStorage for the report page to read
    localStorage.setItem('auditReport', JSON.stringify(report));

    // Open report.html in a new tab
    window.open('/report.html', '_blank');
};

window.downloadAuditPDF = async () => {
    const report = window.lastAuditReport;
    if (!report) return;

    // 1. FORCED VIEWPORT RESET (Crucial for html2canvas alignment)
    const savedScrollY = window.scrollY;
    window.scrollTo(0, 0);

    const leadName = (report.business_name || 'Technical_Audit').replace(/[^a-z0-9]/gi, '_');

    // 2. SOLID LOADING OVERLAY
    const overlay = document.createElement('div');
    overlay.id = 'pdf-gen-overlay';
    overlay.setAttribute('style', `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: #0f172a; z-index: 100000;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        color: white; font-family: sans-serif;
    `);
    overlay.innerHTML = `
        <div style="text-align:center;">
            <div style="width:50px; height:50px; border:5px solid #dfa53a; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto 20px;"></div>
            <div style="font-size:1.5rem; font-weight:bold; letter-spacing:2px; text-transform:uppercase;">Packaging Report Assets</div>
            <div style="color:#dfa53a; margin-top:10px; font-weight:bold;">Please do not close this tab...</div>
        </div>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(overlay);

    const COLORS = { bg: '#0f172a', gold: '#dfa53a', text: '#ffffff', border: 'rgba(255,255,255,0.1)', success: '#4caf50', warning: '#ff9800' };

    try {
        // 3. CREATE THE TEMPORARY CONTAINER
        const pdfWrapper = document.createElement('div');
        pdfWrapper.id = 'render-target';
        pdfWrapper.setAttribute('style', `
            position: absolute; top: 0; left: 0; width: 750px; background: ${COLORS.bg};
            z-index: 50000; visibility: visible; color: white;
        `);

        const footer = (p) => `
            <div style="position:absolute; bottom:30px; left:50px; right:50px; border-top:1px solid ${COLORS.border}; padding-top:15px; display:flex; justify-content:space-between; align-items:center; font-family:sans-serif;">
                <span style="font-size:10px; color:${COLORS.gold}; font-weight:bold; letter-spacing:1px;">PREMIUM QUASAR • TECHNICAL AUDIT</span>
                <span style="font-size:10px; opacity:0.5;">0${p} / 04</span>
            </div>
        `;

        const renderPage = (content, num) => {
            const div = document.createElement('div');
            if (num > 1) div.className = 'html2pdf__page-break';
            div.setAttribute('style', `
                width: 750px; height: 1050px; padding: 70px; position: relative;
                box-sizing: border-box; background: ${COLORS.bg}; overflow: hidden;
            `);
            div.innerHTML = content + footer(num);
            return div;
        };

        // ICONS (Inline SVG to avoid font loading issues)
        const checkIcon = `<svg style="width:24px; height:24px; color:${COLORS.success}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>`;
        const warnIcon = `<svg style="width:24px; height:24px; color:${COLORS.warning}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
        const dangerIcon = `<svg style="width:24px; height:24px; color:${COLORS.danger}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;

        // Score color based on value
        const scoreColor = report.score >= 70 ? COLORS.success : (report.score >= 50 ? COLORS.warning : COLORS.danger);
        const circumference = 2 * Math.PI * 45; // r=45
        const dashOffset = circumference - (circumference * report.score / 100);

        // DYNAMIC STATUS: Technical SEO
        const issues = report.issues || [];
        const criticalCount = issues.filter(i => i.type === 'critical').length;
        const warningCount = issues.filter(i => i.type === 'warning').length;

        let techSeoVal = 'OPTIMIZED';
        let techSeoColor = COLORS.success;

        if (criticalCount > 0) {
            techSeoVal = 'CRITICAL';
            techSeoColor = COLORS.danger;
        } else if (warningCount > 1 || report.score < 70) {
            techSeoVal = 'NEEDS WORK';
            techSeoColor = COLORS.warning;
        }

        // DYNAMIC STATUS: Structured Data
        const hasSchema = (report.seo_technical && report.seo_technical.schema) ||
            issues.some(i => i.type === 'success' && (i.title.includes('Schema') || i.title.includes('Structured Data')));

        const structVal = hasSchema ? 'ACTIVE' : 'MISSING';
        const structColor = hasSchema ? COLORS.success : COLORS.danger;

        // PAGE 1: HERO with SVG Score Ring
        const page1 = `
            <!-- Header with Score Ring -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 50px; font-family: sans-serif;">
                <div style="display: flex; align-items: center; gap: 25px;">
                    <!-- Score Ring using CSS border technique -->
                    <div style="width: 120px; height: 120px; position: relative;">
                        <!-- Outer colored ring -->
                        <div style="width: 120px; height: 120px; border-radius: 50%; border: 10px solid ${scoreColor}; box-sizing: border-box; opacity: 0.2;"></div>
                        <!-- Progress ring overlay -->
                        <div style="position: absolute; top: 0; left: 0; width: 120px; height: 120px; border-radius: 50%; border: 10px solid transparent; border-top-color: ${scoreColor}; border-right-color: ${report.score > 25 ? scoreColor : 'transparent'}; border-bottom-color: ${report.score > 50 ? scoreColor : 'transparent'}; border-left-color: ${report.score > 75 ? scoreColor : 'transparent'}; box-sizing: border-box; transform: rotate(-45deg);"></div>
                        <!-- Inner content -->
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; z-index: 2;">
                            <div style="font-size: 2.5rem; font-weight: 900; color: ${scoreColor}; line-height: 1;">${report.score}</div>
                            <div style="font-size: 0.4rem; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 5px; font-weight: 700; line-height: 1.3;">YOUR WEBSITE<br/>SCORE</div>
                        </div>
                    </div>
                    <!-- Title -->
                    <div>
                        <div style="font-size: 1.6rem; font-weight: 800; letter-spacing: 2px; color: white;">INTELLIGENCE REPORT</div>
                        <div style="font-size: 0.8rem; color: ${COLORS.gold}; font-family: monospace; margin-top: 5px;">${report.url}</div>
                        <div style="font-size: 0.7rem; color: rgba(255,255,255,0.4); margin-top: 3px;">Web HTML5 CSS3</div>
                    </div>
                </div>
                <!-- Company Branding -->
                <div style="text-align: right;">
                    <div style="font-size: 0.65rem; letter-spacing: 2px; color: ${COLORS.gold}; font-weight: bold;">✦ SOLUTIONS</div>
                    <div style="font-size: 1.2rem; font-weight: 900; letter-spacing: 3px; color: white;">QUASAR</div>
                    <div style="font-size: 0.6rem; color: rgba(255,255,255,0.5); margin-top: 3px;">Premium Web Engineering</div>
                </div>
            </div>

            <!-- Executive Summary Badge -->
            <div style="text-align: center; margin: 50px 0 30px;">
                <span style="display: inline-block; padding: 10px 30px; border: 1px solid rgba(255,255,255,0.2); border-radius: 50px; font-size: 0.7rem; letter-spacing: 3px; color: rgba(255,255,255,0.7); text-transform: uppercase; font-weight: bold;">Executive Summary</span>
            </div>

            <!-- Summary Quote -->
            <div style="text-align: center; padding: 0 30px; margin-bottom: 60px;">
                <div style="font-size: 1.3rem; line-height: 1.8; color: white; font-style: italic; font-weight: 300;">
                    "${report.executive_summary || 'The website is underperforming due to poor loading speeds, suboptimal mobile design, and a lack of essential SEO practices.'}"
                </div>
            </div>

            <!-- Metrics Grid - 2 rows of 3 -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
                <div style="padding: 25px; background: rgba(255,255,255,0.02); border: 1px solid ${COLORS.border}; border-radius: 15px; text-align: center;">
                    <div style="font-size: 0.65rem; opacity: 0.5; margin-bottom: 8px; letter-spacing: 1px; text-transform: uppercase;">Load Estimate</div>
                    <div style="font-size: 1.5rem; font-weight: bold; color: white;">${report.performance?.fcp_estimate || '4.6s'}</div>
                </div>
                <div style="padding: 25px; background: rgba(255,255,255,0.02); border: 1px solid ${COLORS.border}; border-radius: 15px; text-align: center;">
                    <div style="font-size: 0.65rem; opacity: 0.5; margin-bottom: 8px; letter-spacing: 1px; text-transform: uppercase;">Search Presence</div>
                    <div style="font-size: 1.5rem; font-weight: bold; color: white;">${report.search_visibility || 'Invisible'}</div>
                </div>
                <div style="padding: 25px; background: rgba(255,255,255,0.02); border: 1px solid ${COLORS.border}; border-radius: 15px; text-align: center;">
                    <div style="font-size: 0.65rem; opacity: 0.5; margin-bottom: 8px; letter-spacing: 1px; text-transform: uppercase;">DOM Complexity</div>
                    <div style="font-size: 1.5rem; font-weight: bold; color: ${COLORS.warning};">${report.performance?.dom_complexity || 'High'}</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                <div style="padding: 25px; background: rgba(255,255,255,0.02); border: 1px solid ${COLORS.border}; border-radius: 15px; text-align: center;">
                    <div style="font-size: 0.65rem; opacity: 0.5; margin-bottom: 8px; letter-spacing: 1px; text-transform: uppercase;">Technical SEO</div>
                    <div style="font-size: 1.5rem; font-weight: bold; color: ${techSeoColor};">${techSeoVal}</div>
                </div>
                <div style="padding: 25px; background: rgba(255,255,255,0.02); border: 1px solid ${COLORS.border}; border-radius: 15px; text-align: center;">
                    <div style="font-size: 0.65rem; opacity: 0.5; margin-bottom: 8px; letter-spacing: 1px; text-transform: uppercase;">Structured Data</div>
                    <div style="font-size: 1.5rem; font-weight: bold; color: ${structColor};">${structVal}</div>
                </div>
                <div style="padding: 25px; background: rgba(255,255,255,0.02); border: 1px solid ${COLORS.border}; border-radius: 15px; text-align: center;">
                    <div style="font-size: 0.65rem; opacity: 0.5; margin-bottom: 8px; letter-spacing: 1px; text-transform: uppercase;">Mobile Score</div>
                    <div style="font-size: 1.5rem; font-weight: bold; color: white;">${report.performance?.mobile_score || '62%'}</div>
                </div>
            </div>
        `;

        const issuesHtml = report.issues.slice(0, 5).map(i => {
            // Premium high-tech icons based on issue type
            let icon, gradientBg, borderColor, glowColor;

            if (i.type === 'critical') {
                // Red critical - filled circle with X
                gradientBg = 'linear-gradient(135deg, rgba(244,67,54,0.2) 0%, rgba(183,28,28,0.3) 100%)';
                borderColor = 'rgba(244,67,54,0.4)';
                glowColor = 'rgba(244,67,54,0.3)';
                icon = `<svg style="width:22px; height:22px;" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" fill="${COLORS.danger}"/>
                    <path d="M15 9L9 15M9 9l6 6" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                </svg>`;
            } else if (i.type === 'success' || i.type === 'good') {
                // Green success - filled circle with checkmark
                gradientBg = 'linear-gradient(135deg, rgba(76,175,80,0.2) 0%, rgba(27,94,32,0.3) 100%)';
                borderColor = 'rgba(76,175,80,0.4)';
                glowColor = 'rgba(76,175,80,0.3)';
                icon = `<svg style="width:22px; height:22px;" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" fill="${COLORS.success}"/>
                    <path d="M8 12l3 3 5-6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </svg>`;
            } else {
                // Orange warning - filled triangle
                gradientBg = 'linear-gradient(135deg, rgba(255,152,0,0.2) 0%, rgba(230,81,0,0.3) 100%)';
                borderColor = 'rgba(255,152,0,0.4)';
                glowColor = 'rgba(255,152,0,0.3)';
                icon = `<svg style="width:22px; height:22px;" viewBox="0 0 24 24">
                    <path d="M12 3L2 21h20L12 3z" fill="${COLORS.warning}"/>
                    <line x1="12" y1="10" x2="12" y2="14" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                    <circle cx="12" cy="17" r="1.2" fill="white"/>
                </svg>`;
            }

            return `
                <div style="display:flex; gap:18px; align-items:flex-start; padding: 18px 20px; margin-bottom: 12px; background: rgba(255,255,255,0.015); border: 1px solid ${COLORS.border}; border-radius: 12px; font-family: sans-serif;">
                    <div style="width:44px; height:44px; border-radius:12px; background:${gradientBg}; border:1px solid ${borderColor}; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow: 0 4px 15px ${glowColor};">
                        ${icon}
                    </div>
                    <div style="flex:1; padding-top:2px;">
                        <div style="font-weight: 700; font-size: 1rem; color: #fff; margin-bottom: 5px; letter-spacing: 0.3px;">${i.title}</div>
                        <div style="font-size: 0.8rem; color: rgba(255,255,255,0.55); line-height: 1.6;">${i.desc}</div>
                    </div>
                </div>
            `;
        }).join('');

        const page2 = `
            <div style="font-family: sans-serif; margin-bottom: 10px;">
                <div style="font-size: 0.7rem; color: ${COLORS.gold}; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;">02 / STRATEGIC AUDIT</div>
                <div style="position:absolute; top:60px; right:60px; font-size:0.65rem; color:rgba(255,255,255,0.4); font-family:monospace;">${report.url}</div>
            </div>
            <div style="display:flex; align-items:center; gap:15px; margin-bottom: 35px;">
                <svg style="width:28px; height:28px;" viewBox="0 0 24 24" fill="none" stroke="${COLORS.danger}" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div style="font-size: 1.8rem; font-weight: 800; color: white; letter-spacing: 2px;">DETAILED FINDINGS</div>
            </div>
            ${issuesHtml}
        `;

        const fixesHtml = report.fixes.slice(0, 6).map(f => `
            <div style="display:flex; gap:15px; align-items:center; padding: 22px; margin-bottom: 15px; background: rgba(76,175,80,0.05); border: 1px solid rgba(76,175,80,0.1); border-radius: 15px; font-family: sans-serif;">
                ${checkIcon}
                <div style="font-weight: 500; font-size: 1.15rem; color: white;">${f}</div>
            </div>
        `).join('');

        const page3 = `
            <div style="font-family: sans-serif; margin-bottom: 40px;">
                <div style="font-size: 2.2rem; font-weight: 800; color: white;">Remediation Path</div>
                <div style="height: 5px; width: 80px; background: ${COLORS.success}; margin-top: 15px;"></div>
            </div>
            ${fixesHtml}
        `;

        const page4 = `
            <div style="margin-top: 120px; background: linear-gradient(135deg, #0b0d10 0%, #1e293b 100%); padding: 120px 60px; border-radius: 48px; border: 1px solid ${COLORS.gold}; text-align: center; font-family: sans-serif;">
                <div style="color: ${COLORS.gold}; font-weight: 900; font-size: 1.2rem; margin-bottom: 30px; letter-spacing: 4px;">THE NEXT STEP</div>
                <div style="font-size: 3.5rem; font-weight: 900; color: white; margin-bottom: 40px; line-height: 1.1;">Secure Your Lead Flow.</div>
                <p style="color: rgba(255,255,255,0.7); line-height: 2.0; margin-bottom: 80px; font-size: 1.3rem;">We specialize in high-performance migration and lead generation systems.</p>
                <div style="display: flex; flex-direction: column; gap: 30px; align-items: center;">
                    <div style="font-size: 2rem; font-weight: 800; color: white; border-bottom: 2px solid ${COLORS.gold}; padding-bottom: 10px;">solutionsquasar.ca</div>
                </div>
            </div>
        `;

        pdfWrapper.appendChild(renderPage(page1, 1));
        pdfWrapper.appendChild(renderPage(page2, 2));
        pdfWrapper.appendChild(renderPage(page3, 3));
        pdfWrapper.appendChild(renderPage(page4, 4));
        document.body.appendChild(pdfWrapper);

        const opt = {
            margin: 0,
            filename: `Audit_${leadName}.pdf`,
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // 4. CAPTURE AND GENERATE PDF USING DIRECT LIBRARIES
        setTimeout(async () => {
            try {
                console.log("Starting PDF generation with direct libraries...");
                console.log("Element dimensions:", pdfWrapper.offsetWidth, "x", pdfWrapper.offsetHeight);

                // Step 1: Capture with html2canvas
                const canvas = await html2canvas(pdfWrapper, {
                    scale: 2,
                    useCORS: true,
                    logging: true,
                    backgroundColor: '#0f172a',
                    scrollX: 0,
                    scrollY: 0
                });

                console.log("Canvas captured:", canvas.width, "x", canvas.height);

                // Step 2: Create PDF with jsPDF
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });

                const pageWidth = 210; // A4 width in mm
                const pageHeight = 297; // A4 height in mm
                const imgWidth = pageWidth;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;

                // Calculate how many pages we need
                const totalPages = Math.ceil(imgHeight / pageHeight);
                console.log("Total pages needed:", totalPages);

                // Add the image as a single long image (jsPDF will handle overflow)
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                console.log("Image data length:", imgData.length);

                let heightLeft = imgHeight;
                let position = 0;

                // Add first page
                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;

                // Add additional pages if needed
                while (heightLeft > 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;
                }

                // Save the PDF
                pdf.save(`Audit_${leadName}.pdf`);
                console.log("PDF saved successfully!");

                document.body.removeChild(pdfWrapper);
                overlay.remove();
                window.scrollTo(0, savedScrollY);

            } catch (err) {
                console.error("PDF Generation Error:", err);
                overlay.remove();
                window.scrollTo(0, savedScrollY);
            }
        }, 2500);

    } catch (e) {
        console.error("PDF Logic Setup Error:", e);
        if (overlay) overlay.remove();
        window.scrollTo(0, savedScrollY);
    }
};

window.copyRebuildPrompt = () => {
    const text = document.getElementById('rebuild-prompt-text').innerText;
    const btn = event.currentTarget;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons" style="font-size:14px; margin-right:4px;">check</span> COPIED';
    setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
};

// ... Rest of status update logic (same as before) ...

function getStatusColor(status) {
    switch (status) {
        case 'NEW': return 'var(--gold)';
        case 'APPROVED': return 'var(--success)';
        case 'REJECTED': return 'var(--danger)';
        default: return 'var(--border)';
    }
}

function renderActionButtons(id, status) {
    if (status === 'NEW') {
        return ''; // Buttons removed from list view as requested
    }
    if (status === 'APPROVED') {
        return ''; // Queue removed
    }
    return '';
}

window.updateLeadStatus = async (id, newStatus, category = null) => {
    try {
        let updateData = {
            status: newStatus,
            updated_at: new Date().toISOString()
        };

        // If Approving, use provided category or default
        if (newStatus === 'APPROVED' && category) {
            updateData.lead_quality_category = category;

            // If "Other", prompt for specific notes
            if (category === 'OTHER') {
                const note = prompt("Please enter a note for why this is 'Other' (optional):");
                if (note) {
                    updateData.notes = note;
                }
            }
        }

        const ref = doc(db, "leads", id);
        await updateDoc(ref, updateData);

        // --- NEW: Trigger Automation ---
        if (newStatus === 'APPROVED') {
            triggerWorkflowForLead(id);
        }

        // Close overlay via URL reset
        window.location.hash = '#leads';

        // Refresh list
        const activeBtn = document.querySelector('button[data-filter].btn-primary');
        if (activeBtn) activeBtn.click();

    } catch (e) {
        console.error(e);
        alert('Error updating status');
    }
};

// --- LEAD ASSIGNMENT ---
window.openAssignModal = async (leadId) => {
    // We reuse the audit-modal-host for convenience or create a new one
    let host = document.getElementById('audit-modal-host');

    const options = await getTeamDropdownOptions();

    host.innerHTML = `
        <div class="crm-modal-overlay" onclick="document.getElementById('audit-modal-host').innerHTML=''">
            <div class="crm-modal-content" style="max-width:400px;" onclick="event.stopPropagation()">
                <div class="crm-modal-header">
                    <div class="text-h">Assign Lead</div>
                    <button class="icon-btn" onclick="document.getElementById('audit-modal-host').innerHTML=''"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body">
                    <input type="hidden" id="assign-lead-id" value="${leadId}">
                    <div class="form-group">
                        <label class="form-label">Select Sales Agent</label>
                        <select id="assign-agent-select" class="form-input" style="background:var(--bg-dark); color:white;">
                            ${options}
                        </select>
                    </div>
                    <button class="btn btn-primary btn-block mt-3" onclick="assignLead()">Confirm Assignment</button>
                </div>
            </div>
        </div>
    `;
};

window.assignLead = async () => {
    const leadId = document.getElementById('assign-lead-id').value;
    const select = document.getElementById('assign-agent-select');
    const agentId = select.value;
    const agentName = select.options[select.selectedIndex].text;

    if (!agentId) return;

    try {
        await updateDoc(doc(db, "leads", leadId), {
            assigned_to: agentId,
            assigned_to_name: agentName, // Storing name for easier display
            updated_at: new Date().toISOString()
        });

        document.getElementById('audit-modal-host').innerHTML = ''; // Close modal
        window.location.hash = '#leads'; // Close detail detail via URL reset

        // Refresh list
        const activeBtn = document.querySelector('button[data-filter].btn-primary');
        if (activeBtn) activeBtn.click();

    } catch (e) {
        console.error(e);
        alert('Error updating status');
    }
};

window.handleCSVImport = async (input) => {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) {
            alert("CSV file seems empty or has no data rows.");
            return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

        // Simple mapping helper
        const findIdx = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));

        const idxName = findIdx(['name', 'business', 'company', 'lead']);
        const idxEmail = findIdx(['email', 'mail']);
        const idxPhone = findIdx(['phone', 'tel', 'mobile', 'cell']);
        const idxWeb = findIdx(['web', 'url', 'site']);
        const idxAddr = findIdx(['address', 'location', 'city']);
        const idxCat = findIdx(['category', 'industry', 'type']);

        if (idxName === -1) {
            alert("Could not detect a 'Name' or 'Business Name' column in CSV.");
            return;
        }

        let addedCount = 0;
        const confirmMsg = `Found ${lines.length - 1} rows. Importing...`;
        console.log(confirmMsg);

        // Inform user it started
        const btn = document.querySelector('.btn-secondary');
        if (btn && btn.innerText.includes('Import')) btn.innerText = 'Importing...';

        for (let i = 1; i < lines.length; i++) {
            // Split by comma ignoring quoted commas
            const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''));

            const leadData = {
                business_name: cols[idxName] || 'Unknown',
                email: idxEmail > -1 ? (cols[idxEmail] || '') : '',
                phone: idxPhone > -1 ? (cols[idxPhone] || '') : '',
                website: idxWeb > -1 ? (cols[idxWeb] || '') : '',
                address: idxAddr > -1 ? (cols[idxAddr] || '') : '',
                category: idxCat > -1 ? (cols[idxCat] || 'Imported') : 'Imported',
                status: 'NEW', // Default status
                rating: 0,
                reviews: 0,
                source: 'CSV Import',
                created_at: new Date().toISOString()
            };

            try {
                await addDoc(collection(db, "leads"), leadData);
                addedCount++;
            } catch (err) {
                console.error("Error adding row " + i, err);
            }
        }

        alert(`Successfully imported ${addedCount} leads!`);
        input.value = ''; // Reset
        if (btn && btn.innerText === 'Importing...') btn.innerHTML = '<span class="material-icons" style="font-size:1.1rem;">upload_file</span> Import CSV';

        // Reload leads (New status)
        const newFilterBtn = document.querySelector('button[data-filter="NEW"]');
        if (newFilterBtn) newFilterBtn.click();
    };

    reader.readAsText(file);
};


window.openImportModal = () => {
    let host = document.getElementById('import-modal-host');
    if (!host) {
        host = document.createElement('div');
        host.id = 'import-modal-host';
        document.body.appendChild(host);
    }

    host.innerHTML = `
        <div class="crm-modal-overlay" onclick="this.parentElement.remove()">
            <div class="crm-modal-content" style="max-width:500px;" onclick="event.stopPropagation()">
                <div class="crm-modal-header">
                    <div class="text-h">Import Leads CSV</div>
                    <button class="icon-btn" onclick="document.getElementById('import-modal-host').remove()"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body">
                    <p class="text-muted mb-2">Import leads in bulk by uploading a CSV file.</p>
                    <p class="text-muted text-sm mb-4">Your CSV <b>must</b> contain a header row with the following columns (flexible naming):</p>
                    
                    <ul class="text-sm text-muted" style="margin-bottom:1.5rem; line-height:1.6;">
                        <li><b class="text-gold">Business Name</b> (Required)</li>
                        <li>Email</li>
                        <li>Phone / Tel</li>
                        <li>Website</li>
                        <li>Address</li>
                        <li>Category / Industry</li>
                    </ul>
                    
                    <div style="background:var(--bg-dark); padding:1rem; border-radius:6px; border:1px solid var(--border); font-family:monospace; font-size:0.8rem; color:var(--text-muted); margin-bottom:1.5rem;">
                        Business Name, Email, Phone, Website, Category<br>
                        <span style="color:var(--gold);">Acme Inc</span>, contact@acme.com, 555-0123, acme.com, Tech<br>
                        <span style="color:var(--gold);">Dental Care</span>, info@dental.com, 555-0987, dental.com, Health
                    </div>
                </div>
                <div style="display:flex !important; justify-content:center !important; align-items:center !important; gap:15px; margin-top:2rem; width:100%; border-top:1px solid rgba(255,255,255,0.1); padding-top:1rem;">
                    <button class="btn btn-secondary" onclick="document.getElementById('import-modal-host').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="document.getElementById('csv-file-input').click(); document.getElementById('import-modal-host').remove()">Select CSV File</button>
                </div>
            </div>
        </div>
    `;
};

// --- EMAIL COMPOSER ---
window.openEmailComposer = (email, name) => {
    // Only open if email exists
    if (!email || email === 'undefined') {
        alert("No valid email address found for this lead.");
        return;
    }

    const modalId = 'email-composer-modal';
    let modal = document.getElementById(modalId);

    if (modal) modal.remove();

    const html = `
    <div id="${modalId}" class="modal-overlay" style="display:flex; align-items:center; justify-content:center; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:2000;">
        <div class="card" style="width:600px; max-width:95vw; background:#15171C; border:1px solid #333;">
             <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid #333; padding-bottom:1rem;">
                <div class="text-h">New Message to <span class="text-gold">${name}</span></div>
                <button class="btn btn-sm" onclick="document.getElementById('${modalId}').remove()">✕</button>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="email-to">To:</label>
                <input type="text" id="email-to" class="form-input" value="${email}" disabled style="opacity:0.7;">
            </div>

            <div class="form-group">
                <label class="form-label" for="email-subject">Subject:</label>
                <input type="text" id="email-subject" class="form-input" value="Regarding ${name} - Opportunity">
            </div>

            <div class="form-group">
                <label class="form-label" for="email-body">Message:</label>
                <textarea id="email-body" class="form-input" rows="8" style="resize:vertical;">Hi there,

I came across ${name} and was impressed by what I saw. I'd love to connect and discuss how we can help you grow.

Best,
The Team</textarea>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:1rem;">
                <button class="btn" onclick="document.getElementById('${modalId}').remove()">Discard</button>
                <button class="btn btn-primary" onclick="sendLeadEmail('${email}')">Send Message</button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
};

window.sendLeadEmail = async (toEmail) => {
    const subject = document.getElementById('email-subject').value;
    const body = document.getElementById('email-body').value;
    const btn = document.querySelector('#email-composer-modal .btn-primary');

    if (!subject || !body) {
        showToast("Please fill in subject and message.", "error");
        return;
    }

    btn.innerText = "Sending...";
    btn.disabled = true;

    try {
        const user = auth.currentUser;
        if (!user) throw new Error("You must be logged in.");

        const token = await user.getIdToken();

        const response = await fetch(`${API_BASE}/api/send-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ to: toEmail, subject, body })
        });

        const data = await response.json();

        if (!data.success) throw new Error(data.message || data.error || 'Failed to send.');

        showToast("Email sent successfully!", "success");
        document.getElementById('email-composer-modal').remove();

    } catch (error) {
        console.error(error);
        showToast("Error sending email: " + error.message, "error");
        btn.innerText = "Send Message";
        btn.disabled = false;
    }
};

window.saveLeadDetails = async (leadId) => {
    try {
        const getVal = (id) => (document.getElementById(id) ? document.getElementById(id).value.trim() : '');

        const business_name = getVal('edit-business-name');
        const notes = getVal('edit-notes');
        const address = getVal('edit-address');
        const city = getVal('edit-city');
        const state = getVal('edit-state');
        const website = getVal('edit-website');
        const phone = getVal('edit-phone');
        const email = getVal('edit-email');

        const dm_name = getVal('edit-dm-name');
        const dm_email = getVal('edit-dm-email');
        const dm_phone = getVal('edit-dm-phone');

        // NEW: Capture Assigned Agent and Status
        const assigned_agent_id = getVal('edit-assigned-agent');
        const status = getVal('edit-lead-status');

        if (!business_name) {
            showToast("Business Name is required.", "error");
            return;
        }

        const updateData = {
            business_name,
            notes,
            address,
            city,
            state,
            website,
            phone,
            email,
            dm_name,
            dm_email,
            dm_phone,
            assigned_agent_id, // Add to payload
            status: status || 'NEW', // Add status to payload
            pain_signals: Array.from(document.querySelectorAll('#sidebar-pain-selector .pain-chip.selected')).map(el => el.dataset.value),
            updated_at: new Date().toISOString()
        };

        await updateDoc(doc(db, "leads", leadId), updateData);

        // Update the header title immediately for UX
        const headerTitle = document.querySelector('.detail-header .text-h');
        if (headerTitle) headerTitle.innerText = business_name;

        // Update Local Cache ID Match to prevent stale data if we don't reload list immediately
        if (window.allLeadsCache) {
            const cached = window.allLeadsCache.find(l => l.id === leadId);
            if (cached) {
                Object.assign(cached, updateData);
            }
        }

        // Update Actions Matrix (Sticky row)
        const actionRow = document.getElementById('lead-actions-row');
        if (actionRow) {
            actionRow.innerHTML = `
                <button class="btn btn-sm" onclick="sendLeadToSelf('${leadId}')" title="Send info to my phone" style="background:rgba(255,255,255,0.05); border:1px solid var(--border); padding: 0 12px;">
                    <span class="material-icons" style="font-size:20px;">smartphone</span>
                </button>
                
                ${email ?
                    `<button class="btn btn-sm btn-secondary" onclick="openEmailComposer(document.getElementById('edit-email').value, document.getElementById('edit-business-name').value)" style="flex:1; display: flex; align-items:center; justify-content:center; gap: 8px;">
                        <span class="material-icons" style="font-size:16px;">send</span> COMPOSE EMAIL
                     </button>`
                    : ''}
                
                <button class="btn btn-sm btn-primary" style="flex:1.5; box-shadow: 0 4px 15px rgba(223, 165, 58, 0.2);" onclick="saveLeadDetails('${leadId}')">SAVE UPDATES</button>
            `;
        }

        showToast("Lead details updated successfully!", "success");

        // Refresh Grid in background
        const activeFilter = document.querySelector('button[data-filter].active-filter');
        if (activeFilter) {
            loadLeads(activeFilter.dataset.filter);
        }

    } catch (error) {
        console.error("Error saving lead:", error);
        showToast("Error updating lead: " + error.message, "error");
    }
};

// --- NEW LEAD LOGIC ---

window.closeNewLeadModal = () => {
    const host = document.getElementById('modal-container');
    if (host) host.innerHTML = '';
};

window.openNewLeadModal = () => {
    const host = document.getElementById('modal-container') || document.body.appendChild(document.createElement('div'));
    host.id = 'modal-container'; // Ensure ID if created

    host.innerHTML = `
        <div class="crm-modal-overlay" onclick="window.closeNewLeadModal()">
            <div class="crm-modal-content" style="max-width:500px;" onclick="event.stopPropagation()">
                <div class="crm-modal-header">
                    <div class="text-h">Create New Lead</div>
                    <button class="icon-btn" onclick="window.closeNewLeadModal()"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body">
                    <div class="form-group">
                        <label class="form-label" for="new-lead-name">Business Name *</label>
                        <input type="text" id="new-lead-name" class="form-input" placeholder="e.g. Acme Corp">
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
                        <div class="form-group">
                            <label class="form-label" for="new-lead-category">Category</label>
                            <input type="text" id="new-lead-category" class="form-input" placeholder="e.g. Plumber">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="new-lead-city">City</label>
                            <input type="text" id="new-lead-city" class="form-input" placeholder="e.g. Toronto">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="new-lead-state">State/Prov</label>
                            <input type="text" id="new-lead-state" class="form-input" placeholder="e.g. ON or AZ">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="new-lead-website">Website</label>
                        <input type="text" id="new-lead-website" class="form-input" placeholder="https://...">
                    </div>
                     <div class="form-group">
                        <label class="form-label" for="new-lead-notes">Notes</label>
                        <textarea id="new-lead-notes" class="form-input" rows="2" placeholder="Optional notes..."></textarea>
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:1rem;">
                        <button class="btn btn-secondary" onclick="window.closeNewLeadModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="saveNewLead()">Create Lead</button>
                    </div>
                </div>
            </div>
        </div>
    `;
};

window.sendLeadToSelf = async (leadId) => {
    // Gather current data from UI to ensure latest edits are sent
    const name = document.getElementById('edit-business-name').value;
    const phone = document.getElementById('edit-phone').value;
    const email = document.getElementById('edit-email').value;
    const address = document.getElementById('edit-address').value;
    const notes = document.getElementById('edit-notes').value;

    if (!phone && !email) {
        alert("This lead has no phone or email to send.");
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        alert("You must be logged in.");
        return;
    }

    const targetEmail = user.email; // Send to self
    const subject = `📱 Lead: ${name}`;

    // Gather DM Data
    const dm_name = document.getElementById('edit-dm-name').value;
    const dm_phone = document.getElementById('edit-dm-phone').value;
    const dm_email = document.getElementById('edit-dm-email').value;

    // Create a mobile-optimized simple body
    let body = `
    <h3>${name}</h3>
    <p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>
    <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
    <p><strong>Address:</strong> ${address}</p>
    <p><strong>Notes:</strong> ${notes}</p>
    `;

    if (dm_name || dm_phone || dm_email) {
        body += `
        <hr>
        <h4 style="color:#DFA53A;">Decision Maker</h4>
        <p><strong>Name:</strong> ${dm_name}</p>
        <p><strong>Phone:</strong> <a href="tel:${dm_phone}">${dm_phone}</a></p>
        <p><strong>Email:</strong> <a href="mailto:${dm_email}">${dm_email}</a></p>
        `;
    }

    body += `
    <hr>
    <small>Sent from Premium Quasar ERP</small>
    `;

    showToast("Sending info to your phone (email)...");

    try {
        const token = await user.getIdToken();
        const response = await fetch(`${API_BASE}/api/send-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ to: targetEmail, subject, body })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.message || data.error);

        showToast("Sent to " + targetEmail, "success");

    } catch (e) {
        console.error(e);
        showToast("Failed to send: " + e.message, "error");
    }
};

window.saveNewLead = async () => {
    const name = document.getElementById('new-lead-name').value.trim();
    const category = document.getElementById('new-lead-category').value.trim();
    const city = document.getElementById('new-lead-city').value.trim();
    const state = document.getElementById('new-lead-state').value.trim();
    const website = document.getElementById('new-lead-website').value.trim();
    const notes = document.getElementById('new-lead-notes').value.trim();

    if (!name) {
        alert('Business Name is required');
        return;
    }

    try {
        const leadData = {
            business_name: name,
            category: category || 'Business',
            city: city,
            state: state,
            website: website,
            notes: notes,
            status: 'NEW',
            created_at: new Date().toISOString(),
            source: 'MANUAL',
            pain_signals: !website ? ['NO_WEBSITE'] : []
        };

        const docRef = await addDoc(collection(db, "leads"), leadData);

        // Add to cache & update UI if in view
        // Ideally we reload, but for speed:
        closeNewLeadModal();
        loadLeads('NEW');

        // Show success
        // alert('Lead created!'); 

    } catch (e) {
        console.error("Error adding lead: ", e);
        alert("Error saving lead: " + e.message);
    }
}

// --- SMART FILTER LOGIC ---

window.populateSmartFilters = () => {
    if (!window.allLeadsCache || window.allLeadsCache.length === 0) return;

    const options = LeadFilterService.getFilterOptions(window.allLeadsCache);

    // 1. Fill Industries & Pain Points (Standard)
    const fillStandard = (id, items) => {
        const select = document.getElementById(id);
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = `<option value="ALL">${select.options[0].text}</option>`;
        items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = typeof item === 'object' ? item.key : item;
            opt.innerText = typeof item === 'object' ? item.label : item;
            select.appendChild(opt);
        });
        select.value = items.some(i => (typeof i === 'object' ? i.key : i) === currentVal) ? currentVal : 'ALL';
    };

    fillStandard('smart-filter-industry', options.industries);
    fillStandard('smart-filter-pain', options.painPoints);

    // 2. Fill Regions (Categorized with Optgroups)
    const regionSelect = document.getElementById('smart-filter-region');
    if (regionSelect) {
        const currentRegion = regionSelect.value;
        regionSelect.innerHTML = '<option value="ALL">All Regions</option>';

        const addGroup = (label, items) => {
            if (items.length === 0) return;
            const group = document.createElement('optgroup');
            group.label = label;
            items.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.key;
                opt.innerText = item.label + (item.hasLeads ? ' •' : '');
                if (!item.hasLeads) opt.style.opacity = '0.6'; // Dim if no leads found, but keep selectable
                group.appendChild(opt);
            });
            regionSelect.appendChild(group);
        };

        addGroup('Canada', options.regions.canada);
        addGroup('USA', options.regions.usa);

        // Restore selection
        regionSelect.value = currentRegion;
        if (regionSelect.selectedIndex === -1) regionSelect.value = 'ALL';
    }

    updateFilterStats(window.allLeadsCache.length);
};

window.applySmartFilters = () => {
    const industry = document.getElementById('smart-filter-industry').value;
    const region = document.getElementById('smart-filter-region').value;
    const painPoint = document.getElementById('smart-filter-pain').value;

    const filtered = LeadFilterService.filterLeads(window.allLeadsCache, {
        industry,
        region,
        painPoint
    });

    renderLeads(filtered);
    updateFilterStats(filtered.length);
};

function updateFilterStats(count) {
    const statEl = document.getElementById('smart-filter-count');
    if (statEl) statEl.innerText = `${count} leads match`;
}

window.togglePain = (el, value) => {
    el.classList.toggle('selected');
};

window.approveWithSelectedPain = async (id) => {
    const selector = document.getElementById('sidebar-pain-selector') || document.getElementById(`pain-selector-${id}`);
    if (!selector) return;

    const selected = Array.from(selector.querySelectorAll('.pain-chip.selected')).map(el => el.dataset.value);

    // Default to OTHER if nothing selected, or prompt? Let's allow empty effectively means "General"
    let primaryCategory = 'MANUAL_REVIEW';
    if (selected.length > 0) primaryCategory = selected[0];
    if (selected.includes('NO_WEBSITE')) primaryCategory = 'NO_WEBSITE'; // Priority

    try {
        const getVal = (id) => (document.getElementById(id) ? document.getElementById(id).value.trim() : null);

        const business_name = getVal('edit-business-name');
        const notes = getVal('edit-notes');
        const address = getVal('edit-address');
        const city = getVal('edit-city');
        const state = getVal('edit-state');
        const website = getVal('edit-website');
        const phone = getVal('edit-phone');
        const email = getVal('edit-email');
        const dm_name = getVal('edit-dm-name');
        const dm_email = getVal('edit-dm-email');
        const dm_phone = getVal('edit-dm-phone');
        const assigned_agent_id = getVal('edit-assigned-agent');

        const updateData = {
            status: 'APPROVED',
            lead_quality_category: primaryCategory,
            pain_signals: selected,
            updated_at: new Date().toISOString()
        };

        // Only include fields if they are present in the UI (to avoid overwriting if element doesn't exist)
        if (business_name !== null) updateData.business_name = business_name;
        if (notes !== null) updateData.notes = notes;
        if (address !== null) updateData.address = address;
        if (city !== null) updateData.city = city;
        if (state !== null) updateData.state = state;
        if (website !== null) updateData.website = website;
        if (phone !== null) updateData.phone = phone;
        if (email !== null) updateData.email = email;
        if (dm_name !== null) updateData.dm_name = dm_name;
        if (dm_email !== null) updateData.dm_email = dm_email;
        if (dm_phone !== null) updateData.dm_phone = dm_phone;
        if (assigned_agent_id !== null) updateData.assigned_agent_id = assigned_agent_id;

        const ref = doc(db, "leads", id);
        await updateDoc(ref, updateData);

        // Update local cache if exists
        if (window.allLeadsCache) {
            const cached = window.allLeadsCache.find(l => l.id === id);
            if (cached) Object.assign(cached, updateData);
        }

        if (window.showToast) {
            window.showToast("Lead Approved & Saved!", "success");
        }

        // Close overlay via URL reset
        window.location.hash = '#leads';

        // Refresh list
        const activeBtn = document.querySelector('button[data-filter].active-filter');
        if (activeBtn && activeBtn.dataset.filter === 'NEW') {
            loadLeads('NEW');
        } else {
            if (activeBtn) loadLeads(activeBtn.dataset.filter);
        }

    } catch (e) {
        console.error(e);
        alert('Error approving lead: ' + e.message);
    }
};
