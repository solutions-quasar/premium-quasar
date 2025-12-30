// CONFIGURATION OBJECT - Single Source of Truth
const CONFIG = {
    business: {
        name: "Solutions Quasar Inc.",
        tagline: "Ultra-Premium Digital Architecture",
        phone: "418-410-0856",
        phoneClean: "14184100856",
        email: "benjamin@solutionsquasar.ca",
        address: "New Brunswick, Canada", // From scrape or generic
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Solutions+Quasar+Inc+New+Brunswick",
        mapEmbed: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d355000.0!2d-66.0!3d46.0!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTPCsDQ5JzUyLjYiTiA2NcKwMzUnMjMuNiJX!5e0!3m2!1sen!2sca!4v1630000000000!5m2!1sen!2sca" // Generic NB map center
    },
    nav: [
        { label: "Home", href: "#top" },
        { label: "Services", href: "#services" },
        { label: "Reviews", href: "#reviews" },
        { label: "Why Us", href: "#why-us" },
        { label: "Contact", href: "#contact" }
    ],
    hero: {
        h1: "Premium websites and apps for high standard businesses.",
        subhead: "Fast, modern, mobile-first builds that convert—designed for lawyers, accountants, dentists, brokers, and high-trust services.",
        cta: "Book a Strategy Call",
        trust: "Mobile-first • Performance-focused • Clean SEO foundations",
        imageDesktop: "hero-desktop.png",
        imageMobile: "hero-desktop.png" // Using the same high-res for quality, CSS handles object-fit
    },
    services: {
        title: "Our Expertise",
        subtitle: "We build systems, not just pages.",
        items: [
            { icon: "monitor", title: "Premium Website Creation", desc: "Custom-coded, ultra-fast websites designed to position your brand at the top of your industry.", detail: "No templates. Pure performance and aesthetics.", url: "websites.html" },
            { icon: "layout", title: "Custom Business Apps", desc: "Tailored web applications to streamline operations and enhance client interaction.", detail: "Client portals, internal tools, and dashboards.", url: "apps.html" },
            { icon: "database", title: "Smart AI Integration", desc: "Leverage artificial intelligence to automate workflows and personalize user experiences.", detail: "Chatbots, predictive analytics, and automated content.", url: "ai.html" }
        ]
    },
    reviews: {
        title: "Client Words",
        items: [
            { text: "Solutions Quasar transformed our online image. Professional, fast, and the design is simply stunning.", author: "James M., Partner at Law Firm" },
            { text: "Finally a web agency that understands business needs. The new site generated leads in week one.", author: "Sarah L., Financial Consultant" }
        ]
    },
    why: {
        title: "Why Choose Us",
        items: [
            { icon: "shield", title: "White-Glove Service", desc: "A dedicated partner for your digital growth. Direct access, clear communication." },
            { icon: "gauge", title: "Premium Performance", desc: "Built to load instantly. We optimize every line of code for speed and SEO ranking." },
            { icon: "check", title: "Conversion Focused", desc: "Beauty with purpose. Every design element is engineered to turn visitors into clients." },
            { icon: "monitor", title: "Mobile Excellence", desc: "A flawless experience on every device. Your brand looks expensive everywhere." }
        ]
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
});

function renderSite() {
    // Determine context: Fix navigation on service pages
    const isSubPage = window.location.pathname.includes('websites.html') ||
        window.location.pathname.includes('apps.html') ||
        window.location.pathname.includes('ai.html');

    const getLinkHref = (href) => {
        if (isSubPage && href.startsWith('#') && href !== '#contact') {
            return 'index.html' + href;
        }
        return href;
    };

    // Render Header Links
    const navHTML = CONFIG.nav.map(link => `<a href="${getLinkHref(link.href)}">${link.label}</a>`).join('');
    document.querySelector('.desktop-nav').innerHTML = navHTML;

    // Logo Injection
    const logoHTML = `<img src="logo.png?v=final" alt="${CONFIG.business.name}" class="nav-logo"><span class="brand-text">SOLUTIONS QUASAR</span>`;
    document.querySelector('.brand').innerHTML = logoHTML;
    document.querySelector('.mobile-logo').innerHTML = logoHTML;

    document.querySelector('.contact-phone').textContent = CONFIG.business.phone;
    document.querySelector('.contact-phone').href = `tel:${CONFIG.business.phoneClean}`;
    document.querySelector('.contact-email').textContent = "Email Us";
    document.querySelector('.contact-email').href = `mailto:${CONFIG.business.email}`;

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
                <h1>${CONFIG.hero.h1}</h1>
                <p>${CONFIG.hero.subhead}</p>
                <a href="#contact" class="btn-primary">${CONFIG.hero.cta}</a>
                <div class="trust-cue">${CONFIG.hero.trust}</div>
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
            <div class="service-icon">${ICONS[s.icon] || ICONS.monitor}</div>
            <h3>${s.title}</h3>
            <p>${s.desc}</p>
            <div class="service-details">${s.detail}</div>
            <a href="${s.url}" class="text-gold uppercase" style="display:block; margin-top:1.5rem; font-size:0.8rem;">Learn More &rarr;</a>
        </div>
    `).join('');
    }

    // Render Reviews
    const reviewGrid = document.querySelector('.review-container'); // Need to add container in HTML
    if (reviewGrid) {
        reviewGrid.innerHTML = CONFIG.reviews.items.map(r => `
            <div class="review-card">
                <p class="review-text">"${r.text}"</p>
                <p class="review-author">— ${r.author}</p>
            </div>
        `).join('');
    }

    // Render Why Us
    const whyGrid = document.querySelector('.why-grid');
    if (whyGrid) {
        document.querySelector('#why-us h2').textContent = CONFIG.why.title;
        whyGrid.innerHTML = CONFIG.why.items.map(item => `
        <div class="why-card">
            <div class="why-icon text-gold">${ICONS[item.icon] || ICONS.check}</div>
            <h3 style="margin:1rem 0; font-size:1.1rem;">${item.title}</h3>
            <p class="text-muted" style="font-size:0.95rem;">${item.desc}</p>
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
                <h4>Services</h4>
                <ul>
                    ${CONFIG.services.items.map(s => `<li><a href="${s.url}">${s.title}</a></li>`).join('')}
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
                    <li style="opacity:0.7; margin-top:1rem;">${CONFIG.business.address}</li>
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

    // Render Mobile Menu Links
    document.querySelector('.menu-nav').innerHTML = CONFIG.nav.map(link => `<a href="${getLinkHref(link.href)}" class="menu-link">${link.label}</a>`).join('');
}

function setupInteractions() {
    // Mobile Menu
    const menuBtn = document.getElementById('btn-menu');
    const overlay = document.getElementById('menu-overlay');
    const closeBtn = document.getElementById('btn-close-menu');
    const menuLinks = document.querySelectorAll('.menu-link');

    // Inject Icons
    menuBtn.innerHTML = `<div>${ICONS.menu}</div><div>Menu</div>`;
    closeBtn.innerHTML = ICONS.close;

    // Bottom Bar Icons
    document.getElementById('btn-call').innerHTML = `<div>${ICONS.phone}</div><div>Call</div>`;
    document.getElementById('btn-msg').innerHTML = `<div>${ICONS.message}</div><div>Message</div>`;

    function toggleMenu() {
        const isOpen = overlay.classList.contains('open');
        if (isOpen) {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
        } else {
            overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    }

    menuBtn.addEventListener('click', toggleMenu);
    closeBtn.addEventListener('click', toggleMenu);
    menuLinks.forEach(l => l.addEventListener('click', toggleMenu));

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
