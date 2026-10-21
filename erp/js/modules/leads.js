import { db, auth } from '../firebase-config.js';
import { collection, query, where, getDocs, getDoc, updateDoc, doc, addDoc, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { triggerLeadSequenceFromUI, openSequencesConfigModal, openTriggerSequenceModal } from './sequences.js';
import { auditSingleLeadNow } from './audit.js';
import { getTeamDropdownOptions } from './team.js';
import { LeadFilterService } from '../services/LeadFilterService.js';
import { t } from '../services/translationService.js';
import Fuse from 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.mjs';

const API_BASE = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : '';

// --- CUSTOM SLEEK SVG ICONS (Ultra-Clean, Lightweight, 24x24) ---
export const SVG_ICONS = {
    sms: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    gmail: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
    phone: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    sparkles: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>`,
    search: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
    mapPin: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    globe: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
    user: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    star: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    grid: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`,
    list: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    settings: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
    target: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    external: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
    close: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
    copy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
    send: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    bolt: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`
};

// --- MODULE STATE & PERSISTENCE ---
let currentSubfilter = 'ALL';
let currentMainFilter = 'NEW';

export function getLeadsUrlParams() {
    const rawHash = window.location.hash || '';
    const qIndex = rawHash.indexOf('?');
    if (qIndex === -1) {
        return { filter: null, sub: null, id: null };
    }
    const queryString = rawHash.slice(qIndex + 1);
    const params = new URLSearchParams(queryString);
    return {
        filter: params.get('filter') ? params.get('filter').toUpperCase() : null,
        sub: params.get('sub') ? params.get('sub').toUpperCase() : null,
        id: params.get('id') || null
    };
}
window.getLeadsUrlParams = getLeadsUrlParams;

export function updateLeadsUrlParams(newParams = {}, replace = false) {
    const rawHash = window.location.hash || '#leads';
    const base = rawHash.split('?')[0] || '#leads';
    if (base !== '#leads') return;

    const current = getLeadsUrlParams();

    let nextFilter = current.filter;
    if (newParams.filter !== undefined) {
        nextFilter = newParams.filter;
    }
    if (!nextFilter) {
        nextFilter = localStorage.getItem('erp_leads_active_tab') || currentMainFilter || 'NEW';
    }

    let nextSub = current.sub;
    if (newParams.sub !== undefined) {
        nextSub = newParams.sub;
    }
    if (!nextSub && (nextFilter === 'APPROVED' || nextFilter === 'AUDITED' || nextFilter === 'ALL')) {
        nextSub = localStorage.getItem('erp_leads_active_subfilter') || currentSubfilter || 'ALL';
    }

    let nextId = current.id;
    if (newParams.id !== undefined) {
        nextId = newParams.id;
    }

    const searchParams = new URLSearchParams();
    if (nextFilter) {
        searchParams.set('filter', nextFilter);
    }
    if (nextSub && nextSub !== 'ALL' && (nextFilter === 'APPROVED' || nextFilter === 'AUDITED' || nextFilter === 'ALL')) {
        searchParams.set('sub', nextSub);
    }
    if (nextId) {
        searchParams.set('id', nextId);
    }

    const queryStr = searchParams.toString();
    const newHash = queryStr ? `${base}?${queryStr}` : base;

    if (window.location.hash !== newHash) {
        if (replace) {
            history.replaceState({ leadId: nextId || null }, '', newHash);
        } else {
            history.pushState({ leadId: nextId || null }, '', newHash);
        }
    }
}
window.updateLeadsUrlParams = updateLeadsUrlParams;

export function switchLeadsTab(filter, syncUrl = true) {
    const validFilters = ['ALL', 'NEW', 'AUDITED', 'APPROVED', 'CONTACTED', 'INTERESTED', 'COLD_NURTURE', 'MEETING_SCHEDULED', 'CLIENT', 'REJECTED'];
    const targetFilter = validFilters.includes(filter) ? filter : 'NEW';

    currentMainFilter = targetFilter;
    localStorage.setItem('erp_leads_active_tab', targetFilter);

    const buttons = document.querySelectorAll('button[data-filter]');
    buttons.forEach(b => {
        if (b.dataset.filter === targetFilter) {
            b.classList.add('btn-primary', 'active-filter');
            b.classList.remove('btn-secondary');
        } else {
            b.classList.remove('btn-primary', 'active-filter');
        }
    });

    if (syncUrl) {
        updateLeadsUrlParams({ filter: targetFilter });
    }

    loadLeads(targetFilter);
}
window.switchLeadsTab = switchLeadsTab;

window.closeLeadDetailOverlay = () => {
    const overlay = document.getElementById('lead-detail-overlay');
    if (overlay) overlay.innerHTML = '';
    updateLeadsUrlParams({ id: null });
};

// Monitor hash changes to handle browser "Back" and "Forward" buttons
window.addEventListener('hashchange', () => {
    const rawHash = window.location.hash || '';
    if (!rawHash.startsWith('#leads')) return;

    const { filter, sub, id } = getLeadsUrlParams();
    const overlay = document.getElementById('lead-detail-overlay');

    // 1. Overlay state sync:
    if (!id) {
        if (overlay && overlay.innerHTML.trim() !== '') {
            overlay.innerHTML = '';
        }
    } else {
        const currentDetailEl = overlay ? overlay.querySelector(`[data-lead-detail-id="${id}"]`) : null;
        if (!currentDetailEl) {
            const lead = (window.allLeadsCache || []).find(l => l.id === id) || (window.masterLeadsCache || []).find(l => l.id === id);
            if (lead) {
                openLeadDetail(lead, false);
            }
        }
    }

    // 2. Tab filter state sync:
    if (filter && filter !== currentMainFilter) {
        switchLeadsTab(filter, false);
    }

    // 3. Subfilter state sync:
    if (sub && sub !== currentSubfilter && typeof window.setLeadsSubfilter === 'function') {
        window.setLeadsSubfilter(sub, false);
    }
});

// Close lead detail overlay on Escape key
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const overlay = document.getElementById('lead-detail-overlay');
        if (overlay && overlay.innerHTML.trim() !== '') {
            window.closeLeadDetailOverlay();
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

// Helper: Format status badge styling & label
function getStatusConfig(status) {
    const s = (status || 'NEW').toUpperCase();
    switch (s) {
        case 'NEW':
            return { label: 'Nouveau', className: 'lead-status-new', color: 'var(--gold)' };
        case 'AUDITED':
            return { label: 'Audité IA', className: 'lead-status-audited', color: '#C084FC' };
        case 'APPROVED':
            return { label: 'Approuvé', className: 'lead-status-approved', color: 'var(--success)' };
        case 'CONTACTED':
            return { label: 'Contacté', className: 'lead-status-contacted', color: '#60A5FA' };
        case 'INTERESTED':
            return { label: 'Intéressé', className: 'lead-status-interested', color: '#FB923C' };
        case 'COLD_NURTURE':
            return { label: 'Nurturing', className: 'lead-status-nurture', color: '#10B981' };
        case 'MEETING_SCHEDULED':
            return { label: 'RDV Fixé', className: 'lead-status-meeting', color: '#C084FC' };
        case 'CLIENT':
            return { label: 'Client', className: 'lead-status-client', color: '#22C55E' };
        case 'ARCHIVED':
            return { label: 'Archivé (6 mois)', className: 'lead-status-rejected', color: '#94A3B8' };
        case 'REJECTED':
            return { label: 'Archivé', className: 'lead-status-rejected', color: '#F87171' };
        default:
            return { label: s, className: 'lead-status-new', color: 'var(--gold)' };
    }
}

// Helper: Format Region Flag & Label
function formatRegionBadge(data) {
    const state = (data.state || '').trim().toUpperCase();
    const city = (data.city || '').trim();

    const canadianProvs = ['QC', 'NB', 'ON', 'BC', 'AB', 'MB', 'SK', 'NS', 'PE', 'NL'];
    const usStates = ['FL', 'TX', 'CA', 'NY', 'NC', 'GA', 'PA', 'IL', 'OH', 'MI', 'AZ'];

    let flag = '📍';
    if (canadianProvs.includes(state)) flag = '🇨🇦';
    else if (usStates.includes(state)) flag = '🇺🇸';

    const locationText = [city, state].filter(Boolean).join(', ') || 'Localisation N/A';
    return `<span class="lead-pill-subtle" title="${escapeHtml(locationText)}">${flag} ${escapeHtml(state || city || 'Zone')}</span>`;
}

// Helper: Format Language Badge
function formatLanguageBadge(data) {
    const lang = data.preferredLanguage || (window.detectLeadLanguage ? window.detectLeadLanguage(data) : 'en');
    const isFr = String(lang).toLowerCase().startsWith('fr');
    return `<span class="lead-pill-subtle" title="Langue de contact : ${isFr ? 'Français' : 'English'}" style="background:rgba(255,255,255,0.05); border-color:rgba(255,255,255,0.12); font-size:0.71rem; padding:1px 6px;">${isFr ? '🇫🇷 FR' : '🇺🇸 EN'}</span>`;
}

// Helper: Format Category Badge
function formatCategoryBadge(data) {
    const cat = data.leadCategory || data.category;
    const hasWebsite = Boolean(data.website && data.website.trim().length > 3);

    if (cat === 'directory_only' || data.has_directory_only) {
        const platName = escapeHtml(data.directory_platform || 'Annuaire');
        return `<span class="lead-pill-subtle" style="background:rgba(239,68,68,0.12); border-color:rgba(239,68,68,0.3); color:#F87171;" title="Aucun site officiel dédié (hébergé sur la plateforme ${platName})">🚫 Pas de site dédié (${platName})</span>`;
    }
    if (cat === 'missing_gmb_website' || data.google_business_missing_website) {
        return `<span class="lead-pill-subtle" style="background:rgba(245,158,11,0.12); border-color:rgba(245,158,11,0.3); color:#FBBF24;" title="Site web existant mais absent de la fiche Google Business">📍 Site non relié à Google</span>`;
    }
    if (cat === 'no_website' || !hasWebsite) {
        return `<span class="lead-pill-subtle lead-pill-no-website" title="Aucun site officiel détecté sur Google">🚫 Sans site web</span>`;
    }
    if (cat === 'outdated_website') {
        return `<span class="lead-pill-subtle lead-pill-outdated" title="Site lent ou non optimisé pour mobile">⚡ Refonte requise</span>`;
    }
    if (data.google_rating >= 4.5 && (data.google_reviews_count || 0) >= 10) {
        return `<span class="lead-pill-subtle" style="background:rgba(223,165,58,0.1); border-color:rgba(223,165,58,0.25); color:var(--gold);" title="Forte réputation locale">⭐ Top réputation</span>`;
    }
    return `<span class="lead-pill-subtle">${escapeHtml(data.category || 'Commerce local')}</span>`;
}

// Helper: Format Category Human-Readable Label
function formatCategoryLabel(cat) {
    switch (cat) {
        case 'directory_only': return '🚫 Pas de site web dédié';
        case 'missing_gmb_website': return '📍 Site non relié à Google Maps';
        case 'no_website': return '🚫 Sans Site Web';
        case 'outdated_website': return '⏳ Site Obsolète / Refonte';
        case 'modern_no_ai': return '🤖 Moderne sans IA';
        case 'social_only': return '📱 Réseaux Sociaux Seuls';
        case 'franchise': return '🏢 Franchise / Chaîne Exclue';
        default: return cat || 'Non qualifié';
    }
}

// Helper: Format AI Score Badge
function formatScoreBadge(data) {
    const auditScore = data.lastAudit?.score;
    const confScore = data.confidence_score;
    const score = auditScore !== undefined ? auditScore : confScore;

    if (score !== undefined && score !== null) {
        return `<span class="lead-pill-subtle lead-pill-score" title="Score de qualification IA : ${score}%">${SVG_ICONS.sparkles} ${score}% IA</span>`;
    }
    return '';
}

// Helper: Format Sequence Badge
function formatSequenceBadge(data) {
    const seqId = data.activeSequenceId || data.sequence_id;
    const seqStatus = data.sequenceStatus || data.sms_sequence_status;
    const step = data.smsSequenceStep || data.sms_sequence_step || 1;

    const seqNames = {
        'seq_directory_only': 'Annuaire Tierce',
        'seq_missing_gmb_website': 'Maps sans Site',
        'seq_no_website': 'Sans Site',
        'seq_outdated_website': 'Refonte Web',
        'seq_modern_no_ai': 'Agent IA 24/7'
    };

    if (seqStatus === 'STOPPED_MEETING' || data.status === 'MEETING_SCHEDULED') {
        return `<span class="lead-pill-subtle" style="background:rgba(192,132,252,0.15); border-color:rgba(192,132,252,0.3); color:#C084FC;" title="Rendez-vous fixé avec le prospect">${SVG_ICONS.calendar || '📅'} RDV Fixé</span>`;
    }
    if (data.stalledStatus || data.stalledState) {
        const ss = data.stalledStatus || data.stalledState;
        if (ss === 'WAITING_REPLY') {
            return `<span class="lead-pill-subtle" style="background:rgba(251,146,60,0.12); border-color:rgba(251,146,60,0.3); color:#FB923C;" title="Prospect ayant répondu puis silencieux. Relance douce J+2 prévue">${SVG_ICONS.bolt || '⚡'} Relance J+2</span>`;
        }
        if (ss === 'BUMP_SENT') {
            return `<span class="lead-pill-subtle" style="background:rgba(234,179,8,0.12); border-color:rgba(234,179,8,0.3); color:#FACC15;" title="Relance douce envoyée. Break-up SMS prévu à J+5 si sans réponse">${SVG_ICONS.sms} Relance J+2 envoyée</span>`;
        }
        if (ss === 'BREAKUP_SENT') {
            return `<span class="lead-pill-subtle" style="background:rgba(168,85,247,0.12); border-color:rgba(168,85,247,0.3); color:#C084FC;" title="Break-up SMS envoyé. Nurturing J+60 en attente">🚪 Break-up J+5</span>`;
        }
        if (ss === 'COLD_NURTURE_SCHEDULED') {
            return `<span class="lead-pill-subtle" style="background:rgba(16,185,129,0.12); border-color:rgba(16,185,129,0.3); color:#34D399;" title="Cold Nurturing long terme programmé (J+60)">🌱 Nurturing (J+60)</span>`;
        }
        if (ss === 'COLD_NURTURE_ROUND_1_SENT') {
            return `<span class="lead-pill-subtle" style="background:rgba(16,185,129,0.18); border-color:rgba(16,185,129,0.35); color:#10B981;" title="Nurture Round 1 envoyé. Round 2 prévu à 6 mois">🌱 Nurture R1 (J+60)</span>`;
        }
        if (ss === 'COLD_NURTURE_ROUND_2_SENT') {
            return `<span class="lead-pill-subtle" style="background:rgba(16,185,129,0.22); border-color:rgba(16,185,129,0.4); color:#059669;" title="Nurture Round 2 envoyé (Semestriel). Archivage automatique dans 14j sans réponse">🌱 Nurture R2 (6 mois)</span>`;
        }
        if (ss === 'ARCHIVED_INACTIVE') {
            return `<span class="lead-pill-subtle" style="background:rgba(100,116,139,0.15); border-color:rgba(100,116,139,0.3); color:#94A3B8;" title="Archivé automatiquement après 6 mois sans réponse (LCAP/CASL)">📁 Archivé (6 mois)</span>`;
        }
    }
    if (seqStatus === 'STOPPED_REPLIED' || data.smsStatus === 'Replied' || data.status === 'INTERESTED') {
        return `<span class="lead-pill-subtle" style="background:rgba(56,189,248,0.1); border-color:rgba(56,189,248,0.3); color:#38BDF8;" title="Le prospect a répondu">${SVG_ICONS.sms} ✋ Répondu</span>`;
    }
    if (seqStatus === 'BLOCKED_LANDLINE') {
        return `<span class="lead-pill-subtle" style="background:rgba(148,163,184,0.1); border-color:rgba(148,163,184,0.25); color:#94A3B8;" title="Ligne fixe : SMS bloqué pour protéger votre réputation">${SVG_ICONS.phone} Fixe (Pas de SMS)</span>`;
    }
    if (seqStatus === 'ACTIVE') {
        const shortName = seqNames[seqId] || 'Séquence';
        const modeLabel = data.smsStatus ? ` (${data.smsStatus})` : '';
        return `<span class="lead-pill-subtle" style="background:rgba(223,165,58,0.12); border-color:rgba(223,165,58,0.3); color:var(--gold);" title="Séquence SMS active : ${shortName} (Étape ${step}/4${modeLabel})">${SVG_ICONS.sms} Seq: ${shortName} (Étape ${step})</span>`;
    }
    if (data.status === 'CONTACTED') {
        return `<span class="lead-pill-subtle" style="background:rgba(59,130,246,0.1); border-color:rgba(59,130,246,0.2); color:#60A5FA;">${SVG_ICONS.gmail} Contacté</span>`;
    }
    return '';
}

// Helper: Format friendly schedule timestamp (e.g. "Lun. 19 oct. à 09h36")
function formatLeadScheduleTime(date, timezone) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
    if (timezone) timeOptions.timeZone = timezone;
    const timeStr = d.toLocaleTimeString('fr-CA', timeOptions).replace(':', 'h');

    if (isToday) return `Aujourd'hui à ${timeStr}`;
    if (isTomorrow) return `Demain à ${timeStr}`;

    const dateOptions = { weekday: 'short', day: 'numeric', month: 'short' };
    if (timezone) dateOptions.timeZone = timezone;
    const dayStr = d.toLocaleDateString('fr-CA', dateOptions);

    return `${dayStr} à ${timeStr}`;
}

// Helper: Format Next Send Badge for Leads Table Row
function formatNextSendBadge(data) {
    // 0. Lead has an active Autonomous AI Follow-up scheduled (100% Autonome)
    if (data.hasScheduledFollowup && data.nextFollowupDue) {
        const fuDate = new Date(data.nextFollowupDue);
        if (!isNaN(fuDate.getTime())) {
            const timeStr = formatLeadScheduleTime(fuDate, data.timezone);
            return `
            <div class="lead-schedule-pill" style="display:inline-flex; align-items:center; gap:4px; font-size:0.71rem; font-weight:700; color:var(--gold); background:rgba(223,165,58,0.12); border:1px solid rgba(223,165,58,0.35); border-radius:5px; padding:2px 7px; margin-top:3px; white-space:nowrap;" title="Suivi IA 100% Autonome : ${escapeHtml(data.nextFollowupReason || 'Relance convenue')} (${timeStr})">
                <span class="material-icons" style="font-size:11px;">smart_toy</span>
                <span>Relance IA : <strong>${timeStr}</strong></span>
            </div>
            `;
        }
    }

    // 1. Lead has an active next send timestamp
    if (data.nextStepDue && data.sequenceStatus === 'ACTIVE' && data.status !== 'MEETING_SCHEDULED' && data.status !== 'INTERESTED') {
        const d = new Date(data.nextStepDue);
        if (!isNaN(d.getTime())) {
            const timeStr = formatLeadScheduleTime(d, data.timezone);
            const stepNum = data.nextStepNumber || data.smsSequenceStep || 1;
            const isSimulated = data.smsStatus === 'Simulated' || data.dryRun !== false;

            return `
            <div class="lead-schedule-pill" style="display:inline-flex; align-items:center; gap:4px; font-size:0.71rem; font-weight:600; color:#38BDF8; background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.25); border-radius:5px; padding:2px 7px; margin-top:3px; white-space:nowrap;" title="Étape ${stepNum} programmée dans le fuseau du prospect (${data.timezone || 'Local'}) : ${d.toLocaleString()}">
                <span style="font-size:10px;">📅</span>
                <span>Étape ${stepNum} : <strong>${timeStr}</strong></span>
                ${isSimulated ? `<span style="font-size:0.62rem; padding:0 3px; border-radius:3px; background:rgba(242,192,55,0.18); color:#F2C037; font-weight:700;">SIMU</span>` : ''}
            </div>
            `;
        }
    }

    // 2. Lead is APPROVED with verified mobile phone, ready for sequence trigger
    if (data.status === 'APPROVED' && data.phone_type === 'mobile') {
        const isMasterPaused = window.isMasterAutoSmsEnabled === false;
        return `
        <div class="lead-schedule-pill" style="display:inline-flex; align-items:center; gap:4px; font-size:0.7rem; color:${isMasterPaused ? '#F59E0B' : '#4ADE80'}; background:${isMasterPaused ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)'}; border:1px solid ${isMasterPaused ? 'rgba(245,158,11,0.22)' : 'rgba(34,197,94,0.22)'}; border-radius:5px; padding:2px 7px; margin-top:3px; white-space:nowrap;" title="${isMasterPaused ? 'Envois automatiques suspendus (Switch SMS en pause)' : 'Mobile qualifié, prêt pour envoi lundi matin'}">
            <span>${isMasterPaused ? '⏸️' : '⚡'}</span>
            <span>${isMasterPaused ? 'SMS Auto en pause' : 'Prêt pour Lundi 09h36'}</span>
        </div>
        `;
    }

    return '';
}

// Helper: Format Phone Line Type Badge (Mobile vs Fixe / Landline)
function formatPhoneBadge(data) {
    if (!data.phone && !data.phone_number) {
        return `<span class="lead-pill-subtle" style="opacity:0.4; font-size:0.73rem;" title="Aucun numéro de téléphone">🚫 Sans tél</span>`;
    }
    const type = data.phone_type;
    const carrier = escapeHtml(data.carrier_name || data.phone_carrier || '');
    if (type === 'mobile') {
        return `<span class="lead-pill-subtle" style="background:rgba(34,197,94,0.12); border-color:rgba(34,197,94,0.25); color:#4ADE80; font-size:0.75rem;" title="Numéro Cellulaire / Mobile certifié (${carrier || 'Opérateur Mobile'})">📱 Mobile</span>`;
    }
    if (type === 'landline') {
        return `<span class="lead-pill-subtle" style="background:rgba(148,163,184,0.12); border-color:rgba(148,163,184,0.25); color:#94A3B8; font-size:0.75rem;" title="Ligne Fixe / Filaire (${carrier || 'Ligne Fixe'}). Les SMS ne sont pas supportés.">☎️ Fixe</span>`;
    }
    if (type === 'voip') {
        return `<span class="lead-pill-subtle" style="background:rgba(59,130,246,0.12); border-color:rgba(59,130,246,0.25); color:#60A5FA; font-size:0.75rem;" title="Ligne VoIP / Virtuelle (${carrier || 'VoIP'})">🌐 VoIP</span>`;
    }
    return `<span class="lead-pill-subtle" style="background:rgba(245,158,11,0.1); border-color:rgba(245,158,11,0.25); color:#FBBF24; font-size:0.73rem;" title="Numéro non qualifié — Cliquez sur le lead pour vérifier">❓ Non vérifié</span>`;
}

// Init Leads Module
export async function initLeads() {
    console.log('Initializing Clean Leads Pipeline Module...');
    const container = document.getElementById('view-leads');

    container.innerHTML = `
        <!-- Top Actions Bar (Sleek & Airy) -->
        <div class="top-actions" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:12px;">
            <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <div class="text-h text-gold" style="font-size:1.3rem; margin:0; letter-spacing:-0.02em;">Pipeline Leads</div>
                    <span id="leads-total-counter" class="badge" style="background:rgba(223,165,58,0.12); color:var(--gold); border:1px solid rgba(223,165,58,0.25); font-size:0.75rem; padding:2px 8px; border-radius:12px;">...</span>
                </div>
                
                <!-- Modern Search Bar with SVG -->
                <div style="position:relative; width:260px;">
                    <span style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--text-muted); pointer-events:none; display:flex;">
                        ${SVG_ICONS.search}
                    </span>
                    <input type="text" id="lead-search-input" class="form-input" placeholder="Rechercher entreprise, ville..." style="padding-left:34px; padding-right:12px; height:36px; font-size:0.85rem; border-radius:8px; border:1px solid rgba(255,255,255,0.08); background:#14171D;" onkeyup="handleLeadSearch(this.value)">
                </div>
            </div>

            <!-- Right Controls -->
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <!-- View Toggles -->
                <div class="view-toggle" style="background:#14171D; border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:2px; display:flex;">
                    <div class="view-toggle-btn ${currentViewMode === 'grid' ? 'active' : ''}" id="btn-view-grid" onclick="setViewMode('grid')" title="Vue Grille" style="padding:4px 8px; border-radius:6px; cursor:pointer;">
                        ${SVG_ICONS.grid}
                    </div>
                    <div class="view-toggle-btn ${currentViewMode === 'list' ? 'active' : ''}" id="btn-view-list" onclick="setViewMode('list')" title="Vue Liste" style="padding:4px 8px; border-radius:6px; cursor:pointer;">
                        ${SVG_ICONS.list}
                    </div>
                </div>

                <!-- Master Toggle: Auto SMS Outreach -->
                <button id="btn-master-auto-sms" class="btn btn-sm auto-sms-toggle-btn" onclick="window.toggleMasterAutoSms()" style="display:flex; align-items:center; gap:6px; height:36px; padding:0 12px; font-size:0.8rem; font-weight:600; border-radius:8px; transition:all 0.2s;" title="Activer ou suspendre les envois automatiques de séquences SMS">
                    <span class="status-dot" style="width:8px; height:8px; border-radius:50%; background:#22C55E; display:inline-block; box-shadow:0 0 8px #22C55E;"></span>
                    <span id="master-auto-sms-label">SMS Auto : ACTIF</span>
                </button>

                <button class="btn btn-primary" onclick="openNewLeadModal()" style="display:flex; align-items:center; gap:6px; height:36px; padding:0 14px; font-size:0.82rem; font-weight:600;">
                    ${SVG_ICONS.plus} <span>Nouveau Lead</span>
                </button>
                
                <button class="btn btn-secondary" onclick="window.openSequencesConfigModal()" style="display:flex; align-items:center; gap:6px; height:36px; padding:0 12px; font-size:0.82rem;" title="Configurer le prompt IA, les séquences SMS et les templates d'accroche">
                    <span style="color:var(--gold); display:flex;">${SVG_ICONS.settings}</span> <span>Séquences & IA</span>
                </button>

                <button class="btn btn-outline-gold" onclick="window.location.hash='#leadhunter'" style="display:flex; align-items:center; gap:6px; height:36px; padding:0 14px; font-size:0.82rem; font-weight:600;">
                    ${SVG_ICONS.target} <span>Lead Hunter</span>
                </button>
            </div>
        </div>

        <!-- Status Filter Pills (Clean, Horizontal Scroll, Highly Readable with Count Badges) -->
        <div style="display:flex; gap:8px; margin-bottom:1.25rem; overflow-x:auto; padding-bottom:6px; -webkit-overflow-scrolling:touch;">
            <button class="btn btn-sm active-filter" data-filter="ALL" style="border-radius:20px; padding:5px 12px; font-size:0.8rem; display:inline-flex; align-items:center;">
                <span>Tous</span>
                <span class="lead-filter-badge" id="count-filter-ALL">0</span>
            </button>
            <button class="btn btn-sm" data-filter="NEW" style="border-radius:20px; padding:5px 12px; font-size:0.8rem; display:inline-flex; align-items:center;">
                <span>Nouveaux</span>
                <span class="lead-filter-badge" id="count-filter-NEW">0</span>
            </button>
            <button class="btn btn-sm" data-filter="AUDITED" style="border-radius:20px; padding:5px 12px; font-size:0.8rem; display:inline-flex; align-items:center;">
                <span>Audit IA</span>
                <span class="lead-filter-badge" id="count-filter-AUDITED">0</span>
            </button>
            <button class="btn btn-sm" data-filter="APPROVED" style="border-radius:20px; padding:5px 12px; font-size:0.8rem; display:inline-flex; align-items:center;">
                <span>Approuvés</span>
                <span class="lead-filter-badge" id="count-filter-APPROVED">0</span>
            </button>
            <button class="btn btn-sm" data-filter="CONTACTED" style="border-radius:20px; padding:5px 12px; font-size:0.8rem; display:inline-flex; align-items:center;">
                <span>Contactés</span>
                <span class="lead-filter-badge" id="count-filter-CONTACTED">0</span>
            </button>
            <button class="btn btn-sm" data-filter="INTERESTED" style="border-radius:20px; padding:5px 12px; font-size:0.8rem; display:inline-flex; align-items:center;">
                <span>Intéressés</span>
                <span class="lead-filter-badge" id="count-filter-INTERESTED">0</span>
            </button>
            <button class="btn btn-sm" data-filter="COLD_NURTURE" style="border-radius:20px; padding:5px 12px; font-size:0.8rem; display:inline-flex; align-items:center;">
                <span>🌱 Nurturing</span>
                <span class="lead-filter-badge" id="count-filter-COLD_NURTURE">0</span>
            </button>
            <button class="btn btn-sm" data-filter="MEETING_SCHEDULED" style="border-radius:20px; padding:5px 12px; font-size:0.8rem; display:inline-flex; align-items:center;">
                <span>RDV Fixé</span>
                <span class="lead-filter-badge" id="count-filter-MEETING_SCHEDULED">0</span>
            </button>
            <button class="btn btn-sm" data-filter="CLIENT" style="border-radius:20px; padding:5px 12px; font-size:0.8rem; display:inline-flex; align-items:center;">
                <span>Clients</span>
                <span class="lead-filter-badge" id="count-filter-CLIENT">0</span>
            </button>
            <button class="btn btn-sm" data-filter="REJECTED" style="border-radius:20px; padding:5px 12px; font-size:0.8rem; display:inline-flex; align-items:center;">
                <span>Archivés</span>
                <span class="lead-filter-badge" id="count-filter-REJECTED">0</span>
            </button>
        </div>

        <!-- Sub-filters Bar (Displayed to distinguish Mobiles vs Fixes) -->
        <div id="leads-subfilters-bar" style="display:none; align-items:center; justify-content:space-between; margin-bottom:1.1rem; padding:8px 14px; background:rgba(20,23,29,0.7); border:1px solid rgba(255,255,255,0.06); border-radius:10px; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span class="text-xs text-muted font-bold uppercase" style="letter-spacing:0.5px; margin-right:2px;">Canal Télécom :</span>
                <button class="subfilter-pill active" data-subfilter="ALL" onclick="window.setLeadsSubfilter('ALL')">
                    <span>Tous</span> <span id="subfilter-count-all" class="subfilter-badge">0</span>
                </button>
                <button class="subfilter-pill" data-subfilter="MOBILE" onclick="window.setLeadsSubfilter('MOBILE')" title="Uniquement les leads avec cellulaire vérifié, prêts pour les séquences SMS">
                    <span>📱 Mobiles Prêts SMS</span> <span id="subfilter-count-mobile" class="subfilter-badge" style="background:rgba(34,197,94,0.2); color:#4ADE80;">0</span>
                </button>
                <button class="subfilter-pill" data-subfilter="LANDLINE" onclick="window.setLeadsSubfilter('LANDLINE')" title="Lignes fixes filaires (SMS non supporté - appel direct ou courriel requis)">
                    <span>☎️ Fixes / À Appeler</span> <span id="subfilter-count-landline" class="subfilter-badge" style="background:rgba(148,163,184,0.2); color:#CBD5E1;">0</span>
                </button>
                <button class="subfilter-pill" data-subfilter="UNKNOWN" onclick="window.setLeadsSubfilter('UNKNOWN')" title="Numéros à qualifier via Telnyx Lookup">
                    <span>❓ À Vérifier</span> <span id="subfilter-count-unknown" class="subfilter-badge">0</span>
                </button>
            </div>
            <div id="subfilter-batch-action" style="display:flex; align-items:center; gap:6px;">
                <button class="btn btn-xs btn-outline-gold" onclick="window.batchVerifyApprovedPhones()" style="display:inline-flex; align-items:center; gap:5px; font-weight:600; font-size:0.75rem; padding:3px 10px;" title="Vérifier automatiquement les numéros non vérifiés de cette vue via Telnyx">
                    <span class="material-icons" style="font-size:13px;">verified</span> Qualifier les numéros
                </button>
            </div>
        </div>

        <!-- Leads List/Grid Host Container -->
        <div id="leads-list-container">
            <div class="text-center text-muted" style="padding: 3rem;">${t('leads_fetching')}</div>
        </div>
    `;

    // Add filter listeners
    const buttons = container.querySelectorAll('button[data-filter]');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetBtn = e.target.closest('button[data-filter]');
            if (!targetBtn) return;
            switchLeadsTab(targetBtn.dataset.filter, true);
        });
    });

    // Resolve initial filter & subfilter: URL params > localStorage > defaults
    const urlParams = getLeadsUrlParams();
    const storedTab = localStorage.getItem('erp_leads_active_tab');
    const storedSub = localStorage.getItem('erp_leads_active_subfilter');

    const validFilters = ['ALL', 'NEW', 'AUDITED', 'APPROVED', 'CONTACTED', 'INTERESTED', 'COLD_NURTURE', 'MEETING_SCHEDULED', 'CLIENT', 'REJECTED'];
    let initialFilter = urlParams.filter || storedTab || 'NEW';
    if (urlParams.id && !urlParams.filter && !storedTab) {
        initialFilter = 'ALL';
    }
    if (!validFilters.includes(initialFilter)) initialFilter = 'NEW';

    let initialSub = urlParams.sub || storedSub || 'ALL';
    const validSubs = ['ALL', 'MOBILE', 'LANDLINE', 'UNKNOWN'];
    if (!validSubs.includes(initialSub)) initialSub = 'ALL';

    currentMainFilter = initialFilter;
    currentSubfilter = initialSub;
    localStorage.setItem('erp_leads_active_tab', initialFilter);
    localStorage.setItem('erp_leads_active_subfilter', initialSub);

    // Sync subfilter pills in DOM
    const pills = container.querySelectorAll('.subfilter-pill');
    pills.forEach(p => {
        if (p.dataset.subfilter === initialSub) {
            p.classList.add('active');
        } else {
            p.classList.remove('active');
        }
    });

    // Sync URL with current filters
    updateLeadsUrlParams({ filter: initialFilter, sub: initialSub, id: urlParams.id }, true);

    const initialBtn = Array.from(buttons).find(b => b.dataset.filter === initialFilter) || buttons[0];

    // Clean up any previous listener and initiate real-time sync
    cleanupLeadsRealtime();
    await loadLeads(initialFilter, true);

    // Sync UI
    buttons.forEach(b => b.classList.remove('btn-primary', 'active-filter', 'active'));
    if (initialBtn) initialBtn.classList.add('btn-primary', 'active-filter');

    // Auto-open if ID in URL
    if (urlParams.id) {
        const lead = (window.allLeadsCache || []).find(l => l.id === urlParams.id) || (masterLeadsCache || []).find(l => l.id === urlParams.id);
        if (lead) openLeadDetail(lead, false);
    }

    // Load Master Auto-SMS Switch Status from backend
    if (window.loadMasterAutoSmsStatus) {
        window.loadMasterAutoSmsStatus();
    }
}

