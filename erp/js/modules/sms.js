import { db, auth } from '../firebase-config.js';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, updateDoc, setDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { t } from '../services/translationService.js';
import { openSequencesConfigModal } from './sequences.js';

const IS_LOCALHOST = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');
const LOCAL_API_BASE = 'http://localhost:5000';
const PROD_API_BASE = 'https://quasar-erp-b26d5.web.app';
const API_BASE = IS_LOCALHOST ? LOCAL_API_BASE : '';
let localBackendUnavailable = false;

/**
 * Resilient API Fetch helper: tries localhost:5000 with a fast timeout when running locally,
 * and seamlessly falls back to the production Cloud Function API if local backend is offline.
 */
async function smsApiFetch(path, options = {}) {
    if (!IS_LOCALHOST) {
        return fetch(path, options);
    }
    if (!localBackendUnavailable) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1800);
            const resp = await fetch(`${LOCAL_API_BASE}${path}`, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return resp;
        } catch (_) {
            localBackendUnavailable = true;
            console.info('[SMS] Local backend port 5000 unreachable — routing API calls to production Cloud Functions.');
        }
    }
    return fetch(`${PROD_API_BASE}${path}`, options);
}

let activeConversationId = null;
let conversationsCache = [];
let activeFilter = 'all'; // 'all', 'unread', 'ai_on', 'ai_off'
let searchQuery = '';
let unsubscribeSnapshot = null;
let activeLeadCache = [];

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getCleanWebsiteDomain(url) {
    if (!url) return '';
    try {
        const clean = String(url).trim();
        const u = new URL(clean.startsWith('http') ? clean : 'https://' + clean);
        return u.hostname.replace(/^www\./i, '');
    } catch (_) {
        return String(url).replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
    }
}

/**
 * Format phone numbers nicely: +18193002831 -> +1 (819) 300-2831
 */
