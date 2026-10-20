/**
 * Quasar ERP - SMS AI Agent Red Teaming & Stress Test Suite
 * Validates date constraints, anti-spam filters, rate limits, loop breaker, and admin alert debounce.
 * Run locally via: node test-sms-stress.js
 */

const assert = require('assert');
const twilioService = require('./twilio-service');
const calendarReminderService = require('./calendar-reminder-service');
const smsSequenceService = require('./sms-sequence-service');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✅ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    }
}

async function runAsyncTest(name, fn) {
    totalTests++;
    try {
        await fn();
        console.log(`  ✅ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    }
}

async function startSuite() {
    console.log("==================================================================");
    console.log("🚀 STARTING QUASAR SMS AI STRESS TEST & GUARDRAILS SUITE");
    console.log("==================================================================\n");

    // =========================================================================
    // BATTERIE 1 : GARDE-FOUS TEMPORELS & CALENDRIER (Ce qui a piégé Sasha)
    // =========================================================================
    console.log("📅 BATTERIE 1 : Garde-Fous Temporels & Calendrier");

    await runAsyncTest("T1.1 : Rejet formel d'un RDV dans le passé", async () => {
        const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h in past
        let errorThrown = false;
        try {
            await calendarReminderService.scheduleAppointment({
                appointmentTime: pastDate,
                prospectName: "Test Lead Past",
                prospectPhone: "+15550000001"
            });
        } catch (e) {
            errorThrown = true;
            assert(e.message.includes("past") || e.message.includes("passé"), "Error should explain appointment is in past");
        }
        assert.strictEqual(errorThrown, true, "scheduleAppointment must throw when appointmentTime is in the past");
    });

    await runAsyncTest("T1.2 : Rejet d'un RDV avec préavis insuffisant (< 2 heures)", async () => {
        const soonDate = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min in future
        let errorThrown = false;
        try {
            await calendarReminderService.scheduleAppointment({
                appointmentTime: soonDate,
                prospectName: "Test Lead Soon",
                prospectPhone: "+15550000002"
            });
        } catch (e) {
            errorThrown = true;
            assert(e.message.includes("2 hours") || e.message.includes("2 heures"), "Error should require 2h notice");
        }
        assert.strictEqual(errorThrown, true, "scheduleAppointment must throw when notice is under 2 hours");
    });

    // =========================================================================
    // BATTERIE 2 : DÉTECTION DES RÉPONDEURS AUTOMATIQUES (Out of office)
    // =========================================================================
    console.log("\n🤖 BATTERIE 2 : Détection des Répondeurs Automatiques (Out of Office)");

    runTest("T2.1 : Interception 'Out of office' anglais", () => {
        const msg = "Thank you for your email. I am out of office until Monday with limited access to messages.";
        assert.strictEqual(twilioService.isAutoResponderText(msg), true);
    });

    runTest("T2.2 : Interception 'Absence du bureau' français", () => {
        const msg = "Message automatique : Je suis actuellement en absence du bureau jusqu'au 25 octobre.";
        assert.strictEqual(twilioService.isAutoResponderText(msg), true);
    });

    runTest("T2.3 : Interception 'Notification d'échec de distribution'", () => {
        const msg = "Delivery Status Notification (Failure): The recipient address was not recognized.";
        assert.strictEqual(twilioService.isAutoResponderText(msg), true);
    });

    runTest("T2.4 : Message d'un vrai prospect NE DOIT PAS être considéré comme répondeur", () => {
        const msg = "Bonjour Benjamin, je suis disponible jeudi à 14h pour discuter de notre site.";
        assert.strictEqual(twilioService.isAutoResponderText(msg), false);
    });

    // =========================================================================
    // BATTERIE 3 : FILTRAGE SPAM CYRILLIQUE / BOT
    // =========================================================================
    console.log("\n🛡️ BATTERIE 3 : Filtrage Spam Cyrillique / Bot");

    runTest("T3.1 : Détection et blocage de texte cyrillique", () => {
        const msg = "Здравствуйте! Предлагаем создание сайтов недорого.";
        assert.strictEqual(twilioService.isCyrillicSpam(msg), true);
    });

    runTest("T3.2 : Texte normal en français / anglais autorisé", () => {
        const msgFr = "Est-ce que votre agence fait des applications mobiles ?";
        const msgEn = "Would Thursday at 2pm work for our discovery call?";
        assert.strictEqual(twilioService.isCyrillicSpam(msgFr), false);
        assert.strictEqual(twilioService.isCyrillicSpam(msgEn), false);
    });

    // =========================================================================
    // BATTERIE 4 : COUPE-BOUCLE DE POLITESSE (LOOP BREAKER)
    // =========================================================================
    console.log("\n🔄 BATTERIE 4 : Coupe-Boucle de Politesse (Loop Breaker)");

    runTest("T4.1 : Détection d'accusé de politesse après confirmation de RDV", () => {
        const mockHistory = [
            { role: "user", content: "Jeudi 14h c'est bon pour moi" },
            { role: "assistant", content: "Votre rendez-vous est confirmé pour le Jeudi 22 octobre à 14h00 ! Meet: https://meet.google.com/qsr-auto-meet" }
        ];
        const msg = "Parfait merci !";
        const isAck = twilioService.isCourtesyAck(msg, mockHistory, { appointmentBooked: true });
        assert.strictEqual(isAck, true, "Should recognize courtesy ack after confirmed booking");
    });

    runTest("T4.2 : Une vraie question après RDV NE DOIT PAS être coupée", () => {
        const mockHistory = [
            { role: "assistant", content: "Votre rendez-vous est confirmé pour le Jeudi 22 octobre à 14h00 !" }
        ];
        const msg = "Est-ce que je dois préparer des documents pour le rendez-vous ?";
        const isAck = twilioService.isCourtesyAck(msg, mockHistory, { appointmentBooked: true });
        assert.strictEqual(isAck, false, "Real question after booking must NOT be intercepted by loop breaker");
    });

    // =========================================================================
    // BATTERIE 5 : RATE LIMITING DYNAMIQUE ET PLAFOND JOURNALIER
    // =========================================================================
    console.log("\n⚡ BATTERIE 5 : Rate Limiting Dynamique & Plafond Journalier");

    runTest("T5.1 : Quota de 3 messages en 2 minutes", () => {
        const testPhone = "+15559998888";
        twilioService.inboundRateLimitTracker.delete(testPhone);

        // First 3 messages allowed
        assert.strictEqual(twilioService.checkInboundRateLimit(testPhone).allowed, true);
        assert.strictEqual(twilioService.checkInboundRateLimit(testPhone).allowed, true);
        assert.strictEqual(twilioService.checkInboundRateLimit(testPhone).allowed, true);

        // 4th message in 2 min -> throttled!
        const fourth = twilioService.checkInboundRateLimit(testPhone);
        assert.strictEqual(fourth.allowed, false);
        assert.strictEqual(fourth.reason, "flood_detected");
    });

    runTest("T5.2 : Plafond journalier de 12 échanges IA (Daily Cap)", () => {
        const testPhone = "+15557776666";
        twilioService.inboundRateLimitTracker.delete(testPhone);

        // Simulate 12 outgoing AI messages
        for (let i = 0; i < 12; i++) {
            twilioService.checkInboundRateLimit(testPhone);
            const rec = twilioService.inboundRateLimitTracker.get(testPhone);
            rec.dailyCount = i + 1;
        }

        // 13th check should trigger daily cap
        const capped = twilioService.checkInboundRateLimit(testPhone);
        assert.strictEqual(capped.allowed, false);
        assert.strictEqual(capped.dailyCapReached, true);
        assert.strictEqual(capped.reason, "daily_cap");
    });

    // =========================================================================
    // BATTERIE 6 : DEBOUNCE DES NOTIFICATIONS EMAIL ADMINISTRATEUR
    // =========================================================================
    console.log("\n📧 BATTERIE 6 : Debounce des Alertes Email Administrateur");

    await runAsyncTest("T6.1 : Alertes de réponse espacées de moins de 15 min sont debouncées", async () => {
        const testPhone = "+15551234567";
        let debounceLogged = false;
        const originalLog = console.log;
        console.log = (...args) => {
            if (args.join(' ').includes("[Admin Alert Debounce] Redundant reply alert skipped")) {
                debounceLogged = true;
            }
            originalLog(...args);
        };

        try {
            await smsSequenceService.notifyAdminOnProspectAction({
                phoneNumber: testPhone,
                clientName: "Test Prospect",
                actionType: "reply",
                text: "Message 1"
            });

            await smsSequenceService.notifyAdminOnProspectAction({
                phoneNumber: testPhone,
                clientName: "Test Prospect",
                actionType: "reply",
                text: "Message 2"
            });
        } finally {
            console.log = originalLog;
        }

        assert.strictEqual(debounceLogged, true, "Second reply within 15 min window must be skipped by debounce");
    });

    await runAsyncTest("T6.2 : Une prise de RDV ('booking') N'EST JAMAIS debouncée", async () => {
        const testPhone = "+15551234567";
        let debounceLogged = false;
        const originalLog = console.log;
        console.log = (...args) => {
            if (args.join(' ').includes("[Admin Alert Debounce]")) {
                debounceLogged = true;
            }
            originalLog(...args);
        };

        try {
            await smsSequenceService.notifyAdminOnProspectAction({
                phoneNumber: testPhone,
                clientName: "Test Prospect",
                actionType: "booking",
                text: "RDV confirmé"
            });
        } finally {
            console.log = originalLog;
        }

        assert.strictEqual(debounceLogged, false, "Booking alerts must never be debounced!");
    });

    console.log("\n==================================================================");
    console.log(`📊 TEST SUITE SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests / totalTests) * 100).toFixed(0)}%)`);
    console.log("==================================================================");

    process.exit(passedTests === totalTests ? 0 : 1);
}

startSuite().catch(e => {
    console.error("[Fatal Test Suite Error]:", e);
    process.exit(1);
});
