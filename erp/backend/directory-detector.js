/**
 * Solutions Quasar Inc. - Directory & Third-Party Platform Detector
 * 
 * Detects whether a business URL points to a third-party directory, aggregator,
 * marketplace, booking portal, or social profile instead of a proprietary domain.
 */

const DIRECTORY_PLATFORMS = [
    // Salons, Coiffure, Beauté, Massothérapie, Spa & Cliniques (Booking Engines & Répertoires)
    { domain: 'gorendezvous.com', name: 'GOrendezvous', category: 'beauty_booking' },
    { domain: 'gorendezvous.ca', name: 'GOrendezvous', category: 'beauty_booking' },
    { domain: 'go-rendez-vous.com', name: 'GOrendezvous', category: 'beauty_booking' },
    { domain: 'dashbooking.com', name: 'Dash Booking', category: 'beauty_booking' },
    { domain: 'jane.app', name: 'Jane App', category: 'beauty_booking' },
    { domain: 'janeapp.com', name: 'Jane App', category: 'beauty_booking' },
    { domain: 'noterro.com', name: 'Noterro', category: 'beauty_booking' },
    { domain: 'booxi.com', name: 'Booxi', category: 'beauty_booking' },
    { domain: 'booxi.ca', name: 'Booxi', category: 'beauty_booking' },
    { domain: 'fresha.com', name: 'Fresha', category: 'beauty_booking' },
    { domain: 'booksy.com', name: 'Booksy', category: 'beauty_booking' },
    { domain: 'vagaro.com', name: 'Vagaro', category: 'beauty_booking' },
    { domain: 'planity.com', name: 'Planity', category: 'beauty_booking' },
    { domain: 'planity.fr', name: 'Planity', category: 'beauty_booking' },
    { domain: 'planity.de', name: 'Planity', category: 'beauty_booking' },
    { domain: 'treatwell.com', name: 'Treatwell', category: 'beauty_booking' },
    { domain: 'treatwell.ca', name: 'Treatwell', category: 'beauty_booking' },
    { domain: 'treatwell.fr', name: 'Treatwell', category: 'beauty_booking' },
    { domain: 'treatwell.co.uk', name: 'Treatwell', category: 'beauty_booking' },
    { domain: 'mindbodyonline.com', name: 'Mindbody', category: 'beauty_booking' },
    { domain: 'mindbody.io', name: 'Mindbody', category: 'beauty_booking' },
    { domain: 'styleseat.com', name: 'StyleSeat', category: 'beauty_booking' },
    { domain: 'resurva.com', name: 'Resurva', category: 'beauty_booking' },
    { domain: 'glossgenius.com', name: 'GlossGenius', category: 'beauty_booking' },
    { domain: 'gettimely.com', name: 'Timely', category: 'beauty_booking' },
    { domain: 'timely.com', name: 'Timely', category: 'beauty_booking' },
    { domain: 'schedulicity.com', name: 'Schedulicity', category: 'beauty_booking' },
    { domain: 'setmore.com', name: 'Setmore', category: 'booking' },
    { domain: 'acuityscheduling.com', name: 'Acuity Scheduling', category: 'booking' },
    { domain: 'simplybook.it', name: 'SimplyBook', category: 'booking' },
    { domain: 'simplybook.me', name: 'SimplyBook', category: 'booking' },
    { domain: 'square.site', name: 'Square Appointments', category: 'booking' },
    { domain: 'squareup.com', name: 'Square Appointments', category: 'booking' },
    { domain: 'zenoti.com', name: 'Zenoti', category: 'beauty_booking' },
    { domain: 'salonized.com', name: 'Salonized', category: 'beauty_booking' },
    { domain: 'joinblvd.com', name: 'Boulevard', category: 'beauty_booking' },
    { domain: 'boulevard.io', name: 'Boulevard', category: 'beauty_booking' },
    { domain: 'phorest.com', name: 'Phorest', category: 'beauty_booking' },
    { domain: 'mangomint.com', name: 'Mangomint', category: 'beauty_booking' },
    { domain: 'shedul.com', name: 'Shedul', category: 'beauty_booking' },
    { domain: 'reservio.com', name: 'Reservio', category: 'booking' },
    { domain: 'cliniko.com', name: 'Cliniko', category: 'beauty_booking' },
    { domain: 'smartagenda.fr', name: 'SmartAgenda', category: 'booking' },
    { domain: 'smartagenda.com', name: 'SmartAgenda', category: 'booking' },
    { domain: 'agendize.com', name: 'Agendize', category: 'booking' },
    { domain: 'clicrdv.com', name: 'ClicRDV', category: 'booking' },
    { domain: 'kizen.com', name: 'Kizen', category: 'booking' },
    { domain: 'rdv360.com', name: 'RDV360', category: 'booking' },
    { domain: 'balinea.com', name: 'Balinea', category: 'beauty_booking' },
    { domain: 'timify.com', name: 'Timify', category: 'booking' },
    { domain: 'appointlet.com', name: 'Appointlet', category: 'booking' },
    { domain: 'youcanbook.me', name: 'YouCanBookMe', category: 'booking' },
    { domain: 'picktime.com', name: 'Picktime', category: 'booking' },
    { domain: 'calendarhero.com', name: 'CalendarHero', category: 'booking' },
    { domain: 'calendly.com', name: 'Calendly', category: 'booking' },
    { domain: 'cal.com', name: 'Cal.com', category: 'booking' },
    { domain: 'doctolib.fr', name: 'Doctolib', category: 'booking' },
    { domain: 'doctolib.com', name: 'Doctolib', category: 'booking' },
    { domain: 'doctolib.de', name: 'Doctolib', category: 'booking' },
    { domain: 'bms-rendezvous.com', name: 'BMS Rendez-vous', category: 'booking' },

    // Annuaires & Pages Jaunes (Canada / Québec / USA / International)
    { domain: 'yellowpages.ca', name: 'Pages Jaunes', category: 'directory' },
    { domain: 'pagesjaunes.ca', name: 'Pages Jaunes', category: 'directory' },
    { domain: 'pagesjaunes.fr', name: 'Pages Jaunes', category: 'directory' },
    { domain: 'yellowpages.com', name: 'Yellow Pages', category: 'directory' },
    { domain: '411.ca', name: '411 Canada', category: 'directory' },
    { domain: 'canadapages.com', name: 'Canada Pages', category: 'directory' },
    { domain: 'cylex-canada.com', name: 'Cylex Canada', category: 'directory' },
    { domain: 'cylex-locale.ca', name: 'Cylex Canada', category: 'directory' },
    { domain: 'cylex.ca', name: 'Cylex', category: 'directory' },
    { domain: 'cylex.fr', name: 'Cylex', category: 'directory' },
    { domain: 'yelp.ca', name: 'Yelp', category: 'directory' },
    { domain: 'yelp.com', name: 'Yelp', category: 'directory' },
    { domain: 'yelp.fr', name: 'Yelp', category: 'directory' },
    { domain: 'tripadvisor.ca', name: 'TripAdvisor', category: 'directory' },
    { domain: 'tripadvisor.com', name: 'TripAdvisor', category: 'directory' },
    { domain: 'tripadvisor.fr', name: 'TripAdvisor', category: 'directory' },
    { domain: 'bbb.org', name: 'Better Business Bureau', category: 'directory' },
    { domain: 'brownbook.net', name: 'Brownbook', category: 'directory' },
    { domain: 'hotfrog.ca', name: 'Hotfrog', category: 'directory' },
    { domain: 'hotfrog.com', name: 'Hotfrog', category: 'directory' },
    { domain: 'weblocal.ca', name: 'WebLocal', category: 'directory' },
    { domain: 'infobel.com', name: 'Infobel', category: 'directory' },
    { domain: 'mapquest.com', name: 'MapQuest', category: 'directory' },
    { domain: 'manta.com', name: 'Manta', category: 'directory' },
    { domain: 'superpages.com', name: 'Superpages', category: 'directory' },
    { domain: 'dexknows.com', name: 'DexKnows', category: 'directory' },
    { domain: 'chamberofcommerce.com', name: 'Chamber of Commerce', category: 'directory' },
    { domain: 'trustpilot.com', name: 'Trustpilot', category: 'directory' },
    { domain: 'zoominfo.com', name: 'ZoomInfo', category: 'directory' },
    { domain: 'dnb.com', name: 'Dun & Bradstreet', category: 'directory' },
    { domain: 'opencorporates.com', name: 'OpenCorporates', category: 'directory' },
    { domain: 'ratemds.com', name: 'RateMDs', category: 'directory' },
    { domain: 'cortico.health', name: 'Cortico Health', category: 'directory' },
    { domain: 'groupon.ca', name: 'Groupon', category: 'directory' },
    { domain: 'groupon.com', name: 'Groupon', category: 'directory' },

    // Artisans, Rénovations & Services
    { domain: 'bark.com', name: 'Bark', category: 'home_services' },
    { domain: 'houzz.com', name: 'Houzz', category: 'home_services' },
    { domain: 'houzz.ca', name: 'Houzz', category: 'home_services' },
    { domain: 'houzz.fr', name: 'Houzz', category: 'home_services' },
    { domain: 'homestars.com', name: 'HomeStars', category: 'home_services' },
    { domain: 'thumbtack.com', name: 'Thumbtack', category: 'home_services' },
    { domain: 'angi.com', name: 'Angi', category: 'home_services' },
    { domain: 'angieslist.com', name: "Angie's List", category: 'home_services' },
    { domain: 'starofservice.com', name: 'StarOfService', category: 'home_services' },
    { domain: 'starofservice.ca', name: 'StarOfService', category: 'home_services' },
    { domain: 'starofservice.fr', name: 'StarOfService', category: 'home_services' },
    { domain: 'renovationquebec.ca', name: 'Rénovation Québec', category: 'home_services' },
    { domain: 'soumissionrenovation.ca', name: 'Soumission Rénovation', category: 'home_services' },

    // Restauration, Livraison & Réservations Tables
    { domain: 'ubereats.com', name: 'Uber Eats', category: 'restaurant_delivery' },
    { domain: 'doordash.com', name: 'DoorDash', category: 'restaurant_delivery' },
    { domain: 'skipthedishes.com', name: 'SkipTheDishes', category: 'restaurant_delivery' },
    { domain: 'opentable.com', name: 'OpenTable', category: 'restaurant_booking' },
    { domain: 'opentable.ca', name: 'OpenTable', category: 'restaurant_booking' },
    { domain: 'opentable.fr', name: 'OpenTable', category: 'restaurant_booking' },
    { domain: 'resy.com', name: 'Resy', category: 'restaurant_booking' },
    { domain: 'thefork.com', name: 'TheFork', category: 'restaurant_booking' },
    { domain: 'lafourchette.com', name: 'LaFourchette', category: 'restaurant_booking' },
    { domain: 'toasttab.com', name: 'Toast', category: 'restaurant_ordering' },
    { domain: 'clover.com', name: 'Clover', category: 'restaurant_ordering' },
    { domain: 'grubhub.com', name: 'Grubhub', category: 'restaurant_delivery' },
    { domain: 'just-eat.com', name: 'Just Eat', category: 'restaurant_delivery' },

    // Sous-domaines gratuits de créateurs / CMS sans nom de domaine propriétaire
    { domain: 'wixsite.com', name: 'Wix (Sous-domaine gratuit)', category: 'free_subdomain' },
    { domain: 'wordpress.com', name: 'WordPress (Sous-domaine gratuit)', category: 'free_subdomain' },
    { domain: 'weebly.com', name: 'Weebly (Sous-domaine gratuit)', category: 'free_subdomain' },
    { domain: 'site123.me', name: 'Site123 (Sous-domaine gratuit)', category: 'free_subdomain' },
    { domain: 'business.site', name: 'Google Business Profile', category: 'free_subdomain' },
    { domain: 'myshopify.com', name: 'Shopify (Sous-domaine gratuit)', category: 'free_subdomain' },

    // Réseaux Sociaux & Linktrees
    { domain: 'facebook.com', name: 'Facebook', category: 'social_profile' },
    { domain: 'fb.com', name: 'Facebook', category: 'social_profile' },
    { domain: 'instagram.com', name: 'Instagram', category: 'social_profile' },
    { domain: 'linkedin.com', name: 'LinkedIn', category: 'social_profile' },
    { domain: 'linktr.ee', name: 'Linktree', category: 'bio_link' },
    { domain: 'linktree.com', name: 'Linktree', category: 'bio_link' },
    { domain: 'tiktok.com', name: 'TikTok', category: 'social_profile' },
    { domain: 'bio.site', name: 'Bio.site', category: 'bio_link' },
    { domain: 'beacons.ai', name: 'Beacons', category: 'bio_link' },
    { domain: 'carrd.co', name: 'Carrd', category: 'bio_link' }
];

