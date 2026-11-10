/**
 * Website price list (ai.html #pricing): reads the public catalog edited in the ERP (Plan tab)
 * from /api/billing/public-catalog, so prices on the site always match what clients pay.
 */
(function () {
    var root = document.getElementById('pricing-root');
    if (!root) return;
    var data = null;

    var lang = function () { try { return localStorage.getItem('lang') === 'fr' ? 'fr' : 'en'; } catch (_) { return 'en'; } };
    var L = function (fr, en) { return lang() === 'fr' ? fr : en; };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var money = function (n, digits) {
        return new Intl.NumberFormat(lang() === 'fr' ? 'fr-CA' : 'en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: digits == null ? 0 : digits, maximumFractionDigits: 2 }).format(Number(n || 0));
    };

    var style = document.createElement('style');
    style.textContent = [
        '#pricing { padding: var(--section-pad, 5rem) 0; }',
        '.pr-head { text-align:center; max-width:720px; margin:0 auto 2.5rem; }',
        '.pr-head h2 { font-size: clamp(1.8rem, 3.5vw, 2.6rem); margin: .4rem 0 1rem; }',
        '.pr-grid { display:grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 1.25rem; max-width: 1100px; margin: 0 auto; }',
        '@media (max-width: 860px) { .pr-grid { grid-template-columns: 1fr; } }',
        '.pr-card { background: var(--bg-card, #15171C); border: 1px solid var(--border-subtle, rgba(255,255,255,.08)); border-radius: 20px; padding: clamp(1.25rem, 3vw, 2rem); }',
        '.pr-card.main { border-color: var(--border-gold, rgba(223,165,58,.3)); box-shadow: 0 0 60px var(--gold-glow, rgba(223,165,58,.12)); }',
        '.pr-price { font-size: clamp(2.4rem, 5vw, 3.2rem); font-weight: 800; letter-spacing: -1px; }',
        '.pr-muted { color: var(--text-muted, #A0A5B0); }',
        '.pr-list { list-style:none; padding:0; margin:1.25rem 0; }',
        '.pr-list li { padding:.45rem 0; color: var(--text-main, #F0F2F5); }',
        '.pr-opt { display:flex; justify-content:space-between; gap:1rem; padding:.9rem 0; border-top:1px solid var(--border-subtle, rgba(255,255,255,.08)); }',
        '.pr-opt:first-of-type { border-top:0; }',
        '.pr-opt strong { white-space:nowrap; color: var(--gold, #DFA53A); }',
        '.pr-foot { text-align:center; margin-top:1.5rem; font-size:.9rem; }',
        '.pr-cta { display:flex; gap:.75rem; flex-wrap:wrap; margin-top:1.25rem; }',
        '.pr-cta a { flex:1; text-align:center; min-width:200px; }'
    ].join('\n');
    document.head.appendChild(style);

    // English name / description when the site is in English and the ERP has one
    var tr = function (o, k) { var en = o[k + "En"]; return lang() === "en" && en ? en : o[k]; };

    function render() {
        if (!data) return;
        var b = data.base;
        root.innerHTML =
            '<div class="pr-head">' +
                '<span class="uppercase text-gold">' + L('Tarifs', 'Pricing') + '</span>' +
                '<h2>' + L('Un agent IA sur tous vos canaux, à partir de ', 'An AI agent on all your channels, from ') + money(b.monthly) + L(' / mois', ' / month') + '</h2>' +
                '<p class="pr-muted">' + L('Prix de départ. Chaque entreprise est différente : nous ajustons l\'offre à vos besoins, à votre volume et à vos outils.', 'Starting prices. Every business is different: we tailor the offer to your needs, your volume and your tools.') + '</p>' +
            '</div>' +
            '<div class="pr-grid">' +
                '<div class="pr-card main">' +
                    '<div class="uppercase text-gold" style="font-size:.8rem;">' + esc(tr(b, "name")) + '</div>' +
                    '<div style="margin-top:.5rem;"><span class="pr-price">' + money(b.monthly) + '</span> <span class="pr-muted">' + L('/ mois', '/ month') + '</span></div>' +
                    '<p class="pr-muted" style="margin-top:.75rem;">' + esc(tr(b, "description")) + '</p>' +
                    '<ul class="pr-list">' +
                        '<li>✓ ' + L(b.includedConversations + ' conversations IA incluses chaque mois', b.includedConversations + ' AI conversations included every month') + '</li>' +
                        '<li>✓ ' + L('Messenger, Instagram, WhatsApp et courriel dans une seule boîte', 'Messenger, Instagram, WhatsApp and email in one inbox') + '</li>' +
                        '<li>✓ ' + L('Portail client sur téléphone, reprise en main en un clic', 'Client portal on your phone, take over in one tap') + '</li>' +
                        '<li>✓ ' + L('Connexion de vos comptes en quelques clics', 'Connect your accounts in a few clicks') + '</li>' +
                    '</ul>' +
                    '<div class="pr-muted" style="font-size:.9rem;">' +
                        (data.setupFee ? L('Installation et configuration : ', 'Setup and configuration: ') + money(data.setupFee) + L(' (une fois)', ' (one time)') + '<br>' : '') +
                        L('Au-delà du quota : ', 'Beyond the quota: ') + money(data.overageUnitPrice, 2) + L(' par conversation', ' per conversation') +
                    '</div>' +
                    '<div class="pr-cta"><a href="#contact" class="btn-primary">' + L('Obtenir une offre sur mesure', 'Get a tailored offer') + '</a></div>' +
                '</div>' +
                (data.options.length ?
                '<div class="pr-card">' +
                    '<div class="uppercase text-gold" style="font-size:.8rem; margin-bottom:.5rem;">' + L('Options', 'Add-ons') + '</div>' +
                    data.options.map(function (o) {
                        var minutes = o.includedMinutes ? '<div class="pr-muted" style="font-size:.85rem; margin-top:2px;">' + L(o.includedMinutes + ' minutes d\'appel incluses / mois, puis ' + money(data.minuteOverageUnitPrice, 2) + ' la minute', o.includedMinutes + ' call minutes included / month, then ' + money(data.minuteOverageUnitPrice, 2) + ' per minute') + '</div>' : '';
                        return '<div class="pr-opt"><div><div style="font-weight:700;">' + esc(tr(o, "name")) + '</div><div class="pr-muted" style="font-size:.9rem;">' + esc(tr(o, "description")) + '</div>' + minutes + '</div><strong>+' + money(o.monthly) + L('/mois', '/mo') + '</strong></div>';
                    }).join('') +
                '</div>' : '') +
            '</div>' +
            '<p class="pr-foot pr-muted">' + L('Prix en dollars canadiens, taxes en sus. Sans engagement : résiliable en tout temps.', 'Prices in Canadian dollars, plus taxes. No commitment: cancel anytime.') + '</p>';
    }

    // Re-render when the site language changes
    var originalSetLanguage = window.setLanguage;
    if (typeof originalSetLanguage === 'function') {
        window.setLanguage = function (l) { originalSetLanguage(l); render(); };
    }

    fetch('/api/billing/public-catalog')
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && d.success && d.catalog) { data = d.catalog; render(); } else { root.closest('section').style.display = 'none'; } })
        .catch(function () { root.closest('section').style.display = 'none'; });
})();
