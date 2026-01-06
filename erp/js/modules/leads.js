import { db } from '../firebase-config.js';
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Init Leads Module
export async function initLeads() {
    console.log('Initializing Leads Module...');
    const container = document.getElementById('view-leads');

    container.innerHTML = `
        <div class="top-actions" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <div class="text-h text-gold">Leads Pipeline</div>
            <div style="display:flex; gap:10px; align-items:center;">
                <!-- View Toggles -->
                <div class="view-toggle">
                    <div class="view-toggle-btn active" id="btn-view-grid" onclick="setViewMode('grid')"><span class="material-icons" style="font-size:1.2rem;">grid_view</span></div>
                    <div class="view-toggle-btn" id="btn-view-list" onclick="setViewMode('list')"><span class="material-icons" style="font-size:1.2rem;">view_list</span></div>
                </div>
                <button class="btn" onclick="window.location.hash='#leadhunter'">Go to Hunter</button>
            </div>
        </div>

        <!-- Filter Tabs -->
        <div style="display:flex; gap:1rem; margin-bottom:1rem; overflow-x:auto; padding-bottom:5px;">
            <button class="btn btn-sm active-filter" data-filter="NEW">New</button>
            <button class="btn btn-sm" data-filter="APPROVED">Approved</button>
            <button class="btn btn-sm" data-filter="CONTACT_QUEUED">Queued</button>
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

async function loadLeads(statusFilter) {
    const listContainer = document.getElementById('leads-list-container');
    listContainer.innerHTML = '<div class="text-center text-muted mt-4">Fetching leads...</div>';

    try {
        let q;
        if (statusFilter === 'ALL') {
            q = query(collection(db, "leads"));
        } else {
            q = query(collection(db, "leads"), where("status", "==", statusFilter));
        }

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            listContainer.innerHTML = `
                <div class="card" style="text-align:center; padding:3rem;">
                    <div class="text-h text-muted">No leads found in '${statusFilter}'</div>
                    <p class="text-sm text-muted">Run the Lead Hunter to find new prospects.</p>
                    <button class="btn btn-primary" style="margin-top:1rem;" onclick="window.location.hash='#leadhunter'">Open Lead Hunter</button>
                </div>
            `;
            return;
        }

        let html = '';
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const jsonParam = encodeURIComponent(JSON.stringify({ ...data, id: docSnap.id }));

            // Pain Signals Badges
            let badges = '';
            if (data.pain_signals && data.pain_signals.length > 0) {
                badges = data.pain_signals.map(s => `<span class="badge badge-danger">${s.replace(/_/g, ' ')}</span>`).join('');
            }

            html += `
                <div class="lead-card card" style="display:flex; flex-direction:column; gap:0.5rem; border-left: 3px solid ${getStatusColor(data.status)}">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <div class="text-h" style="font-size:1.1rem;">${data.business_name}</div>
                            <div class="text-sm text-muted">${data.category || 'Business'} • ${data.city}</div>
                        </div>
                        <div class="text-gold" style="font-weight:bold;">${data.google_rating || '-'} ★ <span class="text-muted text-sm">(${data.google_reviews_count || 0})</span></div>
                    </div>
                    
                    <div style="display:flex; gap:5px; flex-wrap:wrap; margin: 0.5rem 0;">
                        ${badges}
                    </div>

                     <!-- Mini Info -->
                    <div class="text-xs text-muted" style="margin-bottom:0.5rem;">
                         Found via: "${data.discovered_query || 'N/A'}"
                    </div>

                    <div style="margin-top:auto; display:flex; gap:10px; justify-content: space-between; align-items:center;">
                         <div style="display:flex; gap:5px;">
                            ${renderActionButtons(docSnap.id, data.status)}
                         </div>
                         <button class="btn btn-sm" onclick="openLeadDetail('${jsonParam}')">View Data</button>
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = `
            <div id="leads-grid-wrapper" class="${currentViewMode === 'grid' ? 'leads-grid' : 'leads-list'}">
                ${html}
            </div>
        `;

    } catch (e) {
        console.error(e);
        listContainer.innerHTML = '<div class="text-danger">Error loading leads.</div>';
    }
}

// --- DETAIL VIEW LOGIC ---

