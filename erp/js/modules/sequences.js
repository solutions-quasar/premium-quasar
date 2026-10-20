import { db, auth } from '../firebase-config.js';
import { collection, query, where, getDocs, orderBy, onSnapshot, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { t } from '../services/translationService.js';
import { getAuditConfig, getAuditStats, renderAuditConfigTab } from './audit.js';

const API_BASE = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : '';

let cachedSequences = [];
let sequenceSettings = {
    dryRun: true,
    adminAlertPhone: '+15062337006',
    adminAlertsEnabled: true
};
let selectedSequenceId = null;
let sequenceEditorLang = 'fr'; // 'fr' (QC / Francophone) or 'en' (Default: Rest of Canada & US)

export const DEFAULT_SEQUENCE_IDS = [
    'seq_missing_gmb_website',
    'seq_directory_only',
    'seq_no_website',
    'seq_outdated_website',
    'seq_modern_no_ai',
    'seq_social_only'
];

// -- CUSTOM SLEEK SVG ICONS (Ultra-Clean, High-Readability) --
export const SEQ_SVGS = {
    infinity: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z"/></svg>`,
    flask: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.31L4.25 19.94A2 2 0 0 0 6 23h12a2 2 0 0 0 1.75-3.06L14 9.31V2z"/><line x1="8.5" y1="2" x2="15.5" y2="2"/><line x1="10" y1="9" x2="14" y2="9"/></svg>`,
    close: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    list: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    brain: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>`,
    radar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/><path d="M4 6h.01"/><path d="M2.29 9.62A10 10 0 0 0 21.42 14"/><path d="M16.24 7.76A6 6 0 1 0 8.23 16.24"/><path d="M12 12h.01"/><path d="m14.5 9.5-2.5 2.5"/></svg>`,
    history: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>`,
    bell: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
    activity: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    send: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    save: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
    restore: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
    shield: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    clock: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    message: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    globe: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
    bot: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="12" x="3" y="6" rx="2"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="8" y1="12" x2="8.01" y2="12"/><line x1="16" y1="12" x2="16.01" y2="12"/></svg>`,
    web: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    gauge: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>`,
    share: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
    alertCircle: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    stopCircle: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><rect width="6" height="6" x="9" y="9"/></svg>`,
    sparkles: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`
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

/**
 * Main Prospection IA Page Module (Full View)
 */
export async function initProspectionView(initialTab = 'hunter') {
    const container = document.getElementById('view-prospection');
    if (!container) return;

    container.innerHTML = `
        <div class="prospection-page-container">
            
            <!-- Unified Top Panel (Header + Integrated Tabs) -->
            <div class="prospection-top-panel">
                <div class="prospection-header-row">
                    <div style="display:flex; align-items:center; gap:14px;">
                        <div style="width:40px; height:40px; border-radius:10px; background:rgba(223,165,58,0.12); border:1px solid rgba(223,165,58,0.3); display:flex; align-items:center; justify-content:center; color:var(--gold); flex-shrink:0;">
                            ${SEQ_SVGS.infinity}
                        </div>
                        <div>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <h2 style="margin:0; font-size:1.35rem; font-weight:700; color:#F8FAFC; letter-spacing:-0.3px;">Réglages IA</h2>
                            </div>
                        </div>
                    </div>

                    <!-- Right controls: Dry-Run Switch -->
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:6px 14px; border-radius:20px;">
                            <span id="dry-run-status-label" style="font-size:0.82rem; font-weight:600; color:#F2C037; display:flex; align-items:center; gap:6px;">
                                ${SEQ_SVGS.flask} Mode Simulation
                            </span>
                            <label class="ai-toggle-switch sim-mode" style="position:relative; display:inline-block; width:42px; height:22px; margin:0;" title="Basculer entre Mode Simulation et Mode Réel">
                                <input type="checkbox" id="sequence-dryrun-toggle" checked>
                                <span class="ai-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Integrated Chronological Tabs Strip -->
                <div class="seq-tab-bar" style="background:#090B0F; padding:0 16px; overflow-x:auto;">
                    <button class="seq-tab-btn active" id="tab-btn-seq-hunter" onclick="window.switchSequenceTab('hunter')">
                        ${SEQ_SVGS.radar} Lead Hunter
                    </button>
                    <button class="seq-tab-btn" id="tab-btn-seq-audit" onclick="window.switchSequenceTab('audit')">
                        ${SEQ_SVGS.brain} Audit et SMS
                    </button>
                    <button class="seq-tab-btn" id="tab-btn-seq-list" onclick="window.switchSequenceTab('list')">
                        ${SEQ_SVGS.list} Séquences (${cachedSequences.length || 5})
                    </button>
                    <button class="seq-tab-btn" id="tab-btn-seq-instances" onclick="window.switchSequenceTab('instances')">
                        ${SEQ_SVGS.history} Monitoring & Leads
                    </button>
                    <button class="seq-tab-btn" id="tab-btn-seq-settings" onclick="window.switchSequenceTab('settings')">
                        ${SEQ_SVGS.bell} Notifications
                    </button>
                    <button class="seq-tab-btn" id="tab-btn-seq-live" onclick="window.switchSequenceTab('live')">
                        ${SEQ_SVGS.activity} Flux Live
                    </button>
                </div>
            </div>

            <!-- Tab Panels Body (Full Width, Transparent Canvas) -->
            <div id="sequence-modal-body" class="prospection-body-container">
                <div style="text-align:center; padding:3rem; color:var(--text-muted);">
                    <div style="font-size:0.85rem; color:#64748B;">Chargement du module Réglages IA...</div>
                </div>
            </div>

            <!-- Page Footer Strip -->
            <div style="background:#0E1015; padding:12px 20px; border:1px solid rgba(255,255,255,0.06); border-radius:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div class="text-xs text-muted" id="sequence-footer-note" style="display:flex; align-items:center; gap:6px; font-size:0.78rem; color:#64748B;">
                    ${SEQ_SVGS.shield}
                    <span>Exclusion des franchises • Arrêt automatique dès qu'un prospect répond.</span>
                </div>
                <div style="font-size:0.75rem; color:#64748B;">
                    Solutions Quasar Inc. • Prospection B2B
                </div>
            </div>
        </div>
    `;

    // Load data
    await loadSequencesAndSettings();
    await window.switchSequenceTab(initialTab);

    // Hook DryRun toggle with native ERP confirmation modal
    const dryRunToggle = document.getElementById('sequence-dryrun-toggle');
    const dryRunLabel = document.getElementById('dry-run-status-label');
    if (dryRunToggle && dryRunLabel) {
        const isSimulation = sequenceSettings.dryRun !== false;
        dryRunToggle.checked = isSimulation;
        dryRunLabel.innerHTML = isSimulation
            ? `${SEQ_SVGS.flask} Mode Simulation`
            : `${SEQ_SVGS.send} Mode Réel`;
        dryRunLabel.style.color = isSimulation ? '#F2C037' : '#10B981';

        dryRunToggle.addEventListener('click', (e) => {
            e.preventDefault();
            const willBeActiveSimulation = !dryRunToggle.checked;

            if (!willBeActiveSimulation) {
                // Switching from Simulation to Production Réelle
                window.showConfirmModal({
                    title: "Activer la Production Réelle ?",
                    message: "⚠️ <strong>Attention : Conséquences importantes</strong><br><br>Vous quittez le mode simulation. Tous les SMS générés par l'IA seront désormais <strong>réellement envoyés</strong> aux prospects ciblés et <strong>facturés</strong> sur vos comptes opérateurs (Twilio / Telnyx).<br><br>Souhaitez-vous confirmer le passage en mode réel ?",
                    confirmText: "Oui, passer en Réel",
                    cancelText: "Garder la Simulation",
                    onConfirm: async () => {
                        dryRunToggle.checked = false;
                        dryRunLabel.innerHTML = `${SEQ_SVGS.send} Mode Réel`;
                        dryRunLabel.style.color = '#10B981';
                        await handleSaveSettings({ dryRun: false });
                        window.showToast("🟢 Mode Réel activé : les SMS programmés seront réellement envoyés.", "success");
                    }
                });
            } else {
                // Switching from Production to Simulation
                window.showConfirmModal({
                    title: "Activer le Mode Simulation ?",
                    message: "ℹ️ <strong>Conséquences :</strong><br><br>Aucun SMS réel ne sera transmis. Les déclenchements de séquences seront enregistrés uniquement dans les <strong>logs de simulation</strong> sans frais d'opérateur ni impact pour les clients.",
                    confirmText: "Activer la Simulation",
                    cancelText: "Annuler",
                    onConfirm: async () => {
                        dryRunToggle.checked = true;
                        dryRunLabel.innerHTML = `${SEQ_SVGS.flask} Mode Simulation`;
                        dryRunLabel.style.color = '#F2C037';
                        await handleSaveSettings({ dryRun: true });
                        window.showToast("🟡 Mode Simulation activé : aucun SMS réel ne sera transmis.", "info");
                    }
                });
            }
        });
    }
}

window.initProspectionView = initProspectionView;

/**
 * Legacy modal launcher: Redirects directly to the new full-page Prospection IA view
 */
export async function openSequencesConfigModal(initialTab = 'hunter') {
    window.location.hash = '#prospection';
    setTimeout(() => {
        if (window.switchSequenceTab) {
            window.switchSequenceTab(initialTab);
        }
    }, 100);
}

window.openSequencesConfigModal = openSequencesConfigModal;

/**
 * Switch tabs in the Sequences Modal
 */
window.switchSequenceTab = async (tabName) => {
    ['hunter', 'audit', 'list', 'instances', 'settings', 'live'].forEach(t => {
        const btn = document.getElementById(`tab-btn-seq-${t}`);
        if (btn) {
            btn.classList.toggle('active', t === tabName);
        }
    });

    if (tabName === 'hunter') renderHunterAutoPilotModalTab();
    if (tabName === 'audit') {
        const body = document.getElementById('sequence-modal-body');
        if (body) {
            body.innerHTML = `
                <div style="text-align:center; padding:3rem; color:var(--text-muted);">
                    <div style="font-size:0.85rem; color:#64748B;">Chargement du moteur d'audit et du System Prompt...</div>
                </div>
            `;
            await getAuditConfig();
            await renderAuditConfigTab(body);
        }
    }
    if (tabName === 'list') renderSequencesListTab();
    if (tabName === 'instances') renderSequencesInstancesTab();
    if (tabName === 'settings') renderSequencesSettingsTab();
    if (tabName === 'live') renderSequencesLiveFeedTab();
};

function formatSmsPreview(text) {
    if (!text) return '';
    return escapeHtml(text).replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, '<span style="color:#F2C037; background:rgba(223,165,58,0.18); padding:1px 6px; border-radius:4px; font-weight:700; font-family:monospace; font-size:0.82rem; border:1px solid rgba(223,165,58,0.3);">{{$1}}</span>');
}

/**
 * Load Sequences and Settings from Backend
 */
async function loadSequencesAndSettings() {
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        
        // 1. Settings
        const sResp = await fetch(`${API_BASE}/api/sequences/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const sData = await sResp.json();
        if (sData.success && sData.settings) {
            sequenceSettings = sData.settings;
        }

        // 2. Sequences
        const qResp = await fetch(`${API_BASE}/api/sequences`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const qData = await qResp.json();
        if (qData.success && qData.sequences) {
            cachedSequences = qData.sequences;
        }
    } catch (e) {
        console.error("Load Sequences Error:", e);
    }
}

/**
 * Tab 1: Render Sequences List in Spacious Visual Cards Studio
 */
export const CATEGORY_META = {
    'directory_only': {
        label: 'Annuaire seul',
        svg: SEQ_SVGS.list,
        color: '#60A5FA',
        badgeBg: 'rgba(96, 165, 250, 0.12)',
        badgeBorder: 'rgba(96, 165, 250, 0.28)',
        desc: 'Commerces présents uniquement sur des annuaires (Pages Jaunes, Yelp, 411).'
    },
    'missing_gmb_website': {
        label: 'Google Maps manquant',
        svg: SEQ_SVGS.globe,
        color: '#F2C037',
        badgeBg: 'rgba(242, 192, 55, 0.12)',
        badgeBorder: 'rgba(242, 192, 55, 0.3)',
        desc: 'Fiches Google Business Maps actives mais sans aucun site internet lié.'
    },
    'no_website': {
        label: 'Pas de site web',
        svg: SEQ_SVGS.web,
        color: '#EF4444',
        badgeBg: 'rgba(239, 68, 68, 0.12)',
        badgeBorder: 'rgba(239, 68, 68, 0.3)',
        desc: 'Prospects sans site web détecté sur Google Places ni réseaux sociaux.'
    },
    'outdated_website': {
        label: 'Site obsolète / lent',
        svg: SEQ_SVGS.gauge,
        color: '#F59E0B',
        badgeBg: 'rgba(245, 158, 11, 0.12)',
        badgeBorder: 'rgba(245, 158, 11, 0.3)',
        desc: 'Prospects avec un site obsolète, lent (>4s sur mobile) ou non optimisé.'
    },
    'modern_no_ai': {
        label: 'Site sans agent IA',
        svg: SEQ_SVGS.bot,
        color: '#38BDF8',
        badgeBg: 'rgba(56, 189, 248, 0.12)',
        badgeBorder: 'rgba(56, 189, 248, 0.3)',
        desc: 'Sites contemporains sans répondeur automatique IA ni qualification 24/7.'
    },
    'social_only': {
        label: 'Réseaux sociaux seuls',
        svg: SEQ_SVGS.share,
        color: '#C084FC',
        badgeBg: 'rgba(192, 132, 252, 0.12)',
        badgeBorder: 'rgba(192, 132, 252, 0.3)',
        desc: 'Commerces actifs sur Instagram ou Facebook sans vitrine web officielle pour convertir.'
    },
    'custom': {
        label: 'Sur-mesure / Autre',
        svg: SEQ_SVGS.sparkles,
        color: '#34D399',
        badgeBg: 'rgba(52, 211, 153, 0.12)',
        badgeBorder: 'rgba(52, 211, 153, 0.3)',
        desc: 'Séquence personnalisée pour un secteur ou une campagne sur-mesure.'
    }
};

export const STANDARD_DELAYS = [
    { value: 0.033, label: '2 minutes (Double SMS)' },
    { value: 0.05, label: '3 minutes' },
    { value: 0.25, label: '15-20 minutes' },
    { value: 0.5, label: '30 minutes' },
    { value: 1, label: '1 heure' },
    { value: 2, label: '2 heures' },
    { value: 24, label: 'J+1 (24 heures)' },
    { value: 48, label: 'J+2 (48 heures)' },
    { value: 72, label: 'J+3 (72 heures)' },
    { value: 168, label: 'J+7 (1 semaine)' },
    { value: 192, label: 'J+8 (8 jours)' },
    { value: 336, label: 'J+14 (2 semaines)' },
    { value: 480, label: 'J+20 (20 jours)' },
    { value: 600, label: 'J+25 (25 jours)' },
    { value: 720, label: 'J+30 (1 mois)' },
    { value: 1440, label: 'J+60 (2 mois)' },
    { value: 2160, label: 'J+90 (3 mois)' },
    { value: 2880, label: 'J+120 (4 mois)' },
    { value: 4320, label: 'J+180 (6 mois)' }
];

export const STEP_PURPOSES = [
    { label: 'Prise de contact & Salutation', color: '#60A5FA' },
    { label: 'Question directe (Double SMS)', color: 'var(--gold)' },
    { label: 'Relance Valeur & Solution', color: '#38BDF8' },
    { label: 'Démo & Preuve Récente', color: '#C084FC' },
    { label: 'Clôture Courtoisie', color: '#94A3B8' },
    { label: 'Suivi Trimestriel (Mois +2)', color: '#34D399' },
    { label: 'Prise de Nouvelles (Mois +3)', color: '#F472B6' },
    { label: 'Relance Long Terme (Mois +4)', color: '#FB923C' },
    { label: 'Check-in Semestriel (Mois +6)', color: '#818CF8' }
];

export const COUNTRY_MAP = {
    'ALL': { label: 'Canada & USA (Tous)', flag: '🇨🇦🇺🇸', short: 'CA / US' },
    'CA': { label: 'Canada (QC & autres)', flag: '🇨🇦', short: 'Canada' },
    'US': { label: 'États-Unis (USA)', flag: '🇺🇸', short: 'USA' }
};

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Render an individual sequence card in the catalog
 */
let activeCountrySectionFilter = 'ALL_SECTIONS';

/**
 * Filter sequence catalog by country pill
 */
window.filterSequenceCountrySection = (filterKey) => {
    activeCountrySectionFilter = filterKey;
    renderSequencesListTab();
};

/**
 * Quick change sequence country directly from catalog card
 */
window.changeCardCountry = async (seqId, newCountry, event) => {
    if (event) event.stopPropagation();
    const seq = cachedSequences.find(s => s.id === seqId);
    if (!seq) return;

    const oldCountry = seq.targetCountry || 'ALL';
    if (oldCountry === newCountry) return;

    seq.targetCountry = newCountry;
    const countryInfo = COUNTRY_MAP[newCountry] || COUNTRY_MAP['ALL'];

    try {
        window.showToast(`Attribution au pays : ${countryInfo.label}...`, "info");
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sequences`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(seq)
        });
        const data = await resp.json();
        if (data.success) {
            window.showToast(`✓ Séquence "${seq.name}" déplacée vers ${countryInfo.flag} ${countryInfo.short} !`, "success");
            renderSequencesListTab();
        } else {
            throw new Error(data.error || "Erreur de mise à jour");
        }
    } catch (e) {
        seq.targetCountry = oldCountry;
        window.showToast(`Erreur : ${e.message}`, "error");
        renderSequencesListTab();
    }
};

/**
 * 1-Click Clone Universal Sequence into a specific Country (Canada or USA)
 */
window.cloneUniversalForCountry = async (targetCountry) => {
    const universalSeqs = cachedSequences.filter(s => !s.targetCountry || s.targetCountry === 'ALL');
    if (universalSeqs.length === 0) {
        return window.openCreateSequenceModal(targetCountry);
    }

    const countryInfo = COUNTRY_MAP[targetCountry] || { label: targetCountry, flag: '' };
    
    // Choose first universal sequence to clone
    const sourceSeq = universalSeqs[0];
    const newId = `seq_${sourceSeq.targetCategory || 'custom'}_${Date.now()}`;
    const newName = `${sourceSeq.name} (${targetCountry === 'CA' ? 'Canada / QC' : 'USA'})`;

    const clonedSteps = (sourceSeq.steps || []).map((st, i) => ({
        stepNumber: i + 1,
        delayHours: st.delayHours,
        template: st.template || '',
        template_en: st.template_en || ''
    }));

    const newSeq = {
        id: newId,
        name: newName,
        targetCategory: sourceSeq.targetCategory || 'custom',
        targetCountry: targetCountry,
        description: `Variante dédiée pour ${countryInfo.label}.`,
        active: true,
        isCustom: true,
        steps: clonedSteps
    };

    try {
        window.showToast(`Création de la variante dédiée pour ${countryInfo.flag} ${countryInfo.label}...`, "info");
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sequences`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(newSeq)
        });
        const data = await resp.json();
        if (data.success) {
            cachedSequences.push(newSeq);
            renderSequencesListTab();
            window.showToast(`✓ Séquence "${newName}" créée avec succès !`, "success");
            window.openSequenceEditorModal(newSeq.id);
        } else {
            throw new Error(data.error || "Erreur lors du clonage");
        }
    } catch (e) {
        window.showToast(`Erreur : ${e.message}`, "error");
    }
};

/**
 * Render an individual sequence card in the catalog
 */
function renderSequenceCard(seq) {
    const isDefault = DEFAULT_SEQUENCE_IDS.includes(seq.id);
    const meta = CATEGORY_META[seq.targetCategory] || CATEGORY_META['custom'] || { label: 'Sur-mesure', color: '#38BDF8', badgeBg: 'rgba(56,189,248,0.12)', badgeBorder: 'rgba(56,189,248,0.3)', desc: '' };
    const country = COUNTRY_MAP[seq.targetCountry || 'ALL'] || COUNTRY_MAP['ALL'];
    const stepCount = seq.steps?.length || 0;
    const firstStepText = seq.steps?.[0]?.template || seq.steps?.[0]?.template_en || '';
    const firstStepSnippet = firstStepText ? (firstStepText.slice(0, 95) + (firstStepText.length > 95 ? '...' : '')) : '(Message vide)';

    return `
    <div class="seq-catalog-card" onclick="window.openSequenceEditorModal('${seq.id}')" title="Cliquer pour éditer cette séquence">
        <!-- Card Top Bar: Badges & Inline Country Selector -->
        <div>
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:10px;">
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <!-- Category Pill -->
                    <span style="font-size:0.72rem; font-weight:700; color:${meta.color}; background:${meta.badgeBg}; border:1px solid ${meta.badgeBorder}; padding:2px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:5px;">
                        ${meta.svg || ''}
                        <span>${escapeHtml(meta.label)}</span>
                    </span>

                    <!-- Inline Country Selector Dropdown -->
                    <div onclick="event.stopPropagation()" style="display:inline-flex; align-items:center;">
                        <select class="seq-card-country-select" onchange="window.changeCardCountry('${seq.id}', this.value, event)" title="Changer le pays d'attribution">
                            <option value="ALL" ${(!seq.targetCountry || seq.targetCountry === 'ALL') ? 'selected' : ''}>🇨🇦🇺🇸 CA & US</option>
                            <option value="CA" ${seq.targetCountry === 'CA' ? 'selected' : ''}>🇨🇦 Canada</option>
                            <option value="US" ${seq.targetCountry === 'US' ? 'selected' : ''}>🇺🇸 USA</option>
                        </select>
                    </div>
                </div>

                <!-- Native vs Custom Tag -->
                ${isDefault ? `
                    <span style="font-size:0.65rem; font-weight:700; color:#94A3B8; background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px;">NATIF</span>
                ` : `
                    <span style="font-size:0.65rem; font-weight:700; color:#38BDF8; background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.3); padding:2px 6px; border-radius:4px;">SUR-MESURE</span>
                `}
            </div>

            <!-- Card Title -->
            <div style="font-size:1.05rem; font-weight:700; color:#F8FAFC; margin-bottom:6px; line-height:1.3;">
                ${escapeHtml(seq.name)}
            </div>

            <!-- Card Description -->
            <div style="font-size:0.8rem; color:#94A3B8; line-height:1.45; min-height:36px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                ${escapeHtml(seq.description || meta.desc || '')}
            </div>
        </div>

        <!-- Card Middle: Steps Snippet Box -->
        <div style="background:#090B0F; border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:10px 12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.72rem; margin-bottom:5px;">
                <span style="font-weight:700; color:var(--gold); display:flex; align-items:center; gap:4px;">
                    ${SEQ_SVGS.clock} ${stepCount} étapes programmées
                </span>
                <span style="color:#64748B;">Étape 1 :</span>
            </div>
            <div style="font-size:0.78rem; color:#94A3B8; font-style:italic; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                "${escapeHtml(firstStepSnippet)}"
            </div>
        </div>

        <!-- Card Bottom: Actions Bar -->
        <div style="display:flex; justify-content:space-between; align-items:center; padding-top:10px; border-top:1px solid rgba(255,255,255,0.06);" onclick="event.stopPropagation()">
            <div style="display:flex; align-items:center; gap:8px;">
                <button type="button" class="lead-action-btn primary" onclick="window.openSequenceEditorModal('${seq.id}')" style="font-size:0.78rem; padding:4px 12px; background:rgba(223,165,58,0.15); border-color:var(--gold); color:var(--gold); font-weight:600; display:inline-flex; align-items:center; gap:5px;">
                    <span class="material-icons" style="font-size:15px;">edit</span> Éditer
                </button>
                <button type="button" class="lead-action-btn" onclick="window.duplicateSequenceFromList('${seq.id}', event)" title="Dupliquer (clone 1-clic)" style="font-size:0.78rem; padding:4px 10px; display:inline-flex; align-items:center; gap:5px;">
                    <span class="material-icons" style="font-size:14px;">content_copy</span> Dupliquer
                </button>
            </div>

            <div>
                ${!isDefault ? `
                    <button type="button" class="lead-action-btn danger" onclick="window.deleteSequenceFromList('${seq.id}', event)" title="Supprimer la séquence" style="font-size:0.75rem; padding:4px 8px; color:#EF4444; border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.06);">
                        <span class="material-icons" style="font-size:15px;">delete</span>
                    </button>
                ` : `
                    <span style="font-size:0.7rem; color:#64748B; font-weight:500;">Natif ERP</span>
                `}
            </div>
        </div>
    </div>
    `;
}

