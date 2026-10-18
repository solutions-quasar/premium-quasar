/**
 * Solutions Quasar Inc. - Phone Validator & Carrier Intelligence Service
 * 
 * Uses Telnyx Number Lookup v2 API to classify phone numbers (Mobile, Landline, VoIP)
 * to guarantee 100% SMS deliverability, prevent telecom filtering (10DLC / Bell / Telus / Rogers),
 * and smartly route landlines to voice call / cold call workflows.
 * 
 * Caches results in Firestore ('phone_cache' collection and lead documents) to never query twice.
 */

const axios = require('axios');
const { db } = require('./firebase-admin');
const aiActivityService = require('./ai-activity-service');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY;

/**
 * Standardizes a phone number to E.164 format (+1XXXXXXXXXX)
 */
function formatE164(phone) {
    if (!phone || typeof phone !== 'string') return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    if (phone.trim().startsWith('+')) return phone.trim();
    return digits.length >= 10 ? `+${digits}` : null;
}

/**
 * Classifies a carrier payload into standardized line types: 'mobile' | 'landline' | 'voip' | 'toll_free'
 */
function classifyCarrier(carrier) {
    if (!carrier) return 'unknown';

    const type = (carrier.type || '').toLowerCase().trim();
    const name = (carrier.name || '').toLowerCase().trim();

    // 1. Definite Mobile Indicators (Wireless / Cellular)
    // Note: Do NOT match 'Bell & Virgin' as mobile because Bell wireline has normalized_carrier 'Bell & Virgin'
    if (
        type === 'mobile' ||
        name.includes('mobility') ||
        name.includes('wireless') ||
        name.includes('cellular') ||
        name.includes('fido') ||
        name.includes('freedom') ||
        name.includes('koodo') ||
        name.includes('virgin mobile') ||
        name.includes('chatr') ||
        name.includes('fizz') ||
        name.includes('public mobile') ||
        name.includes('lucky mobile') ||
        name.includes('sasktel mobility') ||
        name.includes('t-mobile') ||
        name.includes('verizon wireless') ||
        name.includes('at&t mobility')
    ) {
        return 'mobile';
    }

    // 2. VoIP
    if (type === 'voip') return 'voip';

    // 3. Toll Free
    if (type === 'toll free' || type === 'toll-free') return 'toll_free';

    // 4. Fixed Line / Wireline (Default for Bell Quebec, Bell Canada, Videotron wireline, Cogeco, etc.)
    if (type === 'fixed line' || type.includes('fixed')) {
        return 'landline';
    }

    // 5. Default wireline providers without 'mobility' tag
    if (
        name.includes('bell quebec') ||
        name.includes('bell canada') ||
        name.includes('iristel') ||
        name.includes('videotron') ||
        name.includes('cogeco') ||
        name.includes('eastlink') ||
        name.includes('telebec')
    ) {
        return 'landline';
    }

    return type || 'unknown';
}

/**
 * Validates and qualifies a phone number using Telnyx Number Lookup with Firestore caching.
 * @param {string} rawPhone 
 * @param {object} leadContext Optional lead object with id, business_name, etc.
 * @returns {Promise<{ phone: string, phone_type: string, carrier_name: string, sms_eligible: boolean, recommended_channel: string }>}
 */
