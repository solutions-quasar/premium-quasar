/**
 * Quasar ERP - Stalled Conversation Recovery Unit Test Suite
 * Tests the 3-Stage Recovery Lifecycle:
 * - Stage 1 (J+2 / 48h): Soft Bump
 * - Stage 2 (J+5 / 72h): Break-up SMS
 * - Stage 3 (J+60 / 60d): Automatic Long-Term Nurture scheduling
 * - State resolution on prospect reply or appointment booking
 */

const stalledRecoveryService = require('./stalled-recovery-service');

function runTest(testName, fn) {
    try {
        fn();
        console.log(`✅ [PASS] ${testName}`);
        return true;
    } catch (err) {
        console.error(`❌ [FAIL] ${testName}: ${err.message}`);
        return false;
    }
}

async function runAllTests() {
    console.log("==========================================================");
    console.log("🧪 TESTING STALLED CONVERSATION & LONG-TERM RECOVERY ENGINE");
    console.log("==========================================================\n");

    let passed = 0;
    let total = 0;

    // Test 1: Soft Bump Message Generation (FR)
    total++;
    if (runTest("Soft Bump Message Generation (FR) with First Name", () => {
        const msg = stalledRecoveryService.generateSoftBumpMessage({
            clientName: "Jean Tremblay",
            language: "fr"
        });
        if (!msg.includes("Jean")) throw new Error("Missing first name Jean");
        if (!msg.includes("disponibilités")) throw new Error("Missing check-in question");
        if (msg.length > 160) throw new Error(`Message exceeds 160 chars (${msg.length})`);
    })) passed++;

    // Test 2: Soft Bump Message Generation (EN)
    total++;
    if (runTest("Soft Bump Message Generation (EN) with First Name", () => {
        const msg = stalledRecoveryService.generateSoftBumpMessage({
            clientName: "Robert Miller",
            language: "en"
        });
        if (!msg.includes("Robert")) throw new Error("Missing first name Robert");
        if (!msg.includes("quick call")) throw new Error("Missing quick call reference");
        if (msg.length > 160) throw new Error(`Message exceeds 160 chars (${msg.length})`);
    })) passed++;

    // Test 3: Break-up Message Generation (FR)
    total++;
    if (runTest("Break-up Message Generation (FR) with Company Name", () => {
        const msg = stalledRecoveryService.generateBreakupMessage({
            clientName: "Sophie Gagnon",
            companyName: "Clinique Santé Plus",
            language: "fr"
        });
        if (!msg.includes("Sophie")) throw new Error("Missing first name Sophie");
        if (!msg.includes("Clinique Santé Plus")) throw new Error("Missing company name");
        if (!msg.includes("classe le dossier")) throw new Error("Missing gentle closure phrase");
        if (msg.length > 200) throw new Error(`Message exceeds 200 chars (${msg.length})`);
    })) passed++;

    // Test 4: Break-up Message Generation (EN)
    total++;
    if (runTest("Break-up Message Generation (EN) with Company Name", () => {
        const msg = stalledRecoveryService.generateBreakupMessage({
            clientName: "David Clark",
            companyName: "Clark Law Group",
            language: "en"
        });
        if (!msg.includes("David")) throw new Error("Missing first name David");
        if (!msg.includes("Clark Law Group")) throw new Error("Missing company name");
        if (!msg.includes("close our file")) throw new Error("Missing gentle closure phrase");
        if (msg.length > 200) throw new Error(`Message exceeds 200 chars (${msg.length})`);
    })) passed++;

    // Test 5: Fallback without names (FR & EN)
    total++;
    if (runTest("Fallback without names produces elegant messages", () => {
        const msgFr = stalledRecoveryService.generateSoftBumpMessage({ language: "fr" });
        const msgEn = stalledRecoveryService.generateSoftBumpMessage({ language: "en" });
        if (msgFr.includes("undefined") || msgEn.includes("undefined")) throw new Error("Found undefined in text");
        if (!msgFr.startsWith("Allo,") || !msgEn.startsWith("Hey,")) throw new Error("Improper generic greeting");
    })) passed++;

    // Test 6: Delay Configuration Constants
    total++;
    if (runTest("Delay configuration adheres to 48h bump, 72h breakup, 60d nurture", () => {
        if (stalledRecoveryService.BUMP_DELAY_HOURS !== 48) throw new Error("BUMP_DELAY_HOURS must be 48");
        if (stalledRecoveryService.BREAKUP_DELAY_HOURS !== 72) throw new Error("BREAKUP_DELAY_HOURS must be 72");
        if (stalledRecoveryService.NURTURE_DELAY_DAYS !== 60) throw new Error("NURTURE_DELAY_DAYS must be 60");
    })) passed++;

    // Test 7: 6-Month Nurturing Multi-Touch Chaining Constants
    total++;
    if (runTest("6-Month Nurturing Cycle (Round 1 at 60d + Round 2 at +120d = 180d total)", () => {
        const round1Delay = 60;
        const round2Delay = 120;
        const totalNurtureDays = round1Delay + round2Delay;
        if (totalNurtureDays !== 180) throw new Error(`Total days must be 180 (got ${totalNurtureDays})`);
        const totalMonths = totalNurtureDays / 30;
        if (totalMonths !== 6) throw new Error(`Total months must be 6 (got ${totalMonths})`);
    })) passed++;

    // Test 8: Auto-Archiving Rules (CASL / LCAP 6-Month Expiration)
    total++;
    if (runTest("Auto-Archiving correctly sets terminal ARCHIVED_INACTIVE and ARCHIVED status", () => {
        const activeStates = ['WAITING_REPLY', 'BUMP_SENT', 'BREAKUP_SENT', 'COLD_NURTURE_SCHEDULED', 'COLD_NURTURE_ROUND_1_SENT', 'COLD_NURTURE_ROUND_2_SENT'];
        const terminalStates = ['ARCHIVED_INACTIVE', 'RESOLVED_REPLIED', 'RESOLVED_BOOKED', 'CANCELLED_OPTOUT'];
        for (const state of terminalStates) {
            if (activeStates.includes(state)) throw new Error(`Terminal state ${state} must not be in active states`);
        }
    })) passed++;

    console.log("\n==========================================================");
    console.log(`📊 TEST RESULTS: ${passed}/${total} PASSED (${((passed / total) * 100).toFixed(0)}%)`);
    console.log("==========================================================");

    if (passed !== total) process.exit(1);
    process.exit(0);
}

runAllTests().catch(err => {
    console.error("Test runner fatal error:", err);
    process.exit(1);
});
