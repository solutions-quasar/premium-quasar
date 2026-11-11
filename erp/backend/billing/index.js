/**
 * Billing — subscriptions for the AI agent service (one per client project).
 *
 * Offer: a base plan + optional add-ons (monthly), a one-time setup fee, and AI conversations
 * beyond the included quota billed as overage (Stripe Billing Meter, reported by us).
 *
 * Stripe stays the source of truth for subscriptions and invoices; Firestore keeps:
 *   billing_settings/catalog                    the offer (prices, quotas) + Stripe product / price ids
 *   ai_projects/{id}.billing                     { customerId, subscriptionId, status, options, periodStart, periodEnd }
 *   ai_projects/{id}/billing_usage/{periodKey}   { conversations, overage, voiceMinutes, voiceOverageMinutes }
 *
 * Voice: options with includedMinutes > 0 (the "voice" add-on) include phone minutes; minutes beyond are
 * billed per minute on a second meter (quasar_voice_minute), reported by the voice module after each call.
 *
 * Routes (mounted under /api/billing):
 *   GET  /catalog                         staff   offer + sync state
 *   PUT  /catalog                         staff   save the offer (does not touch Stripe)
 *   POST /catalog/sync                    staff   create / update the Stripe products, prices and meter
 *   GET  /projects/:projectId             staff + project's client   subscription, usage, invoices
 *   POST /projects/:projectId/checkout    staff + project's client   Stripe Checkout link (base + options + setup)
 *   POST /projects/:projectId/options     staff + project's client   add / remove an add-on (prorated)
 *   POST /projects/:projectId/portal      staff + project's client   Stripe customer portal (card, invoices, cancel)
 */
const express = require('express');
const { db } = require('../firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
// Test and live Stripe ids are stored apart: the local server (test key) and production (live key)
// share the same Firestore, so test products, customers and subscriptions must never overwrite live ones.
//   live → catalog.stripe,     ai_projects/{id}.billing
//   test → catalog.stripeTest, ai_projects/{id}.billingTest
const STRIPE_TEST_MODE = /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY || '');
const STRIPE_FIELD = STRIPE_TEST_MODE ? 'stripeTest' : 'stripe';
const BILLING_FIELD = STRIPE_TEST_MODE ? 'billingTest' : 'billing';
/** Project data with `billing` = the subscription data of the current Stripe mode. */
const withMode = (data = {}) => (STRIPE_TEST_MODE ? { ...data, billing: data.billingTest || {} } : data);
if (STRIPE_TEST_MODE) console.log('[Billing] Stripe TEST mode: ids kept in stripeTest / billingTest');
// Where Stripe may send the customer back: our sites, plus localhost only with a test key (local development)
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const allowedReturn = (url) => /^https:\/\/(www\.)?(solutionsquasar\.ca|quasar-erp-b26d5\.(web|firebaseapp)\.app)\//.test(url)
    || (STRIPE_TEST_MODE && LOCAL_ORIGIN.test(String(url).replace(/^(http:\/\/[^/]+).*$/, '$1')));
const CATALOG_REF = () => db.collection('billing_settings').doc('catalog');
const METER_EVENT = 'quasar_ai_conversation';
const VOICE_METER_EVENT = 'quasar_voice_minute';
const PUBLIC_BASE = process.env.PUBLIC_APP_URL || 'https://solutionsquasar.ca';

const DEFAULT_CATALOG = {
    currency: 'cad',
    automaticTax: false,
    base: {
        name: 'Agent IA Quasar',
        description: 'Assistant IA sur vos canaux (Messenger, Instagram, WhatsApp, courriel), boîte de réception unifiée et portail client.',
        nameEn: 'Quasar AI Agent',
        descriptionEn: 'AI assistant on your channels (Messenger, Instagram, WhatsApp, email), unified inbox and client portal.',
        monthly: 349,
        includedConversations: 1000
    },
    setupFee: {
        name: 'Installation et configuration',
        description: 'Configuration de l\'assistant, connexion des canaux et mise en route.',
        amount: 999
    },
    overage: {
        name: 'Conversations IA supplémentaires',
        unitPrice: 0.15
    },
    minuteOverage: {
        name: 'Minutes d\'appel supplémentaires',
        unitPrice: 0.40
    },
    options: [
        { key: 'voice', name: 'Agent vocal (téléphone)', description: 'L\'assistant répond à vos appels, prend les rendez-vous et vous envoie un résumé.', nameEn: 'Voice agent (phone)', descriptionEn: 'The assistant answers your calls, books appointments and sends you a summary.', monthly: 249, extraConversations: 0, includedMinutes: 300 },
        { key: 'booking', name: 'Prise de rendez-vous', description: 'Réservation automatique dans votre Google Agenda.', nameEn: 'Appointment booking', descriptionEn: 'Automatic booking in your Google Calendar.', monthly: 79, extraConversations: 0, includedMinutes: 0 },
        { key: 'sms', name: 'Numéro texto dédié (SMS)', description: 'Un numéro local pour vos textos, enregistré auprès des opérateurs.', nameEn: 'Dedicated text number (SMS)', descriptionEn: 'A local number for your texts, registered with the carriers.', monthly: 39, extraConversations: 0, includedMinutes: 0 },
        { key: 'quota', name: '+1 000 conversations IA', description: 'Quota mensuel supplémentaire, à prix réduit.', nameEn: '+1,000 AI conversations', descriptionEn: 'Extra monthly quota at a lower price.', monthly: 99, extraConversations: 1000, includedMinutes: 0 }
    ],
    // Proposal page defaults (each client's offer can override them)
    presentation: {
        includes: [
            'Réponses IA 24 h/24 sur Messenger, Instagram, WhatsApp et courriel',
            'Une seule boîte de réception pour tous vos messages',
            'Portail client sur téléphone : vous reprenez la main en un clic',
            'Assistant formé sur vos services, vos prix et vos horaires',
            'Suivi et ajustements par l\'équipe Quasar'
        ],
        includesEn: [
            'AI replies 24/7 on Messenger, Instagram, WhatsApp and email',
            'One inbox for all your messages',
            'Client portal on your phone: take over in one tap',
            'Assistant trained on your services, prices and hours',
            'Follow-up and adjustments by the Quasar team'
        ],
        setupIncludes: [
            'Configuration de l\'assistant (instructions, ton, informations)',
            'Connexion de vos comptes (Facebook, Instagram, WhatsApp, courriel)',
            'Tests complets avant la mise en service',
            'Formation de 30 minutes à votre portail'
        ],
        setupIncludesEn: [
            'Assistant setup (instructions, tone, information)',
            'Connection of your accounts (Facebook, Instagram, WhatsApp, email)',
            'Full testing before going live',
            '30-minute training on your portal'
        ],
        validityDays: 30,
        contactEmail: ''
    },
    stripe: {}
};

