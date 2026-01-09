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
                        <select id="input-industry" class="form-input" onchange="window.toggleCustomIndustry(this)">
                            <!-- Home Services -->
                            <option value="Plumber">Plumber</option>
                            <option value="Electrician">Electrician</option>
                            <option value="HVAC Contractor">HVAC Contractor</option>
                            <option value="Roofer">Roofer</option>
                            <option value="Landscaper">Landscaper</option>
                            <option value="General Contractor">General Contractor</option>
                            <option value="Painter">Painter</option>
                            <option value="Flooring Specialist">Flooring Specialist</option>
                            <option value="Window & Door Installer">Window & Door Installer</option>
                            <option value="Pest Control">Pest Control</option>
                            <option value="Pool Service">Pool Service</option>
                            <option value="Locksmith">Locksmith</option>
                            <option value="Movers">Movers</option>
                            <option value="Cleaning Service">Cleaning Service</option>
                            <option value="Solar Installer">Solar Installer</option>
                            <option value="Garage Door Repair">Garage Door Repair</option>
                            <option value="Restoration Service">Restoration Service</option>
                            
                            <!-- Health & Wellness -->
                            <option value="Dentist">Dentist</option>
                            <option value="Orthodontist">Orthodontist</option>
                            <option value="Chiropractor">Chiropractor</option>
                            <option value="Physiotherapist">Physiotherapist</option>
                            <option value="Plastic Surgeon">Plastic Surgeon</option>
                            <option value="Dermatologist">Dermatologist</option>
                            <option value="Optometrist">Optometrist</option>
                            <option value="Veterinarian">Veterinarian</option>
                            <option value="Med Spa">Med Spa</option>
                            <option value="Massage Therapist">Massage Therapist</option>
                            <option value="Gym / Fitness Center">Gym / Fitness Center</option>
                            <option value="Yoga Studio">Yoga Studio</option>
                            
                            <!-- Professional Services -->
                            <option value="Real Estate Agent">Real Estate Agent</option>
                            <option value="Mortgage Broker">Mortgage Broker</option>
                            <option value="Insurance Agent">Insurance Agent</option>
                            <option value="Accountant / CPA">Accountant / CPA</option>
                            <option value="Lawyer - Personal Injury">Lawyer - Personal Injury</option>
                            <option value="Lawyer - Family Law">Lawyer - Family Law</option>
                            <option value="Lawyer - Criminal Defense">Lawyer - Criminal Defense</option>
                            <option value="Financial Advisor">Financial Advisor</option>
                            <option value="Architect">Architect</option>
                            <option value="Interior Designer">Interior Designer</option>
                            
                            <!-- Automotive -->
                            <option value="Auto Repair Shop">Auto Repair Shop</option>
                            <option value="Auto Body Shop">Auto Body Shop</option>
                            <option value="Car Detailer">Car Detailer</option>
                            <option value="Tire Shop">Tire Shop</option>
                            <option value="Towing Service">Towing Service</option>
                            
                            <!-- Events & Lifestyle -->
                            <option value="Wedding Planner">Wedding Planner</option>
                            <option value="Photographer">Photographer</option>
                            <option value="Florist">Florist</option>
                            <option value="Caterer">Caterer</option>
                            <option value="Event Venue">Event Venue</option>
                             
                            <!-- B2B & Other -->
                            <option value="Marketing Agency">Marketing Agency</option>
                            <option value="Web Design Agency">Web Design Agency</option>
                            <option value="IT Support / MSP">IT Support / MSP</option>
                            <option value="Printing & Signage">Printing & Signage</option>
                            <option value="Commercial Cleaner">Commercial Cleaner</option>
                            
                            <option value="CUSTOM">-- Custom --</option>
                        </select>
                        <input type="text" id="input-industry-custom" class="form-input mt-2" style="display:none; margin-top:8px;" placeholder="Enter custom industry...">
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
                        <select id="input-city" class="form-input" onchange="window.toggleCustomCity(this)">
                            <option value="">-- Random City --</option>
                            
                            <optgroup label="Ontario">
                                <option value="Toronto, ON">Toronto, ON</option>
                                <option value="Ottawa, ON">Ottawa, ON</option>
                                <option value="Mississauga, ON">Mississauga, ON</option>
                                <option value="Brampton, ON">Brampton, ON</option>
                                <option value="Hamilton, ON">Hamilton, ON</option>
                                <option value="London, ON">London, ON</option>
                                <option value="Markham, ON">Markham, ON</option>
                                <option value="Vaughan, ON">Vaughan, ON</option>
                            </optgroup>

                            <optgroup label="British Columbia">
                                <option value="Vancouver, BC">Vancouver, BC</option>
                                <option value="Surrey, BC">Surrey, BC</option>
                                <option value="Burnaby, BC">Burnaby, BC</option>
                                <option value="Richmond, BC">Richmond, BC</option>
                                <option value="Kelowna, BC">Kelowna, BC</option>
                                <option value="Victoria, BC">Victoria, BC</option>
                            </optgroup>

                            <optgroup label="Quebec">
                                <option value="Montreal, QC">Montreal, QC</option>
                                <option value="Quebec City, QC">Quebec City, QC</option>
                                <option value="Laval, QC">Laval, QC</option>
                                <option value="Gatineau, QC">Gatineau, QC</option>
                                <option value="Longueuil, QC">Longueuil, QC</option>
                                <option value="Sherbrooke, QC">Sherbrooke, QC</option>
                            </optgroup>

                            <optgroup label="Alberta">
                                <option value="Calgary, AB">Calgary, AB</option>
                                <option value="Edmonton, AB">Edmonton, AB</option>
                                <option value="Red Deer, AB">Red Deer, AB</option>
                                <option value="Lethbridge, AB">Lethbridge, AB</option>
                                <option value="St. Albert, AB">St. Albert, AB</option>
                            </optgroup>

                            <optgroup label="Manitoba">
                                <option value="Winnipeg, MB">Winnipeg, MB</option>
                                <option value="Brandon, MB">Brandon, MB</option>
                                <option value="Steinbach, MB">Steinbach, MB</option>
                                <option value="Thompson, MB">Thompson, MB</option>
                                <option value="Portage la Prairie, MB">Portage la Prairie, MB</option>
                            </optgroup>

                            <optgroup label="Saskatchewan">
                                <option value="Saskatoon, SK">Saskatoon, SK</option>
                                <option value="Regina, SK">Regina, SK</option>
                                <option value="Prince Albert, SK">Prince Albert, SK</option>
                                <option value="Moose Jaw, SK">Moose Jaw, SK</option>
                                <option value="Swift Current, SK">Swift Current, SK</option>
                            </optgroup>

                            <optgroup label="Nova Scotia">
                                <option value="Halifax, NS">Halifax, NS</option>
                                <option value="Sydney, NS">Sydney, NS</option>
                                <option value="Truro, NS">Truro, NS</option>
                                <option value="New Glasgow, NS">New Glasgow, NS</option>
                                <option value="Glace Bay, NS">Glace Bay, NS</option>
                            </optgroup>

                            <optgroup label="New Brunswick">
                                <option value="Moncton, NB">Moncton, NB</option>
                                <option value="Saint John, NB">Saint John, NB</option>
                                <option value="Fredericton, NB">Fredericton, NB</option>
                                <option value="Dieppe, NB">Dieppe, NB</option>
                                <option value="Miramichi, NB">Miramichi, NB</option>
                            </optgroup>

                            <optgroup label="Newfoundland & Labrador">
                                <option value="St. John's, NL">St. John's, NL</option>
                                <option value="Mount Pearl, NL">Mount Pearl, NL</option>
                                <option value="Corner Brook, NL">Corner Brook, NL</option>
                                <option value="Conception Bay South, NL">Conception Bay South, NL</option>
                                <option value="Paradise, NL">Paradise, NL</option>
                            </optgroup>
                            
                            <optgroup label="PEI">
                                <option value="Charlottetown, PE">Charlottetown, PE</option>
                                <option value="Summerside, PE">Summerside, PE</option>
                                <option value="Stratford, PE">Stratford, PE</option>
                                <option value="Cornwall, PE">Cornwall, PE</option>
                            </optgroup>

                            <option value="CUSTOM">-- Custom --</option>
                        </select>
                        <input type="text" id="input-city-custom" class="form-input mt-2" style="display:none; margin-top:8px;" placeholder="Enter custom city (e.g. New York, NY)">
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
    let industryInput = document.getElementById('input-industry').value;
    if (industryInput === 'CUSTOM') {
        industryInput = document.getElementById('input-industry-custom').value.trim();
    }
    industryInput = industryInput || 'Business';
    let cityInput = document.getElementById('input-city').value;
    if (cityInput === 'CUSTOM') {
        cityInput = document.getElementById('input-city-custom').value.trim();
    }
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
            // Expanded default list for randomness
            const defaultCities = [
                'Toronto, ON', 'Vancouver, BC', 'Montreal, QC', 'Calgary, AB', 'Ottawa, ON',
                'Edmonton, AB', 'Winnipeg, MB', 'Mississauga, ON', 'Brampton, ON', 'Hamilton, ON',
                'Quebec City, QC', 'Halifax, NS', 'London, ON', 'Victoria, BC', 'Saskatoon, SK'
            ];
            city = defaultCities[Math.floor(Math.random() * defaultCities.length)];
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
                    google_page_rank: pageNum,
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

window.toggleCustomIndustry = (select) => {
    const customInput = document.getElementById('input-industry-custom');
    if (select.value === 'CUSTOM') {
        customInput.style.display = 'block';
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        customInput.value = '';
    }
};

window.toggleCustomCity = (select) => {
    const customInput = document.getElementById('input-city-custom');
    if (select.value === 'CUSTOM') {
        customInput.style.display = 'block';
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        customInput.value = '';
    }
};
