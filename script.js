// LANGUAGE STATE MANAGEMENT
let currentLang = localStorage.getItem('lang') || 'en';

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
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
        address: { en: "New Brunswick, Canada", fr: "Nouveau-Brunswick, Canada" },
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Solutions+Quasar+Inc+New+Brunswick",
        mapEmbed: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d355000.0!2d-66.0!3d46.0!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTPCsDQ5JzUyLjYiTiA2NcKwMzUnMjMuNiJX!5e0!3m2!1sen!2sca!4v1630000000000!5m2!1sen!2sca"
    },
    nav: [
        { label: { en: "Home", fr: "Accueil" }, href: "#top" },
        { label: { en: "Services", fr: "Services" }, href: "#services" },
        { label: { en: "About", fr: "À Propos" }, href: "about.html" },
        { label: { en: "Reviews", fr: "Témoignages" }, href: "#reviews" },
        { label: { en: "Why Us", fr: "Pourquoi Nous" }, href: "#why-us" },
        { label: { en: "Contact", fr: "Contact" }, href: "#contact" }
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
            }
        ]
    },
    reviews: {
        title: { en: "Client Words", fr: "Témoignages Clients" },
        items: [
            { text: { en: "Solutions Quasar transformed our online image. Professional, fast, and the design is simply stunning.", fr: "Solutions Quasar a transformé notre image en ligne. Professionnel, rapide, et le design est tout simplement magnifique." }, author: { en: "James M., Partner at Law Firm", fr: "James M., Associé dans un Cabinet d'Avocats" } },
            { text: { en: "Finally a web agency that understands business needs. The new site generated leads in week one.", fr: "Enfin une agence web qui comprend les besoins d'affaires. Le nouveau site a généré des prospects dès la première semaine." }, author: { en: "Sarah L., Financial Consultant", fr: "Sarah L., Consultante Financière" } }
        ]
    },
    why: {
        title: { en: "Why Choose Us", fr: "Pourquoi Nous Choisir" },
        items: [
            { icon: "message", title: { en: "Communication Excellence", fr: "Excellence en Communication" }, desc: { en: "A dedicated partner for your digital growth. Direct access, clear communication at every step.", fr: "Un partenaire dévoué pour votre croissance numérique. Accès direct, communication claire à chaque étape." }, image: "feat_communication_new.png" },
            { icon: "gauge", title: { en: "Premium Performance", fr: "Performance Premium" }, desc: { en: "Built to load instantly. We optimize every line of code for speed and SEO ranking.", fr: "Conçu pour charger instantanément. Nous optimisons chaque ligne de code pour la vitesse et le référencement." }, image: "feat_web_speed.png" },
            { icon: "check", title: { en: "Conversion Focused", fr: "Axé sur la Conversion" }, desc: { en: "Beauty with purpose. Every design element is engineered to turn visitors into clients.", fr: "Beauté avec objectif. Chaque élément de design est conçu pour transformer les visiteurs en clients." }, image: "feat_conversion.png" },
            { icon: "monitor", title: { en: "Mobile Excellence", fr: "Excellence Mobile" }, desc: { en: "A flawless experience on every device. Your brand looks expensive everywhere.", fr: "Une expérience impeccable sur chaque appareil. Votre marque paraît luxueuse partout." }, image: "feat_mobile.png" }
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
                { name: "Benjamin Dempsey", role: { en: "Founder & Lead Developer", fr: "Fondateur & Développeur Principal" }, bio: { en: "Full-stack developer with a passion for creating premium digital experiences that drive real business results.", fr: "Développeur full-stack passionné par la création d'expériences numériques premium qui génèrent de vrais résultats commerciaux." } },
                { name: "Sarah Mitchell", role: { en: "UX/UI Designer", fr: "Designer UX/UI" }, bio: { en: "Crafting intuitive interfaces that blend aesthetic excellence with conversion-focused design principles.", fr: "Création d'interfaces intuitives qui allient excellence esthétique et principes de design axés sur la conversion." } },
                { name: "Marcus Chen", role: { en: "Performance Engineer", fr: "Ingénieur Performance" }, bio: { en: "Optimizing every millisecond to deliver lightning-fast experiences that rank high and convert better.", fr: "Optimisation de chaque milliseconde pour offrir des expériences ultra-rapides qui se classent haut et convertissent mieux." } }
            ]
        },
        cta: {
            title: { en: "Ready to Work Together?", fr: "Prêt à Travailler Ensemble?" },
            desc: { en: "Let's discuss how we can elevate your digital presence with a premium solution built for your business.", fr: "Discutons de la façon dont nous pouvons élever votre présence numérique avec une solution premium conçue pour votre entreprise." }
        }
    }
};

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
    gauge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 18 V12"></path><path d="M16.5 7.5l0 0"></path></svg>`
};

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
        const role = document.querySelector(`[data-i18n="about.team.members.${i}.role"]`);
        const bio = document.querySelector(`[data-i18n="about.team.members.${i}.bio"]`);
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
        window.location.pathname.includes('about.html');

    const getLinkHref = (href) => {
        if (isSubPage && href.startsWith('#') && href !== '#contact') {
            return 'index.html' + href;
        }
        return href;
    };

    // Render Header Links
    const navHTML = CONFIG.nav.map(link => `<a href="${getLinkHref(link.href)}">${t(link.label)}</a>`).join('');
    document.querySelector('.desktop-nav').innerHTML = navHTML;

    // Logo Injection
    const logoHTML = `
    <a href="index.html" style="text-decoration:none; display:flex; align-items:center; color:inherit; gap: 0.5rem;">
        <img src="logo.png?v=final" alt="${CONFIG.business.name}" class="nav-logo">
        <span class="brand-text">SOLUTIONS QUASAR</span>
    </a>`;
    document.querySelector('.brand').innerHTML = logoHTML;
    document.querySelector('.mobile-logo').innerHTML = logoHTML;

    document.querySelector('.contact-phone').textContent = CONFIG.business.phone;
    document.querySelector('.contact-phone').href = `tel:${CONFIG.business.phoneClean}`;
    document.querySelector('.contact-email').textContent = currentLang === 'fr' ? 'Nous Écrire' : 'Email Us';
    document.querySelector('.contact-email').href = `mailto:${CONFIG.business.email}`;

    // Add Language Toggle to Desktop Header
    const contactActions = document.querySelector('.contact-actions');
    if (contactActions && !document.querySelector('.lang-toggle')) {
        const langToggle = document.createElement('div');
        langToggle.className = 'lang-toggle';
        langToggle.innerHTML = `
            <button class="lang-btn ${currentLang === 'en' ? 'active' : ''}" onclick="setLanguage('en')">EN</button>
            <button class="lang-btn ${currentLang === 'fr' ? 'active' : ''}" onclick="setLanguage('fr')">FR</button>
        `;
        contactActions.appendChild(langToggle);
    }

    // Mobile Top Bar
    document.querySelector('.mobile-call-btn').href = `tel:${CONFIG.business.phoneClean}`;
    document.querySelector('.mobile-call-btn').href = `tel:${CONFIG.business.phoneClean}`;
    document.querySelector('.mobile-call-btn').innerHTML = ICONS.phone;

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
    document.querySelector('.info-phone').innerHTML = `<strong>Phone:</strong> <a href="tel:${CONFIG.business.phoneClean}">${CONFIG.business.phone}</a>`;
    document.querySelector('.info-email').innerHTML = `<strong>Email:</strong> <a href="mailto:${CONFIG.business.email}">${CONFIG.business.email}</a>`;
    document.querySelector('.info-address').innerHTML = `<strong>Address:</strong> ${CONFIG.business.address}`;
    document.querySelector('.btn-directions').href = CONFIG.business.mapUrl;
    document.querySelector('.map-frame').src = CONFIG.business.mapEmbed;

    // Render Premium Footer
    const footerHTML = `
        <div class="footer-grid">
            <div class="footer-col footer-brand">
                <div class="brand" style="display:flex; align-items:center; gap:10px;">
                    <img src="logo.png?v=final" alt="${CONFIG.business.name}" style="height:32px; width:auto;">
                    <span class="brand-text" style="font-size:1.1rem;">SOLUTIONS QUASAR</span>
                </div>
                <p>Ultra-Premium Digital Architecture for high-standard businesses. We build the systems that power your growth.</p>
                <div style="margin-top:1.5rem; display:flex; gap:1rem;">
                   <!-- Social Placeholders -->
                   <a href="#" aria-label="LinkedIn">${ICONS.arrow}</a>
                   <a href="#" aria-label="Twitter">${ICONS.arrow}</a>
                </div>
            </div>
            
            <div class="footer-col">
                <h4>${currentLang === 'fr' ? 'Services' : 'Services'}</h4>
                <ul>
                    ${CONFIG.services.items.map(s => `<li><a href="${s.url}">${t(s.title)}</a></li>`).join('')}
                </ul>
            </div>

            <div class="footer-col">
                <h4>Company</h4>
                <ul>
                    <li><a href="${getLinkHref('#why-us')}">Why Us</a></li>
                    <li><a href="${getLinkHref('#reviews')}">Case Studies</a></li>
                    <li><a href="#">Careers</a></li>
                    <li><a href="#">Privacy Policy</a></li>
                </ul>
            </div>

            <div class="footer-col">
                <h4>Contact</h4>
                <ul>
                    <li class="text-gold" style="font-size:1.1rem; font-weight:600;"><a href="tel:${CONFIG.business.phoneClean}">${CONFIG.business.phone}</a></li>
                    <li><a href="mailto:${CONFIG.business.email}">${CONFIG.business.email}</a></li>
                    <li style="opacity:0.7; margin-top:1rem;">${t(CONFIG.business.address)}</li>
                </ul>
            </div>
        </div>

        <div class="footer-bottom">
            <div class="footer-cred">&copy; ${new Date().getFullYear()} ${CONFIG.business.name} • All Rights Reserved.</div>
            <div class="footer-links">
                <a href="#">Terms</a> &nbsp;•&nbsp; <a href="#">Sitemap</a> &nbsp;•&nbsp; <span style="opacity:0.5">Designed by Solutions Quasar Inc.</span>
            </div>
        </div>
    `;

    // Inject entire footer content into the container
    document.querySelector('footer .container').innerHTML = footerHTML;

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
}