// Amounts in Stripe texts, French Canadian format (0,15 $)
const frMoney = (n) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(Number(n || 0));
const cents = (dollars) => Math.round(Number(dollars || 0) * 100);
const nowIso = () => new Date().toISOString();
const requireStripe = () => { if (!stripe) throw new Error('Stripe n\'est pas configuré sur le serveur (STRIPE_SECRET_KEY).'); };

// ---------- Catalog ----------

async function getCatalog() {
    const snap = await CATALOG_REF().get();
    if (!snap.exists) return { ...DEFAULT_CATALOG, isDefault: true };
    const c = snap.data();
    return { ...DEFAULT_CATALOG, ...c, base: { ...DEFAULT_CATALOG.base, ...c.base }, setupFee: { ...DEFAULT_CATALOG.setupFee, ...c.setupFee }, overage: { ...DEFAULT_CATALOG.overage, ...c.overage }, minuteOverage: { ...DEFAULT_CATALOG.minuteOverage, ...c.minuteOverage }, presentation: { ...DEFAULT_CATALOG.presentation, ...(c.presentation || {}) }, stripe: c[STRIPE_FIELD] || {} };
}

/** Lines typed in a textarea (or an array) → trimmed non-empty lines. */
const toLines = (v, max = 12) => (Array.isArray(v) ? v : String(v || '').split('\n')).map(s => String(s).trim().replace(/^[-•·✓*]\s*/, '').slice(0, 200)).filter(Boolean).slice(0, max);

function cleanPresentation(input, previous) {
    if (!input) return previous;
    const p = { ...previous };
    for (const k of ['includes', 'includesEn', 'setupIncludes', 'setupIncludesEn']) if (k in input) p[k] = toLines(input[k]);
    if ('validityDays' in input) p.validityDays = Math.min(365, Math.max(1, Math.round(Number(input.validityDays) || 30)));
    if ('contactEmail' in input) {
        const e = String(input.contactEmail || '').trim();
        if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Courriel de contact invalide.');
        p.contactEmail = e;
    }
    return p;
}

function cleanCatalog(input, previous) {
    const num = (v, min = 0) => Math.max(min, Number(v) || 0);
    const str = (v, max = 300) => String(v || '').trim().slice(0, max);
    const options = (Array.isArray(input.options) ? input.options : []).map(o => ({
        key: str(o.key, 40).toLowerCase().replace(/[^a-z0-9_]/g, '_') || `opt_${Math.random().toString(36).slice(2, 7)}`,
        name: str(o.name, 120), description: str(o.description), nameEn: str(o.nameEn, 120), descriptionEn: str(o.descriptionEn),
        monthly: num(o.monthly), extraConversations: Math.round(num(o.extraConversations)), includedMinutes: Math.round(num(o.includedMinutes))
    })).filter(o => o.name);
    if (new Set(options.map(o => o.key)).size !== options.length) throw new Error('Deux options ont la même clé.');
    return {
        currency: 'cad',
        automaticTax: !!input.automaticTax,
        base: { name: str(input.base?.name, 120) || DEFAULT_CATALOG.base.name, description: str(input.base?.description), nameEn: str(input.base?.nameEn, 120), descriptionEn: str(input.base?.descriptionEn), monthly: num(input.base?.monthly), includedConversations: Math.round(num(input.base?.includedConversations)) },
        setupFee: { name: str(input.setupFee?.name, 120) || DEFAULT_CATALOG.setupFee.name, description: str(input.setupFee?.description), amount: num(input.setupFee?.amount) },
        overage: { name: str(input.overage?.name, 120) || DEFAULT_CATALOG.overage.name, unitPrice: num(input.overage?.unitPrice) },
        minuteOverage: { name: str(input.minuteOverage?.name, 120) || DEFAULT_CATALOG.minuteOverage.name, unitPrice: input.minuteOverage?.unitPrice == null ? (previous.minuteOverage?.unitPrice ?? DEFAULT_CATALOG.minuteOverage.unitPrice) : num(input.minuteOverage.unitPrice) },
        options,
        presentation: cleanPresentation(input.presentation, previous.presentation || DEFAULT_CATALOG.presentation),
        [STRIPE_FIELD]: previous.stripe || {}
    };
}

async function saveCatalog(input, user) {
    const previous = await getCatalog();
    const data = cleanCatalog(input, previous);
    // merge: the other Stripe mode's ids (stripe / stripeTest) are kept
    await CATALOG_REF().set({ ...data, updatedAt: nowIso(), updatedBy: user?.email || null }, { merge: true });
    return getCatalog();
}