// Subfilter & Master Toggle State
window.setLeadsSubfilter = (subfilter, syncUrl = true) => {
    const validSubs = ['ALL', 'MOBILE', 'LANDLINE', 'UNKNOWN'];
    currentSubfilter = validSubs.includes(subfilter) ? subfilter : 'ALL';
    localStorage.setItem('erp_leads_active_subfilter', currentSubfilter);

    const pills = document.querySelectorAll('.subfilter-pill');
    pills.forEach(p => {
        if (p.dataset.subfilter === currentSubfilter) {
            p.classList.add('active');
        } else {
            p.classList.remove('active');
        }
    });

    if (syncUrl) {
        updateLeadsUrlParams({ sub: currentSubfilter });
    }

    applyCurrentSubfilter();
};

function applyCurrentSubfilter() {
    if (!window.allLeadsCache) return;
    let list = [...window.allLeadsCache];

    const hasSubfilterSupport = (currentMainFilter === 'APPROVED' || currentMainFilter === 'AUDITED' || currentMainFilter === 'ALL');

    if (hasSubfilterSupport) {
        if (currentSubfilter === 'MOBILE') {
            list = list.filter(l => l.phone_type === 'mobile' && l.sms_eligible !== false);
        } else if (currentSubfilter === 'LANDLINE') {
            list = list.filter(l => l.phone_type === 'landline' || l.sms_eligible === false);
        } else if (currentSubfilter === 'UNKNOWN') {
            list = list.filter(l => (!l.phone_type || l.phone_type === 'unknown') && Boolean(l.phone || l.phone_number));
        }
    }

    window.currentFilteredLeads = list;
    renderLeads(list);
}

function updateSubfilterCounts(leads) {
    const list = leads || [];
    const countAll = list.length;
    const countMobile = list.filter(l => l.phone_type === 'mobile' && l.sms_eligible !== false).length;
    const countLandline = list.filter(l => l.phone_type === 'landline' || l.sms_eligible === false).length;
    const countUnknown = list.filter(l => (!l.phone_type || l.phone_type === 'unknown') && Boolean(l.phone || l.phone_number)).length;

    const elAll = document.getElementById('subfilter-count-all');
    const elMobile = document.getElementById('subfilter-count-mobile');
    const elLandline = document.getElementById('subfilter-count-landline');
    const elUnknown = document.getElementById('subfilter-count-unknown');

    if (elAll) elAll.textContent = countAll;
    if (elMobile) elMobile.textContent = countMobile;
    if (elLandline) elLandline.textContent = countLandline;
    if (elUnknown) elUnknown.textContent = countUnknown;
}

// Master Switch: Load, Update UI, Toggle
window.isMasterAutoSmsEnabled = true;

window.loadMasterAutoSmsStatus = async () => {
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sms/auto-send-status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        const isEnabled = data.success ? data.autoSendEnabled : true;
        window.isMasterAutoSmsEnabled = isEnabled;
        window.updateMasterAutoSmsUI(isEnabled);
    } catch (_) {
        window.updateMasterAutoSmsUI(true);
    }
};

window.updateMasterAutoSmsUI = (isEnabled) => {
    const btn = document.getElementById('btn-master-auto-sms');
    const label = document.getElementById('master-auto-sms-label');
    const dot = btn?.querySelector('.status-dot');
    if (!btn) return;

    if (isEnabled) {
        btn.className = 'btn btn-sm auto-sms-toggle-btn active';
        btn.style.borderColor = 'rgba(34,197,94,0.4)';
        btn.style.background = 'rgba(34,197,94,0.12)';
        btn.style.color = '#4ADE80';
        if (label) label.textContent = 'SMS Auto : ACTIF';
        if (dot) {
            dot.style.background = '#22C55E';
            dot.style.boxShadow = '0 0 8px #22C55E';
        }
    } else {
        btn.className = 'btn btn-sm auto-sms-toggle-btn paused';
        btn.style.borderColor = 'rgba(239,68,68,0.4)';
        btn.style.background = 'rgba(239,68,68,0.12)';
        btn.style.color = '#FCA5A5';
        if (label) label.textContent = 'SMS Auto : EN PAUSE';
        if (dot) {
            dot.style.background = '#EF4444';
            dot.style.boxShadow = '0 0 8px #EF4444';
        }
    }
};

window.toggleMasterAutoSms = async () => {
    const nextState = !window.isMasterAutoSmsEnabled;
    window.isMasterAutoSmsEnabled = nextState;
    window.updateMasterAutoSmsUI(nextState);

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sms/toggle-auto-send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ enabled: nextState })
        });
        const data = await resp.json();
        if (data.success) {
            showToast(data.message || (nextState ? "Envois automatiques de SMS activés." : "Envois automatiques de SMS suspendus."), nextState ? "success" : "warning");
        }
    } catch (e) {
        console.error("Toggle Auto SMS Error:", e);
        showToast("Erreur de synchronisation du Master Switch", "error");
    }
};

// Batch Verify Approved Phones
window.batchVerifyApprovedPhones = async () => {
    if (!window.allLeadsCache) return;
    const unverifiedLeads = window.allLeadsCache.filter(l => (!l.phone_type || l.phone_type === 'unknown') && Boolean(l.phone || l.phone_number));
    
    if (unverifiedLeads.length === 0) {
        showToast("Tous les leads de cette liste sont déjà qualifiés !", "info");
        return;
    }

    const leadIds = unverifiedLeads.map(l => l.id).slice(0, 15);
    showToast(`Qualification de ${leadIds.length} numéros via Telnyx en cours...`, "info");

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/leads/batch-validate-phones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ leadIds })
        });
        const data = await resp.json();
        if (data.success && data.results) {
            let mobilesCount = 0;
            let landlinesCount = 0;
            data.results.forEach(res => {
                syncLeadInAllCaches(res.leadId, {
                    phone_type: res.phone_type,
                    carrier_name: res.carrier_name,
                    sms_eligible: res.sms_eligible,
                    recommended_channel: res.recommended_channel,
                    phone_validated_at: res.checked_at
                });
                if (res.phone_type === 'mobile') mobilesCount++;
                else if (res.phone_type === 'landline') landlinesCount++;
            });

            updateSubfilterCounts(window.allLeadsCache);
            applyCurrentSubfilter();
            showToast(`${data.results.length} numéro(s) qualifié(s) : ${mobilesCount} Mobile(s) 📱, ${landlinesCount} Ligne(s) Fixe(s) ☎️`, "success");
        }
    } catch (e) {
        console.error("Batch verify error:", e);
        showToast("Erreur lors de la qualification par lot : " + e.message, "error");
    }
};

// Global state for view mode
let currentViewMode = (() => {
    try {
        return localStorage.getItem('erp_leads_view_mode') || 'list';
    } catch (e) {
        return 'list';
    }
})();

window.setViewMode = (mode) => {
    currentViewMode = mode;
    try {
        localStorage.setItem('erp_leads_view_mode', mode);
    } catch (e) {}

    const btnGrid = document.getElementById('btn-view-grid');
    const btnList = document.getElementById('btn-view-list');
    if (btnGrid) btnGrid.className = `view-toggle-btn ${mode === 'grid' ? 'active' : ''}`;
    if (btnList) btnList.className = `view-toggle-btn ${mode === 'list' ? 'active' : ''}`;

    renderLeads(window.currentFilteredLeads || window.allLeadsCache);
};

window.allLeadsCache = [];
window.currentFilteredLeads = null;

window.handleLeadSearch = (query) => {
    if (!query || !query.trim()) {
        window.currentFilteredLeads = window.allLeadsCache;
        renderLeads(window.allLeadsCache);
        return;
    }

    const options = {
        keys: [
            'business_name',
            'city',
            'state',
            'category',
            'dm_name',
            'phone',
            'discovered_query'
        ],
        threshold: 0.35,
        ignoreLocation: true
    };

    const fuse = new Fuse(window.allLeadsCache, options);
    const results = fuse.search(query.trim());
    const filtered = results.map(r => r.item);

    window.currentFilteredLeads = filtered;
    renderLeads(filtered);
};

