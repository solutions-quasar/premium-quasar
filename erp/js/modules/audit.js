/**
 * Solutions Quasar Inc. - Frontend Module: Audit IA
 * 
 * Manages:
 * 1. AI Audit Configuration (System Prompt editing, frequency, batch size, pause/resume)
 * 2. Multi-Prompt Management: Audit IA, Conversation SMS (Inbound/RDV), Accroches Outbound, Documentation
 * 3. AI Meta-Prompt Optimizer (Demander à l'IA d'améliorer ses propres prompts en direct)
 * 4. On-demand batch and single-lead audits
 * 5. Real-time stats & KPIs (Franchises excluded, Ambiguous reviews, Category breakdown)
 */

import { auth } from '../firebase-config.js';

const API_BASE = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : '';

const AUDIT_SVGS = {
    brain: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>`,
    bolt: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    shield: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    tune: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/><line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="16" y1="18" x2="16" y2="22"/></svg>`,
    terminal: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
    save: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
    restore: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
    check: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    alert: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    clock: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    sparkles: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>`,
    messageSquare: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    send: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    book: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`
};

const DEFAULT_PROMPTS = {
    audit: `Tu es l'Auditeur Cognitif IA de Solutions Quasar Inc., expert en audit digital et acquisition B2B pour PME locales au Canada et aux USA.
Ton rôle est d'analyser les données collectées d'une entreprise (fiche Google Places, contenu du site web scanné, présences réseaux sociaux, avis) et de :

1. ÉVALUATION ANTI-HOMONYMIE (Triangulation à 3 clés) :
   - Vérifie si le numéro de téléphone extrait de Google Places correspond aux chiffres trouvés sur le site ou les réseaux.
   - Vérifie la cohérence du numéro civique, de la rue et du code postal / ZIP.
   - Attribue un score de confiance global de 0 à 100 sur la certitude que les données appartiennent au bon commerce.
   - Si score < 85, le lead sera marqué 'Ambiguous Match / Review' pour éviter toute erreur de contact.

2. DÉTECTION STRICTE DE FRANCHISE / CHAÎNE CORPORATIVE :
   - Analyse les indices de franchises : multi-succursales, chaîne de salons/restauration/services, mention de 'franchise', 'nos succursales', 'locations', 'store locator', 'devenir franchisé', etc.
   - Si l'entreprise fait partie d'une franchise ou d'une grande chaîne : marque isFranchise = true. Ces entreprises sont STRICTEMENT EXCLUES de la prospection automatique.

3. CATÉGORISATION PRÉCISE DU LEAD :
   Choisis UNE SEULE des 7 catégories suivantes :
   - 'directory_only' : L'entreprise n'a PAS de site web dédié officiel. Son lien Google Maps pointe vers un annuaire, un répertoire d'entreprises ou une plateforme de réservation tierce (ex: GOrendezvous, Dash Booking, Fresha, Booksy, Planity, Jane App, Noterro, Booxi, Pages Jaunes, Yelp, etc.). L'entreprise est captive d'un tiers qui expose ses clients aux concurrents et prélève des commissions/frais. Opportunité commerciale majeure pour lui vendre son propre site officiel dédié avec prise de rendez-vous IA autonome et sans commission !
   - 'missing_gmb_website' : L'entreprise possède un site web actif et vérifié (découvert par recherche Google), mais il n'est PAS répertorié sur sa fiche Google Business / Google Maps (bouton 'Ajouter un site web' affiché aux clients). Opportunité commerciale prioritaire !
   - 'no_website' : Aucun site web actif n'existe (ni sur Google Places, ni sur la recherche Google), ou domaine expiré/inaccessible.
   - 'outdated_website' : Site obsolète (design non adapté aux téléphones mobiles, copyright ancien < 2022, pas de HTTPS, technologies désuètes, pas de tunnel moderne).
   - 'modern_no_ai' : Site web moderne et responsive, mais SANS agent conversationnel IA 24/7, sans automatisation de réservation, ni intégration ERP intelligente.
   - 'social_only' : Pas de site web propre, mais présence active sur Facebook, Instagram ou LinkedIn.
   - 'franchise' : Grande chaîne ou réseau de franchises.

4. DIAGNOSTIC ET ANGLE COMMERCIAL :
   - Liste 2 à 4 'painPoints' concrets (ex: 'Dépendance à une plateforme tierce', 'Absence de site propriétaire officiel', 'Site web non relié à Google Maps', 'Pas de réservation en ligne', 'Site non adapté aux téléphones').
   - Rédige un 'auditSummary' clair en 2 phrases pour le CRM.
   - Rédige un 'recommendedAngle' pour personnaliser la séquence SMS.

RÉPONS OBLIGATOIREMENT EN JSON VALIDE STRICT respectant ce format :
{
  "category": "directory_only" | "missing_gmb_website" | "no_website" | "outdated_website" | "modern_no_ai" | "social_only" | "franchise",
  "isFranchise": boolean,
  "franchiseReason": string,
  "confidenceScore": number,
  "antiHomonymMatched": boolean,
  "painPoints": ["point 1", "point 2"],
  "auditSummary": "Synthèse courte...",
  "recommendedAngle": "Angle d'accroche recommandé..."
}`,

    sms_conversation: `Tu es l'assistant commercial IA bilingue de Solutions Quasar Inc. (agence d'automatisation IA, développement web et logiciels ERP à Deschambault, QC, Canada).
Tu discutes par SMS avec des prospects et clients francophones et anglophones en Amérique du Nord (Canada & USA).

RÈGLES STRICTES DE RÉPONSE SMS :
1. CONCIS : Ta réponse DOIT faire moins de 160 caractères (1 SMS standard, max 200) pour rester percutante.
2. Ton : Chaleureux, professionnel, courtois et très humain.
3. Objectif : Répondre à sa question avec précision en t'appuyant sur la documentation de l'entreprise, lever les objections ou proposer un court appel découverte de 10-15 minutes (ex: "Avez-vous 10 min mardi ou jeudi ?" / "Would Thursday at 2:00 PM AST work for a quick 10-min call?").
4. Langue OBLIGATOIRE : Réponds STRICTEMENT dans la même langue que le prospect (100% français si le prospect écrit en français, 100% anglais si le prospect écrit en anglais). Ne mélange jamais les langues dans un même SMS.
5. PRISE DE RENDEZ-VOUS EN DIRECT : Tu as l'autorisation TOTALE de planifier et confirmer les rendez-vous en direct par SMS avec tes outils ('get_available_slots' et 'book_appointment').
6. Ne promets aucun prix définitif non documenté sans consultation préalable.`,

    sms_outbound: `Tu es un expert d'élite en prospection commerciale B2B par SMS pour Solutions Quasar Inc. (conception web, agents IA et logiciels ERP à Deschambault, QC).
Ton rôle est de rédiger un UNIQUE premier SMS de prospection à froid/tiède, percutant, ultra-personnalisé et respectueux pour une entreprise ciblée.

RÈGLES STRICTES :
1. MAXIMUM 160 CARACTÈRES (1 SMS standard). Sois direct, naturel et percutant.
2. Identifie clairement l'expéditeur ("Solutions Quasar" ou "Ben de Solutions Quasar" / "Ben from Solutions Quasar").
3. Ton extrêmement humain, courtois et crédible (aucun mot creux de marketeur, aucun emoji abusif).
4. Termine par un appel à l'action léger et sans engagement (ex: "Avez-vous 5 min cette semaine pour en discuter ?" / "Would you be open for a quick 5-min chat this week?").
5. Inclus obligatoirement la mention de désabonnement en fin de message : [Rép. STOP pour cesser] (FR) ou [Reply STOP to opt out] (EN).
6. Respecte strictement la langue demandée (100% français ou 100% anglais).
7. Renvoie STRICTEMENT le texte brut du SMS, rien d'autre.`,

    documentation: `# SOLUTIONS QUASAR INC. - OFFICIAL KNOWLEDGE BASE / BASE DE CONNAISSANCES

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
  - Disponibilités habituelles : Du lundi au vendredi, entre 9h00 et 17h00 (heure de l'Atlantique).`
};