/**
 * Analyzes a full URL and determines whether it represents a third-party platform,
 * appointment booking portal, or directory profile instead of a proprietary domain.
 * @param {string} rawUrl 
 * @returns {{ isDirectory: boolean, platformName: string|null, category: string|null, domain: string, originalUrl: string, isPathProfile: boolean }}
 */
function detectDirectoryPlatform(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
        return { isDirectory: false, platformName: null, category: null, domain: '', originalUrl: '', isPathProfile: false };
    }

    const trimmed = rawUrl.trim();
    let hostname = '';
    let pathname = '';
    let fullUrlLower = trimmed.toLowerCase();

    try {
        const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
        hostname = (parsed.hostname || '').toLowerCase().replace(/^www\./, '');
        pathname = (parsed.pathname || '').toLowerCase();
    } catch (_) {
        const parts = trimmed.toLowerCase().split('/');
        hostname = (parts[0] || '').replace(/^www\./, '');
        pathname = parts.length > 1 ? '/' + parts.slice(1).join('/') : '';
    }

    if (!hostname) {
        return { isDirectory: false, platformName: null, category: null, domain: '', originalUrl: trimmed, isPathProfile: false };
    }

    // 1. Check known directory & booking platforms
    for (const item of DIRECTORY_PLATFORMS) {
        if (hostname === item.domain || hostname.endsWith('.' + item.domain)) {
            const isPathProfile = pathname.length > 1 && pathname !== '/';
            return {
                isDirectory: true,
                platformName: item.name,
                category: item.category,
                domain: item.domain,
                originalUrl: trimmed,
                isPathProfile
            };
        }
    }

    // 2. Full URL Path Heuristics for appointment & directory profiling
    const directoryPathRegex = /\/(?:salon|salons|clinique|cliniques|clinic|clinics|spa|spas|practitioner|therapist|pro|profil|profile|fiche|membre|member|company|entreprise|commerce|rdv|rendez-vous|rendezvous|booking|book|appointments|agenda)\/([a-z0-9_-]+)/i;
    if (directoryPathRegex.test(pathname)) {
        // If the path clearly indicates a profile slug on an aggregator
        const segments = pathname.split('/').filter(Boolean);
        if (segments.length >= 2) {
            return {
                isDirectory: true,
                platformName: hostname.split('.')[0].toUpperCase(),
                category: 'booking',
                domain: hostname,
                originalUrl: trimmed,
                isPathProfile: true
            };
        }
    }

    return {
        isDirectory: false,
        platformName: null,
        category: null,
        domain: hostname,
        originalUrl: trimmed,
        isPathProfile: false
    };
}

module.exports = {
    DIRECTORY_PLATFORMS,
    detectDirectoryPlatform
};
