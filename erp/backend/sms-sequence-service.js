const { db, admin } = require('./firebase-admin');
const twilioService = require('./twilio-service');
const aiActivityService = require('./ai-activity-service');
const phoneValidatorService = require('./phone-validator-service');

// Default sequence settings
const DEFAULT_SETTINGS = {
    dryRun: true, // Safe testing by default!
    autoSendEnabled: true, // Master Switch for auto SMS sequences
    adminAlertPhone: '+15062337006',
    adminAlertsEnabled: true,
    batchSize: 25,
    checkIntervalMinutes: 5
};

// Default seed sequences by lead category (Concise, Double-SMS & Long-Term Quebec/North America)
const DEFAULT_SEQUENCES = [
    {
        id: 'seq_missing_gmb_website',
        name: 'Connexion Google Maps & Fiche Incomplète',
        targetCategory: 'missing_gmb_website',
        targetCountry: 'ALL',
        description: 'Pour prospects ayant un site web actif mais absent de leur fiche Google Maps / Google Business.',
        active: true,
        steps: [
            {
                stepNumber: 1,
                delayHours: 0.25, // 15 min
                template: "Allo {{name}}, c'est Ben de Solutions Quasar !",
                template_en: "Hey {{name}}, Ben from Solutions Quasar here!"
            },
            {
                stepNumber: 2,
                delayHours: 0.033, // 2 min
                template: "Je regardais votre fiche Google à {{city}}, vous prenez encore des clients ces temps-ci ? [Rép. STOP pour cesser]",
                template_en: "Quick question about your Google listing in {{city}}, taking on new clients right now? [Reply STOP to opt out]"
            },
            {
                stepNumber: 3,
                delayHours: 24, // J+1
                template: "On peut ajouter votre site directement sur votre fiche Google Maps en 24h. Curieux de voir comment en 2 min ?",
                template_en: "We can link your website straight to your Google profile in 24h. Open to a 2-min preview?"
            },
            {
                stepNumber: 4,
                delayHours: 168, // J+7
                template: "Rebonjour {{name}}, voici un exemple récent : cliniquetn.ca . On pourrait faire la même chose pour {{company}} !",
                template_en: "Hi {{name}}, here's a live example: caissiecapeoasis.com . We could easily set this up for {{company}}!"
            },
            {
                stepNumber: 5,
                delayHours: 720, // J+30
                template: "Dernier petit mot {{name}}, je ne vous dérange plus. Gardez mon contact si vous voulez bonifier votre fiche plus tard !",
                template_en: "Last note {{name}}, won't bug you anymore! Feel free to keep my contact handy for {{company}}."
            },
            {
                stepNumber: 6,
                delayHours: 1440, // J+60 (2 mois)
                template: "Allo {{name}}, j'espère que les affaires vont bien chez {{company}} ! C'est toujours dans vos projets pour ce trimestre ?",
                template_en: "Hey {{name}}, hope all is well with {{company}}! Still on your roadmap for this quarter, or put on hold?"
            },
            {
                stepNumber: 7,
                delayHours: 2160, // J+90 (3 mois)
                template: "Bonjour {{name}}, juste pour prendre des nouvelles. Comment se passe la saison pour vous chez {{company}} ?",
                template_en: "Hi {{name}}, just checking in. How are things shaping up this season for {{company}}?"
            }
        ]
    },
    {
        id: 'seq_directory_only',
        name: 'Indépendance vs Annuaire & Plateforme Tierce',
        targetCategory: 'directory_only',
        targetCountry: 'ALL',
        description: 'Pour commerces hébergés uniquement sur Dash Booking, Fresha, Booksy, Pages Jaunes, etc.',
        active: true,
        steps: [
            {
                stepNumber: 1,
                delayHours: 0.25, // 15 min
                template: "Allo {{name}}, c'est Ben de Solutions Quasar !",
                template_en: "Hey {{name}}, Ben from Solutions Quasar here!"
            },
            {
                stepNumber: 2,
                delayHours: 0.033, // 2 min
                template: "J'ai vu la page de {{company}} sur {{platform_name}}. Vous voulez éviter que vos clients aillent voir vos concurrents ? [Rép. STOP pour cesser]",
                template_en: "Saw {{company}} on {{platform_name}}. Want to stop clients from clicking on local competitors? [Reply STOP to opt out]"
            },
            {
                stepNumber: 3,
                delayHours: 24, // J+1
                template: "Avoir votre propre site vous évite de payer des frais ou commissions à des tiers. Vous auriez 2 min pour jeter un œil ?",
                template_en: "Having your own branded portal cuts out booking fees and protects your regulars. Got 2 min to take a look?"
            },
            {
                stepNumber: 4,
                delayHours: 168, // J+7
                template: "Rebonjour {{name}}, voici un portail autonome qu'on a mis en place : caissiecapeoasis.com . Qu'en pensez-vous pour {{company}} ?",
                template_en: "Hi {{name}}, here is a custom direct-booking site we launched: caissiecapeoasis.com . What do you think for {{company}}?"
            },
            {
                stepNumber: 5,
                delayHours: 720, // J+30
                template: "Dernier message {{name}}, je vous laisse tranquille. Gardez nos coordonnées si vous prévoyez avoir votre propre vitrine !",
                template_en: "Final courtesy note {{name}}. Feel free to reach out whenever you want to own your brand and direct bookings!"
            },
            {
                stepNumber: 6,
                delayHours: 1440, // J+60 (2 mois)
                template: "Allo {{name}}, petite pensée pour {{company}}. Réduire vos frais de réservation, c'est toujours sur votre table ce trimestre ?",
                template_en: "Hey {{name}}, checking in for {{company}}! If cutting out booking platform fees is on your radar this quarter, let me know."
            },
            {
                stepNumber: 7,
                delayHours: 2160, // J+90 (3 mois)
                template: "Bonjour {{name}}, juste un petit coucou. Tout se passe bien avec votre clientèle chez {{company}} ?",
                template_en: "Hi {{name}}, just dropping a quick note. Hope you and {{company}} are having a great season!"
            }
        ]
    },
    {
        id: 'seq_no_website',
        name: 'Pack Création Web Clé en Main',
        targetCategory: 'no_website',
        targetCountry: 'ALL',
        description: 'Séquence pour prospects sans aucun site web détecté sur Google.',
        active: true,
        steps: [
            {
                stepNumber: 1,
                delayHours: 0.25, // 15 min
                template: "Allo {{name}}, c'est Ben de Solutions Quasar !",
                template_en: "Hey {{name}}, Ben from Solutions Quasar here!"
            },
            {
                stepNumber: 2,
                delayHours: 0.033, // 2 min
                template: "On a monté un concept de site web avec prise de rendez-vous pour {{company}} à {{city}}. Curieux de voir ce que ça donne ? [Rép. STOP pour cesser]",
                template_en: "We put together a website concept with online booking for {{company}} in {{city}}. Open to a quick peek? [Reply STOP to opt out]"
            },
            {
                stepNumber: 3,
                delayHours: 24, // J+1
                template: "On monte des sites modernes clé en main en 48h pour attirer de nouveaux clients locaux. Avez-vous 5 min cette semaine pour jaser ?",
                template_en: "We launch modern turnkey websites in 48h to bring you local clients. Free for a quick 5-min chat this week?"
            },
            {
                stepNumber: 4,
                delayHours: 168, // J+7
                template: "Bonjour {{name}}, voici deux exemples récents en ligne : cliniquetn.ca et caissiecapeoasis.com . Ça vous plairait pour {{company}} ?",
                template_en: "Hi {{name}}, here are two recent sites we launched: cliniquetn.ca and caissiecapeoasis.com . Would that fit {{company}}?"
            },
            {
                stepNumber: 5,
                delayHours: 720, // J+30
                template: "Dernier petit mot {{name}}. Gardez mon numéro si vous décidez de lancer votre site officiel plus tard. Bon succès avec {{company}} !",
                template_en: "Final note {{name}}. Keep my number handy whenever you're ready to launch your official site. Wishing you great success!"
            },
            {
                stepNumber: 6,
                delayHours: 1440, // J+60 (2 mois)
                template: "Allo {{name}}, j'espère que tout va bien chez {{company}} ! Lancer votre site web, est-ce toujours dans vos plans pour ce trimestre ?",
                template_en: "Hey {{name}}, hope business is good! Still thinking about getting your official website up this quarter?"
            },
            {
                stepNumber: 7,
                delayHours: 2160, // J+90 (3 mois)
                template: "Bonjour {{name}}, petite prise de nouvelles amicale. Comment se portent vos projets chez {{company}} ?",
                template_en: "Hi {{name}}, just a quick friendly check-in. How are things progressing at {{company}}?"
            }
        ]
    },
    {
        id: 'seq_outdated_website',
        name: 'Refonte Moderne & Vitesse Mobile',
        targetCategory: 'outdated_website',
        targetCountry: 'ALL',
        description: 'Pour prospects avec un site ancien, lent ou non optimisé pour mobile.',
        active: true,
        steps: [
            {
                stepNumber: 1,
                delayHours: 0.25, // 15 min
                template: "Allo {{name}}, c'est Ben de Solutions Quasar !",
                template_en: "Hey {{name}}, Ben from Solutions Quasar here!"
            },
            {
                stepNumber: 2,
                delayHours: 0.033, // 2 min
                template: "Le site de {{company}} prend pas mal de temps à charger sur cellulaire. Vous voulez voir comment le rendre instantané ? [Rép. STOP pour cesser]",
                template_en: "Notice {{company}}'s website takes a bit to load on mobile. Open to seeing how to make it load instantly? [Reply STOP to opt out]"
            },
            {
                stepNumber: 3,
                delayHours: 48, // J+2
                template: "Un site super rapide sur téléphone fait monter les appels directs dès la première semaine. On en jase 2 min ?",
                template_en: "A fast mobile experience directly boosts incoming calls and bookings. Open to a quick 2-min chat?"
            },
            {
                stepNumber: 4,
                delayHours: 168, // J+7
                template: "Rebonjour {{name}}, regardez la vitesse sur mobile de cliniquetn.ca . On pourrait vous bâtir la même chose pour {{company}} !",
                template_en: "Hi {{name}}, check out the mobile speed on caissiecapeoasis.com . We could easily do the same upgrade for {{company}}!"
            },
            {
                stepNumber: 5,
                delayHours: 720, // J+30
                template: "Dernier suivi {{name}}, je ne vous embête plus. Gardez mon contact si vous prévoyez moderniser votre site plus tard !",
                template_en: "Last check-in {{name}}, won't bother you anymore. Keep our contact if you ever plan a website refresh down the road!"
            },
            {
                stepNumber: 6,
                delayHours: 1440, // J+60 (2 mois)
                template: "Allo {{name}}, petite pensée pour {{company}}. Avez-vous eu le temps de retoucher votre site ou c'est remis à plus tard ?",
                template_en: "Hey {{name}}, checking in on {{company}}! Did you get around to refreshing your website, or is it on the back burner?"
            },
            {
                stepNumber: 7,
                delayHours: 2160, // J+90 (3 mois)
                template: "Bonjour {{name}}, juste pour prendre des nouvelles de {{company}}. Les affaires roulent bien ce trimestre ?",
                template_en: "Hi {{name}}, quick seasonal check-in. Hope business is treating you well at {{company}}!"
            }
        ]
    },
    {
        id: 'seq_modern_no_ai',
        name: 'Agent IA & Automatisation 24/7',
        targetCategory: 'modern_no_ai',
        targetCountry: 'ALL',
        description: 'Pour entreprises avec un site moderne mais sans répondeur automatique IA.',
        active: true,
        steps: [
            {
                stepNumber: 1,
                delayHours: 0.25, // 15 min
                template: "Allo {{name}}, c'est Ben de Solutions Quasar !",
                template_en: "Hey {{name}}, Ben from Solutions Quasar here!"
            },
            {
                stepNumber: 2,
                delayHours: 0.033, // 2 min
                template: "Super beau site pour {{company}} ! Qui répond à vos clients le soir et la fin de semaine quand vous êtes occupé ? [Rép. STOP pour cesser]",
                template_en: "Great website for {{company}}! Who handles customer messages on evenings & weekends when you're busy? [Reply STOP to opt out]"
            },
            {
                stepNumber: 3,
                delayHours: 24, // J+1
                template: "On installe des assistants IA qui qualifient les leads et réservent directement dans votre agenda 24/7. Curieux de tester une démo ?",
                template_en: "We plug in AI assistants that qualify leads and book appointments 24/7 straight into your calendar. Open to testing a quick demo?"
            },
            {
                stepNumber: 4,
                delayHours: 168, // J+7
                template: "Bonjour {{name}}, l'agent IA se branche sur votre site en moins de 48h. Avez-vous 5 min cette semaine pour voir une simulation ?",
                template_en: "Hi {{name}}, our AI receptionist connects to your existing site in under 48 hours. Got 5 min to test a live simulation?"
            },
            {
                stepNumber: 5,
                delayHours: 720, // J+30
                template: "Dernier mot {{name}}, je vous laisse aller ! Gardez mon contact si vous voulez automatiser vos réponses clients plus tard.",
                template_en: "Last note {{name}}, I'll leave you to it! Keep my number if you ever look to automate customer booking down the road."
            },
            {
                stepNumber: 6,
                delayHours: 1440, // J+60 (2 mois)
                template: "Allo {{name}}, j'espère que tout va bien chez {{company}} ! L'automatisation des demandes clients, toujours dans vos plans ce trimestre ?",
                template_en: "Hey {{name}}, hope things are thriving at {{company}}! Still considering automated booking this quarter, or still on hold?"
            },
            {
                stepNumber: 7,
                delayHours: 2160, // J+90 (3 mois)
                template: "Bonjour {{name}}, petite prise de nouvelles. Comment se déroule votre saison chez {{company}} ?",
                template_en: "Hi {{name}}, quick hello. How is the season going for you and the team at {{company}}?"
            }
        ]
    },
    {
        id: 'seq_social_only',
        name: 'Conversion Réseaux vers Portail Web',
        targetCategory: 'social_only',
        targetCountry: 'ALL',
        description: 'Pour prospects actifs sur Facebook/Instagram sans site web officiel.',
        active: true,
        steps: [
            {
                stepNumber: 1,
                delayHours: 0.25, // 15 min
                template: "Allo {{name}}, c'est Ben de Solutions Quasar !",
                template_en: "Hey {{name}}, Ben from Solutions Quasar here!"
            },
            {
                stepNumber: 2,
                delayHours: 0.033, // 2 min
                template: "Belle présence sur les réseaux pour {{company}} ! Vos abonnés peuvent réserver en ligne directement ou vous devez leur répondre un par un ? [Rép. STOP pour cesser]",
                template_en: "Great social page for {{company}}! Can followers book with you directly, or do you have to reply to DMs manually? [Reply STOP to opt out]"
            },
            {
                stepNumber: 3,
                delayHours: 24, // J+1
                template: "Ajouter un lien de réservation directe dans votre bio double les clients sans perdre de temps en messages. Curieux de voir un aperçu ?",
                template_en: "Adding an instant booking link in your bio doubles your bookings without losing hours in DMs. Open to seeing a quick concept?"
            },
            {
                stepNumber: 4,
                delayHours: 168, // J+7
                template: "Bonjour {{name}}, voici un portail qu'on a relié aux réseaux sociaux : cliniquetn.ca . Qu'en pensez-vous pour {{company}} ?",
                template_en: "Hi {{name}}, here is a clean web portal linked to social profiles: cliniquetn.ca . How would that look for {{company}}?"
            },
            {
                stepNumber: 5,
                delayHours: 720, // J+30
                template: "Dernier petit mot {{name}}, je vous laisse tranquille. Gardez nos coordonnées si vous voulez votre propre portail plus tard !",
                template_en: "Final note {{name}}. Keep our contact handy whenever you're ready to launch your official portal. Best of success!"
            },
            {
                stepNumber: 6,
                delayHours: 1440, // J+60 (2 mois)
                template: "Allo {{name}}, petite pensée pour {{company}}. Avez-vous eu l'occasion d'avancer sur votre vitrine web ce trimestre ?",
                template_en: "Hey {{name}}, thinking of {{company}}! Did you get a chance to build your direct booking link this quarter?"
            },
            {
                stepNumber: 7,
                delayHours: 2160, // J+90 (3 mois)
                template: "Bonjour {{name}}, juste pour prendre des nouvelles. Les affaires vont bien avec votre communauté chez {{company}} ?",
                template_en: "Hi {{name}}, quick check-in. Hope you're having an awesome season with {{company}}!"
            }
        ]
    }
];