let auditConfig = {
    isActive: true,
    frequencyMinutes: 30,
    batchSize: 10,
    minConfidenceScore: 85,
    autoTriggerSequences: true,
    systemPrompt: DEFAULT_PROMPTS.audit,
    lastRun: null,
    status: 'idle'
};

let smsAiConfig = {
    systemPrompt: DEFAULT_PROMPTS.sms_conversation,
    outboundPrompt: DEFAULT_PROMPTS.sms_outbound,
    knowledgeDocumentation: DEFAULT_PROMPTS.documentation,
    model: 'gpt-4o-mini',
    temperature: 0.7
};

let auditStats = {
    totalAudited: 0,
    franchisesExcluded: 0,
    ambiguousReviews: 0,
    categoryBreakdown: {
        no_website: 0,
        outdated_website: 0,
        modern_no_ai: 0,
        social_only: 0,
        franchise: 0,
        unclassified: 0
    }
};

let activePromptTab = 'audit'; // 'audit' | 'sms_conversation' | 'sms_outbound' | 'documentation'

/**
 * Fetch current audit config and system prompt from backend
 */
export async function getAuditConfig() {
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/audit/config`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.success && data.config) {
            auditConfig = data.config;
        }
    } catch (e) {
        console.error('[AuditModule] Error fetching config:', e);
    }
    return auditConfig;
}

/**
 * Fetch current SMS AI config from backend
 */
export async function getSmsAiConfig() {
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sms/config`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.success && data.config) {
            smsAiConfig = {
                systemPrompt: data.config.systemPrompt || DEFAULT_PROMPTS.sms_conversation,
                outboundPrompt: data.config.outboundPrompt || DEFAULT_PROMPTS.sms_outbound,
                knowledgeDocumentation: data.config.knowledgeDocumentation || DEFAULT_PROMPTS.documentation,
                model: data.config.model || 'gpt-4o-mini',
                temperature: data.config.temperature !== undefined ? data.config.temperature : 0.7
            };
        }
    } catch (e) {
        console.error('[AuditModule] Error fetching sms ai config:', e);
    }
    return smsAiConfig;
}

/**
 * Fetch audit stats from backend
 */
export async function getAuditStats() {
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/audit/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.success && data.stats) {
            auditStats = data.stats;
            if (data.stats.config) auditConfig = data.stats.config;
        }
    } catch (e) {
        console.error('[AuditModule] Error fetching stats:', e);
    }
    return auditStats;
}

/**
 * Save updated audit settings & system prompt
 */
export async function saveAuditConfig(updates) {
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/audit/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updates)
        });
        const data = await resp.json();
        if (data.success && data.config) {
            auditConfig = data.config;
            window.showToast?.("Prompt d'Audit IA enregistré !", "success");
            return data.config;
        } else {
            throw new Error(data.error || 'Erreur lors de la sauvegarde');
        }
    } catch (e) {
        window.showToast?.(`Erreur : ${e.message}`, "error");
        throw e;
    }
}

/**
 * Save updated SMS AI settings & prompts
 */
