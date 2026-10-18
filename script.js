// ICONS (Inline SVG Library)
const ICONS = {
    menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
    message: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`,
    arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    // Service Icons
    monitor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`,
    layout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    database: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s 9-1.34 9-3V5"></path></svg>`,
    shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    gauge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 18 V12"></path><path d="M16.5 7.5l0 0"></path></svg>`,
    zap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
    smartphone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`,
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
    layers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    award: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>`
};

// LANGUAGE STATE MANAGEMENT
let currentLang = localStorage.getItem('lang') || 'en';

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;

    // Update toggle button states immediately
    document.querySelectorAll('.lang-opt').forEach(btn => {
        const btnLang = btn.textContent.toLowerCase();
        if (btnLang === lang) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    renderSite();
}

function t(textObj) {
    if (typeof textObj === 'string') return textObj; // For non-translated content
    return textObj[currentLang] || textObj.en || textObj;
}

// CONFIGURATION OBJECT - Bilingual Single Source of Truth
const CONFIG = {
    business: {
        name: "Solutions Quasar Inc.",
        tagline: { en: "Ultra-Premium Digital Architecture", fr: "Architecture Numérique Ultra-Premium" },
        phone: "+1 506 233 7006",
        phoneClean: "15062337006",
        email: "info@solutionsquasar.ca",
        address: { en: "Quebec & New Brunswick, Canada", fr: "Québec & Nouveau-Brunswick, Canada" },
        offices: [
            {
                name: { en: "Quebec Office", fr: "Bureau de Québec" },
                address: "131 Rue Montambault, Deschambault, QC G0A 1S0",
                mapUrl: "https://www.google.com/maps/search/?api=1&query=131+Rue+Montambault+Deschambault+QC+G0A+1S0"
            },
            {
                name: { en: "New Brunswick Office", fr: "Bureau du Nouveau-Brunswick" },
                address: "1611 Route 950, Trois-Ruisseaux, NB E4N 2Y7",
                mapUrl: "https://www.google.com/maps/search/?api=1&query=1611+Route+950+Trois-Ruisseaux+NB+E4N+2Y7"
            }
        ],
    },

    nav: [
        { label: { en: "Home", fr: "Accueil" }, href: "#top", icon: ICONS.home },
        { label: { en: "Services", fr: "Services" }, href: "#services", icon: ICONS.layers },
        { label: { en: "Our Work", fr: "Nos Réalisations" }, href: "clients.html", icon: ICONS.star },
        { label: { en: "About", fr: "À Propos" }, href: "about.html", icon: ICONS.info },
        { label: { en: "Contact", fr: "Contact" }, href: "#contact", icon: ICONS.message },
        { label: { en: "Client Portal", fr: "Portail Client" }, href: "portal.html", icon: ICONS.layers }
    ],
    hero: {
        h1: { en: "Premium websites and apps for high standard businesses.", fr: "Sites web et applications premium pour entreprises exigeantes." },
        subhead: { en: "Fast, modern, mobile-first builds that convert.", fr: "Créations rapides, modernes et mobiles qui convertissent." },
        cta: { en: "Book a Strategy Call", fr: "Réserver un Appel Stratégique" },
        trust: { en: "Mobile-first • Performance-focused • Clean SEO foundations", fr: "Mobile d'abord • Axé sur la performance • Fondations SEO solides" },
        imageDesktop: "hero-desktop.png",
        imageMobile: "hero-desktop.png"
    },
    services: {
        label: { en: "Expertise", fr: "Expertise" },
        heading: { en: "What We Do", fr: "Notre Savoir-Faire" },
        title: { en: "Our Expertise", fr: "Notre Expertise" },
        subtitle: { en: "We build systems, not just pages.", fr: "Nous construisons des systèmes, pas seulement des pages." },
        items: [
            {
                icon: "monitor",
                title: { en: "Premium Website Creation", fr: "Création de Sites Web Premium" },
                desc: { en: "Custom-coded, ultra-fast websites designed to position your brand at the top of your industry.", fr: "Sites web ultra-rapides codés sur mesure pour positionner votre marque au sommet de votre industrie." },
                detail: { en: "No templates. Pure performance and aesthetics.", fr: "Aucun modèle. Performance et esthétique pures." },
                url: "websites.html",
                image: "hero_bg_websites.png"
            },
            {
                icon: "layout",
                title: { en: "Custom Business Apps", fr: "Applications d'Affaires Personnalisées" },
                desc: { en: "Tailored web applications to streamline operations and enhance client interaction.", fr: "Applications web sur mesure pour rationaliser les opérations et améliorer l'interaction client." },
                detail: { en: "Client portals, internal tools, and dashboards.", fr: "Portails clients, outils internes et tableaux de bord." },
                url: "apps.html",
                image: "hero_bg_apps.png"
            },
            {
                icon: "database",
                title: { en: "Smart AI Integration", fr: "Intégration IA Intelligente" },
                desc: { en: "Leverage artificial intelligence to automate workflows and personalize user experiences.", fr: "Exploitez l'intelligence artificielle pour automatiser les flux de travail et personnaliser les expériences utilisateur." },
                detail: { en: "Chatbots, predictive analytics, and automated content.", fr: "Chatbots, analyses prédictives et contenu automatisé." },
                url: "ai.html",
                image: "hero_bg_ai.png"
            },
            {
                icon: "search",
                title: { en: "Digital Marketing", fr: "Marketing Numérique" },
                desc: { en: "Data-driven strategies to dominate search results and capture high-value leads.", fr: "Stratégies axées sur les données pour dominer les résultats de recherche et capturer des prospects." },
                detail: { en: "SEO, PPC, and localized growth campaigns.", fr: "SEO, PPC et campagnes de croissance localisées." },
                url: "marketing.html",
                image: "hero_bg_marketing.png"
            },
            {
                icon: "smartphone",
                title: { en: "Mobile App Development", fr: "Dév. d'Applications Mobiles" },
                desc: { en: "Native and cross-platform mobile experiences that feel premium and intuitive.", fr: "Expériences mobiles natives et multiplateformes au ressenti premium et intuitif." },
                detail: { en: "iOS, Android, and Store Management.", fr: "iOS, Android et Gestion des Stores." },
                url: "mobile.html",
                image: "hero_bg_mobile.png"
            }
        ]
    },
    reviews: {
        label: { en: "References", fr: "Références" },
        heading: { en: "Trusted By Professionals", fr: "La Confiance des Professionnels" },
        title: { en: "Client Words", fr: "Témoignages Clients" },
        items: [
            { text: { en: "Solutions Quasar transformed our online image. Professional, fast, and the design is simply stunning.", fr: "Solutions Quasar a transformé notre image en ligne. Professionnel, rapide, et le design est tout simplement magnifique." }, author: { en: "James M., Partner at Law Firm", fr: "James M., Associé dans un Cabinet d'Avocats" } },
            { text: { en: "Finally a web agency that understands business needs. The new site generated leads in week one.", fr: "Enfin une agence web qui comprend les besoins d'affaires. Le nouveau site a généré des prospects dès la première semaine." }, author: { en: "Sarah L., Financial Consultant", fr: "Sarah L., Consultante Financière" } }
        ]
    },
    why: {
        title: { en: "Why Choose Us", fr: "Pourquoi Nous Choisir" },
        heading: { en: "Premium Standards", fr: "Standards Premium" },
        items: [
            { icon: "message", title: { en: "Communication Excellence", fr: "Excellence en Communication" }, desc: { en: "A dedicated partner for your digital growth. Direct access, clear communication at every step.", fr: "Un partenaire dévoué pour votre croissance numérique. Accès direct, communication claire à chaque étape." }, image: "feat_communication_new.png" },
            { icon: "zap", title: { en: "Premium Performance", fr: "Performance Premium" }, desc: { en: "Built to load instantly. We optimize every line of code for speed and SEO ranking.", fr: "Conçu pour charger instantanément. Nous optimisons chaque ligne de code pour la vitesse et le référencement." }, image: "feat_web_speed.png" },
            { icon: "check", title: { en: "Conversion Focused", fr: "Axé sur la Conversion" }, desc: { en: "Beauty with purpose. Every design element is engineered to turn visitors into clients.", fr: "Beauté avec objectif. Chaque élément de design est conçu pour transformer les visiteurs en clients." }, image: "feat_conversion.png" },
            { icon: "smartphone", title: { en: "Mobile Excellence", fr: "Excellence Mobile" }, desc: { en: "A flawless experience on every device. Your brand looks expensive everywhere.", fr: "Une expérience impeccable sur chaque appareil. Votre marque paraît luxueuse partout." }, image: "feat_mobile.png" }
        ]
    },
    about: {
        hero: {
            subtitle: { en: "Who We Are", fr: "Qui Nous Sommes" },
            h1: { en: "Building Digital Excellence for High-Standard Businesses", fr: "Créer l'Excellence Numérique pour les Entreprises Exigeantes" },
            desc: { en: "We're a team of digital architects dedicated to creating premium web solutions that convert.", fr: "Nous sommes une équipe d'architectes numériques dédiés à créer des solutions web premium qui convertissent." }
        },
        story: {
            subtitle: { en: "Our Story", fr: "Notre Histoire" },
            title: { en: "Crafting Premium Digital Experiences", fr: "Créer des Expériences Numériques Premium" },
            p1: { en: "Solutions Quasar was founded on a simple belief: businesses with high standards deserve digital solutions that match their excellence. We specialize in creating ultra-premium, mobile-first websites and applications for professionals who demand the best.", fr: "Solutions Quasar a été fondée sur une conviction simple : les entreprises exigeantes méritent des solutions numériques à la hauteur de leur excellence. Nous nous spécialisons dans la création de sites web et d'applications ultra-premium, mobiles d'abord, pour les professionnels qui exigent le meilleur." },
            p2: { en: "Every project we undertake is built with meticulous attention to detail, combining cutting-edge technology with timeless design principles. We don't just build websites—we architect digital experiences that elevate brands and drive measurable results.", fr: "Chaque projet que nous entreprenons est construit avec une attention méticuleuse aux détails, combinant technologie de pointe et principes de design intemporels. Nous ne construisons pas seulement des sites web—nous concevons des expériences numériques qui élèvent les marques et génèrent des résultats mesurables." }
        },
        values: {
            subtitle: { en: "Our Values", fr: "Nos Valeurs" },
            title: { en: "What Drives Us", fr: "Ce Qui Nous Motive" },
            items: [
                { title: { en: "Excellence First", fr: "Excellence d'Abord" }, desc: { en: "We never compromise on quality. Every line of code, every design element is crafted to premium standards.", fr: "Nous ne faisons jamais de compromis sur la qualité. Chaque ligne de code, chaque élément de design est créé selon des standards premium." } },
                { title: { en: "Speed & Performance", fr: "Vitesse & Performance" }, desc: { en: "Fast-loading, optimized experiences that keep visitors engaged and search engines happy.", fr: "Expériences rapides et optimisées qui maintiennent l'engagement des visiteurs et satisfont les moteurs de recherche." } },
                { title: { en: "Clear Communication", fr: "Communication Claire" }, desc: { en: "Direct access to our team. No runaround, no confusion—just clear, honest dialogue.", fr: "Accès direct à notre équipe. Pas de détours, pas de confusion—juste un dialogue clair et honnête." } },
                { title: { en: "Results Driven", fr: "Axé sur les Résultats" }, desc: { en: "Beautiful design with purpose. Every element engineered to convert visitors into clients.", fr: "Design magnifique avec un objectif. Chaque élément conçu pour convertir les visiteurs en clients." } }
            ]
        },
        team: {
            subtitle: { en: "Our Team", fr: "Notre Équipe" },
            title: { en: "The People Behind the Work", fr: "Les Personnes Derrière le Travail" },
            members: [
                { name: "Benjamin Sultan", role: { en: "Developer", fr: "Développeur" }, bio: { en: "Full-stack developer dedicated to building robust and scalable digital solutions.", fr: "Développeur full-stack dédié à la construction de solutions numériques robustes et évolutives." } },
                { name: "Tim Rieg", role: { en: "Web and AI Consultant", fr: "Consultant Web et IA" }, bio: { en: "Specializing in frontend performance and creating seamless user experiences.", fr: "Spécialisé dans la performance frontend et la création d'expériences utilisateur fluides." } },
                { name: "Mathieu Rieg", role: { en: "Admin Director", fr: "Directeur Administratif" }, bio: { en: "Overseeing strategic operations and ensuring the highest standards of service delivery.", fr: "Supervision des opérations stratégiques et garantie des plus hauts standards de prestation de services." } }
            ]
        },
        cta: {
            title: { en: "Ready to Work Together?", fr: "Prêt à Travailler Ensemble?" },
            desc: { en: "Let's discuss how we can elevate your digital presence with a premium solution built for your business.", fr: "Discutons de la façon dont nous pouvons élever votre présence numérique avec une solution premium conçue pour votre entreprise." }
        }
    },
    contact: {
        title: { en: "Book a Strategy Call", fr: "Réserver un Appel Stratégique" },
        subtitle: { en: "Tell us what you need. We'll reply with next steps.", fr: "Dites-nous ce dont vous avez besoin. Nous vous répondrons avec les prochaines étapes." },
        form: {
            name: { en: "Name", fr: "Nom" },
            namePlaceholder: { en: "John Doe", fr: "Jean Dupont" },
            company: { en: "Firm / Company", fr: "Cabinet / Entreprise" },
            companyPlaceholder: { en: "Miller Law Group", fr: "Cabinet Juridique Miller" },
            contact: { en: "Phone or Email", fr: "Téléphone ou Courriel" },
            contactPlaceholder: { en: "john@example.com", fr: "jean@exemple.com" },
            interest: { en: "Interest", fr: "Intérêt" },
            interestOptions: {
                website: { en: "New Website", fr: "Nouveau Site Web" },
                app: { en: "Custom App", fr: "Application Personnalisée" },
                ai: { en: "AI Integration", fr: "Intégration IA" },
                consult: { en: "Consultation", fr: "Consultation" }
            },
            message: { en: "Message", fr: "Message" },
            messagePlaceholder: { en: "How can we help?", fr: "Comment pouvons-nous vous aider?" },
            submit: { en: "Send Request", fr: "Envoyer la Demande" }
        },
        info: {
            title: { en: "Contact", fr: "Contact" },
            phone: { en: "Phone:", fr: "Téléphone:" },
            email: { en: "Email:", fr: "Courriel:" },
            address: { en: "Address:", fr: "Adresse:" },
            directions: { en: "Get Directions", fr: "Obtenir l'Itinéraire" }
        }
    },
    websites: {
        hero: {
            tag: { en: "Premium Engineering", fr: "Ingénierie Premium" },
            h1: { en: "Websites that define your authority.", fr: "Des sites web qui définissent votre autorité." },
            desc: { en: "Stop losing clients to competitors with better sites. We build custom, ultra-fast digital assets that perform.", fr: "Cessez de perdre des clients face à des concurrents mieux équipés. Nous créons des actifs numériques sur mesure, ultra-rapides et performants." },
            cta: { en: "Start Your Build", fr: "Lancez Votre Projet" }
        },
        features: {
            arch: {
                tag: { en: "Precision Engineering", fr: "Ingénierie de Précision" },
                title: { en: "Custom Architecture", fr: "Architecture Sur Mesure" },
                desc: { en: "We don't rely on bloated templates or drag-and-drop builders. Every line of code is written with purpose, ensuring your site is lean, secure, and built to scale.", fr: "Nous ne comptons pas sur des modèles lourds ou des constructeurs 'glisser-déposer'. Chaque ligne de code est écrite avec un but, assurant un site léger, sécurisé et évolutif." },
                list: [
                    { en: "Semantic HTML5 & Custom CSS3", fr: "HTML5 Sémantique & CSS3 Personnalisé" },
                    { en: "Component-Based Structure", fr: "Structure Basée sur les Composants" },
                    { en: "Zero Dependency Bloat", fr: "Zéro Surcharge de Dépendances" }
                ]
            },
            speed: {
                tag: { en: "Performance First", fr: "Performance Avant Tout" },
                title: { en: "Instant Load Times", fr: "Temps de Chargement Instantanés" },
                desc: { en: "Speed isn't a luxury; it's a requirement. We optimize critical rendering paths and asset delivery to ensure sub-second loads that keep high-value clients engaged.", fr: "La vitesse n'est pas un luxe, c'est une exigence. Nous optimisons le rendu et la livraison des actifs pour assurer des chargements en moins d'une seconde." },
                list: [
                    { en: "95+ PageSpeed Scores", fr: "Scores PageSpeed 95+" },
                    { en: "Next-Gen Image Formats", fr: "Formats d'Image Nouvelle Génération" },
                    { en: "Global CDN Deployment", fr: "Déploiement CDN Global" }
                ]
            },
            mobile: {
                tag: { en: "Responsive Design", fr: "Design Adaptatif" },
                title: { en: "Mobile-First & Fluid", fr: "Mobile-First & Fluide" },
                desc: { en: "Your clients are on their phones. We build experiences that feel like native apps, with touch-optimized interfaces and fluid layouts that look perfect on any device.", fr: "Vos clients sont sur leurs téléphones. Nous créons des expériences qui ressemblent à des applis natives, avec des interfaces tactiles optimisées." },
                list: [
                    { en: "Adaptive Layouts", fr: "Mises en Page Adaptatives" },
                    { en: "Touch-Friendly Targets", fr: "Zones Tactiles Optimisées" },
                    { en: "Cross-Device Consistency", fr: "Cohérence Multi-Appareils" }
                ]
            },
            seo: {
                tag: { en: "Search Visibility", fr: "Visibilité de Recherche" },
                title: { en: "SEO Baked In", fr: "SEO Intégré" },
                desc: { en: "Ranking starts with code. We implement structured data, semantic hierarchy, and technical SEO best practices from day one, giving you a head start in search results.", fr: "Le classement commence par le code. Nous implémentons les données structurées et les meilleures pratiques SEO dès le premier jour." },
                list: [
                    { en: "Schema.org Markup", fr: "Balisage Schema.org" },
                    { en: "Meta Data Optimization", fr: "Optimisation des Métadonnées" },
                    { en: "Accessibility (WCAG) Compliant", fr: "Conformité Accessibilité (WCAG)" }
                ]
            }
        }
    },
    apps: {
        hero: {
            tag: { en: "Digital Transformation", fr: "Transformation Numérique" },
            h1: { en: "Web Apps that power your operations.", fr: "Des applis web qui propulsent vos opérations." },
            desc: { en: "Stop running your business on spreadsheets. We build secure, custom dashboards and client portals that scale.", fr: "Arrêtez de gérer votre entreprise sur des tableurs. Nous construisons des tableaux de bord et portails clients sécurisés qui évoluent." },
            cta: { en: "Build Your App", fr: "Créez Votre Application" }
        },
        features: {
            workflow: {
                tag: { en: "Operational Efficiency", fr: "Efficience Opérationnelle" },
                title: { en: "Custom Workflows", fr: "Flux de Travail Personnalisés" },
                desc: { en: "Generic software forces you to change how you work. We build systems that wrap around your existing processes, automating bottlenecks and eliminating manual data entry.", fr: "Les logiciels génériques vous forcent à changer votre façon de travailler. Nous construisons des systèmes qui s'adaptent à vos processus existants." },
                list: [
                    { en: "Role-Based Access Control", fr: "Contrôle d'Accès par Rôle" },
                    { en: "Automated Approval Chains", fr: "chaînes d'Approbation Automatisées" },
                    { en: "API Integrations (CRM, ERP)", fr: "Intégrations API (CRM, ERP)" }
                ]
            },
            portal: {
                tag: { en: "Client Experience", fr: "Expérience Client" },
                title: { en: "Secure Client Portals", fr: "Portails Clients Sécurisés" },
                desc: { en: "Elevate your client service with a branded, secure login area. Allow clients to upload documents, view project status, and communicate securely without leaving your site.", fr: "Élevez votre service client avec un espace de connexion sécurisé à votre marque. Permettez le partage de documents et le suivi de projet." },
                list: [
                    { en: "Encrypted Document Sharing", fr: "Partage de Documents Chiffré" },
                    { en: "Real-Time Status Updates", fr: "Mises à Jour en Temps Réel" },
                    { en: "White-Label Interface", fr: "Interface Marque Blanche" }
                ]
            },
            dash: {
                tag: { en: "Business Intelligence", fr: "Intelligence d'Affaires" },
                title: { en: "Data Dashboards", fr: "Tableaux de Bord de Données" },
                desc: { en: "Stop guessing. We visualize your firm's data in real-time, giving partners and stakeholders the insights they need to make rapid, informed decisions.", fr: "Arrêtez de deviner. Nous visualisons les données de votre entreprise en temps réel pour des décisions rapides et éclairées." },
                list: [
                    { en: "Live KPI Tracking", fr: "Suivi KPI en Direct" },
                    { en: "Interactive Charts & Graphs", fr: "Graphiques Interactifs" },
                    { en: "Exportable Reports", fr: "Rapports Exportables" }
                ]
            },
            security: {
                tag: { en: "Compliance & Safety", fr: "Conformité & Sécurité" },
                title: { en: "Bank-Grade Security", fr: "Sécurité de Niveau Bancaire" },
                desc: { en: "We treat your data like currency. Every application is built with defense-in-depth architecture, ensuring you meet industry compliance standards (GDPR, SOC2, HIPAA).", fr: "Nous traitons vos données comme une monnaie. Chaque application est construite avec une architecture de défense en profondeur (RGPD, SOC2, HIPAA)." },
                list: [
                    { en: "End-to-End Encryption", fr: "Chiffrement de Bout en Bout" },
                    { en: "Regular Penetration Testing", fr: "Tests d'Intrusion Réguliers" },
                    { en: "2-Factor Authentication", fr: "Authentification à 2 Facteurs" }
                ]
            }
        }
    },
    ai: {
        hero: {
            tag: { en: "Artificial Intelligence", fr: "Intelligence Artificielle" },
            h1: { en: "Future-proof your firm with practical AI.", fr: "Pérennisez votre firme avec une IA pratique." },
            desc: { en: "Automate the mundane. Predict the future. Multiply your output without increasing headcount.", fr: "Automatisez le banal. Prédis l'avenir. Multipliez votre production sans augmenter les effectifs." },
            cta: { en: "Integrate AI Now", fr: "Intégrez l'IA Maintenant" }
        },
        features: {
            concierge: {
                tag: { en: "Smart Automation", fr: "Automatisation Intelligente" },
                title: { en: "24/7 Smart Concierge", fr: "Concierge Intelligent 24/7" },
                desc: { en: "Your firm never sleeps. Our AI agents handle inquiries, schedule appointments, and qualify leads instantly, ensuring no opportunity is missed even after hours.", fr: "Votre firme ne dort jamais. Nos agents IA gèrent les demandes et qualifient les prospects instantanément, même après les heures d'ouverture." },
                list: [
                    { en: "Natural Language Processing", fr: "Traitement du Langage Naturel" },
                    { en: "Multi-Channel Integration", fr: "Intégration Multi-Canaux" },
                    { en: "Instant Escalation to Humans", fr: "Escalade Instantanée aux Humains" }
                ]
            },
            docs: {
                tag: { en: "Data Extraction", fr: "Extraction de Données" },
                title: { en: "Document Intelligence", fr: "Intelligence Documentaire" },
                desc: { en: "Stop manual data entry. We deploy models that read contracts, invoices, and legal documents, extracting key terms and populating your databases automatically.", fr: "Arrêtez la saisie manuelle. Nos modèles lisent contrats et factures, extrayant les termes clés vers vos bases de données automatiquement." },
                list: [
                    { en: "OCR & Context Understanding", fr: "OCR & Compréhension du Contexte" },
                    { en: "99.9% Accuracy Rate", fr: "Taux de Précision de 99.9%" },
                    { en: "Batch Processing", fr: "Traitement par Lots" }
                ]
            },
            score: {
                tag: { en: "Predictive Analytics", fr: "Analyse Prédictive" },
                title: { en: "Predictive Lead Scoring", fr: "Scoring Prédictif de Prospects" },
                desc: { en: "Not all leads are equal. Our algorithms analyze user behavior, firmographics, and engagement to identify high-value prospects before they even reach out.", fr: "Nos algorithmes analysent le comportement et l'engagement pour identifier les prospects à haute valeur avant même qu'ils ne vous contactent." },
                list: [
                    { en: "Propensity to Buy Models", fr: "Modèles de Propension d'Achat" },
                    { en: "Real-Time Scoring Updates", fr: "Mises à Jour de Scoring en Temps Réel" },
                    { en: "CRM Sync", fr: "Synchro CRM" }
                ]
            },
            content: {
                tag: { en: "Generative Creation", fr: "Création Générative" },
                title: { en: "Automated Content", fr: "Contenu Automatisé" },
                desc: { en: "Scale your authority. We build pipelines that generate draft briefs, client updates, and newsletters in your specific brand voice, ready for final review.", fr: "Échelle de votre autorité. Nous générons des ébauches, mises à jour et newsletters dans votre voix de marque, prêtes pour révision." },
                list: [
                    { en: "Brand Voice Calibration", fr: "Calibrage de Voix de Marque" },
                    { en: "SEO-Optimized Drafting", fr: "Rédaction Optimisée SEO" },
                    { en: "Multi-Format Output (Email, Blog, PDF)", fr: "Sortie Multi-Format (Email, Blog, PDF)" }
                ]
            }
        }
    },
    marketing: {
        hero: {
            tag: { en: "Market Dominance", fr: "Domination du Marché" },
            h1: { en: "Be seen by the clients who matter.", fr: "Soyez vu par les clients qui comptent." },
            desc: { en: "Traffic is vanity, revenue is sanity. We deploy precision targeted campaigns to put your firm in front of high-net-worth individuals exactly when they need you.", fr: "Le trafic est une vanité, le revenu est une santé. Nous déployons des campagnes ciblées avec précision pour placer votre firme devant les individus à haute valeur nette exactement quand ils ont besoin de vous." },
            cta: { en: "Launch Your Campaign", fr: "Lancez Votre Campagne" }
        },
        features: {
            seo: {
                tag: { en: "Organic Growth", fr: "Croissance Organique" },
                title: { en: "Elite S.E.O.", fr: "S.E.O. d'Élite" },
                desc: { en: "We don't just target keywords; we target intent. Our technical SEO audits and content strategies ensure you rank for the terms that drive revenue, not just clicks.", fr: "Nous ne visons pas juste les mots-clés ; nous visons l'intention. Nos audits SEO techniques et stratégies de contenu assurent votre classement sur les termes qui génèrent des revenus." },
                list: [
                    { en: "Technical SEO Audits", fr: "Audits SEO Techniques" },
                    { en: "Local Authority Building", fr: "Construction d'Autorité Locale" },
                    { en: "High-Intent Keyword Targeting", fr: "Ciblage de Mots-Clés à Haute Intention" }
                ]
            },
            ads: {
                tag: { en: "Paid Acquisition", fr: "Acquisition Payante" },
                title: { en: "Precision PPC", fr: "PPC de Précision" },
                desc: { en: "Stop wasting budget on broad matches. We build hyper-segmented campaigns on Google and LinkedIn to target specific job titles, incomes, and legal needs.", fr: "Arrêtez de gaspiller votre budget. Nous construisons des campagnes hyper-segmentées sur Google et LinkedIn pour cibler des titres de poste, revenus et besoins juridiques spécifiques." },
                list: [
                    { en: "Google Ads Management", fr: "Gestion Google Ads" },
                    { en: "LinkedIn B2B Targeting", fr: "Ciblage B2B LinkedIn" },
                    { en: "Retargeting Funnels", fr: "Entonnoirs de Retargeting" }
                ]
            },
            social: {
                tag: { en: "Brand Authority", fr: "Autorité de Marque" },
                title: { en: "Strategic Social", fr: "Social Stratégique" },
                desc: { en: "Your reputation precedes you. We curate a professional social media presence that establishes your firm as a thought leader in your industry.", fr: "Votre réputation vous précède. Nous curons une présence sociale professionnelle qui établit votre firme comme un leader d'opinion dans votre industrie." },
                list: [
                    { en: "Thought Leadership Content", fr: "Contenu de Leadership d'Opinion" },
                    { en: "Professional Branding", fr: "Branding Professionnel" },
                    { en: "Community Management", fr: "Gestion de Communauté" }
                ]
            },
            analytics: {
                tag: { en: "Data Intelligence", fr: "Intelligence de Données" },
                title: { en: "Revenue Tracking", fr: "Suivi des Revenus" },
                desc: { en: "Know exactly where your clients come from. We implement closed-loop reporting to attribute every dollar of revenue back to the specific campaign that generated it.", fr: "Sachez exactement d'où viennent vos clients. Nous implémentons un reporting en boucle fermée pour attribuer chaque dollar de revenu à la campagne spécifique qui l'a généré." },
                list: [
                    { en: "Custom Data Boards", fr: "Tableaux de Données Personnalisés" },
                    { en: "Conversion Attribution", fr: "Attribution de Conversion" },
                    { en: "ROI Analysis", fr: "Analyse de ROI" }
                ]
            }
        }
    },
    mobile: {
        hero: {
            tag: { en: "Mobile Innovation", fr: "Innovation Mobile" },
            h1: { en: "Your brand, right in their pocket.", fr: "Votre marque, directement dans leur poche." },
            desc: { en: "Stay connected with your clients 24/7. We design and build premium native mobile applications that offer seamless access to your services and portals.", fr: "Restez connecté avec vos clients 24/7. Nous concevons et construisons des applications mobiles natives premium offrant un accès fluide à vos services et portails." },
            cta: { en: "Start Your App", fr: "Démarrez Votre App" }
        },
        features: {
            native: {
                tag: { en: "Native Performance", fr: "Performance Native" },
                title: { en: "iOS & Android", fr: "iOS & Android" },
                desc: { en: "The gold standard of mobile apps. We build native applications using Swift and Kotlin to ensure maximum performance, smooth animations, and full hardware access.", fr: "L'étalon-or des applis mobiles. Nous construisons des applications natives utilisant Swift et Kotlin pour assurer une performance maximale." },
                list: [
                    { en: "Swift (iOS) Development", fr: "Développement Swift (iOS)" },
                    { en: "Kotlin (Android) Development", fr: "Développement Kotlin (Android)" },
                    { en: "Native UI Components", fr: "Composants UI Natifs" }
                ]
            },
            cross: {
                tag: { en: "Efficiency", fr: "Efficacité" },
                title: { en: "Cross-Platform", fr: "Multiplateforme" },
                desc: { en: "Launch faster on both platforms. Using Flutter or React Native, we deliver a near-native experience with a single codebase, reducing time-to-market and maintenance costs.", fr: "Lancez plus vite sur les deux plateformes. Utilisant Flutter ou React Native, nous livrons une expérience quasi-native avec une seule base de code." },
                list: [
                    { en: "React Native / Flutter", fr: "React Native / Flutter" },
                    { en: "Single Codebase", fr: "Base de Code Unique" },
                    { en: "Unified Logic", fr: "Logique Unifiée" }
                ]
            },
            ux: {
                tag: { en: "User Experience", fr: "Expérience Utilisateur" },
                title: { en: "Premium UX/UI", fr: "UX/UI Premium" },
                desc: { en: "Mobile screens are small; attention spans are shorter. We design intuitive, thumb-friendly interfaces that make navigating your app a joy, not a chore.", fr: "Les écrans sont petits; l'attention est courte. Nous concevons des interfaces intuitives qui rendent la navigation dans votre appli agréable." },
                list: [
                    { en: "Gesture-Based Navigation", fr: "Navigation Gestuelle" },
                    { en: "Dark Mode Support", fr: "Support Mode Sombre" },
                    { en: "Accessibility First", fr: "Accessibilité Avant Tout" }
                ]
            },
            store: {
                tag: { en: "Launch & Growth", fr: "Lancement & Croissance" },
                title: { en: "Store Management", fr: "Gestion des Stores" },
                desc: { en: "The App Store and Play Store can be complex. We handle the entire submission process, metadata optimization, and updates, ensuring your app stays live and compliant.", fr: "L'App Store et Play Store peuvent être complexes. Nous gérons tout le processus de soumission, l'optimisation des métadonnées et les mises à jour." },
                list: [
                    { en: "App Store Optimization (ASO)", fr: "Optimisation App Store (ASO)" },
                    { en: "Submission Management", fr: "Gestion des Soumissions" },
                    { en: "Review Handling", fr: "Gestion des Avis" }
                ]
            }
        }
    },
    footer: {
        desc: { en: "Ultra-Premium Digital Architecture for high-standard businesses. We build the systems that power your growth.", fr: "Architecture Numérique Ultra-Premium pour entreprises exigeantes. Nous construisons les systèmes qui propulsent votre croissance." },
        company: { en: "Company", fr: "Entreprise" },
        whyUs: { en: "Why Us", fr: "Pourquoi Nous" },
        caseStudies: { en: "Case Studies", fr: "Études de Cas" },
        careers: { en: "Careers", fr: "Carrières" },
        privacy: { en: "Privacy Policy", fr: "Politique de Confidentialité" },
        terms: { en: "Terms of Service", fr: "Conditions d'Utilisation" },
        sitemap: { en: "Sitemap", fr: "Plan du Site" },
        rights: { en: "All Rights Reserved.", fr: "Tous Droits Réservés." },
        designedBy: { en: "Designed by Solutions Quasar Inc.", fr: "Conçu par Solutions Quasar Inc." }
    },
    privacy: {
        title: { en: "Privacy Policy", fr: "Politique de Confidentialité" },
        updated: { en: "Last updated: October 2026", fr: "Dernière mise à jour : Octobre 2026" },
        badge: { en: "Legal & Data Protection", fr: "Mentions Légales & Protection des Données" },
        intro_title: { en: "1. Introduction", fr: "1. Introduction" },
        intro_desc: {
            en: "Solutions Quasar Inc. (\"we,\" \"us,\" or \"our\") is dedicated to protecting the privacy, confidentiality, and security of personal information entrusted to us. This Privacy Policy details our practices concerning the collection, use, disclosure, and protection of information obtained through our website (solutionsquasar.ca), client communication channels, and associated digital services.",
            fr: "Solutions Quasar Inc. (« nous » ou « notre ») s'engage à protéger la vie privée, la confidentialité et la sécurité des renseignements personnels qui lui sont confiés. Cette politique de confidentialité détaille nos pratiques concernant la collecte, l'utilisation, la divulgation et la protection des informations obtenues via notre site web (solutionsquasar.ca), nos canaux de communication et nos services numériques associés."
        },
        collect_title: { en: "2. Information We Collect", fr: "2. Renseignements Recueillis" },
        collect_p1: {
            en: "We collect information you voluntarily provide when requesting a strategy call, submitting project briefs, contacting us by email or telephone, or engaging with our live chat widget. This includes your full name, business or corporate email address, phone number, company or law firm name, and project specifications.",
            fr: "Nous recueillons les renseignements que vous nous fournissez volontairement lors de demandes d'appel stratégique, de soumission de projets, de prise de contact par courriel ou téléphone, ou via notre widget de clavardage. Cela inclut votre nom, courriel professionnel, numéro de téléphone, nom d'entreprise ou de cabinet, et spécifications de projet."
        },
        collect_p2: {
            en: "Technical Data & Analytics: When browsing our site, our infrastructure may automatically collect technical diagnostics including IP addresses, device identifiers, browser types, and navigation timestamps to monitor platform security, protect against automated abuse, and maintain optimal performance.",
            fr: "Données Techniques & Analytique : Lors de votre navigation, notre infrastructure peut consigner automatiquement des diagnostics techniques incluant adresses IP, identifiants d'appareil, types de navigateur et horodatages afin d'assurer la sécurité, prévenir les abus automatisés et maintenir des performances optimales."
        },
        use_title: { en: "3. How We Use Your Information", fr: "3. Utilisation de vos Renseignements" },
        use_desc: {
            en: "Your information is used strictly for legitimate commercial purposes: evaluating and responding to project inquiries, architecting customized software and web solutions, managing client accounts and billing, scheduling consultations, and ensuring compliance with applicable Canadian legal obligations.",
            fr: "Vos renseignements sont utilisés strictement à des fins professionnelles légitimes : évaluer et répondre à vos demandes de projets, concevoir des solutions logicielles et web sur mesure, gérer les comptes clients et la facturation, planifier les consultations et respecter nos obligations légales canadiennes."
        },
        thirdparty_title: { en: "4. Third-Party Integrations & Processing", fr: "4. Intégrations Tiers & Traitement" },
        thirdparty_desc: {
            en: "We do not sell, rent, or trade your personal information. To deliver premium digital architecture, we rely on trusted, enterprise-grade third-party infrastructure adhering to strict security standards: Google Cloud / Firebase (hosting and database infrastructure), Stripe (PCI-DSS Level 1 compliant payment processing), and LeadConnector (live customer communication and appointment booking tools).",
            fr: "Nous ne vendons, ne louons et ne commercialisons jamais vos renseignements personnels. Pour offrir des architectures numériques de premier ordre, nous nous appuyons sur des infrastructures tierces de niveau entreprise respectant des normes de sécurité rigoureuses : Google Cloud / Firebase (hébergement et bases de données), Stripe (traitement des paiements certifié PCI-DSS Niveau 1) et LeadConnector (outils de communication et prise de rendez-vous)."
        },
        security_title: { en: "5. Data Security & Retention", fr: "5. Sécurité & Conservation des Données" },
        security_desc: {
            en: "We implement rigorous technical, organizational, and physical safeguards—including SSL/TLS 256-bit data encryption in transit, strict role-based access controls, and serverless isolation—to protect against unauthorized access, loss, or alteration. We retain personal data only as long as necessary to fulfill the operational purpose or legal retention requirements.",
            fr: "Nous mettons en œuvre des mesures techniques, organisationnelles et physiques rigoureuses — incluant le chiffrement SSL/TLS 256 bits en transit, des contrôles d'accès stricts et des environnements isolés — pour prévenir tout accès non autorisé, perte ou altération. Nous ne conservons les données que le temps nécessaire aux finalités prévues ou aux exigences légales."
        },
        rights_title: { en: "6. Your Rights & Data Deletion", fr: "6. Vos Droits & Suppression des Données" },
        rights_desc: {
            en: "Under Canadian privacy laws (PIPEDA, Quebec Law 25) and applicable international frameworks, you have the right to request access to your stored personal information, request corrections, or request complete deletion of your records. To submit a request, contact our Privacy Officer at info@solutionsquasar.ca with the subject line 'Privacy Request'.",
            fr: "Conformément aux lois canadiennes sur la vie privée (LPRPDE, Loi 25 du Québec) et aux cadres internationaux applicables, vous avez le droit de demander l'accès à vos renseignements stockés, d'en exiger la rectification ou la suppression complète. Pour soumettre une demande, contactez notre responsable à info@solutionsquasar.ca avec l'objet « Demande de Confidentialité »."
        },
        contact_title: { en: "7. Contact Us", fr: "7. Nous Contacter" },
        contact_desc: {
            en: "If you have any questions about this Privacy Policy or our security standards, contact Solutions Quasar Inc., Quebec & New Brunswick, Canada. Email: info@solutionsquasar.ca | Tel: +1 506 233 7006.",
            fr: "Si vous avez des questions concernant cette politique de confidentialité ou nos standards de sécurité, contactez Solutions Quasar Inc., Québec & Nouveau-Brunswick, Canada. Courriel : info@solutionsquasar.ca | Tél : +1 506 233 7006."
        },
        cta: { en: "← Return to Home", fr: "← Retour à l'Accueil" }
    },
    p404: {
        title: { en: "Page Not Found", fr: "Page Non Trouvée" },
        desc: { en: "The digital asset you are looking for has been moved or does not exist.", fr: "L'actif numérique que vous recherchez a été déplacé ou n'existe pas." },
        cta: { en: "Return to Home", fr: "Retour à l'Accueil" }
    },
    clientsPage: {
        hero: {
            subtitle: { en: "Our Work", fr: "Nos Réalisations" },
            h1: { en: "Premium Digital Experiences we built", fr: "Expériences Numériques Premium que nous avons conçues" },
            desc: { en: "Explore the systems and architectures that power some of our most demanding clients.", fr: "Explorez les systèmes et architectures qui propulsent certains de nos clients les plus exigeants." }
        },
        showcase: {
            subtitle: { en: "Portfolio", fr: "Portfolio" },
            title: { en: "Trusted by Professionals", fr: "La Confiance des Professionnels" },
            items: [
                { title: "Clinique TN", desc: { en: "Healthcare & Wellness Platform", fr: "Plateforme de Santé et Bien-être" }, url: "https://cliniquetn.ca", image: "client_cliniquetn.png", detail: { en: "Custom appointments and patient portal.", fr: "Rendez-vous sur mesure et portail patient." } },
                { title: "Caissie Cape Oasis", desc: { en: "Retreat & Booking System", fr: "Système de Réservation et Retraite" }, url: "https://caissiecapeoasis.com", image: "client_caissiecape.png", detail: { en: "Premium booking experience with seamless calendar integration.", fr: "Expérience de réservation premium avec intégration transparente du calendrier." } },
                { title: "CRMAEQ/ATQ", desc: { en: "Institutional Web Portal", fr: "Portail Web Institutionnel" }, url: "https://crmaeqatq.ca", image: "client_crmaeq.png", detail: { en: "Member directory and secure fast-access resources.", fr: "Répertoire des membres et ressources à accès rapide et sécurisé." } },
                { title: "Celtics de l'Ouest", desc: { en: "Sports Organization App", fr: "Application d'Organisation Sportive" }, url: "https://celticsdelouest.org", image: "client_soccer.png", detail: { en: "Interactive schedules, rosters, and community hub.", fr: "Horaires interactifs, équipes et centre communautaire." } }
            ]
        }
    },
    terms: {
        badge: { en: "Legal & Terms of Service", fr: "Mentions Légales & Conditions Générales" },
        title: { en: "Terms of Service", fr: "Conditions d'Utilisation" },
        updated: { en: "Last updated: October 2026", fr: "Dernière mise à jour : Octobre 2026" },

        intro_title: { en: "1. Acceptance of Terms", fr: "1. Acceptation des Conditions" },
        intro_p1: {
            en: "These Terms of Service (\"Terms\") govern the access to and use of websites, digital portals, software platforms, and professional engineering services provided by Solutions Quasar Inc. (\"Solutions Quasar,\" \"we,\" \"us,\" or \"our\"), a Canadian corporation. By accessing our website (solutionsquasar.ca), contracting our services, or logging into any client portal or enterprise system, you (\"Client\" or \"User\") agree to be bound by these Terms in full. If you do not accept these terms, you must refrain from using our systems and services.",
            fr: "Les présentes conditions générales d'utilisation (« Conditions ») régissent l'accès et l'utilisation des sites web, portails numériques, plateformes logicielles et services d'ingénierie fournis par Solutions Quasar Inc. (« Solutions Quasar », « nous », « notre » ou « nos »), une société par actions canadienne. En accédant à notre site web (solutionsquasar.ca), en souscrivant à nos services ou en vous connectant à un portail client ou système d'entreprise, vous (« Client » ou « Utilisateur ») convenez d'être lié sans réserve par ces Conditions. Si vous n'acceptez pas l'ensemble de ces termes, vous devez cesser toute utilisation de nos services et systèmes."
        },

        services_title: { en: "2. Scope of Services & Deliverables", fr: "2. Portée des Services & Livrables" },
        services_p1: {
            en: "Solutions Quasar provides ultra-premium digital architecture, web application engineering, custom SaaS/ERP development, cloud infrastructure deployment, workflow automation, and specialized technical consulting. Specific deliverables, project milestones, performance metrics, and completion timelines are defined in written Statements of Work (SOW), service proposals, or enterprise contracts mutually agreed upon.",
            fr: "Solutions Quasar offre des services d'architecture numérique ultra-premium, de développement d'applications web, de conception SaaS/ERP sur mesure, de déploiement d'infrastructures infonuagiques, d'automatisation de flux de travail et de conseil technologique. Les livrables spécifiques, jalons de projet, métriques de performance et échéanciers sont stipulés dans les devis, propositions de services ou contrats d'entreprise mutuellement convenus."
        },

        ip_title: { en: "3. Intellectual Property & Ownership", fr: "3. Propriété Intellectuelle & Droits" },
        ip_p1: {
            en: "Client Deliverables: Upon receipt of full and final payment for the designated engagement, the Client holds all ownership rights, title, and interest in the bespoke custom deliverables, user interfaces, and custom source code explicitly developed for their project.",
            fr: "Livrables Clients : Dès réception du paiement intégral et définitif pour le mandat concerné, le Client détient tous les droits de propriété, titres et intérêts sur les livrables personnalisés, interfaces graphiques et code source sur mesure conçus spécifiquement pour son projet."
        },
        ip_p2: {
            en: "Solutions Quasar Frameworks: Solutions Quasar retains all proprietary rights, trademarks, copyrights, and trade secrets in its pre-existing core software libraries, reusable modules, enterprise scaffolding, boilerplate architectures, and development toolchains. When integrated into client deliverables, Solutions Quasar grants the Client a perpetual, irrevocable, non-exclusive, royalty-free commercial license to run and operate such components within their deliverable.",
            fr: "Cadres & Outils Solutions Quasar : Solutions Quasar conserve l'entière propriété intellectuelle, marques de commerce, droits d'auteur et secrets d'affaires relatifs à ses bibliothèques logicielles fondamentales préexistantes, modules réutilisables, squelettes d'architecture et outillages techniques. Lorsqu'ils sont intégrés dans les livrables du client, Solutions Quasar lui accorde une licence commerciale perpétuelle, irrévocable, non exclusive et libre de redevances pour exploiter ces éléments au sein de son livrable."
        },

        payment_title: { en: "4. Fees, Billing & Payment Terms", fr: "4. Honoraires, Facturation & Modalités de Paiement" },
        payment_p1: {
            en: "Project billing terms, deposit schedules, retainer arrangements, and milestone disbursements are detailed in the applicable agreement. All payments are securely processed through enterprise payment gateways (e.g., Stripe) in Canadian Dollars (CAD) or US Dollars (USD) as specified. Invoices are due upon receipt or within 15 calendar days unless otherwise stated. Unpaid balances past 30 days may accrue late interest at 1.5% per month (19.56% annually) and may result in temporary suspension of hosting or active engineering support.",
            fr: "Les modalités de facturation, acomptes initiaux, forfaits de maintenance et déboursements par jalon sont détaillés dans l'accord applicable. Tous les paiements sont traités de manière sécurisée via des passerelles de paiement d'entreprise certifiées (ex. Stripe) en dollars canadiens (CAD) ou américains (USD) selon l'entente. Les factures sont payables sur réception ou dans un délai de 15 jours calendrier sauf indication contraire. Les soldes impayés au-delà de 30 jours peuvent porter intérêt au taux de 1,5 % par mois (19,56 % par an) et entraîner la suspension temporaire de l'hébergement ou du soutien technique."
        },

        sms_title: { en: "5. Mobile & SMS Communications (A2P 10DLC Compliance)", fr: "5. Communications Mobiles & SMS (Conformité A2P 10DLC)" },
        sms_p1: {
            en: "Consent & Purpose: By providing your phone number to Solutions Quasar Inc. through our contact forms, service agreements, or client portals, you explicitly consent to receive transactional, operational, and customer support SMS text messages directly related to your inquiries, account security, appointment verifications, and project status updates.",
            fr: "Consentement & Finalité : En fournissant votre numéro de téléphone à Solutions Quasar Inc. par le biais de nos formulaires, ententes de service ou portails clients, vous consentez expressément à recevoir des messages texte SMS transactionnels, opérationnels et de support client directement liés à vos demandes, à la sécurité de vos comptes, aux confirmations de rendez-vous et au suivi de vos projets."
        },
        sms_p2: {
            en: "Cadence & Rates: Message frequency varies depending on your project milestones, account activity, and support inquiries. Message and data rates may apply depending on your mobile carrier and mobile service plan.",
            fr: "Fréquence & Tarifs : La fréquence d'envoi varie selon l'activité de vos projets, les demandes d'assistance et les alertes de sécurité. Les tarifs standard de messagerie et de données de votre opérateur de téléphonie mobile peuvent s'appliquer."
        },
        sms_p3: {
            en: "Opt-Out & Assistance: You can cancel SMS notifications at any time. Reply STOP, CANCEL, or UNSUBSCRIBE to any text message to immediately discontinue mobile messages. For assistance, reply HELP or contact our team directly at info@solutionsquasar.ca or +1 506 233 7006. Wireless carriers are not liable for delayed or undelivered messages. We do not sell or share mobile contact numbers with third parties for promotional purposes.",
            fr: "Désabonnement & Assistance : Vous pouvez annuler les notifications SMS à tout moment. Répondez STOP, ARRET ou UNSUBSCRIBE à n'importe quel message pour vous désabonner immédiatement. Pour obtenir de l'aide, répondez HELP ou AIDE, ou écrivez-nous à info@solutionsquasar.ca ou par téléphone au +1 506 233 7006. Les opérateurs sans fil ne sont pas responsables des messages retardés ou non livrés. Nous ne vendons ni ne partageons jamais vos numéros mobiles avec des tiers à des fins promotionnelles."
        },

        acceptable_title: { en: "6. User Conduct & Prohibited Uses", fr: "6. Conduite de l'Utilisateur & Usages Interdits" },
        acceptable_p1: {
            en: "Users and clients agree to use our systems exclusively for lawful business purposes. You agree not to: (a) engage in unauthorized vulnerability scanning, penetration testing, or reverse engineering of Solutions Quasar infrastructure; (b) upload, transmit, or introduce malicious payloads, viruses, or automated scrapers; (c) attempt unauthorized privilege escalation or bypass security access controls; or (d) misuse our communication networks to distribute unsolicited messages or spam.",
            fr: "Les utilisateurs et clients conviennent d'utiliser nos systèmes exclusivement à des fins professionnelles légitimes. Vous vous engagez à ne pas : (a) effectuer d'analyse de vulnérabilité non autorisée, de test d'intrusion ou de rétro-ingénierie sur l'infrastructure de Solutions Quasar ; (b) téléverser, propager ou introduire des logiciels malveillants, virus ou robots d'extraction non autorisés ; (c) tenter d'élever des privilèges d'accès ou de contourner les contrôles de sécurité ; ou (d) détourner nos canaux de communication pour diffuser des courriels ou messages non sollicités (spam)."
        },

        liability_title: { en: "7. Warranties & Limitation of Liability", fr: "7. Garanties & Limitation de Responsabilité" },
        liability_p1: {
            en: "Professional Standard: We design, engineer, and deploy digital assets adhering to top-tier industry standards for performance, code hygiene, and security.",
            fr: "Norme Professionnelle : Nous concevons, développons et déployons les actifs numériques selon les standards les plus rigoureux de l'industrie en matière de performance, de qualité de code et de cybersécurité."
        },
        liability_p2: {
            en: "Disclaimer & Cap: To the maximum extent permitted by applicable law, Solutions Quasar Inc. provides its platforms \"as is\" and \"as available.\" Solutions Quasar shall not be liable for any indirect, punitive, incidental, special, or consequential damages (including lost profits, loss of data, business interruption, or downtime caused by upstream telecom or cloud provider outages such as Google Cloud, Telnyx, or Stripe). In any event, our total aggregate liability arising out of or related to these Terms shall not exceed the total fees paid by the client to Solutions Quasar during the three (3) months preceding the incident giving rise to liability.",
            fr: "Exclusion & Plafond : Dans toute la mesure permise par la loi applicable, Solutions Quasar Inc. fournit ses plateformes « telles quelles » et « selon leur disponibilité ». Solutions Quasar ne peut être tenue responsable de tout dommage indirect, punitif, accessoire, spécial ou consécutif (y compris la perte de profits, la perte de données, l'interruption d'activité ou les pannes réseau imputables aux fournisseurs tiers tels que Google Cloud, Telnyx ou Stripe). En tout état de cause, notre responsabilité globale découlant des présentes Conditions ne pourra excéder le montant total des honoraires payés par le client à Solutions Quasar au cours des trois (3) mois précédant l'événement ouvrant droit à réparation."
        },

        confidentiality_title: { en: "8. Confidentiality & Non-Disclosure", fr: "8. Confidentialité & Non-Divulgation" },
        confidentiality_p1: {
            en: "Both parties agree to hold in strict confidence all proprietary, commercial, financial, and technical information disclosed during the engagement. Confidential information shall not be revealed to third parties without prior written consent, except to employees, subcontractors, or legal/financial advisors bound by equivalent confidentiality obligations. Personal information handling is strictly governed by our Privacy Policy.",
            fr: "Les deux parties s'engagent à préserver la stricte confidentialité de toutes les informations commerciales, financières, stratégiques et techniques divulguées dans le cadre de leur relation d'affaires. Ces informations ne seront divulguées à aucun tiers sans accord écrit préalable, à l'exception des employés, sous-traitants ou conseillers juridiques/financiers liés par des obligations de confidentialité équivalentes. La gestion des renseignements personnels est régie par notre Politique de Confidentialité."
        },

        termination_title: { en: "9. Term & Termination", fr: "9. Durée & Résiliation" },
        termination_p1: {
            en: "Agreements may be terminated by either party according to the terms specified in the mutual service contract or upon thirty (30) days' written notice for continuous monthly retainers. Upon termination, the client shall promptly pay all outstanding fees for work performed up to the termination date. Solutions Quasar shall deliver all completed client-owned assets and provide customary transition assistance.",
            fr: "Les ententes peuvent être résiliées par l'une ou l'autre des parties conformément aux stipulations du contrat de service spécifique ou avec un préavis écrit de trente (30) jours pour les forfaits mensuels récurrents. En cas de résiliation, le client réglera sans délai les honoraires dus pour les prestations réalisées jusqu'à la date d'effet. Solutions Quasar remettra l'ensemble des livrables finalisés appartenant au client et assurera la transition d'usage."
        },

        governing_title: { en: "10. Governing Law & Dispute Resolution", fr: "10. Droit Applicable & Résolution des Différends" },
        governing_p1: {
            en: "These Terms and all related contractual relationships shall be governed by, and construed in accordance with, the laws of the Province of Québec and the federal laws of Canada applicable therein, without regard to conflict of law principles. The parties agree to submit any unresolved dispute arising from these Terms to the exclusive jurisdiction of the competent courts sitting in the judicial district of Montreal or Quebec City, Canada.",
            fr: "Les présentes Conditions et toutes relations contractuelles s'y rapportant sont régies et interprétées conformément aux lois de la province de Québec et aux lois fédérales du Canada qui y sont applicables, sans égard aux principes de conflit de lois. Les parties conviennent de soumettre tout différend découlant des présentes à la compétence exclusive des tribunaux du district judiciaire de Montréal ou de Québec, Canada."
        },

        contact_title: { en: "11. Contact Information", fr: "11. Coordonnées & Questions" },
        contact_p1: {
            en: "If you have any questions or require legal clarification regarding these Terms of Service, please contact Solutions Quasar Inc., Quebec & New Brunswick, Canada. Email: info@solutionsquasar.ca | Tel: +1 506 233 7006.",
            fr: "Pour toute question ou demande d'éclaircissement juridique concernant ces conditions d'utilisation, veuillez contacter Solutions Quasar Inc., Québec & Nouveau-Brunswick, Canada. Courriel : info@solutionsquasar.ca | Tél : +1 506 233 7006."
        },

        cta: { en: "← Return to Home", fr: "← Retour à l'Accueil" },
        privacy_link: { en: "Privacy Policy", fr: "Politique de Confidentialité" }
    }
};

// ICONS object moved to top of file

document.addEventListener('DOMContentLoaded', () => {
    renderSite();
    setupInteractions();
    setupForm();
    injectSchema();

    // Render About page if on about.html
    if (window.location.pathname.includes('about.html')) {
        renderAboutPage();
    }

    // Render Clients page if on clients.html
    if (window.location.pathname.includes('clients.html')) {
        renderClientsPage();
    }
});

function renderAboutPage() {
    // Hero
    const heroSubtitle = document.querySelector('[data-i18n="about.hero.subtitle"]');
    const heroH1 = document.querySelector('[data-i18n="about.hero.h1"]');
    const heroDesc = document.querySelector('[data-i18n="about.hero.desc"]');
    if (heroSubtitle) heroSubtitle.textContent = t(CONFIG.about.hero.subtitle);
    if (heroH1) heroH1.textContent = t(CONFIG.about.hero.h1);
    if (heroDesc) heroDesc.textContent = t(CONFIG.about.hero.desc);

    // Story
    const storySubtitle = document.querySelector('[data-i18n="about.story.subtitle"]');
    const storyTitle = document.querySelector('[data-i18n="about.story.title"]');
    const storyP1 = document.querySelector('[data-i18n="about.story.p1"]');
    const storyP2 = document.querySelector('[data-i18n="about.story.p2"]');
    if (storySubtitle) storySubtitle.textContent = t(CONFIG.about.story.subtitle);
    if (storyTitle) storyTitle.textContent = t(CONFIG.about.story.title);
    if (storyP1) storyP1.textContent = t(CONFIG.about.story.p1);
    if (storyP2) storyP2.textContent = t(CONFIG.about.story.p2);

    // Values
    const valuesSubtitle = document.querySelector('[data-i18n="about.values.subtitle"]');
    const valuesTitle = document.querySelector('[data-i18n="about.values.title"]');
    if (valuesSubtitle) valuesSubtitle.textContent = t(CONFIG.about.values.subtitle);
    if (valuesTitle) valuesTitle.textContent = t(CONFIG.about.values.title);

    CONFIG.about.values.items.forEach((item, i) => {
        const title = document.querySelector(`[data-i18n="about.values.items.${i}.title"]`);
        const desc = document.querySelector(`[data-i18n="about.values.items.${i}.desc"]`);
        if (title) title.textContent = t(item.title);
        if (desc) desc.textContent = t(item.desc);
    });

    // Team
    const teamSubtitle = document.querySelector('[data-i18n="about.team.subtitle"]');
    const teamTitle = document.querySelector('[data-i18n="about.team.title"]');
    if (teamSubtitle) teamSubtitle.textContent = t(CONFIG.about.team.subtitle);
    if (teamTitle) teamTitle.textContent = t(CONFIG.about.team.title);

    CONFIG.about.team.members.forEach((member, i) => {
        const name = document.querySelector(`[data-i18n="about.team.members.${i}.name"]`);
        const role = document.querySelector(`[data-i18n="about.team.members.${i}.role"]`);
        const bio = document.querySelector(`[data-i18n="about.team.members.${i}.bio"]`);
        if (name) name.textContent = member.name;
        if (role) role.textContent = t(member.role);
        if (bio) bio.textContent = t(member.bio);
    });

    // CTA
    const ctaTitle = document.querySelector('[data-i18n="about.cta.title"]');
    const ctaDesc = document.querySelector('[data-i18n="about.cta.desc"]');
    const ctaBtn = document.querySelector('[data-i18n="hero.cta"]');
    if (ctaTitle) ctaTitle.textContent = t(CONFIG.about.cta.title);
    if (ctaDesc) ctaDesc.textContent = t(CONFIG.about.cta.desc);
    if (ctaBtn) ctaBtn.textContent = t(CONFIG.hero.cta);
}

function renderClientsPage() {
    // Hero
    const heroSubtitle = document.querySelector('[data-i18n="clientsPage.hero.subtitle"]');
    const heroH1 = document.querySelector('[data-i18n="clientsPage.hero.h1"]');
    const heroDesc = document.querySelector('[data-i18n="clientsPage.hero.desc"]');
    if (heroSubtitle) heroSubtitle.textContent = t(CONFIG.clientsPage.hero.subtitle);
    if (heroH1) heroH1.textContent = t(CONFIG.clientsPage.hero.h1);
    if (heroDesc) heroDesc.textContent = t(CONFIG.clientsPage.hero.desc);

    // Showcase
    const showcaseSubtitle = document.querySelector('[data-i18n="clientsPage.showcase.subtitle"]');
    const showcaseTitle = document.querySelector('[data-i18n="clientsPage.showcase.title"]');
    if (showcaseSubtitle) showcaseSubtitle.textContent = t(CONFIG.clientsPage.showcase.subtitle);
    if (showcaseTitle) showcaseTitle.textContent = t(CONFIG.clientsPage.showcase.title);

    const grid = document.getElementById('clients-grid');
    if (grid) {
        grid.innerHTML = CONFIG.clientsPage.showcase.items.map(client => `
            <div class="service-card" onclick="window.open('${client.url}', '_blank')" style="cursor: pointer;">
                <div class="service-image-header">
                    <img src="${client.image}" alt="${client.title}" loading="lazy">
                </div>
                <div class="service-content">
                    <h3 style="margin-bottom: 0.5rem; font-size: 1.5rem;">${client.title}</h3>
                    <p class="text-gold" style="margin-bottom: 1rem; font-weight: 500;">${t(client.desc)}</p>
                    <p class="text-muted" style="margin-bottom: 1.5rem;">${t(client.detail)}</p>
                    <div style="margin-top: auto;">
                        <span style="color: var(--gold); font-weight: 600; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;">
                            View Live Project
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                        </span>
                    </div>
                </div>
            </div>
        `).join('');
    }
}


function renderSite() {
    // Determine context: Fix navigation on service pages
    // Determine context: Generic check for any non-index page
    const path = window.location.pathname;
    const isSubPage = path !== '/' && !path.endsWith('index.html') && !path.endsWith('/');

    const getLinkHref = (href) => {
        // Rewrite all hash links (including #contact) to point to index.html if we are on a subpage
        if (isSubPage && href.startsWith('#')) {
            return 'index.html' + href;
        }
        return href;
    };

    // Render Header Links
    // Render Header Links
    const desktopNav = document.querySelector('.desktop-nav');
    if (desktopNav) {
        const navHTML = CONFIG.nav.map(link => {
            const labelEn = link.label.en || link.label;

            // Special handling for Services Dropdown
            if (labelEn === 'Services') {
                const dropdownItems = CONFIG.services.items.map(service => `
                    <a href="${getLinkHref(service.url)}" class="dropdown-item">
                        <span class="dropdown-icon">${ICONS[service.icon] || ''}</span>
                        <div class="dropdown-text">
                            <span class="dropdown-title">${t(service.title)}</span>
                            <span class="dropdown-desc">${t(service.desc).split('.')[0]}.</span>
                        </div>
                    </a>
                `).join('');

                return `
                    <div class="dropdown-container">
                        <a href="${getLinkHref(link.href)}">
                            ${t(link.label)}
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:4px; opacity:0.7"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </a>
                        <div class="dropdown-menu">
                            ${dropdownItems}
                        </div>
                    </div>
                `;
            }

            return `<a href="${getLinkHref(link.href)}">${t(link.label)}</a>`;
        }).join('');

        desktopNav.innerHTML = navHTML;
    }

    // Render Mobile Menu Links
    // Render Mobile Menu Links
    const mobileNavHTML = CONFIG.nav.map(link => {
        const labelEn = link.label.en || link.label;
        const isServices = String(link.href).includes('services') || labelEn === 'Services';

        if (isServices) {
            const dropdownItems = CONFIG.services.items.map(service => `
                <a href="${getLinkHref(service.url)}" class="mobile-dropdown-item" onclick="window.toggleMobileMenu()">
                    <span class="mobile-dropdown-icon">${ICONS[service.icon] || ''}</span>
                    ${t(service.title)}
                </a>
            `).join('');

            return `
                <div style="width:100%">
                    <button class="mobile-dropdown-trigger" onclick="window.toggleMobileDropdown(this, event)">
                        <div style="display:flex; align-items:center; gap:1rem;">
                            <!-- Ensure text and icon align -->
                            <div style="display:flex; align-items:center; justify-content:center; min-width:24px;">
                                ${ICONS[link.icon] || link.icon || ''}
                            </div>
                            ${t(link.label)}
                        </div>
                        <span class="trigger-icon">
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </span>
                    </button>
                    <div class="mobile-dropdown-content">
                        ${dropdownItems}
                    </div>
                </div>
            `;
        }

        return `<a href="${getLinkHref(link.href)}" class="menu-link">
            ${link.icon || ''}
            ${t(link.label)}
        </a>`;
    }).join('');

    // Global helper not needed for inline clicks anymore, verifying cleanup
    window.toggleMobileDropdown = function (btn, e) {
        if (e) e.stopPropagation();
        btn.classList.toggle('open');
        const content = btn.nextElementSibling;
        content.classList.toggle('open');
    };

    const menuNavs = document.querySelectorAll('.menu-nav'); // Handle duplicates

    // Force clear first
    menuNavs.forEach(nav => nav.innerHTML = '');

    // Delay assignment to defeat race conditions
    setTimeout(() => {
        menuNavs.forEach(nav => {
            nav.innerHTML = mobileNavHTML;

            // Add minimal contact info to mobile menu
            nav.innerHTML += `
            <div class="mobile-menu-contact mobile-contact-info" style="margin-top:0; padding-top:0; border:none;">
                <p style="margin-bottom:0.5rem; color:var(--gold);">${t(CONFIG.business.tagline)}</p>
                <a href="tel:${CONFIG.business.phoneClean}">
                    ${ICONS.phone}
                    ${CONFIG.business.phone}
                </a>
                <a href="mailto:${CONFIG.business.email}">
                    ${ICONS.message}
                    ${CONFIG.business.email}
                </a>
            </div>
        `;
        });
    }, 50);

    // Logo Injection
    const logoHTML = `
        <a href="index.html" style="text-decoration:none; display:flex; align-items:center; color:inherit; gap: 0.5rem;">
            <img src="logo.png?v=final" alt="${CONFIG.business.name}" class="nav-logo">
            <span class="brand-text">SOLUTIONS QUASAR</span>
        </a>`;
    const brandContainer = document.querySelector('.brand');
    if (brandContainer) brandContainer.innerHTML = logoHTML;
    const mobileLogo = document.querySelector('.mobile-logo');
    if (mobileLogo) mobileLogo.innerHTML = logoHTML;

    const contactPhone = document.querySelector('.contact-phone');
    if (contactPhone) {
        contactPhone.textContent = CONFIG.business.phone;
        contactPhone.href = `tel:${CONFIG.business.phoneClean} `;
    }
    const contactEmail = document.querySelector('.contact-email');
    if (contactEmail) {
        contactEmail.innerHTML = ICONS.message;
        // Point to Contact Form instead of mailto:
        contactEmail.href = isSubPage ? 'index.html#contact' : '#contact';
        contactEmail.ariaLabel = currentLang === 'fr' ? 'Nous Écrire' : 'Email Us';
        contactEmail.title = currentLang === 'fr' ? 'Nous Écrire' : 'Email Us';
        contactEmail.style.display = 'flex';
        contactEmail.style.alignItems = 'center';
    }

    // Add Language Toggle to Desktop Header
    const contactActions = document.querySelector('.contact-actions');
    if (contactActions && !document.querySelector('.lang-toggle')) {
        const langToggle = document.createElement('div');
        langToggle.className = 'lang-toggle';
        langToggle.innerHTML = `
            <button class="lang-opt ${currentLang === 'en' ? 'active' : ''}" onclick="setLanguage('en')">EN</button>
            <button class="lang-opt ${currentLang === 'fr' ? 'active' : ''}" onclick="setLanguage('fr')">FR</button>
        `;
        contactActions.appendChild(langToggle);
    }

    // Add Language Toggle to Mobile Bottom Bar
    const mobileBottomBar = document.getElementById('mobile-bar');
    if (mobileBottomBar && !mobileBottomBar.querySelector('.lang-toggle-mobile')) {
        const langToggleContainer = document.createElement('div');
        langToggleContainer.className = 'bar-item';
        langToggleContainer.innerHTML = `
            <div class="lang-toggle-mobile">
                <button class="lang-opt ${currentLang === 'en' ? 'active' : ''}" onclick="setLanguage('en')">EN</button>
                <button class="lang-opt ${currentLang === 'fr' ? 'active' : ''}" onclick="setLanguage('fr')">FR</button>
            </div>
        `;
        mobileBottomBar.appendChild(langToggleContainer);
    }

    // Mobile Top Bar
    const mobileCallBtn = document.querySelector('.mobile-call-btn');
    if (mobileCallBtn) {
        mobileCallBtn.href = `tel:${CONFIG.business.phoneClean} `;
        mobileCallBtn.innerHTML = ICONS.phone;
    }

    // Render Hero (Homepage Only)
    const hero = document.getElementById('hero');
    if (hero) {
        hero.innerHTML = `
            <div class="hero-split">
                <div class="hero-content">
                    <h1>${t(CONFIG.hero.h1)}</h1>
                    <p>${t(CONFIG.hero.subhead)}</p>
                    <a href="#contact" class="btn-primary">${t(CONFIG.hero.cta)} ${ICONS.arrow}</a>
                    <div class="trust-cue">${t(CONFIG.hero.trust)}</div>
                </div>
                <img src="${CONFIG.hero.imageDesktop}" alt="Premium Strategy" class="hero-image">
            </div>
        `;
    }

    // Render Services
    const servicesGrid = document.querySelector('.services-grid');
    if (servicesGrid) {
        servicesGrid.innerHTML = CONFIG.services.items.map(s => `
            <div class="service-card" onclick="window.location.href='${s.url}'" style="cursor: pointer;">
                <div class="service-image-header">
                    <img src="${s.image}" alt="${t(s.title)}" loading="lazy">
                </div>
                <div class="service-content">
                    <div class="service-icon">${ICONS[s.icon] || ICONS.monitor}</div>
                    <h3>${t(s.title)}</h3>
                    <p>${t(s.desc)}</p>
                    <div class="service-details">${t(s.detail)}</div>
                    <a href="${s.url}" class="text-gold uppercase" style="display:block; margin-top:1.5rem; font-size:0.8rem;">${currentLang === 'fr' ? 'En Savoir Plus' : 'Learn More'} &rarr;</a>
                </div>
            </div>
        `).join('');
    }

    // Render Reviews
    const reviewGrid = document.querySelector('.review-container');
    if (reviewGrid) {
        reviewGrid.innerHTML = CONFIG.reviews.items.map(r => `
            <div class="review-card">
                <div class="stars">★★★★★</div>
                <p class="review-text">"${t(r.text)}"</p>
                <p class="review-author">— ${t(r.author)}</p>
            </div>
        `).join('');
    }

    // Render Why Us
    const whyGrid = document.querySelector('.why-grid');
    if (whyGrid) {
        const whyTitle = document.querySelector('#why-us h2');
        if (whyTitle) whyTitle.textContent = t(CONFIG.why.title);
        whyGrid.innerHTML = CONFIG.why.items.map(item => `
            <div class="why-card">
                <div class="why-image-header">
                    <img src="${item.image}" alt="${t(item.title)}" loading="lazy">
                </div>
            <div class="why-content">
                <div class="why-icon text-gold">${ICONS[item.icon] || ICONS.check}</div>
                <h3 style="margin:1rem 0; font-size:1.1rem;">${t(item.title)}</h3>
                <p class="text-muted" style="font-size:0.95rem;">${t(item.desc)}</p>
            </div>
            </div>
        `).join('');
    }

    // Render Contact Info
    // Render Contact Info (Premium Cards Design)
    const contactCards = document.querySelectorAll('.contact-card');
    const contactNav = CONFIG.nav.find(n => n.href === '#contact');
    contactCards.forEach(card => {
        card.innerHTML = `
            <h3 style="margin-bottom:1.5rem">${t(contactNav ? contactNav.label : { en: 'Contact', fr: 'Contact' })}</h3>
            <div class="contact-details-grid">
                <!-- Phone -->
                <a href="tel:${CONFIG.business.phoneClean}" class="contact-detail-item">
                    <div class="detail-icon">${ICONS.phone}</div>
                    <div class="detail-content">
                        <span class="detail-label">Phone</span>
                        <span class="detail-value">${CONFIG.business.phone}</span>
                    </div>
                </a>

                <!-- Email -->
                <a href="mailto:${CONFIG.business.email}" class="contact-detail-item">
                    <div class="detail-icon">${ICONS.message}</div>
                    <div class="detail-content">
                        <span class="detail-label">Email</span>
                        <span class="detail-value">${CONFIG.business.email}</span>
                    </div>
                </a>

                <!-- Offices -->
                <div class="contact-detail-item full-width">
                    <div class="detail-icon">${ICONS.home}</div>
                    <div class="detail-content">
                        ${CONFIG.business.offices.map(office => `
                            <div class="office-block" style="margin-bottom:0.5rem">
                                <strong style="color:var(--gold)">${t(office.name)}</strong>
                                <div style="font-size:0.9rem; color:var(--text-muted)">${office.address}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
    `;
    });

    // Safety checks for elements that might have been removed
    const btnDirections = document.querySelector('.btn-directions');
    if (btnDirections) btnDirections.href = CONFIG.business.mapUrl;

    const mapFrame = document.querySelector('.map-frame');
    if (mapFrame) mapFrame.src = CONFIG.business.mapEmbed;

    // Render Premium Footer
    // Render Premium Footer
    const footerHTML = `
        <div class="footer-grid">
            <div class="footer-col footer-brand">
                <div class="brand" style="display:flex; align-items:center; gap:10px;">
                    <img src="logo.png?v=final" alt="${CONFIG.business.name}" style="height:32px; width:auto;">
                    <span class="brand-text" style="font-size:1.1rem;">SOLUTIONS QUASAR</span>
                </div>
                <p>${t(CONFIG.footer.desc)}</p>
                <div style="margin-top:1.5rem; display:flex; gap:1rem;">
                   <!-- Social Placeholders -->
                   <a href="#" aria-label="LinkedIn">${ICONS.arrow}</a>
                   <a href="#" aria-label="Twitter">${ICONS.arrow}</a>
                </div>
            </div>
            
            <div class="footer-col">
                <h4>${t(CONFIG.nav[1].label)}</h4>
                <ul>
                    ${CONFIG.services.items.map(s => `<li><a href="${s.url}">${t(s.title)}</a></li>`).join('')}
                </ul>
            </div>

            <div class="footer-col">
                <h4>${t(CONFIG.footer.company)}</h4>
                <ul>
                    <li><a href="${getLinkHref('#why-us')}">${t(CONFIG.footer.whyUs)}</a></li>
                    <li><a href="${getLinkHref('#reviews')}">${t(CONFIG.footer.caseStudies)}</a></li>
                    <li><a href="#">${t(CONFIG.footer.careers)}</a></li>
                    <li><a href="privacy.html">${t(CONFIG.footer.privacy)}</a></li>
                    <li><a href="terms.html">${t(CONFIG.footer.terms)}</a></li>
                </ul>
            </div>

            <div class="footer-col">
                <h4>${t(CONFIG.contact.info.title)}</h4>
                <ul>
                    <li class="text-gold" style="font-size:1.1rem; font-weight:600;"><a href="tel:${CONFIG.business.phoneClean}">${CONFIG.business.phone}</a></li>
                    <li><a href="mailto:${CONFIG.business.email}">${CONFIG.business.email}</a></li>
                    <li style="opacity:0.7; margin-top:1rem;">${t(CONFIG.business.address)}</li>
                </ul>
            </div>
            </div>
        </div>

        <div class="footer-bottom">
            <div class="footer-cred">&copy; ${new Date().getFullYear()} ${CONFIG.business.name} • ${t(CONFIG.footer.rights)}</div>
            <div class="footer-links">
                <a href="privacy.html">${t(CONFIG.footer.privacy)}</a> &nbsp;•&nbsp; <a href="terms.html">${t(CONFIG.footer.terms)}</a> &nbsp;•&nbsp; <a href="/erp/" class="text-muted" style="text-decoration:none; opacity:0.5; font-size:0.8rem;">ERP Login</a> &nbsp;•&nbsp; <span style="opacity:0.5">${t(CONFIG.footer.designedBy)}</span>
            </div>
        </div>
    `;

    // Inject entire footer content into the container
    const footerContainer = document.querySelector('footer .container');
    if (footerContainer) footerContainer.innerHTML = footerHTML;

    // Render Mobile Menu Links & Contact Info
    const menuContent = `
        ${CONFIG.nav.map(link => `<a href="${getLinkHref(link.href)}" class="menu-link">${t(link.label)}</a>`).join('')}
        <div class="golden-separator"></div>
        <div style="text-align: center; margin: 2rem 0;">
            <div class="lang-toggle" style="justify-content: center; margin: 0;">
                <button class="lang-btn ${currentLang === 'en' ? 'active' : ''}" onclick="setLanguage('en')">EN</button>
                <button class="lang-btn ${currentLang === 'fr' ? 'active' : ''}" onclick="setLanguage('fr')">FR</button>
            </div>
        </div>
        <div class="golden-separator"></div>
        <div class="mobile-contact-info">
            <a href="tel:${CONFIG.business.phoneClean}">${ICONS.phone} ${CONFIG.business.phone}</a>
            <a href="mailto:${CONFIG.business.email}">${ICONS.message} ${CONFIG.business.email}</a>
            <div style="font-size:0.8rem; opacity:0.6; margin-top:0.5rem;">${t(CONFIG.business.address)}</div>
        </div>
    `;
    document.querySelector('.menu-nav').innerHTML = menuContent;

    // Render Contact Form
    renderContactForm();

    // Render Mobile Bottom Bar Icons
    renderMobileBottomBar();
}

function renderContactForm() {
    // Translate form labels
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const keys = key.split('.');
        let value = CONFIG;
        for (const k of keys) {
            value = value[k];
        }
        if (value) el.textContent = t(value);
    });

    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const keys = key.split('.');
        let value = CONFIG;
        for (const k of keys) {
            value = value[k];
        }
        if (value) el.placeholder = t(value);
    });

    // Translate select options but keep their original value for form submission
    document.querySelectorAll('select.form-select option[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const keys = key.split('.');
        let value = CONFIG;
        for (const k of keys) {
            value = value[k];
        }
        if (value) {
            // Store original english value if not already stored
            if (!el.hasAttribute('value')) {
                el.setAttribute('value', el.textContent);
            }
            el.textContent = t(value);
        }
    });

    // Update contact info
    const infoPhone = document.querySelector('.info-phone');
    const infoEmail = document.querySelector('.info-email');
    const infoAddress = document.querySelector('.info-address');

    if (infoPhone) infoPhone.innerHTML = `< strong > ${t(CONFIG.contact.info.phone)}</strong > <a href="tel:${CONFIG.business.phoneClean}">${CONFIG.business.phone}</a>`;
    if (infoEmail) infoEmail.innerHTML = `< strong > ${t(CONFIG.contact.info.email)}</strong > <a href="mailto:${CONFIG.business.email}">${CONFIG.business.email}</a>`;
    if (infoAddress) {
        // Display both office addresses
        const officesHTML = CONFIG.business.offices.map(office =>
            `< div style = "margin-top: 1rem;" >
                <strong>${t(office.name)}:</strong><br>
                <span style="opacity: 0.8;">${office.address}</span>
            </div>`
        ).join('');
        infoAddress.innerHTML = `< strong > ${t(CONFIG.contact.info.address)}</strong > ${officesHTML} `;
    }

}



function renderMobileBottomBar() {
    const btnMenu = document.getElementById('btn-menu');
    const btnCall = document.getElementById('btn-call');
    const btnMsg = document.getElementById('btn-msg');

    // Remove text-based onclick attributes to prevent conflicts with addEventListener
    // usage in setupInteractions (fixes index.html double-toggle issue)
    if (btnMenu) btnMenu.removeAttribute('onclick');
    if (btnCall) btnCall.removeAttribute('onclick');
    if (btnMsg) btnMsg.removeAttribute('onclick');

    // Menu: Burger Icon for Animation
    if (btnMenu) {
        btnMenu.innerHTML = `
            <div class="menu-icon-wrapper">
                <div class="burger-icon">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
    }

    // Call: Phone SVG
    if (btnCall) {
        // Only update innerHTML if empty or check to avoid loop if called repeatedly (renderSite is called once usually)
        // But renderSite calls translate functions.
        // We can just overwrite it.
        btnCall.innerHTML = `
            <div>${ICONS.phone}</div>
        `;
        btnCall.href = `tel:${CONFIG.business.phoneClean} `;
    }

    // Msg: Message SVG
    if (btnMsg) {
        btnMsg.innerHTML = `
            <div>${ICONS.message}</div>
        `;
    }
}

function setupInteractions() {
    // Mobile Menu
    const menuBtn = document.getElementById('btn-menu');
    const overlay = document.getElementById('menu-overlay');
    const closeBtn = document.getElementById('btn-close-menu');
    const menuLinks = document.querySelectorAll('.menu-link');

    // Icons are now hardcoded in HTML for reliability

    // Bottom Bar Links
    const btnCall = document.getElementById('btn-call');
    if (btnCall) {
        btnCall.href = `tel:${CONFIG.business.phoneClean} `;
    }

    function updateMenuIcon(isOpen) {
        if (!menuBtn) return;
        const wrapper = menuBtn.querySelector('.menu-icon-wrapper');

        if (wrapper && isOpen) {
            wrapper.classList.add('open');
        } else if (wrapper) {
            wrapper.classList.remove('open');
        }
    }

    function toggleMenu() {
        console.log('Toggle menu clicked'); // Debug
        if (!overlay) {
            console.error('Menu overlay not found');
            return;
        }

        const isOpen = overlay.classList.contains('open');
        if (isOpen) {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
            if (typeof updateMenuIcon === 'function') updateMenuIcon(false);
        } else {
            overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
            if (typeof updateMenuIcon === 'function') updateMenuIcon(true);
        }
    }

    // Mobile Menu Event Listener (Restored)
    if (menuBtn) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling issues
            toggleMenu();
        });
    }

    // Use event delegation for dynamically added links
    // Use event delegation for dynamically added links
    document.querySelector('.menu-nav').addEventListener('click', (e) => {
        // Handle Mobile Dropdown Toggle
        const dropdownTrigger = e.target.closest('.mobile-dropdown-trigger');
        if (dropdownTrigger) {
            e.stopPropagation(); // Stop bubbling to prevent any parent listeners
            e.preventDefault();  // Stop default button behavior

            // Toggle Logic
            dropdownTrigger.classList.toggle('open');
            const content = dropdownTrigger.nextElementSibling;
            if (content) content.classList.toggle('open');
            return; // Exit completely
        }

        // Handle standard links closing the menu
        if (e.target.closest('.menu-link') || e.target.closest('.mobile-dropdown-item')) {
            toggleMenu();
        }
    });

    // Message Button Scroll
    const btnMsg = document.getElementById('btn-msg');
    if (btnMsg) {
        btnMsg.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollToContact();
        });
    }
}

