const twilio = require('twilio');
const OpenAI = require('openai');
const { db, admin } = require('./firebase-admin');
const phoneValidatorService = require('./phone-validator-service');
const telnyxService = require('./telnyx-service');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const apiKeySid = process.env.TWILIO_API_KEY_SID;
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER || '+18193002831';

let twilioClient = null;
if (accountSid && apiKeySid && apiKeySecret) {
    try {
        twilioClient = twilio(apiKeySid, apiKeySecret, { accountSid });
        console.log(`[Twilio] Client successfully initialized with Account SID: ${accountSid}`);
    } catch (err) {
        console.error('[Twilio Init Error]', err.message);
    }
} else {
    console.warn('[Twilio] Missing Twilio credentials in environment.');
}

/**
 * Normalizes phone numbers to standard E.164 (defaults to North American +1)
 */
function normalizePhone(rawPhone) {
    if (!rawPhone) return '';
    let cleaned = String(rawPhone).trim().replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
        return cleaned;
    }
    // If starts with 1 and is 11 digits
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
        return `+${cleaned}`;
    }
    // Standard 10 digit North American number (e.g., 8193002831)
    if (cleaned.length === 10) {
        return `+1${cleaned}`;
    }
    return `+${cleaned}`;
}

/**
 * Generates common punctuation and format variations of a phone number
 * to ensure bulletproof matching across Firestore collections regardless of user formatting.
 */
function getPhoneVariations(rawPhone) {
    if (!rawPhone) return [];
    const cleaned = String(rawPhone).trim();
    const digitsOnly = cleaned.replace(/\D/g, '');
    const tenDigits = (digitsOnly.length === 11 && digitsOnly.startsWith('1')) ? digitsOnly.slice(1) : digitsOnly.slice(-10);

    if (tenDigits.length !== 10) {
        return Array.from(new Set([rawPhone, cleaned])).filter(Boolean);
    }

    const d3 = tenDigits.slice(0, 3);
    const m3 = tenDigits.slice(3, 6);
    const l4 = tenDigits.slice(6);

    const set = new Set([
        `+1${tenDigits}`,
        `1${tenDigits}`,
        tenDigits,
        `${d3} ${m3} ${l4}`,
        `(${d3}) ${m3}-${l4}`,
        `(${d3}) ${m3} ${l4}`,
        `${d3}-${m3}-${l4}`,
        `+1 ${d3} ${m3} ${l4}`,
        `+1 (${d3}) ${m3}-${l4}`,
        cleaned
    ]);
    return Array.from(set).filter(Boolean).slice(0, 10);
}

/**
 * Human-readable timezone labels in French / English
 */
function getHumanTzName(tz, isEn = false) {
    if (!tz) return isEn ? 'Atlantic Time' : "heure de l'Atlantique";
    if (tz.includes('Moncton') || tz.includes('Halifax')) return isEn ? 'Atlantic Time' : "heure de l'Atlantique";
    if (tz.includes('Toronto') || tz.includes('Montreal')) return isEn ? 'Eastern Time (QC/ON)' : "heure du Québec";
    if (tz.includes('New_York')) return isEn ? 'Eastern Time' : "heure de l'Est";
    if (tz.includes('Chicago') || tz.includes('Winnipeg')) return isEn ? 'Central Time' : "heure du Centre";
    if (tz.includes('Denver') || tz.includes('Edmonton')) return isEn ? 'Mountain Time' : "heure des Rocheuses";
    if (tz.includes('Phoenix')) return isEn ? 'Arizona Time' : "heure de l'Arizona";
    if (tz.includes('Los_Angeles') || tz.includes('Vancouver')) return isEn ? 'Pacific Time' : "heure du Pacifique";
    if (tz.includes('St_Johns')) return isEn ? 'Newfoundland Time' : "heure de Terre-Neuve";
    return tz;
}

/**
 * Resolves next occurrence of a weekday and time in a specific timezone
 */
function resolveWeekdayTime(dayName, hour, min = 0, targetTimezone = 'America/Moncton') {
    const days = {
        'dimanche': 0, 'sunday': 0,
        'lundi': 1, 'monday': 1,
        'mardi': 2, 'tuesday': 2,
        'mercredi': 3, 'wednesday': 3,
        'jeudi': 4, 'thursday': 4,
        'vendredi': 5, 'friday': 5,
        'samedi': 6, 'saturday': 6
    };
    const targetDay = days[String(dayName).toLowerCase().trim()];
    if (targetDay === undefined) return null;
    const now = new Date();
    for (let i = 0; i <= 7; i++) {
        const candidate = new Date(now.getTime() + i * 24 * 3600 * 1000);
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: targetTimezone,
            weekday: 'short',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).formatToParts(candidate);
        const p = {};
        parts.forEach(x => p[x.type] = x.value);
        
        const dayStr = new Intl.DateTimeFormat('en-US', {
            timeZone: targetTimezone,
            weekday: 'short'
        }).format(candidate);
        const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };

        if (dayMap[dayStr] === targetDay) {
            // Compute real offset for targetTimezone
            const guess = new Date(Date.UTC(parseInt(p.year, 10), parseInt(p.month, 10) - 1, parseInt(p.day, 10), 12, 0));
            const tzStr = guess.toLocaleString('en-US', { timeZone: targetTimezone, timeZoneName: 'shortOffset' });
            const match = tzStr.match(/GMT([+-]\d+)/);
            const off = match ? parseInt(match[1], 10) : -4;
            const sign = off >= 0 ? '+' : '-';
            const offsetStr = `${sign}${String(Math.abs(off)).padStart(2, '0')}:00`;
            return `${p.year}-${p.month}-${p.day}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00${offsetStr}`;
        }
    }
    return null;
}

/**
 * Normalizes an appointment date/time string with timezone offset if missing
 */
