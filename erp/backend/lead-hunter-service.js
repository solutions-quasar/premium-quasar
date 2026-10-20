const { db, admin } = require('./firebase-admin');
const leadAuditService = require('./lead-audit-service');
const smsSequenceService = require('./sms-sequence-service');
const twilioService = require('./twilio-service');
const aiActivityService = require('./ai-activity-service');
const { detectDirectoryPlatform } = require('./directory-detector');
const emailAlertService = require('./email-alert-service');

const REGIONS_DATA = {
    // === CANADA (Provinces) ===
    'QC': {
        name: 'Québec (QC)',
        country: 'CA',
        cities: [
            'Montreal, QC', 'Quebec City, QC', 'Laval, QC', 'Gatineau, QC', 'Longueuil, QC',
            'Sherbrooke, QC', 'Levis, QC', 'Trois-Rivieres, QC', 'Saint-Jean-sur-Richelieu, QC',
            'Brossard, QC', 'Drummondville, QC', 'Granby, QC', 'Saint-Jerome, QC', 'Terrebonne, QC'
        ]
    },
    'ON': {
        name: 'Ontario (ON)',
        country: 'CA',
        cities: [
            'Toronto, ON', 'Ottawa, ON', 'Mississauga, ON', 'Brampton, ON', 'Hamilton, ON',
            'London, ON', 'Markham, ON', 'Vaughan, ON', 'Kitchener, ON', 'Windsor, ON',
            'Burlington, ON', 'Oshawa, ON', 'Barrie, ON', 'Oakville, ON', 'Guelph, ON'
        ]
    },
    'NB': {
        name: 'Nouveau-Brunswick (NB)',
        country: 'CA',
        cities: [
            'Moncton, NB', 'Dieppe, NB', 'Fredericton, NB', 'Saint John, NB',
            'Riverview, NB', 'Bathurst, NB', 'Miramichi, NB', 'Edmundston, NB'
        ]
    },
    'NS': {
        name: 'Nouvelle-Écosse (NS)',
        country: 'CA',
        cities: [
            'Halifax, NS', 'Dartmouth, NS', 'Sydney, NS', 'Truro, NS', 'New Glasgow, NS', 'Glace Bay, NS'
        ]
    },
    'BC': {
        name: 'Colombie-Britannique (BC)',
        country: 'CA',
        cities: [
            'Vancouver, BC', 'Surrey, BC', 'Burnaby, BC', 'Richmond, BC', 'Victoria, BC',
            'Kelowna, BC', 'Abbotsford, BC', 'Coquitlam, BC', 'Nanaimo, BC', 'Kamloops, BC'
        ]
    },
    'AB': {
        name: 'Alberta (AB)',
        country: 'CA',
        cities: [
            'Calgary, AB', 'Edmonton, AB', 'Red Deer, AB', 'Lethbridge, AB', 'St. Albert, AB', 'Medicine Hat, AB', 'Airdrie, AB'
        ]
    },
    'MB': {
        name: 'Manitoba (MB)',
        country: 'CA',
        cities: [
            'Winnipeg, MB', 'Brandon, MB', 'Steinbach, MB', 'Portage la Prairie, MB', 'Thompson, MB'
        ]
    },
    'SK': {
        name: 'Saskatchewan (SK)',
        country: 'CA',
        cities: [
            'Saskatoon, SK', 'Regina, SK', 'Prince Albert, SK', 'Moose Jaw, SK', 'Swift Current, SK'
        ]
    },
    'NL': {
        name: 'Terre-Neuve-et-Labrador (NL)',
        country: 'CA',
        cities: [
            "St. John's, NL", 'Mount Pearl, NL', 'Corner Brook, NL', 'Conception Bay South, NL'
        ]
    },
    'PE': {
        name: 'Île-du-Prince-Édouard (PE)',
        country: 'CA',
        cities: [
            'Charlottetown, PE', 'Summerside, PE', 'Stratford, PE'
        ]
    },

    // === USA (States) ===
    'FL': {
        name: 'Florida (FL)',
        country: 'US',
        cities: [
            'Tampa, FL', 'Miami, FL', 'Orlando, FL', 'Jacksonville, FL', 'St. Petersburg, FL',
            'Fort Lauderdale, FL', 'Cape Coral, FL', 'Tallahassee, FL', 'Pembroke Pines, FL', 'Sarasota, FL'
        ]
    },
    'GA': {
        name: 'Georgia (GA)',
        country: 'US',
        cities: [
            'Atlanta, GA', 'Augusta, GA', 'Columbus, GA', 'Macon, GA', 'Savannah, GA', 'Athens, GA', 'Sandy Springs, GA', 'Roswell, GA'
        ]
    },
    'NC': {
        name: 'North Carolina (NC)',
        country: 'US',
        cities: [
            'Charlotte, NC', 'Raleigh, NC', 'Greensboro, NC', 'Durham, NC', 'Winston-Salem, NC', 'Fayetteville, NC', 'Cary, NC', 'Wilmington, NC'
        ]
    },
    'TX': {
        name: 'Texas (TX)',
        country: 'US',
        cities: [
            'Houston, TX', 'Dallas, TX', 'Austin, TX', 'San Antonio, TX', 'Fort Worth, TX', 'El Paso, TX', 'Arlington, TX', 'Plano, TX'
        ]
    },
    'CA_US': {
        name: 'California (CA)',
        country: 'US',
        cities: [
            'Los Angeles, CA', 'San Diego, CA', 'San Jose, CA', 'San Francisco, CA', 'Fresno, CA', 'Sacramento, CA', 'Long Beach, CA', 'Oakland, CA'
        ]
    },
    'NY': {
        name: 'New York (NY)',
        country: 'US',
        cities: [
            'New York, NY', 'Buffalo, NY', 'Rochester, NY', 'Yonkers, NY', 'Syracuse, NY', 'Albany, NY', 'White Plains, NY'
        ]
    },
    'IL': {
        name: 'Illinois (IL)',
        country: 'US',
        cities: [
            'Chicago, IL', 'Aurora, IL', 'Naperville, IL', 'Joliet, IL', 'Rockford, IL', 'Springfield, IL', 'Peoria, IL'
        ]
    },
    'MA': {
        name: 'Massachusetts (MA)',
        country: 'US',
        cities: [
            'Boston, MA', 'Worcester, MA', 'Springfield, MA', 'Cambridge, MA', 'Lowell, MA', 'Brockton, MA', 'Quincy, MA'
        ]
    },
    'WA': {
        name: 'Washington (WA)',
        country: 'US',
        cities: [
            'Seattle, WA', 'Spokane, WA', 'Tacoma, WA', 'Vancouver, WA', 'Bellevue, WA', 'Kent, WA', 'Everett, WA'
        ]
    },
    'CO': {
        name: 'Colorado (CO)',
        country: 'US',
        cities: [
            'Denver, CO', 'Colorado Springs, CO', 'Aurora, CO', 'Fort Collins, CO', 'Lakewood, CO', 'Boulder, CO'
        ]
    },
    'AZ': {
        name: 'Arizona (AZ)',
        country: 'US',
        cities: [
            'Phoenix, AZ', 'Tucson, AZ', 'Mesa, AZ', 'Chandler, AZ', 'Scottsdale, AZ', 'Glendale, AZ', 'Gilbert, AZ'
        ]
    }
};