/** Creates / updates Stripe products and prices for the offer. Prices are immutable: a changed amount gets a new price. */
async function syncCatalog() {
    requireStripe();
    const cat = await getCatalog();
    const ids = { ...(cat.stripe || {}) };
    ids.options = { ...(ids.options || {}) };

    if (!ids.meterId) {
        const existing = (await stripe.billing.meters.list({ limit: 100 })).data.find(m => m.event_name === METER_EVENT && m.status === 'active');
        ids.meterId = existing?.id || (await stripe.billing.meters.create({
            display_name: 'Conversations IA supplémentaires',
            event_name: METER_EVENT,
            default_aggregation: { formula: 'sum' },
            customer_mapping: { type: 'by_id', event_payload_key: 'stripe_customer_id' },
            value_settings: { event_payload_key: 'value' }
        })).id;
    }

    if (!ids.voiceMeterId) {
        const existing = (await stripe.billing.meters.list({ limit: 100 })).data.find(m => m.event_name === VOICE_METER_EVENT && m.status === 'active');
        ids.voiceMeterId = existing?.id || (await stripe.billing.meters.create({
            display_name: 'Minutes d\'appel supplémentaires',
            event_name: VOICE_METER_EVENT,
            default_aggregation: { formula: 'sum' },
            customer_mapping: { type: 'by_id', event_payload_key: 'stripe_customer_id' },
            value_settings: { event_payload_key: 'value' }
        })).id;
    }

    const upsertProduct = async (current, { name, description, key }) => {
        if (current) {
            await stripe.products.update(current, { name, description: description || undefined, active: true });
            return current;
        }
        return (await stripe.products.create({ name, description: description || undefined, metadata: { quasar_item: key } })).id;
    };
    const upsertPrice = async (current, productId, params, sameAs) => {
        if (current) {
            const p = await stripe.prices.retrieve(current);
            if (p.active && p.product === productId && sameAs(p)) return current;
            await stripe.prices.update(current, { active: false }).catch(() => { });
        }
        return (await stripe.prices.create({ product: productId, currency: cat.currency, ...params })).id;
    };
    const monthlyPrice = (amount) => ({
        params: { unit_amount: cents(amount), recurring: { interval: 'month' }, tax_behavior: 'exclusive' },
        same: (p) => p.unit_amount === cents(amount) && p.recurring?.interval === 'month' && p.recurring?.usage_type !== 'metered'
    });

    ids.baseProduct = await upsertProduct(ids.baseProduct, { ...cat.base, key: 'base' });
    const b = monthlyPrice(cat.base.monthly);
    ids.basePrice = await upsertPrice(ids.basePrice, ids.baseProduct, b.params, b.same);

    if (cat.setupFee.amount > 0) {
        ids.setupProduct = await upsertProduct(ids.setupProduct, { ...cat.setupFee, key: 'setup' });
        ids.setupPrice = await upsertPrice(ids.setupPrice, ids.setupProduct,
            { unit_amount: cents(cat.setupFee.amount), tax_behavior: 'exclusive' },
            (p) => p.unit_amount === cents(cat.setupFee.amount) && !p.recurring);
    }

    ids.overageProduct = await upsertProduct(ids.overageProduct, { name: cat.overage.name, description: `${frMoney(cat.overage.unitPrice)} par conversation au-delà du quota mensuel.`, key: 'overage' });
    const unitDecimal = String(Math.round(cat.overage.unitPrice * 100 * 10000) / 10000);
    ids.overagePrice = await upsertPrice(ids.overagePrice, ids.overageProduct,
        { unit_amount_decimal: unitDecimal, recurring: { interval: 'month', usage_type: 'metered', meter: ids.meterId }, tax_behavior: 'exclusive' },
        (p) => p.unit_amount_decimal === unitDecimal && p.recurring?.usage_type === 'metered' && p.recurring?.meter === ids.meterId);

    ids.minuteProduct = await upsertProduct(ids.minuteProduct, { name: cat.minuteOverage.name, description: `${frMoney(cat.minuteOverage.unitPrice)} par minute au-delà des minutes incluses.`, key: 'voice_minutes' });
    const minuteDecimal = String(Math.round(cat.minuteOverage.unitPrice * 100 * 10000) / 10000);
    ids.minutePrice = await upsertPrice(ids.minutePrice, ids.minuteProduct,
        { unit_amount_decimal: minuteDecimal, recurring: { interval: 'month', usage_type: 'metered', meter: ids.voiceMeterId }, tax_behavior: 'exclusive' },
        (p) => p.unit_amount_decimal === minuteDecimal && p.recurring?.usage_type === 'metered' && p.recurring?.meter === ids.voiceMeterId);

    for (const o of cat.options) {
        const cur = ids.options[o.key] || {};
        const product = await upsertProduct(cur.product, { ...o, key: `option_${o.key}` });
        const m = monthlyPrice(o.monthly);
        ids.options[o.key] = { product, price: await upsertPrice(cur.price, product, m.params, m.same) };
    }

    await CATALOG_REF().set({ [STRIPE_FIELD]: ids, [STRIPE_TEST_MODE ? 'syncedTestAt' : 'syncedAt']: nowIso() }, { merge: true });
    return getCatalog();
}

// ---------- Project subscription ----------

async function getProject(projectId) {
    const snap = await db.collection('ai_projects').doc(projectId).get();
    if (!snap.exists) throw new Error('Projet introuvable.');
    return { id: snap.id, ...withMode(snap.data()) };
}

async function clientEmailFor(project) {
    if (project.clientEmail) return project.clientEmail;
    if (project.clientId) {
        const c = await db.collection('clients').doc(project.clientId).get().catch(() => null);
        if (c?.exists) return c.data().email || null;
    }
    return null;
}

async function ensureCustomer(project, fallbackEmail) {
    if (project.billing?.customerId) return project.billing.customerId;
    const email = (await clientEmailFor(project)) || fallbackEmail || undefined;
    const customer = await stripe.customers.create({
        email, name: project.clientName || project.name || undefined,
        metadata: { projectId: project.id, source: 'quasar_ai_agents' }
    });
    await db.collection('ai_projects').doc(project.id).set({ [BILLING_FIELD]: { customerId: customer.id } }, { merge: true });
    return customer.id;
}

const periodOf = (sub) => {
    const item = sub?.items?.data?.[0] || {};
    const start = item.current_period_start || sub?.current_period_start;
    const end = item.current_period_end || sub?.current_period_end;
    return { start: start ? new Date(start * 1000).toISOString() : null, end: end ? new Date(end * 1000).toISOString() : null };
};

/** Finds the project's live subscription in Stripe and mirrors the essentials on the project. */
async function syncProjectSubscription(project, catalog) {
    requireStripe();
    let sub = null;
    if (project.billing?.subscriptionId) {
        sub = await stripe.subscriptions.retrieve(project.billing.subscriptionId, { expand: ['items.data.price'] }).catch(() => null);
    }
    if (!sub || sub.status === 'incomplete_expired') {
        const found = await stripe.subscriptions.search({ query: `metadata['projectId']:'${project.id}'`, limit: 10, expand: ['data.items.data.price'] }).catch(() => ({ data: [] }));
        sub = found.data.filter(s => s.status !== 'incomplete_expired').sort((a, b) => b.created - a.created)[0] || null;
    }
    const optionByPrice = new Map(Object.entries(catalog.stripe?.options || {}).map(([k, v]) => [v.price, k]));
    const optionByProduct = new Map(Object.entries(catalog.stripe?.options || {}).map(([k, v]) => [v.product, k]));
    const options = sub ? sub.items.data.map(i => optionByPrice.get(i.price.id) || optionByProduct.get(i.price.product)).filter(Boolean) : [];
    const period = periodOf(sub);
    const billing = {
        customerId: sub?.customer || project.billing?.customerId || null,
        subscriptionId: sub?.id || null,
        status: sub?.status || null,
        options,
        periodStart: period.start,
        periodEnd: period.end,
        cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
        syncedAt: nowIso()
    };
    await db.collection('ai_projects').doc(project.id).set({ [BILLING_FIELD]: billing }, { merge: true });
    return { sub, billing };
}