/**
 * Tab 1: Render Sequences Catalog (Organized by Distinct, High-Visibility Country Sections)
 */
function renderSequencesListTab() {
    const body = document.getElementById('sequence-modal-body');
    if (!body) return;

    if (!cachedSequences || cachedSequences.length === 0) {
        body.innerHTML = `
            <div style="text-align:center; padding:3rem; color:var(--text-muted);">
                <div style="font-size:1rem; font-weight:600; color:#CBD5E1;">Aucune séquence chargée</div>
                <div class="text-xs text-muted" style="margin-top:4px;">Impossible de récupérer les séquences depuis le serveur.</div>
                <button class="lead-action-btn" onclick="loadSequencesAndSettings().then(() => renderSequencesListTab())" style="margin-top:14px;">
                    ${SEQ_SVGS.restore} Réessayer
                </button>
            </div>
        `;
        return;
    }

    const tabBtn = document.getElementById('tab-btn-seq-list');
    if (tabBtn) {
        tabBtn.innerHTML = `${SEQ_SVGS.list} Séquences (${cachedSequences.length})`;
    }

    const caCount = cachedSequences.filter(s => s.targetCountry === 'CA').length;
    const usCount = cachedSequences.filter(s => s.targetCountry === 'US').length;
    const allCount = cachedSequences.filter(s => !s.targetCountry || s.targetCountry === 'ALL').length;

    // Structured Country Sections: Canada, USA, and North America (Universal)
    const COUNTRY_SECTIONS = [
        {
            key: 'CA',
            title: 'Canada (Québec & Provinces Canadiennes)',
            subtitle: 'Séquences ciblées en français québécois & stricte conformité Loi 25 / CRTC',
            flag: '🇨🇦',
            accentColor: '#EF4444',
            bgGradient: 'linear-gradient(90deg, rgba(239,68,68,0.08) 0%, rgba(13,17,23,0) 100%)',
            badgeColor: '#EF4444',
            badgeBg: 'rgba(239,68,68,0.12)',
            badgeBorder: 'rgba(239,68,68,0.35)',
            complianceBadge: '🍁 Loi 25 & CRTC • Bilingue QC/CAN',
            filterMatch: (s) => s.targetCountry === 'CA'
        },
        {
            key: 'US',
            title: 'États-Unis (Marché Américain - USA)',
            subtitle: 'Séquences dédiées en anglais américain avec clauses de conformité TCPA & 10DLC',
            flag: '🇺🇸',
            accentColor: '#38BDF8',
            bgGradient: 'linear-gradient(90deg, rgba(56,189,248,0.08) 0%, rgba(13,17,23,0) 100%)',
            badgeColor: '#38BDF8',
            badgeBg: 'rgba(56,189,248,0.12)',
            badgeBorder: 'rgba(56,189,248,0.35)',
            complianceBadge: '🦅 TCPA & 10DLC • US English',
            filterMatch: (s) => s.targetCountry === 'US'
        },
        {
            key: 'ALL',
            title: 'Amérique du Nord (Canada & USA - Séquences Universelles)',
            subtitle: 'Séquences multi-marchés bilingues déployées selon le fuseau horaire du prospect',
            flag: '🇨🇦 🇺🇸',
            accentColor: 'var(--gold)',
            bgGradient: 'linear-gradient(90deg, rgba(223,165,58,0.08) 0%, rgba(13,17,23,0) 100%)',
            badgeColor: 'var(--gold)',
            badgeBg: 'rgba(223,165,58,0.12)',
            badgeBorder: 'rgba(223,165,58,0.35)',
            complianceBadge: '🌐 Multi-Fuseaux • Bilingue FR / EN',
            filterMatch: (s) => !s.targetCountry || s.targetCountry === 'ALL'
        }
    ];

    // Filter displayed sections if user clicked a country pill
    const displayedSections = activeCountrySectionFilter === 'ALL_SECTIONS'
        ? COUNTRY_SECTIONS
        : COUNTRY_SECTIONS.filter(sec => sec.key === activeCountrySectionFilter);

    body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:24px;">
            <!-- Top Catalog Header Bar -->
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; background:#12151B; border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:16px 22px; box-shadow:0 4px 18px rgba(0,0,0,0.35);">
                <div>
                    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                        <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:#F8FAFC;">Catalogue des Séquences SMS</h3>
                        <span style="font-size:0.75rem; font-weight:700; color:var(--gold); background:rgba(223,165,58,0.12); border:1px solid rgba(223,165,58,0.3); padding:2px 10px; border-radius:12px;">
                            ${cachedSequences.length} actives au total
                        </span>
                    </div>
                    <div style="font-size:0.8rem; color:#94A3B8; margin-top:4px;">
                        Les séquences sont réparties ci-dessous par pays avec sections dédiées. Cliquez sur une carte pour ouvrir le Grand Studio d'édition.
                    </div>
                </div>

                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <div style="font-size:0.75rem; color:#64748B; display:flex; align-items:center; gap:5px;">
                        ${SEQ_SVGS.shield}
                        <span>Arrêt sur réponse • Franchises exclues • Respect TCPA</span>
                    </div>
                    <button type="button" class="lead-action-btn primary" onclick="window.openCreateSequenceModal('ALL')" style="padding:7px 18px; font-size:0.82rem; border-color:var(--gold); color:var(--gold); background:rgba(223,165,58,0.15); display:inline-flex; align-items:center; gap:6px; font-weight:700;">
                        <span style="font-size:16px; font-weight:900;">+</span> Nouvelle séquence
                    </button>
                </div>
            </div>

            <!-- Country Switcher Navigation Pills -->
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:4px 0;">
                <span style="font-size:0.75rem; font-weight:700; color:#64748B; text-transform:uppercase; letter-spacing:0.4px; margin-right:4px;">Afficher :</span>
                <button type="button" class="seq-country-filter-pill ${activeCountrySectionFilter === 'ALL_SECTIONS' ? 'active' : ''}" onclick="window.filterSequenceCountrySection('ALL_SECTIONS')">
                    <span>🌐 Toutes les sections</span>
                    <span style="font-size:0.7rem; opacity:0.85; padding:1px 6px; border-radius:10px; background:rgba(255,255,255,0.08);">${cachedSequences.length}</span>
                </button>
                <button type="button" class="seq-country-filter-pill ${activeCountrySectionFilter === 'CA' ? 'active' : ''}" onclick="window.filterSequenceCountrySection('CA')">
                    <span>🇨🇦 Canada</span>
                    <span style="font-size:0.7rem; opacity:0.85; padding:1px 6px; border-radius:10px; background:${caCount > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}; color:${caCount > 0 ? '#EF4444' : 'inherit'}; font-weight:700;">${caCount}</span>
                </button>
                <button type="button" class="seq-country-filter-pill ${activeCountrySectionFilter === 'US' ? 'active' : ''}" onclick="window.filterSequenceCountrySection('US')">
                    <span>🇺🇸 États-Unis</span>
                    <span style="font-size:0.7rem; opacity:0.85; padding:1px 6px; border-radius:10px; background:${usCount > 0 ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.08)'}; color:${usCount > 0 ? '#38BDF8' : 'inherit'}; font-weight:700;">${usCount}</span>
                </button>
                <button type="button" class="seq-country-filter-pill ${activeCountrySectionFilter === 'ALL' ? 'active' : ''}" onclick="window.filterSequenceCountrySection('ALL')">
                    <span>🇨🇦🇺🇸 Amérique du Nord</span>
                    <span style="font-size:0.7rem; opacity:0.85; padding:1px 6px; border-radius:10px; background:${allCount > 0 ? 'rgba(223,165,58,0.2)' : 'rgba(255,255,255,0.08)'}; color:${allCount > 0 ? 'var(--gold)' : 'inherit'}; font-weight:700;">${allCount}</span>
                </button>
            </div>

            <!-- Distinct, High-Visibility Country Sections Stack -->
            ${displayedSections.map(section => {
                const groupSeqs = cachedSequences.filter(section.filterMatch);
                return `
                <div class="seq-country-section" style="border-left:5px solid ${section.accentColor}; background:${section.bgGradient};">
                    
                    <!-- Section Banner -->
                    <div class="seq-country-banner">
                        <div style="display:flex; align-items:center; gap:16px;">
                            <div class="seq-country-flag-tile">
                                ${section.flag}
                            </div>
                            <div>
                                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                                    <h4 style="margin:0; font-size:1.2rem; font-weight:800; color:#F8FAFC; letter-spacing:-0.2px;">${section.title}</h4>
                                    <span style="font-size:0.72rem; font-weight:700; color:${section.badgeColor}; background:${section.badgeBg}; border:1px solid ${section.badgeBorder}; padding:2px 10px; border-radius:12px;">
                                        ${groupSeqs.length} séquence${groupSeqs.length > 1 ? 's' : ''} active${groupSeqs.length > 1 ? 's' : ''}
                                    </span>
                                    <span style="font-size:0.72rem; font-weight:600; color:#94A3B8; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); padding:2px 8px; border-radius:12px;">
                                        ${section.complianceBadge}
                                    </span>
                                </div>
                                <div style="font-size:0.8rem; color:#94A3B8; margin-top:4px;">
                                    ${section.subtitle}
                                </div>
                            </div>
                        </div>

                        <!-- Section Quick Action -->
                        <div style="display:flex; align-items:center; gap:8px;">
                            <button type="button" class="lead-action-btn" onclick="window.openCreateSequenceModal('${section.key}')" style="font-size:0.78rem; padding:6px 14px; display:inline-flex; align-items:center; gap:6px; border-color:${section.badgeBorder}; background:${section.badgeBg}; color:#F8FAFC; font-weight:600;">
                                <span class="material-icons" style="font-size:16px; color:${section.badgeColor};">add_circle_outline</span>
                                <span>Ajouter pour ${section.key === 'ALL' ? 'CA & US' : (section.key === 'CA' ? 'le Canada' : 'les USA')}</span>
                            </button>
                        </div>
                    </div>

                    <!-- Cards Grid or Proactive Helper Box -->
                    ${groupSeqs.length > 0 ? `
                        <div class="seq-catalog-grid" style="margin-top:4px;">
                            ${groupSeqs.map(renderSequenceCard).join('')}
                        </div>
                    ` : `
                        <div style="background:rgba(0,0,0,0.35); border:1px dashed rgba(255,255,255,0.12); border-radius:12px; padding:28px 24px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:12px; margin-top:4px;">
                            <div style="width:44px; height:44px; border-radius:50%; background:${section.badgeBg}; border:1px solid ${section.badgeBorder}; display:flex; align-items:center; justify-content:center; color:${section.badgeColor}; font-size:1.4rem;">
                                ${section.flag}
                            </div>
                            <div>
                                <div style="font-size:0.95rem; font-weight:700; color:#F8FAFC;">
                                    ${section.key === 'CA' ? 'Couverture automatique active pour le Canada' : (section.key === 'US' ? 'Couverture automatique active pour les USA' : 'Aucune séquence dans cette section')}
                                </div>
                                <div style="font-size:0.78rem; color:#94A3B8; max-width:620px; margin:6px auto 0; line-height:1.5;">
                                    ${section.key === 'CA'
                                        ? "Vos prospects canadiens sont actuellement pris en charge par les <strong>séquences universelles Amérique du Nord</strong> ci-dessous (détection du français québécois & conformité Loi 25). Vous pouvez créer ou cloner une séquence 100% exclusive au Canada pour cibler des particularités locales."
                                        : "Vos prospects américains sont actuellement pris en charge par les <strong>séquences universelles Amérique du Nord</strong> ci-dessous (déploiement en anglais américain & clauses TCPA). Vous pouvez créer ou cloner une séquence 100% exclusive aux USA."}
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:6px;">
                                <button type="button" class="lead-action-btn primary" onclick="window.cloneUniversalForCountry('${section.key}')" style="font-size:0.8rem; padding:7px 18px; background:rgba(223,165,58,0.15); border-color:var(--gold); color:var(--gold); font-weight:700; display:inline-flex; align-items:center; gap:6px;">
                                    <span class="material-icons" style="font-size:16px;">content_copy</span>
                                    <span>Cloner une séquence pour ${section.key === 'CA' ? 'le Canada' : 'les USA'}</span>
                                </button>
                                <button type="button" class="lead-action-btn" onclick="window.openCreateSequenceModal('${section.key}')" style="font-size:0.8rem; padding:7px 16px; display:inline-flex; align-items:center; gap:6px;">
                                    <span class="material-icons" style="font-size:16px;">add</span>
                                    <span>Créer une nouvelle séquence vierge</span>
                                </button>
                            </div>
                        </div>
                    `}
                </div>
                `;
            }).join('')}

            <!-- Bottom Footnote Bar -->
            <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:10px; padding:12px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; align-items:center; gap:8px; font-size:0.78rem; color:#94A3B8;">
                    ${SEQ_SVGS.check}
                    <span>L'IA route automatiquement chaque prospect vers la séquence adéquate selon le pays de sa fiche Google Maps et l'audit technique.</span>
                </div>
                <div style="font-size:0.75rem; color:#64748B;">
                    Variables dynamiques disponibles : {{name}}, {{company}}, {{city}}, {{industry}}
                </div>
            </div>
        </div>
    `;
}

/**
 * Open Grand Studio Modal for Sequence Editing
 */
window.openSequenceEditorModal = (sequenceId) => {
    selectedSequenceId = sequenceId;
    const seq = cachedSequences.find(s => s.id === sequenceId) || cachedSequences[0];
    if (!seq) return;

    // Remove any previously open editor modal
    const existing = document.getElementById('sequence-editor-modal');
    if (existing) existing.remove();

    const isDefaultSequence = DEFAULT_SEQUENCE_IDS.includes(seq.id);

    const modalHtml = `
    <div id="sequence-editor-modal" class="seq-modal-overlay" onclick="if(event.target === this) window.closeSequenceEditorModal();">
        <div class="seq-modal-window">
            
            <!-- Modal Header (Pinned) -->
            <div class="seq-modal-header">
                <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:320px; flex-wrap:wrap;">
                    <!-- Editable Name Input -->
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="material-icons" style="font-size:22px; color:var(--gold);">auto_fix_high</span>
                        <input type="text" id="seq-modal-edit-name" value="${escapeHtml(seq.name)}" placeholder="Nom de la séquence" style="background:#090B0F; border:1px solid rgba(255,255,255,0.12); color:#F8FAFC; font-size:1.05rem; font-weight:700; padding:6px 12px; border-radius:8px; min-width:280px; outline:none; transition:border-color 0.2s;" onfocus="this.style.borderColor='var(--gold)';" onblur="this.style.borderColor='rgba(255,255,255,0.12)';" onchange="window.updateSequenceName(this.value)">
                    </div>

                    <!-- Target Category Dropdown -->
                    <div style="display:inline-flex; align-items:center; gap:5px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:4px 10px; border-radius:8px;">
                        <span style="font-size:0.75rem; color:#94A3B8; font-weight:600;">Type :</span>
                        <select id="seq-modal-target-category" class="seq-country-select" onchange="window.updateSequenceCategory(this.value)" style="background:transparent; border:none; color:#F8FAFC; font-size:0.8rem; font-weight:600; outline:none; cursor:pointer;">
                            <option value="directory_only" ${seq.targetCategory === 'directory_only' ? 'selected' : ''}>Annuaire seul</option>
                            <option value="missing_gmb_website" ${seq.targetCategory === 'missing_gmb_website' ? 'selected' : ''}>Google Maps manquant</option>
                            <option value="no_website" ${seq.targetCategory === 'no_website' ? 'selected' : ''}>Pas de site web</option>
                            <option value="outdated_website" ${seq.targetCategory === 'outdated_website' ? 'selected' : ''}>Site obsolète</option>
                            <option value="modern_no_ai" ${seq.targetCategory === 'modern_no_ai' ? 'selected' : ''}>Sans agent IA</option>
                            <option value="social_only" ${seq.targetCategory === 'social_only' ? 'selected' : ''}>Réseaux seuls</option>
                            <option value="custom" ${seq.targetCategory === 'custom' ? 'selected' : ''}>Sur-mesure / Autre</option>
                        </select>
                    </div>

                    <!-- Target Country Dropdown -->
                    <div style="display:inline-flex; align-items:center; gap:5px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:4px 10px; border-radius:8px;">
                        <span style="font-size:0.75rem; color:#94A3B8; font-weight:600;">Pays :</span>
                        <select id="seq-modal-target-country" class="seq-country-select" onchange="window.updateSequenceCountry(this.value)" style="background:transparent; border:none; color:#F8FAFC; font-size:0.8rem; font-weight:600; outline:none; cursor:pointer;">
                            <option value="ALL" ${(!seq.targetCountry || seq.targetCountry === 'ALL') ? 'selected' : ''}>🇨🇦🇺🇸 CA & US (Tous)</option>
                            <option value="CA" ${seq.targetCountry === 'CA' ? 'selected' : ''}>🇨🇦 Canada (QC & autres)</option>
                            <option value="US" ${seq.targetCountry === 'US' ? 'selected' : ''}>🇺🇸 USA</option>
                        </select>
                    </div>
                </div>

                <!-- Center: Language Switcher -->
                <div style="display:flex; align-items:center; gap:6px; background:#0B0E14; border:1px solid rgba(255,255,255,0.08); padding:3px; border-radius:8px;">
                    <button type="button" id="btn-lang-fr" onclick="window.switchSequenceEditorLang('fr')" style="border:none; border-radius:6px; padding:5px 12px; font-size:0.75rem; font-weight:600; cursor:pointer; background:${sequenceEditorLang === 'fr' ? 'rgba(223,165,58,0.2)' : 'transparent'}; color:${sequenceEditorLang === 'fr' ? 'var(--gold)' : '#94A3B8'}; border:1px solid ${sequenceEditorLang === 'fr' ? 'rgba(223,165,58,0.35)' : 'transparent'}; display:flex; align-items:center; gap:6px; transition:all 0.2s ease;">
                        <span>🇨🇦</span>
                        <span>Français (Québec)</span>
                    </button>
                    <button type="button" id="btn-lang-en" onclick="window.switchSequenceEditorLang('en')" style="border:none; border-radius:6px; padding:5px 12px; font-size:0.75rem; font-weight:600; cursor:pointer; background:${sequenceEditorLang === 'en' ? 'rgba(56,189,248,0.2)' : 'transparent'}; color:${sequenceEditorLang === 'en' ? '#38BDF8' : '#94A3B8'}; border:1px solid ${sequenceEditorLang === 'en' ? 'rgba(56,189,248,0.35)' : 'transparent'}; display:flex; align-items:center; gap:6px; transition:all 0.2s ease;">
                        <span>🇺🇸🇨🇦</span>
                        <span>English (Canada & USA)</span>
                    </button>
                </div>

                <!-- Right Header Actions -->
                <div style="display:flex; align-items:center; gap:8px;">
                    <button type="button" class="lead-action-btn" onclick="window.duplicateCurrentSequence()" title="Dupliquer cette séquence" style="font-size:0.78rem; display:inline-flex; align-items:center; gap:5px; padding:6px 12px;">
                        <span class="material-icons" style="font-size:15px;">content_copy</span> Dupliquer
                    </button>
                    ${isDefaultSequence ? `
                        <button type="button" class="lead-action-btn" onclick="window.resetCurrentSequence()" title="Rétablir le modèle initial" style="font-size:0.78rem; display:inline-flex; align-items:center; gap:5px; padding:6px 12px;">
                            ${SEQ_SVGS.restore} Rétablir
                        </button>
                    ` : `
                        <button type="button" class="lead-action-btn" onclick="window.deleteCurrentSequence()" title="Supprimer cette séquence" style="font-size:0.78rem; color:#EF4444; border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.06); display:inline-flex; align-items:center; gap:5px; padding:6px 12px;">
                            ${SEQ_SVGS.close} Supprimer
                        </button>
                    `}
                    <button type="button" id="btn-save-current-seq" class="lead-action-btn primary" onclick="window.saveCurrentSequence()" style="background:rgba(223,165,58,0.18); border-color:var(--gold); color:var(--gold); font-weight:700; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px; padding:6px 16px;">
                        ${SEQ_SVGS.save} Enregistrer
                    </button>
                    <button type="button" onclick="window.closeSequenceEditorModal()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; padding:6px; display:inline-flex; align-items:center; justify-content:center; border-radius:6px; margin-left:4px;" title="Fermer le studio (Échap)">
                        <span class="material-icons" style="font-size:20px;">close</span>
                    </button>
                </div>
            </div>

            <!-- Modal Toolbar (Pinned) -->
            <div class="seq-modal-toolbar">
                <!-- Editable Description -->
                <div style="flex:1; min-width:280px; max-width:650px;">
                    <input type="text" id="seq-modal-edit-desc" value="${escapeHtml(seq.description || '')}" placeholder="Description / rôle de la séquence..." style="background:transparent; border:none; border-bottom:1px dashed rgba(255,255,255,0.15); color:#94A3B8; font-size:0.82rem; padding:4px 6px; width:100%; outline:none;" onchange="window.updateSequenceDescription(this.value)">
                </div>

                <!-- Info Badges & Accordion Controls -->
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:12px; font-size:0.75rem; color:#64748B;">
                        <span style="display:flex; align-items:center; gap:4px;">
                            ${SEQ_SVGS.clock} Auto post-audit
                        </span>
                        <span style="display:flex; align-items:center; gap:4px;">
                            ${SEQ_SVGS.stopCircle} Stop immédiat si réponse
                        </span>
                        <span style="display:flex; align-items:center; gap:4px;">
                            ${SEQ_SVGS.globe} 09h-18h local
                        </span>
                    </div>

                    <div style="display:flex; align-items:center; gap:5px; border-left:1px solid rgba(255,255,255,0.08); padding-left:12px;">
                        <button type="button" class="lead-action-btn" onclick="window.collapseAllSteps(true)" style="padding:4px 9px; font-size:0.72rem; display:flex; align-items:center; gap:4px;" title="Replier toutes les cartes">
                            <span class="material-icons" style="font-size:14px;">unfold_less</span> Replier tout
                        </button>
                        <button type="button" class="lead-action-btn" onclick="window.collapseAllSteps(false)" style="padding:4px 9px; font-size:0.72rem; display:flex; align-items:center; gap:4px;" title="Déplier toutes les cartes">
                            <span class="material-icons" style="font-size:14px;">unfold_more</span> Déplier tout
                        </button>
                        <button type="button" class="lead-action-btn" onclick="window.addNewSequenceStep()" style="background:rgba(223,165,58,0.12); border-color:rgba(223,165,58,0.35); color:var(--gold); font-weight:600; font-size:0.75rem; padding:4px 12px; display:flex; align-items:center; gap:5px;">
                            <span class="material-icons" style="font-size:15px;">add_circle</span> Ajouter une étape
                        </button>
                    </div>
                </div>
            </div>

            <!-- Modal Body: Scrollable Steps List -->
            <div id="seq-modal-steps-container" class="seq-modal-body">
                <!-- Dynamically rendered by renderModalSteps(seq) -->
            </div>

            <!-- Modal Footer (Pinned) -->
            <div class="seq-modal-footer">
                <div style="display:flex; align-items:center; gap:8px; font-size:0.78rem; color:#94A3B8;">
                    ${SEQ_SVGS.shield}
                    <span>Arrêt automatique dès qu'un prospect répond par SMS. Respect strict des règles anti-spam et TCPA.</span>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <button type="button" class="lead-action-btn" onclick="window.closeSequenceEditorModal()" style="padding:6px 16px; font-size:0.82rem;">
                        Fermer
                    </button>
                    <button type="button" class="lead-action-btn primary" onclick="window.saveCurrentSequence()" style="padding:6px 20px; font-size:0.82rem; font-weight:700; background:rgba(223,165,58,0.18); border-color:var(--gold); color:var(--gold);">
                        ${SEQ_SVGS.save} Enregistrer la Séquence
                    </button>
                </div>
            </div>

        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    renderModalSteps(seq);

    // Escape key listener to close modal
    const escListener = (e) => {
        if (e.key === 'Escape') {
            window.closeSequenceEditorModal();
            window.removeEventListener('keydown', escListener);
        }
    };
    window.addEventListener('keydown', escListener);
};

