/**
 * Billing — subscriptions for the AI agent service (one per client project).
 *
 * Offer: a base plan + optional add-ons (monthly), a one-time setup fee, and AI conversations
 * beyond the included quota billed as overage (Stripe Billing Meter, reported by us).
 *
 * Stripe stays the source of truth for subscriptions and invoices; Firestore keeps:
 *   billing_settings/catalog                    the offer (prices, quotas) + Stripe product / price ids
 *   ai_projects/{id}.billing                     { customerId, subscriptionId, status, options, periodStart, periodEnd }
 *   ai_projects/{id}/billing_usage/{periodKey}   { conversations, overage }
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
const CATALOG_REF = () => db.collection('billing_settings').doc('catalog');
const METER_EVENT = 'quasar_ai_conversation';
const PUBLIC_BASE = process.env.PUBLIC_APP_URL || 'https://solutionsquasar.ca';

const DEFAULT_CATALOG = {
    currency: 'cad',
    automaticTax: false,
    base: {
        name: 'Agent IA Quasar',
        description: 'Assistant IA sur vos canaux (Messenger, Instagram, WhatsApp, courriel), boîte de réception unifiée et portail client.',
        monthly: 199,
        includedConversations: 1000
    },
    setupFee: {
        name: 'Installation et configuration',
        description: 'Configuration de l\'assistant, connexion des canaux et mise en route.',
        amount: 499
    },
    overage: {
        name: 'Conversations IA supplémentaires',
        unitPrice: 0.15
    },
    options: [
        { key: 'voice', name: 'Agent vocal (téléphone)', description: 'L\'assistant répond aux appels et prend les messages.', monthly: 149, extraConversations: 0 },
        { key: 'booking', name: 'Prise de rendez-vous', description: 'Réservation automatique dans Google Agenda.', monthly: 49, extraConversations: 0 },
        { key: 'sms', name: 'Numéro texto dédié (SMS)', description: 'Un numéro local pour vos textos, enregistré auprès des opérateurs.', monthly: 29, extraConversations: 0 },
        { key: 'quota', name: '+1 000 conversations IA', description: 'Quota mensuel supplémentaire, à prix réduit.', monthly: 99, extraConversations: 1000 }
    ],
    stripe: {}
};

const cents = (dollars) => Math.round(Number(dollars || 0) * 100);
const nowIso = () => new Date().toISOString();
const requireStripe = () => { if (!stripe) throw new Error('Stripe n\'est pas configuré sur le serveur (STRIPE_SECRET_KEY).'); };

// ---------- Catalog ----------

async function getCatalog() {
    const snap = await CATALOG_REF().get();
    if (!snap.exists) return { ...DEFAULT_CATALOG, isDefault: true };
    const c = snap.data();
    return { ...DEFAULT_CATALOG, ...c, base: { ...DEFAULT_CATALOG.base, ...c.base }, setupFee: { ...DEFAULT_CATALOG.setupFee, ...c.setupFee }, overage: { ...DEFAULT_CATALOG.overage, ...c.overage }, stripe: c.stripe || {} };
}

function cleanCatalog(input, previous) {
    const num = (v, min = 0) => Math.max(min, Number(v) || 0);
    const str = (v, max = 300) => String(v || '').trim().slice(0, max);
    const options = (Array.isArray(input.options) ? input.options : []).map(o => ({
        key: str(o.key, 40).toLowerCase().replace(/[^a-z0-9_]/g, '_') || `opt_${Math.random().toString(36).slice(2, 7)}`,
        name: str(o.name, 120), description: str(o.description), monthly: num(o.monthly), extraConversations: Math.round(num(o.extraConversations))
    })).filter(o => o.name);
    if (new Set(options.map(o => o.key)).size !== options.length) throw new Error('Deux options ont la même clé.');
    return {
        currency: 'cad',
        automaticTax: !!input.automaticTax,
        base: { name: str(input.base?.name, 120) || DEFAULT_CATALOG.base.name, description: str(input.base?.description), monthly: num(input.base?.monthly), includedConversations: Math.round(num(input.base?.includedConversations)) },
        setupFee: { name: str(input.setupFee?.name, 120) || DEFAULT_CATALOG.setupFee.name, description: str(input.setupFee?.description), amount: num(input.setupFee?.amount) },
        overage: { name: str(input.overage?.name, 120) || DEFAULT_CATALOG.overage.name, unitPrice: num(input.overage?.unitPrice) },
        options,
        stripe: previous.stripe || {}
    };
}

async function saveCatalog(input, user) {
    const previous = await getCatalog();
    const data = cleanCatalog(input, previous);
    await CATALOG_REF().set({ ...data, updatedAt: nowIso(), updatedBy: user?.email || null });
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

    ids.overageProduct = await upsertProduct(ids.overageProduct, { name: cat.overage.name, description: `${cat.overage.unitPrice} $ par conversation au-delà du quota mensuel.`, key: 'overage' });
    const unitDecimal = String(Math.round(cat.overage.unitPrice * 100 * 10000) / 10000);
    ids.overagePrice = await upsertPrice(ids.overagePrice, ids.overageProduct,
        { unit_amount_decimal: unitDecimal, recurring: { interval: 'month', usage_type: 'metered', meter: ids.meterId }, tax_behavior: 'exclusive' },
        (p) => p.unit_amount_decimal === unitDecimal && p.recurring?.usage_type === 'metered' && p.recurring?.meter === ids.meterId);

    for (const o of cat.options) {
        const cur = ids.options[o.key] || {};
        const product = await upsertProduct(cur.product, { ...o, key: `option_${o.key}` });
        const m = monthlyPrice(o.monthly);
        ids.options[o.key] = { product, price: await upsertPrice(cur.price, product, m.params, m.same) };
    }

    await CATALOG_REF().set({ stripe: ids, syncedAt: nowIso() }, { merge: true });
    return getCatalog();
}

// ---------- Project subscription ----------

async function getProject(projectId) {
    const snap = await db.collection('ai_projects').doc(projectId).get();
    if (!snap.exists) throw new Error('Projet introuvable.');
    return { id: snap.id, ...snap.data() };
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
    await db.collection('ai_projects').doc(project.id).set({ billing: { customerId: customer.id } }, { merge: true });
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
    await db.collection('ai_projects').doc(project.id).set({ billing }, { merge: true });
    return { sub, billing };
}

const includedFor = (catalog, options) => (catalog.base.includedConversations || 0)
    + catalog.options.filter(o => options.includes(o.key)).reduce((n, o) => n + (o.extraConversations || 0), 0);

const periodKeyOf = (billing) => billing?.periodStart ? billing.periodStart.slice(0, 10) : new Date().toISOString().slice(0, 7);

async function projectSummary(projectId) {
    const [project, catalog] = await Promise.all([getProject(projectId), getCatalog()]);
    const publicCatalog = {
        currency: catalog.currency, base: catalog.base, setupFee: catalog.setupFee, overage: catalog.overage,
        options: catalog.options.map(({ key, name, description, monthly, extraConversations }) => ({ key, name, description, monthly, extraConversations })),
        ready: !!catalog.stripe?.basePrice
    };
    if (!stripe) return { stripe: false, catalog: publicCatalog, subscription: null, usage: null, invoices: [] };

    const { sub, billing } = await syncProjectSubscription(project, catalog);
    const usageSnap = await db.collection('ai_projects').doc(projectId).collection('billing_usage').doc(periodKeyOf(billing)).get();
    const used = usageSnap.exists ? usageSnap.data().conversations || 0 : 0;
    const included = includedFor(catalog, billing.options);
    const overage = Math.max(0, used - included);

    let invoices = [];
    let upcoming = null;
    if (billing.customerId) {
        const list = await stripe.invoices.list({ customer: billing.customerId, limit: 12 }).catch(() => ({ data: [] }));
        invoices = list.data.filter(i => i.status !== 'draft').map(i => ({
            number: i.number, date: new Date(i.created * 1000).toISOString(), total: i.total / 100, currency: i.currency,
            status: i.status, url: i.hosted_invoice_url, pdf: i.invoice_pdf
        }));
        if (sub && ['active', 'trialing', 'past_due'].includes(sub.status)) {
            try {
                const preview = stripe.invoices.createPreview
                    ? await stripe.invoices.createPreview({ customer: billing.customerId, subscription: sub.id })
                    : await stripe.invoices.retrieveUpcoming({ customer: billing.customerId, subscription: sub.id });
                upcoming = { total: preview.total / 100, date: preview.next_payment_attempt ? new Date(preview.next_payment_attempt * 1000).toISOString() : billing.periodEnd };
            } catch (_) { /* no upcoming invoice */ }
        }
    }

    return {
        stripe: true,
        catalog: publicCatalog,
        subscription: sub ? {
            status: billing.status, options: billing.options, periodStart: billing.periodStart, periodEnd: billing.periodEnd,
            cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
            monthly: (catalog.base.monthly || 0) + catalog.options.filter(o => billing.options.includes(o.key)).reduce((n, o) => n + o.monthly, 0)
        } : null,
        usage: { used, included, overage, overageEstimate: Math.round(overage * catalog.overage.unitPrice * 100) / 100, periodKey: periodKeyOf(billing) },
        upcoming,
        invoices
    };
}