function formatPhone(phone) {
    if (!phone) return '';
    const cleaned = String(phone).replace(/[^\d+]/g, '');
    const digits = cleaned.replace(/^\+1|^1|\+/, '');
    if (digits.length === 10) {
        return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
}

/**
 * Format timestamp to relative or localized time
 */
function formatTime(isoString) {
    if (!isoString) return '';
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return '';
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "À l'instant";
        if (diffMins < 60) return `Il y a ${diffMins} min`;
        if (diffHours < 24 && d.getDate() === now.getDate()) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        if (diffDays === 1) return "Hier";
        if (diffDays < 7) {
            return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (_) {
        return '';
    }
}

/**
 * Format Omnichannel Badges (WhatsApp, Instagram, Facebook Messenger, SMS)
 */
export function getChannelBadge(channel) {
    const c = String(channel || 'sms').toLowerCase();
    switch (c) {
        case 'whatsapp':
            return {
                code: 'whatsapp',
                label: 'WhatsApp',
                shortLabel: 'WA',
                icon: 'chat',
                color: '#25D366',
                bg: 'rgba(37, 211, 102, 0.15)',
                border: 'rgba(37, 211, 102, 0.4)'
            };
        case 'instagram':
            return {
                code: 'instagram',
                label: 'Instagram',
                shortLabel: 'IG',
                icon: 'photo_camera',
                color: '#E1306C',
                bg: 'rgba(225, 48, 108, 0.15)',
                border: 'rgba(225, 48, 108, 0.4)'
            };
        case 'facebook':
            return {
                code: 'facebook',
                label: 'Messenger',
                shortLabel: 'FB',
                icon: 'forum',
                color: '#0084FF',
                bg: 'rgba(0, 132, 255, 0.15)',
                border: 'rgba(0, 132, 255, 0.4)'
            };
        case 'email':
            return {
                code: 'email',
                label: 'Email',
                shortLabel: '@',
                icon: 'mail',
                color: '#EA4335',
                bg: 'rgba(234, 67, 53, 0.15)',
                border: 'rgba(234, 67, 53, 0.4)'
            };
        case 'sms':
        default:
            return {
                code: 'sms',
                label: 'SMS',
                shortLabel: 'SMS',
                icon: 'sms',
                color: 'var(--gold)',
                bg: 'rgba(223, 165, 58, 0.15)',
                border: 'rgba(223, 165, 58, 0.4)'
            };
    }
}

/**
 * Format Lead Status into consistent label, badge colors, and icons
 */
export function formatLeadStatusBadge(status) {
    const s = String(status || 'NEW').toUpperCase();
    switch (s) {
        case 'NEW':
            return {
                code: 'NEW',
                label: 'Nouveau',
                shortLabel: 'Nouveau',
                icon: 'fiber_new',
                color: 'var(--gold)',
                bg: 'rgba(223, 165, 58, 0.12)',
                border: 'rgba(223, 165, 58, 0.35)'
            };
        case 'AUDITED':
            return {
                code: 'AUDITED',
                label: 'Audité IA',
                shortLabel: 'Audité',
                icon: 'auto_awesome',
                color: '#C084FC',
                bg: 'rgba(192, 132, 252, 0.12)',
                border: 'rgba(192, 132, 252, 0.35)'
            };
        case 'APPROVED':
            return {
                code: 'APPROVED',
                label: 'Approuvé',
                shortLabel: 'Approuvé',
                icon: 'check_circle',
                color: '#4ADE80',
                bg: 'rgba(34, 197, 94, 0.12)',
                border: 'rgba(34, 197, 94, 0.35)'
            };
        case 'CONTACTED':
            return {
                code: 'CONTACTED',
                label: 'Contacté',
                shortLabel: 'Contacté',
                icon: 'outgoing_mail',
                color: '#60A5FA',
                bg: 'rgba(96, 165, 250, 0.12)',
                border: 'rgba(96, 165, 250, 0.35)'
            };
        case 'INTERESTED':
        case 'REPLIED':
            return {
                code: 'INTERESTED',
                label: 'Intéressé / Répondu',
                shortLabel: 'Intéressé',
                icon: 'mark_chat_unread',
                color: '#FB923C',
                bg: 'rgba(251, 146, 60, 0.15)',
                border: 'rgba(251, 146, 60, 0.4)'
            };
        case 'QUALIFIED':
            return {
                code: 'QUALIFIED',
                label: 'Qualifié',
                shortLabel: 'Qualifié',
                icon: 'verified',
                color: '#22C55E',
                bg: 'rgba(34, 197, 94, 0.15)',
                border: 'rgba(34, 197, 94, 0.4)'
            };
        case 'MEETING_SCHEDULED':
            return {
                code: 'MEETING_SCHEDULED',
                label: 'RDV Fixé',
                shortLabel: 'RDV Fixé',
                icon: 'event',
                color: '#C084FC',
                bg: 'rgba(192, 132, 252, 0.15)',
                border: 'rgba(192, 132, 252, 0.4)'
            };
        case 'CLIENT':
            return {
                code: 'CLIENT',
                label: 'Client Actif',
                shortLabel: 'Client',
                icon: 'star',
                color: '#10B981',
                bg: 'rgba(16, 185, 129, 0.18)',
                border: 'rgba(16, 185, 129, 0.45)'
            };
        case 'COLD_NURTURE':
            return {
                code: 'COLD_NURTURE',
                label: 'Nurturing (J+60)',
                shortLabel: 'Nurturing',
                icon: 'eco',
                color: '#34D399',
                bg: 'rgba(52, 211, 153, 0.12)',
                border: 'rgba(52, 211, 153, 0.35)'
            };
        case 'WAITING_REPLY':
            return {
                code: 'WAITING_REPLY',
                label: 'Relance J+2',
                shortLabel: 'Relance J+2',
                icon: 'hourglass_empty',
                color: '#FB923C',
                bg: 'rgba(251, 146, 60, 0.12)',
                border: 'rgba(251, 146, 60, 0.3)'
            };
        case 'BUMP_SENT':
            return {
                code: 'BUMP_SENT',
                label: 'Relance J+2 envoyée',
                shortLabel: 'Relance envoyée',
                icon: 'bolt',
                color: '#FACC15',
                bg: 'rgba(250, 204, 21, 0.12)',
                border: 'rgba(250, 204, 21, 0.3)'
            };
        case 'BREAKUP_SENT':
            return {
                code: 'BREAKUP_SENT',
                label: 'Break-up J+5',
                shortLabel: 'Break-up',
                icon: 'exit_to_app',
                color: '#C084FC',
                bg: 'rgba(192, 132, 252, 0.12)',
                border: 'rgba(192, 132, 252, 0.3)'
            };
        case 'ARCHIVED':
        case 'REJECTED':
            return {
                code: 'ARCHIVED',
                label: 'Archivé (6 mois)',
                shortLabel: 'Archivé',
                icon: 'archive',
                color: '#94A3B8',
                bg: 'rgba(148, 163, 184, 0.12)',
                border: 'rgba(148, 163, 184, 0.3)'
            };
        default:
            return {
                code: s,
                label: s,
                shortLabel: s,
                icon: 'label',
                color: 'var(--gold)',
                bg: 'rgba(223, 165, 58, 0.12)',
                border: 'rgba(223, 165, 58, 0.35)'
            };
    }
}

/**
 * Resolves the pain point / problem to solve for a lead or conversation
 */
export function resolveProblemConfig(lead, conv) {
    if (lead?.problem_to_solve) {
        return {
            category: 'custom',
            label: lead.problem_to_solve,
            shortLabel: lead.problem_to_solve.length > 20 ? lead.problem_to_solve.slice(0, 18) + '...' : lead.problem_to_solve,
            detail: lead.problem_to_solve,
            icon: 'build',
            color: '#A78BFA',
            bg: 'rgba(167, 139, 250, 0.12)',
            border: 'rgba(167, 139, 250, 0.35)'
        };
    }

    const cat = lead?.leadCategory || lead?.category || conv?.targetCategory || '';
    const seqId = lead?.activeSequenceId || conv?.activeSequenceId || '';
    const painSignals = Array.isArray(lead?.pain_signals) ? lead.pain_signals : (Array.isArray(lead?.pain_points) ? lead.pain_points : []);

    let inferredFromMsg = null;
    if (Array.isArray(conv?.messages)) {
        for (const m of conv.messages) {
            const content = (m.content || '').toLowerCase();
            if (content.includes('evenings & weekends') || content.includes('soirs & fins de semaine') || content.includes('ai assistants that qualify leads') || content.includes('répondeur')) {
                inferredFromMsg = 'modern_no_ai';
                break;
            }
            if (content.includes('concept de site web') || content.includes('website concept with online booking') || content.includes('lancer votre site officiel') || content.includes('sans site')) {
                inferredFromMsg = 'no_website';
                break;
            }
            if (content.includes('temps à charger sur cellulaire') || content.includes('load on mobile') || content.includes('vitesse sur mobile') || content.includes('refonte')) {
                inferredFromMsg = 'outdated_website';
                break;
            }
            if (content.includes('annuaire') || content.includes('plateforme') || content.includes('dash booking') || content.includes('fresha') || content.includes('booksy')) {
                inferredFromMsg = 'directory_only';
                break;
            }
            if (content.includes('fiche google') || content.includes('google listing') || content.includes('google maps')) {
                inferredFromMsg = 'missing_gmb_website';
                break;
            }
        }
    }

    const effectiveCat = cat || inferredFromMsg || (seqId ? seqId.replace('seq_', '') : '');

    if (effectiveCat === 'modern_no_ai' || painSignals.includes('NO_AI') || painSignals.includes('NO_AUTOMATION')) {
        return {
            category: 'modern_no_ai',
            label: 'Agent IA 24/7 (Soirs & Fins de sem.)',
            shortLabel: 'IA 24/7 & RDV',
            detail: "Manque de répondeur IA autonome pour capturer les leads et fixer des rendez-vous en dehors des heures d'ouverture.",
            icon: 'smart_toy',
            color: '#A78BFA',
            bg: 'rgba(167, 139, 250, 0.12)',
            border: 'rgba(167, 139, 250, 0.35)'
        };
    }

    if (effectiveCat === 'no_website' || painSignals.includes('NO_WEBSITE')) {
        return {
            category: 'no_website',
            label: 'Aucun Site Web Officiel',
            shortLabel: 'Sans site web',
            detail: "Aucun site internet dédié détecté sur Google. Besoin d'un portail moderne clé en main avec prise de rendez-vous.",
            icon: 'public_off',
            color: '#F87171',
            bg: 'rgba(248, 113, 113, 0.12)',
            border: 'rgba(248, 113, 113, 0.35)'
        };
    }

    if (effectiveCat === 'outdated_website' || painSignals.includes('SLOW_SPEED') || painSignals.includes('BAD_DESIGN')) {
        return {
            category: 'outdated_website',
            label: 'Refonte & Vitesse Mobile',
            shortLabel: 'Refonte & Vitesse',
            detail: "Site existant lent ou désuet sur mobile. Perte de conversion et expérience utilisateur dégradée.",
            icon: 'speed',
            color: '#FBBF24',
            bg: 'rgba(251, 191, 36, 0.12)',
            border: 'rgba(251, 191, 36, 0.35)'
        };
    }

    if (effectiveCat === 'directory_only' || lead?.has_directory_only || painSignals.includes('DIRECTORY_ONLY')) {
        const plat = lead?.directory_platform || 'Tierce';
        return {
            category: 'directory_only',
            label: `Annuaire seul (${plat})`,
            shortLabel: 'Annuaire seul',
            detail: `Commerce hébergé uniquement sur une plateforme tierce (${plat}). Dépendance aux commissions et concurrence directe.`,
            icon: 'storefront',
            color: '#FB923C',
            bg: 'rgba(251, 146, 60, 0.12)',
            border: 'rgba(251, 146, 60, 0.35)'
        };
    }

    if (effectiveCat === 'missing_gmb_website' || lead?.google_business_missing_website) {
        return {
            category: 'missing_gmb_website',
            label: 'Site absent de Google Maps',
            shortLabel: 'Maps sans site',
            detail: 'Site web actif mais absent de la fiche Google Business Maps. Perte de trafic local qualifié.',
            icon: 'wrong_location',
            color: '#38BDF8',
            bg: 'rgba(56, 189, 248, 0.12)',
            border: 'rgba(56, 189, 248, 0.35)'
        };
    }

    const auditSummary = lead?.lastAudit?.summary || lead?.audit_notes || '';
    return {
        category: 'general',
        label: auditSummary ? (auditSummary.length > 30 ? auditSummary.slice(0, 28) + '...' : auditSummary) : 'Audit & Conversion Web',
        shortLabel: 'Optimisation Web',
        detail: auditSummary || "Amélioration de la présence en ligne, conversion locale et intégration d'assistants IA.",
        icon: 'tune',
        color: 'var(--gold)',
        bg: 'rgba(223, 165, 58, 0.12)',
        border: 'rgba(223, 165, 58, 0.35)'
    };
}

/**
 * Resolves full lead status, problem, and metadata for a conversation
 */
export function resolveLeadInfo(conv, leadData = null) {
    const lead = leadData || conv?._leadData || null;

    let rawStatus = lead?.status || conv?.leadStatus || null;
    if (!rawStatus) {
        if (conv?.stalledState === 'WAITING_REPLY') {
            rawStatus = 'WAITING_REPLY';
        } else if (conv?.stalledState === 'BUMP_SENT') {
            rawStatus = 'BUMP_SENT';
        } else if (conv?.stalledState === 'BREAKUP_SENT') {
            rawStatus = 'BREAKUP_SENT';
        } else if (conv?.messages && conv.messages.some(m => m.role === 'user')) {
            rawStatus = 'INTERESTED';
        } else if (conv?.messages && conv.messages.length > 0) {
            rawStatus = 'CONTACTED';
        } else {
            rawStatus = 'NEW';
        }
    }

    const statusConfig = formatLeadStatusBadge(rawStatus);
    const problemConfig = resolveProblemConfig(lead, conv);
    const website = lead?.website || lead?.website_url || lead?.url || lead?.directory_url || conv?.website || conv?._leadData?.website || null;

    return {
        status: statusConfig,
        problem: problemConfig,
        leadId: lead?.id || conv?.leadId || null,
        website: website,
        leadData: lead
    };
}

/**
 * Asynchronously enriches conversation with Firestore lead doc and refreshes badges
 */
export async function fetchAndRefreshLeadForConversation(conv) {
    if (!conv) return;

    try {
        let matchedLead = null;

        if (conv.leadId) {
            matchedLead = (window.allLeadsCache || []).find(l => l.id === conv.leadId)
                || (window.masterLeadsCache || []).find(l => l.id === conv.leadId)
                || (activeLeadCache || []).find(l => l.id === conv.leadId);
        }

        const phoneClean = (conv.phoneNumber || '').replace(/[^\d]/g, '');
        const last10 = phoneClean.slice(-10);

        if (!matchedLead && last10) {
            matchedLead = (window.allLeadsCache || []).find(l => (l.phone || '').replace(/[^\d]/g, '').endsWith(last10))
                || (window.masterLeadsCache || []).find(l => (l.phone || '').replace(/[^\d]/g, '').endsWith(last10))
                || (activeLeadCache || []).find(l => (l.phone || '').replace(/[^\d]/g, '').endsWith(last10));
        }

        if (!matchedLead && conv.leadId) {
            const snap = await getDoc(doc(db, 'leads', conv.leadId));
            if (snap.exists()) {
                matchedLead = { id: snap.id, ...snap.data() };
            }
        }

        if (!matchedLead && conv.phoneNumber) {
            const qPhone = query(collection(db, 'leads'), where('phone', '==', conv.phoneNumber));
            const snapP = await getDocs(qPhone);
            if (!snapP.empty) {
                const d = snapP.docs[0];
                matchedLead = { id: d.id, ...d.data() };
            }
        }

        if (matchedLead) {
            conv._leadData = matchedLead;
            if (!conv.leadId) conv.leadId = matchedLead.id;
            if (!conv.companyName && (matchedLead.business_name || matchedLead.company)) {
                conv.companyName = matchedLead.business_name || matchedLead.company;
            }

            if (activeConversationId === conv.id) {
                const refreshed = resolveLeadInfo(conv, matchedLead);
                const statusBtn = document.getElementById('sms-lead-status-pill');
                const problemBtn = document.getElementById('sms-lead-problem-pill');

                if (statusBtn) {
                    statusBtn.style.background = refreshed.status.bg;
                    statusBtn.style.borderColor = refreshed.status.border;
                    statusBtn.style.color = refreshed.status.color;
                    statusBtn.title = `Statut actuel du prospect : ${refreshed.status.label}. Cliquez pour changer de statut.`;
                    statusBtn.innerHTML = `
                        <span class="material-icons" style="font-size:12px;">${refreshed.status.icon}</span>
                        <span class="sms-pill-text-desktop">Statut : <strong>${refreshed.status.label}</strong></span>
                        <span class="sms-pill-text-mobile">${refreshed.status.shortLabel}</span>
                        <span class="material-icons" style="font-size:11px; opacity:0.7;">arrow_drop_down</span>
                    `;
                }

                if (problemBtn) {
                    problemBtn.style.background = refreshed.problem.bg;
                    problemBtn.style.borderColor = refreshed.problem.border;
                    problemBtn.style.color = refreshed.problem.color;
                    problemBtn.title = `Problème à résoudre : ${escapeHtml(refreshed.problem.detail)}. Cliquez pour voir le diagnostic.`;
                    problemBtn.innerHTML = `
                        <span class="material-icons" style="font-size:12px;">${refreshed.problem.icon}</span>
                        <span class="sms-pill-text-desktop">Problème : <strong>${escapeHtml(refreshed.problem.label)}</strong></span>
                        <span class="sms-pill-text-mobile">${escapeHtml(refreshed.problem.shortLabel)}</span>
                        <span class="material-icons" style="font-size:11px; opacity:0.7;">info_outline</span>
                    `;
                }

                // Dynamic Website Link Refresh
                const webSlot = document.getElementById('sms-lead-website-slot');
                const freshWeb = matchedLead.website || matchedLead.website_url || matchedLead.url || matchedLead.directory_url;
                if (webSlot && freshWeb) {
                    const dom = getCleanWebsiteDomain(freshWeb);
                    const href = freshWeb.startsWith('http') ? freshWeb : 'https://' + freshWeb;
                    webSlot.innerHTML = `<span class="sms-desktop-inline">•</span> <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="text-xs text-gold" style="text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-weight:600;" title="Ouvrir le site web : ${escapeHtml(href)}"><span class="material-icons" style="font-size:13px;">language</span><span class="truncate" style="max-width:180px;">${escapeHtml(dom || 'Site Web')} ↗</span></a>`;
                }

                const menuWebSlot = document.getElementById('sms-menu-website-slot');
                if (menuWebSlot && freshWeb) {
                    const dom = getCleanWebsiteDomain(freshWeb);
                    const href = freshWeb.startsWith('http') ? freshWeb : 'https://' + freshWeb;
                    menuWebSlot.innerHTML = `
                    <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="sms-menu-btn" style="text-decoration:none;" onclick="window.closeSmsThreadMenu();">
                        <span class="material-icons" style="font-size:18px; color:var(--gold);">language</span>
                        <span>Visiter le site (${escapeHtml(dom || 'Web')}) ↗</span>
                    </a>`;
                }
            }
        }
    } catch (e) {
        console.warn("[SMS] Lead enrichment error:", e);
    }
}

/**
 * Main Entry Point for the SMS Module
 */
export async function initSms() {
    console.log("Premium Quasar: Initializing SMS Conversations Module...");
    const container = document.getElementById('view-sms');
    if (!container) return;

    renderSmsModuleLayout(container);
    setupRealtimeListener();
    preloadLeadsForNewSms();

    // Check URL parameters for requested conversation
    setTimeout(() => {
        handleUrlRequestedConversation();
    }, 120);

    // Attach hash listener for seamless in-app switches
    if (!window._smsHashListenerAttached) {
        window.addEventListener('hashchange', () => {
            if (window.location.hash.startsWith('#sms')) {
                handleUrlRequestedConversation();
            }
        });
        window._smsHashListenerAttached = true;
    }
}

/**
 * Preload recent leads/clients to offer quick selection in "+ Nouveau SMS"
 */
async function preloadLeadsForNewSms() {
    try {
        const leadsSnap = await (db.collection ? db.collection('leads').limit(50).get() : getDocs(query(collection(db, 'leads'), limit(50))));
        activeLeadCache = [];
        leadsSnap.forEach(d => {
            const data = d.data();
            if (data.phone) {
                activeLeadCache.push({
                    id: d.id,
                    name: data.name || data.business_name || '',
                    company: data.company || data.business_name || '',
                    phone: data.phone
                });
            }
        });
    } catch (_) {}
}

/**
 * Render the top-level structural layout of the SMS Module
 */
function renderSmsModuleLayout(container) {
    container.innerHTML = `
        <div id="sms-module-container" class="sms-module-container">
            
            <!-- Top Header Bar -->
            <div id="sms-top-bar" class="sms-top-bar">
                <div class="sms-header-brand">
                    <div class="sms-header-icon">
                        <span class="material-icons">forum</span>
                    </div>
                    <div>
                        <div class="sms-header-title-row">
                            <h2 class="sms-header-title">Boîte Omnicanale & SMS</h2>
                            <span class="sms-status-badge">
                                <span class="sms-status-dot"></span>
                                <span class="sms-badge-text">Multicanal Actif (SMS • WhatsApp • Instagram • Messenger • Email)</span>
                            </span>
                        </div>
                        <div class="sms-header-desc text-xs text-muted" style="margin-top:2px;">
                            Centralisation unifiée des SMS, WhatsApp Business, Instagram DM et Messenger avec répondeur IA autonome et reprise en direct.
                        </div>
                    </div>
                </div>

                <div class="sms-header-actions">
                    <button class="btn btn-secondary btn-sm sms-action-btn sms-desktop-action" onclick="window.openOmnichannelSimulatorModal()" title="Tester et simuler un message (WhatsApp, Instagram, Messenger, SMS)" style="border-color:rgba(37,211,102,0.4); color:#25D366;">
                        <span class="material-icons" style="font-size:16px; color:#25D366;">science</span>
                        <span class="sms-btn-label">🧪 Simuler Message</span>
                    </button>
                    <button class="btn btn-secondary btn-sm sms-action-btn sms-desktop-action" onclick="window.openSequencesConfigModal()" title="Séquences & Simulation">
                        <span class="material-icons" style="font-size:16px; color:var(--gold);">repeat</span>
                        <span class="sms-btn-label">Séquences</span>
                    </button>
                    <button class="btn btn-secondary btn-sm sms-action-btn sms-desktop-action" id="btn-sms-ai-config" title="Prompt & Docs IA">
                        <span class="material-icons" style="font-size:16px; color:var(--gold);">tune</span>
                        <span class="sms-btn-label">Prompt IA</span>
                    </button>
                    <button class="btn btn-secondary btn-sm sms-action-btn sms-desktop-action" id="btn-gmail-inbox" onclick="window.handleGmailInboxButton()" title="Connecter / synchroniser Gmail" style="border-color:rgba(234,67,53,0.4); color:#EA4335;">
                        <span class="material-icons" style="font-size:16px; color:#EA4335;">mail</span>
                        <span class="sms-btn-label" id="gmail-inbox-btn-label">Gmail</span>
                    </button>
                    <button class="btn btn-primary btn-sm sms-action-btn" id="btn-new-sms" style="display:flex; align-items:center; gap:6px;">
                        <span class="material-icons" style="font-size:16px;">add_comment</span>
                        <span>Nouveau Message</span>
                    </button>
                    <!-- Mobile 3-Dots for Module Actions -->
                    <div class="sms-module-menu-wrap sms-mobile-only" style="position:relative;">
                        <button id="btn-sms-module-menu" class="sms-3dots-btn" onclick="window.toggleSmsModuleMenu(event)" title="Options de la boîte omnicanale">
                            <span class="material-icons">more_vert</span>
                        </button>
                        <div id="sms-module-menu-dropdown" class="sms-dropdown-menu" style="display:none;">
                            <button class="sms-menu-btn" onclick="window.openOmnichannelSimulatorModal(); window.closeSmsModuleMenu();">
                                <span class="material-icons" style="font-size:18px; color:#25D366;">science</span>
                                <span>🧪 Simuler Message Entrant</span>
                            </button>
                            <button class="sms-menu-btn" onclick="if(window.openSequencesConfigModal) window.openSequencesConfigModal(); window.closeSmsModuleMenu();">
                                <span class="material-icons" style="font-size:18px; color:var(--gold);">repeat</span>
                                <span>Séquences & Simulation</span>
                            </button>
                            <button class="sms-menu-btn" onclick="if(window.openSmsConfigModal) window.openSmsConfigModal(); window.closeSmsModuleMenu();">
                                <span class="material-icons" style="font-size:18px; color:var(--gold);">tune</span>
                                <span>Prompt & Documentation IA</span>
                            </button>
                            <button class="sms-menu-btn" onclick="window.handleGmailInboxButton(); window.closeSmsModuleMenu();">
                                <span class="material-icons" style="font-size:18px; color:#EA4335;">mail</span>
                                <span>Gmail : connecter / synchroniser</span>
                            </button>
                            <div class="sms-menu-divider"></div>
                            <div style="padding:10px 14px; font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:8px;">
                                <span class="sms-status-dot" style="flex-shrink:0;"></span>
                                <span>Canaux : WhatsApp • SMS • IG • FB • Email</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Main Bi-Pane Area -->
            <div id="sms-bi-pane" class="sms-bi-pane">
                
                <!-- Left Pane: Conversations List -->
                <div id="sms-left-pane" class="sms-left-pane">
                    
                    <!-- Search & Filter Controls -->
                    <div style="padding:12px; border-bottom:1px solid var(--border); background:rgba(255,255,255,0.01);">
                        <div style="position:relative; margin-bottom:8px;">
                            <span class="material-icons text-muted" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:18px;">search</span>
                            <input type="text" id="sms-search-input" class="form-input" placeholder="Chercher contact, numéro, message..." style="padding-left:34px; font-size:16px; height:36px; border-radius:8px;">
                            <span class="material-icons text-muted" id="sms-search-clear" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); font-size:16px; cursor:pointer; display:none;">close</span>
                        </div>
                        
                        <!-- Filter Chips -->
                        <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:4px; -webkit-overflow-scrolling:touch;">
                            <button class="sms-filter-chip active" data-filter="all">Tous</button>
                            <button class="sms-filter-chip" data-filter="whatsapp" style="color:#25D366;">🟢 WhatsApp</button>
                            <button class="sms-filter-chip" data-filter="instagram" style="color:#E1306C;">🟣 Instagram</button>
                            <button class="sms-filter-chip" data-filter="facebook" style="color:#0084FF;">🔵 Messenger</button>
                            <button class="sms-filter-chip" data-filter="sms" style="color:var(--gold);">🟡 SMS</button>
                            <button class="sms-filter-chip" data-filter="email" style="color:#EA4335;">🔴 Email</button>
                            <button class="sms-filter-chip" data-filter="unread">Non lus</button>
                            <button class="sms-filter-chip" data-filter="ai_on">🤖 IA</button>
                            <button class="sms-filter-chip" data-filter="ai_off">👤 Manuel</button>
                        </div>
                    </div>

                    <!-- Scrollable List -->
                    <div id="sms-conversations-list" style="flex:1; overflow-y:auto; padding:6px; -webkit-overflow-scrolling:touch;">
                        <div style="text-align:center; padding:2rem; color:var(--text-muted);">
                            <span class="material-icons rotating" style="font-size:24px; color:var(--gold);">refresh</span>
                            <div style="font-size:0.85rem; margin-top:8px;">Chargement des conversations...</div>
                        </div>
                    </div>

                    <!-- Left Pane Footer Status -->
                    <div style="padding:8px 12px; border-top:1px solid var(--border); background:rgba(0,0,0,0.2); font-size:0.75rem; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
                        <span id="sms-count-label">0 conversation</span>
                        <span id="sms-realtime-indicator" style="display:inline-flex; align-items:center; gap:4px; color:#21BA45;">
                            <span style="width:5px; height:5px; border-radius:50%; background:#21BA45;"></span> Temps réel
                        </span>
                    </div>
                </div>

                <!-- Right Pane: Active Thread & Composer -->
                <div id="sms-thread-pane" class="sms-thread-pane">
                    <!-- Rendered Dynamically (Empty State or Conversation View) -->
                </div>

            </div>
        </div>

        <style>
            .sms-module-container {
                display: flex;
                flex-direction: column;
                height: calc(100vh - 6rem);
                max-height: 100vh;
                gap: 14px;
                position: relative;
                box-sizing: border-box;
            }
            .sms-top-bar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 12px;
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 12px 18px;
                box-sizing: border-box;
            }
            .sms-header-brand {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .sms-header-icon {
                width: 40px;
                height: 40px;
                border-radius: 10px;
                background: rgba(223, 165, 58, 0.12);
                border: 1px solid rgba(223, 165, 58, 0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--gold);
                flex-shrink: 0;
            }
            .sms-header-title-row {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            .sms-header-title {
                font-size: 1.15rem;
                font-weight: 700;
                margin: 0;
                color: var(--text-main);
            }
            .sms-status-badge {
                background: rgba(33, 186, 69, 0.15);
                color: #21BA45;
                border: 1px solid rgba(33, 186, 69, 0.3);
                padding: 3px 10px;
                font-size: 11px;
                border-radius: 12px;
                display: inline-flex;
                align-items: center;
                gap: 5px;
            }
            .sms-status-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #21BA45;
                box-shadow: 0 0 6px #21BA45;
                display: inline-block;
            }
            .sms-header-actions {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .sms-bi-pane {
                display: flex;
                gap: 16px;
                flex: 1;
                min-height: 0;
                overflow: hidden;
                position: relative;
            }
            .sms-left-pane {
                width: 360px;
                min-width: 320px;
                max-width: 400px;
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .sms-thread-pane {
                flex: 1;
                min-width: 0;
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                position: relative;
            }
            .sms-mobile-back-btn {
                display: none !important;
            }
            .sms-mobile-only {
                display: none !important;
            }
            .sms-3dots-btn {
                width: 36px;
                height: 36px;
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid var(--border);
                color: var(--text-main);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                flex-shrink: 0;
            }
            .sms-3dots-btn:hover,
            .sms-3dots-btn:active {
                background: rgba(223, 165, 58, 0.15);
                border-color: var(--gold);
                color: var(--gold);
            }
            .sms-dropdown-menu {
                position: absolute;
                top: calc(100% + 8px);
                right: 0;
                width: 270px;
                background: rgba(21, 23, 28, 0.98);
                border: 1px solid var(--border);
                border-radius: 12px;
                box-shadow: 0 12px 35px rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(14px);
                -webkit-backdrop-filter: blur(14px);
                z-index: 1000;
                overflow: hidden;
                animation: fadeInMenu 0.15s ease-out;
            }
            @keyframes fadeInMenu {
                from { opacity: 0; transform: translateY(-6px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .sms-menu-btn {
                width: 100%;
                padding: 10px 14px;
                background: transparent;
                border: none;
                color: var(--text-main);
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 0.84rem;
                font-weight: 500;
                text-align: left;
                cursor: pointer;
                transition: background 0.15s ease, color 0.15s ease;
                box-sizing: border-box;
            }
            .sms-menu-btn:hover,
            .sms-menu-btn:active {
                background: rgba(223, 165, 58, 0.1);
                color: var(--gold);
            }
            .sms-menu-divider {
                height: 1px;
                background: var(--border);
                margin: 4px 0;
            }
            .sms-filter-chip {
                background: rgba(255, 255, 255, 0.04);
                border: 1px solid var(--border);
                color: var(--text-muted);
                padding: 4px 10px;
                border-radius: 14px;
                font-size: 0.75rem;
                cursor: pointer;
                white-space: nowrap;
                transition: all 0.2s ease;
            }
            .sms-filter-chip:hover {
                background: rgba(255, 255, 255, 0.08);
                color: var(--text-main);
            }
            .sms-filter-chip.active {
                background: rgba(223, 165, 58, 0.15);
                border-color: var(--gold);
                color: var(--gold);
                font-weight: 600;
            }
            .sms-conv-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 12px;
                border-radius: 10px;
                cursor: pointer;
                transition: background 0.15s ease, border-color 0.15s ease;
                border: 1px solid transparent;
                margin-bottom: 4px;
                user-select: none;
                -webkit-tap-highlight-color: transparent;
            }
            .sms-conv-item:hover {
                background: rgba(255, 255, 255, 0.03);
            }
            .sms-conv-item.active {
                background: rgba(223, 165, 58, 0.08);
                border-color: rgba(223, 165, 58, 0.3);
            }
            .sms-bubble-in {
                background: rgba(255, 255, 255, 0.04);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px 12px 12px 2px;
                padding: 10px 14px;
                max-width: 75%;
                align-self: flex-start;
                color: var(--text-main);
                position: relative;
            }
            .sms-bubble-ai {
                background: rgba(223, 165, 58, 0.08);
                border: 1px solid rgba(223, 165, 58, 0.25);
                border-radius: 12px 12px 2px 12px;
                padding: 10px 14px;
                max-width: 75%;
                align-self: flex-end;
                color: #FFF;
                position: relative;
            }
            .sms-bubble-agent {
                background: rgba(49, 204, 236, 0.08);
                border: 1px solid rgba(49, 204, 236, 0.25);
                border-radius: 12px 12px 2px 12px;
                padding: 10px 14px;
                max-width: 75%;
                align-self: flex-end;
                color: #FFF;
                position: relative;
            }
            /* AI Switch style */
            .ai-toggle-switch {
                position: relative;
                display: inline-block;
                width: 44px;
                height: 24px;
                flex-shrink: 0;
            }
            .ai-toggle-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            .ai-slider {
                position: absolute;
                cursor: pointer;
                top: 0; left: 0; right: 0; bottom: 0;
                background-color: #3a3f4a;
                transition: .3s;
                border-radius: 24px;
                border: 1px solid rgba(255,255,255,0.1);
            }
            .ai-slider:before {
                position: absolute;
                content: "";
                height: 16px;
                width: 16px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                transition: .3s;
                border-radius: 50%;
            }
            input:checked + .ai-slider {
                background-color: #21BA45;
                box-shadow: 0 0 8px rgba(33, 186, 69, 0.4);
            }
            input:checked + .ai-slider:before {
                transform: translateX(20px);
            }

            /* Lead Status & Problem to Solve Header Pills */
            .sms-thread-meta-row {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-top: 4px;
                flex-wrap: wrap;
            }
            .sms-header-pill {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 2px 8px;
                border-radius: 6px;
                font-size: 0.72rem;
                font-weight: 600;
                cursor: pointer;
                line-height: 1.25;
                transition: all 0.15s ease;
                border: 1px solid transparent;
                text-decoration: none;
                user-select: none;
                background: transparent;
            }
            .sms-header-pill:active {
                transform: scale(0.96);
            }
            .sms-pill-text-desktop {
                display: inline;
            }
            .sms-pill-text-mobile {
                display: none;
            }

            /* Responsive Mobile Layout (<= 860px) */
            @media (max-width: 860px) {
                .sms-mobile-only {
                    display: inline-flex !important;
                }
                .sms-desktop-action {
                    display: none !important;
                }
                .sms-desktop-control {
                    display: none !important;
                }
                .sms-desktop-inline {
                    display: none !important;
                }

                .sms-module-container {
                    height: calc(100dvh - 4.2rem) !important;
                    max-height: calc(100dvh - 4.2rem) !important;
                    gap: 8px;
                    padding: 0 4px 6px 4px;
                }
                .sms-top-bar {
                    padding: 8px 12px;
                    border-radius: 10px;
                    gap: 8px;
                    flex-wrap: nowrap;
                }
                .sms-header-title {
                    font-size: 0.95rem;
                }
                .sms-header-desc {
                    display: none;
                }
                .sms-status-badge {
                    font-size: 10px;
                    padding: 2px 6px;
                }
                .sms-badge-text {
                    display: none;
                }
                .sms-header-actions {
                    width: auto;
                    justify-content: flex-end;
                    gap: 6px;
                }
                .sms-header-actions .sms-action-btn {
                    padding: 6px 10px;
                    font-size: 0.78rem;
                }
                .sms-bi-pane {
                    gap: 0;
                }

                /* In list mode on mobile: Left pane is 100%, thread pane is hidden */
                .sms-left-pane {
                    width: 100% !important;
                    min-width: 0 !important;
                    max-width: 100% !important;
                    height: 100% !important;
                    border-radius: 10px;
                }
                .sms-thread-pane {
                    display: none !important;
                }

                /* When inside an active conversation on mobile (.mobile-thread-open) */
                .sms-module-container.mobile-thread-open .sms-top-bar {
                    display: none !important;
                }
                .sms-module-container.mobile-thread-open .sms-left-pane {
                    display: none !important;
                }
                .sms-module-container.mobile-thread-open .sms-thread-pane {
                    display: flex !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    height: 100% !important;
                    border-radius: 0 !important;
                    border: none !important;
                }

                /* Fullscreen when thread is open: remove bottom-nav and expand containers */
                body.sms-thread-open .bottom-nav {
                    display: none !important;
                }
                body.sms-thread-open main,
                body.sms-thread-open #main-content {
                    height: 100vh !important;
                    height: 100dvh !important;
                    padding: 0 !important;
                    padding-bottom: 0 !important;
                    margin: 0 !important;
                    overflow: hidden !important;
                }
                body.sms-thread-open #view-sms {
                    height: 100vh !important;
                    height: 100dvh !important;
                    padding: 0 !important;
                    margin: 0 !important;
                }
                body.sms-thread-open .sms-module-container {
                    height: 100vh !important;
                    height: 100dvh !important;
                    max-height: 100dvh !important;
                    gap: 0 !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    border-radius: 0 !important;
                }

                /* Mobile Back Button - Sleek Icon Only */
                .sms-mobile-back-btn {
                    display: inline-flex !important;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    background: rgba(255, 255, 255, 0.06);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    color: var(--gold);
                    padding: 0 !important;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    flex-shrink: 0;
                }
                .sms-mobile-back-btn:active {
                    background: rgba(223, 165, 58, 0.2);
                    border-color: var(--gold);
                    transform: scale(0.94);
                }

                /* Thread Header on Mobile */
                .sms-thread-header {
                    padding: 8px 12px !important;
                    gap: 8px !important;
                    min-height: 52px;
                }
                .sms-thread-header-contact {
                    gap: 8px !important;
                    flex: 1;
                    min-width: 0;
                }
                .sms-thread-avatar {
                    width: 36px !important;
                    height: 36px !important;
                    font-size: 0.85rem !important;
                }
                .sms-thread-title {
                    font-size: 0.95rem !important;
                }
                .sms-thread-controls {
                    gap: 6px !important;
                }
                .sms-thread-meta-row {
                    gap: 4px !important;
                    margin-top: 3px !important;
                }
                .sms-header-pill {
                    padding: 2px 6px !important;
                    font-size: 0.69rem !important;
                }
                .sms-pill-text-desktop {
                    display: none !important;
                }
                .sms-pill-text-mobile {
                    display: inline !important;
                }

                /* Chat bubbles on mobile */
                #sms-chat-messages {
                    padding: 10px 10px !important;
                    gap: 8px !important;
                }
                .sms-bubble-in, .sms-bubble-ai, .sms-bubble-agent {
                    max-width: 88% !important;
                    padding: 8px 12px !important;
                    font-size: 0.88rem !important;
                }

                /* Composer on mobile */
                .sms-composer-area {
                    padding: 8px 10px !important;
                    gap: 6px !important;
                    padding-bottom: max(12px, env(safe-area-inset-bottom)) !important;
                }
                #sms-reply-input {
                    font-size: 16px !important;
                    min-height: 44px !important;
                    padding: 8px 10px !important;
                }
                #btn-send-reply {
                    height: 44px !important;
                    padding: 0 14px !important;
                    min-width: 44px !important;
                }
                #btn-send-reply span:not(.material-icons) {
                    display: none;
                }
            }
        </style>
    `;

    // Bind event handlers
    const btnNewSms = document.getElementById('btn-new-sms');
    if (btnNewSms) btnNewSms.onclick = () => openNewSmsModal();

    const btnAiCfg = document.getElementById('btn-sms-ai-config');
    if (btnAiCfg) {
        btnAiCfg.onclick = () => {
            if (typeof window.openSmsConfigModal === 'function') {
                window.openSmsConfigModal();
            } else {
                window.showToast("Le modal de configuration est en cours de chargement...", "info");
            }
        };
    }

    const searchInput = document.getElementById('sms-search-input');
    const clearBtn = document.getElementById('sms-search-clear');
    if (searchInput) {
        searchInput.oninput = (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            if (clearBtn) clearBtn.style.display = searchQuery ? 'block' : 'none';
            renderConversationsList();
        };
    }
    if (clearBtn) {
        clearBtn.onclick = () => {
            if (searchInput) searchInput.value = '';
            searchQuery = '';
            clearBtn.style.display = 'none';
            renderConversationsList();
        };
    }

    // Filter Chips
    const chips = container.querySelectorAll('.sms-filter-chip');
    chips.forEach(chip => {
        chip.onclick = () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeFilter = chip.dataset.filter;
            renderConversationsList();
        };
    });

    renderEmptyThreadPane();
}

let unsubscribeActiveDoc = null;
let smsPollingTimer = null;

/**
 * Setup Realtime Firestore Snapshot on conversations collection (Omnichannel)
 */
function setupRealtimeListener() {
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
    }
    if (unsubscribeActiveDoc) {
        unsubscribeActiveDoc();
        unsubscribeActiveDoc = null;
    }
    if (smsPollingTimer) {
        clearInterval(smsPollingTimer);
        smsPollingTimer = null;
    }

    try {
        const q = query(collection(db, 'conversations'));
        unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
            let list = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                // AI memory/log documents (meta_*, web chat) are not inbox threads
                if (!data.channel && data.agentId) return;
                let convChannel = data.channel;
                if (!convChannel) {
                    if (docSnap.id.startsWith('facebook_') || docSnap.id.startsWith('meta_') || data.sessionId?.startsWith('meta_')) {
                        convChannel = 'facebook';
                    } else if (docSnap.id.startsWith('whatsapp_')) {
                        convChannel = 'whatsapp';
                    } else if (docSnap.id.startsWith('instagram_')) {
                        convChannel = 'instagram';
                    } else if (docSnap.id.startsWith('email_')) {
                        convChannel = 'email';
                    } else if (docSnap.id.startsWith('sms_') || data.phoneNumber) {
                        convChannel = 'sms';
                    } else {
                        convChannel = 'sms';
                    }
                }
                if (convChannel === 'meta') convChannel = 'facebook';
                // Only retain omnichannel conversations
                if (!['sms', 'whatsapp', 'instagram', 'facebook', 'email'].includes(convChannel)) return;

                const msgs = (data.messages || []).filter(m => m.role !== 'system');
                const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
                const clientName = data.clientName || data.name || data.displayName || (
                    convChannel === 'facebook' ? (data.senderId ? `Contact Facebook (${data.senderId.slice(-4)})` : 'Contact Facebook') :
                    convChannel === 'instagram' ? (data.senderId ? `Contact Instagram (${data.senderId.slice(-4)})` : 'Contact Instagram') :
                    convChannel === 'whatsapp' ? (data.phoneNumber || 'Contact WhatsApp') :
                    convChannel === 'email' ? (data.senderEmail || 'Contact Email') : ''
                );
                list.push({
                    id: docSnap.id,
                    channel: convChannel,
                    phoneNumber: data.phoneNumber || '',
                    senderId: data.senderId || data.phoneNumber || '',
                    whatsappPhoneNumberId: data.whatsappPhoneNumberId || null,
                    senderEmail: data.senderEmail || null,
                    subject: data.subject || null,
                    clientName: clientName,
                    companyName: data.companyName || '',
                    leadId: data.leadId || null,
                    clientId: data.clientId || null,
                    aiEnabled: data.aiEnabled !== false, // default true
                    unread: data.unread || false,
                    updatedAt: data.updatedAt || (lastMsg ? lastMsg.timestamp : new Date().toISOString()),
                    messages: msgs,
                    lastMessage: lastMsg
                });
            });

            // Sort by updatedAt descending
            list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
            conversationsCache = list;

            renderConversationsList();

            // Check if deep link from URL or localStorage requests a specific conversation
            const hash = window.location.hash || '';
            const qIndex = hash.indexOf('?');
            const params = qIndex !== -1 ? new URLSearchParams(hash.slice(qIndex + 1)) : new URLSearchParams();
            let savedActiveId = params.get('id');
            if (!savedActiveId) {
                try {
                    savedActiveId = localStorage.getItem('sms_active_conversation_id');
                } catch (_) {}
            }
            const hasDeepLink = hash.includes('leadId=') || hash.includes('phone=') || hash.includes('id=');

            if (hasDeepLink) {
                handleUrlRequestedConversation();
            } else if (savedActiveId && list.some(c => c.id === savedActiveId)) {
                selectConversation(savedActiveId);
            } else if (activeConversationId) {
                const currentActive = list.find(c => c.id === activeConversationId);
                if (currentActive) {
                    renderActiveThreadMessages(currentActive);
                }
            } else if (list.length > 0 && window.innerWidth >= 860) {
                // Auto-select first conversation on desktop only (keep mobile clean on list)
                selectConversation(list[0].id);
            }
        }, (error) => {
            console.error("[SMS Listener Error]", error);
            const listEl = document.getElementById('sms-conversations-list');
            if (listEl) {
                listEl.innerHTML = `<div class="text-danger" style="text-align:center; padding:1.5rem; font-size:0.85rem;">Erreur de connexion en temps réel: ${error.message}</div>`;
            }
            // Start fallback polling ONLY if the real-time Firestore listener fails
            if (!smsPollingTimer) {
                smsPollingTimer = setInterval(pollSmsConversationsFallback, 15000);
            }
        });
    } catch (e) {
        console.error("[SMS Snapshot Init Error]", e);
        if (!smsPollingTimer) {
            smsPollingTimer = setInterval(pollSmsConversationsFallback, 15000);
        }
    }
}