/**
 * Render Steps inside the Grand Studio Modal
 */
function renderModalSteps(seq) {
    const container = document.getElementById('seq-modal-steps-container');
    if (!container || !seq) return;

    const steps = Array.isArray(seq.steps) ? seq.steps : [];
    const isEn = sequenceEditorLang === 'en';

    container.innerHTML = `
        <div class="seq-steps-column" id="seq-steps-column">
            ${steps.map((st, i) => {
                const stepPurpose = STEP_PURPOSES[i] || { label: (i === steps.length - 1 ? 'Clôture Courtoisie' : `Étape ${st.stepNumber}`), color: 'var(--gold)' };
                const templateText = isEn ? (st.template_en || '') : (st.template || '');
                const charCount = templateText.length;
                const segments = charCount > 160 ? Math.ceil(charCount / 153) : 1;
                const hasStop = /stop/i.test(templateText);
                const hasCustomDelay = !STANDARD_DELAYS.some(d => Math.abs(d.value - st.delayHours) < 0.01);
                const isCollapsed = window.collapsedSteps?.[i] === true;
                const snippet = templateText ? templateText.slice(0, 85) + (templateText.length > 85 ? '...' : '') : '(Message vide)';
                const delayObj = STANDARD_DELAYS.find(d => Math.abs(d.value - st.delayHours) < 0.01);
                const delayLabel = delayObj ? delayObj.label : `${st.delayHours}h`;

                return `
                <div class="seq-step-card ${isCollapsed ? 'is-collapsed' : ''}" id="seq-step-card-${i}">
                    <!-- Step Header -->
                    <div class="seq-step-header" onclick="window.toggleStepCollapse(${i})">
                        <!-- Col 1: Step Number -->
                        <div style="width:72px; flex-shrink:0;">
                            <span style="display:inline-block; font-size:0.76rem; font-weight:700; color:#F8FAFC; padding:3px 8px; border-radius:5px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); text-align:center; width:100%;">
                                Étape ${st.stepNumber}
                            </span>
                        </div>

                        <!-- Col 2: Step Purpose & Language -->
                        <div style="width:235px; flex-shrink:0; display:flex; align-items:center; gap:6px;">
                            <span style="font-size:0.8rem; font-weight:600; color:${stepPurpose.color}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${stepPurpose.label}">
                                ${stepPurpose.label}
                            </span>
                            <span style="font-size:0.66rem; font-weight:700; color:${isEn ? '#38BDF8' : 'var(--gold)'}; background:${isEn ? 'rgba(56,189,248,0.1)' : 'rgba(223,165,58,0.1)'}; border:1px solid ${isEn ? 'rgba(56,189,248,0.25)' : 'rgba(223,165,58,0.25)'}; padding:1px 5px; border-radius:4px; flex-shrink:0;">
                                ${isEn ? '🇺🇸 EN' : '🇨🇦 FR'}
                            </span>
                        </div>

                        <!-- Col 3: Delay Badge -->
                        <div style="width:145px; flex-shrink:0;">
                            <span style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; color:#CBD5E1; background:rgba(255,255,255,0.03); padding:2px 8px; border-radius:4px; border:1px solid rgba(255,255,255,0.06); white-space:nowrap;">
                                ⏱️ ${delayLabel}
                            </span>
                        </div>

                        <!-- Col 4: Collapsed Snippet -->
                        <div class="seq-collapsed-summary" style="flex:1; min-width:0; overflow:hidden; display:flex; align-items:center;">
                            <span class="seq-collapsed-text" style="font-size:0.8rem; color:#94A3B8; font-style:italic; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;" title="${escapeHtml(templateText)}">
                                "${escapeHtml(snippet)}"
                            </span>
                        </div>

                        <!-- Col 5: Header Actions -->
                        <div class="seq-step-header-actions" onclick="event.stopPropagation()" style="width:130px; flex-shrink:0; display:flex; justify-content:flex-end; gap:5px;">
                            <button type="button" class="seq-step-icon-btn" onclick="window.moveSequenceStep(${i}, -1)" ${i === 0 ? 'disabled' : ''} title="Monter cette étape">
                                <span class="material-icons" style="font-size:15px;">arrow_upward</span>
                            </button>
                            <button type="button" class="seq-step-icon-btn" onclick="window.moveSequenceStep(${i}, 1)" ${i === steps.length - 1 ? 'disabled' : ''} title="Descendre cette étape">
                                <span class="material-icons" style="font-size:15px;">arrow_downward</span>
                            </button>
                            <button type="button" class="seq-step-icon-btn danger" onclick="window.deleteSequenceStep(${i})" title="Supprimer cette étape">
                                <span class="material-icons" style="font-size:15px;">delete</span>
                            </button>
                            <button type="button" class="seq-step-icon-btn" onclick="window.toggleStepCollapse(${i})" title="${isCollapsed ? 'Déplier' : 'Replier'}">
                                <span class="material-icons seq-collapse-chevron" style="font-size:16px;">expand_more</span>
                            </button>
                        </div>
                    </div>

                    <!-- Step Body (Full Editor) -->
                    <div class="seq-step-body" style="margin-top:14px;">
                        <!-- Delay Selector & Test Bar -->
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size:0.75rem; color:#94A3B8; font-weight:600;">Délai d'envoi :</span>
                                <select id="seq-step-delay-${i}" style="background:#090B0F; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:4px 10px; font-size:0.78rem; color:#CBD5E1; outline:none; cursor:pointer;" title="Délai avant cette étape">
                                    ${STANDARD_DELAYS.map(d => {
                                        const isSelected = Math.abs(d.value - st.delayHours) < 0.01;
                                        return `<option value="${d.value}" ${isSelected ? 'selected' : ''}>${d.label}</option>`;
                                    }).join('')}
                                    ${hasCustomDelay ? `<option value="${st.delayHours}" selected>${st.delayHours}h (Personnalisé)</option>` : ''}
                                </select>
                            </div>

                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.72rem; color:#64748B;">Admin : +1 506 233-7006</span>
                                <button type="button" id="btn-test-step-${i}" class="lead-action-btn" onclick="window.testSingleStepSMS(${i})" style="font-size:0.74rem; padding:4px 10px;" title="Tester ce SMS sur votre mobile">
                                    ${SEQ_SVGS.send} Tester (${isEn ? 'EN' : 'FR'})
                                </button>
                            </div>
                        </div>

                        <!-- Variables Quick Insert Bar -->
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
                            <span style="font-size:0.72rem; color:#94A3B8; font-weight:600;">Variables & Démos :</span>
                            <div style="display:flex; gap:5px; flex-wrap:wrap;">
                                <button type="button" class="seq-var-btn" onclick="window.insertVarIntoStep(${i}, '{{name}}')">+ {{name}}</button>
                                <button type="button" class="seq-var-btn" onclick="window.insertVarIntoStep(${i}, '{{company}}')">+ {{company}}</button>
                                <button type="button" class="seq-var-btn" onclick="window.insertVarIntoStep(${i}, '{{city}}')">+ {{city}}</button>
                                <button type="button" class="seq-var-btn" onclick="window.insertVarIntoStep(${i}, '{{industry}}')">+ {{industry}}</button>
                                <button type="button" class="seq-var-btn" onclick="window.insertVarIntoStep(${i}, 'https://cliniquetn.ca')" style="color:#60A5FA; border-color:rgba(96,165,250,0.25);" title="Insérer le lien démo Clinique TN">+ cliniquetn.ca</button>
                                <button type="button" class="seq-var-btn" onclick="window.insertVarIntoStep(${i}, 'https://caissiecapeoasis.com')" style="color:var(--gold); border-color:rgba(223,165,58,0.25);" title="Insérer le lien démo Caissie Cape Oasis">+ caissiecapeoasis.com</button>
                            </div>
                        </div>

                        <!-- Editable Textarea -->
                        <textarea id="seq-step-template-${i}" rows="4" class="seq-textarea" oninput="window.updateStepLiveStats(${i})" placeholder="${isEn ? 'Enter your English SMS copy...' : 'Tapez votre SMS en français...'}">${escapeHtml(templateText)}</textarea>

                        <!-- Live Counter & Compliance -->
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; font-size:0.74rem; color:#64748B; flex-wrap:wrap; gap:6px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span id="seq-step-chars-${i}" style="color:#CBD5E1;">${charCount} car.</span>
                                <span id="seq-step-segments-${i}" style="color:${segments > 1 ? '#F59E0B' : '#10B981'}; font-weight:600;">
                                    ${segments} SMS (${segments * 160} max)
                                </span>
                            </div>

                            <div id="seq-step-compliance-${i}" style="color:${hasStop ? '#10B981' : '#F59E0B'}; display:flex; align-items:center; gap:4px; font-weight:500;">
                                ${hasStop ? `${SEQ_SVGS.check} Mention STOP conforme` : `${SEQ_SVGS.alertCircle} Mention STOP conseillée`}
                            </div>
                        </div>
                    </div>
                </div>
                `;
            }).join('')}

            <!-- Bottom Add Step Button -->
            <button type="button" class="seq-add-step-btn" onclick="window.addNewSequenceStep()">
                <span class="material-icons" style="font-size:18px;">add_circle_outline</span>
                <span>Ajouter une étape supplémentaire à cette séquence</span>
            </button>
        </div>
    `;
}

/**
 * Close Grand Studio Modal
 */
window.closeSequenceEditorModal = () => {
    const modal = document.getElementById('sequence-editor-modal');
    if (modal) modal.remove();
    renderSequencesListTab();
};

/**
 * Tab: Render Autonomous Lead Hunter Auto-Pilot Dashboard in Modal
 */
async function renderHunterAutoPilotModalTab() {
    const body = document.getElementById('sequence-modal-body');
    if (!body) return;

    body.innerHTML = `
        <div style="text-align:center; padding:3rem; color:var(--text-muted);">
            <span class="material-icons rotating" style="font-size:28px; color:var(--gold);">refresh</span>
            <div style="margin-top:10px;">Chargement du Chasseur Auto-Pilot...</div>
        </div>
    `;

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/hunter/config`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        const cfg = data.config || {};

        const isAct = cfg.isActive === true;
        const freq = cfg.frequencyHours || 6;
        const batch = cfg.leadsPerBatch || 10;
        const filter = cfg.websiteFilter || 'NO_WEBSITE';
        const apiKey = cfg.apiKey || localStorage.getItem('erp_google_places_key') || '';
        const total = cfg.totalLeadsHunted || 0;
        const lastRun = cfg.lastRunAt ? new Date(cfg.lastRunAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Aucun cycle exécuté';
        const lastSummary = cfg.lastRunSummary;

        const targetCountry = cfg.targetCountry || 'CA';
        const targetRegion = cfg.targetRegion || 'ALL';
        const targetIndustry = cfg.targetIndustry || 'ALL';
        const customIndustry = cfg.customIndustry || '';

        body.innerHTML = `
            <div class="prospection-grid-layout">
                
                <!-- LEFT COLUMN: Engine Settings & Cockpit Below -->
                <div style="display:flex; flex-direction:column; gap:16px;">
                    
                    <!-- Parameters Card -->
                    <div style="background:#12151B; border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:20px 22px; box-shadow:0 4px 20px rgba(0,0,0,0.2);">
                        
                        <!-- Parameters Grid (4 cols on wide screen) -->
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
                            <div class="form-group" style="margin:0;">
                                <label style="display:block; font-size:0.72rem; text-transform:uppercase; font-weight:600; color:#94A3B8; margin-bottom:4px;">Fréquence des cycles :</label>
                                <select id="modal-autopilot-freq" style="width:100%; background:#090B0F; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:7px 10px; font-size:0.82rem; color:#CBD5E1; outline:none;">
                                    <option value="2" ${freq === 2 ? 'selected' : ''}>Toutes les 2 heures</option>
                                    <option value="4" ${freq === 4 ? 'selected' : ''}>Toutes les 4 heures</option>
                                    <option value="6" ${freq === 6 ? 'selected' : ''}>Toutes les 6 heures (Recommandé)</option>
                                    <option value="12" ${freq === 12 ? 'selected' : ''}>Toutes les 12 heures</option>
                                    <option value="24" ${freq === 24 ? 'selected' : ''}>Quotidien (Toutes les 24h)</option>
                                </select>
                            </div>

                            <div class="form-group" style="margin:0;">
                                <label style="display:block; font-size:0.72rem; text-transform:uppercase; font-weight:600; color:#94A3B8; margin-bottom:4px;">Quota par cycle :</label>
                                <select id="modal-autopilot-batch" style="width:100%; background:#090B0F; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:7px 10px; font-size:0.82rem; color:#CBD5E1; outline:none;">
                                    <option value="5" ${batch === 5 ? 'selected' : ''}>5 leads qualifiés</option>
                                    <option value="10" ${batch === 10 ? 'selected' : ''}>10 leads qualifiés (Recommandé)</option>
                                    <option value="15" ${batch === 15 ? 'selected' : ''}>15 leads qualifiés</option>
                                    <option value="25" ${batch === 25 ? 'selected' : ''}>25 leads qualifiés</option>
                                </select>
                            </div>

                            <div class="form-group" style="margin:0;">
                                <label style="display:block; font-size:0.72rem; text-transform:uppercase; font-weight:600; color:#94A3B8; margin-bottom:4px;">Ciblage Site Web :</label>
                                <select id="modal-autopilot-filter" style="width:100%; background:#090B0F; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:7px 10px; font-size:0.82rem; color:#CBD5E1; outline:none;">
                                    <option value="NO_WEBSITE" ${filter === 'NO_WEBSITE' ? 'selected' : ''}>Sans site web uniquement</option>
                                    <option value="ALL" ${filter === 'ALL' ? 'selected' : ''}>Tous les prospects (Tous profils)</option>
                                    <option value="HAS_WEBSITE" ${filter === 'HAS_WEBSITE' ? 'selected' : ''}>Avec site web (Refonte & IA)</option>
                                </select>
                            </div>

                            <div class="form-group" style="margin:0;">
                                <label style="display:block; font-size:0.72rem; text-transform:uppercase; font-weight:600; color:#94A3B8; margin-bottom:4px;">Clé Google Places API :</label>
                                <input type="password" id="modal-autopilot-api-key" value="${escapeHtml(apiKey)}" placeholder="AIzaSy..." style="width:100%; background:#090B0F; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:7px 10px; font-size:0.82rem; color:#CBD5E1; font-family:monospace; outline:none;">
                            </div>
                        </div>

                        <!-- CIBLAGE GÉOGRAPHIQUE & MÉTIERS -->
                        <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:10px; padding:16px; margin-top:16px;">
                            <div style="display:flex; align-items:center; gap:6px; margin-bottom:12px;">
                                ${SEQ_SVGS.globe}
                                <span style="font-size:0.8rem; font-weight:600; color:#F8FAFC; text-transform:uppercase; letter-spacing:0.5px;">Ciblage Géographique (Canada / USA) & Profession</span>
                            </div>

                            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
                                <div class="form-group" style="margin:0;">
                                    <label style="display:block; font-size:0.72rem; text-transform:uppercase; font-weight:600; color:#94A3B8; margin-bottom:4px;">Pays cible :</label>
                                    <select id="modal-autopilot-country" style="width:100%; background:#090B0F; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:7px 10px; font-size:0.82rem; color:#CBD5E1; outline:none;" onchange="window.handleModalAutopilotCountryChange(this.value)">
                                        <option value="CA" ${targetCountry === 'CA' ? 'selected' : ''}>Canada</option>
                                        <option value="US" ${targetCountry === 'US' ? 'selected' : ''}>USA (États-Unis)</option>
                                        <option value="ALL" ${targetCountry === 'ALL' ? 'selected' : ''}>Canada & USA (Alternance)</option>
                                    </select>
                                </div>

                                <div class="form-group" style="margin:0;">
                                    <label style="display:block; font-size:0.72rem; text-transform:uppercase; font-weight:600; color:#94A3B8; margin-bottom:4px;">Province ou État :</label>
                                    <select id="modal-autopilot-region" style="width:100%; background:#090B0F; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:7px 10px; font-size:0.82rem; color:#CBD5E1; outline:none;">
                                        ${buildRegionOptionsHtml(targetCountry, targetRegion)}
                                    </select>
                                </div>

                                <div class="form-group" style="margin:0;">
                                    <label style="display:block; font-size:0.72rem; text-transform:uppercase; font-weight:600; color:#94A3B8; margin-bottom:4px;">Profession ciblée :</label>
                                    <select id="modal-autopilot-industry" style="width:100%; background:#090B0F; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:7px 10px; font-size:0.82rem; color:#CBD5E1; outline:none;" onchange="window.handleModalAutopilotIndustryChange(this.value)">
                                        ${buildIndustryOptionsHtml(targetIndustry)}
                                    </select>
                                </div>

                                <div class="form-group" id="modal-autopilot-custom-industry-group" style="margin:0; display:${targetIndustry === 'CUSTOM' ? 'block' : 'none'};">
                                    <label style="display:block; font-size:0.72rem; text-transform:uppercase; font-weight:600; color:#94A3B8; margin-bottom:4px;">Métier personnalisé :</label>
                                    <input type="text" id="modal-autopilot-custom-industry" value="${escapeHtml(customIndustry)}" placeholder="Ex: Serrurier, Peintre, Traiteur..." style="width:100%; background:#090B0F; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:7px 10px; font-size:0.82rem; color:#CBD5E1; outline:none;">
                                </div>
                            </div>
                        </div>

                        <!-- Pipeline & Alert Strip -->
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:12px 16px; border-radius:8px; margin-top:16px;">
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                                <input type="checkbox" id="modal-autopilot-pipeline" ${cfg.autoAuditAndSequence !== false ? 'checked' : ''} style="accent-color:var(--gold); width:16px; height:16px;">
                                <span style="font-size:0.82rem; font-weight:600; color:#F8FAFC;">
                                    Audit IA + Attribution automatique de séquence
                                </span>
                            </label>

                            <div style="display:flex; align-items:center; gap:8px;">
                                <input type="checkbox" id="modal-autopilot-alerts" ${cfg.adminAlertsEnabled !== false ? 'checked' : ''} style="display:none;">
                                <span style="font-size:0.8rem; color:#94A3B8; display:flex; align-items:center; gap:6px;">
                                    ${SEQ_SVGS.bell} Alertes SMS :
                                    <a href="javascript:void(0)" onclick="window.switchSequenceTab('settings')" style="color:var(--gold); text-decoration:none; font-weight:600;">
                                        Gérer dans l'onglet Notifications ↗
                                    </a>
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Cockpit Controls (Directly below Configuration, No Title, No Total leads) -->
                    <div style="background:#12151B; border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:16px 20px; box-shadow:0 4px 20px rgba(0,0,0,0.2);">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
                            <!-- Toggle Switch Box -->
                            <div style="display:flex; align-items:center; gap:14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); padding:8px 16px; border-radius:10px; flex:1; min-width:240px;">
                                <label class="ai-toggle-switch" style="position:relative; display:inline-block; width:44px; height:22px; margin:0; flex-shrink:0;">
                                    <input type="checkbox" id="modal-autopilot-toggle" ${isAct ? 'checked' : ''} onchange="window.handleModalAutopilotToggle(this)">
                                    <span class="ai-slider" style="border-radius:22px;"></span>
                                </label>
                                <div>
                                    <div id="modal-autopilot-toggle-label" style="font-size:0.86rem; font-weight:600; color:${isAct ? '#10B981' : '#F59E0B'};">
                                        ${isAct ? 'Recherche Activée' : 'Recherche en Pause'}
                                    </div>
                                    <div style="font-size:0.72rem; color:#64748B;">Exécution automatique selon cycle</div>
                                </div>
                                <span id="modal-autopilot-badge" style="display:none;"></span>
                            </div>

                            <!-- Action Buttons -->
                            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                                <button type="button" id="btn-modal-run-autopilot-now" class="lead-action-btn primary" onclick="window.runModalHunterAutopilotNow()" style="padding:10px 18px; font-size:0.86rem; font-weight:700; background:linear-gradient(135deg, rgba(223,165,58,0.25), rgba(223,165,58,0.1)); border-color:var(--gold); color:var(--gold); display:inline-flex; align-items:center; gap:8px;">
                                    ${SEQ_SVGS.send} Lancer un cycle immédiat
                                </button>
                                <button type="button" class="lead-action-btn" onclick="window.saveModalHunterAutopilotConfig()" style="padding:10px 18px; font-size:0.84rem; font-weight:600; display:inline-flex; align-items:center; gap:8px;">
                                    ${SEQ_SVGS.save} Enregistrer les paramètres
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- RIGHT COLUMN: Target Markets & Professions Reference Card -->
                <div style="display:flex; flex-direction:column; gap:16px;">
                    <div style="background:#12151B; border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:18px 20px; box-shadow:0 4px 20px rgba(0,0,0,0.2);">
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                            ${SEQ_SVGS.globe}
                            <span style="font-size:0.82rem; font-weight:700; color:#F8FAFC;">Métropoles en Rotation</span>
                        </div>
                        <div style="font-size:0.75rem; color:#64748B; line-height:1.5; margin-bottom:14px;">
                            🇨🇦 <strong style="color:#CBD5E1;">Canada :</strong> Montréal, Toronto, Vancouver, Calgary, Ottawa, Québec, Moncton, Halifax.<br>
                            🇺🇸 <strong style="color:#CBD5E1;">USA :</strong> Tampa, Miami, Orlando, Atlanta, Houston, Dallas, Chicago, Phoenix, New York.
                        </div>

                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                            ${SEQ_SVGS.bot}
                            <span style="font-size:0.82rem; font-weight:700; color:#F8FAFC;">Secteurs Prioritaires</span>
                        </div>
                        <div style="font-size:0.75rem; color:#64748B; line-height:1.5;">
                            🔧 <strong style="color:#CBD5E1;">Bâtiment :</strong> Plombiers, Électriciens, HVAC, Couvreurs.<br>
                            🩺 <strong style="color:#CBD5E1;">Services :</strong> Dentistes, Spas, Cliniques, Avocats.
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        body.innerHTML = `<div class="text-danger" style="text-align:center; padding:2rem;">Erreur : ${e.message}</div>`;
    }
}