function renderLeads(leads) {
    const listContainer = document.getElementById('leads-list-container');
    if (!listContainer) return;

    window.currentFilteredLeads = leads;

    if (!leads || leads.length === 0) {
        listContainer.innerHTML = `
            <div style="background:var(--bg-card); border: 1px solid rgba(255,255,255,0.06); border-radius:12px; padding:3.5rem 1.5rem; text-align:center;">
                <div style="color:var(--gold); margin-bottom:0.75rem; display:flex; justify-content:center;">
                    ${SVG_ICONS.target}
                </div>
                <div class="text-h" style="font-size:1.1rem; color:var(--text-main); margin-bottom:0.25rem;">Aucun prospect dans cette vue</div>
                <p class="text-xs text-muted" style="margin-bottom:1.25rem;">Ajustez vos filtres ci-dessus ou lancez le Lead Hunter pour sourcer de nouvelles entreprises.</p>
                <button class="btn btn-primary btn-sm" onclick="window.location.hash='#leadhunter'" style="display:inline-flex; align-items:center; gap:6px;">
                    ${SVG_ICONS.sparkles} Ouvrir le Lead Hunter
                </button>
            </div>
        `;
        return;
    }

    // LIST VIEW MODE (Strict CSS Grid alignment across all rows)
    if (currentViewMode === 'list') {
        let rowsHtml = '';
        leads.forEach((data) => {
            const statusCfg = getStatusConfig(data.status);
            const regionBadge = formatRegionBadge(data);
            const catBadge = formatCategoryBadge(data);
            const scoreBadge = formatScoreBadge(data);
            const sequenceBadge = formatSequenceBadge(data);
            const phoneBadge = formatPhoneBadge(data);

            const ratingHtml = data.google_rating 
                ? `<span style="display:inline-flex; align-items:center; gap:3px; font-weight:600; color:var(--gold); font-size:0.82rem;">
                     ${SVG_ICONS.star} ${data.google_rating} <span class="text-muted" style="font-weight:400; font-size:0.75rem;">(${data.google_reviews_count || 0})</span>
                   </span>`
                : `<span class="text-muted text-xs" style="opacity:0.45; padding-left:2px;">—</span>`;

            const safePhone = (data.phone || '').replace(/'/g, "\\'");
            const safeName = (data.business_name || '').replace(/'/g, "\\'");
            const isLandline = data.phone_type === 'landline' || data.sms_eligible === false;
            const hasPhone = Boolean(data.phone && String(data.phone).trim());
            const carrierLabel = (data.carrier_name || data.phone_carrier || 'Ligne Fixe').replace(/'/g, "\\'");

            rowsHtml += `
                <div class="lead-row-clean" data-lead-id="${data.id}" onclick="openLeadDetail('${data.id}')">
                    <!-- Col 1: Entreprise & Profil -->
                    <div class="lead-col-info">
                        <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                            <span class="lead-title truncate" title="${escapeHtml(data.business_name)}" style="color:#FFFFFF; font-weight:600; font-size:0.9rem;">${escapeHtml(data.business_name)}</span>
                            <span class="lead-status-pill ${statusCfg.className}">${statusCfg.label}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px; margin-top:3px; flex-wrap:wrap;">
                            ${regionBadge}
                            ${formatLanguageBadge(data)}
                            ${catBadge}
                            ${phoneBadge}
                        </div>
                    </div>

                    <!-- Col 2: Avis Google -->
                    <div class="lead-col-rating">
                        ${ratingHtml}
                    </div>

                    <!-- Col 3: Qualification IA & Séquence -->
                    <div class="lead-col-ai">
                        <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                            ${scoreBadge || sequenceBadge ? `${scoreBadge || ''} ${sequenceBadge || ''}` : '<span class="text-muted text-xs" style="opacity:0.45; padding-left:2px;">—</span>'}
                        </div>
                        ${formatNextSendBadge(data)}
                    </div>

                    <!-- Col 4: Décideur -->
                    <div class="lead-col-dm" title="${escapeHtml(data.dm_name || 'Dirigeant à qualifier')}">
                        ${data.dm_name 
                            ? `<span style="color:#94A3B8; display:inline-flex;">${SVG_ICONS.user}</span> <strong class="truncate" style="color:var(--text-main); font-size:0.82rem;">${escapeHtml(data.dm_name)}</strong>` 
                            : '<span class="text-muted truncate" style="font-size:0.8rem; opacity:0.55;">Dirigeant à qualifier</span>'}
                    </div>

                    <!-- Col 5: Actions Rapides -->
                    <div class="lead-col-actions" onclick="event.stopPropagation()">
                        ${!hasPhone ? `
                            <button class="lead-action-btn sms-btn" style="opacity:0.35; cursor:not-allowed;" onclick="window.showToast('Aucun numéro de téléphone enregistré pour ce lead.', 'warning')" title="Aucun numéro disponible">
                                ${SVG_ICONS.sms} <span>SMS</span>
                            </button>
                        ` : isLandline ? `
                            <button class="lead-action-btn sms-btn landline-blocked" style="opacity:0.45; cursor:not-allowed; border-color:rgba(239,68,68,0.25);" onclick="window.showToast('☎️ Ligne Fixe détectée (${carrierLabel}) : les SMS ne peuvent être reçus. Privilégiez un appel direct.', 'warning')" title="☎️ Ligne fixe (${carrierLabel}) : SMS indisponible">
                                ${SVG_ICONS.sms} <span style="text-decoration:line-through; opacity:0.75;">SMS</span>
                            </button>
                        ` : `
                            <button class="lead-action-btn sms-btn" onclick="window.openSmsOutreachModal('${data.id}', '${safePhone}', '${safeName}', '${data.preferredLanguage || (window.detectLeadLanguage ? window.detectLeadLanguage(data) : 'en')}')" title="Envoyer un SMS IA via Twilio (+18193002831)">
                                ${SVG_ICONS.sms} <span>SMS</span>
                            </button>
                        `}
                        <button class="lead-action-btn gmail-btn" onclick="window.openGmailPitchModal('${data.id}')" title="Ouvrir un pitch pré-rempli dans Gmail (ou envoi serveur)">
                            ${SVG_ICONS.gmail} <span>Gmail</span>
                        </button>
                        ${isLandline ? `
                            <button class="lead-action-btn phone-btn highlight-landline-call" style="border-color: rgba(223, 165, 58, 0.65); color: var(--gold); background: rgba(223, 165, 58, 0.1);" onclick="window.openLeadCallModal('${data.id}')" title="☎️ Ligne fixe détectée : Privilégier un appel direct">
                                ${SVG_ICONS.phone} <span style="font-weight:600;">Appeler</span>
                            </button>
                        ` : `
                            <button class="lead-action-btn phone-btn" onclick="window.openLeadCallModal('${data.id}')" title="Appeler directement ou transférer vers Cold Call">
                                ${SVG_ICONS.phone} <span>Appel</span>
                            </button>
                        `}
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = `
            <div class="leads-list-wrapper">
                <div id="leads-grid-wrapper" class="leads-list-clean">
                    <div class="leads-table-header">
                        <div class="lead-col-info">Entreprise & Catégorie</div>
                        <div class="lead-col-rating">Avis Google</div>
                        <div class="lead-col-ai">Audit IA & Séquence</div>
                        <div class="lead-col-dm">Décideur</div>
                        <div class="lead-col-actions">Actions</div>
                    </div>
                    ${rowsHtml}
                </div>
            </div>
        `;
        return;
    }

    // GRID VIEW MODE
    let html = '';
    leads.forEach((data) => {
        const statusCfg = getStatusConfig(data.status);
        const regionBadge = formatRegionBadge(data);
        const catBadge = formatCategoryBadge(data);
        const scoreBadge = formatScoreBadge(data);
        const sequenceBadge = formatSequenceBadge(data);
        const phoneBadge = formatPhoneBadge(data);

        // Rating
        const ratingHtml = data.google_rating 
            ? `<span style="display:inline-flex; align-items:center; gap:3px; font-weight:600; color:var(--gold); font-size:0.8rem;">
                 ${SVG_ICONS.star} ${data.google_rating} <span class="text-muted" style="font-weight:400; font-size:0.75rem;">(${data.google_reviews_count || 0})</span>
               </span>`
            : `<span class="text-muted text-xs">—</span>`;

        // Safe strings for inline handlers
        const safePhone = (data.phone || '').replace(/'/g, "\\'");
        const safeName = (data.business_name || '').replace(/'/g, "\\'");
        const isLandline = data.phone_type === 'landline' || data.sms_eligible === false;
        const hasPhone = Boolean(data.phone && String(data.phone).trim());
        const carrierLabel = (data.carrier_name || data.phone_carrier || 'Ligne Fixe').replace(/'/g, "\\'");

        html += `
            <div class="lead-card-clean" data-lead-id="${data.id}" onclick="openLeadDetail('${data.id}')">
                <!-- Card Header -->
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
                    <div style="min-width:0; flex:1;">
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <span class="lead-title truncate" title="${escapeHtml(data.business_name)}">${escapeHtml(data.business_name)}</span>
                            <span class="lead-status-pill ${statusCfg.className}">${statusCfg.label}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px; margin-top:4px; flex-wrap:wrap;">
                            ${regionBadge}
                            ${formatLanguageBadge(data)}
                            ${catBadge}
                            ${phoneBadge}
                        </div>
                    </div>
                    <div style="text-align:right; flex-shrink:0;">
                        ${ratingHtml}
                    </div>
                </div>

                <!-- AI Insights & Contact Line -->
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin: 8px 0; padding: 6px 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 7px; font-size:0.75rem;">
                    <div style="display:flex; flex-direction:column; gap:3px;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            ${scoreBadge}
                            ${sequenceBadge}
                        </div>
                        ${formatNextSendBadge(data)}
                    </div>
                    <div class="text-muted truncate" style="max-width:180px; display:flex; align-items:center; gap:4px;" title="${escapeHtml(data.dm_name || 'Dirigeant à qualifier')}">
                        ${data.dm_name ? `${SVG_ICONS.user} <strong style="color:var(--text-main);">${escapeHtml(data.dm_name)}</strong>` : '<span style="opacity:0.55;">Dirigeant à qualifier</span>'}
                    </div>
                </div>

                <!-- 3 Master Actions Footer -->
                <div style="margin-top:auto; padding-top:10px; border-top:1px solid rgba(255,255,255,0.05); display:grid; grid-template-columns: 1fr 1fr 1fr; gap:6px;" onclick="event.stopPropagation()">
                    ${!hasPhone ? `
                        <button class="lead-action-btn sms-btn" style="opacity:0.35; cursor:not-allowed;" onclick="window.showToast('Aucun numéro de téléphone enregistré pour ce lead.', 'warning')" title="Aucun numéro disponible">
                            ${SVG_ICONS.sms} <span>SMS</span>
                        </button>
                    ` : isLandline ? `
                        <button class="lead-action-btn sms-btn landline-blocked" style="opacity:0.45; cursor:not-allowed; border-color:rgba(239,68,68,0.25);" onclick="window.showToast('☎️ Ligne Fixe détectée (${carrierLabel}) : les SMS ne peuvent être reçus. Privilégiez un appel direct.', 'warning')" title="☎️ Ligne fixe (${carrierLabel}) : SMS indisponible">
                            ${SVG_ICONS.sms} <span style="text-decoration:line-through; opacity:0.75;">SMS</span>
                        </button>
                    ` : `
                        <button class="lead-action-btn sms-btn" onclick="window.openSmsOutreachModal('${data.id}', '${safePhone}', '${safeName}', '${data.preferredLanguage || (window.detectLeadLanguage ? window.detectLeadLanguage(data) : 'en')}')" title="Envoyer un SMS IA via Twilio (+18193002831)">
                            ${SVG_ICONS.sms} <span>SMS</span>
                        </button>
                    `}
                    <button class="lead-action-btn gmail-btn" onclick="window.openGmailPitchModal('${data.id}')" title="Ouvrir un pitch pré-rempli dans Gmail (ou envoi serveur)">
                        ${SVG_ICONS.gmail} <span>Gmail</span>
                    </button>
                    ${isLandline ? `
                        <button class="lead-action-btn phone-btn highlight-landline-call" style="border-color: rgba(223, 165, 58, 0.65); color: var(--gold); background: rgba(223, 165, 58, 0.1);" onclick="window.openLeadCallModal('${data.id}')" title="☎️ Ligne fixe détectée : Privilégier un appel direct">
                            ${SVG_ICONS.phone} <span style="font-weight:600;">Appeler</span>
                        </button>
                    ` : `
                        <button class="lead-action-btn phone-btn" onclick="window.openLeadCallModal('${data.id}')" title="Appeler directement ou transférer vers Cold Call">
                            ${SVG_ICONS.phone} <span>Appel</span>
                        </button>
                    `}
                </div>
            </div>
        `;
    });

    listContainer.innerHTML = `
        <div id="leads-grid-wrapper" class="leads-grid-clean">
            ${html}
        </div>
    `;
}

let masterLeadsCache = null;
window.masterLeadsCache = masterLeadsCache;

// Universal Lead Cache Synchronizer: guarantees data consistency across ALL memory caches & views
function syncLeadInAllCaches(leadId, patch) {
    if (!leadId || !patch) return;
    if (Array.isArray(masterLeadsCache)) {
        const leadM = masterLeadsCache.find(l => l.id === leadId);
        if (leadM) Object.assign(leadM, patch);
    }
    if (Array.isArray(window.masterLeadsCache)) {
        const leadWM = window.masterLeadsCache.find(l => l.id === leadId);
        if (leadWM) Object.assign(leadWM, patch);
    }
    if (Array.isArray(window.allLeadsCache)) {
        const leadA = window.allLeadsCache.find(l => l.id === leadId);
        if (leadA) Object.assign(leadA, patch);
    }
    if (Array.isArray(window.currentFilteredLeads)) {
        const leadF = window.currentFilteredLeads.find(l => l.id === leadId);
        if (leadF) Object.assign(leadF, patch);
    }
}
window.syncLeadInAllCaches = syncLeadInAllCaches;

function updateFilterCounts(leads) {
    const list = leads || masterLeadsCache || [];
    const counts = {
        ALL: list.length,
        NEW: 0,
        AUDITED: 0,
        APPROVED: 0,
        CONTACTED: 0,
        INTERESTED: 0,
        COLD_NURTURE: 0,
        MEETING_SCHEDULED: 0,
        CLIENT: 0,
        REJECTED: 0
    };

    list.forEach(l => {
        const status = (l.status || 'NEW').toUpperCase();
        if (status === 'NEW') counts.NEW++;
        else if (status === 'APPROVED') counts.APPROVED++;
        else if (status === 'CONTACTED') counts.CONTACTED++;
        else if (status === 'INTERESTED') counts.INTERESTED++;
        else if (status === 'COLD_NURTURE') counts.COLD_NURTURE++;
        else if (status === 'MEETING_SCHEDULED') counts.MEETING_SCHEDULED++;
        else if (status === 'CLIENT') counts.CLIENT++;
        else if (status === 'REJECTED' || status === 'ARCHIVED') counts.REJECTED++;

        if (l.lastAudit || l.audit_date || l.confidence_score !== undefined || l.leadCategory) {
            counts.AUDITED++;
        }
    });

    Object.entries(counts).forEach(([key, count]) => {
        const el = document.getElementById(`count-filter-${key}`);
        if (el) el.textContent = count;
    });

    const counterEl = document.getElementById('leads-total-counter');
    if (counterEl) {
        counterEl.innerText = `${list.length} ${list.length > 1 ? 'leads' : 'lead'}`;
    }
}

let leadsSnapshotUnsubscribe = null;

export function cleanupLeadsRealtime() {
    if (typeof leadsSnapshotUnsubscribe === 'function') {
        leadsSnapshotUnsubscribe();
        leadsSnapshotUnsubscribe = null;
        console.log("[Leads Module] Real-time Firestore listener successfully detached.");
    }
}
window.cleanupLeadsRealtime = cleanupLeadsRealtime;

function filterAndRenderActiveLeads(statusFilter) {
    if (!masterLeadsCache) return;

    window.allLeadsCache = [];
    if (statusFilter === 'ALL') {
        window.allLeadsCache = [...masterLeadsCache];
    } else if (statusFilter === 'AUDITED') {
        window.allLeadsCache = masterLeadsCache.filter(l => Boolean(l.lastAudit || l.audit_date || l.confidence_score !== undefined || l.leadCategory));
    } else {
        window.allLeadsCache = masterLeadsCache.filter(l => (l.status || 'NEW').toUpperCase() === statusFilter);
    }

    currentMainFilter = statusFilter;
    const subfiltersBar = document.getElementById('leads-subfilters-bar');
    if (subfiltersBar) {
        if (statusFilter === 'APPROVED' || statusFilter === 'AUDITED' || statusFilter === 'ALL') {
            subfiltersBar.style.display = 'flex';
            updateSubfilterCounts(window.allLeadsCache);
        } else {
            subfiltersBar.style.display = 'none';
        }
    }

    applyCurrentSubfilter();
}

async function loadLeads(statusFilter = 'ALL', forceRefresh = false) {
    const listContainer = document.getElementById('leads-list-container');
    if (!listContainer) return;

    currentMainFilter = statusFilter;

    const searchInput = document.getElementById('lead-search-input');
    if (searchInput) searchInput.value = '';

    // If real-time listener is already running and cache exists, instant in-memory tab switch
    if (masterLeadsCache && masterLeadsCache.length > 0 && !forceRefresh && leadsSnapshotUnsubscribe) {
        filterAndRenderActiveLeads(statusFilter);
        return;
    }

    cleanupLeadsRealtime();
    listContainer.innerHTML = `<div class="text-center text-muted mt-4">${t('leads_fetching')}</div>`;

    try {
        const q = query(collection(db, "leads"));
        leadsSnapshotUnsubscribe = onSnapshot(q, (querySnapshot) => {
            const modifiedLeadIds = [];
            const isInitial = !masterLeadsCache || masterLeadsCache.length === 0;

            if (isInitial) {
                masterLeadsCache = [];
                querySnapshot.forEach(docSnap => {
                    masterLeadsCache.push({ ...docSnap.data(), id: docSnap.id });
                });
            } else {
                // Reactive incremental sync
                querySnapshot.docChanges().forEach(change => {
                    const leadData = { ...change.doc.data(), id: change.doc.id };
                    const idx = masterLeadsCache.findIndex(l => l.id === change.doc.id);

                    if (change.type === 'added') {
                        if (idx === -1) masterLeadsCache.push(leadData);
                        else masterLeadsCache[idx] = leadData;
                        modifiedLeadIds.push(change.doc.id);
                    } else if (change.type === 'modified') {
                        if (idx !== -1) masterLeadsCache[idx] = leadData;
                        else masterLeadsCache.push(leadData);
                        modifiedLeadIds.push(change.doc.id);
                    } else if (change.type === 'removed') {
                        if (idx !== -1) masterLeadsCache.splice(idx, 1);
                    }
                });
            }

            window.masterLeadsCache = masterLeadsCache;

            // Client-side Sort (Newest First)
            masterLeadsCache.sort((a, b) => {
                const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
                const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
                return dateB - dateA;
            });

            // Update Counter Badges on every filter button in real-time
            updateFilterCounts(masterLeadsCache);

            // Filter & Render
            filterAndRenderActiveLeads(currentMainFilter);

            // Auto-open lead detail if ID was in URL on initial load
            if (isInitial) {
                const initialParams = getLeadsUrlParams();
                if (initialParams.id) {
                    const leadToOpen = masterLeadsCache.find(l => l.id === initialParams.id);
                    const overlay = document.getElementById('lead-detail-overlay');
                    const isAlreadyOpen = overlay && overlay.querySelector(`[data-lead-detail-id="${initialParams.id}"]`);
                    if (leadToOpen && !isAlreadyOpen) {
                        openLeadDetail(leadToOpen, false);
                    }
                }
            }

            // Visual feedback: glow effect on modified rows
            if (!isInitial && modifiedLeadIds.length > 0) {
                requestAnimationFrame(() => {
                    modifiedLeadIds.forEach(id => {
                        const row = document.querySelector(`[data-lead-id="${id}"]`);
                        if (row) {
                            row.classList.remove('lead-row-updated-glow');
                            void row.offsetWidth; // trigger reflow
                            row.classList.add('lead-row-updated-glow');
                        }
                    });
                });
            }
        }, (err) => {
            console.error('[Leads Module] Firestore real-time error:', err);
            listContainer.innerHTML = `<div class="text-danger" style="text-align:center; padding:2rem;">${t('leads_error_loading')}</div>`;
        });
    } catch (e) {
        console.error('Error attaching leads real-time listener:', e);
        listContainer.innerHTML = `<div class="text-danger" style="text-align:center; padding:2rem;">${t('leads_error_loading')}</div>`;
    }
}

// --- DETAIL VIEW LOGIC ---

window.openLeadDetail = async (data, updateUrl = true) => {
    let lead;
    if (typeof data === 'object' && data !== null) {
        lead = data;
    } else if (typeof data === 'string') {
        const leadId = data;
        if (window.allLeadsCache) {
            lead = window.allLeadsCache.find(l => l.id === leadId);
        }
        if (!lead && masterLeadsCache) {
            lead = masterLeadsCache.find(l => l.id === leadId);
        }
        if (!lead && window.masterLeadsCache) {
            lead = window.masterLeadsCache.find(l => l.id === leadId);
        }
        if (!lead) {
            try {
                lead = JSON.parse(decodeURIComponent(data));
            } catch (e) { }
        }
    }

    // Always merge latest fields from cache if lead is already in memory
    if (lead && lead.id) {
        const cachedLead = (window.allLeadsCache || []).find(l => l.id === lead.id) || (masterLeadsCache || []).find(l => l.id === lead.id);
        if (cachedLead) {
            lead = Object.assign({}, cachedLead, lead);
        }
    }

    if (!lead) return;
    const overlay = document.getElementById('lead-detail-overlay');

    // Website URL or Fallback for Iframe
    // Note: Many sites block iframe (X-Frame-Options). We handle this by showing a message if it fails, or just linking out.
    // For "Preview", we can try to show it.
    // Verify we intend to start the timer (in case user navigated away fast)
    startLoadTimer();

    // Sync URL with lead ID while preserving current filter & subfilter
    if (updateUrl) {
        updateLeadsUrlParams({ id: lead.id }, false);
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

    const teamOptions = await getTeamDropdownOptions(lead.assigned_agent_id);
    const enriched = lead.enriched_data || {};
    const hasEnrichment = Object.keys(enriched).length > 0;
    const savedSidebarWidth = localStorage.getItem('erp_lead_detail_sidebar_width') || '520px';
    const leadLang = lead.preferredLanguage || (window.detectLeadLanguage ? window.detectLeadLanguage(lead) : 'en');

    overlay.innerHTML = `
        <div class="detail-overlay" data-lead-detail-id="${lead.id}" style="flex-direction: row; padding:0; height: 100%; max-height: 100vh; overflow: hidden;">
            
            <!-- 1. FULL HEIGHT SIDEBAR (Left) -->
            <div class="detail-sidebar" id="lead-sidebar" style="width: ${savedSidebarWidth}; min-width: 380px; max-width: 900px; background: var(--bg-card); border-right: 1px solid var(--border); position: relative; height: 100%; max-height: 100vh; overflow: hidden; display: flex; flex-direction: column; z-index: 20;">
                
                <!-- SCROLLABLE BODY (Padding-bottom ensures content is never covered by floating action bar) -->
                <div style="flex: 1; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; padding-bottom: 78px;">

                <!-- SECTION 1: IDENTITY -->
                <div style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border);">
                    <div class="form-group" style="margin-bottom: 8px;">
                        <label class="form-label">${t('leads_business_name')}</label>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="text" id="edit-business-name" class="form-input" value="${escapeHtml(lead.business_name)}" style="font-weight: 600; border-color: rgba(223, 165, 58, 0.2); padding: 8px 12px; font-size: 1rem; flex: 1;">
                            <button id="lead-google-search" class="btn btn-sm" onclick="window.open('https://www.google.com/search?q=${encodeURIComponent(lead.business_name + ' ' + (lead.city || ''))}+contact+phone+email', '_blank')" 
                                    style="padding: 8px; min-width: 40px; display: flex; align-items: center; justify-content: center; background: rgba(223,165,58,0.1); border-color: rgba(223,165,58,0.2);" title="Search Google">
                                <span class="material-icons" style="font-size: 1.2rem; color: var(--gold);">search</span>
                            </button>
                        </div>
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
        const isDir = lead.leadCategory === 'directory_only' || lead.has_directory_only;
        const isSelected = lead.pain_signals && (lead.pain_signals.includes(p) || (p === 'NO_WEBSITE' && isDir)) ? 'selected' : '';
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
                        <div style="display:flex; align-items:center; gap:6px; background: rgba(0,0,0,0.2); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border);">
                            <span class="material-icons text-muted" style="font-size:1rem;">phone</span>
                            <input type="text" id="edit-phone" class="form-input" style="border:none; background:transparent; padding:4px; font-size: 0.85rem; flex:1; min-width:0;" value="${escapeHtml(lead.phone || '')}" placeholder="${t('leads_phone')}">
                            ${lead.phone ? `
                                <div id="lead-phone-badge-slot" style="flex-shrink:0;">
                                    ${lead.phone_type === 'mobile' 
                                        ? `<span class="badge" style="background:rgba(34,197,94,0.15); color:#4ADE80; font-size:0.68rem; padding:2px 6px; border-radius:4px; font-weight:600;" title="${escapeHtml(lead.carrier_name || 'Opérateur Mobile')}">📱 Mobile</span>`
                                        : (lead.phone_type === 'landline'
                                            ? `<span class="badge" style="background:rgba(148,163,184,0.15); color:#94A3B8; font-size:0.68rem; padding:2px 6px; border-radius:4px; font-weight:600;" title="${escapeHtml(lead.carrier_name || 'Ligne Fixe')}">☎️ Fixe</span>`
                                            : `<button type="button" class="btn btn-xs" onclick="window.verifyLeadPhone('${lead.id}')" style="background:rgba(223,165,58,0.12); color:var(--gold); border:1px solid rgba(223,165,58,0.3); font-size:0.68rem; padding:2px 6px; border-radius:4px; font-weight:600;" title="Qualifier la ligne avec Telnyx Lookup (Mobile vs Fixe)">Vérifier</button>`
                                        )
                                    }
                                </div>
                            ` : ''}
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; background: rgba(0,0,0,0.2); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border);">
                            <span class="material-icons text-muted" style="font-size:1rem;">email</span>
                            <input type="text" id="edit-email" class="form-input" style="border:none; background:transparent; padding:4px; font-size: 0.85rem;" value="${escapeHtml(lead.email || '')}" placeholder="${t('leads_public_email')}">
                        </div>
                    </div>

                    <!-- PREFERRED LANGUAGE SELECTOR & INDICATOR -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
                        <div style="display:flex; align-items:center; gap:8px; background: rgba(0,0,0,0.2); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border);">
                            <span class="material-icons text-muted" style="font-size:1rem;">translate</span>
                            <select id="edit-preferred-language" class="form-input" style="border:none; background:transparent; padding:4px; font-size: 0.85rem; color:var(--text-main); cursor:pointer; width:100%;" onchange="window.handleLeadLanguageChange(this.value, '${lead.id}')">
                                <option value="fr" ${leadLang === 'fr' ? 'selected' : ''}>🇫🇷 Français</option>
                                <option value="en" ${leadLang === 'en' ? 'selected' : ''}>🇺🇸 English</option>
                            </select>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px; background: rgba(223,165,58,0.06); border: 1px solid rgba(223,165,58,0.2); padding: 4px 10px; border-radius: 6px; font-size:0.75rem; color:#E2E8F0;">
                            <span class="material-icons text-gold" style="font-size:14px;">sms</span>
                            <span id="lead-language-status-text" style="font-weight:600;">SMS : ${leadLang === 'fr' ? '🇫🇷 Français' : '🇺🇸 English'}</span>
                        </div>
                    </div>

                    ${lead.website ? `
                    <div style="margin-top: 8px;">
                        <button type="button" class="btn btn-xs ${(!lead.phone || !lead.email) ? 'btn-outline-gold' : 'btn-secondary'}" onclick="window.enrichLeadContactsFromWebsite('${lead.id}')" style="display:flex; align-items:center; justify-content:center; gap:6px; width:100%; padding:5px 10px; font-weight:700; font-size:0.78rem;" title="Scrape le site web pour extraire automatiquement le téléphone et l'email">
                            <span class="material-icons" style="font-size:14px;">travel_explore</span> ${(!lead.phone || !lead.email) ? 'Scanner Contacts Web (Tél & Email)' : 'Re-scanner Coordonnées Web'}
                        </button>
                    </div>
                    ` : ''}
                </div>

                <!-- SECTION 3: DECISION MAKER -->
                <div style="padding: 1rem; border-bottom: 1px solid var(--border); background: rgba(223, 165, 58, 0.02);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                        <div class="text-xs text-gold uppercase tracking-wider font-bold" style="letter-spacing: 1px;">${t('leads_governance')}</div>
                        <button type="button" id="btn-enrich-dm-${lead.id}" class="btn btn-xs btn-outline-gold" style="font-size: 0.68rem; padding: 2px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; font-weight: 600;" onclick="window.enrichLeadDecisionMakerWithPerplexity('${lead.id}')" title="Rechercher automatiquement le propriétaire/dirigeant via Perplexity Agent API (Recherche Web en direct)">
                            <span class="material-icons" style="font-size: 13px;">travel_explore</span> Décideur (Perplexity)
                        </button>
                    </div>

                    <div id="dm-source-badge-${lead.id}">
                        ${lead.dm_source_summary ? `
                            <div style="font-size:0.68rem; color:#94A3B8; margin-bottom:6px; font-style:italic; background:rgba(0,0,0,0.25); padding:3px 6px; border-radius:4px; border:1px solid rgba(223,165,58,0.2);">
                                🔍 Source Perplexity : ${escapeHtml(lead.dm_source_summary)}
                            </div>
                        ` : ''}
                    </div>
                    
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
                            ${teamOptions}
                        </select>
                    </div>


                </div>

                <!-- SECTION 4: STRATEGIC NOTES -->
                <div style="padding: 1rem; border-bottom: 1px solid var(--border);">
                        <div class="text-xs text-muted uppercase tracking-wider mb-2 font-bold" style="letter-spacing: 1px;">${t('leads_strategic_notes')}</div>
                        <textarea id="edit-notes" class="form-input" rows="3" style="font-size: 0.85rem; background: rgba(0,0,0,0.15); border-style: dashed; padding: 8px;" placeholder="${t('leads_notes_placeholder')}">${escapeHtml(lead.notes || '')}</textarea>
                </div>

                <!-- AUDIT IA -->
                <div style="padding: 1rem; border-bottom: 1px solid var(--border); background: rgba(223, 165, 58, 0.04);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                        <div class="text-xs text-gold uppercase tracking-wider font-bold" style="letter-spacing: 1px; display:flex; align-items:center; gap:6px;">
                            ${SVG_ICONS.sparkles}
                            Audit IA
                        </div>
                        <div>
                            ${lead.confidence_score !== undefined
                                ? `<span class="badge" style="border:1px solid ${lead.confidence_score >= 85 ? '#21BA45' : '#F2C037'}; color:${lead.confidence_score >= 85 ? '#21BA45' : '#F2C037'}; background:rgba(0,0,0,0.3); font-size:11px;">🎯 ${lead.confidence_score}% Confiance</span>`
                                : '<span class="badge text-muted" style="font-size:11px;">Non audité</span>'}
                        </div>
                    </div>

                    ${lead.audit_date ? `
                    <div style="background:rgba(0,0,0,0.25); border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <span class="text-xs text-muted">Profil qualifié :</span>
                            <span class="badge" style="background:${(lead.leadCategory === 'directory_only' || lead.has_directory_only) ? 'rgba(239,68,68,0.15)' : (lead.leadCategory === 'missing_gmb_website' || lead.google_business_missing_website) ? 'rgba(245,158,11,0.2)' : 'rgba(223,165,58,0.15)'}; color:${(lead.leadCategory === 'directory_only' || lead.has_directory_only) ? '#F87171' : (lead.leadCategory === 'missing_gmb_website' || lead.google_business_missing_website) ? '#FBBF24' : 'var(--gold)'}; border:1px solid ${(lead.leadCategory === 'directory_only' || lead.has_directory_only) ? '#F87171' : (lead.leadCategory === 'missing_gmb_website' || lead.google_business_missing_website) ? '#FBBF24' : 'var(--gold)'}; font-size:11px; font-weight:bold;">
                                ${escapeHtml(formatCategoryLabel(lead.leadCategory || lead.category))}
                            </span>
                        </div>
                        ${lead.isFranchise ? `
                            <div style="background:rgba(237,76,103,0.15); border:1px solid #ED4C67; color:#ED4C67; border-radius:6px; padding:6px 10px; font-size:0.8rem; font-weight:bold; margin-bottom:6px;">
                                🚫 FRANCHISE / CHAÎNE CORPORATIVE EXCLUE
                            </div>
                        ` : ''}
                        <div class="text-xs" style="color:var(--text-main); margin-bottom:6px; line-height:1.4;">
                            ${escapeHtml(lead.audit_summary || 'Aucune synthèse disponible.')}
                        </div>
                        <div class="text-xs text-muted" style="font-size:0.75rem;">
                            Vérification : ${escapeHtml(lead.anti_homonym_details || 'Vérification automatique')}
                        </div>
                    </div>
                    ` : ''}

                    <button class="btn btn-block btn-sm" id="btn-run-lead-audit" style="border-color: var(--gold); color: var(--gold); font-weight: bold; background: rgba(223, 165, 58, 0.1); font-size: 0.75rem; display:flex; align-items:center; justify-content:center; gap:6px;" onclick="window.auditSingleLeadNow('${lead.id}')">
                        ${SVG_ICONS.bolt}
                        ${lead.audit_date ? "Ré-auditer l'Entreprise (IA)" : "Lancer l'Audit IA"}
                    </button>
                </div>

                <!-- SECTION: SÉQUENCE SMS & PROSPECTION -->
                <div style="padding: 1rem; border-bottom: 1px solid var(--border); background: rgba(56, 189, 248, 0.03);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                        <div class="text-xs uppercase tracking-wider font-bold" style="color: #38BDF8; letter-spacing: 1px; display:flex; align-items:center; gap:6px;">
                            ${SVG_ICONS.sms}
                            Séquence SMS & Prospection
                        </div>
                        <div>
                            ${(lead.sequenceStatus === 'ACTIVE' || lead.activeSequenceId)
                                ? `<span class="badge" style="background:rgba(33,186,69,0.15); color:#21BA45; border:1px solid rgba(33,186,69,0.3); font-size:10px;">🟢 Active (${lead.smsStatus || 'Simulation'})</span>`
                                : (lead.sequenceStatus === 'STOPPED_REPLIED'
                                    ? `<span class="badge" style="background:rgba(56,189,248,0.15); color:#38BDF8; border:1px solid rgba(56,189,248,0.3); font-size:10px;">✋ Répondu</span>`
                                    : (lead.phone_type === 'landline' || lead.sms_eligible === false
                                        ? `<span class="badge" style="background:rgba(148,163,184,0.15); color:#94A3B8; border:1px solid rgba(148,163,184,0.3); font-size:10px;">☎️ Fixe (Non éligible SMS)</span>`
                                        : `<span class="badge text-muted" style="font-size:10px; background:rgba(255,255,255,0.05);">⚪ Prête à déclencher</span>`
                                    )
                                )
                            }
                        </div>
                    </div>

                    <!-- CASL / LCAP COMPLIANCE DOSSIER (Canada Anti-Spam Legislation) -->
                    ${(() => {
                        const casl = lead.casl;
                        if (!casl) {
                            return `
                            <div style="background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.1); border-radius:8px; padding:10px 12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span class="material-icons" style="font-size:18px; color:var(--text-muted);">verified_user</span>
                                    <div>
                                        <div style="font-size:0.75rem; font-weight:600; color:var(--text-main);">Dossier LCAP / CASL (Canada)</div>
                                        <div style="font-size:0.68rem; color:var(--text-muted);">Conformité non encore attestée</div>
                                    </div>
                                </div>
                                <button type="button" class="btn btn-xs btn-outline-gold" onclick="window.verifyLeadCasl('${lead.id}')" style="font-size:0.7rem; padding:3px 10px; border-radius:6px; font-weight:600;">
                                    Vérifier LCAP
                                </button>
                            </div>
                            `;
                        }
                        if (casl.status === 'ELIGIBLE') {
                            return `
                            <div style="background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.25); border-radius:8px; padding:10px 12px; margin-bottom:10px;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div style="display:flex; align-items:center; gap:6px; font-weight:700; color:#4ADE80; font-size:0.78rem;">
                                        <span class="material-icons" style="font-size:16px;">verified</span> 🇨🇦 LCAP : ÉLIGIBLE (Publication officielle)
                                    </div>
                                    <button type="button" class="btn btn-xs" style="background:transparent; border:1px solid rgba(74,222,128,0.3); color:#86EFAC; font-size:0.68rem; padding:2px 8px; border-radius:4px; cursor:pointer;" onclick="window.verifyLeadCasl('${lead.id}')" title="Re-scanner la conformité CASL">
                                        Re-vérifier
                                    </button>
                                </div>
                                <div style="font-size:0.72rem; color:#A7F3D0; margin-top:4px; line-height:1.35;">
                                    Numéro publié bien en vue sur le site officiel sans restriction (art. 10(9)(b) LCAP).
                                    ${casl.publication_context ? `<div style="font-size:0.68rem; color:#6EE7B7; font-style:italic; margin-top:3px; background:rgba(0,0,0,0.2); padding:3px 6px; border-radius:4px; font-family:monospace;">« ${escapeHtml(casl.publication_context)} »</div>` : ''}
                                    <div style="font-size:0.65rem; color:#94A3B8; margin-top:4px; font-family:monospace;">Preuve : ${escapeHtml(casl.evidence_hash || '')} &bull; ${casl.source_url ? `<a href="${escapeHtml(casl.source_url)}" target="_blank" style="color:#60A5FA; text-decoration:underline;">Source</a>` : ''} &bull; ${new Date(casl.captured_at || Date.now()).toLocaleDateString('fr-CA')}</div>
                                </div>
                            </div>
                            `;
                        }
                        if (casl.status === 'REVIEW') {
                            return `
                            <div style="background:rgba(234,179,8,0.08); border:1px solid rgba(234,179,8,0.25); border-radius:8px; padding:10px 12px; margin-bottom:10px;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div style="display:flex; align-items:center; gap:6px; font-weight:700; color:#FACC15; font-size:0.78rem;">
                                        <span class="material-icons" style="font-size:16px;">pending_actions</span> 🇨🇦 LCAP : À VÉRIFIER
                                    </div>
                                    <button type="button" class="btn btn-xs" style="background:rgba(234,179,8,0.15); border:1px solid rgba(234,179,8,0.4); color:#FDE047; font-size:0.68rem; padding:2px 8px; border-radius:4px; cursor:pointer;" onclick="window.verifyLeadCasl('${lead.id}')">
                                        Scanner Site
                                    </button>
                                </div>
                                <div style="font-size:0.72rem; color:#FEF08A; margin-top:4px; line-height:1.35;">
                                    ${escapeHtml(casl.notes || 'Publication non détectée avec certitude sur le site officiel. Envoi automatique suspendu.')}
                                </div>
                            </div>
                            `;
                        }
                        if (casl.status === 'INELIGIBLE') {
                            return `
                            <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:8px; padding:10px 12px; margin-bottom:10px;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div style="display:flex; align-items:center; gap:6px; font-weight:700; color:#F87171; font-size:0.78rem;">
                                        <span class="material-icons" style="font-size:16px;">block</span> 🇨🇦 LCAP : REFUSÉ
                                    </div>
                                    <button type="button" class="btn btn-xs" style="background:transparent; border:1px solid rgba(239,68,68,0.4); color:#FCA5A5; font-size:0.68rem; padding:2px 8px; border-radius:4px; cursor:pointer;" onclick="window.verifyLeadCasl('${lead.id}')">
                                        Re-scanner
                                    </button>
                                </div>
                                <div style="font-size:0.72rem; color:#FCA5A5; margin-top:4px; line-height:1.35;">
                                    ${escapeHtml(casl.notes || 'Sollicitation commerciale interdite par l\'entreprise.')}
                                </div>
                            </div>
                            `;
                        }
                        if (casl.status === 'NOT_APPLICABLE') {
                            return `
                            <div style="background:rgba(148,163,184,0.06); border:1px solid rgba(148,163,184,0.15); border-radius:8px; padding:8px 12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-size:0.75rem; color:#CBD5E1;">🇺🇸 <strong>USA</strong> &bull; Régie par 10DLC Telnyx (LCAP non applicable)</span>
                            </div>
                            `;
                        }
                        return '';
                    })()}

                    <div style="background:rgba(0,0,0,0.25); border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <span class="text-xs text-muted">Séquence attribuée :</span>
                            <span style="font-weight:700; color:var(--gold); font-size:0.8rem;">
                                ${escapeHtml(
                                    lead.activeSequenceId === 'seq_directory_only' || (!lead.activeSequenceId && (lead.leadCategory === 'directory_only' || lead.has_directory_only))
                                        ? 'Indépendance vs Annuaire & Plateforme'
                                        : (lead.activeSequenceId === 'seq_missing_gmb_website' || (!lead.activeSequenceId && (lead.leadCategory === 'missing_gmb_website' || lead.google_business_missing_website))
                                            ? 'Site non relié à Google Maps'
                                            : (lead.activeSequenceId === 'seq_no_website' || (!lead.activeSequenceId && lead.leadCategory === 'no_website')
                                                ? 'Création de site web officiel'
                                                : (lead.activeSequenceId === 'seq_outdated_website' || (!lead.activeSequenceId && lead.leadCategory === 'outdated_website')
                                                    ? 'Refonte moderne & Conversion'
                                                    : 'Agent Conversationnel IA 24/7'
                                                )
                                            )
                                        )
                                )}
                            </span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:0.75rem; color:#94A3B8;">
                            <span>Progression :</span>
                            <span style="font-weight:600; color:#F8FAFC;">
                                ${lead.sequenceStatus === 'ACTIVE' 
                                    ? `Étape ${lead.smsSequenceStep || 1} sur 4 (${lead.smsStatus || 'Simulé'})`
                                    : (lead.phone_type === 'landline' ? 'Ligne fixe (SMS bloqué pour réputation)' : 'En attente de déclenchement')}
                            </span>
                        </div>
                        <div class="text-xs" style="color:#CBD5E1; line-height:1.4; background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:6px; border:1px dashed rgba(255,255,255,0.08); font-style:italic;">
                            ${escapeHtml(
                                lead.lastSimulatedSmsText 
                                    || lead.recommended_angle 
                                    || (lead.leadCategory === 'directory_only' 
                                        ? `Bonjour ${lead.business_name || 'cher dirigeant'}, Ben de Solutions Quasar. Avoir votre propre vitrine officielle évite que vos clients voient vos concurrents sur ${lead.directory_platform || 'les plateformes tierces'}.`
                                        : `Bonjour ${lead.business_name || 'cher dirigeant'}, Ben de Solutions Quasar. Vos clients peuvent-ils réserver en direct 24/7 sans attendre ?`
                                    )
                            )}
                        </div>
                    </div>

                    <!-- Sequence Timeline Container -->
                    <div id="lead-sequence-timeline-container" style="margin-bottom:12px;"></div>

                    <!-- Autonomous Long-Term Follow-up Container (100% Autonome) -->
                    <div id="lead-autonomous-followup-container" style="margin-bottom:12px;"></div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        <button type="button" class="btn btn-sm btn-outline-gold" style="font-size:0.75rem; font-weight:700; display:flex; align-items:center; justify-content:center; gap:5px;" onclick="window.openTriggerSequenceModal('${lead.id}')">
                            <span class="material-icons" style="font-size:14px;">${lead.sequenceStatus === 'ACTIVE' ? 'tune' : 'rocket_launch'}</span> ${lead.sequenceStatus === 'ACTIVE' ? 'Gérer / Relancer Séquence' : 'Lancer Séquence (Réel / Test)'}
                        </button>
                        <button type="button" class="btn btn-sm btn-secondary" style="font-size:0.75rem; font-weight:600; display:flex; align-items:center; justify-content:center; gap:5px;" onclick="window.openSequencesConfigModal('instances')">
                            <span class="material-icons" style="font-size:14px;">view_list</span> Toutes les Séquences
                        </button>
                    </div>
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
                <!-- END OF SCROLLABLE BODY -->
                </div>

                <!-- FLOATING ACTION BAR (ALIGNED WITH SIDEBAR) -->
                <div id="lead-floating-bar-container" style="position: absolute; bottom: 14px; left: 14px; right: 14px; background: rgba(18, 21, 28, 0.94); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(223, 165, 58, 0.3); border-radius: 12px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05); padding: 7px 9px; z-index: 40; box-sizing: border-box; pointer-events: auto;">
                    <div id="lead-actions-row" style="display: grid; grid-template-columns: repeat(3, 1fr) 1.25fr; gap: 6px; align-items: center;">
                        ${(lead && (lead.phone_type === 'landline' || lead.sms_eligible === false)) ? `
                            <button class="btn btn-sm" onclick="window.showToast('☎️ Ligne fixe détectée (${escapeHtml(lead.carrier_name || 'Fixe')}) : SMS non supporté. Privilégiez un appel direct.', 'warning')" style="display: inline-flex; align-items: center; justify-content: center; gap: 5px; font-size: 0.75rem; font-weight: 600; opacity: 0.55; border: 1px solid rgba(239,68,68,0.3); color: #FCA5A5; background: rgba(239,68,68,0.06); white-space: nowrap; height: 34px; padding: 0 6px; border-radius: 8px; cursor: not-allowed;" title="Ligne fixe : SMS non supporté">
                                ${SVG_ICONS.sms} <span style="text-decoration:line-through;">SMS IA</span>
                            </button>
                        ` : `
                            <button class="btn btn-sm btn-outline-gold" onclick="window.openSmsOutreachModal('${lead.id}', document.getElementById('edit-phone')?.value || '${(lead.phone || '').replace(/'/g, "\\'")}', document.getElementById('edit-business-name')?.value || '${(lead.business_name || lead.name || '').replace(/'/g, "\\'")}', '${lead.preferredLanguage || (window.detectLeadLanguage ? window.detectLeadLanguage(lead) : 'en')}')" style="display: inline-flex; align-items: center; justify-content: center; gap: 5px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; height: 34px; padding: 0 6px; border-radius: 8px; transition: all 0.2s;" title="Envoyer un SMS IA via Twilio/Telnyx">
                                ${SVG_ICONS.sms} <span>SMS IA</span>
                            </button>
                        `}
                        
                        <button class="btn btn-sm" onclick="window.openGmailPitchModal('${lead.id}')" style="display: inline-flex; align-items: center; justify-content: center; gap: 5px; font-size: 0.75rem; font-weight: 600; border: 1px solid rgba(96,165,250,0.3); color: #60A5FA; background: rgba(96,165,250,0.08); white-space: nowrap; height: 34px; padding: 0 6px; border-radius: 8px; transition: all 0.2s;" title="Ouvrir un pitch pré-rempli dans Gmail">
                            ${SVG_ICONS.gmail} <span>Gmail Pitch</span>
                        </button>

                        <button class="btn btn-sm" onclick="window.openLeadCallModal('${lead.id}')" style="display: inline-flex; align-items: center; justify-content: center; gap: 5px; font-size: 0.75rem; font-weight: 600; ${(lead && (lead.phone_type === 'landline' || lead.sms_eligible === false)) ? 'border: 1px solid rgba(223, 165, 58, 0.7); color: var(--gold); background: rgba(223, 165, 58, 0.12);' : 'border: 1px solid rgba(255,255,255,0.15); color: #CBD5E1; background: rgba(255,255,255,0.04);'} white-space: nowrap; height: 34px; padding: 0 6px; border-radius: 8px; transition: all 0.2s;" title="Appel direct ou transférer vers Cold Call">
                            ${SVG_ICONS.phone} <span>Appeler</span>
                        </button>

                        <button class="btn btn-sm btn-primary" style="height: 34px; font-size: 0.76rem; font-weight: 700; padding: 0 10px; box-shadow: 0 4px 15px rgba(223, 165, 58, 0.25); white-space: nowrap; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.2s;" onclick="saveLeadDetails('${lead.id}')" title="Enregistrer les modifications">
                            ${SVG_ICONS.check} <span>Sauvegarder</span>
                        </button>
                    </div>
                </div>

            </div>

            <!-- 2. RESIZER -->
            <div class="detail-resizer" id="sidebar-resizer" style="height: 100%;"></div>

            <!-- 3. RIGHT PANE (Header + Preview) -->
            <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; height: 100%; position: relative;">
                
                <!-- HEADER (Now specific to right pane) -->
                <div class="detail-header" style="width: 100%; box-sizing: border-box; height: auto; min-height: 52px; flex-shrink: 0; display: flex; flex-direction: column; justify-content: center; align-items: stretch; gap: 8px; padding: 12px 24px;">
                    <!-- ROW 1: Identity & Close -->
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box; gap: 16px;">
                        <div style="display: flex; align-items: center; gap: 14px; overflow: hidden; min-width: 0; flex: 1;">
                                <div class="text-h truncate" style="font-size: 1.18rem; font-weight: 700; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main);" title="${escapeHtml(lead.business_name)}">${escapeHtml(lead.business_name)}</div>
                                
                                <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                                <select id="edit-lead-status" class="badge status-${lead.status ? lead.status.toLowerCase() : 'new'}" style="font-size: 0.75rem; padding: 4px 22px 4px 10px; font-weight: 600; border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; background: #14171D; color: var(--text-main); cursor: pointer;" onchange="this.className='badge status-'+this.value.toLowerCase();">
                                    <option value="NEW" ${lead.status === 'NEW' ? 'selected' : ''}>NOUVEAU</option>
                                    <option value="AUDITED" ${lead.status === 'AUDITED' ? 'selected' : ''}>AUDITÉ IA</option>
                                    <option value="APPROVED" ${lead.status === 'APPROVED' ? 'selected' : ''}>APPROUVÉ</option>
                                    <option value="CONTACTED" ${lead.status === 'CONTACTED' ? 'selected' : ''}>CONTACTÉ</option>
                                    <option value="INTERESTED" ${lead.status === 'INTERESTED' ? 'selected' : ''}>INTÉRESSÉ</option>
                                    <option value="MEETING_SCHEDULED" ${lead.status === 'MEETING_SCHEDULED' ? 'selected' : ''}>RDV FIXÉ</option>
                                    <option value="CLIENT" ${lead.status === 'CLIENT' ? 'selected' : ''}>CLIENT</option>
                                    <option value="REJECTED" ${lead.status === 'REJECTED' ? 'selected' : ''}>ARCHIVÉ</option>
                                </select>
                                
                                <div style="display:flex; align-items:center; gap:5px; background:#14171D; border:1px solid rgba(255,255,255,0.15); border-radius:12px; padding:2px 8px;" title="Langue de contact & des SMS du lead">
                                    <span class="material-icons text-muted" style="font-size:13px;">translate</span>
                                    <select id="header-preferred-language" style="border:none; background:transparent; color:var(--text-main); font-size:0.75rem; font-weight:600; cursor:pointer; outline:none; padding:2px 0;" onchange="window.handleLeadLanguageChange(this.value, '${lead.id}')">
                                        <option value="fr" ${leadLang === 'fr' ? 'selected' : ''}>🇫🇷 FR</option>
                                        <option value="en" ${leadLang === 'en' ? 'selected' : ''}>🇺🇸 EN</option>
                                    </select>
                                </div>
                                ${lead.google_page_rank ? `<span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-muted); border: 1px solid var(--border); font-size: 0.72rem; padding: 3px 8px; border-radius: 6px;">Page ${lead.google_page_rank}</span>` : ''}
                                <a href="${googleSearchUrl}" target="_blank" class="text-xs text-gold hover-underline" style="display: flex; align-items: center; gap: 5px; font-weight: 500;">
                                    ${SVG_ICONS.external} ${t('leads_verify_rank')}
                                </a>
                                </div>
                        </div>
                        
                        <button class="btn icon-btn" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; color: var(--text-muted); width: 36px; height: 36px; min-width: 36px; min-height: 36px; padding: 0; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; margin-left: auto; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);" onmouseenter="this.style.background='rgba(239, 68, 68, 0.15)'; this.style.borderColor='rgba(239, 68, 68, 0.35)'; this.style.color='#f87171';" onmouseleave="this.style.background='rgba(255, 255, 255, 0.05)'; this.style.borderColor='rgba(255, 255, 255, 0.1)'; this.style.color='var(--text-muted)';" onclick="window.closeLeadDetailOverlay()" title="Fermer le volet">
                            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                    </div>

                    <!-- ROW 2: Actions (Compact) -->
                    ${lead.status === 'NEW' || lead.lastAudit ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 8px; width: 100%; box-sizing: border-box;">
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

    // Load Proactive SMS Sequence Timeline (Section 4)
    if (window.loadLeadSequenceTimeline) {
        window.loadLeadSequenceTimeline(lead.id, lead);
    }

    // Load Autonomous Long-Term Follow-up (100% Autonome)
    if (window.loadLeadAutonomousFollowup) {
        window.loadLeadAutonomousFollowup(lead.id, lead);
    }
};

// Global to store listeners for cleanup (kept for safety)
window.activeLeadLogListeners = [];
window.startLeadNeuralLogsListener = (leadId) => {
    // Retired for streamlined simplicity & zero listener overhead
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
        if (newWidth < 380) newWidth = 380;
        if (newWidth > 950) newWidth = 950;

        sidebar.style.width = `${newWidth}px`;
    });

    document.addEventListener("mouseup", () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = "default";
            resizer.classList.remove("resizing");
            try {
                localStorage.setItem('erp_lead_detail_sidebar_width', sidebar.style.width);
            } catch (_) {}
        }
    });
}

