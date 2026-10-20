// Premium Quasar ERP - Real-Time Prospection Alert Service
// 100% Visual Real-Time Alerts for Key Prospection Milestones
import { onSnapshot, collection, query, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let isServiceInitialized = false;
let sessionStartTime = Date.now() - 5000; // 5-second buffer for clock skew

// Hub element
function getOrCreateAlertHub() {
    let hub = document.getElementById('prospection-notifications-hub');
    if (!hub) {
        hub = document.createElement('div');
        hub.id = 'prospection-notifications-hub';
        document.body.appendChild(hub);
    }
    return hub;
}

/**
 * Display a premium, native visual alert card
 * @param {Object} options
 * @param {'meeting'|'reply'|'sequence'|'approval'} options.type
 * @param {string} options.title
 * @param {string} options.leadName
 * @param {string} options.details
 * @param {string} options.actionText
 * @param {Function} options.onAction
 * @param {boolean} options.pinned - If true, remains until explicitly closed or action clicked
 */
export function displayProspectionAlert({
    alertId = null,
    type = 'meeting',
    title = 'Alerte Prospection',
    leadName = '',
    details = '',
    actionText = 'Voir',
    onAction = null,
    pinned = false
}) {
    const hub = getOrCreateAlertHub();

    // Deduplication check: if card with same alertId is already in hub, update its details in-place
    if (alertId) {
        const existingCard = hub.querySelector(`[data-alert-id="${alertId}"]`);
        if (existingCard) {
            const detailsEl = existingCard.querySelector('.prospection-alert-details');
            if (detailsEl) {
                detailsEl.textContent = details;
            }
            return existingCard;
        }
    }

    const card = document.createElement('div');
    if (alertId) card.setAttribute('data-alert-id', alertId);
    card.className = `prospection-alert-card alert-type-${type} ${pinned ? 'pinned' : ''}`;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });

    let typeBadgeLabel = 'Prospection';
    let iconName = 'auto_awesome';

    if (type === 'meeting') {
        typeBadgeLabel = '📅 RDV FIXÉ';
        iconName = 'event_available';
    } else if (type === 'reply') {
        typeBadgeLabel = '💬 RÉPONSE SMS';
        iconName = 'sms';
    } else if (type === 'sequence') {
        typeBadgeLabel = '🚀 SÉQUENCE SMS';
        iconName = 'send';
    } else if (type === 'approval') {
        typeBadgeLabel = '🎯 QUALIFIÉ';
        iconName = 'verified';
    }

    const safeLeadName = escapeAlertHtml(leadName);
    const safeDetails = escapeAlertHtml(details);

    card.innerHTML = `
        <div class="prospection-alert-header">
            <div class="prospection-alert-title-wrap">
                <span class="prospection-live-pulse-dot" style="background:${type === 'meeting' ? '#C084FC' : (type === 'reply' ? '#4ADE80' : '#38BDF8')};"></span>
                <span class="prospection-alert-badge">${typeBadgeLabel}</span>
                <span class="prospection-alert-time">${timeStr}</span>
            </div>
            <button class="prospection-alert-close-btn" title="Fermer cette alerte">✕</button>
        </div>

        ${safeLeadName ? `
            <div class="prospection-alert-lead-name">
                <span class="material-icons" style="font-size:16px; opacity:0.85;">${iconName}</span>
                <span>${safeLeadName}</span>
            </div>
        ` : ''}

        ${safeDetails ? `
            <div class="prospection-alert-details">
                ${safeDetails}
            </div>
        ` : ''}

        <div class="prospection-alert-actions">
            ${onAction ? `
                <button class="prospection-alert-action-btn" id="btn-action-${Date.now()}">
                    <span>${actionText}</span>
                    <span class="material-icons" style="font-size:13px;">arrow_forward</span>
                </button>
            ` : ''}
        </div>

        ${!pinned ? `<div class="prospection-alert-progress"></div>` : ''}
    `;

    // Close animation & handler
    const closeAlert = () => {
        if (card.classList.contains('closing')) return;
        card.classList.add('closing');
        setTimeout(() => card.remove(), 260);
    };

    const closeBtn = card.querySelector('.prospection-alert-close-btn');
    if (closeBtn) closeBtn.onclick = closeAlert;

    const actionBtn = card.querySelector('.prospection-alert-action-btn');
    if (actionBtn && onAction) {
        actionBtn.onclick = () => {
            try {
                onAction();
            } finally {
                closeAlert();
            }
        };
    }

    hub.appendChild(card);

    // Auto-dismiss ONLY for non-critical alerts (User explicit preference: "laisse les notif importantes affichées")
    if (!pinned) {
        setTimeout(closeAlert, 6000);
    }
}

function escapeAlertHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Initializes real-time listeners across Firestore collections for prospection events
 */
