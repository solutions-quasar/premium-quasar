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
        /\b(what is|what are|who is|who are|where are|when can|how do|why)\b/i,
        /\b(call me|give me a call|reach me|phone me|text me)\b/i,
        /\b(interested|sounds good|sounds great|looks good|let'?s do it|let'?s talk|count me in)\b/i,
        /\b(tomorrow|yesterday|today|tonight|next week|this week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
        /\b(appointment|schedule|meeting|booking|calendar|available|availability|slot|slots)\b/i,
        /\b(website|web site|online|business|company|service|services)\b/i,
        /\b(i am|i'm|i would|i'd|i have|i've|we are|we're|can you|could you|would you)\b/i,
        /\b(yes|yeah|yep|nope|sure|okay|ok|not interested|stop|unsubscribe)\b/i,
        /\b(do you|are you|is it|is this|will you|have you)\b/i,
        /\b(the|and|is|with|for|about|from|our|your|my)\b/i
    ];

    // French markers (regex word boundaries)
    const frenchPatterns = [
        /\b(bonjour|salut|bonsoir|all[oô])\b/i,
        /\b(merci|merci beaucoup|remercie)\b/i,
        /\b(s'il vous pla[iî]t|svp|s'il te pla[iî]t)\b/i,
        /\b(combien|co[uû]te|co[uû]tent|prix|tarif|tarifs|co[uû]t|devis|facture)\b/i,
        /\b(c'est quoi|qui [eê]tes-vous|o[uù] [eê]tes-vous|qu'est-ce|comment faire|pourquoi)\b/i,
        /\b(appelez-moi|rappelez-moi|joindre|t[eé]l[eé]phonez-moi|parler)\b/i,
        /\b(int[eé]ress[eé]|int[eé]ress[eé]e|d'accord|super|parfait|on peut se parler|bonne id[eé]e)\b/i,
        /\b(demain|aujourd'hui|ce soir|hier|semaine prochaine|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i,
        /\b(rendez-vous|rdv|rencontre|horaire|disponible|disponibilit[eé]|dispo|cr[eé]neau|cr[eé]neaux)\b/i,
        /\b(site web|site internet|entreprise|compagnie|service|services)\b/i,
        /\b(je suis|j'ai|je voudrais|j'aimerais|on est|nous sommes|pouvez-vous|pourriez-vous)\b/i,
        /\b(oui|ouais|non|pas int[eé]ress[eé]|arr[eê]t|fin)\b/i,
        /\b(est-ce que|avez-vous|[eê]tes-vous)\b/i,
        /\b(le|la|les|un|une|des|du|dans|pour|avec|sans|votre|notre)\b/i
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
4. Langue OBLIGATOIRE : Réponds STRICTEMENT dans la même langue que le prospect (100% français si le prospect écrit en français, 100% anglais si le prospect écrit en anglais). Ne mélange jamais les langues dans un même SMS.
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
        updatedAt: new Date().toISOString()
    };
    await db.collection('settings').doc('sms_ai_config').set(toSave, { merge: true });
    return toSave;
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

/**
 * Handles incoming Twilio SMS Webhooks autonomously with AI conversation
 */
async function handleIncomingSms({ from, body, messageSid }) {
    const formattedFrom = normalizePhone(from);
    const text = (body || '').trim();

    console.log(`[Twilio Webhook] Incoming SMS from ${formattedFrom}: "${text}"`);

    // 1. Opt-out check (Compliance: CASL & TCPA)
    if (/^(stop|arret|arr[eê]t|unsubscribe|cancel|quit|fin)/i.test(text)) {
        console.log(`[Twilio Webhook] Opt-out requested by ${formattedFrom}`);

        // Update in crm_leads
        const leadsSnap = await db.collection('crm_leads').where('phone', '==', formattedFrom).get();
        leadsSnap.forEach(d => d.ref.update({ smsOptOut: true, doNotContact: true }));

        // Update in clients
        const clientsSnap = await db.collection('clients').where('phone', '==', formattedFrom).get();
        clientsSnap.forEach(d => d.ref.update({ smsOptOut: true, doNotContact: true }));

        // Update in Lead Hunter leads collection
        const huntSnap = await db.collection('leads')
            .where('phone_number', 'in', [formattedFrom, from, from.replace('+1', '')])
            .get();
        huntSnap.forEach(d => d.ref.update({ smsOptOut: true, doNotContact: true }));

        const reply = "Solutions Quasar Inc. : Vous avez bien été désabonné(e) de nos messages SMS. / You have been successfully unsubscribed.";
        return reply;
    }

    // 2. Identify Lead / Client across crm_leads, clients, and leads (Lead Hunter)
    let clientName = '';
    let companyName = '';
    let preferredLang = null;
    let leadRef = null;
    let leadData = null;

    // Search in crm_leads
    const leadsSearch = await db.collection('crm_leads')
        .where('phone', 'in', [formattedFrom, from, from.replace('+1', '')])
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
            .where('phone', 'in', [formattedFrom, from, from.replace('+1', '')])
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
                .where('phone_number', 'in', [formattedFrom, from, from.replace('+1', '')])
                .limit(1)
                .get();
            if (!huntSearch1.empty) matchedHuntingDoc = huntSearch1.docs[0];

            if (!matchedHuntingDoc) {
                const huntSearch2 = await db.collection('leads')
                    .where('phone', 'in', [formattedFrom, from, from.replace('+1', '')])
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

    // Language Detection: Detect dynamically from message text, conversation history, or preferredLang
    const activeLanguage = detectMessageLanguage(text, history, preferredLang);
    const isEn = activeLanguage === 'en';

    console.log(`[Twilio Webhook] Inbound SMS from ${formattedFrom} resolved language: "${activeLanguage}" (Lead default: "${preferredLang}")`);

    // Cancel any active automated sequence on reply & notify Admin via SMS
    try {
        const smsSequenceService = require('./sms-sequence-service');
        await smsSequenceService.cancelSequenceOnReply(formattedFrom);
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

    // Check if AI is paused for this conversation (Human takeover mode)
    if (!aiEnabled) {
        console.log(`[Twilio Webhook] AI is DISABLED for ${sessionId}. Storing message for human agent takeover.`);
        await sessionDocRef.set({
            sessionId,
            channel: 'sms',
            phoneNumber: formattedFrom,
            clientName: clientName || null,
            companyName: companyName || null,
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

    const calendarReminderService = require('./calendar-reminder-service');

    const nowInAtlantic = new Date().toLocaleString(isEn ? 'en-US' : 'fr-CA', {
        timeZone: 'America/Moncton',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Clear and strict language instructions tailored to the conversation
    const languageDirective = isEn
        ? `[CRITICAL: 100% ENGLISH RESPONSE MANDATORY]
The prospect is communicating in ENGLISH.
You MUST write your entire response strictly and 100% in natural, fluent, professional ENGLISH.
NEVER answer in French.
- Length: Strictly under 160 characters (max 200). Be concise, clear, and friendly.
- Objective: Answer clearly, address objections, or propose a quick 10-15 minute discovery call.
- Booking suggestion: "Hi ${clientName ? clientName.split(' ')[0] : 'there'}, I'd be glad to help! Would Thursday at 2:00 PM AST or Friday at 10:00 AM AST work for a quick 10-minute discovery call?"
- Confirmation: "Confirmed for Thursday at 2:00 PM AST! You'll receive a reminder SMS with the Google Meet link before our call."`
        : `[CRITIQUE : RÉPONSE 100% FRANÇAIS OBLIGATOIRE]
Le prospect communique en FRANÇAIS.
Tu DOIS rédiger l'intégralité de ta réponse strictement et 100% en français chaleureux, fluide et professionnel.
N'utilise JAMAIS l'anglais.
- Longueur : Strictement moins de 160 caractères (max 200). Sois concis et courtois.
- Objectif : Répondre avec précision, lever les objections ou proposer un court appel découverte de 10-15 minutes.
- Suggestion d'appel : "Bonjour ${clientName ? clientName.split(' ')[0] : ''}, avec plaisir ! Est-ce que jeudi à 14h00 (heure de l'Atlantique) ou vendredi à 10h vous conviendrait pour un court appel de 10 min ?"
- Confirmation : "C'est confirmé pour jeudi à 14h00 (heure de l'Atlantique) ! Vous recevrez un rappel SMS avec le lien Google Meet avant l'appel."`;

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
- Téléphone / Phone: ${formattedFrom}
- Langue active détectée / Active Language: ${isEn ? 'ENGLISH (Respond 100% in English)' : 'FRANÇAIS (Réponds 100% en Français)'}

[FUSEAU HORAIRE ET HEURE LOCALE / TIME ZONE]
- Fuseau horaire officiel: Heure de l'Atlantique (America/Moncton, Nouveau-Brunswick / Canada - AST/ADT).
- Date et heure actuelles: ${nowInAtlantic} (Heure de l'Atlantique / Atlantic Time).
- Tous les rendez-vous, disponibilités et rappels sont fixés selon l'heure de l'Atlantique.

[DOCUMENTATION ET BASE DE CONNAISSANCES OFFICIELLE / KNOWLEDGE BASE]
${knowledgeDoc}

[ACCÈS DIRECT À L'AGENDA GOOGLE & PRISE DE RENDEZ-VOUS / BOOKING TOOLS]
Tu as deux outils (tools) à ta disposition :
1. 'get_available_slots' : vérifie les créneaux libres en temps réel dans Google Calendar pour un appel découverte (15-30 min). Propose 2 créneaux concrets et simples.
2. 'book_appointment' : réserve fermement le rendez-vous dans Google Calendar avec Google Meet dès que le prospect valide un créneau. Confirme chaleureusement la date et l'heure en précisant qu'un rappel SMS avec le lien Meet sera envoyé.

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
                description: "Réserve fermement le rendez-vous dans Google Calendar et l'ERP lorsque le prospect accepte ou demande un créneau précis. / Firmly books discovery meeting in Google Calendar.",
                parameters: {
                    type: "object",
                    properties: {
                        appointmentTime: { type: "string", description: "Date et heure exacte du rendez-vous au format ISO (ex: 2026-10-16T14:00:00-04:00)" },
                        topic: { type: "string", description: "Sujet ou service abordé (ex: Audit IA, Refonte site web, Démo ERP / AI Audit, Web Design, ERP Demo)" },
                        prospectEmail: { type: "string", description: "Email du prospect s'il a été communiqué" }
                    },
                    required: ["appointmentTime"]
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
                const slots = await calendarReminderService.getAvailableSlots(fnArgs.daysAhead || 5);
                toolOutput = {
                    success: true,
                    available_slots: slots.slice(0, 4)
                };
            } else if (fnName === 'book_appointment') {
                try {
                    const bookRes = await calendarReminderService.scheduleAppointment({
                        leadId: leadRef?.id || null,
                        prospectName: clientName || (isEn ? 'SMS Client' : 'Client SMS'),
                        prospectPhone: formattedFrom,
                        prospectEmail: fnArgs.prospectEmail || '',
                        appointmentTime: fnArgs.appointmentTime,
                        notes: isEn 
                            ? `Booked by SMS AI. Topic: ${fnArgs.topic || 'Quasar Discovery Call'}`
                            : `Réservé par l'IA SMS. Sujet: ${fnArgs.topic || 'Découverte Quasar'}`
                    });
                    toolOutput = {
                        success: true,
                        confirmedTime: fnArgs.appointmentTime,
                        meetLink: bookRes.appointment?.meetLink || 'https://meet.google.com/qsr-auto-meet'
                    };
                } catch (bErr) {
                    toolOutput = { success: false, error: bErr.message };
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
        language: activeLanguage,
        aiEnabled: true,
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
Langue cible : FRANÇAIS (100%).
Propose une réponse SMS adaptée, courtoise et concise en français que le conseiller humain pourra envoyer ou adapter.
RÈGLES :
1. Moins de 160 caractères si possible (max 200).
2. Direct, clair et poli.
3. Ne mets pas de guillemets autour du texte.
4. Output SEULEMENT le corps du message SMS suggéré en FRANÇAIS.
${customPrompt ? `Consigne spécifique de l'agent : ${customPrompt}` : ''}`;

    const systemPromptWithContext = `${config.systemPrompt}

[INFORMATIONS CONTEXTUELLES DU CLIENT / CLIENT CONTEXT]
- Nom / Name: ${sessionData.clientName || (isEn ? 'Client' : 'Inconnu')}
- Entreprise / Company: ${sessionData.companyName || (isEn ? 'Company' : 'Inconnue')}
- Téléphone / Phone: ${sessionData.phoneNumber || 'N/A'}
- Langue / Language: ${isEn ? 'ENGLISH' : 'FRANÇAIS'}

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
    isPhoneFrancophone,
    detectMessageLanguage,
    sendSms,
    getSmsAiConfig,
    saveSmsAiConfig,
    generateAiOutreachSms,
    handleIncomingSms,
    suggestReply
};