/**
 * Handle direct deep-links from CRM Leads or external modules (#sms?leadId=...&phone=...&name=...)
 */
export function handleUrlRequestedConversation() {
    const hash = window.location.hash || '';
    if (!hash.startsWith('#sms')) return;

    const qIndex = hash.indexOf('?');
    const params = qIndex !== -1 ? new URLSearchParams(hash.slice(qIndex + 1)) : new URLSearchParams();
    const reqLeadId = params.get('leadId');
    const reqPhone = params.get('phone');
    let reqId = params.get('id');
    if (!reqId && !reqLeadId && !reqPhone) {
        try {
            reqId = localStorage.getItem('sms_active_conversation_id');
        } catch (_) {}
    }
    const reqName = decodeURIComponent(params.get('name') || '');

    if (!reqLeadId && !reqPhone && !reqId) return;

    // 1. Try finding by direct conversation id
    if (reqId && conversationsCache.length > 0) {
        const match = conversationsCache.find(c => c.id === reqId);
        if (match) {
            selectConversation(match.id);
            return;
        }
    }

    // 2. Try finding by leadId
    if (reqLeadId && conversationsCache.length > 0) {
        const match = conversationsCache.find(c => String(c.leadId) === String(reqLeadId));
        if (match) {
            selectConversation(match.id);
            return;
        }
    }

    // 3. Try finding by phone number (last 10 digits match)
    if (reqPhone && conversationsCache.length > 0) {
        const cleanReqPhone = reqPhone.replace(/[^\d]/g, '');
        const last10 = cleanReqPhone.slice(-10);
        if (last10) {
            const match = conversationsCache.find(c => {
                const cClean = (c.phoneNumber || '').replace(/[^\d]/g, '');
                return cClean.endsWith(last10);
            });
            if (match) {
                selectConversation(match.id);
                return;
            }
        }
    }

    // 4. If conversations list is still loading, wait a bit and retry
    if (conversationsCache.length === 0) {
        setTimeout(handleUrlRequestedConversation, 300);
        return;
    }

    // 5. If no active conversation exists for this phone yet, prompt composer pre-filled
    if (reqPhone) {
        console.log(`[SMS] No existing thread found for lead ${reqLeadId || reqPhone}. Opening New SMS composer.`);
        openNewSmsModal({
            phone: reqPhone,
            name: reqName,
            leadId: reqLeadId
        });
    }
}

window.handleUrlRequestedConversation = handleUrlRequestedConversation;

window.openSmsThreadForLead = function(leadId, phone, name) {
    if (!conversationsCache || conversationsCache.length === 0) {
        setTimeout(() => window.openSmsThreadForLead(leadId, phone, name), 350);
        return;
    }

    const cleanReqPhone = (phone || '').replace(/[^\d]/g, '');
    const last10 = cleanReqPhone.slice(-10);

    const match = conversationsCache.find(c => 
        (leadId && String(c.leadId) === String(leadId)) ||
        (last10 && (c.phoneNumber || '').replace(/[^\d]/g, '').endsWith(last10))
    );

    if (match) {
        selectConversation(match.id);
    } else if (phone) {
        openNewSmsModal({
            phone: phone,
            name: name,
            leadId: leadId
        });
    }
};

/**
 * Dedicated Real-Time Document Listener for the currently active conversation
 */