const DEFAULT_HUNTER_CONFIG = {
    isActive: false, // Inactive by default until user enables it
    apiKey: '', // Google Places API Key
    frequencyHours: 6, // Runs every 6 hours by default
    leadsPerBatch: 10, // Target number of valid leads per cycle
    minReviews: 3,
    websiteFilter: 'NO_WEBSITE', // 'ALL' | 'NO_WEBSITE' | 'HAS_WEBSITE'
    autoAuditAndSequence: true, // Seamlessly triggers cognitive audit and SMS sequence
    adminAlertPhone: '+15062337006',
    adminAlertsEnabled: true,
    adminAlertEmail: 'benjamin@solutionsquasar.ca',
    adminEmailAlertsEnabled: true,
    notifyOnHunterBatch: true,
    lastRunAt: null,
    lastRunSummary: null,
    totalLeadsHunted: 0,
    rotationIndex: 0,
    status: 'idle',

    // --- CIBLAGE GÉOGRAPHIQUE & PROFESSIONNEL ---
    targetCountry: 'CA', // 'CA' | 'US' | 'ALL'
    targetRegion: 'ALL', // 'ALL' | 'QC' | 'ON' | 'NB' | 'NS' | 'FL' | 'TX' etc.
    targetIndustry: 'ALL', // 'ALL' | 'Plumber' | 'Electrician' | 'CUSTOM' etc.
    customIndustry: '',

    targetIndustries: [
        'Plumber',
        'Electrician',
        'Dentist',
        'HVAC Contractor',
        'Roofer',
        'Auto Repair Shop',
        'Lawyer',
        'Med Spa',
        'Real Estate Agent',
        'Accountant',
        'Cleaning Service',
        'General Contractor',
        'Veterinarian',
        'Optometrist',
        'Landscaper',
        'Flooring Specialist',
        'Pest Control',
        'Window & Door Installer'
    ]
};