// --- VISUAL SMS SEQUENCE TIMELINE (SIDEBAR SECTION 4) ---

window.toggleTimelineMessagePreview = function(stepNum) {
    const box = document.getElementById(`seq-step-preview-${stepNum}`);
    const arrow = document.getElementById(`seq-step-arrow-${stepNum}`);
    if (!box) return;
    const isHidden = box.style.display === 'none';
    box.style.display = isHidden ? 'block' : 'none';
    if (arrow) {
        arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
};

window.loadLeadSequenceTimeline = async function(leadId, leadData) {
    const container = document.getElementById('lead-sequence-timeline-container');
    if (!container) return;

    // Loading State
    container.innerHTML = `
        <div class="lead-timeline-container">
            <div class="seq-timeline-header">
                <div style="display:flex; align-items:center; gap:6px;">
                    <span class="material-icons text-gold" style="font-size:15px;">schedule</span>
                    <span style="font-weight:700; color:#F8FAFC; font-size:0.78rem;">Calendrier d'envoi SMS (4 Étapes)</span>
                </div>
                <span class="text-xs text-muted" style="font-size:0.68rem;">Calcul en cours...</span>
            </div>
            <div style="padding:14px; text-align:center; color:#94A3B8; font-size:0.75rem;">
                <span class="material-icons" style="font-size:16px; vertical-align:middle; margin-right:4px; animation: spin 1s linear infinite;">sync</span>
                Calcul des créneaux dans le fuseau du prospect...
            </div>
        </div>
    `;

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sequences/leads/${leadId}/timeline`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await resp.json();

        if (!data.success || !Array.isArray(data.steps) || data.steps.length === 0) {
            container.innerHTML = `
                <div class="lead-timeline-container" style="padding:10px 12px; font-size:0.74rem; color:#94A3B8;">
                    <span class="material-icons" style="font-size:14px; vertical-align:middle; color:var(--gold); margin-right:4px;">info</span>
                    Calendrier indisponible : numéro de téléphone à qualifier ou séquence en attente.
                </div>
            `;
            return;
        }

        const isLandline = (leadData && leadData.phone_type === 'landline');
        const tz = data.timezone || 'America/Montreal';
        const hasActive = data.hasActiveInstance;
        const dryRun = data.dryRun;
        
        let badgeClass = 'preview';
        let badgeText = 'Prévisionnel';
        if (data.status === 'STOPPED_REPLIED') {
            badgeClass = 'simulated';
            badgeText = '✋ Suspendu (Répondu)';
        } else if (data.status === 'STOPPED_MEETING') {
            badgeClass = 'done';
            badgeText = '📅 RDV Fixé';
        } else if (data.status === 'STOPPED_MANUAL') {
            badgeClass = 'preview';
            badgeText = '⏹️ Arrêté';
        } else if (hasActive) {
            badgeClass = dryRun ? 'simulated' : 'active';
            badgeText = dryRun ? 'Simulation' : 'Actif';
        }

        const delayLabels = [
            'Immédiat / Lundi matin',
            'J+1 (24h après Étape 1)',
            'J+3 (48h après Étape 2)',
            'J+6 (Breakup final)'
        ];

        let stepsHtml = '';
        data.steps.forEach((step, idx) => {
            const stepNum = step.stepNumber || (idx + 1);
            const isDone = step.status === 'COMPLETED' || step.status === 'SENT';
            const isSimulated = step.status === 'SIMULATED';
            const isScheduled = step.status === 'SCHEDULED' || step.status === 'CANCELLED';
            const isCurrent = (hasActive && data.currentStep === stepNum);
            
            let dotClass = 'preview';
            let dotContent = stepNum;
            let timeColor = '#CBD5E1';
            let statusBadge = '';

            if (isDone) {
                dotClass = 'done';
                dotContent = '✓';
                timeColor = '#4ADE80';
                statusBadge = '<span style="font-size:0.65rem; color:#4ADE80; font-weight:700;">ENVOYÉ</span>';
            } else if (isSimulated) {
                dotClass = 'simulated';
                dotContent = '✓';
                timeColor = '#38BDF8';
                statusBadge = '<span style="font-size:0.65rem; color:#38BDF8; font-weight:700;">SIMULÉ</span>';
            } else if (isScheduled) {
                const isHalted = data.status === 'STOPPED_REPLIED' || data.status === 'STOPPED_MEETING' || data.status === 'STOPPED_MANUAL' || step.status === 'CANCELLED';
                if (isHalted) {
                    dotClass = 'preview';
                    dotContent = '⏸️';
                    timeColor = '#94A3B8';
                    statusBadge = data.status === 'STOPPED_MEETING'
                        ? '<span style="font-size:0.65rem; color:#A78BFA; font-weight:700;">RDV FIXÉ</span>'
                        : '<span style="font-size:0.65rem; color:#94A3B8; font-weight:700;">SUSPENDU</span>';
                } else {
                    dotClass = 'scheduled';
                    dotContent = '⏳';
                    timeColor = 'var(--gold)';
                    statusBadge = '<span style="font-size:0.65rem; color:var(--gold); font-weight:700;">PROGRAMMÉ</span>';
                }
            }

            const sendDate = step.sentAt ? new Date(step.sentAt) : (step.scheduledFor ? new Date(step.scheduledFor) : null);
            const formattedTime = sendDate ? formatLeadScheduleTime(sendDate, tz) : 'Non défini';
            const delayText = delayLabels[idx] || `Délai : ${step.delayHours}h`;
            const messageBody = step.executedBody || step.template || step.templateText || '';

            stepsHtml += `
                <div class="seq-step-item ${isCurrent ? 'is-current' : ''}">
                    <div class="seq-step-dot ${dotClass}">
                        ${dotContent}
                    </div>
                    <div class="seq-step-topline">
                        <span class="seq-step-title">Étape ${stepNum} • ${delayText}</span>
                        ${statusBadge}
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; flex-wrap:wrap; gap:4px;">
                        <span class="seq-step-time" style="color:${timeColor};">
                            <span class="material-icons" style="font-size:12px;">event</span>
                            <span>${formattedTime}</span>
                        </span>
                        <span class="text-xs text-muted" style="font-size:0.66rem; opacity:0.8;">(Heure locale)</span>
                    </div>
                    <div class="seq-step-purpose" style="color:${step.purposeColor || '#94A3B8'};">
                        🎯 ${escapeHtml(step.purpose || 'Relance stratégique')}
                    </div>
                    ${messageBody ? `
                        <div class="seq-step-accordion">
                            <button type="button" class="seq-step-accordion-toggle" onclick="window.toggleTimelineMessagePreview(${stepNum})">
                                <span class="material-icons" id="seq-step-arrow-${stepNum}" style="font-size:13px; transition:transform 0.2s;">expand_more</span>
                                <span>Aperçu du SMS prévu</span>
                            </button>
                            <div id="seq-step-preview-${stepNum}" class="seq-step-preview-box" style="display:none;">
                                <div class="seq-preview-bubble">
                                    ${escapeHtml(messageBody)}
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        container.innerHTML = `
            <div class="lead-timeline-container">
                <div class="seq-timeline-header">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="material-icons text-gold" style="font-size:15px;">schedule</span>
                        <span style="font-weight:700; color:#F8FAFC; font-size:0.78rem;">Calendrier d'envoi SMS (4 Étapes)</span>
                        <span class="badge" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); font-size:0.65rem; padding:1px 6px; border-radius:4px; font-weight:700; color:${data.isFrancophone ? '#60A5FA' : '#FBBF24'};">${data.isFrancophone ? '🇫🇷 FR' : '🇺🇸 EN'}</span>
                    </div>
                    <span class="seq-timeline-badge ${badgeClass}">${badgeText}</span>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 8px; margin-bottom:10px; background:rgba(255,255,255,0.02); border-radius:6px; font-size:0.7rem; color:#94A3B8; border:1px solid rgba(255,255,255,0.04);">
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span class="material-icons" style="font-size:13px; color:var(--info);">public</span>
                        <span>Fuseau : <strong style="color:#F8FAFC;">${tz}</strong></span>
                    </div>
                    <span style="display:inline-flex; align-items:center; gap:4px;">
                        ${isLandline ? '<span style="color:#FCA5A5;">☎️ Ligne Fixe (SMS Bloqué)</span>' : '<span style="color:#4ADE80;">● Respect TCPA 9h-18h</span>'}
                    </span>
                </div>

                <div class="seq-timeline-track">
                    ${stepsHtml}
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Error loading sequence timeline:', err);
        container.innerHTML = `
            <div class="lead-timeline-container" style="padding:10px; font-size:0.72rem; color:#FCA5A5;">
                <span class="material-icons" style="font-size:14px; vertical-align:middle; margin-right:4px;">error_outline</span>
                Impossible de charger le calendrier de séquence.
            </div>
        `;
    }
};

