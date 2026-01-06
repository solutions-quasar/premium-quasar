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
                     <button class="btn btn-primary" id="btn-run-agent">RUN NOW</button>
                </div>
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2rem;">
                <!-- Logs / Terminal -->
                <div style="background: #000; border:1px solid var(--border); padding: 1rem; height: 300px; overflow-y: auto; font-family: monospace; font-size: 0.8rem; color: #0f0;" id="hunter-logs">
                    > System Ready...<br>
                    > Waiting for command.<br>
                </div>

                <!-- Config Summary -->
                <div>
                     <div class="text-h">Configuration</div>
                     <div class="form-group">
                        <label class="form-label">Target Cities</label>
                        <div class="text-sm text-muted">${settings.cities.join(', ')}</div>
                     </div>
                     <div class="form-group">
                        <label class="form-label">Target Industries</label>
                        <div class="text-sm text-muted">${settings.industries.join(', ')} (Editable in code for now)</div>
                     </div>
                     <div class="form-group">
                        <label class="form-label">Strategy</label>
                        <div class="text-sm text-muted">Page 2+ Results ONLY (Low Visibility Targets)</div>
                     </div>
                     <button class="btn btn-sm" id="btn-clear-key" style="margin-top: 2rem; border-color: var(--danger); color: var(--danger);">Reset API Key</button>
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
    const status = document.getElementById('stat-run-status');
    const apiKey = localStorage.getItem(STORAGE_KEY_API);

    if (!apiKey) {
        alert('Missing API Key');
        return;
    }

    btn.disabled = true;
    status.innerText = "Running...";

    // Auto-scroll log
    const log = (msg) => {
        logs.innerHTML += `> ${msg}<br>`;
        logs.scrollTop = logs.scrollHeight;
    };

    try {
        log("Starting Lead Hunter Job...");

        // 1. Pick Strategy (Random City + Industry)
        const city = settings.cities[Math.floor(Math.random() * settings.cities.length)];
        const industry = settings.industries[Math.floor(Math.random() * settings.industries.length)];
        const queryTerm = `${industry} in ${city}`;

        log(`Strategy: Targeting "${queryTerm}"`);
        log("Connecting to Google Places API...");

        // 2. Fetch from Google Places API
        const endpoint = `https://places.googleapis.com/v1/places:searchText`;

        // Fetch Page 1 (to skip it? Or just process it?)
        // PROMPT asked for "Page 2 or lower".
        // To do this, we usually need to fetch Page 1 to get the next Page Token.
        // HOWEVER, Google Places (New) API text search might not strictly "page" in the same old way.
        // We will fetch 20 results, look at the token, and fetch the next page.

        log("Requesting Page 1...");
        let response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.id,nextPageToken'
            },
            body: JSON.stringify({
                textQuery: queryTerm,
                maxResultCount: 20 // Max per page
            })
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        let data = await response.json();

        if (!data.nextPageToken) {
            log("Only 1 page of results found. Stopping (Strategy requires >20 results).");
            status.innerText = "Done";
            return;
        }

        // Wait for token to become valid (short delay recommended)
        log("Page 1 found. Waiting to fetch Page 2 (Low Visibility)...");
        await new Promise(r => setTimeout(r, 2000));

        // Fetch Page 2
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.id'
            },
            body: JSON.stringify({
                textQuery: queryTerm,
                maxResultCount: 20,
                pageToken: data.nextPageToken
            })
        });

        if (!response.ok) throw new Error(`API Page 2 Error: ${response.status}`);
        data = await response.json();

        if (!data.places || data.places.length === 0) {
            log("Page 2 was empty.");
            return;
        }

        log(`Analyzing ${data.places.length} candidates from Page 2...`);

        let leadsAdded = 0;

        for (const place of data.places) {
            const name = place.displayName?.text || "Unknown";
            const reviews = place.userRatingCount || 0;
            const website = place.websiteUri || null;

            // Log for debug
            // log(`Checking: ${name} (${reviews} revs)`);

            // Rule: Min Reviews
            if (reviews < settings.minReviews) {
                // log(`- Skip: < 3 reviews`);
                continue;
            }

            // Rule: Heuristics / Pain Signals
            const painSignals = [];
            if (!website) painSignals.push('NO_WEBSITE');
            if (reviews < 10) painSignals.push('WEAK_VISIBILITY');

            // If no URL and has few reviews, it's a prime target.
            // If it has 500 reviews, even on page 2, user might not want it? 
            // Let's stick to the prompt's "Money making" + "Low ranking" (implied by Page 2).

            // Dedupe Check (Real Firestore)
            const q = query(collection(db, 'leads'), where('place_id', '==', place.id));
            const existing = await getDocs(q);
            if (!existing.empty) {
                // log(`- Skip: Duplicate`);
                continue;
            }

            // Save to DB
            const leadData = {
                business_name: name,
                category: industry,
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
            log(`+ SAVED: ${name}`);
        }

        log(`JOB COMPLETE. Added ${leadsAdded} new leads from Page 2.`);
        status.innerText = "Done";

    } catch (e) {
        log(`ERROR: ${e.message}`);
        console.error(e);
        status.innerText = "Error";
    } finally {
        btn.disabled = false;
    }
}
