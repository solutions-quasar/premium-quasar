/**
 * Solutions Quasar Inc. - Stalled Conversation Recovery & Long-Term Nurturing Engine
 * 
 * Handles the critical B2B scenario:
 * 1. Prospect replies to outbound sequence -> sequence deactivates.
 * 2. AI agent (or admin) responds with discovery call proposal.
 * 3. Prospect goes silent / ghosts without booking.
 * 
 * 3-Stage Recovery Lifecycle:
 * - Stage 1 (J+2 / 48h): "Soft Bump" - Natural, low-pressure contextual check-in.
 * - Stage 2 (J+5 / 72h after Bump): "Break-up SMS" - Professional closure, reverse psychology.
 * - Stage 3 (J+60 / 2 months): "Long-Term Nurturing" - Automatically schedules an autonomous follow-up via followupService.
 * 
 * Compliant with CASL / CRTC / FCC legal hours and instant opt-out respect.
 */

const { db } = require('./firebase-admin');
const OpenAI = require('openai');
const twilioService = require('./twilio-service');
const smsSequenceService = require('./sms-sequence-service');
const aiActivityService = require('./ai-activity-service');

class StalledRecoveryService {
    constructor() {
        this.workerInterval = null;
        this.BUMP_DELAY_HOURS = 48; // 48h after initial response
        this.BREAKUP_DELAY_HOURS = 72; // 72h after bump (~5 days total)
        this.NURTURE_DELAY_DAYS = 60; // 60 days long-term nurture
    }

    init() {
        this.startWorker();
        console.log('[StalledRecoveryService] Stalled Conversation Recovery Engine initialized.');
    }

    startWorker() {
        if (this.workerInterval) clearInterval(this.workerInterval);

        // Check every 60 seconds
        this.workerInterval = setInterval(async () => {
            try {
                await this.processStalledConversations();
            } catch (err) {
                console.error('[StalledRecoveryService] Worker error:', err.message);
            }
        }, 60000);
    }

