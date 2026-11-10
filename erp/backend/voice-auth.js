/**
 * Voice Security Service
 * Handles strict authentication and authorization for voice agent calls.
 */
const { getApp } = require('./firebase-manager');

class VoiceAuth {
    /**
     * Normalizes phone numbers to a consistent format for comparison.
     * Removes leading +, spaces, dashes, and parentheses.
     * @param {string} phone 
     * @returns {string}
     */
    normalizePhone(phone) {
        if (!phone) return '';
        // Keep only digits
        return phone.replace(/\D/g, '');
    }

    /** True when both numbers have at least 10 digits and their last 10 digits are identical. */
    samePhone(a, b) {
        const x = this.normalizePhone(String(a || '')), y = this.normalizePhone(String(b || ''));
        if (x.length < 10 || y.length < 10) return false;
        return x.slice(-10) === y.slice(-10);
    }

    /**
     * Verifies if a caller is an authorized team member with voice access.
     * @param {string} phoneNumber Initial phone number from Vapi
     * @param {string} projectId Target Project ID
     * @returns {Promise<{authorized: boolean, user?: object, reason?: string}>}
     */
    async verifyCaller(phoneNumber, projectId) {
        try {
            if (!phoneNumber) {
                return { authorized: false, reason: 'No Caller ID detected.' };
            }

            const normalizedInput = this.normalizePhone(phoneNumber);
            console.log(`[VoiceAuth] Verifying: ${normalizedInput} for Project: ${projectId}`);

            const app = await getApp(projectId);
            const db = app.firestore();

            // 1. Check if 'team' collection exists/has data
            // Note: We use a query instead of listCollections for performance and compatibility
            const teamRef = db.collection('team');
            const userQuery = await teamRef.get();

            if (userQuery.empty) {
                console.warn(`[VoiceAuth] BLOCKED: No team members found for project ${projectId}.`);
                return { authorized: false, reason: 'System lock: No team registered.' };
            }

            // 2. Find specific user by phone
            // We fetch all and normalize locally to be bulletproof against varied storage formats
            // Alternatively, if the collection is huge, we'd rely on a normalized field in DB
            const allMembers = userQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const authorizedMember = allMembers.find(member => {
                // Compare the last 10 digits exactly (ignores the +1 country code). Members without a full
                // phone number never match: an empty number used to match every caller.
                const phoneMatch = this.samePhone(normalizedInput, member.voicePhone || member.phone);

                // CRITICAL: Check explicit permissions
                const hasAccess = member.voiceAccess === true;
                const isActive = member.status === 'Active' || member.active !== false;

                return phoneMatch && hasAccess && isActive;
            });

            if (!authorizedMember) {
                console.warn(`[VoiceAuth] BLOCKED: Caller ${normalizedInput} unauthorized or missing permissions.`);
                return { authorized: false, reason: 'Access denied: Unauthorized number or missing permissions.' };
            }

            console.log(`[VoiceAuth] SUCCESS: Authorized ${authorizedMember.name} (${authorizedMember.id})`);
            return {
                authorized: true,
                user: {
                    id: authorizedMember.id,
                    name: authorizedMember.name,
                    role: authorizedMember.role
                },
                hasPin: !!String(authorizedMember.voicePin || '').trim(),
                pin: String(authorizedMember.voicePin || '').trim()
            };

        } catch (error) {
            console.error(`[VoiceAuth] CRITICAL ERROR during verification:`, error.message);
            // FAIL CLOSED: If there's an error (DB down, config error), block the call.
            return { authorized: false, reason: 'Security system error. Call blocked.' };
        }
    }
}

// ---- PIN verification for one call (stored in the central ERP database, keyed by Vapi call id) ----
const MAX_PIN_ATTEMPTS = 5;
const PIN_SESSION_MS = 2 * 60 * 60 * 1000;
const callAuthRef = (callId) => require('./firebase-admin').db.collection('voice_call_auth').doc(String(callId));

/**
 * Checks the PIN said by the caller against the team member matched by caller ID.
 * After MAX_PIN_ATTEMPTS failures the call is locked (no more tries).
 */
VoiceAuth.prototype.verifyPin = async function (callId, projectId, phoneNumber, pin) {
    if (!callId) return { success: false, error: 'System error: call id missing. Cannot verify PIN.' };
    const ref = callAuthRef(callId);
    const snap = await ref.get();
    const state = snap.exists ? snap.data() : { failures: 0 };
    if (state.projectId && state.projectId !== projectId) return { success: false, error: 'Access denied.' };
    if ((state.failures || 0) >= MAX_PIN_ATTEMPTS) return { success: false, locked: true, error: 'Too many wrong PINs. Access is locked for this call.' };

    const auth = await this.verifyCaller(phoneNumber, projectId);
    if (!auth.authorized) return { success: false, error: 'Caller not recognised.' };
    if (!auth.hasPin) return { success: false, error: 'No voice PIN is set for this team member. Set one in the ERP (Team).' };

    const said = String(pin || '').replace(/\D/g, '');
    const now = Date.now();
    if (said && said === auth.pin) {
        await ref.set({ projectId, memberId: auth.user.id, verified: true, failures: state.failures || 0, verifiedAt: new Date(now).toISOString(), expiresAt: new Date(now + PIN_SESSION_MS).toISOString() });
        return { success: true, authorized: true, message: `PIN verified. Welcome, ${auth.user.name || 'user'}.` };
    }
    const failures = (state.failures || 0) + 1;
    await ref.set({ projectId, memberId: auth.user.id, verified: false, failures, expiresAt: new Date(now + PIN_SESSION_MS).toISOString() });
    return failures >= MAX_PIN_ATTEMPTS
        ? { success: false, locked: true, error: 'Too many wrong PINs. Access is locked for this call.' }
        : { success: false, error: `Wrong PIN. ${MAX_PIN_ATTEMPTS - failures} attempt(s) left.` };
};

/** True when this call already passed verifyPin for this project and team member, and has not expired. */
VoiceAuth.prototype.isPinVerified = async function (callId, projectId, memberId) {
    if (!callId) return false;
    try {
        const snap = await callAuthRef(callId).get();
        if (!snap.exists) return false;
        const s = snap.data();
        return s.verified === true && s.projectId === projectId && s.memberId === memberId && Date.parse(s.expiresAt) > Date.now();
    } catch (e) {
        console.error('[VoiceAuth] PIN state read failed:', e.message);
        return false; // fail closed
    }
};

module.exports = new VoiceAuth();
