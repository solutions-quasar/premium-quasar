const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const app = require("./server");
const smsSequenceService = require("./sms-sequence-service");
const followupService = require("./followup-service");
const stalledRecoveryService = require("./stalled-recovery-service");
const leadAuditService = require("./lead-audit-service");
const calendarReminderService = require("./calendar-reminder-service");
const gmailInbox = require("./gmail-inbox-service");
const messagingPlatform = require("./messaging-platform");

// Export the Express app as a Firebase Cloud Function (2nd Gen) v1.0.2
// Timeout set to 120s and Memory to 1GiB to support AI / Puppeteer / Stripe operations
exports.api = onRequest({
    timeoutSeconds: 120,
    memory: "1GiB",
    cors: true
}, app);

// Scheduled Worker (Every 2 minutes) to guarantee SMS Sequence Steps, Follow-ups & Stalled Recovery execute on time
exports.sequenceWorker = onSchedule({
    schedule: "every 2 minutes",
    timeZone: "America/Moncton",
    timeoutSeconds: 120,
    memory: "512MiB"
}, async () => {
    await smsSequenceService.enrollApprovedUnsequencedLeads(15).catch(err => console.error("[Cron Enroll Error]", err.message));
    await smsSequenceService.processDueSequenceSteps().catch(err => console.error("[Cron Sequence Error]", err.message));
    await leadAuditService.runAuditBatch(5).catch(err => console.error("[Cron Audit Error]", err.message));
    await followupService.processDueFollowups().catch(err => console.error("[Cron Followup Error]", err.message));
    await stalledRecoveryService.processStalledConversations().catch(err => console.error("[Cron Stalled Error]", err.message));
    await calendarReminderService.reconcileActiveAppointments().catch(err => console.error("[Cron Calendar Reconcile Error]", err.message));
    await gmailInbox.syncInbox().catch(err => console.error("[Cron Gmail Inbox Error]", err.message));
    // Client Messaging Platform: Gmail channels of client projects (separate from the Quasar Gmail inbox above)
    await messagingPlatform.syncAllEmailChannels().catch(err => console.error("[Cron MP Gmail Error]", err.message));
});