export async function saveSmsAiConfig(updates) {
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const payload = {
            systemPrompt: updates.systemPrompt !== undefined ? updates.systemPrompt : smsAiConfig.systemPrompt,
            outboundPrompt: updates.outboundPrompt !== undefined ? updates.outboundPrompt : smsAiConfig.outboundPrompt,
            knowledgeDocumentation: updates.knowledgeDocumentation !== undefined ? updates.knowledgeDocumentation : smsAiConfig.knowledgeDocumentation,
            model: updates.model || smsAiConfig.model,
            temperature: updates.temperature !== undefined ? updates.temperature : smsAiConfig.temperature
        };
        const resp = await fetch(`${API_BASE}/api/sms/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        if (data.success && data.config) {
            smsAiConfig = data.config;
            window.showToast?.("Prompt SMS enregistré avec succès !", "success");
            return data.config;
        } else {
            throw new Error(data.error || 'Erreur lors de la sauvegarde');
        }
    } catch (e) {
        window.showToast?.(`Erreur : ${e.message}`, "error");
        throw e;
    }
}

/**
 * Ask the AI to meta-optimize a prompt
 */
export async function optimizePromptWithAi({ currentPrompt, promptType, userInstruction }) {
    const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
    const resp = await fetch(`${API_BASE}/api/ai/optimize-prompt`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPrompt, promptType, userInstruction })
    });
    const data = await resp.json();
    if (data.success && data.optimizedPrompt) {
        return data.optimizedPrompt;
    } else {
        throw new Error(data.error || "Échec de l'optimisation par l'IA.");
    }
}

/**
 * Reset system prompt to default
 */
export async function resetAuditPrompt() {
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/audit/reset-prompt`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.success && data.config) {
            auditConfig = data.config;
            window.showToast?.("Prompt d'Audit réinitialisé avec succès !", "success");
            return data.config;
        }
    } catch (e) {
        window.showToast?.(`Erreur : ${e.message}`, "error");
    }
}

/**
 * Run a batch audit on unclassified leads now
 */
export async function runAuditBatchNow(batchSize = 10) {
    try {
        window.showToast?.(`Lancement de l'audit pour ${batchSize} leads...`, "info");
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/audit/run-batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ batchSize })
        });
        const data = await resp.json();
        if (data.success) {
            window.showToast?.(`Audit terminé : ${data.processedCount} leads traités !`, "success");
            await getAuditStats();
            return data;
        } else {
            throw new Error(data.error || 'Erreur batch');
        }
    } catch (e) {
        window.showToast?.(`Erreur audit batch : ${e.message}`, "error");
    }
}

/**
 * Audit a single lead on demand
 */
export async function auditSingleLeadNow(leadId) {
    try {
        window.showToast?.("Audit IA en cours...", "info");
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/audit/lead/${leadId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.success) {
            if (data.enrichedContacts) {
                const ext = data.enrichedContacts;
                const pInput = document.getElementById('edit-phone');
                if (pInput && ext.primaryPhone) pInput.value = ext.primaryPhone;
                const eInput = document.getElementById('edit-email');
                if (eInput && ext.primaryEmail) eInput.value = ext.primaryEmail;
            }

            if (data.website) {
                const wInput = document.getElementById('edit-website');
                if (wInput) wInput.value = data.website;
            }

            window.showToast?.(`Lead qualifié : ${data.category || 'Terminé'} (${data.confidenceScore || 0}%)`, "success");
            return data;
        } else {
            throw new Error(data.error || 'Audit échoué');
        }
    } catch (e) {
        window.showToast?.(`Erreur audit lead : ${e.message}`, "error");
    }
}

/**
 * Open the native AI Prompt Optimizer modal
 */