window.handleModalAutopilotToggle = (input) => {
    const isChecked = input.checked;
    const label = document.getElementById('modal-autopilot-toggle-label');
    const badge = document.getElementById('modal-autopilot-badge');

    if (label) {
        label.textContent = isChecked ? 'Recherche Activée' : 'Recherche en Pause';
        label.style.color = isChecked ? '#21BA45' : '#F2C037';
    }

    if (badge) {
        badge.innerHTML = isChecked ? '🟢 ACTIF' : '🟡 EN PAUSE';
        badge.style.background = isChecked ? 'rgba(33,186,69,0.18)' : 'rgba(242,192,55,0.18)';
        badge.style.color = isChecked ? '#21BA45' : '#F2C037';
        badge.style.borderColor = isChecked ? 'rgba(33,186,69,0.4)' : 'rgba(242,192,55,0.4)';
    }
};

window.handleModalAutopilotCountryChange = (country) => {
    const regionSelect = document.getElementById('modal-autopilot-region');
    if (regionSelect) {
        regionSelect.innerHTML = buildRegionOptionsHtml(country, 'ALL');
    }
};

window.handleModalAutopilotIndustryChange = (val) => {
    const customGroup = document.getElementById('modal-autopilot-custom-industry-group');
    if (customGroup) {
        customGroup.style.display = val === 'CUSTOM' ? 'block' : 'none';
        if (val === 'CUSTOM') {
            document.getElementById('modal-autopilot-custom-industry')?.focus();
        }
    }
};

window.saveModalHunterAutopilotConfig = async () => {
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const isActive = document.getElementById('modal-autopilot-toggle')?.checked;
        const frequencyHours = parseInt(document.getElementById('modal-autopilot-freq')?.value, 10) || 6;
        const leadsPerBatch = parseInt(document.getElementById('modal-autopilot-batch')?.value, 10) || 10;
        const websiteFilter = document.getElementById('modal-autopilot-filter')?.value || 'NO_WEBSITE';
        const autoAuditAndSequence = document.getElementById('modal-autopilot-pipeline')?.checked;
        const adminAlertsEnabled = document.getElementById('modal-autopilot-alerts')?.checked;
        const apiKey = document.getElementById('modal-autopilot-api-key')?.value.trim() || localStorage.getItem('erp_google_places_key') || '';

        const targetCountry = document.getElementById('modal-autopilot-country')?.value || 'CA';
        const targetRegion = document.getElementById('modal-autopilot-region')?.value || 'ALL';
        const targetIndustry = document.getElementById('modal-autopilot-industry')?.value || 'ALL';
        const customIndustry = document.getElementById('modal-autopilot-custom-industry')?.value.trim() || '';

        if (apiKey) {
            localStorage.setItem('erp_google_places_key', apiKey);
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
            window.showToast(
                isActive
                    ? "🟢 Recherche ACTIVÉE : Le Lead Hunter tourne automatiquement en arrière-plan."
                    : "🟡 Recherche EN PAUSE : Les recherches automatiques sont suspendues.",
                isActive ? "success" : "info"
            );
        } else {
            throw new Error(data.error || "Erreur de sauvegarde");
        }
    } catch (e) {
        window.showToast(`Erreur : ${e.message}`, "error");
    }
};

window.runModalHunterAutopilotNow = async () => {
    const runBtn = document.getElementById('btn-modal-run-autopilot-now');
    if (runBtn) {
        runBtn.disabled = true;
        runBtn.innerHTML = `<span class="material-icons rotating" style="font-size:16px;">refresh</span> Chasse en cours...`;
    }

    try {
        window.showToast("⚡ Lancement du cycle Auto-Pilot en arrière-plan...", "info");
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');

        const targetCountry = document.getElementById('modal-autopilot-country')?.value || 'CA';
        const targetRegion = document.getElementById('modal-autopilot-region')?.value || 'ALL';
        const targetIndustry = document.getElementById('modal-autopilot-industry')?.value || 'ALL';
        const customIndustry = document.getElementById('modal-autopilot-custom-industry')?.value.trim() || '';

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
            const infoEl = document.getElementById('modal-autopilot-last-run-info');
            if (infoEl) {
                infoEl.textContent = `Dernier cycle : À l'instant • ${data.leadsAdded} leads pour "${data.query || ''}"`;
            }
        } else {
            throw new Error(data.message || data.error || "Erreur pendant le cycle");
        }
    } catch (e) {
        window.showToast(`Erreur : ${e.message}`, "error");
    } finally {
        if (runBtn) {
            runBtn.disabled = false;
            runBtn.innerHTML = `<span class="material-icons" style="font-size:16px;">bolt</span> Lancer un cycle immédiat`;
        }
    }
};

/**
 * Tab 2: Render Live Sequence Instances Monitoring & Simulation Logs
 */
async function renderSequencesInstancesTab() {
    const body = document.getElementById('sequence-modal-body');
    if (!body) return;

    body.innerHTML = `
        <div style="text-align:center; padding:2rem; color:var(--text-muted);">
            <span class="material-icons rotating" style="font-size:24px; color:var(--gold);">refresh</span>
            <div style="margin-top:8px;">Chargement des instances de séquences...</div>
        </div>
    `;

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sequences/instances`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        const instances = data.instances || [];

        if (instances.length === 0) {
            body.innerHTML = `
                <div style="text-align:center; padding:3rem; color:var(--text-muted);">
                    <span class="material-icons" style="font-size:36px; opacity:0.3;">checklist</span>
                    <div style="font-size:1rem; font-weight:700; margin-top:8px;">Aucune séquence en cours d'exécution</div>
                    <div class="text-xs text-muted" style="margin-top:4px;">
                        Lancez le Lead Hunter ou déclenchez manuellement une séquence depuis une fiche lead pour observer les étapes ici.
                    </div>
                </div>
            `;
            return;
        }

        body.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <div class="text-xs text-muted">
                    Surveillance en direct des étapes programmées, du calcul des fuseaux horaires locaux et des envois simulés.
                </div>
                <button class="btn btn-xs btn-secondary" onclick="window.switchSequenceTab('instances')" style="display:flex; align-items:center; gap:4px;">
                    <span class="material-icons" style="font-size:14px;">refresh</span> Actualiser
                </button>
            </div>

            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:left;">
                    <thead>
                        <tr style="border-bottom:1px solid var(--border); color:var(--text-muted); font-size:0.75rem; text-transform:uppercase;">
                            <th style="padding:10px 12px;">Lead / Contact</th>
                            <th style="padding:10px 12px;">Séquence & Étape</th>
                            <th style="padding:10px 12px;">Fuseau Horaire</th>
                            <th style="padding:10px 12px;">Mode</th>
                            <th style="padding:10px 12px;">Prochaine Échéance</th>
                            <th style="padding:10px 12px;">Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${instances.map(inst => {
                            const isDry = inst.dryRun;
                            const isStopped = inst.status === 'STOPPED_REPLIED';
                            const isCompleted = inst.status === 'COMPLETED';

                            let statusBadge = `<span class="badge" style="background:rgba(33,186,69,0.15); color:#21BA45; border:1px solid rgba(33,186,69,0.3); padding:2px 8px; border-radius:10px; font-size:11px;">🟢 Active</span>`;
                            if (isStopped) {
                                statusBadge = `<span class="badge" style="background:rgba(49,204,236,0.15); color:#31CCEC; border:1px solid rgba(49,204,236,0.3); padding:2px 8px; border-radius:10px; font-size:11px;">✋ Répondu (Stoppé)</span>`;
                            } else if (isCompleted) {
                                statusBadge = `<span class="badge" style="background:rgba(255,255,255,0.08); color:var(--text-muted); border:1px solid var(--border); padding:2px 8px; border-radius:10px; font-size:11px;">✓ Terminée</span>`;
                            }

                            const nextStep = inst.steps ? inst.steps[inst.currentStep - 1] : null;
                            const nextDueStr = nextStep ? new Date(nextStep.scheduledFor).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

                            return `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                                <td style="padding:10px 12px;">
                                    <div style="font-weight:700; color:var(--text-main);">${escapeHtml(inst.leadName || inst.companyName || 'Lead')}</div>
                                    <div class="text-xs text-muted">${escapeHtml(inst.phone)}</div>
                                </td>
                                <td style="padding:10px 12px;">
                                    <div style="color:var(--gold); font-weight:600;">${escapeHtml(inst.sequenceName)}</div>
                                    <div class="text-xs text-muted">Étape ${inst.currentStep} sur ${inst.totalSteps}</div>
                                </td>
                                <td style="padding:10px 12px;">
                                    <span style="background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; font-size:11px; font-family:monospace;">
                                        ${escapeHtml(inst.timezone || 'America/Toronto')}
                                    </span>
                                </td>
                                <td style="padding:10px 12px;">
                                    ${isDry 
                                        ? `<span class="badge" style="background:rgba(242,192,55,0.15); color:#F2C037; border:1px solid rgba(242,192,55,0.3); padding:2px 6px; border-radius:8px; font-size:10px;">🟡 SIMULÉ</span>`
                                        : `<span class="badge" style="background:rgba(33,186,69,0.15); color:#21BA45; border:1px solid rgba(33,186,69,0.3); padding:2px 6px; border-radius:8px; font-size:10px;">🟢 RÉEL</span>`
                                    }
                                </td>
                                <td style="padding:10px 12px; font-size:0.8rem; color:var(--text-main);">
                                    ${nextDueStr}
                                </td>
                                <td style="padding:10px 12px;">
                                    ${statusBadge}
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (e) {
        body.innerHTML = `<div class="text-danger" style="text-align:center; padding:2rem;">Erreur : ${e.message}</div>`;
    }
}

/**
 * Tab 3: Render Admin Alert & Timezone Settings
 */
