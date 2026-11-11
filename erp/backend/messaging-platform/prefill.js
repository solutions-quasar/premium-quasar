/**
 * Agent setup wizard: pre-fill the business sheet from public sources.
 *
 * Sources (each optional, run in parallel, failures ignored):
 *   - Google Places (New): address, phone, opening hours, website, category, summary
 *   - The client's website: home page + up to 6 relevant sub-pages (services, prices, FAQ, contact…)
 *   - The client's Facebook Page, when connected in Messaging (about, hours, phone…)
 *   - Perplexity (web search with citations): services, prices, policies, FAQ found elsewhere
 * Then OpenAI sorts what was found into the wizard fields. Rule: only facts present in the sources,
 * empty when unknown (never invented prices), with the source of each field.
 */
const axios = require('axios');
const OpenAI = require('openai');
const { db } = require('../firebase-admin');

const FIELDS = ['businessName', 'activity', 'location', 'contact', 'hours', 'services', 'prices', 'booking', 'policies', 'faq', 'languages'];
const UA = 'Mozilla/5.0 (compatible; QuasarSetupBot/1.0; +https://solutionsquasar.ca)';
const clip = (s, n) => String(s || '').slice(0, n);

// ---------- Google Places ----------
async function fromPlaces({ businessName, city, website }) {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    const textQuery = [businessName, city].filter(Boolean).join(' ') || website;
    if (!key || !textQuery) return null;
    const r = await axios.post('https://places.googleapis.com/v1/places:searchText', { textQuery, maxResultCount: 1 }, {
        timeout: 12000,
        headers: {
            'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.regularOpeningHours.weekdayDescriptions,places.primaryTypeDisplayName,places.editorialSummary,places.businessStatus'
        }
    });
    const p = r.data?.places?.[0];
    if (!p) return null;
    return {
        name: p.displayName?.text || '', address: p.formattedAddress || '', phone: p.nationalPhoneNumber || p.internationalPhoneNumber || '',
        website: p.websiteUri || '', hours: (p.regularOpeningHours?.weekdayDescriptions || []).join('\n'),
        category: p.primaryTypeDisplayName?.text || '', summary: p.editorialSummary?.text || '', status: p.businessStatus || ''
    };
}

// ---------- Website ----------
const htmlToText = (html) => String(html || '')
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&agrave;/g, 'à')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

const isPublicHttpUrl = (u) => {
    try {
        const x = new URL(u);
        if (!/^https?:$/.test(x.protocol)) return false;
        // No local / private targets (server-side fetch)
        return !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|169\.254\.|\[?::1\]?$)/i.test(x.hostname);
    } catch (_) { return false; }
};

async function fetchPage(url) {
    const r = await axios.get(url, { timeout: 10000, maxContentLength: 2_000_000, maxRedirects: 4, beforeRedirect: (o) => { if (!isPublicHttpUrl(`${o.protocol}//${o.hostname}/`)) throw new Error("Redirect to a private address blocked"); }, headers: { 'User-Agent': UA, Accept: 'text/html' }, responseType: 'text', validateStatus: s => s < 400 });
    return String(r.data || '');
}

async function fromWebsite(website) {
    if (!website) return null;
    let base = website.trim();
    if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
    if (!isPublicHttpUrl(base)) return null;
    let home;
    try { home = await fetchPage(base); } catch (_) { base = base.replace(/^https:/, 'http:'); home = await fetchPage(base); }
    const origin = new URL(base).origin;
    // Pick the useful sub-pages from the links of the home page
    const WANT = /(service|tarif|prix|price|pricing|rate|faq|question|contact|about|a-propos|propos|apropos|horaire|hours|politique|policy|garantie|warranty|rendez|booking|book|menu|produit|product)/i;
    const links = [...home.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)].map(m => { try { return new URL(m[1], base).href.split('#')[0]; } catch (_) { return null; } })
        .filter(u => u && u.startsWith(origin) && WANT.test(u) && !/\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|mp4)$/i.test(u));
    const sub = [...new Set(links)].slice(0, 6);
    const pages = [{ url: base, text: clip(htmlToText(home), 7000) }];
    const subs = await Promise.allSettled(sub.map(async u => ({ url: u, text: clip(htmlToText(await fetchPage(u)), 5000) })));
    subs.forEach(s => { if (s.status === 'fulfilled' && s.value.text.length > 80) pages.push(s.value); });
    return { pages };
}