/**
 * Comprehensive 50 US States + Canadian Provinces Timezone Dictionary
 */
const STATE_PROVINCE_TIMEZONE_MAP = {
    // === CANADIAN PROVINCES & TERRITORIES ===
    'NL': 'America/St_Johns', 'NEWFOUNDLAND': 'America/St_Johns',
    'NS': 'America/Halifax',  'NOVA SCOTIA': 'America/Halifax',
    'PE': 'America/Halifax',  'PRINCE EDWARD ISLAND': 'America/Halifax',
    'NB': 'America/Moncton',  'NEW BRUNSWICK': 'America/Moncton',
    'QC': 'America/Toronto',  'QUEBEC': 'America/Toronto',
    'ON': 'America/Toronto',  'ONTARIO': 'America/Toronto',
    'MB': 'America/Winnipeg', 'MANITOBA': 'America/Winnipeg',
    'SK': 'America/Regina',   'SASKATCHEWAN': 'America/Regina',
    'AB': 'America/Edmonton', 'ALBERTA': 'America/Edmonton',
    'BC': 'America/Vancouver','BRITISH COLUMBIA': 'America/Vancouver',
    'YT': 'America/Whitehorse','YUKON': 'America/Whitehorse',
    'NT': 'America/Yellowknife','NORTHWEST TERRITORIES': 'America/Yellowknife',
    'NU': 'America/Iqaluit',  'NUNAVUT': 'America/Iqaluit',

    // === US STATES: EASTERN TIME ===
    'CT': 'America/New_York', 'CONNECTICUT': 'America/New_York',
    'DE': 'America/New_York', 'DELAWARE': 'America/New_York',
    'DC': 'America/New_York', 'DISTRICT OF COLUMBIA': 'America/New_York',
    'FL': 'America/New_York', 'FLORIDA': 'America/New_York',
    'GA': 'America/New_York', 'GEORGIA': 'America/New_York',
    'ME': 'America/New_York', 'MAINE': 'America/New_York',
    'MD': 'America/New_York', 'MARYLAND': 'America/New_York',
    'MA': 'America/New_York', 'MASSACHUSETTS': 'America/New_York',
    'MI': 'America/New_York', 'MICHIGAN': 'America/New_York',
    'NH': 'America/New_York', 'NEW HAMPSHIRE': 'America/New_York',
    'NJ': 'America/New_York', 'NEW JERSEY': 'America/New_York',
    'NY': 'America/New_York', 'NEW YORK': 'America/New_York',
    'NC': 'America/New_York', 'NORTH CAROLINA': 'America/New_York',
    'OH': 'America/New_York', 'OHIO': 'America/New_York',
    'PA': 'America/New_York', 'PENNSYLVANIA': 'America/New_York',
    'RI': 'America/New_York', 'RHODE ISLAND': 'America/New_York',
    'SC': 'America/New_York', 'SOUTH CAROLINA': 'America/New_York',
    'VT': 'America/New_York', 'VERMONT': 'America/New_York',
    'VA': 'America/New_York', 'VIRGINIA': 'America/New_York',
    'WV': 'America/New_York', 'WEST VIRGINIA': 'America/New_York',

    // === US STATES: CENTRAL TIME ===
    'AL': 'America/Chicago',  'ALABAMA': 'America/Chicago',
    'AR': 'America/Chicago',  'ARKANSAS': 'America/Chicago',
    'IL': 'America/Chicago',  'ILLINOIS': 'America/Chicago',
    'IA': 'America/Chicago',  'IOWA': 'America/Chicago',
    'KS': 'America/Chicago',  'KANSAS': 'America/Chicago',
    'KY': 'America/New_York', 'KENTUCKY': 'America/New_York',
    'LA': 'America/Chicago',  'LOUISIANA': 'America/Chicago',
    'MN': 'America/Chicago',  'MINNESOTA': 'America/Chicago',
    'MS': 'America/Chicago',  'MISSISSIPPI': 'America/Chicago',
    'MO': 'America/Chicago',  'MISSOURI': 'America/Chicago',
    'NE': 'America/Chicago',  'NEBRASKA': 'America/Chicago',
    'ND': 'America/Chicago',  'NORTH DAKOTA': 'America/Chicago',
    'OK': 'America/Chicago',  'OKLAHOMA': 'America/Chicago',
    'SD': 'America/Chicago',  'SOUTH DAKOTA': 'America/Chicago',
    'TN': 'America/Chicago',  'TENNESSEE': 'America/Chicago',
    'TX': 'America/Chicago',  'TEXAS': 'America/Chicago',
    'WI': 'America/Chicago',  'WISCONSIN': 'America/Chicago',

    // === US STATES: MOUNTAIN TIME ===
    'AZ': 'America/Phoenix',  'ARIZONA': 'America/Phoenix',
    'CO': 'America/Denver',   'COLORADO': 'America/Denver',
    'ID': 'America/Boise',    'IDAHO': 'America/Boise',
    'MT': 'America/Denver',   'MONTANA': 'America/Denver',
    'NM': 'America/Denver',   'NEW MEXICO': 'America/Denver',
    'UT': 'America/Denver',   'UTAH': 'America/Denver',
    'WY': 'America/Denver',   'WYOMING': 'America/Denver',

    // === US STATES: PACIFIC TIME ===
    'CA': 'America/Los_Angeles', 'CALIFORNIA': 'America/Los_Angeles',
    'NV': 'America/Los_Angeles', 'NEVADA': 'America/Los_Angeles',
    'OR': 'America/Los_Angeles', 'OREGON': 'America/Los_Angeles',
    'WA': 'America/Los_Angeles', 'WASHINGTON': 'America/Los_Angeles',

    // === US STATES: ALASKA & HAWAII ===
    'AK': 'America/Anchorage',   'ALASKA': 'America/Anchorage',
    'HI': 'America/Honolulu',    'HAWAII': 'America/Honolulu'
};

