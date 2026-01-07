import { db } from '../firebase-config.js';
import { collection, addDoc, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// -- CONFIG --
// Since we don't have a secure backend server, we will ask the user to input the key 
// and store it in localStorage for this session/device.
const STORAGE_KEY_API = 'erp_google_places_key';
const STORAGE_KEY_SETTINGS = 'erp_hunter_settings';

// Initial Settings
let settings = {
    cities: ['Toronto, ON', 'Vancouver, BC', 'Montreal, QC', 'Calgary, AB', 'Ottawa, ON'],
    industries: ['Lawyer', 'Accountant', 'Dentist', 'Plumber', 'Real Estate Agent', 'Marketing Agency'],
    minReviews: 3
};

// --- INIT ---
export async function initLeadHunter() {
    const container = document.getElementById('view-leadhunter');

    // Check for API Key
    const apiKey = localStorage.getItem(STORAGE_KEY_API);
    if (!apiKey) {
        renderWizard(container);
        return;
    }

    renderHunterUI(container);
}

// --- UI RENDERERS ---

function renderWizard(container) {
    container.innerHTML = `
        <div class="card" style="max-width: 600px; margin: 2rem auto; text-align: left;">
            <div class="text-center text-h text-gold" style="margin-bottom: 2rem;">Lead Hunter Setup</div>
            
            <p style="margin-bottom: 1rem;">To use the automated Lead Hunter, you need a <strong>Google Places API Key</strong>.</p>
            
            <ol style="line-height: 1.8; color: var(--text-muted); margin-bottom: 2rem;">
                <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" class="text-gold">Google Cloud Console</a>.</li>
                <li>Create a new project (e.g., "ERP Lead Hunter").</li>
                <li>Enable the <strong>Places API (New)</strong>.</li>
                <li>Create credentials (API Key).</li>
                <li>(Recommended) Restrict the key to specific HTTP referrers or IP addresses.</li>
                <li>Paste the key below.</li>
            </ol>

            <div class="form-group">
                <label class="form-label">Google Places API Key</label>
                <input type="password" id="input-api-key" class="form-input" placeholder="AIzaSy...">
            </div>

            <button class="btn btn-primary btn-block" id="btn-save-key">Save & Continue</button>
            <p class="text-sm text-center text-muted" style="margin-top: 1rem;">Key is stored locally on your device.</p>
        </div>
    `;

    document.getElementById('btn-save-key').addEventListener('click', () => {
        const key = document.getElementById('input-api-key').value.trim();
        if (key.length > 10) {
            localStorage.setItem(STORAGE_KEY_API, key);
            initLeadHunter();
        } else {
            alert('Invalid Key');
        }
    });
}

function renderHunterUI(container) {
    // Load persisted settings
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (saved) settings = JSON.parse(saved);

    container.innerHTML = `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div class="text-h text-gold">Lead Hunter Agent</div>
                    <div class="text-muted text-sm">Automated Prospecting System</div>
                </div>
                <div style="text-align:right;">
                     <div class="text-h" id="stat-run-status">Idle</div>
                     <button class="btn btn-sm" id="btn-clear-key" style="border-color: var(--danger); color: var(--danger);">Reset API Key</button>
                </div>
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2rem;">
                <!-- Logs / Terminal -->
                <div style="background: #000; border:1px solid var(--border); padding: 1rem; h-min: 300px; height: 100%; overflow-y: auto; font-family: monospace; font-size: 0.8rem; color: #0f0;" id="hunter-logs">
                    > System Ready...<br>
                    > Configure agent settings to start.<br>
                </div>

                <!-- Config Form -->
                <div>
                     <div class="text-h mb-4">Configuration</div>
                     
                     <!-- Industry Selection -->
                     <div class="form-group">
                        <label class="form-label">Target Industry</label>
                        <input type="text" id="input-industry" class="form-input" list="industry-suggestions" placeholder="e.g. Plumber, Dentist, Accountant" value="Plumber">
                        <datalist id="industry-suggestions">
                            <option value="Plumber">
                            <option value="Dentist">
                            <option value="Real Estate Agent">
                            <option value="Accountant">
                            <option value="Marketing Agency">
                            <option value="Roofer">
                            <option value="Lawyer">
                            <option value="HVAC">
                            <option value="Landscaper">
                            <option value="Chiropractor">
                        </datalist>
                     </div>

                     <!-- Website Filter -->
                     <div class="form-group">
                        <label class="form-label">Website Status</label>
                        <select id="input-website-filter" class="form-input">
                            <option value="ALL">Any (Website or No Website)</option>
                            <option value="NO_WEBSITE">No Website (High Priority)</option>
                            <option value="HAS_WEBSITE">Must Have Website</option>
                        </select>
                     </div>

                     <!-- Quantity -->
                     <div class="form-group">
                        <label class="form-label">Leads to Hunt (Max)</label>
                        <input type="number" id="input-max-leads" class="form-input" value="10" min="1" max="50">
                     </div>

                     <div class="form-group">
                        <label class="form-label">Target City</label>
                        <input type="text" id="input-city" class="form-input" list="city-suggestions" placeholder="Random (or type specific city)">
                        <datalist id="city-suggestions">
                            <option value="Toronto, ON">
                            <option value="Vancouver, BC">
                            <option value="Montreal, QC">
                            <option value="Calgary, AB">
                            <option value="Ottawa, ON">
                            <option value="New York, NY">
                            <option value="Los Angeles, CA">
                            <option value="London, UK">
                        </datalist>
                     </div>
                     
                      <div class="form-group">
                         <label class="form-label">Strategy</label>
                         <div class="text-sm text-muted">Page 2-5 Results (Deep Search)</div>
                      </div>

                      <button class="btn btn-primary btn-block" id="btn-run-agent" style="margin-top: 1rem;">RUN AGENT NOW</button>
                </div>
            </div>
            
            <!-- Live Preview Section -->
            <div style="margin-top: 3rem;">
                <div class="text-h text-gold mb-2">Recently Hunted Leads</div>
                <div id="hunter-preview-container" class="leads-grid" style="grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));">
                    <!-- Cards will appear here -->
                    <div class="text-muted text-sm" style="grid-column: 1/-1;">Run the agent to see results here...</div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-run-agent').addEventListener('click', runAgentJob);
    document.getElementById('btn-clear-key').addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEY_API);
        initLeadHunter();
    });
}

// --- AGENT LOGIC ---

async function runAgentJob() {
    const btn = document.getElementById('btn-run-agent');
    const logs = document.getElementById('hunter-logs');
    const previewContainer = document.getElementById('hunter-preview-container');
    const status = document.getElementById('stat-run-status');
    const apiKey = localStorage.getItem(STORAGE_KEY_API);

    // Get Inputs
    const industryInput = document.getElementById('input-industry').value.trim() || 'Business';
    const cityInput = document.getElementById('input-city').value.trim();
    const websiteFilter = document.getElementById('input-website-filter').value;
    const maxLeads = parseInt(document.getElementById('input-max-leads').value) || 10;

    if (!apiKey) {
        alert('Missing API Key');
        return;
    }

    btn.disabled = true;
    status.innerText = "Running...";
    logs.innerHTML = ''; // Clear logs
    if (previewContainer) previewContainer.innerHTML = ''; // Clear preview

    // Auto-scroll log
    const log = (msg) => {
        logs.innerHTML += `> ${msg}<br>`;
        logs.scrollTop = logs.scrollHeight;
    };

    try {
        log(`Starting Job: Find ${maxLeads} ${industryInput} leads...`);
        log(`Filter Mode: ${websiteFilter}`);

        // 1. Pick Strategy (Manual or Random)
        let city = cityInput;
        if (!city) {
            city = settings.cities[Math.floor(Math.random() * settings.cities.length)];
            log(`City not specified. Randomly selected: ${city}`);
        }

        const queryTerm = `${industryInput} in ${city}`;

        log(`Strategy: Targeting "${queryTerm}"`);
        log("Connecting to Google Places API...");

        // 2. Fetch from Google Places API
        const endpoint = `https://places.googleapis.com/v1/places:searchText`;
        let currentPageToken = null;
        let leadsAdded = 0;

        log(`Strategy: Deep Search Pages 2-5...`);

        // Loop through pages 1 to 5
        // Page 1 is fetched only to get the token for Page 2
        for (let pageNum = 1; pageNum <= 5; pageNum++) {
            if (leadsAdded >= maxLeads) break;

            log(`Requesting Page ${pageNum}...`);

            const requestConfig = {
                textQuery: queryTerm,
                maxResultCount: 20
            };
            if (currentPageToken) requestConfig.pageToken = currentPageToken;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.id,nextPageToken'
                },
                body: JSON.stringify(requestConfig)
            });

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(`API Error Page ${pageNum}: ${response.status} - ${errorBody.error?.message || response.statusText}`);
            }

            const data = await response.json();
            currentPageToken = data.nextPageToken;

            // STRATEGY: Skip Page 1 results (Top performers), process Page 2 to 5
            if (pageNum === 1) {
                log("Page 1 found. Skipping top results to target internal pages...");
                if (!currentPageToken) {
                    log("No more results found beyond Page 1.");
                    break;
                }
                log("Waiting 2s for token activation...");
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            if (!data.places || data.places.length === 0) {
                log(`No results on Page ${pageNum}.`);
                break;
            }

            log(`Processing ${data.places.length} candidates from Page ${pageNum}...`);

            for (const place of data.places) {
                if (leadsAdded >= maxLeads) break;

                const name = place.displayName?.text || "Unknown";
                const reviews = place.userRatingCount || 0;
                const website = place.websiteUri || null;

                // --- FILTER LOGIC ---

                // 1. Min Reviews
                if (reviews < settings.minReviews) continue;

                // 2. Website Filter
                if (websiteFilter === 'NO_WEBSITE' && website) {
                    // Skip if we ONLY want No Website, but this one HAS one
                    continue;
                }
                if (websiteFilter === 'HAS_WEBSITE' && !website) {
                    // Skip if we ONLY want Has Website, but this one HAS NONE
                    console.log("Filtered out: No website");
                    continue;
                }

                // --- ANALYZE ---
                const painSignals = [];
                if (!website) painSignals.push('NO_WEBSITE');
                if (reviews < 10) painSignals.push('WEAK_VISIBILITY');

                // --- DEDUPE ---
                const q = query(collection(db, 'leads'), where('place_id', '==', place.id));
                const existing = await getDocs(q);
                if (!existing.empty) continue;

                // --- SAVE ---
                const leadData = {
                    business_name: name,
                    category: industryInput,
                    city: city,
                    address: place.formattedAddress || city,
                    google_rating: place.rating || 0,
                    google_reviews_count: reviews,
                    website: website || '',
                    pain_signals: painSignals,
                    status: 'NEW',
                    source: 'GOOGLE_PLACES_AGENT',
                    discovered_query: queryTerm,
                    place_id: place.id,
                    created_at: new Date().toISOString()
                };

                await addDoc(collection(db, 'leads'), leadData);
                leadsAdded++;
                log(`+ SAVED: ${name} ${!website ? '[No Web]' : ''}`);

                // --- UPDATE PREVIEW ---
                if (previewContainer) {
                    const card = document.createElement('div');
                    card.className = 'card';
                    card.style.cssText = 'padding: 1rem; border-left: 3px solid var(--success); font-size: 0.9rem; animation: fadeIn 0.5s ease; cursor: pointer;';
                    card.innerHTML = `
                    <div class="text-h" style="font-size:1rem; margin-bottom: 5px;">${name}</div>
                    <div class="text-muted text-sm">${place.formattedAddress || city}</div>
                    <div style="margin: 0.5rem 0; color: var(--gold);">${place.rating || '-'} ★ (${reviews})</div>
                    ${!website ? '<span class="badge status-new" style="background:var(--danger); color:white;">No Website</span>' : '<span class="text-muted text-xs">Has Website</span>'}
                `;
                    // Add click to view detail in Leads module (simulate navigation)
                    card.onclick = () => {
                        window.location.hash = '#leads';
                        // Ideally we would open the specific lead, but for now just navigating is good feedback.
                    }
                    previewContainer.appendChild(card);
                }
            }

            if (pageNum < 5 && currentPageToken) {
                log(`Prep for next page... Waiting 1s...`);
                await new Promise(r => setTimeout(r, 1000));
            } else {
                break;
            }
        }

        if (leadsAdded === 0) {
            log("No leads met criteria on Pages 2-5.");
        } else {
            log(`JOB COMPLETE. Added ${leadsAdded} new leads from deep search.`);
        }

        status.innerText = "Done";

    } catch (e) {
        log(`ERROR: ${e.message}`);
        console.error(e);
        status.innerText = "Error";
    } finally {
        btn.disabled = false;
    }
}
