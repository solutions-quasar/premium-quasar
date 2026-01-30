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
        phone: "418-410-0856",
        phoneClean: "14184100856",
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
        terms: { en: "Terms", fr: "Conditions" },
        sitemap: { en: "Sitemap", fr: "Plan du Site" },
        rights: { en: "All Rights Reserved.", fr: "Tous Droits Réservés." },
        designedBy: { en: "Designed by Solutions Quasar Inc.", fr: "Conçu par Solutions Quasar Inc." }
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


function renderSite() {
    // Determine context: Fix navigation on service pages
    const isSubPage = window.location.pathname.includes('websites.html') ||
        window.location.pathname.includes('apps.html') ||
        window.location.pathname.includes('ai.html') ||
        window.location.pathname.includes('privacy.html') ||
        window.location.pathname.includes('404.html') ||
        window.location.pathname.includes('about.html');

    const getLinkHref = (href) => {
        if (isSubPage && href.startsWith('#') && href !== '#contact') {
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
                    <button class="mobile-dropdown-trigger">
                        <div style="display:flex; align-items:center; gap:1rem;">
                            ${link.icon || ''}
                            ${t(link.label)}
                        </div>
                        <span class="trigger-icon">${ICONS.arrow}</span>
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

    // Add Language Toggle to Mobile Top Bar (Compact)
    const mobileBar = document.querySelector('.mobile-top-bar');
    if (mobileBar && !mobileBar.querySelector('.lang-toggle-mobile')) {
        const langToggle = document.createElement('div');
        langToggle.className = 'lang-toggle-mobile';
        langToggle.innerHTML = `
            <button class="lang-opt ${currentLang === 'en' ? 'active' : ''}" onclick="setLanguage('en')">EN</button>
            <button class="lang-opt ${currentLang === 'fr' ? 'active' : ''}" onclick="setLanguage('fr')">FR</button>
        `;
        // Insert before call button (which is typically last)
        const callBtn = mobileBar.querySelector('.mobile-call-btn');
        if (callBtn) {
            mobileBar.insertBefore(langToggle, callBtn);
        } else {
            mobileBar.appendChild(langToggle);
        }
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
                    <li><a href="#">${t(CONFIG.footer.privacy)}</a></li>
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
                <a href="#">${t(CONFIG.footer.terms)}</a> &nbsp;•&nbsp; <a href="#">${t(CONFIG.footer.sitemap)}</a> &nbsp;•&nbsp; <a href="/erp/" class="text-muted" style="text-decoration:none; opacity:0.5; font-size:0.8rem;">ERP Login</a> &nbsp;•&nbsp; <span style="opacity:0.5">${t(CONFIG.footer.designedBy)}</span>
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
        const data = Object.fromEntries(formData.entries());

        // Determine API URL
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const API_BASE = isLocal ? 'http://localhost:5000' : '';

        try {
            // Use API
            const response = await fetch(`${API_BASE}/api/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                form.innerHTML = `<div class="success-message" style="text-align:center; padding:2rem;">
                    <h3 style="color:var(--gold); margin-bottom:1rem;">Request Received</h3>
                    <p>We'll get back to you shortly.</p>
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
