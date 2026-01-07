import { db, auth } from '../firebase-config.js';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getTeamDropdownOptions } from './team.js';
import Fuse from 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.mjs';

// Monitor hash changes to handle browser "Back" and "Forward" buttons
window.addEventListener('hashchange', () => {
    const hash = window.location.hash;

    // 1. Clean route (Close Overlay)
    if (hash === '#leads' || hash === '#leads?') {
        const overlay = document.getElementById('lead-detail-overlay');
        if (overlay) overlay.innerHTML = '';
        return;
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
                <div class="text-h text-gold">Leads Pipeline</div>
                <input type="text" id="lead-search-input" class="form-input" placeholder="Search leads..." style="width:250px; padding:6px 12px; font-size:0.9rem;" onkeyup="handleLeadSearch(this.value)">
            </div>
            <div style="display:flex; gap:10px; align-items:center;">
                <button class="btn btn-primary" onclick="openNewLeadModal()" style="display:flex; align-items:center; gap:5px;">
                    <span class="material-icons">add</span> New Lead
                </button>
                <!-- View Toggles -->
                <div class="view-toggle">
                    <div class="view-toggle-btn active" id="btn-view-grid" onclick="setViewMode('grid')"><span class="material-icons" style="font-size:1.2rem;">grid_view</span></div>
                    <div class="view-toggle-btn" id="btn-view-list" onclick="setViewMode('list')"><span class="material-icons" style="font-size:1.2rem;">view_list</span></div>
                </div>
                <button class="btn btn-secondary" onclick="openImportModal()" style="display:flex; align-items:center; gap:5px;">
                    <span class="material-icons" style="font-size:1.1rem;">upload_file</span> Import CSV
                </button>
                <input type="file" id="csv-file-input" style="display:none;" accept=".csv" onchange="handleCSVImport(this)">
                <button class="btn" onclick="window.location.hash='#leadhunter'">Go to Hunter</button>
            </div>
        </div>

        <!-- Filter Tabs -->
        <div style="display:flex; gap:1rem; margin-bottom:1rem; overflow-x:auto; padding-bottom:5px;">
            <button class="btn btn-sm active-filter" data-filter="NEW">New</button>
            <button class="btn btn-sm" data-filter="APPROVED">Approved</button>
            <button class="btn btn-sm" data-filter="CONTACTED">Contacted</button>
            <button class="btn btn-sm" data-filter="ALL">All</button>
        </div>

        <div id="leads-list-container">
            <div class="text-center text-muted" style="padding: 2rem;">Loading pipeline...</div>
        </div>

        <!-- Detail Overlay Container -->
        <div id="lead-detail-overlay"></div>
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

    // Default load
    buttons[0].click();
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
                <div class="text-h text-muted">No leads found</div>
                <p class="text-sm text-muted">Try adjusting your search or filter.</p>
            </div>
        `;
        return;
    }

    let html = '';
    leads.forEach((data) => {
        const jsonParam = encodeURIComponent(JSON.stringify(data));

        // Pain Signals Badges
        let badges = '';
        if (data.pain_signals && data.pain_signals.length > 0) {
            badges = data.pain_signals.map(s => `<span class="badge badge-danger">${s.replace(/_/g, ' ')}</span>`).join('');
        }

        html += `
            <div class="lead-card card" onclick="openLeadDetail('${jsonParam}')" style="display:flex; flex-direction:column; gap:0.5rem; border-left: 3px solid ${getStatusColor(data.status)}; cursor:pointer;">
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
                     Found via: "${escapeHtml(data.discovered_query || 'N/A')}"
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
    listContainer.innerHTML = '<div class="text-center text-muted mt-4">Fetching leads...</div>';

    // reset search input
    const searchInput = document.getElementById('lead-search-input');
    if (searchInput) searchInput.value = '';

    try {
        let q;
        if (statusFilter === 'ALL') {
            q = query(collection(db, "leads"));
        } else {
            q = query(collection(db, "leads"), where("status", "==", statusFilter));
        }

        const querySnapshot = await getDocs(q);

        // Cache data
        window.allLeadsCache = [];
        querySnapshot.forEach(docSnap => {
            window.allLeadsCache.push({ ...docSnap.data(), id: docSnap.id });
        });

        // Client-side Sort (Newest First)
        window.allLeadsCache.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
            const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
            return dateB - dateA;
        });

        renderLeads(window.allLeadsCache);

    } catch (e) {
        console.error(e);

        listContainer.innerHTML = '<div class="text-danger">Error loading leads.</div>';
    }
}

