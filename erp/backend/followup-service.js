/**
 * Solutions Quasar Inc. - Autonomous Long-Term Follow-up Engine
 * 
 * Manages:
 * 1. AI-triggered follow-up scheduling (OpenAI tool `schedule_followup`)
 * 2. 100% Autonomous execution when due:
 *    - Context-aware re-engagement SMS generation via OpenAI GPT-4o-mini
 *    - Direct SMS dispatch via Twilio/Telnyx
 *    - Timezone & legal hours compliance (CASL / FCC / CRTC)
 *    - Respects opt-out status (smsOptOut)
 *    - Conversation threading into Firestore `conversations`
 * 3. Instant Admin notifications (SMS/Email) upon execution
 * 4. Full tracking in `crm_followups` and `ai_activities`
 */

const { db } = require('./firebase-admin');
const OpenAI = require('openai');
const twilioService = require('./twilio-service');
const smsSequenceService = require('./sms-sequence-service');
const aiActivityService = require('./ai-activity-service');

class FollowupService {
    constructor() {
        this.workerInterval = null;
    }

    init() {
        this.startFollowupWorker();
        console.log('[FollowupService] Autonomous Long-Term Follow-up Engine initialized.');
    }

    startFollowupWorker() {
        if (this.workerInterval) clearInterval(this.workerInterval);

        // Check every 30 seconds for due follow-ups
        this.workerInterval = setInterval(async () => {
            try {
                await this.processDueFollowups();
            } catch (err) {
                console.error('[FollowupService] Worker error:', err.message);
            }
        }, 30000);
    }

    /**
     * Resolves the target Date object based on delayDays or targetDate string
     */
    resolveTargetDate({ delayDays, targetDate }) {
        const now = new Date();
        if (targetDate) {
            const parsed = new Date(targetDate);
            if (!isNaN(parsed.getTime())) {
                // If only a date string YYYY-MM-DD is given, set default send time to 10:15 AM
                if (targetDate.length <= 10) {
                    parsed.setHours(10, 15, 0, 0);
                }
                return parsed;
            }
        }

        const days = parseInt(delayDays, 10) || 14; // Default: 2 weeks
        const target = new Date(now.getTime() + (days * 24 * 3600 * 1000));
        target.setHours(10, 15, 0, 0);
        return target;
    }