// ---------- Per-client offer ----------
// ai_projects/{id}.billingOffer: the client's own offer, derived from the catalog then customised.
//   options[].mode: 'included' (always billed, price can be 0) | 'optional' (client may add) | 'hidden'

const OPTION_MODES = ['included', 'optional', 'hidden'];
const newId = () => require('crypto').randomBytes(12).toString('hex');

function defaultOffer(catalog) {
    return {
        base: { name: catalog.base.name, description: catalog.base.description, monthly: catalog.base.monthly, includedConversations: catalog.base.includedConversations },
        setupFee: catalog.setupFee.amount,
        overageUnitPrice: catalog.overage.unitPrice,
        minuteOverageUnitPrice: catalog.minuteOverage.unitPrice,
        options: catalog.options.map(o => ({ key: o.key, name: o.name, description: o.description, monthly: o.monthly, extraConversations: o.extraConversations || 0, includedMinutes: o.includedMinutes || 0, mode: 'optional' })),
        customItems: [],
        discount: { percent: 0, months: 0 },
        note: '',
        // Proposal page: empty lists fall back to the catalog defaults in the page language
        clientCompany: '', senderName: '', contactEmail: '', validUntil: '', includes: [], setupIncludes: [],
        isDefault: true
    };
}

function cleanOffer(input, catalog) {
    const num = (v) => Math.max(0, Number(v) || 0);
    const str = (v, max = 300) => String(v || '').trim().slice(0, max);
    const known = new Set(catalog.options.map(o => o.key));
    return {
        base: { name: str(input.base?.name, 120) || catalog.base.name, description: str(input.base?.description, 500), monthly: num(input.base?.monthly), includedConversations: Math.round(num(input.base?.includedConversations)) },
        setupFee: num(input.setupFee),
        overageUnitPrice: num(input.overageUnitPrice),
        minuteOverageUnitPrice: input.minuteOverageUnitPrice == null ? catalog.minuteOverage.unitPrice : num(input.minuteOverageUnitPrice),
        options: (Array.isArray(input.options) ? input.options : []).filter(o => known.has(o.key)).map(o => ({
            key: o.key, name: str(o.name, 120), description: str(o.description), monthly: num(o.monthly),
            extraConversations: Math.round(num(o.extraConversations)),
            includedMinutes: Math.round(num(o.includedMinutes ?? catalog.options.find(c => c.key === o.key)?.includedMinutes)),
            mode: OPTION_MODES.includes(o.mode) ? o.mode : 'optional'
        })),
        customItems: (Array.isArray(input.customItems) ? input.customItems : []).map(i => ({
            id: str(i.id, 30) || newId().slice(0, 8), name: str(i.name, 120), description: str(i.description), amount: num(i.amount),
            type: i.type === 'once' ? 'once' : 'monthly'
        })).filter(i => i.name),
        discount: { percent: Math.min(100, num(input.discount?.percent)), months: Math.round(num(input.discount?.months)) },
        note: str(input.note, 1000),
        clientCompany: str(input.clientCompany, 120),
        senderName: str(input.senderName, 120),
        contactEmail: (() => { const e = str(input.contactEmail, 200); if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Courriel de contact invalide.'); return e; })(),
        validUntil: /^\d{4}-\d{2}-\d{2}$/.test(String(input.validUntil || '')) ? input.validUntil : '',
        includes: toLines(input.includes),
        setupIncludes: toLines(input.setupIncludes)
    };
}

const offerOf = (project, catalog) => {
    if (!project.billingOffer) return defaultOffer(catalog);
    const o = { ...defaultOffer(catalog), ...project.billingOffer, isDefault: false };
    // Offers saved before phone minutes existed: take the missing values from the catalog
    if (o.minuteOverageUnitPrice == null) o.minuteOverageUnitPrice = catalog.minuteOverage.unitPrice;
    o.options = (o.options || []).map(x => x.includedMinutes == null ? { ...x, includedMinutes: catalog.options.find(c => c.key === x.key)?.includedMinutes || 0 } : x);
    return o;
};

async function saveOffer(projectId, input, user) {
    const [project, catalog] = await Promise.all([getProject(projectId), getCatalog()]);
    const offer = cleanOffer(input, catalog);
    // Validity: given date, else today + the catalog's validity days
    if (!offer.validUntil) offer.validUntil = new Date(Date.now() + (catalog.presentation?.validityDays || 30) * 86400e3).toISOString().slice(0, 10);
    const proposalId = project.billingOffer?.proposalId || newId();
    // update() replaces the whole field: removed options / items do not linger
    await db.collection('ai_projects').doc(projectId).update({
        billingOffer: { ...offer, proposalId, ...(project.billingOffer?.coupon ? { coupon: project.billingOffer.coupon } : {}), updatedAt: nowIso(), updatedBy: user?.email || null }
    });
    return offerOf((await getProject(projectId)), catalog);
}

/** Options billed on top of the base: 'included' ones + the 'optional' ones chosen. */
const activeOptions = (offer, chosen = []) => offer.options.filter(o => o.mode === 'included' || (o.mode === 'optional' && chosen.includes(o.key)));
const includedFor = (offer, options) => (offer.base.includedConversations || 0)
    + offer.options.filter(o => options.includes(o.key) || o.mode === 'included').reduce((n, o) => n + (o.extraConversations || 0), 0);
/** Phone minutes included per month: options with minutes that are included or chosen. */
const includedMinutesFor = (offer, options) => offer.options.filter(o => o.mode !== 'hidden' && (o.mode === 'included' || options.includes(o.key))).reduce((n, o) => n + (o.includedMinutes || 0), 0);
/** The offer contains a voice option the client has or can add. */
const offersVoice = (offer) => offer.options.some(o => o.mode !== 'hidden' && (o.includedMinutes || 0) > 0);
const monthlyFor = (offer, options) => (offer.base.monthly || 0)
    + offer.options.filter(o => o.mode !== 'hidden' && (o.mode === 'included' || options.includes(o.key))).reduce((n, o) => n + o.monthly, 0)
    + offer.customItems.filter(i => i.type === 'monthly').reduce((n, i) => n + i.amount, 0);

const periodKeyOf = (billing) => billing?.periodStart ? billing.periodStart.slice(0, 10) : new Date().toISOString().slice(0, 7);

/** What the client (or the public proposal page) may see of an offer. */
const publicOffer = (offer) => ({
    base: offer.base, setupFee: offer.setupFee, overageUnitPrice: offer.overageUnitPrice, minuteOverageUnitPrice: offer.minuteOverageUnitPrice,
    options: offer.options.filter(o => o.mode !== 'hidden').map(({ key, name, description, monthly, extraConversations, includedMinutes, mode }) => ({ key, name, description, monthly, extraConversations, includedMinutes: includedMinutes || 0, mode })),
    customItems: offer.customItems, discount: offer.discount, note: offer.note
});

async function projectSummary(projectId, { staff = false } = {}) {
    const [project, catalog] = await Promise.all([getProject(projectId), getCatalog()]);
    const offer = offerOf(project, catalog);
    const base = {
        stripe: !!stripe, ready: !!catalog.stripe?.baseProduct,
        offer: staff ? offer : publicOffer(offer),
        ...(staff ? { proposalUrl: project.billingOffer?.proposalId ? `${PUBLIC_BASE}/offer.html?p=${project.billingOffer.proposalId}` : null, presentationDefaults: catalog.presentation } : {})
    };
    if (!stripe) return { ...base, subscription: null, usage: null, invoices: [] };

    const { sub, billing } = await syncProjectSubscription(project, catalog);
    const usageSnap = await db.collection('ai_projects').doc(projectId).collection('billing_usage').doc(periodKeyOf(billing)).get();
    const used = usageSnap.exists ? usageSnap.data().conversations || 0 : 0;
    const minutesUsed = usageSnap.exists ? usageSnap.data().voiceMinutes || 0 : 0;
    const minutesIncluded = includedMinutesFor(offer, billing.options);
    const minutesOver = Math.max(0, minutesUsed - minutesIncluded);
    const included = includedFor(offer, billing.options);
    const overage = Math.max(0, used - included);

    let invoices = [];
    let upcoming = null;
    let monthly = null;
    if (billing.customerId) {
        const list = await stripe.invoices.list({ customer: billing.customerId, limit: 12 }).catch(() => ({ data: [] }));
        invoices = list.data.filter(i => i.status !== 'draft').map(i => ({
            number: i.number, date: new Date(i.created * 1000).toISOString(), total: i.total / 100, currency: i.currency,
            status: i.status, url: i.hosted_invoice_url, pdf: i.invoice_pdf
        }));
        if (sub && ['active', 'trialing', 'past_due'].includes(sub.status)) {
            // Monthly amount = licensed (non-metered) items of the live subscription
            monthly = sub.items.data.filter(i => i.price.recurring?.usage_type !== 'metered').reduce((n, i) => n + (i.price.unit_amount || 0) * (i.quantity || 1), 0) / 100;
            try {
                const preview = stripe.invoices.createPreview
                    ? await stripe.invoices.createPreview({ customer: billing.customerId, subscription: sub.id })
                    : await stripe.invoices.retrieveUpcoming({ customer: billing.customerId, subscription: sub.id });
                upcoming = { total: preview.total / 100, date: preview.next_payment_attempt ? new Date(preview.next_payment_attempt * 1000).toISOString() : billing.periodEnd };
            } catch (_) { /* no upcoming invoice */ }
        }
    }
    return {
        ...base,
        subscription: sub ? {
            status: billing.status, options: billing.options, periodStart: billing.periodStart, periodEnd: billing.periodEnd,
            cancelAtPeriodEnd: billing.cancelAtPeriodEnd, monthly: monthly ?? monthlyFor(offer, billing.options)
        } : null,
        usage: {
            used, included, overage, overageEstimate: Math.round(overage * offer.overageUnitPrice * 100) / 100, periodKey: periodKeyOf(billing),
            voice: (minutesIncluded > 0 || minutesUsed > 0) ? { used: minutesUsed, included: minutesIncluded, overage: minutesOver, overageEstimate: Math.round(minutesOver * offer.minuteOverageUnitPrice * 100) / 100 } : null
        },
        upcoming,
        invoices
    };
}

/** Metered overage price for a unit amount (shared by every client with the same price). */
async function overagePriceFor(catalog, unitPrice) {
    const decimal = String(Math.round(unitPrice * 100 * 10000) / 10000);
    const ids = catalog.stripe || {};
    const cache = { ...(ids.overagePrices || {}) };
    if (cache[decimal]) return cache[decimal];
    const price = await stripe.prices.create({
        product: ids.overageProduct, currency: catalog.currency, unit_amount_decimal: decimal,
        recurring: { interval: 'month', usage_type: 'metered', meter: ids.meterId }, tax_behavior: 'exclusive'
    });
    cache[decimal] = price.id;
    await CATALOG_REF().set({ [STRIPE_FIELD]: { overagePrices: cache } }, { merge: true });
    return price.id;
}

/** Metered per-minute price for a unit amount (voice overage). */
async function minutePriceFor(catalog, unitPrice) {
    const decimal = String(Math.round(unitPrice * 100 * 10000) / 10000);
    const ids = catalog.stripe || {};
    if (!ids.minuteProduct || !ids.voiceMeterId) throw new Error('Le catalogue doit être republié dans Stripe (minutes d\'appel).');
    const cache = { ...(ids.minutePrices || {}) };
    if (cache[decimal]) return cache[decimal];
    const price = await stripe.prices.create({
        product: ids.minuteProduct, currency: catalog.currency, unit_amount_decimal: decimal,
        recurring: { interval: 'month', usage_type: 'metered', meter: ids.voiceMeterId }, tax_behavior: 'exclusive'
    });
    cache[decimal] = price.id;
    await CATALOG_REF().set({ [STRIPE_FIELD]: { minutePrices: cache } }, { merge: true });
    return price.id;
}

async function couponFor(projectId, offer) {
    const { percent, months } = offer.discount || {};
    if (!percent) return null;
    const key = `${percent}_${months}${STRIPE_TEST_MODE ? '_test' : ''}`; // a test coupon is never reused in live
    if (offer.coupon?.key === key) return offer.coupon.id;
    const coupon = await stripe.coupons.create({
        percent_off: percent, duration: months ? 'repeating' : 'forever', ...(months ? { duration_in_months: months } : {}),
        name: months ? `-${percent} % (${months} mois)` : `-${percent} %`, metadata: { projectId }
    });
    await db.collection('ai_projects').doc(projectId).set({ billingOffer: { coupon: { key, id: coupon.id } } }, { merge: true });
    return coupon.id;
}

async function createCheckout(projectId, { options = [], withSetup = true, returnTo, user, termsAcceptedAt = null }) {
    requireStripe();
    const [project, catalog] = await Promise.all([getProject(projectId), getCatalog()]);
    const ids = catalog.stripe || {};
    if (!ids.baseProduct || !ids.meterId) throw new Error('Le catalogue n\'est pas encore publié dans Stripe : publiez-le dans l\'ERP (onglet Forfait).');
    const offer = offerOf(project, catalog);
    const { sub } = await syncProjectSubscription(project, catalog);
    if (sub && ['active', 'trialing', 'past_due', 'unpaid'].includes(sub.status)) throw new Error('Ce projet a déjà un abonnement actif.');

    const customer = await ensureCustomer(project, user?.email);
    const recurring = { interval: 'month' };
    const line = (product, amount, rec = true) => ({ price_data: { currency: catalog.currency, product, unit_amount: cents(amount), ...(rec ? { recurring } : {}), tax_behavior: 'exclusive' }, quantity: 1 });
    const lineNamed = (name, description, amount, rec = true) => ({ price_data: { currency: catalog.currency, product_data: { name, ...(description ? { description } : {}), metadata: { projectId } }, unit_amount: cents(amount), ...(rec ? { recurring } : {}), tax_behavior: 'exclusive' }, quantity: 1 });

    const line_items = [
        offer.base.name === catalog.base.name ? line(ids.baseProduct, offer.base.monthly) : lineNamed(offer.base.name, offer.base.description, offer.base.monthly),
        ...activeOptions(offer, options).filter(o => ids.options?.[o.key]?.product).map(o => line(ids.options[o.key].product, o.monthly)),
        ...offer.customItems.map(i => lineNamed(i.name, i.description, i.amount, i.type === 'monthly')),
        { price: await overagePriceFor(catalog, offer.overageUnitPrice) },
        // Per-minute voice overage, whenever the offer has a voice option (nothing is charged without usage)
        ...(offersVoice(offer) ? [{ price: await minutePriceFor(catalog, offer.minuteOverageUnitPrice) }] : []),
        ...(withSetup && offer.setupFee > 0 ? [ids.setupProduct ? line(ids.setupProduct, offer.setupFee, false) : lineNamed(catalog.setupFee.name, '', offer.setupFee, false)] : [])
    ];
    const coupon = await couponFor(projectId, offer);
    const back = returnTo && allowedReturn(returnTo) ? returnTo.split('#')[0] : `${PUBLIC_BASE}/portal.html`;
    const sep = back.includes('?') ? '&' : '?';
    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer,
        line_items,
        subscription_data: { metadata: { projectId, source: 'quasar_ai_agents', ...(termsAcceptedAt ? { termsAcceptedAt } : {}) } },
        metadata: { projectId, type: 'ai_agent_subscription' },
        automatic_tax: { enabled: !!catalog.automaticTax },
        ...(catalog.automaticTax ? { customer_update: { address: 'auto' } } : {}),
        billing_address_collection: 'required',
        ...(coupon ? { discounts: [{ coupon }] } : { allow_promotion_codes: true }),
        locale: 'auto',
        success_url: `${back}${sep}billing=success`,
        cancel_url: `${back}${sep}billing=cancelled`
    });
    return { url: session.url };
}

