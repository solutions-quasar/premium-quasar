/**
 * Billing UI — the client's subscription (portal "Subscription" tab and ERP project "Plan" tab)
 * and the offer editor (ERP staff). Talks to /api/billing (erp/backend/billing).
 */
import { tip, bindTips } from './mp_help.js';

const isEn = () => { if (window.MP_LANG) return window.MP_LANG !== 'fr'; try { return (localStorage.getItem('erp_lang') || 'en') !== 'fr'; } catch (_) { return true; } };
const L = (fr, en) => (isEn() ? en : fr);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => new Intl.NumberFormat(isEn() ? 'en-CA' : 'fr-CA', { style: 'currency', currency: 'CAD' }).format(Number(n || 0));
const date = (iso) => iso ? new Date(iso).toLocaleDateString(isEn() ? 'en-CA' : 'fr-CA', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

export const STYLES = `
.bl { display:flex; flex-direction:column; gap:14px; max-width:860px; }
.bl-card { background:var(--bg-card, #121418); border:1px solid var(--border, #2d3139); border-radius:16px; padding:16px; }
.bl-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.bl-title { font-weight:700; font-size:1.05rem; }
.bl-dim { color:var(--text-dim, var(--text-muted, #94a3b8)); font-size:.82rem; line-height:1.45; }
.bl-big { font-size:1.6rem; font-weight:800; }
.bl-chip { font-size:.72rem; padding:2px 10px; border-radius:20px; border:1px solid; white-space:nowrap; font-weight:700; }
.bl-chip.ok { color:#3ecf8e; border-color:#3ecf8e66; background:#3ecf8e14; }
.bl-chip.warn { color:#f5a524; border-color:#f5a52466; background:#f5a52414; }
.bl-chip.err { color:#ef4444; border-color:#ef444466; background:#ef444414; }
.bl-chip.off { color:var(--text-dim, #94a3b8); border-color:var(--border, #2d3139); }
.bl-btn { border:0; border-radius:12px; padding:0 16px; min-height:46px; font-weight:700; font-size:.9rem; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:8px; background:var(--gold, #dfa53a); color:#000; }
.bl-btn.ghost { background:transparent; color:inherit; border:1px solid var(--border, #2d3139); }
.bl-btn:disabled { opacity:.5; cursor:not-allowed; }
.bl-bar { height:12px; border-radius:8px; background:rgba(255,255,255,.07); overflow:hidden; }
.bl-bar > div { height:100%; border-radius:8px; }
.bl-opt { display:flex; align-items:center; gap:12px; padding:12px 0; border-top:1px solid var(--border, #2d3139); }
.bl-opt:first-child { border-top:0; }
.bl-switch { position:relative; width:44px; height:26px; flex-shrink:0; display:inline-block; }
.bl-switch input { opacity:0; width:0; height:0; }
.bl-switch span { position:absolute; inset:0; background:#444; border-radius:26px; cursor:pointer; transition:.2s; }
.bl-switch span::before { content:''; position:absolute; width:20px; height:20px; left:3px; top:3px; background:#fff; border-radius:50%; transition:.2s; }
.bl-switch input:checked + span { background:#3ecf8e; }
.bl-switch input:checked + span::before { transform:translateX(18px); }
.bl-switch input:disabled + span { opacity:.45; cursor:not-allowed; }
.bl-inv { display:flex; align-items:center; gap:10px; padding:10px 0; border-top:1px solid var(--border, #2d3139); font-size:.85rem; flex-wrap:wrap; }
.bl-inv:first-child { border-top:0; }
.bl-note { padding:10px 12px; border-radius:10px; font-size:.82rem; }
.bl-note.ok { background:#3ecf8e14; border:1px solid #3ecf8e55; }
.bl-note.err { background:#ef444414; border:1px solid #ef444455; }
.bl-note.info { background:rgba(223,165,58,.08); border:1px solid rgba(223,165,58,.3); }
.bl-total { display:flex; justify-content:space-between; gap:10px; font-size:.9rem; padding:4px 0; }
.bl-input { background:var(--bg-dark, #0d0f12); border:1px solid var(--border, #2d3139); color:inherit; border-radius:10px; padding:10px 12px; font-size:.9rem; width:100%; box-sizing:border-box; font-family:inherit; }
.bl-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:10px; }
.bl-field { display:flex; flex-direction:column; gap:4px; font-size:.78rem; font-weight:600; }
@media (max-width: 600px) { .bl-btn { width:100%; } .bl-big { font-size:1.4rem; } }
.bo-sum { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:14px; align-items:center; }
.bo-sum .k { font-size:.75rem; color:var(--text-dim, #94a3b8); margin-bottom:4px; }
.bo-sum .v { font-size:1.5rem; font-weight:800; letter-spacing:-.5px; }
.bo-sum .v small { font-size:.75rem; font-weight:600; color:var(--text-dim, #94a3b8); letter-spacing:0; }
.bo-sec { display:flex; align-items:flex-start; gap:12px; margin-bottom:14px; }
.bo-ic { width:36px; height:36px; border-radius:10px; background:rgba(223,165,58,.1); color:var(--gold, #dfa53a); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.bo-ic .material-icons { font-size:1.2rem; }
.bo-h { font-weight:700; font-size:1rem; }
.bo-sub { font-size:.8rem; color:var(--text-dim, #94a3b8); margin-top:2px; }
.bo-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:12px; }
.bo-f { display:flex; flex-direction:column; gap:5px; font-size:.75rem; font-weight:600; color:var(--text-dim, #94a3b8); }
.bo-f .bl-input, .bo-opt .bl-input { color:var(--text-main, #fff); }
.bo-u { display:flex; align-items:center; gap:8px; }
.bo-u .bl-input { max-width:120px; font-weight:700; color:var(--text-main, #fff); }
.bo-u span { font-size:.8rem; color:var(--text-dim, #94a3b8); white-space:nowrap; font-weight:500; }
.bo-opt { display:flex; align-items:center; gap:12px; padding:12px 0; border-top:1px solid var(--border, #2d3139); flex-wrap:wrap; }
.bo-opt:first-child { border-top:0; padding-top:0; }
.bo-opt.off .bo-on { opacity:.45; }
.bo-on { display:flex; align-items:center; gap:12px; flex:1; min-width:200px; }
.bo-seg { display:inline-flex; border:1px solid var(--border, #2d3139); border-radius:10px; overflow:hidden; }
.bo-seg label { padding:7px 12px; font-size:.78rem; font-weight:600; cursor:pointer; color:var(--text-dim, #94a3b8); border-left:1px solid var(--border, #2d3139); }
.bo-seg label:first-child { border-left:0; }
.bo-seg input { display:none; }
.bo-seg label.on { background:rgba(223,165,58,.15); color:var(--gold, #dfa53a); }
.bo-seg label.on.hid { background:rgba(255,255,255,.06); color:var(--text-main, #fff); }
.bo-bar { position:sticky; bottom:0; z-index:5; display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:12px 16px; border:1px solid var(--border, #2d3139); border-radius:14px; background:var(--bg-card, #121418); }
.bo-bar .msg { flex:1; font-size:.8rem; color:var(--text-dim, #94a3b8); min-width:160px; }
.bo-bar .msg.dirty { color:#f5a524; }
.bc-head { display:flex; align-items:center; gap:12px; cursor:pointer; }
@media (max-width: 600px) { .bo-seg label { padding:7px 9px; } .bo-u .bl-input { max-width:none; } }
`;

function api(apiBase, getToken) {
    return async (path, { method = 'GET', body } = {}) => {
        const token = getToken ? await getToken() : null;
        const res = await fetch(`${apiBase}/api/billing${path}`, {
            method,
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    };
}

const STATUS = () => ({
    active: ['ok', L('Actif', 'Active')],
    trialing: ['ok', L('Essai', 'Trial')],
    past_due: ['err', L('Paiement en retard', 'Payment past due')],
    unpaid: ['err', L('Impayé', 'Unpaid')],
    incomplete: ['warn', L('Paiement à finaliser', 'Payment pending')],
    canceled: ['off', L('Annulé', 'Canceled')],
    paused: ['off', L('En pause', 'Paused')]
});

// ---------- Offer view (client portal, proposal page, staff preview) ----------

/** Monthly total, one-time total and included conversations for an offer + chosen optional add-ons. */
function totals(offer, chosen) {
    const opts = offer.options.filter(o => o.mode === 'included' || (o.mode === 'optional' && chosen.has(o.key)));
    const monthly = offer.base.monthly + opts.reduce((n, o) => n + o.monthly, 0) + offer.customItems.filter(i => i.type === 'monthly').reduce((n, i) => n + i.amount, 0);
    const once = offer.setupFee + offer.customItems.filter(i => i.type === 'once').reduce((n, i) => n + i.amount, 0);
    const included = offer.base.includedConversations + opts.reduce((n, o) => n + (o.extraConversations || 0), 0);
    const minutes = opts.reduce((n, o) => n + (o.includedMinutes || 0), 0);
    const pct = offer.discount?.percent || 0;
    // Stripe applies the coupon to the whole first invoice (subscription + one-time fees)
    const off = (n) => Math.round(n * (100 - pct)) / 100;
    return { monthly, once, included, minutes, pct, discounted: off(monthly), first: off(monthly + once) };
}

function offerHtml(offer, chosen, { cta, staffExtra = '' } = {}) {
    const t = totals(offer, chosen);
    const d = offer.discount || {};
    const discountLabel = d.percent ? (d.months ? L(`-${d.percent} % pendant ${d.months} mois`, `-${d.percent}% for ${d.months} months`) : L(`-${d.percent} % en permanence`, `-${d.percent}% ongoing`)) : '';
    const included = offer.options.filter(o => o.mode === 'included');
    const optional = offer.options.filter(o => o.mode === 'optional');
    // "300 phone minutes included, then $0.40/min" under any option that includes minutes
    const minutesLine = (o) => o.includedMinutes ? `<br><span class="bl-dim">${L(`${o.includedMinutes} minutes d'appel incluses / mois, puis ${money(offer.minuteOverageUnitPrice ?? 0)} la minute`, `${o.includedMinutes} call minutes included / month, then ${money(offer.minuteOverageUnitPrice ?? 0)} per minute`)}</span>` : '';
    return `
        ${offer.note ? `<div class="bl-note info" style="white-space:pre-wrap;">${esc(offer.note)}</div>` : ''}
        <div class="bl-card">
            <div class="bl-row" data-tip-host><div class="bl-title" style="flex:1;">${esc(offer.base.name)}</div>${tip(L(`Votre forfait inclut ${t.included} conversations IA par mois. Une conversation IA = un client à qui l'assistant a répondu pendant le mois, quel que soit le nombre de messages. Au-delà, chaque conversation coûte ${money(offer.overageUnitPrice)}.`, `Your plan includes ${t.included} AI conversations per month. One AI conversation = one customer the assistant replied to during the month, whatever the number of messages. Beyond that, each conversation costs ${money(offer.overageUnitPrice)}.`))}</div>
            ${offer.base.description ? `<div class="bl-dim" style="margin-top:4px;">${esc(offer.base.description)}</div>` : ''}
            <div style="margin-top:10px;"><span class="bl-big">${money(offer.base.monthly)}</span> <span class="bl-dim">/ ${L('mois', 'month')}</span></div>
            <div class="bl-dim">${L(`${offer.base.includedConversations} conversations IA incluses, puis ${money(offer.overageUnitPrice)} par conversation`, `${offer.base.includedConversations} AI conversations included, then ${money(offer.overageUnitPrice)} per conversation`)}</div>
            ${included.length || offer.customItems.length ? `<div style="margin-top:12px;">${[
                ...included.map(o => `<div class="bl-total"><span>✓ ${esc(o.name)}${minutesLine(o)}</span><strong>${o.monthly ? `+${money(o.monthly)}` : L('Inclus', 'Included')}</strong></div>`),
                ...offer.customItems.map(i => `<div class="bl-total"><span>✓ ${esc(i.name)}${i.description ? `<br><span class="bl-dim">${esc(i.description)}</span>` : ''}</span><strong style="white-space:nowrap;">${money(i.amount)}${i.type === 'monthly' ? `/${L('mois', 'mo')}` : ` (${L('une fois', 'once')})`}</strong></div>`)
            ].join('')}</div>` : ''}
        </div>
        ${optional.length ? `
        <div class="bl-card">
            <div class="bl-title" style="margin-bottom:6px;">${L('Options', 'Add-ons')}</div>
            ${optional.map(o => `
                <label class="bl-opt" style="cursor:pointer;">
                    <span class="bl-switch"><input type="checkbox" data-pick="${esc(o.key)}" ${chosen.has(o.key) ? 'checked' : ''}><span></span></span>
                    <span style="flex:1; min-width:0;"><strong>${esc(o.name)}</strong><br><span class="bl-dim">${esc(o.description)}</span>${minutesLine(o)}</span>
                    <strong style="white-space:nowrap;">+${money(o.monthly)}</strong>
                </label>`).join('')}
        </div>` : ''}
        <div class="bl-card">
            ${staffExtra}
            <div class="bl-total"><span>${L('Abonnement mensuel', 'Monthly subscription')}</span><strong>${money(t.monthly)}</strong></div>
            ${t.pct ? `<div class="bl-total" style="color:#3ecf8e;"><span>${L('Remise', 'Discount')} (${discountLabel})</span><strong>${money(t.discounted)}</strong></div>` : ''}
            ${t.once ? `<div class="bl-total"><span>${L('Frais uniques (installation…)', 'One-time fees (setup…)')}</span><strong>${money(t.once)}</strong></div>` : ''}
            <div class="bl-total" style="border-top:1px solid var(--border, #2d3139); margin-top:6px; padding-top:10px;"><span>${L('Premier paiement', 'First payment')}${t.pct && t.once ? ` <span class="bl-dim">(${L('remise incluse', 'discount included')})</span>` : ''}</span><strong>${money(t.first)} <span class="bl-dim">+ ${L('taxes', 'taxes')}</span></strong></div>
            <div class="bl-dim" style="margin:6px 0 12px;">${L('Paiement sécurisé par Stripe. Résiliable en tout temps, sans frais.', 'Secure payment by Stripe. Cancel anytime, no fees.')}</div>
            <div class="bl-row">${cta}</div>
        </div>`;
}

/**
 * Subscription of one project (portal "Subscription" tab, ERP "Plan" tab).
 * @param {{ projectId, apiBase, getToken, isStaff }} opts
 */
export function renderProjectBilling(container, opts) {
    const call = api(opts.apiBase, opts.getToken);
    const state = { data: null, picked: new Set(), withSetup: true, editing: false };

    const params = new URLSearchParams(window.location.search);
    const back = params.get('billing');
    if (back) {
        params.delete('billing');
        const q = params.toString();
        window.history.replaceState(null, '', `${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`);
    }

    container.innerHTML = `<style>${STYLES}</style><div class="bl"><div id="bl-notice"></div><div id="bl-body" class="bl-dim">${L('Chargement…', 'Loading…')}</div></div>`;
    bindTips(container);
    const notice = (type, html) => { container.querySelector('#bl-notice').innerHTML = html ? `<div class="bl-note ${type}">${html}</div>` : ''; };
    if (back === 'success') notice('ok', L('Merci ! Votre abonnement est activé. La confirmation de paiement peut prendre quelques secondes.', 'Thank you! Your subscription is active. The payment confirmation can take a few seconds.'));
    if (back === 'cancelled') notice('info', L('Paiement annulé : aucun montant n\'a été prélevé.', 'Payment cancelled: nothing was charged.'));

    async function load() {
        try {
            state.data = await call(`/projects/${opts.projectId}`);
            render();
        } catch (e) {
            container.querySelector('#bl-body').innerHTML = `<div class="bl-note err">${esc(e.message)}</div>`;
        }
    }

    function render() {
        const d = state.data;
        const body = container.querySelector('#bl-body');
        body.className = '';
        if (!d.stripe) { body.innerHTML = `<div class="bl-note info">${L('La facturation n\'est pas encore activée.', 'Billing is not set up yet.')}</div>`; return; }
        const subscribed = d.subscription && d.subscription.status !== 'canceled';
        if (opts.isStaff && state.editing) { renderOfferEditor(body, d); return; }
        body.innerHTML = (opts.isStaff ? staffBar(d, subscribed) : '') + (subscribed ? subscribedView(d) : notSubscribedView(d));
        bind(d);
    }

    function staffBar(d, subscribed) {
        return `
            <div class="bl-card" style="border-color:rgba(223,165,58,.4);">
                <div class="bl-row" data-tip-host>
                    <div style="flex:1; min-width:200px;"><div class="bl-title">${L('Offre de ce client', 'This client\'s offer')}</div>
                        <div class="bl-dim">${d.offer.isDefault ? L('Basée sur la grille publique. Personnalisez-la pour ce client.', 'Based on the public price list. Customise it for this client.') : L(`Personnalisée${d.offer.updatedAt ? ` le ${date(d.offer.updatedAt)}` : ''}.`, `Customised${d.offer.updatedAt ? ` on ${date(d.offer.updatedAt)}` : ''}.`)}${subscribed ? ` ${L('Les changements s\'appliquent aux nouveaux paiements, pas à l\'abonnement en cours.', 'Changes apply to new checkouts, not to the current subscription.')}` : ''}</div></div>
                    ${tip(L('1. Personnalisez l\'offre (prix, quota, options incluses, lignes sur mesure, remise). 2. Copiez le lien de proposition et envoyez-le au client : il voit son offre et paie en ligne. Il la voit aussi dans son portail, onglet Subscription.', '1. Customise the offer (prices, quota, included add-ons, custom lines, discount). 2. Copy the proposal link and send it to the client: they see their offer and pay online. They also see it in their portal, Subscription tab.'))}
                </div>
                <div class="bl-row" style="margin-top:12px;">
                    <button class="bl-btn" id="bl-edit"><span class="material-icons">tune</span> ${L('Personnaliser l\'offre', 'Customise the offer')}</button>
                    ${!subscribed ? `<button class="bl-btn ghost" id="bl-link"><span class="material-icons">link</span> ${L('Copier le lien de proposition', 'Copy the proposal link')}</button>` : ''}
                </div>
            </div>`;
    }

    function notSubscribedView(d) {
        if (!d.ready) return `<div class="bl-card"><div class="bl-title">${L('Abonnement', 'Subscription')}</div><div class="bl-dim" style="margin-top:6px;">${L('L\'offre n\'est pas encore publiée.', 'The offer is not published yet.')} ${opts.isStaff ? L('Publiez la grille ci-dessous dans Stripe.', 'Publish the price list below to Stripe.') : L('Contactez l\'équipe Quasar.', 'Contact the Quasar team.')}</div></div>`;
        const staffExtra = opts.isStaff ? `<label class="bl-row" style="cursor:pointer; margin-bottom:10px;"><span class="bl-switch"><input type="checkbox" id="bl-setup" ${state.withSetup ? 'checked' : ''}><span></span></span><span>${L('Inclure les frais uniques', 'Include the one-time fees')}</span></label>` : '';
        const offer = state.withSetup ? d.offer : { ...d.offer, setupFee: 0, customItems: d.offer.customItems.filter(i => i.type === 'monthly') };
        return offerHtml(offer, state.picked, {
            staffExtra,
            cta: `<button class="bl-btn" id="bl-subscribe"><span class="material-icons">lock</span> ${opts.isStaff ? L('Ouvrir le paiement', 'Open checkout') : L('S\'abonner', 'Subscribe')}</button>`
        });
    }

    function subscribedView(d) {
        const s = d.subscription, o = d.offer, u = d.usage;
        const [cls, label] = STATUS()[s.status] || ['off', s.status];
        const pct = u.included ? Math.min(100, Math.round(u.used / u.included * 100)) : 0;
        const barColor = u.used > u.included ? '#ef4444' : pct >= 80 ? '#f5a524' : '#3ecf8e';
        const optional = o.options.filter(x => x.mode === 'optional');
        const included = o.options.filter(x => x.mode === 'included');
        return `
            <div class="bl-card">
                <div class="bl-row"><div class="bl-title" style="flex:1;">${esc(o.base.name)}</div><span class="bl-chip ${cls}">${label}</span></div>
                <div style="margin-top:8px;"><span class="bl-big">${money(s.monthly)}</span> <span class="bl-dim">/ ${L('mois', 'month')} + ${L('taxes', 'taxes')}</span></div>
                ${included.length ? `<div class="bl-dim" style="margin-top:6px;">${L('Inclus', 'Included')} : ${included.map(x => esc(x.name)).join(', ')}</div>` : ''}
                ${s.cancelAtPeriodEnd ? `<div class="bl-note info" style="margin-top:10px;">${L(`L'abonnement se termine le ${date(s.periodEnd)}.`, `The subscription ends on ${date(s.periodEnd)}.`)}</div>` : ''}
                ${s.status === 'past_due' || s.status === 'unpaid' ? `<div class="bl-note err" style="margin-top:10px;">${L('Le dernier paiement a échoué. Mettez à jour votre carte pour éviter une interruption du service.', 'The last payment failed. Update your card to avoid a service interruption.')}</div>` : ''}
                ${d.upcoming ? `<div class="bl-dim" style="margin-top:8px;">${L('Prochaine facture', 'Next invoice')} : <strong style="color:var(--text-main,#fff);">${money(d.upcoming.total)}</strong> ${L('le', 'on')} ${date(d.upcoming.date)}</div>` : ''}
                <div class="bl-row" style="margin-top:14px;"><button class="bl-btn" id="bl-portal"><span class="material-icons">credit_card</span> ${L('Paiement, factures et résiliation', 'Payment, invoices and cancellation')}</button></div>
            </div>
            <div class="bl-card">
                <div class="bl-row" data-tip-host><div class="bl-title" style="flex:1;">${L('Utilisation ce mois-ci', 'Usage this month')}</div>${tip(L(`Une conversation IA = un client à qui l'assistant a répondu pendant la période de facturation, peu importe le nombre de messages. Au-delà de ${u.included} conversations, chacune coûte ${money(o.overageUnitPrice)}, ajouté à la facture suivante.`, `One AI conversation = one customer the assistant replied to during the billing period, whatever the number of messages. Beyond ${u.included} conversations, each one costs ${money(o.overageUnitPrice)}, added to the next invoice.`))}</div>
                <div style="margin:10px 0 6px;"><span class="bl-big">${u.used}</span> <span class="bl-dim">/ ${u.included} ${L('conversations IA', 'AI conversations')}</span></div>
                <div class="bl-bar"><div style="width:${pct}%; background:${barColor};"></div></div>
                <div class="bl-dim" style="margin-top:8px;">${s.periodEnd ? `${L('Remise à zéro le', 'Resets on')} ${date(s.periodEnd)}. ` : ''}${u.overage ? `<span style="color:#ef4444; font-weight:600;">${L(`${u.overage} conversations au-delà du quota : environ ${money(u.overageEstimate)} sur la prochaine facture.`, `${u.overage} conversations over the quota: about ${money(u.overageEstimate)} on the next invoice.`)}</span>` : pct >= 80 ? `<span style="color:#f5a524; font-weight:600;">${L('Vous approchez de votre quota.', 'You are close to your quota.')}</span>` : ''}</div>
                ${u.voice ? (() => {
                    const v = u.voice;
                    const vp = v.included ? Math.min(100, Math.round(v.used / v.included * 100)) : 100;
                    const vc = v.used > v.included ? '#ef4444' : vp >= 80 ? '#f5a524' : '#3ecf8e';
                    return `
                        <div class="bl-row" data-tip-host style="margin-top:16px;"><div class="bl-title" style="flex:1; font-size:.95rem;">${L('Minutes d\'appel', 'Call minutes')}</div>${tip(L(`Chaque appel compte à la minute supérieure. Au-delà de ${v.included} minutes, chaque minute coûte ${money(o.minuteOverageUnitPrice ?? 0)}, ajouté à la facture suivante.`, `Each call counts to the next full minute. Beyond ${v.included} minutes, each minute costs ${money(o.minuteOverageUnitPrice ?? 0)}, added to the next invoice.`))}</div>
                        <div style="margin:8px 0 6px;"><span class="bl-big" style="font-size:1.4rem;">${v.used}</span> <span class="bl-dim">/ ${v.included} ${L('minutes', 'minutes')}</span></div>
                        <div class="bl-bar"><div style="width:${vp}%; background:${vc};"></div></div>
                        ${v.overage ? `<div class="bl-dim" style="margin-top:8px;"><span style="color:#ef4444; font-weight:600;">${L(`${v.overage} minutes au-delà : environ ${money(v.overageEstimate)} sur la prochaine facture.`, `${v.overage} minutes over: about ${money(v.overageEstimate)} on the next invoice.`)}</span></div>` : ''}`;
                })() : ''}
            </div>
            ${optional.length ? `
            <div class="bl-card">
                <div class="bl-row" data-tip-host style="margin-bottom:6px;"><div class="bl-title" style="flex:1;">${L('Options', 'Add-ons')}</div>${tip(L('Ajoutez ou retirez une option à tout moment. Le montant est ajusté au prorata sur votre prochaine facture.', 'Add or remove an add-on at any time. The amount is prorated on your next invoice.'))}</div>
                ${optional.map(x => `
                    <div class="bl-opt">
                        <span style="flex:1; min-width:0;"><strong>${esc(x.name)}</strong><br><span class="bl-dim">${esc(x.description)} · ${money(x.monthly)}/${L('mois', 'mo')}${x.includedMinutes ? ` · ${L(`${x.includedMinutes} min incluses`, `${x.includedMinutes} min included`)}` : ''}</span></span>
                        <label class="bl-switch"><input type="checkbox" data-opt="${esc(x.key)}" ${s.options.includes(x.key) ? 'checked' : ''}><span></span></label>
                    </div>`).join('')}
            </div>` : ''}
            <div class="bl-card">
                <div class="bl-title" style="margin-bottom:6px;">${L('Factures', 'Invoices')}</div>
                ${d.invoices.length ? d.invoices.map(i => `
                    <div class="bl-inv">
                        <span style="flex:1; min-width:140px;">${date(i.date)}<br><span class="bl-dim">${esc(i.number || '')}</span></span>
                        <strong>${money(i.total)}</strong>
                        <span class="bl-chip ${i.status === 'paid' ? 'ok' : i.status === 'open' ? 'warn' : 'off'}">${i.status === 'paid' ? L('Payée', 'Paid') : i.status === 'open' ? L('À payer', 'Due') : esc(i.status)}</span>
                        ${i.url ? `<a href="${esc(i.url)}" target="_blank" rel="noopener" class="bl-btn ghost" style="min-height:36px; text-decoration:none;">${L('Voir', 'View')}</a>` : ''}
                    </div>`).join('') : `<div class="bl-dim">${L('Aucune facture pour le moment.', 'No invoice yet.')}</div>`}
            </div>`;
    }

    function bind(d) {
        container.querySelectorAll('[data-pick]').forEach(i => i.addEventListener('change', () => {
            i.checked ? state.picked.add(i.dataset.pick) : state.picked.delete(i.dataset.pick);
            render();
        }));
        container.querySelector('#bl-setup')?.addEventListener('change', (e) => { state.withSetup = e.target.checked; render(); });
        container.querySelector('#bl-edit')?.addEventListener('click', () => { state.editing = true; render(); });
        container.querySelector('#bl-link')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            try {
                let url = d.proposalUrl;
                if (!url) { // first link: save the offer as it is to create the proposal id
                    await call(`/projects/${opts.projectId}/offer`, { method: 'PUT', body: d.offer });
                    url = (await call(`/projects/${opts.projectId}`)).proposalUrl;
                }
                await navigator.clipboard.writeText(url).catch(() => { });
                notice('ok', `${L('Lien de proposition copié. Envoyez-le à votre client :', 'Proposal link copied. Send it to your client:')}<br><a href="${esc(url)}" target="_blank" rel="noopener" style="word-break:break-all; font-size:.78rem; color:var(--gold);">${esc(url)}</a>`);
            } catch (err) { notice('err', esc(err.message)); }
            btn.disabled = false;
        });
        container.querySelector('#bl-subscribe')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            try {
                const { url } = await call(`/projects/${opts.projectId}/checkout`, {
                    method: 'POST',
                    body: { options: [...state.picked], withSetup: state.withSetup, returnTo: `${window.location.origin}${window.location.pathname}` }
                });
                window.location.href = url;
            } catch (err) { notice('err', esc(err.message)); btn.disabled = false; }
        });
        container.querySelector('#bl-portal')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            try {
                const { url } = await call(`/projects/${opts.projectId}/portal`, { method: 'POST', body: { returnTo: `${window.location.origin}${window.location.pathname}` } });
                window.location.href = url;
            } catch (err) { notice('err', esc(err.message)); btn.disabled = false; }
        });
        container.querySelectorAll('[data-opt]').forEach(input => input.addEventListener('change', async () => {
            const o = d.offer.options.find(x => x.key === input.dataset.opt);
            input.disabled = true;
            try {
                await call(`/projects/${opts.projectId}/options`, { method: 'POST', body: { key: o.key, enabled: input.checked } });
                notice('ok', input.checked
                    ? L(`Option « ${esc(o.name)} » ajoutée. Le montant est ajusté au prorata sur la prochaine facture.`, `Add-on "${esc(o.name)}" added. The amount is prorated on the next invoice.`)
                    : L(`Option « ${esc(o.name)} » retirée.`, `Add-on "${esc(o.name)}" removed.`));
                await load();
            } catch (e) { input.checked = !input.checked; input.disabled = false; notice('err', esc(e.message)); }
        }));
    }

    // ----- Staff: edit this client's offer -----
    // Layout: live price summary, then numbered sections (plan, fees, add-ons, custom lines and discount),
    // amounts with their unit next to them, add-ons as rows with an Included / Offered / Hidden switch,
    // and a sticky save bar that shows unsaved changes.
    function renderOfferEditor(body, d) {
        const o = d.offer;
        const subscribed = d.subscription && d.subscription.status !== 'canceled';
        const unit = (name, value, suffix, step = '0.01', extra = '') => `<div class="bo-u"><input class="bl-input" name="${name}" type="number" min="0" step="${step}" value="${esc(value)}" ${extra}><span>${suffix}</span></div>`;
        const fld = (label, inner) => `<label class="bo-f">${label}${inner}</label>`;
        const sec = (n, icon, title, sub, right = '') => `<div class="bo-sec"><div class="bo-ic"><span class="material-icons">${icon}</span></div><div style="flex:1;"><div class="bo-h">${n}. ${title}</div><div class="bo-sub">${sub}</div></div>${right}</div>`;
        const OPT_ICON = { voice: 'call', booking: 'event', sms: 'sms', quota: 'forum' };
        const MODES = () => [['included', L('Incluse', 'Included')], ['optional', L('Proposée', 'Offered')], ['hidden', L('Masquée', 'Hidden')]];
        const seg = (opt) => `<div class="bo-seg" role="radiogroup">${MODES().map(([v, l]) => `<label class="${opt.mode === v ? 'on' : ''} ${v === 'hidden' ? 'hid' : ''}"><input type="radio" name="mode-${esc(opt.key)}" value="${v}" ${opt.mode === v ? 'checked' : ''}>${l}</label>`).join('')}</div>`;
        const itemRow = (i) => `
            <div data-item class="bo-opt">
                <div class="bo-on" style="flex-wrap:wrap;">
                    <span class="material-icons" style="color:var(--text-dim);">add_box</span>
                    <input class="bl-input" name="name" value="${esc(i.name)}" placeholder="${L('ex. Intégration CRM', 'e.g. CRM integration')}" style="flex:1; min-width:160px;">
                    <input class="bl-input" name="description" value="${esc(i.description || '')}" placeholder="${L('Précision (facultatif)', 'Detail (optional)')}" style="flex:1; min-width:160px;">
                </div>
                <div class="bo-u"><input class="bl-input" name="amount" type="number" min="0" step="0.01" value="${esc(i.amount)}" style="max-width:100px;"><span>$</span>
                    <select class="bl-input" name="type" style="max-width:130px;"><option value="monthly" ${i.type === 'monthly' ? 'selected' : ''}>${L('par mois', 'per month')}</option><option value="once" ${i.type === 'once' ? 'selected' : ''}>${L('une fois', 'one time')}</option></select></div>
                <input type="hidden" name="id" value="${esc(i.id || '')}">
                <button type="button" class="bl-btn ghost" data-remove style="min-height:38px; padding:0 10px;" title="${L('Retirer', 'Remove')}"><span class="material-icons">delete_outline</span></button>
            </div>`;
        const statusChip = subscribed ? ['ok', L('Client abonné', 'Client subscribed')] : d.proposalUrl ? ['info', L('Lien de proposition prêt', 'Proposal link ready')] : ['warn', L('Offre pas encore envoyée', 'Offer not sent yet')];

        body.innerHTML = `
            <form id="bo-form" class="bl" style="max-width:none;">
                <div class="bl-card" style="border-color:rgba(223,165,58,.4);">
                    <div class="bl-row" style="margin-bottom:14px;"><div style="flex:1; min-width:200px;"><div class="bl-title">${L('Offre de ce client', 'This client\'s offer')}</div><div class="bl-dim">${L('Seul ce client voit ces conditions. La grille publique ne change pas.', 'Only this client sees these terms. The public price list does not change.')}</div></div>
                        <span class="bl-chip ${statusChip[0] === 'info' ? 'ok' : statusChip[0]}">${statusChip[1]}</span></div>
                    <div class="bo-sum" id="bo-sum"></div>
                    ${subscribed ? `<div class="bl-note info" style="margin-top:12px;">${L('Ce client est déjà abonné : les changements s\'appliquent à un futur paiement, pas à l\'abonnement en cours.', 'This client is already subscribed: changes apply to a future checkout, not to the current subscription.')}</div>` : ''}
                </div>

                <div class="bl-card">
                    ${sec(1, 'inventory_2', L('Forfait de base', 'Base plan'), L('Ce que le client paie chaque mois.', 'What the client pays every month.'))}
                    <div class="bo-grid">
                        ${fld(L('Nom affiché au client', 'Name shown to the client'), `<input class="bl-input" name="base.name" value="${esc(o.base.name)}">`)}
                        ${fld(L('Prix', 'Price'), unit('base.monthly', o.base.monthly, L('$ / mois', '$ / month')))}
                        ${fld(L('Conversations IA incluses', 'AI conversations included'), unit('base.includedConversations', o.base.includedConversations, L('/ mois', '/ month'), '1'))}
                    </div>
                    ${fld(`<span style="margin-top:12px;">${L('Description (affichée sur la proposition)', 'Description (shown on the proposal)')}</span>`, `<textarea class="bl-input" name="base.description" rows="2">${esc(o.base.description)}</textarea>`)}
                </div>

                <div class="bl-card">
                    ${sec(2, 'receipt_long', L('Frais et dépassements', 'Fees and overage'), L('L\'installation, payée une fois, et ce qui est facturé au-delà de ce qui est inclus.', 'Setup, paid once, and what is billed beyond what is included.'))}
                    <div class="bo-grid">
                        ${fld(L('Installation', 'Setup'), unit('setupFee', o.setupFee, L('$ une fois', '$ one time')))}
                        ${fld(L('Conversation en plus', 'Extra conversation'), unit('overageUnitPrice', o.overageUnitPrice, L('$ chacune', '$ each')))}
                        ${fld(L('Minute d\'appel en plus', 'Extra call minute'), unit('minuteOverageUnitPrice', o.minuteOverageUnitPrice ?? 0.4, L('$ / min', '$ / min')))}
                    </div>
                </div>

                <div class="bl-card">
                    ${sec(3, 'extension', L('Options', 'Add-ons'), L('<b>Incluse</b> : toujours facturée (0 $ pour l\'offrir). <b>Proposée</b> : le client la coche s\'il la veut. <b>Masquée</b> : il ne la voit pas.', '<b>Included</b>: always billed ($0 to give it away). <b>Offered</b>: the client ticks it if they want it. <b>Hidden</b>: they don\'t see it.'))}
                    ${o.options.map(opt => `
                        <div data-option="${esc(opt.key)}" class="bo-opt ${opt.mode === 'hidden' ? 'off' : ''}">
                            <div class="bo-on">
                                <span class="material-icons" style="color:var(--text-dim);">${OPT_ICON[opt.key] || 'add_circle_outline'}</span>
                                <div style="flex:1; min-width:140px;"><input class="bl-input" name="name" value="${esc(opt.name)}" style="font-weight:600;">
                                    ${(opt.includedMinutes || opt.key === 'voice') ? `<div class="bo-u" style="margin-top:6px;"><input class="bl-input" name="minutes" type="number" min="0" step="1" value="${esc(opt.includedMinutes || 0)}" style="max-width:90px;"><span>${L('min d\'appel incluses / mois', 'call min included / month')}</span></div>` : `<input type="hidden" name="minutes" value="${esc(opt.includedMinutes || 0)}">`}
                                </div>
                                <div class="bo-u"><input class="bl-input" name="monthly" type="number" min="0" step="0.01" value="${esc(opt.monthly)}" style="max-width:90px;"><span>${L('$ / mois', '$ / mo')}</span></div>
                            </div>
                            ${seg(opt)}
                            <input type="hidden" name="description" value="${esc(opt.description)}"><input type="hidden" name="extra" value="${esc(opt.extraConversations || 0)}">
                        </div>`).join('') || `<div class="bl-dim">${L('Aucune option dans la grille.', 'No add-on in the price list.')}</div>`}
                </div>

                <div class="bl-card">
                    ${sec(4, 'sell', L('Sur mesure et remise', 'Custom lines and discount'), L('Facultatif. Ce qui n\'est pas dans la grille, et un rabais de lancement.', 'Optional. Anything not in the price list, and a launch discount.'), `<button type="button" class="bl-btn ghost" id="bo-add" style="min-height:38px;"><span class="material-icons">add</span> ${L('Ligne sur mesure', 'Custom line')}</button>`)}
                    <div id="bo-items">${o.customItems.map(itemRow).join('')}</div>
                    <div class="bo-grid" style="margin-top:${o.customItems.length ? '14px' : '0'};">
                        ${fld(L('Remise', 'Discount'), `<div class="bo-u"><input class="bl-input" name="discount.percent" type="number" min="0" max="100" step="1" value="${esc(o.discount?.percent || 0)}" style="max-width:80px;"><span>${L('% pendant', '% for')}</span><input class="bl-input" name="discount.months" type="number" min="0" step="1" value="${esc(o.discount?.months || 0)}" style="max-width:70px;"><span>${L('mois (0 = toujours)', 'months (0 = always)')}</span></div>`)}
                    </div>
                </div>

                <div class="bl-card">
                    ${sec(5, 'description', L('Ce que le client voit', 'What the client sees'), L('L\'en-tête, votre message et les listes « Ce qui est inclus » de la page de proposition. Laissez une liste vide pour utiliser celle de la grille.', 'The header, your message and the "What\'s included" lists of the proposal page. Leave a list empty to use the price list one.'))}
                    <div class="bo-grid">
                        ${fld(L('Nom de l\'entreprise du client', 'Client\'s business name'), `<input class="bl-input" name="clientCompany" value="${esc(o.clientCompany || '')}" placeholder="${L('ex. Garage Leblanc', 'e.g. Leblanc Garage')}">`)}
                        ${fld(L('Signé par', 'Signed by'), `<input class="bl-input" name="senderName" value="${esc(o.senderName || '')}" placeholder="${L('ex. Benjamin, Solutions Quasar', 'e.g. Benjamin, Solutions Quasar')}">`)}
                        ${fld(L('Courriel pour les questions', 'Email for questions'), `<input class="bl-input" name="contactEmail" type="email" value="${esc(o.contactEmail || '')}" placeholder="${esc(d.presentationDefaults?.contactEmail || L('votre courriel', 'your email'))}">`)}
                        ${fld(L('Valable jusqu\'au', 'Valid until'), `<input class="bl-input" name="validUntil" type="date" value="${esc(o.validUntil || '')}">`)}
                    </div>
                    ${fld(`<span style="margin-top:12px;">${L('Message personnel (en haut de la proposition)', 'Personal message (top of the proposal)')}</span>`, `<textarea class="bl-input" name="note" rows="3" placeholder="${L('ex. Bonjour Paul, comme convenu lors de notre rencontre, voici l\'offre pour votre garage…', 'e.g. Hi Paul, as discussed in our meeting, here is the offer for your garage…')}">${esc(o.note || '')}</textarea>`)}
                    <div class="bo-grid" style="margin-top:12px;">
                        ${fld(L('Ce qui est inclus (une ligne par point)', 'What\'s included (one line per item)'), `<textarea class="bl-input" name="includes" rows="5" placeholder="${esc((d.presentationDefaults?.includes || []).join('\n'))}">${esc((o.includes || []).join('\n'))}</textarea>`)}
                        ${fld(L('L\'installation comprend (une ligne par point)', 'Setup includes (one line per item)'), `<textarea class="bl-input" name="setupIncludes" rows="5" placeholder="${esc((d.presentationDefaults?.setupIncludes || []).join('\n'))}">${esc((o.setupIncludes || []).join('\n'))}</textarea>`)}
                    </div>
                    <div class="bl-dim" style="margin-top:6px;">${L('Le texte grisé est celui de la grille : il s\'affichera si vous laissez le champ vide.', 'The grey text comes from the price list: it shows if you leave the field empty.')}</div>
                </div>

                <div class="bo-bar">
                    <span class="msg" id="bo-msg">${L('Aucune modification', 'No changes')}</span>
                    ${!o.isDefault ? `<button type="button" class="bl-btn ghost" id="bo-reset" style="min-height:40px;">${L('Revenir à la grille', 'Back to price list')}</button>` : ''}
                    <button type="button" class="bl-btn ghost" id="bo-cancel" style="min-height:40px;">${L('Annuler', 'Cancel')}</button>
                    <button type="submit" class="bl-btn" style="min-height:40px;"><span class="material-icons">save</span> ${L('Enregistrer l\'offre', 'Save the offer')}</button>
                </div>
            </form>`;

        const form = body.querySelector('#bo-form');
        const num = (n) => Number(form.querySelector(`[name="${n}"]`)?.value) || 0;
        // Live summary from what is typed (same rules as the proposal page and Stripe)
        const summary = () => {
            const rows = [...form.querySelectorAll('[data-option]')].map(r => ({ mode: r.querySelector('input[type=radio]:checked')?.value, monthly: Number(r.querySelector('[name=monthly]').value) || 0 }));
            const items = [...form.querySelectorAll('[data-item]')].map(r => ({ amount: Number(r.querySelector('[name=amount]').value) || 0, type: r.querySelector('[name=type]').value }));
            const monthly = num('base.monthly') + rows.filter(r => r.mode === 'included').reduce((n, r) => n + r.monthly, 0) + items.filter(i => i.type === 'monthly').reduce((n, i) => n + i.amount, 0);
            const offered = rows.filter(r => r.mode === 'optional').reduce((n, r) => n + r.monthly, 0);
            const once = num('setupFee') + items.filter(i => i.type === 'once').reduce((n, i) => n + i.amount, 0);
            const pct = Math.min(100, num('discount.percent'));
            const first = Math.round((monthly + once) * (100 - pct)) / 100;
            body.querySelector('#bo-sum').innerHTML = `
                <div><div class="k">${L('Par mois', 'Per month')}</div><div class="v">${money(monthly)}</div>${offered ? `<div class="k" style="margin:4px 0 0;">${L(`+ jusqu'à ${money(offered)} d'options`, `+ up to ${money(offered)} in add-ons`)}</div>` : ''}</div>
                <div><div class="k">${L('Une fois', 'One time')}</div><div class="v">${money(once)}</div></div>
                <div><div class="k">${L('Premier paiement', 'First payment')}</div><div class="v">${money(first)} <small>+ ${L('taxes', 'taxes')}</small></div>${pct ? `<div class="k" style="margin:4px 0 0; color:#3ecf8e;">${L(`remise de ${pct} % incluse`, `${pct}% discount included`)}</div>` : ''}</div>`;
        };
        let dirty = false;
        const changed = () => { if (!dirty) { dirty = true; const m = body.querySelector('#bo-msg'); m.textContent = L('Modifications non enregistrées', 'Unsaved changes'); m.classList.add('dirty'); } summary(); };
        form.addEventListener('input', changed);
        form.addEventListener('change', (e) => {
            if (e.target.type === 'radio') {
                const row = e.target.closest('[data-option]');
                row.querySelectorAll('.bo-seg label').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
                row.classList.toggle('off', e.target.value === 'hidden');
            }
            changed();
        });
        summary();

        body.querySelector('#bo-add').addEventListener('click', () => { body.querySelector('#bo-items').insertAdjacentHTML('beforeend', itemRow({ name: '', amount: 0, type: 'monthly' })); changed(); });
        body.querySelector('#bo-items').addEventListener('click', (e) => { if (e.target.closest('[data-remove]')) { e.target.closest('[data-item]').remove(); changed(); } });
        body.querySelector('#bo-cancel').addEventListener('click', async () => {
            if (dirty && window.erpConfirm && !(await window.erpConfirm(L('Abandonner les modifications ?', 'Discard your changes?')))) return;
            state.editing = false; render();
        });
        body.querySelector('#bo-reset')?.addEventListener('click', async () => {
            try { await call(`/projects/${opts.projectId}/offer`, { method: 'DELETE' }); state.editing = false; notice('ok', L('Offre remise à la grille publique.', 'Offer reset to the public price list.')); load(); }
            catch (e) { notice('err', esc(e.message)); }
        });
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const v = (n) => form.querySelector(`[name="${n}"]`).value;
            const payload = {
                base: { name: v('base.name'), description: v('base.description'), monthly: v('base.monthly'), includedConversations: v('base.includedConversations') },
                setupFee: v('setupFee'), overageUnitPrice: v('overageUnitPrice'), minuteOverageUnitPrice: v('minuteOverageUnitPrice'),
                options: [...form.querySelectorAll('[data-option]')].map(r => ({
                    key: r.dataset.option, name: r.querySelector('[name=name]').value, monthly: r.querySelector('[name=monthly]').value,
                    mode: r.querySelector('input[type=radio]:checked')?.value || 'optional', description: r.querySelector('[name=description]').value,
                    extraConversations: r.querySelector('[name=extra]').value, includedMinutes: r.querySelector('[name=minutes]').value
                })),
                customItems: [...form.querySelectorAll('[data-item]')].map(r => ({
                    id: r.querySelector('[name=id]').value, name: r.querySelector('[name=name]').value, description: r.querySelector('[name=description]').value,
                    amount: r.querySelector('[name=amount]').value, type: r.querySelector('[name=type]').value
                })),
                discount: { percent: v('discount.percent'), months: v('discount.months') },
                note: v('note'),
                clientCompany: v('clientCompany'), senderName: v('senderName'), contactEmail: v('contactEmail'), validUntil: v('validUntil'),
                includes: v('includes'), setupIncludes: v('setupIncludes')
            };
            const btn = e.submitter;
            if (btn) btn.disabled = true;
            try {
                await call(`/projects/${opts.projectId}/offer`, { method: 'PUT', body: payload });
                state.editing = false;
                notice('ok', L('Offre enregistrée. Copiez maintenant le lien de proposition et envoyez-le au client.', 'Offer saved. Now copy the proposal link and send it to the client.'));
                await load();
            } catch (err) { notice('err', esc(err.message)); if (btn) btn.disabled = false; }
        });
    }
    load();
}

const PP_STYLES = `
.pp { max-width:1120px; margin:0 auto; color:var(--text-main, #fff); }
.pp-top { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:22px; }
.pp-eyebrow { font-size:.72rem; letter-spacing:.14em; text-transform:uppercase; color:var(--gold, #dfa53a); font-weight:700; }
.pp-h1 { font-size:clamp(1.6rem, 3.4vw, 2.3rem); font-weight:800; letter-spacing:-.5px; margin:4px 0 0; line-height:1.15; }
.pp-meta { display:flex; gap:8px; flex-wrap:wrap; }
.pp-pill { font-size:.75rem; padding:5px 11px; border-radius:20px; border:1px solid var(--border, #2d3139); color:var(--text-dim, #94a3b8); white-space:nowrap; }
.pp-pill.warn { color:#ef4444; border-color:#ef444466; background:#ef444414; }
.pp-grid { display:grid; grid-template-columns:minmax(0, 1fr) 360px; gap:20px; align-items:start; }
.pp-col { display:flex; flex-direction:column; gap:16px; min-width:0; }
.pp-card { background:var(--bg-card, #121418); border:1px solid var(--border, #2d3139); border-radius:16px; padding:20px; }
.pp-card h3 { font-size:1.05rem; margin:0 0 4px; font-weight:700; }
.pp-dim { color:var(--text-dim, #94a3b8); font-size:.88rem; line-height:1.55; }
.pp-msg { border-color:rgba(223,165,58,.35); background:rgba(223,165,58,.05); }
.pp-msg p { margin:0; white-space:pre-wrap; line-height:1.6; font-size:.95rem; }
.pp-sign { display:flex; align-items:center; gap:10px; margin-top:14px; font-size:.85rem; color:var(--text-dim, #94a3b8); }
.pp-av { width:34px; height:34px; border-radius:50%; background:rgba(223,165,58,.15); color:var(--gold, #dfa53a); display:flex; align-items:center; justify-content:center; font-weight:800; }
.pp-price { font-size:2.2rem; font-weight:800; letter-spacing:-1px; }
.pp-list { list-style:none; padding:0; margin:14px 0 0; display:flex; flex-direction:column; gap:9px; }
.pp-list li { display:flex; gap:10px; align-items:flex-start; font-size:.92rem; line-height:1.45; }
.pp-list .material-icons { color:#3ecf8e; font-size:1.15rem; margin-top:1px; }
.pp-explain { margin-top:14px; padding:12px 14px; border-radius:12px; background:rgba(255,255,255,.04); font-size:.85rem; line-height:1.5; color:var(--text-dim, #94a3b8); }
.pp-explain b { color:var(--text-main, #fff); }
.pp-opt { display:flex; gap:14px; align-items:flex-start; padding:14px 0; border-top:1px solid var(--border, #2d3139); cursor:pointer; }
.pp-opt:first-of-type { border-top:0; padding-top:4px; }
.pp-sum { position:sticky; top:16px; }
.pp-line { display:flex; justify-content:space-between; gap:12px; font-size:.88rem; padding:5px 0; }
.pp-line span:first-child { color:var(--text-dim, #94a3b8); }
.pp-sep { border-top:1px solid var(--border, #2d3139); margin:10px 0; }
.pp-big { display:flex; justify-content:space-between; align-items:baseline; gap:10px; }
.pp-big .v { font-size:1.6rem; font-weight:800; letter-spacing:-.5px; }
.pp-terms { display:flex; gap:10px; align-items:flex-start; font-size:.82rem; line-height:1.45; color:var(--text-dim, #94a3b8); margin:14px 0 12px; cursor:pointer; }
.pp-terms input { width:18px; height:18px; margin-top:1px; accent-color:var(--gold, #dfa53a); flex-shrink:0; }
.pp-terms a, .pp-dim a { color:var(--gold, #dfa53a); }
.pp-q { display:flex; align-items:center; justify-content:center; gap:8px; margin-top:10px; font-size:.85rem; color:var(--text-dim, #94a3b8); text-decoration:none; padding:10px; border-radius:12px; border:1px solid var(--border, #2d3139); }
.pp-q:hover { color:var(--text-main, #fff); border-color:var(--gold, #dfa53a); }
.pp-faq details { border-top:1px solid var(--border, #2d3139); padding:12px 0; }
.pp-faq details:first-of-type { border-top:0; }
.pp-faq summary { cursor:pointer; font-weight:600; font-size:.92rem; list-style:none; display:flex; justify-content:space-between; gap:10px; }
.pp-faq summary::-webkit-details-marker { display:none; }
.pp-faq summary::after { content:'+'; color:var(--gold, #dfa53a); font-weight:800; }
.pp-faq details[open] summary::after { content:'–'; }
.pp-faq p { margin:8px 0 0; }
.pp-bar { display:none; }
@media (max-width: 900px) {
  .pp-grid { grid-template-columns:1fr; }
  .pp-sum { position:static; }
  .pp-bar { display:flex; position:fixed; left:0; right:0; bottom:0; z-index:50; gap:12px; align-items:center; padding:10px 14px calc(10px + env(safe-area-inset-bottom, 0px)); background:rgba(13,15,18,.96); border-top:1px solid var(--border, #2d3139); backdrop-filter:blur(8px); }
  .pp-bar .t { flex:1; font-size:.75rem; color:var(--text-dim, #94a3b8); }
  .pp-bar .t b { display:block; font-size:1.15rem; color:var(--text-main, #fff); }
  .pp { padding-bottom:80px; }
}
`;

/**
 * Public proposal page (offer.html?p=…): the client reads their offer and pays, without an account.
 * Two columns on desktop (offer on the left, summary and payment on the right, kept in view),
 * one column with a fixed bottom bar on phones.
 */
export function renderProposal(container, { apiBase, proposalId }) {
    const call = api(apiBase, null);
    const state = { data: null, picked: new Set(), terms: false, error: '' };
    const params = new URLSearchParams(window.location.search);
    const back = params.get('billing');
    container.innerHTML = `<style>${STYLES}${PP_STYLES}</style><div class="pp"><div id="pp-body" class="pp-dim">${L('Chargement de votre proposition…', 'Loading your proposal…')}</div></div>`;
    const body = () => container.querySelector('#pp-body');
    const day = (iso) => iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString(isEn() ? 'en-CA' : 'fr-CA', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const li = (t) => `<li><span class="material-icons">check_circle</span><span>${esc(t)}</span></li>`;
    const tr = (x, k) => (isEn() && x?.[k + 'En']) ? x[k + 'En'] : (x?.[k] || ''); // English name when the price list has one

    function totals() {
        const o = state.data.offer;
        const chosen = o.options.filter(x => x.mode === 'optional' && state.picked.has(x.key));
        const incl = o.options.filter(x => x.mode === 'included');
        const monthlyItems = o.customItems.filter(i => i.type === 'monthly');
        const onceItems = o.customItems.filter(i => i.type === 'once');
        const monthly = o.base.monthly + incl.reduce((n, x) => n + x.monthly, 0) + chosen.reduce((n, x) => n + x.monthly, 0) + monthlyItems.reduce((n, i) => n + i.amount, 0);
        const once = o.setupFee + onceItems.reduce((n, i) => n + i.amount, 0);
        const pct = o.discount?.percent || 0;
        const off = (n) => Math.round(n * (100 - pct)) / 100;
        return { chosen, incl, monthlyItems, onceItems, monthly, once, pct, months: o.discount?.months || 0, today: off(monthly + once), monthlyDiscounted: off(monthly) };
    }

    function summaryHtml() {
        const d = state.data, o = d.offer, t = totals();
        const line = (label, amount, suffix = '') => `<div class="pp-line"><span>${label}</span><strong>${money(amount)}${suffix}</strong></div>`;
        const thereafter = t.pct ? (t.months === 1 ? t.monthly : t.monthlyDiscounted) : t.monthly;
        return `
            <div class="pp-card pp-sum" id="pp-sum">
                <h3>${L('Récapitulatif', 'Summary')}</h3>
                <div class="pp-dim" style="margin-bottom:8px;">${L('Chaque mois', 'Every month')}</div>
                ${line(esc(tr(o.base, 'name')), o.base.monthly)}
                ${t.incl.map(x => line(esc(tr(x, 'name')), x.monthly)).join('')}
                ${t.chosen.map(x => line(`+ ${esc(tr(x, 'name'))}`, x.monthly)).join('')}
                ${t.monthlyItems.map(i => line(esc(i.name), i.amount)).join('')}
                ${t.pct ? `<div class="pp-line" style="color:#3ecf8e;"><span style="color:#3ecf8e;">${L('Remise', 'Discount')} -${t.pct} %${t.months ? ` ${L(`pendant ${t.months} mois`, `for ${t.months} months`)}` : ''}</span><strong>-${money(t.monthly - t.monthlyDiscounted)}</strong></div>` : ''}
                <div class="pp-big" style="margin-top:4px;"><span class="pp-dim">${L('Ensuite, chaque mois', 'Then, every month')}</span><span style="font-weight:800;">${money(thereafter)}</span></div>
                ${t.pct && t.months > 1 ? `<div class="pp-dim" style="font-size:.75rem;">${L(`puis ${money(t.monthly)} après ${t.months} mois`, `then ${money(t.monthly)} after ${t.months} months`)}</div>` : ''}
                ${t.once ? `<div class="pp-sep"></div><div class="pp-dim" style="margin-bottom:6px;">${L('Une seule fois', 'One time')}</div>${o.setupFee ? line(L('Installation', 'Setup'), o.setupFee) : ''}${t.onceItems.map(i => line(esc(i.name), i.amount)).join('')}` : ''}
                <div class="pp-sep"></div>
                <div class="pp-big"><span style="font-weight:700;">${L('Aujourd\'hui', 'Today')}</span><span class="v">${money(t.today)}</span></div>
                <div class="pp-dim" style="font-size:.75rem; text-align:right;">${L('+ taxes applicables', '+ applicable taxes')}${t.pct && t.once ? ` · ${L('remise incluse', 'discount included')}` : ''}</div>
                ${d.expired ? `<div class="bl-note err" style="margin-top:14px;">${L('Cette proposition a expiré. Écrivez-nous pour la renouveler.', 'This proposal has expired. Write to us to renew it.')}</div>` : `
                <label class="pp-terms"><input type="checkbox" id="pp-terms" ${state.terms ? 'checked' : ''}><span>${L('J\'accepte les <a href="/terms.html" target="_blank" rel="noopener">conditions d\'utilisation</a> et la <a href="/privacy.html" target="_blank" rel="noopener">politique de confidentialité</a>. Abonnement mensuel, résiliable en tout temps.', 'I accept the <a href="/terms.html" target="_blank" rel="noopener">terms of service</a> and the <a href="/privacy.html" target="_blank" rel="noopener">privacy policy</a>. Monthly subscription, cancel anytime.')}</span></label>
                ${state.error ? `<div class="bl-note err" style="margin-bottom:10px;">${esc(state.error)}</div>` : ''}
                <button class="bl-btn" id="pp-pay" style="width:100%; min-height:50px; font-size:1rem;"><span class="material-icons">lock</span> ${L('Accepter et payer', 'Accept and pay')}</button>`}
                ${d.sender?.email ? `<a class="pp-q" href="mailto:${esc(d.sender.email)}?subject=${encodeURIComponent(`${L('Question sur la proposition', 'Question about proposal')} ${d.number}`)}"><span class="material-icons" style="font-size:1.1rem;">help_outline</span>${L('J\'ai une question', 'I have a question')}</a>` : ''}
                <div class="pp-dim" style="font-size:.75rem; text-align:center; margin-top:12px;"><span class="material-icons" style="font-size:.9rem; vertical-align:text-bottom;">verified_user</span> ${L('Paiement sécurisé par Stripe. Vos données de carte ne passent jamais par nos serveurs.', 'Secure payment by Stripe. Your card details never go through our servers.')}</div>
            </div>`;
    }

    function render() {
        const d = state.data, o = d.offer;
        const lang = isEn() ? 'en' : 'fr';
        const includes = d.includes?.[lang] || [];
        const setupIncludes = d.setupIncludes?.[lang] || [];
        const optional = o.options.filter(x => x.mode === 'optional');
        const t = totals();
        const head = `
            <div class="pp-top">
                <div><div class="pp-eyebrow">${L('Proposition commerciale', 'Business proposal')}</div><h1 class="pp-h1">${esc(d.clientName || d.projectName)}</h1></div>
                <div class="pp-meta">
                    <span class="pp-pill">${L('N°', 'No.')} ${esc(d.number)}</span>
                    ${d.date ? `<span class="pp-pill">${day(d.date)}</span>` : ''}
                    ${d.validUntil ? `<span class="pp-pill ${d.expired ? 'warn' : ''}">${d.expired ? L('Expirée le', 'Expired on') : L('Valable jusqu\'au', 'Valid until')} ${day(d.validUntil)}</span>` : ''}
                </div>
            </div>`;

        if (d.subscribed || back === 'success') {
            body().className = '';
            body().innerHTML = `${head}<div class="pp-card" style="text-align:center; padding:40px 20px;"><span class="material-icons" style="font-size:3rem; color:#3ecf8e;">check_circle</span><h3 style="font-size:1.3rem; margin-top:10px;">${L('Merci ! Votre abonnement est actif.', 'Thank you! Your subscription is active.')}</h3><p class="pp-dim">${L('Vous recevrez votre reçu et vos accès par courriel. L\'équipe Quasar vous contacte pour la mise en route.', 'You will receive your receipt and access by email. The Quasar team will contact you to get started.')}</p></div>`;
            return;
        }

        body().className = '';
        body().innerHTML = `
            ${head}
            ${back === 'cancelled' ? `<div class="bl-note info" style="margin-bottom:16px;">${L('Paiement annulé : aucun montant n\'a été prélevé.', 'Payment cancelled: nothing was charged.')}</div>` : ''}
            <div class="pp-grid">
                <div class="pp-col">
                    ${o.note ? `<div class="pp-card pp-msg"><p>${esc(o.note)}</p>${d.sender?.name ? `<div class="pp-sign"><span class="pp-av">${esc(d.sender.name.trim()[0] || 'Q')}</span>${esc(d.sender.name)}</div>` : ''}</div>` : ''}

                    <div class="pp-card">
                        <div class="pp-eyebrow" style="margin-bottom:6px;">${L('Votre forfait', 'Your plan')}</div>
                        <h3 style="font-size:1.25rem;">${esc(tr(o.base, 'name'))}</h3>
                        ${o.base.description ? `<div class="pp-dim">${esc(tr(o.base, 'description'))}</div>` : ''}
                        <div style="margin-top:12px;"><span class="pp-price">${money(o.base.monthly)}</span> <span class="pp-dim">/ ${L('mois', 'month')}</span></div>
                        ${includes.length ? `<ul class="pp-list">${includes.map(li).join('')}</ul>` : ''}
                        <div class="pp-explain"><b>${L(`${o.base.includedConversations} conversations IA par mois`, `${o.base.includedConversations} AI conversations per month`)}</b> ${L('incluses. Une conversation = un client à qui l\'assistant a répondu pendant le mois, peu importe le nombre de messages échangés.', 'included. One conversation = one customer the assistant replied to during the month, whatever the number of messages.')} ${L(`Au-delà : ${money(o.overageUnitPrice)} par conversation, ajouté à la facture suivante.`, `Beyond that: ${money(o.overageUnitPrice)} per conversation, added to the next invoice.`)}</div>
                        ${t.incl.length || o.customItems.length ? `
                        <div class="pp-sep" style="margin:16px 0 10px;"></div>
                        <div class="pp-dim" style="margin-bottom:4px;">${L('Également inclus dans votre offre', 'Also included in your offer')}</div>
                        <ul class="pp-list" style="margin-top:6px;">${[...t.incl.map(x => `${tr(x, 'name')}${x.includedMinutes ? ` (${L(`${x.includedMinutes} min d'appel / mois`, `${x.includedMinutes} call min / month`)})` : ''}`), ...o.customItems.map(i => `${i.name}${i.description ? ` · ${i.description}` : ''}`)].map(li).join('')}</ul>` : ''}
                    </div>

                    ${optional.length ? `
                    <div class="pp-card">
                        <h3>${L('Options à ajouter', 'Add-ons you can add')}</h3>
                        <div class="pp-dim" style="margin-bottom:10px;">${L('Cochez ce qui vous intéresse : le récapitulatif se met à jour. Vous pourrez aussi les ajouter ou les retirer plus tard depuis votre portail.', 'Tick what interests you: the summary updates. You can also add or remove them later from your portal.')}</div>
                        ${optional.map(x => `
                            <label class="pp-opt">
                                <span class="bl-switch"><input type="checkbox" data-pick="${esc(x.key)}" ${state.picked.has(x.key) ? 'checked' : ''}><span></span></span>
                                <span style="flex:1; min-width:0;"><strong>${esc(tr(x, 'name'))}</strong>${x.description ? `<br><span class="pp-dim">${esc(tr(x, 'description'))}</span>` : ''}${x.includedMinutes ? `<br><span class="pp-dim">${L(`${x.includedMinutes} minutes d'appel incluses / mois, puis ${money(o.minuteOverageUnitPrice ?? 0)} la minute`, `${x.includedMinutes} call minutes included / month, then ${money(o.minuteOverageUnitPrice ?? 0)} per minute`)}</span>` : ''}</span>
                                <strong style="white-space:nowrap;">+${money(x.monthly)}<span class="pp-dim" style="font-weight:400;"> / ${L('mois', 'mo')}</span></strong>
                            </label>`).join('')}
                    </div>` : ''}

                    ${o.setupFee ? `
                    <div class="pp-card">
                        <h3>${L('Installation et mise en route', 'Setup and onboarding')} · ${money(o.setupFee)} <span class="pp-dim" style="font-weight:400;">${L('une seule fois', 'one time')}</span></h3>
                        ${setupIncludes.length ? `<ul class="pp-list">${setupIncludes.map(li).join('')}</ul>` : ''}
                    </div>` : ''}

                    <div class="pp-card pp-faq">
                        <h3 style="margin-bottom:8px;">${L('Questions fréquentes', 'Frequently asked questions')}</h3>
                        ${[
                [L('Suis-je engagé pour une durée minimale ?', 'Is there a minimum commitment?'), L('Non. L\'abonnement est mensuel et résiliable en tout temps depuis votre portail, sans frais. Le mois en cours reste payé.', 'No. The subscription is monthly and can be cancelled anytime from your portal, at no cost. The current month remains paid.')],
                [L('Quand mon assistant sera-t-il en service ?', 'When will my assistant be live?'), L('En général dans la semaine qui suit le paiement : nous configurons l\'assistant, connectons vos comptes et testons tout avec vous avant la mise en service.', 'Usually within a week of payment: we set up the assistant, connect your accounts and test everything with you before going live.')],
                [L('Que se passe-t-il si je dépasse mon quota ?', 'What if I go over my quota?'), L(`Le service continue sans interruption. Chaque conversation en plus coûte ${money(o.overageUnitPrice)}, ajoutée à la facture suivante. Votre portail affiche votre consommation en temps réel.`, `The service keeps running. Each extra conversation costs ${money(o.overageUnitPrice)}, added to the next invoice. Your portal shows your usage in real time.`)],
                [L('Puis-je reprendre la main sur une conversation ?', 'Can I take over a conversation?'), L('Oui, à tout moment, depuis votre portail sur téléphone : vous coupez l\'IA pour ce client et vous répondez vous-même.', 'Yes, anytime, from your portal on your phone: you turn AI off for that customer and reply yourself.')],
                [L('Mes données sont-elles protégées ?', 'Is my data protected?'), L('Vos messages restent privés et servent uniquement à répondre à vos clients. Vous pouvez demander leur suppression à tout moment. Voir notre <a href="/privacy.html" target="_blank" rel="noopener">politique de confidentialité</a>.', 'Your messages stay private and are only used to answer your customers. You can ask for their deletion at any time. See our <a href="/privacy.html" target="_blank" rel="noopener">privacy policy</a>.')]
            ].map(([q, a]) => `<details><summary>${q}</summary><p class="pp-dim">${a}</p></details>`).join('')}
                    </div>
                </div>
                <div class="pp-col">${summaryHtml()}</div>
            </div>
            <div class="pp-bar">
                <div class="t">${L('Aujourd\'hui', 'Today')}<b id="pp-bar-total">${money(t.today)}</b></div>
                <button class="bl-btn" id="pp-bar-go" style="min-height:44px;">${d.expired ? L('Voir', 'View') : L('Accepter et payer', 'Accept and pay')}</button>
            </div>`;
        bind();
    }

    function refreshSummary() {
        const wrap = container.querySelector('#pp-sum')?.parentElement;
        if (wrap) wrap.innerHTML = summaryHtml();
        const bt = container.querySelector('#pp-bar-total');
        if (bt) bt.textContent = money(totals().today);
        bindSummary();
    }

    function bindSummary() {
        container.querySelector('#pp-terms')?.addEventListener('change', (e) => { state.terms = e.target.checked; if (state.terms && state.error) { state.error = ''; refreshSummary(); } });
        container.querySelector('#pp-pay')?.addEventListener('click', async (e) => {
            if (!state.terms) { state.error = L('Cochez la case pour accepter les conditions.', 'Tick the box to accept the terms.'); refreshSummary(); return; }
            const btn = e.currentTarget;
            btn.disabled = true;
            try {
                window.location.href = (await call(`/proposals/${proposalId}/checkout`, { method: 'POST', body: { options: [...state.picked], acceptTerms: true } })).url;
            } catch (err) { state.error = err.message; refreshSummary(); }
        });
    }

    function bind() {
        container.querySelectorAll('[data-pick]').forEach(i => i.addEventListener('change', () => { i.checked ? state.picked.add(i.dataset.pick) : state.picked.delete(i.dataset.pick); refreshSummary(); }));
        container.querySelector('#pp-bar-go')?.addEventListener('click', () => container.querySelector('#pp-sum')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        bindSummary();
    }

    call(`/proposals/${proposalId}`).then(d => { state.data = d; render(); })
        .catch(e => { body().innerHTML = `<div class="bl-note err">${esc(e.message)}</div>`; });
}
const OV_STYLES = `
.ov-head { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
.ov-tabs { display:flex; gap:6px; flex-wrap:wrap; }
.ov-tab { border:1px solid var(--border, #2d3139); background:transparent; color:var(--text-dim, #94a3b8); border-radius:10px; padding:9px 14px; font-weight:700; font-size:.85rem; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
.ov-tab.on { border-color:var(--gold, #dfa53a); color:var(--gold, #dfa53a); background:rgba(223,165,58,.1); }
.ov-tab .material-icons { font-size:1.1rem; }
.ov-cards { display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:12px; }
.ov-card { background:var(--bg-card, #121418); border:1px solid var(--border, #2d3139); border-radius:14px; padding:14px 16px; }
.ov-card .k { font-size:.75rem; color:var(--text-dim, #94a3b8); display:flex; align-items:center; gap:6px; }
.ov-card .k .material-icons { font-size:1rem; color:var(--gold, #dfa53a); }
.ov-card .v { font-size:1.6rem; font-weight:800; margin-top:6px; letter-spacing:-.5px; }
.ov-row { display:flex; align-items:center; gap:14px; padding:14px 0; border-top:1px solid var(--border, #2d3139); flex-wrap:wrap; }
.ov-row:first-child { border-top:0; }
.ov-name { flex:1 1 220px; min-width:0; }
.ov-name b { display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ov-amt { min-width:110px; text-align:right; }
.ov-mini { display:flex; flex-direction:column; gap:4px; min-width:150px; font-size:.72rem; color:var(--text-dim, #94a3b8); }
.ov-mini .bl-bar { height:6px; }
@media (max-width: 640px) { .ov-amt { text-align:left; min-width:0; } }
`;

/**
 * ERP › AI Agents › "Pricing and subscriptions": all clients at a glance (recurring revenue, subscriptions,
 * proposals, things to watch) and the shared price list.
 * @param {{ apiBase, getToken, onOpenProject: (projectId) => void, initialTab?: 'overview'|'catalog' }} opts
 */
export function renderBillingOverview(container, opts) {
    const call = api(opts.apiBase, opts.getToken);
    let tab = opts.initialTab || 'overview';
    let data = null;
    const STATUS_OV = () => ({
        active: ['ok', L('Abonné', 'Subscribed')], canceling: ['warn', L('Résiliation prévue', 'Cancels at period end')], past_due: ['err', L('Paiement en retard', 'Payment past due')],
        proposal: ['info', L('Proposition envoyée', 'Proposal sent')], expired: ['warn', L('Proposition expirée', 'Proposal expired')],
        unpaid: ['err', L('Impayé', 'Unpaid')], canceled: ['off', L('Résilié', 'Canceled')], none: ['off', L('Pas d\'offre', 'No offer')]
    });
    container.innerHTML = `<style>${STYLES}${OV_STYLES}</style>
        <div class="bl" style="max-width:none;">
            <div class="ov-head">
                ${opts.embedded ? '<div style="flex:1;"></div>' : `<div style="flex:1; min-width:220px;"><div class="bl-title" style="font-size:1.2rem;">${L('Tarifs et abonnements', 'Pricing and subscriptions')}</div>
                    <div class="bl-dim">${L('Tous vos clients d\'un coup d\'œil, et la grille de prix commune.', 'All your clients at a glance, and the shared price list.')}</div></div>`}
                <span id="ov-mode"></span>
                <div class="ov-tabs">
                    <button class="ov-tab" data-t="overview"><span class="material-icons">insights</span>${L('Vue d\'ensemble', 'Overview')}</button>
                    <button class="ov-tab" data-t="catalog"><span class="material-icons">sell</span>${L('Grille tarifaire', 'Price list')}</button>
                </div>
            </div>
            <div id="ov-notice"></div>
            <div id="ov-body" class="bl-dim">${L('Chargement…', 'Loading…')}</div>
        </div>`;
    const body = container.querySelector('#ov-body');
    const notice = (type, html) => { container.querySelector('#ov-notice').innerHTML = html ? `<div class="bl-note ${type}" style="margin-bottom:12px;">${html}</div>` : ''; };
    const setTab = (t) => { tab = t; container.querySelectorAll('.ov-tab').forEach(b => b.classList.toggle('on', b.dataset.t === t)); show(); };
    container.querySelectorAll('.ov-tab').forEach(b => b.onclick = () => setTab(b.dataset.t));

    async function show() {
        notice('', '');
        if (tab === 'catalog') {
            body.className = '';
            body.innerHTML = `<div class="bl-note info" style="margin-bottom:12px;">${L('Ces prix s\'affichent sur le site et servent de point de départ à chaque nouvelle offre. Les clients déjà abonnés gardent leur prix. Pour un client en particulier, personnalisez son offre dans son projet (onglet Forfait).', 'These prices show on the website and are the starting point of every new offer. Subscribed clients keep their price. For one client, customise their offer in their project (Plan tab).')}</div><div id="ov-cat"></div>`;
            renderCatalogEditor(body.querySelector('#ov-cat'), { apiBase: opts.apiBase, getToken: opts.getToken, startOpen: true });
            return;
        }
        if (!data) {
            try { data = await call('/overview'); } catch (e) { body.innerHTML = `<div class="bl-note err">${esc(e.message)}</div>`; return; }
        }
        renderOverview();
    }

    function usageBar(used, included, label) {
        if (!included) return '';
        const pct = Math.min(100, Math.round(used / included * 100));
        const color = used > included ? '#ef4444' : pct >= 80 ? '#f5a524' : '#3ecf8e';
        return `<div>${label} ${used} / ${included}</div><div class="bl-bar"><div style="width:${pct}%; background:${color};"></div></div>`;
    }

    function renderOverview() {
        body.className = '';
        container.querySelector('#ov-mode').innerHTML = `<span class="bl-chip ${data.mode === 'live' ? 'ok' : 'warn'}">${data.mode === 'live' ? L('Stripe live', 'Stripe live') : L('Stripe test (local)', 'Stripe test (local)')}</span>`;
        const t = data.totals;
        const S = STATUS_OV();
        body.innerHTML = `
            ${!data.published ? `<div class="bl-note err" style="margin-bottom:12px;">${L('La grille n\'est pas publiée dans Stripe : aucun client ne peut payer. Ouvrez l\'onglet « Grille tarifaire » et publiez-la.', 'The price list is not published to Stripe: no client can pay. Open the "Price list" tab and publish it.')}</div>` : ''}
            <div class="ov-cards">
                <div class="ov-card"><div class="k"><span class="material-icons">trending_up</span>${L('Revenu mensuel récurrent', 'Monthly recurring revenue')}</div><div class="v">${money(t.mrr)}</div></div>
                <div class="ov-card"><div class="k"><span class="material-icons">verified</span>${L('Clients abonnés', 'Subscribed clients')}</div><div class="v">${t.subscribed}</div></div>
                <div class="ov-card"><div class="k"><span class="material-icons">send</span>${L('Propositions en attente', 'Pending proposals')}</div><div class="v">${t.proposals}</div></div>
                <div class="ov-card"><div class="k"><span class="material-icons" style="color:${t.attention ? '#f5a524' : 'var(--gold)'};">notification_important</span>${L('À surveiller', 'To watch')}</div><div class="v" style="${t.attention ? 'color:#f5a524;' : ''}">${t.attention}</div></div>
            </div>
            <div class="bl-card" style="margin-top:14px;">
                <div class="bl-row" style="margin-bottom:6px;">
                    <div class="bl-title" style="flex:1;">${L('Clients', 'Clients')}</div>
                    <button class="bl-btn ghost" id="ov-refresh" style="min-height:36px;" title="${L('Relire les abonnements dans Stripe (après un paiement ou une résiliation)', 'Re-read subscriptions from Stripe (after a payment or a cancellation)')}"><span class="material-icons">sync</span>${L('Actualiser depuis Stripe', 'Refresh from Stripe')}</button>
                </div>
                ${data.rows.map(r => {
            const [cls, label] = S[r.status] || ['off', r.status];
            const info = ['active', 'canceling', 'past_due'].includes(r.status)
                ? (r.periodEnd ? `${r.status === 'canceling' ? L('Fin le', 'Ends on') : L('Renouvellement le', 'Renews on')} ${date(r.periodEnd)}` : '')
                : r.status === 'proposal' || r.status === 'expired' ? (r.validUntil ? `${r.status === 'expired' ? L('Expirée le', 'Expired on') : L('Valable jusqu\'au', 'Valid until')} ${date(r.validUntil)}` : '')
                    : r.customOffer ? L('Offre personnalisée, pas encore envoyée', 'Custom offer, not sent yet') : L('Grille publique', 'Public price list');
            return `
                    <div class="ov-row">
                        <div class="ov-name"><b>${esc(r.name)}</b><span class="bl-dim">${esc(r.client || '')}${r.client && info ? ' · ' : ''}${info}</span></div>
                        <span class="bl-chip ${cls === 'info' ? 'ok' : cls}" style="${cls === 'info' ? 'color:var(--gold); border-color:rgba(223,165,58,.4); background:rgba(223,165,58,.08);' : ''}">${label}</span>
                        ${r.usage ? `<div class="ov-mini">${usageBar(r.usage.conversations, r.usage.includedConversations, L('Conversations', 'Conversations'))}${usageBar(r.usage.minutes, r.usage.includedMinutes, L('Minutes', 'Minutes'))}</div>` : ''}
                        <div class="ov-amt"><b>${money(r.monthly)}</b><div class="bl-dim">${['active', 'canceling', 'past_due'].includes(r.status) ? L('/ mois', '/ month') : L('/ mois proposé', '/ month offered')}</div></div>
                        <div class="bl-row" style="gap:6px;">
                            ${r.proposalUrl && ['proposal', 'expired'].includes(r.status) ? `<button class="bl-btn ghost" data-copy="${esc(r.proposalUrl)}" style="min-height:36px; padding:0 10px;" title="${L('Copier le lien de proposition', 'Copy the proposal link')}"><span class="material-icons">link</span></button>` : ''}
                            <button class="bl-btn ghost" data-open="${esc(r.projectId)}" style="min-height:36px;">${L('Ouvrir', 'Open')} <span class="material-icons">chevron_right</span></button>
                        </div>
                    </div>`;
        }).join('') || `<div class="bl-dim">${L('Aucun projet client.', 'No client project.')}</div>`}
                <div class="bl-dim" style="margin-top:10px; font-size:.75rem;">${L('Montants calculés à partir de chaque offre, hors taxes et dépassements. Les factures exactes sont dans Stripe.', 'Amounts computed from each offer, before taxes and overage. Exact invoices are in Stripe.')}</div>
            </div>`;
        body.querySelectorAll('[data-open]').forEach(b => b.onclick = () => opts.onOpenProject?.(b.dataset.open));
        body.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => { await navigator.clipboard.writeText(b.dataset.copy).catch(() => { }); notice('ok', L('Lien de proposition copié.', 'Proposal link copied.')); });
        body.querySelector('#ov-refresh').onclick = async (e) => {
            const btn = e.currentTarget; btn.disabled = true;
            try { data = await call('/overview/refresh', { method: 'POST' }); renderOverview(); notice('ok', L('Abonnements relus dans Stripe.', 'Subscriptions re-read from Stripe.')); }
            catch (err) { notice('err', esc(err.message)); btn.disabled = false; }
        };
    }

    setTab(tab);
}

/** ERP staff: edit the offer and publish it to Stripe. */
export function renderCatalogEditor(container, opts) {
    const call = api(opts.apiBase, opts.getToken);
    let cat = null;
    let open = opts.startOpen ? true : null; // folded once published (rarely edited); open while it still has to be published

    container.innerHTML = `<style>${STYLES}</style><div class="bl"><div id="bc-notice"></div><div id="bc-body" class="bl-dim">${L('Chargement…', 'Loading…')}</div></div>`;
    bindTips(container);
    const notice = (type, html) => { container.querySelector('#bc-notice').innerHTML = html ? `<div class="bl-note ${type}">${html}</div>` : ''; };
    const field = (label, name, value, type = 'text', step = '') => `<label class="bl-field">${label}<input class="bl-input" name="${name}" type="${type}" ${step ? `step="${step}"` : ''} value="${esc(value)}"></label>`;

    function render() {
        const body = container.querySelector('#bc-body');
        body.className = '';
        const published = !!cat.stripe?.basePrice;
        if (open === null) open = !published;
        if (!open) {
            body.innerHTML = `
                <div class="bl-card bc-head" id="bc-open" role="button" tabindex="0">
                    <div class="bo-ic" style="background:rgba(255,255,255,.05); color:var(--text-dim);"><span class="material-icons">public</span></div>
                    <div style="flex:1; min-width:180px;"><div class="bl-title" style="font-size:.95rem;">${L('Grille publique (site web)', 'Public price list (website)')}</div>
                        <div class="bl-dim">${L(`À partir de ${money(cat.base.monthly)} / mois · point de départ de chaque offre`, `From ${money(cat.base.monthly)} / month · starting point of every offer`)}</div></div>
                    <span class="bl-chip ${published ? 'ok' : 'warn'}">${published ? L('Publiée dans Stripe', 'Published to Stripe') : L('Non publiée', 'Not published')}</span>
                    <span class="material-icons" style="color:var(--text-dim);">expand_more</span>
                </div>`;
            const go = () => { open = true; render(); };
            body.querySelector('#bc-open').onclick = go;
            body.querySelector('#bc-open').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
            return;
        }
        body.innerHTML = `
            <form id="bc-form" class="bl" style="max-width:none;">
                <div class="bl-card">
                    <div class="bl-row" data-tip-host><div class="bo-ic"><span class="material-icons">public</span></div><div class="bl-title" style="flex:1;">${L('Grille publique (site web) et point de départ des offres', 'Public price list (website) and starting point of offers')}</div>
                        ${published ? `<button type="button" class="bl-btn ghost" id="bc-close" style="min-height:34px; padding:0 10px;" title="${L('Replier', 'Fold')}"><span class="material-icons">expand_less</span></button>` : ''}
                        <span class="bl-chip ${cat.stripe?.basePrice ? 'ok' : 'warn'}">${cat.stripe?.basePrice ? L('Publié dans Stripe', 'Published to Stripe') : L('Non publié', 'Not published')}</span>
                        ${tip(L('Modifiez les prix puis cliquez « Enregistrer et publier ». Un prix modifié crée un nouveau prix Stripe pour les nouveaux abonnements ; les abonnements existants gardent leur prix tant que vous ne les migrez pas.', 'Edit the prices then click "Save and publish". A changed price creates a new Stripe price for new subscriptions; existing subscriptions keep their price until you migrate them.'))}</div>
                </div>
                <div class="bl-card">
                    <div class="bl-title" style="margin-bottom:10px;">${L('Forfait de base', 'Base plan')}</div>
                    <div class="bl-grid">
                        ${field(L('Nom', 'Name'), 'base.name', cat.base.name)}
                        ${field(L('Prix mensuel ($)', 'Monthly price ($)'), 'base.monthly', cat.base.monthly, 'number', '0.01')}
                        ${field(L('Conversations IA incluses / mois', 'AI conversations included / month'), 'base.includedConversations', cat.base.includedConversations, 'number', '1')}
                        ${field(L('Nom en anglais (site EN)', 'English name (EN website)'), 'base.nameEn', cat.base.nameEn || '')}
                    </div>
                    <label class="bl-field" style="margin-top:10px;">${L('Description', 'Description')}<textarea class="bl-input" name="base.description" rows="2">${esc(cat.base.description)}</textarea></label>
                    <label class="bl-field" style="margin-top:10px;">${L('Description en anglais (site EN)', 'English description (EN website)')}<textarea class="bl-input" name="base.descriptionEn" rows="2">${esc(cat.base.descriptionEn || '')}</textarea></label>
                </div>
                <div class="bl-card">
                    <div class="bl-title" style="margin-bottom:10px;">${L('Installation et dépassement', 'Setup and overage')}</div>
                    <div class="bl-grid">
                        ${field(L('Frais d\'installation : nom', 'Setup fee: name'), 'setupFee.name', cat.setupFee.name)}
                        ${field(L('Frais d\'installation ($, 0 = aucun)', 'Setup fee ($, 0 = none)'), 'setupFee.amount', cat.setupFee.amount, 'number', '0.01')}
                        ${field(L('Prix par conversation au-delà du quota ($)', 'Price per conversation over quota ($)'), 'overage.unitPrice', cat.overage.unitPrice, 'number', '0.01')}
                        ${field(L('Prix par minute d\'appel au-delà des minutes incluses ($)', 'Price per call minute over the included minutes ($)'), 'minuteOverage.unitPrice', cat.minuteOverage?.unitPrice ?? 0.4, 'number', '0.01')}
                    </div>
                    <label class="bl-row" style="margin-top:12px; cursor:pointer;"><span class="bl-switch"><input type="checkbox" name="automaticTax" ${cat.automaticTax ? 'checked' : ''}><span></span></span><span class="bl-dim">${L('Taxes automatiques Stripe Tax (à activer d\'abord dans Stripe)', 'Automatic taxes with Stripe Tax (turn it on in Stripe first)')}</span></label>
                </div>
                <div class="bl-card">
                    <div class="bl-title" style="margin-bottom:4px;">${L('Page de proposition : textes par défaut', 'Proposal page: default texts')}</div>
                    <div class="bl-dim" style="margin-bottom:10px;">${L('Utilisés pour chaque client, sauf si vous les remplacez dans son offre. Une ligne par point.', 'Used for every client unless replaced in their offer. One line per item.')}</div>
                    <div class="bl-grid">
                        <label class="bl-field">${L('Ce qui est inclus (FR)', 'What\'s included (FR)')}<textarea class="bl-input" name="pres.includes" rows="5">${esc((cat.presentation?.includes || []).join('\n'))}</textarea></label>
                        <label class="bl-field">${L('Ce qui est inclus (EN)', 'What\'s included (EN)')}<textarea class="bl-input" name="pres.includesEn" rows="5">${esc((cat.presentation?.includesEn || []).join('\n'))}</textarea></label>
                        <label class="bl-field">${L('L\'installation comprend (FR)', 'Setup includes (FR)')}<textarea class="bl-input" name="pres.setupIncludes" rows="4">${esc((cat.presentation?.setupIncludes || []).join('\n'))}</textarea></label>
                        <label class="bl-field">${L('L\'installation comprend (EN)', 'Setup includes (EN)')}<textarea class="bl-input" name="pres.setupIncludesEn" rows="4">${esc((cat.presentation?.setupIncludesEn || []).join('\n'))}</textarea></label>
                        ${field(L('Validité d\'une proposition (jours)', 'Proposal validity (days)'), 'pres.validityDays', cat.presentation?.validityDays ?? 30, 'number', '1')}
                        ${field(L('Courriel pour les questions', 'Email for questions'), 'pres.contactEmail', cat.presentation?.contactEmail || '', 'email')}
                    </div>
                </div>
                <div class="bl-card">
                    <div class="bl-row" style="margin-bottom:6px;"><div class="bl-title" style="flex:1;">${L('Options', 'Add-ons')}</div><button type="button" class="bl-btn ghost" id="bc-add" style="min-height:38px;"><span class="material-icons">add</span> ${L('Ajouter', 'Add')}</button></div>
                    <div id="bc-options">${cat.options.map(optionRow).join('')}</div>
                </div>
                <div class="bl-row">
                    <button type="submit" class="bl-btn" data-publish="1"><span class="material-icons">publish</span> ${L('Enregistrer et publier dans Stripe', 'Save and publish to Stripe')}</button>
                    <button type="submit" class="bl-btn ghost" data-publish="0">${L('Enregistrer seulement', 'Save only')}</button>
                </div>
            </form>`;
        const form = body.querySelector('#bc-form');
        body.querySelector('#bc-close')?.addEventListener('click', () => { open = false; render(); });
        body.querySelector('#bc-add').addEventListener('click', () => {
            body.querySelector('#bc-options').insertAdjacentHTML('beforeend', optionRow({ key: '', name: '', description: '', monthly: 0, extraConversations: 0, includedMinutes: 0 }));
        });
        body.querySelector('#bc-options').addEventListener('click', (e) => { if (e.target.closest('[data-remove]')) e.target.closest('[data-option]').remove(); });
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const publish = e.submitter?.dataset.publish === '1';
            const v = (n) => form.querySelector(`[name="${n}"]`).value;
            const payload = {
                automaticTax: form.querySelector('[name=automaticTax]').checked,
                base: { name: v('base.name'), description: v('base.description'), nameEn: v('base.nameEn'), descriptionEn: v('base.descriptionEn'), monthly: v('base.monthly'), includedConversations: v('base.includedConversations') },
                setupFee: { name: v('setupFee.name'), amount: v('setupFee.amount') },
                overage: { unitPrice: v('overage.unitPrice') },
                minuteOverage: { unitPrice: v('minuteOverage.unitPrice') },
                presentation: { includes: v('pres.includes'), includesEn: v('pres.includesEn'), setupIncludes: v('pres.setupIncludes'), setupIncludesEn: v('pres.setupIncludesEn'), validityDays: v('pres.validityDays'), contactEmail: v('pres.contactEmail') },
                options: [...form.querySelectorAll('[data-option]')].map(r => ({
                    key: r.querySelector('[name=key]').value, name: r.querySelector('[name=name]').value, description: r.querySelector('[name=description]').value,
                    nameEn: r.querySelector('[name=nameEn]').value, descriptionEn: r.querySelector('[name=descriptionEn]').value,
                    monthly: r.querySelector('[name=monthly]').value, extraConversations: r.querySelector('[name=extra]').value, includedMinutes: r.querySelector('[name=minutes]').value
                }))
            };
            const btns = form.querySelectorAll('button[type=submit]');
            btns.forEach(b => { b.disabled = true; });
            try {
                cat = (await call('/catalog', { method: 'PUT', body: payload })).catalog;
                if (publish) cat = (await call('/catalog/sync', { method: 'POST' })).catalog;
                notice('ok', publish ? L('Catalogue enregistré et publié dans Stripe.', 'Catalog saved and published to Stripe.') : L('Catalogue enregistré (pas encore publié dans Stripe).', 'Catalog saved (not published to Stripe yet).'));
                render();
            } catch (err) {
                notice('err', esc(err.message));
                btns.forEach(b => { b.disabled = false; });
            }
        });
    }

    function optionRow(o) {
        return `
            <div data-option class="bl-opt" style="flex-wrap:wrap; align-items:flex-end;">
                <div class="bl-grid" style="flex:1;">
                    <label class="bl-field">${L('Clé', 'Key')}<input class="bl-input" name="key" value="${esc(o.key)}" placeholder="voice"></label>
                    <label class="bl-field">${L('Nom', 'Name')}<input class="bl-input" name="name" value="${esc(o.name)}"></label>
                    <label class="bl-field">${L('Prix mensuel ($)', 'Monthly price ($)')}<input class="bl-input" name="monthly" type="number" step="0.01" value="${esc(o.monthly)}"></label>
                    <label class="bl-field">${L('Conversations en plus', 'Extra conversations')}<input class="bl-input" name="extra" type="number" step="1" value="${esc(o.extraConversations || 0)}"></label>
                    <label class="bl-field">${L('Minutes d\'appel incluses', 'Call minutes included')}<input class="bl-input" name="minutes" type="number" step="1" value="${esc(o.includedMinutes || 0)}"></label>
                    <label class="bl-field" style="grid-column:1/-1;">${L('Description', 'Description')}<input class="bl-input" name="description" value="${esc(o.description)}"></label>
                    <label class="bl-field">${L('Nom en anglais', 'English name')}<input class="bl-input" name="nameEn" value="${esc(o.nameEn || '')}"></label>
                    <label class="bl-field" style="grid-column:span 2;">${L('Description en anglais', 'English description')}<input class="bl-input" name="descriptionEn" value="${esc(o.descriptionEn || '')}"></label>
                </div>
                <button type="button" class="bl-btn ghost" data-remove style="min-height:40px;" title="${L('Retirer', 'Remove')}"><span class="material-icons">delete_outline</span></button>
            </div>`;
    }

    call('/catalog').then(d => {
        cat = d.catalog;
        if (!d.stripeConfigured) notice('err', L('STRIPE_SECRET_KEY manque sur le serveur : la publication est impossible.', 'STRIPE_SECRET_KEY is missing on the server: publishing is not possible.'));
        else if (cat.isDefault) notice('info', L('Prix proposés par défaut : ajustez-les, puis publiez.', 'Default prices are suggested: adjust them, then publish.'));
        render();
    }).catch(e => { container.querySelector('#bc-body').innerHTML = `<div class="bl-note err">${esc(e.message)}</div>`; });
}
