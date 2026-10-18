import { db, auth } from '../firebase-config.js';
import { collection, addDoc, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { LeadFilterService } from '../services/LeadFilterService.js';
import { triggerWorkflowForLead } from './automations.js';
import { detectDirectoryPlatform } from '../services/directoryDetector.js';

const API_BASE = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : '';

// -- CONFIG --
const STORAGE_KEY_API = 'erp_google_places_key';
const STORAGE_KEY_SETTINGS = 'erp_hunter_settings';

// Initial Settings
let settings = {
    cities: ['Toronto, ON', 'Vancouver, BC', 'Montreal, QC', 'Calgary, AB', 'Ottawa, ON'],
    industries: ['Lawyer', 'Accountant', 'Dentist', 'Plumber', 'Real Estate Agent', 'Marketing Agency'],
    minReviews: 3
};

// -- CUSTOM SLEEK SVG ICONS (Ultra-Clean, High-Readability) --
export const HUNTER_SVGS = {
    radar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/><path d="M4 6h.01"/><path d="M2.29 9.62A10 10 0 0 0 21.42 14"/><path d="M16.24 7.76A6 6 0 1 0 8.23 16.24"/><path d="M12 12h.01"/><path d="m14.5 9.5-2.5 2.5"/></svg>`,
    bolt: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    save: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
    pause: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
    play: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    sliders: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
    globe: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
    mapPin: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    briefcase: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
    search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
    activity: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    chevronDown: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
    clock: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    message: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    brain: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>`,
    bell: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
    check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
};

const REGIONS_LIST = {
    CA: [
        { id: 'ALL', label: '🍁 Toutes les provinces canadiennes (Rotation)' },
        { id: 'QC', label: 'Québec (QC) - Montréal, Québec, Laval, Sherbrooke, Lévis...' },
        { id: 'ON', label: 'Ontario (ON) - Toronto, Ottawa, Mississauga, Brampton, Hamilton...' },
        { id: 'NB', label: 'Nouveau-Brunswick (NB) - Moncton, Dieppe, Fredericton, Saint John...' },
        { id: 'NS', label: 'Nouvelle-Écosse (NS) - Halifax, Dartmouth, Sydney...' },
        { id: 'BC', label: 'Colombie-Britannique (BC) - Vancouver, Surrey, Burnaby, Victoria...' },
        { id: 'AB', label: 'Alberta (AB) - Calgary, Edmonton, Red Deer, Lethbridge...' },
        { id: 'MB', label: 'Manitoba (MB) - Winnipeg, Brandon, Steinbach...' },
        { id: 'SK', label: 'Saskatchewan (SK) - Saskatoon, Regina, Prince Albert...' },
        { id: 'NL', label: 'Terre-Neuve-et-Labrador (NL) - St. John\'s, Mount Pearl...' },
        { id: 'PE', label: 'Île-du-Prince-Édouard (PE) - Charlottetown, Summerside...' }
    ],
    US: [
        { id: 'ALL', label: '🦅 Tous les états américains (Rotation)' },
        { id: 'FL', label: 'Florida (FL) - Tampa, Miami, Orlando, Jacksonville, Fort Lauderdale...' },
        { id: 'GA', label: 'Georgia (GA) - Atlanta, Savannah, Augusta, Columbus...' },
        { id: 'NC', label: 'North Carolina (NC) - Charlotte, Raleigh, Greensboro, Durham...' },
        { id: 'TX', label: 'Texas (TX) - Houston, Dallas, Austin, San Antonio, Fort Worth...' },
        { id: 'CA_US', label: 'California (CA) - Los Angeles, San Diego, San Francisco, San Jose...' },
        { id: 'NY', label: 'New York (NY) - New York City, Buffalo, Rochester, Albany...' },
        { id: 'IL', label: 'Illinois (IL) - Chicago, Aurora, Naperville, Joliet...' },
        { id: 'MA', label: 'Massachusetts (MA) - Boston, Worcester, Cambridge, Lowell...' },
        { id: 'WA', label: 'Washington (WA) - Seattle, Spokane, Tacoma, Vancouver...' },
        { id: 'CO', label: 'Colorado (CO) - Denver, Colorado Springs, Aurora, Boulder...' },
        { id: 'AZ', label: 'Arizona (AZ) - Phoenix, Tucson, Scottsdale, Mesa, Chandler...' }
    ]
};

const INDUSTRIES_LIST = [
    { id: 'ALL', label: '🔄 Rotation Toutes Professions (Multi-Secteurs)' },
    { id: 'Plumber', label: '🔧 Plombier (Plumber)' },
    { id: 'Electrician', label: '⚡ Électricien (Electrician)' },
    { id: 'Roofer', label: '🏠 Couvreur / Toiture (Roofer)' },
    { id: 'HVAC Contractor', label: '❄️ Climatisation, Chauffage & Ventilation (HVAC)' },
    { id: 'General Contractor', label: '🔨 Entrepreneur Général / Rénovation' },
    { id: 'Auto Repair Shop', label: '🚗 Garage & Mécanique Automobile' },
    { id: 'Dentist', label: '🦷 Dentiste / Clinique Dentaire' },
    { id: 'Med Spa', label: '💆‍♀️ Clinique Esthétique & Med Spa' },
    { id: 'Lawyer', label: '⚖️ Avocat / Cabinet Juridique' },
    { id: 'Accountant', label: '📊 Comptable / Fiscaliste / CPA' },
    { id: 'Cleaning Service', label: '🧹 Entretien Ménager & Nettoyage Commercial' },
    { id: 'Landscaper', label: '🌿 Paysagiste & Aménagement Extérieur' },
    { id: 'Pest Control', label: '🐜 Exterminateur / Gestion Parasitaire' },
    { id: 'Window & Door Installer', label: '🪟 Portes et Fenêtres' },
    { id: 'Flooring Specialist', label: '🪵 Pose de Planchers & Céramique' },
    { id: 'Veterinarian', label: '🐾 Clinique Vétérinaire' },
    { id: 'Optometrist', label: '👓 Optométriste & Lunetterie' },
    { id: 'Real Estate Agent', label: '🏡 Courtier Immobilier' },
    { id: 'CUSTOM', label: '✏️ Métier Spécifique (Personnalisé...)' }
];

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function buildRegionOptionsHtml(selectedCountry, currentRegion = 'ALL') {
    let html = '';
    if (selectedCountry === 'CA') {
        html += `<option value="ALL" ${currentRegion === 'ALL' ? 'selected' : ''}>🍁 Toutes les provinces canadiennes (Rotation)</option>`;
        REGIONS_LIST.CA.filter(r => r.id !== 'ALL').forEach(r => {
            html += `<option value="${r.id}" ${currentRegion === r.id ? 'selected' : ''}>${r.label}</option>`;
        });
    } else if (selectedCountry === 'US') {
        html += `<option value="ALL" ${currentRegion === 'ALL' ? 'selected' : ''}>🦅 Tous les états américains (Rotation)</option>`;
        REGIONS_LIST.US.filter(r => r.id !== 'ALL').forEach(r => {
            html += `<option value="${r.id}" ${currentRegion === r.id ? 'selected' : ''}>${r.label}</option>`;
        });
    } else {
        html += `<option value="ALL" ${currentRegion === 'ALL' ? 'selected' : ''}>🌎 Toutes les provinces & états (Canada + USA)</option>`;
        html += `<optgroup label="🇨🇦 Canada">`;
        REGIONS_LIST.CA.filter(r => r.id !== 'ALL').forEach(r => {
            html += `<option value="${r.id}" ${currentRegion === r.id ? 'selected' : ''}>${r.label}</option>`;
        });
        html += `</optgroup>`;
        html += `<optgroup label="🇺🇸 USA">`;
        REGIONS_LIST.US.filter(r => r.id !== 'ALL').forEach(r => {
            html += `<option value="${r.id}" ${currentRegion === r.id ? 'selected' : ''}>${r.label}</option>`;
        });
        html += `</optgroup>`;
    }
    return html;
}

function buildIndustryOptionsHtml(currentIndustry = 'ALL') {
    return INDUSTRIES_LIST.map(ind => {
        return `<option value="${ind.id}" ${currentIndustry === ind.id ? 'selected' : ''}>${ind.label}</option>`;
    }).join('');
}

let autopilotConfig = {
    isActive: false,
    frequencyHours: 6,
    leadsPerBatch: 10,
    websiteFilter: 'NO_WEBSITE',
    autoAuditAndSequence: true,
    adminAlertPhone: '+15062337006',
    adminAlertsEnabled: true,
    targetCountry: 'CA',
    targetRegion: 'ALL',
    targetIndustry: 'ALL',
    customIndustry: '',
    lastRunAt: null,
    lastRunSummary: null,
    totalLeadsHunted: 0,
    status: 'idle'
};

async function fetchAutopilotConfig() {
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/hunter/config`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.success && data.config) {
            autopilotConfig = data.config;
            return data.config;
        }
    } catch (e) {
        console.warn("[LeadHunter] Error fetching autopilot config:", e.message);
    }
    return autopilotConfig;
}

// --- INIT ---
export async function initLeadHunter() {
    const container = document.getElementById('view-leadhunter');

    // Fetch backend autopilot settings first
    const backendCfg = await fetchAutopilotConfig();
    if (backendCfg?.apiKey && !localStorage.getItem(STORAGE_KEY_API)) {
        localStorage.setItem(STORAGE_KEY_API, backendCfg.apiKey);
    }

    // Check for API Key
    const apiKey = localStorage.getItem(STORAGE_KEY_API) || backendCfg?.apiKey;
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
            window.showToast('Clé Google Places API invalide', 'warn');
        }
    });
}

function renderHunterUI(container) {
    // Load persisted settings
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (saved) settings = JSON.parse(saved);

    const apiKey = localStorage.getItem(STORAGE_KEY_API) || autopilotConfig.apiKey || '';
    const isAutopilotActive = autopilotConfig.isActive === true;
    const freq = autopilotConfig.frequencyHours || 6;
    const batch = autopilotConfig.leadsPerBatch || 10;
    const filter = autopilotConfig.websiteFilter || 'NO_WEBSITE';
    const totalHunted = autopilotConfig.totalLeadsHunted || 0;
    const lastSummary = autopilotConfig.lastRunSummary;

    const targetCountry = autopilotConfig.targetCountry || 'CA';
    const targetRegion = autopilotConfig.targetRegion || 'ALL';
    const targetIndustry = autopilotConfig.targetIndustry || 'ALL';
    const customIndustry = autopilotConfig.customIndustry || '';

    let lastRunText = "En attente du premier cycle automatique...";
    if (autopilotConfig.lastRunAt) {
        const d = new Date(autopilotConfig.lastRunAt);
        const timeStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        if (lastSummary) {
            lastRunText = `Dernier cycle : ${timeStr} • ${lastSummary.leadsAdded} leads qualifiés chassés pour "${lastSummary.query || ''}"`;
        } else {
            lastRunText = `Dernier cycle : ${timeStr}`;
        }
    }

    container.innerHTML = `
        <!-- AUTO-PILOT 24/7 BACKGROUND SOURCING CARD -->
        <div class="hunter-card-clean">
            <!-- Header Row -->
            <div class="hunter-header-row">
                <div class="hunter-title-area">
                    <div class="hunter-icon-box">
                        ${HUNTER_SVGS.radar}
                    </div>
                    <div>
                        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                            <h3 class="hunter-title">Chasseur Auto-Pilot 24/7</h3>
                            <span id="autopilot-status-badge" class="hunter-status-pill ${isAutopilotActive ? 'hunter-status-active' : 'hunter-status-paused'}">
                                ${isAutopilotActive ? '● ACTIF (En service)' : '○ EN PAUSE'}
                            </span>
                        </div>
                        <div class="hunter-desc">
                            Prospection autonome Google Places (Canada & USA). Le serveur cycle en arrière-plan, extrait les coordonnées, audite et alimente le pipeline en continu.
                        </div>
                    </div>
                </div>

                <!-- Master Toggle Switch -->
                <div style="display:flex; align-items:center; gap:12px; background:rgba(0,0,0,0.35); border:1px solid rgba(255,255,255,0.08); padding:6px 14px; border-radius:24px;">
                    <span id="autopilot-toggle-label" style="font-size:0.8rem; font-weight:600; color:${isAutopilotActive ? '#4ADE80' : '#FBBF24'};">
                        ${isAutopilotActive ? 'En service' : 'En pause'}
                    </span>
                    <label class="ai-toggle-switch" style="position:relative; display:inline-block; width:44px; height:22px; cursor:pointer;" title="Activer / Désactiver l'auto-pilot">
                        <input type="checkbox" id="autopilot-toggle" ${isAutopilotActive ? 'checked' : ''} onchange="window.handleAutopilotToggleChange(this)">
                        <span class="ai-slider"></span>
                    </label>
                </div>
            </div>

            <!-- Direct 3-Column Targeting Grid (Airy, No Nested Boxes) -->
            <div class="hunter-targeting-grid">
                <div class="hunter-field-group">
                    <label class="hunter-label">
                        ${HUNTER_SVGS.globe}
                        <span>Pays cible</span>
                    </label>
                    <select id="autopilot-country" class="hunter-select" onchange="window.handleAutopilotCountryChange(this.value)">
                        <option value="CA" ${targetCountry === 'CA' ? 'selected' : ''}>🇨🇦 Canada</option>
                        <option value="US" ${targetCountry === 'US' ? 'selected' : ''}>🇺🇸 États-Unis (USA)</option>
                        <option value="ALL" ${targetCountry === 'ALL' ? 'selected' : ''}>🌎 Canada & USA (Alternance)</option>
                    </select>
                </div>

                <div class="hunter-field-group">
                    <label class="hunter-label">
                        ${HUNTER_SVGS.mapPin}
                        <span>Province ou État</span>
                    </label>
                    <select id="autopilot-region" class="hunter-select">
                        ${buildRegionOptionsHtml(targetCountry, targetRegion)}
                    </select>
                </div>

                <div class="hunter-field-group">
                    <label class="hunter-label">
                        ${HUNTER_SVGS.briefcase}
                        <span>Profession ciblée</span>
                    </label>
                    <select id="autopilot-industry" class="hunter-select" onchange="window.handleAutopilotIndustryChange(this.value)">
                        ${buildIndustryOptionsHtml(targetIndustry)}
                    </select>
                </div>
            </div>

            <!-- Custom Profession Input (Smoothly revealed when 'CUSTOM' selected) -->
            <div class="hunter-field-group" id="autopilot-custom-industry-group" style="margin-bottom:16px; display:${targetIndustry === 'CUSTOM' ? 'flex' : 'none'};">
                <label class="hunter-label">Métier personnalisé :</label>
                <input type="text" id="autopilot-custom-industry" class="hunter-input" value="${escapeHtml(customIndustry)}" placeholder="Ex: Serrurier, Peintre, Traiteur, Clinique d'ostéopathie...">
            </div>

            <!-- Options Ribbon & Advanced Settings Toggle -->
            <div class="hunter-options-ribbon">
                <div style="display:flex; align-items:center; gap:18px; flex-wrap:wrap;">
                    <label class="hunter-checkbox-label">
                        <input type="checkbox" id="autopilot-auto-pipeline" ${autopilotConfig.autoAuditAndSequence !== false ? 'checked' : ''}>
                        <span>Audit IA & Attribution automatique de séquence</span>
                    </label>

                    <label class="hunter-checkbox-label">
                        <input type="checkbox" id="autopilot-admin-alerts" ${autopilotConfig.adminAlertsEnabled !== false ? 'checked' : ''}>
                        <span>Alerte SMS Admin (+1 506 233-7006)</span>
                    </label>
                </div>

                <button type="button" onclick="window.toggleHunterAdvancedSettings()" style="display:inline-flex; align-items:center; gap:6px; font-size:0.78rem; font-weight:600; color:#94A3B8; background:transparent; border:none; cursor:pointer; padding:4px 8px; border-radius:6px; transition:color 0.15s ease;" onmouseover="this.style.color='#F8FAFC'" onmouseout="this.style.color='#94A3B8'">
                    ${HUNTER_SVGS.sliders}
                    <span>Paramètres avancés & API</span>
                    <span id="hunter-adv-arrow" style="display:inline-flex; transition:transform 0.2s;">${HUNTER_SVGS.chevronDown}</span>
                </button>
            </div>

            <!-- Advanced Settings Drawer (Hidden by default to keep the UI light) -->
            <div id="hunter-advanced-panel" class="hunter-advanced-panel" style="display:none;">
                <div class="hunter-field-group">
                    <label class="hunter-label">Fréquence des cycles</label>
                    <select id="autopilot-frequency" class="hunter-select">
                        <option value="2" ${freq === 2 ? 'selected' : ''}>Toutes les 2 heures</option>
                        <option value="4" ${freq === 4 ? 'selected' : ''}>Toutes les 4 heures</option>
                        <option value="6" ${freq === 6 ? 'selected' : ''}>Toutes les 6 heures (Recommandé)</option>
                        <option value="12" ${freq === 12 ? 'selected' : ''}>Toutes les 12 heures</option>
                        <option value="24" ${freq === 24 ? 'selected' : ''}>Quotidien (Toutes les 24h)</option>
                    </select>
                </div>

                <div class="hunter-field-group">
                    <label class="hunter-label">Quota par cycle</label>
                    <select id="autopilot-batch" class="hunter-select">
                        <option value="5" ${batch === 5 ? 'selected' : ''}>5 leads qualifiés</option>
                        <option value="10" ${batch === 10 ? 'selected' : ''}>10 leads qualifiés (Recommandé)</option>
                        <option value="15" ${batch === 15 ? 'selected' : ''}>15 leads qualifiés</option>
                        <option value="25" ${batch === 25 ? 'selected' : ''}>25 leads qualifiés</option>
                    </select>
                </div>

                <div class="hunter-field-group">
                    <label class="hunter-label">Ciblage Site Web</label>
                    <select id="autopilot-filter" class="hunter-select">
                        <option value="NO_WEBSITE" ${filter === 'NO_WEBSITE' ? 'selected' : ''}>Sans site web uniquement (Priorité 1)</option>
                        <option value="ALL" ${filter === 'ALL' ? 'selected' : ''}>Tous les prospects</option>
                        <option value="HAS_WEBSITE" ${filter === 'HAS_WEBSITE' ? 'selected' : ''}>Avec site web (Refonte & IA)</option>
                    </select>
                </div>

                <div class="hunter-field-group">
                    <label class="hunter-label">Clé Google Places API</label>
                    <input type="password" id="autopilot-api-key" class="hunter-input" value="${escapeHtml(apiKey)}" placeholder="AIzaSy..." style="font-family:monospace;">
                </div>
            </div>

            <!-- Live Status & Action Buttons -->
            <div class="hunter-actions-bar">
                <div style="font-size:0.8rem; color:#94A3B8; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <span style="display:flex; align-items:center; gap:6px; color:#CBD5E1;">
                        ${HUNTER_SVGS.clock}
                        <span id="autopilot-last-run-info">${escapeHtml(lastRunText)}</span>
                    </span>
                    <span style="display:inline-block; width:3px; height:3px; border-radius:50%; background:rgba(255,255,255,0.25);"></span>
                    <span class="lead-pill-subtle">
                        ${totalHunted} leads chassés au total
                    </span>
                </div>

                <div style="display:flex; align-items:center; gap:10px;">
                    <button type="button" id="btn-run-autopilot-now" class="lead-action-btn" onclick="window.runHunterAutopilotNow()" style="padding:8px 16px; font-weight:600; color:#E2E8F0; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12);">
                        ${HUNTER_SVGS.bolt}
                        <span>Lancer un cycle immédiat</span>
                    </button>
                    <button type="button" class="lead-action-btn sms-btn" onclick="window.saveHunterAutopilotConfig()" style="padding:8px 20px; font-weight:700;">
                        ${HUNTER_SVGS.save}
                        <span>Enregistrer</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- REAL-TIME AI ACTIVITY & SMS MONITOR -->
        <div class="hunter-card-clean">
            <!-- Header Row -->
            <div class="hunter-header-row" style="margin-bottom:16px;">
                <div class="hunter-title-area">
                    <div class="hunter-icon-box" style="background:rgba(96,165,250,0.1); border-color:rgba(96,165,250,0.25); color:#60A5FA;">
                        ${HUNTER_SVGS.activity}
                    </div>
                    <div>
                        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                            <h3 class="hunter-title">Activité IA en Direct</h3>
                            <span id="ai-feed-sse-badge" class="hunter-status-pill hunter-status-active" style="font-size:0.7rem; padding:2px 8px;">
                                <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#4ADE80; box-shadow:0 0 6px #4ADE80;"></span>
                                <span>FLUX EN DIRECT (SSE)</span>
                            </span>
                        </div>
                        <div class="hunter-desc">
                            Actions en direct de l'IA : prospection Google Places, qualification des téléphones, audits cognitifs et simulations/envois SMS.
                        </div>
                    </div>
                </div>

                <!-- Live Stream Controls -->
                <div style="display:flex; align-items:center; gap:8px;">
                    <button type="button" id="btn-ai-feed-pause" class="lead-action-btn" onclick="window.toggleAiFeedPause()" style="font-size:0.78rem; padding:6px 12px;">
                        <span id="icon-ai-feed-pause" style="display:inline-flex;">${HUNTER_SVGS.pause}</span>
                        <span id="label-ai-feed-pause">Pause</span>
                    </button>
                    <button type="button" class="lead-action-btn" onclick="window.clearAiFeedDisplay()" style="font-size:0.78rem; padding:6px 12px;" title="Effacer l'affichage">
                        ${HUNTER_SVGS.trash}
                        <span>Vider l'écran</span>
                    </button>
                </div>
            </div>

            <!-- Filter Pills -->
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.06);">
                <span style="font-size:0.72rem; font-weight:600; color:#64748B; text-transform:uppercase; margin-right:4px;">Filtrer :</span>
                <button type="button" class="hunter-pill-tab ai-filter-pill active" id="btn-filter-all" onclick="window.filterAiFeed('all', this)">
                    Tous (<span id="count-ai-all">0</span>)
                </button>
                <button type="button" class="hunter-pill-tab ai-filter-pill" id="btn-filter-sourcing" onclick="window.filterAiFeed('sourcing', this)">
                    Sourcing (<span id="count-ai-sourcing">0</span>)
                </button>
                <button type="button" class="hunter-pill-tab ai-filter-pill" id="btn-filter-audit" onclick="window.filterAiFeed('audit', this)">
                    Audit IA (<span id="count-ai-audit">0</span>)
                </button>
                <button type="button" class="hunter-pill-tab ai-filter-pill" id="btn-filter-sms" onclick="window.filterAiFeed('sms', this)">
                    SMS Séquences (<span id="count-ai-sms">0</span>)
                </button>
                <button type="button" class="hunter-pill-tab ai-filter-pill" id="btn-filter-admin" onclick="window.filterAiFeed('admin_alert', this)">
                    Alertes Admin (<span id="count-ai-admin">0</span>)
                </button>
            </div>

            <!-- Feed Container -->
            <div id="ai-live-feed-container" class="hunter-feed-container">
                <div id="ai-feed-empty" style="text-align:center; padding:32px 16px; color:#64748B;">
                    <div style="display:inline-flex; opacity:0.4; margin-bottom:6px;">${HUNTER_SVGS.radar}</div>
                    <div style="font-size:0.86rem; font-weight:500;">En attente d'événements du flux IA...</div>
                    <div style="font-size:0.76rem; color:#475569; margin-top:3px;">Lancez un cycle immédiat ou activez l'Auto-Pilot pour suivre l'activité.</div>
                </div>
            </div>
        </div>

        <!-- MANUAL SEARCH & TESTING AGENT (Collapsible Accordion) -->
        <div class="hunter-card-clean" style="margin-top:20px; padding:18px 22px;">
            <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="window.toggleHunterManualAccordion()">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="color:#64748B; display:inline-flex;">
                        ${HUNTER_SVGS.search}
                    </div>
                    <div>
                        <div style="font-size:0.92rem; font-weight:600; color:#E2E8F0;">Recherche Manuelle Ponctuelle & Deep Search</div>
                        <div style="font-size:0.78rem; color:#64748B;">Outils de test ponctuel pour sonder directement une ville ou les pages 2 à 5 de Google Places</div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <span class="lead-pill-subtle" id="stat-run-status" style="font-size:0.75rem;">Prêt</span>
                    <button class="lead-action-btn" id="btn-clear-key" onclick="event.stopPropagation();" style="border-color: rgba(239, 68, 68, 0.2); color: #F87171; font-size:0.75rem; padding:4px 8px;">Reset Key</button>
                    <span id="hunter-manual-chevron" style="color:#64748B; display:inline-flex; transition:transform 0.2s;">
                        ${HUNTER_SVGS.chevronDown}
                    </span>
                </div>
            </div>

            <div id="hunter-manual-content" style="display:none; margin-top:16px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.06);">
                <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap: 1.5rem;">
                    <!-- Logs / Terminal (Airy modern dark) -->
                    <div style="background: #090B0F; border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding: 12px; min-height: 260px; max-height: 380px; overflow-y: auto; font-family: monospace; font-size: 0.78rem; color: #38BDF8; line-height: 1.5;" id="hunter-logs">
                        > Système de prospection manuelle prêt...<br>
                        > Choisissez vos paramètres et cliquez sur Démarrer.<br>
                    </div>

                    <!-- Config Form -->
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <div class="hunter-field-group">
                            <label class="hunter-label">Secteur / Métier cible</label>
                            <select id="input-industry" class="hunter-select" onchange="window.toggleCustomIndustry(this)">
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
                                <option value="Auto Repair Shop">Auto Repair Shop</option>
                                <option value="Auto Body Shop">Auto Body Shop</option>
                                <option value="Car Detailer">Car Detailer</option>
                                <option value="Tire Shop">Tire Shop</option>
                                <option value="Towing Service">Towing Service</option>
                                <option value="Wedding Planner">Wedding Planner</option>
                                <option value="Photographer">Photographer</option>
                                <option value="Florist">Florist</option>
                                <option value="Caterer">Caterer</option>
                                <option value="Event Venue">Event Venue</option>
                                <option value="Marketing Agency">Marketing Agency</option>
                                <option value="Web Design Agency">Web Design Agency</option>
                                <option value="IT Support / MSP">IT Support / MSP</option>
                                <option value="Printing & Signage">Printing & Signage</option>
                                <option value="Commercial Cleaner">Commercial Cleaner</option>
                                <option value="CUSTOM">-- Custom --</option>
                            </select>
                            <input type="text" id="input-industry-custom" class="hunter-input" style="display:none; margin-top:6px;" placeholder="Entrez un métier personnalisé...">
                        </div>

                        <div class="hunter-field-group">
                            <label class="hunter-label">Filtre Présence Web</label>
                            <select id="input-website-filter" class="hunter-select">
                                <option value="ALL">Tous (Avec ou sans site web)</option>
                                <option value="NO_WEBSITE" selected>Sans site web uniquement (Priorité 1)</option>
                                <option value="HAS_WEBSITE">Avec site web (Refonte & IA)</option>
                            </select>
                        </div>

                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                            <div class="hunter-field-group">
                                <label class="hunter-label">Leads max</label>
                                <input type="number" id="input-max-leads" class="hunter-input" value="10" min="1" max="50">
                            </div>
                            <div class="hunter-field-group">
                                <label class="hunter-label">Ville ciblée</label>
                                <select id="input-city" class="hunter-select" onchange="window.toggleCustomCity(this)">
                                    <option value="">-- Ville aléatoire --</option>
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
                                    <optgroup label="USA - Major Metros (East & South)">
                                        <option value="New York, NY">New York, NY</option>
                                        <option value="Miami, FL">Miami, FL</option>
                                        <option value="Orlando, FL">Orlando, FL</option>
                                        <option value="Tampa, FL">Tampa, FL</option>
                                        <option value="Atlanta, GA">Atlanta, GA</option>
                                        <option value="Charlotte, NC">Charlotte, NC</option>
                                        <option value="Philadelphia, PA">Philadelphia, PA</option>
                                        <option value="Boston, MA">Boston, MA</option>
                                        <option value="Nashville, TN">Nashville, TN</option>
                                    </optgroup>
                                    <optgroup label="USA - Central & Texas">
                                        <option value="Houston, TX">Houston, TX</option>
                                        <option value="Dallas, TX">Dallas, TX</option>
                                        <option value="Austin, TX">Austin, TX</option>
                                        <option value="San Antonio, TX">San Antonio, TX</option>
                                        <option value="Chicago, IL">Chicago, IL</option>
                                        <option value="Indianapolis, IN">Indianapolis, IN</option>
                                        <option value="Columbus, OH">Columbus, OH</option>
                                        <option value="Minneapolis, MN">Minneapolis, MN</option>
                                    </optgroup>
                                    <optgroup label="USA - West & Mountain">
                                        <option value="Los Angeles, CA">Los Angeles, CA</option>
                                        <option value="San Francisco, CA">San Francisco, CA</option>
                                        <option value="San Diego, CA">San Diego, CA</option>
                                        <option value="Seattle, WA">Seattle, WA</option>
                                        <option value="Denver, CO">Denver, CO</option>
                                        <option value="Phoenix, AZ">Phoenix, AZ</option>
                                        <option value="Las Vegas, NV">Las Vegas, NV</option>
                                        <option value="Portland, OR">Portland, OR</option>
                                        <option value="Salt Lake City, UT">Salt Lake City, UT</option>
                                    </optgroup>
                                    <option value="CUSTOM">-- Ville personnalisée --</option>
                                </select>
                            </div>
                        </div>
                        <input type="text" id="input-city-custom" class="hunter-input" style="display:none;" placeholder="Ville personnalisée (ex: Moncton, NB)">

                        <label class="hunter-checkbox-label" style="margin-top:4px;">
                            <input type="checkbox" id="input-auto-reachout">
                            <span>Pipeline Automatique (Audit IA & Envoi SMS dès découverte)</span>
                        </label>

                        <button class="lead-action-btn sms-btn" id="btn-run-agent" style="width:100%; padding:9px; font-weight:700; margin-top:4px;">
                            ${HUNTER_SVGS.bolt}
                            <span>Lancer la recherche manuelle</span>
                        </button>
                    </div>
                </div>

                <!-- Live Preview Section -->
                <div style="margin-top: 1.5rem; padding-top:1.2rem; border-top:1px solid rgba(255,255,255,0.06);">
                    <div style="font-size:0.86rem; font-weight:600; color:#F8FAFC; margin-bottom:10px;">Leads découverts lors de cette session</div>
                    <div id="hunter-preview-container" class="leads-grid" style="grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:12px;">
                        <div class="text-muted text-xs" style="grid-column: 1/-1;">Lancez une recherche manuelle pour voir les résultats s'afficher ici...</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-run-agent').addEventListener('click', runAgentJob);
    document.getElementById('btn-clear-key').addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEY_API);
        initLeadHunter();
    });

    // Start Live AI Activity Streaming
    initAiActivityFeed();
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
    const autoReachout = document.getElementById('input-auto-reachout')?.checked || false;

    if (!apiKey) {
        window.showToast('Clé Google Places API manquante. Renseignez-la dans les Paramètres Avancés.', 'warn');
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
                    'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.id,places.internationalPhoneNumber,places.nationalPhoneNumber,places.addressComponents,places.types,nextPageToken'
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
                const phone = place.internationalPhoneNumber || place.nationalPhoneNumber || '';

                // Extract address components
                let postalCode = '';
                let cityComp = '';
                let stateComp = '';
                let countryComp = '';
                let streetNum = '';
                let routeName = '';

                if (Array.isArray(place.addressComponents)) {
                    for (const comp of place.addressComponents) {
                        const compTypes = comp.types || [];
                        if (compTypes.includes('postal_code')) postalCode = comp.shortText || comp.longText || '';
                        if (compTypes.includes('locality') || compTypes.includes('postal_town')) cityComp = comp.longText || comp.shortText || '';
                        if (compTypes.includes('administrative_area_level_1')) stateComp = comp.shortText || comp.longText || '';
                        if (compTypes.includes('country')) countryComp = comp.shortText || comp.longText || '';
                        if (compTypes.includes('street_number')) streetNum = comp.longText || comp.shortText || '';
                        if (compTypes.includes('route')) routeName = comp.longText || comp.shortText || '';
                    }
                }

                const streetAddress = [streetNum, routeName].filter(Boolean).join(' ') || place.formattedAddress || '';

                // --- FILTER LOGIC ---

                // 1. Min Reviews
                if (reviews < settings.minReviews) continue;

                // 2. Website & Directory Platform Filter
                const dirInfo = detectDirectoryPlatform(website);
                const hasProprietaryWebsite = Boolean(website && !dirInfo.isDirectory);

                if (websiteFilter === 'NO_WEBSITE' && hasProprietaryWebsite) {
                    // Skip only if merchant has a real proprietary website (we KEEP directory-only listings like Dash Booking, Fresha, etc.)
                    continue;
                }
                if (websiteFilter === 'HAS_WEBSITE' && !hasProprietaryWebsite) {
                    console.log("Filtered out: No proprietary website");
                    continue;
                }

                // --- ANALYZE ---
                const painSignals = [];
                if (!website) {
                    painSignals.push('NO_WEBSITE');
                } else if (dirInfo.isDirectory) {
                    painSignals.push('DIRECTORY_ONLY');
                    painSignals.push(`DIRECTORY_${(dirInfo.platformName || 'PLATFORM').toUpperCase().replace(/[^A-Z0-9]/g, '_')}`);
                }
                if (reviews < 10) painSignals.push('WEAK_VISIBILITY');

                // --- DEDUPE ---
                const q = query(collection(db, 'leads'), where('place_id', '==', place.id));
                const existing = await getDocs(q);
                if (!existing.empty) continue;

                // --- ENRICH FROM WEBSITE (Scrape Phone, Email, Socials) ---
                let finalPhone = phone;
                let finalEmail = '';
                let finalInstagram = '';

                if (website) {
                    try {
                        log(`  > Scraping website contact signals: ${website}...`);
                        const enrichResp = await fetch('http://localhost:5000/api/leads/enrich-website', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ website, businessName: name, address: place.formattedAddress })
                        });
                        const enrichData = await enrichResp.json();
                        if (enrichData.success) {
                            if (!finalPhone && enrichData.primaryPhone) {
                                finalPhone = enrichData.primaryPhone;
                                log(`    [TROUVÉ TÉL] ${enrichData.primaryPhoneFormatted || enrichData.primaryPhone}`);
                            }
                            if (enrichData.primaryEmail) {
                                finalEmail = enrichData.primaryEmail;
                                log(`    [TROUVÉ EMAIL] ${enrichData.primaryEmail}`);
                            }
                            if (enrichData.instagram) {
                                finalInstagram = enrichData.instagram;
                                log(`    [TROUVÉ INSTA] ${enrichData.instagram}`);
                            }
                        }
                    } catch (scrapErr) {
                        // Continue gracefully if backend scraper is unreachable
                    }
                }

                // --- SAVE ---
                const leadData = {
                    business_name: name,
                    category: industryInput,
                    city: cityComp || city,
                    address: place.formattedAddress || city,
                    street_address: streetAddress,
                    phone: finalPhone,
                    phone_number: finalPhone,
                    email: finalEmail,
                    public_email: finalEmail,
                    instagram: finalInstagram,
                    postal_code: postalCode,
                    zip_code: postalCode,
                    country: countryComp || (postalCode && /^[A-Z]\d[A-Z]/i.test(postalCode) ? 'CA' : 'US'),
                    types: place.types || [],
                    leadCategory: !website ? 'no_website' : (dirInfo.isDirectory ? 'directory_only' : 'unclassified'),
                    has_directory_only: dirInfo.isDirectory,
                    directory_platform: dirInfo.platformName || null,
                    directory_url: dirInfo.isDirectory ? website : null,
                    is_directory_website: dirInfo.isDirectory,
                    google_rating: place.rating || 0,
                    google_reviews_count: reviews,
                    website: website || '',
                    pain_signals: painSignals,
                    status: autoReachout ? 'APPROVED' : 'NEW',
                    source: 'GOOGLE_PLACES_AGENT',
                    discovered_query: queryTerm,
                    google_page_rank: pageNum,
                    place_id: place.id,
                    created_at: new Date().toISOString()
                };

                // Extract and save State/Province
                leadData.state = stateComp || LeadFilterService.extractRegion(leadData);

                const docRef = await addDoc(collection(db, 'leads'), leadData);
                leadsAdded++;
                log(`+ SAVED: ${name} ${finalPhone ? '(' + finalPhone + ')' : ''} ${finalEmail ? '[' + finalEmail + ']' : ''} ${!website ? '[No Web]' : ''}`);
                
                if (autoReachout) {
                    log(`  > AUTOMATION: Launching Neural Pipeline...`);
                    try {
                        await triggerWorkflowForLead(docRef.id);
                        log(`  > SUCCESS: Neural Pipeline triggered.`);
                    } catch (e) {
                        log(`  > ERROR: Pipeline failed: ${e.message}`);
                    }
                }

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