// --- AUTONOMOUS LONG-TERM FOLLOW-UP (100% AUTONOME) ---

window.loadLeadAutonomousFollowup = async function(leadId, leadData) {
    const container = document.getElementById('lead-autonomous-followup-container');
    if (!container) return;

    container.innerHTML = `
        <div style="background: rgba(18, 21, 28, 0.7); border: 1px solid rgba(223, 165, 58, 0.2); border-radius: 10px; padding: 12px; margin-top: 10px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:6px;">
                    <span class="material-icons text-gold" style="font-size:16px;">smart_toy</span>
                    <span style="font-weight:700; color:#F8FAFC; font-size:0.78rem;">Suivi Long Terme IA (100% Autonome)</span>
                </div>
                <span class="text-xs text-muted" style="font-size:0.68rem;">Chargement...</span>
            </div>
        </div>
    `;

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/followups/lead/${leadId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        const followups = (data && data.success && Array.isArray(data.followups)) ? data.followups : [];

        const activeFollowup = followups.find(f => f.status === 'SCHEDULED');
        const executedFollowups = followups.filter(f => f.status === 'EXECUTED');

        const phone = leadData?.phone || leadData?.phone_number || '';
        const name = leadData?.name || leadData?.business_name || '';

        if (activeFollowup) {
            const dueDate = new Date(activeFollowup.dueDate);
            const dateStr = dueDate.toLocaleString('fr-CA', {
                timeZone: activeFollowup.timezone || 'America/Moncton',
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });

            container.innerHTML = `
                <div style="background: linear-gradient(135deg, rgba(223, 165, 58, 0.08) 0%, rgba(16, 185, 129, 0.06) 100%); border: 1px solid rgba(223, 165, 58, 0.35); border-radius: 10px; padding: 12px; margin-top: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span class="material-icons" style="font-size:16px; color:var(--gold);">smart_toy</span>
                            <span style="font-weight:700; color:#F8FAFC; font-size:0.78rem;">Suivi Long Terme IA</span>
                        </div>
                        <span style="background: rgba(16, 185, 129, 0.15); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 12px; font-size: 0.65rem; font-weight: 700; padding: 2px 8px; text-transform: uppercase;">
                            100% Autonome
                        </span>
                    </div>

                    <div style="background: rgba(0,0,0,0.25); border-radius: 8px; padding: 10px; border: 1px solid rgba(255,255,255,0.06); margin-bottom: 10px;">
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 5px;">
                            <span style="font-size: 0.72rem; color: #94A3B8;">Échéance prévue :</span>
                            <span style="font-size: 0.74rem; font-weight: 700; color: var(--gold); display:flex; align-items:center; gap:4px;">
                                <span class="material-icons" style="font-size:13px;">event</span> ${dateStr}
                            </span>
                        </div>
                        <div style="font-size: 0.7rem; color: #CBD5E1; margin-bottom: 4px;">
                            <strong style="color:#94A3B8;">Motif :</strong> ${escapeHtml(activeFollowup.reason || 'Report demandé par le prospect')}
                        </div>
                        ${activeFollowup.contextNote ? `
                            <div style="font-size: 0.68rem; color: #94A3B8; font-style: italic; background: rgba(255,255,255,0.02); padding: 5px 8px; border-radius: 5px; border-left: 2px solid var(--gold);">
                                💡 Notes : ${escapeHtml(activeFollowup.contextNote)}
                            </div>
                        ` : ''}
                    </div>

                    <div style="display:flex; gap:6px;">
                        <button type="button" class="btn btn-sm btn-outline-gold" style="flex:1; font-size:0.72rem; height:30px; display:flex; align-items:center; justify-content:center; gap:4px;" onclick="window.executeAutonomousFollowupNow('${activeFollowup.id}', '${leadId}')">
                            <span class="material-icons" style="font-size:13px;">bolt</span> Tester l'envoi direct
                        </button>
                        <button type="button" class="btn btn-sm" style="font-size:0.72rem; height:30px; border-color:rgba(239,68,68,0.4); color:#FCA5A5; background:rgba(239,68,68,0.06); padding:0 10px; display:flex; align-items:center; justify-content:center; gap:4px;" onclick="window.cancelAutonomousFollowup('${activeFollowup.id}', '${leadId}')" title="Annuler ce suivi">
                            <span class="material-icons" style="font-size:13px;">close</span> Annuler
                        </button>
                    </div>
                </div>
            `;
        } else {
            // No active follow-up
            container.innerHTML = `
                <div style="background: rgba(18, 21, 28, 0.6); border: 1px dashed rgba(223, 165, 58, 0.25); border-radius: 10px; padding: 10px 12px; margin-top: 10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span class="material-icons text-gold" style="font-size:15px;">smart_toy</span>
                            <span style="font-weight:600; color:#E2E8F0; font-size:0.74rem;">Suivi Long Terme IA :</span>
                        </div>
                        <span style="font-size:0.7rem; color:#94A3B8;">Aucun suivi planifié</span>
                    </div>
                    ${executedFollowups.length > 0 ? `
                        <div style="margin-top:6px; font-size:0.68rem; color:#34D399; display:flex; align-items:center; gap:4px;">
                            <span class="material-icons" style="font-size:12px;">check_circle</span> Dernier suivi exécuté avec succès (${executedFollowups.length} envoyé${executedFollowups.length > 1 ? 's' : ''})
                        </div>
                    ` : ''}
                    <div style="margin-top:8px;">
                        <button type="button" class="btn btn-sm btn-outline-gold btn-block" style="font-size:0.72rem; height:28px; width:100%; display:flex; align-items:center; justify-content:center; gap:4px;" onclick="window.openScheduleFollowupModal('${leadId}', '${escapeHtml(phone)}', '${escapeHtml(name)}')">
                            <span class="material-icons" style="font-size:13px;">add_alarm</span> + Programmer un suivi IA autonome
                        </button>
                    </div>
                </div>
            `;
        }
    } catch (err) {
        console.error("Error loading autonomous followup:", err);
        container.innerHTML = '';
    }
};

window.openScheduleFollowupModal = function(leadId, phone, name) {
    const existing = document.getElementById('modal-schedule-followup');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-schedule-followup';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        display: flex; align-items: center; justify-content: center; z-index: 99999; padding: 20px;
    `;

    modal.innerHTML = `
        <div style="background: #14171F; border: 1px solid rgba(223, 165, 58, 0.35); border-radius: 14px; width: 100%; max-width: 480px; box-shadow: 0 20px 50px rgba(0,0,0,0.8); overflow: hidden; animation: fadeInScale 0.2s ease-out;">
            <div style="padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; background: rgba(223, 165, 58, 0.05);">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="material-icons text-gold" style="font-size:20px;">smart_toy</span>
                    <span style="font-weight:700; color:#F8FAFC; font-size:0.95rem;">Programmer un Suivi IA 100% Autonome</span>
                </div>
                <button type="button" class="btn icon-btn" style="color:#94A3B8; background:none; border:none; cursor:pointer;" onclick="document.getElementById('modal-schedule-followup').remove()">
                    <span class="material-icons">close</span>
                </button>
            </div>

            <div style="padding: 20px; display:flex; flex-direction:column; gap:14px;">
                <div>
                    <label style="display:block; font-size:0.75rem; color:#94A3B8; margin-bottom:6px; font-weight:600;">Destinataire :</label>
                    <div style="background:rgba(255,255,255,0.04); padding:8px 12px; border-radius:8px; font-size:0.8rem; color:#F8FAFC; border:1px solid rgba(255,255,255,0.06);">
                        ${escapeHtml(name || 'Prospect')} (${escapeHtml(phone || 'Numéro non défini')})
                    </div>
                </div>

                <div>
                    <label style="display:block; font-size:0.75rem; color:#94A3B8; margin-bottom:6px; font-weight:600;">Délai rapide ou Date précise :</label>
                    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:6px; margin-bottom:8px;">
                        <button type="button" class="btn btn-sm btn-secondary fu-preset-btn" onclick="selectFollowupPreset(7, this)" style="font-size:0.72rem; padding:6px 4px;">7 jours</button>
                        <button type="button" class="btn btn-sm btn-secondary fu-preset-btn active" onclick="selectFollowupPreset(14, this)" style="font-size:0.72rem; padding:6px 4px; border-color:var(--gold); color:var(--gold);">14 jours (2 sem.)</button>
                        <button type="button" class="btn btn-sm btn-secondary fu-preset-btn" onclick="selectFollowupPreset(30, this)" style="font-size:0.72rem; padding:6px 4px;">1 mois</button>
                        <button type="button" class="btn btn-sm btn-secondary fu-preset-btn" onclick="selectFollowupPreset(60, this)" style="font-size:0.72rem; padding:6px 4px;">2 mois</button>
                        <button type="button" class="btn btn-sm btn-secondary fu-preset-btn" onclick="selectFollowupPreset(90, this)" style="font-size:0.72rem; padding:6px 4px;">3 mois</button>
                        <button type="button" class="btn btn-sm btn-secondary fu-preset-btn" onclick="selectFollowupPreset('custom', this)" style="font-size:0.72rem; padding:6px 4px;">Date libre</button>
                    </div>
                    <input type="date" id="fu-custom-date" class="form-input" style="display:none; width:100%; box-sizing:border-box; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#F8FAFC; border-radius:8px; padding:8px; font-size:0.8rem;">
                    <input type="hidden" id="fu-selected-delay" value="14">
                </div>

                <div>
                    <label style="display:block; font-size:0.75rem; color:#94A3B8; margin-bottom:6px; font-weight:600;">Motif du suivi :</label>
                    <input type="text" id="fu-reason-input" class="form-input" placeholder="ex: Prospect en vacances jusqu'à mi-novembre" value="Relance convenue avec le prospect" style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#F8FAFC; border-radius:8px; padding:8px 10px; font-size:0.8rem;">
                </div>

                <div>
                    <label style="display:block; font-size:0.75rem; color:#94A3B8; margin-bottom:6px; font-weight:600;">Notes contextuelles pour l'IA (optionnel) :</label>
                    <textarea id="fu-context-input" class="form-input" rows="2" placeholder="ex: Était intéressé par l'agent IA, comparer avec son prestataire actuel." style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#F8FAFC; border-radius:8px; padding:8px 10px; font-size:0.8rem; resize:none;"></textarea>
                </div>

                <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; padding: 10px; font-size: 0.72rem; color: #6EE7B7; display:flex; gap:6px;">
                    <span class="material-icons" style="font-size:16px; flex-shrink:0;">info</span>
                    <span><strong>Exécution 100% Autonome :</strong> Le jour de l'échéance, l'IA composera un SMS ultra-personnalisé en tenant compte de l'historique et l'enverra directement au prospect dans son fuseau horaire légal.</span>
                </div>
            </div>

            <div style="padding: 14px 20px; background: rgba(0,0,0,0.25); border-top: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: flex-end; gap: 8px;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('modal-schedule-followup').remove()">Annuler</button>
                <button type="button" class="btn btn-primary btn-sm" onclick="window.submitScheduleFollowup('${leadId}', '${escapeHtml(phone)}')">
                    <span class="material-icons" style="font-size:14px; margin-right:4px;">check</span> Confirmer le suivi autonome
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    window.selectFollowupPreset = function(days, btn) {
        document.querySelectorAll('.fu-preset-btn').forEach(b => {
            b.style.borderColor = '';
            b.style.color = '';
        });
        btn.style.borderColor = 'var(--gold)';
        btn.style.color = 'var(--gold)';

        const customInput = document.getElementById('fu-custom-date');
        const delayHidden = document.getElementById('fu-selected-delay');

        if (days === 'custom') {
            customInput.style.display = 'block';
            delayHidden.value = 'custom';
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            customInput.min = tomorrow.toISOString().split('T')[0];
        } else {
            customInput.style.display = 'none';
            delayHidden.value = days;
        }
    };
};

window.submitScheduleFollowup = async function(leadId, phone) {
    const delayVal = document.getElementById('fu-selected-delay')?.value || '14';
    const customDate = document.getElementById('fu-custom-date')?.value || '';
    const reason = document.getElementById('fu-reason-input')?.value?.trim() || 'Suivi convenu';
    const contextNote = document.getElementById('fu-context-input')?.value?.trim() || '';

    let payload = {
        leadId,
        phoneNumber: phone,
        reason,
        contextNote,
        createdBy: 'crm_manual'
    };

    if (delayVal === 'custom') {
        if (!customDate) {
            if (window.showToast) window.showToast('Veuillez sélectionner une date.', 'warning');
            return;
        }
        payload.targetDate = customDate;
    } else {
        payload.delayDays = parseInt(delayVal, 10);
    }

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const res = await fetch(`${API_BASE}/api/followups/schedule`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
            document.getElementById('modal-schedule-followup')?.remove();
            if (window.showToast) window.showToast(`✦ Suivi IA programmé pour le ${data.scheduledForDisplay} !`, 'success');
            if (window.loadLeadAutonomousFollowup) {
                window.loadLeadAutonomousFollowup(leadId);
            }
        } else {
            if (window.showToast) window.showToast(`Erreur : ${data.error || 'Échec de planification'}`, 'danger');
        }
    } catch (e) {
        console.error('Error submitting followup:', e);
        if (window.showToast) window.showToast(`Erreur réseau : ${e.message}`, 'danger');
    }
};