function attachTimezoneOffset(isoOrDateStr, timezone = 'America/Moncton') {
    if (!isoOrDateStr) return isoOrDateStr;
    const str = String(isoOrDateStr).trim();
    if (/(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(str)) {
        return str;
    }
    const m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return str;
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const d = parseInt(m[3], 10);
    const h = parseInt(m[4] || '0', 10);
    const min = parseInt(m[5] || '0', 10);
    const sec = parseInt(m[6] || '0', 10);

    const guess = new Date(Date.UTC(y, mo - 1, d, 12, 0));
    const tzStr = guess.toLocaleString('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' });
    const match = tzStr.match(/GMT([+-]\d+)/);
    const off = match ? parseInt(match[1], 10) : -4;
    const sign = off >= 0 ? '+' : '-';
    const offsetStr = `${sign}${String(Math.abs(off)).padStart(2, '0')}:00`;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}${offsetStr}`;
}


/**
 * Smart Multi-Carrier SMS Dispatcher:
 * - 🇺🇸 USA Destinations: Routed via Telnyx API v2 (+1 832 743 6292 Houston, TX)
 * - 🇨🇦 Canada Destinations: Routed via Twilio (+1 819 300 2831 QC)
 */
async function sendSms({ to, message, allowLandline = false, forceProvider = null, leadContext = {} }) {
    const formattedTo = normalizePhone(to);
    if (!formattedTo || formattedTo.length < 10) {
        throw new Error(`Invalid phone number: ${to}`);
    }
    if (!message || !message.trim()) {
        throw new Error("Cannot send empty SMS message.");
    }

    // Safety Carrier Check: Block landline numbers from consuming SMS or triggering operator delivery failure
    if (!allowLandline) {
        try {
            const validation = await phoneValidatorService.validatePhoneNumber(formattedTo);
            if (validation && validation.phone_type === 'landline') {
                const carrier = validation.carrier_name || 'Ligne fixe / Bell / Wireline';
                console.warn(`[SMS Dispatcher] 🛑 Blocked SMS attempt to landline ${formattedTo} (${carrier})`);
                throw new Error(`Envoi SMS impossible : Le numéro ${formattedTo} est une ligne fixe (${carrier}). Les SMS ne sont pas supportés sur les lignes filaires. Privilégiez un appel téléphonique ou un courriel.`);
            }
        } catch (valErr) {
            if (valErr.message && valErr.message.includes('ligne fixe')) {
                throw valErr;
            }
            console.warn('[SMS Dispatcher] Phone validation check warning:', valErr.message);
        }
    }

    // Determine Destination: Canada vs USA
    const isCanada = telnyxService.isCanadianDestination(formattedTo, leadContext);
    const targetProvider = forceProvider || (isCanada ? 'twilio' : 'telnyx');

    // 1. ROUTE TO TELNYX (USA)
    if (targetProvider === 'telnyx') {
        console.log(`[SMS Dispatcher] 🇺🇸 Destination USA détectée (${formattedTo}). Routage automatique vers Telnyx (${telnyxService.TELNYX_PHONE_NUMBER()})...`);
        try {
            const telnyxRes = await telnyxService.sendTelnyxSms({
                to: formattedTo,
                message: message.trim(),
                allowLandline: true // already validated above
            });
            return telnyxRes;
        } catch (telnyxErr) {
            console.error(`[SMS Dispatcher] Telnyx send failed: ${telnyxErr.message}`);
            if (twilioClient) {
                console.warn(`[SMS Dispatcher] ⚠️ Retrying USA send via Twilio fallback...`);
            } else {
                throw telnyxErr;
            }
        }
    }

    // 2. ROUTE TO TWILIO (CANADA or USA Fallback)
    if (!twilioClient) {
        // If Twilio not configured, try Telnyx as fallback
        console.warn("[SMS Dispatcher] Twilio is not configured. Trying Telnyx as fallback...");
        return await telnyxService.sendTelnyxSms({
            to: formattedTo,
            message: message.trim(),
            allowLandline: true
        });
    }

    console.log(`[SMS Dispatcher] 🇨🇦 Destination Canada détectée (${formattedTo}). Routage automatique vers Twilio (${fromPhoneNumber})...`);

    const result = await twilioClient.messages.create({
        from: fromPhoneNumber,
        to: formattedTo,
        body: message.trim()
    });

    console.log(`[SMS Dispatcher] 🎯 Twilio Sent successfully! SID: ${result.sid}`);

    // Log to Firestore audit log
    try {
        await db.collection('sms_logs').add({
            provider: 'twilio',
            messageSid: result.sid,
            from: fromPhoneNumber,
            to: formattedTo,
            body: message.trim(),
            status: result.status,
            direction: 'outbound-api',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (logErr) {
        console.warn("[Twilio SMS] Warning logging to Firestore:", logErr.message);
    }

    return {
        success: true,
        provider: 'twilio',
        messageSid: result.sid,
        sid: result.sid,
        from: fromPhoneNumber,
        to: formattedTo,
        status: result.status
    };
}

/**
 * Detects whether a phone number likely belongs to a Quebec / Francophone region
 */
function isPhoneFrancophone(phone) {
    const clean = String(phone || '').replace(/[^\d]/g, '');
    if (clean.startsWith('33')) return true; // France (+33)
    if (clean.length >= 10) {
        const areaCode = clean.length === 11 && clean.startsWith('1')
            ? clean.slice(1, 4)
            : clean.slice(0, 3);
        const qcAreaCodes = ['418', '581', '367', '514', '438', '450', '579', '819', '873'];
        if (qcAreaCodes.includes(areaCode)) return true;
    }
    return false;
}

/**
 * Intelligent bilingual language detector (French vs English)
 * Analyzes keywords, common verbs/greetings, and previous messages
 */
function detectMessageLanguage(text, conversationHistory = [], defaultFallback = 'fr') {
    if (!text || typeof text !== 'string') {
        if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
            for (let i = conversationHistory.length - 1; i >= 0; i--) {
                const histMsg = conversationHistory[i]?.content;
                if (histMsg && typeof histMsg === 'string') {
                    const l = detectMessageLanguage(histMsg, [], null);
                    if (l) return l;
                }
            }
        }
        return defaultFallback || 'fr';
    }

    const clean = text.toLowerCase().trim();

    // English markers (regex word boundaries)
    const englishPatterns = [
        /\b(hello|hi|hey|good morning|good afternoon|good evening)\b/i,
        /\b(thanks|thank you|thx|cheers|appreciate)\b/i,
        /\b(please|pls)\b/i,
        /\b(how much|cost|pricing|price|rate|rates|quote|fee|fees)\b/i,
        /\b(what|who|where|when|why|which|how|whose|whom)\b/i,
        /\b(call me|give me a call|reach me|phone me|text me)\b/i,
        /\b(interested|sounds good|sounds great|looks good|let'?s do it|let'?s talk|count me in)\b/i,
        /\b(tomorrow|yesterday|today|tonight|next week|this week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
        /\b(appointment|schedule|meeting|booking|calendar|available|availability|slot|slots)\b/i,
        /\b(website|web site|online|business|company|service|services)\b/i,
        /\b(i am|i'm|i would|i'd|i have|i've|we are|we're|can you|could you|would you)\b/i,
        /\b(yes|yeah|yep|nope|sure|okay|ok|not interested|stop|unsubscribe)\b/i,
        /\b(do you|are you|is it|is this|will you|have you)\b/i,
        /\b(the|and|is|are|with|for|about|from|our|your|my)\b/i,
        /\b(english|speak english|in english|talk in english)\b/i,
        /\b(sorry|pardon|huh|excuse me)\b/i,
        /\b(can|could|would|will|do|does|did|have|has|want|need|help|assist|tell)\b/i
    ];

    // French markers (regex word boundaries)
    const frenchPatterns = [
        /\b(bonjour|salut|bonsoir|all[oôóò]|allo)\b/i,
        /\b(merci|merci beaucoup|remercie)\b/i,
        /\b(s'il vous pla[iî]t|svp|s'il te pla[iî]t)\b/i,
        /\b(combien|co[uû]te|co[uû]tent|prix|tarif|tarifs|co[uû]t|devis|facture)\b/i,
        /\b(c'est quoi|qui [eê]tes-vous|o[uù] [eê]tes-vous|qu'est-ce|comment faire|pourquoi|quoi|qui|quand|comment)\b/i,
        /\b(appelez-moi|rappelez-moi|joindre|t[eé]l[eé]phonez-moi|parler)\b/i,
        /\b(int[eé]ress[eé]|int[eé]ress[eé]e|d'accord|super|parfait|on peut se parler|bonne id[eé]e)\b/i,
        /\b(demain|aujourd'hui|ce soir|hier|semaine prochaine|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i,
        /\b(rendez-vous|rdv|rencontre|horaire|disponible|disponibilit[eé]|dispo|cr[eé]neau|cr[eé]neaux)\b/i,
        /\b(site web|site internet|entreprise|compagnie|service|services)\b/i,
        /\b(je suis|j'ai|je voudrais|j'aimerais|on est|nous sommes|pouvez-vous|pourriez-vous)\b/i,
        /\b(oui|ouais|non|pas int[eé]ress[eé]|arr[eê]t|fin)\b/i,
        /\b(est-ce que|avez-vous|[eê]tes-vous)\b/i,
        /\b(le|la|les|un|une|des|du|dans|pour|avec|sans|votre|notre)\b/i,
        /\b(francais|français|en francais|en français)\b/i
    ];

    let enScore = 0;
    let frScore = 0;

    for (const pat of englishPatterns) {
        if (pat.test(clean)) enScore++;
    }
    for (const pat of frenchPatterns) {
        if (pat.test(clean)) frScore++;
    }

    if (enScore > frScore) return 'en';
    if (frScore > enScore) return 'fr';

    // If tied or ambiguous (e.g., "ok", "yes", "2pm"), look at conversation history
    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        for (let i = conversationHistory.length - 1; i >= 0; i--) {
            const histMsg = conversationHistory[i]?.content;
            if (histMsg && typeof histMsg === 'string' && histMsg.trim() !== clean) {
                const histLang = detectMessageLanguage(histMsg, [], null);
                if (histLang) return histLang;
            }
        }
    }

    return defaultFallback || 'fr';
}

/**
 * Default System Prompt and Documentation for the SMS AI Agent (Bilingual FR / EN)
 */
const DEFAULT_SYSTEM_PROMPT = `Tu es l'assistant commercial IA bilingue de Solutions Quasar Inc. (agence d'automatisation IA, développement web et logiciels ERP à Deschambault, QC, Canada).
Tu discutes par SMS avec des prospects et clients francophones et anglophones en Amérique du Nord (Canada & USA).

RÈGLES STRICTES DE RÉPONSE SMS :
1. CONCIS : Ta réponse DOIT faire moins de 160 caractères (1 SMS standard, max 200) pour rester percutante.
2. Ton : Chaleureux, professionnel, courtois et très humain.
3. Objectif : Répondre à sa question avec précision en t'appuyant sur la documentation de l'entreprise, lever les objections ou proposer un court appel découverte de 10-15 minutes (ex: "Avez-vous 10 min mardi ou jeudi ?" / "Would Thursday at 2:00 PM AST work for a quick 10-min call?").
4. Langue OBLIGATOIRE : Tu es un assistant commercial 100% bilingue (français et anglais). Réponds TOUJOURS dans la même langue que le dernier message du prospect (100% français s'il écrit en français, 100% anglais s'il écrit en anglais). Ne mélange jamais les langues dans un même SMS. Si le prospect bascule en anglais ou te demande d'échanger en anglais, réponds-lui toujours en anglais. Ne dis JAMAIS que tu ne parles que français ou que tu ne peux pas répondre en anglais.
5. PRISE DE RENDEZ-VOUS EN DIRECT : Tu as l'autorisation TOTALE de planifier et confirmer les rendez-vous en direct par SMS avec tes outils. Ne dis JAMAIS que tu ne peux pas réserver par SMS ou qu'il faut envoyer un courriel. Utilise 'get_available_slots' pour proposer des créneaux libres et 'book_appointment' pour confirmer fermement.
6. Ne promets aucun prix définitif non documenté sans consultation préalable.`;

const DEFAULT_DOCUMENTATION = `# SOLUTIONS QUASAR INC. - OFFICIAL KNOWLEDGE BASE / BASE DE CONNAISSANCES

## English:
- Official Name: Solutions Quasar Inc.
- Location: Deschambault, QC, Canada (Serving Canada & USA)
- Email: info@solutionsquasar.ca
- Phone / SMS: +1 (819) 300-2831
- Core Services:
  1. High-Performance Websites & Mobile Apps: Modern design, ultra-fast loading, top-tier SEO, direct Google Maps & online booking sync.
  2. 24/7 AI Conversational Agents: Chatbots for SMS, Instagram, Web & Phone to capture and qualify leads 24/7.
  3. Quasar ERP & CRM: Complete operations software (invoicing, online Stripe quotes, pipeline management).
- Pricing Guidelines:
  - Maintenance & hosting packages: Starting from $350/month.
  - Custom development: Free personalized quote after a quick 15-minute discovery call.
- Scheduling Discovery Calls:
  - Propose a short 10-15 minute discovery phone call or Google Meet with Benjamin / technical team.
  - Availability: Monday to Friday, 9:00 AM to 5:00 PM Atlantic Time (AST).

## Français :
- Nom officiel : Solutions Quasar Inc.
- Localisation : Deschambault, QC, Canada
- Courriel : info@solutionsquasar.ca
- Téléphone SMS : +1 (819) 300-2831
- Spécialité : Création de sites web haute performance, intégration d'agents IA intelligents 24/7, développement d'ERP sur-mesure et automatisation de processus d'affaires.
- Services & Offres Clés :
  1. Sites Web & Applications Mobiles : Design moderne, vitesse optimale, référencement SEO de pointe, synchronisation Google Maps.
  2. Agents IA & Automatisation : Chatbots IA pour SMS, Instagram, Facebook et Web, répondeurs intelligents, qualification de leads 24/7.
  3. ERP & CRM Quasar : Gestion complète (facturation, devis en ligne avec paiement Stripe, suivi des leads, gestion de projets).