function listenToActiveConversation(conversationId) {
    if (unsubscribeActiveDoc) {
        unsubscribeActiveDoc();
        unsubscribeActiveDoc = null;
    }
    if (!conversationId) return;

    try {
        const docRef = doc(db, 'conversations', conversationId);
        unsubscribeActiveDoc = onSnapshot(docRef, (docSnap) => {
            if (!docSnap.exists()) return;
            const data = docSnap.data();
            const msgs = data.messages || [];

            if (activeConversationId !== conversationId) return;

            const cached = conversationsCache.find(c => c.id === conversationId);
            if (cached) {
                cached.messages = msgs;
                cached.lastMessage = msgs.length > 0 ? msgs[msgs.length - 1] : null;
                cached.aiEnabled = data.aiEnabled !== false;
                cached.unread = data.unread || false;
                cached.updatedAt = data.updatedAt || new Date().toISOString();
            }

            // Immediately re-render active messages
            renderActiveThreadMessages({
                ...data,
                id: conversationId,
                messages: msgs
            });

            // Update live AI toggle state in header if changed externally
            const aiToggle = document.getElementById('sms-ai-toggle');
            const aiLabel = document.getElementById('ai-toggle-label');
            const isAiOn = data.aiEnabled !== false;
            if (aiToggle && aiToggle.checked !== isAiOn) {
                aiToggle.checked = isAiOn;
                if (aiLabel) {
                    aiLabel.innerHTML = `
                        <span class="material-icons" style="font-size:16px;">${isAiOn ? 'smart_toy' : 'person'}</span>
                        ${isAiOn ? 'Mode IA Automatique' : 'Reprise Humaine (IA Pause)'}
                    `;
                    aiLabel.style.color = isAiOn ? '#21BA45' : '#F2C037';
                }
            }
        }, (err) => {
            console.warn("[SMS Active Doc Listener Error]", err);
        });
    } catch (e) {
        console.warn("[SMS Active Doc Listener Init Error]", e);
    }
}

/**
 * Fallback Poller for bulletproof background synchronization
 */