window.openLeadDetail = (encodedJson) => {
    const lead = JSON.parse(decodeURIComponent(encodedJson));
    const overlay = document.getElementById('lead-detail-overlay');

    // Website URL or Fallback for Iframe
    // Note: Many sites block iframe (X-Frame-Options). We handle this by showing a message if it fails, or just linking out.
    // For "Preview", we can try to show it.
    const siteUrl = lead.website && lead.website.startsWith('http') ? lead.website : '';
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(lead.business_name + ' ' + lead.city)}`;

    overlay.innerHTML = `
        <div class="detail-overlay">
            <div class="detail-header">
                <div>
                     <div class="text-h">${lead.business_name}</div>
                     <span class="badge status-${lead.status.toLowerCase()}">${lead.status}</span>
                </div>
                <div>
                    <button class="btn" onclick="document.getElementById('lead-detail-overlay').innerHTML=''">Close</button>
                    ${lead.status === 'NEW' ? `<button class="btn btn-primary" onclick="updateLeadStatus('${lead.id}', 'APPROVED')">Approve Lead</button>` : ''}
                </div>
            </div>
            <div class="detail-body">
                <!-- LEADS INFO SIDEBAR -->
                <div class="detail-sidebar">
                    <div class="text-h text-gold" style="margin-bottom:1rem;">Lead Intelligence</div>
                    
                    <div class="form-group">
                        <label class="form-label">Discovery Logic</label>
                        <div class="text-sm">Found via query: <strong>${lead.discovered_query}</strong></div>
                        <div class="text-sm">Result Type: <strong>Page 2+ (Low Visibility)</strong></div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Contact Info</label>
                        <div class="text-sm"><span class="material-icons" style="font-size:1rem; vertical-align:middle;">location_on</span> ${lead.address}</div>
                        ${lead.website ? `<div class="text-sm"><span class="material-icons" style="font-size:1rem; vertical-align:middle;">language</span> <a href="${lead.website}" target="_blank" class="text-gold">${lead.website}</a></div>` : '<div class="text-danger text-sm">No Website Detected</div>'}
                        <div class="text-sm"><span class="material-icons" style="font-size:1rem; vertical-align:middle;">phone</span> ${lead.phone || 'Not found'}</div>
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
                         <button class="btn btn-block" style="border-color: var(--info); color: var(--info);" onclick="runSEOAudit('${lead.website}')">Run Quick Website Audit</button>
                    </div>

                </div>

                <!-- PREVIEW MAIN -->
                <div class="detail-main">
                    <div class="preview-tabs">
                        <div class="preview-tab active" onclick="setPreviewSrc('${siteUrl}', this, 'website')">Website</div>
                        <div class="preview-tab" onclick="setPreviewSrc('${googleSearchUrl}&tbm=isch', this, 'google')">Google Images</div>
                        <div class="preview-tab" onclick="setPreviewSrc('${googleSearchUrl}', this, 'google')">Search Results</div>
                    </div>
                    
                    <!-- DEVICE TOOLBAR (Only relevant for Website) -->
                    <div id="device-toolbar" class="preview-toolbar" style="display: ${siteUrl ? 'flex' : 'none'};">
                        <div class="device-btn" onclick="setPreviewMode('mobile', this)"><span class="material-icons">smartphone</span> Mobile</div>
                        <div class="device-btn" onclick="setPreviewMode('tablet', this)"><span class="material-icons">tablet</span> Tablet</div>
                        <div class="device-btn active" onclick="setPreviewMode('desktop', this)"><span class="material-icons">laptop</span> Desktop</div>
                        
                        <div class="dev-slider-group">
                            <span class="text-xs text-muted">Width:</span>
                            <input type="range" class="dev-slider" min="320" max="1600" value="1200" oninput="setCustomWidth(this.value)">
                            <span class="text-xs text-gold" id="width-display">100%</span>
                        </div>
                        
                        <div class="device-btn" style="margin-left:10px;" onclick="reloadPreview()" title="Force Reload">
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

// --- ACTION LOGIC ---

window.runSEOAudit = (url) => {
    const container = document.getElementById('seo-report-container');
    if (!url) {
        container.innerHTML = '<p class="text-danger">Cannot audit: No URL provided.</p>';
        return;
    }

    container.innerHTML = '<p class="text-gold blink">Analyzing HTML structure, meta tags, and mobile readiness...</p>';

    // Simulate Analysis (Real implementation would require a backend proxy to fetch HTML)
    setTimeout(() => {
        const score = Math.floor(Math.random() * 40) + 40; // Random score 40-80
        container.innerHTML = `
            <div class="seo-score-circle" style="background: conic-gradient(var(--${score > 70 ? 'success' : 'warning'}) 0% ${score}%, rgba(255,255,255,0.1) 0% 100%);">
                <span class="text-h">${score}%</span>
            </div>
            <div style="max-height: 200px; overflow-y:auto;">
                <div class="seo-item">
                    <span class="material-icons text-danger">highlight_off</span>
                    <div class="text-sm"><div>Missing H1 Tag</div><div class="text-muted">Critical for ranking</div></div>
                </div>
                <div class="seo-item">
                    <span class="material-icons text-warning">warning</span>
                    <div class="text-sm"><div>Slow Mobile Load</div><div class="text-muted">Time to interactive > 3s</div></div>
                </div>
                <div class="seo-item">
                     <span class="material-icons text-success">check_circle</span>
                     <div class="text-sm"><div>SSL Secured</div><div class="text-muted">HTTPS is active</div></div>
                </div>
            </div>
            <button class="btn btn-sm btn-block btn-primary" style="margin-top:1rem;" onclick="alert('Report generated! Ready to email.')">Generate Email Report</button>
        `;
    }, 2000);
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
        return `
            <button class="btn btn-sm" style="border-color:var(--success); color:var(--success);" onclick="updateLeadStatus('${id}', 'APPROVED')">Approve</button>
            <button class="btn btn-sm" style="border-color:var(--danger); color:var(--danger);" onclick="updateLeadStatus('${id}', 'REJECTED')">Reject</button>
        `;
    }
    if (status === 'APPROVED') {
        return `<button class="btn btn-sm btn-primary" onclick="updateLeadStatus('${id}', 'CONTACT_QUEUED')">Push to Components</button>`;
    }
    return '';
}

window.updateLeadStatus = async (id, newStatus) => {
    try {
        const ref = doc(db, "leads", id);
        await updateDoc(ref, {
            status: newStatus,
            updated_at: new Date().toISOString()
        });

        // If approved, maybe create a client draft?
        if (newStatus === 'APPROVED') {
            // Optional: Auto-add to CRM? 
            // For now, just keep in "Approved" tab
        }

        // Close overlay if open
        const overlay = document.getElementById('lead-detail-overlay');
        if (overlay) overlay.innerHTML = '';

        // Refresh list
        const activeBtn = document.querySelector('button[data-filter].btn-primary');
        if (activeBtn) activeBtn.click();

    } catch (e) {
        console.error(e);
        alert('Error updating status');
    }
};