async function renderSequencesSettingsTab() {
    const body = document.getElementById('sequence-modal-body');
    if (!body) return;

    let googleStatus = { connected: false, email: null };
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/integrations/google/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const gData = await resp.json();
        if (gData.success) {
            googleStatus = gData;
        }
    } catch (_) {}

    const isGoogleConnected = googleStatus.connected === true;
    const googleEmail = googleStatus.email || '';

    body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:16px; width:100%;">
            
            <!-- Top Row: Admin SMS Channel + Event Triggers Matrix -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(380px, 1fr)); gap:16px;">
                
                <!-- Card 1: Coordonnées & Canaux de Réception des Alertes (SMS & Courriel) -->
                <div style="background:#12151B; border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:20px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 4px 20px rgba(0,0,0,0.2);">
                    <div>
                        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                            <div style="width:38px; height:38px; border-radius:10px; background:rgba(223,165,58,0.12); border:1px solid rgba(223,165,58,0.3); display:flex; align-items:center; justify-content:center; color:var(--gold); flex-shrink:0;">
                                ${SEQ_SVGS.bell}
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:1.05rem; font-weight:700; color:#F8FAFC;">Canaux de Réception des Alertes</h4>
                                <div class="text-xs text-muted" style="margin-top:2px; font-size:0.78rem; color:#64748B;">
                                    Réception immédiate des alertes critiques en temps réel par SMS et/ou Courriel.
                                </div>
                            </div>
                        </div>

                        <!-- Section A: Canal SMS Direct -->
                        <div style="background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.05); padding:12px 14px; border-radius:10px; margin-bottom:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <label style="font-size:0.74rem; text-transform:uppercase; font-weight:700; color:#94A3B8; display:flex; align-items:center; gap:6px;">
                                    📱 Canal SMS Direct (Cellulaire Admin) :
                                </label>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span id="badge-master-alerts" style="font-size:0.68rem; font-weight:700; color:${sequenceSettings.adminAlertsEnabled !== false ? '#10B981' : '#64748B'}; background:${sequenceSettings.adminAlertsEnabled !== false ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)'}; border:1px solid ${sequenceSettings.adminAlertsEnabled !== false ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}; padding:2px 6px; border-radius:4px; text-transform:uppercase;">
                                        ${sequenceSettings.adminAlertsEnabled !== false ? 'Actif' : 'Désactivé'}
                                    </span>
                                    <label class="ai-toggle-switch" style="position:relative; display:inline-block; width:44px; height:22px; margin:0;" title="Activer / Désactiver le canal SMS">
                                        <input type="checkbox" id="cfg-admin-enabled" ${sequenceSettings.adminAlertsEnabled !== false ? 'checked' : ''} onchange="window.handleMasterAlertsToggle(this.checked)">
                                        <span class="ai-slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div style="display:flex; gap:8px;">
                                <input type="tel" id="cfg-admin-phone" value="${escapeHtml(sequenceSettings.adminAlertPhone || '+15062337006')}" placeholder="+15062337006" style="flex:1; background:#090B0F; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:7px 11px; font-size:0.88rem; color:#CBD5E1; outline:none; font-family:monospace;">
                                <button class="lead-action-btn" onclick="window.testAdminAlertSms()" style="font-size:0.78rem; padding:7px 12px; white-space:nowrap; display:inline-flex; align-items:center; gap:5px;">
                                    ${SEQ_SVGS.send} Tester SMS
                                </button>
                            </div>
                        </div>

                        <!-- Section B: Canal Courriel Direct -->
                        <div style="background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.05); padding:12px 14px; border-radius:10px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <label style="font-size:0.74rem; text-transform:uppercase; font-weight:700; color:#94A3B8; display:flex; align-items:center; gap:6px;">
                                    ✉️ Canal Courriel Direct (Email Admin) :
                                </label>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span id="badge-master-email-alerts" style="font-size:0.68rem; font-weight:700; color:${sequenceSettings.adminEmailAlertsEnabled !== false ? '#10B981' : '#64748B'}; background:${sequenceSettings.adminEmailAlertsEnabled !== false ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)'}; border:1px solid ${sequenceSettings.adminEmailAlertsEnabled !== false ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}; padding:2px 6px; border-radius:4px; text-transform:uppercase;">
                                        ${sequenceSettings.adminEmailAlertsEnabled !== false ? 'Actif' : 'Désactivé'}
                                    </span>
                                    <label class="ai-toggle-switch" style="position:relative; display:inline-block; width:44px; height:22px; margin:0;" title="Activer / Désactiver le canal Courriel">
                                        <input type="checkbox" id="cfg-admin-email-enabled" ${sequenceSettings.adminEmailAlertsEnabled !== false ? 'checked' : ''} onchange="window.handleMasterEmailAlertsToggle(this.checked)">
                                        <span class="ai-slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div style="display:flex; gap:8px;">
                                <input type="email" id="cfg-admin-email" value="${escapeHtml(sequenceSettings.adminAlertEmail || 'benjamin@solutionsquasar.ca')}" placeholder="benjamin@solutionsquasar.ca" style="flex:1; background:#090B0F; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:7px 11px; font-size:0.88rem; color:#CBD5E1; outline:none;">
                                <button class="lead-action-btn" onclick="window.testAdminAlertEmail()" style="font-size:0.78rem; padding:7px 12px; white-space:nowrap; display:inline-flex; align-items:center; gap:5px;">
                                    ${SEQ_SVGS.send} Tester Courriel
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style="margin-top:16px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.05); display:flex; justify-content:flex-end;">
                        <button class="lead-action-btn primary" onclick="window.saveAdminSettings()" style="background:rgba(223,165,58,0.15); border-color:var(--gold); color:var(--gold); font-weight:700; padding:9px 18px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px;">
                            ${SEQ_SVGS.save} Enregistrer les canaux
                        </button>
                    </div>
                </div>

                <!-- Card 2: Matrice des Événements Déclencheurs -->
                <div style="background:#12151B; border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:20px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 4px 20px rgba(0,0,0,0.2);">
                    <div>
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
                            <div style="width:38px; height:38px; border-radius:10px; background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.3); display:flex; align-items:center; justify-content:center; color:#38BDF8; flex-shrink:0;">
                                ${SEQ_SVGS.sparkles}
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:1.05rem; font-weight:700; color:#F8FAFC;">Événements Déclencheurs d'Alertes</h4>
                                <div class="text-xs text-muted" style="margin-top:2px; font-size:0.78rem; color:#64748B;">
                                    Chaque événement envoie un SMS formaté avec lien direct vers l'ERP.
                                </div>
                            </div>
                        </div>

                        <!-- Triggers List with Individual Toggles -->
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            <!-- Trigger 1: Réponse d'un Prospect -->
                            <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:10px 14px; border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <span style="font-size:1.25rem;">🚨</span>
                                    <div>
                                        <div style="font-size:0.86rem; font-weight:600; color:#F8FAFC;">Réponse d'un Prospect (Priorité Haute)</div>
                                        <div style="font-size:0.73rem; color:#64748B;">Extrait du SMS et lien direct pour reprise humaine</div>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <span id="badge-notify-reply" style="font-size:0.72rem; font-weight:700; color:${sequenceSettings.notifyOnReply !== false ? '#10B981' : '#64748B'}; background:${sequenceSettings.notifyOnReply !== false ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)'}; border:1px solid ${sequenceSettings.notifyOnReply !== false ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}; padding:2px 8px; border-radius:4px; text-transform:uppercase;">
                                        ${sequenceSettings.notifyOnReply !== false ? 'Actif' : 'Désactivé'}
                                    </span>
                                    <label class="ai-toggle-switch" style="position:relative; display:inline-block; width:44px; height:22px; margin:0; flex-shrink:0;" title="Activer / Désactiver cette alerte">
                                        <input type="checkbox" id="cfg-notify-reply" ${sequenceSettings.notifyOnReply !== false ? 'checked' : ''} onchange="window.handleNotificationTriggerToggle('notifyOnReply', this.checked)">
                                        <span class="ai-slider"></span>
                                    </label>
                                </div>
                            </div>

                            <!-- Trigger 2: Rendez-vous Réservé -->
                            <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:10px 14px; border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <span style="font-size:1.25rem;">📅</span>
                                    <div>
                                        <div style="font-size:0.86rem; font-weight:600; color:#F8FAFC;">Rendez-vous Réservé (Google Calendar)</div>
                                        <div style="font-size:0.73rem; color:#64748B;">Appel découverte booké par le bot SMS ou l'agent Vapi</div>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <span id="badge-notify-booking" style="font-size:0.72rem; font-weight:700; color:${sequenceSettings.notifyOnBooking !== false ? '#10B981' : '#64748B'}; background:${sequenceSettings.notifyOnBooking !== false ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)'}; border:1px solid ${sequenceSettings.notifyOnBooking !== false ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}; padding:2px 8px; border-radius:4px; text-transform:uppercase;">
                                        ${sequenceSettings.notifyOnBooking !== false ? 'Actif' : 'Désactivé'}
                                    </span>
                                    <label class="ai-toggle-switch" style="position:relative; display:inline-block; width:44px; height:22px; margin:0; flex-shrink:0;" title="Activer / Désactiver cette alerte">
                                        <input type="checkbox" id="cfg-notify-booking" ${sequenceSettings.notifyOnBooking !== false ? 'checked' : ''} onchange="window.handleNotificationTriggerToggle('notifyOnBooking', this.checked)">
                                        <span class="ai-slider"></span>
                                    </label>
                                </div>
                            </div>

                            <!-- Trigger 3: Rapport Lead Hunter -->
                            <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:10px 14px; border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <span style="font-size:1.25rem;">🎯</span>
                                    <div>
                                        <div style="font-size:0.86rem; font-weight:600; color:#F8FAFC;">Rapport de Cycle Lead Hunter</div>
                                        <div style="font-size:0.73rem; color:#64748B;">Nouveaux commerces chassés sur Google Maps</div>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <span id="badge-notify-hunter" style="font-size:0.72rem; font-weight:700; color:${sequenceSettings.notifyOnHunterBatch !== false ? '#10B981' : '#64748B'}; background:${sequenceSettings.notifyOnHunterBatch !== false ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)'}; border:1px solid ${sequenceSettings.notifyOnHunterBatch !== false ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}; padding:2px 8px; border-radius:4px; text-transform:uppercase;">
                                        ${sequenceSettings.notifyOnHunterBatch !== false ? 'Actif' : 'Désactivé'}
                                    </span>
                                    <label class="ai-toggle-switch" style="position:relative; display:inline-block; width:44px; height:22px; margin:0; flex-shrink:0;" title="Activer / Désactiver cette alerte">
                                        <input type="checkbox" id="cfg-notify-hunter" ${sequenceSettings.notifyOnHunterBatch !== false ? 'checked' : ''} onchange="window.handleNotificationTriggerToggle('notifyOnHunterBatch', this.checked)">
                                        <span class="ai-slider"></span>
                                    </label>
                                </div>
                            </div>

                            <!-- Trigger 4: Note d'Appel Vocal Vapi -->
                            <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:10px 14px; border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <span style="font-size:1.25rem;">📞</span>
                                    <div>
                                        <div style="font-size:0.86rem; font-weight:600; color:#F8FAFC;">Note d'Appel Vocal (Assistant Vapi)</div>
                                        <div style="font-size:0.73rem; color:#64748B;">Rapport de fin d'appel avec coordonnées et besoins du lead</div>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <span id="badge-notify-vapi" style="font-size:0.72rem; font-weight:700; color:${sequenceSettings.notifyOnVapiCall !== false ? '#10B981' : '#64748B'}; background:${sequenceSettings.notifyOnVapiCall !== false ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)'}; border:1px solid ${sequenceSettings.notifyOnVapiCall !== false ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}; padding:2px 8px; border-radius:4px; text-transform:uppercase;">
                                        ${sequenceSettings.notifyOnVapiCall !== false ? 'Actif' : 'Désactivé'}
                                    </span>
                                    <label class="ai-toggle-switch" style="position:relative; display:inline-block; width:44px; height:22px; margin:0; flex-shrink:0;" title="Activer / Désactiver cette alerte">
                                        <input type="checkbox" id="cfg-notify-vapi" ${sequenceSettings.notifyOnVapiCall !== false ? 'checked' : ''} onchange="window.handleNotificationTriggerToggle('notifyOnVapiCall', this.checked)">
                                        <span class="ai-slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Card 3: Google Calendar Sync & Triple Rappel RDV (Full Width) -->
            <div style="background:#12151B; border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:20px; box-shadow:0 4px 20px rgba(0,0,0,0.2);">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:38px; height:38px; border-radius:10px; background:${isGoogleConnected ? 'rgba(16,185,129,0.12)' : 'rgba(223,165,58,0.12)'}; border:1px solid ${isGoogleConnected ? 'rgba(16,185,129,0.3)' : 'rgba(223,165,58,0.3)'}; display:flex; align-items:center; justify-content:center; color:${isGoogleConnected ? '#10B981' : 'var(--gold)'}; flex-shrink:0;">
                            ${isGoogleConnected ? SEQ_SVGS.check : SEQ_SVGS.clock}
                        </div>
                        <div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <h4 style="margin:0; font-size:1.05rem; font-weight:700; color:#F8FAFC;">Google Calendar Sync & Triple Rappel RDV</h4>
                                <span style="font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:4px; background:${isGoogleConnected ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)'}; color:${isGoogleConnected ? '#10B981' : '#F59E0B'}; border:1px solid ${isGoogleConnected ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'};">
                                    ${isGoogleConnected ? `✓ Connecté (${googleEmail || 'Google Agenda'})` : 'En attente de connexion'}
                                </span>
                            </div>
                            <div class="text-xs text-muted" style="margin-top:2px; font-size:0.78rem; color:#64748B;">
                                Synchronisation automatique de vos rendez-vous avec Google Agenda sur votre smartphone + rappels SMS.
                            </div>
                        </div>
                    </div>

                    <div>
                        ${isGoogleConnected ? `
                            <button type="button" class="lead-action-btn" onclick="window.disconnectGoogleCalendar()" style="color:#EF4444; border-color:rgba(239,68,68,0.3); font-size:0.8rem; padding:8px 14px;">
                                Déconnecter
                            </button>
                        ` : `
                            <button type="button" class="lead-action-btn primary" onclick="window.connectGoogleCalendar()" style="background:rgba(223,165,58,0.15); border-color:var(--gold); color:var(--gold); font-weight:700; font-size:0.84rem; display:flex; align-items:center; gap:6px; padding:8px 16px;">
                                <span>📅</span> Connecter mon Google Agenda
                            </button>
                        `}
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:10px; margin-bottom:12px;">
                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:12px 14px;">
                        <div style="font-size:0.82rem; font-weight:600; color:var(--gold);">1. Rappel J-24h</div>
                        <div style="font-size:0.74rem; color:#64748B; margin-top:3px;">Confirmation d'horaire et préparation de la session découverte.</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:12px 14px;">
                        <div style="font-size:0.82rem; font-weight:600; color:var(--gold);">2. Rappel H-1h</div>
                        <div style="font-size:0.74rem; color:#64748B; margin-top:3px;">Rappel de courtoisie 60 minutes avant l'appel.</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:12px 14px;">
                        <div style="font-size:0.82rem; font-weight:600; color:var(--gold);">3. Rappel H-0 (Meet)</div>
                        <div style="font-size:0.74rem; color:#64748B; margin-top:3px;">Envoi automatique du lien direct Google Meet à l'heure du RDV.</div>
                    </div>
                </div>

                <div style="font-size:0.78rem; color:#94A3B8; background:rgba(223,165,58,0.06); padding:10px 14px; border-radius:8px; border:1px solid rgba(223,165,58,0.15); display:flex; align-items:center; gap:8px;">
                    ${SEQ_SVGS.shield}
                    <span>Dès qu'un prospect prend rendez-vous, l'événement est synchronisé avec Google Calendar et une alerte instantanée est envoyée à l'administrateur (+1 506 233-7006).</span>
                </div>
            </div>

            <!-- Card 4: Règles de Fuseaux Horaires (Canada & USA) -->
            <div style="background:#12151B; border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:20px; box-shadow:0 4px 20px rgba(0,0,0,0.2);">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                    <div style="width:38px; height:38px; border-radius:10px; background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.3); display:flex; align-items:center; justify-content:center; color:#38BDF8; flex-shrink:0;">
                        ${SEQ_SVGS.clock}
                    </div>
                    <div>
                        <h4 style="margin:0; font-size:1.05rem; font-weight:700; color:#F8FAFC;">Règles de Fuseaux Horaires (Canada & USA)</h4>
                        <div class="text-xs text-muted" style="margin-top:2px; font-size:0.78rem; color:#64748B;">
                            Résolution multi-signaux : Code Postal Canadien (FSA), ZIP Code US et indicatif régional.
                        </div>
                    </div>
                </div>

                <div style="line-height:1.6; background:rgba(255,255,255,0.02); padding:14px; border-radius:8px; border:1px solid rgba(255,255,255,0.04); font-size:0.82rem; color:#94A3B8;">
                    <div style="margin-bottom:6px;"><strong style="color:#CBD5E1;">Plage autorisée :</strong> Envois exclusivement entre <strong style="color:#CBD5E1;">09h00 et 18h00</strong> dans le fuseau local du prospect (du lundi au vendredi).</div>
                    <div style="margin-bottom:6px;"><strong style="color:#CBD5E1;">Protection Nuit & Week-end :</strong> Décalage automatique au prochain jour ouvrable à <strong style="color:#CBD5E1;">10h15 locale</strong>.</div>
                    <div><strong style="color:#CBD5E1;">Couverture complète :</strong> Eastern, Central, Mountain, Pacific, Alaska et Hawaï supportés avec respect strict des normes antipollution / TCPA.</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Action: Save Sequence Settings
 */
async function handleSaveSettings(newSettings) {
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sequences/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(newSettings)
        });
        const data = await resp.json();
        if (data.success) {
            sequenceSettings = { ...sequenceSettings, ...newSettings };
        }
    } catch (e) {
        console.error("Save settings error:", e);
    }
}

window.handleMasterAlertsToggle = async (isChecked) => {
    sequenceSettings.adminAlertsEnabled = isChecked;

    const badgeEl = document.getElementById('badge-master-alerts');
    if (badgeEl) {
        badgeEl.textContent = isChecked ? 'Actif' : 'Désactivé';
        badgeEl.style.color = isChecked ? '#10B981' : '#64748B';
        badgeEl.style.background = isChecked ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)';
        badgeEl.style.borderColor = isChecked ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)';
    }

    try {
        await handleSaveSettings({
            adminAlertsEnabled: isChecked
        });

        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        await fetch(`${API_BASE}/api/hunter/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                adminAlertsEnabled: isChecked
            })
        }).catch(() => {});

        window.showToast?.(
            isChecked ? "Canal SMS Direct activé !" : "Canal SMS Direct désactivé (alertes en pause)",
            isChecked ? "success" : "info"
        );
    } catch (err) {
        console.error("[Notifications] Master alert toggle error:", err);
        window.showToast?.("Erreur lors de la mise à jour du canal SMS", "error");
    }
};

window.handleMasterEmailAlertsToggle = async (isChecked) => {
    sequenceSettings.adminEmailAlertsEnabled = isChecked;

    const badgeEl = document.getElementById('badge-master-email-alerts');
    if (badgeEl) {
        badgeEl.textContent = isChecked ? 'Actif' : 'Désactivé';
        badgeEl.style.color = isChecked ? '#10B981' : '#64748B';
        badgeEl.style.background = isChecked ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)';
        badgeEl.style.borderColor = isChecked ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)';
    }

    try {
        await handleSaveSettings({
            adminEmailAlertsEnabled: isChecked
        });

        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        await fetch(`${API_BASE}/api/hunter/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                adminEmailAlertsEnabled: isChecked
            })
        }).catch(() => {});

        window.showToast?.(
            isChecked ? "Canal Courriel Direct activé !" : "Canal Courriel Direct désactivé (alertes courriel en pause)",
            isChecked ? "success" : "info"
        );
    } catch (err) {
        console.error("[Notifications] Master email alert toggle error:", err);
        window.showToast?.("Erreur lors de la mise à jour du canal Courriel", "error");
    }
};

window.handleNotificationTriggerToggle = async (triggerKey, isChecked) => {
    sequenceSettings[triggerKey] = isChecked;

    const badgeMap = {
        notifyOnReply: 'badge-notify-reply',
        notifyOnBooking: 'badge-notify-booking',
        notifyOnHunterBatch: 'badge-notify-hunter',
        notifyOnVapiCall: 'badge-notify-vapi'
    };
    const badgeId = badgeMap[triggerKey];
    if (badgeId) {
        const badgeEl = document.getElementById(badgeId);
        if (badgeEl) {
            badgeEl.textContent = isChecked ? 'Actif' : 'Désactivé';
            badgeEl.style.color = isChecked ? '#10B981' : '#64748B';
            badgeEl.style.background = isChecked ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)';
            badgeEl.style.borderColor = isChecked ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)';
        }
    }

    try {
        await handleSaveSettings({
            [triggerKey]: isChecked
        });

        if (triggerKey === 'notifyOnHunterBatch') {
            const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
            await fetch(`${API_BASE}/api/hunter/config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    notifyOnHunterBatch: isChecked
                })
            }).catch(() => {});
        }

        const labels = {
            notifyOnReply: "Alerte Réponse Prospect",
            notifyOnBooking: "Alerte Rendez-vous Réservé",
            notifyOnHunterBatch: "Rapport Cycle Lead Hunter",
            notifyOnVapiCall: "Note d'Appel Vocal Vapi"
        };
        const title = labels[triggerKey] || "Notification";
        const stateStr = isChecked ? "activée" : "désactivée";
        window.showToast?.(`${title} ${stateStr} avec succès`, isChecked ? "success" : "info");
    } catch (err) {
        console.error("[Notifications] Erreur de bascule du déclencheur:", err);
        window.showToast?.("Erreur lors de l'enregistrement de l'alerte", "error");
    }
};

window.saveAdminSettings = async () => {
    const phone = document.getElementById('cfg-admin-phone')?.value.trim();
    const enabled = document.getElementById('cfg-admin-enabled')?.checked;
    const email = document.getElementById('cfg-admin-email')?.value.trim();
    const emailEnabled = document.getElementById('cfg-admin-email-enabled')?.checked;
    const notifyOnReply = document.getElementById('cfg-notify-reply')?.checked;
    const notifyOnBooking = document.getElementById('cfg-notify-booking')?.checked;
    const notifyOnHunterBatch = document.getElementById('cfg-notify-hunter')?.checked;
    const notifyOnVapiCall = document.getElementById('cfg-notify-vapi')?.checked;

    const payload = {
        adminAlertPhone: phone || '+15062337006',
        adminAlertsEnabled: Boolean(enabled),
        adminAlertEmail: email || 'benjamin@solutionsquasar.ca',
        adminEmailAlertsEnabled: Boolean(emailEnabled)
    };
    if (notifyOnReply !== undefined) payload.notifyOnReply = Boolean(notifyOnReply);
    if (notifyOnBooking !== undefined) payload.notifyOnBooking = Boolean(notifyOnBooking);
    if (notifyOnHunterBatch !== undefined) payload.notifyOnHunterBatch = Boolean(notifyOnHunterBatch);
    if (notifyOnVapiCall !== undefined) payload.notifyOnVapiCall = Boolean(notifyOnVapiCall);

    await handleSaveSettings(payload);

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        await fetch(`${API_BASE}/api/hunter/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                adminAlertPhone: phone || '+15062337006',
                adminAlertsEnabled: Boolean(enabled),
                adminAlertEmail: email || 'benjamin@solutionsquasar.ca',
                adminEmailAlertsEnabled: Boolean(emailEnabled),
                ...(notifyOnHunterBatch !== undefined ? { notifyOnHunterBatch: Boolean(notifyOnHunterBatch) } : {})
            })
        });
    } catch (_) {}

    window.showToast("Paramètres des canaux d'alertes enregistrés avec succès !", "success");
};

window.connectGoogleCalendar = async () => {
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/integrations/google/auth-url?projectId=master_admin`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error(data.error || "Impossible de générer le lien de connexion Google.");
        }
    } catch (e) {
        window.showToast?.(`Erreur Google Auth : ${e.message}`, "error");
    }
};

window.disconnectGoogleCalendar = async () => {
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/integrations/google/disconnect`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.success) {
            window.showToast?.("Google Calendar déconnecté avec succès.", "info");
            renderSequencesSettingsTab();
        }
    } catch (e) {
        window.showToast?.(`Erreur : ${e.message}`, "error");
    }
};

/**
 * Action: Test Admin Alert SMS
 */