export function initProspectionAlertService(db) {
    if (isServiceInitialized) return;
    isServiceInitialized = true;
    sessionStartTime = Date.now();

    console.log("[ProspectionAlertService] 100% Visual Real-Time Engine starting at", new Date(sessionStartTime).toISOString());

    // 1. Listen for Confirmed Appointments (CRITICAL: PINNED)
    initAppointmentsListener(db);

    // 2. Listen for Inbound Prospect SMS Replies (CRITICAL: PINNED)
    initConversationsListener(db);

    // 3. Listen for Started Sequences (INFORMATIONAL: AUTO-DISMISS)
    initSequenceInstancesListener(db);

    // 4. Listen for Approved Leads (INFORMATIONAL: BATCHED & AUTO-DISMISS)
    initLeadApprovalsListener(db);
}

// --- 1. APPOINTMENTS (RDV FIXÉ) ---
function initAppointmentsListener(db) {
    const knownApptIds = new Set();
    const alertedApptIds = new Set();
    let isInitialSnapshot = true;

    try {
        const q = query(collection(db, "appointments"));
        onSnapshot(q, (snapshot) => {
            if (isInitialSnapshot) {
                snapshot.forEach(docSnap => {
                    knownApptIds.add(docSnap.id);
                    alertedApptIds.add(docSnap.id);
                });
                isInitialSnapshot = false;
                return;
            }

            snapshot.docChanges().forEach((change) => {
                const data = change.doc.data() || {};
                const id = change.doc.id;

                if (data.status !== 'confirmed') return;

                // Verify timestamp is reasonably recent (within current session)
                const apptCreated = data.created_at ? new Date(data.created_at).getTime() : Date.now();
                if (apptCreated < sessionStartTime - 30000) return;

                const alertId = `appt_${id}`;
                const apptTime = data.appointmentTime ? new Date(data.appointmentTime) : null;
                const formattedTime = apptTime ? apptTime.toLocaleString('fr-CA', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'Date à confirmer';

                const detailsText = `📅 Créneau fixé le ${formattedTime} ${data.businessLocation ? `(${data.businessLocation})` : ''}\nMeet : ${data.meetLink || 'Lien généré'}`;

                // If already alerted and existing card is present, update its text (e.g. meet link upgraded)
                const hub = getOrCreateAlertHub();
                const existingCard = hub.querySelector(`[data-alert-id="${alertId}"]`);
                if (existingCard) {
                    const detailsEl = existingCard.querySelector('.prospection-alert-details');
                    if (detailsEl) detailsEl.textContent = detailsText;
                    return;
                }

                // If already alerted in this session, do not spawn a duplicate card
                if (alertedApptIds.has(id)) {
                    return;
                }

                alertedApptIds.add(id);
                knownApptIds.add(id);

                displayProspectionAlert({
                    alertId,
                    type: 'meeting',
                    pinned: true, // IMPORTANT: Stays displayed until clicked/dismissed
                    title: 'Rendez-vous Confirmé',
                    leadName: data.prospectName || 'Nouveau Prospect',
                    details: detailsText,
                    actionText: 'Voir Calendrier',
                    onAction: () => {
                        window.location.hash = '#calendar';
                    }
                });
            });
        }, (err) => {
            console.warn("[ProspectionAlertService] Appointments listener notice:", err.message);
        });
    } catch (e) {
        console.warn("[ProspectionAlertService] Setup appointments listener error:", e);
    }
}

// --- 2. CONVERSATIONS (RÉPONSES PROSPECT SMS) ---
function initConversationsListener(db) {
    const lastSeenMessageTimestamps = new Map();
    let isInitialSnapshot = true;

    try {
        const q = query(collection(db, "conversations"));
        onSnapshot(q, (snapshot) => {
            if (isInitialSnapshot) {
                snapshot.forEach(docSnap => {
                    const data = docSnap.data() || {};
                    const messages = data.messages || [];
                    if (messages.length > 0) {
                        const lastMsg = messages[messages.length - 1];
                        lastSeenMessageTimestamps.set(docSnap.id, lastMsg.timestamp || lastMsg.created_at || '0');
                    }
                });
                isInitialSnapshot = false;
                return;
            }

            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added' || change.type === 'modified') {
                    const data = change.doc.data() || {};
                    const convId = change.doc.id;
                    const messages = data.messages || [];
                    if (messages.length === 0) return;

                    const lastMsg = messages[messages.length - 1];
                    const msgTime = lastMsg.timestamp || lastMsg.created_at;
                    const msgTimestampMs = msgTime ? new Date(msgTime).getTime() : Date.now();
                    const previousTimestamp = lastSeenMessageTimestamps.get(convId);

                    // Check if this is a newly arrived user/prospect message
                    if (lastMsg.role === 'user' && msgTimestampMs > sessionStartTime && msgTime !== previousTimestamp) {
                        lastSeenMessageTimestamps.set(convId, msgTime);

                        const senderName = data.clientName || data.companyName || (data.phone || convId.replace('sms_', '+'));
                        const snippet = lastMsg.content && lastMsg.content.length > 120
                            ? lastMsg.content.substring(0, 120) + '...'
                            : (lastMsg.content || 'Nouveau message reçu');

                        displayProspectionAlert({
                            alertId: `reply_${convId}_${msgTime}`,
                            type: 'reply',
                            pinned: true, // IMPORTANT: Stays displayed until clicked/dismissed
                            title: 'Réponse SMS Reçue',
                            leadName: senderName,
                            details: `« ${snippet} »`,
                            actionText: 'Répondre',
                            onAction: () => {
                                const phone = data.phone || data.phoneNumber || (convId.replace('sms_', '+'));
                                window.location.hash = `#sms?phone=${encodeURIComponent(phone)}`;
                            }
                        });
                    }
                }
            });
        }, (err) => {
            console.warn("[ProspectionAlertService] Conversations listener notice:", err.message);
        });
    } catch (e) {
        console.warn("[ProspectionAlertService] Setup conversations listener error:", e);
    }
}