export function openPromptOptimizerModal({ promptType, currentPromptText, onApply }) {
    const modalId = 'modal-ai-prompt-optimizer';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const titles = {
        audit: "Auditeur Cognitif & Triangulation",
        sms_conversation: "Conversation SMS & Prise de RDV",
        sms_outbound: "Accroches SMS Outbound",
        documentation: "Documentation & Connaissances Entreprise"
    };

    const targetTitle = titles[promptType] || "Prompt Système IA";

    const modalHtml = `
    <div id="${modalId}" class="crm-modal-overlay" style="z-index:9999; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.85); position:fixed; top:0; left:0; width:100vw; height:100vh; backdrop-filter:blur(8px);">
        <div class="crm-modal-content" style="width:100%; max-width:880px; max-height:92vh; background:#0D0F14; border:1px solid rgba(223,165,58,0.35); border-radius:14px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 25px 70px rgba(0,0,0,0.9);">
            <!-- Modal Header -->
            <div style="background:#13161D; padding:16px 24px; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:34px; height:34px; border-radius:8px; background:linear-gradient(135deg, rgba(223,165,58,0.2), rgba(223,165,58,0.05)); border:1px solid rgba(223,165,58,0.4); display:flex; align-items:center; justify-content:center; color:var(--gold);">
                        ${AUDIT_SVGS.sparkles}
                    </div>
                    <div>
                        <h3 style="margin:0; font-size:1.05rem; font-weight:700; color:#F8FAFC; display:flex; align-items:center; gap:8px;">
                            <span>Optimiseur de Prompt IA</span>
                            <span style="font-size:0.7rem; font-weight:600; padding:2px 8px; border-radius:4px; background:rgba(223,165,58,0.15); color:var(--gold); border:1px solid rgba(223,165,58,0.3);">
                                ${targetTitle}
                            </span>
                        </h3>
                        <div style="font-size:0.75rem; color:#94A3B8; margin-top:2px;">
                            L'IA analyse vos directives actuelles, élimine les ambiguïtés et maximise la conversion.
                        </div>
                    </div>
                </div>
                <button id="btn-close-optimizer" style="background:none; border:none; color:#64748B; cursor:pointer; font-size:1.2rem; padding:4px 8px; border-radius:4px; transition:color 0.2s;" onmouseover="this.style.color='#F8FAFC'" onmouseout="this.style.color='#64748B'">✕</button>
            </div>

            <!-- Modal Body -->
            <div style="padding:22px 24px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                <!-- Instruction Input -->
                <div>
                    <label style="display:block; font-size:0.78rem; text-transform:uppercase; font-weight:700; color:#CBD5E1; letter-spacing:0.5px; margin-bottom:6px;">
                        Directive spécifique pour l'IA (Optionnelle) :
                    </label>
                    <input type="text" id="optimizer-user-instruction" placeholder="ex: Insiste sur la prise de rendez-vous rapide, sois plus percutant, zéro hallucination..." style="width:100%; background:#161922; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px 14px; font-size:0.85rem; color:#F8FAFC; outline:none; transition:border-color 0.2s;" onfocus="this.style.borderColor='var(--gold)';" onblur="this.style.borderColor='rgba(255,255,255,0.1)';">
                </div>

                <!-- Quick Directive Pills -->
                <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                    <span style="font-size:0.72rem; color:#64748B; font-weight:600;">Suggestions rapides :</span>
                    <button type="button" class="opt-pill-btn" data-pill="Maximise le taux de réponse et la conversion avec un appel à l'action irrésistible.">⚡ Maximiser la conversion</button>
                    <button type="button" class="opt-pill-btn" data-pill="Applique des contraintes strictes anti-hallucination et un respect total des règles négatives.">🛡️ Zéro hallucination & plus strict</button>
                    <button type="button" class="opt-pill-btn" data-pill="Rends le texte ultra-concis, direct et percutant en éliminant tout verbiage inutile.">🎯 Ultra-concis & punchy</button>
                    <button type="button" class="opt-pill-btn" data-pill="Adopte un ton très humain, chaleureux, empathique et professionnel sans paraître vendeur.">🤝 Chaleureux & humain</button>
                </div>

                <!-- Action Button -->
                <div style="display:flex; justify-content:center; margin-top:4px;">
                    <button id="btn-run-optimization" class="lead-action-btn primary" style="background:linear-gradient(135deg, rgba(223,165,58,0.25), rgba(223,165,58,0.1)); border:1px solid var(--gold); color:var(--gold); font-weight:700; padding:10px 24px; font-size:0.88rem; border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s;">
                        ${AUDIT_SVGS.sparkles}
                        <span id="opt-btn-label">Générer l'amélioration avec l'IA</span>
                    </button>
                </div>

                <!-- Preview Area -->
                <div id="optimizer-preview-container" style="display:none; flex-direction:column; gap:8px; margin-top:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:#10B981; display:flex; align-items:center; gap:6px;">
                            ${AUDIT_SVGS.check} Version optimisée par l'IA :
                        </span>
                        <span style="font-size:0.72rem; color:#64748B;" id="optimizer-char-count"></span>
                    </div>
                    <textarea id="optimizer-result-textarea" rows="12" style="width:100%; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size:0.8rem; line-height:1.5; background:#080A0E; color:#E2E8F0; border:1px solid rgba(16,185,129,0.35); border-radius:8px; padding:14px; outline:none; resize:vertical;"></textarea>
                </div>
            </div>

            <!-- Modal Footer -->
            <div style="background:#13161D; padding:14px 24px; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center;">
                <button id="btn-cancel-optimizer" style="background:transparent; border:1px solid rgba(255,255,255,0.12); color:#94A3B8; padding:7px 18px; border-radius:6px; font-size:0.82rem; cursor:pointer;">Annuler</button>
                <button id="btn-apply-optimized-prompt" class="lead-action-btn primary" style="display:none; background:rgba(16,185,129,0.18); border-color:#10B981; color:#10B981; font-weight:700; padding:8px 22px; font-size:0.84rem; border-radius:6px; cursor:pointer;" disabled>
                    ${AUDIT_SVGS.check} Appliquer ce prompt
                </button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Event listeners for modal
    const modalEl = document.getElementById(modalId);
    const closeBtn = document.getElementById('btn-close-optimizer');
    const cancelBtn = document.getElementById('btn-cancel-optimizer');
    const runBtn = document.getElementById('btn-run-optimization');
    const btnLabel = document.getElementById('opt-btn-label');
    const instructionInput = document.getElementById('optimizer-user-instruction');
    const previewContainer = document.getElementById('optimizer-preview-container');
    const resultTextarea = document.getElementById('optimizer-result-textarea');
    const applyBtn = document.getElementById('btn-apply-optimized-prompt');
    const charCountEl = document.getElementById('optimizer-char-count');

    const closeModal = () => modalEl?.remove();
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    // Pill quick-clicks
    modalEl?.querySelectorAll('.opt-pill-btn').forEach(btn => {
        btn.style.cssText = "background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); color:#CBD5E1; padding:3px 10px; border-radius:14px; font-size:0.72rem; cursor:pointer; transition:all 0.15s ease;";
        btn.addEventListener('click', () => {
            const val = btn.getAttribute('data-pill');
            if (instructionInput) instructionInput.value = val;
        });
    });

    // Run optimization
    runBtn?.addEventListener('click', async () => {
        const userInstruction = instructionInput?.value || '';
        runBtn.disabled = true;
        btnLabel.innerHTML = `<span style="display:inline-block; animation:spin 1s linear infinite;">⏳</span> Optimisation par l'IA en cours...`;

        try {
            const optimized = await optimizePromptWithAi({
                currentPrompt: currentPromptText,
                promptType,
                userInstruction
            });

            if (resultTextarea && previewContainer && applyBtn) {
                resultTextarea.value = optimized;
                previewContainer.style.display = 'flex';
                applyBtn.style.display = 'inline-flex';
                applyBtn.disabled = false;
                if (charCountEl) charCountEl.innerText = `${optimized.length} caractères`;
                resultTextarea.scrollIntoView({ behavior: 'smooth' });
            }
        } catch (err) {
            window.showToast?.(`Erreur : ${err.message}`, "error");
        } finally {
            runBtn.disabled = false;
            btnLabel.innerText = "Générer à nouveau";
        }
    });

    // Apply button
    applyBtn?.addEventListener('click', () => {
        const finalPrompt = resultTextarea?.value || '';
        if (finalPrompt.trim()) {
            onApply(finalPrompt);
            closeModal();
            window.showToast?.("Prompt optimisé appliqué ! N'oubliez pas de l'enregistrer.", "success");
        }
    });
}

/**
 * Render the full Audit, Triangulation & Multi-Prompt Management tab content
 */