async function setOption(projectId, key, enabled) {
    requireStripe();
    const [project, catalog] = await Promise.all([getProject(projectId), getCatalog()]);
    const offer = offerOf(project, catalog);
    const opt = offer.options.find(o => o.key === key && o.mode === 'optional');
    const product = catalog.stripe?.options?.[key]?.product;
    if (!opt || !product) throw new Error('Cette option n\'est pas proposée dans votre offre.');
    const { sub } = await syncProjectSubscription(project, catalog);
    if (!sub || !['active', 'trialing', 'past_due'].includes(sub.status)) throw new Error('Aucun abonnement actif pour ce projet.');
    const item = sub.items.data.find(i => i.price.product === product);
    if (enabled === !!item) return { changed: false };
    const addItem = { price_data: { currency: catalog.currency, product, unit_amount: cents(opt.monthly), recurring: { interval: 'month' }, tax_behavior: 'exclusive' }, quantity: 1 };
    // Turning voice on for a subscription that has no per-minute item yet: add it too
    const needsMinutes = enabled && (opt.includedMinutes || 0) > 0 && !sub.items.data.some(i => i.price.recurring?.meter && i.price.recurring.meter === catalog.stripe?.voiceMeterId);
    await stripe.subscriptions.update(sub.id, {
        items: enabled
            ? [addItem, ...(needsMinutes ? [{ price: await minutePriceFor(catalog, offer.minuteOverageUnitPrice) }] : [])]
            : [{ id: item.id, deleted: true }],
        proration_behavior: 'create_prorations'
    });
    await syncProjectSubscription(project, catalog);
    return { changed: true };
}