// --- DETAIL VIEW LOGIC ---

window.openLeadDetail = (data) => {
    let lead;
    // Check if data is already an object or a string
    if (typeof data === 'string') {
        lead = JSON.parse(decodeURIComponent(data));
    } else {
        lead = data;
    }
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
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(lead.business_name + ' ' + lead.city)}`;

    overlay.innerHTML = `
        <div class="detail-overlay">
            <div class="detail-header">
                <div>
                     <div class="text-h">${escapeHtml(lead.business_name)}</div>
                     <span class="badge status-${lead.status.toLowerCase()}">${escapeHtml(lead.status)}</span>
                </div>
                <div>
                    <button class="btn" onclick="window.location.hash='#leads'">Close</button>
                    ${lead.status === 'NEW' ? `
                        <div style="display:inline-flex; gap:5px; margin-left:10px;">
                              <button class="btn btn-sm" style="border-color:var(--success); color:var(--success);" onclick="updateLeadStatus('${lead.id}', 'APPROVED', 'NO_WEBSITE')">No Web</button>
                             <button class="btn btn-sm" style="border-color:var(--success); color:var(--success);" onclick="updateLeadStatus('${lead.id}', 'APPROVED', 'DATED_DESIGN')">Bad Web</button>
                             <button class="btn btn-sm" style="border-color:var(--success); color:var(--success);" onclick="updateLeadStatus('${lead.id}', 'APPROVED', 'BAD_RANKING')">Bad SEO</button>
                             <button class="btn btn-sm" style="border-color:var(--success); color:var(--success);" onclick="updateLeadStatus('${lead.id}', 'APPROVED', 'OTHER')">Other</button>
                             <button class="btn btn-sm" style="border-color:var(--danger); color:var(--danger);" onclick="updateLeadStatus('${lead.id}', 'REJECTED')">Reject</button>
                        </div>
                    ` : ''}
                    ${lead.status === 'APPROVED' ? `<button class="btn btn-primary ml-2" onclick="openAssignModal('${lead.id}')">Assign Agent</button>` : ''}            
                </div>
            </div>
            <div class="detail-body">
                <!-- LEADS INFO SIDEBAR -->
                <div class="detail-sidebar">
                    <div class="text-h text-gold" style="margin-bottom:1rem;">Lead Intelligence</div>
                    
                    <div class="form-group">
                        <label class="form-label">Business Name</label>
                        <input type="text" id="edit-business-name" class="form-input" value="${escapeHtml(lead.business_name)}">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Discovery Logic</label>
                        <div class="text-sm">Found via query: <strong>${escapeHtml(lead.discovered_query || 'N/A')}</strong></div>
                        <div class="text-sm">Result Type: <strong>Page 2+ (Low Visibility)</strong></div>
                    </div>
                    
                     <div class="form-group">
                        <label class="form-label">Internal Notes</label>
                        <textarea id="edit-notes" class="form-input" rows="3" placeholder="Add notes here...">${escapeHtml(lead.notes || '')}</textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Contact Info</label>
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">
                            <span class="material-icons text-muted" style="font-size:1rem;">location_on</span>
                            <input type="text" id="edit-address" class="form-input" style="padding:4px;" value="${escapeHtml(lead.address || '')}" placeholder="Address">
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">
                            <span class="material-icons text-muted" style="font-size:1rem;">language</span>
                            <input type="text" id="edit-website" class="form-input" style="padding:4px;" value="${escapeHtml(lead.website || '')}" placeholder="Website URL">
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">
                            <span class="material-icons text-muted" style="font-size:1rem;">phone</span>
                            <input type="text" id="edit-phone" class="form-input" style="padding:4px;" value="${escapeHtml(lead.phone || '')}" placeholder="Phone">
                        </div>
                         <div style="display:flex; align-items:center; gap:8px;">
                            <span class="material-icons text-muted" style="font-size:1rem;">email</span>
                            <input type="text" id="edit-email" class="form-input" style="padding:4px;" value="${escapeHtml(lead.email || '')}" placeholder="Email">
                        </div>
                        
                        <!-- Actions Row -->
                        <div id="lead-actions-row" style="display:flex; gap:10px; margin-top:10px;">
                            ${lead.email ?
            `<button class="btn btn-sm btn-secondary" onclick="openEmailComposer(document.getElementById('edit-email').value, document.getElementById('edit-business-name').value)" style="flex:1;">
                                    <span class="material-icons" style="font-size:14px; margin-right:4px;">send</span> Email
                                 </button>`
            : ''}
                            <button class="btn btn-sm btn-primary" style="flex:1;" onclick="saveLeadDetails('${lead.id}')">Save Changes</button>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Live Performance</label>
                        <div class="text-sm">Load Time: <strong id="load-time-display">-</strong></div>
                    </div>

                    <div class="divider" style="margin: 1.5rem 0;"></div>

                    <!-- SEO SECTION -->
                    <div class="text-h text-info" style="margin-bottom:1rem;">SEO Audit</div>
                    
                    <div id="seo-report-container">
                         <p class="text-muted text-sm">No audit run yet.</p>
                         <button class="btn btn-block" style="border-color: var(--info); color: var(--info);" onclick="runDeepAudit('${lead.website}')">Run Deep Full SEO & UX Audit</button>
                    </div>

                </div>

                <!-- PREVIEW MAIN -->
                <div class="detail-main">
                    <div class="preview-tabs">
                        <div class="preview-tab active" onclick="setPreviewSrc('${siteUrl}', this, 'website')">Website</div>
                        <div class="preview-tab" onclick="setPreviewSrc('${googleSearchUrl}&tbm=isch', this, 'google')">Google Images</div>
                        <div class="preview-tab" onclick="setPreviewSrc('${googleSearchUrl}', this, 'google')">Search Results</div>
                    </div>
                    
                    <!-- DEVICE TOOLBAR -->
                    <div id="device-toolbar" class="preview-toolbar" style="display: ${siteUrl ? 'flex' : 'none'};">
                        <div class="device-btn" onclick="setPreviewMode('mobile', this)"><span class="material-icons">smartphone</span> Mobile</div>
                        <div class="device-btn" onclick="setPreviewMode('tablet', this)"><span class="material-icons">tablet</span> Tablet</div>
                        <div class="device-btn active" onclick="setPreviewMode('desktop', this)"><span class="material-icons">laptop</span> Desktop</div>
                        
                        <div class="dev-slider-group">
                             <span class="text-xs text-muted">Width:</span>
                             <input type="range" class="dev-slider" min="320" max="1600" value="1200" oninput="setCustomWidth(this.value)">
                             <span class="text-xs text-gold" id="width-display">100%</span>
                        </div>
                        
                        <div style="flex:1;"></div>

                        <!-- Explicit Blocked Help Button -->
                        <div class="device-btn" style="border-color:var(--danger); color:var(--danger);" onclick="toggleScreenshotMode('${siteUrl}')" title="Use this if website refuses to connect">
                            <span class="material-icons">broken_image</span> <span class="desktop-only text-xs ml-1">Site Blocked?</span>
                        </div>

                        <div class="device-btn" onclick="toggleScreenshotMode('${siteUrl}')" title="Switch to Screenshot">
                            <span class="material-icons">image</span> <span class="desktop-only text-xs ml-1">Screenshot</span>
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
                            <div class="preview-frame-wrapper preview-mode-desktop" id="iframe-wrapper">
                                <iframe src="${siteUrl}" class="preview-frame" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" onload="finishLoadTimer()" onerror="this.src='about:blank'; this.nextElementSibling.style.display='flex'"></iframe>
                                <div style="display:none; position:absolute; top:0; left:0; right:0; bottom:0; background:var(--bg-dark); align-items:center; justify-content:center; flex-direction:column; color:white;">
                                    <p>This website prevents embedding.</p>
                                    <a href="${siteUrl}" target="_blank" class="btn btn-primary">Open in New Tab</a>
                                </div>
                            </div>
                         </div>`
            :
            `<div style="display:flex; align-items:center; justify-content:center; height:100%; color: var(--text-muted);">
                            No Website URL to Preview
                        </div>`
        }
                </div>
            </div>
            <!-- Audit Modal Host -->
            <div id="audit-modal-host"></div>
        </div>
    `;
};

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
        if (mode === 'mobile') widthVal = '375px';
        if (mode === 'tablet') widthVal = '768px';

        if (display) display.innerText = widthVal;

        // Sync slider
        if (slider) {
            if (mode === 'mobile') slider.value = 375;
            else if (mode === 'tablet') slider.value = 768;
            else slider.value = 1200; // rough desktop default
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

window.runDeepAudit = async (url) => {
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
            <div class="spinner-border text-gold" role="status" style="width: 2rem; height: 2rem; border-width: 0.2em;"></div>
            <p class="text-gold blink text-sm mt-3" id="audit-status-text">Connecting to Website...</p>
        </div>
    `;

    try {
        const statusText = document.getElementById('audit-status-text');

        // 2. Fetch Website Content (via CORS Proxy)
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();

        if (!data.contents) throw new Error("Could not fetch website content.");

        let htmlContent = data.contents;
        // Truncate to avoid token limits (Keep Head + First 15000 chars of body)
        const headMatch = htmlContent.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
        const head = headMatch ? headMatch[0] : '';
        const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        let body = bodyMatch ? bodyMatch[1] : htmlContent;

        // Remove scripts/styles
        body = body.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
        body = body.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "");
        body = body.substring(0, 15000);

        const cleanHtml = (head + body).replace(/\s+/g, ' ').trim();

        // 3. Send to OpenAI
        if (statusText) statusText.innerText = "Analyzing with AI (Results in ~10s)...";

        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo-1106",
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: `You are an expert SEO and UX Auditor. Analyze the provided HTML. 
                        Return a JSON object with this EXACT structure:
                        {
                            "score": number (0-100),
                            "issues": [
                                { "type": "critical"|"warning"|"success", "icon": "error"|"warning"|"check_circle", "title": "short title", "desc": "short description" }
                            ],
                            "fixes": ["fix 1", "fix 2"]
                        }
                        Be strict yet fair.`
                    },
                    {
                        role: "user",
                        content: `Analyze this website code (${url}): \n\n ${cleanHtml}`
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
        report.timestamp = new Date().toLocaleDateString();
        window.lastAuditReport = report;

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
            <div class="text-center" style="margin-top:0.5rem;"><a href="#" class="text-xs text-muted" onclick="alert('Email draft created with AI findings!')">Email PDF to Me</a></div>
        `;

    } catch (e) {
        console.error(e);
        container.innerHTML = `<p class="text-danger text-sm">Error: ${e.message}</p>`;
    }
};