export async function renderAuditConfigTab(container) {
    if (!container) return;

    // Load configs in parallel
    await Promise.all([getAuditConfig(), getSmsAiConfig()]);

    const isActive = auditConfig.isActive !== false;
    const isRunning = auditConfig.status === 'running';

    container.innerHTML = `
        <!-- Top Status & Actions Banner -->
        <div style="background:#12151B; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:36px; height:36px; border-radius:8px; background:rgba(223,165,58,0.1); border:1px solid rgba(223,165,58,0.25); display:flex; align-items:center; justify-content:center; color:var(--gold); flex-shrink:0;">
                    ${AUDIT_SVGS.brain}
                </div>
                <div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <h4 style="margin:0; font-size:1.05rem; font-weight:700; color:#F8FAFC; letter-spacing:-0.2px;">Moteur d'Audit IA</h4>
                        <span style="font-size:0.7rem; font-weight:600; padding:2px 7px; border-radius:6px; background:${isActive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; color:${isActive ? '#10B981' : '#EF4444'}; border:1px solid ${isActive ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'};">
                            ${isActive ? 'Actif' : 'En pause'}
                        </span>
                        ${isRunning ? '<span style="font-size:0.7rem; font-weight:600; padding:2px 7px; border-radius:6px; background:rgba(245,158,11,0.1); color:#F59E0B; border:1px solid rgba(245,158,11,0.25);">Analyse en cours...</span>' : ''}
                    </div>
                    <div class="text-xs text-muted" style="margin-top:2px; font-size:0.78rem; color:#64748B;">
                        Vérification automatique du site web, détection des opportunités et assignation de séquences.
                    </div>
                </div>
            </div>

            <!-- Run Now Controls -->
            <div style="display:flex; align-items:center; gap:8px;">
                <select id="audit-batch-size-select" style="background:#090B0F; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:5px 10px; font-size:0.8rem; color:#CBD5E1; outline:none; cursor:pointer;">
                    <option value="5">5 leads</option>
                    <option value="10" selected>10 leads</option>
                    <option value="20">20 leads</option>
                </select>
                <button class="lead-action-btn primary" id="btn-run-audit-now" style="background:rgba(223,165,58,0.12); border-color:var(--gold); color:var(--gold); font-weight:600;">
                    ${AUDIT_SVGS.bolt} Auditer un lot
                </button>
            </div>
        </div>

        <!-- 4 Key KPI Cards -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px; margin-top:12px;">
            <div style="background:#12151B; border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:14px 16px;">
                <div style="font-size:0.72rem; color:#94A3B8; text-transform:uppercase; font-weight:600; letter-spacing:0.5px;">Total Leads Audités</div>
                <div style="font-size:1.45rem; font-weight:700; color:#F8FAFC; margin-top:2px;" id="stat-total-audited">${auditStats.totalAudited || 0}</div>
                <div style="font-size:0.72rem; color:#64748B; margin-top:2px;">Fiches qualifiées par l'IA</div>
            </div>

            <div style="background:#12151B; border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:14px 16px;">
                <div style="font-size:0.72rem; color:#EF4444; text-transform:uppercase; font-weight:600; letter-spacing:0.5px;">Franchises Exclues</div>
                <div style="font-size:1.45rem; font-weight:700; color:#EF4444; margin-top:2px;" id="stat-franchises-excluded">${auditStats.franchisesExcluded || 0}</div>
                <div style="font-size:0.72rem; color:#64748B; margin-top:2px;">Grandes chaînes éliminées</div>
            </div>

            <div style="background:#12151B; border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:14px 16px;">
                <div style="font-size:0.72rem; color:#F59E0B; text-transform:uppercase; font-weight:600; letter-spacing:0.5px;">Matchs Ambigus</div>
                <div style="font-size:1.45rem; font-weight:700; color:#F59E0B; margin-top:2px;" id="stat-ambiguous-reviews">${auditStats.ambiguousReviews || 0}</div>
                <div style="font-size:0.72rem; color:#64748B; margin-top:2px;">Score &lt; 85% (Non sollicités)</div>
            </div>

            <div style="background:#12151B; border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:14px 16px;">
                <div style="font-size:0.72rem; color:#94A3B8; text-transform:uppercase; font-weight:600; letter-spacing:0.5px;">Dernier Passage</div>
                <div style="font-size:1.05rem; font-weight:700; color:var(--gold); margin-top:4px;" id="stat-last-run">
                    ${auditConfig.lastRun ? new Date(auditConfig.lastRun).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' }) : 'En attente'}
                </div>
                <div style="font-size:0.72rem; color:#64748B; margin-top:2px;">Cycle : toutes les ${auditConfig.frequencyMinutes || 30} min</div>
            </div>
        </div>

        <!-- Category Breakdown Strip -->
        <div style="background:#12151B; border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:10px 16px; margin-top:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div style="font-size:0.74rem; font-weight:600; color:#94A3B8; text-transform:uppercase; letter-spacing:0.5px;">Répartition des Catégories :</div>
            <div style="display:flex; gap:10px; flex-wrap:wrap; font-size:0.78rem;">
                <span style="color:#EF4444; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); padding:2px 8px; border-radius:4px;">Pas de site : <strong>${auditStats.categoryBreakdown?.no_website || 0}</strong></span>
                <span style="color:#F87171; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); padding:2px 8px; border-radius:4px;">Pas de site dédié : <strong>${auditStats.categoryBreakdown?.directory_only || 0}</strong></span>
                <span style="color:#F59E0B; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.2); padding:2px 8px; border-radius:4px;">Site ancien : <strong>${auditStats.categoryBreakdown?.outdated_website || 0}</strong></span>
                <span style="color:#38BDF8; background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.2); padding:2px 8px; border-radius:4px;">Moderne sans IA : <strong>${auditStats.categoryBreakdown?.modern_no_ai || 0}</strong></span>
                <span style="color:#C084FC; background:rgba(192,132,252,0.08); border:1px solid rgba(192,132,252,0.2); padding:2px 8px; border-radius:4px;">Réseaux seuls : <strong>${auditStats.categoryBreakdown?.social_only || 0}</strong></span>
                <span style="color:#94A3B8; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); padding:2px 8px; border-radius:4px;">Franchises : <strong>${auditStats.categoryBreakdown?.franchise || 0}</strong></span>
            </div>
        </div>

        <!-- Controls Section: Frequency, Confidence, State -->
        <div style="background:#12151B; border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:16px; margin-top:10px;">
            <div style="font-size:0.86rem; font-weight:600; color:#F8FAFC; display:flex; align-items:center; gap:6px; margin-bottom:12px;">
                ${AUDIT_SVGS.tune}
                <span>Paramètres de l'Audit IA</span>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px;">
                
                <!-- Toggle Engine State -->
                <div class="form-group" style="margin:0;">
                    <label style="display:block; font-size:0.72rem; text-transform:uppercase; font-weight:600; color:#94A3B8; margin-bottom:4px;">État de l'Agent d'Audit</label>
                    <select id="cfg-audit-is-active" style="width:100%; background:#090B0F; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:6px 10px; font-size:0.82rem; color:#CBD5E1; outline:none;">
                        <option value="true" ${isActive ? 'selected' : ''}>Activé (Analyse automatique)</option>
                        <option value="false" ${!isActive ? 'selected' : ''}>En pause (Suspendre l'analyse)</option>
                    </select>
                </div>

                <!-- Frequency -->
                <div class="form-group" style="margin:0;">
                    <label style="display:block; font-size:0.72rem; text-transform:uppercase; font-weight:600; color:#94A3B8; margin-bottom:4px;">Fréquence d'Exécution</label>
                    <select id="cfg-audit-frequency" style="width:100%; background:#090B0F; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:6px 10px; font-size:0.82rem; color:#CBD5E1; outline:none;">
                        <option value="15" ${auditConfig.frequencyMinutes == 15 ? 'selected' : ''}>Toutes les 15 minutes</option>
                        <option value="30" ${auditConfig.frequencyMinutes == 30 ? 'selected' : ''}>Toutes les 30 minutes (Recommandé)</option>
                        <option value="60" ${auditConfig.frequencyMinutes == 60 ? 'selected' : ''}>Toutes les heures</option>
                        <option value="360" ${auditConfig.frequencyMinutes == 360 ? 'selected' : ''}>Toutes les 6 heures</option>
                        <option value="720" ${auditConfig.frequencyMinutes == 720 ? 'selected' : ''}>Toutes les 12 heures</option>
                        <option value="1440" ${auditConfig.frequencyMinutes == 1440 ? 'selected' : ''}>Une fois par 24h</option>
                    </select>
                </div>

                <!-- Min Confidence Score -->
                <div class="form-group" style="margin:0;">
                    <label style="display:block; font-size:0.72rem; text-transform:uppercase; font-weight:600; color:#94A3B8; margin-bottom:4px;">Seuil de Confiance Minimum (%)</label>
                    <input type="number" id="cfg-audit-min-score" min="50" max="100" value="${auditConfig.minConfidenceScore || 85}" style="width:100%; background:#090B0F; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:6px 10px; font-size:0.82rem; color:#CBD5E1; outline:none;">
                    <div style="font-size:0.7rem; color:#64748B; margin-top:3px;">En dessous de 85%, aucun SMS n'est déclenché.</div>
                </div>

                <!-- Auto-Trigger Sequences -->
                <div class="form-group" style="margin:0; display:flex; flex-direction:column; justify-content:center;">
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                        <input type="checkbox" id="cfg-audit-auto-trigger" ${auditConfig.autoTriggerSequences !== false ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--gold);">
                        <span style="font-size:0.82rem; font-weight:600; color:#F8FAFC;">Déclenchement automatique</span>
                    </label>
                    <div style="font-size:0.7rem; color:#64748B; margin-top:3px;">
                        Lance la séquence SMS selon la catégorie dès que le lead est validé.
                    </div>
                </div>
            </div>
        </div>

        <!-- ========================================================================================= -->
        <!-- UPGRADED MULTI-PROMPT MANAGEMENT & AI META-OPTIMIZER -->
        <!-- ========================================================================================= -->
        <div style="background:#12151B; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:18px; margin-top:12px; display:flex; flex-direction:column; gap:14px;">
            
            <!-- Section Header -->
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div>
                    <div style="font-size:0.95rem; font-weight:700; color:#F8FAFC; display:flex; align-items:center; gap:8px;">
                        <span style="color:var(--gold);">${AUDIT_SVGS.terminal}</span>
                        <span>Prompts Système IA & Intelligence de Campagne</span>
                    </div>
                    <div style="font-size:0.75rem; color:#64748B; margin-top:3px;">
                        Modifiez directement les directives régissant la qualification, les réponses conversationnelles et les accroches.
                    </div>
                </div>

                <!-- Action Buttons for active prompt -->
                <div style="display:flex; gap:8px; align-items:center;">
                    <button class="lead-action-btn" id="btn-optimize-active-prompt" style="background:linear-gradient(135deg, rgba(223,165,58,0.2), rgba(223,165,58,0.08)); border:1px solid var(--gold); color:var(--gold); font-weight:700; display:flex; align-items:center; gap:6px;">
                        ${AUDIT_SVGS.sparkles}
                        <span>Améliorer avec l'IA</span>
                    </button>
                    <button class="lead-action-btn" id="btn-reset-active-prompt" title="Restaurer le template d'origine">
                        ${AUDIT_SVGS.restore} Restaurer défaut
                    </button>
                    <button class="lead-action-btn primary" id="btn-save-active-prompt" style="background:rgba(223,165,58,0.15); border-color:var(--gold); color:var(--gold); font-weight:700;">
                        ${AUDIT_SVGS.save} Enregistrer ce prompt
                    </button>
                </div>
            </div>

            <!-- Sub-Tabs Selector for the 4 Prompts -->
            <div style="display:flex; gap:8px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px; flex-wrap:wrap;">
                <button type="button" class="prompt-tab-pill ${activePromptTab === 'audit' ? 'active' : ''}" data-target="audit" style="display:flex; align-items:center; gap:6px; padding:6px 14px; border-radius:6px; font-size:0.8rem; font-weight:600; cursor:pointer; border:1px solid ${activePromptTab === 'audit' ? 'var(--gold)' : 'rgba(255,255,255,0.08)'}; background:${activePromptTab === 'audit' ? 'rgba(223,165,58,0.12)' : '#0A0C10'}; color:${activePromptTab === 'audit' ? 'var(--gold)' : '#94A3B8'}; transition:all 0.15s ease;">
                    ${AUDIT_SVGS.brain} 1. Audit IA
                </button>
                <button type="button" class="prompt-tab-pill ${activePromptTab === 'sms_conversation' ? 'active' : ''}" data-target="sms_conversation" style="display:flex; align-items:center; gap:6px; padding:6px 14px; border-radius:6px; font-size:0.8rem; font-weight:600; cursor:pointer; border:1px solid ${activePromptTab === 'sms_conversation' ? 'var(--gold)' : 'rgba(255,255,255,0.08)'}; background:${activePromptTab === 'sms_conversation' ? 'rgba(223,165,58,0.12)' : '#0A0C10'}; color:${activePromptTab === 'sms_conversation' ? 'var(--gold)' : '#94A3B8'}; transition:all 0.15s ease;">
                    ${AUDIT_SVGS.messageSquare} 2. Conversation SMS & RDV
                </button>
                <button type="button" class="prompt-tab-pill ${activePromptTab === 'sms_outbound' ? 'active' : ''}" data-target="sms_outbound" style="display:flex; align-items:center; gap:6px; padding:6px 14px; border-radius:6px; font-size:0.8rem; font-weight:600; cursor:pointer; border:1px solid ${activePromptTab === 'sms_outbound' ? 'var(--gold)' : 'rgba(255,255,255,0.08)'}; background:${activePromptTab === 'sms_outbound' ? 'rgba(223,165,58,0.12)' : '#0A0C10'}; color:${activePromptTab === 'sms_outbound' ? 'var(--gold)' : '#94A3B8'}; transition:all 0.15s ease;">
                    ${AUDIT_SVGS.send} 3. Accroches SMS Outbound
                </button>
                <button type="button" class="prompt-tab-pill ${activePromptTab === 'documentation' ? 'active' : ''}" data-target="documentation" style="display:flex; align-items:center; gap:6px; padding:6px 14px; border-radius:6px; font-size:0.8rem; font-weight:600; cursor:pointer; border:1px solid ${activePromptTab === 'documentation' ? 'var(--gold)' : 'rgba(255,255,255,0.08)'}; background:${activePromptTab === 'documentation' ? 'rgba(223,165,58,0.12)' : '#0A0C10'}; color:${activePromptTab === 'documentation' ? 'var(--gold)' : '#94A3B8'}; transition:all 0.15s ease;">
                    ${AUDIT_SVGS.book} 4. Documentation Entreprise
                </button>
            </div>

            <!-- Active Prompt Meta Description & Badge -->
            <div id="prompt-meta-box" style="background:#090B0F; border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; font-size:0.78rem;">
                <div id="prompt-desc-text" style="color:#CBD5E1;"></div>
                <div id="prompt-chars-indicator" style="color:#64748B; font-family:monospace; font-weight:600;"></div>
            </div>

            <!-- Single dynamic Textarea for the active prompt -->
            <textarea id="active-prompt-textarea" rows="15" style="width:100%; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size:0.82rem; line-height:1.55; background:#080A0E; color:#CBD5E1; border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:14px; outline:none; resize:vertical; transition:border-color 0.2s ease;" onfocus="this.style.borderColor='var(--gold)';" onblur="this.style.borderColor='rgba(255,255,255,0.08)';"></textarea>
        </div>
    `;

    // Elements & State management
    const promptTextarea = document.getElementById('active-prompt-textarea');
    const promptDescText = document.getElementById('prompt-desc-text');
    const promptCharsIndicator = document.getElementById('prompt-chars-indicator');

    const promptDescriptions = {
        audit: "<strong>Rôle :</strong> Audit IA. Analyse le commerce, le site web et choisit la séquence appropriée.",
        sms_conversation: "<strong>Rôle :</strong> Agent Conversationnel SMS. Répond automatiquement aux SMS des prospects, gère les questions et réserve des créneaux dans Google Calendar.",
        sms_outbound: "<strong>Rôle :</strong> Rédacteur d'accroches Outbound. Génère le premier SMS personnalisé (< 160 car.) avec mention légale [STOP].",
        documentation: "<strong>Rôle :</strong> Base de connaissances officielle de Solutions Quasar Inc. fournie à l'IA pour répondre avec exactitude."
    };

    const getActivePromptContent = () => {
        if (activePromptTab === 'audit') return auditConfig.systemPrompt || DEFAULT_PROMPTS.audit;
        if (activePromptTab === 'sms_conversation') return smsAiConfig.systemPrompt || DEFAULT_PROMPTS.sms_conversation;
        if (activePromptTab === 'sms_outbound') return smsAiConfig.outboundPrompt || DEFAULT_PROMPTS.sms_outbound;
        if (activePromptTab === 'documentation') return smsAiConfig.knowledgeDocumentation || DEFAULT_PROMPTS.documentation;
        return '';
    };

    const updatePromptView = () => {
        const text = getActivePromptContent();
        if (promptTextarea) promptTextarea.value = text;
        if (promptDescText) promptDescText.innerHTML = promptDescriptions[activePromptTab] || '';
        if (promptCharsIndicator) promptCharsIndicator.innerText = `${text.length} caractères`;
    };

    // Initialize prompt textarea
    updatePromptView();

    promptTextarea?.addEventListener('input', () => {
        const text = promptTextarea.value;
        if (promptCharsIndicator) promptCharsIndicator.innerText = `${text.length} caractères`;
        // Sync local in-memory state
        if (activePromptTab === 'audit') auditConfig.systemPrompt = text;
        if (activePromptTab === 'sms_conversation') smsAiConfig.systemPrompt = text;
        if (activePromptTab === 'sms_outbound') smsAiConfig.outboundPrompt = text;
        if (activePromptTab === 'documentation') smsAiConfig.knowledgeDocumentation = text;
    });

    // Sub-tab pills click
    container.querySelectorAll('.prompt-tab-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            activePromptTab = target;

            container.querySelectorAll('.prompt-tab-pill').forEach(b => {
                const isSel = b.getAttribute('data-target') === target;
                b.style.borderColor = isSel ? 'var(--gold)' : 'rgba(255,255,255,0.08)';
                b.style.background = isSel ? 'rgba(223,165,58,0.12)' : '#0A0C10';
                b.style.color = isSel ? 'var(--gold)' : '#94A3B8';
            });

            updatePromptView();
        });
    });

    // Save Active Prompt Button
    document.getElementById('btn-save-active-prompt')?.addEventListener('click', async () => {
        const text = promptTextarea?.value || '';
        if (activePromptTab === 'audit') {
            const isActiveVal = document.getElementById('cfg-audit-is-active')?.value === 'true';
            const freq = parseInt(document.getElementById('cfg-audit-frequency')?.value) || 30;
            const minScore = parseInt(document.getElementById('cfg-audit-min-score')?.value) || 85;
            const autoTrigger = document.getElementById('cfg-audit-auto-trigger')?.checked !== false;

            await saveAuditConfig({
                systemPrompt: text,
                isActive: isActiveVal,
                frequencyMinutes: freq,
                minConfidenceScore: minScore,
                autoTriggerSequences: autoTrigger
            });
        } else if (activePromptTab === 'sms_conversation') {
            smsAiConfig.systemPrompt = text;
            await saveSmsAiConfig(smsAiConfig);
        } else if (activePromptTab === 'sms_outbound') {
            smsAiConfig.outboundPrompt = text;
            await saveSmsAiConfig(smsAiConfig);
        } else if (activePromptTab === 'documentation') {
            smsAiConfig.knowledgeDocumentation = text;
            await saveSmsAiConfig(smsAiConfig);
        }
    });

    // Reset Active Prompt Button
    document.getElementById('btn-reset-active-prompt')?.addEventListener('click', () => {
        const resetAction = async () => {
            const defaultText = DEFAULT_PROMPTS[activePromptTab] || '';
            if (promptTextarea) promptTextarea.value = defaultText;

            if (activePromptTab === 'audit') {
                await resetAuditPrompt();
            } else if (activePromptTab === 'sms_conversation') {
                smsAiConfig.systemPrompt = defaultText;
                await saveSmsAiConfig(smsAiConfig);
            } else if (activePromptTab === 'sms_outbound') {
                smsAiConfig.outboundPrompt = defaultText;
                await saveSmsAiConfig(smsAiConfig);
            } else if (activePromptTab === 'documentation') {
                smsAiConfig.knowledgeDocumentation = defaultText;
                await saveSmsAiConfig(smsAiConfig);
            }
            updatePromptView();
            window.showToast?.("Prompt réinitialisé au template par défaut !", "info");
        };

        if (window.showConfirmModal) {
            window.showConfirmModal({
                title: "Restaurer le Prompt par défaut",
                message: "Voulez-vous vraiment restaurer la version par défaut de Quasar ? Vos modifications actuelles seront remplacées.",
                confirmText: "Restaurer",
                cancelText: "Annuler",
                onConfirm: resetAction
            });
        } else {
            resetAction();
        }
    });

    // Optimize Active Prompt Button
    document.getElementById('btn-optimize-active-prompt')?.addEventListener('click', () => {
        const currentText = promptTextarea?.value || '';
        openPromptOptimizerModal({
            promptType: activePromptTab,
            currentPromptText: currentText,
            onApply: (improvedText) => {
                if (promptTextarea) promptTextarea.value = improvedText;
                if (activePromptTab === 'audit') auditConfig.systemPrompt = improvedText;
                if (activePromptTab === 'sms_conversation') smsAiConfig.systemPrompt = improvedText;
                if (activePromptTab === 'sms_outbound') smsAiConfig.outboundPrompt = improvedText;
                if (activePromptTab === 'documentation') smsAiConfig.knowledgeDocumentation = improvedText;
                if (promptCharsIndicator) promptCharsIndicator.innerText = `${improvedText.length} caractères`;
            }
        });
    });

    // Hook Audit run batch
    document.getElementById('btn-run-audit-now')?.addEventListener('click', async () => {
        const batchSelect = document.getElementById('audit-batch-size-select');
        const bSize = parseInt(batchSelect?.value) || 10;
        await runAuditBatchNow(bSize);
        renderAuditConfigTab(container);
    });
}