async function portalSession(projectId, returnTo) {
    requireStripe();
    const project = await getProject(projectId);
    const customer = project.billing?.customerId;
    if (!customer) throw new Error('Aucun compte de facturation pour ce projet.');
    const back = returnTo && allowedReturn(returnTo) ? returnTo : `${PUBLIC_BASE}/portal.html`;
    const s = await stripe.billingPortal.sessions.create({ customer, return_url: back });
    return { url: s.url };
}

// ---------- Public: price list for the website, proposal page ----------

async function publicCatalog() {
    const c = await getCatalog();
    return {
        currency: c.currency,
        base: { name: c.base.name, description: c.base.description, nameEn: c.base.nameEn || '', descriptionEn: c.base.descriptionEn || '', monthly: c.base.monthly, includedConversations: c.base.includedConversations },
        setupFee: c.setupFee.amount, overageUnitPrice: c.overage.unitPrice, minuteOverageUnitPrice: c.minuteOverage.unitPrice,
        options: c.options.map(({ key, name, description, nameEn, descriptionEn, monthly, extraConversations, includedMinutes }) => ({ key, name, description, nameEn: nameEn || '', descriptionEn: descriptionEn || '', monthly, extraConversations, includedMinutes: includedMinutes || 0 }))
    };
}

async function projectByProposal(proposalId) {
    if (!/^[a-f0-9]{24}$/.test(String(proposalId || ''))) throw new Error('Proposition introuvable.');
    const snap = await db.collection('ai_projects').where('billingOffer.proposalId', '==', proposalId).limit(1).get();
    if (snap.empty) throw new Error('Proposition introuvable ou expirée.');
    return { id: snap.docs[0].id, ...withMode(snap.docs[0].data()) };
}

