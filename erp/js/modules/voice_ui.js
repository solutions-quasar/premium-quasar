/**
 * Phone assistant card (voice agent) — client portal (Connect tab) and ERP (project "Voice" tab).
 * Shows the phone number, where alerts go, booking hours and recent calls. Staff can also link a Vapi number.
 * Talks to /api/voice (erp/backend/voice).
 */
import { tip, bindTips } from './mp_help.js';
import { STYLES } from './billing_ui.js?v=20261111';

const isEn = () => { if (window.MP_LANG) return window.MP_LANG !== 'fr'; try { return (localStorage.getItem('erp_lang') || 'en') !== 'fr'; } catch (_) { return true; } };
const L = (fr, en) => (isEn() ? en : fr);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = (iso) => iso ? new Date(iso).toLocaleString(isEn() ? 'en-CA' : 'fr-CA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const dur = (s) => { s = Number(s || 0); const m = Math.floor(s / 60); return m ? `${m} min ${String(s % 60).padStart(2, '0')}` : `${s} s`; };
const phone = (n) => { const d = String(n || '').replace(/\D/g, ''); return d.length === 11 && d[0] === '1' ? `+1 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7)}` : (n || ''); };

const TIME_ZONES = ['America/St_Johns', 'America/Halifax', 'America/Moncton', 'America/Toronto', 'America/Winnipeg', 'America/Regina', 'America/Edmonton', 'America/Vancouver', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/Paris'];
const DAYS = () => [[1, L('Lun', 'Mon')], [2, L('Mar', 'Tue')], [3, L('Mer', 'Wed')], [4, L('Jeu', 'Thu')], [5, L('Ven', 'Fri')], [6, L('Sam', 'Sat')], [0, L('Dim', 'Sun')]];

function api(apiBase, getToken) {
    return async (path, { method = 'GET', body } = {}) => {
        const token = await getToken();
        const res = await fetch(`${apiBase}/api/voice${path}`, {
            method,
            headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    };
}

/**
 * @param {HTMLElement} container
 * @param {{ projectId: string, apiBase: string, getToken: () => Promise<string>, isStaff: boolean }} opts
 */
export function renderVoice(container, opts) {
    const call = api(opts.apiBase, opts.getToken);
    let d = null, numbers = null;
    container.innerHTML = `<style>${STYLES}</style><div class="bl" style="max-width:none;"><div id="vc-notice"></div><div id="vc-body" class="bl-dim">${L('Chargement…', 'Loading…')}</div></div>`;
    const notice = (type, html) => { container.querySelector('#vc-notice').innerHTML = html ? `<div class="bl-note ${type}">${html}</div>` : ''; };

    async function load() {
        try {
            d = await call(`/projects/${opts.projectId}`);
            if (opts.isStaff && !numbers) numbers = (await call('/numbers').catch(() => ({ numbers: [] }))).numbers;
            render();
        } catch (e) { container.querySelector('#vc-body').innerHTML = `<div class="bl-note err">${esc(e.message)}</div>`; }
    }

    function statusChip() {
        if (!d.agent) return `<span class="bl-chip off">${L('Pas encore configuré', 'Not set up yet')}</span>`;
        if (!d.allowed) return `<span class="bl-chip err">${L('Option non active', 'Add-on not active')}</span>`;
        if (!d.phoneNumber) return `<span class="bl-chip warn">${L('Numéro à venir', 'Number coming soon')}</span>`;
        return `<span class="bl-chip ok">${L('En service', 'Live')}</span>`;
    }

    function render() {
        const s = d.settings;
        const body = container.querySelector('#vc-body');
        body.className = '';
        const reasonText = d.reason === 'voice_option_off' ? L('L\'option « Agent vocal » n\'est pas dans votre abonnement : les appels ne sont pas pris. Ajoutez-la dans l\'onglet Subscription.', 'The "Voice agent" add-on is not in your subscription: calls are not answered. Add it in the Subscription tab.')
            : d.reason === 'subscription_inactive' ? L('Votre abonnement n\'est pas actif : les appels ne sont pas pris.', 'Your subscription is not active: calls are not answered.') : '';
        const numberOptions = (numbers || []).map(n => `<option value="${esc(n.id)}" ${n.id === s.vapiPhoneNumberId ? 'selected' : ''} ${n.linkedTo && n.linkedTo.projectId !== opts.projectId ? 'disabled' : ''}>${esc(phone(n.number) || n.id)}${n.name ? ` · ${esc(n.name)}` : ''}${n.linkedTo && n.linkedTo.projectId !== opts.projectId ? ` (${esc(n.linkedTo.name)})` : ''}</option>`).join('');

        body.innerHTML = `
            <div class="bl-card">
                <div class="bl-row" data-tip-host>
                    <span class="material-icons" style="color:#a855f7; font-size:1.8rem;">support_agent</span>
                    <div style="flex:1; min-width:180px;">
                        <div class="bl-title">${L('Assistant téléphonique', 'Phone assistant')}</div>
                        <div class="bl-dim">${L('Répond à vos appels, prend les rendez-vous et vous envoie un résumé de chaque appel.', 'Answers your calls, books appointments and sends you a summary of every call.')}</div>
                    </div>
                    ${statusChip()}
                    ${tip(L('Chaque appel apparaît dans l\'onglet Messages (canal « Appel ») avec son résumé. Vous recevez aussi une alerte par texto et/ou courriel, selon les réglages ci-dessous.', 'Every call shows in the Messages tab ("Call" channel) with its summary. You also get a text and/or email alert, based on the settings below.'))}
                </div>
                ${reasonText ? `<div class="bl-note err" style="margin-top:12px;">${reasonText}</div>` : ''}
                <div class="bl-row" style="margin-top:14px;">
                    <div style="flex:1; min-width:200px;">
                        <div class="bl-dim">${L('Votre numéro', 'Your number')}</div>
                        <div style="font-size:1.35rem; font-weight:800;">${d.phoneNumber ? esc(phone(d.phoneNumber)) : `<span class="bl-dim" style="font-size:.9rem; font-weight:600;">${L('L\'équipe Quasar vous attribue un numéro.', 'The Quasar team assigns you a number.')}</span>`}</div>
                    </div>
                    ${d.phoneNumber ? `<a class="bl-btn ghost" href="tel:${esc(d.phoneNumber)}" style="text-decoration:none;"><span class="material-icons">call</span> ${L('Tester', 'Test')}</a>` : ''}
                </div>
                ${d.phoneNumber ? `<div class="bl-dim" style="margin-top:10px;">${L('Astuce : gardez votre numéro actuel et renvoyez-y vos appels (renvoi d\'appel chez votre fournisseur), par exemple quand vous ne répondez pas ou en dehors des heures.', 'Tip: keep your current number and forward calls to this one (call forwarding with your phone provider), for example when you don\'t answer or after hours.')}</div>` : ''}
                ${opts.isStaff ? `
                <div class="bl-card" style="margin-top:14px; border-color:rgba(223,165,58,.4);">
                    <div class="bl-title" style="font-size:.95rem;">${L('Quasar : numéro et agent', 'Quasar: number and agent')}</div>
                    <div class="bl-dim" style="margin:4px 0 10px;">${d.agent ? L(`Agent vocal : ${esc(d.agent.name)}${d.agent.active ? '' : ' (désactivé)'}`, `Voice agent: ${esc(d.agent.name)}${d.agent.active ? '' : ' (off)'}`) : L('Aucun agent vocal : créez un agent avec la voix activée (Agents IA).', 'No voice agent: create an agent with voice turned on (AI Agents).')}</div>
                    <div class="bl-row">
                        <select class="bl-input" id="vc-number" style="flex:1; min-width:220px;"><option value="">${L('Choisir un numéro Vapi…', 'Pick a Vapi number…')}</option>${numberOptions}</select>
                        <button class="bl-btn" id="vc-link" ${d.agent ? '' : 'disabled'}><span class="material-icons">link</span> ${L('Relier', 'Link')}</button>
                        ${s.vapiPhoneNumberId ? `<button class="bl-btn ghost" id="vc-unlink"><span class="material-icons">link_off</span> ${L('Détacher', 'Unlink')}</button>` : ''}
                    </div>
                    <div class="bl-dim" style="margin-top:8px;">${L('Relier un numéro le fait passer par le serveur Quasar : le bon agent répond, l\'abonnement est vérifié et les minutes sont comptées.', 'Linking a number routes it through the Quasar server: the right agent answers, the subscription is checked and minutes are counted.')}</div>
                </div>` : ''}
            </div>

            <form class="bl-card" id="vc-form">
                <div class="bl-row" data-tip-host style="margin-bottom:10px;"><div class="bl-title" style="flex:1;">${L('Alertes et rendez-vous', 'Alerts and appointments')}</div>
                    ${tip(L('Les rendez-vous sont pris dans votre Google Agenda (connectez-le plus bas sur cette page), seulement aux heures indiquées ici et quand vous êtes libre.', 'Appointments go into your Google Calendar (connect it further down this page), only during the hours set here and when you are free.'))}</div>
                ${!s.alertPhone && !s.alertEmail ? `<div class="bl-note err" style="margin-bottom:12px;">${L('Personne n\'est prévenu des messages laissés au téléphone : remplissez au moins un texto ou un courriel d\'alerte. Les messages restent visibles dans l\'onglet Messages.', 'Nobody is told about messages left on the phone: fill in at least a text or an email alert. Messages stay visible in the Messages tab.')}</div>` : ''}
                <div class="bl-grid">
                    <label class="bl-field">${L('Texto d\'alerte au', 'Text alerts to')}<input class="bl-input" name="alertPhone" type="tel" placeholder="+1 506 555-0123" value="${esc(s.alertPhone)}"></label>
                    <label class="bl-field">${L('Courriel d\'alerte', 'Alert email')}<input class="bl-input" name="alertEmail" type="email" placeholder="vous@entreprise.ca" value="${esc(s.alertEmail)}"></label>
                    <label class="bl-field">${L('Fuseau horaire', 'Time zone')}<select class="bl-input" name="timeZone">${[...new Set([s.timeZone, ...TIME_ZONES])].map(z => `<option ${z === s.timeZone ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select></label>
                    <label class="bl-field">${L('Durée d\'un rendez-vous (min)', 'Appointment length (min)')}<input class="bl-input" name="slotMinutes" type="number" min="10" max="240" step="5" value="${esc(s.slotMinutes)}"></label>
                    <label class="bl-field">${L('Ouverture (heure)', 'Opens (hour)')}<input class="bl-input" name="startHour" type="number" min="0" max="23" value="${esc(s.startHour)}"></label>
                    <label class="bl-field">${L('Fermeture (heure)', 'Closes (hour)')}<input class="bl-input" name="endHour" type="number" min="1" max="24" value="${esc(s.endHour)}"></label>
                    <label class="bl-field">${L('Délai minimum (heures)', 'Minimum notice (hours)')}<input class="bl-input" name="minNoticeHours" type="number" min="0" max="168" value="${esc(s.minNoticeHours)}"></label>
                </div>
                <div class="bl-row" style="margin-top:12px;">${DAYS().map(([n, l]) => `<label class="bl-chip ${s.days.includes(n) ? 'ok' : 'off'}" style="cursor:pointer; padding:6px 12px;"><input type="checkbox" name="day" value="${n}" ${s.days.includes(n) ? 'checked' : ''} style="display:none;">${l}</label>`).join('')}</div>
                <div class="bl-row" style="margin-top:10px;">
                    <span class="bl-chip ${d.calendarConnected ? 'ok' : 'warn'}" style="white-space:normal; line-height:1.4; padding:4px 10px;">${d.calendarConnected ? L('Google Agenda connecté', 'Google Calendar connected') : L('Google Agenda non connecté : l\'assistant prend un message au lieu de réserver', 'Google Calendar not connected: the assistant takes a message instead of booking')}</span>
                </div>
                <div class="bl-row" style="margin-top:14px;"><button type="submit" class="bl-btn"><span class="material-icons">save</span> ${L('Enregistrer', 'Save')}</button></div>
            </form>

            <div class="bl-card">
                <div class="bl-title" style="margin-bottom:6px;">${L('Derniers appels', 'Recent calls')}</div>
                ${d.calls.length ? d.calls.map(c => `
                    <div class="bl-inv" style="align-items:flex-start;">
                        <span class="material-icons" style="color:#a855f7;">call_received</span>
                        <span style="flex:1; min-width:180px;"><strong>${esc(phone(c.caller))}</strong> <span class="bl-dim">· ${when(c.endedAt)} · ${dur(c.durationSeconds)}</span><br><span class="bl-dim">${esc(c.summary || L('Pas de résumé.', 'No summary.'))}</span></span>
                    </div>`).join('') : `<div class="bl-dim">${L('Aucun appel pour le moment.', 'No calls yet.')}</div>`}
            </div>`;
        bindTips(body);

        body.querySelectorAll('[name=day]').forEach(i => i.addEventListener('change', () => { i.parentElement.className = `bl-chip ${i.checked ? 'ok' : 'off'}`; }));
        body.querySelector('#vc-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const f = e.currentTarget;
            const v = (n) => f.querySelector(`[name=${n}]`).value;
            const btn = e.submitter; if (btn) btn.disabled = true;
            try {
                await call(`/projects/${opts.projectId}/settings`, {
                    method: 'PUT',
                    body: { alertPhone: v('alertPhone'), alertEmail: v('alertEmail'), timeZone: v('timeZone'), slotMinutes: v('slotMinutes'), startHour: v('startHour'), endHour: v('endHour'), minNoticeHours: v('minNoticeHours'), days: [...f.querySelectorAll('[name=day]:checked')].map(i => Number(i.value)) }
                });
                notice('ok', L('Réglages enregistrés.', 'Settings saved.'));
                await load();
            } catch (err) { notice('err', esc(err.message)); if (btn) btn.disabled = false; }
        });
        body.querySelector('#vc-link')?.addEventListener('click', async (e) => {
            const id = body.querySelector('#vc-number').value;
            if (!id) return notice('err', L('Choisissez un numéro.', 'Pick a number.'));
            e.currentTarget.disabled = true;
            try { const r = await call(`/projects/${opts.projectId}/number`, { method: 'POST', body: { numberId: id } }); numbers = null; notice('ok', L(`Numéro ${esc(phone(r.number))} relié à ce projet.`, `Number ${esc(phone(r.number))} linked to this project.`)); await load(); }
            catch (err) { notice('err', esc(err.message)); e.currentTarget.disabled = false; }
        });
        body.querySelector('#vc-unlink')?.addEventListener('click', async (e) => {
            e.currentTarget.disabled = true;
            try { await call(`/projects/${opts.projectId}/number`, { method: 'DELETE' }); numbers = null; notice('ok', L('Numéro détaché.', 'Number unlinked.')); await load(); }
            catch (err) { notice('err', esc(err.message)); e.currentTarget.disabled = false; }
        });
    }

    load();
}