- Forfaits & Tarifs Indicatifs :
  - Forfaits d'entretien & hébergement récurrent : À partir de 350 $/mois.
  - Projets sur-mesure : Devis gratuit personnalisé après un appel de découverte de 15 minutes.
- Prise de Rendez-vous :
  - Proposer un court appel téléphonique de 10-15 minutes avec notre équipe technique.
  - Disponibilités habituelles : Du lundi au vendredi, entre 9h00 et 17h00 (heure de l'Atlantique).`;

const DEFAULT_OUTBOUND_PROMPT = `Tu es un expert d'élite en prospection commerciale B2B par SMS pour Solutions Quasar Inc. (conception web, agents IA et logiciels ERP à Deschambault, QC).
Ton rôle est de rédiger un UNIQUE premier SMS de prospection à froid/tiède, percutant, ultra-personnalisé et respectueux pour une entreprise ciblée.

RÈGLES STRICTES :
1. MAXIMUM 160 CARACTÈRES (1 SMS standard). Sois direct, naturel et percutant.
2. Identifie clairement l'expéditeur ("Solutions Quasar" ou "Ben de Solutions Quasar" / "Ben from Solutions Quasar").
3. Ton extrêmement humain, courtois et crédible (aucun mot creux de marketeur, aucun emoji abusif).
4. Termine par un appel à l'action léger et sans engagement (ex: "Avez-vous 5 min cette semaine pour en discuter ?" / "Would you be open for a quick 5-min chat this week?").
5. Inclus obligatoirement la mention de désabonnement en fin de message : [Rép. STOP pour cesser] (FR) ou [Reply STOP to opt out] (EN).
6. Respecte strictement la langue demandée (100% français ou 100% anglais).
7. Renvoie STRICTEMENT le texte brut du SMS, rien d'autre.`;

/**
 * Loads current SMS AI configuration from Firestore or falls back to defaults
 */
async function getSmsAiConfig() {
    try {
        const doc = await db.collection('settings').doc('sms_ai_config').get();
        if (doc.exists) {
            const data = doc.data() || {};
            return {
                systemPrompt: data.systemPrompt || DEFAULT_SYSTEM_PROMPT,
                outboundPrompt: data.outboundPrompt || DEFAULT_OUTBOUND_PROMPT,
                knowledgeDocumentation: data.knowledgeDocumentation || DEFAULT_DOCUMENTATION,
                model: data.model || 'gpt-4o-mini',
                temperature: data.temperature !== undefined ? parseFloat(data.temperature) : 0.7,
                typingSimulationEnabled: data.typingSimulationEnabled !== false,
                minTypingDelaySeconds: data.minTypingDelaySeconds !== undefined ? parseFloat(data.minTypingDelaySeconds) : 5,
                maxTypingDelaySeconds: data.maxTypingDelaySeconds !== undefined ? parseFloat(data.maxTypingDelaySeconds) : 11,
                updatedAt: data.updatedAt || null
            };
        }
    } catch (err) {
        console.warn("[Twilio SMS] Error fetching sms_ai_config from Firestore, using defaults:", err.message);
    }
    return {
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        outboundPrompt: DEFAULT_OUTBOUND_PROMPT,
        knowledgeDocumentation: DEFAULT_DOCUMENTATION,
        model: 'gpt-4o-mini',
        temperature: 0.7,
        typingSimulationEnabled: true,
        minTypingDelaySeconds: 5,
        maxTypingDelaySeconds: 11,
        updatedAt: null
    };
}

/**
 * Saves updated SMS AI configuration to Firestore
 */
async function saveSmsAiConfig(config) {
    const toSave = {
        systemPrompt: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
        outboundPrompt: config.outboundPrompt || DEFAULT_OUTBOUND_PROMPT,
        knowledgeDocumentation: config.knowledgeDocumentation || DEFAULT_DOCUMENTATION,
        model: config.model || 'gpt-4o-mini',
        temperature: config.temperature !== undefined ? parseFloat(config.temperature) : 0.7,
        typingSimulationEnabled: config.typingSimulationEnabled !== false,
        minTypingDelaySeconds: config.minTypingDelaySeconds !== undefined ? parseFloat(config.minTypingDelaySeconds) : 5,
        maxTypingDelaySeconds: config.maxTypingDelaySeconds !== undefined ? parseFloat(config.maxTypingDelaySeconds) : 11,
        updatedAt: new Date().toISOString()
    };
    await db.collection('settings').doc('sms_ai_config').set(toSave, { merge: true });
    return toSave;
}

/**
 * Calculates a natural human reading + typing delay for SMS responses
 * Models: reading time based on incoming text + typing speed on smartphone + random variance jitter
 */
function calculateHumanTypingDelay(replyText = '', incomingText = '', config = {}) {
    if (config.typingSimulationEnabled === false) return 0;

    const minSec = typeof config.minTypingDelaySeconds === 'number' ? config.minTypingDelaySeconds : 5;
    const maxSec = typeof config.maxTypingDelaySeconds === 'number' ? config.maxTypingDelaySeconds : 11;

    // 1. Reading time: ~1.2s base + 25ms per character of the incoming message (capped at 2.5s)
    const cleanIn = String(incomingText || '').trim();
    const readingTimeMs = Math.min(2500, 1200 + (cleanIn.length * 25));

    // 2. Typing speed: ~32ms per character on mobile keyboard (e.g. 100 chars = 3.2s)
    const cleanReply = String(replyText || '').trim();
    const typingTimeMs = cleanReply.length * 32;

    // 3. Human jitter variance: random value between -1200ms and +1600ms
    const varianceMs = (Math.random() * 2800) - 1200;

    // 4. Combined duration clamped strictly between min and max
    const rawTotalMs = readingTimeMs + typingTimeMs + varianceMs;
    const clampedMs = Math.max(minSec * 1000, Math.min(maxSec * 1000, rawTotalMs));

    // Slight micro-jitter (0 to 450ms) so duration is never an exact round millisecond
    const microJitter = Math.floor(Math.random() * 450);
    return Math.floor(clampedMs + microJitter);
}

/**
 * Generates an AI-crafted high-converting, compliant first-touch outreach SMS
 */
async function generateAiOutreachSms({ name, company, language = 'fr', angle = 'audit', customPrompt = '' }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OpenAI API key missing on server.");

    const config = await getSmsAiConfig();
    const openai = new OpenAI({ apiKey });
    const isFr = language !== 'en';

    const baseSystemPrompt = config.outboundPrompt || DEFAULT_OUTBOUND_PROMPT;
    const systemPrompt = `${baseSystemPrompt}

DOCUMENTATION & OFFRES QUASAR :
${config.knowledgeDocumentation || ''}`;

    const userPrompt = `Client Name: ${name || 'N/A'}
Company: ${company || 'N/A'}
Language: ${isFr ? 'Français' : 'English'}
Strategy Angle: ${angle} (Options: audit, general, website_upgrade, follow_up)
Additional Instructions / Custom Context: ${customPrompt || 'None'}`;

    const completion = await openai.chat.completions.create({
        model: config.model || "gpt-4o-mini",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: config.temperature || 0.7,
        max_tokens: 150
    });

    return completion.choices[0]?.message?.content?.trim() || '';
}

// Rate limiting & loop protection tracker (per phone)
const inboundRateLimitTracker = new Map();

/**
 * Checks if incoming text is an automated out-of-office or delivery failure auto-responder
 */
function isAutoResponderText(rawText) {
    if (!rawText || typeof rawText !== 'string') return false;
    const t = rawText.trim();
    const patterns = [
        /\b(out of (the )?office|automatic(ally)? (reply|response)|auto-?reply|autoreply)\b/i,
        /\b(absence du bureau|message automatique|réponse automatique|ne pas r[eé]pondre|do not reply)\b/i,
        /\b(delivery status notification|undeliverable|failure notice|mail delivery subsystem)\b/i,
        /\b(i am currently (away|out)|i will be (away|out)|je serai de retour|de retour le)\b/i,
        /\b(notification d'?état de distribution|échec de remise)\b/i
    ];
    return patterns.some(p => p.test(t));
}

/**
 * Checks for Cyrillic / Eastern European scripts to prevent bot spam
 */
function isCyrillicSpam(rawText) {
    if (!rawText || typeof rawText !== 'string') return false;
    return /[А-Яа-яЁё]/.test(rawText);
}

/**
 * Dynamic Rate Limiter & Cooldown for incoming SMS (Max 3 msgs in 2 min, Daily Cap of 12 AI replies)
 */
function checkInboundRateLimit(phone) {
    if (!phone) return { allowed: true };
    const now = Date.now();
    let record = inboundRateLimitTracker.get(phone);

    if (!record) {
        record = { timestamps: [], dailyCount: 0, dayStart: now };
        inboundRateLimitTracker.set(phone, record);
    }

    // Reset daily counter after 24h
    if (now - record.dayStart > 24 * 60 * 60 * 1000) {
        record.dailyCount = 0;
        record.dayStart = now;
    }

    // Daily Cap Check (max 12 automated AI replies per 24h)
    if (record.dailyCount >= 12) {
        return { allowed: false, dailyCapReached: true, reason: 'daily_cap', message: 'Daily limit of 12 AI messages reached' };
    }

    // Clean timestamps older than 2 minutes (120s)
    record.timestamps = record.timestamps.filter(t => now - t < 120 * 1000);

    // Flood Check (max 3 messages in 2 minutes)
    if (record.timestamps.length >= 3) {
        return { allowed: false, dailyCapReached: false, reason: 'flood_detected', message: 'Rate limit exceeded (>3 msgs in 2 min)' };
    }

    record.timestamps.push(now);
    return { allowed: true };
}

/**
 * Records an outgoing AI message for daily quota tracking
 */
function recordOutgoingAiMessage(phone) {
    if (!phone) return;
    const record = inboundRateLimitTracker.get(phone);
    if (record) {
        record.dailyCount = (record.dailyCount || 0) + 1;
    }
}

/**
 * Loop Breaker: Identifies simple polite closing acknowledgments after an appointment is already booked
 */
function isCourtesyAck(rawText, history = [], sessionData = {}) {
    if (!rawText) return false;
    const clean = rawText.trim().toLowerCase().replace(/[.!?,;:~]+$/, '').trim();
    const courtesyPatterns = [
        /^(merci|merci beaucoup|thanks|thank you|ok merci|parfait merci|super merci|parfait|d'accord|cool|c'est not[eé]|sounds good|great thanks|perfect|see you|a bientot|à bientôt|a jeudi|à jeudi|a demain|à demain)$/i,
        /^(bonne journ[eé]e|bonne fin de journ[eé]e|have a good day|have a great day|take care|bonne soir[eé]e)$/i
    ];
    const isAck = courtesyPatterns.some(p => p.test(clean));
    if (!isAck) return false;

    // Verify if last messages confirmed a meeting or scheduled a followup
    const lastAssistantMsg = [...history].reverse().find(m => m.role === 'assistant')?.content || '';
    const hadBookingOrConfirmation = 
        sessionData?.appointmentBooked ||
        lastAssistantMsg.includes('meet.google.com') ||
        /\b(confirm[eé]|r[eé]serv[eé]|confirmed|booked|not[eé] pour|rendez-vous)\b/i.test(lastAssistantMsg);

    return hadBookingOrConfirmation;
}

/**
 * Strict compliance opt-out check (TCPA, CTIA & CRTC).
 * Matches only exact standalone keywords or dedicated short phrases.
 * Prevents false positives on normal conversation words like "Finalement", "Finition", "Financer", etc.
 */
function isOptOutKeyword(rawText) {
    if (!rawText) return false;
    const clean = rawText.trim().toLowerCase().replace(/[.!?,;:]+$/, '').trim();

    // 1. Exact standalone single keywords
    const exactKeywords = [
        'stop', 'stopall', 'arret', 'arrêt', 'unsubscribe',
        'cancel', 'quit', 'end', 'fin', 'désabonner', 'desabonner'
    ];
    if (exactKeywords.includes(clean)) return true;

    // 2. Specific short opt-out phrases
    const politePhrases = [
        'stop svp', 'arret svp', 'arrêt svp', 'fin svp',
        'stop please', 'stop merci', 'stop thanks',
        'ne plus me contacter', 'retirez moi', 'retirez-moi',
        'pas interesse stop', 'pas intéressé stop',
        'arretez de me contacter', 'arrêtez de me contacter'
    ];
    if (politePhrases.includes(clean)) return true;

    // 3. Strict regex starting with keyword followed by at most a polite closing
    const strictRegex = /^(stop|stopall|arret|arr[eê]t|unsubscribe|cancel|quit|end|fin|d[eé]sabonner)\b(\s+(svp|merci|please|thanks))?[\.\!\?]?$/i;
    return strictRegex.test(clean);
}

/**
 * Opt-in / Resubscribe check (START, UNSTOP, RECOMMENCER, etc.)
 */
function isOptInKeyword(rawText) {
    if (!rawText) return false;
    const clean = rawText.trim().toLowerCase().replace(/[.!?,;:]+$/, '').trim();
    const optInKeywords = ['start', 'unstop', 'recommencer', 'reactiver', 'réactiver', 'subscribe', 'reprendre', 're-activer'];
    return optInKeywords.includes(clean);
}

/**
 * Handles incoming Twilio SMS Webhooks autonomously with AI conversation
 */
async function handleIncomingSms({ from, body, messageSid }) {
    const formattedFrom = normalizePhone(from);
    const text = (body || '').trim();

    console.log(`[Twilio Webhook] Incoming SMS from ${formattedFrom}: "${text}"`);

    // 1. Opt-out check (Compliance: CASL & TCPA)
    if (isOptOutKeyword(text)) {
        console.log(`[Twilio Webhook] Opt-out requested by ${formattedFrom}`);

        const phoneVars = getPhoneVariations(formattedFrom);

        // Update in crm_leads
        const leadsSnap = await db.collection('crm_leads').where('phone', 'in', phoneVars).get();
        leadsSnap.forEach(d => d.ref.update({ smsOptOut: true, doNotContact: true }));

        // Update in clients
        const clientsSnap = await db.collection('clients').where('phone', 'in', phoneVars).get();
        clientsSnap.forEach(d => d.ref.update({ smsOptOut: true, doNotContact: true }));

        // Update in Lead Hunter leads collection (both 'phone' and 'phone_number')
        const huntSnap = await db.collection('leads')
            .where('phone', 'in', phoneVars)
            .get();
        huntSnap.forEach(d => d.ref.update({ smsOptOut: true, doNotContact: true }));

        const huntSnapOld = await db.collection('leads')
            .where('phone_number', 'in', phoneVars)
            .get();
        huntSnapOld.forEach(d => d.ref.update({ smsOptOut: true, doNotContact: true }));

        const reply = "Solutions Quasar Inc. : Vous avez bien été désabonné(e) de nos messages SMS. / You have been successfully unsubscribed.";
        return reply;
    }

    // 1b. Opt-in check (Resubscribe: START / RECOMMENCER / etc.)
    if (isOptInKeyword(text)) {
        console.log(`[Twilio Webhook] Opt-in / Resubscribe requested by ${formattedFrom}`);
        const phoneVars = getPhoneVariations(formattedFrom);

        const leadsSnap = await db.collection('crm_leads').where('phone', 'in', phoneVars).get();
        leadsSnap.forEach(d => d.ref.update({ smsOptOut: false, doNotContact: false }));

        const clientsSnap = await db.collection('clients').where('phone', 'in', phoneVars).get();
        clientsSnap.forEach(d => d.ref.update({ smsOptOut: false, doNotContact: false }));

        const huntSnap = await db.collection('leads')
            .where('phone', 'in', phoneVars)
            .get();
        huntSnap.forEach(d => d.ref.update({ smsOptOut: false, doNotContact: false }));

        const reply = "Solutions Quasar Inc. : Vous avez bien été réabonné(e) à nos messages SMS. / You have been successfully resubscribed.";
        return reply;
    }

    // 1c. Security / Anti-Spam Filter: Cyrillic / Eastern European scripts
    if (isCyrillicSpam(text)) {
        console.warn(`[Twilio Webhook Anti-Spam] Cyrillic characters detected from ${formattedFrom}. Silently rejecting message.`);
        return null;
    }

    // 1d. Auto-Responder / Out-of-Office Bot Filter
    if (isAutoResponderText(text)) {
        console.log(`[Twilio Webhook Anti-Spam] Auto-responder detected from ${formattedFrom}: "${text}". Halting AI sequence without sending reply.`);
        return null;
    }

    // 1e. Inbound Rate Limiting & Cooldown Protection (Anti-Flood & Daily Cap)
    const rateCheck = checkInboundRateLimit(formattedFrom);
    if (!rateCheck.allowed) {
        if (rateCheck.dailyCapReached) {
            console.log(`[Twilio Webhook Anti-Spam] Daily cap reached for ${formattedFrom}. Transferring to human agent.`);
            const sessionId = `sms_${formattedFrom.replace('+', '')}`;
            await db.collection('conversations').doc(sessionId).set({ aiEnabled: false }, { merge: true });
            const isEnHandoff = isPhoneFrancophone(formattedFrom) ? false : true;
            return isEnHandoff
                ? "Thank you! To best assist you with detailed answers, I will have Benjamin connect with you directly."
                : "Merci ! Pour que nous puissions faire le point plus efficacement, je laisse Benjamin prendre le relais avec vous directement.";
        }
        console.warn(`[Twilio Webhook Anti-Spam] ${rateCheck.message} for ${formattedFrom}. Throttling response.`);
        return null;
    }

    // 2. Identify Lead / Client across crm_leads, clients, and leads (Lead Hunter)
    let clientName = '';
    let companyName = '';
    let preferredLang = null;
    let leadRef = null;
    let leadData = null;

    const leadPhoneVars = getPhoneVariations(formattedFrom);

    // Search in crm_leads
    const leadsSearch = await db.collection('crm_leads')
        .where('phone', 'in', leadPhoneVars)
        .limit(1)
        .get();

    if (!leadsSearch.empty) {
        const d = leadsSearch.docs[0];
        leadRef = d.ref;
        leadData = d.data();
        clientName = leadData.name || leadData.business_name || '';
        companyName = leadData.company || leadData.business_name || '';
        if (leadData.preferredLanguage) {
            preferredLang = String(leadData.preferredLanguage).toLowerCase().startsWith('en') ? 'en' : 'fr';
        }
    } else {
        // Search in clients
        const clientsSearch = await db.collection('clients')
            .where('phone', 'in', leadPhoneVars)
            .limit(1)
            .get();
        if (!clientsSearch.empty) {
            const d = clientsSearch.docs[0];
            leadRef = d.ref;
            leadData = d.data();
            clientName = leadData.name || '';
            companyName = leadData.company || '';
            if (leadData.preferredLanguage) {
                preferredLang = String(leadData.preferredLanguage).toLowerCase().startsWith('en') ? 'en' : 'fr';
            }
        } else {
            // Search in Lead Hunter 'leads' collection
            let matchedHuntingDoc = null;
            const huntSearch1 = await db.collection('leads')
                .where('phone_number', 'in', leadPhoneVars)
                .limit(1)
                .get();
            if (!huntSearch1.empty) matchedHuntingDoc = huntSearch1.docs[0];

            if (!matchedHuntingDoc) {
                const huntSearch2 = await db.collection('leads')
                    .where('phone', 'in', leadPhoneVars)
                    .limit(1)
                    .get();
                if (!huntSearch2.empty) matchedHuntingDoc = huntSearch2.docs[0];
            }

            if (matchedHuntingDoc) {
                leadRef = matchedHuntingDoc.ref;
                leadData = matchedHuntingDoc.data();
                clientName = leadData.name || leadData.business_name || leadData.company || '';
                companyName = leadData.company || leadData.business_name || leadData.name || '';
                if (leadData.preferredLanguage) {
                    preferredLang = String(leadData.preferredLanguage).toLowerCase().startsWith('en') ? 'en' : 'fr';
                } else if (leadData.country === 'US' || leadData.country === 'USA') {
                    preferredLang = 'en';
                }
            }
        }
    }

    // Default fallback language if not explicitly specified on lead
    if (!preferredLang) {
        preferredLang = isPhoneFrancophone(formattedFrom) ? 'fr' : 'en';
    }

    // 3. Load or initialize Conversation Session
    const sessionId = `sms_${formattedFrom.replace('+', '')}`;
    const sessionDocRef = db.collection('conversations').doc(sessionId);
    const sessionDoc = await sessionDocRef.get();

    let history = [];
    let aiEnabled = true;
    if (sessionDoc.exists) {
        const sessionData = sessionDoc.data() || {};
        history = (sessionData.messages || []).slice(-20);
        if (sessionData.aiEnabled !== undefined) {
            aiEnabled = sessionData.aiEnabled;
        }
        if (!clientName && sessionData.clientName) clientName = sessionData.clientName;
        if (!companyName && sessionData.companyName) companyName = sessionData.companyName;
    }

    // Append incoming user message
    history.push({
        role: "user",
        content: text,
        timestamp: new Date().toISOString()
    });

    // Mark stalled conversation as resolved/replied if active
    try {
        const stalledRecoveryService = require('./stalled-recovery-service');
        stalledRecoveryService.markConversationReplied(formattedFrom).catch(() => {});
    } catch (_) {}

    // 1f. Loop Breaker: Courtesy Acknowledgment after confirmed booking or followup
    if (isCourtesyAck(text, history, sessionDoc.exists ? sessionDoc.data() : {})) {
        console.log(`[Twilio Webhook Loop Breaker] Courtesy acknowledgment received from ${formattedFrom}: "${text}" after appointment/followup. Suppressing redundant reply.`);
        await sessionDocRef.set({
            sessionId,
            channel: 'sms',
            phoneNumber: formattedFrom,
            clientName: clientName || null,
            companyName: companyName || null,
            unread: false,
            updatedAt: new Date().toISOString(),
            messages: history
        }, { merge: true });
        return null;
    }

    // Language Detection: Detect dynamically from message text, conversation history, or preferredLang
    const activeLanguage = detectMessageLanguage(text, history, preferredLang);
    const isEn = activeLanguage === 'en';

    console.log(`[Twilio Webhook] Inbound SMS from ${formattedFrom} resolved language: "${activeLanguage}" (Lead default: "${preferredLang}")`);

    // Cancel any active automated sequence on reply & notify Admin via SMS
    try {
        const smsSequenceService = require('./sms-sequence-service');
        const curStatus = (leadData?.status || '').toUpperCase();
        const curSeqStatus = leadData?.sequenceStatus || '';
        const isAlreadyMeetingOrClient = curStatus === 'MEETING_SCHEDULED' || curStatus === 'CLIENT' || curSeqStatus === 'STOPPED_MEETING';

        await smsSequenceService.cancelSequenceOnReply({
            leadId: leadRef?.id,
            phone: formattedFrom,
            reason: isAlreadyMeetingOrClient ? 'STOPPED_MEETING' : 'STOPPED_REPLIED',
            status: isAlreadyMeetingOrClient ? leadData.status : 'INTERESTED'
        });
        await smsSequenceService.notifyAdminOnProspectAction({
            leadId: leadRef?.id,
            phoneNumber: formattedFrom,
            clientName,
            companyName,
            actionType: 'reply',
            text
        });
    } catch (seqErr) {
        console.warn("[Twilio Webhook] Sequence hook notice:", seqErr.message);
    }

    // Resolve prospect timezone with STRICT PRIORITY TO BUSINESS PHYSICAL LOCATION
    const smsSequenceService = require('./sms-sequence-service');
    const calendarReminderService = require('./calendar-reminder-service');
    const followupService = require('./followup-service');

    const tzDetails = smsSequenceService.resolveTimezoneDetails({
        phone: formattedFrom,
        city: leadData?.city,
        postalCode: leadData?.postal_code || leadData?.postalCode || leadData?.zip,
        address: leadData?.address || leadData?.formattedAddress,
        province: leadData?.province || leadData?.state,
        country: leadData?.country,
        timezone: leadData?.timezone || leadData?.businessTimezone
    });
    const prospectTimezone = tzDetails.timezone;
    const businessCity = tzDetails.city || leadData?.city || null;
    const businessState = tzDetails.state || leadData?.province || leadData?.state || null;
    const businessLocationStr = [businessCity, businessState].filter(Boolean).join(', ');

    // Check if AI is paused for this conversation (Human takeover mode)
    if (!aiEnabled) {
        console.log(`[Twilio Webhook] AI is DISABLED for ${sessionId}. Storing message for human agent takeover.`);
        await sessionDocRef.set({
            sessionId,
            channel: 'sms',
            phoneNumber: formattedFrom,
            clientName: clientName || null,
            companyName: companyName || null,
            businessCity: businessCity || null,
            businessState: businessState || null,
            businessAddress: leadData?.address || leadData?.formattedAddress || null,
            businessPostalCode: tzDetails.postalCode || leadData?.postal_code || null,
            businessTimezone: prospectTimezone,
            businessLocationStr: businessLocationStr || null,
            timezoneSource: tzDetails.source,
            timezoneDivergence: tzDetails.divergence || false,
            language: activeLanguage,
            aiEnabled: false,
            unread: true,
            updatedAt: new Date().toISOString(),
            messages: history
        }, { merge: true });

        if (leadRef) {
            try {
                await leadRef.update({
                    status: 'Replied',
                    lastSmsInteraction: new Date().toISOString(),
                    smsStatus: 'Replied'
                });
            } catch (_) {}
        }

        return null; // Suppresses auto-reply, sends empty TwiML
    }

    // 4. Generate AI response using OpenAI and live custom prompt + documentation
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OpenAI API key missing on server.");

    const config = await getSmsAiConfig();
    const openai = new OpenAI({ apiKey });

    const agencyTimezone = 'America/Moncton';
    const isDifferentTz = prospectTimezone && prospectTimezone !== agencyTimezone;
    const prospectTzName = getHumanTzName(prospectTimezone, isEn);
    const agencyTzName = getHumanTzName(agencyTimezone, isEn);
    const phoneTzName = tzDetails.phoneTimezone ? getHumanTzName(tzDetails.phoneTimezone, isEn) : null;

    const nowInAtlantic = new Date().toLocaleString(isEn ? 'en-US' : 'fr-CA', {
        timeZone: agencyTimezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const nowInProspect = new Date().toLocaleString(isEn ? 'en-US' : 'fr-CA', {
        timeZone: prospectTimezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Timezone divergence alert if mobile area code conflicts with business address
    const divergenceDirective = tzDetails.divergence
        ? (isEn
            ? `\n⚠️ CRITICAL TIMEZONE NOTE: The prospect's mobile phone number has an out-of-province area code (${phoneTzName}), but their physical business is located at ${businessLocationStr || 'their local area'} (${prospectTzName}). ALWAYS base meeting times strictly on their physical business location (${prospectTzName})!`
            : `\n⚠️ RÈGLE ABSOLUE FUSEAU HORAIRE COMMERCE : Le numéro cellulaire du prospect possède un indicatif d'une autre région (${phoneTzName}), mais SON COMMERCE EST PHYSIQUEMENT ÉTABLI À ${businessLocationStr || 'dans son secteur'} (${prospectTzName}).
Tu dois STRICTEMENT caler toutes les disponibilités, propositions et confirmations sur l'heure locale de son commerce physique (${prospectTzName}), et non sur l'origine géographique de son forfait cellulaire.
Lors de la confirmation : "C'est noté ! Parlez-vous bien de 11h selon l'heure de votre établissement ${businessLocationStr ? `à ${businessLocationStr} ` : ''}(${prospectTzName}) ?"`)
        : '';

    // Clear and strict language instructions tailored to the conversation
    const languageDirective = isEn
        ? `[CRITICAL: 100% ENGLISH RESPONSE MANDATORY]
The prospect is communicating in ENGLISH.
You MUST write your entire response strictly and 100% in natural, fluent, professional ENGLISH.
NEVER answer in French.
- Length: Strictly under 160 characters (max 200). Be concise, clear, and friendly.
- Objective: Answer clearly, address objections, or propose a quick 10-15 minute discovery call.
- Booking workflow: Always call 'get_available_slots' to propose 2 real open calendar slots with exact date and time. NEVER invent or guess days, dates or times without calling the tool.
- Timezone & Confirmation Rule:
  1. The prospect's business is located in ${businessLocationStr || prospectTzName} (${prospectTzName}, ${prospectTimezone}).
  2. ALWAYS propose times in their business timezone (${prospectTzName}) and mention the timezone.
  3. When the prospect accepts or mentions a time (e.g. "11 AM is good"), confirm their timezone if ambiguous: "Sounds great! Do you mean 11:00 AM ${prospectTzName} (12:00 PM Atlantic)?"
  4. Once confirmed, you MUST immediately call 'book_appointment'! NEVER say "Confirmed" without calling 'book_appointment'!
${divergenceDirective}`
        : `[DIRECTIVE DE LANGUE : FRANÇAIS ACTIF]
Le prospect communique en FRANÇAIS.
Tu dois rédiger ta réponse en français chaleureux, fluide et professionnel.
RÈGLE D'OR BILINGUISME : Tu représentes Solutions Quasar, une entreprise bilingue d'Amérique du Nord. Si le dernier message du prospect contient de l'anglais ou s'il bascule en anglais (ex: "What?", "Who is this?", "Do you speak English?"), bascule IMMÉDIATEMENT en anglais pour lui répondre en anglais avec courtoisie. Ne dis JAMAIS que tu ne parles que français ou que tu ne peux pas répondre en anglais !
- Longueur : Strictement moins de 160 caractères (max 200). Sois concis et courtois.
- Objectif : Répondre avec précision, lever les objections ou proposer un court appel découverte de 10-15 minutes.
- Démarche de réservation : Appelle TOUJOURS 'get_available_slots' pour proposer 2 vrais créneaux libres avec date et heure précises. N'invente JAMAIS de jour ni d'heure sans appeler l'outil.
- RÈGLE FUSEAU HORAIRE & CONFIRMATION DU COMMERCE :
  1. Le commerce du prospect est situé à ${businessLocationStr || prospectTzName} (${prospectTzName}, ${prospectTimezone}, heure locale actuelle: ${nowInProspect}).
  2. Propose TOUJOURS les créneaux dans l'heure locale de SON commerce (${prospectTzName}) en précisant le nom (ex: "10h00 ${prospectTzName}"). Tu peux aussi mentionner l'heure Atlantique entre parenthèses (ex: "10h00 ${prospectTzName} / 11h00 Atlantique").
  3. CONFIRMATION DU FUSEAU : Si le prospect dit simplement "Parfait pour 11h" ou "Ok à 14h" sans spécifier le fuseau, demande-lui confirmation en toute simplicité (ex: "C'est noté ! Parlez-vous bien de 11h00 ${prospectTzName} (soit 12h00 pour moi en Atlantique) ?").
  4. Dès que le créneau est validé ou clair, tu DOIS OBLIGATOIREMENT appeler l'outil book_appointment ! INTERDICTION STRICTE d'écrire "C'est confirmé" sans exécuter book_appointment !
${divergenceDirective}`;

    // Ensure documentation includes bilingual reference
    let knowledgeDoc = config.knowledgeDocumentation || DEFAULT_DOCUMENTATION;
    if (isEn && !knowledgeDoc.includes('## English:')) {
        knowledgeDoc = `${DEFAULT_DOCUMENTATION}\n\n${knowledgeDoc}`;
    }

    const systemPromptWithContext = `${config.systemPrompt}

${languageDirective}

[INFORMATIONS CONTEXTUELLES DU PROSPECT / PROSPECT CONTEXT]
- Nom / Name: ${clientName || (isEn ? 'Prospect' : 'Inconnu')}
- Entreprise / Company: ${companyName || (isEn ? 'Company' : 'Inconnue')}
- Téléphone / Phone: ${formattedFrom}${tzDetails.phoneTimezone && tzDetails.phoneTimezone !== prospectTimezone ? ` (Indicatif portable: ${phoneTzName})` : ''}
- Emplacement physique de l'entreprise: ${businessLocationStr || 'Non spécifié'}
- Fuseau horaire officiel du commerce: ${prospectTzName} (${prospectTimezone}) [Source: ${tzDetails.source}]
- Langue active détectée / Active Language: ${isEn ? 'ENGLISH (Respond 100% in English)' : 'FRANÇAIS (Réponds 100% en Français)'}

[FUSEAUX HORAIRES ET HEURE LOCALE / TIME ZONE CONTEXT]
- Fuseau horaire agence (Solutions Quasar): Heure de l'Atlantique (${agencyTzName}, ${agencyTimezone}). Heure actuelle: ${nowInAtlantic}.
- Fuseau horaire commerce prospect: ${prospectTzName} (${prospectTimezone}). Heure locale actuelle: ${nowInProspect}.
${isDifferentTz ? `ATTENTION DÉCALAGE : Le prospect est dans un fuseau horaire différent (${prospectTzName}). Raisonne et formule toujours les horaires dans le fuseau horaire local de son commerce (${prospectTzName}) et confirme son fuseau en cas d'ambiguïté.` : `- Agence et prospect partagent le même fuseau horaire.`}

[DOCUMENTATION ET BASE DE CONNAISSANCES OFFICIELLE / KNOWLEDGE BASE]
${knowledgeDoc}

[ACCÈS DIRECT AUX OUTILS & SUIVIS / TOOLS]
Tu as 5 outils (tools) à ta disposition :
1. 'get_available_slots' : vérifie les créneaux libres en temps réel dans Google Calendar pour un appel découverte (15-30 min). Tu DOIS l'utiliser pour proposer des créneaux réels avec la date précise. N'invente JAMAIS de créneaux fictifs.
2. 'book_appointment' : OBLIGATOIRE ! Réserve fermement un nouveau rendez-vous dans Google Calendar avec Google Meet dès que le prospect accepte ou valide un horaire.
   ⚠️ RÈGLE DE SÉCURITÉ TEMPORELLE ABSOLUE :
   - L'heure 'appointmentTime' DOIT être STRICTEMENT DANS LE FUTUR avec au minimum 2 heures de préavis par rapport à l'heure actuelle (${nowInProspect}).
   - IL EST STRICTEMENT INTERDIT de réserver dans le passé.
   - Cohérence jour de la semaine et date : Si aujourd'hui est ${nowInProspect}, assure-toi que la date calendaire correspond exactement au jour demandé (si on est mardi 20 oct et que le prospect demande jeudi, la date est le 22 oct, JAMAIS le 20 oct !).
   - N'écris JAMAIS de confirmation de rendez-vous sans exécuter 'book_appointment' avec succès !
3. 'reschedule_appointment' : OBLIGATOIRE POUR REPROGRAMMER / DÉCALER ! Si le prospect demande de reporter, décaler, changer l'heure ou repousser son rendez-vous (ex: "Can I reschedule?", "Pouvez-vous reporter mon rdv ?", "Décalons à vendredi 14h"), appelle cet outil pour décaler son rendez-vous dans Google Calendar et reprogrammer les rappels SMS ! Propose des créneaux avec 'get_available_slots' si nécessaire.
4. 'cancel_appointment' : ANNULE UN RENDEZ-VOUS si le prospect demande expressément d'annuler sa rencontre (ex: "Annulez mon appel", "Je ne pourrai pas venir").
5. 'schedule_followup' : PROGRAMME UNE RELANCE 100% AUTONOME si le prospect dit qu'il n'est pas disponible maintenant mais plus tard sans date précise de rendez-vous (ex: "rappelez-moi dans 2 semaines", "je suis en vacances", "recontactez-moi en novembre / le mois prochain / au printemps", "pas le temps cette semaine, relancez-moi plus tard"). Appelle cet outil dès qu'un report est demandé, puis confirme chaleureusement dans ton SMS que c'est bien noté et que tu lui réécriras à ce moment-là !

RÈGLES IMPORTANTES SMS :
- Sois très concis (1 SMS court, idéalement moins de 160 caractères, max 200).
- Humain, direct, chaleureux, professionnel. Pas d'emojis excessifs.
- RÉPONDS STRICTEMENT DANS LA LANGUE DU PROSPECT (${isEn ? 'ENGLISH' : 'FRANÇAIS'}).`;

    const tools = [
        {
            type: "function",
            function: {
                name: "get_available_slots",
                description: "Vérifie les créneaux libres en temps réel dans le Google Calendar de Solutions Quasar pour un court appel de découverte (15-45 min). / Checks real-time open calendar slots.",
                parameters: {
                    type: "object",
                    properties: {
                        daysAhead: { type: "integer", description: "Nombre de jours à vérifier / Number of days ahead (default 5)" }
                    }
                }
            }
        },
        {
            type: "function",
            function: {
                name: "book_appointment",
                description: "OBLIGATOIRE ! Réserve fermement le rendez-vous dans Google Calendar et l'ERP lorsque le prospect accepte un horaire futur. STRICTEMENT DANS LE FUTUR (min 2h d'avance). / Firmly books future discovery meeting in Google Calendar (must be strictly in the future with at least 2h notice).",
                parameters: {
                    type: "object",
                    properties: {
                        appointmentTime: { type: "string", description: "Date et heure exacte FUTURE du rendez-vous au format ISO (ex: 2026-10-22T14:00:00-04:00). STRICTEMENT DANS LE FUTUR avec min 2h d'avance." },
                        topic: { type: "string", description: "Sujet ou service abordé (ex: Audit IA, Refonte site web, Démo ERP / AI Audit, Web Design, ERP Demo)" },
                        prospectEmail: { type: "string", description: "Email du prospect s'il a été communiqué" }
                    },
                    required: ["appointmentTime"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "reschedule_appointment",
                description: "Reprogramme ou décale un rendez-vous existant vers une nouvelle date/heure future. Met à jour Google Calendar, l'ERP et les rappels SMS. / Reschedules an existing appointment to a new future date and time.",
                parameters: {
                    type: "object",
                    properties: {
                        newAppointmentTime: { 
                            type: "string", 
                            description: "Nouvelle date et heure FUTURE exacte du rendez-vous au format ISO (ex: 2026-10-23T15:00:00-04:00). Min 2h d'avance. / Exact new future appointment time in ISO format." 
                        },
                        reason: { 
                            type: "string", 
                            description: "Motif du report ou notes contextuelles / Reason for reschedule" 
                        }
                    },
                    required: ["newAppointmentTime"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "cancel_appointment",
                description: "Annule fermement un rendez-vous existant à la demande du prospect et désactive les rappels SMS associés. / Cancels an existing appointment at the prospect's request.",
                parameters: {
                    type: "object",
                    properties: {
                        reason: { type: "string", description: "Raison de l'annulation (ex: 'Imprévu du prospect') / Reason for cancellation" }
                    }
                }
            }
        },
        {
            type: "function",
            function: {
                name: "schedule_followup",
                description: "Programme une relance ou suivi automatique à long terme (100% autonome) pour ce prospect à une date ultérieure s'il n'est pas disponible immédiatement (ex: vacances, report au mois prochain, fin de trimestre, recontactez-moi plus tard). / Schedules an autonomous long-term follow-up SMS.",
                parameters: {
                    type: "object",
                    properties: {
                        delayDays: { 
                            type: "integer", 
                            description: "Délai en jours avant la relance (ex: 7 pour 1 sem., 14 pour 2 sem., 30 pour 1 mois, 60 pour 2 mois, 90 pour 3 mois) / Delay in days" 
                        },
                        targetDate: { 
                            type: "string", 
                            description: "Date cible exacte ou approximative si mentionnée (format ISO ou YYYY-MM-DD, ex: 2026-11-15) / Target date" 
                        },
                        reason: { 
                            type: "string", 
                            description: "Motif précis du report / suivi (ex: 'Prospect en vacances jusqu'au 12 nov.', 'Budget à revoir début décembre', 'Rappelez-moi mardi prochain') / Reason for follow-up" 
                        },
                        contextNote: { 
                            type: "string", 
                            description: "Notes contextuelles utiles pour la future relance (ex: 'Intéressé par la refonte web et l'agent IA, comparer avec son prestataire actuel') / Contextual notes for the follow-up" 
                        }
                    },
                    required: ["reason"]
                }
            }
        }
    ];

    let messagesForOpenAI = [
        { role: "system", content: systemPromptWithContext },
        ...history.map(m => ({ role: m.role, content: m.content }))
    ];

    let completion = await openai.chat.completions.create({
        model: config.model || "gpt-4o-mini",
        messages: messagesForOpenAI,
        tools: tools,
        tool_choice: "auto",
        temperature: config.temperature !== undefined ? config.temperature : 0.7,
        max_tokens: 200
    });

    let choice = completion.choices[0];
    let toolCalls = choice?.message?.tool_calls;
    let appointmentBooked = false;

    // Handle tool execution loop (up to 2 tool calls sequentially)
    let maxLoops = 2;
    while (toolCalls && toolCalls.length > 0 && maxLoops > 0) {
        maxLoops--;
        messagesForOpenAI.push(choice.message);

        for (const tc of toolCalls) {
            const fnName = tc.function.name;
            let fnArgs = {};
            try { fnArgs = JSON.parse(tc.function.arguments || '{}'); } catch (_) {}

            console.log(`[Twilio SMS AI Tool] Calling ${fnName} with args:`, fnArgs);

            let toolOutput = {};
            if (fnName === 'get_available_slots') {
                const slots = await calendarReminderService.getAvailableSlots(fnArgs.daysAhead || 5, prospectTimezone);
                toolOutput = {
                    success: true,
                    prospectTimezone,
                    prospectTimezoneName: prospectTzName,
                    available_slots: slots.slice(0, 4)
                };
            } else if (fnName === 'book_appointment') {
                try {
                    const normalizedTime = attachTimezoneOffset(fnArgs.appointmentTime, prospectTimezone);
                    const bookRes = await calendarReminderService.scheduleAppointment({
                        leadId: leadRef?.id || null,
                        prospectName: clientName || (isEn ? 'SMS Client' : 'Client SMS'),
                        prospectPhone: formattedFrom,
                        prospectEmail: fnArgs.prospectEmail || '',
                        prospectTimezone: prospectTimezone,
                        businessLocation: businessLocationStr,
                        appointmentTime: normalizedTime,
                        notes: isEn 
                            ? `Booked by SMS AI. Topic: ${fnArgs.topic || 'Quasar Discovery Call'} [${businessLocationStr ? `${businessLocationStr} - ` : ''}${prospectTzName}]`
                            : `Réservé par l'IA SMS. Sujet: ${fnArgs.topic || 'Découverte Quasar'} [${businessLocationStr ? `${businessLocationStr} - ` : ''}${prospectTzName}]`
                    });
                    if (bookRes.success !== false) {
                        appointmentBooked = true;
                        try {
                            const stalledRecoveryService = require('./stalled-recovery-service');
                            stalledRecoveryService.markConversationBooked(formattedFrom).catch(() => {});
                        } catch (_) {}
                    }
                    toolOutput = {
                        success: true,
                        confirmedTime: normalizedTime,
                        prospectTimezone: prospectTzName,
                        businessLocation: businessLocationStr || undefined,
                        meetLink: bookRes.appointment?.meetLink || 'https://meet.google.com/qsr-auto-meet'
                    };
                } catch (bErr) {
                    toolOutput = { success: false, error: bErr.message };
                }
            } else if (fnName === 'reschedule_appointment') {
                try {
                    const normalizedTime = attachTimezoneOffset(fnArgs.newAppointmentTime, prospectTimezone);
                    const activeAppt = await calendarReminderService.findActiveAppointment(formattedFrom, leadRef?.id);

                    if (activeAppt) {
                        await calendarReminderService.rescheduleAppointment(activeAppt.id, normalizedTime, {
                            notes: `${activeAppt.notes || ''} | Reporté par SMS: ${fnArgs.reason || 'Demande client'}`
                        });
                        appointmentBooked = true;
                        try {
                            const stalledRecoveryService = require('./stalled-recovery-service');
                            stalledRecoveryService.markConversationBooked(formattedFrom).catch(() => {});
                        } catch (_) {}
                        try {
                            await smsSequenceService.notifyAdminOnProspectAction({
                                leadId: activeAppt.id,
                                phoneNumber: formattedFrom,
                                clientName: clientName || activeAppt.prospectName,
                                companyName: companyName || activeAppt.prospectPhone,
                                actionType: 'reschedule',
                                text: `🔄 RDV REPROGRAMMÉ au ${new Date(normalizedTime).toLocaleString('fr-CA', { timeZone: prospectTimezone })} (${prospectTzName})`
                            });
                        } catch (_) {}
                        toolOutput = {
                            success: true,
                            rescheduled: true,
                            appointmentId: activeAppt.id,
                            confirmedTime: normalizedTime,
                            prospectTimezone: prospectTzName,
                            meetLink: activeAppt.meetLink || 'https://meet.google.com/qsr-auto-meet',
                            message: "Appointment successfully rescheduled in Google Calendar and ERP."
                        };
                    } else {
                        // Fallback: if no existing appointment was found, book as new
                        const bookRes = await calendarReminderService.scheduleAppointment({
                            leadId: leadRef?.id || null,
                            prospectName: clientName || (isEn ? 'SMS Client' : 'Client SMS'),
                            prospectPhone: formattedFrom,
                            prospectEmail: '',
                            prospectTimezone: prospectTimezone,
                            businessLocation: businessLocationStr,
                            appointmentTime: normalizedTime,
                            notes: `Rescheduled/Booked by SMS AI: ${fnArgs.reason || 'Demande client'}`
                        });
                        appointmentBooked = true;
                        toolOutput = {
                            success: true,
                            bookedNew: true,
                            confirmedTime: normalizedTime,
                            prospectTimezone: prospectTzName,
                            meetLink: bookRes.appointment?.meetLink || 'https://meet.google.com/qsr-auto-meet',
                            message: "New appointment booked successfully."
                        };
                    }
                } catch (rErr) {
                    toolOutput = { success: false, error: rErr.message };
                }
            } else if (fnName === 'cancel_appointment') {
                try {
                    const activeAppt = await calendarReminderService.findActiveAppointment(formattedFrom, leadRef?.id);
                    if (activeAppt) {
                        await calendarReminderService.cancelAppointment(activeAppt.id, fnArgs.reason || 'cancelled_by_sms_request');
                        try {
                            await smsSequenceService.notifyAdminOnProspectAction({
                                leadId: activeAppt.id,
                                phoneNumber: formattedFrom,
                                clientName: clientName || activeAppt.prospectName,
                                companyName: companyName || activeAppt.prospectPhone,
                                actionType: 'cancellation',
                                text: `❌ RDV ANNULÉ par le prospect via SMS (Motif: ${fnArgs.reason || 'Non précisé'})`
                            });
                        } catch (_) {}
                        toolOutput = {
                            success: true,
                            cancelled: true,
                            appointmentId: activeAppt.id,
                            message: "Appointment successfully cancelled and reminders cleared."
                        };
                    } else {
                        toolOutput = {
                            success: true,
                            message: "No active appointment found to cancel."
                        };
                    }
                } catch (cErr) {
                    toolOutput = { success: false, error: cErr.message };
                }
            } else if (fnName === 'schedule_followup') {
                try {
                    const fuRes = await followupService.scheduleFollowup({
                        leadId: leadRef?.id || null,
                        phoneNumber: formattedFrom,
                        clientName: clientName || '',
                        companyName: companyName || '',
                        delayDays: fnArgs.delayDays,
                        targetDate: fnArgs.targetDate,
                        reason: fnArgs.reason,
                        contextNote: fnArgs.contextNote,
                        language: isEn ? 'en' : 'fr',
                        createdBy: 'ai_agent'
                    });
                    toolOutput = {
                        success: true,
                        scheduledFor: fuRes.scheduledForDisplay,
                        reason: fuRes.reason,
                        note: "Follow-up successfully scheduled. Warmly confirm to the prospect that it is noted."
                    };
                } catch (fuErr) {
                    console.error("[Twilio SMS AI Tool] Error in schedule_followup:", fuErr.message);
                    toolOutput = { success: false, error: fuErr.message };
                }
            }

            messagesForOpenAI.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify(toolOutput)
            });
        }

        completion = await openai.chat.completions.create({
            model: config.model || "gpt-4o-mini",
            messages: messagesForOpenAI,
            temperature: config.temperature !== undefined ? config.temperature : 0.7,
            max_tokens: 160
        });

        choice = completion.choices[0];
        toolCalls = choice?.message?.tool_calls;
    }

    const aiReply = choice?.message?.content?.trim() || (isEn 
        ? "Thank you! Our team will get back to you shortly." 
        : "Merci ! Notre équipe vous répondra dans les plus brefs délais.");

    // Safety Net: Auto-heal if AI produced a confirmation text without calling book_appointment tool
    if (!appointmentBooked) {
        const confirmMatch = aiReply.match(/(?:c'est\s+confirm[eé]|confirm[eé]\s+pour|rendez-vous\s+confirm[eé]|not[eé]\s+pour|confirmed\s+for)\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday)\s+(?:à|at)?\s*(\d{1,2})(?:h|:)?(\d{2})?/i);
        if (confirmMatch) {
            const dayName = confirmMatch[1];
            const hour = parseInt(confirmMatch[2], 10);
            const minute = parseInt(confirmMatch[3] || '0', 10);
            const resolvedIso = resolveWeekdayTime(dayName, hour, minute, prospectTimezone);
            if (resolvedIso) {
                console.log(`[Twilio SMS AI Safety Net] AI generated confirmation text without executing tool. Auto-booking now for ${resolvedIso} (${prospectTimezone})...`);
                try {
                    await calendarReminderService.scheduleAppointment({
                        leadId: leadRef?.id || null,
                        prospectName: clientName || (isEn ? 'SMS Client' : 'Client SMS'),
                        prospectPhone: formattedFrom,
                        prospectEmail: '',
                        prospectTimezone: prospectTimezone,
                        businessLocation: businessLocationStr,
                        appointmentTime: resolvedIso,
                        notes: isEn 
                            ? `Auto-synced by Quasar Safety Net. Topic: Discovery Call [${businessLocationStr ? `${businessLocationStr} - ` : ''}${prospectTzName}]`
                            : `Auto-synchronisé par le filet de sécurité Quasar. Sujet: Appel découverte [${businessLocationStr ? `${businessLocationStr} - ` : ''}${prospectTzName}]`
                    });
                    appointmentBooked = true;
                } catch (bErr) {
                    console.error("[Twilio SMS AI Safety Net] Error auto-booking appointment:", bErr.message);
                }
            }
        }
    }

    // Append assistant reply to history
    history.push({
        role: "assistant",
        author: "ai",
        content: aiReply,
        timestamp: new Date().toISOString()
    });

    // Save session in Firestore
    await sessionDocRef.set({
        sessionId,
        channel: 'sms',
        phoneNumber: formattedFrom,
        clientName: clientName || null,
        companyName: companyName || null,
        businessCity: businessCity || null,
        businessState: businessState || null,
        businessAddress: leadData?.address || leadData?.formattedAddress || null,
        businessPostalCode: tzDetails.postalCode || leadData?.postal_code || null,
        businessTimezone: prospectTimezone,
        businessLocationStr: businessLocationStr || null,
        timezoneSource: tzDetails.source,
        timezoneDivergence: tzDetails.divergence || false,
        language: activeLanguage,
        aiEnabled: true,
        stalledState: appointmentBooked ? 'RESOLVED_BOOKED' : 'WAITING_REPLY',
        lastAssistantReplyAt: new Date().toISOString(),
        unread: false,
        updatedAt: new Date().toISOString(),
        messages: history
    }, { merge: true });

    // Update lead status if matched
    if (leadRef) {
        try {
            await leadRef.update({
                lastSmsInteraction: new Date().toISOString(),
                smsStatus: 'Replied'
            });
        } catch (_) {}
    }

    // --- NATURAL HUMAN TYPING SIMULATION TIMER ---
    // Simulates reading time + typing speed on smartphone + slight random variance
    const delayMs = calculateHumanTypingDelay(aiReply, text, config);
    if (delayMs > 0) {
        console.log(`[Twilio SMS AI] ⏳ Simulating natural human typing delay: ${(delayMs / 1000).toFixed(1)}s (${delayMs}ms) for ${formattedFrom}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    recordOutgoingAiMessage(formattedFrom);
    return aiReply;
}

/**
 * Generates a suggested response for human agent to review/edit before sending (Bilingual)
 */
async function suggestReply({ conversationId, customPrompt = '' }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OpenAI API key missing on server.");

    const sessionDocRef = db.collection('conversations').doc(conversationId);
    const sessionDoc = await sessionDocRef.get();
    if (!sessionDoc.exists) throw new Error("Conversation introuvable.");

    const sessionData = sessionDoc.data() || {};
    const history = (sessionData.messages || []).slice(-10);
    const config = await getSmsAiConfig();
    const openai = new OpenAI({ apiKey });

    // Detect language of the conversation
    const lastUserMsg = [...history].reverse().find(m => m.role === 'user')?.content || '';
    const fallbackLang = sessionData.language || (isPhoneFrancophone(sessionData.phoneNumber) ? 'fr' : 'en');
    const detectedLang = detectMessageLanguage(lastUserMsg, history, fallbackLang);
    const isEn = detectedLang === 'en';

    let knowledgeDoc = config.knowledgeDocumentation || DEFAULT_DOCUMENTATION;
    if (isEn && !knowledgeDoc.includes('## English:')) {
        knowledgeDoc = `${DEFAULT_DOCUMENTATION}\n\n${knowledgeDoc}`;
    }

    const missionDirective = isEn
        ? `MISSION: SUGGEST AN SMS REPLY IN ENGLISH
Target Language: ENGLISH (100%).
Draft a polite, natural, high-converting SMS reply in fluent English that the human agent can review or send immediately.
RULES:
1. Under 160 characters if possible (max 200).
2. Direct, polite, professional, human.
3. No quotation marks around the text.
4. Output STRICTLY the SMS body in fluent ENGLISH.
${customPrompt ? `Agent custom instruction: ${customPrompt}` : ''}`
        : `MISSION DE SUGGESTION DE RÉPONSE :
Langue cible : FRANÇAIS (ou ANGLAIS si le dernier message du prospect est en anglais).
Propose une réponse SMS adaptée, courtoise et concise. Si le prospect s'est adressé en anglais (ex: "What?", "Who is this?"), réponds-lui en anglais !
RÈGLES :
1. Moins de 160 caractères si possible (max 200).
2. Direct, clair et poli.
3. Ne mets pas de guillemets autour du texte.
4. Output SEULEMENT le corps du message SMS suggéré.
${customPrompt ? `Consigne spécifique de l'agent : ${customPrompt}` : ''}`;

    const smsSequenceService = require('./sms-sequence-service');
    const tzDetails = smsSequenceService.resolveTimezoneDetails({
        phone: sessionData.phoneNumber,
        city: sessionData.businessCity,
        state: sessionData.businessState,
        postalCode: sessionData.businessPostalCode,
        address: sessionData.businessAddress,
        timezone: sessionData.businessTimezone
    });
    const prospectTimezone = tzDetails.timezone;
    const businessLocationStr = sessionData.businessLocationStr || [sessionData.businessCity, sessionData.businessState].filter(Boolean).join(', ');
    const agencyTimezone = 'America/Moncton';
    const isDifferentTz = prospectTimezone && prospectTimezone !== agencyTimezone;
    const prospectTzName = getHumanTzName(prospectTimezone, isEn);
    const agencyTzName = getHumanTzName(agencyTimezone, isEn);

    const systemPromptWithContext = `${config.systemPrompt}

[INFORMATIONS CONTEXTUELLES DU CLIENT / CLIENT CONTEXT]
- Nom / Name: ${sessionData.clientName || (isEn ? 'Client' : 'Inconnu')}
- Entreprise / Company: ${sessionData.companyName || (isEn ? 'Company' : 'Inconnue')}
- Téléphone / Phone: ${sessionData.phoneNumber || 'N/A'}
- Emplacement physique de l'entreprise: ${businessLocationStr || 'Non spécifié'}
- Langue / Language: ${isEn ? 'ENGLISH' : 'FRANÇAIS'}

[FUSEAUX HORAIRES ET HEURE LOCALE / TIME ZONE CONTEXT]
- Fuseau horaire agence (Solutions Quasar): Heure de l'Atlantique (${agencyTzName}, ${agencyTimezone}).
- Fuseau horaire officiel du commerce: ${prospectTzName} (${prospectTimezone}).
${isDifferentTz ? `NOTE DÉCALAGE : Formule toujours les propositions d'horaires dans le fuseau horaire du commerce du prospect (${prospectTzName}).` : ''}

[DOCUMENTATION DE SOLUTIONS QUASAR INC.]
${knowledgeDoc}

${missionDirective}`;

    const messagesForOpenAI = [
        { role: "system", content: systemPromptWithContext },
        ...history.map(m => ({ role: m.role, content: m.content }))
    ];

    const completion = await openai.chat.completions.create({
        model: config.model || "gpt-4o-mini",
        messages: messagesForOpenAI,
        temperature: config.temperature !== undefined ? config.temperature : 0.7,
        max_tokens: 150
    });

    return completion.choices[0]?.message?.content?.trim() || '';
}

module.exports = {
    twilioClient,
    fromPhoneNumber,
    normalizePhone,
    getPhoneVariations,
    isPhoneFrancophone,
    detectMessageLanguage,
    sendSms,
    getSmsAiConfig,
    saveSmsAiConfig,
    generateAiOutreachSms,
    handleIncomingSms,
    suggestReply,
    isAutoResponderText,
    isCyrillicSpam,
    checkInboundRateLimit,
    isCourtesyAck,
    inboundRateLimitTracker
};