async function validatePhoneNumber(rawPhone, leadContext = {}) {
    const e164 = formatE164(rawPhone);
    if (!e164) {
        return {
            phone: rawPhone,
            phone_type: 'invalid',
            carrier_name: null,
            sms_eligible: false,
            recommended_channel: 'email',
            error: 'Invalid phone format'
        };
    }

    // 1. Check in-memory / leadContext cache
    if (leadContext.phone_type && leadContext.phone_type !== 'unknown') {
        const smsEligible = leadContext.phone_type === 'mobile';
        return {
            phone: e164,
            phone_type: leadContext.phone_type,
            carrier_name: leadContext.carrier_name || null,
            sms_eligible: smsEligible,
            recommended_channel: smsEligible ? 'sms' : 'call',
            source: 'lead_context'
        };
    }

    // 2. Check Firestore 'phone_cache' collection (Never pay twice!)
    try {
        const cacheDoc = await db.collection('phone_cache').doc(e164).get();
        if (cacheDoc.exists) {
            const cached = cacheDoc.data();
            
            // Ensure lead document is synchronized even when result comes from cache
            if (leadContext.id) {
                const updatePayload = {
                    phone_type: cached.phone_type,
                    carrier_name: cached.carrier_name || null,
                    sms_eligible: cached.sms_eligible,
                    recommended_channel: cached.recommended_channel || (cached.sms_eligible ? 'sms' : 'call'),
                    phone_validated_at: cached.checked_at || new Date().toISOString()
                };
                try {
                    let leadRef = db.collection('crm_leads').doc(leadContext.id);
                    let leadSnap = await leadRef.get();
                    if (!leadSnap.exists) {
                        leadRef = db.collection('leads').doc(leadContext.id);
                    }
                    await leadRef.set(updatePayload, { merge: true });
                } catch (saveErr) {
                    console.warn('[PhoneValidator] Error updating lead from cache:', saveErr.message);
                }
            }

            return {
                ...cached,
                source: 'cache'
            };
        }
    } catch (cacheErr) {
        console.warn('[PhoneValidator] Cache lookup note:', cacheErr.message);
    }

    // 3. Query Telnyx Number Lookup v2 API
    if (!TELNYX_API_KEY) {
        console.warn('[PhoneValidator] TELNYX_API_KEY missing. Defaulting to unknown.');
        return {
            phone: e164,
            phone_type: 'unknown',
            carrier_name: null,
            sms_eligible: true, // Default allow if lookup unavailable
            recommended_channel: 'sms',
            source: 'fallback_no_key'
        };
    }

    try {
        console.log(`[PhoneValidator] Querying Telnyx Number Lookup for ${e164}...`);
        const resp = await axios.get(`https://api.telnyx.com/v2/number_lookup/${encodeURIComponent(e164)}?type=carrier`, {
            headers: {
                'Authorization': `Bearer ${TELNYX_API_KEY}`,
                'Accept': 'application/json'
            },
            timeout: 6000
        });

        const data = resp.data?.data;
        const carrier = data?.carrier;
        const phoneType = classifyCarrier(carrier);
        const smsEligible = phoneType === 'mobile'; // Strict: Only true mobile lines for SMS!
        const recommendedChannel = smsEligible ? 'sms' : 'call';

        const result = {
            phone: e164,
            national_format: data?.national_format || rawPhone,
            country_code: data?.country_code || 'CA',
            phone_type: phoneType,
            carrier_name: carrier?.name || null,
            normalized_carrier: carrier?.normalized_carrier || null,
            raw_type: carrier?.type || null,
            sms_eligible: smsEligible,
            recommended_channel: recommendedChannel,
            checked_at: new Date().toISOString(),
            source: 'telnyx_live'
        };

        // Cache into Firestore 'phone_cache'
        try {
            await db.collection('phone_cache').doc(e164).set(result, { merge: true });
        } catch (_) {}

        // If leadId is provided, update the lead document directly
        if (leadContext.id) {
            const updatePayload = {
                phone_type: result.phone_type,
                carrier_name: result.carrier_name,
                sms_eligible: result.sms_eligible,
                recommended_channel: result.recommended_channel,
                phone_validated_at: result.checked_at
            };

            try {
                let leadRef = db.collection('crm_leads').doc(leadContext.id);
                let leadSnap = await leadRef.get();
                if (!leadSnap.exists) {
                    leadRef = db.collection('leads').doc(leadContext.id);
                }
                await leadRef.set(updatePayload, { merge: true });
            } catch (_) {}
        }

        console.log(`[PhoneValidator] 🎯 ${e164} -> Type: ${result.phone_type.toUpperCase()} (${result.carrier_name}) | SMS Eligible: ${smsEligible}`);

        // Log to AI activity stream
        aiActivityService.log({
            category: 'system',
            type: 'phone_validated',
            level: smsEligible ? 'info' : 'warning',
            title: `Ligne ${result.phone_type === 'mobile' ? 'Mobile' : 'Fixe'} qualifiée (${result.carrier_name || 'Inconnu'})`,
            detail: `${e164} pour "${leadContext.business_name || 'Prospect'}": classé en ${result.phone_type}. Canal recommandé : ${recommendedChannel.toUpperCase()}.`,
            phone: e164
        });

        return result;

    } catch (err) {
        console.error('[PhoneValidator] Telnyx API error:', err.response?.status, err.response?.data || err.message);
        return {
            phone: e164,
            phone_type: 'unknown',
            carrier_name: null,
            sms_eligible: true, // Allow fallback
            recommended_channel: 'sms',
            error: err.message,
            source: 'error_fallback'
        };
    }
}

module.exports = {
    formatE164,
    classifyCarrier,
    validatePhoneNumber
};