const proposalExpired = (offer) => !!offer.validUntil && offer.validUntil < new Date().toISOString().slice(0, 10);

async function proposal(proposalId) {
    const project = await projectByProposal(proposalId);
    const catalog = await getCatalog();
    const subscribed = ['active', 'trialing', 'past_due'].includes(project.billing?.status);
    const offer = offerOf(project, catalog);
    const pres = catalog.presentation || DEFAULT_CATALOG.presentation;
    return {
        projectName: project.name || '',
        // The client's business name: set in the offer, else the CRM name without our "(…)" notes
        clientName: offer.clientCompany || String(project.clientName || project.name || '').replace(/\s*\([^)]*\)\s*$/, ''),
        number: `Q-${proposalId.slice(0, 6).toUpperCase()}`,
        date: project.billingOffer?.updatedAt || null,
        validUntil: offer.validUntil || null,
        expired: proposalExpired(offer),
        sender: { name: offer.senderName || '', email: offer.contactEmail || pres.contactEmail || project.billingOffer?.updatedBy || '' },
        includes: offer.includes?.length ? { fr: offer.includes, en: offer.includes } : { fr: pres.includes, en: pres.includesEn },
        setupIncludes: offer.setupIncludes?.length ? { fr: offer.setupIncludes, en: offer.setupIncludes } : { fr: pres.setupIncludes, en: pres.setupIncludesEn },
        offer: withEnglishNames(publicOffer(offer), catalog),
        subscribed
    };
}

/** English names for the proposal page in English, when the plan / add-on still uses the price list text. */
function withEnglishNames(pub, catalog) {
    const en = (item, ref) => ({
        ...item,
        ...(ref && item.name === ref.name && ref.nameEn ? { nameEn: ref.nameEn } : {}),
        ...(ref && item.description === ref.description && ref.descriptionEn ? { descriptionEn: ref.descriptionEn } : {})
    });
    return { ...pub, base: en(pub.base, catalog.base), options: pub.options.map(o => en(o, catalog.options.find(c => c.key === o.key))) };
}

// ---------- Usage (called by the Messaging Platform after each AI reply) ----------

/**
 * Counts an "AI conversation": one contact with at least one AI reply in the billing period.
 * Past the included quota, each new conversation is reported to the Stripe meter (overage).
 */
async function recordAiConversation(projectId, convId) {
    try {
        const projectRef = db.collection('ai_projects').doc(projectId);
        const project = withMode((await projectRef.get()).data() || {});
        let billing = project.billing || {};
        // New billing period started since the last sync: refresh it so usage restarts at 0
        if (stripe && billing.subscriptionId && billing.periodEnd && Date.now() > Date.parse(billing.periodEnd)) {
            billing = (await syncProjectSubscription({ id: projectId, ...project }, await getCatalog())).billing;
        }
        const periodKey = periodKeyOf(billing);
        const convRef = projectRef.collection('mp_conversations').doc(convId);
        const usageRef = projectRef.collection('billing_usage').doc(periodKey);

        const count = await db.runTransaction(async (tx) => {
            const [conv, usage] = await Promise.all([tx.get(convRef), tx.get(usageRef)]);
            if (conv.exists && conv.data().aiCountedPeriod === periodKey) return null;
            const n = (usage.exists ? usage.data().conversations || 0 : 0) + 1;
            tx.set(usageRef, { conversations: n, updatedAt: nowIso() }, { merge: true });
            tx.set(convRef, { aiCountedPeriod: periodKey }, { merge: true });
            return n;
        });
        if (!count || !stripe || !billing.customerId || !['active', 'trialing', 'past_due'].includes(billing.status)) return;

        const offer = offerOf({ id: projectId, ...project }, await getCatalog());
        if (count <= includedFor(offer, billing.options || [])) return;
        await stripe.billing.meterEvents.create({
            event_name: METER_EVENT,
            identifier: `${projectId}_${convId}_${periodKey}`,
            payload: { stripe_customer_id: billing.customerId, value: '1' }
        });
        await usageRef.set({ overage: FieldValue.increment(1) }, { merge: true });
    } catch (e) {
        console.warn('[Billing] Usage not recorded:', e.message);
    }
}

/**
 * Phone minutes of one call (rounded up), counted once per call. Past the included minutes of the
 * client's offer, the extra minutes go to the Stripe voice meter.
 */