// Comprehensive NPA Area Code Sets for US & Canada
const NPA_PACIFIC = new Set([
    '209', '213', '310', '323', '408', '415', '424', '442', '510', '530', '559', '562', '619', '626', '628', '650', '657', '661', '669', '707', '714', '747', '760', '805', '818', '820', '831', '840', '858', '909', '916', '925', '949', '951',
    '702', '725', '775',
    '503', '541', '971', '458',
    '206', '253', '360', '425', '509', '564',
    '604', '778', '250', '236', '672', '867'
]);

const NPA_MOUNTAIN = new Set([
    '480', '520', '602', '623', '928',
    '303', '719', '720', '970',
    '208', '986',
    '406',
    '505', '575',
    '385', '435', '801',
    '307',
    '403', '780', '587', '825'
]);

const NPA_CENTRAL = new Set([
    '210', '214', '254', '281', '325', '346', '361', '409', '430', '432', '469', '512', '713', '726', '737', '806', '817', '830', '832', '903', '915', '936', '940', '956', '972', '979',
    '217', '224', '309', '312', '331', '618', '630', '708', '773', '779', '815', '847', '872',
    '225', '318', '337', '504', '985',
    '218', '320', '507', '612', '651', '763', '952',
    '314', '417', '573', '636', '660', '816',
    '262', '414', '534', '608', '715', '920',
    '423', '615', '629', '731', '865', '901', '931',
    '205', '251', '256', '334', '938',
    '479', '501', '870',
    '319', '515', '563', '641', '712',
    '316', '620', '785', '913',
    '228', '601', '662', '769',
    '308', '402', '531',
    '701', '605',
    '405', '539', '580', '918',
    '204', '431', '306', '639'
]);

const NPA_ATLANTIC = new Set([
    '506', '902', '782', '709'
]);

/**
 * Resolves recipient timezone using Multi-Signal Analysis (100% Bulletproof):
 * 1. Canadian Postal Code FSA (1st letter)
 * 2. USA 5-digit ZIP code prefix
 * 3. State / Province Comprehensive Lookup (50 US States + 13 CA Provinces/Territories)
 * 4. Phone NPA Area Code (Complete North American NPA mapping)
 * 5. Conservative Failsafe Default (Pacific Time for USA to prevent early morning wake-ups)
 */
function resolveTimezone({ phone, postalCode, address, province, country }) {
    const rawZip = String(postalCode || '').trim().toUpperCase();
    const rawAddr = String(address || '').toUpperCase();
    const rawProv = String(province || '').trim().toUpperCase();
    const rawCountry = String(country || '').trim().toUpperCase();
    const cleanPhone = String(phone || '').replace(/[^\d]/g, '');

    // 1. Canadian Postal Code (A1A 1A1 format)
    if (/^[A-Z]\d[A-Z]/.test(rawZip)) {
        const firstChar = rawZip[0];
        const fsaMap = {
            'A': 'America/St_Johns', // NL
            'B': 'America/Halifax',  // NS
            'C': 'America/Halifax',  // PE
            'E': 'America/Moncton',  // NB
            'G': 'America/Toronto',  // QC East
            'H': 'America/Toronto',  // QC Montreal
            'J': 'America/Toronto',  // QC West
            'K': 'America/Toronto',  // ON East
            'L': 'America/Toronto',  // ON Central
            'M': 'America/Toronto',  // ON Toronto
            'N': 'America/Toronto',  // ON South
            'P': 'America/Toronto',  // ON North
            'R': 'America/Winnipeg', // MB
            'S': 'America/Regina',   // SK
            'T': 'America/Edmonton', // AB
            'V': 'America/Vancouver',// BC
            'X': 'America/Yellowknife',
            'Y': 'America/Whitehorse'
        };
        if (fsaMap[firstChar]) return fsaMap[firstChar];
    }

    // 2. USA 5-digit ZIP Code prefix (000-999)
    const usZipMatch = (rawZip.match(/\b\d{5}\b/) || rawAddr.match(/\b\d{5}\b/));
    if (usZipMatch) {
        const zipPrefix = parseInt(usZipMatch[0].slice(0, 3), 10);
        // Eastern Time (000-499)
        if (zipPrefix >= 0 && zipPrefix <= 499) return 'America/New_York';
        // Central Time (500-799)
        if (zipPrefix >= 500 && zipPrefix <= 799) return 'America/Chicago';
        // Mountain Time (800-899)
        if (zipPrefix >= 800 && zipPrefix <= 899) {
            if (zipPrefix >= 850 && zipPrefix <= 865) return 'America/Phoenix';
            return 'America/Denver';
        }
        // Pacific Time (900-969)
        if (zipPrefix >= 900 && zipPrefix <= 969) return 'America/Los_Angeles';
        // Hawaii (967-968)
        if (zipPrefix >= 967 && zipPrefix <= 968) return 'America/Honolulu';
        // Alaska (995-999)
        if (zipPrefix >= 995 && zipPrefix <= 999) return 'America/Anchorage';
    }

    // 3. State / Province Comprehensive Lookup
    if (rawProv) {
        if (STATE_PROVINCE_TIMEZONE_MAP[rawProv]) {
            return STATE_PROVINCE_TIMEZONE_MAP[rawProv];
        }
        for (const [st, tz] of Object.entries(STATE_PROVINCE_TIMEZONE_MAP)) {
            const re = new RegExp(`\\b${st}\\b`, 'i');
            if (re.test(rawProv) || re.test(rawAddr)) {
                return tz;
            }
        }
    }

    // 4. Area Code (NPA 3 digits) Full North American Lookup
    let npa = '';
    if (cleanPhone.startsWith('1') && cleanPhone.length === 11) {
        npa = cleanPhone.slice(1, 4);
    } else if (cleanPhone.length === 10) {
        npa = cleanPhone.slice(0, 3);
    }

    if (npa) {
        if (NPA_ATLANTIC.has(npa)) return 'America/Moncton';
        if (NPA_PACIFIC.has(npa)) return 'America/Los_Angeles';
        if (NPA_MOUNTAIN.has(npa)) {
            if (['480', '520', '602', '623', '928'].includes(npa)) return 'America/Phoenix';
            return 'America/Denver';
        }
        if (NPA_CENTRAL.has(npa)) return 'America/Chicago';
    }

    // 5. BULLETPROOF FAILSAFE DEFAULT:
    // If country is explicitly Canada or province is clearly Canadian, default to Eastern/Toronto.
    // Otherwise for USA / Unknown: Default to Pacific (America/Los_Angeles).
    // WHY? Sending at 10:15 AM Pacific = 1:15 PM Eastern (Safe & Legal everywhere in US!).
    // Never send at 9:00 AM Eastern because it could wake up someone at 6:00 AM Pacific!
    if (rawCountry === 'CA' || rawCountry === 'CANADA' || rawCountry === 'CAN' || rawProv.includes('QUEBEC') || rawProv.includes('ONTARIO')) {
        return 'America/Toronto';
    }

    return 'America/Los_Angeles';
}