window.cancelAutonomousFollowup = async function(followupId, leadId) {
    if (!window.showConfirmModal) {
        return;
    }

    window.showConfirmModal({
        title: 'Annuler le suivi IA',
        message: 'Êtes-vous certain de vouloir annuler ce suivi automatique ? L\'IA n\'enverra aucun message au prospect.',
        confirmText: 'Oui, annuler',
        cancelText: 'Retour',
        onConfirm: async () => {
            try {
                const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
                const res = await fetch(`${API_BASE}/api/followups/${followupId}/cancel`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ reason: 'Annulé depuis le CRM' })
                });
                const data = await res.json();
                if (data.success) {
                    if (window.showToast) window.showToast('Suivi IA annulé avec succès.', 'info');
                    if (window.loadLeadAutonomousFollowup) {
                        window.loadLeadAutonomousFollowup(leadId);
                    }
                }
            } catch (e) {
                if (window.showToast) window.showToast(`Erreur: ${e.message}`, 'danger');
            }
        }
    });
};

window.executeAutonomousFollowupNow = async function(followupId, leadId) {
    if (!window.showConfirmModal) {
        return;
    }

    window.showConfirmModal({
        title: '⚡ Exécuter le suivi IA maintenant (Mode Réel)',
        message: 'L\'IA va immédiatement générer un SMS contextuel et l\'envoyer en direct sur le mobile du prospect via Twilio/Telnyx. Confirmer l\'envoi ?',
        confirmText: 'Oui, envoyer maintenant',
        cancelText: 'Annuler',
        onConfirm: async () => {
            if (window.showToast) window.showToast('Génération et envoi du SMS par l\'IA...', 'info');
            try {
                const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
                const res = await fetch(`${API_BASE}/api/followups/${followupId}/execute-now`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const data = await res.json();
                if (data.success) {
                    if (window.showToast) window.showToast(`✓ SMS IA envoyé : "${data.sentMessage}"`, 'success');
                    if (window.loadLeadAutonomousFollowup) {
                        window.loadLeadAutonomousFollowup(leadId);
                    }
                } else {
                    if (window.showToast) window.showToast(`Échec: ${data.error || 'Erreur d\'envoi'}`, 'danger');
                }
            } catch (e) {
                if (window.showToast) window.showToast(`Erreur: ${e.message}`, 'danger');
            }
        }
    });
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

        if (category) {
            updateData.lead_quality_category = category;
        }

        const ref = doc(db, "leads", id);
        await updateDoc(ref, updateData);

        // Update local cache across all memory layers
        syncLeadInAllCaches(id, updateData);

        window.showToast ? window.showToast(`Statut mis à jour : ${newStatus}`, "success") : null;

        // Close overlay if open
        window.closeLeadDetailOverlay();

        // Refresh list
        const activeBtn = document.querySelector('button[data-filter].btn-primary');
        if (activeBtn) activeBtn.click();

    } catch (e) {
        console.error('Error updating status:', e);
        window.showToast ? window.showToast("Erreur lors de la mise à jour du statut", "error") : null;
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
        window.closeLeadDetailOverlay();

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
window.emailTemplates = {
    general: {
        subject: "Regarding {name} - Opportunity",
        body: "Hi there,\n\nI came across {name} and was impressed by what I saw. I'd love to connect and discuss how we can help you grow.\n\nBest,\nThe Team"
    },
    audit: {
        subject: "Free Website Audit for {name}",
        body: "Hi there,\n\nI was looking at the {name} website and noticed a few areas that could be improved for better conversions. Would you be open to receiving a free audit report?\n\nCheers,\nThe Team"
    },
    seo: {
        subject: "SEO Proposal for {name}",
        body: "Hello,\n\nWe specialize in helping businesses like {name} rank higher on Google. Are you currently taking on new clients? Let me know if you are interested in a quick chat.\n\nBest,\nThe Team"
    },
    followup: {
        subject: "Following up: {name}",
        body: "Hi there,\n\nI'm just following up on my previous email. I'd love to hear your thoughts when you have a moment.\n\nThanks,\nThe Team"
    }
};

window.applyEmailTemplate = (templateKey, companyName) => {
    if (!templateKey) return;
    const template = window.emailTemplates[templateKey];
    if (template) {
        document.getElementById('email-subject').value = template.subject.replace(/{name}/g, companyName);
        document.getElementById('email-body').value = template.body.replace(/{name}/g, companyName);
    }
};

window.openEmailComposer = (email, name) => {
    // Only open if email exists
    if (!email || email === 'undefined') {
        alert("No valid email address found for this lead.");
        return;
    }

    const modalId = 'email-composer-modal';
    let modal = document.getElementById(modalId);

    if (modal) modal.remove();

    // Default template
    const defaultSubject = window.emailTemplates.general.subject.replace(/{name}/g, name);
    const defaultBody = window.emailTemplates.general.body.replace(/{name}/g, name);

    const html = `
    <div id="${modalId}" class="modal-overlay" style="display:flex; align-items:center; justify-content:center; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:2000;">
        <div class="card" style="width:600px; max-width:95vw; background:#15171C; border:1px solid #333;">
             <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid #333; padding-bottom:1rem;">
                <div class="text-h">New Message to <span class="text-gold">${escapeHtml(name)}</span></div>
                <button class="btn btn-sm" onclick="document.getElementById('${modalId}').remove()">✕</button>
            </div>
            
            <div class="form-group" style="display:flex; gap: 10px; align-items: flex-end;">
                <div style="flex:1;">
                    <label class="form-label" for="email-template-select">Template:</label>
                    <select id="email-template-select" class="form-input" onchange="applyEmailTemplate(this.value, '${escapeHtml(name)}')">
                        <option value="general">General Interest</option>
                        <option value="audit">Free Audit Offer</option>
                        <option value="seo">SEO Proposal</option>
                        <option value="followup">Follow Up</option>
                    </select>
                </div>
                <div style="flex:1;">
                    <label class="form-label" for="email-to">To:</label>
                    <input type="text" id="email-to" class="form-input" value="${email}" disabled style="opacity:0.7;">
                </div>
            </div>

            <div class="form-group">
                <label class="form-label" for="email-subject">Subject:</label>
                <input type="text" id="email-subject" class="form-input" value="${escapeHtml(defaultSubject)}">
            </div>

            <div class="form-group">
                <label class="form-label" for="email-body">Message:</label>
                <textarea id="email-body" class="form-input" rows="8" style="resize:vertical;">${escapeHtml(defaultBody)}</textarea>
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

// --- LEAD LANGUAGE DETECTION (DEFAULT ENGLISH, FRENCH FOR QUEBEC / FRANCOPHONE) ---
export function detectLeadLanguage(lead = {}) {
    const explicitLang = lead.preferredLanguage || lead.language || lead.lang;
    if (explicitLang) {
        return String(explicitLang).toLowerCase().startsWith('fr') ? 'fr' : 'en';
    }

    const bizName = String(lead.business_name || lead.company || lead.name || '').trim();
    const cleanBiz = bizName.toLowerCase();

    // 1. Explicit French business naming patterns
    const frPatterns = /\b(clinique|rénovation|renovation|plomberie|toiture|menuiserie|électricien|electricite|avocat|notaire|comptable|esthétique|esthetique|coiffure|boutique|chiropratique|santé|sante|dentaire|ébénisterie|paysagiste)\b/i;
    if (frPatterns.test(cleanBiz)) {
        return 'fr';
    }

    // 2. Clear English naming patterns or English possessive (e.g. Sasha's colors, Bob's Barbershop)
    const enPatterns = /\b(colors|colour|barbershop|bakery|cleaning|landscaping|roofing|plumbing|auto repair|beauty|lounge|studio|tattoo|fitness|wellness|spa|designs|consulting|nails|lashes|hair|barber)\b/i;
    const hasEnglishPossessive = /^[a-zA-Z0-9]+'s\s+[a-zA-Z]/i.test(bizName);
    if ((hasEnglishPossessive || enPatterns.test(cleanBiz)) && !frPatterns.test(cleanBiz)) {
        return 'en';
    }

    const prov = String(lead.province || lead.state || '').trim().toUpperCase();
    const city = String(lead.city || '').trim().toLowerCase();
    const address = String(lead.address || lead.formattedAddress || '').toUpperCase();
    const postal = String(lead.postal_code || lead.postalCode || '').trim().toUpperCase();
    const cleanPhone = String(lead.phone || '').replace(/[^\d]/g, '');

    // 3. Quebec Province
    if (prov === 'QC' || prov === 'QUEBEC' || prov === 'QUÉBEC' ||
        address.includes(' QC ') || address.includes(', QC') || address.includes('QUEBEC') || address.includes('QUÉBEC')) {
        return 'fr';
    }
    // 4. Quebec FSA Postal Code (G, H, J)
    if (/^[GHJ]\d[A-Z]/.test(postal)) {
        return 'fr';
    }
    // 5. Quebec NPAs Area Codes
    if (cleanPhone.length >= 10) {
        const areaCode = cleanPhone.length === 11 && cleanPhone.startsWith('1')
            ? cleanPhone.slice(1, 4)
            : cleanPhone.slice(0, 3);
        const qcAreaCodes = ['418', '581', '367', '514', '438', '450', '579', '819', '873'];
        if (qcAreaCodes.includes(areaCode)) {
            return 'fr';
        }
    }
    // 6. Quebec Municipalities
    const qcCities = [
        'montréal', 'montreal', 'québec', 'quebec', 'laval', 'gatineau', 'longueuil', 'sherbrooke',
        'lévis', 'levis', 'saguenay', 'trois-rivières', 'trois-rivieres', 'terrebonne', 'saint-jean-sur-richelieu',
        'brossard', 'repentigny', 'drummondville', 'saint-jérôme', 'saint-jerome', 'granby', 'blainville',
        'mirabel', 'shawinigan', 'rimouski', 'victoriaville', 'rouyn-noranda', 'châteauguay', 'saint-hyacinthe',
        'magog', 'val-d-or', 'alma', 'baie-comeau', 'sept-îles', 'deschambault'
    ];
    if (qcCities.some(c => city.includes(c))) {
        return 'fr';
    }
    // 7. DEFAULT: English for all other Canada provinces and all US states!
    return 'en';
}
window.detectLeadLanguage = detectLeadLanguage;

// --- TWILIO AI SMS OUTREACH MODAL & ACTIONS ---
window.openSmsOutreachModal = (leadId, phone, name, preferredLang = null) => {
    const modalId = 'sms-outreach-modal';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    const lead = leadId && window.allLeadsCache ? window.allLeadsCache.find(l => l.id === leadId) : null;
    const isLandline = lead && (lead.phone_type === 'landline' || lead.sms_eligible === false);
    const carrierName = lead ? (lead.carrier_name || lead.phone_carrier || 'Ligne Fixe') : '';
    const pClean = (phone || (lead && lead.phone) || '').replace(/\D/g, '');
    const isCanadian = !lead ? true : (lead.country === 'Canada' || lead.country === 'CA' || /^(?:204|226|236|249|250|289|306|343|365|367|368|403|416|418|428|431|437|438|450|506|514|519|548|579|581|584|587|604|613|639|647|672|683|705|709|742|753|778|780|782|807|819|825|867|873|879|902|905)/.test(pClean.startsWith('1') ? pClean.slice(1) : pClean));

    let isFr = false;
    if (preferredLang) {
        isFr = String(preferredLang).toLowerCase().startsWith('fr');
    } else {
        isFr = detectLeadLanguage({ phone, name }) === 'fr';
    }
    const defaultPhone = phone || '';
    const safeName = (name || '').replace(/"/g, '&quot;');

    const html = `
    <div id="${modalId}" class="modal-overlay" style="display:flex; align-items:center; justify-content:center; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(11, 13, 16, 0.85); z-index:2200; backdrop-filter: blur(6px); padding:1rem;">
        <div class="card" style="width:580px; max-width:95vw; background:#14171D; border:1px solid rgba(223,165,58,0.3); box-shadow: 0 25px 60px rgba(0,0,0,0.8); border-radius:14px; overflow:hidden;">
            <div style="background:#181C24; padding: 1.2rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:34px; height:34px; border-radius:8px; background:rgba(223,165,58,0.12); color:var(--gold); display:flex; align-items:center; justify-content:center;">
                        ${SVG_ICONS.sms}
                    </div>
                    <div>
                        <div class="text-h" style="font-size:1.05rem; margin:0; color:#FFFFFF;">Outreach SMS IA</div>
                        <div class="text-xs text-muted">Solutions Quasar Inc. &bull; <strong>${isCanadian ? '🇨🇦 Twilio : +1 (819) 300-2831' : '🇺🇸 Telnyx : +1 (832) 743-6292'}</strong></div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <button class="btn btn-xs btn-outline-gold" onclick="window.openSmsConfigModal()" style="display:flex; align-items:center; gap:5px; font-weight:600; padding:3px 10px; font-size:0.75rem;" title="Modifier le prompt système et la documentation d'entreprise">
                        ${SVG_ICONS.settings} Prompt & Docs
                    </button>
                    <button class="btn icon-btn" onclick="document.getElementById('${modalId}').remove()" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer;">
                        ${SVG_ICONS.close}
                    </button>
                </div>
            </div>

            <div style="padding: 1.5rem; display:flex; flex-direction:column; gap:14px;">
                ${isLandline ? `
                <div style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.35); border-radius:8px; padding:10px 14px; display:flex; align-items:flex-start; gap:10px; color:#FCA5A5; font-size:0.8rem;">
                    <span style="font-size:1.3rem; line-height:1;">☎️</span>
                    <div>
                        <strong style="color:#F87171;">Ligne Fixe Détectée (${escapeHtml(carrierName)})</strong><br>
                        <span style="opacity:0.9;">Ce numéro est un téléphone fixe d'entreprise. Les SMS ne peuvent pas être délivrés aux téléphones fixes et seront rejetés par l'opérateur telecom. Privilégiez un appel direct ou Gmail.</span>
                    </div>
                </div>
                ` : ''}

                ${isCanadian && lead?.casl?.status === 'ELIGIBLE' ? `
                <div style="background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.25); border-radius:8px; padding:8px 12px; display:flex; align-items:center; gap:8px; color:#4ADE80; font-size:0.75rem;">
                    <span class="material-icons" style="font-size:16px;">verified</span>
                    <span><strong>Conforme LCAP / CASL :</strong> Numéro publié bien en vue sur le site officiel sans restriction. Preuve archivée.</span>
                </div>
                ` : (isCanadian && lead?.casl?.status === 'INELIGIBLE' ? `
                <div style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.35); border-radius:8px; padding:8px 12px; display:flex; align-items:center; gap:8px; color:#F87171; font-size:0.75rem;">
                    <span class="material-icons" style="font-size:16px;">block</span>
                    <span><strong>Attention LCAP / CASL :</strong> Mention de refus de sollicitation détectée sur le site de l'entreprise. Envoi risqué.</span>
                </div>
                ` : (isCanadian && lead?.casl?.status === 'REVIEW' ? `
                <div style="background:rgba(234,179,8,0.08); border:1px solid rgba(234,179,8,0.25); border-radius:8px; padding:8px 12px; display:flex; align-items:center; gap:8px; color:#FACC15; font-size:0.75rem;">
                    <span class="material-icons" style="font-size:16px;">warning</span>
                    <span><strong>LCAP / CASL en attente :</strong> Numéro non repéré dans le texte officiel. Vérification recommandée avant l'envoi.</span>
                </div>
                ` : ''))}
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                    <div class="form-group" style="margin:0;">
                        <label class="form-label text-xs uppercase text-muted font-bold" style="margin-bottom:4px;">Destinataire (Téléphone) *</label>
                        <input type="text" id="sms-to" class="form-input" value="${defaultPhone}" placeholder="+1 819 123 4567" style="background:#0F1217; border-color:rgba(255,255,255,0.1); height:36px; font-size:0.85rem;">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label class="form-label text-xs uppercase text-muted font-bold" style="margin-bottom:4px;">Contact / Entreprise</label>
                        <input type="text" id="sms-name" class="form-input" value="${safeName}" placeholder="Nom du contact ou commerce" style="background:#0F1217; border-color:rgba(255,255,255,0.1); height:36px; font-size:0.85rem;">
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1.5fr; gap:12px;">
                    <div class="form-group" style="margin:0;">
                        <label class="form-label text-xs uppercase text-muted font-bold" style="margin-bottom:4px;">Langue du SMS</label>
                        <select id="sms-language" class="form-input" style="background:#0F1217; border-color:rgba(255,255,255,0.1); height:36px; font-size:0.85rem;">
                            <option value="fr" ${isFr ? 'selected' : ''}>Français (French)</option>
                            <option value="en" ${!isFr ? 'selected' : ''}>English (Anglais)</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label class="form-label text-xs uppercase text-muted font-bold" style="margin-bottom:4px;">Angle d'Accroche IA</label>
                        <select id="sms-angle" class="form-input" style="background:#0F1217; border-color:rgba(255,255,255,0.1); height:36px; font-size:0.85rem;">
                            <option value="audit" selected>Offre d'Audit IA Gratuit</option>
                            <option value="general">Prise de contact & Partenariat</option>
                            <option value="website_upgrade">Modernisation Site & Automatisations</option>
                            <option value="follow_up">Relance / Suivi rapide</option>
                        </select>
                    </div>
                </div>

                <div class="form-group" style="margin:0;">
                    <label class="form-label text-xs uppercase text-muted font-bold" style="margin-bottom:4px;">Consignes Personnalisées pour l'IA (Optionnel)</label>
                    <input type="text" id="sms-custom-prompt" class="form-input" placeholder="ex: Mentionner qu'on a vu leur page Facebook, proposer un appel de 10 min" style="background:#0F1217; border-color:rgba(255,255,255,0.1); height:36px; font-size:0.85rem;">
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
                    <label class="form-label text-xs uppercase text-gold font-bold" style="margin:0;">Message SMS (Prêt à l'envoi)</label>
                    <button class="btn btn-xs btn-outline-gold" id="btn-generate-ai-sms" onclick="window.generateAiSmsMessage()" style="display:flex; align-items:center; gap:4px; padding:3px 10px; font-size:0.75rem;">
                        ${SVG_ICONS.sparkles} Générer avec l'IA
                    </button>
                </div>

                <div class="form-group" style="position:relative; margin:0;">
                    <textarea id="sms-body" class="form-input" rows="4" style="resize:vertical; font-family:inherit; font-size:0.85rem; background:#0F1217; border-color:rgba(255,255,255,0.1);" placeholder="Cliquez sur 'Générer avec l'IA' ou écrivez votre message directement..." oninput="window.updateSmsCharCount()"></textarea>
                    <div id="sms-char-counter" class="text-xs text-muted" style="text-align:right; margin-top:4px;">0 / 160 caractères (1 SMS)</div>
                </div>

                <div class="text-xs text-muted" style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:10px; font-size:0.73rem;">
                    <span class="text-gold font-bold">Conformité Légale (LCAP / TCPA) :</span> Les SMS de prospection incluent la mention de désabonnement obligatoire <em>[Rép. STOP pour cesser]</em>. Dès qu'un prospect répond, l'IA répond automatiquement.
                </div>
            </div>

            <div style="background:#181C24; padding: 1rem 1.5rem; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:flex-end; gap:10px; align-items:center;">
                <button class="btn btn-secondary btn-sm" onclick="document.getElementById('${modalId}').remove()" style="font-size:0.8rem;">Annuler</button>
                <button class="btn btn-primary btn-sm" id="btn-send-sms" onclick="window.sendSmsOutreach('${leadId || ''}')" style="display:flex; align-items:center; gap:6px; font-weight:600; padding:0 16px; font-size:0.82rem; box-shadow: 0 4px 15px rgba(223, 165, 58, 0.25);">
                    ${SVG_ICONS.send} <span>Envoyer le SMS</span>
                </button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    if (defaultPhone) {
        window.generateAiSmsMessage();
    }
};

window.updateSmsCharCount = () => {
    const textarea = document.getElementById('sms-body');
    const counter = document.getElementById('sms-char-counter');
    if (!textarea || !counter) return;
    const len = textarea.value.length;
    const segments = Math.ceil(len / 160) || 1;
    counter.innerHTML = `${len} / 160 caractères (${segments} SMS)`;
    if (len > 160) {
        counter.style.color = 'var(--warning)';
    } else {
        counter.style.color = 'var(--text-muted)';
    }
};

window.generateAiSmsMessage = async () => {
    const to = document.getElementById('sms-to')?.value.trim();
    const name = document.getElementById('sms-name')?.value.trim();
    const language = document.getElementById('sms-language')?.value || 'fr';
    const angle = document.getElementById('sms-angle')?.value || 'audit';
    const customPrompt = document.getElementById('sms-custom-prompt')?.value.trim();

    const genBtn = document.getElementById('btn-generate-ai-sms');
    const textarea = document.getElementById('sms-body');
    const originalText = genBtn ? genBtn.innerHTML : '';

    if (genBtn) {
        genBtn.innerHTML = '<span class="material-icons rotating" style="font-size:13px;">refresh</span> Génération...';
        genBtn.disabled = true;
    }

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sms/generate-outreach`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name,
                company: name,
                language,
                angle,
                customPrompt
            })
        });

        const data = await resp.json();
        if (data.success && data.text) {
            textarea.value = data.text;
            window.updateSmsCharCount();
        } else {
            throw new Error(data.error || "Impossible de générer le SMS");
        }
    } catch (e) {
        console.error("SMS Generation Error:", e);
        showToast(e.message, "error");
    } finally {
        if (genBtn) {
            genBtn.innerHTML = originalText;
            genBtn.disabled = false;
        }
    }
};

window.sendSmsOutreach = async (leadId) => {
    const to = document.getElementById('sms-to')?.value.trim();
    const name = document.getElementById('sms-name')?.value.trim();
    const message = document.getElementById('sms-body')?.value.trim();
    const sendBtn = document.getElementById('btn-send-sms');

    if (!to) {
        return showToast("Veuillez saisir un numéro de téléphone valide.", "warning");
    }
    if (!message) {
        return showToast("Le message SMS ne peut pas être vide.", "warning");
    }

    const lead = leadId && window.allLeadsCache ? window.allLeadsCache.find(l => l.id === leadId) : null;
    if (lead && (lead.phone_type === 'landline' || lead.sms_eligible === false)) {
        return showToast(`Envoi impossible : Ce numéro est une ligne fixe (${lead.carrier_name || 'Filaire'}). Privilégiez un appel direct.`, "warning");
    }

    const originalBtnHtml = sendBtn ? sendBtn.innerHTML : '';
    if (sendBtn) {
        sendBtn.innerHTML = '<span class="material-icons rotating" style="font-size:16px;">refresh</span> Envoi en cours...';
        sendBtn.disabled = true;
    }

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sms/send-outreach`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                to,
                message,
                leadId,
                name,
                company: name
            })
        });

        const data = await resp.json();
        if (!data.success) {
            throw new Error(data.error || "Échec de l'envoi du SMS via Twilio.");
        }

        showToast(`SMS envoyé avec succès à ${to} !`, "success");
        const modal = document.getElementById('sms-outreach-modal');
        if (modal) modal.remove();

    } catch (e) {
        console.error("SMS Send Error:", e);
        showToast(`Erreur Twilio: ${e.message}`, "error");
    } finally {
        if (sendBtn) {
            sendBtn.innerHTML = originalBtnHtml;
            sendBtn.disabled = false;
        }
    }
};