window.testAdminAlertSms = async () => {
    try {
        window.showToast("Envoi de l'alerte SMS test...", "info");
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sequences/test-admin-alert`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.success) {
            window.showToast(data.message, "success");
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        window.showToast(`Erreur : ${e.message}`, "error");
    }
};

/**
 * Action: Test Admin Alert Email
 */
window.testAdminAlertEmail = async () => {
    try {
        const emailInput = document.getElementById('cfg-admin-email')?.value.trim();
        const targetEmail = emailInput || sequenceSettings.adminAlertEmail || 'benjamin@solutionsquasar.ca';
        window.showToast(`Envoi du courriel test à ${targetEmail}...`, "info");

        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sequences/test-admin-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ targetEmail })
        });
        const data = await resp.json();
        if (data.success) {
            window.showToast(data.message, "success");
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        window.showToast(`Erreur : ${e.message}`, "error");
    }
};

/**
 * Sequences Studio Action Handlers
 */
window.selectSequenceProfile = (sequenceId) => {
    selectedSequenceId = sequenceId;
    renderSequencesListTab();
};

window.insertVarIntoStep = (idx, varText) => {
    const el = document.getElementById(`seq-step-template-${idx}`);
    if (!el) return;
    const start = el.selectionStart !== undefined ? el.selectionStart : el.value.length;
    const end = el.selectionEnd !== undefined ? el.selectionEnd : el.value.length;
    el.value = el.value.substring(0, start) + varText + el.value.substring(end);
    el.focus();
    el.setSelectionRange(start + varText.length, start + varText.length);
    window.updateStepLiveStats(idx);
};

window.updateStepLiveStats = (idx) => {
    const el = document.getElementById(`seq-step-template-${idx}`);
    if (!el) return;
    const text = el.value;
    const len = text.length;
    const charsEl = document.getElementById(`seq-step-chars-${idx}`);
    const segsEl = document.getElementById(`seq-step-segments-${idx}`);
    const compEl = document.getElementById(`seq-step-compliance-${idx}`);
    const snippetEl = document.querySelector(`#seq-step-card-${idx} .seq-collapsed-text`);

    if (charsEl) {
        charsEl.textContent = `${len} caractère${len > 1 ? 's' : ''}`;
    }

    let segments = 1;
    if (len > 160) {
        segments = Math.ceil(len / 153);
    }
    if (segsEl) {
        segsEl.textContent = `${segments} SMS (${segments * 160} max)`;
        segsEl.style.color = segments > 1 ? '#F2C037' : '#21BA45';
        segsEl.style.background = segments > 1 ? 'rgba(242,192,55,0.15)' : 'rgba(33,186,69,0.15)';
        segsEl.style.borderColor = segments > 1 ? 'rgba(242,192,55,0.3)' : 'rgba(33,186,69,0.3)';
    }

    if (compEl) {
        const hasStop = /stop/i.test(text);
        compEl.innerHTML = hasStop
            ? `<span class="material-icons" style="font-size:14px; color:#21BA45;">check_circle</span> Mention STOP incluse`
            : `<span class="material-icons" style="font-size:14px; color:#F2C037;">info</span> Clause STOP conseillée`;
        compEl.style.color = hasStop ? '#21BA45' : '#F2C037';
    }

    if (snippetEl) {
        snippetEl.textContent = text ? `"${text.slice(0, 85)}${text.length > 85 ? '...' : ''}"` : '""';
        snippetEl.title = text;
    }
};

window.switchSequenceEditorLang = (lang) => {
    // 1. Sync currently visible step text back to model in memory so user edits aren't lost
    const seq = cachedSequences.find(s => s.id === selectedSequenceId);
    if (seq) {
        window.syncCurrentStepInputsToMemory(seq);
    }

    // 2. Switch language and re-render
    sequenceEditorLang = lang;
    renderSequencesListTab();
};

// --- COLLAPSIBLE ACCORDION STATE & ACTIONS ---
window.collapsedSteps = window.collapsedSteps || {};

window.toggleStepCollapse = (idx) => {
    window.collapsedSteps[idx] = !window.collapsedSteps[idx];
    const card = document.getElementById(`seq-step-card-${idx}`);
    if (card) {
        if (window.collapsedSteps[idx]) {
            card.classList.add('is-collapsed');
        } else {
            card.classList.remove('is-collapsed');
        }
    }
};

window.collapseAllSteps = (collapse) => {
    const seq = cachedSequences.find(s => s.id === selectedSequenceId);
    if (!seq || !Array.isArray(seq.steps)) return;
    seq.steps.forEach((_, i) => {
        window.collapsedSteps[i] = collapse;
        const card = document.getElementById(`seq-step-card-${i}`);
        if (card) {
            if (collapse) card.classList.add('is-collapsed');
            else card.classList.remove('is-collapsed');
        }
    });
};

// --- DYNAMIC STEPS MANAGEMENT (ADD, DELETE, REORDER) ---

window.syncCurrentStepInputsToMemory = (seq) => {
    if (!seq || !Array.isArray(seq.steps)) return;
    const isEn = sequenceEditorLang === 'en';

    // Synchronize header inputs (from modal or inline)
    const nameEl = document.getElementById('seq-modal-edit-name') || document.getElementById('seq-edit-name');
    if (nameEl && nameEl.value.trim()) seq.name = nameEl.value.trim();

    const descEl = document.getElementById('seq-modal-edit-desc') || document.getElementById('seq-edit-desc');
    if (descEl) seq.description = descEl.value.trim();

    const catEl = document.getElementById('seq-modal-target-category') || document.getElementById('seq-target-category');
    if (catEl && catEl.value) seq.targetCategory = catEl.value;

    const countryEl = document.getElementById('seq-modal-target-country') || document.getElementById('seq-target-country');
    if (countryEl && countryEl.value) seq.targetCountry = countryEl.value;

    seq.steps.forEach((st, i) => {
        const templateEl = document.getElementById(`seq-step-template-${i}`);
        const delayEl = document.getElementById(`seq-step-delay-${i}`);
        if (templateEl) {
            if (isEn) st.template_en = templateEl.value.trim();
            else st.template = templateEl.value.trim();
        }
        if (delayEl) {
            const val = parseFloat(delayEl.value);
            if (!isNaN(val)) st.delayHours = val;
        }
    });
};

window.addNewSequenceStep = () => {
    const seq = cachedSequences.find(s => s.id === selectedSequenceId);
    if (!seq) return;
    if (!Array.isArray(seq.steps)) seq.steps = [];

    window.syncCurrentStepInputsToMemory(seq);

    const stepNum = seq.steps.length + 1;
    let defaultDelay = 72; // J+3
    if (seq.steps.length > 0) {
        const lastStep = seq.steps[seq.steps.length - 1];
        if (lastStep.delayHours < 24) defaultDelay = 24;
        else if (lastStep.delayHours < 72) defaultDelay = 72;
        else if (lastStep.delayHours < 168) defaultDelay = 168;
        else if (lastStep.delayHours < 336) defaultDelay = 336;
        else defaultDelay = lastStep.delayHours + 168;
    }

    const newStep = {
        stepNumber: stepNum,
        delayHours: defaultDelay,
        template: `Allo {{name}}, je fais un petit suivi pour {{company}}. Avez-vous eu l'occasion d'évaluer notre proposition ? [Rép. STOP pour cesser]`,
        template_en: `Hey {{name}}, just following up regarding {{company}}. Have you had a moment to review our proposal? [Reply STOP to opt out]`
    };

    seq.steps.push(newStep);
    window.collapsedSteps[seq.steps.length - 1] = false; // Auto-expand newly created step

    if (document.getElementById('seq-modal-steps-container')) {
        renderModalSteps(seq);
    } else {
        renderSequencesListTab();
    }
    window.showToast(`✓ Étape ${stepNum} ajoutée à la séquence. Pensez à enregistrer !`, "success");

    setTimeout(() => {
        const el = document.getElementById(`seq-step-card-${seq.steps.length - 1}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
};

window.deleteSequenceStep = (idx) => {
    const seq = cachedSequences.find(s => s.id === selectedSequenceId);
    if (!seq || !Array.isArray(seq.steps)) return;

    if (seq.steps.length <= 1) {
        return window.showToast("Une séquence doit comporter au moins une étape.", "warning");
    }

    window.syncCurrentStepInputsToMemory(seq);

    const stepNum = seq.steps[idx].stepNumber || (idx + 1);
    seq.steps.splice(idx, 1);

    // Re-index steps
    seq.steps.forEach((st, i) => {
        st.stepNumber = i + 1;
    });

    window.collapsedSteps = {};
    if (document.getElementById('seq-modal-steps-container')) {
        renderModalSteps(seq);
    } else {
        renderSequencesListTab();
    }
    window.showToast(`Étape ${stepNum} supprimée. Cliquez sur "Enregistrer" pour valider.`, "info");
};

window.moveSequenceStep = (idx, direction) => {
    const seq = cachedSequences.find(s => s.id === selectedSequenceId);
    if (!seq || !Array.isArray(seq.steps)) return;

    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= seq.steps.length) return;

    window.syncCurrentStepInputsToMemory(seq);

    const temp = seq.steps[idx];
    seq.steps[idx] = seq.steps[targetIdx];
    seq.steps[targetIdx] = temp;

    // Re-index step numbers
    seq.steps.forEach((st, i) => {
        st.stepNumber = i + 1;
    });

    window.collapsedSteps = {};
    if (document.getElementById('seq-modal-steps-container')) {
        renderModalSteps(seq);
    } else {
        renderSequencesListTab();
    }
    window.showToast(`Étape déplacée en position ${targetIdx + 1}.`, "info");
};

window.updateSequenceName = (name) => {
    const seq = cachedSequences.find(s => s.id === selectedSequenceId);
    if (!seq) return;
    seq.name = (name || '').trim() || seq.name;
};

window.updateSequenceDescription = (desc) => {
    const seq = cachedSequences.find(s => s.id === selectedSequenceId);
    if (!seq) return;
    seq.description = (desc || '').trim();
};

window.updateSequenceCategory = (category) => {
    const seq = cachedSequences.find(s => s.id === selectedSequenceId);
    if (!seq) return;
    seq.targetCategory = category;
};

window.updateSequenceCountry = (country) => {
    const seq = cachedSequences.find(s => s.id === selectedSequenceId);
    if (!seq) return;
    seq.targetCountry = country;
    const countryNames = {
        'ALL': 'Canada & USA (Amérique du Nord)',
        'CA': 'Canada (Québec & autres provinces)',
        'US': 'États-Unis (USA)'
    };
    window.showToast(`Pays cible défini sur "${countryNames[country] || country}". Enregistrez pour sauvegarder.`, "info");
};

window.duplicateCurrentSequence = async () => {
    const currentSeq = cachedSequences.find(s => s.id === selectedSequenceId);
    if (!currentSeq) return;

    window.syncCurrentStepInputsToMemory(currentSeq);
    const nameVal = document.getElementById('seq-modal-edit-name')?.value.trim() || document.getElementById('seq-edit-name')?.value.trim() || currentSeq.name;
    const descVal = document.getElementById('seq-modal-edit-desc')?.value.trim() ?? document.getElementById('seq-edit-desc')?.value.trim() ?? (currentSeq.description || '');
    const categoryVal = document.getElementById('seq-modal-target-category')?.value || document.getElementById('seq-target-category')?.value || currentSeq.targetCategory || 'custom';
    const countryVal = document.getElementById('seq-modal-target-country')?.value || document.getElementById('seq-target-country')?.value || currentSeq.targetCountry || 'ALL';

    const newId = `seq_${categoryVal}_${Date.now()}`;
    const newName = `${nameVal} (Copie)`;

    const clonedSteps = (currentSeq.steps || []).map((st, i) => ({
        stepNumber: i + 1,
        delayHours: st.delayHours,
        template: st.template || '',
        template_en: st.template_en || ''
    }));

    const newSeq = {
        id: newId,
        name: newName,
        targetCategory: categoryVal,
        targetCountry: countryVal,
        description: descVal ? `${descVal} (Copie)` : 'Séquence dupliquée',
        active: true,
        isCustom: true,
        steps: clonedSteps
    };

    try {
        window.showToast("Duplication de la séquence en cours...", "info");
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sequences`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(newSeq)
        });
        const data = await resp.json();
        if (data.success) {
            cachedSequences.push(newSeq);
            selectedSequenceId = newSeq.id;
            window.showToast(`✓ Séquence dupliquée : "${newSeq.name}"`, "success");
            renderSequencesListTab();
            window.openSequenceEditorModal(newSeq.id);
        } else {
            throw new Error(data.error || "Erreur lors de la duplication");
        }
    } catch (e) {
        window.showToast(`Erreur : ${e.message}`, "error");
    }
};

window.duplicateSequenceFromList = async (seqId, event) => {
    if (event) event.stopPropagation();
    const sourceSeq = cachedSequences.find(s => s.id === seqId);
    if (!sourceSeq) return;

    const newId = `seq_${sourceSeq.targetCategory || 'custom'}_${Date.now()}`;
    const newName = `${sourceSeq.name} (Copie)`;

    const clonedSteps = (sourceSeq.steps || []).map((st, i) => ({
        stepNumber: i + 1,
        delayHours: st.delayHours,
        template: st.template || '',
        template_en: st.template_en || ''
    }));

    const newSeq = {
        id: newId,
        name: newName,
        targetCategory: sourceSeq.targetCategory || 'custom',
        targetCountry: sourceSeq.targetCountry || 'ALL',
        description: sourceSeq.description ? `${sourceSeq.description} (Copie)` : 'Séquence dupliquée',
        active: true,
        isCustom: true,
        steps: clonedSteps
    };

    try {
        window.showToast("Duplication de la séquence en cours...", "info");
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sequences`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(newSeq)
        });
        const data = await resp.json();
        if (data.success) {
            cachedSequences.push(newSeq);
            renderSequencesListTab();
            window.showToast(`✓ Séquence "${newSeq.name}" créée !`, "success");
            window.openSequenceEditorModal(newSeq.id);
        } else {
            throw new Error(data.error || "Erreur lors de la duplication");
        }
    } catch (e) {
        window.showToast(`Erreur : ${e.message}`, "error");
    }
};

window.deleteCurrentSequence = () => {
    const seq = cachedSequences.find(s => s.id === selectedSequenceId);
    if (!seq) return;

    if (DEFAULT_SEQUENCE_IDS.includes(seq.id)) {
        return window.showToast("Les séquences natives du système ne peuvent pas être supprimées.", "warning");
    }

    const doDelete = async () => {
        try {
            window.showToast("Suppression de la séquence...", "info");
            const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
            const resp = await fetch(`${API_BASE}/api/sequences/${seq.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            if (data.success) {
                cachedSequences = cachedSequences.filter(s => s.id !== seq.id);
                selectedSequenceId = cachedSequences[0]?.id || DEFAULT_SEQUENCE_IDS[0];
                document.getElementById('sequence-editor-modal')?.remove();
                window.showToast(`✓ Séquence "${seq.name}" supprimée avec succès.`, "success");
                renderSequencesListTab();
            } else {
                throw new Error(data.error || "Erreur de suppression");
            }
        } catch (e) {
            window.showToast(`Erreur : ${e.message}`, "error");
        }
    };

    if (window.showConfirmModal) {
        window.showConfirmModal({
            title: 'Supprimer la séquence',
            message: `Êtes-vous certain de vouloir supprimer la séquence <strong>"${escapeHtml(seq.name)}"</strong> ? Cette action est irréversible.`,
            confirmText: 'Supprimer définitivement',
            cancelText: 'Annuler',
            onConfirm: doDelete
        });
    } else {
        doDelete();
    }
};

window.deleteSequenceFromList = (seqId, event) => {
    if (event) event.stopPropagation();
    const seq = cachedSequences.find(s => s.id === seqId);
    if (!seq) return;

    if (DEFAULT_SEQUENCE_IDS.includes(seq.id)) {
        return window.showToast("Les séquences natives du système ne peuvent pas être supprimées.", "warning");
    }

    const doDelete = async () => {
        try {
            window.showToast("Suppression de la séquence...", "info");
            const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
            const resp = await fetch(`${API_BASE}/api/sequences/${seq.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            if (data.success) {
                cachedSequences = cachedSequences.filter(s => s.id !== seq.id);
                renderSequencesListTab();
                window.showToast(`✓ Séquence "${seq.name}" supprimée.`, "success");
            } else {
                throw new Error(data.error || "Erreur de suppression");
            }
        } catch (e) {
            window.showToast(`Erreur : ${e.message}`, "error");
        }
    };

    if (window.showConfirmModal) {
        window.showConfirmModal({
            title: 'Supprimer la séquence',
            message: `Êtes-vous certain de vouloir supprimer définitivement la séquence <strong>"${escapeHtml(seq.name)}"</strong> ?`,
            confirmText: 'Supprimer définitivement',
            cancelText: 'Annuler',
            onConfirm: doDelete
        });
    } else {
        doDelete();
    }
};

window.openCreateSequenceModal = (defaultCountry = 'ALL') => {
    const existing = document.getElementById('seq-create-modal');
    if (existing) existing.remove();

    const templateOptions = cachedSequences.map(s => {
        return `<option value="${s.id}">Copier le modèle : ${escapeHtml(s.name)} (${s.steps?.length || 4} étapes)</option>`;
    }).join('');

    const modalHtml = `
    <div id="seq-create-modal" class="crm-modal-overlay" style="z-index:9999; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.85); position:fixed; top:0; left:0; width:100vw; height:100vh; backdrop-filter:blur(8px);">
        <div class="crm-modal-content" style="width:92%; max-width:500px; background:#12151B; border:1px solid rgba(223,165,58,0.4); border-radius:14px; padding:24px 26px; box-shadow:0 25px 70px rgba(0,0,0,0.9); color:#F8FAFC;">
            
            <!-- Header -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:34px; height:34px; border-radius:8px; background:rgba(223,165,58,0.12); border:1px solid rgba(223,165,58,0.3); display:flex; align-items:center; justify-content:center; color:var(--gold);">
                        <span class="material-icons" style="font-size:18px;">add_circle_outline</span>
                    </div>
                    <h3 style="margin:0; font-size:1.1rem; font-weight:700; color:#F8FAFC;">Nouvelle séquence SMS</h3>
                </div>
                <button type="button" onclick="document.getElementById('seq-create-modal')?.remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; padding:4px;" title="Fermer">
                    <span class="material-icons" style="font-size:20px;">close</span>
                </button>
            </div>

            <!-- Form -->
            <form id="form-create-sequence" onsubmit="window.handleCreateSequenceSubmit(event)" style="display:flex; flex-direction:column; gap:14px;">
                
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:600; color:#CBD5E1; margin-bottom:6px;">Nom de la séquence <span style="color:var(--gold);">*</span></label>
                    <input type="text" id="new-seq-name" required placeholder="Ex: Climatisation & Chauffage Québec" style="width:100%; box-sizing:border-box; background:#090B0F; border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:9px 12px; font-size:0.86rem; color:#F8FAFC; outline:none;" onfocus="this.style.borderColor='var(--gold)';" onblur="this.style.borderColor='rgba(255,255,255,0.12)';">
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:600; color:#CBD5E1; margin-bottom:6px;">Type de lead cible</label>
                        <select id="new-seq-category" style="width:100%; box-sizing:border-box; background:#090B0F; border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:9px 10px; font-size:0.82rem; color:#F8FAFC; outline:none; cursor:pointer;">
                            <option value="directory_only">Annuaire seul</option>
                            <option value="missing_gmb_website">Google Maps manquant</option>
                            <option value="no_website">Pas de site web</option>
                            <option value="outdated_website" selected>Site obsolète</option>
                            <option value="modern_no_ai">Sans agent IA</option>
                            <option value="social_only">Réseaux seuls</option>
                            <option value="custom">Sur-mesure / Autre</option>
                        </select>
                    </div>

                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:600; color:#CBD5E1; margin-bottom:6px;">Pays cible</label>
                        <select id="new-seq-country" style="width:100%; box-sizing:border-box; background:#090B0F; border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:9px 10px; font-size:0.82rem; color:#F8FAFC; outline:none; cursor:pointer;">
                            <option value="ALL" ${defaultCountry === 'ALL' ? 'selected' : ''}>🇨🇦🇺🇸 Canada & USA (Tous)</option>
                            <option value="CA" ${defaultCountry === 'CA' ? 'selected' : ''}>🇨🇦 Canada (QC & autres)</option>
                            <option value="US" ${defaultCountry === 'US' ? 'selected' : ''}>🇺🇸 USA</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:600; color:#CBD5E1; margin-bottom:6px;">Modèle de départ</label>
                    <select id="new-seq-template-source" style="width:100%; box-sizing:border-box; background:#090B0F; border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:9px 10px; font-size:0.82rem; color:#F8FAFC; outline:none; cursor:pointer;">
                        <option value="blank">Modèle vierge (1 étape prête à rédiger)</option>
                        ${templateOptions}
                    </select>
                </div>

                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:600; color:#CBD5E1; margin-bottom:6px;">Description (optionnel)</label>
                    <input type="text" id="new-seq-desc" placeholder="Ex: Séquence ciblée pour commerces du Grand Montréal" style="width:100%; box-sizing:border-box; background:#090B0F; border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:9px 12px; font-size:0.82rem; color:#94A3B8; outline:none;" onfocus="this.style.borderColor='var(--gold)';" onblur="this.style.borderColor='rgba(255,255,255,0.12)';">
                </div>

                <!-- Action Buttons -->
                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px; border-top:1px solid rgba(255,255,255,0.08); padding-top:14px;">
                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('seq-create-modal')?.remove()" style="padding:8px 18px; font-size:0.84rem;">Annuler</button>
                    <button type="submit" id="btn-submit-create-seq" class="btn btn-primary" style="padding:8px 22px; font-size:0.84rem; font-weight:700; background:rgba(223,165,58,0.2); border-color:var(--gold); color:var(--gold);">
                        Créer la séquence
                    </button>
                </div>
            </form>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => {
        document.getElementById('new-seq-name')?.focus();
    }, 100);
};

window.handleCreateSequenceSubmit = async (event) => {
    event.preventDefault();
    const name = document.getElementById('new-seq-name')?.value.trim();
    if (!name) return;

    const category = document.getElementById('new-seq-category')?.value || 'custom';
    const country = document.getElementById('new-seq-country')?.value || 'ALL';
    const sourceTemplate = document.getElementById('new-seq-template-source')?.value || 'blank';
    const desc = document.getElementById('new-seq-desc')?.value.trim() || '';

    const newId = `seq_${category}_${Date.now()}`;
    let steps = [];

    if (sourceTemplate === 'blank') {
        steps = [{
            stepNumber: 1,
            delayHours: 0.05,
            template: `Bonjour {{name}}, je vous contacte concernant {{company}} à {{city}}. Proposez-vous des devis en ligne ? [STOP pour désabonner]`,
            template_en: `Hello {{name}}, reaching out regarding {{company}} in {{city}}. Do you offer instant online quotes? [Reply STOP to opt out]`
        }];
    } else {
        const sourceSeq = cachedSequences.find(s => s.id === sourceTemplate);
        if (sourceSeq && Array.isArray(sourceSeq.steps)) {
            steps = sourceSeq.steps.map((st, i) => ({
                stepNumber: i + 1,
                delayHours: st.delayHours,
                template: st.template || '',
                template_en: st.template_en || ''
            }));
        } else {
            steps = [{
                stepNumber: 1,
                delayHours: 0.05,
                template: `Bonjour {{name}}, petit suivi pour {{company}}. [STOP pour cesser]`,
                template_en: `Hello {{name}}, quick follow-up for {{company}}. [STOP to opt out]`
            }];
        }
    }

    const newSeq = {
        id: newId,
        name,
        targetCategory: category,
        targetCountry: country,
        description: desc,
        active: true,
        isCustom: true,
        steps
    };

    const submitBtn = document.getElementById('btn-submit-create-seq');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="material-icons rotating" style="font-size:16px;">refresh</span> Création...`;
    }

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sequences`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(newSeq)
        });
        const data = await resp.json();
        if (data.success) {
            document.getElementById('seq-create-modal')?.remove();
            cachedSequences.push(newSeq);
            selectedSequenceId = newSeq.id;
            window.showToast(`✓ Séquence "${newSeq.name}" créée avec succès !`, "success");
            renderSequencesListTab();
            window.openSequenceEditorModal(newSeq.id);
        } else {
            throw new Error(data.error || "Erreur de création");
        }
    } catch (e) {
        window.showToast(`Erreur : ${e.message}`, "error");
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Créer la séquence';
        }
    }
};

window.saveCurrentSequence = async () => {
    const seq = cachedSequences.find(s => s.id === selectedSequenceId);
    if (!seq) return;

    const isEn = sequenceEditorLang === 'en';
    const nameVal = document.getElementById('seq-modal-edit-name')?.value.trim() || document.getElementById('seq-edit-name')?.value.trim() || seq.name;
    const descVal = document.getElementById('seq-modal-edit-desc')?.value.trim() ?? document.getElementById('seq-edit-desc')?.value.trim() ?? (seq.description || '');
    const categoryVal = document.getElementById('seq-modal-target-category')?.value || document.getElementById('seq-target-category')?.value || seq.targetCategory || 'custom';
    const targetCountryVal = document.getElementById('seq-modal-target-country')?.value || document.getElementById('seq-target-country')?.value || seq.targetCountry || 'ALL';

    const newSteps = (seq.steps || []).map((st, i) => {
        const templateEl = document.getElementById(`seq-step-template-${i}`);
        const delayEl = document.getElementById(`seq-step-delay-${i}`);
        const templateVal = templateEl ? templateEl.value : undefined;
        const delayVal = delayEl ? parseFloat(delayEl.value) : undefined;
        return {
            ...st,
            stepNumber: i + 1,
            template: !isEn && templateVal !== undefined ? templateVal.trim() : (st.template || ''),
            template_en: isEn && templateVal !== undefined ? templateVal.trim() : (st.template_en || ''),
            delayHours: !isNaN(delayVal) ? delayVal : st.delayHours
        };
    });

    const saveBtns = [
        document.getElementById('btn-save-current-seq'),
        ...document.querySelectorAll('button[onclick*="saveCurrentSequence"]')
    ].filter(Boolean);

    saveBtns.forEach(b => {
        b.disabled = true;
        b.innerHTML = `<span class="material-icons rotating" style="font-size:16px;">refresh</span> Enregistrement...`;
    });

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sequences`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                ...seq,
                name: nameVal,
                description: descVal,
                targetCategory: categoryVal,
                targetCountry: targetCountryVal,
                steps: newSteps
            })
        });
        const data = await resp.json();
        if (data.success) {
            seq.name = nameVal;
            seq.description = descVal;
            seq.targetCategory = categoryVal;
            seq.targetCountry = targetCountryVal;
            seq.steps = newSteps;
            const idx = cachedSequences.findIndex(s => s.id === seq.id);
            if (idx !== -1) cachedSequences[idx] = seq;
            window.showToast(`✓ Séquence "${seq.name}" enregistrée avec succès !`, "success");
            renderSequencesListTab();
        } else {
            throw new Error(data.error || "Erreur de sauvegarde");
        }
    } catch (e) {
        window.showToast(`Erreur : ${e.message}`, "error");
    } finally {
        saveBtns.forEach(b => {
            b.disabled = false;
            b.innerHTML = `${SEQ_SVGS.save} Enregistrer`;
        });
    }
};

window.testSingleStepSMS = async (idx) => {
    const text = document.getElementById(`seq-step-template-${idx}`)?.value.trim();
    if (!text) {
        return window.showToast("Le message SMS de cette étape est vide.", "warning");
    }

    const testBtn = document.getElementById(`btn-test-step-${idx}`);
    if (testBtn) {
        testBtn.disabled = true;
        testBtn.innerHTML = `<span class="material-icons rotating" style="font-size:14px;">refresh</span> Envoi...`;
    }

    try {
        window.showToast("Envoi du SMS test sur votre mobile...", "info");
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sequences/test-step`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                text,
                targetPhone: sequenceSettings.adminAlertPhone || '+15062337006'
            })
        });
        const data = await resp.json();
        if (data.success) {
            window.showToast(data.message, "success");
        } else {
            throw new Error(data.error || "Erreur lors de l'envoi");
        }
    } catch (e) {
        window.showToast(`Erreur Twilio : ${e.message}`, "error");
    } finally {
        if (testBtn) {
            testBtn.disabled = false;
            testBtn.innerHTML = `${SEQ_SVGS.send} Tester (${sequenceEditorLang === 'en' ? 'EN' : 'FR'})`;
        }
    }
};