const CANADIAN_AREA_CODES = new Set([
    '204', '226', '236', '249', '250', '289', '306', '343', '365', '367', '403', '416', '418',
    '431', '437', '438', '450', '506', '514', '519', '548', '579', '581', '587', '604', '613',
    '639', '647', '672', '705', '709', '778', '780', '782', '807', '819', '825', '867', '873', '902', '905'
]);

/**
 * Resolves lead country code ('CA', 'US', 'FR', 'GB', or 'ALL')
 */
function resolveLeadCountry(lead) {
    if (!lead) return 'ALL';
    const c = String(lead.country || '').toUpperCase().trim();
    if (c === 'CA' || c === 'CAN' || c.includes('CANADA')) return 'CA';
    if (c === 'US' || c === 'USA' || c.includes('UNITED STATES') || c.includes('ÉTATS-UNIS')) return 'US';
    if (c === 'FR' || c === 'FRA' || c.includes('FRANCE')) return 'FR';
    if (c === 'GB' || c === 'UK' || c.includes('ROYAUME-UNI') || c.includes('UNITED KINGDOM')) return 'GB';

    // Check Canadian Postal Code
    const postal = String(lead.postal_code || lead.postalCode || '').trim();
    if (/^[A-Z]\d[A-Z]/i.test(postal)) return 'CA';

    // Check Province / State
    const p = String(lead.province || lead.state || '').toUpperCase().trim();
    const caProvinces = ['QC', 'QUEBEC', 'ON', 'ONTARIO', 'BC', 'BRITISH COLUMBIA', 'AB', 'ALBERTA', 'MB', 'MANITOBA', 'SK', 'SASKATCHEWAN', 'NB', 'NEW BRUNSWICK', 'NS', 'NOVA SCOTIA', 'PE', 'PRINCE EDWARD ISLAND', 'NL', 'NEWFOUNDLAND', 'YT', 'YUKON', 'NT', 'NORTHWEST TERRITORIES', 'NU', 'NUNAVUT'];
    if (caProvinces.includes(p)) return 'CA';

    const cleanPhone = String(lead.phone || lead.phoneNumber || '').replace(/[^\d+]/g, '');
    if (cleanPhone.startsWith('+33') || cleanPhone.startsWith('0033')) return 'FR';
    if (cleanPhone.startsWith('+44') || cleanPhone.startsWith('0044')) return 'GB';

    // NPA check for North American +1 numbers
    let npa = '';
    const digitsOnly = cleanPhone.replace(/^\+/, '');
    if (digitsOnly.startsWith('1') && digitsOnly.length === 11) {
        npa = digitsOnly.slice(1, 4);
    } else if (digitsOnly.length === 10) {
        npa = digitsOnly.slice(0, 3);
    }

    if (npa) {
        if (CANADIAN_AREA_CODES.has(npa)) return 'CA';
        return 'US';
    }

    return 'ALL';
}

/**
 * Extracts zoned date parts using Intl.DateTimeFormat
 */
function getZonedParts(date, timezone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    });
    const parts = {};
    formatter.formatToParts(date).forEach(p => { parts[p.type] = p.value; });
    return {
        weekday: parts.weekday,
        year: parseInt(parts.year, 10),
        month: parseInt(parts.month, 10),
        day: parseInt(parts.day, 10),
        hour: parseInt(parts.hour, 10),
        minute: parseInt(parts.minute, 10)
    };
}

/**
 * Returns true if the given date falls into legal business hours (09:30 - 17:30, Mon-Fri) in the target timezone
 * Strictly excludes Saturday and Sunday.
 */