async function createCheckout(projectId, { options = [], withSetup = true, returnTo, user }) {
    requireStripe();
    const [project, catalog] = await Promise.all([getProject(projectId), getCatalog()]);
    const ids = catalog.stripe || {};
    if (!ids.basePrice || !ids.overagePrice) throw new Error('Le forfait n\'est pas encore publié dans Stripe : synchronisez le catalogue dans l\'ERP.');
    const { sub } = await syncProjectSubscription(project, catalog);
    if (sub && ['active', 'trialing', 'past_due', 'unpaid'].includes(sub.status)) throw new Error('Ce projet a déjà un abonnement actif.');

    const customer = await ensureCustomer(project, user?.email);
    const chosen = catalog.options.filter(o => options.includes(o.key) && ids.options?.[o.key]?.price);
    const line_items = [
        { price: ids.basePrice, quantity: 1 },
        ...chosen.map(o => ({ price: ids.options[o.key].price, quantity: 1 })),
        { price: ids.overagePrice },
        ...(withSetup && ids.setupPrice && catalog.setupFee.amount > 0 ? [{ price: ids.setupPrice, quantity: 1 }] : [])
    ];
    const back = returnTo && /^https:\/\/(www\.)?(solutionsquasar\.ca|quasar-erp-b26d5\.(web|firebaseapp)\.app)\//.test(returnTo)
        ? returnTo.split('?')[0].split('#')[0] : `${PUBLIC_BASE}/portal.html`;
    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer,
        line_items,
        subscription_data: { metadata: { projectId, source: 'quasar_ai_agents' } },
        metadata: { projectId, type: 'ai_agent_subscription' },
        automatic_tax: { enabled: !!catalog.automaticTax },
        ...(catalog.automaticTax ? { customer_update: { address: 'auto' } } : {}),
        billing_address_collection: 'required',
        allow_promotion_codes: true,
        locale: 'auto',
        success_url: `${back}?billing=success`,
        cancel_url: `${back}?billing=cancelled`
    });
    return { url: session.url };
}