class LeadHunterService {
    constructor() {
        this.config = { ...DEFAULT_HUNTER_CONFIG };
        this.isHunting = false;
        this.schedulerInterval = null;
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.startScheduler();
    }

    async loadConfig() {
        try {
            const docSnap = await db.collection('settings').doc('hunter_autopilot_config').get();
            if (docSnap.exists) {
                const data = docSnap.data();
                this.config = { ...DEFAULT_HUNTER_CONFIG, ...data };
            } else {
                await this.saveConfig(this.config);
            }
        } catch (e) {
            console.error('[LeadHunterService] Error loading config:', e.message);
        }
        return this.config;
    }

    async saveConfig(newConfig) {
        try {
            this.config = {
                ...this.config,
                ...newConfig,
                updatedAt: new Date().toISOString()
            };
            await db.collection('settings').doc('hunter_autopilot_config').set(this.config, { merge: true });
            this.startScheduler();
            return { success: true, config: this.config };
        } catch (e) {
            console.error('[LeadHunterService] Error saving config:', e.message);
            throw e;
        }
    }

    startScheduler() {
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
        }

        if (!this.config.isActive) {
            console.log('[LeadHunterService] Auto-Pilot is currently PAUSED.');
            return;
        }

        console.log(`[LeadHunterService] Auto-Pilot active (Frequency: every ${this.config.frequencyHours}h). Checking ticker started...`);

