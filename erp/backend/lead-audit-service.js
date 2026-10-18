/**
 * Solutions Quasar Inc. - Lead Audit & Triangulation IA Service
 * 
 * Pipeline:
 * 1. Crawl & OSINT Scrape (Anti-Homonym Triangulation: Phone, Street, Postal Code)
 * 2. Franchise / Corporate Chain Detection (Strict Exclusion: NEVER Contacted)
 * 3. AI Cognitive Audit via OpenAI with User-Configurable System Prompt
 * 4. Automatic Categorization: 'no_website' | 'outdated_website' | 'modern_no_ai' | 'social_only' | 'franchise'
 * 5. Automatic Workflow Sequence Triggering (Respects Global Dry-Run Mode)
 */

const crypto = require('crypto');
const axios = require('axios');
const OpenAI = require('openai');
const { db } = require('./firebase-admin');
const smsSequenceService = require('./sms-sequence-service');
const aiActivityService = require('./ai-activity-service');
const { detectDirectoryPlatform } = require('./directory-detector');
const phoneValidatorService = require('./phone-validator-service');
const { isCanadianDestination } = require('./telnyx-service');

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const DEFAULT_AUDIT_SYSTEM_PROMPT = `Tu es l'Auditeur Cognitif IA de Solutions Quasar Inc., expert en audit digital et acquisition B2B pour PME locales au Canada et aux USA.
Ton rôle est d'analyser les données collectées d'une entreprise (fiche Google Places, contenu du site web scanné, présences réseaux sociaux, avis) et de :

1. ÉVALUATION ANTI-HOMONYMIE (Triangulation à 3 clés) :
   - Vérifie si le numéro de téléphone extrait de Google Places correspond aux chiffres trouvés sur le site ou les réseaux.
   - Vérifie la cohérence du numéro civique, de la rue et du code postal / ZIP.
   - Attribue un score de confiance global de 0 à 100 sur la certitude que les données appartiennent au bon commerce.
   - Si score < 85, le lead sera marqué 'Ambiguous Match / Review' pour éviter toute erreur de contact.

2. DÉTECTION STRICTE DE FRANCHISE / CHAÎNE CORPORATIVE :
   - Analyse les indices de franchises : multi-succursales, chaîne de salons/restauration/services, mention de 'franchise', 'nos succursales', 'locations', 'store locator', 'devenir franchisé', etc.
   - Si l'entreprise fait partie d'une franchise ou d'une grande chaîne : marque isFranchise = true. Ces entreprises sont STRICTEMENT EXCLUES de la prospection automatique.

3. CATÉGORISATION PRÉCISE DU LEAD - RÈGLES DE VÉRITÉ TERRAIN GOOGLE PLACES :
   ⚠️ ATTENTION : RÈGLE ABSOLUE SUR LA FICHE GOOGLE MAPS / GOOGLE BUSINESS :
   - 'directory_only' : Le commerce n'a PAS de site web dédié officiel. Son bouton "Site Web" sur Google Maps pointe vers un annuaire, un répertoire d'entreprises ou une plateforme de réservation tierce (ex: GOrendezvous, Dash Booking, Fresha, Booksy, Planity, Jane App, Noterro, Booxi, Pages Jaunes, Yelp, etc.). Ces commerces sont dépendants d'un tiers et exposent leurs clients aux concurrents. DOIT TOUJOURS ÊTRE CATÉGORISÉ EN 'directory_only' (Pas de site web dédié).
   - Si google_places_signals.has_website_on_gmb === true (la fiche Google Places a un bouton "Site Web" pointant vers un site officiel) : LE SITE EST DÉJÀ RELIÉ À GOOGLE MAPS.
     -> Il est FORMELLEMENT INTERDIT de catégoriser ce lead en 'missing_gmb_website' ou 'no_website' !
     -> N'inclus JAMAIS de pain point tel que 'Site web non relié à Google Maps' ou 'Absence de site propriétaire sur Google Business'.
   - 'missing_gmb_website' est STRICTEMENT RÉSERVÉ aux commerces dont la fiche Google Maps n'avait AUCUN site (bouton manquant "Ajouter un site web"), mais dont l'IA a retrouvé le site officiel via une recherche Google externe.
   - 'no_website' : Aucun site actif nulle part (ni sur Google Places, ni sur la recherche Google), ou domaine expiré/inaccessible.
   - 'outdated_website' : Site obsolète (design non adapté aux mobiles sans balise viewport, non sécurisé sans HTTPS, copyright ancien < 2022).
   - 'modern_no_ai' : Site web moderne, responsive et fonctionnel, mais SANS agent conversationnel IA 24/7, sans automatisation de réservation, ni intégration ERP intelligente. C'est l'angle d'excellence pour proposer un agent vocal/SMS IA Quasar et une conciergerie automatisée !
   - 'social_only' : Pas de site web propre, mais présence active sur Facebook, Instagram ou LinkedIn.
   - 'franchise' : Grande chaîne ou réseau de franchises.

4. DIAGNOSTIC ET ANGLE COMMERCIAL :
   - Liste 2 à 4 'painPoints' concrets (ex: 'Absence de site web dédié officiel', 'Aucun agent conversationnel IA 24/7 pour capturer les réservations hors heures d'ouverture', 'Prise de rendez-vous manuelle sans automatisation intelligente', 'Dépendance à une plateforme tierce', etc.).
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
}`;

class LeadAuditService {
    constructor() {
        this.config = {
            isActive: true,
            frequencyMinutes: 30,
            batchSize: 10,
            minConfidenceScore: 85,
            autoTriggerSequences: true,
            systemPrompt: DEFAULT_AUDIT_SYSTEM_PROMPT,
            lastRun: null,
            status: 'idle'
        };
        this.schedulerInterval = null;
        this.isProcessingBatch = false;
    }

    /**
     * Initialize service: load config and start scheduler
     */
    async init() {
        await this.loadConfig();
        this.startScheduler();
        console.log(`[LeadAuditService] Initialized. Active: ${this.config.isActive}, Frequency: ${this.config.frequencyMinutes}m, BatchSize: ${this.config.batchSize}`);
    }

    /**
     * Load settings from Firestore
     */
    async loadConfig() {
        try {
            const doc = await db.collection('settings').doc('audit_crawler_config').get();
            if (doc.exists) {
                const data = doc.data();
                this.config = { ...this.config, ...data };
                if (!this.config.systemPrompt || this.config.systemPrompt.trim() === '' || !this.config.systemPrompt.includes('GOrendezvous') || !this.config.systemPrompt.includes('has_website_on_gmb')) {
                    this.config.systemPrompt = DEFAULT_AUDIT_SYSTEM_PROMPT;
                    await this.saveConfig(this.config);
                }
            } else {
                await this.saveConfig(this.config);
            }
        } catch (e) {
            console.error('[LeadAuditService] Error loading config from Firestore:', e.message);
        }
        return this.config;
    }

    /**
     * Save settings to Firestore
     */
    async saveConfig(newConfig) {
        try {
            this.config = { ...this.config, ...newConfig, updated_at: new Date().toISOString() };
            await db.collection('settings').doc('audit_crawler_config').set(this.config, { merge: true });
            
            // Restart scheduler if frequency changed
            this.startScheduler();
            return { success: true, config: this.config };
        } catch (e) {
            console.error('[LeadAuditService] Error saving config:', e.message);
            throw e;
        }
    }

    /**
     * Reset prompt to default
     */
    async resetPrompt() {
        this.config.systemPrompt = DEFAULT_AUDIT_SYSTEM_PROMPT;
        return this.saveConfig({ systemPrompt: DEFAULT_AUDIT_SYSTEM_PROMPT });
    }

    /**
     * Start the background scheduler
     */
    startScheduler() {
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
        }

        if (!this.config.isActive) {
            console.log('[LeadAuditService] Scheduler is PAUSED.');
            return;
        }

        const intervalMs = Math.max(5, this.config.frequencyMinutes || 30) * 60 * 1000;
        console.log(`[LeadAuditService] Starting background audit worker (every ${this.config.frequencyMinutes} minutes)...`);