async function pollSmsConversationsFallback() {
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await smsApiFetch(`/api/sms/conversations`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.success && data.conversations) {
            let hasChanged = false;
            if (data.conversations.length !== conversationsCache.length) {
                hasChanged = true;
            } else {
                for (let i = 0; i < data.conversations.length; i++) {
                    const fresh = data.conversations[i];
                    const cached = conversationsCache.find(c => c.id === fresh.id);
                    if (!cached || cached.updatedAt !== fresh.updatedAt || cached.unread !== fresh.unread || cached.aiEnabled !== fresh.aiEnabled) {
                        hasChanged = true;
                        break;
                    }
                }
            }

            if (hasChanged) {
                if (activeConversationId) {
                    const activeDoc = await smsApiFetch(`/api/sms/conversations/${activeConversationId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }).then(r => r.json()).catch(() => null);

                    if (activeDoc && activeDoc.success && activeDoc.conversation) {
                        const target = conversationsCache.find(c => c.id === activeConversationId);
                        if (target) {
                            target.messages = activeDoc.conversation.messages || [];
                            target.lastMessage = target.messages[target.messages.length - 1] || null;
                            target.aiEnabled = activeDoc.conversation.aiEnabled !== false;
                            renderActiveThreadMessages(target);
                        }
                    }
                }
                renderConversationsList();
            }
        }
    } catch (_) {}
}


/**
 * Render the list of conversations in the left pane based on current search & filter
 */
function renderConversationsList() {
    const listEl = document.getElementById('sms-conversations-list');
    const countLabel = document.getElementById('sms-count-label');
    if (!listEl) return;

    // Filter
    let filtered = conversationsCache.filter(conv => {
        // Channel filters
        if (activeFilter === 'whatsapp' && conv.channel !== 'whatsapp') return false;
        if (activeFilter === 'instagram' && conv.channel !== 'instagram') return false;
        if (activeFilter === 'facebook' && conv.channel !== 'facebook' && conv.channel !== 'meta') return false;
        if (activeFilter === 'sms' && (conv.channel || 'sms') !== 'sms') return false;
        if (activeFilter === 'email' && conv.channel !== 'email') return false;

        // Status filter
        if (activeFilter === 'unread' && !conv.unread) return false;
        if (activeFilter === 'ai_on' && !conv.aiEnabled) return false;
        if (activeFilter === 'ai_off' && conv.aiEnabled) return false;

        // Search query
        if (searchQuery) {
            const nameMatch = (conv.clientName || '').toLowerCase().includes(searchQuery);
            const companyMatch = (conv.companyName || '').toLowerCase().includes(searchQuery);
            const phoneMatch = (conv.phoneNumber || '').toLowerCase().includes(searchQuery);
            const msgMatch = (conv.lastMessage?.content || '').toLowerCase().includes(searchQuery);
            const emailMatch = (conv.senderEmail || '').toLowerCase().includes(searchQuery) || (conv.subject || '').toLowerCase().includes(searchQuery);
            if (!nameMatch && !companyMatch && !phoneMatch && !msgMatch && !emailMatch) return false;
        }

        return true;
    });

    if (countLabel) {
        countLabel.textContent = `${filtered.length} conversation${filtered.length > 1 ? 's' : ''}`;
    }

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div style="text-align:center; padding:3rem 1.5rem; color:var(--text-muted);">
                <span class="material-icons" style="font-size:32px; opacity:0.3;">speaker_notes_off</span>
                <div style="font-size:0.9rem; margin-top:8px; font-weight:600;">Aucune conversation trouvée</div>
                <div class="text-xs text-muted" style="margin-top:4px;">
                    ${searchQuery ? "Modifiez votre recherche ou réinitialisez les filtres." : "Envoyez votre premier message ou utilisez le simulateur pour tester."}
                </div>
            </div>
        `;
        return;
    }

    listEl.innerHTML = filtered.map(conv => {
        const isActive = conv.id === activeConversationId;
        const channelBadge = getChannelBadge(conv.channel);
        const displayName = conv.clientName || (conv.phoneNumber ? formatPhone(conv.phoneNumber) : (conv.senderId ? `@${conv.senderId}` : 'Contact'));
        const displaySub = conv.channel === 'email'
            ? (conv.subject || conv.senderEmail || 'Email')
            : conv.companyName 
            ? `${conv.companyName} • ${conv.phoneNumber ? formatPhone(conv.phoneNumber) : conv.senderId}`
            : (conv.phoneNumber ? formatPhone(conv.phoneNumber) : (conv.senderId ? `@${conv.senderId}` : channelBadge.label));
        const lastSnippet = conv.lastMessage?.content || 'Aucun message pour le moment';
        const timeAgo = formatTime(conv.updatedAt || conv.lastMessage?.timestamp);
        const isUnread = conv.unread;
        const isAiOn = conv.aiEnabled;
        const leadInfo = resolveLeadInfo(conv);

        // Initials for avatar
        const initials = conv.clientName
            ? conv.clientName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
            : channelBadge.shortLabel;

        return `
            <div class="sms-conv-item ${isActive ? 'active' : ''}" data-id="${conv.id}" onclick="window.selectSmsConversation('${conv.id}')">
                <!-- Avatar with Channel Tag -->
                <div style="position:relative; flex-shrink:0;">
                    <div style="width:40px; height:40px; border-radius:50%; background:${isActive ? 'rgba(223,165,58,0.2)' : 'rgba(255,255,255,0.06)'}; border:1px solid ${isActive ? 'var(--gold)' : 'var(--border)'}; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.8rem; color:${isActive ? 'var(--gold)' : 'var(--text-main)'};">
                        ${initials}
                    </div>
                    <span title="Canal : ${channelBadge.label}" style="position:absolute; bottom:-2px; right:-2px; width:17px; height:17px; border-radius:50%; background:${channelBadge.bg}; border:1px solid ${channelBadge.border}; color:${channelBadge.color}; display:flex; align-items:center; justify-content:center; font-size:9px; box-shadow:0 1px 3px rgba(0,0,0,0.6);">
                        <span class="material-icons" style="font-size:10px;">${channelBadge.icon}</span>
                    </span>
                </div>

                <!-- Info -->
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; justify-content:space-between; align-items:baseline; gap:6px;">
                        <span style="font-weight:${isUnread ? '700' : '600'}; font-size:0.88rem; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${escapeHtml(displayName)}
                        </span>
                        <span style="font-size:0.7rem; color:${isUnread ? 'var(--gold)' : 'var(--text-muted)'}; white-space:nowrap;">
                            ${timeAgo}
                        </span>
                    </div>

                    <div style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px;">
                        ${escapeHtml(displaySub)}
                    </div>

                    <!-- Compact Channel, Lead Status & Problem Badges -->
                    <div style="display:flex; align-items:center; gap:4px; margin-top:3px; flex-wrap:wrap;">
                        <span class="sms-header-pill" style="padding:1px 6px; font-size:9px; background:${channelBadge.bg}; border-color:${channelBadge.border}; color:${channelBadge.color}; font-weight:700; display:inline-flex; align-items:center; gap:3px;">
                            <span class="material-icons" style="font-size:10px;">${channelBadge.icon}</span>
                            ${channelBadge.label}
                        </span>
                        <span class="sms-header-pill" style="padding:1px 5px; font-size:9px; background:${leadInfo.status.bg}; border-color:${leadInfo.status.border}; color:${leadInfo.status.color};">
                            ${leadInfo.status.shortLabel}
                        </span>
                        <span class="sms-header-pill" style="padding:1px 5px; font-size:9px; background:${leadInfo.problem.bg}; border-color:${leadInfo.problem.border}; color:${leadInfo.problem.color};">
                            ${escapeHtml(leadInfo.problem.shortLabel)}
                        </span>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:4px;">
                        <span style="font-size:0.78rem; color:${isUnread ? 'var(--text-main)' : 'var(--text-muted)'}; font-weight:${isUnread ? '600' : 'normal'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1;">
                            ${conv.lastMessage?.role === 'assistant' ? '<span style="color:var(--gold);">Vous:</span> ' : ''}${escapeHtml(lastSnippet)}
                        </span>
                        
                        <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
                            ${(() => {
                                if (conv.stalledState === 'WAITING_REPLY') {
                                    return `<span class="badge" title="En attente de réponse (Relance J+2)" style="font-size:9px; padding:2px 6px; border-radius:10px; background:rgba(251,146,60,0.15); color:#FB923C; border:1px solid rgba(251,146,60,0.3);">⏳ Relance J+2</span>`;
                                } else if (conv.stalledState === 'BUMP_SENT') {
                                    return `<span class="badge" title="Relance J+2 envoyée, Break-up J+5 si sans réponse" style="font-size:9px; padding:2px 6px; border-radius:10px; background:rgba(234,179,8,0.15); color:#FACC15; border:1px solid rgba(234,179,8,0.3);">⚡ Relance J+2</span>`;
                                } else if (conv.stalledState === 'BREAKUP_SENT') {
                                    return `<span class="badge" title="Break-up envoyé (Nurturing J+60)" style="font-size:9px; padding:2px 6px; border-radius:10px; background:rgba(168,85,247,0.15); color:#C084FC; border:1px solid rgba(168,85,247,0.3);">🚪 Break-up</span>`;
                                } else if (conv.stalledState && conv.stalledState.startsWith('COLD_NURTURE')) {
                                    return `<span class="badge" title="Cold Nurturing actif" style="font-size:9px; padding:2px 6px; border-radius:10px; background:rgba(16,185,129,0.15); color:#10B981; border:1px solid rgba(16,185,129,0.3);">🌱 Nurturing</span>`;
                                } else if (conv.stalledState === 'ARCHIVED_INACTIVE') {
                                    return `<span class="badge" title="Archivé après 6 mois sans réponse (LCAP/CASL)" style="font-size:9px; padding:2px 6px; border-radius:10px; background:rgba(100,116,139,0.15); color:#94A3B8; border:1px solid rgba(100,116,139,0.3);">📁 Archivé 6m</span>`;
                                }
                                return '';
                            })()}
                            ${isAiOn
                                ? `<span class="badge" title="IA active" style="font-size:9px; padding:2px 6px; border-radius:10px; background:rgba(33,186,69,0.15); color:#21BA45; border:1px solid rgba(33,186,69,0.3);">🤖 IA</span>`
                                : `<span class="badge" title="Mode manuel (IA arrêtée)" style="font-size:9px; padding:2px 6px; border-radius:10px; background:rgba(242,192,55,0.15); color:#F2C037; border:1px solid rgba(242,192,55,0.3);">👤 Manuel</span>`
                            }
                            ${isUnread ? `<span style="width:8px; height:8px; border-radius:50%; background:var(--gold); display:inline-block; box-shadow:0 0 6px var(--gold);"></span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.selectSmsConversation = (id) => selectConversation(id);

/**
 * Bouton Gmail : connecte le compte si nécessaire, sinon synchronise la boîte de réception
 */
window.handleGmailInboxButton = async function() {
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
        const statusResp = await fetch(`${API_BASE}/api/integrations/gmail/status`, { headers });
        const status = await statusResp.json();

        if (!status.connected) {
            const returnTo = `${window.location.origin}${window.location.pathname}#sms`;
            const urlResp = await fetch(`${API_BASE}/api/integrations/gmail/auth-url?returnTo=${encodeURIComponent(returnTo)}`, { headers });
            const urlData = await urlResp.json();
            if (urlData.url) { window.location.href = urlData.url; return; }
            throw new Error(urlData.error || "Impossible d'obtenir le lien de connexion Gmail");
        }

        const syncResp = await fetch(`${API_BASE}/api/gmail-inbox/sync`, { method: 'POST', headers });
        const sync = await syncResp.json();
        if (!sync.success) throw new Error(sync.error || 'Échec de la synchronisation');
        if (window.showToast) window.showToast(`Gmail (${status.email}) synchronisé : ${sync.imported || 0} nouveau(x) courriel(s)`, 'success');
    } catch (e) {
        console.error('[Gmail Inbox]', e);
        if (window.showToast) window.showToast('Gmail : ' + e.message, 'error');
    }
};

window.closeMobileSmsThread = function() {
    activeConversationId = null;
    document.body.classList.remove('sms-thread-open');
    const container = document.getElementById('sms-module-container');
    if (container) {
        container.classList.remove('mobile-thread-open');
    }
    window.closeSmsThreadMenu();
    try {
        localStorage.removeItem('sms_active_conversation_id');
    } catch (_) {}
    if (window.location.hash.startsWith('#sms')) {
        history.replaceState(null, '', '#sms');
    }
    renderConversationsList();
    renderEmptyThreadPane();
};

/**
 * Select a specific conversation and render its chat history in right pane
 */
export async function selectConversation(conversationId) {
    activeConversationId = conversationId;

    // Persist conversation in URL hash and localStorage so page refresh stays on this conversation
    const targetHash = `#sms?id=${conversationId}`;
    if (window.location.hash !== targetHash) {
        history.replaceState(null, '', targetHash);
    }
    try {
        localStorage.setItem('sms_active_conversation_id', conversationId);
    } catch (_) {}

    // Add mobile thread open state class for single-pane mobile view on mobile/tablet ONLY
    if (window.innerWidth <= 1023) {
        document.body.classList.add('sms-thread-open');
    } else {
        document.body.classList.remove('sms-thread-open');
    }
    const container = document.getElementById('sms-module-container');
    if (container) {
        container.classList.add('mobile-thread-open');
    }

    renderConversationsList();
    listenToActiveConversation(conversationId);

    const conv = conversationsCache.find(c => c.id === conversationId);
    if (!conv) {
        renderEmptyThreadPane();
        return;
    }

    renderActiveThreadFrame(conv);
    renderActiveThreadMessages(conv);
    fetchAndRefreshLeadForConversation(conv);

    // If conversation was unread, mark as read in Firestore
    if (conv.unread) {
        try {
            await updateDoc(doc(db, 'conversations', conversationId), { unread: false });
        } catch (_) {}
    }
}

/**
 * Render the static frame (Header + Composer) of an active conversation
 */
function renderActiveThreadFrame(conv) {
    const threadPane = document.getElementById('sms-thread-pane');
    if (!threadPane) return;

    const displayName = conv.clientName || (conv.phoneNumber ? formatPhone(conv.phoneNumber) : (conv.senderId ? `@${conv.senderId}` : 'Contact'));
    const formattedPhone = conv.channel === 'email'
        ? `${conv.senderEmail || conv.senderId || ''}${conv.subject ? ' • ' + conv.subject : ''}`
        : (conv.phoneNumber ? formatPhone(conv.phoneNumber) : (conv.senderId ? `@${conv.senderId}` : ''));
    const isAiOn = conv.aiEnabled !== false;
    const leadInfo = resolveLeadInfo(conv);
    const channelBadge = getChannelBadge(conv.channel);

    let placeholderText = "Écrire un SMS direct (+1 819 300-2831)...";
    let sendBtnText = "Envoyer";
    if (conv.channel === 'whatsapp') {
        placeholderText = `Répondre via WhatsApp (${displayName})...`;
        sendBtnText = "WhatsApp";
    } else if (conv.channel === 'instagram') {
        placeholderText = `Répondre via Instagram Direct (${displayName})...`;
        sendBtnText = "Instagram";
    } else if (conv.channel === 'facebook') {
        placeholderText = `Répondre via Messenger (${displayName})...`;
        sendBtnText = "Messenger";
    } else if (conv.channel === 'email') {
        placeholderText = `Répondre par courriel à ${conv.senderEmail || displayName} (même fil Gmail)...`;
        sendBtnText = "Email";
    }

    threadPane.innerHTML = `
        <!-- Thread Header -->
        <div class="sms-thread-header" style="padding:10px 14px; border-bottom:1px solid var(--border); background:rgba(255,255,255,0.015); display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div class="sms-thread-header-contact" style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
                <!-- Mobile Back Button - Icon Only -->
                <button id="btn-back-to-convs" class="sms-mobile-back-btn" onclick="window.closeMobileSmsThread()" title="Retour aux conversations">
                    <span class="material-icons" style="font-size:20px;">arrow_back</span>
                </button>

                <div class="sms-thread-avatar" style="width:38px; height:38px; border-radius:50%; background:${channelBadge.bg}; border:1px solid ${channelBadge.border}; display:flex; align-items:center; justify-content:center; color:${channelBadge.color}; font-weight:700; font-size:0.92rem; flex-shrink:0;">
                    ${displayName.slice(0, 2).toUpperCase()}
                </div>
                <div style="min-width:0; flex:1;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <h3 class="sms-thread-title truncate" style="margin:0; font-size:0.98rem; font-weight:700; color:var(--text-main);" id="sms-thread-title" title="${escapeHtml(displayName)}">
                            ${escapeHtml(displayName)}
                        </h3>
                        <button class="btn btn-xs sms-desktop-inline" id="btn-edit-contact-name" title="Modifier le nom ou entreprise" style="background:none; border:none; padding:2px; color:var(--text-muted); cursor:pointer;">
                            <span class="material-icons" style="font-size:15px;">edit</span>
                        </button>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; margin-top:2px; font-size:0.75rem; color:var(--text-muted); flex-wrap:nowrap;">
                        <span class="truncate">${formattedPhone || channelBadge.label}</span>
                        ${conv.phoneNumber ? `
                        <button class="btn btn-xs sms-desktop-inline" onclick="navigator.clipboard.writeText('${conv.phoneNumber}'); window.showToast('Numéro copié !', 'success');" title="Copier le numéro" style="background:none; border:none; padding:0; color:var(--text-muted); cursor:pointer;">
                            <span class="material-icons" style="font-size:13px;">content_copy</span>
                        </button>` : ''}
                        ${conv.companyName ? `<span class="truncate sms-desktop-inline" style="max-width:140px;">• <span class="text-gold">${escapeHtml(conv.companyName)}</span></span>` : ''}
                        ${conv.leadId ? `<span class="sms-desktop-inline">•</span> <a href="#leads?id=${conv.leadId}" class="text-xs text-gold sms-desktop-inline" style="text-decoration:none;">Fiche Lead ↗</a>` : ''}
                        <span id="sms-lead-website-slot" style="display:inline-flex; align-items:center;">
                            ${(() => {
                                const web = leadInfo.website;
                                if (!web) return '';
                                const dom = getCleanWebsiteDomain(web);
                                const href = web.startsWith('http') ? web : 'https://' + web;
                                return `<span class="sms-desktop-inline">•</span> <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="text-xs text-gold" style="text-decoration:none; display:inline-flex; align-items:center; gap:3px; font-weight:600;" title="Ouvrir le site web : ${escapeHtml(href)}"><span class="material-icons" style="font-size:13px;">language</span><span class="truncate" style="max-width:180px;">${escapeHtml(dom || 'Site Web')} ↗</span></a>`;
                            })()}
                        </span>
                    </div>

                    <!-- Badges: Canal, Statut de Lead & Problème à résoudre -->
                    <div class="sms-thread-meta-row" id="sms-thread-meta-row">
                        <!-- Canal Badge -->
                        <span class="sms-header-pill" style="padding:2px 8px; font-size:10px; background:${channelBadge.bg}; border-color:${channelBadge.border}; color:${channelBadge.color}; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
                            <span class="material-icons" style="font-size:12px;">${channelBadge.icon}</span>
                            <span>${channelBadge.label}</span>
                        </span>

                        <!-- Statut de Lead -->
                        <button type="button" id="sms-lead-status-pill" class="sms-header-pill" onclick="window.openQuickStatusChangeModal('${conv.id}')" title="Statut actuel : ${leadInfo.status.label}. Cliquer pour changer le statut." style="background:${leadInfo.status.bg}; border-color:${leadInfo.status.border}; color:${leadInfo.status.color};">
                            <span class="material-icons" style="font-size:12px;">${leadInfo.status.icon}</span>
                            <span class="sms-pill-text-desktop">Statut : <strong>${leadInfo.status.label}</strong></span>
                            <span class="sms-pill-text-mobile">${leadInfo.status.shortLabel}</span>
                            <span class="material-icons" style="font-size:11px; opacity:0.7;">arrow_drop_down</span>
                        </button>

                        <!-- Problème à résoudre -->
                        <div id="sms-lead-problem-pill" class="sms-header-pill" onclick="window.showLeadProblemDetailModal('${conv.id}')" title="Problème à résoudre : ${escapeHtml(leadInfo.problem.detail)}. Cliquer pour voir le diagnostic." style="background:${leadInfo.problem.bg}; border-color:${leadInfo.problem.border}; color:${leadInfo.problem.color};">
                            <span class="material-icons" style="font-size:12px;">${leadInfo.problem.icon}</span>
                            <span class="sms-pill-text-desktop">Problème : <strong>${escapeHtml(leadInfo.problem.label)}</strong></span>
                            <span class="sms-pill-text-mobile">${escapeHtml(leadInfo.problem.shortLabel)}</span>
                            <span class="material-icons" style="font-size:11px; opacity:0.7;">info_outline</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Header Right Controls: Desktop inline AI pill + 3-dots Menu Button -->
            <div class="sms-thread-controls" style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                
                <!-- Desktop Autonomous AI Toggle Switch (hidden on mobile) -->
                <div class="sms-ai-pill-compact sms-desktop-control" style="display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.3); border:1px solid var(--border); padding:5px 10px; border-radius:20px;">
                    <span id="ai-toggle-label" style="font-size:0.75rem; font-weight:600; color:${isAiOn ? '#21BA45' : '#F2C037'}; display:flex; align-items:center; gap:4px;">
                        <span class="material-icons" style="font-size:16px;">${isAiOn ? 'smart_toy' : 'person'}</span>
                        <span>${isAiOn ? 'Mode IA' : 'Manuel'}</span>
                    </span>
                    <label class="ai-toggle-switch" title="Activer ou désactiver les réponses automatiques de l'IA">
                        <input type="checkbox" id="sms-ai-toggle" ${isAiOn ? 'checked' : ''}>
                        <span class="ai-slider"></span>
                    </label>
                </div>

                <!-- Desktop Open Config Button (hidden on mobile) -->
                <button class="btn btn-secondary btn-sm sms-desktop-control" onclick="if(window.openSmsConfigModal) window.openSmsConfigModal();" title="Ouvrir le System Prompt & Documentation IA" style="padding:6px 8px;">
                    <span class="material-icons" style="font-size:16px; color:var(--gold);">settings</span>
                </button>

                <!-- 3-Dots Menu Button (Always available, prime entry on mobile) -->
                <div class="sms-thread-menu-wrap" style="position:relative;">
                    <button id="btn-sms-thread-menu" class="sms-3dots-btn" onclick="window.toggleSmsThreadMenu(event)" title="Options de la conversation">
                        <span class="material-icons">more_vert</span>
                    </button>

                    <!-- 3-Dots Dropdown Menu -->
                    <div id="sms-thread-menu-dropdown" class="sms-dropdown-menu" style="display:none;">
                        
                        <!-- AI Mode Interactive Row -->
                        <div class="sms-menu-item-ai" style="padding:10px 14px; background:rgba(255,255,255,0.02); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; gap:12px;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="width:30px; height:30px; border-radius:50%; background:${isAiOn ? 'rgba(33,186,69,0.15)' : 'rgba(242,192,55,0.15)'}; display:flex; align-items:center; justify-content:center;">
                                    <span id="sms-menu-ai-icon" class="material-icons" style="font-size:18px; color:${isAiOn ? '#21BA45' : '#F2C037'};">${isAiOn ? 'smart_toy' : 'person'}</span>
                                </div>
                                <div style="text-align:left;">
                                    <div style="font-weight:700; font-size:0.84rem; color:var(--text-main);">Mode IA Automatique</div>
                                    <div id="sms-menu-ai-status" style="font-size:0.72rem; color:${isAiOn ? '#21BA45' : '#F2C037'}; font-weight:600;">
                                        ${isAiOn ? 'Activé (Réponses directes)' : 'En pause (Manuel)'}
                                    </div>
                                </div>
                            </div>
                            <label class="ai-toggle-switch" style="transform:scale(0.85); transform-origin:right center;">
                                <input type="checkbox" id="sms-ai-toggle-menu" ${isAiOn ? 'checked' : ''}>
                                <span class="ai-slider"></span>
                            </label>
                        </div>

                        <!-- Lead Status & Problem Shortcuts in 3-dots Menu -->
                        <div style="padding:4px 0; border-bottom:1px solid var(--border);">
                            <button class="sms-menu-btn" onclick="window.openQuickStatusChangeModal('${conv.id}'); window.closeSmsThreadMenu();">
                                <span class="material-icons" style="font-size:18px; color:${leadInfo.status.color};">${leadInfo.status.icon}</span>
                                <div style="text-align:left;">
                                    <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase;">Statut du Lead</div>
                                    <strong style="color:var(--text-main); font-size:0.82rem;">${leadInfo.status.label}</strong>
                                </div>
                            </button>
                            <button class="sms-menu-btn" onclick="window.showLeadProblemDetailModal('${conv.id}'); window.closeSmsThreadMenu();">
                                <span class="material-icons" style="font-size:18px; color:${leadInfo.problem.color};">${leadInfo.problem.icon}</span>
                                <div style="text-align:left;">
                                    <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase;">Problème à résoudre</div>
                                    <strong style="color:var(--text-main); font-size:0.82rem;">${escapeHtml(leadInfo.problem.shortLabel)}</strong>
                                </div>
                            </button>
                        </div>

                        <!-- Menu Options List -->
                        <div style="padding:6px 0;">
                            
                            <!-- Prompt & Réglages IA -->
                            <button class="sms-menu-btn" onclick="if(window.openSmsConfigModal) window.openSmsConfigModal(); window.closeSmsThreadMenu();">
                                <span class="material-icons" style="font-size:18px; color:var(--gold);">tune</span>
                                <span>Prompt & Documentation IA</span>
                            </button>

                            <!-- Modifier le Contact -->
                            <button class="sms-menu-btn" id="btn-menu-edit-contact">
                                <span class="material-icons" style="font-size:18px; color:var(--gold);">edit</span>
                                <span>Modifier le contact</span>
                            </button>

                            <!-- Copier le Numéro -->
                            <button class="sms-menu-btn" onclick="navigator.clipboard.writeText('${conv.phoneNumber}'); window.showToast('Numéro copié !', 'success'); window.closeSmsThreadMenu();">
                                <span class="material-icons" style="font-size:18px; color:var(--text-muted);">content_copy</span>
                                <span>Copier le numéro (${formattedPhone})</span>
                            </button>

                            <!-- Fiche Lead CRM if leadId exists -->
                            ${conv.leadId ? `
                            <a href="#leads?id=${conv.leadId}" class="sms-menu-btn" style="text-decoration:none;" onclick="window.closeSmsThreadMenu();">
                                <span class="material-icons" style="font-size:18px; color:var(--gold);">person_search</span>
                                <span>Voir la Fiche Lead CRM ↗</span>
                            </a>
                            ` : ''}

                            <!-- Site Web direct link if exists -->
                            <div id="sms-menu-website-slot">
                                ${leadInfo.website ? `
                                <a href="${escapeHtml(leadInfo.website.startsWith('http') ? leadInfo.website : 'https://' + leadInfo.website)}" target="_blank" rel="noopener noreferrer" class="sms-menu-btn" style="text-decoration:none;" onclick="window.closeSmsThreadMenu();">
                                    <span class="material-icons" style="font-size:18px; color:var(--gold);">language</span>
                                    <span>Visiter le site (${escapeHtml(getCleanWebsiteDomain(leadInfo.website))}) ↗</span>
                                </a>
                                ` : ''}
                            </div>

                            <div class="sms-menu-divider"></div>

                            <!-- Séquences & Simulation -->
                            <button class="sms-menu-btn" onclick="if(window.openSequencesConfigModal) window.openSequencesConfigModal(); window.closeSmsThreadMenu();">
                                <span class="material-icons" style="font-size:18px; color:var(--info);">repeat</span>
                                <span>Séquences SMS & Simulation</span>
                            </button>
                        </div>

                    </div>
                </div>

            </div>
        </div>

        ${(() => {
            if (conv.stalledState === 'WAITING_REPLY') {
                return `<div style="padding:7px 20px; background:rgba(251,146,60,0.08); border-bottom:1px solid rgba(251,146,60,0.22); color:#FB923C; font-size:0.78rem; display:flex; align-items:center; gap:8px;"><span class="material-icons" style="font-size:16px;">hourglass_top</span> <span>Prospect silencieux suite à sa réponse. Relance douce (Soft Bump) programmée à 48h.</span></div>`;
            } else if (conv.stalledState === 'BUMP_SENT') {
                return `<div style="padding:7px 20px; background:rgba(234,179,8,0.08); border-bottom:1px solid rgba(234,179,8,0.22); color:#FACC15; font-size:0.78rem; display:flex; align-items:center; gap:8px;"><span class="material-icons" style="font-size:16px;">mark_chat_read</span> <span>Relance douce J+2 envoyée. Break-up SMS poli prévu à J+5 si aucune réponse.</span></div>`;
            } else if (conv.stalledState === 'BREAKUP_SENT') {
                return `<div style="padding:7px 20px; background:rgba(168,85,247,0.08); border-bottom:1px solid rgba(168,85,247,0.22); color:#C084FC; font-size:0.78rem; display:flex; align-items:center; gap:8px;"><span class="material-icons" style="font-size:16px;">door_front</span> <span>Break-up SMS envoyé. Clôture polie active, lead basculé en Cold Nurture J+60.</span></div>`;
            } else if (conv.stalledState && conv.stalledState.startsWith('COLD_NURTURE')) {
                return `<div style="padding:7px 20px; background:rgba(16,185,129,0.08); border-bottom:1px solid rgba(16,185,129,0.22); color:#34D399; font-size:0.78rem; display:flex; align-items:center; gap:8px;"><span class="material-icons" style="font-size:16px;">eco</span> <span>Lead en Cold Nurture semestriel (Touchpoints J+60 et 6 mois, puis archivage conforme LCAP/CASL).</span></div>`;
            } else if (conv.stalledState === 'ARCHIVED_INACTIVE') {
                return `<div style="padding:7px 20px; background:rgba(100,116,139,0.08); border-bottom:1px solid rgba(100,116,139,0.22); color:#94A3B8; font-size:0.78rem; display:flex; align-items:center; gap:8px;"><span class="material-icons" style="font-size:16px;">archive</span> <span>Lead archivé automatiquement après 6 mois sans contact, en conformité avec la loi canadienne LCAP/CASL.</span></div>`;
            }
            return '';
        })()}

        <!-- Chat History Scrollable Area -->
        <div id="sms-chat-messages" style="flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:10px; -webkit-overflow-scrolling:touch;">
            <!-- Bubbles injected by renderActiveThreadMessages -->
        </div>

        <!-- Composer Area -->
        <div class="sms-composer-area" style="padding:12px 18px; border-top:1px solid var(--border); background:rgba(11,13,16,0.7); display:flex; flex-direction:column; gap:8px;">
            
            <!-- Helper Tool: AI Suggestion Draft Button -->
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <button class="btn btn-xs" id="btn-suggest-reply" style="background:rgba(223,165,58,0.12); border:1px solid rgba(223,165,58,0.35); color:var(--gold); border-radius:8px; padding:4px 10px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-weight:600; font-size:0.78rem; transition:all 0.2s ease;">
                    <span class="material-icons" style="font-size:14px;">auto_awesome</span>
                    <span id="btn-suggest-text">Suggérer IA</span>
                </button>

                <!-- SMS / Omnichannel Counter & Channel Label -->
                <div id="sms-char-counter" class="text-xs text-muted">
                    ${(conv.channel || 'sms') === 'sms' ? '0 / 160 car. (1 SMS)' : `<span style="color:${channelBadge.color}; font-weight:600;"><span class="material-icons" style="font-size:11px; vertical-align:middle;">${channelBadge.icon}</span> Canal : ${channelBadge.label}</span>`}
                </div>
            </div>

            <!-- Input and Send Action -->
            <div style="display:flex; gap:8px; align-items:flex-end;">
                <textarea id="sms-reply-input" class="form-input" rows="2" placeholder="${placeholderText}" style="flex:1; resize:none; font-size:16px; line-height:1.35; border-radius:8px; padding:8px 12px;"></textarea>
                
                <button class="btn btn-primary" id="btn-send-reply" style="height:44px; padding:0 16px; display:flex; align-items:center; gap:6px; border-radius:8px; font-weight:700; flex-shrink:0;">
                    <span class="material-icons" style="font-size:18px;">send</span>
                    <span>${sendBtnText}</span>
                </button>
            </div>
        </div>
    `;

    // Hook Toggle Switch (Desktop)
    const aiToggle = document.getElementById('sms-ai-toggle');
    const aiLabel = document.getElementById('ai-toggle-label');
    if (aiToggle) {
        aiToggle.onchange = async () => {
            const newState = aiToggle.checked;
            if (aiLabel) {
                aiLabel.innerHTML = `
                    <span class="material-icons" style="font-size:16px;">${newState ? 'smart_toy' : 'person'}</span>
                    ${newState ? 'Mode IA' : 'Manuel'}
                `;
                aiLabel.style.color = newState ? '#21BA45' : '#F2C037';
            }
            syncMenuAiToggle(newState);
            await handleToggleAi(conv.id, newState);
        };
    }

    // Hook Toggle Switch (3-Dots Menu)
    const menuAiToggle = document.getElementById('sms-ai-toggle-menu');
    if (menuAiToggle) {
        menuAiToggle.onchange = async () => {
            const newState = menuAiToggle.checked;
            if (aiToggle) {
                aiToggle.checked = newState;
                if (aiLabel) {
                    aiLabel.innerHTML = `
                        <span class="material-icons" style="font-size:16px;">${newState ? 'smart_toy' : 'person'}</span>
                        ${newState ? 'Mode IA' : 'Manuel'}
                    `;
                    aiLabel.style.color = newState ? '#21BA45' : '#F2C037';
                }
            }
            syncMenuAiToggle(newState);
            await handleToggleAi(conv.id, newState);
        };
    }

    function syncMenuAiToggle(isOn) {
        const statusEl = document.getElementById('sms-menu-ai-status');
        const iconEl = document.getElementById('sms-menu-ai-icon');
        if (statusEl) {
            statusEl.innerText = isOn ? 'Activé (Réponses directes)' : 'En pause (Manuel)';
            statusEl.style.color = isOn ? '#21BA45' : '#F2C037';
        }
        if (iconEl) {
            iconEl.innerText = isOn ? 'smart_toy' : 'person';
            iconEl.style.color = isOn ? '#21BA45' : '#F2C037';
            if (iconEl.parentElement) {
                iconEl.parentElement.style.background = isOn ? 'rgba(33,186,69,0.15)' : 'rgba(242,192,55,0.15)';
            }
        }
    }

    // Hook 3-dots Menu Edit Contact
    const btnMenuEdit = document.getElementById('btn-menu-edit-contact');
    if (btnMenuEdit) {
        btnMenuEdit.onclick = () => {
            window.closeSmsThreadMenu();
            openEditContactModal(conv);
        };
    }

    // Hook Suggest Reply Button
    const btnSuggest = document.getElementById('btn-suggest-reply');
    if (btnSuggest) {
        btnSuggest.onclick = () => handleSuggestReply(conv.id);
    }

    // Hook Textarea Counter
    const replyInput = document.getElementById('sms-reply-input');
    const counterEl = document.getElementById('sms-char-counter');
    if (replyInput && counterEl) {
        replyInput.oninput = () => {
            const len = replyInput.value.length;
            const segments = Math.max(1, Math.ceil(len / 160));
            counterEl.innerHTML = `${len} / 160 car. <span style="color:${segments > 1 ? 'var(--gold)' : 'inherit'}; font-weight:${segments > 1 ? 'bold' : 'normal'};">(${segments} SMS)</span>`;
        };

        // Enter key (without shift) to send
        replyInput.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendReply(conv.id);
            }
        };
    }

    // Hook Send Button
    const btnSend = document.getElementById('btn-send-reply');
    if (btnSend) {
        btnSend.onclick = () => handleSendReply(conv.id);
    }

    // Hook Edit Contact Name
    const btnEditName = document.getElementById('btn-edit-contact-name');
    if (btnEditName) {
        btnEditName.onclick = () => openEditContactModal(conv);
    }
}

// Window functions for 3-dots menus
window.toggleSmsThreadMenu = function(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('sms-thread-menu-dropdown');
    if (!dropdown) return;
    const isShown = dropdown.style.display === 'block';
    dropdown.style.display = isShown ? 'none' : 'block';
};

window.closeSmsThreadMenu = function() {
    const dropdown = document.getElementById('sms-thread-menu-dropdown');
    if (dropdown) dropdown.style.display = 'none';
};

window.toggleSmsModuleMenu = function(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('sms-module-menu-dropdown');
    if (!dropdown) return;
    const isShown = dropdown.style.display === 'block';
    dropdown.style.display = isShown ? 'none' : 'block';
};

window.closeSmsModuleMenu = function() {
    const dropdown = document.getElementById('sms-module-menu-dropdown');
    if (dropdown) dropdown.style.display = 'none';
};

if (!window._smsClickOutsideAttached) {
    window._smsClickOutsideAttached = true;
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#sms-thread-menu-dropdown') && !e.target.closest('#btn-sms-thread-menu')) {
            window.closeSmsThreadMenu();
        }
        if (!e.target.closest('#sms-module-menu-dropdown') && !e.target.closest('#btn-sms-module-menu')) {
            window.closeSmsModuleMenu();
        }
    });
}