async function recordVoiceMinutes(projectId, callId, seconds) {
    try {
        const minutes = Math.max(1, Math.ceil(Number(seconds) / 60));
        const projectRef = db.collection('ai_projects').doc(projectId);
        const project = withMode((await projectRef.get()).data() || {});
        let billing = project.billing || {};
        if (stripe && billing.subscriptionId && billing.periodEnd && Date.now() > Date.parse(billing.periodEnd)) {
            billing = (await syncProjectSubscription({ id: projectId, ...project }, await getCatalog())).billing;
        }
        const periodKey = periodKeyOf(billing);
        const usageRef = projectRef.collection('billing_usage').doc(periodKey);
        const callRef = projectRef.collection('voice_calls').doc(String(callId));
        const totals = await db.runTransaction(async (tx) => {
            const [call, usage] = await Promise.all([tx.get(callRef), tx.get(usageRef)]);
            if (call.exists && call.data().billedPeriod) return null;
            const before = usage.exists ? usage.data().voiceMinutes || 0 : 0;
            tx.set(usageRef, { voiceMinutes: before + minutes, updatedAt: nowIso() }, { merge: true });
            tx.set(callRef, { billedPeriod: periodKey, billedMinutes: minutes }, { merge: true });
            return { before, after: before + minutes };
        });
        if (!totals || !stripe || !billing.customerId || !['active', 'trialing', 'past_due'].includes(billing.status)) return;
        const offer = offerOf({ id: projectId, ...project }, await getCatalog());
        const included = includedMinutesFor(offer, billing.options || []);
        const over = Math.max(0, totals.after - Math.max(included, totals.before));
        if (!over) return;
        await stripe.billing.meterEvents.create({
            event_name: VOICE_METER_EVENT,
            identifier: `${projectId}_${callId}`,
            payload: { stripe_customer_id: billing.customerId, value: String(over) }
        });
        await usageRef.set({ voiceOverageMinutes: FieldValue.increment(over) }, { merge: true });
    } catch (e) {
        console.warn('[Billing] Voice minutes not recorded:', e.message);
    }
}

/**
 * May this project take calls? Projects without a subscription are managed by hand (allowed).
 * A subscribed client needs an active subscription that includes a voice option.
 */
async function voiceStatus(projectId) {
    const project = { id: projectId, ...withMode((await db.collection('ai_projects').doc(projectId).get()).data() || {}) };
    const billing = project.billing || {};
    if (!billing.subscriptionId) return { allowed: true, reason: 'not_subscribed' };
    if (!['active', 'trialing', 'past_due'].includes(billing.status)) return { allowed: false, reason: 'subscription_inactive' };
    const offer = offerOf(project, await getCatalog());
    return includedMinutesFor(offer, billing.options || []) > 0 || (billing.options || []).includes('voice')
        ? { allowed: true }
        : { allowed: false, reason: 'voice_option_off' };
}

// ---------- Router ----------

function mountBilling(app, { verifyToken }) {
    const router = express.Router();
    const isStaff = (req) => req.user?.role !== 'client';
    const staff = (req, res, next) => isStaff(req) ? next() : res.status(403).json({ success: false, error: 'Réservé à l\'administrateur.' });
    const projectAccess = (req, res, next) => (isStaff(req) || req.user?.projectId === req.params.projectId)
        ? next() : res.status(403).json({ success: false, error: 'Accès refusé à ce projet.' });
    const handle = (fn) => async (req, res) => {
        try { res.json({ success: true, ...(await fn(req)) }); }
        catch (e) {
            console.error('[Billing]', e.message);
            res.status(400).json({ success: false, error: e.raw?.message || e.message });
        }
    };

    router.use(express.json());

    // Public (no login): the website price list and the proposal page
    router.get('/public-catalog', (req, res, next) => { res.set('Access-Control-Allow-Origin', '*'); res.set('Cache-Control', 'public, max-age=300'); next(); }, handle(async () => ({ catalog: await publicCatalog() })));
    router.get('/proposals/:proposalId', handle(async (req) => proposal(req.params.proposalId)));
    router.post('/proposals/:proposalId/checkout', handle(async (req) => {
        const project = await projectByProposal(req.params.proposalId);
        if (proposalExpired(offerOf(project, await getCatalog()))) throw new Error('Cette proposition a expiré. Contactez Solutions Quasar pour la renouveler. / This proposal has expired. Contact Solutions Quasar to renew it.');
        if (req.body?.acceptTerms !== true) throw new Error('Veuillez accepter les conditions d\'utilisation. / Please accept the terms of service.');
        return createCheckout(project.id, {
            options: Array.isArray(req.body?.options) ? req.body.options.map(String) : [],
            // Local test page (http://localhost:…) gets the customer back; production always uses the public site
            withSetup: true, returnTo: `${STRIPE_TEST_MODE && LOCAL_ORIGIN.test(req.get('origin') || '') ? req.get('origin') : PUBLIC_BASE}/offer.html?p=${req.params.proposalId}`,
            termsAcceptedAt: new Date().toISOString()
        });
    }));

    // Staff
    router.get('/catalog', verifyToken, staff, handle(async () => ({ catalog: await getCatalog(), stripeConfigured: !!stripe })));
    router.put('/catalog', verifyToken, staff, handle(async (req) => ({ catalog: await saveCatalog(req.body || {}, req.user) })));
    router.post('/catalog/sync', verifyToken, staff, handle(async () => ({ catalog: await syncCatalog() })));
    router.put('/projects/:projectId/offer', verifyToken, staff, handle(async (req) => ({ offer: await saveOffer(req.params.projectId, req.body || {}, req.user) })));
    router.delete('/projects/:projectId/offer', verifyToken, staff, handle(async (req) => {
        await db.collection('ai_projects').doc(req.params.projectId).update({ billingOffer: FieldValue.delete() });
        return {};
    }));

    // Staff + the project's client
    router.get('/projects/:projectId', verifyToken, projectAccess, handle(async (req) => projectSummary(req.params.projectId, { staff: isStaff(req) })));
    router.post('/projects/:projectId/checkout', verifyToken, projectAccess, handle(async (req) => createCheckout(req.params.projectId, {
        options: Array.isArray(req.body?.options) ? req.body.options.map(String) : [],
        withSetup: isStaff(req) ? req.body?.withSetup !== false : true,
        returnTo: req.body?.returnTo, user: req.user
    })));
    router.post('/projects/:projectId/options', verifyToken, projectAccess, handle(async (req) => setOption(req.params.projectId, String(req.body?.key || ''), req.body?.enabled === true)));
    router.post('/projects/:projectId/portal', verifyToken, projectAccess, handle(async (req) => portalSession(req.params.projectId, req.body?.returnTo)));

    app.use('/api/billing', router);
    console.log('[Billing] Routes mounted on /api/billing');
}

module.exports = { mountBilling, recordAiConversation, recordVoiceMinutes, voiceStatus, getCatalog, DEFAULT_CATALOG, STRIPE_TEST_MODE,
    // for local tests
    _syncCatalog: syncCatalog, _createCheckout: createCheckout };