window.resetCurrentSequence = () => {
    const seq = cachedSequences.find(s => s.id === selectedSequenceId);
    if (!seq) return;

    const doReset = async () => {
        try {
            window.showToast("Rétablissement du modèle par défaut...", "info");
            const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
            const resp = await fetch(`${API_BASE}/api/sequences/reset`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ sequenceId: seq.id })
            });
            const data = await resp.json();
            if (data.success && data.sequence) {
                const idx = cachedSequences.findIndex(s => s.id === seq.id);
                if (idx !== -1) cachedSequences[idx] = data.sequence;
                window.showToast(`✓ Modèle "${seq.name}" rétabli à l'état d'origine !`, "success");
                if (document.getElementById('seq-modal-steps-container')) {
                    renderModalSteps(data.sequence);
                }
                renderSequencesListTab();
            } else {
                throw new Error(data.error || "Erreur lors de la réinitialisation");
            }
        } catch (e) {
            window.showToast(`Erreur : ${e.message}`, "error");
        }
    };

    if (window.showConfirmModal) {
        window.showConfirmModal({
            title: 'Rétablir le modèle par défaut',
            message: `Voulez-vous rétablir les textes et délais d'origine pour la séquence "${seq.name}" ? Vos modifications actuelles seront écrasées.`,
            confirmText: 'Rétablir',
            cancelText: 'Annuler',
            onConfirm: doReset
        });
    } else {
        doReset();
    }
};

// Aliases for studio modal & backward compatibility
window.saveModalSequence = window.saveCurrentSequence;
window.duplicateModalSequence = window.duplicateCurrentSequence;
window.deleteModalSequence = window.deleteCurrentSequence;
window.resetModalSequence = window.resetCurrentSequence;
window.editSequence = (sequenceId) => {
    window.openSequenceEditorModal(sequenceId);
};
window.saveEditedSequence = window.saveCurrentSequence;

/**
 * Helper to build grouped sequence options
 */
function buildSequenceSelectOptions(selectedId, isUS) {
    if (!cachedSequences || cachedSequences.length === 0) {
        return `<option value="">Chargement des séquences...</option>`;
    }

    const caSeqs = cachedSequences.filter(s => s.targetCountry === 'CA');
    const usSeqs = cachedSequences.filter(s => s.targetCountry === 'US');
    const allSeqs = cachedSequences.filter(s => !s.targetCountry || s.targetCountry === 'ALL');
    const otherSeqs = cachedSequences.filter(s => s.targetCountry && !['CA', 'US', 'ALL'].includes(s.targetCountry));

    let html = '';
    const renderGroup = (label, list) => {
        if (!list || list.length === 0) return '';
        let groupHtml = `<optgroup label="${escapeHtml(label)}">`;
        list.forEach(s => {
            const isSel = s.id === selectedId ? 'selected' : '';
            const stepsCount = Array.isArray(s.steps) ? s.steps.length : 4;
            groupHtml += `<option value="${escapeHtml(s.id)}" ${isSel}>${escapeHtml(s.name)} (${stepsCount} étapes)</option>`;
        });
        groupHtml += `</optgroup>`;
        return groupHtml;
    };

    if (isUS) {
        html += renderGroup('🇺🇸 Séquences USA (Telnyx / 10DLC)', usSeqs);
        html += renderGroup('🇨🇦🇺🇸 Séquences Universelles (Amérique du Nord)', allSeqs);
        html += renderGroup('🇨🇦 Séquences Canada (Loi 25 / CRTC)', caSeqs);
    } else {
        html += renderGroup('🇨🇦 Séquences Canada (Québec / Loi 25)', caSeqs);
        html += renderGroup('🇨🇦🇺🇸 Séquences Universelles (Amérique du Nord)', allSeqs);
        html += renderGroup('🇺🇸 Séquences USA (Telnyx / TCPA)', usSeqs);
    }

    if (otherSeqs.length > 0) {
        html += renderGroup('✨ Autres Séquences', otherSeqs);
    }

    return html;
}

window.handleTriggerModalSeqChange = (seqId) => {
    if (window._triggerModalState) {
        window._triggerModalState.selectedSeqId = seqId;
        window.updateTriggerModalPreview();
    }
};

window.switchTriggerPreviewLang = (lang) => {
    if (window._triggerModalState) {
        window._triggerModalState.leadLang = lang;
        const btnFr = document.getElementById('trigger-preview-lang-fr');
        const btnEn = document.getElementById('trigger-preview-lang-en');
        if (btnFr && btnEn) {
            btnFr.className = `btn btn-xs ${lang === 'fr' ? 'btn-primary' : 'btn-secondary'}`;
            btnEn.className = `btn btn-xs ${lang === 'en' ? 'btn-primary' : 'btn-secondary'}`;
        }
        window.updateTriggerModalPreview();
    }
};

window.updateTriggerModalPreview = () => {
    const state = window._triggerModalState;
    if (!state || !state.lead) return;

    const lead = state.lead;
    const selectedSeq = cachedSequences.find(s => s.id === state.selectedSeqId) || cachedSequences[0];
    if (!selectedSeq) return;

    const step1 = (selectedSeq.steps && selectedSeq.steps[0]) || {
        delayHours: 0.05,
        template: "Bonjour {{name}}, je vous contacte concernant {{company}} à {{city}}. Proposez-vous des devis en ligne ? [STOP pour désabonner]",
        template_en: "Hello {{name}}, reaching out regarding {{company}} in {{city}}. Do you offer instant online quotes? [Reply STOP to opt out]"
    };

    const isEn = state.leadLang === 'en';
    const rawTemplate = isEn ? (step1.template_en || step1.template || '') : (step1.template || step1.template_en || '');

    // Variable substitutions
    const fullName = lead.dm_name || lead.contact_name || lead.business_name || lead.name || '';
    const firstName = fullName ? fullName.split(' ')[0] : (isEn ? 'there' : 'bonjour');
    const company = lead.business_name || lead.company || lead.name || (isEn ? 'your company' : 'votre entreprise');
    const city = lead.city || (isEn ? 'your area' : 'votre région');
    const industry = lead.industry || lead.category || lead.leadCategory || (isEn ? 'your industry' : 'votre activité');
    const website = lead.website || '';

    const rendered = rawTemplate
        .replace(/\{\{\s*name\s*\}\}/gi, fullName || firstName)
        .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
        .replace(/\{\{\s*company\s*\}\}/gi, company)
        .replace(/\{\{\s*city\s*\}\}/gi, city)
        .replace(/\{\{\s*industry\s*\}\}/gi, industry)
        .replace(/\{\{\s*website\s*\}\}/gi, website);

    const previewEl = document.getElementById('trigger-modal-preview-text');
    if (previewEl) {
        previewEl.textContent = rendered;
    }

    // Stats
    const charLen = rendered.length;
    const segments = charLen <= 160 ? 1 : Math.ceil(charLen / 153);
    const charsEl = document.getElementById('trigger-modal-chars');
    const segsEl = document.getElementById('trigger-modal-segments');
    const compEl = document.getElementById('trigger-modal-compliance');
    const badgeEl = document.getElementById('trigger-modal-step-badge');

    if (charsEl) charsEl.textContent = `${charLen} caractère${charLen > 1 ? 's' : ''}`;
    if (segsEl) {
        segsEl.textContent = `${segments} SMS (${segments * 160} max)`;
        segsEl.style.color = segments > 1 ? '#F59E0B' : '#10B981';
    }

    if (compEl) {
        const hasStop = /stop/i.test(rendered);
        compEl.innerHTML = hasStop
            ? `<span class="material-icons" style="font-size:14px; color:#10B981;">check_circle</span> Mention STOP conforme`
            : `<span class="material-icons" style="font-size:14px; color:#F59E0B;">info</span> Clause STOP conseillée`;
        compEl.style.color = hasStop ? '#10B981' : '#F59E0B';
    }

    if (badgeEl) {
        const totalSteps = selectedSeq.steps ? selectedSeq.steps.length : 1;
        badgeEl.textContent = `Étape 1 sur ${totalSteps} • Envoi Immédiat (Test Direct)`;
    }
};

window.confirmExecuteRealSms = (leadId) => {
    const state = window._triggerModalState;
    if (!state || !state.lead) return;

    const lead = state.lead;
    const selectedSeq = cachedSequences.find(s => s.id === state.selectedSeqId) || cachedSequences[0];
    const seqName = selectedSeq ? selectedSeq.name : 'Séquence SMS';
    const leadPhone = lead.phone || lead.telephone || '';
    const leadName = lead.business_name || lead.name || 'Prospect';
    const isUS = state.isUS;

    window.showConfirmModal({
        title: "🚀 Confirmer l'envoi RÉEL du SMS",
        message: `
            Vous êtes sur le point de déclencher un <strong>VRAI SMS</strong> en situation réelle :<br><br>
            <div style="background:#090B0F; padding:10px 14px; border-radius:8px; border:1px solid rgba(223,165,58,0.3); text-align:center; margin-bottom:12px;">
                <div style="font-size:1.15rem; font-weight:800; font-family:monospace; color:var(--gold);">${escapeHtml(leadPhone)}</div>
                <div style="font-size:0.8rem; color:#94A3B8; margin-top:2px;">${escapeHtml(leadName)} &bull; ${isUS ? '🇺🇸 USA' : '🇨🇦 Canada'}</div>
            </div>
            <strong>Séquence :</strong> ${escapeHtml(seqName)}<br>
            <strong>Mode d'envoi :</strong> <span style="color:#10B981; font-weight:700;">RÉEL avec Bypass Pause (Dérogation de test)</span><br><br>
            <div style="font-size:0.82rem; color:#CBD5E1; line-height:1.45; text-align:left; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:6px; border-left:3px solid #10B981;">
                • Le SMS sera réellement expédié sur le réseau par <strong>${isUS ? 'Telnyx' : 'Twilio'}</strong>.<br>
                • Le pilote automatique reste <strong>en pause</strong> pour tous les autres leads.<br>
                • Les étapes suivantes respecteront les délais programmés.
            </div>
            <br>
            Confirmez-vous l'envoi immédiat du SMS ?
        `,
        confirmText: "Oui, Envoyer le SMS Réel",
        cancelText: "Annuler",
        onConfirm: () => window.executeSequenceTrigger(leadId, false)
    });
};

window.executeSequenceTrigger = async (leadId, isDryRun) => {
    const state = window._triggerModalState;
    const selectedSeqId = state ? state.selectedSeqId : null;
    const btnLive = document.getElementById('btn-trigger-live');
    const btnSim = document.getElementById('btn-trigger-simulation');

    if (btnLive) btnLive.disabled = true;
    if (btnSim) btnSim.disabled = true;

    if (!isDryRun && btnLive) {
        btnLive.innerHTML = `<span class="material-icons rotating" style="font-size:16px;">refresh</span> Envoi du SMS réel...`;
    } else if (isDryRun && btnSim) {
        btnSim.innerHTML = `<span class="material-icons rotating" style="font-size:16px;">refresh</span> Démarrage...`;
    }

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sequences/trigger`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                leadId,
                sequenceId: selectedSeqId,
                dryRun: isDryRun,
                forceLive: !isDryRun,
                bypassPause: true
            })
        });

        const data = await resp.json();

        if (data.success) {
            document.getElementById('trigger-sequence-lead-modal')?.remove();

            if (!isDryRun) {
                const prov = data.firstStepResult?.provider ? ` (via ${data.firstStepResult.provider.toUpperCase()})` : '';
                window.showToast(`🚀 SMS RÉEL expédié avec succès${prov} !`, "success");
            } else {
                window.showToast(`🧪 Séquence démarrée en mode Simulation (Bypass Pause) !`, "info");
            }

            // Sync local cache
            if (state && state.lead) {
                state.lead.sequenceStatus = 'ACTIVE';
                state.lead.activeSequenceId = selectedSeqId || data.sequenceId;
                state.lead.smsSequenceStep = 1;
                state.lead.smsStatus = isDryRun ? 'Simulé' : 'Réel';
            }

            // Refresh lead detail modal timeline if open
            if (typeof window.refreshLeadSequenceTimeline === 'function') {
                window.refreshLeadSequenceTimeline(leadId);
            }
        } else if (data.skipped) {
            window.showToast(`Déclenchement ignoré : ${data.reason}`, "warning");
            if (btnLive) {
                btnLive.disabled = false;
                btnLive.innerHTML = `<span class="material-icons" style="font-size:16px;">bolt</span> <span>Lancer en RÉEL (Bypass Pause)</span>`;
            }
            if (btnSim) {
                btnSim.disabled = false;
                btnSim.innerHTML = `${SEQ_SVGS.flask} <span>Tester en Simulation</span>`;
            }
        } else {
            throw new Error(data.error || "Erreur de déclenchement");
        }
    } catch (e) {
        window.showToast(`Erreur : ${e.message}`, "error");
        if (btnLive) {
            btnLive.disabled = false;
            btnLive.innerHTML = `<span class="material-icons" style="font-size:16px;">bolt</span> <span>Lancer en RÉEL (Bypass Pause)</span>`;
        }
        if (btnSim) {
            btnSim.disabled = false;
            btnSim.innerHTML = `${SEQ_SVGS.flask} <span>Tester en Simulation</span>`;
        }
    }
};

window.stopLeadSequenceAction = (leadId) => {
    const state = window._triggerModalState;
    const leadName = (state && state.lead) ? (state.lead.business_name || state.lead.name || 'ce lead') : 'ce lead';

    window.showConfirmModal({
        title: "Arrêter la séquence en cours ?",
        message: `Voulez-vous stopper définitivement la séquence active pour <strong>${escapeHtml(leadName)}</strong> ?<br><br>Plus aucun SMS planifié ne sera envoyé à ce numéro.`,
        confirmText: "Oui, Arrêter la Séquence",
        cancelText: "Annuler",
        onConfirm: async () => {
            try {
                window.showToast("Arrêt de la séquence...", "info");
                const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
                const resp = await fetch(`${API_BASE}/api/sequences/stop`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ leadId })
                });
                const data = await resp.json();
                if (data.success) {
                    window.showToast("✓ Séquence arrêtée pour ce lead.", "info");
                    if (state && state.lead) {
                        state.lead.sequenceStatus = 'STOPPED_MANUAL';
                    }
                    document.getElementById('trigger-sequence-lead-modal')?.remove();
                } else {
                    throw new Error(data.error || "Impossible d'arrêter la séquence");
                }
            } catch (err) {
                window.showToast(`Erreur : ${err.message}`, "error");
            }
        }
    });
};

/**
 * Dedicated In-App Modal: Trigger an automated sequence on a specific lead
 * Supports:
 * - Real live SMS dispatch with Pause Bypass (Dérogation exclusive)
 * - Dry-run simulation testing
 * - Step 1 dynamic variable interpolation
 * - Country & language matching (QC/Canada vs USA Telnyx)
 * - Halting active instances
 */
export async function openTriggerSequenceModal(leadId, preselectedSeqId = null) {
    if (!leadId) {
        return window.showToast?.("Identifiant de lead manquant.", "error");
    }

    const modalId = 'trigger-sequence-lead-modal';
    document.getElementById(modalId)?.remove();

    // 1. Resolve lead data
    let lead = (window.allLeadsCache || []).find(l => l.id === leadId)
        || (window.masterLeadsCache || []).find(l => l.id === leadId)
        || (window.leadsCache || []).find(l => l.id === leadId);

    if (!lead || !lead.phone) {
        try {
            const snap = await getDoc(doc(db, "leads", leadId));
            if (snap.exists()) {
                lead = { id: snap.id, ...snap.data() };
            } else {
                const snapCrm = await getDoc(doc(db, "crm_leads", leadId));
                if (snapCrm.exists()) lead = { id: snapCrm.id, ...snapCrm.data() };
            }
        } catch (e) {
            console.warn("[TriggerModal] Fetch lead error:", e);
        }
    }

    if (!lead) {
        return window.showToast?.("Impossible de charger les données de ce lead.", "error");
    }

    const leadPhone = lead.phone || lead.telephone || '';
    if (!leadPhone) {
        return window.showToast?.("Ce lead n'a aucun numéro de téléphone renseigné.", "warning");
    }

    // 2. Fetch global status & ensure cachedSequences are loaded
    let isGlobalAutoPaused = true;
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const [statusRes, seqsRes] = await Promise.all([
            fetch(`${API_BASE}/api/sms/auto-send-status`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null),
            cachedSequences.length === 0 
                ? fetch(`${API_BASE}/api/sequences`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null)
                : Promise.resolve(null)
        ]);

        if (statusRes && statusRes.ok) {
            const sData = await statusRes.json();
            isGlobalAutoPaused = sData.autoSendEnabled === false;
        }

        if (seqsRes && seqsRes.ok) {
            const qData = await seqsRes.json();
            if (qData.success && Array.isArray(qData.sequences)) {
                cachedSequences = qData.sequences;
            }
        }
    } catch (e) {
        console.warn("[TriggerModal] Status fetch error:", e);
    }

    // 3. Lead geography & language detection
    const cleanPhone = leadPhone.replace(/\D/g, '');
    const isUS = lead.country === 'US' || lead.country === 'USA' || lead.country === 'United States'
        || (cleanPhone.length === 11 && cleanPhone.startsWith('1') && !/^(?:204|226|236|249|250|289|306|343|365|367|368|403|416|418|428|431|437|438|450|506|514|519|548|579|581|584|587|604|613|639|647|672|683|705|709|742|753|778|780|782|807|819|825|867|873|879|902|905)/.test(cleanPhone.slice(1)));
    
    let leadLang = 'fr';
    if (lead.preferredLanguage) {
        leadLang = lead.preferredLanguage.toLowerCase().startsWith('en') ? 'en' : 'fr';
    } else if (isUS) {
        leadLang = 'en';
    } else if (window.detectLeadLanguage) {
        leadLang = window.detectLeadLanguage(lead) || 'fr';
    }

    // 4. Determine default sequence
    let initialSeqId = preselectedSeqId || lead.activeSequenceId;
    if (!initialSeqId) {
        const leadCat = lead.leadCategory || lead.category || '';
        const candidate = cachedSequences.find(s => {
            const matchesCountry = isUS ? (s.targetCountry === 'US' || s.targetCountry === 'ALL') : (s.targetCountry === 'CA' || s.targetCountry === 'ALL');
            return matchesCountry && s.targetCategory === leadCat;
        }) || cachedSequences.find(s => isUS ? s.targetCountry === 'US' : s.targetCountry === 'CA')
           || cachedSequences[0];

        if (candidate) initialSeqId = candidate.id;
    }

    // 5. Build Modal DOM
    const leadName = lead.business_name || lead.company || lead.name || 'Prospect';
    const contactPerson = lead.dm_name || lead.contact_name || '';
    const city = lead.city || '';
    const state = lead.state || lead.region || '';
    const locationStr = [city, state, isUS ? 'USA' : 'Canada'].filter(Boolean).join(', ');
    const isLandline = lead.phone_type === 'landline' || lead.sms_eligible === false;
    const carrierName = lead.carrier_name || lead.phone_carrier || lead.carrier || '';
    const isSequenceActive = lead.sequenceStatus === 'ACTIVE';

    const modalHtml = `
    <div id="${modalId}" class="crm-modal-overlay" style="z-index:9990; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.85); position:fixed; top:0; left:0; width:100vw; height:100vh; backdrop-filter:blur(8px); padding:16px; box-sizing:border-box;">
        <div class="crm-modal-content" style="width:100%; max-width:680px; max-height:92vh; background:#12151B; border:1px solid rgba(223,165,58,0.4); border-radius:16px; box-shadow:0 25px 70px rgba(0,0,0,0.9); display:flex; flex-direction:column; overflow:hidden;">
            
            <!-- Modal Header -->
            <div style="background:#171B24; padding:16px 22px; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:38px; height:38px; border-radius:10px; background:rgba(223,165,58,0.15); border:1px solid var(--gold); display:flex; align-items:center; justify-content:center; color:var(--gold); flex-shrink:0;">
                        <span class="material-icons" style="font-size:20px;">rocket_launch</span>
                    </div>
                    <div>
                        <h3 style="margin:0; font-size:1.1rem; font-weight:800; color:#F8FAFC; letter-spacing:-0.2px;">Lancer une Séquence SMS</h3>
                        <div class="text-xs text-muted" style="margin-top:2px;">
                            Test en situation réelle ciblé &bull; <span style="color:#A7F3D0; font-weight:600;">Dérogation Bypass Pause disponible</span>
                        </div>
                    </div>
                </div>
                <button type="button" class="btn icon-btn" onclick="document.getElementById('${modalId}')?.remove()" style="background:transparent; border:none; color:#94A3B8; font-size:1.2rem; cursor:pointer; padding:6px; border-radius:8px;">
                    ✕
                </button>
            </div>

            <!-- Scrollable Modal Body -->
            <div style="padding:20px 22px; overflow-y:auto; display:flex; flex-direction:column; gap:16px; flex:1;">
                
                <!-- 1. Pause Status Notice Banner -->
                ${isGlobalAutoPaused ? `
                <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.3); border-radius:12px; padding:12px 16px; display:flex; align-items:flex-start; gap:12px;">
                    <span style="font-size:1.4rem; line-height:1.2;">🟡</span>
                    <div>
                        <div style="font-size:0.86rem; font-weight:700; color:#F59E0B;">SMS Auto Global : ACTUELLEMENT EN PAUSE</div>
                        <div style="font-size:0.77rem; color:#CBD5E1; margin-top:3px; line-height:1.45;">
                            Le pilote automatique est actuellement en pause générale pour protéger votre liste. En déclenchant ci-dessous, le système appliquera automatiquement le <strong>Bypass Pause (Dérogation exclusive)</strong> : ce prospect recevra le SMS en direct, <strong>sans réactiver les envois pour les autres leads</strong>.
                        </div>
                    </div>
                </div>
                ` : `
                <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); border-radius:12px; padding:10px 16px; display:flex; align-items:center; gap:10px;">
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10B981; box-shadow:0 0 8px #10B981;"></span>
                    <span style="font-size:0.82rem; color:#A7F3D0; font-weight:600;">SMS Auto Global : ACTIF (Pilote automatique en marche)</span>
                </div>
                `}

                <!-- 2. Target Lead Info Card -->
                <div style="background:#090B0F; border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:14px 16px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                        <div>
                            <div style="font-size:1rem; font-weight:700; color:#F8FAFC;">
                                ${escapeHtml(leadName)}
                                ${contactPerson ? `<span style="font-weight:400; color:#94A3B8; font-size:0.85rem;"> &bull; ${escapeHtml(contactPerson)}</span>` : ''}
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; margin-top:4px; flex-wrap:wrap;">
                                <span style="font-family:monospace; font-weight:700; font-size:0.95rem; color:var(--gold);">${escapeHtml(leadPhone)}</span>
                                <span style="font-size:0.75rem; color:#64748B;">&bull;</span>
                                <span style="font-size:0.78rem; color:#CBD5E1;">${isUS ? '🇺🇸' : '🇨🇦'} ${escapeHtml(locationStr)}</span>
                            </div>
                        </div>

                        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                            ${isLandline ? `
                                <span style="background:rgba(239,68,68,0.15); color:#F87171; border:1px solid rgba(239,68,68,0.3); font-size:0.72rem; font-weight:600; padding:2px 8px; border-radius:6px;">
                                    ☎️ Ligne Fixe
                                </span>
                            ` : `
                                <span style="background:rgba(16,185,129,0.12); color:#10B981; border:1px solid rgba(16,185,129,0.3); font-size:0.72rem; font-weight:600; padding:2px 8px; border-radius:6px;">
                                    📱 Mobile Valide
                                </span>
                            `}
                            ${carrierName ? `
                                <span style="background:rgba(255,255,255,0.05); color:#94A3B8; border:1px solid rgba(255,255,255,0.1); font-size:0.72rem; padding:2px 8px; border-radius:6px;">
                                    ${escapeHtml(carrierName)}
                                </span>
                            ` : ''}
                        </div>
                    </div>

                    ${isSequenceActive ? `
                    <div style="margin-top:12px; padding-top:10px; border-top:1px dashed rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#21BA45;"></span>
                            <span style="font-size:0.8rem; color:#21BA45; font-weight:600;">
                                Séquence active en cours (Étape ${lead.smsSequenceStep || 1})
                            </span>
                        </div>
                        <button type="button" class="btn btn-xs" onclick="window.stopLeadSequenceAction('${lead.id}')" style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.35); color:#F87171; font-size:0.72rem; padding:3px 10px; border-radius:6px; cursor:pointer; font-weight:600;">
                            ⏹️ Arrêter la Séquence en cours
                        </button>
                    </div>
                    ` : ''}
                </div>

                <!-- 3. Sequence Selector Dropdown -->
                <div>
                    <label style="display:block; font-size:0.76rem; text-transform:uppercase; font-weight:700; color:#94A3B8; margin-bottom:6px; letter-spacing:0.3px;">
                        Sélectionner la Séquence SMS :
                    </label>
                    <select id="trigger-modal-sequence-select" style="width:100%; background:#090B0F; border:1px solid rgba(223,165,58,0.3); border-radius:8px; padding:10px 12px; font-size:0.88rem; color:#F8FAFC; outline:none;" onchange="window.handleTriggerModalSeqChange(this.value)">
                        ${buildSequenceSelectOptions(initialSeqId, isUS)}
                    </select>
                </div>

                <!-- 4. Step 1 Live Preview Box -->
                <div style="background:#090B0F; border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px 16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:0.75rem; font-weight:700; color:var(--gold); text-transform:uppercase; letter-spacing:0.4px;">
                                Aperçu en Direct — Étape 1
                            </span>
                            <span id="trigger-modal-step-badge" style="background:rgba(255,255,255,0.06); font-size:0.7rem; color:#94A3B8; padding:2px 8px; border-radius:6px;">
                                Envoi Immédiat
                            </span>
                        </div>

                        <!-- Language Switch Pill -->
                        <div style="display:flex; align-items:center; gap:4px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:2px;">
                            <button type="button" id="trigger-preview-lang-fr" class="btn btn-xs ${leadLang === 'fr' ? 'btn-primary' : 'btn-secondary'}" style="font-size:0.7rem; padding:2px 8px; height:22px;" onclick="window.switchTriggerPreviewLang('fr')">
                                FR 🇨🇦
                            </button>
                            <button type="button" id="trigger-preview-lang-en" class="btn btn-xs ${leadLang === 'en' ? 'btn-primary' : 'btn-secondary'}" style="font-size:0.7rem; padding:2px 8px; height:22px;" onclick="window.switchTriggerPreviewLang('en')">
                                EN 🇺🇸
                            </button>
                        </div>
                    </div>

                    <!-- Rendered Message Box -->
                    <div id="trigger-modal-preview-text" style="background:#12151B; border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:12px 14px; font-size:0.86rem; color:#E2E8F0; line-height:1.5; white-space:pre-wrap; word-break:break-word; min-height:60px;">
                        <!-- Dynamically filled -->
                    </div>

                    <!-- Character & Compliance Stats -->
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:0.73rem; color:#64748B; flex-wrap:wrap; gap:8px;">
                        <div id="trigger-modal-stats" style="display:flex; align-items:center; gap:10px;">
                            <span id="trigger-modal-chars">-- car.</span>
                            <span id="trigger-modal-segments">1 segment SMS</span>
                        </div>
                        <div id="trigger-modal-compliance" style="display:flex; align-items:center; gap:4px; color:#10B981;">
                            <span class="material-icons" style="font-size:14px;">check_circle</span> Mention STOP conforme
                        </div>
                    </div>
                </div>

                <!-- 5. Carrier Route Notice -->
                <div style="font-size:0.75rem; color:#64748B; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px;">
                    <span>Route Opérateur : <strong style="color:#CBD5E1;">${isUS ? '🇺🇸 Telnyx 10DLC (+1 832 743-6292)' : '🇨🇦 Twilio Local (+1 819 300-2831)'}</strong></span>
                    <span>Arrêt auto sur réponse : <strong style="color:#10B981;">Actif</strong></span>
                </div>

            </div>

            <!-- Modal Action Footer -->
            <div style="background:#171B24; padding:14px 22px; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; flex-shrink:0;">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('${modalId}')?.remove()" style="font-size:0.82rem; padding:8px 16px;">
                    Annuler
                </button>

                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <!-- Simulation Button -->
                    <button type="button" class="btn btn-outline-gold" id="btn-trigger-simulation" onclick="window.executeSequenceTrigger('${lead.id}', true)" style="font-size:0.82rem; font-weight:700; padding:8px 16px; display:inline-flex; align-items:center; gap:6px;" title="Tester la séquence sans envoi de SMS réel sur le réseau">
                        ${SEQ_SVGS.flask} <span>Tester en Simulation</span>
                    </button>

                    <!-- Real SMS Button -->
                    <button type="button" class="btn btn-primary" id="btn-trigger-live" onclick="window.confirmExecuteRealSms('${lead.id}')" style="background:linear-gradient(135deg, #10B981 0%, #059669 100%); border-color:#10B981; color:#FFFFFF; font-size:0.84rem; font-weight:800; padding:8px 20px; box-shadow:0 4px 18px rgba(16,185,129,0.35); display:inline-flex; align-items:center; gap:8px;" title="Envoyer le premier SMS immédiatement en situation réelle avec dérogation Bypass Pause">
                        <span class="material-icons" style="font-size:16px;">bolt</span>
                        <span>Lancer en RÉEL (Bypass Pause)</span>
                    </button>
                </div>
            </div>

        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Store state on window for dynamic updates
    window._triggerModalState = {
        lead,
        leadLang,
        isUS,
        selectedSeqId: initialSeqId
    };

    window.updateTriggerModalPreview();
}