// --- 3. SEQUENCE INSTANCES (SÉQUENCES SMS DÉBUTÉES) ---
function initSequenceInstancesListener(db) {
    const knownInstanceIds = new Set();
    let isInitialSnapshot = true;

    try {
        const q = query(collection(db, "sequence_instances"));
        onSnapshot(q, (snapshot) => {
            if (isInitialSnapshot) {
                snapshot.forEach(docSnap => knownInstanceIds.add(docSnap.id));
                isInitialSnapshot = false;
                return;
            }

            snapshot.docChanges().forEach((change) => {
                const data = change.doc.data() || {};
                const id = change.doc.id;

                if (change.type === 'added' && !knownInstanceIds.has(id)) {
                    knownInstanceIds.add(id);
                    const createdAt = data.createdAt ? new Date(data.createdAt).getTime() : Date.now();

                    if (createdAt >= sessionStartTime - 10000 && data.status === 'ACTIVE') {
                        const targetName = data.leadName || data.companyName || 'Prospect';
                        const seqName = data.sequenceName || 'Séquence IA';

                        displayProspectionAlert({
                            type: 'sequence',
                            pinned: false, // Auto-dismiss after 6s
                            title: 'Séquence SMS Démarrée',
                            leadName: targetName,
                            details: `Étape 1 envoyée via Twilio • Séquence « ${seqName} »`,
                            actionText: 'Voir Lead',
                            onAction: () => {
                                if (data.leadId) {
                                    window.location.hash = `#leads?id=${data.leadId}`;
                                } else {
                                    window.location.hash = '#leads';
                                }
                            }
                        });
                    }
                }
            });
        }, (err) => {
            console.warn("[ProspectionAlertService] Sequence instances listener notice:", err.message);
        });
    } catch (e) {
        console.warn("[ProspectionAlertService] Setup sequences listener error:", e);
    }
}

// --- 4. LEADS APPROVALS (BATCHED NOTIFICATION) ---
let pendingApprovedLeads = [];
let approvalDebounceTimer = null;

function initLeadApprovalsListener(db) {
    const knownApprovedLeadIds = new Set();
    let isInitialSnapshot = true;

    try {
        const q = query(collection(db, "leads"));
        onSnapshot(q, (snapshot) => {
            if (isInitialSnapshot) {
                snapshot.forEach(docSnap => {
                    const data = docSnap.data() || {};
                    if ((data.status || '').toUpperCase() === 'APPROVED') {
                        knownApprovedLeadIds.add(docSnap.id);
                    }
                });
                isInitialSnapshot = false;
                return;
            }

            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added' || change.type === 'modified') {
                    const data = change.doc.data() || {};
                    const id = change.doc.id;
                    const status = (data.status || '').toUpperCase();

                    if (status === 'APPROVED' && !knownApprovedLeadIds.has(id)) {
                        knownApprovedLeadIds.add(id);
                        pendingApprovedLeads.push({
                            id,
                            name: data.business_name || data.name || 'Prospect'
                        });

                        // Debounce batch notifications
                        if (approvalDebounceTimer) clearTimeout(approvalDebounceTimer);
                        approvalDebounceTimer = setTimeout(() => {
                            if (pendingApprovedLeads.length === 0) return;

                            if (pendingApprovedLeads.length === 1) {
                                const lead = pendingApprovedLeads[0];
                                displayProspectionAlert({
                                    type: 'approval',
                                    pinned: false, // Auto-dismiss after 6s
                                    title: 'Prospect Approuvé',
                                    leadName: lead.name,
                                    details: `Audit IA validé. Prêt pour l'engagement par SMS/Courriel.`,
                                    actionText: 'Ouvrir Pipeline',
                                    onAction: () => {
                                        window.location.hash = '#leads';
                                    }
                                });
                            } else {
                                const count = pendingApprovedLeads.length;
                                displayProspectionAlert({
                                    type: 'approval',
                                    pinned: false, // Auto-dismiss after 6s
                                    title: `${count} Prospects Approuvés`,
                                    leadName: `Campagne de prospection`,
                                    details: `${count} entreprises qualifiées et ajoutées dans la file d'attente d'envoi.`,
                                    actionText: 'Voir les Approuvés',
                                    onAction: () => {
                                        window.location.hash = '#leads';
                                    }
                                });
                            }
                            pendingApprovedLeads = [];
                        }, 1200);
                    }
                }
            });
        }, (err) => {
            console.warn("[ProspectionAlertService] Leads approvals listener notice:", err.message);
        });
    } catch (e) {
        console.warn("[ProspectionAlertService] Setup approvals listener error:", e);
    }
}