window.handleAutopilotToggleChange = (input) => {
    const isChecked = input.checked;
    const label = document.getElementById('autopilot-toggle-label');
    const badge = document.getElementById('autopilot-status-badge');

    if (label) {
        label.textContent = isChecked ? 'En service' : 'En pause';
        label.style.color = isChecked ? '#4ADE80' : '#FBBF24';
    }

    if (badge) {
        badge.innerHTML = isChecked ? '● ACTIF (En service)' : '○ EN PAUSE';
        badge.className = `hunter-status-pill ${isChecked ? 'hunter-status-active' : 'hunter-status-paused'}`;
    }
};

window.toggleHunterAdvancedSettings = () => {
    const panel = document.getElementById('hunter-advanced-panel');
    const arrow = document.getElementById('hunter-adv-arrow');
    if (!panel) return;
    const isHidden = panel.style.display === 'none';
    panel.style.display = isHidden ? 'grid' : 'none';
    if (arrow) {
        arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
};

window.toggleHunterManualAccordion = () => {
    const content = document.getElementById('hunter-manual-content');
    const chevron = document.getElementById('hunter-manual-chevron');
    if (!content) return;
    const isHidden = content.style.display === 'none';
    content.style.display = isHidden ? 'block' : 'none';
    if (chevron) {
        chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
};

window.handleAutopilotCountryChange = (country) => {
    const regionSelect = document.getElementById('autopilot-region');
    if (regionSelect) {
        regionSelect.innerHTML = buildRegionOptionsHtml(country, 'ALL');
    }
};

window.handleAutopilotIndustryChange = (val) => {
    const customGroup = document.getElementById('autopilot-custom-industry-group');
    if (customGroup) {
        customGroup.style.display = val === 'CUSTOM' ? 'block' : 'none';
        if (val === 'CUSTOM') {
            document.getElementById('autopilot-custom-industry')?.focus();
        }
    }
};

window.saveHunterAutopilotConfig = async () => {
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const isActive = document.getElementById('autopilot-toggle')?.checked;
        const frequencyHours = parseInt(document.getElementById('autopilot-frequency')?.value, 10) || 6;
        const leadsPerBatch = parseInt(document.getElementById('autopilot-batch')?.value, 10) || 10;
        const websiteFilter = document.getElementById('autopilot-filter')?.value || 'NO_WEBSITE';
        const autoAuditAndSequence = document.getElementById('autopilot-auto-pipeline')?.checked;
        const adminAlertsEnabled = document.getElementById('autopilot-admin-alerts')?.checked;
        const apiKey = document.getElementById('autopilot-api-key')?.value.trim() || localStorage.getItem(STORAGE_KEY_API) || '';

        const targetCountry = document.getElementById('autopilot-country')?.value || 'CA';
        const targetRegion = document.getElementById('autopilot-region')?.value || 'ALL';
        const targetIndustry = document.getElementById('autopilot-industry')?.value || 'ALL';
        const customIndustry = document.getElementById('autopilot-custom-industry')?.value.trim() || '';

        if (apiKey) {
            localStorage.setItem(STORAGE_KEY_API, apiKey);
        }

        const resp = await fetch(`${API_BASE}/api/hunter/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                isActive: Boolean(isActive),
                frequencyHours,
                leadsPerBatch,
                websiteFilter,
                autoAuditAndSequence: Boolean(autoAuditAndSequence),
                adminAlertsEnabled: Boolean(adminAlertsEnabled),
                apiKey,
                targetCountry,
                targetRegion,
                targetIndustry,
                customIndustry
            })
        });

        const data = await resp.json();
        if (data.success) {
            autopilotConfig = data.config;
            window.showToast(
                isActive
                    ? "🟢 Auto-Pilot ACTIVÉ : La prospection Google Places tournera automatiquement en arrière-plan !"
                    : "🟡 Auto-Pilot EN PAUSE : La prospection automatique est suspendue.",
                isActive ? "success" : "info"
            );
        } else {
            throw new Error(data.error || "Erreur lors de la sauvegarde");
        }
    } catch (e) {
        window.showToast(`Erreur : ${e.message}`, "error");
    }
};

window.runHunterAutopilotNow = async () => {
    const runBtn = document.getElementById('btn-run-autopilot-now');
    if (runBtn) {
        runBtn.disabled = true;
        runBtn.innerHTML = `${HUNTER_SVGS.bolt} <span>Chasse en cours...</span>`;
    }

    try {
        window.showToast("⚡ Lancement du cycle Auto-Pilot en arrière-plan...", "info");
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');

        const targetCountry = document.getElementById('autopilot-country')?.value || autopilotConfig.targetCountry || 'CA';
        const targetRegion = document.getElementById('autopilot-region')?.value || autopilotConfig.targetRegion || 'ALL';
        const targetIndustry = document.getElementById('autopilot-industry')?.value || autopilotConfig.targetIndustry || 'ALL';
        const customIndustry = document.getElementById('autopilot-custom-industry')?.value.trim() || autopilotConfig.customIndustry || '';

        const resp = await fetch(`${API_BASE}/api/hunter/run-now`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                country: targetCountry,
                region: targetRegion,
                industry: targetIndustry === 'CUSTOM' ? customIndustry : (targetIndustry !== 'ALL' ? targetIndustry : undefined)
            })
        });

        const data = await resp.json();
        if (data.success) {
            window.showToast(`🎯 Cycle Auto-Pilot terminé ! ${data.leadsAdded} leads qualifiés chassés à ${data.city} (${data.industry}) et insérés dans le pipeline.`, "success");
            
            const infoEl = document.getElementById('autopilot-last-run-info');
            if (infoEl) {
                infoEl.textContent = `Dernier cycle : À l'instant • ${data.leadsAdded} leads qualifiés pour "${data.query || ''}"`;
            }
        } else {
            throw new Error(data.message || data.error || "Erreur pendant le cycle");
        }
    } catch (e) {
        window.showToast(`Erreur : ${e.message}`, "error");
    } finally {
        if (runBtn) {
            runBtn.disabled = false;
            runBtn.innerHTML = `${HUNTER_SVGS.bolt} <span>Lancer un cycle immédiat</span>`;
        }
    }
};