function isWithinLegalWindow(date, timezone = 'America/Los_Angeles') {
    try {
        const { weekday, hour, minute } = getZonedParts(date, timezone);
        // Weekend check: Sat and Sun strictly excluded
        if (weekday === 'Sat' || weekday === 'Sun') return false;

        // Legal business hours: 09:30 to 17:30 in recipient timezone
        if (hour < 9 || (hour === 9 && minute < 30) || hour >= 18) return false;

        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Calculates the next legal send timestamp in recipient timezone
 * Automatically bumps past night/weekend to Monday at 09:30 - 10:15 AM local time
 */
function getNextLegalSendTime(targetDate, timezone = 'America/Los_Angeles') {
    let d = new Date(targetDate);
    // Check up to 10 days ahead in 30-minute steps
    const maxSteps = 10 * 24 * 2; // 480 steps = 10 days
    for (let step = 0; step < maxSteps; step++) {
        if (isWithinLegalWindow(d, timezone)) {
            return d.toISOString();
        }
        d = new Date(d.getTime() + 30 * 60 * 1000);
    }
    return d.toISOString();
}

/**
 * Loads or initializes Sequence Settings from Firestore
 */
async function getSequenceSettings() {
    try {
        const docSnap = await db.collection('settings').doc('sms_sequence_config').get();
        if (docSnap.exists) {
            return { ...DEFAULT_SETTINGS, ...docSnap.data() };
        }
    } catch (err) {
        console.warn("[Sequences] Error reading config, using defaults:", err.message);
    }
    return { ...DEFAULT_SETTINGS };
}

/**
 * Saves Sequence Settings
 */
async function saveSequenceSettings(settings) {
    const toSave = {
        dryRun: settings.dryRun !== undefined ? Boolean(settings.dryRun) : true,
        autoSendEnabled: settings.autoSendEnabled !== undefined ? Boolean(settings.autoSendEnabled) : true,
        adminAlertPhone: settings.adminAlertPhone || DEFAULT_SETTINGS.adminAlertPhone,
        adminAlertsEnabled: settings.adminAlertsEnabled !== false,
        batchSize: parseInt(settings.batchSize, 10) || 25,
        updatedAt: new Date().toISOString()
    };
    await db.collection('settings').doc('sms_sequence_config').set(toSave, { merge: true });
    return toSave;
}

/**
 * Detects whether a lead should receive French or English SMS sequences.
 * RULE: English by default, UNLESS in Quebec (QC) or clearly Francophone.
 */
function isLeadFrancophone(lead = {}) {
    // 1. Explicit preference on lead document
    if (lead.preferredLanguage) {
        return String(lead.preferredLanguage).toLowerCase().startsWith('fr');
    }

    const prov = String(lead.province || lead.state || '').trim().toUpperCase();
    const city = String(lead.city || '').trim().toLowerCase();
    const address = String(lead.address || lead.formattedAddress || '').toUpperCase();
    const postal = String(lead.postal_code || lead.postalCode || '').trim().toUpperCase();
    const cleanPhone = String(lead.phone || '').replace(/[^\d]/g, '');

    // 2. Quebec province check
    if (prov === 'QC' || prov === 'QUEBEC' || prov === 'QUÉBEC' || 
        address.includes(' QC ') || address.includes(', QC') || address.includes('QUEBEC') || address.includes('QUÉBEC')) {
        return true;
    }

    // 3. Quebec Canadian Postal Code FSA (G, H, J)
    if (/^[GHJ]\d[A-Z]/.test(postal)) {
        return true;
    }

    // 4. Quebec Phone Area Codes (NPA)
    if (cleanPhone.length >= 10) {
        const areaCode = cleanPhone.length === 11 && cleanPhone.startsWith('1')
            ? cleanPhone.slice(1, 4)
            : cleanPhone.slice(0, 3);
        const qcAreaCodes = ['418', '581', '367', '514', '438', '450', '579', '819', '873'];
        if (qcAreaCodes.includes(areaCode)) {
            return true;
        }
    }

    // 5. Well-known Quebec cities
    const qcCities = [
        'montréal', 'montreal', 'québec', 'quebec', 'laval', 'gatineau', 'longueuil', 'sherbrooke',
        'lévis', 'levis', 'saguenay', 'trois-rivières', 'trois-rivieres', 'terrebonne', 'saint-jean-sur-richelieu',
        'brossard', 'repentigny', 'drummondville', 'saint-jérôme', 'saint-jerome', 'granby', 'blainville',
        'mirabel', 'shawinigan', 'rimouski', 'victoriaville', 'rouyn-noranda', 'châteauguay', 'saint-hyacinthe',
        'magog', 'val-d-or', 'alma', 'baie-comeau', 'sept-îles', 'deschambault'
    ];
    if (qcCities.some(c => city.includes(c))) {
        return true;
    }

    // 6. Explicit French business naming patterns
    const bizName = String(lead.business_name || lead.company || lead.name || '').toLowerCase();
    const frPatterns = /\b(clinique|rénovation|renovation|plomberie|toiture|menuiserie|électricien|electricite|avocat|notaire|comptable|esthétique|esthetique|coiffure|boutique|chiropratique|santé|sante|dentaire|ébénisterie|paysagiste)\b/i;
    if (frPatterns.test(bizName)) {
        return true;
    }

    // 7. DEFAULT: English for all other Canada provinces and all US states!
    return false;
}

/**
 * Retrieves all available Sequences (from Firestore or default seed)
 */
async function getSequences() {
    try {
        const snap = await db.collection('sms_sequences').get();
        if (!snap.empty) {
            let list = [];
            for (const d of snap.docs) {
                let data = { id: d.id, ...d.data() };
                const defaultSeq = DEFAULT_SEQUENCES.find(s => s.id === d.id);
                if (defaultSeq) {
                    let updated = false;
                    if (!data.steps || data.steps.length < defaultSeq.steps.length) {
                        data.steps = defaultSeq.steps;
                        data.targetCountry = defaultSeq.targetCountry;
                        data.name = defaultSeq.name;
                        data.description = defaultSeq.description;
                        updated = true;
                    } else {
                        data.steps.forEach((st, idx) => {
                            const defStep = defaultSeq?.steps?.[idx];
                            if (st.template && st.template.includes('Maxime')) {
                                st.template = st.template.replace(/Maxime/g, 'Ben');
                                updated = true;
                            }
                            if (st.template && st.template.includes('solutionsquasar.ca/demo')) {
                                st.template = st.template.replace(/https?:\/\/solutionsquasar\.ca\/demo/g, 'https://cliniquetn.ca et https://caissiecapeoasis.com');
                                updated = true;
                            }
                            if (!st.template_en && defStep?.template_en) {
                                st.template_en = defStep.template_en;
                                updated = true;
                            }
                        });
                    }
                    if (data.targetCountry === 'FR' || data.targetCountry === 'GB') {
                        data.targetCountry = 'ALL';
                        updated = true;
                    }
                    if (updated) {
                        try {
                            await d.ref.update({
                                steps: data.steps,
                                targetCountry: data.targetCountry || 'ALL',
                                name: data.name,
                                description: data.description,
                                updatedAt: new Date().toISOString()
                            });
                        } catch (_) {}
                    }
                }
                list.push(data);
            }

            // Auto-seed any newly added default sequences (e.g. seq_missing_gmb_website)
            for (const defSeq of DEFAULT_SEQUENCES) {
                if (!list.some(s => s.id === defSeq.id)) {
                    try {
                        await db.collection('sms_sequences').doc(defSeq.id).set(defSeq);
                        list.push(defSeq);
                    } catch (_) {}
                }
            }

            return list;
        }
    } catch (_) {}

    // Seed default sequences to Firestore if empty
    try {
        for (const seq of DEFAULT_SEQUENCES) {
            await db.collection('sms_sequences').doc(seq.id).set(seq);
        }
    } catch (_) {}

    return DEFAULT_SEQUENCES;
}

/**
 * Resolves the most relevant live demo link for a given lead
 */
function resolveDemoUrl(lead = {}) {
    const text = `${lead.industry || ''} ${lead.category || ''} ${lead.business_name || ''} ${lead.name || ''}`.toLowerCase();
    const isHealthOrMedical = /(santé|sante|clinique|clinic|dentist|dentiste|chiro|médic|medic|soin|spa|physio|avocat|lawyer|comptable|accountant|doctor|docteur)/i.test(text);
    return isHealthOrMedical ? 'https://cliniquetn.ca' : 'https://caissiecapeoasis.com';
}

/**
 * Detects and extracts a legitimate human first name from lead fields.
 * Returns null if the name is missing, equals the company name, or matches corporate keywords.
 */
function extractHumanFirstName(lead = {}) {
    const biz = String(lead.company || lead.business_name || '').trim().toLowerCase();
    
    // Potential name candidates in order of priority
    const candidates = [
        lead.first_name,
        lead.contact_name,
        lead.manager_name,
        lead.contactPerson,
        lead.name
    ];

    for (const cand of candidates) {
        if (!cand || typeof cand !== 'string') continue;
        const trimmed = cand.trim();
        if (!trimmed) continue;
        const lower = trimmed.toLowerCase();

        // If candidate name matches or contains the company name, reject
        if (biz && (lower === biz || biz.startsWith(lower) || biz.endsWith(lower) || biz.includes(lower))) {
            continue;
        }

        // Reject if candidate contains corporate/business naming keywords
        const bizKeywords = /\b(inc|ltd|llc|corp|co|clinique|clinic|centre|center|spa|salon|garage|plomberie|toiture|rénovation|renovation|services|boutique|groupe|group|auto|esthetique|esthétique|chiro|dentaire|restaurant|bar|cafe|café|hôtel|hotel|motel|lavage|gym|studio|avocat|notaire|entrepôt|entrepot)\b/i;
        if (bizKeywords.test(lower)) {
            continue;
        }

        // It looks like a real person's name! Extract first name if multiple words (e.g. "Stéphane Gagnon" -> "Stéphane")
        const firstName = trimmed.split(/\s+/)[0].replace(/[^a-zA-ZÀ-ÿ-]/g, '');
        if (firstName.length >= 2) {
            return firstName.charAt(0).toUpperCase() + firstName.slice(1);
        }
    }

    return null;
}

/**
 * Replaces message placeholders {{name}}, {{company}}, {{city}}, {{industry}}, {{demo_url}}, {{demo_clinic}}, {{demo_oasis}}
 * with smart grammatical fallback when person name is unknown (e.g. "Bonjour," instead of "Bonjour Entreprise Inc,")
 */
function interpolateTemplate(template, lead = {}, isFr = true) {
    if (!template) return '';
    
    const humanName = extractHumanFirstName(lead);
    const defaultCompany = isFr ? 'votre entreprise' : 'your business';
    const defaultCity = isFr ? 'votre secteur' : 'your area';
    const defaultIndustry = isFr ? 'votre domaine' : 'your industry';

    const company = lead.company || lead.business_name || defaultCompany;
    const city = lead.city || defaultCity;
    const industry = lead.industry || lead.category || defaultIndustry;
    const platformName = lead.directory_platform || (isFr ? 'une plateforme tierce' : 'a third-party platform');

    let text = template;

    if (humanName) {
        text = text.replace(/{{name}}/g, humanName);
    } else {
        // French replacements without awkward repetitions or punctuation glitches
        text = text.replace(/Allo\s+{{name}}\s*([,!])?/gi, (_, p) => p ? `Allo ${p}` : 'Allo,');
        text = text.replace(/Bonjour\s+{{name}}\s*([,.\?!])?/gi, (_, p) => p ? `Bonjour ${p}` : 'Bonjour,');
        text = text.replace(/Rebonjour\s+{{name}}\s*([,.\?!])?/gi, (_, p) => p ? `Rebonjour ${p}` : 'Rebonjour,');
        text = text.replace(/Dernier\s+petit\s+mot\s+{{name}}\s*([,.\?!])?/gi, (_, p) => p ? `Dernier petit mot ${p}` : 'Dernier petit mot,');
        text = text.replace(/Dernier\s+message\s+{{name}}\s*([,.\?!])?/gi, (_, p) => p ? `Dernier message ${p}` : 'Dernier message,');
        text = text.replace(/Dernier\s+mot\s+{{name}}\s*([,.\?!])?/gi, (_, p) => p ? `Dernier mot ${p}` : 'Dernier mot,');
        text = text.replace(/Dernier\s+suivi\s+{{name}}\s*([,.\?!])?/gi, (_, p) => p ? `Dernier suivi ${p}` : 'Dernier suivi,');
        text = text.replace(/Dernier\s+suivi\s+de\s+courtoisie\s+{{name}}\s*([,.\?!])?/gi, (_, p) => p ? `Dernier suivi de courtoisie ${p}` : 'Dernier suivi de courtoisie.');

        // English replacements
        text = text.replace(/Hey\s+{{name}}\s*([,!])?/gi, (_, p) => p ? `Hey ${p}` : 'Hey,');
        text = text.replace(/Hi\s+{{name}}\s*([,.\?!])?/gi, (_, p) => p ? `Hi ${p}` : 'Hi,');
        text = text.replace(/Hello\s+{{name}}\s*([,.\?!])?/gi, (_, p) => p ? `Hello ${p}` : 'Hello,');
        text = text.replace(/Final\s+note\s+{{name}}\s*([,.\?!])?/gi, (_, p) => p ? `Final note ${p}` : 'Final note,');
        text = text.replace(/Final\s+courtesy\s+note\s+{{name}}\s*([,.\?!])?/gi, (_, p) => p ? `Final courtesy note ${p}` : 'Final courtesy note.');
        text = text.replace(/Last\s+note\s+{{name}}\s*([,.\?!])?/gi, (_, p) => p ? `Last note ${p}` : 'Last note,');
        text = text.replace(/Last\s+check-in\s+{{name}}\s*([,.\?!])?/gi, (_, p) => p ? `Last check-in ${p}` : 'Last check-in,');
        text = text.replace(/Last\s+courtesy\s+(?:note|follow-up)\s+{{name}}\s*([,.\?!])?/gi, (_, p) => p ? `Last courtesy note ${p}` : 'Last courtesy note.');

        // Clean any standalone {{name}} tag
        text = text.replace(/{{name}}/g, '');
    }

    text = text
        .replace(/{{company}}/g, company)
        .replace(/{{city}}/g, city)
        .replace(/{{industry}}/g, industry)
        .replace(/{{platform_name}}/g, platformName)
        .replace(/{{demo_url}}/g, resolveDemoUrl(lead))
        .replace(/{{demo_clinic}}/g, 'https://cliniquetn.ca')
        .replace(/{{demo_oasis}}/g, 'https://caissiecapeoasis.com');

    // Clean up spaces before punctuation, double punctuation or double spaces
    text = text
        .replace(/\s+([,.\?!])/g, '$1')
        .replace(/,\s*,/g, ',')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return text;
}

/**
 * Binds and triggers a Sequence for a Lead
 */
async function triggerLeadSequence({ leadId, sequenceId, dryRunOverride }) {
    if (!leadId) throw new Error("leadId is required");

    let leadRef = db.collection('crm_leads').doc(leadId);
    let leadSnap = await leadRef.get();
    if (!leadSnap.exists) {
        leadRef = db.collection('leads').doc(leadId);
        leadSnap = await leadRef.get();
    }
    if (!leadSnap.exists) throw new Error("Lead introuvable");

    const lead = leadSnap.data();

    // 0. Master Switch Check: Are automated SMS sequences globally enabled?
    const globalSettings = await getSequenceSettings();
    if (globalSettings.autoSendEnabled === false) {
        console.log(`[Sequences] ⏸️ Lead ${leadId} (${lead.business_name || lead.name}): Envois automatiques en pause (Master Switch). Séquence non déclenchée.`);
        return {
            skipped: true,
            paused: true,
            reason: 'Envois automatiques de SMS désactivés par le Master Switch dans le CRM.'
        };
    }

    // 1. Franchise Exclusion Rule
    if (lead.isFranchise || lead.status === 'Excluded / Franchise') {
        console.log(`[Sequences] Lead ${leadId} (${lead.business_name}) is a Franchise. EXCLUDED from automated SMS sequences.`);
        return {
            skipped: true,
            reason: 'Franchise excluded from automated sequences.'
        };
    }

    // 2. Opt-out check
    if (lead.smsOptOut || lead.doNotContact) {
        return { skipped: true, reason: 'Lead has opted out.' };
    }

    if (!lead.phone) {
        return { skipped: true, reason: 'No valid phone number for lead.' };
    }

    // 2.1 CASL / LCAP Compliance Protection (Canadian Destinations)
    const { isCanadianDestination } = require('./telnyx-service');
    const isCanadian = isCanadianDestination(lead.phone, lead);
    if (isCanadian && !dryRunOverride) {
        if (lead.casl?.status === 'INELIGIBLE') {
            console.log(`[Sequences] 🛑 BLOCKED (CASL INELIGIBLE): Lead ${leadId} (${lead.business_name || lead.name}): Sollicitation interdite sur le site.`);
            return {
                skipped: true,
                reason: `Conformité LCAP / CASL : ${lead.casl?.notes || 'Sollicitation commerciale interdite par l\'entreprise sur son site web.'}`
            };
        }
        if (lead.casl?.status === 'REVIEW') {
            console.log(`[Sequences] ⚠️ BLOCKED (CASL REVIEW): Lead ${leadId} (${lead.business_name || lead.name}): Publication bien en vue non confirmée.`);
            return {
                skipped: true,
                reviewRequired: true,
                reason: `Conformité LCAP / CASL : Le numéro n'a pas été détecté sur le site officiel de l'entreprise. Vérification manuelle requise avant envoi automatique.`
            };
        }
    }

    // 3. Landline & Carrier Intelligence Protection (Telnyx)
    let phoneValidation = null;
    try {
        phoneValidation = await phoneValidatorService.validatePhoneNumber(lead.phone, {
            ...lead,
            id: leadId
        });
    } catch (_) {}

    if (phoneValidation && (!phoneValidation.sms_eligible || phoneValidation.phone_type === 'landline')) {
        const carrier = phoneValidation.carrier_name || 'Ligne Fixe';
        console.log(`[Sequences] 🛑 BLOCKED: Lead ${leadId} (${lead.business_name || lead.name}) is a LANDLINE (${carrier}). Séquence SMS impossible.`);
        
        aiActivityService.log({
            category: 'sms',
            type: 'sms_blocked_landline',
            level: 'warning',
            title: `Séquence SMS bloquée (Ligne fixe)`,
            detail: `Le numéro ${lead.phone} (${carrier}) est une ligne fixe. L'envoi de SMS est bloqué pour protéger votre réputation télécom. Privilégier un appel vocal ou Gmail.`,
            leadName: lead.business_name || lead.name,
            phone: lead.phone
        });

        await leadRef.update({
            phone_type: phoneValidation.phone_type,
            carrier_name: carrier,
            sms_eligible: false,
            recommended_channel: 'call',
            sequenceStatus: 'BLOCKED_LANDLINE'
        });

        return {
            skipped: true,
            reason: `Ligne fixe détectée (${carrier}). Envoi de SMS bloqué pour protéger votre réputation télécom. Privilégiez un appel ou Gmail.`
        };
    }

    // Load Sequence Config
    const sequences = await getSequences();
    let targetSeq = sequences.find(s => s.id === sequenceId);

    // Auto-match by lead category and country if sequenceId not explicitly provided
    if (!targetSeq) {
        const leadCat = lead.category || lead.leadCategory || (lead.has_directory_only ? 'directory_only' : (lead.website ? 'outdated_website' : 'no_website'));
        const leadCountry = resolveLeadCountry(lead);

        // 1. Exact match on category AND targetCountry
        if (leadCountry !== 'ALL') {
            targetSeq = sequences.find(s => s.targetCategory === leadCat && s.targetCountry === leadCountry);
        }
        // 2. Fallback to category with ALL or undefined targetCountry
        if (!targetSeq) {
            targetSeq = sequences.find(s => s.targetCategory === leadCat && (!s.targetCountry || s.targetCountry === 'ALL'));
        }
        // 3. Fallback to any sequence matching country
        if (!targetSeq && leadCountry !== 'ALL') {
            targetSeq = sequences.find(s => s.targetCountry === leadCountry);
        }
        // 4. Fallback to category or first sequence
        if (!targetSeq) {
            targetSeq = sequences.find(s => s.targetCategory === leadCat) || sequences[0];
        }
    }

    const settings = await getSequenceSettings();
    const isDryRun = dryRunOverride !== undefined ? Boolean(dryRunOverride) : settings.dryRun;

    // Resolve Timezone
    const timezone = resolveTimezone({
        phone: lead.phone,
        postalCode: lead.postal_code || lead.postalCode,
        address: lead.address || lead.formattedAddress,
        province: lead.province || lead.state,
        country: lead.country
    });

    // Schedule all steps
    const now = new Date();
    const scheduledSteps = (targetSeq.steps || []).map((step, idx) => {
        let baseDate = new Date(now.getTime() + (step.delayHours * 3600000));
        let legalSendDate = getNextLegalSendTime(baseDate, timezone);
        return {
            stepNumber: step.stepNumber || (idx + 1),
            delayHours: step.delayHours,
            template: step.template,
            template_en: step.template_en || null,
            scheduledFor: legalSendDate,
            status: idx === 0 ? 'PENDING' : 'SCHEDULED',
            sentAt: null
        };
    });

    const isFrancophone = isLeadFrancophone(lead);
    const instanceId = `seq_${leadId}_${Date.now()}`;
    const instanceData = {
        instanceId,
        leadId,
        sequenceId: targetSeq.id,
        sequenceName: targetSeq.name,
        targetCategory: targetSeq.targetCategory,
        phone: lead.phone,
        leadName: lead.name || lead.business_name || '',
        companyName: lead.company || lead.business_name || '',
        timezone,
        isFrancophone,
        dryRun: isDryRun,
        status: 'ACTIVE', // ACTIVE, STOPPED_REPLIED, STOPPED_OPT_OUT, COMPLETED
        currentStep: 1,
        totalSteps: scheduledSteps.length,
        steps: scheduledSteps,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    };

    await db.collection('sequence_instances').doc(instanceId).set(instanceData);

    // Update Lead Doc with active sequence link
    const firstStepScheduledFor = scheduledSteps[0]?.scheduledFor || null;
    await leadRef.update({
        activeSequenceId: targetSeq.id,
        sequenceName: targetSeq.name,
        sequenceInstanceId: instanceId,
        sequenceStatus: 'ACTIVE',
        sequenceCategory: targetSeq.targetCategory,
        timezone,
        nextStepDue: firstStepScheduledFor,
        nextStepNumber: 1,
        totalSequenceSteps: scheduledSteps.length,
        updatedAt: now.toISOString()
    });

    console.log(`[Sequences] Triggered "${targetSeq.name}" on Lead ${leadId} (${lead.phone}) | Dry-Run: ${isDryRun} | TZ: ${timezone}`);

    aiActivityService.log({
        category: 'sms',
        type: 'seq_assigned',
        level: 'info',
        title: `Séquence activée : ${targetSeq.name}`,
        detail: `Lead: "${lead.business_name || lead.name}" (${lead.phone}) • ${scheduledSteps.length} étapes planifiées • Mode : ${isDryRun ? 'Simulation Dry-Run' : 'Production Twilio'} • Fuseau : ${timezone}`,
        leadName: lead.business_name || lead.name,
        phone: lead.phone
    });

    // If step 1 is scheduled within next 15 minutes, execute immediately
    const firstStep = scheduledSteps[0];
    if (firstStep && firstStep.delayHours <= 0.25) {
        await executeInstanceStep(instanceId, 1);
    }

    return {
        success: true,
        instanceId,
        sequenceName: targetSeq.name,
        dryRun: isDryRun,
        timezone,
        firstStepDue: firstStep ? firstStep.scheduledFor : null
    };
}

/**
 * Executes a single step of a Sequence Instance
 */
async function executeInstanceStep(instanceId, stepNumber) {
    const instRef = db.collection('sequence_instances').doc(instanceId);
    const instSnap = await instRef.get();
    if (!instSnap.exists) return;

    const inst = instSnap.data();
    if (inst.status !== 'ACTIVE') {
        console.log(`[Sequences] Instance ${instanceId} is not ACTIVE (${inst.status}). Skipping step.`);
        return;
    }

    let leadRef = db.collection('crm_leads').doc(inst.leadId);
    let leadSnap = await leadRef.get();
    if (!leadSnap.exists) {
        leadRef = db.collection('leads').doc(inst.leadId);
        leadSnap = await leadRef.get();
    }
    if (!leadSnap.exists) return;
    const lead = leadSnap.data();

    // Kill switch: Check if prospect has replied, booked or opted out
    if (lead.smsOptOut || lead.smsStatus === 'Replied' || lead.status === 'Replied' || lead.status === 'Meeting Scheduled') {
        console.log(`[Sequences] Kill-switch triggered for Lead ${inst.leadId}. Halting sequence.`);
        aiActivityService.log({
            category: 'sms',
            type: 'seq_stopped',
            level: 'warning',
            title: `Séquence arrêtée (Kill-Switch)`,
            detail: `Le prospect "${lead.business_name || lead.name}" (${lead.phone}) a répondu ou s'est désabonné. Séquence immédiatement interrompue.`,
            leadName: lead.business_name || lead.name,
            phone: lead.phone
        });
        await instRef.update({
            status: 'STOPPED_REPLIED',
            stoppedAt: new Date().toISOString()
        });
        await leadRef.update({ sequenceStatus: 'STOPPED_REPLIED' });
        return;
    }

    // Landline Protection Check
    if (lead.phone_type === 'landline' || lead.sms_eligible === false) {
        console.log(`[Sequences] Step blocked: Lead ${inst.leadId} is a landline.`);
        await instRef.update({
            status: 'STOPPED_LANDLINE',
            stoppedAt: new Date().toISOString()
        });
        await leadRef.update({ sequenceStatus: 'BLOCKED_LANDLINE' });
        return;
    }

    const stepIndex = stepNumber - 1;
    const step = inst.steps[stepIndex];
    if (!step) return;

    // Detect language: Default English, French ONLY if in Quebec (QC) or obviously Francophone
    const isFr = (inst.isFrancophone !== undefined) ? inst.isFrancophone : isLeadFrancophone(lead);
    const chosenTemplate = (isFr || !step.template_en) ? step.template : step.template_en;
    const messageBody = interpolateTemplate(chosenTemplate, lead, isFr);

    console.log(`[Sequences] Executing Step ${stepNumber} for ${lead.phone} (Lang: ${isFr ? 'FR' : 'EN'}) | Dry-Run: ${inst.dryRun}`);

    if (inst.dryRun) {
        // --- DRY RUN MODE (SIMULATION) ---
        // Log to simulated logs without touching Twilio
        await db.collection('sms_simulation_logs').add({
            instanceId,
            leadId: inst.leadId,
            to: lead.phone,
            stepNumber,
            body: messageBody,
            timezone: inst.timezone,
            simulatedAt: new Date().toISOString()
        });

        // Update step status in instance
        inst.steps[stepIndex].status = 'SIMULATED';
        inst.steps[stepIndex].sentAt = new Date().toISOString();
        inst.steps[stepIndex].executedBody = messageBody;

        const nextStepIdx = stepNumber; // index of next step in 0-based array
        const nextStepObj = inst.steps[nextStepIdx];
        const nextDue = (nextStepObj && stepNumber < inst.totalSteps) ? nextStepObj.scheduledFor : null;

        await instRef.update({
            currentStep: stepNumber < inst.totalSteps ? stepNumber + 1 : stepNumber,
            status: stepNumber >= inst.totalSteps ? 'COMPLETED' : 'ACTIVE',
            steps: inst.steps,
            updatedAt: new Date().toISOString()
        });

        await leadRef.update({
            lastSimulatedSms: new Date().toISOString(),
            smsSequenceStep: stepNumber,
            smsStatus: 'Simulated',
            nextStepDue: nextDue,
            nextStepNumber: stepNumber < inst.totalSteps ? stepNumber + 1 : null
        });

        aiActivityService.log({
            category: 'sms',
            type: 'sms_simulated',
            level: 'warning',
            title: `SMS Étape ${stepNumber} SIMULÉ (Dry-Run)`,
            detail: `Destinataire : ${lead.phone} ("${lead.business_name || lead.name}")\n💬 Message : "${messageBody}"`,
            leadName: lead.business_name || lead.name,
            phone: lead.phone,
            metadata: { stepNumber, dryRun: true, isDryRun: true, smsBody: messageBody, phone: lead.phone, recipientPhone: lead.phone }
        });

    } else {
        // --- REAL PRODUCTION MODE (TWILIO DISPATCH) ---
        try {
            const sendResult = await twilioService.sendSms({
                to: lead.phone,
                message: messageBody,
                leadContext: lead
            });

            const providerLabel = sendResult.provider === 'telnyx' ? 'Telnyx (USA)' : 'Twilio (Canada)';

            aiActivityService.log({
                category: 'sms',
                type: 'sms_sent',
                level: 'success',
                title: `SMS Étape ${stepNumber} ENVOYÉ (${providerLabel})`,
                detail: `Délivré avec succès vers ${lead.phone} ("${lead.business_name || lead.name}") via ${providerLabel}\n💬 Message : "${messageBody}"`,
                leadName: lead.business_name || lead.name,
                phone: lead.phone,
                metadata: { stepNumber, sid: sendResult.messageSid, provider: sendResult.provider, isDryRun: false, smsBody: messageBody, phone: lead.phone, recipientPhone: lead.phone }
            });

            // Update CRM Lead status to Contacted
            await leadRef.update({
                status: 'Contacted',
                smsStatus: 'Sent',
                lastSmsSent: new Date().toISOString(),
                lastContactDate: new Date().toISOString(),
                smsSequenceStep: stepNumber
            });

            // Synchronize with conversation thread
            const normalizedPhone = twilioService.normalizePhone(lead.phone);
            const sessionId = `sms_${normalizedPhone.replace('+', '')}`;
            const convRef = db.collection('conversations').doc(sessionId);
            const convSnap = await convRef.get();
            let history = convSnap.exists ? (convSnap.data().messages || []) : [];

            history.push({
                role: 'assistant',
                author: 'sequence',
                content: messageBody,
                timestamp: new Date().toISOString(),
                sequenceStep: stepNumber
            });

            await convRef.set({
                sessionId,
                channel: 'sms',
                phoneNumber: normalizedPhone,
                clientName: lead.name || lead.business_name || null,
                companyName: lead.company || lead.business_name || null,
                leadId: inst.leadId,
                aiEnabled: true,
                updatedAt: new Date().toISOString(),
                messages: history.slice(-50)
            }, { merge: true });

            // Update step status in instance
            inst.steps[stepIndex].status = 'SENT';
            inst.steps[stepIndex].sentAt = new Date().toISOString();
            inst.steps[stepIndex].messageSid = sendResult.messageSid;

            const nextStepIdx = stepNumber;
            const nextStepObj = inst.steps[nextStepIdx];
            const nextDue = (nextStepObj && stepNumber < inst.totalSteps) ? nextStepObj.scheduledFor : null;

            await instRef.update({
                currentStep: stepNumber < inst.totalSteps ? stepNumber + 1 : stepNumber,
                status: stepNumber >= inst.totalSteps ? 'COMPLETED' : 'ACTIVE',
                steps: inst.steps,
                updatedAt: new Date().toISOString()
            });

            await leadRef.update({
                smsSequenceStep: stepNumber,
                smsStatus: 'Sent',
                nextStepDue: nextDue,
                nextStepNumber: stepNumber < inst.totalSteps ? stepNumber + 1 : null
            });

        } catch (sendErr) {
            console.error(`[Sequences] Step ${stepNumber} Twilio send failed:`, sendErr.message);
            inst.steps[stepIndex].status = 'FAILED';
            inst.steps[stepIndex].error = sendErr.message;
            await instRef.update({ steps: inst.steps });
        }
    }
}

/**
 * Cron / Worker: Checks all pending scheduled steps across active sequence instances
 */
async function processDueSequenceSteps() {
    try {
        const settings = await getSequenceSettings();
        if (settings.autoSendEnabled === false) {
            // Master Switch is paused: do not send any automated SMS steps
            return;
        }

        const now = new Date();
        const snap = await db.collection('sequence_instances')
            .where('status', '==', 'ACTIVE')
            .get();

        if (snap.empty) return;

        console.log(`[Sequences Engine] Checking ${snap.size} active sequence instances...`);

        for (const doc of snap.docs) {
            const inst = doc.data();
            const currStep = inst.steps[inst.currentStep - 1];

            if (currStep && currStep.status === 'SCHEDULED' || currStep?.status === 'PENDING') {
                const scheduledTime = new Date(currStep.scheduledFor);
                if (scheduledTime <= now) {
                    // Check if right now is legal send window in recipient timezone
                    if (isWithinLegalWindow(now, inst.timezone)) {
                        await executeInstanceStep(doc.id, inst.currentStep);
                    } else {
                        // Reschedule to next legal window
                        const nextLegal = getNextLegalSendTime(now, inst.timezone);
                        currStep.scheduledFor = nextLegal;
                        await doc.ref.update({ steps: inst.steps });
                        if (inst.leadId) {
                            await db.collection('leads').doc(inst.leadId).update({
                                nextStepDue: nextLegal
                            }).catch(() => {});
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error("[Sequences Engine] Error processing scheduled steps:", err.message);
    }
}

/**
 * Sends an instant Admin SMS notification on lead reply or booking
 */
async function notifyAdminOnProspectAction({ leadId, phoneNumber, clientName, companyName, actionType = 'reply', text = '' }) {
    try {
        const settings = await getSequenceSettings();
        if (!settings.adminAlertsEnabled || !settings.adminAlertPhone) return;

        const displayName = clientName || companyName || phoneNumber;
        const snippet = text ? text.replace(/\n/g, ' ').slice(0, 75) : '';

        const alertMessage = actionType === 'booking'
            ? `📅 QUASAR RDV RÉSERVÉ ! ${displayName} a confirmé un appel découverte. Ouvrez l'ERP : https://quasar-erp-b26d5.web.app/#calendar`
            : `🚨 QUASAR ALERT : ${displayName} vient de répondre par SMS ! Message : "${snippet}". L'IA est en pause (Reprise Humaine). Répondre : https://quasar-erp-b26d5.web.app/#sms`;

        console.log(`[Admin Alert] Dispatching notification SMS to admin phone: ${settings.adminAlertPhone}`);
        await twilioService.sendSms({
            to: settings.adminAlertPhone,
            message: alertMessage
        });
    } catch (err) {
        console.warn("[Admin Alert] Failed to dispatch admin SMS alert:", err.message);
    }
}

/**
 * Halts active sequence when a lead replies
 */
async function cancelSequenceOnReply(phoneNumber) {
    try {
        const formatted = twilioService.normalizePhone(phoneNumber);
        const instancesSnap = await db.collection('sequence_instances')
            .where('phone', 'in', [formatted, phoneNumber])
            .where('status', '==', 'ACTIVE')
            .get();

        instancesSnap.forEach(async d => {
            console.log(`[Sequences] Prospect ${formatted} replied. Auto-stopping instance ${d.id}`);
            await d.ref.update({
                status: 'STOPPED_REPLIED',
                stoppedAt: new Date().toISOString()
            });
        });
    } catch (err) {
        console.error("[Sequences] Error cancelling sequence on reply:", err.message);
    }
}

/**
 * Convenience wrapper to trigger sequence by category for a lead
 */
async function triggerSequenceForLead(leadId, category) {
    const sequenceId = category ? `seq_${category}` : null;
    return triggerLeadSequence({ leadId, sequenceId });
}

/**
 * Synchronizes seed sequences into Firestore sms_sequences collection
 */
async function syncDefaultSequences() {
    for (const seq of DEFAULT_SEQUENCES) {
        await db.collection('sms_sequences').doc(seq.id).set(seq, { merge: true });
    }
    console.log(`[Sequences] Synchronized ${DEFAULT_SEQUENCES.length} default sequences into Firestore.`);
    return DEFAULT_SEQUENCES;
}

/**
 * Resolves the complete visual timeline (all 4 steps with actual or projected dates/times) for a lead
 */
async function getLeadSequenceTimeline(leadId) {
    if (!leadId) throw new Error("leadId is required");

    let leadRef = db.collection('crm_leads').doc(leadId);
    let leadSnap = await leadRef.get();
    if (!leadSnap.exists) {
        leadRef = db.collection('leads').doc(leadId);
        leadSnap = await leadRef.get();
    }
    if (!leadSnap.exists) {
        return { success: false, error: "Lead introuvable" };
    }
    const lead = { id: leadSnap.id, ...leadSnap.data() };

    const sequences = await getSequences();
    const globalSettings = await getSequenceSettings();
    const isFr = isLeadFrancophone(lead);
    const timezone = resolveTimezone({
        phone: lead.phone,
        postalCode: lead.postal_code || lead.postalCode,
        address: lead.address || lead.formattedAddress,
        province: lead.province || lead.state,
        country: lead.country
    });

    // Check if there is an active sequence_instance
    let activeInstance = null;
    if (lead.sequenceInstanceId) {
        const instSnap = await db.collection('sequence_instances').doc(lead.sequenceInstanceId).get();
        if (instSnap.exists) {
            activeInstance = instSnap.data();
        }
    }

    if (!activeInstance && leadId) {
        // Fallback: look up by leadId in sequence_instances (no composite index required)
        const qSnap = await db.collection('sequence_instances')
            .where('leadId', '==', leadId)
            .limit(5)
            .get();
        if (!qSnap.empty) {
            const list = [];
            qSnap.forEach(d => list.push(d.data()));
            list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            activeInstance = list[0];
        }
    }

    const STEP_PURPOSES = [
        { label: "Prise de contact & Salutation", color: "#60A5FA" },
        { label: "Question directe & Consentement", color: "var(--gold)" },
        { label: "Relance Valeur & Appel Découverte", color: "#38BDF8" },
        { label: "Preuve Sociale & Démonstrateurs", color: "#A78BFA" },
        { label: "Dernier Suivi de Courtoisie", color: "#94A3B8" },
        { label: "Suivi Trimestriel (Mois +2)", color: "#34D399" },
        { label: "Prise de Nouvelles (Mois +3)", color: "#F472B6" }
    ];

    if (activeInstance) {
        const steps = (activeInstance.steps || []).map((st, idx) => {
            const purpose = STEP_PURPOSES[idx] || { label: `Étape ${st.stepNumber}`, color: 'var(--gold)' };
            const rawTemplate = (isFr || !st.template_en) ? st.template : st.template_en;
            const interpolated = interpolateTemplate(rawTemplate, lead, isFr);
            return {
                stepNumber: st.stepNumber || (idx + 1),
                delayHours: st.delayHours,
                purpose: purpose.label,
                purposeColor: purpose.color,
                scheduledFor: st.scheduledFor,
                status: st.status || 'SCHEDULED',
                sentAt: st.sentAt || null,
                executedBody: st.executedBody || interpolated,
                template: interpolated
            };
        });

        return {
            success: true,
            hasActiveInstance: true,
            instanceId: activeInstance.instanceId,
            sequenceId: activeInstance.sequenceId,
            sequenceName: activeInstance.sequenceName,
            status: activeInstance.status,
            currentStep: activeInstance.currentStep,
            totalSteps: activeInstance.totalSteps,
            timezone: activeInstance.timezone || timezone,
            dryRun: activeInstance.dryRun !== undefined ? activeInstance.dryRun : globalSettings.dryRun,
            isFrancophone: isFr,
            steps
        };
    }

    // No active instance yet: Generate PREVIEW prospective timeline
    const leadCat = lead.category || lead.leadCategory || (lead.has_directory_only ? 'directory_only' : (lead.website ? 'outdated_website' : 'no_website'));
    const leadCountry = resolveLeadCountry(lead);
    let targetSeq;
    if (leadCountry !== 'ALL') {
        targetSeq = sequences.find(s => s.targetCategory === leadCat && s.targetCountry === leadCountry);
    }
    if (!targetSeq) {
        targetSeq = sequences.find(s => s.targetCategory === leadCat && (!s.targetCountry || s.targetCountry === 'ALL'));
    }
    if (!targetSeq) {
        targetSeq = sequences.find(s => s.targetCategory === leadCat) || sequences[0];
    }

    const now = new Date();
    const previewSteps = (targetSeq.steps || []).map((step, idx) => {
        const baseDate = new Date(now.getTime() + (step.delayHours * 3600000));
        const legalSendDate = getNextLegalSendTime(baseDate, timezone);
        const purpose = STEP_PURPOSES[idx] || { label: `Étape ${step.stepNumber}`, color: 'var(--gold)' };
        const rawTemplate = (isFr || !step.template_en) ? step.template : step.template_en;
        const interpolated = interpolateTemplate(rawTemplate, lead, isFr);
        return {
            stepNumber: step.stepNumber || (idx + 1),
            delayHours: step.delayHours,
            purpose: purpose.label,
            purposeColor: purpose.color,
            scheduledFor: legalSendDate,
            status: 'PREVIEW',
            sentAt: null,
            executedBody: interpolated,
            template: interpolated
        };
    });

    return {
        success: true,
        hasActiveInstance: false,
        instanceId: null,
        sequenceId: targetSeq.id,
        sequenceName: targetSeq.name,
        status: 'PENDING_TRIGGER',
        currentStep: 1,
        totalSteps: previewSteps.length,
        timezone,
        dryRun: globalSettings.dryRun,
        isFrancophone: isFr,
        steps: previewSteps
    };
}

module.exports = {
    DEFAULT_SEQUENCES,
    DEFAULT_SETTINGS,
    resolveTimezone,
    isWithinLegalWindow,
    getNextLegalSendTime,
    getSequenceSettings,
    getSettings: getSequenceSettings,
    saveSequenceSettings,
    getSequences,
    syncDefaultSequences,
    triggerLeadSequence,
    triggerSequenceForLead,
    executeInstanceStep,
    processDueSequenceSteps,
    notifyAdminOnProspectAction,
    cancelSequenceOnReply,
    isLeadFrancophone,
    resolveDemoUrl,
    extractHumanFirstName,
    interpolateTemplate,
    getLeadSequenceTimeline,
    resolveLeadCountry
};