function setupForm() {
    const form = document.querySelector('form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = 'Sending...';
        btn.disabled = true;

        const formData = new FormData(form);
        // --- HANDLE SUBMISSION ---
        const payload = {
            name: formData.get('name'),
            company: formData.get('company'),
            contact_method: formData.get('contact_method') || formData.get('contact'),
            interest: formData.get('interest'),
            message: formData.get('message'),
            lang: currentLang, // PASS LANGUAGE
            _gotcha: formData.get('_gotcha')
        };

        // Determine API URL
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const API_BASE = isLocal ? 'http://localhost:5000' : '';

        try {
            // Use API
            const response = await fetch(`${API_BASE}/api/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'x-quasar-client': 'pq-secure-form-v1'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const successMsg = currentLang === 'fr'
                    ? { title: 'Demande Reçue', desc: 'Nous vous contacterons sous peu.' }
                    : { title: 'Request Received', desc: 'We\'ll get back to you shortly.' };

                form.innerHTML = `<div class="success-message" style="text-align:center; padding:2rem;">
                    <h3 style="color:var(--gold); margin-bottom:1rem;">${successMsg.title}</h3>
                    <p>${successMsg.desc}</p>
                </div>`;
            } else {
                throw new Error('Network error');
            }
        } catch (error) {
            console.error(error);
            btn.textContent = 'Error. Try Again.';
            btn.disabled = false;
            setTimeout(() => {
                btn.textContent = originalText;
            }, 3000);
        }
    });
}

function injectSchema() {
    const schema = {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": CONFIG.business.name,
        "image": window.location.origin + "/hero-desktop.png",
        "telephone": CONFIG.business.phone,
        "email": CONFIG.business.email,
        "address": {
            "@type": "PostalAddress",
            "addressRegion": "New Brunswick",
            "addressCountry": "CA"
        },
        "url": window.location.origin
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
}

// Global Mobile Menu Toggle (Robust Fix)
window.toggleMobileMenu = function () {
    const overlay = document.getElementById('menu-overlay');
    const menuBtn = document.getElementById('btn-menu');

    if (!overlay || !menuBtn) {
        console.error('Mobile menu elements not found');
        return;
    }

    const wrapper = menuBtn.querySelector('.menu-icon-wrapper');
    const isOpen = overlay.classList.contains('open');

    if (isOpen) {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
        if (wrapper) wrapper.classList.remove('open');
    } else {
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        if (wrapper) wrapper.classList.add('open');
    }
};

// Global Scroll to Contact (Robust Fix)
window.scrollToContact = function () {
    const contactSection = document.getElementById('contact');
    if (contactSection) {
        // Target the form wrapper specifically to frame it
        const formWrapper = contactSection.querySelector('.form-wrapper') || contactSection;

        formWrapper.scrollIntoView({
            behavior: 'smooth',
            block: 'center', // This ensures it's framed in the middle of the screen
            inline: 'nearest'
        });

        setTimeout(() => {
            const nameInput = document.querySelector('input[name="name"]');
            if (nameInput) nameInput.focus({ preventScroll: true }); // Prevent focus from messing up scroll
        }, 1000);
    } else {
        window.location.href = 'index.html#contact';
    }
};