    /**
     * Schedule a new smart follow-up (called by AI tool or manual CRM trigger)
     */
    async scheduleFollowup({
        leadId,
        phoneNumber,
        clientName,
        companyName,
        delayDays,
        targetDate,
        reason,
        contextNote,
        language,
        createdBy = 'ai_agent'
    }) {
        if (!phoneNumber) throw new Error("phoneNumber is required to schedule a follow-up");

        const normalizedPhone = twilioService.normalizePhone(phoneNumber);
        let resolvedLead = null;
        let resolvedLeadId = leadId || null;

        // Try to find lead in Firestore if leadId not passed
        if (!resolvedLeadId) {
            const snap = await db.collection('leads')
                .where('phone_number', '==', normalizedPhone)
                .limit(1)
                .get();
            if (!snap.empty) {
                resolvedLeadId = snap.docs[0].id;
                resolvedLead = snap.docs[0].data();
            } else {
                const snap2 = await db.collection('leads')
                    .where('phone', '==', normalizedPhone)
                    .limit(1)
                    .get();
                if (!snap2.empty) {
                    resolvedLeadId = snap2.docs[0].id;
                    resolvedLead = snap2.docs[0].data();
                }
            }
        } else {
            const leadSnap = await db.collection('leads').doc(resolvedLeadId).get();
            if (leadSnap.exists) resolvedLead = leadSnap.data();
        }

        const resolvedClientName = clientName || resolvedLead?.name || resolvedLead?.business_name || '';
        const resolvedCompanyName = companyName || resolvedLead?.company || resolvedLead?.business_name || '';

        // Resolve timezone and next legal send window
        const timezone = smsSequenceService.resolveTimezone({
            phone: normalizedPhone,
            postalCode: resolvedLead?.postal_code || resolvedLead?.postalCode,
            address: resolvedLead?.address || resolvedLead?.formattedAddress,
            province: resolvedLead?.province || resolvedLead?.state,
            country: resolvedLead?.country
        });

        const rawTargetDate = this.resolveTargetDate({ delayDays, targetDate });
        const legalSendIso = smsSequenceService.getNextLegalSendTime(rawTargetDate, timezone);
        const legalSendDate = new Date(legalSendIso);

        // Cancel any existing pending follow-up for this phone to avoid stacking duplicates
        const existingPending = await db.collection('crm_followups')
            .where('phoneNumber', '==', normalizedPhone)
            .where('status', '==', 'SCHEDULED')
            .get();

        for (const doc of existingPending.docs) {
            await doc.ref.update({
                status: 'SUPERSEDED',
                supersededAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        const followupDocRef = db.collection('crm_followups').doc();
        const followupRecord = {
            id: followupDocRef.id,
            leadId: resolvedLeadId,
            phoneNumber: normalizedPhone,
            clientName: resolvedClientName,
            companyName: resolvedCompanyName,
            dueDate: legalSendIso,
            scheduledForDisplay: legalSendDate.toLocaleString('fr-CA', { timeZone: 'America/Moncton' }),
            timezone,
            reason: reason || 'Suivi long terme automatique',
            contextNote: contextNote || '',
            language: language || (resolvedLead && !smsSequenceService.isLeadFrancophone(resolvedLead) ? 'en' : 'fr'),
            status: 'SCHEDULED', // 'SCHEDULED', 'EXECUTED', 'CANCELLED', 'SUPERSEDED', 'FAILED'
            mode: 'autonomous', // 100% autonome
            createdBy,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await followupDocRef.set(followupRecord);

        // Update lead document for rapid CRM display & filtering
        if (resolvedLeadId) {
            await db.collection('leads').doc(resolvedLeadId).set({
                hasScheduledFollowup: true,
                nextFollowupDue: legalSendDate.toISOString(),
                nextFollowupReason: reason || 'Suivi IA programmé',
                nextFollowupId: followupDocRef.id,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        }

        // Log AI Activity
        aiActivityService.log({
            category: 'sms',
            type: 'ai_followup_scheduled',
            level: 'success',
            title: `Suivi IA autonome programmé pour ${resolvedClientName || normalizedPhone}`,
            detail: `Échéance : ${followupRecord.scheduledForDisplay} (${timezone}). Motif: ${reason}`,
            leadId: resolvedLeadId
        });

        console.log(`[FollowupService] Follow-up scheduled for ${normalizedPhone} on ${legalSendDate.toISOString()} (ID: ${followupDocRef.id})`);

        return {
            success: true,
            followupId: followupDocRef.id,
            dueDate: legalSendDate.toISOString(),
            scheduledForDisplay: followupRecord.scheduledForDisplay,
            timezone,
            reason: followupRecord.reason
        };
    }

    /**
     * Cancels an existing scheduled follow-up
     */
    async cancelFollowup(followupId, cancelReason = 'Annulé manuellement') {
        if (!followupId) throw new Error("followupId is required");

        const ref = db.collection('crm_followups').doc(followupId);
        const snap = await ref.get();
        if (!snap.exists) throw new Error("Follow-up introuvable");

        const data = snap.data();
        await ref.update({
            status: 'CANCELLED',
            cancelReason,
            cancelledAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        if (data.leadId) {
            await db.collection('leads').doc(data.leadId).update({
                hasScheduledFollowup: false,
                nextFollowupDue: null,
                nextFollowupReason: null,
                updatedAt: new Date().toISOString()
            }).catch(() => {});
        }

        aiActivityService.log({
            category: 'sms',
            type: 'ai_followup_cancelled',
            level: 'info',
            title: `Suivi IA annulé pour ${data.clientName || data.phoneNumber}`,
            detail: `Motif d'annulation : ${cancelReason}`,
            leadId: data.leadId || null
        });

        return { success: true, followupId };
    }

    /**
     * Generates a context-aware re-engagement SMS via OpenAI
     */
    async generateFollowupSms({ followup, history = [] }) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error("OPENAI_API_KEY missing on server.");

        const openai = new OpenAI({ apiKey });
        const isEn = followup.language === 'en';

        const conversationContext = history.length > 0 
            ? history.slice(-6).map(m => `${m.role === 'user' ? 'Prospect' : 'Ben'}: ${m.content}`).join('\n')
            : 'Aucun échange récent';

        const systemPrompt = isEn
            ? `You are Ben from Solutions Quasar Inc., a modern tech agency in Atlantic Canada.
You are sending an autonomous, highly personalized follow-up SMS to a prospect who asked to be re-contacted later.

PROSPECT CONTEXT:
- Name: ${followup.clientName || 'there'}
- Company: ${followup.companyName || 'your business'}
- Reason for follow-up: ${followup.reason}
- Additional Context / Notes: ${followup.contextNote || 'None'}

PREVIOUS CONVERSATION SNIPPET:
${conversationContext}

CRITICAL RULES:
1. Tone: Friendly, genuine, human, direct. NEVER sound like a spammy sales bot.
2. Reference the previous discussion or the agreed timing naturally (e.g. "Hey ${followup.clientName ? followup.clientName.split(' ')[0] : ''}, hope your trip went well! Checking in as promised...").
3. Ask a simple, polite open-ended question to re-open the dialogue.
4. STRICT LENGTH LIMIT: Strictly under 160 characters (maximum 180).
5. Output ONLY the raw SMS text, no quotes, no extra greetings.`
            : `Tu es Ben de Solutions Quasar Inc., agence technologique moderne au Canada atlantique.
Tu envoies un SMS de relance autonome, ultra-personnalisé et chaleureux à un prospect qui avait demandé d'être recontacté plus tard.

CONTEXTE DU PROSPECT :
- Nom : ${followup.clientName || ''}
- Entreprise : ${followup.companyName || ''}
- Motif du suivi : ${followup.reason}
- Notes contextuelles : ${followup.contextNote || 'Aucune'}

EXTRAIT DE LA CONVERSATION PRÉCÉDENTE :
${conversationContext}

RÈGLES STRICTES :
1. Ton : Chaleureux, humain, direct, courtois. Ne fais JAMAIS robotique ou vendeur insistant.
2. Fais référence naturellement au motif convenu (ex: "Allo ${followup.clientName ? followup.clientName.split(' ')[0] : ''}, j'espère que les vacances se sont bien passées ! Comme convenu, je prenais des nouvelles...").
3. Termine par une question simple et ouverte pour relancer l'échange.
4. LONGUEUR STRICTE : Moins de 160 caractères (maximum 180).
5. Output UNIQUEMENT le texte brut du SMS, sans guillemets, sans fioritures.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Génère le SMS de suivi maintenant." }
            ],
            temperature: 0.65,
            max_tokens: 120
        });

        let smsText = completion.choices[0]?.message?.content?.trim() || '';
        // Strip outer quotes if any
        smsText = smsText.replace(/^["']|["']$/g, '').trim();
        return smsText;
    }

    /**
     * Executes a single follow-up record immediately (Autonomous dispatch)
     */
    async executeFollowup(followupId) {
        const ref = db.collection('crm_followups').doc(followupId);
        const snap = await ref.get();
        if (!snap.exists) throw new Error("Follow-up record not found");

        const followup = snap.data();
        if (followup.status !== 'SCHEDULED') {
            console.log(`[FollowupService] Follow-up ${followupId} is already in status ${followup.status}, skipping.`);
            return { skipped: true, reason: `Status is ${followup.status}` };
        }

        const normalizedPhone = twilioService.normalizePhone(followup.phoneNumber);

        // 1. Safety Check: Verify opt-out status
        let leadData = null;
        if (followup.leadId) {
            const leadSnap = await db.collection('leads').doc(followup.leadId).get();
            if (leadSnap.exists) leadData = leadSnap.data();
        }

        if (leadData?.smsOptOut === true || leadData?.status === 'UNSUBSCRIBED') {
            console.log(`[FollowupService] Prospect ${normalizedPhone} has opted out. Cancelling follow-up.`);
            await ref.update({
                status: 'CANCELLED_OPTOUT',
                cancelledAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            return { cancelled: true, reason: 'Opt-out' };
        }

        // 2. Fetch conversation history for high-fidelity context
        const sessionId = `sms_${normalizedPhone.replace('+', '')}`;
        const convRef = db.collection('conversations').doc(sessionId);
        const convSnap = await convRef.get();
        const convData = convSnap.exists ? convSnap.data() : {};
        const history = convData.messages || [];

        // 3. Generate hyper-contextual AI SMS
        let smsMessage = '';
        try {
            smsMessage = await this.generateFollowupSms({ followup, history });
        } catch (genErr) {
            console.error(`[FollowupService] Failed to generate AI SMS:`, genErr.message);
            // Bulletproof fallback
            smsMessage = followup.language === 'en'
                ? `Hi ${followup.clientName ? followup.clientName.split(' ')[0] : 'there'}, Ben from Solutions Quasar following up as promised! How are things with ${followup.companyName || 'your projects'}?`
                : `Bonjour ${followup.clientName ? followup.clientName.split(' ')[0] : ''}, c'est Ben de Solutions Quasar comme promis ! Comment se passent vos projets chez ${followup.companyName || 'vous'} ?`;
        }

        // 4. Send SMS via Twilio / Telnyx
        console.log(`[FollowupService] Executing 100% Autonomous Follow-up to ${normalizedPhone}: "${smsMessage}"`);
        const sendResult = await twilioService.sendSms(normalizedPhone, smsMessage);

        if (!sendResult.success) {
            console.error(`[FollowupService] SMS dispatch failed for ${normalizedPhone}:`, sendResult.error);
            await ref.update({
                status: 'FAILED',
                error: sendResult.error,
                updatedAt: new Date().toISOString()
            });
            return { success: false, error: sendResult.error };
        }

        const nowIso = new Date().toISOString();

        // 5. Append sent SMS to conversation history
        history.push({
            role: 'assistant',
            author: 'ai_followup',
            content: smsMessage,
            timestamp: nowIso,
            followupId
        });

        await convRef.set({
            sessionId,
            channel: 'sms',
            phoneNumber: normalizedPhone,
            clientName: followup.clientName || null,
            companyName: followup.companyName || null,
            leadId: followup.leadId || null,
            aiEnabled: true,
            updatedAt: nowIso,
            messages: history.slice(-50)
        }, { merge: true });

        // 6. Update follow-up record
        await ref.update({
            status: 'EXECUTED',
            executedAt: nowIso,
            sentMessage: smsMessage,
            messageSid: sendResult.messageSid,
            updatedAt: nowIso
        });

        // 7. Update lead document
        if (followup.leadId) {
            await db.collection('leads').doc(followup.leadId).update({
                hasScheduledFollowup: false,
                lastFollowupSentAt: nowIso,
                lastContactDate: nowIso,
                nextFollowupDue: null,
                nextFollowupReason: null,
                updatedAt: nowIso
            }).catch(() => {});
        }

        // 8. Log in AI Activity Stream
        aiActivityService.log({
            category: 'sms',
            type: 'ai_followup_executed',
            level: 'success',
            title: `Suivi IA autonome envoyé à ${followup.clientName || normalizedPhone}`,
            detail: `"${smsMessage}" (Motif : ${followup.reason})`,
            leadId: followup.leadId || null
        });

        // 9. Send alert to Admin (Benjamin)
        try {
            await smsSequenceService.notifyAdminOnProspectAction({
                leadId: followup.leadId,
                phoneNumber: normalizedPhone,
                clientName: followup.clientName,
                companyName: followup.companyName,
                actionType: 'followup_sent',
                text: `[Suivi IA 100% Autonome Envoyé] : "${smsMessage}"`
            });
        } catch (alertErr) {
            console.warn('[FollowupService] Admin notification warning:', alertErr.message);
        }

        return {
            success: true,
            followupId,
            sentMessage: smsMessage,
            messageSid: sendResult.messageSid
        };
    }

    /**
     * Background Worker: checks for all due follow-ups and executes them autonomously
     */
    async processDueFollowups() {
        try {
            const now = new Date();
            const nowIso = now.toISOString();

            const snapshot = await db.collection('crm_followups')
                .where('status', '==', 'SCHEDULED')
                .limit(50)
                .get();

            if (snapshot.empty) return;

            // Filter in memory to avoid requiring a Firestore composite index
            const dueDocs = snapshot.docs.filter(d => {
                const data = d.data();
                return data.dueDate && data.dueDate <= nowIso;
            });

            if (dueDocs.length === 0) return;

            console.log(`[FollowupService] Found ${dueDocs.length} due follow-up(s) to process.`);

            for (const doc of dueDocs) {
                const followup = doc.data();

                // Respect recipient local timezone legal window
                const tz = followup.timezone || 'America/Moncton';
                if (!smsSequenceService.isWithinLegalWindow(now, tz)) {
                    // Reschedule to next legal window (e.g. 10:15 AM tomorrow)
                    const nextLegalIso = smsSequenceService.getNextLegalSendTime(now, tz);
                    const nextLegalDate = new Date(nextLegalIso);
                    console.log(`[FollowupService] Outside legal window for ${followup.phoneNumber} (${tz}). Rescheduling to ${nextLegalIso}`);
                    await doc.ref.update({
                        dueDate: nextLegalIso,
                        scheduledForDisplay: nextLegalDate.toLocaleString('fr-CA', { timeZone: 'America/Moncton' }),
                        updatedAt: new Date().toISOString()
                    });
                    continue;
                }

                // Execute autonomous follow-up
                await this.executeFollowup(doc.id).catch(err => {
                    console.error(`[FollowupService] Error executing follow-up ${doc.id}:`, err.message);
                });
            }
        } catch (err) {
            console.error('[FollowupService] Error in processDueFollowups:', err.message);
        }
    }

    /**
     * Fetch all followups for a specific lead
     */
    async getFollowupsForLead(leadId) {
        if (!leadId) return [];
        const snap = await db.collection('crm_followups')
            .where('leadId', '==', leadId)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        return list;
    }

    /**
     * List recent follow-ups (all leads) with optional status filter
     */
    async listFollowups({ status, limit = 50 } = {}) {
        let q = db.collection('crm_followups');
        if (status) {
            q = q.where('status', '==', status);
        }
        const snap = await q.orderBy('dueDate', 'asc').limit(limit).get();
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        return list;
    }
}

const followupService = new FollowupService();
module.exports = followupService;