// ---------- Facebook Page (connected in Messaging) ----------
async function fromFacebook(projectId) {
    const snap = await db.collection('mp_channels').where('projectId', '==', projectId).where('type', '==', 'facebook').limit(1).get();
    if (snap.empty) return null;
    const ch = snap.docs[0].data();
    if (!ch.accessToken) return null;
    const r = await axios.get(`https://graph.facebook.com/v21.0/${encodeURIComponent(ch.externalId)}`, {
        timeout: 10000,
        params: { fields: 'name,about,description,category,phone,website,emails,single_line_address,hours,price_range', access_token: ch.accessToken }
    });
    return r.data || null;
}

// ---------- Perplexity (web search) ----------
async function fromPerplexity({ businessName, city, website, lang }) {
    const pplx = require('../perplexity-agent-service');
    if (!pplx.isConfigured() || !businessName) return null;
    const input = `${lang === 'en' ? 'Research this local business on the web' : 'Recherche sur le web cette entreprise locale'} :
${businessName}${city ? ` (${city})` : ''}${website ? ` — ${website}` : ''}

${lang === 'en' ? 'Report only facts you actually found, with the page they come from' : 'Rapporte seulement les faits réellement trouvés, avec la page d\'où ils viennent'} :
- activity and customers / activité et clientèle
- services and products / services et produits
- prices or rates / prix ou tarifs
- opening hours / horaires
- address, service area, phone, email / adresse, zone desservie, téléphone, courriel
- booking or ordering / prise de rendez-vous ou commande
- policies (warranty, payment, cancellation) / politiques (garantie, paiement, annulation)
- frequently asked questions with answers / questions fréquentes et réponses
- languages spoken / langues parlées
${lang === 'en' ? 'If something is not found, say "not found". Do not guess.' : 'Si une information est introuvable, écris « introuvable ». Ne devine rien.'}`;
    const r = await pplx.runAgent({ input, preset: 'low' });
    return { text: clip(r.output_text, 9000), citations: (r.citations || []).slice(0, 10), engine: 'perplexity' };
}

// OpenAI web search: used when Perplexity is not available (no key or no credit)
async function fromOpenAiSearch({ businessName, city, website, lang }) {
    if (!process.env.OPENAI_API_KEY || !(businessName || website)) return null;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const who = [businessName, city, website].filter(Boolean).join(', ');
    const r = await openai.responses.create({
        model: 'gpt-4.1-mini',
        tools: [{ type: 'web_search_preview' }],
        input: `${lang === 'en' ? 'Research this local business' : 'Recherche cette entreprise locale'}: ${who}.
Report ONLY facts you found, each with its source URL: official website, activity and customers, services and products, prices, opening hours, address and service area, phone, email, how to book or order, policies (warranty, payment, cancellation), frequently asked questions with answers, languages. Write "not found" for anything you could not find. Do not guess.`
    });
    const citations = new Set();
    (r.output || []).forEach(i => (i.content || []).forEach(c => (c.annotations || []).forEach(a => a.url && citations.add(a.url.replace(/[?&]utm_source=openai/, '')))));
    return { text: clip(r.output_text, 9000), citations: [...citations].slice(0, 10), engine: 'openai' };
}

async function fromWebSearch(q) {
    try { const r = await fromPerplexity(q); if (r && r.text) return r; } catch (e) { console.warn('[Prefill] Perplexity unavailable, using OpenAI web search:', e.message.slice(0, 120)); }
    return fromOpenAiSearch(q);
}

// The official website among the search citations (not directories or social networks)
const DIRECTORIES = /(google.|facebook.|instagram.|yelp.|tripadvisor.|yellowpages|pagesjaunes|linkedin.|twitter.|x.com|tiktok.|youtube.|wikipedia.|canada411|bbb.org|foursquare|mapquest|opentable|ubereats|doordash|skipthedishes|indeed.)/i;
const officialSite = (citations = []) => {
    for (const u of citations) { try { const x = new URL(u); if (!DIRECTORIES.test(x.hostname)) return x.origin; } catch (_) { } }
    return '';
};