function setupInteractions() {
    // Mobile Menu
    const menuBtn = document.getElementById('btn-menu');
    const overlay = document.getElementById('menu-overlay');
    const closeBtn = document.getElementById('btn-close-menu');
    const menuLinks = document.querySelectorAll('.menu-link');

    // Inject Icons with CSS Burger (No Text)
    menuBtn.innerHTML = `
        <div class="menu-icon-wrapper">
            <div class="burger-icon">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;

    // Bottom Bar Icons (Icon Only) - Fix Links
    const btnCall = document.getElementById('btn-call');
    btnCall.innerHTML = `<div>${ICONS.phone}</div>`;
    btnCall.href = `tel:${CONFIG.business.phoneClean}`;

    document.getElementById('btn-msg').innerHTML = `<div>${ICONS.message}</div>`;

    function updateMenuIcon(isOpen) {
        const wrapper = menuBtn.querySelector('.menu-icon-wrapper');

        if (isOpen) {
            wrapper.classList.add('open');
        } else {
            wrapper.classList.remove('open');
        }
    }

    function toggleMenu() {
        const isOpen = overlay.classList.contains('open');
        if (isOpen) {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
            updateMenuIcon(false);
        } else {
            overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
            updateMenuIcon(true);
        }
    }

    menuBtn.addEventListener('click', toggleMenu);

    // Use event delegation for dynamically added links
    document.querySelector('.menu-nav').addEventListener('click', (e) => {
        if (e.target.closest('.menu-link')) {
            toggleMenu();
        }
    });

    // Message Button Scroll
    document.getElementById('btn-msg').addEventListener('click', () => {
        document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => document.querySelector('input[name="name"]').focus(), 800);
    });
}

function setupForm() {
    const form = document.querySelector('form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = 'Sending...';
        btn.disabled = true;

        const formData = new FormData(form);

        try {
            const response = await fetch(form.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                form.innerHTML = `<div class="success-message"><h3>Request Received</h3><p>We will contact you shortly.</p></div>`;
            } else {
                throw new Error('Network error');
            }
        } catch (error) {
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