// =========================================================================
// REAL-TIME AI ACTIVITY FEED (STREAMING & VISUALIZATION)
// =========================================================================

let aiFeedEvents = [];
let aiFeedFilter = 'all';
let aiFeedPaused = false;
let aiActivityEventSource = null;

export async function initAiActivityFeed() {
    const container = document.getElementById('ai-live-feed-container');
    if (!container) return;

    // Close any previous event source
    if (aiActivityEventSource) {
        try { aiActivityEventSource.close(); } catch (e) {}
        aiActivityEventSource = null;
    }

    // 1. Fetch recent events to seed the live display immediately
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/ai/activity/recent?limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.success && Array.isArray(data.events)) {
            aiFeedEvents = data.events;
            updateAiFeedCounts();
            renderAiFeed();
        }
    } catch (e) {
        console.warn("[LeadHunter] Error fetching recent activity:", e.message);
    }

    // 2. Open Server-Sent Events (SSE) Stream
    try {
        const sseUrl = `${API_BASE}/api/ai/activity/stream`;
        aiActivityEventSource = new EventSource(sseUrl);

        const badge = document.getElementById('ai-feed-sse-badge');

        aiActivityEventSource.onopen = () => {
            if (badge) {
                badge.style.background = 'rgba(33,186,69,0.15)';
                badge.style.color = '#21BA45';
                badge.style.borderColor = 'rgba(33,186,69,0.4)';
                badge.innerHTML = `<span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#21BA45; box-shadow:0 0 8px #21BA45;"></span> <span>FLUX EN DIRECT (SSE)</span>`;
            }
        };

        aiActivityEventSource.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data);
                if (parsed.type === 'connected' || parsed.type === 'keepalive') return;

                // Prepend new event
                aiFeedEvents.unshift(parsed);
                if (aiFeedEvents.length > 250) aiFeedEvents.pop();

                updateAiFeedCounts();

                if (!aiFeedPaused) {
                    renderAiFeed();
                }
            } catch (err) {
                console.error("[LeadHunter] Error parsing SSE event:", err);
            }
        };

        aiActivityEventSource.onerror = () => {
            if (badge) {
                badge.style.background = 'rgba(242,192,55,0.15)';
                badge.style.color = '#F2C037';
                badge.style.borderColor = 'rgba(242,192,55,0.4)';
                badge.innerHTML = `<span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#F2C037;"></span> <span>RECONNEXION...</span>`;
            }
        };
    } catch (err) {
        console.error("[LeadHunter] Error connecting SSE:", err);
    }
}