window.openAuditPopup = () => {
    const report = window.lastAuditReport;
    if (!report) return;

    const host = document.getElementById('audit-modal-host');

    const issuesHtml = report.issues.map(i => `
        <div style="display:flex; gap:10px; margin-bottom:10px; padding:10px; background:rgba(255,255,255,0.05); border-radius:8px;">
            <span class="material-icons text-${i.type === 'critical' ? 'danger' : (i.type === 'warning' ? 'warning' : 'success')}">${i.icon}</span>
            <div>
                <div style="font-weight:bold; font-size:0.95rem;">${i.title}</div>
                <div class="text-sm text-muted">${i.desc}</div>
            </div>
        </div>
    `).join('');

    const fixesHtml = report.fixes.map(f => `
        <li class="text-sm" style="margin-bottom:5px; color:var(--text-main);">${f}</li>
    `).join('');

    host.innerHTML = `
        <div class="crm-modal-overlay" style="z-index:9999;" onclick="document.getElementById('audit-modal-host').innerHTML=''">
            <div class="crm-modal-content" style="max-width:700px;" onclick="event.stopPropagation()">
                <div class="crm-modal-header">
                    <div>
                        <div class="text-h">Deep SEO & UX Audit Report</div>
                        <div class="text-sm text-muted">Analysis for ${report.url}</div>
                    </div>
                    <button class="icon-btn" onclick="document.getElementById('audit-modal-host').innerHTML=''"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body" style="max-height:60vh; overflow-y:auto;">
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px;">
                        <div class="card" style="text-align:center;">
                            <div class="text-muted text-sm uppercase">Overall Health</div>
                            <div class="text-h text-${report.score > 70 ? 'success' : 'warning'}" style="font-size:3rem;">${report.score}/100</div>
                        </div>
                        <div class="card">
                            <div class="text-muted text-sm uppercase">Summary</div>
                            <div style="margin-top:5px;" class="text-danger"><strong>${report.issues.filter(i => i.type === 'critical').length}</strong> Critical Errors</div>
                            <div class="text-warning"><strong>${report.issues.filter(i => i.type === 'warning').length}</strong> Warnings</div>
                        </div>
                    </div>

                    <div class="text-h text-gold mb-2">Detailed Findings</div>
                    <div style="margin-bottom:2rem;">
                        ${issuesHtml}
                    </div>

                    <div class="text-h text-success mb-2">Recommended Fixes</div>
                    <ul style="padding-left:20px; color:var(--text-muted);">
                        ${fixesHtml}
                    </ul>

                    <button class="btn btn-primary btn-block" style="margin-top:2rem;" onclick="document.getElementById('audit-modal-host').innerHTML=''">Close Report</button>
                </div>
            </div>
        </div>
    `;
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
                <label class="form-label">To:</label>
                <input type="text" class="form-input" value="${email}" disabled style="opacity:0.7;">
            </div>

            <div class="form-group">
                <label class="form-label">Subject:</label>
                <input type="text" id="email-subject" class="form-input" value="Regarding ${name} - Opportunity">
            </div>

            <div class="form-group">
                <label class="form-label">Message:</label>
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

        const response = await fetch('http://localhost:5000/api/send-email', {
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
        const website = getVal('edit-website');
        const phone = getVal('edit-phone');
        const email = getVal('edit-email');

        if (!business_name) {
            showToast("Business Name is required.", "error");
            return;
        }

        const updateData = {
            business_name,
            notes,
            address,
            website,
            phone,
            email,
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

        // Update Email Button visibility - Re-render Row for cleanliness
        const actionRow = document.getElementById('lead-actions-row');
        if (actionRow) {
            actionRow.innerHTML = `
                ${email ?
                    `<button class="btn btn-sm btn-secondary" onclick="openEmailComposer(document.getElementById('edit-email').value, document.getElementById('edit-business-name').value)" style="flex:1;">
                    <span class="material-icons" style="font-size:14px; margin-right:4px;">send</span> Email
                </button>`
                    : ''}
                <button class="btn btn-sm btn-primary" style="flex:1;" onclick="saveLeadDetails('${leadId}')">Save Changes</button>
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

window.openNewLeadModal = () => {
    const host = document.getElementById('modal-container') || document.body.appendChild(document.createElement('div'));
    host.id = 'modal-container'; // Ensure ID if created

    host.innerHTML = `
        <div class="crm-modal-overlay" onclick="document.getElementById('modal-container').innerHTML=''">
            <div class="crm-modal-content" style="max-width:500px;" onclick="event.stopPropagation()">
                <div class="crm-modal-header">
                    <div class="text-h">Create New Lead</div>
                    <button class="icon-btn" onclick="document.getElementById('modal-container').innerHTML=''"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body">
                    <div class="form-group">
                        <label class="form-label">Business Name *</label>
                        <input type="text" id="new-lead-name" class="form-input" placeholder="e.g. Acme Corp">
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
                        <div class="form-group">
                            <label class="form-label">Category</label>
                            <input type="text" id="new-lead-category" class="form-input" placeholder="e.g. Plumber">
                        </div>
                        <div class="form-group">
                            <label class="form-label">City</label>
                            <input type="text" id="new-lead-city" class="form-input" placeholder="e.g. Toronto">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Website</label>
                        <input type="text" id="new-lead-website" class="form-input" placeholder="https://...">
                    </div>
                     <div class="form-group">
                        <label class="form-label">Notes</label>
                        <textarea id="new-lead-notes" class="form-input" rows="2" placeholder="Optional notes..."></textarea>
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:1rem;">
                        <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
                        <button class="btn btn-primary" onclick="saveNewLead()">Create Lead</button>
                    </div>
                </div>
            </div>
        </div>
    `;
};

window.saveNewLead = async () => {
    const name = document.getElementById('new-lead-name').value.trim();
    const category = document.getElementById('new-lead-category').value.trim();
    const city = document.getElementById('new-lead-city').value.trim();
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
            website: website,
            notes: notes,
            status: 'NEW',
            created_at: new Date().toISOString(),
            source: 'MANUAL',
            pain_signals: !website ? ['NO_WEBSITE'] : []
        };

        const docRef = await addDoc(collection(db, "leads"), leadData);

        // Close modal
        document.getElementById('modal-container').innerHTML = '';

        // Refresh List (and maybe show toast)
        // Check if we are in 'NEW' or 'ALL' view to reload
        const activeFilter = document.querySelector('button[data-filter].active-filter');
        if (activeFilter) {
            loadLeads(activeFilter.dataset.filter); // Reload current view
        } else {
            loadLeads('NEW'); // Default to NEW
        }

    } catch (e) {
        console.error("Error creating lead:", e);
        alert('Failed to create lead.');
    }
};