async function setOption(projectId, key, enabled) {
    requireStripe();
    const [project, catalog] = await Promise.all([getProject(projectId), getCatalog()]);
    const price = catalog.stripe?.options?.[key]?.price;
    if (!price) throw new Error('Option inconnue ou non publiée.');
    const { sub } = await syncProjectSubscription(project, catalog);
    if (!sub || !['active', 'trialing', 'past_due'].includes(sub.status)) throw new Error('Aucun abonnement actif pour ce projet.');
    const item = sub.items.data.find(i => i.price.id === price || i.price.product === catalog.stripe.options[key].product);
    if (enabled && item) return { changed: false };
    if (!enabled && !item) return { changed: false };
    await stripe.subscriptions.update(sub.id, {
        items: enabled ? [{ price, quantity: 1 }] : [{ id: item.id, deleted: true }],
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
    const back = returnTo && /^https:\/\/(www\.)?(solutionsquasar\.ca|quasar-erp-b26d5\.(web|firebaseapp)\.app)\//.test(returnTo) ? returnTo : `${PUBLIC_BASE}/portal.html`;
    const s = await stripe.billingPortal.sessions.create({ customer, return_url: back });
    return { url: s.url };
}

// ---------- Usage (called by the Messaging Platform after each AI reply) ----------

/**
 * Counts an "AI conversation": one contact with at least one AI reply in the billing period.
 * Past the included quota, each new conversation is reported to the Stripe meter (overage).
 */
async function recordAiConversation(projectId, convId) {
    try {
        const projectRef = db.collection('ai_projects').doc(projectId);
        const project = (await projectRef.get()).data() || {};
        let billing = project.billing || {};
        // New billing period started since the last sync: refresh it so usage restarts at 0
        if (stripe && billing.subscriptionId && billing.periodEnd && Date.now() > Date.parse(billing.periodEnd)) {
            billing = (await syncProjectSubscription({ id: projectId, ...project }, await getCatalog())).billing;
        }
        const periodKey = periodKeyOf(billing);
        const convRef = projectRef.collection('mp_conversations').doc(convId);
        const usageRef = projectRef.collection('billing_usage').doc(periodKey);

        const result = await db.runTransaction(async (tx) => {
            const [conv, usage] = await Promise.all([tx.get(convRef), tx.get(usageRef)]);
            if (conv.exists && conv.data().aiCountedPeriod === periodKey) return null;
            const count = (usage.exists ? usage.data().conversations || 0 : 0) + 1;
            tx.set(usageRef, { conversations: count, updatedAt: nowIso() }, { merge: true });
            tx.set(convRef, { aiCountedPeriod: periodKey }, { merge: true });
            return count;
        });
        if (!result || !stripe || !billing.customerId || !['active', 'trialing', 'past_due'].includes(billing.status)) return;

        const catalog = await getCatalog();
        if (result <= includedFor(catalog, billing.options || [])) return;
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
    router.get('/catalog', verifyToken, staff, handle(async () => ({ catalog: await getCatalog(), stripeConfigured: !!stripe })));
    router.put('/catalog', verifyToken, staff, handle(async (req) => ({ catalog: await saveCatalog(req.body || {}, req.user) })));
    router.post('/catalog/sync', verifyToken, staff, handle(async () => ({ catalog: await syncCatalog() })));
    router.get('/projects/:projectId', verifyToken, projectAccess, handle(async (req) => projectSummary(req.params.projectId)));
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

module.exports = { mountBilling, recordAiConversation, getCatalog, DEFAULT_CATALOG };