function updateAiFeedCounts() {
    const total = aiFeedEvents.length;
    const sourcing = aiFeedEvents.filter(e => e.category === 'sourcing').length;
    const audit = aiFeedEvents.filter(e => e.category === 'audit').length;
    const sms = aiFeedEvents.filter(e => e.category === 'sms').length;
    const admin = aiFeedEvents.filter(e => e.category === 'admin_alert').length;

    const elAll = document.getElementById('count-ai-all');
    const elSourcing = document.getElementById('count-ai-sourcing');
    const elAudit = document.getElementById('count-ai-audit');
    const elSms = document.getElementById('count-ai-sms');
    const elAdmin = document.getElementById('count-ai-admin');

    if (elAll) elAll.textContent = total;
    if (elSourcing) elSourcing.textContent = sourcing;
    if (elAudit) elAudit.textContent = audit;
    if (elSms) elSms.textContent = sms;
    if (elAdmin) elAdmin.textContent = admin;
}

function renderAiFeed() {
    const container = document.getElementById('ai-live-feed-container');
    if (!container) return;

    const filtered = aiFeedFilter === 'all'
        ? aiFeedEvents
        : aiFeedEvents.filter(e => e.category === aiFeedFilter);

    if (filtered.length === 0) {
        container.innerHTML = `
            <div id="ai-feed-empty" style="text-align:center; padding:36px 16px; color:rgba(255,255,255,0.4);">
                <span class="material-icons" style="font-size:36px; opacity:0.35; margin-bottom:8px;">stream</span>
                <div style="font-size:0.9rem; font-weight:600;">Aucun événement dans cette catégorie pour le moment.</div>
                <div style="font-size:0.8rem; margin-top:4px;">L'IA inscrira ici chaque étape dès son exécution.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(ev => renderAiFeedItemHtml(ev)).join('');
}

function renderAiFeedItemHtml(ev) {
    const dateObj = new Date(ev.timestamp || Date.now());
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const meta = ev.metadata || {};

    // Category styling & icon
    let catBadge = '';
    let borderAccent = 'rgba(255,255,255,0.06)';

    if (ev.category === 'sourcing') {
        catBadge = `<span class="lead-status-pill lead-status-contacted">${HUNTER_SVGS.search} SOURCING</span>`;
        borderAccent = 'rgba(96,165,250,0.2)';
    } else if (ev.category === 'audit') {
        catBadge = `<span class="lead-status-pill lead-status-audited">${HUNTER_SVGS.brain} AUDIT IA</span>`;
        borderAccent = 'rgba(192,132,252,0.2)';
    } else if (ev.category === 'sms') {
        const isSimulated = meta.isDryRun !== false;
        catBadge = `<span class="lead-status-pill ${isSimulated ? 'lead-status-new' : 'lead-status-approved'}">${HUNTER_SVGS.message} ${isSimulated ? 'SMS SIMULÉ' : 'SMS ENVOYÉ'}</span>`;
        borderAccent = isSimulated ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.25)';
    } else if (ev.category === 'admin_alert') {
        catBadge = `<span class="lead-status-pill lead-status-approved">${HUNTER_SVGS.bell} ALERTE ADMIN</span>`;
        borderAccent = 'rgba(34,197,94,0.2)';
    } else {
        catBadge = `<span class="lead-status-pill lead-pill-subtle">SYSTÈME</span>`;
    }

    // Level indicator icon
    let levelIcon = '';
    if (ev.level === 'success') {
        levelIcon = `<span style="color:#4ADE80; display:inline-flex;">${HUNTER_SVGS.check}</span>`;
    } else if (ev.level === 'warn') {
        levelIcon = `<span style="color:#FBBF24; display:inline-flex;">${HUNTER_SVGS.bolt}</span>`;
    } else if (ev.level === 'error') {
        levelIcon = `<span style="color:#F87171; display:inline-flex;">${HUNTER_SVGS.bolt}</span>`;
    } else {
        levelIcon = `<span style="color:#60A5FA; display:inline-flex;">${HUNTER_SVGS.radar}</span>`;
    }

    // SMS message content highlight bubble
    let smsBoxHtml = '';
    if (meta.smsBody || meta.previewText) {
        const smsContent = meta.smsBody || meta.previewText;
        const recipient = meta.phone || meta.recipientPhone || '';
        const isSimulated = meta.isDryRun !== false;

        smsBoxHtml = `
            <div class="hunter-sms-bubble">
                <div style="font-size:0.75rem; color:${isSimulated ? '#FBBF24' : '#4ADE80'}; font-weight:600; margin-bottom:5px; display:flex; align-items:center; gap:6px;">
                    <span style="display:inline-flex;">${HUNTER_SVGS.message}</span>
                    <span>${isSimulated ? 'Simulation SMS (Dry-Run)' : 'SMS Expédié en Production (Twilio)'}</span>
                    ${recipient ? `<span style="margin-left:auto; color:#94A3B8; font-size:0.75rem;">Destinataire : <strong style="color:#F1F5F9;">${escapeHtml(recipient)}</strong></span>` : ''}
                </div>
                <div style="color:#E2E8F0; font-size:0.83rem; line-height:1.45; white-space:pre-wrap;">"${escapeHtml(smsContent)}"</div>
            </div>
        `;
    }

    // Google Places chips
    let placesChipsHtml = '';
    if (meta.placeName || meta.placesFound !== undefined) {
        placesChipsHtml = `
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
                ${meta.placeName ? `<span class="lead-pill-subtle" style="color:#60A5FA;">🏢 ${escapeHtml(meta.placeName)}</span>` : ''}
                ${meta.city ? `<span class="lead-pill-subtle">📍 ${escapeHtml(meta.city)}</span>` : ''}
                ${meta.phone ? `<span class="lead-pill-subtle" style="color:#4ADE80;">📞 ${escapeHtml(meta.phone)}</span>` : ''}
                ${meta.hasWebsite !== undefined ? (meta.hasWebsite ? `<span class="lead-pill-subtle">🌐 ${escapeHtml(meta.website || 'Site web')}</span>` : `<span class="lead-pill-no-website lead-pill-subtle">🚫 Sans site web</span>`) : ''}
                ${meta.placesFound !== undefined ? `<span class="lead-pill-subtle" style="color:var(--gold);">🎯 ${meta.placesFound} trouvés</span>` : ''}
                ${meta.leadsAdded !== undefined ? `<span class="lead-pill-subtle" style="color:#4ADE80;">✨ +${meta.leadsAdded} qualifiés</span>` : ''}
            </div>
        `;
    }

    // Audit chips
    let auditChipsHtml = '';
    if (meta.profile || meta.score !== undefined) {
        auditChipsHtml = `
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
                ${meta.profile ? `<span class="lead-pill-subtle" style="color:#C084FC;">🎯 Profil: ${escapeHtml(meta.profile)}</span>` : ''}
                ${meta.score !== undefined ? `<span class="lead-pill-score lead-pill-subtle">⭐ Score: ${meta.score}/100</span>` : ''}
                ${meta.isFranchise ? `<span class="lead-pill-no-website lead-pill-subtle">⛔ Franchise</span>` : ''}
            </div>
        `;
    }

    return `
        <div class="hunter-feed-item" style="border-left: 2px solid ${borderAccent};">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    ${levelIcon}
                    ${catBadge}
                    <span style="font-size:0.86rem; font-weight:600; color:#F1F5F9;">${escapeHtml(ev.title || 'Activité IA')}</span>
                </div>
                <span style="font-size:0.73rem; color:#64748B; font-family:monospace;">${timeStr}</span>
            </div>

            ${ev.message ? `<div style="font-size:0.8rem; color:#94A3B8; margin-top:4px; line-height:1.45;">${escapeHtml(ev.message)}</div>` : ''}
            ${placesChipsHtml}
            ${auditChipsHtml}
            ${smsBoxHtml}
        </div>
    `;
}

window.toggleAiFeedPause = () => {
    aiFeedPaused = !aiFeedPaused;
    const btn = document.getElementById('btn-ai-feed-pause');
    const icon = document.getElementById('icon-ai-feed-pause');
    const label = document.getElementById('label-ai-feed-pause');
    if (aiFeedPaused) {
        if (btn) {
            btn.style.borderColor = 'rgba(245,158,11,0.4)';
            btn.style.color = '#FBBF24';
        }
        if (icon) icon.innerHTML = HUNTER_SVGS.play;
        if (label) label.textContent = 'Reprendre';
        window.showToast("Flux d'activité mis en pause", "info");
    } else {
        if (btn) {
            btn.style.borderColor = '';
            btn.style.color = '';
        }
        if (icon) icon.innerHTML = HUNTER_SVGS.pause;
        if (label) label.textContent = 'Pause';
        renderAiFeed();
        window.showToast("Flux d'activité repris", "info");
    }
};

window.clearAiFeedDisplay = async () => {
    aiFeedEvents = [];
    renderAiFeed();
    updateAiFeedCounts();
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        await fetch(`${API_BASE}/api/ai/activity/clear`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    } catch (e) {}
    window.showToast("Affichage du moniteur effacé", "info");
};

window.filterAiFeed = (category, btnElement) => {
    aiFeedFilter = category;
    document.querySelectorAll('.hunter-pill-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    if (btnElement) {
        btnElement.classList.add('active');
    }
    renderAiFeed();
};