export function triggerLeadSequenceFromUI(leadId, leadName, leadCompany, leadPhone, leadCategory) {
    return openTriggerSequenceModal(leadId);
}

window.triggerLeadSequenceFromUI = triggerLeadSequenceFromUI;
window.openTriggerSequenceModal = openTriggerSequenceModal;


// =========================================================================
// SEQUENCES MODAL: REAL-TIME AI ACTIVITY & SMS MONITOR TAB
// =========================================================================

let seqModalFeedEvents = [];
let seqModalFilter = 'all';
let seqModalPaused = false;
let seqModalEventSource = null;

function renderSequencesLiveFeedTab() {
    const body = document.getElementById('sequence-modal-body');
    if (!body) return;

    // Close any prior stream in this modal
    if (seqModalEventSource) {
        try { seqModalEventSource.close(); } catch (e) {}
        seqModalEventSource = null;
    }

    body.innerHTML = `
        <div style="background:#12151B; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:18px 20px; display:flex; flex-direction:column; gap:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:34px; height:34px; border-radius:8px; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.25); display:flex; align-items:center; justify-content:center; color:#38BDF8; flex-shrink:0;">
                        ${SEQ_SVGS.activity}
                    </div>
                    <div>
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <h4 style="margin:0; font-size:1rem; font-weight:700; color:#F8FAFC;">Flux d'Activité IA & Séquences SMS en Direct</h4>
                            <span id="seq-modal-sse-badge" style="background:rgba(16,185,129,0.1); color:#10B981; border:1px solid rgba(16,185,129,0.25); font-size:0.7rem; font-weight:600; padding:2px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:5px;">
                                <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#10B981;"></span>
                                <span>EN DIRECT (SSE)</span>
                            </span>
                        </div>
                        <div class="text-xs text-muted" style="margin-top:2px; font-size:0.76rem; color:#64748B;">
                            Visualisez chaque action de prospection, d'audit IA et chaque SMS généré ou expédié en temps réel.
                        </div>
                    </div>
                </div>

                <!-- Live Stream Controls -->
                <div style="display:flex; align-items:center; gap:6px;">
                    <button type="button" id="btn-seq-feed-pause" class="lead-action-btn" onclick="window.toggleSeqFeedPause()" style="font-size:0.78rem; padding:5px 12px;">
                        <span id="label-seq-feed-pause">Pause</span>
                    </button>
                    <button type="button" class="lead-action-btn" onclick="window.clearSeqFeedDisplay()" style="font-size:0.78rem; padding:5px 12px;" title="Effacer l'affichage">
                        Vider l'écran
                    </button>
                </div>
            </div>

            <!-- Filter Pills -->
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.05);">
                <span style="font-size:0.72rem; font-weight:600; color:#64748B; text-transform:uppercase; margin-right:4px;">Filtrer :</span>
                <button type="button" class="seq-modal-filter-pill active" id="btn-seq-filter-all" onclick="window.filterSeqModalFeed('all', this)" style="background:rgba(223,165,58,0.12); border:1px solid var(--gold); color:var(--gold); font-size:0.74rem; font-weight:600; padding:3px 10px; border-radius:12px; cursor:pointer;">
                    Tous (<span id="seq-count-all">0</span>)
                </button>
                <button type="button" class="seq-modal-filter-pill" id="btn-seq-filter-sms" onclick="window.filterSeqModalFeed('sms', this)" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); color:#94A3B8; font-size:0.74rem; font-weight:500; padding:3px 10px; border-radius:12px; cursor:pointer;">
                    SMS Séquences (<span id="seq-count-sms">0</span>)
                </button>
                <button type="button" class="seq-modal-filter-pill" id="btn-seq-filter-audit" onclick="window.filterSeqModalFeed('audit', this)" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); color:#94A3B8; font-size:0.74rem; font-weight:500; padding:3px 10px; border-radius:12px; cursor:pointer;">
                    Audit IA (<span id="seq-count-audit">0</span>)
                </button>
                <button type="button" class="seq-modal-filter-pill" id="btn-seq-filter-sourcing" onclick="window.filterSeqModalFeed('sourcing', this)" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); color:#94A3B8; font-size:0.74rem; font-weight:500; padding:3px 10px; border-radius:12px; cursor:pointer;">
                    Sourcing (<span id="seq-count-sourcing">0</span>)
                </button>
                <button type="button" class="seq-modal-filter-pill" id="btn-seq-filter-admin" onclick="window.filterSeqModalFeed('admin_alert', this)" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); color:#94A3B8; font-size:0.74rem; font-weight:500; padding:3px 10px; border-radius:12px; cursor:pointer;">
                    Alertes Admin (<span id="seq-count-admin">0</span>)
                </button>
            </div>

            <!-- Feed Container -->
            <div id="seq-modal-feed-list" style="max-height:550px; min-height:240px; overflow-y:auto; background:#090B0F; border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:12px; display:flex; flex-direction:column; gap:8px;">
                <div id="seq-modal-feed-empty" style="text-align:center; padding:32px 16px; color:#64748B;">
                    <div style="font-size:0.85rem; font-weight:500;">En attente d'événements du flux IA...</div>
                    <div style="font-size:0.75rem; margin-top:4px;">Chaque SMS calculé ou transmis apparaîtra ici avec son texte complet.</div>
                </div>
            </div>
        </div>
    `;

    initSeqModalLiveStream();
}

async function initSeqModalLiveStream() {
    // 1. Fetch recent events
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/ai/activity/recent?limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.success && Array.isArray(data.events)) {
            seqModalFeedEvents = data.events;
            updateSeqModalFeedCounts();
            renderSeqModalFeedItems();
        }
    } catch (e) {
        console.warn("[Sequences] Error fetching recent activity:", e.message);
    }

    // 2. Open SSE
    try {
        seqModalEventSource = new EventSource(`${API_BASE}/api/ai/activity/stream`);
        const badge = document.getElementById('seq-modal-sse-badge');

        seqModalEventSource.onopen = () => {
            if (badge) {
                badge.style.background = 'rgba(33,186,69,0.15)';
                badge.style.color = '#21BA45';
                badge.style.borderColor = 'rgba(33,186,69,0.4)';
                badge.innerHTML = `<span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#21BA45; box-shadow:0 0 8px #21BA45;"></span> <span>FLUX EN DIRECT (SSE)</span>`;
            }
        };

        seqModalEventSource.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data);
                if (parsed.type === 'connected' || parsed.type === 'keepalive') return;

                seqModalFeedEvents.unshift(parsed);
                if (seqModalFeedEvents.length > 250) seqModalFeedEvents.pop();

                updateSeqModalFeedCounts();
                if (!seqModalPaused) renderSeqModalFeedItems();
            } catch (err) {
                console.error("[Sequences] SSE parse error:", err);
            }
        };

        seqModalEventSource.onerror = () => {
            if (badge) {
                badge.style.background = 'rgba(242,192,55,0.15)';
                badge.style.color = '#F2C037';
                badge.style.borderColor = 'rgba(242,192,55,0.4)';
                badge.innerHTML = `<span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#F2C037;"></span> <span>RECONNEXION...</span>`;
            }
        };
    } catch (e) {
        console.error("[Sequences] Error opening SSE:", e);
    }
}

function updateSeqModalFeedCounts() {
    const total = seqModalFeedEvents.length;
    const sms = seqModalFeedEvents.filter(e => e.category === 'sms').length;
    const audit = seqModalFeedEvents.filter(e => e.category === 'audit').length;
    const sourcing = seqModalFeedEvents.filter(e => e.category === 'sourcing').length;
    const admin = seqModalFeedEvents.filter(e => e.category === 'admin_alert').length;

    const elAll = document.getElementById('seq-count-all');
    const elSms = document.getElementById('seq-count-sms');
    const elAudit = document.getElementById('seq-count-audit');
    const elSourcing = document.getElementById('seq-count-sourcing');
    const elAdmin = document.getElementById('seq-count-admin');

    if (elAll) elAll.textContent = total;
    if (elSms) elSms.textContent = sms;
    if (elAudit) elAudit.textContent = audit;
    if (elSourcing) elSourcing.textContent = sourcing;
    if (elAdmin) elAdmin.textContent = admin;
}

function renderSeqModalFeedItems() {
    const container = document.getElementById('seq-modal-feed-list');
    if (!container) return;

    const filtered = seqModalFilter === 'all'
        ? seqModalFeedEvents
        : seqModalFeedEvents.filter(e => e.category === seqModalFilter);

    if (filtered.length === 0) {
        container.innerHTML = `
            <div id="seq-modal-feed-empty" style="text-align:center; padding:36px 16px; color:rgba(255,255,255,0.4);">
                <span class="material-icons" style="font-size:36px; opacity:0.35; margin-bottom:8px;">stream</span>
                <div style="font-size:0.9rem; font-weight:600;">Aucun événement dans cette catégorie pour le moment.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(ev => {
        const dateObj = new Date(ev.timestamp || Date.now());
        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const meta = ev.metadata || {};

        let catBadge = '';
        let borderAccent = 'rgba(255,255,255,0.08)';

        if (ev.category === 'sms') {
            const isSimulated = meta.isDryRun !== false;
            catBadge = `<span class="badge" style="background:${isSimulated ? 'rgba(242,192,55,0.14)' : 'rgba(33,186,69,0.14)'}; border:1px solid ${isSimulated ? 'rgba(242,192,55,0.4)' : 'rgba(33,186,69,0.4)'}; color:${isSimulated ? '#F2C037' : '#21BA45'}; font-size:10px; font-weight:800; padding:2px 7px;">💬 ${isSimulated ? 'SMS SIMULÉ' : 'SMS TWILIO ENVOYÉ'}</span>`;
            borderAccent = isSimulated ? 'rgba(242,192,55,0.4)' : 'rgba(33,186,69,0.4)';
        } else if (ev.category === 'audit') {
            catBadge = `<span class="badge" style="background:rgba(179,136,255,0.14); border:1px solid rgba(179,136,255,0.35); color:#b388ff; font-size:10px; font-weight:800; padding:2px 7px;">🧠 AUDIT IA</span>`;
            borderAccent = 'rgba(179,136,255,0.35)';
        } else if (ev.category === 'sourcing') {
            catBadge = `<span class="badge" style="background:rgba(0,212,255,0.14); border:1px solid rgba(0,212,255,0.35); color:#00d4ff; font-size:10px; font-weight:800; padding:2px 7px;">🔍 SOURCING</span>`;
            borderAccent = 'rgba(0,212,255,0.35)';
        } else if (ev.category === 'admin_alert') {
            catBadge = `<span class="badge" style="background:rgba(33,186,69,0.14); border:1px solid rgba(33,186,69,0.4); color:#21BA45; font-size:10px; font-weight:800; padding:2px 7px;">📱 ALERTE ADMIN</span>`;
            borderAccent = 'rgba(33,186,69,0.35)';
        } else {
            catBadge = `<span class="badge" style="background:rgba(255,255,255,0.06); color:var(--text-muted); font-size:10px; font-weight:800; padding:2px 7px;">⚙️ SYSTÈME</span>`;
        }

        let smsBoxHtml = '';
        if (meta.smsBody || meta.previewText) {
            const smsContent = meta.smsBody || meta.previewText;
            const recipient = meta.phone || meta.recipientPhone || '';
            const isSimulated = meta.isDryRun !== false;

            smsBoxHtml = `
                <div style="margin-top:8px; background:rgba(0,0,0,0.55); border:1px solid ${isSimulated ? 'rgba(242,192,55,0.35)' : 'rgba(33,186,69,0.4)'}; border-left:3px solid ${isSimulated ? '#F2C037' : '#21BA45'}; border-radius:8px; padding:10px 14px; font-family:monospace; font-size:0.83rem;">
                    <div style="font-size:0.75rem; color:${isSimulated ? '#F2C037' : '#21BA45'}; font-weight:700; margin-bottom:5px; display:flex; align-items:center; gap:6px;">
                        <span class="material-icons" style="font-size:14px;">textsms</span>
                        <span>${isSimulated ? '📝 TEXTE DU SMS PRÉPARÉ (SIMULATION DRY-RUN)' : '🚀 SMS EXPÉDIÉ EN PRODUCTION (TWILIO)'}</span>
                        ${recipient ? `<span style="margin-left:auto; color:rgba(255,255,255,0.6); font-family:var(--font-family, sans-serif); font-size:0.75rem;">Destinataire : <strong style="color:var(--text-main);">${escapeHtml(recipient)}</strong></span>` : ''}
                    </div>
                    <div style="color:#f5f5f5; line-height:1.45; white-space:pre-wrap;">"${escapeHtml(smsContent)}"</div>
                </div>
            `;
        }

        return `
            <div class="ai-feed-item" style="background:rgba(255,255,255,0.02); border:1px solid ${borderAccent}; border-radius:8px; padding:10px 14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${catBadge}
                        <span style="font-size:0.88rem; font-weight:700; color:var(--text-main);">${escapeHtml(ev.title || 'Activité')}</span>
                    </div>
                    <span style="font-size:0.75rem; color:var(--text-muted); font-family:monospace;">${timeStr}</span>
                </div>
                ${ev.message ? `<div style="font-size:0.82rem; color:var(--text-muted); margin-top:4px; line-height:1.4;">${escapeHtml(ev.message)}</div>` : ''}
                ${smsBoxHtml}
            </div>
        `;
    }).join('');
}

window.toggleSeqFeedPause = () => {
    seqModalPaused = !seqModalPaused;
    const btn = document.getElementById('btn-seq-feed-pause');
    const icon = document.getElementById('icon-seq-feed-pause');
    const label = document.getElementById('label-seq-feed-pause');
    if (seqModalPaused) {
        if (btn) {
            btn.style.background = 'rgba(242,192,55,0.2)';
            btn.style.color = '#F2C037';
            btn.style.borderColor = '#F2C037';
        }
        if (icon) icon.textContent = 'play_arrow';
        if (label) label.textContent = 'Reprendre';
        window.showToast("Flux d'activité mis en pause", "info");
    } else {
        if (btn) {
            btn.style.background = '';
            btn.style.color = '';
            btn.style.borderColor = '';
        }
        if (icon) icon.textContent = 'pause';
        if (label) label.textContent = 'Pause';
        renderSeqModalFeedItems();
        window.showToast("Flux d'activité repris", "info");
    }
};

window.clearSeqFeedDisplay = async () => {
    seqModalFeedEvents = [];
    renderSeqModalFeedItems();
    updateSeqModalFeedCounts();
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        await fetch(`${API_BASE}/api/ai/activity/clear`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    } catch (e) {}
    window.showToast("Affichage du moniteur effacé", "info");
};

window.filterSeqModalFeed = (category, btnElement) => {
    seqModalFilter = category;
    document.querySelectorAll('.seq-modal-filter-pill').forEach(btn => {
        btn.style.background = 'rgba(255,255,255,0.05)';
        btn.style.borderColor = 'rgba(255,255,255,0.12)';
        btn.style.color = 'var(--text-muted)';
    });
    if (btnElement) {
        btnElement.style.background = 'rgba(223,165,58,0.2)';
        btnElement.style.borderColor = 'var(--gold)';
        btnElement.style.color = 'var(--gold)';
    }
    renderSeqModalFeedItems();
};