        // Check every 2 minutes if a scheduled run is due
        this.schedulerInterval = setInterval(async () => {
            if (!this.config.isActive || this.isHunting) return;

            const freqMs = Math.max(1, this.config.frequencyHours || 6) * 3600 * 1000;
            const lastRunTime = this.config.lastRunAt ? new Date(this.config.lastRunAt).getTime() : 0;
            const now = Date.now();

            if (now - lastRunTime >= freqMs) {
                console.log('[LeadHunterService] Auto-Pilot timer due. Launching autonomous hunt cycle...');
                try {
                    await this.runAutonomousHunt({ manual: false });
                } catch (e) {
                    console.error('[LeadHunterService] Scheduled hunt cycle error:', e.message);
                }
            }
        }, 2 * 60 * 1000);
    }

    /**
     * Executes an autonomous hunt cycle across Google Places (Canada & USA)
     */
    async runAutonomousHunt(options = {}) {
        if (this.isHunting) {
            return { success: false, message: "Un cycle de prospection est déjà en cours d'exécution.", status: 'in_progress' };
        }

        const apiKey = this.config.apiKey || process.env.GOOGLE_PLACES_API_KEY;
        if (!apiKey || apiKey.trim().length < 10) {
            throw new Error("Clé Google Places API requise. Veuillez renseigner votre clé API dans les paramètres Auto-Pilot.");
        }

        this.isHunting = true;
        this.config.status = 'running';

        const maxLeads = parseInt(this.config.leadsPerBatch, 10) || 10;
        const websiteFilter = this.config.websiteFilter || 'NO_WEBSITE';
        const minReviews = parseInt(this.config.minReviews, 10) || 3;

        // 1. Determine candidate cities based on targetCountry and targetRegion
        let candidateCities = [];
        const targetCountry = options.customCountry || this.config.targetCountry || 'CA';
        const targetRegion = options.customRegion || this.config.targetRegion || 'ALL';

        if (targetRegion && targetRegion !== 'ALL' && REGIONS_DATA[targetRegion]) {
            // Specific Province or State selected
            candidateCities = [...REGIONS_DATA[targetRegion].cities];
        } else if (targetCountry === 'CA') {
            // All Canadian provinces
            Object.values(REGIONS_DATA)
                .filter(r => r.country === 'CA')
                .forEach(r => candidateCities.push(...r.cities));
        } else if (targetCountry === 'US') {
            // All US states
            Object.values(REGIONS_DATA)
                .filter(r => r.country === 'US')
                .forEach(r => candidateCities.push(...r.cities));
        } else {
            // Both Canada and USA
            Object.values(REGIONS_DATA).forEach(r => candidateCities.push(...r.cities));
        }

        if (candidateCities.length === 0) {
            candidateCities = ['Montreal, QC', 'Toronto, ON', 'Moncton, NB', 'Vancouver, BC', 'Tampa, FL', 'Miami, FL'];
        }

        // 2. Determine target industry
        let selectedIndustry = options.customIndustry;
        if (!selectedIndustry) {
            if (this.config.targetIndustry === 'CUSTOM' && this.config.customIndustry && this.config.customIndustry.trim()) {
                selectedIndustry = this.config.customIndustry.trim();
            } else if (this.config.targetIndustry && this.config.targetIndustry !== 'ALL') {
                selectedIndustry = this.config.targetIndustry;
            }
        }

        // 3. Resolve city and industry with rotation
        const rot = this.config.rotationIndex || 0;
        let city = options.customCity || candidateCities[rot % candidateCities.length];

        let industry = selectedIndustry;
        if (!industry) {
            const defaultIndustries = (this.config.targetIndustries && this.config.targetIndustries.length > 0)
                ? this.config.targetIndustries
                : DEFAULT_HUNTER_CONFIG.targetIndustries;
            industry = defaultIndustries[Math.floor(rot / candidateCities.length) % defaultIndustries.length];
        }

        this.config.rotationIndex = (rot + 1) % (candidateCities.length * 50);

        const queryTerm = `${industry} in ${city}`;
        console.log(`[LeadHunterService] Starting Auto-Pilot cycle for "${queryTerm}" (Target: ${maxLeads} leads, Filter: ${websiteFilter})...`);

        aiActivityService.log({
            category: 'search',
            type: 'cycle_start',
            level: 'info',
            title: `Cycle Auto-Pilot lancé : "${queryTerm}"`,
            detail: `Cible : ${maxLeads} leads • Filtre : ${websiteFilter === 'NO_WEBSITE' ? 'Sans site web' : websiteFilter} • Ville : ${city} • Métier : ${industry}`
        });

        const endpoint = `https://places.googleapis.com/v1/places:searchText`;
        let currentPageToken = null;
        let leadsAdded = 0;
        const addedLeadsList = [];

        try {
            // Loop through pages 1 to 5 (Deep Search Page 2-5 preferred)
            for (let pageNum = 1; pageNum <= 5; pageNum++) {
                if (leadsAdded >= maxLeads) break;

                aiActivityService.log({
                    category: 'search',
                    type: 'page_search',
                    level: 'info',
                    title: `Google Places Exploration (Page ${pageNum})`,
                    detail: `Recherche en profondeur sur "${queryTerm}" (Page ${pageNum}/5)...`
                });

                const requestConfig = {
                    textQuery: queryTerm,
                    maxResultCount: 20
                };
                if (currentPageToken) requestConfig.pageToken = currentPageToken;

                const headers = {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.id,places.internationalPhoneNumber,places.nationalPhoneNumber,places.addressComponents,places.types,nextPageToken',
                    'Referer': options.referer || 'http://localhost:3002/'
                };

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(requestConfig)
                });

                if (!response.ok) {
                    const errorBody = await response.json();
                    let errMsg = errorBody.error?.message || response.statusText;
                    if (errMsg.includes('places.googleapis.com method google.maps.places.v1.Places.SearchText are blocked') || errorBody.error?.status === 'PERMISSION_DENIED') {
                        errMsg = "Accès bloqué par Google : l'API 'Places API (New)' n'est pas activée ou est restreinte sur cette clé dans Google Cloud Console (Projet 317018641428).";
                    } else if (errMsg.includes('Requests from referer') || errMsg.includes('blocked')) {
                        errMsg = `Accès bloqué par Google (Restriction d'URL) : ${errMsg}`;
                    }
                    const fullErr = `Erreur Google Places API (${response.status}) : ${errMsg}`;

                    aiActivityService.log({
                        category: 'sourcing',
                        type: 'api_error',
                        level: 'error',
                        title: `Erreur API Google Places (403/500)`,
                        message: fullErr,
                        metadata: {
                            status: response.status,
                            googleError: errorBody.error
                        }
                    });
                    throw new Error(fullErr);
                }

                const data = await response.json();
                currentPageToken = data.nextPageToken;

                // STRATEGY: Skip page 1 if more pages exist (Page 1 = top ranked who often have big agencies),
                // but if only page 1 exists, process it!
                if (pageNum === 1 && currentPageToken) {
                    console.log("[LeadHunterService] Skipping Page 1 top results to focus on Page 2-5 local opportunities...");
                    aiActivityService.log({
                        category: 'search',
                        type: 'deep_search',
                        level: 'info',
                        title: `Deep Search : Passage direct à la Page 2`,
                        detail: `Les résultats de page 1 sont souvent de grosses chaînes/franchises. L'IA plonge en page 2-5 pour trouver les vrais artisans locaux.`
                    });
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }

                if (!data.places || data.places.length === 0) {
                    aiActivityService.log({
                        category: 'search',
                        type: 'page_empty',
                        level: 'warning',
                        title: `Fin des résultats Google Places`,
                        detail: `Aucun établissement supplémentaire trouvé pour "${queryTerm}".`
                    });
                    break;
                }

                aiActivityService.log({
                    category: 'search',
                    type: 'page_results',
                    level: 'info',
                    title: `${data.places.length} établissements trouvés en Page ${pageNum}`,
                    detail: `Filtrage en cours selon critères (Sans site web, note, avis et téléphone)...`
                });

                for (const place of data.places) {
                    if (leadsAdded >= maxLeads) break;

                    const name = place.displayName?.text || "Unknown";
                    const reviews = place.userRatingCount || 0;
                    const website = place.websiteUri || null;
                    const phone = place.internationalPhoneNumber || place.nationalPhoneNumber || '';

                    // Review filter
                    if (reviews < minReviews) continue;

                    // Directory & Website filter
                    const dirInfo = detectDirectoryPlatform(website);
                    const hasProprietaryWebsite = Boolean(website && !dirInfo.isDirectory);

                    // If filter is NO_WEBSITE: accept businesses with NO website OR with directory/platform only (e.g. Dash Booking, Fresha, etc.)
                    if (websiteFilter === 'NO_WEBSITE' && hasProprietaryWebsite) continue;
                    if (websiteFilter === 'HAS_WEBSITE' && !hasProprietaryWebsite) continue;

                    // Deduplication check
                    const existingSnap = await db.collection('leads')
                        .where('place_id', '==', place.id)
                        .limit(1)
                        .get();
                    if (!existingSnap.empty) continue;

                    // Parse address components
                    let postalCode = '';
                    let cityComp = '';
                    let stateComp = '';
                    let countryComp = '';
                    let streetNum = '';
                    let routeName = '';

                    if (Array.isArray(place.addressComponents)) {
                        for (const comp of place.addressComponents) {
                            const compTypes = comp.types || [];
                            if (compTypes.includes('postal_code')) postalCode = comp.shortText || comp.longText || '';
                            if (compTypes.includes('locality') || compTypes.includes('postal_town')) cityComp = comp.longText || comp.shortText || '';
                            if (compTypes.includes('administrative_area_level_1')) stateComp = comp.shortText || comp.longText || '';
                            if (compTypes.includes('country')) countryComp = comp.shortText || comp.longText || '';
                            if (compTypes.includes('street_number')) streetNum = comp.longText || comp.shortText || '';
                            if (compTypes.includes('route')) routeName = comp.longText || comp.shortText || '';
                        }
                    }

                    const streetAddress = [streetNum, routeName].filter(Boolean).join(' ') || place.formattedAddress || '';
                    const resolvedCountry = countryComp || (postalCode && /^[A-Z]\d[A-Z]/i.test(postalCode) ? 'CA' : 'US');

                    // Contact enrichment (Scrape website for email / phone / instagram)
                    let finalPhone = phone;
                    let finalEmail = '';
                    let finalInstagram = '';
                    let finalLinkedin = '';
                    let apolloProfile = null;

                    if (website) {
                        try {
                            const enrichedContacts = await leadAuditService.extractContactsFromWebsite(website, {
                                businessName: name,
                                address: place.formattedAddress
                            });
                            if (enrichedContacts.success) {
                                if (!finalPhone && enrichedContacts.phones?.length > 0) {
                                    finalPhone = enrichedContacts.phones[0].e164 || enrichedContacts.phones[0].national;
                                }
                                if (enrichedContacts.emails?.length > 0) {
                                    finalEmail = enrichedContacts.emails[0];
                                }
                                if (enrichedContacts.socials?.instagram) {
                                    finalInstagram = enrichedContacts.socials.instagram;
                                }
                                if (enrichedContacts.linkedin) {
                                    finalLinkedin = enrichedContacts.linkedin;
                                }
                                if (enrichedContacts.apollo) {
                                    apolloProfile = enrichedContacts.apollo;
                                }
                            }
                        } catch (_) {}
                    }

                    const painSignals = [];
                    if (!website) {
                        painSignals.push('NO_WEBSITE');
                    } else if (dirInfo.isDirectory) {
                        painSignals.push('DIRECTORY_ONLY');
                        painSignals.push(`DIRECTORY_${(dirInfo.platformName || 'PLATFORM').toUpperCase().replace(/[^A-Z0-9]/g, '_')}`);
                    }
                    if (reviews < 10) painSignals.push('WEAK_VISIBILITY');

                    const isFr = smsSequenceService.isLeadFrancophone({
                        business_name: name,
                        city: cityComp || city,
                        state: stateComp,
                        province: stateComp,
                        postal_code: postalCode,
                        address: place.formattedAddress,
                        phone: finalPhone
                    });

                    const leadTimezone = smsSequenceService.resolveTimezone({
                        phone: finalPhone,
                        city: cityComp || city,
                        state: stateComp,
                        postal_code: postalCode,
                        address: place.formattedAddress,
                        country: resolvedCountry
                    });

                    const leadData = {
                        business_name: name,
                        category: industry,
                        city: cityComp || city,
                        address: place.formattedAddress || city,
                        street_address: streetAddress,
                        state: stateComp,
                        postal_code: postalCode,
                        zip_code: postalCode,
                        country: resolvedCountry,
                        timezone: leadTimezone,
                        businessTimezone: leadTimezone,
                        phone: finalPhone,
                        phone_number: finalPhone,
                        email: finalEmail,
                        public_email: finalEmail,
                        instagram: finalInstagram,
                        linkedin: finalLinkedin,
                        apollo: apolloProfile,
                        preferredLanguage: isFr ? 'fr' : 'en',
                        types: place.types || [],
                        leadCategory: !website ? 'no_website' : (dirInfo.isDirectory ? 'directory_only' : 'unclassified'),
                        has_directory_only: dirInfo.isDirectory,
                        directory_platform: dirInfo.platformName || null,
                        directory_category: dirInfo.category || null,
                        directory_url: dirInfo.isDirectory ? website : null,
                        is_directory_website: dirInfo.isDirectory,
                        google_rating: place.rating || 0,
                        google_reviews_count: reviews,
                        website: website || '',
                        pain_signals: painSignals,
                        status: this.config.autoAuditAndSequence ? 'APPROVED' : 'NEW',
                        source: 'GOOGLE_PLACES_AUTOPILOT',
                        discovered_query: queryTerm,
                        google_page_rank: pageNum,
                        place_id: place.id,
                        created_at: new Date().toISOString()
                    };

                    const docRef = await db.collection('leads').add(leadData);
                    leadsAdded++;
                    addedLeadsList.push({ id: docRef.id, name, phone: finalPhone, website });

                    console.log(`[LeadHunterService] + AUTOPILOT SAVED: ${name} (${finalPhone}) [${!website ? 'No Web' : (dirInfo.isDirectory ? `Directory: ${dirInfo.platformName}` : 'Has Web')}]`);

                    aiActivityService.log({
                        category: 'search',
                        type: 'lead_saved',
                        level: 'success',
                        title: `Lead qualifié enregistré : ${name}`,
                        detail: `Statut : ${!website ? '🚫 Sans site web' : '💻 Avec site web'} • Tél : ${finalPhone || 'N/A'} • Ville : ${cityComp || city}`,
                        leadName: name,
                        phone: finalPhone,
                        leadId: docRef.id
                    });

                    // Trigger Autonomous Cognitive Audit & Matching Sequence immediately
                    if (this.config.autoAuditAndSequence) {
                        try {
                            console.log(`[LeadHunterService] Launching AI Audit & Sequence for Lead ${docRef.id}...`);
                            aiActivityService.log({
                                category: 'audit',
                                type: 'audit_start',
                                level: 'info',
                                title: `Audit IA démarré : ${name}`,
                                detail: `Analyse du site web et préparation du pitch...`,
                                leadName: name
                            });
                            await leadAuditService.auditLead(docRef.id);
                        } catch (auditErr) {
                            console.warn(`[LeadHunterService] Lead audit error for ${docRef.id}:`, auditErr.message);
                            aiActivityService.log({
                                category: 'audit',
                                type: 'audit_error',
                                level: 'warning',
                                title: `Avertissement Audit IA pour ${name}`,
                                detail: auditErr.message,
                                leadName: name
                            });
                        }
                    }
                }

                if (pageNum < 5 && currentPageToken) {
                    await new Promise(r => setTimeout(r, 1200));
                } else {
                    break;
                }
            }

            // Summary & Notifications
            const nowIso = new Date().toISOString();
            const summary = {
                leadsAdded,
                query: queryTerm,
                city,
                industry,
                at: nowIso,
                leads: addedLeadsList.map(l => ({ name: l.name, phone: l.phone }))
            };

            this.config.lastRunAt = nowIso;
            this.config.lastRunSummary = summary;
            this.config.totalLeadsHunted = (this.config.totalLeadsHunted || 0) + leadsAdded;
            this.config.status = 'idle';

            await db.collection('settings').doc('hunter_autopilot_config').set(this.config, { merge: true });

            // Admin SMS Notification
            if (leadsAdded > 0 && this.config.adminAlertsEnabled && this.config.adminAlertPhone && this.config.notifyOnHunterBatch !== false) {
                try {
                    const noWebCount = addedLeadsList.filter(l => !l.website).length;
                    const alertMsg = `🎯 QUASAR AUTO-PILOT : ${leadsAdded} nouveaux prospects qualifiés chassés à ${city} (${industry}) ! ${noWebCount} sans site web. Séquences SMS initiées.`;
                    await twilioService.sendSms({
                        to: this.config.adminAlertPhone,
                        message: alertMsg
                    });
                    aiActivityService.log({
                        category: 'alert',
                        type: 'admin_sms_sent',
                        level: 'info',
                        title: `Alerte SMS Admin envoyée`,
                        detail: `SMS envoyé à Benjamin (${this.config.adminAlertPhone}) : ${leadsAdded} prospect(s) qualifié(s) trouvé(s) !`
                    });
                } catch (smsErr) {
                    console.warn('[LeadHunterService] Failed to send admin SMS alert:', smsErr.message);
                }
            }

            // Admin Email Notification
            if (leadsAdded > 0 && this.config.adminEmailAlertsEnabled !== false && this.config.adminAlertEmail && this.config.notifyOnHunterBatch !== false) {
                try {
                    const noWebCount = addedLeadsList.filter(l => !l.website).length;
                    const subject = `🎯 Rapport Lead Hunter : ${leadsAdded} nouveau(x) prospect(s) (${city})`;
                    const title = `Auto-Pilot Lead Hunter : ${leadsAdded} prospects qualifiés chassés`;
                    await emailAlertService.sendAdminAlertEmail({
                        to: this.config.adminAlertEmail,
                        subject,
                        title,
                        badgeText: 'Lead Hunter Cycle',
                        badgeColor: '#38BDF8',
                        details: [
                            { label: 'Ville / Région', value: city },
                            { label: 'Secteur d\'activité', value: industry },
                            { label: 'Prospects trouvés', value: `${leadsAdded} leads` },
                            { label: 'Sans site web', value: `${noWebCount} (Priorité Haute)` },
                            { label: 'Séquences SMS', value: 'Initiées automatiquement' }
                        ],
                        snippet: `Cycle de chasse complété avec succès sur Google Maps pour "${queryTerm}".`,
                        ctaUrl: 'https://quasar-erp-b26d5.web.app/#prospection',
                        ctaText: 'Voir les Leads dans l\'ERP'
                    });
                } catch (emailErr) {
                    console.warn('[LeadHunterService] Failed to send admin Email alert:', emailErr.message);
                }
            }

            console.log(`[LeadHunterService] Auto-Pilot cycle complete: ${leadsAdded} leads added for "${queryTerm}".`);

            aiActivityService.log({
                category: 'search',
                type: 'cycle_complete',
                level: 'success',
                title: `Cycle Auto-Pilot terminé avec succès`,
                detail: `🎯 ${leadsAdded} leads qualifiés chassés et injectés dans le pipeline commercial pour "${queryTerm}".`
            });

            return { success: true, ...summary };

        } finally {
            this.isHunting = false;
            this.config.status = 'idle';
        }
    }

    getStatus() {
        return {
            isActive: this.config.isActive,
            status: this.isHunting ? 'running' : 'idle',
            frequencyHours: this.config.frequencyHours,
            leadsPerBatch: this.config.leadsPerBatch,
            lastRunAt: this.config.lastRunAt,
            lastRunSummary: this.config.lastRunSummary,
            totalLeadsHunted: this.config.totalLeadsHunted || 0,
            hasApiKey: Boolean(this.config.apiKey || process.env.GOOGLE_PLACES_API_KEY)
        };
    }
}

const hunterInstance = new LeadHunterService();
hunterInstance.REGIONS_DATA = REGIONS_DATA;
module.exports = hunterInstance;