// ---------- Sort into the wizard fields ----------
async function extract({ lang, given, places, site, facebook, web }) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const blocks = [];
    if (places) blocks.push(`### SOURCE google (Google Maps)\n${JSON.stringify(places)}`);
    if (facebook) blocks.push(`### SOURCE facebook (Page Facebook)\n${JSON.stringify(facebook)}`);
    if (site) site.pages.forEach((p, i) => blocks.push(`### SOURCE website (${p.url})\n${p.text}`));
    if (web) blocks.push(`### SOURCE web (Perplexity search; citations: ${web.citations.join(', ')})\n${web.text}`);
    if (!blocks.length) return { fields: {}, sources: {} };

    const fr = lang !== 'en';
    const system = `${fr ? 'Tu remplis la fiche d\'une entreprise pour configurer son assistant IA, en français.' : 'You fill in a business sheet to set up its AI assistant, in English.'}
STRICT RULES:
- Use ONLY facts present in the SOURCES. Never guess, never complete from general knowledge.
- Leave a field as "" when the sources do not contain it. Prices: only exact amounts found in a source.
- If sources disagree, prefer: google for hours/address/phone, website for services/prices/policies, then facebook, then web.
- For each non-empty field, give the source key used: google, website, facebook or web.
FIELD FORMATS:
- businessName: the business name.
- activity: one sentence, what the business does and for whom.
- location: address and, if stated, the service area.
- contact: public phone · email · website, separated by " · ".
- hours: one line per day or range (e.g. "${fr ? 'Lun-ven 8 h-17 h' : 'Mon-Fri 8am-5pm'}"), closed days included.
- services: one service per line.
- prices: "service: price" separated by " · " or one per line.
- booking: how to book or order, lead times.
- policies: warranty, payment methods, cancellation, deposit.
- faq: one "Q: ... A: ..." per line, only questions answered in the sources.
- languages: languages the business serves customers in, if stated.`;
    const schemaProps = Object.fromEntries(FIELDS.map(f => [f, { type: 'string' }]));
    const srcProps = Object.fromEntries(FIELDS.map(f => [f, { type: 'string', enum: ['', 'google', 'website', 'facebook', 'web'] }]));
    const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: {
            type: 'json_schema',
            json_schema: { name: 'business_sheet', strict: true, schema: { type: 'object', additionalProperties: false, required: ['fields', 'sources'], properties: { fields: { type: 'object', additionalProperties: false, required: FIELDS, properties: schemaProps }, sources: { type: 'object', additionalProperties: false, required: FIELDS, properties: srcProps } } } }
        },
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: `${fr ? 'Indications données par l\'utilisateur' : 'Hints given by the user'}: ${JSON.stringify(given)}\n\nSOURCES:\n${clip(blocks.join('\n\n'), 45000)}` }
        ]
    });
    const out = JSON.parse(resp.choices[0].message.content || '{}');
    const fields = {}, sources = {};
    FIELDS.forEach(f => {
        let v = String(out.fields?.[f] || '').trim();
        // Drop empty " · " segments (e.g. contact without email)
        if (v.includes('·')) v = v.split('·').map(x => x.trim()).filter(Boolean).join(' · ');
        if (v && out.sources?.[f]) { fields[f] = v; sources[f] = out.sources[f]; }
    });
    return { fields, sources };
}

/**
 * @returns {{ fields, sources, sourceInfo: { google?, website?, facebook?, web? }, used: string[] }}
 */
async function prefillBusiness(projectId, { website = '', businessName = '', city = '', lang = 'fr' } = {}) {
    website = String(website || '').trim().slice(0, 300);
    businessName = String(businessName || '').trim().slice(0, 150);
    city = String(city || '').trim().slice(0, 100);
    if (!website && !businessName) throw new Error(lang === 'en' ? 'Give the website or the business name.' : 'Indiquez le site web ou le nom de l\'entreprise.');

    const settle = (p) => p.then(v => v, e => { console.warn('[Prefill] source failed:', e.response?.status || '', e.message); return null; });
    const [places, facebook] = await Promise.all([settle(fromPlaces({ businessName, city, website })), settle(fromFacebook(projectId))]);
    const web = await settle(fromWebSearch({ businessName: businessName || places?.name || facebook?.name, city, website: website || places?.website || facebook?.website, lang }));
    // Website: given > Google Maps > Facebook Page > first official site found by the web search
    const site = website || places?.website || facebook?.website || officialSite(web?.citations);
    const siteData = await settle(fromWebsite(site));
    const { fields, sources } = await extract({ lang, given: { website, businessName, city }, places, site: siteData, facebook, web });
    const used = [places && 'google', siteData && 'website', facebook && 'facebook', web && 'web'].filter(Boolean);
    return {
        fields, sources, used,
        sourceInfo: {
            google: places ? (places.name || 'Google Maps') : null,
            website: siteData ? siteData.pages.map(p => p.url) : null,
            facebook: facebook ? (facebook.name || 'Facebook') : null,
            web: web ? web.citations : null,
            webEngine: web?.engine || null,
            websiteUsed: siteData ? site : null
        }
    };
}

module.exports = { prefillBusiness, _htmlToText: htmlToText, _isPublicHttpUrl: isPublicHttpUrl };
