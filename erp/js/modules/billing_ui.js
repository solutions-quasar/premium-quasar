/**
 * Billing UI — the client's subscription (portal "Subscription" tab and ERP project "Plan" tab)
 * and the offer editor (ERP staff). Talks to /api/billing (erp/backend/billing).
 */
import { tip, bindTips } from './mp_help.js';

const isEn = () => { try { return (localStorage.getItem('erp_lang') || 'en') !== 'fr'; } catch (_) { return true; } };
const L = (fr, en) => (isEn() ? en : fr);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => new Intl.NumberFormat(isEn() ? 'en-CA' : 'fr-CA', { style: 'currency', currency: 'CAD' }).format(Number(n || 0));
const date = (iso) => iso ? new Date(iso).toLocaleDateString(isEn() ? 'en-CA' : 'fr-CA', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

const STYLES = `
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
`;

function api(apiBase, getToken) {
    return async (path, { method = 'GET', body } = {}) => {
        const token = await getToken();
        const res = await fetch(`${apiBase}/api/billing${path}`, {
            method,
            headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
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

/**
 * Subscription of one project.
 * @param {{ projectId, apiBase, getToken, isStaff }} opts
 */
export function renderProjectBilling(container, opts) {
    const call = api(opts.apiBase, opts.getToken);
    const state = { data: null, picked: new Set(), withSetup: true };

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
        body.innerHTML = d.subscription && d.subscription.status !== 'canceled' ? subscribedView(d) : offerView(d);
        bind(d);
    }

    // ----- Not subscribed: the offer -----
    function offerView(d) {
        const c = d.catalog;
        if (!c.ready) return `<div class="bl-card"><div class="bl-title">${L('Abonnement', 'Subscription')}</div><div class="bl-dim" style="margin-top:6px;">${L('L\'offre n\'est pas encore publiée.', 'The offer is not published yet.')} ${opts.isStaff ? L('Publiez le catalogue ci-dessous.', 'Publish the catalog below.') : L('Contactez l\'équipe Quasar.', 'Contact the Quasar team.')}</div></div>`;
        const opt = c.options.filter(o => state.picked.has(o.key));
        const monthly = c.base.monthly + opt.reduce((n, o) => n + o.monthly, 0);
        const setup = state.withSetup ? c.setupFee.amount : 0;
        return `
            <div class="bl-card">
                <div class="bl-row" data-tip-host><div class="bl-title" style="flex:1;">${esc(c.base.name)}</div>${tip(L(`Le forfait inclut ${c.base.includedConversations} conversations IA par mois. Une conversation IA = un client à qui l'assistant a répondu pendant le mois, quel que soit le nombre de messages. Au-delà, chaque conversation coûte ${money(c.overage.unitPrice)}.`, `The plan includes ${c.base.includedConversations} AI conversations per month. One AI conversation = one customer the assistant replied to during the month, whatever the number of messages. Beyond that, each conversation costs ${money(c.overage.unitPrice)}.`))}</div>
                <div class="bl-dim" style="margin-top:4px;">${esc(c.base.description)}</div>
                <div style="margin-top:10px;"><span class="bl-big">${money(c.base.monthly)}</span> <span class="bl-dim">/ ${L('mois', 'month')}</span></div>
                <div class="bl-dim">${L(`${c.base.includedConversations} conversations IA incluses, puis ${money(c.overage.unitPrice)} par conversation`, `${c.base.includedConversations} AI conversations included, then ${money(c.overage.unitPrice)} per conversation`)}</div>
            </div>
            ${c.options.length ? `
            <div class="bl-card">
                <div class="bl-title" style="margin-bottom:6px;">${L('Options', 'Add-ons')}</div>
                ${c.options.map(o => `
                    <label class="bl-opt" style="cursor:pointer;">
                        <span class="bl-switch"><input type="checkbox" data-pick="${esc(o.key)}" ${state.picked.has(o.key) ? 'checked' : ''}><span></span></span>
                        <span style="flex:1; min-width:0;"><strong>${esc(o.name)}</strong><br><span class="bl-dim">${esc(o.description)}</span></span>
                        <strong style="white-space:nowrap;">+${money(o.monthly)}</strong>
                    </label>`).join('')}
            </div>` : ''}
            <div class="bl-card">
                ${opts.isStaff ? `<label class="bl-row" style="cursor:pointer; margin-bottom:10px;"><span class="bl-switch"><input type="checkbox" id="bl-setup" ${state.withSetup ? 'checked' : ''}><span></span></span><span>${L('Inclure les frais d\'installation', 'Include the setup fee')}</span></label>` : ''}
                <div class="bl-total"><span>${L('Abonnement mensuel', 'Monthly subscription')}</span><strong>${money(monthly)}</strong></div>
                ${setup ? `<div class="bl-total"><span>${esc(c.setupFee.name)} (${L('une fois', 'one time')})</span><strong>${money(setup)}</strong></div>` : ''}
                <div class="bl-total" style="border-top:1px solid var(--border, #2d3139); margin-top:6px; padding-top:10px;"><span>${L('Premier paiement', 'First payment')}</span><strong>${money(monthly + setup)} <span class="bl-dim">+ ${L('taxes', 'taxes')}</span></strong></div>
                <div class="bl-dim" style="margin:6px 0 12px;">${L('Paiement sécurisé par Stripe. Résiliable en tout temps, sans frais.', 'Secure payment by Stripe. Cancel anytime, no fees.')}</div>
                <div class="bl-row">
                    <button class="bl-btn" id="bl-subscribe"><span class="material-icons">lock</span> ${opts.isStaff ? L('Ouvrir le paiement', 'Open checkout') : L('S\'abonner', 'Subscribe')}</button>
                    ${opts.isStaff ? `<button class="bl-btn ghost" id="bl-copy"><span class="material-icons">link</span> ${L('Copier le lien pour le client', 'Copy the link for the client')}</button>` : ''}
                </div>
            </div>`;
    }

    // ----- Subscribed -----
    function subscribedView(d) {
        const s = d.subscription, c = d.catalog, u = d.usage;
        const [cls, label] = STATUS()[s.status] || ['off', s.status];
        const pct = u.included ? Math.min(100, Math.round(u.used / u.included * 100)) : 0;
        const barColor = u.used > u.included ? '#ef4444' : pct >= 80 ? '#f5a524' : '#3ecf8e';
        return `
            <div class="bl-card">
                <div class="bl-row"><div class="bl-title" style="flex:1;">${esc(c.base.name)}</div><span class="bl-chip ${cls}">${label}</span></div>
                <div style="margin-top:8px;"><span class="bl-big">${money(s.monthly)}</span> <span class="bl-dim">/ ${L('mois', 'month')} + ${L('taxes', 'taxes')}</span></div>
                ${s.cancelAtPeriodEnd ? `<div class="bl-note info" style="margin-top:10px;">${L(`L'abonnement se termine le ${date(s.periodEnd)}.`, `The subscription ends on ${date(s.periodEnd)}.`)}</div>` : ''}
                ${s.status === 'past_due' || s.status === 'unpaid' ? `<div class="bl-note err" style="margin-top:10px;">${L('Le dernier paiement a échoué. Mettez à jour votre carte pour éviter une interruption du service.', 'The last payment failed. Update your card to avoid a service interruption.')}</div>` : ''}
                ${d.upcoming ? `<div class="bl-dim" style="margin-top:8px;">${L('Prochaine facture', 'Next invoice')} : <strong style="color:var(--text-main,#fff);">${money(d.upcoming.total)}</strong> ${L('le', 'on')} ${date(d.upcoming.date)}</div>` : ''}
                <div class="bl-row" style="margin-top:14px;"><button class="bl-btn" id="bl-portal"><span class="material-icons">credit_card</span> ${L('Paiement, factures et résiliation', 'Payment, invoices and cancellation')}</button></div>
            </div>
            <div class="bl-card">
                <div class="bl-row" data-tip-host><div class="bl-title" style="flex:1;">${L('Utilisation ce mois-ci', 'Usage this month')}</div>${tip(L(`Une conversation IA = un client à qui l'assistant a répondu pendant la période de facturation, peu importe le nombre de messages. Au-delà de ${u.included} conversations, chacune coûte ${money(c.overage.unitPrice)}, ajouté à la facture suivante.`, `One AI conversation = one customer the assistant replied to during the billing period, whatever the number of messages. Beyond ${u.included} conversations, each one costs ${money(c.overage.unitPrice)}, added to the next invoice.`))}</div>
                <div style="margin:10px 0 6px;"><span class="bl-big">${u.used}</span> <span class="bl-dim">/ ${u.included} ${L('conversations IA', 'AI conversations')}</span></div>
                <div class="bl-bar"><div style="width:${pct}%; background:${barColor};"></div></div>
                <div class="bl-dim" style="margin-top:8px;">${s.periodEnd ? `${L('Remise à zéro le', 'Resets on')} ${date(s.periodEnd)}. ` : ''}${u.overage ? `<span style="color:#ef4444; font-weight:600;">${L(`${u.overage} conversations au-delà du quota : environ ${money(u.overageEstimate)} sur la prochaine facture.`, `${u.overage} conversations over the quota: about ${money(u.overageEstimate)} on the next invoice.`)}</span>` : pct >= 80 ? `<span style="color:#f5a524; font-weight:600;">${L('Vous approchez de votre quota.', 'You are close to your quota.')}</span>` : ''}</div>
            </div>
            ${c.options.length ? `
            <div class="bl-card">
                <div class="bl-row" data-tip-host style="margin-bottom:6px;"><div class="bl-title" style="flex:1;">${L('Options', 'Add-ons')}</div>${tip(L('Ajoutez ou retirez une option à tout moment. Le montant est ajusté au prorata sur votre prochaine facture.', 'Add or remove an add-on at any time. The amount is prorated on your next invoice.'))}</div>
                ${c.options.map(o => `
                    <div class="bl-opt">
                        <span style="flex:1; min-width:0;"><strong>${esc(o.name)}</strong><br><span class="bl-dim">${esc(o.description)} · ${money(o.monthly)}/${L('mois', 'mo')}</span></span>
                        <label class="bl-switch"><input type="checkbox" data-opt="${esc(o.key)}" ${s.options.includes(o.key) ? 'checked' : ''}><span></span></label>
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
        const checkout = async (btn, copy) => {
            btn.disabled = true;
            try {
                const { url } = await call(`/projects/${opts.projectId}/checkout`, {
                    method: 'POST',
                    body: { options: [...state.picked], withSetup: state.withSetup, returnTo: opts.returnTo || `${window.location.origin}${window.location.pathname}` }
                });
                if (copy) {
                    await navigator.clipboard.writeText(url).catch(() => { });
                    notice('ok', `${L('Lien de paiement copié. Envoyez-le à votre client :', 'Checkout link copied. Send it to your client:')}<br><code style="word-break:break-all; font-size:.75rem;">${esc(url)}</code>`);
                    btn.disabled = false;
                } else window.location.href = url;
            } catch (e) { notice('err', esc(e.message)); btn.disabled = false; }
        };
        container.querySelector('#bl-subscribe')?.addEventListener('click', (e) => checkout(e.currentTarget, false));
        container.querySelector('#bl-copy')?.addEventListener('click', (e) => checkout(e.currentTarget, true));
        container.querySelector('#bl-portal')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            try {
                const { url } = await call(`/projects/${opts.projectId}/portal`, { method: 'POST', body: { returnTo: `${window.location.origin}${window.location.pathname}` } });
                window.location.href = url;
            } catch (err) { notice('err', esc(err.message)); btn.disabled = false; }
        });
        container.querySelectorAll('[data-opt]').forEach(input => input.addEventListener('change', async () => {
            const o = d.catalog.options.find(x => x.key === input.dataset.opt);
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

    load();
}

/** ERP staff: edit the offer and publish it to Stripe. */
export function renderCatalogEditor(container, opts) {
    const call = api(opts.apiBase, opts.getToken);
    let cat = null;

    container.innerHTML = `<style>${STYLES}</style><div class="bl"><div id="bc-notice"></div><div id="bc-body" class="bl-dim">${L('Chargement…', 'Loading…')}</div></div>`;
    bindTips(container);
    const notice = (type, html) => { container.querySelector('#bc-notice').innerHTML = html ? `<div class="bl-note ${type}">${html}</div>` : ''; };
    const field = (label, name, value, type = 'text', step = '') => `<label class="bl-field">${label}<input class="bl-input" name="${name}" type="${type}" ${step ? `step="${step}"` : ''} value="${esc(value)}"></label>`;

    function render() {
        const body = container.querySelector('#bc-body');
        body.className = '';
        body.innerHTML = `
            <form id="bc-form" class="bl" style="max-width:none;">
                <div class="bl-card">
                    <div class="bl-row" data-tip-host><div class="bl-title" style="flex:1;">${L('Catalogue de l\'offre (tous les clients)', 'Offer catalog (all clients)')}</div>
                        <span class="bl-chip ${cat.stripe?.basePrice ? 'ok' : 'warn'}">${cat.stripe?.basePrice ? L('Publié dans Stripe', 'Published to Stripe') : L('Non publié', 'Not published')}</span>
                        ${tip(L('Modifiez les prix puis cliquez « Enregistrer et publier ». Un prix modifié crée un nouveau prix Stripe pour les nouveaux abonnements ; les abonnements existants gardent leur prix tant que vous ne les migrez pas.', 'Edit the prices then click "Save and publish". A changed price creates a new Stripe price for new subscriptions; existing subscriptions keep their price until you migrate them.'))}</div>
                </div>
                <div class="bl-card">
                    <div class="bl-title" style="margin-bottom:10px;">${L('Forfait de base', 'Base plan')}</div>
                    <div class="bl-grid">
                        ${field(L('Nom', 'Name'), 'base.name', cat.base.name)}
                        ${field(L('Prix mensuel ($)', 'Monthly price ($)'), 'base.monthly', cat.base.monthly, 'number', '0.01')}
                        ${field(L('Conversations IA incluses / mois', 'AI conversations included / month'), 'base.includedConversations', cat.base.includedConversations, 'number', '1')}
                    </div>
                    <label class="bl-field" style="margin-top:10px;">${L('Description', 'Description')}<textarea class="bl-input" name="base.description" rows="2">${esc(cat.base.description)}</textarea></label>
                </div>
                <div class="bl-card">
                    <div class="bl-title" style="margin-bottom:10px;">${L('Installation et dépassement', 'Setup and overage')}</div>
                    <div class="bl-grid">
                        ${field(L('Frais d\'installation : nom', 'Setup fee: name'), 'setupFee.name', cat.setupFee.name)}
                        ${field(L('Frais d\'installation ($, 0 = aucun)', 'Setup fee ($, 0 = none)'), 'setupFee.amount', cat.setupFee.amount, 'number', '0.01')}
                        ${field(L('Prix par conversation au-delà du quota ($)', 'Price per conversation over quota ($)'), 'overage.unitPrice', cat.overage.unitPrice, 'number', '0.01')}
                    </div>
                    <label class="bl-row" style="margin-top:12px; cursor:pointer;"><span class="bl-switch"><input type="checkbox" name="automaticTax" ${cat.automaticTax ? 'checked' : ''}><span></span></span><span class="bl-dim">${L('Taxes automatiques Stripe Tax (à activer d\'abord dans Stripe)', 'Automatic taxes with Stripe Tax (turn it on in Stripe first)')}</span></label>
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
        body.querySelector('#bc-add').addEventListener('click', () => {
            body.querySelector('#bc-options').insertAdjacentHTML('beforeend', optionRow({ key: '', name: '', description: '', monthly: 0, extraConversations: 0 }));
        });
        body.querySelector('#bc-options').addEventListener('click', (e) => { if (e.target.closest('[data-remove]')) e.target.closest('[data-option]').remove(); });
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const publish = e.submitter?.dataset.publish === '1';
            const v = (n) => form.querySelector(`[name="${n}"]`).value;
            const payload = {
                automaticTax: form.querySelector('[name=automaticTax]').checked,
                base: { name: v('base.name'), description: v('base.description'), monthly: v('base.monthly'), includedConversations: v('base.includedConversations') },
                setupFee: { name: v('setupFee.name'), amount: v('setupFee.amount') },
                overage: { unitPrice: v('overage.unitPrice') },
                options: [...form.querySelectorAll('[data-option]')].map(r => ({
                    key: r.querySelector('[name=key]').value, name: r.querySelector('[name=name]').value, description: r.querySelector('[name=description]').value,
                    monthly: r.querySelector('[name=monthly]').value, extraConversations: r.querySelector('[name=extra]').value
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
                    <label class="bl-field" style="grid-column:1/-1;">${L('Description', 'Description')}<input class="bl-input" name="description" value="${esc(o.description)}"></label>
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
