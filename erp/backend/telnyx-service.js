/**
 * Solutions Quasar Inc. - Telnyx SMS Service (API v2)
 * 
 * Manages programmable SMS messaging for US destinations and Telnyx webhooks.
 * - Dedicated USA SMS Dispatch via Houston (+1 832 743 6292)
 * - Inbound Webhook event processing for conversation threads & AI responses
 * - Automatic carrier & landline safety protection
 */

const axios = require('axios');
const { db, admin } = require('./firebase-admin');
const phoneValidatorService = require('./phone-validator-service');

const TELNYX_API_URL = 'https://api.telnyx.com/v2/messages';
const TELNYX_API_KEY = () => process.env.TELNYX_API_KEY;
const TELNYX_PHONE_NUMBER = () => process.env.TELNYX_PHONE_NUMBER || '+18327436292';

// Comprehensive list of Canadian Area Codes (NANP NPAs)
const CANADIAN_AREA_CODES = new Set([
    '204', '226', '236', '249', '250', '289', '306', '343', '365', '367', '368',
    '403', '416', '418', '428', '431', '437', '438', '450', '506', '514', '519',
    '548', '579', '581', '584', '587', '604', '613', '639', '647', '672', '683',
    '705', '709', '742', '753', '778', '780', '782', '807', '819', '825', '867',
    '873', '879', '902', '905'
]);

/**
 * Normalizes a phone number to standard E.164 (+1XXXXXXXXXX)
 */
function normalizePhone(rawPhone) {
    if (!rawPhone) return '';
    let cleaned = String(rawPhone).trim().replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) return cleaned;
    if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
    if (cleaned.length === 10) return `+1${cleaned}`;
    return `+${cleaned}`;
}

/**
 * Detects whether a phone number belongs to Canada or the United States
 */
function isCanadianDestination(phone, leadContext = {}) {
    // 1. Check explicit country context if available
    const country = String(leadContext.country || leadContext.country_code || '').trim().toUpperCase();
    if (country === 'CA' || country === 'CAN' || country === 'CANADA') return true;
    if (country === 'US' || country === 'USA' || country === 'UNITED STATES') return false;

    // 2. Check explicit province / state
    const region = String(leadContext.state || leadContext.province || '').trim().toUpperCase();
    const caProvinces = ['QC', 'QUEBEC', 'QUÉBEC', 'ON', 'ONTARIO', 'BC', 'BRITISH COLUMBIA', 'AB', 'ALBERTA', 'MB', 'MANITOBA', 'SK', 'SASKATCHEWAN', 'NB', 'NEW BRUNSWICK', 'NS', 'NOVA SCOTIA', 'PE', 'PEI', 'NL', 'NEWFOUNDLAND', 'YT', 'NT', 'NU'];
    if (caProvinces.includes(region)) return true;

    // 3. Fallback: Area code extraction from E.164 (+1XXXXXXXXXX)
    const norm = normalizePhone(phone);
    if (norm.startsWith('+1') && norm.length >= 5) {
        const areaCode = norm.slice(2, 5);
        if (CANADIAN_AREA_CODES.has(areaCode)) {
            return true;
        }
    }
    return false;
}

/**
 * Sends an SMS message using Telnyx API v2
 */
async function sendTelnyxSms({ to, message, from = null, allowLandline = false }) {
    const apiKey = TELNYX_API_KEY();
    const fromNumber = from || TELNYX_PHONE_NUMBER();

    if (!apiKey) {
        throw new Error("Telnyx API Key is not configured in environment (TELNYX_API_KEY).");
    }

    const formattedTo = normalizePhone(to);
    if (!formattedTo || formattedTo.length < 10) {
        throw new Error(`Invalid phone number: ${to}`);
    }
    if (!message || !message.trim()) {
        throw new Error("Cannot send empty SMS message.");
    }

    // Safety Carrier Check: Block landline numbers
    if (!allowLandline) {
        try {
            const validation = await phoneValidatorService.validatePhoneNumber(formattedTo);
            if (validation && validation.phone_type === 'landline') {
                const carrier = validation.carrier_name || 'Ligne fixe / Wireline';
                console.warn(`[Telnyx SMS] 🛑 Blocked SMS attempt to landline ${formattedTo} (${carrier})`);
                throw new Error(`Envoi SMS impossible : Le numéro ${formattedTo} est une ligne fixe (${carrier}). Les SMS ne sont pas supportés sur les lignes filaires.`);
            }
        } catch (valErr) {
            if (valErr.message && valErr.message.includes('ligne fixe')) {
                throw valErr;
            }
            console.warn('[Telnyx SMS] Phone validation check warning:', valErr.message);
        }
    }

    console.log(`[Telnyx SMS] 🇺🇸 Sending USA SMS via Telnyx API v2 from ${fromNumber} to ${formattedTo}...`);

    try {
        const resp = await axios.post(TELNYX_API_URL, {
            from: fromNumber,
            to: formattedTo,
            text: message.trim()
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 10000
        });

        const data = resp.data?.data;
        const messageId = data?.id || `telnyx_${Date.now()}`;
        const status = data?.to?.[0]?.status || 'queued';

        console.log(`[Telnyx SMS] 🎯 Sent successfully! Message ID: ${messageId} | Status: ${status}`);

        // Log to Firestore audit log
        try {
            await db.collection('sms_logs').add({
                provider: 'telnyx',
                messageSid: messageId,
                from: fromNumber,
                to: formattedTo,
                body: message.trim(),
                status: status,
                direction: 'outbound-api',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (logErr) {
            console.warn("[Telnyx SMS] Warning logging to Firestore:", logErr.message);
        }

        return {
            success: true,
            provider: 'telnyx',
            messageSid: messageId,
            sid: messageId,
            from: fromNumber,
            to: formattedTo,
            status: status
        };

    } catch (err) {
        const errorDetails = err.response?.data?.errors?.[0]?.detail || err.response?.data?.message || err.message;
        console.error('[Telnyx SMS Error]', errorDetails);
        throw new Error(`Telnyx SMS Error: ${errorDetails}`);
    }
}

module.exports = {
    normalizePhone,
    isCanadianDestination,
    sendTelnyxSms,
    TELNYX_PHONE_NUMBER,
    CANADIAN_AREA_CODES
};