// Verification de numéro de téléphone en direct via Telnyx Lookup v2
window.verifyLeadPhone = async (leadId) => {
    const badgeSlot = document.getElementById('lead-phone-badge-slot');
    const phoneInput = document.getElementById('edit-phone');
    const phone = phoneInput ? phoneInput.value.trim() : null;

    if (!phone) {
        showToast("Aucun numéro de téléphone à vérifier.", "warning");
        return;
    }

    if (badgeSlot) {
        badgeSlot.innerHTML = `<span class="badge" style="background:rgba(223,165,58,0.15); color:var(--gold); font-size:0.68rem; padding:2px 6px; border-radius:4px;"><span class="material-icons rotating" style="font-size:10px;">refresh</span> Vérification...</span>`;
    }

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/phone/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ phone, leadId })
        });
        const data = await resp.json();
        if (!data.success) {
            throw new Error(data.error || "Échec de validation Telnyx");
        }

        const res = data.result;
        // Update local caches across all collections & views
        syncLeadInAllCaches(leadId, {
            phone_type: res.phone_type,
            carrier_name: res.carrier_name,
            sms_eligible: res.sms_eligible,
            recommended_channel: res.recommended_channel,
            phone_validated_at: res.checked_at
        });

        if (badgeSlot) {
            if (res.phone_type === 'mobile') {
                badgeSlot.innerHTML = `<span class="badge" style="background:rgba(34,197,94,0.15); color:#4ADE80; font-size:0.68rem; padding:2px 6px; border-radius:4px; font-weight:600;" title="${escapeHtml(res.carrier_name || 'Mobile')}">📱 Mobile</span>`;
                showToast(`Ligne certifiée Mobile (${res.carrier_name || 'Cellulaire'}). Éligible SMS !`, "success");
            } else if (res.phone_type === 'landline') {
                badgeSlot.innerHTML = `<span class="badge" style="background:rgba(148,163,184,0.15); color:#94A3B8; font-size:0.68rem; padding:2px 6px; border-radius:4px; font-weight:600;" title="${escapeHtml(res.carrier_name || 'Fixe')}">☎️ Fixe</span>`;
                showToast(`Ligne Fixe détectée (${res.carrier_name || 'Filaire'}). SMS non supporté.`, "warning");
            } else {
                badgeSlot.innerHTML = `<span class="badge" style="background:rgba(59,130,246,0.15); color:#60A5FA; font-size:0.68rem; padding:2px 6px; border-radius:4px; font-weight:600;" title="${escapeHtml(res.carrier_name || 'Ligne')}">${escapeHtml(res.phone_type)}</span>`;
                showToast(`Type de ligne : ${res.phone_type} (${res.carrier_name || ''})`, "info");
            }
        }

        // Dynamically update the actions row in open sidebar
        const actionRow = document.getElementById('lead-actions-row');
        if (actionRow) {
            const isLandline = res.phone_type === 'landline' || res.sms_eligible === false;
            const carrierLabel = escapeHtml(res.carrier_name || 'Fixe');
            const buttons = actionRow.querySelectorAll('button');
            const smsBtn = buttons[0];
            const callBtn = buttons[2];
            if (isLandline) {
                if (smsBtn) {
                    smsBtn.style.opacity = '0.5';
                    smsBtn.style.cursor = 'not-allowed';
                    smsBtn.style.borderColor = 'rgba(239,68,68,0.3)';
                    smsBtn.style.color = '#FCA5A5';
                    smsBtn.onclick = () => window.showToast(`☎️ Ligne fixe détectée (${carrierLabel}) : SMS non supporté. Privilégiez un appel direct.`, 'warning');
                    const textSpan = smsBtn.querySelector('span');
                    if (textSpan) textSpan.style.textDecoration = 'line-through';
                }
                if (callBtn) {
                    callBtn.style.borderColor = 'rgba(223, 165, 58, 0.7)';
                    callBtn.style.color = 'var(--gold)';
                    callBtn.style.background = 'rgba(223, 165, 58, 0.12)';
                    callBtn.style.fontWeight = '600';
                }
            }
        }

        // Re-render leads list & subfilters
        updateSubfilterCounts(window.allLeadsCache);
        applyCurrentSubfilter();
    } catch (err) {
        console.error("Phone verification error:", err);
        showToast(err.message, "error");
        if (badgeSlot) {
            badgeSlot.innerHTML = `<button type="button" class="btn btn-xs" onclick="window.verifyLeadPhone('${leadId}')" style="background:rgba(223,165,58,0.12); color:var(--gold); border:1px solid rgba(223,165,58,0.3); font-size:0.68rem; padding:2px 6px; border-radius:4px; font-weight:600;">Réessayer</button>`;
        }
    }
};

// --- SMS AI SYSTEM PROMPT & DOCUMENTATION MODAL ---
window.openSmsConfigModal = async () => {
    const modalId = 'sms-config-modal';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    const modalHtml = `
    <div id="${modalId}" class="modal-overlay" style="display:flex; align-items:center; justify-content:center; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:2200; backdrop-filter: blur(4px);">
        <div class="card" style="width:740px; max-width:95vw; background:#15171C; border:1px solid rgba(223,165,58,0.4); box-shadow: 0 25px 60px rgba(0,0,0,0.8); border-radius:12px; overflow:hidden; display:flex; flex-direction:column; max-height:90vh;">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #15171C 0%, #0B0D10 100%); padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:36px; height:36px; border-radius:8px; background:rgba(223,165,58,0.15); color:var(--gold); display:flex; align-items:center; justify-content:center;">
                        <span class="material-icons" style="font-size:20px;">psychology</span>
                    </div>
                    <div>
                        <div class="text-h" style="font-size:1.1rem; margin:0;">Configuration de l'IA SMS (Prompt & Documentation)</div>
                        <div class="text-xs text-muted">Personnalisez à volonté le comportement et les connaissances de l'IA</div>
                    </div>
                </div>
                <button class="btn btn-sm btn-icon" onclick="document.getElementById('${modalId}').remove()" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer;">
                    <span class="material-icons">close</span>
                </button>
            </div>

            <!-- Tabs Nav -->
            <div style="display:flex; background:rgba(0,0,0,0.25); border-bottom:1px solid var(--border); padding:0 1.5rem; gap:10px;">
                <button class="tab-btn active" id="tab-btn-prompt" onclick="window.switchSmsConfigTab('prompt')" style="padding:10px 14px; background:transparent; border:none; border-bottom:2px solid var(--gold); color:var(--gold); font-weight:bold; font-size:0.85rem; cursor:pointer; display:flex; align-items:center; gap:6px;">
                    <span class="material-icons" style="font-size:16px;">chat</span> System Prompt
                </button>
                <button class="tab-btn" id="tab-btn-docs" onclick="window.switchSmsConfigTab('docs')" style="padding:10px 14px; background:transparent; border:none; border-bottom:2px solid transparent; color:var(--text-muted); font-size:0.85rem; cursor:pointer; display:flex; align-items:center; gap:6px;">
                    <span class="material-icons" style="font-size:16px;">library_books</span> Documentation & FAQ
                </button>
                <button class="tab-btn" id="tab-btn-model" onclick="window.switchSmsConfigTab('model')" style="padding:10px 14px; background:transparent; border:none; border-bottom:2px solid transparent; color:var(--text-muted); font-size:0.85rem; cursor:pointer; display:flex; align-items:center; gap:6px;">
                    <span class="material-icons" style="font-size:16px;">tune</span> Modèle & Paramètres
                </button>
            </div>

            <!-- Body -->
            <div id="sms-config-body" style="padding: 1.5rem; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                <div style="text-align:center; padding:2rem; color:var(--text-muted);">
                    <span class="material-icons rotating" style="font-size:2rem; color:var(--gold);">refresh</span>
                    <div style="margin-top:8px;">Chargement de la configuration...</div>
                </div>
            </div>

            <!-- Footer -->
            <div style="background:var(--bg-dark); padding: 1rem 1.5rem; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                <button class="btn btn-xs btn-secondary" onclick="window.resetSmsConfigToDefaults()">
                    <span class="material-icons" style="font-size:14px;">restart_alt</span> Restaurer par défaut
                </button>
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">Fermer</button>
                    <button class="btn btn-primary" id="btn-save-sms-cfg" onclick="window.saveSmsAiConfig()" style="display:flex; align-items:center; gap:6px;">
                        <span class="material-icons" style="font-size:16px;">save</span> Enregistrer la configuration
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sms/config`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.success && data.config) {
            window.currentSmsConfig = data.config;
            window.renderSmsConfigFields(data.config);
        } else {
            throw new Error(data.error || "Impossible de charger la configuration");
        }
    } catch (e) {
        console.error("SMS Config Fetch Error:", e);
        const body = document.getElementById('sms-config-body');
        if (body) {
            body.innerHTML = `<div class="text-danger" style="text-align:center; padding:2rem;">Erreur de chargement: ${e.message}</div>`;
        }
    }
};

window.switchSmsConfigTab = (tabName) => {
    ['prompt', 'docs', 'model'].forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        const panel = document.getElementById(`panel-cfg-${t}`);
        if (btn) {
            if (t === tabName) {
                btn.style.color = 'var(--gold)';
                btn.style.borderBottom = '2px solid var(--gold)';
                btn.style.fontWeight = 'bold';
            } else {
                btn.style.color = 'var(--text-muted)';
                btn.style.borderBottom = '2px solid transparent';
                btn.style.fontWeight = 'normal';
            }
        }
        if (panel) {
            panel.style.display = (t === tabName) ? 'flex' : 'none';
        }
    });
};

window.renderSmsConfigFields = (cfg) => {
    const body = document.getElementById('sms-config-body');
    if (!body) return;

    body.innerHTML = `
        <!-- Panel 1: System Prompt -->
        <div id="panel-cfg-prompt" style="display:flex; flex-direction:column; gap:12px;">
            <div class="text-xs text-muted" style="line-height:1.5;">
                Le <strong>System Prompt</strong> dicte le comportement, la personnalité et les contraintes strictes de l'IA lorsqu'elle répond par SMS ou génère un premier message d'accroche.
            </div>
            <div class="form-group">
                <label class="form-label text-xs uppercase text-gold font-bold">System Prompt (Instructions de l'Agent SMS) :</label>
                <textarea id="cfg-system-prompt" class="form-input" rows="12" style="font-family:monospace; font-size:0.85rem; line-height:1.5; resize:vertical;">${cfg.systemPrompt || ''}</textarea>
            </div>
            <div class="text-xs text-muted" style="background:rgba(255,255,255,0.02); padding:8px 12px; border-radius:6px; border:1px solid var(--border);">
                💡 <em>Règle clé :</em> Conservez toujours l'instruction d'une réponse de moins de 160 caractères pour le format SMS.
            </div>
        </div>

        <!-- Panel 2: Documentation & FAQ -->
        <div id="panel-cfg-docs" style="display:none; flex-direction:column; gap:12px;">
            <div class="text-xs text-muted" style="line-height:1.5;">
                Collez ici toute la <strong>documentation de Solutions Quasar</strong> (liste détaillée de vos services, forfaits d'entretien, tarifs indicatifs, lien de prise de rendez-vous Calendly/Cal.com, heures d'ouverture). L'IA s'appuie directement dessus pour répondre avec exactitude aux questions posées par SMS.
            </div>
            <div class="form-group">
                <label class="form-label text-xs uppercase text-gold font-bold">Base de connaissances & Documentation d'entreprise :</label>
                <textarea id="cfg-knowledge-docs" class="form-input" rows="14" style="font-family:monospace; font-size:0.85rem; line-height:1.5; resize:vertical;" placeholder="# SOLUTIONS QUASAR INC.&#10;Services : Création de sites web...&#10;Tarifs : À partir de 350 $/mois...&#10;Lien de rendez-vous : https://cal.com/...">${cfg.knowledgeDocumentation || ''}</textarea>
            </div>
        </div>

        <!-- Panel 3: Modèle & Paramètres -->
        <div id="panel-cfg-model" style="display:none; flex-direction:column; gap:16px;">
            <div class="form-group">
                <label class="form-label text-xs uppercase text-muted font-bold">Modèle d'Intelligence Artificielle</label>
                <select id="cfg-model" class="form-input">
                    <option value="gpt-4o-mini" ${cfg.model === 'gpt-4o-mini' || !cfg.model ? 'selected' : ''}>gpt-4o-mini (Recommandé : ultra-rapide < 1s, économique et idéal pour SMS)</option>
                    <option value="gpt-4o" ${cfg.model === 'gpt-4o' ? 'selected' : ''}>gpt-4o (Raisonnement avancé et écriture sophistiquée)</option>
                </select>
            </div>

            <div class="form-group">
                <label class="form-label text-xs uppercase text-muted font-bold">Température (Créativité)</label>
                <select id="cfg-temperature" class="form-input">
                    <option value="0.3" ${cfg.temperature == 0.3 ? 'selected' : ''}>0.3 - Précis et factuel</option>
                    <option value="0.7" ${cfg.temperature == 0.7 || !cfg.temperature ? 'selected' : ''}>0.7 - Équilibré et naturel (Recommandé)</option>
                    <option value="0.9" ${cfg.temperature == 0.9 ? 'selected' : ''}>0.9 - Plus créatif</option>
                </select>
            </div>

            <div class="text-xs text-muted" style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:6px; padding:12px;">
                <span class="text-gold font-bold">Application instantanée :</span> Toute modification enregistrée ici est immédiatement active sur le serveur et injectée dans chaque nouveau SMS sortant et chaque réponse entrante.
            </div>
        </div>
    `;
};

window.saveSmsAiConfig = async () => {
    const systemPrompt = document.getElementById('cfg-system-prompt')?.value;
    const knowledgeDocumentation = document.getElementById('cfg-knowledge-docs')?.value;
    const model = document.getElementById('cfg-model')?.value || 'gpt-4o-mini';
    const temperature = parseFloat(document.getElementById('cfg-temperature')?.value || '0.7');

    const saveBtn = document.getElementById('btn-save-sms-cfg');
    const originalText = saveBtn ? saveBtn.innerHTML : '';
    if (saveBtn) {
        saveBtn.innerHTML = '<span class="material-icons rotating" style="font-size:16px;">refresh</span> Sauvegarde...';
        saveBtn.disabled = true;
    }

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sms/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                systemPrompt,
                knowledgeDocumentation,
                model,
                temperature
            })
        });

        const data = await resp.json();
        if (data.success) {
            window.currentSmsConfig = data.config;
            showToast("Configuration du System Prompt et de la Documentation enregistrée !", "success");
            const modal = document.getElementById('sms-config-modal');
            if (modal) modal.remove();
        } else {
            throw new Error(data.error || "Échec de l'enregistrement");
        }
    } catch (e) {
        console.error("Save SMS Config Error:", e);
        showToast(`Erreur: ${e.message}`, "error");
    } finally {
        if (saveBtn) {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }
};

window.resetSmsConfigToDefaults = async () => {
    const confirmed = await erpConfirm("Voulez-vous réinitialiser le prompt et la documentation avec les valeurs par défaut de Solutions Quasar ?", "Réinitialiser la configuration");
    if (!confirmed) return;

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sms/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                systemPrompt: null,
                knowledgeDocumentation: null,
                model: 'gpt-4o-mini',
                temperature: 0.7
            })
        });
        const data = await resp.json();
        if (data.success) {
            window.currentSmsConfig = data.config;
            window.renderSmsConfigFields(data.config);
            showToast("Valeurs par défaut restaurées avec succès !", "info");
        }
    } catch (e) {
        showToast(e.message, "error");
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

        // NEW: Capture Assigned Agent, Status and Preferred Language
        const assigned_agent_id = getVal('edit-assigned-agent');
        const status = getVal('edit-lead-status');
        const preferredLanguage = getVal('edit-preferred-language') || getVal('header-preferred-language') || 'fr';

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
            preferredLanguage,
            assigned_agent_id, // Add to payload
            status: status || 'NEW', // Add status to payload
            pain_signals: Array.from(document.querySelectorAll('#sidebar-pain-selector .pain-chip.selected')).map(el => el.dataset.value),
            updated_at: new Date().toISOString()
        };

        await updateDoc(doc(db, "leads", leadId), updateData);

        // Sync language with backend sequence instance if active
        try {
            const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
            await fetch(`${API_BASE}/api/leads/${leadId}/language`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ language: preferredLanguage })
            });
        } catch (_) {}

        // Update the header title immediately for UX
        const headerTitle = document.querySelector('.detail-header .text-h');
        if (headerTitle) headerTitle.innerText = business_name;

        // Update Local Cache ID Match across all caches
        syncLeadInAllCaches(leadId, updateData);

        showToast("Lead details updated successfully!", "success");

        // Refresh Grid in background
        const activeFilter = document.querySelector('button[data-filter].active-filter');
        if (activeFilter) {
            loadLeads(activeFilter.dataset.filter, true);
        }

    } catch (error) {
        console.error("Error saving lead:", error);
        showToast("Error updating lead: " + error.message, "error");
    }
};

window.handleLeadLanguageChange = async (newLang, leadId) => {
    try {
        const sel1 = document.getElementById('header-preferred-language');
        const sel2 = document.getElementById('edit-preferred-language');
        const statusText = document.getElementById('lead-language-status-text');
        if (sel1) sel1.value = newLang;
        if (sel2) sel2.value = newLang;
        if (statusText) statusText.innerHTML = `SMS : ${newLang === 'fr' ? '🇫🇷 Français' : '🇺🇸 English'}`;

        // 1. Update Firestore lead doc
        await updateDoc(doc(db, "leads", leadId), {
            preferredLanguage: newLang,
            updated_at: new Date().toISOString()
        });

        // 2. Sync universal cache
        syncLeadInAllCaches(leadId, { preferredLanguage: newLang });

        // 3. Notify backend to update sequence_instance language if active
        try {
            const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
            await fetch(`${API_BASE}/api/leads/${leadId}/language`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ language: newLang })
            });
        } catch (e) {
            console.warn("Backend language sync notification skipped:", e);
        }

        // 4. Reload SMS Timeline preview in real time!
        const leadObj = (window.allLeadsCache || []).find(l => l.id === leadId) || { id: leadId, preferredLanguage: newLang };
        leadObj.preferredLanguage = newLang;
        if (window.loadLeadSequenceTimeline) {
            await window.loadLeadSequenceTimeline(leadId, leadObj);
        }

        // 5. Refresh Pipeline view in background to update language badge
        if (window.currentFilteredLeads) {
            renderLeads(window.currentFilteredLeads);
        }

        showToast(newLang === 'fr' ? "Langue définie : 🇫🇷 Français (SMS recalculés)" : "Langue définie : 🇺🇸 English (SMS recalculés)", "success");
    } catch (err) {
        console.error("Error changing lead language:", err);
        showToast("Erreur lors de la mise à jour de la langue : " + err.message, "error");
    }
};

window.verifyLeadCasl = async (leadId) => {
    if (!leadId) return;
    try {
        showToast("🔍 Vérification conformité LCAP / CASL en cours...", "info");
        const user = auth.currentUser;
        const token = user ? await user.getIdToken() : '';
        const resp = await fetch(`${API_BASE}/api/leads/${leadId}/casl-verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        const res = await resp.json();
        if (res.success && res.casl) {
            const statusLabel = res.casl.status === 'ELIGIBLE' ? '🟢 ÉLIGIBLE' : (res.casl.status === 'INELIGIBLE' ? '🔴 REFUSÉ' : '🟠 À VÉRIFIER');
            showToast(`LCAP / CASL : ${statusLabel}. ${res.casl.notes}`, res.casl.status === 'ELIGIBLE' ? 'success' : 'warning');
            
            // Sync in local caches
            syncLeadInAllCaches(leadId, { casl: res.casl });

            // Re-open lead details to refresh UI seamlessly
            window.openLeadDetail(leadId);
        } else {
            showToast(res.error || "Erreur lors de la vérification LCAP", "error");
        }
    } catch (e) {
        showToast("Erreur réseau vérification LCAP: " + e.message, "error");
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
        loadLeads('NEW', true);

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

        // Update local status badge in current detail view
        const statusBadge = document.getElementById('edit-lead-status');
        if (statusBadge) {
            statusBadge.value = 'INTERESTED';
            statusBadge.className = 'badge status-interested';
        }

        // --- NEW: Trigger Automation ---
        if (typeof triggerWorkflowForLead === 'function') {
            await triggerWorkflowForLead(id);
        }

        // Don't close overlay anymore, let them see the activity stream
        // window.location.hash = '#leads'; 

        // Refresh main list in background
        const activeBtn = document.querySelector('button[data-filter].active-filter');
        if (activeBtn) loadLeads(activeBtn.dataset.filter, true);

    } catch (e) {
        console.error(e);
        alert('Error approving lead: ' + e.message);
    }
};

// --- GMAIL & PHONE REACHOUT MODULES (ULTRA-CLEAN & 1-CLICK) ---

window.getGmailTemplates = (lead) => {
    const biz = lead.business_name || 'votre entreprise';
    const dm = lead.dm_name || '';
    const city = lead.city || 'votre région';
    const rating = lead.google_rating ? `${lead.google_rating}★ (${lead.google_reviews_count || 0} avis)` : 'd\'excellents avis';
    const site = lead.website || '';

    return {
        directory_only: {
            title: "Indépendance vs Annuaire Tiers",
            subject: `Votre fiche ${lead.directory_platform || 'Dash Booking'} vs Votre propre vitrine web • ${biz}`,
            body: `Bonjour ${dm || "l'équipe de " + biz},

J'ai remarqué votre fiche Google avec ${rating} à ${city}. Félicitations pour la solide réputation locale que vous avez bâtie !

J'ai constaté que le bouton 'Site Web' de votre fiche redirige actuellement vers ${lead.directory_platform || 'une plateforme tierce'} (${site || 'annuaire en ligne'}). Bien que cela permette de réserver, cette configuration expose directement vos clients aux tarifs et profils de salons ou commerces concurrents situés juste à côté de vous, tout en prélevant des commissions ou frais récurrents.

Chez Solutions Quasar, nous concevons des portails web indépendants à votre marque avec système de réservation direct et agent IA autonome, sans commission d'intermédiaire, pour fidéliser 100% de votre clientèle.

Seriez-vous ouvert à un court appel découverte de 5 minutes cette semaine pour voir une démo concrète ?

Bien cordialement,

Benjamin S.
Fondateur — Solutions Quasar Inc.
+1 (819) 300-2831
info@solutionsquasar.ca | https://solutionsquasar.ca`
        },
        missing_gmb_website: {
            title: "Site non relié à Google Maps",
            subject: `Anomalie technique sur votre fiche Google Maps • ${biz}`,
            body: `Bonjour ${dm || "l'équipe de " + biz},

J'ai remarqué votre fiche d'entreprise Google avec ${rating} à ${city}. Félicitations pour votre solide réputation locale !

En faisant une recherche plus poussée, j'ai trouvé votre site internet officiel (${site || 'en ligne'}), qui est très professionnel. Cependant, j'ai constaté une anomalie technique majeure : votre site n'est absolument pas relié à votre fiche Google Business / Google Maps (votre fiche affiche le bouton 'Ajouter un site web').

Conséquence directe : les personnes qui vous cherchent sur Google ou Maps ne peuvent pas cliquer vers votre site, voir vos tarifs ou réserver en ligne. Vous perdez chaque semaine des dizaines de clients potentiels au profit de cliniques ou concurrents voisins.

Chez Solutions Quasar, nous pouvons rapidement corriger et synchroniser votre fiche Google, et y connecter un tunnel de réservation automatique pour capturer ces clients perdus.

Seriez-vous ouvert à un court appel de 5 minutes cette semaine pour régler ce point ?

Bien cordialement,

Benjamin S.
Fondateur — Solutions Quasar Inc.
+1 (819) 300-2831
info@solutionsquasar.ca | https://solutionsquasar.ca`
        },
        no_website: {
            title: "Pack Présence Web (Sans site)",
            subject: `Question rapide pour ${dm || biz} (Visibilité Google à ${city})`,
            body: `Bonjour ${dm || "l'équipe de " + biz},

J'ai remarqué votre fiche d'entreprise Google avec ${rating} à ${city}. Félicitations pour la solide réputation que vous avez bâtie !

Par contre, j'ai constaté que vous n'aviez pas encore de site web officiel rattaché directement à votre fiche. Aujourd'hui, de nombreux clients potentiels cherchent vos services sur mobile et finissent par réserver chez un concurrent simplement parce qu'ils ne trouvent pas vos tarifs ou vos coordonnées en 1 clic.

Chez Solutions Quasar, nous concevons des sites vitrines modernes, ultra-rapides et optimisés pour Google avec prise de rendez-vous automatique, livrés clé en main en 48 heures.

Seriez-vous ouvert à ce que je vous montre un exemple concret adapté à votre secteur lors d'un bref échange de 5 minutes cette semaine ?

Bien cordialement,

Benjamin S.
Fondateur — Solutions Quasar Inc.
+1 (819) 300-2831
info@solutionsquasar.ca | https://solutionsquasar.ca`
        },
        audit_overhaul: {
            title: "Refonte & Conversion Mobile",
            subject: `Recommandations visuelles & mobile pour ${biz} (${city})`,
            body: `Bonjour ${dm || "l'équipe de " + biz},

Je vous contacte car je suis tombé sur votre site web (${site || 'actuel'}) en effectuant une recherche d'entreprises locales à ${city}.

En analysant la version mobile, j'ai relevé 2 ou 3 points techniques (vitesse de chargement et clarté des appels à l'action sur téléphone) qui réduisent probablement votre taux de conversion actuel face à la concurrence.

Nous avons préparé un audit rapide sans aucun engagement pour vous montrer comment doubler les demandes de devis/rendez-vous entrants avec une interface moderne et fluide.

Auriez-vous 5 minutes ce jeudi ou vendredi pour que je vous partage ces recommandations ?

Excellente journée,

Benjamin S.
Fondateur — Solutions Quasar Inc.
+1 (819) 300-2831
info@solutionsquasar.ca | https://solutionsquasar.ca`
        },
        direct: {
            title: "Court & Percutant",
            subject: `Partenariat digital local • ${biz}`,
            body: `Bonjour ${dm || "Bonjour"},

Je fais court : je dirige l'agence Solutions Quasar et nous accompagnons les entreprises de ${city} dans l'acquisition de nouveaux clients et la mise en place d'outils automatisés (SMS, réservation en ligne, présence Google).

Avez-vous 5 minutes dans les prochains jours pour un café virtuel rapide afin de voir si nous pouvons vous apporter de la valeur ?

Cordialement,

Benjamin S.
Solutions Quasar Inc.
+1 (819) 300-2831
info@solutionsquasar.ca`
        }
    };
};