/**
 * Render the list of chat bubbles in the active conversation
 */
function renderActiveThreadMessages(conv) {
    const messagesEl = document.getElementById('sms-chat-messages');
    if (!messagesEl) return;

    const msgs = (conv.messages || []).filter(m => m.role !== 'system');

    if (msgs.length === 0) {
        messagesEl.innerHTML = `
            <div style="text-align:center; padding:3rem; color:var(--text-muted); margin:auto;">
                <span class="material-icons" style="font-size:36px; opacity:0.3;">chat_bubble_outline</span>
                <div style="font-size:0.95rem; margin-top:8px; font-weight:600;">Aucun message échangé</div>
                <div class="text-xs text-muted" style="margin-top:4px;">Envoyez un message pour démarrer la discussion sur ce canal.</div>
            </div>
        `;
        return;
    }

    messagesEl.innerHTML = msgs.map(m => {
        const isAssistant = m.role === 'assistant';
        const msgChannel = m.channel || conv.channel || 'sms';
        const msgChannelBadge = getChannelBadge(msgChannel);
        let bubbleClass = 'sms-bubble-in';
        let badgeHtml = '';
        let senderTag = 'Prospect / Client';

        if (isAssistant) {
            if (m.author === 'human' || m.author === 'agent') {
                bubbleClass = 'sms-bubble-agent';
                senderTag = `👤 Agent (${m.senderName || 'Humain'}) • ${msgChannelBadge.label}`;
                badgeHtml = `<span style="font-size:10px; color:#31CCEC; font-weight:600; display:inline-flex; align-items:center; gap:4px; margin-bottom:4px;"><span class="material-icons" style="font-size:12px;">person</span> ${senderTag}</span>`;
            } else if (m.author === 'sequence') {
                bubbleClass = 'sms-bubble-ai';
                senderTag = `⚡ Séquence ${msgChannelBadge.label}${m.sequenceStep ? ` (Étape ${m.sequenceStep})` : ''}`;
                badgeHtml = `<span style="font-size:10px; color:var(--gold); font-weight:600; display:inline-flex; align-items:center; gap:4px; margin-bottom:4px;"><span class="material-icons" style="font-size:12px;">auto_awesome</span> ${senderTag}</span>`;
            } else if (m.author === 'ai_soft_bump' || m.author === 'ai_breakup') {
                bubbleClass = 'sms-bubble-ai';
                senderTag = m.author === 'ai_breakup' ? `🚪 Break-up ${msgChannelBadge.label}` : `⚡ Relance J+2 ${msgChannelBadge.label}`;
                badgeHtml = `<span style="font-size:10px; color:#FACC15; font-weight:600; display:inline-flex; align-items:center; gap:4px; margin-bottom:4px;"><span class="material-icons" style="font-size:12px;">schedule_send</span> ${senderTag}</span>`;
            } else if (m.author === 'ai_followup') {
                bubbleClass = 'sms-bubble-ai';
                senderTag = `🌱 Nurturing Follow-up (${msgChannelBadge.label})`;
                badgeHtml = `<span style="font-size:10px; color:#34D399; font-weight:600; display:inline-flex; align-items:center; gap:4px; margin-bottom:4px;"><span class="material-icons" style="font-size:12px;">eco</span> ${senderTag}</span>`;
            } else {
                bubbleClass = 'sms-bubble-ai';
                senderTag = `✨ IA Quasar (${msgChannelBadge.label})`;
                badgeHtml = `<span style="font-size:10px; color:var(--gold); font-weight:600; display:inline-flex; align-items:center; gap:4px; margin-bottom:4px;"><span class="material-icons" style="font-size:12px;">auto_awesome</span> ${senderTag}</span>`;
            }
        } else {
            bubbleClass = 'sms-bubble-in';
            badgeHtml = `<span style="font-size:10px; color:${msgChannelBadge.color}; font-weight:600; display:inline-flex; align-items:center; gap:4px; margin-bottom:4px;"><span class="material-icons" style="font-size:12px;">${msgChannelBadge.icon}</span> ${conv.clientName || 'Prospect'} (${msgChannelBadge.label})</span>`;
        }

        const timeStr = formatTime(m.timestamp);

        return `
            <div class="${bubbleClass}">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
                    ${badgeHtml}
                    <span style="font-size:10px; color:rgba(255,255,255,0.45);">${timeStr}</span>
                </div>
                <div style="font-size:0.9rem; line-height:1.45; word-break:break-word; white-space:pre-wrap; margin-top:2px;">${escapeHtml(m.content)}</div>
            </div>
        `;
    }).join('');

    // Auto-scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

/**
 * Empty State for Right Pane
 */
function renderEmptyThreadPane() {
    const threadPane = document.getElementById('sms-thread-pane');
    if (!threadPane) return;

    threadPane.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:3rem; color:var(--text-muted);">
            <div style="width:70px; height:70px; border-radius:50%; background:rgba(223,165,58,0.1); border:1px solid rgba(223,165,58,0.3); display:flex; align-items:center; justify-content:center; color:var(--gold); margin-bottom:1.5rem;">
                <span class="material-icons" style="font-size:36px;">forum</span>
            </div>
            <h3 style="font-size:1.25rem; font-weight:700; color:var(--text-main); margin:0 0 8px 0;">Sélectionnez une conversation</h3>
            <p style="font-size:0.88rem; max-width:460px; line-height:1.5; margin:0 0 1.5rem 0;">
                Gérez en direct vos échanges WhatsApp, Instagram, Messenger et SMS. L'IA autonome qualifie et répond 24/7 avec possibilité de prise de contrôle manuelle en un clic.
            </p>
            <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
                <button class="btn btn-primary" onclick="window.openNewSmsModal()" style="display:inline-flex; align-items:center; gap:8px;">
                    <span class="material-icons" style="font-size:18px;">add_comment</span>
                    <span>Nouveau Message</span>
                </button>
                <button class="btn btn-secondary" onclick="window.openOmnichannelSimulatorModal()" style="display:inline-flex; align-items:center; gap:8px; border-color:rgba(37,211,102,0.4); color:#25D366;">
                    <span class="material-icons" style="font-size:18px; color:#25D366;">science</span>
                    <span>🧪 Tester Simulateur</span>
                </button>
            </div>
        </div>
    `;
}

/**
 * Action: Toggle AI Autonomous Mode
 */
async function handleToggleAi(conversationId, aiEnabled) {
    try {
        // Direct Firestore update for instantaneous reactivity
        await updateDoc(doc(db, 'conversations', conversationId), {
            aiEnabled: Boolean(aiEnabled),
            updatedAt: new Date().toISOString()
        });

        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await smsApiFetch(`/api/sms/conversations/${conversationId}/toggle-ai`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ aiEnabled })
        });
        const data = await resp.json();
        if (data.success) {
            window.showToast(
                aiEnabled
                    ? "🤖 Mode IA Automatique réactivé pour ce fil."
                    : "👤 Reprise humaine : l'IA est maintenant en pause sur ce fil.",
                "success"
            );
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        console.error("Toggle AI Error:", e);
        window.showToast(`Erreur : ${e.message}`, "error");
    }
}

/**
 * Action: Suggest AI Reply Draft
 */
async function handleSuggestReply(conversationId) {
    const btn = document.getElementById('btn-suggest-reply');
    const label = document.getElementById('btn-suggest-text');
    const input = document.getElementById('sms-reply-input');
    const counterEl = document.getElementById('sms-char-counter');

    if (!btn || !label) return;

    const originalText = label.textContent;
    label.textContent = "Génération IA en cours...";
    btn.style.opacity = '0.7';
    btn.disabled = true;

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await smsApiFetch(`/api/sms/conversations/${conversationId}/suggest-reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({})
        });
        const data = await resp.json();
        if (data.success && data.suggestion) {
            if (input) {
                input.value = data.suggestion;
                input.focus();
                if (counterEl) {
                    const len = data.suggestion.length;
                    const segments = Math.max(1, Math.ceil(len / 160));
                    counterEl.innerHTML = `${len} / 160 car. <span style="color:${segments > 1 ? 'var(--gold)' : 'inherit'};">(${segments} SMS)</span>`;
                }
            }
            window.showToast("✨ Suggestion IA prête ! Vous pouvez l'ajuster ou l'envoyer.", "success");
        } else {
            throw new Error(data.error || "Aucune suggestion retournée");
        }
    } catch (e) {
        console.error("Suggest Reply Error:", e);
        window.showToast(`Erreur suggestion IA : ${e.message}`, "error");
    } finally {
        label.textContent = originalText;
        btn.style.opacity = '1';
        btn.disabled = false;
    }
}

/**
 * Action: Send Manual Reply via Twilio
 */
async function handleSendReply(conversationId) {
    const input = document.getElementById('sms-reply-input');
    const btnSend = document.getElementById('btn-send-reply');
    if (!input || !btnSend) return;

    const message = input.value.trim();
    if (!message) {
        return window.showToast("Veuillez saisir un message avant d'envoyer.", "warning");
    }

    btnSend.disabled = true;
    btnSend.innerHTML = `<span class="material-icons rotating" style="font-size:18px;">refresh</span> <span>Envoi...</span>`;

    // Optimistic UI update: render message immediately in thread
    const conv = conversationsCache.find(c => c.id === conversationId);
    if (conv) {
        if (!conv.messages) conv.messages = [];
        conv.messages.push({
            role: 'assistant',
            author: 'human',
            senderName: 'Vous',
            content: message,
            timestamp: new Date().toISOString()
        });
        renderActiveThreadMessages(conv);
    }
    input.value = '';

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await smsApiFetch(`/api/sms/conversations/${conversationId}/reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ message })
        });
        const data = await resp.json();
        if (data.success) {
            const counterEl = document.getElementById('sms-char-counter');
            if (counterEl && (conv?.channel || 'sms') === 'sms') {
                counterEl.textContent = '0 / 160 car. (1 SMS)';
            }
            const badge = getChannelBadge(data.channel || conv?.channel);
            window.showToast(`Message transmis avec succès via ${badge.label} !`, "success");
        } else {
            throw new Error(data.error || "Échec de l'envoi du message");
        }
    } catch (e) {
        console.error("SMS Send Error:", e);
        window.showToast(`Erreur d'envoi : ${e.message}`, "error");
    } finally {
        btnSend.disabled = false;
        btnSend.innerHTML = `<span class="material-icons" style="font-size:18px;">send</span> <span>Envoyer</span>`;
    }
}

/**
 * Modal: "+ Nouveau SMS"
 */