/**
 * Open standalone modal for Audit Config
 */
export async function openAuditConfigModal() {
    const modalId = 'modal-audit-config-standalone';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const modalHtml = `
    <div id="${modalId}" class="crm-modal-overlay" style="z-index:9150; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.85); position:fixed; top:0; left:0; width:100vw; height:100vh; backdrop-filter:blur(8px);">
        <div class="crm-modal-content" style="width:100%; max-width:980px; max-height:92vh; background:var(--bg-card); border:1px solid rgba(223,165,58,0.3); border-radius:14px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 25px 60px rgba(0,0,0,0.85);">
            <div style="background:var(--bg-dark); padding:16px 22px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="material-icons" style="color:var(--gold);">psychology</span>
                    <h3 style="margin:0; font-size:1.15rem; color:var(--text-main);">Prompts Système & Audit IA</h3>
                </div>
                <button class="btn btn-xs" onclick="document.getElementById('${modalId}').remove()" style="background:none; border:none; color:var(--text-muted); cursor:pointer;">
                    <span class="material-icons">close</span>
                </button>
            </div>
            <div id="standalone-audit-body" style="padding:22px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:14px;"></div>
            <div style="background:var(--bg-dark); padding:12px 22px; border-top:1px solid var(--border); display:flex; justify-content:flex-end;">
                <button class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">Fermer</button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const bodyContainer = document.getElementById('standalone-audit-body');
    await renderAuditConfigTab(bodyContainer);
}

window.openAuditConfigModal = openAuditConfigModal;
window.auditSingleLeadNow = auditSingleLeadNow;
window.runAuditBatchNow = runAuditBatchNow;