window.openGmailPitchModal = async (leadId) => {
    let lead = window.allLeadsCache?.find(l => l.id === leadId);
    if (!lead) {
        try {
            const snap = await getDoc(doc(db, "leads", leadId));
            if (snap.exists()) lead = { id: snap.id, ...snap.data() };
        } catch (e) {
            console.error(e);
        }
    }

    if (!lead) {
        window.showToast ? window.showToast("Lead introuvable", "error") : null;
        return;
    }

    const modalId = 'gmail-pitch-modal';
    const oldModal = document.getElementById(modalId);
    if (oldModal) oldModal.remove();

    const templates = window.getGmailTemplates(lead);
    const initialAngle = (lead.leadCategory === 'directory_only' || lead.has_directory_only)
        ? 'directory_only'
        : ((lead.leadCategory === 'missing_gmb_website' || lead.google_business_missing_website)
            ? 'missing_gmb_website' 
            : ((!lead.website || lead.leadCategory === 'no_website') ? 'no_website' : 'audit_overhaul'));
    const defaultTpl = templates[initialAngle] || templates.no_website;
    const initialEmail = lead.dm_email || lead.email || '';

    const html = `
    <div id="${modalId}" class="modal-overlay" style="display:flex; align-items:center; justify-content:center; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(11, 13, 16, 0.85); z-index:2200; backdrop-filter: blur(6px); padding: 1rem;">
        <div class="card" style="width:620px; max-width:96vw; background:#14171D; border:1px solid rgba(223,165,58,0.3); border-radius:14px; box-shadow: 0 25px 60px rgba(0,0,0,0.8); overflow:hidden; display:flex; flex-direction:column; max-height:92vh;">
            
            <!-- Modal Header -->
            <div style="background: #181C24; padding: 1.2rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:34px; height:34px; border-radius:8px; background:rgba(96,165,250,0.12); color:#60A5FA; display:flex; align-items:center; justify-content:center;">
                        ${SVG_ICONS.gmail}
                    </div>
                    <div>
                        <div class="text-h" style="font-size:1.05rem; margin:0; color:#FFFFFF;">Reachout Gmail IA &bull; <span class="text-gold">${escapeHtml(lead.business_name)}</span></div>
                        <div class="text-xs text-muted">1-Clic vers Gmail authentifié &bull; 100% Délivrabilité</div>
                    </div>
                </div>
                <button class="btn icon-btn" onclick="document.getElementById('${modalId}').remove()" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer;">
                    ${SVG_ICONS.close}
                </button>
            </div>

            <!-- Pitch Angle Pills -->
            <div style="padding: 0.9rem 1.5rem 0.4rem; background:rgba(255,255,255,0.015); border-bottom:1px solid rgba(255,255,255,0.05); display:flex; gap:8px; align-items:center; overflow-x:auto;">
                <span class="text-xs text-muted font-bold" style="text-transform:uppercase; font-size:0.68rem; letter-spacing:0.5px; flex-shrink:0;">Angle :</span>
                ${(lead.leadCategory === 'directory_only' || lead.has_directory_only) ? `
                <button type="button" class="btn btn-xs ${initialAngle === 'directory_only' ? 'btn-primary' : 'btn-secondary'}" onclick="window.switchGmailPitchAngle('${leadId}', 'directory_only')" id="btn-angle-directory_only" style="border-radius:16px; padding:3px 12px; font-size:0.75rem;">
                    📋 Annuaire Tiers (${escapeHtml(lead.directory_platform || 'Plateforme')})
                </button>` : ''}
                ${(lead.leadCategory === 'missing_gmb_website' || lead.google_business_missing_website) ? `
                <button type="button" class="btn btn-xs ${initialAngle === 'missing_gmb_website' ? 'btn-primary' : 'btn-secondary'}" onclick="window.switchGmailPitchAngle('${leadId}', 'missing_gmb_website')" id="btn-angle-missing_gmb_website" style="border-radius:16px; padding:3px 12px; font-size:0.75rem;">
                    📍 Site non relié Google
                </button>` : ''}
                <button type="button" class="btn btn-xs ${initialAngle === 'no_website' ? 'btn-primary' : 'btn-secondary'}" onclick="window.switchGmailPitchAngle('${leadId}', 'no_website')" id="btn-angle-no_website" style="border-radius:16px; padding:3px 12px; font-size:0.75rem;">
                    🚫 Sans Site Web
                </button>
                <button type="button" class="btn btn-xs ${initialAngle === 'audit_overhaul' ? 'btn-primary' : 'btn-secondary'}" onclick="window.switchGmailPitchAngle('${leadId}', 'audit_overhaul')" id="btn-angle-audit_overhaul" style="border-radius:16px; padding:3px 12px; font-size:0.75rem;">
                    ⚡ Refonte & Audit
                </button>
                <button type="button" class="btn btn-xs ${initialAngle === 'direct' ? 'btn-primary' : 'btn-secondary'}" onclick="window.switchGmailPitchAngle('${leadId}', 'direct')" id="btn-angle-direct" style="border-radius:16px; padding:3px 12px; font-size:0.75rem;">
                    🎯 Court & Direct
                </button>
            </div>

            <!-- Modal Body -->
            <div style="padding: 1.25rem 1.5rem; overflow-y:auto; display:flex; flex-direction:column; gap:12px;">
                <div class="form-group" style="margin:0;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <label class="form-label text-xs uppercase text-muted font-bold" style="margin:0;">Destinataire (Email de contact ou dirigeant)</label>
                        ${!initialEmail ? `<span class="badge" style="background:rgba(239,68,68,0.12); color:#F87171; font-size:0.68rem;">Email non détecté sur Google</span>` : ''}
                    </div>
                    <input type="email" id="gmail-to-input" class="form-input" value="${escapeHtml(initialEmail)}" placeholder="ex: contact@${(lead.business_name || 'entreprise').toLowerCase().replace(/[^a-z0-9]/g, '')}.com" style="background:#0F1217; border-color:rgba(255,255,255,0.1); font-size:0.85rem; height:36px;">
                </div>

                <div class="form-group" style="margin:0;">
                    <label class="form-label text-xs uppercase text-muted font-bold" style="margin-bottom:4px;">Objet du courriel</label>
                    <input type="text" id="gmail-subject-input" class="form-input" value="${escapeHtml(defaultTpl.subject)}" style="background:#0F1217; border-color:rgba(255,255,255,0.1); font-size:0.85rem; height:36px; font-weight:600;">
                </div>

                <div class="form-group" style="margin:0;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <label class="form-label text-xs uppercase text-gold font-bold" style="margin:0;">Pitch IA Pré-rempli</label>
                        <button type="button" class="btn btn-xs" onclick="window.copyGmailPitchText()" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); font-size:0.72rem; display:flex; align-items:center; gap:4px; padding:2px 8px;">
                            ${SVG_ICONS.copy} <span>Copier texte</span>
                        </button>
                    </div>
                    <textarea id="gmail-body-input" class="form-input" rows="8" style="background:#0F1217; border-color:rgba(255,255,255,0.1); font-size:0.82rem; line-height:1.45; resize:vertical; font-family:inherit;">${escapeHtml(defaultTpl.body)}</textarea>
                </div>
            </div>

            <!-- Modal Footer -->
            <div style="padding: 1rem 1.5rem; background:#181C24; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('${modalId}').remove()" style="font-size:0.8rem;">
                    Fermer
                </button>

                <div style="display:flex; gap:8px;">
                    <button type="button" class="btn btn-sm" onclick="window.sendEmailViaServer('${lead.id}')" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.15); font-size:0.8rem; display:flex; align-items:center; gap:5px;" title="Envoyer directement en arrière-plan via le serveur Resend">
                        ${SVG_ICONS.send} <span>Envoi Serveur</span>
                    </button>
                    
                    <button type="button" class="btn btn-primary btn-sm" onclick="window.launchGmailReachout('${lead.id}')" style="display:flex; align-items:center; gap:6px; font-weight:600; padding:0 16px; font-size:0.82rem; box-shadow: 0 4px 15px rgba(223, 165, 58, 0.25);">
                        ${SVG_ICONS.gmail} <span>Ouvrir et Envoyer avec Gmail</span>
                    </button>
                </div>
            </div>

        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
};

window.switchGmailPitchAngle = (leadId, angleKey) => {
    const lead = window.allLeadsCache?.find(l => l.id === leadId);
    if (!lead) return;

    const templates = window.getGmailTemplates(lead);
    const tpl = templates[angleKey];
    if (!tpl) return;

    // Toggle button active classes
    ['directory_only', 'missing_gmb_website', 'no_website', 'audit_overhaul', 'direct'].forEach(key => {
        const btn = document.getElementById(`btn-angle-${key}`);
        if (btn) {
            btn.className = `btn btn-xs ${key === angleKey ? 'btn-primary' : 'btn-secondary'}`;
        }
    });

    const subjectInput = document.getElementById('gmail-subject-input');
    const bodyInput = document.getElementById('gmail-body-input');
    if (subjectInput) subjectInput.value = tpl.subject;
    if (bodyInput) bodyInput.value = tpl.body;
};

window.copyGmailPitchText = () => {
    const bodyInput = document.getElementById('gmail-body-input');
    if (bodyInput) {
        navigator.clipboard.writeText(bodyInput.value);
        window.showToast ? window.showToast("Texte du pitch copié !", "success") : null;
    }
};

window.launchGmailReachout = async (leadId) => {
    const to = (document.getElementById('gmail-to-input')?.value || '').trim();
    const subject = (document.getElementById('gmail-subject-input')?.value || '').trim();
    const body = (document.getElementById('gmail-body-input')?.value || '').trim();

    if (!to) {
        window.showToast ? window.showToast("Veuillez saisir une adresse courriel destinataire.", "warning") : null;
        const toInput = document.getElementById('gmail-to-input');
        if (toInput) toInput.focus();
        return;
    }

    // Build standard Gmail Web Compose URL
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');

    // Update Firestore status to CONTACTED immediately
    try {
        const updateData = {
            status: 'CONTACTED',
            email: to,
            last_contact_channel: 'gmail',
            last_contact_date: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const ref = doc(db, "leads", leadId);
        await updateDoc(ref, updateData);

        // Update local cache
        if (window.allLeadsCache) {
            const cached = window.allLeadsCache.find(l => l.id === leadId);
            if (cached) {
                cached.status = 'CONTACTED';
                cached.email = to;
            }
        }

        // Close modal & notify
        const modal = document.getElementById('gmail-pitch-modal');
        if (modal) modal.remove();

        window.showToast ? window.showToast("✓ Prêt dans Gmail ! Le lead a été marqué CONTACTÉ.", "success") : null;

        // Re-render leads list to reflect updated badge
        if (window.allLeadsCache) renderLeads(window.allLeadsCache);

    } catch (e) {
        console.error('Error recording contact state:', e);
    }
};

window.sendEmailViaServer = async (leadId) => {
    const to = (document.getElementById('gmail-to-input')?.value || '').trim();
    const subject = (document.getElementById('gmail-subject-input')?.value || '').trim();
    const body = (document.getElementById('gmail-body-input')?.value || '').trim();

    if (!to || !subject || !body) {
        window.showToast ? window.showToast("Veuillez renseigner le destinataire, l'objet et le message.", "warning") : null;
        return;
    }

    try {
        window.showToast ? window.showToast("Envoi en cours via le serveur...", "info") : null;
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');

        const response = await fetch(`${API_BASE}/api/send-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ to, subject, body })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.message || data.error || 'Erreur serveur');

        // Mark lead as contacted
        await updateDoc(doc(db, "leads", leadId), {
            status: 'CONTACTED',
            email: to,
            last_contact_channel: 'server_email',
            last_contact_date: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        if (window.allLeadsCache) {
            const cached = window.allLeadsCache.find(l => l.id === leadId);
            if (cached) cached.status = 'CONTACTED';
            renderLeads(window.allLeadsCache);
        }

        const modal = document.getElementById('gmail-pitch-modal');
        if (modal) modal.remove();

        window.showToast ? window.showToast("Courriel envoyé avec succès !", "success") : null;

    } catch (e) {
        console.error(e);
        window.showToast ? window.showToast(`Échec de l'envoi serveur : ${e.message}`, "error") : null;
    }
};

// --- CALL & PHONE OUTREACH MODAL ---
window.openLeadCallModal = async (leadId) => {
    let lead = window.allLeadsCache?.find(l => l.id === leadId);
    if (!lead) {
        try {
            const snap = await getDoc(doc(db, "leads", leadId));
            if (snap.exists()) lead = { id: snap.id, ...snap.data() };
        } catch (e) {}
    }

    if (!lead) return;

    const modalId = 'lead-call-modal';
    const old = document.getElementById(modalId);
    if (old) old.remove();

    const phone = (lead.phone || '').trim();

    const html = `
    <div id="${modalId}" class="modal-overlay" style="display:flex; align-items:center; justify-content:center; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(11, 13, 16, 0.85); z-index:2200; backdrop-filter: blur(6px); padding:1rem;">
        <div class="card" style="width:480px; max-width:95vw; background:#14171D; border:1px solid rgba(255,255,255,0.1); border-radius:14px; box-shadow:0 25px 50px rgba(0,0,0,0.8); overflow:hidden;">
            
            <div style="background:#181C24; padding:1.2rem 1.5rem; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:34px; height:34px; border-radius:8px; background:rgba(255,255,255,0.06); color:#CBD5E1; display:flex; align-items:center; justify-content:center;">
                        ${SVG_ICONS.phone}
                    </div>
                    <div>
                        <div class="text-h" style="font-size:1.05rem; margin:0; color:#FFFFFF;">Appel Téléphonique</div>
                        <div class="text-xs text-muted">${escapeHtml(lead.business_name)} &bull; ${escapeHtml(lead.city || '')}</div>
                    </div>
                </div>
                <button class="btn icon-btn" onclick="document.getElementById('${modalId}').remove()" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer;">
                    ${SVG_ICONS.close}
                </button>
            </div>

            <div style="padding:1.5rem; display:flex; flex-direction:column; gap:14px;">
                <div style="text-align:center; padding:1rem; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:10px;">
                    <div class="text-xs text-muted mb-1" style="text-transform:uppercase; font-size:0.7rem; letter-spacing:1px;">Numéro de Téléphone</div>
                    <div style="font-size:1.35rem; font-weight:700; color:var(--gold); font-family:monospace; margin-bottom:8px;">
                        ${phone || '<span style="color:var(--text-muted); font-size:1rem;">Non renseigné</span>'}
                    </div>
                    ${phone ? `
                        <a href="tel:${phone}" class="btn btn-primary btn-sm" style="display:inline-flex; align-items:center; gap:6px; font-weight:600; padding:6px 18px;" onclick="window.markCallAttempt('${lead.id}')">
                            ${SVG_ICONS.phone} <span>Composer ${phone}</span>
                        </a>
                    ` : `
                        <div class="text-xs text-danger">Aucun numéro enregistré pour cette entreprise.</div>
                    `}
                </div>

                <!-- Talking Points -->
                <div style="background:rgba(223,165,58,0.04); border:1px solid rgba(223,165,58,0.15); border-radius:8px; padding:10px 14px; font-size:0.78rem; line-height:1.45;">
                    <div class="text-gold font-bold mb-1" style="display:flex; align-items:center; gap:4px;">
                        ${SVG_ICONS.sparkles} Points clés du pitch :
                    </div>
                    <ul style="margin:0; padding-left:16px; color:var(--text-main);">
                        <li><strong>Accroche :</strong> "J'ai vu votre fiche Google avec ${lead.google_rating ? lead.google_rating + '★' : 'de super avis'} à ${lead.city || 'votre ville'}..."</li>
                        <li><strong>Constat :</strong> ${(!lead.website || lead.leadCategory === 'no_website') ? '"Vous n\'avez pas encore de site web rattaché à votre fiche..."' : '"Votre site web met du temps à charger sur mobile..."'}</li>
                        <li><strong>Offre :</strong> "On conçoit des sites vitrines modernes avec prise de RDV automatique livrés en 48h."</li>
                        <li><strong>Clôture :</strong> "Auriez-vous 5 minutes pour un bref café virtuel cette semaine ?"</li>
                    </ul>
                </div>

                <!-- Quick Status Update -->
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-sm btn-block" onclick="window.updateLeadStatus('${lead.id}', 'CONTACTED')" style="flex:1; border:1px solid rgba(59,130,246,0.3); color:#60A5FA; background:rgba(59,130,246,0.08); font-size:0.75rem;">
                        Marquer Contacté
                    </button>
                    <button class="btn btn-sm btn-block" onclick="window.updateLeadStatus('${lead.id}', 'INTERESTED')" style="flex:1; border:1px solid rgba(249,115,22,0.3); color:#FB923C; background:rgba(249,115,22,0.08); font-size:0.75rem;">
                        Intéressé / Rappel
                    </button>
                </div>
            </div>

            <div style="padding:1rem 1.5rem; background:#181C24; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center;">
                <button class="btn btn-secondary btn-sm" onclick="document.getElementById('${modalId}').remove()">Fermer</button>
                <button class="btn btn-outline-gold btn-sm" onclick="document.getElementById('${modalId}').remove(); window.location.hash='#coldcall';" style="font-size:0.78rem;">
                    Ouvrir Cold Call Dialer &rarr;
                </button>
            </div>

        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
};

window.markCallAttempt = async (leadId) => {
    try {
        await updateDoc(doc(db, "leads", leadId), {
            last_call_date: new Date().toISOString(),
            last_contact_channel: 'phone',
            updated_at: new Date().toISOString()
        });
    } catch (e) {
        console.error(e);
    }
};

window.enrichLeadContactsFromWebsite = async (leadId) => {
    try {
        window.showToast("Scan du site web en cours (extraction téléphone & email)...", "info");
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`http://localhost:5000/api/leads/${leadId}/enrich-contacts`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.success) {
            const ext = data.extracted;
            let foundDetails = [];
            
            if (ext.primaryPhone) {
                const phoneInput = document.getElementById('edit-phone');
                if (phoneInput) phoneInput.value = ext.primaryPhone;
                foundDetails.push(`Tél: ${ext.primaryPhoneFormatted || ext.primaryPhone}`);
            }
            if (ext.primaryEmail) {
                const emailInput = document.getElementById('edit-email');
                if (emailInput) emailInput.value = ext.primaryEmail;
                foundDetails.push(`Email: ${ext.primaryEmail}`);
            }
            if (ext.instagram) {
                foundDetails.push(`Insta: ${ext.instagram}`);
            }
            
            if (foundDetails.length > 0) {
                window.showToast(`✅ Trouvé sur le site : ${foundDetails.join(' | ')}`, "success");
            } else {
                window.showToast("Aucun téléphone ou email public n'a été détecté dans le code du site.", "warning");
            }
        } else {
            throw new Error(data.error || data.reason || 'Erreur lors du scan');
        }
    } catch (e) {
        window.showToast(`Erreur extraction : ${e.message}`, "error");
    }
};

window.enrichLeadDecisionMakerWithPerplexity = async (leadId) => {
    const btn = document.getElementById(`btn-enrich-dm-${leadId}`);
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="material-icons" style="font-size:12px; display:inline-block; animation:spin 1s linear infinite;">sync</span> Recherche...`;
    }

    try {
        window.showToast("🔎 Perplexity Agent API recherche le dirigeant sur le web en direct...", "info");
        const token = await (window.auth?.currentUser?.getIdToken() || Promise.resolve(localStorage.getItem('authToken') || ''));
        const resp = await fetch(`http://localhost:5000/api/leads/${leadId}/enrich-decision-maker`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        const data = await resp.json();
        if (data.success && data.found) {
            const dm = data.result;
            window.showToast(`🎯 Décideur identifié : ${dm.dm_name} (${dm.dm_title || 'Dirigeant'})`, "success");

            const nameInput = document.getElementById('edit-dm-name');
            if (nameInput) nameInput.value = dm.dm_name;
            const emailInput = document.getElementById('edit-dm-email');
            if (emailInput && dm.dm_email) emailInput.value = dm.dm_email;
            const phoneInput = document.getElementById('edit-dm-phone');
            if (phoneInput && dm.dm_phone) phoneInput.value = dm.dm_phone;

            const badgeSlot = document.getElementById(`dm-source-badge-${leadId}`);
            if (badgeSlot && dm.source_summary) {
                badgeSlot.innerHTML = `<div style="font-size:0.68rem; color:#94A3B8; margin-bottom:6px; font-style:italic; background:rgba(0,0,0,0.25); padding:3px 6px; border-radius:4px; border:1px solid rgba(223,165,58,0.2);">🔍 Source Perplexity : ${escapeHtml(dm.source_summary)}</div>`;
            }
        } else {
            window.showToast("Perplexity n'a pas pu identifier formellement le dirigeant dans les registres publics.", "warning");
        }
    } catch (e) {
        window.showToast(`Erreur Perplexity : ${e.message}`, "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};