export function openNewSmsModal(prefill = {}) {
    const modalId = 'modal-new-sms';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    // Prepare quick pick options from leads
    let quickPickOptions = `<option value="">-- Choisir un lead / client existant (facultatif) --</option>`;
    activeLeadCache.forEach(lead => {
        quickPickOptions += `<option value="${escapeHtml(lead.phone)}" data-name="${escapeHtml(lead.name)}" data-company="${escapeHtml(lead.company)}" data-id="${lead.id}">
            ${escapeHtml(lead.name || 'Inconnu')} (${escapeHtml(lead.company || 'Sans entreprise')}) - ${formatPhone(lead.phone)}
        </option>`;
    });

    const modalHtml = `
    <div id="${modalId}" class="crm-modal-overlay" style="z-index:9000; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.75); position:fixed; top:0; left:0; width:100vw; height:100vh; backdrop-filter:blur(6px); padding:10px; box-sizing:border-box;">
        <div class="crm-modal-content" style="width:96vw; max-width:540px; max-height:92vh; background:var(--bg-card); border:1px solid var(--border); border-radius:14px; overflow-y:auto; box-shadow:0 20px 50px rgba(0,0,0,0.8); display:flex; flex-direction:column;">
            
            <!-- Header -->
            <div style="background:rgba(223,165,58,0.08); border-bottom:1px solid var(--border); padding:14px 18px; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="material-icons text-gold" style="font-size:22px;">chat</span>
                    <h3 style="margin:0; font-size:1.1rem; font-weight:700; color:var(--text-main);">Démarrer un nouveau message</h3>
                </div>
                <button class="btn btn-xs" onclick="document.getElementById('${modalId}').remove()" style="background:none; border:none; color:var(--text-muted); cursor:pointer;">
                    <span class="material-icons">close</span>
                </button>
            </div>

            <!-- Body -->
            <div style="padding:16px 18px; display:flex; flex-direction:column; gap:12px;">
                
                <!-- Channel Selector -->
                <div class="form-group">
                    <label class="form-label text-xs uppercase text-gold font-bold">Canal de départ :</label>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        <button type="button" class="btn btn-sm new-msg-channel-btn active" data-channel="sms" style="display:flex; align-items:center; justify-content:center; gap:6px; padding:8px; border-radius:8px; background:rgba(223,165,58,0.15); border:1px solid var(--gold); color:var(--gold); font-weight:700;">
                            <span class="material-icons" style="font-size:18px;">sms</span>
                            <span>SMS (Twilio/Telnyx)</span>
                        </button>
                        <button type="button" class="btn btn-sm new-msg-channel-btn" data-channel="whatsapp" style="display:flex; align-items:center; justify-content:center; gap:6px; padding:8px; border-radius:8px; background:rgba(255,255,255,0.04); border:1px solid var(--border); color:var(--text-muted); font-weight:600;">
                            <span class="material-icons" style="font-size:18px; color:#25D366;">chat</span>
                            <span>WhatsApp Cloud</span>
                        </button>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label text-xs uppercase text-gold font-bold">Sélection rapide depuis le CRM :</label>
                    <select id="new-sms-quick-pick" class="form-input" style="font-size:16px;">
                        ${quickPickOptions}
                    </select>
                </div>

                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px;">
                    <div class="form-group">
                        <label class="form-label text-xs uppercase text-gold font-bold" id="new-msg-phone-label">Numéro de téléphone * :</label>
                        <input type="tel" id="new-sms-phone" class="form-input" placeholder="+1 (819) 000-0000" style="font-size:16px;" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label text-xs uppercase text-gold font-bold">Nom du contact :</label>
                        <input type="text" id="new-sms-name" class="form-input" placeholder="Ex: Jean Tremblay" style="font-size:16px;">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label text-xs uppercase text-gold font-bold">Entreprise :</label>
                    <input type="text" id="new-sms-company" class="form-input" placeholder="Ex: Entreprises Tremblay Inc." style="font-size:16px;">
                </div>

                <div class="form-group">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <label class="form-label text-xs uppercase text-gold font-bold" style="margin:0;">Message * :</label>
                        <button class="btn btn-xs" id="btn-modal-ai-draft" style="background:rgba(223,165,58,0.15); border:1px solid var(--gold); color:var(--gold); border-radius:6px; padding:3px 8px; font-size:11px; display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
                            <span class="material-icons" style="font-size:13px;">auto_awesome</span>
                            <span>Générer avec l'IA</span>
                        </button>
                    </div>
                    <textarea id="new-sms-body" class="form-input" rows="4" placeholder="Bonjour, je vous contacte de la part de Solutions Quasar Inc..." style="resize:vertical; font-size:16px; line-height:1.4;"></textarea>
                    <div id="new-sms-counter" class="text-xs text-muted" style="text-align:right; margin-top:4px;">
                        0 / 160 car. (1 SMS)
                    </div>
                </div>

                <div class="text-xs text-muted" id="new-msg-channel-note" style="background:rgba(255,255,255,0.03); padding:10px 12px; border-radius:8px; border:1px solid var(--border);">
                    ℹ️ Expéditeur officiel : <strong>+1 (819) 300-2831</strong> (Solutions Quasar Inc.). Le message sera immédiatement indexé dans l'historique de conversation.
                </div>
            </div>

            <!-- Footer -->
            <div style="background:var(--bg-dark); padding:12px 18px; border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:10px;">
                <button class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">Annuler</button>
                <button class="btn btn-primary" id="btn-submit-new-sms" style="display:flex; align-items:center; gap:6px;">
                    <span class="material-icons" style="font-size:16px;">send</span>
                    <span id="btn-submit-new-label">Envoyer le message</span>
                </button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Inputs references
    const quickPick = document.getElementById('new-sms-quick-pick');
    const phoneInput = document.getElementById('new-sms-phone');
    const nameInput = document.getElementById('new-sms-name');
    const compInput = document.getElementById('new-sms-company');
    const bodyInput = document.getElementById('new-sms-body');
    const counterEl = document.getElementById('new-sms-counter');

    // Apply prefill if provided
    if (prefill.phone && phoneInput) phoneInput.value = prefill.phone;
    if (prefill.name && nameInput) nameInput.value = prefill.name;
    if (prefill.company && compInput) compInput.value = prefill.company;
    if (prefill.body && bodyInput) {
        bodyInput.value = prefill.body;
        const len = bodyInput.value.length;
        const segs = Math.max(1, Math.ceil(len / 160));
        if (counterEl) counterEl.innerHTML = `${len} / 160 car. <span style="color:${segs > 1 ? 'var(--gold)' : 'inherit'}; font-weight:${segs > 1 ? 'bold' : 'normal'};">(${segs} SMS)</span>`;
    }

    if (quickPick) {
        quickPick.onchange = () => {
            const opt = quickPick.options[quickPick.selectedIndex];
            if (opt && opt.value) {
                phoneInput.value = opt.value;
                nameInput.value = opt.dataset.name || '';
                compInput.value = opt.dataset.company || '';
            }
        };
    }

    if (bodyInput && counterEl) {
        bodyInput.oninput = () => {
            const len = bodyInput.value.length;
            const segs = Math.max(1, Math.ceil(len / 160));
            counterEl.innerHTML = `${len} / 160 car. <span style="color:${segs > 1 ? 'var(--gold)' : 'inherit'}; font-weight:${segs > 1 ? 'bold' : 'normal'};">(${segs} SMS)</span>`;
        };
    }

    // Channel Selector buttons
    let selectedChannel = 'sms';
    const channelButtons = document.querySelectorAll('.new-msg-channel-btn');
    const channelNote = document.getElementById('new-msg-channel-note');
    const phoneLabel = document.getElementById('new-msg-phone-label');
    const submitLabel = document.getElementById('btn-submit-new-label');

    channelButtons.forEach(btn => {
        btn.onclick = () => {
            selectedChannel = btn.dataset.channel;
            channelButtons.forEach(b => {
                b.classList.remove('active');
                b.style.background = 'rgba(255,255,255,0.04)';
                b.style.borderColor = 'var(--border)';
                b.style.color = 'var(--text-muted)';
            });
            btn.classList.add('active');
            if (selectedChannel === 'whatsapp') {
                btn.style.background = 'rgba(37,211,102,0.15)';
                btn.style.borderColor = '#25D366';
                btn.style.color = '#25D366';
                if (phoneLabel) phoneLabel.textContent = "Numéro WhatsApp * :";
                if (channelNote) channelNote.innerHTML = "ℹ️ Canal d'envoi : <strong>WhatsApp Cloud API</strong>. Le message sera transmis directement sur WhatsApp et synchronisé dans l'inbox.";
                if (submitLabel) submitLabel.textContent = "Envoyer sur WhatsApp";
            } else {
                btn.style.background = 'rgba(223,165,58,0.15)';
                btn.style.borderColor = 'var(--gold)';
                btn.style.color = 'var(--gold)';
                if (phoneLabel) phoneLabel.textContent = "Numéro de téléphone * :";
                if (channelNote) channelNote.innerHTML = "ℹ️ Expéditeur officiel : <strong>+1 (819) 300-2831</strong> (Solutions Quasar Inc.). Le message sera immédiatement indexé dans l'historique de conversation.";
                if (submitLabel) submitLabel.textContent = "Envoyer le SMS";
            }
        };
    });

    // Modal AI Draft Button
    const btnDraft = document.getElementById('btn-modal-ai-draft');
    if (btnDraft) {
        btnDraft.onclick = async () => {
            const name = nameInput.value.trim();
            const company = compInput.value.trim();
            btnDraft.disabled = true;
            btnDraft.innerHTML = `<span class="material-icons rotating" style="font-size:12px;">refresh</span> Génération...`;

            try {
                const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
                const resp = await smsApiFetch(`/api/sms/generate-outreach`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ name, company, language: 'fr', angle: 'audit' })
                });
                const data = await resp.json();
                if (data.success && data.text) {
                    bodyInput.value = data.text;
                    const len = data.text.length;
                    const segs = Math.max(1, Math.ceil(len / 160));
                    counterEl.innerHTML = `${len} / 160 car. <span>(${segs} SMS)</span>`;
                    window.showToast("✨ Accroche IA générée avec succès !", "success");
                } else throw new Error(data.error);
            } catch (e) {
                window.showToast(`Erreur IA : ${e.message}`, "error");
            } finally {
                btnDraft.disabled = false;
                btnDraft.innerHTML = `<span class="material-icons" style="font-size:12px;">auto_awesome</span> Générer avec l'IA`;
            }
        };
    }

    // Submit handler
    const btnSubmit = document.getElementById('btn-submit-new-sms');
    if (btnSubmit) {
        btnSubmit.onclick = async () => {
            const to = phoneInput.value.trim();
            const message = bodyInput.value.trim();
            const clientName = nameInput.value.trim();
            const companyName = compInput.value.trim();

            if (!to) return window.showToast("Numéro de téléphone requis", "warning");
            if (!message) return window.showToast("Message requis", "warning");

            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<span class="material-icons rotating" style="font-size:16px;">refresh</span> Envoi en cours...`;

            try {
                const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
                const resp = await smsApiFetch(`/api/sms/conversations/start`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        to, 
                        message, 
                        clientName, 
                        companyName,
                        leadId: prefill.leadId || null,
                        channel: selectedChannel
                    })
                });
                const data = await resp.json();
                if (data.success) {
                    window.showToast(`Message transmis avec succès via ${selectedChannel.toUpperCase()} !`, "success");
                    document.getElementById(modalId).remove();
                    if (data.sessionId) {
                        selectConversation(data.sessionId);
                    }
                } else {
                    throw new Error(data.error || "Impossible d'envoyer le message");
                }
            } catch (e) {
                console.error("New Message Send Error:", e);
                window.showToast(`Erreur : ${e.message}`, "error");
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = `<span class="material-icons" style="font-size:16px;">send</span> Envoyer le message`;
            }
        };
    }
}

window.openNewSmsModal = openNewSmsModal;

/**
 * Modal: "🧪 Simuler un message entrant" (WhatsApp, Instagram, Messenger, SMS)
 */
export function openOmnichannelSimulatorModal() {
    const modalId = 'modal-sim-message';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const modalHtml = `
    <div id="${modalId}" class="crm-modal-overlay" style="z-index:9000; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.75); position:fixed; top:0; left:0; width:100vw; height:100vh; backdrop-filter:blur(6px); padding:10px; box-sizing:border-box;">
        <div class="crm-modal-content" style="width:96vw; max-width:580px; max-height:92vh; background:var(--bg-card); border:1px solid var(--border); border-radius:14px; overflow-y:auto; box-shadow:0 20px 50px rgba(0,0,0,0.8); display:flex; flex-direction:column;">
            
            <!-- Header -->
            <div style="background:rgba(37,211,102,0.08); border-bottom:1px solid var(--border); padding:14px 18px; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="material-icons" style="font-size:22px; color:#25D366;">science</span>
                    <h3 style="margin:0; font-size:1.1rem; font-weight:700; color:var(--text-main);">Simulateur Omnicanal (Inbound)</h3>
                </div>
                <button class="btn btn-xs" onclick="document.getElementById('${modalId}').remove()" style="background:none; border:none; color:var(--text-muted); cursor:pointer;">
                    <span class="material-icons">close</span>
                </button>
            </div>

            <!-- Body -->
            <div style="padding:16px 18px; display:flex; flex-direction:column; gap:12px;">
                <p style="margin:0; font-size:0.85rem; color:var(--text-muted); line-height:1.4;">
                    Ce simulateur permet de tester l'arrivée en direct d'un message depuis WhatsApp, Instagram, Facebook Messenger ou SMS sans configurer de tunnel webhook externe.
                </p>

                <!-- Canal Selector -->
                <div class="form-group">
                    <label class="form-label text-xs uppercase text-gold font-bold">Canal de réception :</label>
                    <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px;">
                        <button type="button" class="btn btn-sm sim-channel-btn active" data-channel="whatsapp" style="display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 4px; border-radius:8px; background:rgba(37,211,102,0.15); border:1px solid #25D366; color:#25D366; font-weight:700;">
                            <span class="material-icons" style="font-size:18px;">chat</span>
                            <span style="font-size:11px;">WhatsApp</span>
                        </button>
                        <button type="button" class="btn btn-sm sim-channel-btn" data-channel="instagram" style="display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 4px; border-radius:8px; background:rgba(255,255,255,0.04); border:1px solid var(--border); color:var(--text-muted); font-weight:600;">
                            <span class="material-icons" style="font-size:18px;">photo_camera</span>
                            <span style="font-size:11px;">Instagram</span>
                        </button>
                        <button type="button" class="btn btn-sm sim-channel-btn" data-channel="facebook" style="display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 4px; border-radius:8px; background:rgba(255,255,255,0.04); border:1px solid var(--border); color:var(--text-muted); font-weight:600;">
                            <span class="material-icons" style="font-size:18px;">forum</span>
                            <span style="font-size:11px;">Messenger</span>
                        </button>
                        <button type="button" class="btn btn-sm sim-channel-btn" data-channel="sms" style="display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 4px; border-radius:8px; background:rgba(255,255,255,0.04); border:1px solid var(--border); color:var(--text-muted); font-weight:600;">
                            <span class="material-icons" style="font-size:18px;">sms</span>
                            <span style="font-size:11px;">SMS</span>
                        </button>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px;">
                    <div class="form-group">
                        <label class="form-label text-xs uppercase text-gold font-bold" id="sim-sender-label">Numéro WhatsApp / ID :</label>
                        <input type="text" id="sim-from" class="form-input" value="+15147890123" style="font-size:16px;" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label text-xs uppercase text-gold font-bold">Nom du contact :</label>
                        <input type="text" id="sim-name" class="form-input" value="Marc Tremblay" style="font-size:16px;">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label text-xs uppercase text-gold font-bold">Entreprise :</label>
                    <input type="text" id="sim-company" class="form-input" value="Tremblay Électrique Inc." style="font-size:16px;">
                </div>

                <!-- Préréglages rapides -->
                <div class="form-group">
                    <label class="form-label text-xs uppercase text-gold font-bold">Scénarios d'exemples rapides :</label>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button type="button" class="btn btn-xs sim-preset-btn" data-preset="quote" style="background:rgba(255,255,255,0.05); border:1px solid var(--border); color:var(--text-main); border-radius:6px; padding:4px 8px; font-size:11px;">
                            🎯 Soumission Site Web
                        </button>
                        <button type="button" class="btn btn-xs sim-preset-btn" data-preset="ai_agent" style="background:rgba(255,255,255,0.05); border:1px solid var(--border); color:var(--text-main); border-radius:6px; padding:4px 8px; font-size:11px;">
                            🤖 Agent IA 24/7
                        </button>
                        <button type="button" class="btn btn-xs sim-preset-btn" data-preset="meeting" style="background:rgba(255,255,255,0.05); border:1px solid var(--border); color:var(--text-main); border-radius:6px; padding:4px 8px; font-size:11px;">
                            📅 Disponibilité RDV
                        </button>
                        <button type="button" class="btn btn-xs sim-preset-btn" data-preset="optout" style="background:rgba(248,113,113,0.15); border:1px solid rgba(248,113,113,0.3); color:#F87171; border-radius:6px; padding:4px 8px; font-size:11px;">
                            🛑 STOP
                        </button>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label text-xs uppercase text-gold font-bold">Message reçu :</label>
                    <textarea id="sim-text" class="form-input" rows="3" style="resize:vertical; font-size:16px; line-height:1.4;">Bonjour, je voudrais avoir une soumission pour un nouveau site web moderne avec prise de rendez-vous en ligne.</textarea>
                </div>
            </div>

            <!-- Footer -->
            <div style="background:var(--bg-dark); padding:12px 18px; border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:10px;">
                <button class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">Annuler</button>
                <button class="btn btn-primary" id="btn-submit-simulate" style="display:flex; align-items:center; gap:6px; background:#25D366; border-color:#25D366; color:#000; font-weight:700;">
                    <span class="material-icons" style="font-size:16px;">bolt</span>
                    <span>Injecter le Message</span>
                </button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    let selectedSimChannel = 'whatsapp';
    const channelButtons = document.querySelectorAll('.sim-channel-btn');
    const senderLabel = document.getElementById('sim-sender-label');
    const fromInput = document.getElementById('sim-from');
    const nameInput = document.getElementById('sim-name');
    const textInput = document.getElementById('sim-text');

    const channelThemes = {
        whatsapp: { color: '#25D366', bg: 'rgba(37,211,102,0.15)', border: '#25D366', label: 'Numéro WhatsApp (E.164) :', sampleFrom: '+15147890123' },
        instagram: { color: '#E1306C', bg: 'rgba(225,48,108,0.15)', border: '#E1306C', label: 'Handle / Compte Instagram :', sampleFrom: '@marc_tremblay_design' },
        facebook: { color: '#0084FF', bg: 'rgba(0,132,255,0.15)', border: '#0084FF', label: 'Identifiant / Nom Messenger :', sampleFrom: 'fb_user_582914' },
        sms: { color: 'var(--gold)', bg: 'rgba(223,165,58,0.15)', border: 'var(--gold)', label: 'Numéro de Mobile (SMS) :', sampleFrom: '+18195551234' }
    };

    channelButtons.forEach(btn => {
        btn.onclick = () => {
            selectedSimChannel = btn.dataset.channel;
            channelButtons.forEach(b => {
                b.classList.remove('active');
                b.style.background = 'rgba(255,255,255,0.04)';
                b.style.borderColor = 'var(--border)';
                b.style.color = 'var(--text-muted)';
            });
            const theme = channelThemes[selectedSimChannel] || channelThemes.sms;
            btn.classList.add('active');
            btn.style.background = theme.bg;
            btn.style.borderColor = theme.border;
            btn.style.color = theme.color;
            if (senderLabel) senderLabel.textContent = theme.label;
            if (fromInput) fromInput.value = theme.sampleFrom;
        };
    });

    // Preset buttons
    const presetButtons = document.querySelectorAll('.sim-preset-btn');
    presetButtons.forEach(btn => {
        btn.onclick = () => {
            const preset = btn.dataset.preset;
            if (preset === 'quote') {
                textInput.value = "Bonjour, je voudrais avoir une soumission pour un nouveau site web moderne avec prise de rendez-vous en ligne.";
            } else if (preset === 'ai_agent') {
                textInput.value = "Allô, j'ai vu que vous installez des agents IA pour répondre aux clients les soirs et fins de semaine. Pouvez-vous m'en dire plus ?";
            } else if (preset === 'meeting') {
                textInput.value = "Parfait, je serais disponible jeudi à 14h pour une démonstration par Google Meet.";
            } else if (preset === 'optout') {
                textInput.value = "STOP";
            }
        };
    });

    // Submit Simulation
    const btnSubmit = document.getElementById('btn-submit-simulate');
    btnSubmit.onclick = async () => {
        const text = textInput.value.trim();
        const from = fromInput.value.trim();
        const name = nameInput.value.trim();
        const company = document.getElementById('sim-company')?.value.trim();

        if (!text) {
            window.showToast("Veuillez saisir un texte de message.", "warning");
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span class="material-icons rotating" style="font-size:16px;">refresh</span> <span>Simulation en cours...</span>`;

        try {
            const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
            const resp = await smsApiFetch(`/api/conversations/simulate-inbound`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    channel: selectedSimChannel,
                    from,
                    name,
                    company,
                    text
                })
            });

            const data = await resp.json();
            if (data.success) {
                window.showToast(`Message entrant simulé sur ${selectedSimChannel.toUpperCase()} !`, "success");
                document.getElementById(modalId)?.remove();
                if (data.conversationId) {
                    setTimeout(() => {
                        window.selectSmsConversation(data.conversationId);
                    }, 400);
                }
            } else {
                throw new Error(data.error || "Erreur de simulation");
            }
        } catch (e) {
            console.error("Simulation Error:", e);
            window.showToast(`Erreur : ${e.message}`, "error");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<span class="material-icons" style="font-size:16px;">bolt</span> <span>Injecter le Message</span>`;
        }
    };
}

window.openOmnichannelSimulatorModal = openOmnichannelSimulatorModal;

/**
 * Modal to update Contact Name and Company of an existing conversation
 */
function openEditContactModal(conv) {
    const modalId = 'modal-edit-sms-contact';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const modalHtml = `
    <div id="${modalId}" class="crm-modal-overlay" style="z-index:9000; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.75); position:fixed; top:0; left:0; width:100vw; height:100vh; backdrop-filter:blur(6px); padding:10px; box-sizing:border-box;">
        <div class="crm-modal-content" style="width:94vw; max-width:440px; background:var(--bg-card); border:1px solid var(--border); border-radius:14px; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.8);">
            <div style="background:rgba(223,165,58,0.08); border-bottom:1px solid var(--border); padding:14px 18px; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:1.1rem; font-weight:700; color:var(--text-main);">Modifier le Contact</h3>
                <button class="btn btn-xs" onclick="document.getElementById('${modalId}').remove()" style="background:none; border:none; color:var(--text-muted); cursor:pointer;">
                    <span class="material-icons">close</span>
                </button>
            </div>
            <div style="padding:16px 18px; display:flex; flex-direction:column; gap:12px;">
                <div class="form-group">
                    <label class="form-label text-xs uppercase text-gold font-bold">Nom complet du contact :</label>
                    <input type="text" id="edit-sms-name" class="form-input" style="font-size:16px;" value="${escapeHtml(conv.clientName || '')}" placeholder="Ex: Patrick Roy">
                </div>
                <div class="form-group">
                    <label class="form-label text-xs uppercase text-gold font-bold">Entreprise :</label>
                    <input type="text" id="edit-sms-company" class="form-input" style="font-size:16px;" value="${escapeHtml(conv.companyName || '')}" placeholder="Ex: Roy Transport">
                </div>
            </div>
            <div style="background:var(--bg-dark); padding:12px 18px; border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:10px;">
                <button class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">Annuler</button>
                <button class="btn btn-primary" id="btn-save-contact-info">Enregistrer</button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-save-contact-info').onclick = async () => {
        const newName = document.getElementById('edit-sms-name').value.trim();
        const newComp = document.getElementById('edit-sms-company').value.trim();

        try {
            await updateDoc(doc(db, 'conversations', conv.id), {
                clientName: newName || null,
                companyName: newComp || null
            });
            window.showToast("Contact mis à jour avec succès !", "success");
            document.getElementById(modalId).remove();
        } catch (e) {
            window.showToast(`Erreur : ${e.message}`, "error");
        }
    };
}



/**
 * Modal: Quick Status Change (100% App-Native)
 */
window.openQuickStatusChangeModal = function(conversationId) {
    const conv = conversationsCache.find(c => c.id === conversationId);
    if (!conv) return;

    const modalId = 'modal-quick-status-change';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const currentInfo = resolveLeadInfo(conv);
    const curCode = currentInfo.status.code;

    const statuses = [
        { code: 'NEW', label: 'Nouveau', desc: 'Prospect entrant non encore qualifié', icon: 'fiber_new', color: 'var(--gold)', bg: 'rgba(223, 165, 58, 0.15)', border: 'rgba(223, 165, 58, 0.35)' },
        { code: 'AUDITED', label: 'Audité IA', desc: 'Diagnostic technologique et audit réalisés', icon: 'auto_awesome', color: '#C084FC', bg: 'rgba(192, 132, 252, 0.15)', border: 'rgba(192, 132, 252, 0.35)' },
        { code: 'APPROVED', label: 'Approuvé', desc: 'Prêt pour le déclenchement de séquences SMS/appels', icon: 'check_circle', color: '#4ADE80', bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.35)' },
        { code: 'CONTACTED', label: 'Contacté', desc: 'Premier message envoyé ou séquence initiée', icon: 'outgoing_mail', color: '#60A5FA', bg: 'rgba(96, 165, 250, 0.15)', border: 'rgba(96, 165, 250, 0.35)' },
        { code: 'INTERESTED', label: 'Intéressé / Répondu', desc: 'Le prospect a répondu et démontre un intérêt', icon: 'mark_chat_unread', color: '#FB923C', bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.4)' },
        { code: 'QUALIFIED', label: 'Qualifié', desc: 'Besoin confirmé et décideur prêt pour une offre', icon: 'verified', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.2)', border: 'rgba(34, 197, 94, 0.5)' },
        { code: 'MEETING_SCHEDULED', label: 'RDV Fixé', desc: 'Appel de démo ou consultation planifiée', icon: 'event', color: '#C084FC', bg: 'rgba(192, 132, 252, 0.18)', border: 'rgba(192, 132, 252, 0.45)' },
        { code: 'CLIENT', label: 'Client Actif', desc: 'Contrat signé, mandat ou récurrent en cours', icon: 'star', color: '#10B981', bg: 'rgba(16, 185, 129, 0.2)', border: 'rgba(16, 185, 129, 0.5)' },
        { code: 'COLD_NURTURE', label: 'Nurturing (J+60)', desc: 'Pas prêt maintenant, relance dans 60 jours', icon: 'eco', color: '#34D399', bg: 'rgba(52, 211, 153, 0.15)', border: 'rgba(52, 211, 153, 0.35)' },
        { code: 'ARCHIVED', label: 'Archivé / Sans suite', desc: 'Refus explicite ou désabonnement (LCAP/CASL)', icon: 'archive', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.35)' }
    ];

    const optionsHtml = statuses.map(st => {
        const isSelected = curCode === st.code;
        return `
            <div class="sms-status-option-item" onclick="window.applyLeadStatusChange('${conversationId}', '${st.code}')" style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; margin-bottom:6px; background:${isSelected ? 'rgba(223,165,58,0.1)' : 'rgba(255,255,255,0.02)'}; border:1px solid ${isSelected ? 'var(--gold)' : 'rgba(255,255,255,0.06)'}; border-radius:10px; cursor:pointer; transition:all 0.15s ease;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:32px; height:32px; border-radius:50%; background:${st.bg}; border:1px solid ${st.border}; display:flex; align-items:center; justify-content:center; color:${st.color}; flex-shrink:0;">
                        <span class="material-icons" style="font-size:16px;">${st.icon}</span>
                    </div>
                    <div>
                        <div style="font-weight:700; font-size:0.88rem; color:${isSelected ? 'var(--gold)' : 'var(--text-main)'};">${st.label}</div>
                        <div style="font-size:0.72rem; color:var(--text-muted);">${st.desc}</div>
                    </div>
                </div>
                ${isSelected ? '<span class="material-icons text-gold" style="font-size:20px;">check_circle</span>' : '<span class="material-icons text-muted" style="font-size:18px; opacity:0.3;">chevron_right</span>'}
            </div>
        `;
    }).join('');

    const modalHtml = `
    <div id="${modalId}" class="crm-modal-overlay" style="z-index:9999; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.8); position:fixed; top:0; left:0; width:100vw; height:100vh; backdrop-filter:blur(6px); padding:12px; box-sizing:border-box;" onclick="if(event.target.id==='${modalId}') document.getElementById('${modalId}').remove();">
        <div class="crm-modal-content" style="width:96vw; max-width:460px; max-height:90vh; background:var(--bg-card); border:1px solid var(--border); border-radius:14px; overflow:hidden; box-shadow:0 25px 60px rgba(0,0,0,0.85); display:flex; flex-direction:column;">
            
            <div style="background:rgba(223,165,58,0.08); border-bottom:1px solid var(--border); padding:14px 18px; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="material-icons text-gold" style="font-size:22px;">swap_horiz</span>
                    <div>
                        <h3 style="margin:0; font-size:1.05rem; font-weight:700; color:var(--text-main);">Changer le Statut du Lead</h3>
                        <div style="font-size:0.72rem; color:var(--text-muted);">${escapeHtml(conv.clientName || conv.companyName || conv.phoneNumber)}</div>
                    </div>
                </div>
                <button class="btn btn-xs" onclick="document.getElementById('${modalId}').remove()" style="background:none; border:none; color:var(--text-muted); cursor:pointer;">
                    <span class="material-icons">close</span>
                </button>
            </div>

            <div style="padding:14px 16px; overflow-y:auto; flex:1;">
                ${optionsHtml}
            </div>

            <div style="background:var(--bg-dark); padding:10px 16px; border-top:1px solid var(--border); display:flex; justify-content:flex-end;">
                <button class="btn btn-secondary btn-sm" onclick="document.getElementById('${modalId}').remove()">Fermer</button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

/**
 * Action: Apply Lead Status Change to Firestore & Caches
 */
window.applyLeadStatusChange = async function(conversationId, newStatus) {
    const conv = conversationsCache.find(c => c.id === conversationId);
    if (!conv) return;

    const modal = document.getElementById('modal-quick-status-change');
    if (modal) modal.remove();

    try {
        if (!conv._leadData) conv._leadData = {};
        conv._leadData.status = newStatus;
        conv.leadStatus = newStatus;

        await updateDoc(doc(db, 'conversations', conversationId), {
            leadStatus: newStatus,
            updatedAt: new Date().toISOString()
        }).catch(() => {});

        if (conv.leadId) {
            await updateDoc(doc(db, 'leads', conv.leadId), {
                status: newStatus,
                updatedAt: new Date().toISOString()
            }).catch(() => {});

            if (typeof window.syncLeadInAllCaches === 'function') {
                window.syncLeadInAllCaches(conv.leadId, { status: newStatus });
            }
        }

        if (activeConversationId === conversationId) {
            fetchAndRefreshLeadForConversation(conv);
        }
        renderConversationsList();

        const stBadge = formatLeadStatusBadge(newStatus);
        window.showToast(`Statut mis à jour : ${stBadge.label}`, "success");
    } catch (e) {
        console.error("Status update error:", e);
        window.showToast(`Erreur mise à jour : ${e.message}`, "error");
    }
};

/**
 * Modal: Problem to Solve Diagnostic (100% App-Native)
 */
window.showLeadProblemDetailModal = function(conversationId) {
    const conv = conversationsCache.find(c => c.id === conversationId);
    if (!conv) return;

    const modalId = 'modal-lead-problem-detail';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const info = resolveLeadInfo(conv);
    const displayName = conv.clientName || conv.companyName || formatPhone(conv.phoneNumber);

    const getStrategyText = (category) => {
        switch (category) {
            case 'modern_no_ai':
                return "Mettre en avant la capture des messages du soir et de la fin de semaine. Proposer une démonstration de l'agent IA qui répond instantanément et synchronise le calendrier de réservation 24/7.";
            case 'no_website':
                return "Proposer la création clé en main d'un portail web moderne et rapide en 48h pour attirer des clients locaux et maximiser la crédibilité.";
            case 'outdated_website':
                return "Insister sur la perte de clients causée par la lenteur mobile et le design vieillot. Démontrer un exemple de refonte instantanée avec PageSpeed 95+.";
            case 'directory_only':
                return "Souligner l'importance d'éviter les commissions des plateformes tierces et de posséder son propre domaine avec prise de rendez-vous directe.";
            case 'missing_gmb_website':
                return "Proposer de relier en 24h le site officiel à la fiche Google Maps pour convertir le trafic local en appels et réservations.";
            default:
                return "Proposer un rapide audit de 10-15 minutes pour identifier les opportunités digitales prioritaires et automatiser la qualification de leads.";
        }
    };

    const modalHtml = `
    <div id="${modalId}" class="crm-modal-overlay" style="z-index:9999; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.8); position:fixed; top:0; left:0; width:100vw; height:100vh; backdrop-filter:blur(6px); padding:12px; box-sizing:border-box;" onclick="if(event.target.id==='${modalId}') document.getElementById('${modalId}').remove();">
        <div class="crm-modal-content" style="width:96vw; max-width:480px; max-height:90vh; background:var(--bg-card); border:1px solid var(--border); border-radius:14px; overflow:hidden; box-shadow:0 25px 60px rgba(0,0,0,0.85); display:flex; flex-direction:column;">
            
            <div style="background:rgba(223,165,58,0.08); border-bottom:1px solid var(--border); padding:14px 18px; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:34px; height:34px; border-radius:50%; background:${info.problem.bg}; border:1px solid ${info.problem.border}; display:flex; align-items:center; justify-content:center; color:${info.problem.color}; flex-shrink:0;">
                        <span class="material-icons" style="font-size:18px;">${info.problem.icon}</span>
                    </div>
                    <div>
                        <h3 style="margin:0; font-size:1.05rem; font-weight:700; color:var(--text-main);">Diagnostic Prospect & Problème</h3>
                        <div style="font-size:0.72rem; color:var(--text-muted);">${escapeHtml(displayName)}</div>
                    </div>
                </div>
                <button class="btn btn-xs" onclick="document.getElementById('${modalId}').remove()" style="background:none; border:none; color:var(--text-muted); cursor:pointer;">
                    <span class="material-icons">close</span>
                </button>
            </div>

            <div style="padding:16px 18px; display:flex; flex-direction:column; gap:12px; overflow-y:auto; flex:1;">
                
                <!-- Main Problem Callout -->
                <div style="background:${info.problem.bg}; border:1px solid ${info.problem.border}; border-radius:10px; padding:12px 14px;">
                    <div style="font-size:0.7rem; text-transform:uppercase; font-weight:700; letter-spacing:0.5px; color:${info.problem.color};">
                        Type de Problème à Résoudre :
                    </div>
                    <div style="font-size:1rem; font-weight:700; color:var(--text-main); margin-top:3px; display:flex; align-items:center; gap:6px;">
                        <span>${escapeHtml(info.problem.label)}</span>
                    </div>
                    <div style="font-size:0.8rem; color:#CBD5E1; margin-top:6px; line-height:1.45;">
                        ${escapeHtml(info.problem.detail)}
                    </div>
                </div>

                <!-- Strategic Pitch Advice -->
                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:10px; padding:12px 14px;">
                    <div style="font-size:0.7rem; text-transform:uppercase; font-weight:700; letter-spacing:0.5px; color:var(--gold); display:flex; align-items:center; gap:5px;">
                        <span class="material-icons" style="font-size:14px;">tips_and_updates</span>
                        <span>Angle d'accroche recommandé :</span>
                    </div>
                    <div style="font-size:0.8rem; color:var(--text-main); margin-top:6px; line-height:1.45;">
                        ${getStrategyText(info.problem.category)}
                    </div>
                </div>

                <!-- Current Lead Status Indicator -->
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.25); padding:10px 14px; border-radius:10px; border:1px solid var(--border);">
                    <div style="font-size:0.78rem; color:var(--text-muted);">Statut du Lead actuel :</div>
                    <button type="button" class="btn btn-xs" onclick="window.openQuickStatusChangeModal('${conv.id}'); document.getElementById('${modalId}').remove();" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; font-size:0.8rem; background:${info.status.bg}; border:1px solid ${info.status.border}; color:${info.status.color}; border-radius:6px; padding:3px 8px; cursor:pointer;">
                        <span class="material-icons" style="font-size:14px;">${info.status.icon}</span>
                        <span>${info.status.label}</span>
                        <span class="material-icons" style="font-size:12px;">edit</span>
                    </button>
                </div>

            </div>

            <div style="background:var(--bg-dark); padding:12px 18px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; gap:10px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    ${info.leadId ? `
                        <a href="#leads?id=${info.leadId}" class="btn btn-outline-gold btn-sm" style="display:inline-flex; align-items:center; gap:5px; text-decoration:none; font-size:0.78rem;" onclick="document.getElementById('${modalId}').remove();">
                            <span class="material-icons" style="font-size:15px;">person_search</span>
                            <span>Fiche Lead ↗</span>
                        </a>
                    ` : ''}
                    ${info.website ? `
                        <a href="${escapeHtml(info.website.startsWith('http') ? info.website : 'https://' + info.website)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:5px; text-decoration:none; font-size:0.78rem;">
                            <span class="material-icons" style="font-size:15px; color:var(--gold);">language</span>
                            <span>Site Web ↗</span>
                        </a>
                    ` : ''}
                </div>
                <button class="btn btn-secondary btn-sm" onclick="document.getElementById('${modalId}').remove()">Fermer</button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
};
