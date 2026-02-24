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
                const memberPhone = this.normalizePhone(member.voicePhone || member.phone);
                // Check exact match on digits
                const phoneMatch = normalizedInput.endsWith(memberPhone) || memberPhone.endsWith(normalizedInput);

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
                }
            };

        } catch (error) {
            console.error(`[VoiceAuth] CRITICAL ERROR during verification:`, error.message);
            // FAIL CLOSED: If there's an error (DB down, config error), block the call.
            return { authorized: false, reason: 'Security system error. Call blocked.' };
        }
    }
}

module.exports = new VoiceAuth();