    /**
     * Mark a conversation as actively waiting for the prospect's reply
     */
    async markWaitingReply(phoneNumber) {
        if (!phoneNumber) return;
        const normalized = twilioService.normalizePhone(phoneNumber);
        const sessionId = `sms_${normalized.replace('+', '')}`;

        await db.collection('conversations').doc(sessionId).set({
            stalledState: 'WAITING_REPLY',
            lastAssistantReplyAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }

    /**
     * Mark conversation resolved because prospect replied
     */
    async markConversationReplied(phoneNumber) {
        if (!phoneNumber) return;
        const normalized = twilioService.normalizePhone(phoneNumber);
        const sessionId = `sms_${normalized.replace('+', '')}`;

        const docRef = db.collection('conversations').doc(sessionId);
        const snap = await docRef.get();
        if (!snap.exists) return;

        const data = snap.data();
        const activeStates = ['WAITING_REPLY', 'BUMP_SENT', 'BREAKUP_SENT', 'COLD_NURTURE_SCHEDULED', 'COLD_NURTURE_ROUND_1_SENT', 'COLD_NURTURE_ROUND_2_SENT'];
        if (activeStates.includes(data.stalledState)) {
            const nowIso = new Date().toISOString();
            await docRef.update({
                stalledState: 'RESOLVED_REPLIED',
                stalledResolvedAt: nowIso,
                updatedAt: nowIso
            });

            // Reactivate lead to INTERESTED if it was in COLD_NURTURE
            if (data.leadId) {
                await db.collection('leads').doc(data.leadId).update({
                    status: 'INTERESTED',
                    stalledStatus: 'RESOLVED_REPLIED',
                    lastContactDate: nowIso,
                    updatedAt: nowIso
                }).catch(() => {});
            }

            // Cancel any pending scheduled follow-ups
            try {
                const pendingFollowups = await db.collection('crm_followups')
                    .where('phoneNumber', '==', normalized)
                    .where('status', '==', 'SCHEDULED')
                    .get();

                for (const fDoc of pendingFollowups.docs) {
                    await fDoc.ref.update({
                        status: 'CANCELLED_REPLIED',
                        cancelledAt: nowIso,
                        cancelReason: 'Prospect a répondu au SMS',
                        updatedAt: nowIso
                    }).catch(() => {});
                }
            } catch (_) {}

            console.log(`[StalledRecoveryService] Conversation ${normalized} marked as RESOLVED_REPLIED & pending follow-ups cancelled.`);
        }
    }

    /**
     * Mark conversation resolved because an appointment was booked
     */
    async markConversationBooked(phoneNumber) {
        if (!phoneNumber) return;
        const normalized = twilioService.normalizePhone(phoneNumber);
        const sessionId = `sms_${normalized.replace('+', '')}`;

        const nowIso = new Date().toISOString();
        await db.collection('conversations').doc(sessionId).set({
            stalledState: 'RESOLVED_BOOKED',
            stalledResolvedAt: nowIso,
            updatedAt: nowIso
        }, { merge: true });

        // Cancel any pending scheduled follow-ups
        try {
            const pendingFollowups = await db.collection('crm_followups')
                .where('phoneNumber', '==', normalized)
                .where('status', '==', 'SCHEDULED')
                .get();

            for (const fDoc of pendingFollowups.docs) {
                await fDoc.ref.update({
                    status: 'CANCELLED_BOOKED',
                    cancelledAt: nowIso,
                    cancelReason: 'Rendez-vous réservé avec succès',
                    updatedAt: nowIso
                }).catch(() => {});
            }
        } catch (_) {}

        console.log(`[StalledRecoveryService] Conversation ${normalized} marked as RESOLVED_BOOKED & pending follow-ups cancelled.`);
    }

    /**
     * Generates a context-aware Soft Bump message (under 140 chars)
     */
    generateSoftBumpMessage({ clientName, language = 'fr' }) {
        const isEn = language === 'en';
        const firstName = clientName ? clientName.trim().split(' ')[0] : '';

        if (isEn) {
            return firstName
                ? `Hey ${firstName}, just following up on our chat from the other day. Did you get a chance to check the times for a quick call?`
                : `Hey, just following up on our chat from the other day. Did you get a chance to check the times for a quick call?`;
        }

        return firstName
            ? `Allo ${firstName}, je faisais un rapide suivi suite à notre échange. Avez-vous eu 2 minutes pour jeter un œil aux disponibilités ?`
            : `Allo, je faisais un rapide suivi suite à notre échange. Avez-vous eu 2 minutes pour jeter un œil aux disponibilités ?`;
    }

    /**
     * Generates a polite Break-up message (under 160 chars)
     */
    generateBreakupMessage({ clientName, companyName, language = 'fr' }) {
        const isEn = language === 'en';
        const firstName = clientName ? clientName.trim().split(' ')[0] : '';
        const targetOrg = companyName ? companyName.trim() : (isEn ? 'your projects' : 'vos projets');

        if (isEn) {
            return firstName
                ? `Hi ${firstName}, I assume your priorities shifted or the timing isn't right, no problem at all! I'll close our file for now. Wishing you the best with ${targetOrg}!`
                : `Hi, I assume your priorities shifted or the timing isn't right, no problem at all! I'll close our file for now. Wishing you the best with ${targetOrg}!`;
        }

        return firstName
            ? `Bonjour ${firstName}, je présume que le timing n'est pas idéal ou que vos priorités ont changé, aucun souci ! Je classe le dossier. Bonne continuation avec ${targetOrg} !`
            : `Bonjour, je présume que le timing n'est pas idéal ou que vos priorités ont changé, aucun souci ! Je classe le dossier. Bonne continuation avec ${targetOrg} !`;
    }

    /**
     * Autonomous Worker Loop: scans stalled conversations and handles Bump, Break-up & Long-Term follow-up
     */
    async processStalledConversations() {
        const now = new Date();
        const nowMs = now.getTime();

        // 1. Fetch conversations in active stalled states
        const snap = await db.collection('conversations')
            .where('channel', '==', 'sms')
            .where('aiEnabled', '==', true)
            .limit(60)
            .get();

        if (snap.empty) return { processed: 0 };

        let processedCount = 0;

        for (const doc of snap.docs) {
            const conv = doc.data();
            const messages = conv.messages || [];
            if (messages.length === 0) continue;

            const lastMsg = messages[messages.length - 1];
            // Safety: We only act if the LAST message was from the assistant (waiting for prospect)
            if (lastMsg.role !== 'assistant') continue;

            const stalledState = conv.stalledState || 'WAITING_REPLY';
            // Skip already finalized states
            if (['RESOLVED_REPLIED', 'RESOLVED_BOOKED', 'COLD_NURTURE_SCHEDULED', 'CANCELLED_OPTOUT'].includes(stalledState)) {
                continue;
            }

            const phone = conv.phoneNumber || doc.id.replace('sms_', '+');
            const normalizedPhone = twilioService.normalizePhone(phone);
            const timezone = conv.businessTimezone || 'America/Moncton';

            // Check opt-out status on lead
            let leadData = null;
            let leadRef = null;
            if (conv.leadId) {
                const leadSnap = await db.collection('leads').doc(conv.leadId).get();
                if (leadSnap.exists) {
                    leadRef = leadSnap.ref;
                    leadData = leadSnap.data();
                }
            }

            if (leadData?.smsOptOut === true || leadData?.status === 'UNSUBSCRIBED' || leadData?.status === 'MEETING_SCHEDULED') {
                await doc.ref.update({
                    stalledState: leadData?.smsOptOut ? 'CANCELLED_OPTOUT' : 'RESOLVED_BOOKED',
                    updatedAt: new Date().toISOString()
                });
                continue;
            }

            const lang = conv.language || (leadData && !smsSequenceService.isLeadFrancophone(leadData) ? 'en' : 'fr');
            const lastAssistantTime = conv.lastAssistantReplyAt 
                ? new Date(conv.lastAssistantReplyAt).getTime()
                : (lastMsg.timestamp ? new Date(lastMsg.timestamp).getTime() : 0);

            if (!lastAssistantTime) continue;

            const hoursSinceLastAssistant = (nowMs - lastAssistantTime) / (1000 * 3600);

            // Respect recipient legal window before dispatching any recovery SMS
            if (!smsSequenceService.isWithinLegalWindow(now, timezone)) {
                continue; // Wait until legal hours tomorrow morning
            }

            // --- STAGE 1: SOFT BUMP (48h) ---
            if (stalledState === 'WAITING_REPLY') {
                if (hoursSinceLastAssistant >= this.BUMP_DELAY_HOURS) {
                    const bumpText = this.generateSoftBumpMessage({
                        clientName: conv.clientName || leadData?.name,
                        language: lang
                    });

                    console.log(`[StalledRecoveryService] 🚀 Sending Stage 1 Soft Bump to ${normalizedPhone}: "${bumpText}"`);
                    const sendRes = await twilioService.sendSms(normalizedPhone, bumpText);

                    if (sendRes.success) {
                        const nowIso = new Date().toISOString();
                        messages.push({
                            role: 'assistant',
                            author: 'ai_soft_bump',
                            content: bumpText,
                            timestamp: nowIso
                        });

                        await doc.ref.update({
                            stalledState: 'BUMP_SENT',
                            bumpSentAt: nowIso,
                            lastAssistantReplyAt: nowIso,
                            updatedAt: nowIso,
                            messages: messages.slice(-50)
                        });

                        if (leadRef) {
                            await leadRef.update({
                                stalledStatus: 'BUMP_SENT',
                                lastContactDate: nowIso,
                                updatedAt: nowIso
                            }).catch(() => {});
                        }

                        aiActivityService.log({
                            category: 'sms',
                            type: 'ai_stalled_bump_sent',
                            level: 'info',
                            title: `Relance douce J+2 envoyée à ${conv.clientName || normalizedPhone}`,
                            detail: `"${bumpText}"`,
                            leadId: conv.leadId || null
                        });

                        processedCount++;
                    }
                }
            }

            // --- STAGE 2: BREAK-UP SMS (72h after Bump, ~J+5 total) ---
            else if (stalledState === 'BUMP_SENT') {
                const bumpSentTime = conv.bumpSentAt ? new Date(conv.bumpSentAt).getTime() : lastAssistantTime;
                const hoursSinceBump = (nowMs - bumpSentTime) / (1000 * 3600);

                if (hoursSinceBump >= this.BREAKUP_DELAY_HOURS) {
                    const breakupText = this.generateBreakupMessage({
                        clientName: conv.clientName || leadData?.name,
                        companyName: conv.companyName || leadData?.company,
                        language: lang
                    });

                    console.log(`[StalledRecoveryService] 🚪 Sending Stage 2 Break-up to ${normalizedPhone}: "${breakupText}"`);
                    const sendRes = await twilioService.sendSms(normalizedPhone, breakupText);

                    if (sendRes.success) {
                        const nowIso = new Date().toISOString();
                        messages.push({
                            role: 'assistant',
                            author: 'ai_breakup',
                            content: breakupText,
                            timestamp: nowIso
                        });

                        // --- STAGE 3: SCHEDULE 60-DAY AUTONOMOUS LONG-TERM NURTURE ---
                        let scheduledNurtureId = null;
                        try {
                            const followupService = require('./followup-service');
                            const nurtureRes = await followupService.scheduleFollowup({
                                leadId: conv.leadId || null,
                                phoneNumber: normalizedPhone,
                                clientName: conv.clientName || leadData?.name,
                                companyName: conv.companyName || leadData?.company,
                                delayDays: this.NURTURE_DELAY_DAYS, // 60 days
                                nurtureRound: 1, // Round 1 at J+60
                                reason: 'Nurturing autonome trimestriel (reconnexion après silence radio)',
                                contextNote: `A répondu initialement à la séquence mais n'a pas réservé d'appel. Break-up envoyé le ${new Date().toLocaleDateString('fr-CA')}.`,
                                language: lang,
                                createdBy: 'stalled_recovery_engine'
                            });
                            scheduledNurtureId = nurtureRes.followupId;
                            console.log(`[StalledRecoveryService] 📅 Stage 3 Long-term nurture scheduled in 60 days for ${normalizedPhone} (ID: ${scheduledNurtureId})`);
                        } catch (schedErr) {
                            console.error('[StalledRecoveryService] Failed to schedule long-term nurture:', schedErr.message);
                        }

                        await doc.ref.update({
                            stalledState: 'COLD_NURTURE_SCHEDULED',
                            breakupSentAt: nowIso,
                            scheduledNurtureId: scheduledNurtureId || null,
                            updatedAt: nowIso,
                            messages: messages.slice(-50)
                        });

                        if (leadRef) {
                            await leadRef.update({
                                status: 'COLD_NURTURE',
                                stalledStatus: 'COLD_NURTURE_SCHEDULED',
                                lastContactDate: nowIso,
                                updatedAt: nowIso
                            }).catch(() => {});
                        }

                        aiActivityService.log({
                            category: 'sms',
                            type: 'ai_stalled_breakup_sent',
                            level: 'success',
                            title: `Break-up J+5 envoyé & Suivi J+60 programmé pour ${conv.clientName || normalizedPhone}`,
                            detail: `Break-up : "${breakupText}" • Nurture programmé dans 60 jours`,
                            leadId: conv.leadId || null
                        });

                        processedCount++;
                    }
                }
            }

            // --- STAGE 4: AUTO-ARCHIVING (After 6 months + 14-day grace period) ---
            else if (stalledState === 'COLD_NURTURE_ROUND_2_SENT') {
                const archiveDueAt = conv.archiveDueAt ? new Date(conv.archiveDueAt).getTime() : 0;
                if (archiveDueAt && nowMs >= archiveDueAt) {
                    const nowIso = new Date().toISOString();
                    console.log(`[StalledRecoveryService] 📁 Auto-archiving lead ${normalizedPhone} after 6 months of inactivity.`);
                    await doc.ref.update({
                        stalledState: 'ARCHIVED_INACTIVE',
                        archivedAt: nowIso,
                        updatedAt: nowIso
                    });

                    if (leadRef) {
                        await leadRef.update({
                            status: 'ARCHIVED',
                            stalledStatus: 'ARCHIVED_INACTIVE',
                            archivedAt: nowIso,
                            archiveReason: 'Silence radio après 6 mois et 2 relances de nurturing (LCAP/CASL respecté)',
                            updatedAt: nowIso
                        }).catch(() => {});
                    }

                    aiActivityService.log({
                        category: 'sms',
                        type: 'ai_lead_auto_archived',
                        level: 'info',
                        title: `Lead archivé après 6 mois : ${conv.clientName || normalizedPhone}`,
                        detail: "Fin du cycle de nurturing (6 mois sans réponse). Clôture définitive du dossier.",
                        leadId: conv.leadId || null
                    });

                    processedCount++;
                }
            }
        }

        return { processed: processedCount };
    }
}

const stalledRecoveryService = new StalledRecoveryService();
module.exports = stalledRecoveryService;