        this.schedulerInterval = setInterval(async () => {
            if (this.config.isActive && !this.isProcessingBatch) {
                console.log('[LeadAuditService] Background timer triggered. Running scheduled audit batch...');
                try {
                    await this.runAuditBatch(this.config.batchSize);
                } catch (e) {
                    console.error('[LeadAuditService] Background batch error:', e.message);
                }
            }
        }, intervalMs);
    }

    /**
     * Helpers for Deep Contact & OSINT Extraction
     */
    _extractEmailsFromHtml(html) {
        if (!html) return [];
        const mailtoMatches = [...html.matchAll(/href=["']mailto:([^"'\s?]+)/gi)].map(m => m[1].toLowerCase().trim());
        const rawMatches = html.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g) || [];
        const all = [...mailtoMatches, ...rawMatches.map(e => e.toLowerCase().trim())];
        
        const ignoredExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js'];
        const ignoredDomains = ['sentry.io', 'wixpress.com', 'wixsite.com', 'mysite.com', 'wordpress.org', 'schema.org', 'example.com', 'domain.com', 'yourdomain.com', 'email.com', 'w3.org', 'w3schools.com', 'googleapis.com'];

        const valid = all.filter(email => {
            if (ignoredExtensions.some(ext => email.endsWith(ext))) return false;
            if (email.includes('sentry') || email.includes('wixpress') || email.startsWith('example@') || email.startsWith('test@') || /^[a-f0-9]{20,}@/i.test(email)) return false;
            const domain = email.split('@')[1];
            if (!domain || ignoredDomains.some(d => domain === d || domain.endsWith('.' + d))) return false;
            return true;
        });

        // Sort prioritizing common business inboxes
        return [...new Set(valid)].sort((a, b) => {
            const p = ['info@', 'contact@', 'hello@', 'office@', 'admin@', 'dr'];
            const aHas = p.some(x => a.startsWith(x));
            const bHas = p.some(x => b.startsWith(x));
            if (aHas && !bHas) return -1;
            if (!aHas && bHas) return 1;
            return 0;
        });
    }

    _extractPhonesFromHtml(html) {
        if (!html) return [];
        const results = [];
        
        // 1. Tel hrefs
        const telMatches = [...html.matchAll(/href=["']tel:([^"'\s]+)/gi)].map(m => m[1].trim());
        for (const raw of telMatches) {
            const clean = raw.replace(/\D/g, '');
            if (clean.length === 10) {
                results.push({
                    e164: `+1${clean}`,
                    national: `(${clean.slice(0,3)}) ${clean.slice(3,6)}-${clean.slice(6)}`
                });
            } else if (clean.length === 11 && clean.startsWith('1')) {
                const ten = clean.slice(1);
                results.push({
                    e164: `+${clean}`,
                    national: `(${ten.slice(0,3)}) ${ten.slice(3,6)}-${ten.slice(6)}`
                });
            }
        }

        // 2. Text regex (North American format: (XXX) XXX-XXXX, XXX-XXX-XXXX, etc.)
        const textRegex = /(?:\+?1[\s.-]?)?\(?([2-9][0-9]{2})\)?[\s.-]?([2-9][0-9]{2})[\s.-]?([0-9]{4})\b/g;
        const matches = [...html.matchAll(textRegex)];
        for (const match of matches) {
            const area = match[1];
            const prefix = match[2];
            const line = match[3];
            const clean = `${area}${prefix}${line}`;
            if (/^(\d)\1+$/.test(clean)) continue; // ignore dummy e.g. 555-555-5555
            
            const e164 = `+1${clean}`;
            const national = `(${area}) ${prefix}-${line}`;
            if (!results.some(r => r.e164 === e164)) {
                results.push({ e164, national });
            }
        }

        return results;
    }

    _extractSocialsFromHtml(html) {
        const socials = {};
        const ig = html.match(/instagram\.com\/([a-zA-Z0-9._-]+)/i);
        if (ig && !['p', 'explore', 'reel', 'stories', 'about', 'developer'].includes(ig[1].toLowerCase())) {
            socials.instagram = `@${ig[1]}`;
            socials.instagramUrl = `https://instagram.com/${ig[1]}`;
        }
        const fb = html.match(/facebook\.com\/([a-zA-Z0-9._-]+)/i);
        if (fb && !['sharer', 'share', 'dialog', 'plugins', 'tr'].includes(fb[1].toLowerCase())) {
            socials.facebookUrl = `https://facebook.com/${fb[1]}`;
        }
        const li = html.match(/linkedin\.com\/(?:company|in)\/([a-zA-Z0-9._-]+)/i);
        if (li && !['shareArticle', 'sharing', 'feed'].includes(li[1].toLowerCase())) {
            socials.linkedinUrl = `https://linkedin.com/company/${li[1]}`;
        }
        return socials;
    }

    /**
     * Standalone Contact Scraper for any website URL
     */
    async extractContactsFromWebsite(websiteUrl, leadContext = {}) {
        if (!websiteUrl || typeof websiteUrl !== 'string' || websiteUrl.trim() === '') {
            return { success: false, reason: 'NO_URL', emails: [], phones: [], socials: {} };
        }

        let targetUrl = websiteUrl.trim();
        if (!/^https?:\/\//i.test(targetUrl)) {
            targetUrl = 'https://' + targetUrl;
        }

        let html = '';
        let finalUrl = targetUrl;

        try {
            const resp = await axios.get(targetUrl, {
                timeout: 10000,
                maxRedirects: 5,
                maxContentLength: 2 * 1024 * 1024,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 SolutionsQuasarAuditor/2.0',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'fr-CA,fr,en-US,en;q=0.9'
                }
            });
            html = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
            finalUrl = resp.request?.res?.responseUrl || targetUrl;
        } catch (e) {
            // Fallback to http if https failed
            if (targetUrl.startsWith('https://')) {
                try {
                    const httpUrl = targetUrl.replace('https://', 'http://');
                    const respHttp = await axios.get(httpUrl, {
                        timeout: 8000,
                        maxRedirects: 5,
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                    });
                    html = typeof respHttp.data === 'string' ? respHttp.data : JSON.stringify(respHttp.data);
                    finalUrl = httpUrl;
                } catch (err2) {
                    return { success: false, reason: e.message, emails: [], phones: [], socials: {} };
                }
            } else {
                return { success: false, reason: e.message, emails: [], phones: [], socials: {} };
            }
        }

        let combinedHtml = html;

        // Subpage check: if no email on homepage, check /contact or /about
        const initialEmails = this._extractEmailsFromHtml(html);
        if (initialEmails.length === 0) {
            const contactHrefMatch = html.match(/href=["']([^"']*(?:contact|about|touch|reach)[^"']*)["']/i);
            if (contactHrefMatch && contactHrefMatch[1]) {
                const subHref = contactHrefMatch[1];
                try {
                    const parsedBase = new URL(finalUrl);
                    const fullSubUrl = new URL(subHref, parsedBase.origin).href;
                    if (fullSubUrl.startsWith(parsedBase.origin)) {
                        const subResp = await axios.get(fullSubUrl, {
                            timeout: 6000,
                            maxRedirects: 3,
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                        });
                        const subHtml = typeof subResp.data === 'string' ? subResp.data : '';
                        combinedHtml += '\n' + subHtml;
                    }
                } catch (subErr) {
                    // Ignore subpage network error
                }
            }
        }

        const emails = this._extractEmailsFromHtml(combinedHtml);
        const phones = this._extractPhonesFromHtml(combinedHtml);
        const socials = this._extractSocialsFromHtml(combinedHtml);

        const isDirectoryProfile = Boolean(leadContext.isDirectoryProfile) || 
                                   detectDirectoryPlatform(finalUrl).isDirectory || 
                                   detectDirectoryPlatform(targetUrl).isDirectory;

        // Clean out third-party platform corporate socials (e.g. gorendezvous, dashbooking, fresha...)
        if (isDirectoryProfile) {
            if (socials.linkedinUrl && /gorendezvous|dash-?booking|fresha|booksy|planity|janeapp|noterro/i.test(socials.linkedinUrl)) {
                socials.linkedinUrl = null;
            }
            if (socials.facebookUrl && /facebook\.com\/(?:gorendezvous|dashbooking|fresha|booksy|planity)/i.test(socials.facebookUrl)) {
                socials.facebookUrl = null;
            }
            if (socials.instagram && /gorendezvous|dash\.?booking|fresha|booksy/i.test(socials.instagram)) {
                socials.instagram = null;
                socials.instagramUrl = null;
            }
        }

        // Apollo.io B2B Enrichment (LinkedIn, Corporate Phone, Industry) - STRICTLY skipped for directory/booking platforms!
        let apolloData = null;
        if (process.env.APOLLO_API_KEY && finalUrl && !isDirectoryProfile) {
            try {
                apolloData = await this.enrichOrganizationWithApollo(finalUrl);
            } catch (_) {}
        }

        return {
            success: true,
            primaryEmail: emails[0] || null,
            emails,
            primaryPhone: phones[0] ? phones[0].e164 : (apolloData?.phone || null),
            primaryPhoneFormatted: phones[0] ? phones[0].national : (apolloData?.phone || null),
            phones,
            socials,
            instagram: socials.instagram || null,
            facebook: socials.facebookUrl || null,
            linkedin: socials.linkedinUrl || apolloData?.linkedin || null,
            apollo: apolloData || null
        };
    }

    /**
     * Enrich organization with Apollo.io (free tier: organizations/enrich)
     */
    async enrichOrganizationWithApollo(websiteUrl) {
        const apiKey = process.env.APOLLO_API_KEY;
        if (!apiKey || !websiteUrl) return null;

        try {
            const cleanDomain = websiteUrl
                .replace(/^https?:\/\//i, '')
                .replace(/^www\./i, '')
                .split('/')[0]
                .trim();
            if (!cleanDomain || cleanDomain.length < 4) return null;

            const resp = await axios.get(`https://api.apollo.io/v1/organizations/enrich?domain=${encodeURIComponent(cleanDomain)}`, {
                headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
                timeout: 6000
            });

            if (resp.data && resp.data.organization) {
                const org = resp.data.organization;
                return {
                    source: 'APOLLO',
                    name: org.name || null,
                    phone: org.phone || null,
                    linkedin: org.linkedin_url || null,
                    industry: org.industry || null,
                    employees: org.estimated_num_employees || null,
                    city: org.city || null,
                    state: org.state || null,
                    country: org.country || null
                };
            }
        } catch (e) {
            // Silently ignore if Apollo rate limits or domain not found
        }
        return null;
    }

    /**
     * Search Google & the web (DuckDuckGo + Google fallback) for a business's real website
     * when it is missing from Google Places / Google Business Profile
     */
    async searchWebForBusinessWebsite(businessName, city = '', province = '', phone = '') {
        if (!businessName || typeof businessName !== 'string' || businessName.trim() === '') {
            return { found: false, url: null };
        }

        const cleanBiz = businessName.trim();
        const cleanCity = (city || '').trim();
        const cleanProv = (province || '').trim();
        const query = `${cleanBiz} ${cleanCity} ${cleanProv}`.trim();

        console.log(`[LeadAuditService] Searching Google/web for: "${query}"...`);

        const ignoredDomains = [
            'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com',
            'youtube.com', 'tiktok.com', 'pinterest.com',
            'yellowpages.ca', 'pagesjaunes.ca', 'yelp.ca', 'yelp.com', '411.ca',
            'canadapages.com', 'cylex-canada.com', 'mapquest.com', 'tripadvisor.com',
            'zoominfo.com', 'bbb.org', 'wikipedia.org', 'google.com', 'apple.com',
            'bing.com', 'yahoo.com', 'opencorporates.com', 'infobel.com', 'ratemds.com',
            'cortico.health', 'chambers.com', 'dnb.com', 'waze.com'
        ];

        const isIgnoredCandidateUrl = (urlStr) => {
            if (!urlStr || typeof urlStr !== 'string') return true;
            try {
                const u = new URL(urlStr);
                const host = u.hostname.toLowerCase().replace(/^www\./, '');
                if (detectDirectoryPlatform(urlStr).isDirectory) return true;
                if (ignoredDomains.some(d => host === d || host.endsWith('.' + d))) return true;
                return false;
            } catch (_) {
                return true;
            }
        };

        const candidateUrls = [];

        // 1. Serper.dev Google Search API (Fast, structured, real-time Google Search)
        const serperApiKey = process.env.SERPER_API_KEY;
        if (serperApiKey) {
            try {
                console.log(`[LeadAuditService] Querying Serper.dev Google Search for "${query}"...`);
                const serperResp = await axios.post('https://google.serper.dev/search', {
                    q: query,
                    gl: 'ca',
                    hl: 'fr'
                }, {
                    headers: {
                        'X-API-KEY': serperApiKey,
                        'Content-Type': 'application/json'
                    },
                    timeout: 8000
                });
                if (serperResp.data && Array.isArray(serperResp.data.organic)) {
                    for (const item of serperResp.data.organic) {
                        try {
                            if (!isIgnoredCandidateUrl(item.link)) {
                                const u = new URL(item.link);
                                const rootUrl = `${u.protocol}//${u.hostname}`;
                                if (!candidateUrls.includes(rootUrl)) candidateUrls.push(rootUrl);
                            }
                        } catch (_) {}
                    }
                }
                if (candidateUrls.length > 0) {
                    console.log(`[LeadAuditService] Serper.dev found ${candidateUrls.length} candidate URLs.`);
                }
            } catch (serperErr) {
                console.warn('[LeadAuditService] Serper.dev note:', serperErr.response?.data?.message || serperErr.message);
            }
        }

        // 2. Google Custom Search API (Official & Structured Google Results)
        if (candidateUrls.length === 0) {
            try {
                const hunterDoc = await db.collection('settings').doc('hunter_autopilot_config').get();
                const apiKey = (hunterDoc.exists && hunterDoc.data().apiKey) ? hunterDoc.data().apiKey : process.env.GOOGLE_PLACES_API_KEY;
                const cx = process.env.GOOGLE_CUSTOM_SEARCH_CX || '26ba6593ed9dc444e';

                if (apiKey && cx) {
                    console.log(`[LeadAuditService] Querying Google Custom Search API for "${query}" (cx: ${cx})...`);
                    const csUrl = `https://customsearch.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}`;
                    const csResp = await axios.get(csUrl, {
                        headers: { 'Referer': 'http://localhost:3002/' },
                        timeout: 8000
                    });
                    if (csResp.data && csResp.data.items && Array.isArray(csResp.data.items)) {
                        for (const item of csResp.data.items) {
                            try {
                                if (!isIgnoredCandidateUrl(item.link)) {
                                    const u = new URL(item.link);
                                    const rootUrl = `${u.protocol}//${u.hostname}`;
                                    if (!candidateUrls.includes(rootUrl)) candidateUrls.push(rootUrl);
                                }
                            } catch (_) {}
                        }
                    }
                }
            } catch (csErr) {
                console.warn('[LeadAuditService] Google Custom Search API note:', csErr.response?.data?.error?.message || csErr.message);
            }
        }

        // 3. OpenAI Cognitive Website Discovery (LLM Real-world Domain Reasoning)
        if (candidateUrls.length === 0 && openai) {
            try {
                console.log(`[LeadAuditService] Querying OpenAI Cognitive Finder for "${cleanBiz}" (${cleanCity}, ${cleanProv})...`);
                const completion = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an AI specialized in identifying the official website URL of businesses in Canada/USA. Respond ONLY with the clean official website URL starting with https:// or http://, or NOT_FOUND.'
                        },
                        {
                            role: 'user',
                            content: `What is the official website for:\nBusiness: ${cleanBiz}\nCity: ${cleanCity || 'Unknown'}\nProvince/State: ${cleanProv || 'Unknown'}\nPhone: ${phone || 'Unknown'}`
                        }
                    ],
                    temperature: 0
                });
                const aiUrlRaw = completion.choices[0]?.message?.content?.trim() || '';
                if (aiUrlRaw && aiUrlRaw.startsWith('http') && !aiUrlRaw.includes('NOT_FOUND')) {
                    if (!isIgnoredCandidateUrl(aiUrlRaw)) {
                        const parsedAiUrl = new URL(aiUrlRaw);
                        const rootUrl = `${parsedAiUrl.protocol}//${parsedAiUrl.hostname}`;
                        console.log(`[LeadAuditService] OpenAI suggested candidate URL: ${rootUrl}`);
                        candidateUrls.push(rootUrl);
                    }
                }
            } catch (aiErr) {
                console.warn('[LeadAuditService] OpenAI website finder note:', aiErr.message);
            }
        }

        // 4. DuckDuckGo HTML Search (Fallback)
        if (candidateUrls.length === 0) {
            try {
                const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
                const resp = await axios.get(ddgUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'fr-CA,fr,en-US,en;q=0.9'
                    },
                    timeout: 8000
                });

                const html = typeof resp.data === 'string' ? resp.data : '';
                const uddgMatches = [...html.matchAll(/uddg=([^&"']+)/gi)];
                for (const m of uddgMatches) {
                    try {
                        const decoded = decodeURIComponent(m[1]);
                        if (!isIgnoredCandidateUrl(decoded)) {
                            const u = new URL(decoded);
                            const rootUrl = `${u.protocol}//${u.hostname}`;
                            if (!candidateUrls.includes(rootUrl)) candidateUrls.push(rootUrl);
                        }
                    } catch (_) {}
                }
            } catch (ddgErr) {
                console.warn('[LeadAuditService] DuckDuckGo search note:', ddgErr.message);
            }
        }

        // 2. Google Search Fallback if DuckDuckGo didn't find candidate
        if (candidateUrls.length === 0) {
            try {
                const gUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=fr&gl=ca`;
                const respG = await axios.get(gUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SolutionsQuasarHunter/2.0',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'fr-CA,fr,en-US,en;q=0.9'
                    },
                    timeout: 8000
                });
                const gHtml = typeof respG.data === 'string' ? respG.data : '';
                const gMatches = [...gHtml.matchAll(/\/url\?q=(https?:\/\/[^&"']+)/gi)];
                for (const m of gMatches) {
                    try {
                        const decoded = decodeURIComponent(m[1]);
                        if (!isIgnoredCandidateUrl(decoded)) {
                            const u = new URL(decoded);
                            const rootUrl = `${u.protocol}//${u.hostname}`;
                            if (!candidateUrls.includes(rootUrl)) candidateUrls.push(rootUrl);
                        }
                    } catch (_) {}
                }
            } catch (gErr) {
                console.warn('[LeadAuditService] Google search fallback note:', gErr.message);
            }
        }

        // 3. Validate Candidate URLs against business signals
        const cleanPhoneDigits = (phone || '').replace(/\D/g, '');
        const phone7 = cleanPhoneDigits.length >= 7 ? cleanPhoneDigits.slice(-7) : null;
        const nameKeywords = cleanBiz
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length >= 4 && !['inc', 'ltd', 'corp', 'clinic', 'clinique', 'salon', 'services', 'groupe'].includes(w));

        for (const candidate of candidateUrls.slice(0, 3)) {
            try {
                const testResp = await axios.get(candidate, {
                    timeout: 6000,
                    maxRedirects: 4,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });
                const testHtml = (typeof testResp.data === 'string' ? testResp.data : '').toLowerCase();
                const testText = testHtml.replace(/<[^>]+>/g, ' ');

                // Check 1: Phone match
                if (phone7 && testText.replace(/\D/g, '').includes(phone7)) {
                    console.log(`[LeadAuditService] Validated website ${candidate} by PHONE match (${phone7})!`);
                    return { found: true, url: candidate, source: 'web_search_phone_match' };
                }

                // Check 2: Name keyword match in domain or content
                const candHost = new URL(candidate).hostname.toLowerCase();
                const matchedKeyword = nameKeywords.find(kw => candHost.includes(kw) || testText.includes(kw));
                if (matchedKeyword) {
                    // Check if city also matches
                    if (!cleanCity || testText.includes(cleanCity.toLowerCase())) {
                        console.log(`[LeadAuditService] Validated website ${candidate} by KEYWORD (${matchedKeyword}) & CITY (${cleanCity}) match!`);
                        return { found: true, url: candidate, source: 'web_search_keyword_match' };
                    }
                }
            } catch (_) {}
        }

        // If candidates found and domain resembles business name, return top candidate
        if (candidateUrls.length > 0) {
            const topCandidate = candidateUrls[0];
            const candHost = new URL(topCandidate).hostname.toLowerCase();
            if (nameKeywords.some(kw => candHost.includes(kw))) {
                return { found: true, url: topCandidate, source: 'web_search_domain_heuristic' };
            }
        }

        return { found: false, url: null };
    }

    /**
     * Crawl website and extract anti-homonym & technical signals & contact details
     */
    async crawlWebsite(websiteUrl, leadContext = {}) {
        if (!websiteUrl || typeof websiteUrl !== 'string' || websiteUrl.trim() === '') {
            return {
                reachable: false,
                reason: 'NO_URL'
            };
        }

        let targetUrl = websiteUrl.trim();
        if (!/^https?:\/\//i.test(targetUrl)) {
            targetUrl = 'https://' + targetUrl;
        }

        try {
            let response;
            try {
                response = await axios.get(targetUrl, {
                    timeout: 10000,
                    maxRedirects: 5,
                    maxContentLength: 2 * 1024 * 1024, // 2MB
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 SolutionsQuasarAuditor/2.0',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'fr-CA,fr,en-US,en;q=0.9'
                    }
                });
            } catch (errHttps) {
                if (targetUrl.startsWith('https://')) {
                    const httpUrl = targetUrl.replace('https://', 'http://');
                    response = await axios.get(httpUrl, {
                        timeout: 8000,
                        maxRedirects: 5,
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                    });
                } else {
                    throw errHttps;
                }
            }

            const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
            const lowerHtml = html.toLowerCase();

            // Extract title
            const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

            // Extract meta description
            const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                              html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
            const metaDescription = descMatch ? descMatch[1].trim() : '';

            // Extract Schema.org JSON-LD structured data (address, phone, name)
            const ldJsonMatches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
            const ldJsonText = ldJsonMatches.map(m => m[1]).join(' ');

            // Extract clean text (strip scripts and styles, but keep ld+json content for OSINT)
            const cleanText = (ldJsonText + ' ' + html
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim());

            const finalUrl = response.request?.res?.responseUrl || targetUrl;

            // 1. Mobile Responsiveness check
            const hasViewport = /<meta[^>]*name=["']viewport["']/i.test(html);

            // 2. HTTPS / SSL (Checks final resolved URL in case of HTTP -> HTTPS redirect)
            const isHttps = finalUrl.startsWith('https://') || targetUrl.startsWith('https://');

            // 3. Copyright year detection
            let copyrightYear = null;
            const copyMatch = cleanText.match(/(?:©|&copy;|copyright)\s*(?:[12][90]\d\d\s*[-–]\s*)?([12][90]\d\d)/i);
            if (copyMatch && copyMatch[1]) {
                copyrightYear = parseInt(copyMatch[1], 10);
            }

            // 4. Conversational AI / Chat widgets detection
            const chatKeywords = [
                'crisp.chat', 'intercom', 'drift.com', 'tidio', 'zendesk', 'livechat',
                'chatra', 'tawk.to', 'hubspot-messages', 'vapi', 'elevenlabs', 'openai'
            ];
            const hasChatWidget = chatKeywords.some(kw => lowerHtml.includes(kw));

            // 5. Contact Extraction (Phones, Emails, Socials)
            const extractedContacts = await this.extractContactsFromWebsite(finalUrl, leadContext);

            // 6. Franchise & Multi-Location keywords detection
            const franchiseKeywords = [
                'franchise', 'franchises', 'our locations', 'nos succursales', 'store locator',
                'locations', 'devenir franchisé', 'devenir franchisée', 'join our team of franchisees',
                'corporate office', 'franchise opportunity', 'siège social', 'find a store',
                'trouver un salon', 'trouver une succursale', 'nos cliniques'
            ];
            const detectedFranchiseKeywords = franchiseKeywords.filter(kw => lowerHtml.includes(kw));
            const hasStoreLocator = /store[-_]?locator|our[-_]?locations|nos[-_]?succursales/i.test(html);
            const isLikelyFranchise = detectedFranchiseKeywords.length >= 2 || (hasStoreLocator && detectedFranchiseKeywords.length >= 1);

            const dirDetect = detectDirectoryPlatform(finalUrl);
            const isDirectoryProfile = Boolean(leadContext.isDirectoryProfile || dirDetect.isDirectory);
            const directoryPlatform = leadContext.directoryPlatform || dirDetect.platformName;

            return {
                reachable: true,
                finalUrl,
                title,
                metaDescription,
                textSnippet: cleanText.slice(0, 5000), // First 5000 chars for AI
                fullCleanText: cleanText,
                rawHtml: typeof html === 'string' ? html.slice(0, 80000) : '',
                hasViewport,
                isHttps,
                copyrightYear,
                hasChatWidget: isDirectoryProfile ? false : hasChatWidget,
                isDirectoryProfile,
                directoryPlatform,
                socialLinks: {
                    facebook: Boolean(extractedContacts.facebook),
                    instagram: Boolean(extractedContacts.instagram),
                    linkedin: Boolean(extractedContacts.linkedin)
                },
                extractedContacts,
                franchiseSignals: {
                    detectedKeywords: detectedFranchiseKeywords,
                    hasStoreLocator,
                    isLikelyFranchise
                }
            };
        } catch (e) {
            return {
                reachable: false,
                reason: e.message || 'CRAWL_FAILED'
            };
        }
    }

    /**
     * CASL / LCAP Compliance Verification (Article 10(9)(b) - Conspicuous Publication)
     * Verifies whether a Canadian prospect's phone is conspicuously published on their
     * official business website without any no-solicitation restrictions.
     */
    evaluateCaslCompliance(lead, crawlResult) {
        const phone = lead.phone || lead.phone_number || '';
        const isCanadian = isCanadianDestination(phone, lead);

        // For non-Canadian leads (e.g. USA), CASL does not apply (US TCPA / 10DLC applies)
        if (!isCanadian) {
            return {
                jurisdiction: 'US',
                applies: false,
                status: 'NOT_APPLICABLE',
                basis: 'us_destination',
                message: 'Destination américaine (régie par TCPA / 10DLC Telnyx, LCAP non applicable).'
            };
        }

        const cleanDigits = phone.replace(/\D/g, '');
        const last10Digits = cleanDigits.slice(-10);

        const pageText = (crawlResult?.fullCleanText || crawlResult?.textSnippet || '').toLowerCase();
        const rawHtml = (crawlResult?.rawHtml || '').toLowerCase();

        // 1. Check for anti-solicitation restrictions (English & French)
        const solicitationPatterns = [
            { pattern: /\bno\s+solicitation[s]?\b/i, phrase: 'no solicitation' },
            { pattern: /\bno\s+unsolicited\s+(?:commercial\s+)?(?:messages?|emails?|calls?|texts?)\b/i, phrase: 'no unsolicited messages' },
            { pattern: /\bno\s+commercial\s+(?:messages?|emails?|inquiries)\b/i, phrase: 'no commercial messages' },
            { pattern: /\bno\s+sales\s+calls\b/i, phrase: 'no sales calls' },
            { pattern: /\bno\s+marketing\s+(?:messages?|emails?|calls?)\b/i, phrase: 'no marketing' },
            { pattern: /\bsolicitations?\s+(?:strictly\s+)?prohibited\b/i, phrase: 'solicitations prohibited' },
            { pattern: /\bdo\s+not\s+contact\s+(?:for\s+commercial|with\s+unsolicited)\b/i, phrase: 'do not contact for commercial' },
            { pattern: /\baucune\s+sollicitation\b/i, phrase: 'aucune sollicitation' },
            { pattern: /\bpas\s+de\s+sollicitation\b/i, phrase: 'pas de sollicitation' },
            { pattern: /\baucun\s+message\s+commercial\b/i, phrase: 'aucun message commercial' },
            { pattern: /\bsollicitation\s+(?:strictement\s+)?interdite\b/i, phrase: 'sollicitation interdite' },
            { pattern: /\bne\s+pas\s+contacter\s+à\s+des\s+fins\s+commerciales\b/i, phrase: 'ne pas contacter à des fins commerciales' }
        ];

        const detectedRestrictions = [];
        for (const sp of solicitationPatterns) {
            if (sp.pattern.test(pageText) || (rawHtml && sp.pattern.test(rawHtml))) {
                detectedRestrictions.push(sp.phrase);
            }
        }
        const hasSolicitationRestriction = detectedRestrictions.length > 0;

        // 2. Check if the phone is conspicuously published on official site
        const isReachable = Boolean(crawlResult && crawlResult.reachable);
        const isDirectory = Boolean(crawlResult && crawlResult.isDirectoryProfile);
        
        let phoneFoundInContent = false;
        let contextSnippet = null;

        if (last10Digits.length === 10 && (pageText || rawHtml)) {
            const pRegex = new RegExp(
                `${last10Digits.slice(0, 3)}[\\s.-]?${last10Digits.slice(3, 6)}[\\s.-]?${last10Digits.slice(6, 10)}`,
                'i'
            );
            
            const fullTxt = crawlResult?.fullCleanText || crawlResult?.textSnippet || '';
            const match = fullTxt.match(pRegex);
            if (match) {
                phoneFoundInContent = true;
                const idx = fullTxt.indexOf(match[0]);
                const start = Math.max(0, idx - 40);
                const end = Math.min(fullTxt.length, idx + match[0].length + 40);
                contextSnippet = fullTxt.substring(start, end).replace(/\s+/g, ' ').trim();
            } else if (rawHtml.includes(last10Digits)) {
                phoneFoundInContent = true;
                contextSnippet = `Numéro ${phone} détecté dans le code source de la page officielle.`;
            }
        }

        // Also check extracted contacts from website crawler
        if (!phoneFoundInContent && crawlResult?.extractedContacts?.phones) {
            const extPhones = (crawlResult.extractedContacts.phones || []).map(p => {
                const raw = typeof p === 'string' ? p : (p?.e164 || p?.national || '');
                return raw.replace(/\D/g, '').slice(-10);
            });
            if (extPhones.includes(last10Digits)) {
                phoneFoundInContent = true;
                contextSnippet = `Numéro ${phone} extrait des balises de contact du site officiel.`;
            }
        }

        // 3. Compute SHA256 hash of page text for legal evidence archive
        const textSample = (crawlResult?.fullCleanText || crawlResult?.textSnippet || '').slice(0, 4000);
        const evidenceHash = crypto.createHash('sha256').update(textSample).digest('hex').substring(0, 16);

        // 4. Determine CASL Status
        let status = 'REVIEW';
        let notes = '';

        if (hasSolicitationRestriction) {
            status = 'INELIGIBLE';
            notes = `Restriction explicite détectée : "${detectedRestrictions.join(', ')}". Sollicitation commerciale interdite par l'entreprise (LCAP art. 10(9)(b)).`;
        } else if (!isReachable) {
            status = 'REVIEW';
            notes = 'Site web inaccessible lors de l\'audit : impossible d\'attester la publication bien en vue.';
        } else if (isDirectory) {
            status = 'REVIEW';
            notes = `Numéro présent sur un annuaire / plateforme tierce (${crawlResult.directoryPlatform || 'annuaire'}). Ne constitue pas une publication directe de l'entreprise au sens du CRTC.`;
        } else if (phoneFoundInContent) {
            status = 'ELIGIBLE';
            notes = 'Numéro publié bien en vue sur le site officiel de l\'entreprise sans mention d\'interdiction de sollicitation. Conforme LCAP art. 10(9)(b).';
        } else {
            status = 'REVIEW';
            notes = 'Numéro non détecté dans le texte du site officiel (possiblement sur Google Maps uniquement ou dans une image). Vérification manuelle requise.';
        }

        return {
            jurisdiction: 'CA',
            applies: true,
            status, // 'ELIGIBLE' | 'REVIEW' | 'INELIGIBLE'
            basis: 'conspicuous_publication',
            source_type: isDirectory ? 'third_party_directory' : (isReachable ? 'official_business_website' : 'unreachable'),
            source_url: crawlResult?.finalUrl || lead.website || '',
            captured_at: new Date().toISOString(),
            published_phone: phone,
            published_phone_matched: phoneFoundInContent,
            publication_context: contextSnippet,
            no_solicitation_restriction_found: hasSolicitationRestriction,
            solicitation_restriction_keywords: detectedRestrictions,
            evidence_hash: `sha256:${evidenceHash}`,
            relevance_reason: "Audit technique, optimisation mobile/SEO et modernisation de l'expérience client du site web officiel de l'entreprise.",
            notes
        };
    }

    /**
     * Anti-Homonym Triangulation: Phone + Address + Name matching
     */
    calculateTriangulationScore(lead, crawlResult) {
        if (!crawlResult || !crawlResult.reachable || crawlResult.isDirectoryProfile) {
            // If lead has no website or is listed only on a third-party directory, confidence is high
            return {
                confidenceScore: 95,
                antiHomonymMatched: true,
                phoneMatched: Boolean(crawlResult?.extractedContacts?.primaryPhone),
                addressMatched: true,
                nameMatched: true,
                details: crawlResult?.isDirectoryProfile 
                    ? `Commerce répertorié sur la plateforme tierce ${crawlResult.directoryPlatform || 'annuaire'}.`
                    : 'Lead has no reachable website.'
            };
        }

        let score = 20; // Base score for having an indexed URL on Google Places
        let phoneMatched = false;
        let addressMatched = false;
        let nameMatched = false;

        const textToSearch = (crawlResult.fullCleanText || (crawlResult.title + ' ' + crawlResult.metaDescription + ' ' + (crawlResult.textSnippet || ''))).toLowerCase();

        // 1. Phone Anchor (Highest weight: 45 pts)
        let rawPhone = lead.phone || lead.phone_number || '';
        // If lead had no phone in database, but website has a clear verified phone, adopt it
        if (!rawPhone && crawlResult.extractedContacts?.primaryPhone) {
            rawPhone = crawlResult.extractedContacts.primaryPhone;
            phoneMatched = true;
            score += 45;
        } else {
            const cleanDigits = rawPhone.replace(/\D/g, '');
            if (cleanDigits.length >= 7) {
                const last7 = cleanDigits.slice(-7);
                const last10 = cleanDigits.slice(-10);
                
                // Check formatted or direct digits in full text
                const formattedDashes = `${last7.slice(0,3)}-${last7.slice(3)}`;
                const cleanTextDigits = textToSearch.replace(/\D/g, '');

                // Check structured extracted phone objects from deep crawl
                const extractedPhones = crawlResult.extractedContacts?.phones || [];
                const anyExtractedPhoneMatch = extractedPhones.some(p => {
                    const numDigits = (p.e164 || p.national || p.number || '').replace(/\D/g, '');
                    return numDigits.includes(last7) || numDigits.includes(last10) || cleanDigits.includes(numDigits.slice(-7));
                });

                if (anyExtractedPhoneMatch || cleanTextDigits.includes(last7) || cleanTextDigits.includes(last10) || textToSearch.includes(formattedDashes)) {
                    score += 45;
                    phoneMatched = true;
                }
            }
        }

        // 2. Geographic Anchor: Street Number, Postal Code & City (Weight: 35 pts)
        let postalCode = (lead.postal_code || lead.zip_code || '').replace(/\s+/g, '').toLowerCase();
        const streetAddress = (lead.street_address || lead.address || '').toLowerCase();
        
        // Auto-extract postal code / ZIP from address string if not already set
        if (!postalCode && streetAddress) {
            const pMatch = streetAddress.match(/\b([A-Za-z]\d[A-Za-z]\s*\d[A-Za-z]\d|\d{5}(?:-\d{4})?)\b/);
            if (pMatch) postalCode = pMatch[1].replace(/\s+/g, '').toLowerCase();
        }

        const streetNumberMatch = streetAddress.match(/^(\d+)/);
        const streetNum = streetNumberMatch ? streetNumberMatch[1] : '';
        const cityToMatch = (lead.city || '').toLowerCase().trim();

        let geoMatches = 0;
        if (postalCode && postalCode.length >= 3) {
            const cleanTextPostal = textToSearch.replace(/\s+/g, '');
            if (cleanTextPostal.includes(postalCode)) {
                geoMatches++;
            }
        }
        if (streetNum && streetNum.length >= 2) {
            const wordBoundaryNum = new RegExp(`\\b${streetNum}\\b`);
            if (wordBoundaryNum.test(textToSearch)) {
                geoMatches++;
            }
        }
        if (cityToMatch && cityToMatch.length >= 3 && textToSearch.includes(cityToMatch)) {
            geoMatches++;
        }

        if (geoMatches >= 2) {
            score += 35;
            addressMatched = true;
        } else if (geoMatches === 1) {
            score += 20;
            addressMatched = true;
        }

        // 3. Name & Domain Anchor (Weight: 20-35 pts)
        const businessName = (lead.business_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const domain = (lead.website || '').toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/[^a-z0-9]/g, '');

        if (businessName.length >= 4 && (domain.includes(businessName) || businessName.includes(domain.replace(/(com|ca|net|org|co)$/, '')))) {
            score += 35;
            nameMatched = true;
        } else if (businessName.length >= 4 && domain.includes(businessName.slice(0, 6))) {
            score += 20;
            nameMatched = true;
        }

        // 4. Google Places Verified Linkage: If website was directly linked on GMB and name/domain matched
        if (!lead.google_business_missing_website && lead.website && nameMatched) {
            score += 20;
        }

        const finalScore = Math.min(100, score);
        const antiHomonymMatched = finalScore >= (this.config.minConfidenceScore || 85);

        return {
            confidenceScore: finalScore,
            antiHomonymMatched,
            phoneMatched,
            addressMatched,
            nameMatched,
            details: `Phone: ${phoneMatched ? 'MATCH' : 'MISMATCH'}, Address: ${addressMatched ? 'MATCH' : 'MISMATCH'}, Name: ${nameMatched ? 'MATCH' : 'MISMATCH'}`
        };
    }

    /**
     * Fallback Heuristic Classifier (When OpenAI is unavailable)
     */
    fallbackClassification(lead, crawlResult, triangulation) {
        // 0. Directory Only Check (Merchant is on Dash Booking, Fresha, Booksy, Pages Jaunes, etc. without proprietary website)
        if (lead.has_directory_only || (crawlResult?.isDirectoryProfile && !lead.google_business_missing_website)) {
            const platformName = lead.directory_platform || crawlResult?.directoryPlatform || 'un annuaire tiers';
            return {
                category: 'directory_only',
                isFranchise: false,
                franchiseReason: '',
                confidenceScore: triangulation.confidenceScore || 95,
                antiHomonymMatched: triangulation.antiHomonymMatched !== false,
                painPoints: [
                    `Dépendance à la plateforme tierce (${platformName})`,
                    'Absence de nom de domaine et de vitrine Google officielle',
                    'Clients exposés aux commerces concurrents répertoriés sur la même plateforme',
                    'Frais d\'intermédiation récurrents sans valorisation de son propre actif'
                ],
                auditSummary: `L'entreprise n'a pas de site web propre : sa fiche Google Maps redirige vers ${platformName}. Ses clients y voient directement des établissements concurrents.`,
                recommendedAngle: `Proposer de reprendre le contrôle de leur clientèle avec leur propre vitrine web officielle et un agent de réservation IA autonome, sans commission ni concurrence directe.`
            };
        }

        // 1. Franchise Check
        if (crawlResult?.franchiseSignals?.isLikelyFranchise) {
            return {
                category: 'franchise',
                isFranchise: true,
                franchiseReason: `Franchise signals detected: ${crawlResult.franchiseSignals.detectedKeywords.join(', ')}`,
                confidenceScore: triangulation.confidenceScore,
                antiHomonymMatched: triangulation.antiHomonymMatched,
                painPoints: ['Grande chaîne ou réseau de succursales'],
                auditSummary: "Détecté comme franchise ou chaîne corporative multi-succursales.",
                recommendedAngle: "Exclu de la prospection automatique."
            };
        }

        // 2. Missing GMB Website (Website exists and is reachable, but is NOT linked on Google Business Profile!)
        if (lead.google_business_missing_website && crawlResult?.reachable) {
            return {
                category: 'missing_gmb_website',
                isFranchise: false,
                franchiseReason: '',
                confidenceScore: triangulation.confidenceScore,
                antiHomonymMatched: triangulation.antiHomonymMatched,
                painPoints: [
                    'Site web officiel non relié à la fiche Google Business / Google Maps',
                    'Fiche Google Maps incomplète affichant "Ajouter un site web" aux clients',
                    'Perte de trafic local et de réservations directes sur Google Maps'
                ],
                auditSummary: `L'entreprise possède un site internet actif (${crawlResult.finalUrl || lead.website}), mais celui-ci n'est pas répertorié sur sa fiche Google Business / Google Maps, privant les prospects d'un accès direct.`,
                recommendedAngle: `Alerter le dirigeant sur le fait que les prospects sur Google Maps ne peuvent pas cliquer vers son site web, et lui proposer de synchroniser sa fiche Google tout en connectant un tunnel de réservation direct.`
            };
        }

        // 3. No Website (Neither on Google Places nor on Google Search)
        if (!crawlResult || !crawlResult.reachable || crawlResult.reason === 'NO_URL') {
            return {
                category: 'no_website',
                isFranchise: false,
                franchiseReason: '',
                confidenceScore: triangulation.confidenceScore,
                antiHomonymMatched: triangulation.antiHomonymMatched,
                painPoints: ['Absence de site internet officiel', 'Perte de crédibilité face aux concurrents', 'Aucune visibilité Google directe'],
                auditSummary: "L'entreprise ne dispose d'aucun site web actif, ce qui limite son acquisition locale.",
                recommendedAngle: "Proposition de création de site web moderne, rapide et optimisé pour le référencement local."
            };
        }

        // 3. Outdated Website (Copyright < 2022, no viewport, or no SSL)
        const currentYear = new Date().getFullYear();
        const isOldCopyright = crawlResult.copyrightYear && crawlResult.copyrightYear < (currentYear - 3);
        const isOutdated = !crawlResult.hasViewport || !crawlResult.isHttps || isOldCopyright;

        if (isOutdated) {
            const painPoints = [];
            if (!crawlResult.hasViewport) painPoints.push('Non optimisé pour mobiles et téléphones');
            if (!crawlResult.isHttps) painPoints.push('Connexion non sécurisée (absence de SSL/HTTPS)');
            if (isOldCopyright) painPoints.push(`Copyright ancien (${crawlResult.copyrightYear}) indiquant un site non mis à jour`);

            return {
                category: 'outdated_website',
                isFranchise: false,
                franchiseReason: '',
                confidenceScore: triangulation.confidenceScore,
                antiHomonymMatched: triangulation.antiHomonymMatched,
                painPoints: painPoints.length ? painPoints : ['Design web vieillissant'],
                auditSummary: "Site web obsolète et peu adapté aux standards mobiles actuels.",
                recommendedAngle: "Refonte moderne complète avec tunnel de conversion et expérience mobile premium."
            };
        }

        // 4. Social Only (Has social links, but rudimentary web presence)
        if (!crawlResult.reachable && (crawlResult.socialLinks?.facebook || crawlResult.socialLinks?.instagram)) {
            return {
                category: 'social_only',
                isFranchise: false,
                franchiseReason: '',
                confidenceScore: triangulation.confidenceScore,
                antiHomonymMatched: triangulation.antiHomonymMatched,
                painPoints: ['Dépendance totale aux algorithmes des réseaux sociaux', 'Pas de nom de domaine professionnel'],
                auditSummary: "Actif sur les réseaux sociaux mais sans vitrine web propriétaire.",
                recommendedAngle: "Création d'un site web dédié synchronisé avec leurs réseaux sociaux."
            };
        }

        // 5. Modern Website without AI / ERP
        const painPoints = [];
        if (!crawlResult.hasChatWidget) painPoints.push('Aucun agent conversationnel IA 24/7 pour capturer les leads');
        painPoints.push('Réservations et demandes manuelles sans synchronisation ERP automatique');

        return {
            category: 'modern_no_ai',
            isFranchise: false,
            franchiseReason: '',
            confidenceScore: triangulation.confidenceScore,
            antiHomonymMatched: triangulation.antiHomonymMatched,
            painPoints,
            auditSummary: "Site web moderne et fonctionnel, mais manquant d'automatisation IA et d'intégration CRM.",
            recommendedAngle: "Intégration d'un agent IA vocal/SMS 24/7 et automatisation des prises de rendez-vous."
        };
    }

    /**
     * Audit single lead using Crawler + Anti-Homonym Triangulation + OpenAI Cognitive Audit
     */
    async auditLead(leadId) {
        console.log(`[LeadAuditService] Starting audit for lead: ${leadId}`);

        // 1. Fetch lead from Firestore
        let leadDoc = await db.collection('crm_leads').doc(leadId).get();
        let targetCollection = 'crm_leads';

        if (!leadDoc.exists) {
            leadDoc = await db.collection('leads').doc(leadId).get();
            targetCollection = 'leads';
        }

        if (!leadDoc.exists) {
            throw new Error(`Lead not found in crm_leads or leads: ${leadId}`);
        }

        const lead = { id: leadDoc.id, ...leadDoc.data() };

        // 2. Determine website to crawl: if lead has no website on GMB or has directory URL, search Google!
        let websiteToCrawl = lead.website || lead.website_url;
        let isDiscoveredViaGoogleSearch = false;
        let googleBusinessMissingWebsite = Boolean(lead.google_business_missing_website);
        const dirInfo = detectDirectoryPlatform(websiteToCrawl);
        let isDirectoryOnly = false;

        if (dirInfo.isDirectory) {
            console.log(`[LeadAuditService] Lead "${lead.business_name || lead.name}" has directory/booking URL on Google Places: ${websiteToCrawl} (${dirInfo.platformName}). Searching for official proprietary website...`);
            lead.has_directory_only = true;
            lead.directory_platform = dirInfo.platformName;
            lead.directory_url = websiteToCrawl;
            lead.is_directory_website = true;

            const searchDiscovery = await this.searchWebForBusinessWebsite(
                lead.business_name || lead.name,
                lead.city || '',
                lead.state || lead.province || '',
                lead.phone || lead.phone_number || ''
            );

            if (searchDiscovery.found && searchDiscovery.url) {
                console.log(`[LeadAuditService] 🎯 FOUND OFFICIAL PROPRIETARY WEBSITE for "${lead.business_name}": ${searchDiscovery.url} (GMB had directory ${dirInfo.platformName})`);
                websiteToCrawl = searchDiscovery.url;
                isDiscoveredViaGoogleSearch = true;
                googleBusinessMissingWebsite = true;
                lead.website = searchDiscovery.url;
                lead.google_business_missing_website = true;

                aiActivityService.log({
                    category: 'audit',
                    type: 'website_discovered',
                    level: 'info',
                    title: `Site web officiel découvert !`,
                    detail: `La fiche Google Maps pointait vers un annuaire (${dirInfo.platformName}), mais l'IA a trouvé son vrai site web (${searchDiscovery.url}).`
                });
            } else {
                console.log(`[LeadAuditService] No official website found. Lead depends ONLY on ${dirInfo.platformName}.`);
                isDirectoryOnly = true;
            }
        } else if (!websiteToCrawl || typeof websiteToCrawl !== 'string' || websiteToCrawl.trim() === '') {
            console.log(`[LeadAuditService] Lead "${lead.business_name || lead.name}" has no website listed on Google Places. Performing live Google Search...`);
            const searchDiscovery = await this.searchWebForBusinessWebsite(
                lead.business_name || lead.name,
                lead.city || '',
                lead.state || lead.province || '',
                lead.phone || lead.phone_number || ''
            );

            if (searchDiscovery.found && searchDiscovery.url) {
                console.log(`[LeadAuditService] 🎯 FOUND UNLINKED WEBSITE for "${lead.business_name}": ${searchDiscovery.url} (${searchDiscovery.source})`);
                websiteToCrawl = searchDiscovery.url;
                isDiscoveredViaGoogleSearch = true;
                googleBusinessMissingWebsite = true;
                lead.website = searchDiscovery.url;
                lead.google_business_missing_website = true;

                aiActivityService.log({
                    category: 'audit',
                    type: 'website_discovered',
                    level: 'info',
                    title: `Site web découvert sur Google !`,
                    detail: `L'entreprise n'avait pas de site sur Google Business, mais l'IA a trouvé son site officiel (${searchDiscovery.url}). Catégorie : Site non relié à Google Maps.`
                });
            }
        }

        const crawlResult = await this.crawlWebsite(websiteToCrawl, {
            ...lead,
            isDirectoryProfile: isDirectoryOnly,
            directoryPlatform: dirInfo.platformName
        });
        if (isDirectoryOnly) {
            crawlResult.isDirectoryProfile = true;
            crawlResult.directoryPlatform = dirInfo.platformName;
        }

        // Pre-fill missing contacts from website before triangulation & AI payload
        if (crawlResult.extractedContacts) {
            const ext = crawlResult.extractedContacts;
            if ((!lead.phone || lead.phone.trim() === '') && ext.primaryPhone) {
                lead.phone = ext.primaryPhone;
            }
            if ((!lead.email || lead.email.trim() === '') && ext.primaryEmail) {
                lead.email = ext.primaryEmail;
            }
        }

        // 2b. Phone Carrier Intelligence (Telnyx Mobile vs Landline Qualification)
        const phoneToValidate = lead.phone || lead.phone_number;
        let phoneValidation = null;
        if (phoneToValidate) {
            try {
                phoneValidation = await phoneValidatorService.validatePhoneNumber(phoneToValidate, {
                    id: lead.id,
                    business_name: lead.business_name || lead.name
                });
                lead.phone_type = phoneValidation.phone_type;
                lead.carrier_name = phoneValidation.carrier_name;
                lead.sms_eligible = phoneValidation.sms_eligible;
                lead.recommended_channel = phoneValidation.recommended_channel;
            } catch (pErr) {
                console.warn('[LeadAuditService] Phone validation note:', pErr.message);
            }
        }

        // 3. Calculate Anti-Homonym Triangulation Score
        const triangulation = this.calculateTriangulationScore(lead, crawlResult);

        // 4. AI Cognitive Evaluation via OpenAI (with customizable prompt)
        let auditResult = null;

        if (openai) {
            try {
                const hasOfficialGmbWebsite = !googleBusinessMissingWebsite && Boolean(websiteToCrawl) && !isDirectoryOnly;
                const userPayload = {
                    lead_profile: {
                        business_name: lead.business_name || lead.name || 'Inconnu',
                        phone: lead.phone || lead.phone_number || '',
                        phone_type: lead.phone_type || 'unknown',
                        carrier: lead.carrier_name || 'Inconnu',
                        sms_eligible: lead.sms_eligible !== false,
                        recommended_channel: lead.recommended_channel || 'sms',
                        address: lead.address || lead.street_address || '',
                        city: lead.city || '',
                        state: lead.state || '',
                        postal_code: lead.postal_code || lead.zip_code || '',
                        country: lead.country || '',
                        google_rating: lead.google_rating || lead.rating || 0,
                        reviews_count: lead.google_reviews_count || lead.userRatingCount || 0,
                        category: lead.category || ''
                    },
                    google_places_signals: {
                        has_website_on_gmb: hasOfficialGmbWebsite,
                        website_origin: isDiscoveredViaGoogleSearch
                            ? 'Découvert via recherche Google externe (absent de Google Maps)'
                            : (isDirectoryOnly ? 'Fiche Google Maps pointe vers un annuaire/plateforme tierce' : 'Fiche Google Places officielle (Bouton Site Web présent et relié)'),
                        official_website_url: hasOfficialGmbWebsite ? websiteToCrawl : null,
                        rule_reminder: hasOfficialGmbWebsite
                            ? 'CE COMMERCE A DÉJÀ SON SITE OFFICIEL RELIÉ À SA FICHE GOOGLE MAPS. Il est INTERDIT de le classer en missing_gmb_website ou no_website !'
                            : (googleBusinessMissingWebsite ? 'La fiche Google Maps n\'avait aucun site, mais un site externe a été trouvé.' : 'Aucun site officiel.')
                    },
                    crawled_signals: {
                        website_url: isDirectoryOnly ? '' : (websiteToCrawl || ''),
                        is_directory_only: isDirectoryOnly,
                        directory_platform: isDirectoryOnly ? dirInfo.platformName : null,
                        directory_url: isDirectoryOnly ? (lead.directory_url || '') : null,
                        reachable: crawlResult.reachable,
                        google_business_missing_website: googleBusinessMissingWebsite,
                        website_discovered_via_google: isDiscoveredViaGoogleSearch,
                        title: crawlResult.title || '',
                        meta_description: crawlResult.metaDescription || '',
                        has_viewport: isDirectoryOnly ? false : crawlResult.hasViewport,
                        is_https: crawlResult.isHttps,
                        copyright_year: crawlResult.copyrightYear,
                        has_chat_widget: isDirectoryOnly ? false : crawlResult.hasChatWidget,
                        social_links: crawlResult.socialLinks || {},
                        franchise_signals: crawlResult.franchiseSignals || {},
                        text_excerpt: isDirectoryOnly ? `[NOTE IMPORTANTE: Ceci est un profil sur un annuaire / répertoire tiers (${dirInfo.platformName}), pas le site officiel de l'entreprise] ${crawlResult.textSnippet || ''}` : (crawlResult.textSnippet || '')
                    },
                    triangulation_anchors: triangulation
                };

                const completion = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    temperature: 0.2,
                    response_format: { type: "json_object" },
                    messages: [
                        { role: 'system', content: this.config.systemPrompt },
                        { role: 'user', content: JSON.stringify(userPayload) }
                    ]
                });

                const content = completion.choices[0].message.content;
                auditResult = JSON.parse(content);
            } catch (err) {
                console.warn('[LeadAuditService] OpenAI call failed or returned invalid JSON. Using heuristic fallback:', err.message);
            }
        }

        // Fallback if OpenAI failed or not configured
        if (!auditResult || !auditResult.category) {
            auditResult = this.fallbackClassification(lead, crawlResult, triangulation);
        }

        // Deterministic Safety Net 1: Directory-Only Leads (No dedicated website)
        if (isDirectoryOnly || (crawlResult?.isDirectoryProfile && !googleBusinessMissingWebsite)) {
            const platformName = dirInfo.platformName || crawlResult?.directoryPlatform || 'un annuaire tiers';
            console.log(`[LeadAuditService] 📋 Directory-Only Guard: Lead "${lead.business_name}" is on ${platformName} with no dedicated website. Categorizing as directory_only.`);
            auditResult.category = 'directory_only';
            auditResult.isFranchise = false;
            auditResult.confidenceScore = Math.max(90, triangulation.confidenceScore || 95);
            auditResult.antiHomonymMatched = true;
            auditResult.painPoints = [
                'Absence de site web dédié officiel',
                `Dépendance à la plateforme tierce (${platformName})`,
                'Clients et prospects exposés aux commerces concurrents répertoriés sur la même plateforme',
                'Frais d\'intermédiation récurrents sans valorisation de son propre actif web'
            ];
            auditResult.auditSummary = `L'entreprise ${lead.business_name || lead.name} ne dispose d'aucun site web dédié officiel : sa fiche Google Maps redirige vers la plateforme tierce ${platformName}. Ses clients y voient directement des établissements concurrents.`;
            auditResult.recommendedAngle = `Lui proposer de reprendre le contrôle direct de sa clientèle avec son propre site web officiel dédié et un agent de réservation IA 24/7 sans commission ni concurrence directe.`;
        }

        // Deterministic Safety Net 2: Prevent false "missing_gmb_website" or "directory_only" when business already has website on Google Places
        const hasOfficialGmbWebsite = !googleBusinessMissingWebsite && Boolean(websiteToCrawl) && !isDirectoryOnly && !crawlResult?.isDirectoryProfile;
        if (hasOfficialGmbWebsite && (auditResult.category === 'missing_gmb_website' || auditResult.category === 'no_website' || auditResult.category === 'directory_only')) {
            console.warn(`[LeadAuditService] 🛡️ Safety Guard: Lead "${lead.business_name}" already has official GMB website (${websiteToCrawl}). Correcting "${auditResult.category}" to appropriate category.`);
            const isOutdated = crawlResult.reachable && (!crawlResult.hasViewport || !crawlResult.isHttps || (crawlResult.copyrightYear && crawlResult.copyrightYear < (new Date().getFullYear() - 3)));
            auditResult.category = isOutdated ? 'outdated_website' : 'modern_no_ai';

            if (Array.isArray(auditResult.painPoints)) {
                auditResult.painPoints = auditResult.painPoints.filter(p => 
                    !/non relié à google|absence de site propriétaire|pas de site sur google|dépendance à une plateforme|dépendance à la plateforme|dépendant d'un annuaire|DIRECTORY_ONLY|NO_WEBSITE/i.test(p)
                );
                if (!auditResult.painPoints.some(p => /agent|ia|conversationnel|24\/7/i.test(p))) {
                    auditResult.painPoints.push('Aucun agent conversationnel IA 24/7 pour capturer les réservations');
                }
                if (!auditResult.painPoints.some(p => /automatisation/i.test(p))) {
                    auditResult.painPoints.push('Prise de rendez-vous manuelle sans synchronisation automatique');
                }
            }

            if (/non répertorié sur sa fiche google|manque de site|dépendant d'un annuaire|plateforme tierce/i.test(auditResult.auditSummary || '')) {
                auditResult.auditSummary = isOutdated
                    ? `Site web officiel (${websiteToCrawl}) présent sur Google Maps mais vieillissant et non optimisé pour mobile.`
                    : `Site web officiel (${websiteToCrawl}) actif et relié à Google Maps, mais sans agent IA de réservation 24/7.`;
            }

            if (/ajouter son site web|site sur sa fiche|contrôle direct de sa clientèle/i.test(auditResult.recommendedAngle || '')) {
                auditResult.recommendedAngle = `Proposer l'intégration d'un agent IA vocal et SMS 24/7 connecté au site ${websiteToCrawl} pour automatiser les réservations.`;
            }
        }

        // Ensure confidence score incorporates mathematical triangulation verification
        let finalConfidenceScore = triangulation.confidenceScore;
        if (typeof auditResult.confidenceScore === 'number') {
            finalConfidenceScore = Math.max(triangulation.confidenceScore, Math.round(auditResult.confidenceScore));
        }
        const isAntiHomonym = finalConfidenceScore >= (this.config.minConfidenceScore || 85);

        // 5. Determine CRM Status and Exclusion
        let updatedStatus = lead.status || 'NEW';
        let isFranchise = Boolean(auditResult.isFranchise || auditResult.category === 'franchise');

        if (isFranchise) {
            updatedStatus = 'Excluded / Franchise';
            auditResult.category = 'franchise';
        } else if (!isAntiHomonym) {
            updatedStatus = 'Ambiguous Match / Review';
        } else if (updatedStatus === 'Ambiguous Match / Review' || !updatedStatus || updatedStatus === 'NEW') {
            updatedStatus = 'AUDITED';
        }

        // 6. Update Firestore document with audit signals + Extracted Contacts
        const painSignals = Array.isArray(auditResult.painPoints) ? [...auditResult.painPoints] : [];
        if (isDirectoryOnly || auditResult.category === 'directory_only') {
            if (!painSignals.includes('NO_WEBSITE')) painSignals.unshift('NO_WEBSITE');
            if (!painSignals.includes('DIRECTORY_ONLY')) painSignals.unshift('DIRECTORY_ONLY');
        }

        const effectivePlatformName = dirInfo.platformName || crawlResult?.directoryPlatform || (lead.directory_platform || null);
        const isDir = Boolean(isDirectoryOnly || auditResult.category === 'directory_only' || crawlResult?.isDirectoryProfile);

        const updateData = {
            leadCategory: auditResult.category,
            category: auditResult.category,
            isFranchise: isFranchise,
            has_directory_only: isDir,
            directory_platform: isDir ? effectivePlatformName : null,
            directory_url: isDir ? (lead.directory_url || websiteToCrawl) : null,
            is_directory_website: isDir,
            franchise_reason: auditResult.franchiseReason || '',
            confidence_score: finalConfidenceScore,
            anti_homonym_matched: isAntiHomonym,
            anti_homonym_details: triangulation.details,
            pain_signals: painSignals,
            audit_summary: auditResult.auditSummary || '',
            recommended_angle: auditResult.recommendedAngle || '',
            audit_date: new Date().toISOString(),
            status: updatedStatus,
            google_business_missing_website: googleBusinessMissingWebsite,
            phone_type: lead.phone_type || null,
            carrier_name: lead.carrier_name || null,
            sms_eligible: lead.sms_eligible !== undefined ? lead.sms_eligible : null,
            recommended_channel: lead.recommended_channel || null,
            crawl_signals: {
                reachable: crawlResult.reachable,
                copyrightYear: crawlResult.copyrightYear || null,
                hasChatWidget: crawlResult.hasChatWidget || false,
                hasViewport: crawlResult.hasViewport || false,
                isHttps: crawlResult.isHttps || false
            }
        };

        if (lead.email && (lead.email.includes('sentry') || lead.email.includes('wixpress') || lead.email.includes('mysite.com') || lead.email.startsWith('example@') || /^[a-f0-9]{20,}@/i.test(lead.email))) {
            updateData.email = null;
            updateData.public_email = null;
            lead.email = null;
        }

        if (lead.linkedin && /gorendezvous|dash-?booking|fresha|booksy|planity|janeapp|noterro/i.test(lead.linkedin)) {
            updateData.linkedin = null;
        }
        if (lead.apollo && lead.apollo.name && /gorendezvous|dash booking|fresha|booksy/i.test(lead.apollo.name)) {
            updateData.apollo = null;
        }

        if (isDiscoveredViaGoogleSearch && websiteToCrawl) {
            updateData.website = websiteToCrawl;
            updateData.website_url = websiteToCrawl;
            updateData.website_discovered_via = 'google_search';
            lead.website = websiteToCrawl;
        }

        // Deep OSINT & Contact Enrichment from website
        if (crawlResult.extractedContacts) {
            const ext = crawlResult.extractedContacts;
            if ((!lead.phone || lead.phone.trim() === '') && ext.primaryPhone) {
                updateData.phone = ext.primaryPhone;
                updateData.phone_number = ext.primaryPhone;
                updateData.phone_formatted = ext.primaryPhoneFormatted || ext.primaryPhone;
                lead.phone = ext.primaryPhone;
                console.log(`[LeadAuditService] Extracted & saved Phone for lead ${leadId}: ${ext.primaryPhone}`);
            }
            if ((!lead.email || lead.email.trim() === '') && ext.primaryEmail) {
                updateData.email = ext.primaryEmail;
                updateData.public_email = ext.primaryEmail;
                lead.email = ext.primaryEmail;
                console.log(`[LeadAuditService] Extracted & saved Email for lead ${leadId}: ${ext.primaryEmail}`);
            }
            if (ext.instagram && (!lead.instagram || lead.instagram.trim() === '')) {
                updateData.instagram = ext.instagram;
                lead.instagram = ext.instagram;
            }
            if (ext.socials) {
                updateData.social_links = { ...(lead.social_links || {}), ...ext.socials };
            }
        }

        // Auto-extract postal / ZIP code if missing
        if (!lead.postal_code && !lead.zip_code && lead.address) {
            const pMatch = lead.address.match(/\b([A-Za-z]\d[A-Za-z]\s*\d[A-Za-z]\d|\d{5}(?:-\d{4})?)\b/);
            if (pMatch) {
                updateData.postal_code = pMatch[1].trim();
                updateData.zip_code = pMatch[1].trim();
            }
        }

        // Auto-extract State/Province if missing or UNKNOWN
        if ((!lead.state || lead.state === 'UNKNOWN') && lead.address) {
            const stateMatch = lead.address.match(/,\s*([A-Za-z]{2})\s+\d{5}/) || lead.address.match(/,\s*([A-Za-z]{2})\b/);
            if (stateMatch) {
                updateData.state = stateMatch[1].trim().toUpperCase();
            }
        }

        // Auto-detect lead language (default EN, FR if QC or francophone)
        if (!lead.preferredLanguage) {
            const isFr = smsSequenceService.isLeadFrancophone({
                ...lead,
                ...updateData
            });
            updateData.preferredLanguage = isFr ? 'fr' : 'en';
            lead.preferredLanguage = updateData.preferredLanguage;
        }

        // Validate phone carrier & line type (Mobile vs. Landline)
        const finalPhone = updateData.phone || lead.phone || lead.phone_number;
        if (finalPhone && (!lead.phone_type || lead.phone_type === 'unknown')) {
            try {
                const phoneInfo = await phoneValidatorService.validatePhoneNumber(finalPhone, {
                    id: leadId,
                    business_name: lead.business_name || lead.name
                });
                if (phoneInfo) {
                    updateData.phone_type = phoneInfo.phone_type;
                    updateData.carrier_name = phoneInfo.carrier_name;
                    updateData.sms_eligible = phoneInfo.sms_eligible;
                    updateData.recommended_channel = phoneInfo.recommended_channel;
                    lead.phone_type = phoneInfo.phone_type;
                    lead.carrier_name = phoneInfo.carrier_name;
                    lead.sms_eligible = phoneInfo.sms_eligible;
                    lead.recommended_channel = phoneInfo.recommended_channel;
                }
            } catch (phoneErr) {
                console.warn(`[LeadAuditService] Phone validation note for ${finalPhone}:`, phoneErr.message);
            }
        }

        // 6b. Evaluate CASL / LCAP Compliance (Canada Anti-Spam Legislation)
        const caslCompliance = this.evaluateCaslCompliance({ ...lead, ...updateData }, crawlResult);
        updateData.casl = caslCompliance;
        lead.casl = caslCompliance;

        await db.collection(targetCollection).doc(leadId).update(updateData);
        console.log(`[LeadAuditService] Lead ${leadId} updated: Category: ${auditResult.category}, Score: ${finalConfidenceScore}%, CASL: ${caslCompliance.status}, Status: ${updatedStatus}`);

        aiActivityService.log({
            category: 'audit',
            type: 'audit_completed',
            level: 'success',
            title: `Audit IA terminé : "${lead.business_name || lead.name}"`,
            detail: `Profil : ${auditResult.category} • Confiance Triangulation : ${finalConfidenceScore}%\nAngle recommandé : ${auditResult.recommendedAngle || auditResult.auditSummary || 'Standard'}`,
            leadName: lead.business_name || lead.name,
            phone: lead.phone
        });

        if (caslCompliance.applies) {
            aiActivityService.log({
                category: 'casl',
                type: caslCompliance.status === 'ELIGIBLE' ? 'casl_eligible' : (caslCompliance.status === 'INELIGIBLE' ? 'casl_ineligible' : 'casl_review'),
                level: caslCompliance.status === 'ELIGIBLE' ? 'success' : (caslCompliance.status === 'INELIGIBLE' ? 'warning' : 'info'),
                title: `Conformité LCAP / CASL : ${caslCompliance.status} ("${lead.business_name || lead.name}")`,
                detail: `${caslCompliance.notes}\nSource : ${caslCompliance.source_url || 'N/A'}\nPreuve : ${caslCompliance.evidence_hash}`,
                leadName: lead.business_name || lead.name,
                phone: lead.phone
            });
        }

        // 7. Auto-trigger SMS sequence if applicable (respects Franchise + Anti-Homonym + CASL)
        let sequenceTriggered = null;
        const isCaslBlocked = caslCompliance.applies && (caslCompliance.status === 'INELIGIBLE' || caslCompliance.status === 'REVIEW');
        if (this.config.autoTriggerSequences && !isFranchise && isAntiHomonym && auditResult.category !== 'franchise' && !isCaslBlocked) {
            try {
                console.log(`[LeadAuditService] Auto-triggering sequence '${auditResult.category}' for lead ${leadId}...`);
                sequenceTriggered = await smsSequenceService.triggerSequenceForLead(leadId, auditResult.category);
            } catch (seqErr) {
                console.error(`[LeadAuditService] Error triggering sequence for lead ${leadId}:`, seqErr.message);
            }
        } else if (isCaslBlocked) {
            console.log(`[LeadAuditService] 🛡️ Séquence SMS suspendue pour lead ${leadId} : Statut LCAP "${caslCompliance.status}". Envoi automatique bloqué.`);
        } else if (isFranchise) {
            console.log(`[LeadAuditService] 🚫 Lead ${leadId} is a FRANCHISE. STRICTLY EXCLUDED from automated outreach.`);
            aiActivityService.log({
                category: 'audit',
                type: 'franchise_excluded',
                level: 'warning',
                title: `Franchise détectée & exclue : "${lead.business_name || lead.name}"`,
                detail: `Motif : ${auditResult.franchiseReason || 'Siège ou chaîne corporative'}. Exclusion stricte du démarchage SMS.`,
                leadName: lead.business_name || lead.name
            });
        } else if (!isAntiHomonym) {
            console.log(`[LeadAuditService] ⚠️ Lead ${leadId} has low confidence (${finalConfidenceScore}%). Awaiting human review.`);
            aiActivityService.log({
                category: 'audit',
                type: 'ambiguous_match',
                level: 'warning',
                title: `Vérification requise pour "${lead.business_name || lead.name}"`,
                detail: `Score de triangulation (${finalConfidenceScore}%) insuffisant. Mis en attente de validation humaine.`,
                leadName: lead.business_name || lead.name
            });
        }

        return {
            success: true,
            leadId,
            category: auditResult.category,
            isFranchise,
            confidenceScore: finalConfidenceScore,
            status: updatedStatus,
            sequenceTriggered,
            auditResult,
            website: websiteToCrawl || null,
            discoveredWebsite: isDiscoveredViaGoogleSearch ? websiteToCrawl : null,
            googleBusinessMissingWebsite,
            enrichedContacts: crawlResult.extractedContacts || null
        };
    }

    /**
     * Standalone CASL / LCAP compliance verification for an existing lead
     */
    async verifyLeadCasl(leadId) {
        if (!leadId) throw new Error("leadId is required");

        let targetCollection = 'leads';
        let leadDoc = await db.collection('leads').doc(leadId).get();
        if (!leadDoc.exists) {
            targetCollection = 'crm_leads';
            leadDoc = await db.collection('crm_leads').doc(leadId).get();
        }
        if (!leadDoc.exists) throw new Error(`Lead ${leadId} introuvable`);

        const lead = { id: leadId, ...leadDoc.data() };
        const websiteUrl = lead.website || lead.website_url;
        
        let crawlResult = null;
        if (websiteUrl) {
            crawlResult = await this.crawlWebsite(websiteUrl, lead);
        }

        const casl = this.evaluateCaslCompliance(lead, crawlResult);
        await db.collection(targetCollection).doc(leadId).update({
            casl,
            updated_at: new Date().toISOString()
        });

        if (casl.applies) {
            aiActivityService.log({
                category: 'casl',
                type: casl.status === 'ELIGIBLE' ? 'casl_eligible' : (casl.status === 'INELIGIBLE' ? 'casl_ineligible' : 'casl_review'),
                level: casl.status === 'ELIGIBLE' ? 'success' : (casl.status === 'INELIGIBLE' ? 'warning' : 'info'),
                title: `Vérification LCAP manuelle : ${casl.status} ("${lead.business_name || lead.name}")`,
                detail: `${casl.notes}\nSource : ${casl.source_url || 'N/A'}\nPreuve : ${casl.evidence_hash}`,
                leadName: lead.business_name || lead.name,
                phone: lead.phone
            });
        }

        return { success: true, casl, leadId };
    }

    /**
     * Enrich lead contacts directly on demand
     */
    async enrichLeadContacts(leadId) {
        let leadDoc = await db.collection('crm_leads').doc(leadId).get();
        let targetCollection = 'crm_leads';
        if (!leadDoc.exists) {
            leadDoc = await db.collection('leads').doc(leadId).get();
            targetCollection = 'leads';
        }
        if (!leadDoc.exists) {
            throw new Error(`Lead not found: ${leadId}`);
        }

        const lead = { id: leadDoc.id, ...leadDoc.data() };
        if (!lead.website || lead.website.trim() === '') {
            return {
                success: false,
                reason: "Ce lead ne possède pas d'URL de site web.",
                lead
            };
        }

        const contactData = await this.extractContactsFromWebsite(lead.website, lead);
        const updates = {};

        if (contactData.primaryPhone && (!lead.phone || lead.phone.trim() === '')) {
            updates.phone = contactData.primaryPhone;
            updates.phone_number = contactData.primaryPhone;
            updates.phone_formatted = contactData.primaryPhoneFormatted || contactData.primaryPhone;
        }
        if (contactData.primaryEmail && (!lead.email || lead.email.trim() === '')) {
            updates.email = contactData.primaryEmail;
            updates.public_email = contactData.primaryEmail;
        }
        if (contactData.instagram && (!lead.instagram || lead.instagram.trim() === '')) {
            updates.instagram = contactData.instagram;
        }
        if (contactData.socials) {
            updates.social_links = { ...(lead.social_links || {}), ...contactData.socials };
        }

        if (!lead.postal_code && !lead.zip_code && lead.address) {
            const pMatch = lead.address.match(/\b([A-Za-z]\d[A-Za-z]\s*\d[A-Za-z]\d|\d{5}(?:-\d{4})?)\b/);
            if (pMatch) {
                updates.postal_code = pMatch[1].trim();
                updates.zip_code = pMatch[1].trim();
            }
        }

        if ((!lead.state || lead.state === 'UNKNOWN') && lead.address) {
            const stateMatch = lead.address.match(/,\s*([A-Za-z]{2})\s+\d{5}/) || lead.address.match(/,\s*([A-Za-z]{2})\b/);
            if (stateMatch) {
                updates.state = stateMatch[1].trim().toUpperCase();
            }
        }

        if (Object.keys(updates).length > 0) {
            updates.enriched_at = new Date().toISOString();
            await db.collection(targetCollection).doc(leadId).update(updates);
            console.log(`[LeadAuditService] Enriched contacts for lead ${leadId}:`, updates);
        }

        return {
            success: true,
            leadId,
            updated: Object.keys(updates).length > 0,
            updates,
            extracted: contactData
        };
    }

    /**
     * Run batch audit on unclassified or new leads
     */
    async runAuditBatch(batchSize = 10) {
        if (this.isProcessingBatch) {
            return { message: 'A batch is already running.', status: 'in_progress' };
        }

        this.isProcessingBatch = true;
        this.config.status = 'running';
        console.log(`[LeadAuditService] Starting batch audit (limit: ${batchSize})...`);

        const results = [];
        try {
            // Find leads needing audit in crm_leads or leads
            const candidates = [];

            const snapCrm = await db.collection('crm_leads')
                .where('leadCategory', '==', null)
                .limit(batchSize)
                .get();

            snapCrm.forEach(doc => candidates.push({ id: doc.id, col: 'crm_leads', ...doc.data() }));

            if (candidates.length < batchSize) {
                const remaining = batchSize - candidates.length;
                const snapLeads = await db.collection('leads')
                    .where('leadCategory', 'in', ['unclassified', null, ''])
                    .limit(remaining)
                    .get();

                snapLeads.forEach(doc => {
                    if (!candidates.some(c => c.id === doc.id)) {
                        candidates.push({ id: doc.id, col: 'leads', ...doc.data() });
                    }
                });
            }

            // Fallback: search for leads without audit_date
            if (candidates.length < batchSize) {
                const snapAll = await db.collection('crm_leads').limit(batchSize * 2).get();
                snapAll.forEach(doc => {
                    const data = doc.data();
                    if (!data.audit_date && !candidates.some(c => c.id === doc.id)) {
                        candidates.push({ id: doc.id, col: 'crm_leads', ...data });
                    }
                });
            }

            console.log(`[LeadAuditService] Found ${candidates.length} leads to audit in this batch.`);

            for (const item of candidates.slice(0, batchSize)) {
                try {
                    const res = await this.auditLead(item.id);
                    results.push(res);
                } catch (itemErr) {
                    console.error(`[LeadAuditService] Error auditing lead ${item.id}:`, itemErr.message);
                    results.push({ leadId: item.id, error: itemErr.message });
                }

                // Respectful rate limiting between scrapes
                await new Promise(r => setTimeout(r, 1200));
            }

            this.config.lastRun = new Date().toISOString();
            this.config.status = 'idle';
            await this.saveConfig({ lastRun: this.config.lastRun, status: 'idle' });

        } catch (e) {
            console.error('[LeadAuditService] Batch execution error:', e.message);
            this.config.status = 'error';
        } finally {
            this.isProcessingBatch = false;
        }

        return {
            success: true,
            processedCount: results.length,
            results,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get statistics breakdown
     */
    async getAuditStats() {
        try {
            const snap = await db.collection('crm_leads').get();
            let totalAudited = 0;
            let franchisesExcluded = 0;
            let ambiguousReviews = 0;
            const categoryBreakdown = {
                no_website: 0,
                outdated_website: 0,
                modern_no_ai: 0,
                social_only: 0,
                franchise: 0,
                unclassified: 0
            };

            snap.forEach(doc => {
                const data = doc.data();
                if (data.audit_date) {
                    totalAudited++;
                    if (data.isFranchise) franchisesExcluded++;
                    if (data.status === 'Ambiguous Match / Review') ambiguousReviews++;
                    const cat = data.leadCategory || 'unclassified';
                    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
                }
            });

            return {
                totalAudited,
                franchisesExcluded,
                ambiguousReviews,
                categoryBreakdown,
                config: this.config
            };
        } catch (e) {
            console.error('[LeadAuditService] Error calculating stats:', e.message);
            return { error: e.message };
        }
    }
}

const instance = new LeadAuditService();
module.exports = instance;
