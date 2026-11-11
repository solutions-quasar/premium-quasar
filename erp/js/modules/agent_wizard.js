/**
 * Agent setup wizard and per-project setup checklist (ERP › AI Agents).
 *
 * - openAgentWizard(): a series of screens, one topic per screen, with a clear explanation and an example
 *   under every field. Collects the business sheet, writes the instructions with AI, chooses where the
 *   agent answers (messaging channels, phone, website widget), creates the agent, lets you test it, then
 *   turns it on.
 * - renderSetupChecklist(): "Client setup x/9" card, ticked automatically from real data, each missing
 *   item with a button to the right place. Optional items (phone, widget) can be marked "not for this client".
 */
import { db } from '../firebase-config.js';
import { collection, query, where, getDocs, getDoc, addDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const isEn = () => { try { return (localStorage.getItem('erp_lang') || 'en') !== 'fr'; } catch (_) { return true; } };
const L = (fr, en) => (isEn() ? en : fr);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = (m, t = 'success') => (window.showToast ? window.showToast(m, t) : console.log(m));

const STYLES = `
.wz-overlay { position:fixed; inset:0; z-index:3000; background:rgba(0,0,0,.82); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:20px; }
.wz { width:min(820px, 100%); max-height:94vh; display:flex; flex-direction:column; background:var(--bg-card, #15171c); border:1px solid rgba(223,165,58,.4); border-radius:16px; overflow:hidden; color:var(--text, #f0f2f5); }
.wz-head { padding:16px 20px 12px; border-bottom:1px solid var(--border, #2d3139); }
.wz-top { display:flex; align-items:center; gap:10px; }
.wz-title { font-weight:800; font-size:1.15rem; flex:1; }
.wz-step { font-size:.75rem; color:var(--gold, #dfa53a); font-weight:700; text-transform:uppercase; letter-spacing:.06em; }
.wz-bar { height:6px; background:rgba(255,255,255,.07); border-radius:6px; overflow:hidden; margin-top:10px; }
.wz-bar > div { height:100%; background:var(--gold, #dfa53a); border-radius:6px; transition:width .25s; }
.wz-body { padding:18px 20px; overflow-y:auto; flex:1; }
.wz-intro { color:var(--text-muted, #a0a5b0); font-size:.9rem; line-height:1.5; margin-bottom:16px; }
.wz-field { margin-bottom:18px; }
.wz-label { font-weight:700; font-size:.9rem; margin-bottom:4px; display:flex; gap:6px; align-items:center; }
.wz-req { color:var(--gold, #dfa53a); }
.wz-help { color:var(--text-muted, #a0a5b0); font-size:.8rem; line-height:1.45; margin-bottom:6px; }
.wz-help b { color:var(--text, #f0f2f5); font-weight:600; }
.wz-input { width:100%; box-sizing:border-box; background:var(--bg-dark, #0d0f12); border:1px solid var(--border, #2d3139); color:inherit; border-radius:10px; padding:11px 12px; font-size:.92rem; font-family:inherit; }
.wz-input:focus { outline:none; border-color:var(--gold, #dfa53a); }
textarea.wz-input { resize:vertical; min-height:84px; line-height:1.45; }
.wz-box { border:1px solid var(--border, #2d3139); border-radius:12px; padding:14px; margin-bottom:14px; background:var(--bg-dark, #0d0f12); }
.wz-box.on { border-color:rgba(223,165,58,.55); }
.wz-check { display:flex; gap:10px; align-items:flex-start; cursor:pointer; font-weight:700; }
.wz-check input { width:18px; height:18px; margin-top:2px; accent-color:var(--gold, #dfa53a); flex-shrink:0; }
.wz-foot { display:flex; gap:10px; align-items:center; padding:12px 20px; border-top:1px solid var(--border, #2d3139); }
.wz-foot .grow { flex:1; font-size:.8rem; color:var(--text-muted, #a0a5b0); }
.wz-btn { border:0; border-radius:10px; padding:0 18px; min-height:44px; font-weight:700; cursor:pointer; background:var(--gold, #dfa53a); color:#000; display:inline-flex; align-items:center; gap:6px; font-size:.9rem; }
.wz-btn.ghost { background:transparent; color:inherit; border:1px solid var(--border, #2d3139); }
.wz-btn:disabled { opacity:.5; cursor:not-allowed; }
.wz-err { background:#ef444414; border:1px solid #ef444455; border-radius:10px; padding:10px 12px; font-size:.85rem; margin-bottom:12px; }
.wz-ok { background:#3ecf8e14; border:1px solid #3ecf8e55; border-radius:10px; padding:10px 12px; font-size:.85rem; margin-bottom:12px; }
.wz-list { margin:0 0 6px 18px; padding:0; color:var(--text-muted, #a0a5b0); font-size:.88rem; line-height:1.7; }
.wz-chat { height:280px; overflow-y:auto; border:1px solid var(--border, #2d3139); border-radius:10px; padding:12px; background:var(--bg-dark, #0d0f12); display:flex; flex-direction:column; gap:8px; }
.wz-msg { padding:9px 12px; border-radius:12px; max-width:80%; font-size:.88rem; line-height:1.4; white-space:pre-wrap; }
.wz-msg.user { align-self:flex-end; background:var(--gold, #dfa53a); color:#000; }
.wz-msg.ai { align-self:flex-start; background:#2a2d36; }
.wz-chips { display:flex; gap:6px; flex-wrap:wrap; margin:8px 0; }
.wz-chip { border:1px solid var(--border, #2d3139); background:transparent; color:inherit; border-radius:20px; padding:6px 12px; font-size:.8rem; cursor:pointer; }
.wz-chip:hover { border-color:var(--gold, #dfa53a); }
.wz-sum { display:flex; gap:10px; align-items:flex-start; padding:8px 0; border-top:1px solid var(--border, #2d3139); font-size:.88rem; }
.wz-sum:first-child { border-top:0; }
.wz-field.pre .wz-input { border-color:#f5a524; background:rgba(245,165,36,.06); }
.wz-pre { display:inline-flex; align-items:center; gap:4px; font-size:.72rem; font-weight:700; color:#f5a524; margin-bottom:5px; }
.wz-auto { border:1px solid rgba(223,165,58,.45); background:rgba(223,165,58,.06); border-radius:12px; padding:14px; margin-bottom:18px; }
.wz-auto-row { display:grid; grid-template-columns:2fr 1fr auto; gap:8px; align-items:end; }
@media (max-width: 640px) { .wz-auto-row { grid-template-columns:1fr; } }
@media (max-width: 640px) { .wz-overlay { padding:0; } .wz { max-height:100dvh; height:100dvh; border-radius:0; } .wz-foot { flex-wrap:wrap; } .wz-foot .grow { flex-basis:100%; order:3; } }
`;

function api(apiBase, getToken) {
    return async (path, { method = 'GET', body } = {}) => {
        const token = await getToken();
        const res = await fetch(`${apiBase}${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.error || data.message || `HTTP ${res.status}`);
        return data;
    };
}

const CHANNEL_NAMES = { facebook: 'Messenger', instagram: 'Instagram', whatsapp: 'WhatsApp', sms: 'SMS', email: () => L('Courriel', 'Email') };
const channelName = (t) => { const n = CHANNEL_NAMES[t]; return typeof n === 'function' ? n() : (n || t); };

// =====================================================================
// WIZARD
// =====================================================================

/**
 * @param {{ projectId: string, project: object, apiBase: string, getToken: () => Promise<string>, onDone?: (agentId) => void }} opts
 */
export function openAgentWizard(opts) {
    const call = api(opts.apiBase, opts.getToken);
    const project = opts.project || {};
    const s = {
        step: 0,
        brief: { businessName: project.clientName ? String(project.clientName).replace(/\s*\(.*\)\s*$/, '') : (project.name || ''), activity: '', location: '', contact: '', hours: '', services: '', prices: '', booking: '', policies: '', faq: '', extra: '', agentName: '', tone: '', languages: '' },
        model: 'gpt-4o-mini',
        prompt: '',
        channels: null,        // loaded on the "where" step
        pickedChannels: new Set(),
        voice: false, greeting: 'Hello, thanks for calling! How can I help you today?', alertPhone: '', alertEmail: '',
        widget: false, color: '#dfa53a', welcome: L('Bonjour ! Comment puis-je vous aider ?', 'Hello! How can I help you today?'),
        agentId: null, vapiAssistantId: null, saved: false, tested: false, activate: true,
        chat: [], error: '',
        auto: { website: '', city: '' }, prefilled: {}, autoSummary: ''
    };
    const SOURCE_LABEL = { google: () => L('Google Maps', 'Google Maps'), website: () => L('le site web', 'the website'), facebook: () => L('la Page Facebook', 'the Facebook Page'), web: () => L('une recherche web', 'a web search') };

    const STEPS = [
        { key: 'intro', title: L('Créer un agent pas à pas', 'Create an agent step by step') },
        { key: 'business', title: L('L\'entreprise', 'The business') },
        { key: 'offer', title: L('Horaires, services et prix', 'Hours, services and prices') },
        { key: 'rules', title: L('Règles et questions fréquentes', 'Rules and frequent questions') },
        { key: 'assistant', title: L('La personnalité de l\'assistant', 'The assistant\'s personality') },
        { key: 'prompt', title: L('Les instructions', 'The instructions') },
        { key: 'where', title: L('Où il répond', 'Where it answers') },
        { key: 'test', title: L('Création et test', 'Create and test') },
        { key: 'done', title: L('Mise en service', 'Go live') }
    ];

    const overlay = document.createElement('div');
    overlay.className = 'wz-overlay';
    overlay.innerHTML = `<style>${STYLES}</style><div class="wz" role="dialog" aria-modal="true"></div>`;
    document.body.appendChild(overlay);
    const box = overlay.querySelector('.wz');
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape' && !s.agentId) close(); };
    document.addEventListener('keydown', onKey);

    // ---------- Field helper: label, explanation of what to write, example ----------
    const field = (key, label, help, example, { type = 'input', required = false, rows = 4, value } = {}) => {
        const v = value !== undefined ? value : s.brief[key];
        const pre = s.prefilled[key];
        return `
            <div class="wz-field ${pre ? 'pre' : ''}">
                <div class="wz-label">${label}${required ? ' <span class="wz-req">*</span>' : ''}</div>
                <div class="wz-help">${help}</div>
                ${pre ? `<div class="wz-pre"><span class="material-icons" style="font-size:.9rem;">auto_awesome</span>${L('Pré-rempli depuis', 'Pre-filled from')} ${SOURCE_LABEL[pre] ? SOURCE_LABEL[pre]() : pre} · ${L('à vérifier', 'please check')}</div>` : ''}
                ${type === 'textarea'
                ? `<textarea class="wz-input" data-k="${key}" rows="${rows}" placeholder="${esc(example)}">${esc(v)}</textarea>`
                : `<input class="wz-input" data-k="${key}" placeholder="${esc(example)}" value="${esc(v)}">`}
            </div>`;
    };
    const collect = () => {
        box.querySelectorAll('[data-k]').forEach(el => { if (el.dataset.k in s.brief) s.brief[el.dataset.k] = el.value.trim(); });
        const get = (id) => box.querySelector(`#${id}`);
        if (get('wz-model')) s.model = get('wz-model').value;
        if (get('wz-prompt')) s.prompt = get('wz-prompt').value;
        if (get('wz-voice')) s.voice = get('wz-voice').checked;
        if (get('wz-greeting')) s.greeting = get('wz-greeting').value.trim();
        if (get('wz-alert-phone')) s.alertPhone = get('wz-alert-phone').value.trim();
        if (get('wz-alert-email')) s.alertEmail = get('wz-alert-email').value.trim();
        if (get('wz-widget')) s.widget = get('wz-widget').checked;
        if (get('wz-color')) s.color = get('wz-color').value;
        if (get('wz-welcome')) s.welcome = get('wz-welcome').value.trim();
        box.querySelectorAll('[data-ch]').forEach(el => el.checked ? s.pickedChannels.add(el.dataset.ch) : s.pickedChannels.delete(el.dataset.ch));
        if (get('wz-activate')) s.activate = get('wz-activate').checked;
    };

    // ---------- Screens ----------
    const screens = {
        intro: () => `
            <div class="wz-intro">${L('Ce parcours vous guide écran par écran. Chaque champ explique quoi écrire, avec un exemple. Comptez environ 10 minutes.', 'This guide takes you screen by screen. Each field explains what to write, with an example. Allow about 10 minutes.')}</div>
            <div class="wz-box">
                <div class="wz-label">${L('Ce que nous allons faire', 'What we will do')}</div>
                <ol class="wz-list">
                    <li>${L('Décrire l\'entreprise, ses horaires, services et prix', 'Describe the business, its hours, services and prices')}</li>
                    <li>${L('Donner les règles et les questions fréquentes', 'Give the rules and frequent questions')}</li>
                    <li>${L('Choisir la personnalité de l\'assistant', 'Choose the assistant\'s personality')}</li>
                    <li>${L('Laisser l\'IA écrire les instructions, puis les relire', 'Let AI write the instructions, then review them')}</li>
                    <li>${L('Choisir où il répond : messagerie, téléphone, site web', 'Choose where it answers: messaging, phone, website')}</li>
                    <li>${L('Le tester, puis l\'activer', 'Test it, then turn it on')}</li>
                </ol>
            </div>
            <div class="wz-box">
                <div class="wz-label">${L('À avoir sous la main', 'Have at hand')}</div>
                <div class="wz-help" style="margin:0;">${L('Les horaires, la liste des services avec les prix, l\'adresse, le numéro et le courriel du client, ses politiques (garantie, annulation) et les questions que ses clients posent le plus souvent.', 'Opening hours, the list of services with prices, the client\'s address, phone and email, their policies (warranty, cancellation) and the questions their customers ask most.')}</div>
            </div>`,

        business: () => `
            <div class="wz-auto">
                <div class="wz-label"><span class="material-icons" style="font-size:1.1rem; color:var(--gold);">auto_awesome</span>${L('Remplir automatiquement', 'Fill in automatically')}</div>
                <div class="wz-help">${L('Donnez le site web du client, ou son nom (champ ci-dessous) et sa ville. Quasar cherche sur Google Maps, sur son site, sur sa Page Facebook si elle est connectée et sur le web, puis remplit les champs de tout le parcours. <b>Seulement ce qui est trouvé</b> : le reste reste vide. Les champs remplis sont surlignés en orange pour que vous les vérifiiez.', 'Give the client\'s website, or their name (field below) and town. Quasar searches Google Maps, their website, their Facebook Page if connected and the web, then fills in the fields of the whole guide. <b>Only what is found</b>: the rest stays empty. Filled fields are highlighted in orange so you check them.')}</div>
                <div class="wz-auto-row">
                    <label><div class="wz-help" style="margin:0 0 4px;">${L('Site web', 'Website')}</div><input class="wz-input" id="wz-auto-site" placeholder="garageleblanc.ca" value="${esc(s.auto.website)}"></label>
                    <label><div class="wz-help" style="margin:0 0 4px;">${L('Ville', 'Town')}</div><input class="wz-input" id="wz-auto-city" placeholder="Moncton" value="${esc(s.auto.city)}"></label>
                    <button class="wz-btn" id="wz-auto-go" type="button"><span class="material-icons" style="font-size:1.1rem;">travel_explore</span>${L('Rechercher', 'Search')}</button>
                </div>
                <div class="wz-help" id="wz-auto-status" style="margin:8px 0 0;">${s.autoSummary}</div>
            </div>
            <div class="wz-intro">${L('L\'assistant ne sait que ce que vous écrivez ici. S\'il manque une information, il dira au client qu\'il doit la vérifier, au lieu d\'inventer.', 'The assistant only knows what you write here. If something is missing, it tells the customer it must check, instead of making it up.')}</div>
            ${field('businessName', L('Nom de l\'entreprise', 'Business name'), L('Le nom que les clients connaissent, tel qu\'il apparaît sur l\'enseigne ou le site.', 'The name customers know, as it appears on the sign or website.'), L('ex. Garage Leblanc', 'e.g. Leblanc Garage'), { required: true })}
            ${field('activity', L('Activité', 'Activity'), L('En une phrase : <b>ce que fait l\'entreprise et pour qui</b>. Soyez précis, c\'est ce qui oriente toutes les réponses.', 'In one sentence: <b>what the business does and for whom</b>. Be specific: it guides every answer.'), L('ex. Réparation et entretien de tondeuses, souffleuses et VTT pour les particuliers', 'e.g. Repair and servicing of lawn mowers, snowblowers and ATVs for homeowners'), { required: true })}
            ${field('location', L('Adresse et zone desservie', 'Address and service area'), L('L\'adresse exacte et, si l\'entreprise se déplace, les villes ou la zone couvertes.', 'The exact address and, if the business travels, the towns or area covered.'), L('ex. 123 rue Main, Moncton (NB) · se déplace dans le Grand Moncton', 'e.g. 123 Main St, Moncton (NB) · travels across Greater Moncton'))}
            ${field('contact', L('Coordonnées à donner aux clients', 'Contact details to give customers'), L('Ce que l\'assistant peut communiquer : téléphone, courriel, site web. N\'écrivez que ce que le client accepte de rendre public.', 'What the assistant may share: phone, email, website. Only write what the client agrees to make public.'), L('ex. 506 555-1234 · info@garageleblanc.ca · garageleblanc.ca', 'e.g. 506 555-1234 · info@leblancgarage.ca · leblancgarage.ca'))}`,

        offer: () => `
            <div class="wz-intro">${L('Ce sont les questions les plus fréquentes des clients. Plus c\'est précis, moins l\'assistant doit renvoyer vers un humain.', 'These are the questions customers ask most. The more precise, the less the assistant has to refer to a human.')}</div>
            ${field('hours', L('Horaires d\'ouverture', 'Opening hours'), L('Jour par jour, avec les jours fermés et les exceptions (fériés, saison).', 'Day by day, with closed days and exceptions (holidays, season).'), L('ex. Lun-ven 8 h-17 h · Sam 9 h-12 h · Fermé dim et jours fériés', 'e.g. Mon-Fri 8am-5pm · Sat 9am-12pm · Closed Sun and holidays'), { type: 'textarea', rows: 3 })}
            ${field('services', L('Services et produits', 'Services and products'), L('<b>Un service par ligne</b>, avec une courte précision si utile.', '<b>One service per line</b>, with a short detail if useful.'), L('ex.\nEntretien de printemps des tondeuses\nAffûtage de lames\nRéparation de souffleuses', 'e.g.\nSpring mower tune-up\nBlade sharpening\nSnowblower repair'), { type: 'textarea', rows: 5 })}
            ${field('prices', L('Prix et tarifs', 'Prices and rates'), L('Les prix que l\'assistant peut annoncer. Indiquez « à partir de » ou « sur estimation » quand le prix varie. <b>Laissez vide si l\'entreprise ne veut pas donner de prix.</b>', 'Prices the assistant may quote. Write "from" or "quote required" when it varies. <b>Leave empty if the business doesn\'t want to give prices.</b>'), L('ex. Entretien tondeuse : 89 $ · Affûtage : 15 $ · Diagnostic : 30 $ (déduit de la réparation)', 'e.g. Mower tune-up: $89 · Sharpening: $15 · Diagnostic: $30 (deducted from the repair)'), { type: 'textarea', rows: 4 })}
            ${field('booking', L('Rendez-vous et commandes', 'Appointments and orders'), L('Comment un client prend rendez-vous ou commande : sur place, par téléphone, en ligne, délais habituels.', 'How a customer books or orders: walk-in, phone, online, usual lead times.'), L('ex. Sur rendez-vous seulement · délai d\'environ 1 semaine au printemps · l\'équipe rappelle pour confirmer', 'e.g. By appointment only · about 1 week wait in spring · the team calls back to confirm'), { type: 'textarea', rows: 3 })}`,

        rules: () => `
            <div class="wz-intro">${L('Ces règles évitent les mauvaises surprises : promesses que l\'entreprise ne tient pas, sujets à ne pas aborder, moments où un humain doit prendre le relais.', 'These rules prevent bad surprises: promises the business doesn\'t keep, topics to avoid, moments when a human must take over.')}</div>
            ${field('policies', L('Politiques', 'Policies'), L('Garantie, paiement accepté, annulation, dépôt, retour. Ce que l\'assistant doit respecter quand il répond.', 'Warranty, accepted payment, cancellation, deposit, returns. What the assistant must respect when answering.'), L('ex. Garantie 90 jours sur la main-d\'œuvre · Paiement comptant, débit, crédit · Annulation sans frais 24 h avant', 'e.g. 90-day labour warranty · Cash, debit, credit · Free cancellation 24 h before'), { type: 'textarea', rows: 3 })}
            ${field('faq', L('Questions fréquentes', 'Frequent questions'), L('Les questions que les clients posent le plus, <b>avec la bonne réponse</b>. Une question et sa réponse par ligne.', 'The questions customers ask most, <b>with the right answer</b>. One question and its answer per line.'), L('ex.\nQ : Venez-vous chercher la machine ? R : Oui, 40 $ dans le Grand Moncton.\nQ : Réparez-vous les marques chinoises ? R : Oui, sauf pièces introuvables.', 'e.g.\nQ: Do you pick up the machine? A: Yes, $40 within Greater Moncton.\nQ: Do you fix Chinese brands? A: Yes, unless parts are unavailable.'), { type: 'textarea', rows: 5 })}
            ${field('extra', L('À éviter et quand passer la main', 'What to avoid and when to hand over'), L('Ce que l\'assistant ne doit <b>jamais</b> faire ou promettre, et les cas où il doit dire qu\'un membre de l\'équipe va rappeler.', 'What the assistant must <b>never</b> do or promise, and the cases where it must say a team member will call back.'), L('ex. Ne jamais promettre une date de réparation · Plaintes et remboursements : dire que le propriétaire rappelle dans la journée', 'e.g. Never promise a repair date · Complaints and refunds: say the owner will call back the same day'), { type: 'textarea', rows: 3 })}`,

        assistant: () => `
            <div class="wz-intro">${L('Comment l\'assistant se présente et parle aux clients.', 'How the assistant introduces itself and talks to customers.')}</div>
            ${field('agentName', L('Prénom de l\'assistant', 'Assistant\'s first name'), L('Le nom sous lequel il se présente. Facultatif : sans nom, il dit « l\'assistant de [entreprise] ».', 'The name it introduces itself with. Optional: without a name it says "the [business] assistant".'), L('ex. Julie', 'e.g. Julie'))}
            ${field('tone', L('Ton', 'Tone'), L('Deux ou trois mots sur la façon de parler : vouvoiement ou tutoiement, chaleureux ou professionnel, phrases courtes.', 'Two or three words on how to talk: formal or casual, warm or professional, short sentences.'), L('ex. Chaleureux, vouvoiement, phrases courtes', 'e.g. Warm, polite, short sentences'))}
            ${field('languages', L('Langues', 'Languages'), L('Les langues des clients. L\'assistant répond toujours dans la langue de la personne, parmi celles-ci.', 'The customers\' languages. The assistant always answers in the person\'s language, among these.'), L('ex. Français et anglais', 'e.g. French and English'))}
            <div class="wz-field">
                <div class="wz-label">${L('Modèle d\'IA', 'AI model')}</div>
                <div class="wz-help">${L('Le « cerveau » de l\'assistant. <b>Gardez le modèle recommandé</b> sauf si les questions sont très complexes.', 'The assistant\'s "brain". <b>Keep the recommended model</b> unless questions are very complex.')}</div>
                <select id="wz-model" class="wz-input">
                    ${[['gpt-4o-mini', L('GPT-4o mini : rapide et économique (recommandé)', 'GPT-4o mini: fast and cheap (recommended)')], ['gpt-4.1-mini', 'GPT-4.1 mini'], ['gpt-4o', L('GPT-4o : plus intelligent, plus cher', 'GPT-4o: smarter, more expensive')]].map(([v, l]) => `<option value="${v}" ${s.model === v ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
            </div>`,

        prompt: () => `
            <div class="wz-intro">${L('Les instructions sont le « mode d\'emploi » de l\'assistant. L\'IA les écrit à partir de vos réponses ; relisez-les et corrigez si besoin. Les règles de sécurité et propres à chaque canal sont ajoutées automatiquement, inutile de les écrire.', 'The instructions are the assistant\'s "manual". AI writes them from your answers; review and fix them if needed. Safety and channel rules are added automatically, no need to write them.')}</div>
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:12px; flex-wrap:wrap;">
                <button class="wz-btn" id="wz-gen"><span class="material-icons" style="font-size:1.1rem;">auto_awesome</span>${s.prompt ? L('Réécrire avec l\'IA', 'Rewrite with AI') : L('Écrire les instructions avec l\'IA', 'Write the instructions with AI')}</button>
                <span id="wz-gen-status" class="wz-help" style="margin:0;"></span>
            </div>
            <div class="wz-field">
                <div class="wz-label">${L('Instructions de l\'assistant', 'Assistant instructions')} <span class="wz-req">*</span></div>
                <div class="wz-help">${L('Vous pouvez modifier le texte directement. Vérifiez surtout les prix, les horaires et ce qu\'il ne doit pas promettre.', 'You can edit the text directly. Check especially prices, hours and what it must not promise.')}</div>
                <textarea id="wz-prompt" class="wz-input" rows="14" placeholder="${esc(L('Cliquez sur « Écrire les instructions avec l\'IA », ou écrivez-les vous-même.', 'Click "Write the instructions with AI", or write them yourself.'))}">${esc(s.prompt)}</textarea>
            </div>`,

        where: () => {
            const chs = s.channels || [];
            return `
            <div class="wz-intro">${L('Cochez les endroits où cet assistant doit répondre. Vous pourrez changer plus tard.', 'Tick where this assistant should answer. You can change it later.')}</div>
            <div class="wz-box ${chs.some(c => s.pickedChannels.has(c.id)) ? 'on' : ''}">
                <div class="wz-label"><span class="material-icons" style="font-size:1.1rem; color:var(--gold);">forum</span>${L('Messagerie', 'Messaging')}</div>
                <div class="wz-help">${L('Les comptes du client déjà connectés (Messenger, Instagram, WhatsApp, courriel, SMS). L\'assistant répondra aux messages reçus sur ceux que vous cochez.', 'The client\'s connected accounts (Messenger, Instagram, WhatsApp, email, SMS). The assistant answers messages received on the ones you tick.')}</div>
                ${s.channels === null ? `<div class="wz-help">${L('Chargement…', 'Loading…')}</div>`
                    : chs.length ? chs.map(c => `
                    <label class="wz-check" style="font-weight:600; margin:8px 0;"><input type="checkbox" data-ch="${esc(c.id)}" ${s.pickedChannels.has(c.id) ? 'checked' : ''}>
                        <span>${channelName(c.type)} · ${esc(c.label || c.externalId || '')}${c.agentId && c.agentId !== s.agentId ? `<br><span class="wz-help" style="font-weight:400;">${L('Utilise actuellement un autre agent : le cocher le remplace par celui-ci.', 'Currently uses another agent: ticking it replaces it with this one.')}</span>` : ''}</span></label>`).join('')
                    : `<div class="wz-help" style="margin:0;">${L('Aucun compte connecté pour l\'instant. Le client peut les connecter lui-même dans son portail (onglet Connect), ou vous dans Messagerie › Canaux. Vous relierez l\'agent ensuite.', 'No account connected yet. The client can connect them in their portal (Connect tab), or you in Messaging › Channels. You will link the agent afterwards.')}</div>`}
            </div>
            <div class="wz-box ${s.voice ? 'on' : ''}">
                <label class="wz-check"><input type="checkbox" id="wz-voice" ${s.voice ? 'checked' : ''}><span><span class="material-icons" style="font-size:1.1rem; color:#a855f7; vertical-align:text-bottom;">call</span> ${L('Téléphone (agent vocal)', 'Phone (voice agent)')}</span></label>
                <div class="wz-help" style="margin-top:6px;">${L('L\'assistant répond aux appels, prend les messages et les rendez-vous. Le numéro est relié ensuite par Quasar dans l\'onglet Téléphone.', 'The assistant answers calls, takes messages and appointments. The number is linked afterwards by Quasar in the Phone tab.')}</div>
                <div id="wz-voice-fields" style="display:${s.voice ? 'block' : 'none'}; margin-top:10px;">
                    ${field('greeting', L('Première phrase au téléphone', 'First sentence on the phone'), L('Ce que l\'assistant dit en décrochant. Court, avec le nom de l\'entreprise. <b>En anglais par défaut</b>, comme la voix.', 'What the assistant says when it picks up. Short, with the business name. <b>English by default</b>, like the voice.'), 'Hello, Leblanc Garage, how can I help you?', { value: s.greeting }).replace('data-k="greeting"', 'id="wz-greeting"')}
                    ${field('alertPhone', L('Texto d\'alerte au', 'Text alerts to'), L('Le cellulaire du client qui reçoit un texto à chaque message laissé et à chaque fin d\'appel. <b>Remplissez au moins ce champ ou le courriel</b>, sinon personne n\'est prévenu.', 'The client\'s mobile that gets a text for every message left and every finished call. <b>Fill in at least this or the email</b>, otherwise nobody is told.'), '+1 506 555-0123', { value: s.alertPhone }).replace('data-k="alertPhone"', 'id="wz-alert-phone" type="tel"')}
                    ${field('alertEmail', L('Courriel d\'alerte', 'Alert email'), L('Reçoit les mêmes alertes, avec le résumé de l\'appel.', 'Gets the same alerts, with the call summary.'), 'owner@leblancgarage.ca', { value: s.alertEmail }).replace('data-k="alertEmail"', 'id="wz-alert-email" type="email"')}
                </div>
            </div>
            <div class="wz-box ${s.widget ? 'on' : ''}">
                <label class="wz-check"><input type="checkbox" id="wz-widget" ${s.widget ? 'checked' : ''}><span><span class="material-icons" style="font-size:1.1rem; color:var(--gold); vertical-align:text-bottom;">web</span> ${L('Bulle de discussion sur le site web', 'Chat bubble on the website')}</span></label>
                <div class="wz-help" style="margin-top:6px;">${L('Une bulle en bas du site du client. Vous recevrez le code à coller une fois l\'agent créé (Agents › l\'agent › Où il répond).', 'A bubble at the bottom of the client\'s website. You get the code to paste once the agent is created (Agents › the agent › Where it answers).')}</div>
                <div id="wz-widget-fields" style="display:${s.widget ? 'block' : 'none'}; margin-top:10px;">
                    <div class="wz-field"><div class="wz-label">${L('Couleur', 'Colour')}</div><div class="wz-help">${L('La couleur principale du site du client, pour que la bulle s\'y fonde.', 'The main colour of the client\'s website, so the bubble blends in.')}</div><input type="color" id="wz-color" value="${esc(s.color)}" style="width:60px; height:42px; border:1px solid var(--border); border-radius:8px; background:none;"></div>
                    ${field('welcome', L('Message d\'accueil de la bulle', 'Bubble welcome message'), L('La première phrase affichée quand un visiteur ouvre la bulle.', 'The first sentence shown when a visitor opens the bubble.'), L('ex. Bonjour ! Une question sur une réparation ? Je vous réponds tout de suite.', 'e.g. Hi! A question about a repair? I\'ll answer right away.'), { value: s.welcome }).replace('data-k="welcome"', 'id="wz-welcome"')}
                </div>
            </div>`;
        },

        test: () => `
            ${s.error ? `<div class="wz-err">${esc(s.error)}</div>` : ''}
            ${s.saved ? `<div class="wz-ok">${L('L\'agent est créé (pas encore actif : il ne répond pas encore aux vrais clients).', 'The agent is created (not live yet: it does not answer real customers yet).')}</div>` : `<div class="wz-help">${L('Création de l\'agent…', 'Creating the agent…')}</div>`}
            <div class="wz-intro">${L('Posez-lui les questions qu\'un vrai client poserait. Si une réponse est fausse ou manque, revenez en arrière avec « Précédent » pour compléter les informations, puis réécrivez les instructions.', 'Ask the questions a real customer would ask. If an answer is wrong or missing, go back with "Back" to complete the information, then rewrite the instructions.')}</div>
            <div class="wz-chips">${testQuestions().map(q => `<button class="wz-chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
            <div class="wz-chat" id="wz-chat">${s.chat.map(m => `<div class="wz-msg ${m.role === 'user' ? 'user' : 'ai'}">${esc(m.content)}</div>`).join('') || `<div class="wz-help" style="margin:auto;">${L('Cliquez sur une question ou écrivez la vôtre.', 'Click a question or type your own.')}</div>`}</div>
            <div style="display:flex; gap:8px; margin-top:10px;">
                <input id="wz-chat-input" class="wz-input" placeholder="${esc(L('Écrivez comme un client…', 'Type like a customer…'))}" ${s.saved ? '' : 'disabled'}>
                <button class="wz-btn" id="wz-chat-send" ${s.saved ? '' : 'disabled'}>${L('Envoyer', 'Send')}</button>
            </div>`,

        done: () => {
            const picked = (s.channels || []).filter(c => s.pickedChannels.has(c.id));
            const row = (ok, text, todo = '') => `<div class="wz-sum"><span class="material-icons" style="color:${ok ? '#3ecf8e' : '#f5a524'};">${ok ? 'check_circle' : 'radio_button_unchecked'}</span><span style="flex:1;">${text}${todo ? `<br><span class="wz-help">${todo}</span>` : ''}</span></div>`;
            return `
            <div class="wz-intro">${L('Récapitulatif. Ce qui reste à faire apparaît aussi dans la liste « Mise en route » de l\'onglet Agents.', 'Summary. What is left also shows in the "Client setup" list of the Agents tab.')}</div>
            <div class="wz-box">
                ${row(true, L('Agent créé avec ses instructions', 'Agent created with its instructions'))}
                ${row(s.tested, L('Testé dans le chat', 'Tested in the chat'), s.tested ? '' : L('Conseillé avant d\'activer.', 'Recommended before going live.'))}
                ${row(picked.length > 0, picked.length ? `${L('Répond sur', 'Answers on')} ${picked.map(c => channelName(c.type)).join(', ')}` : L('Aucun canal de messagerie', 'No messaging channel'), picked.length ? '' : L('Connectez un compte dans Messagerie › Canaux (ou le client dans son portail), puis choisissez cet agent.', 'Connect an account in Messaging › Channels (or the client in their portal), then pick this agent.'))}
                ${s.voice ? row(!!(s.alertPhone || s.alertEmail), L('Téléphone activé', 'Phone turned on'), L('Reste à faire par Quasar : relier un numéro dans l\'onglet Téléphone.', 'Left for Quasar: link a number in the Phone tab.') + (s.alertPhone || s.alertEmail ? '' : ' ' + L('Aucune alerte : personne ne sera prévenu des messages.', 'No alert: nobody will be told about messages.'))) : ''}
                ${s.widget ? row(false, L('Bulle du site web', 'Website bubble'), L('Copiez le code dans Agents › cet agent › Où il répond, et collez-le sur le site.', 'Copy the code in Agents › this agent › Where it answers, and paste it on the website.')) : ''}
            </div>
            <label class="wz-check" style="margin-top:6px;"><input type="checkbox" id="wz-activate" ${s.activate ? 'checked' : ''}><span>${L('Activer l\'agent maintenant : il répond aux vrais clients sur les canaux cochés', 'Turn the agent on now: it answers real customers on the ticked channels')}</span></label>`;
        }
    };

    const testQuestions = () => {
        const q = [L('Quelles sont vos heures d\'ouverture ?', 'What are your opening hours?'), L('Combien ça coûte ?', 'How much does it cost?'), L('Je voudrais prendre rendez-vous', 'I\'d like to book an appointment')];
        const firstFaq = (s.brief.faq || '').split('\n').map(l => l.replace(/^\s*(Q|Question)\s*:\s*/i, '').split(/\s(R|A)\s*:/)[0].trim()).find(Boolean);
        if (firstFaq) q.push(firstFaq.slice(0, 80));
        return q;
    };

    // ---------- Validation per screen ----------
    const validate = () => {
        const k = STEPS[s.step].key;
        if (k === 'business' && (!s.brief.businessName || !s.brief.activity)) return L('Indiquez au moins le nom de l\'entreprise et son activité.', 'Enter at least the business name and activity.');
        if (k === 'offer' && !s.brief.hours && !s.brief.services) return L('Indiquez au moins les horaires ou les services : c\'est ce que les clients demandent le plus.', 'Enter at least the hours or the services: that is what customers ask most.');
        if (k === 'prompt' && s.prompt.trim().length < 40) return L('Écrivez les instructions avec l\'IA (bouton ci-dessus) ou rédigez-les vous-même.', 'Write the instructions with AI (button above) or write them yourself.');
        if (k === 'where' && s.voice && s.alertEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.alertEmail)) return L('Le courriel d\'alerte n\'est pas valide.', 'The alert email is not valid.');
        return '';
    };

    // ---------- Save (create or update) the agent and its connections ----------
    async function saveAgent() {
        const prompt = s.prompt.trim();
        const name = s.brief.agentName ? `${s.brief.agentName} · ${s.brief.businessName}` : `${L('Assistant', 'Assistant')} ${s.brief.businessName}`;
        if (s.voice && !s.vapiAssistantId) {
            s.vapiAssistantId = (await call('/api/vapi/create-agent', { method: 'POST', body: { name, type: 'Vapi Voice Agent', prompt, model: s.model } })).data.id;
        }
        const data = {
            name, personality: prompt, prompt, knowledgeBase: [], tools: {}, model: s.model,
            type: s.voice ? 'Vapi Voice Agent' : 'Text Chatbot', vapiAssistantId: s.voice ? s.vapiAssistantId : (s.vapiAssistantId || null),
            active: false, projectId: opts.projectId, updatedAt: new Date().toISOString(), maxMessagesPerDay: 50,
            promptBrief: { ...s.brief }, promptBriefUpdatedAt: new Date().toISOString(), createdWithWizard: true,
            firstMessage: s.greeting || 'Hello, how can I help you today?',
            ...(s.widget ? { color: s.color, welcomeMessage: s.welcome, toggleIcon: 'chat' } : {}),
            setupWanted: { voice: s.voice, widget: s.widget }
        };
        if (s.agentId) await updateDoc(doc(db, 'ai_agents', s.agentId), data);
        else s.agentId = (await addDoc(collection(db, 'ai_agents'), { ...data, createdAt: new Date().toISOString() })).id;

        // Messaging channels ticked: this agent answers there (other fields kept as they are)
        for (const c of (s.channels || []).filter(c => s.pickedChannels.has(c.id) && c.agentId !== s.agentId)) {
            await call(`/api/mp/projects/${opts.projectId}/channels`, { method: 'POST', body: { type: c.type, externalId: c.externalId, label: c.label, active: c.active !== false, aiEnabled: c.aiEnabled !== false, agentId: s.agentId, ...(c.wabaId ? { wabaId: c.wabaId } : {}) } });
            c.agentId = s.agentId;
        }
        // Phone: alert contacts and Vapi assistant in sync (prompt, project, model, first sentence)
        if (s.voice) {
            if (s.alertPhone || s.alertEmail) await call(`/api/voice/projects/${opts.projectId}/settings`, { method: 'PUT', body: { alertPhone: s.alertPhone, alertEmail: s.alertEmail } });
            await call(`/api/vapi/update-agent/${s.vapiAssistantId}`, { method: 'PATCH', body: { name, type: 'Vapi Voice Agent', prompt, tools: {}, projectId: opts.projectId } });
            await call(`/api/vapi/update-agent-config/${s.vapiAssistantId}`, { method: 'PATCH', body: { name, model: s.model, firstMessage: s.greeting, firstMessageMode: 'assistant-speaks-first' } });
        }
        s.saved = true;
    }

    // ---------- Render ----------
    function render() {
        const st = STEPS[s.step];
        const last = s.step === STEPS.length - 1;
        const nextLabel = st.key === 'where' ? L('Créer l\'agent et le tester', 'Create the agent and test it') : last ? L('Terminer', 'Finish') : st.key === 'intro' ? L('Commencer', 'Start') : L('Suivant', 'Next');
        box.innerHTML = `
            <div class="wz-head">
                <div class="wz-top">
                    <div style="flex:1;">
                        <div class="wz-step">${L('Étape', 'Step')} ${s.step + 1} / ${STEPS.length}</div>
                        <div class="wz-title">${st.title}</div>
                    </div>
                    <button class="wz-btn ghost" id="wz-close" title="${L('Fermer', 'Close')}" style="min-height:38px; padding:0 10px;"><span class="material-icons">close</span></button>
                </div>
                <div class="wz-bar"><div style="width:${Math.round((s.step + 1) / STEPS.length * 100)}%;"></div></div>
            </div>
            <div class="wz-body">${screens[st.key]()}</div>
            <div class="wz-foot">
                ${s.step > 0 && st.key !== 'done' ? `<button class="wz-btn ghost" id="wz-back"><span class="material-icons" style="font-size:1.1rem;">arrow_back</span>${L('Précédent', 'Back')}</button>` : ''}
                <span class="grow" id="wz-msg">${esc(s.error && st.key !== 'test' ? s.error : '')}</span>
                <button class="wz-btn" id="wz-next">${nextLabel}${last ? '' : ' <span class="material-icons" style="font-size:1.1rem;">arrow_forward</span>'}</button>
            </div>`;
        bind();
        box.querySelector('.wz-body').scrollTop = 0;
        box.querySelector('.wz-input:not([disabled])')?.focus?.({ preventScroll: true });
    }

    function bind() {
        const st = STEPS[s.step];
        box.querySelector('#wz-close').onclick = async () => {
            if (s.agentId) { close(); opts.onDone?.(s.agentId); return; }
            if (!window.erpConfirm || await window.erpConfirm(L('Quitter le parcours ? Ce que vous avez rempli sera perdu.', 'Leave the guide? What you filled in will be lost.'))) close();
        };
        box.querySelector('#wz-back')?.addEventListener('click', () => { collect(); s.error = ''; s.step--; render(); });
        box.querySelector('#wz-next').onclick = next;
        box.querySelector('#wz-voice')?.addEventListener('change', (e) => { box.querySelector('#wz-voice-fields').style.display = e.target.checked ? 'block' : 'none'; e.target.closest('.wz-box').classList.toggle('on', e.target.checked); });
        box.querySelector('#wz-widget')?.addEventListener('change', (e) => { box.querySelector('#wz-widget-fields').style.display = e.target.checked ? 'block' : 'none'; e.target.closest('.wz-box').classList.toggle('on', e.target.checked); });

        if (st.key === 'business') {
            box.querySelector('#wz-auto-go').onclick = async (e) => {
                collect();
                s.auto.website = box.querySelector('#wz-auto-site').value.trim();
                s.auto.city = box.querySelector('#wz-auto-city').value.trim();
                const status = box.querySelector('#wz-auto-status');
                if (!s.auto.website && !s.brief.businessName) { status.textContent = L('Indiquez le site web, ou le nom de l\'entreprise dans le champ ci-dessous.', 'Enter the website, or the business name in the field below.'); status.style.color = '#ef4444'; return; }
                const btn = e.currentTarget; btn.disabled = true; status.style.color = '';
                status.textContent = L('Recherche en cours sur Google Maps, le site et le web (10 à 40 secondes)…', 'Searching Google Maps, the website and the web (10 to 40 seconds)…');
                try {
                    const r = await call(`/api/mp/projects/${opts.projectId}/prefill`, { method: 'POST', body: { website: s.auto.website, businessName: s.brief.businessName, city: s.auto.city, lang: isEn() ? 'en' : 'fr' } });
                    let filled = 0, kept = 0;
                    for (const [k, v] of Object.entries(r.fields || {})) {
                        if (!(k in s.brief)) continue;
                        // Never overwrite what was typed: only empty fields are filled
                        if (s.brief[k] && k !== 'businessName') { kept++; continue; }
                        if (k === 'businessName' && s.brief.businessName) continue;
                        s.brief[k] = v; s.prefilled[k] = r.sources[k]; filled++;
                    }
                    if (!s.auto.website && r.sourceInfo?.websiteUsed) s.auto.website = r.sourceInfo.websiteUsed;
                    const used = (r.used || []).map(u => SOURCE_LABEL[u] ? SOURCE_LABEL[u]() : u).join(', ');
                    s.autoSummary = filled
                        ? `✓ ${L(`${filled} champ(s) pré-rempli(s) depuis ${used}.`, `${filled} field(s) pre-filled from ${used}.`)}${kept ? ' ' + L(`${kept} champ(s) déjà remplis par vous n'ont pas été touchés.`, `${kept} field(s) you had filled were left as they were.`) : ''} ${L('Vérifiez les champs en orange sur chaque écran.', 'Check the orange fields on each screen.')}`
                        : L('Rien de fiable trouvé. Remplissez les champs à la main.', 'Nothing reliable found. Fill in the fields by hand.');
                    render();
                } catch (err) {
                    status.textContent = `${L('Recherche impossible', 'Search failed')} : ${err.message}`; status.style.color = '#ef4444';
                    btn.disabled = false;
                }
            };
        }
        if (st.key === 'prompt') {
            box.querySelector('#wz-gen').onclick = async (e) => {
                const btn = e.currentTarget; const status = box.querySelector('#wz-gen-status');
                btn.disabled = true; status.textContent = L('L\'IA écrit les instructions (environ 20 secondes)…', 'AI is writing the instructions (about 20 seconds)…');
                try {
                    const r = await call(`/api/mp/projects/${opts.projectId}/generate-prompt`, { method: 'POST', body: { brief: s.brief } });
                    s.prompt = r.prompt || ''; box.querySelector('#wz-prompt').value = s.prompt;
                    status.textContent = L('Voilà. Relisez et corrigez si besoin.', 'Done. Review and fix if needed.');
                } catch (err) { status.textContent = `${L('Erreur', 'Error')} : ${err.message}`; }
                btn.disabled = false;
            };
        }
        if (st.key === 'test') {
            const send = async (text) => {
                text = String(text || '').trim();
                if (!text || !s.saved) return;
                s.chat.push({ role: 'user', content: text });
                const chat = box.querySelector('#wz-chat');
                chat.innerHTML = s.chat.map(m => `<div class="wz-msg ${m.role === 'user' ? 'user' : 'ai'}">${esc(m.content)}</div>`).join('') + `<div class="wz-msg ai">…</div>`;
                chat.scrollTop = chat.scrollHeight;
                try {
                    const r = await call('/api/chat', { method: 'POST', body: { projectId: opts.projectId, agentId: s.agentId, sessionId: `wizard_${s.agentId}`, messages: [{ role: 'user', content: text }] } });
                    s.chat.push({ role: 'assistant', content: r.message || '' });
                    if (!s.tested) { s.tested = true; updateDoc(doc(db, 'ai_agents', s.agentId), { testedAt: new Date().toISOString() }).catch(() => { }); }
                } catch (err) { s.chat.push({ role: 'assistant', content: `${L('Erreur', 'Error')} : ${err.message}` }); }
                chat.innerHTML = s.chat.map(m => `<div class="wz-msg ${m.role === 'user' ? 'user' : 'ai'}">${esc(m.content)}</div>`).join('');
                chat.scrollTop = chat.scrollHeight;
            };
            box.querySelectorAll('[data-q]').forEach(b => b.onclick = () => send(b.dataset.q));
            const input = box.querySelector('#wz-chat-input');
            box.querySelector('#wz-chat-send').onclick = () => { send(input.value); input.value = ''; };
            input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); send(input.value); input.value = ''; } };
        }
    }

    async function next() {
        collect();
        const st = STEPS[s.step];
        const err = validate();
        if (err) { s.error = err; box.querySelector('#wz-msg').textContent = err; box.querySelector('#wz-msg').style.color = '#ef4444'; return; }
        s.error = '';
        const btn = box.querySelector('#wz-next');

        if (st.key === 'prompt' && s.channels === null) {
            // Load the project's messaging channels for the next screen
            try { s.channels = (await call(`/api/mp/projects/${opts.projectId}/channels`)).channels || []; } catch (_) { s.channels = []; }
            s.channels.filter(c => !c.agentId).forEach(c => s.pickedChannels.add(c.id)); // free channels ticked by default
        }
        if (st.key === 'where') {
            btn.disabled = true; btn.textContent = L('Création…', 'Creating…');
            s.step++; s.saved = false; render();
            try { await saveAgent(); }
            catch (e) { s.error = `${L('Problème pendant la création', 'Problem while creating')} : ${e.message}`; }
            render();
            return;
        }
        if (st.key === 'test' && !s.saved) return;
        if (st.key === 'done') {
            btn.disabled = true;
            try {
                if (s.activate) await updateDoc(doc(db, 'ai_agents', s.agentId), { active: true, updatedAt: new Date().toISOString() });
                toast(s.activate ? L('Agent activé.', 'Agent is live.') : L('Agent enregistré (pas encore actif).', 'Agent saved (not live yet).'));
                close();
                opts.onDone?.(s.agentId);
            } catch (e) { btn.disabled = false; box.querySelector('#wz-msg').textContent = e.message; }
            return;
        }
        s.step++;
        render();
    }

    render();
}

// =====================================================================
// SETUP CHECKLIST
// =====================================================================

/**
 * @param {HTMLElement} container
 * @param {{ projectId, apiBase, getToken, onAction: (action) => void }} opts
 *   actions: 'wizard' | 'agent:<id>' | 'agent-test:<id>' | 'agent-channels:<id>' | 'messaging' | 'voice' | 'billing' | 'settings'
 */
export async function renderSetupChecklist(container, opts) {
    const call = api(opts.apiBase, opts.getToken);
    container.innerHTML = '';
    let project = {}, agents = [], channels = [], voice = null, billing = null;
    try {
        const [pSnap, aSnap] = await Promise.all([
            getDoc(doc(db, 'ai_projects', opts.projectId)),
            getDocs(query(collection(db, 'ai_agents'), where('projectId', '==', opts.projectId)))
        ]);
        project = pSnap.exists() ? pSnap.data() : {};
        agents = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        [channels, voice, billing] = await Promise.all([
            call(`/api/mp/projects/${opts.projectId}/channels`).then(r => r.channels || []).catch(() => []),
            call(`/api/voice/projects/${opts.projectId}`).catch(() => null),
            call(`/api/billing/projects/${opts.projectId}`).catch(() => null)
        ]);
    } catch (e) { console.warn('[Setup] checklist not loaded:', e.message); return; }
    if (project.setupChecklistHidden) {
        container.innerHTML = `<div style="text-align:right; margin-bottom:8px;"><a href="#" id="sc-show" style="color:var(--text-muted); font-size:.8rem; text-decoration:underline;">${L('Afficher la mise en route', 'Show client setup')}</a></div>`;
        container.querySelector('#sc-show').onclick = async (e) => { e.preventDefault(); await updateDoc(doc(db, 'ai_projects', opts.projectId), { setupChecklistHidden: false }); renderSetupChecklist(container, opts); };
        return;
    }

    const skips = project.setupSkips || {};
    const main = agents.find(a => a.active) || agents[0];
    const instr = (a) => String(a.personality || a.prompt || '').trim().length > 80;
    const knows = (a) => (a.knowledgeBase || []).length >= 3 || !!(a.promptBrief && (a.promptBrief.hours || a.promptBrief.services));
    const voiceAgent = agents.find(a => a.vapiAssistantId);
    const wantVoice = agents.some(a => a.setupWanted?.voice) || !!voiceAgent;
    const wantWidget = agents.some(a => a.setupWanted?.widget);
    const voiceMissing = [
        !voiceAgent && L('activer la voix sur un agent', 'turn voice on for an agent'),
        !voice?.phoneNumber && L('relier un numéro (onglet Téléphone)', 'link a number (Phone tab)'),
        !(voice?.settings?.alertPhone || voice?.settings?.alertEmail) && L('remplir une alerte texto ou courriel', 'fill in a text or email alert')
    ].filter(Boolean);
    const offerReady = !!(billing && (billing.subscription || (billing.offer && !billing.offer.isDefault) || billing.proposalUrl));

    const items = [
        { key: 'agent', done: !!main && instr(main), title: L('Créer l\'agent et ses instructions', 'Create the agent and its instructions'), help: L('Le parcours guidé vous pose les bonnes questions.', 'The guide asks you the right questions.'), action: 'wizard', btn: L('Lancer le parcours', 'Start the guide') },
        { key: 'knowledge', done: !!main && knows(main), title: L('Lui donner les infos pratiques', 'Give it the practical info'), help: L('Horaires, services, prix, questions fréquentes.', 'Hours, services, prices, frequent questions.'), action: main ? `agent-knowledge:${main.id}` : 'wizard', btn: L('Compléter', 'Complete') },
        { key: 'tested', done: agents.some(a => a.testedAt), title: L('Le tester comme un client', 'Test it like a customer'), help: L('Quelques questions dans le chat de test.', 'A few questions in the test chat.'), action: main ? `agent-test:${main.id}` : 'wizard', btn: L('Tester', 'Test') },
        { key: 'channel', done: channels.some(c => c.agentId && agents.some(a => a.id === c.agentId)), title: L('Le relier à un canal de messagerie', 'Link it to a messaging channel'), help: channels.length ? L('Choisissez l\'agent sur un compte connecté.', 'Pick the agent on a connected account.') : L('Aucun compte connecté : le client peut le faire dans son portail (Connect).', 'No account connected: the client can do it in their portal (Connect).'), action: 'messaging', btn: L('Ouvrir les canaux', 'Open channels') },
        { key: 'voice', optional: true, done: wantVoice && voiceMissing.length === 0, skipped: !!skips.voice || (!wantVoice && skips.voice !== false && false), title: L('Téléphone', 'Phone'), help: wantVoice ? (voiceMissing.length ? `${L('Reste à', 'Still to')} ${voiceMissing.join(', ')}.` : '') : L('Si le client a pris l\'option agent vocal.', 'If the client took the voice add-on.'), action: voiceAgent ? 'voice' : (main ? `agent-channels:${main.id}` : 'wizard'), btn: L('Configurer', 'Set up'), warn: wantVoice && !(voice?.settings?.alertPhone || voice?.settings?.alertEmail) },
        { key: 'widget', optional: true, done: agents.some(a => a.widgetCodeCopiedAt), skipped: !!skips.widget, title: L('Bulle sur le site web', 'Website bubble'), help: wantWidget ? L('Copiez le code et collez-le sur le site du client.', 'Copy the code and paste it on the client\'s website.') : L('Si le client veut une bulle de discussion sur son site.', 'If the client wants a chat bubble on their website.'), action: main ? `agent-channels:${main.id}` : 'wizard', btn: L('Obtenir le code', 'Get the code') },
        { key: 'offer', done: offerReady, title: L('Préparer l\'offre et l\'envoyer', 'Prepare and send the offer'), help: L('Onglet Forfait : personnalisez, puis copiez le lien de proposition.', 'Plan tab: customise, then copy the proposal link.'), action: 'billing', btn: L('Ouvrir le forfait', 'Open plan') },
        { key: 'portal', done: !!project.portalEmail, title: L('Inviter le client dans son portail', 'Invite the client to their portal'), help: L('Il y verra ses messages, ses appels et son abonnement.', 'They see their messages, calls and subscription there.'), action: 'settings', btn: L('Inviter', 'Invite') },
        { key: 'active', done: agents.some(a => a.active), title: L('Activer l\'agent', 'Turn the agent on'), help: L('Il répond alors aux vrais clients.', 'It then answers real customers.'), action: main ? `agent:${main.id}` : 'wizard', btn: L('Activer', 'Turn on') }
    ];
    const counted = items.filter(i => !(i.optional && i.skipped));
    const doneCount = counted.filter(i => i.done).length;
    const allDone = doneCount === counted.length;

    container.innerHTML = `
        <style>
            .sc { border:1px solid rgba(223,165,58,.35); border-radius:14px; background:rgba(223,165,58,.05); padding:14px 16px; margin-bottom:1.25rem; }
            .sc-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; cursor:pointer; }
            .sc-title { font-weight:800; flex:1; min-width:180px; }
            .sc-bar { height:6px; background:rgba(255,255,255,.08); border-radius:6px; overflow:hidden; margin:10px 0 4px; }
            .sc-bar > div { height:100%; background:var(--gold); }
            .sc-row { display:flex; align-items:center; gap:10px; padding:9px 0; border-top:1px solid var(--border); flex-wrap:wrap; }
            .sc-row:first-child { border-top:0; }
            .sc-row .t { flex:1; min-width:200px; font-size:.88rem; }
            .sc-row .h { color:var(--text-muted); font-size:.78rem; }
            .sc-row.done .t { color:var(--text-muted); }
            .sc-btn { border:1px solid var(--border); background:transparent; color:inherit; border-radius:8px; padding:6px 12px; font-size:.78rem; font-weight:700; cursor:pointer; white-space:nowrap; }
            .sc-btn.main { background:var(--gold); color:#000; border-color:var(--gold); }
            .sc-skip { background:none; border:0; color:var(--text-muted); font-size:.75rem; text-decoration:underline; cursor:pointer; }
        </style>
        <div class="sc">
            <div class="sc-head" id="sc-toggle">
                <span class="material-icons" style="color:var(--gold);">${allDone ? 'verified' : 'checklist'}</span>
                <div class="sc-title">${allDone ? L('Mise en route terminée', 'Client setup complete') : L('Mise en route de ce client', 'Client setup')} · ${doneCount}/${counted.length}</div>
                <span class="material-icons text-muted" id="sc-chev">${allDone ? 'expand_more' : 'expand_less'}</span>
            </div>
            <div class="sc-bar"><div style="width:${Math.round(doneCount / counted.length * 100)}%;"></div></div>
            <div id="sc-body" style="display:${allDone ? 'none' : 'block'}; margin-top:8px;">
                ${items.map((i, n) => {
                    const skipped = i.optional && i.skipped;
                    const firstTodo = !i.done && !skipped && items.findIndex(x => !x.done && !(x.optional && x.skipped)) === n;
                    return `
                    <div class="sc-row ${i.done || skipped ? 'done' : ''}">
                        <span class="material-icons" style="color:${i.done ? '#3ecf8e' : skipped ? 'var(--text-muted)' : i.warn ? '#ef4444' : '#f5a524'};">${i.done ? 'check_circle' : skipped ? 'remove_circle_outline' : i.warn ? 'error' : 'radio_button_unchecked'}</span>
                        <div class="t">${i.title}${i.optional ? ` <span class="h">(${L('optionnel', 'optional')})</span>` : ''}${!i.done && !skipped && i.help ? `<div class="h">${i.help}</div>` : ''}${skipped ? `<div class="h">${L('Pas pour ce client', 'Not for this client')}</div>` : ''}</div>
                        ${!i.done && !skipped ? `<button class="sc-btn ${firstTodo ? 'main' : ''}" data-act="${i.action}">${i.btn}</button>` : ''}
                        ${i.optional && !i.done ? `<button class="sc-skip" data-skip="${i.key}" data-val="${skipped ? '0' : '1'}">${skipped ? L('Finalement oui', 'Actually yes') : L('Pas pour ce client', 'Not for this client')}</button>` : ''}
                    </div>`;
                }).join('')}
                <div style="text-align:right; margin-top:6px;"><button class="sc-skip" id="sc-hide">${L('Masquer cette liste', 'Hide this list')}</button></div>
            </div>
        </div>`;

    container.querySelector('#sc-toggle').onclick = () => {
        const b = container.querySelector('#sc-body');
        const open = b.style.display === 'none';
        b.style.display = open ? 'block' : 'none';
        container.querySelector('#sc-chev').textContent = open ? 'expand_less' : 'expand_more';
    };
    container.querySelectorAll('[data-act]').forEach(b => b.onclick = () => opts.onAction(b.dataset.act));
    container.querySelectorAll('[data-skip]').forEach(b => b.onclick = async () => {
        await updateDoc(doc(db, 'ai_projects', opts.projectId), { [`setupSkips.${b.dataset.skip}`]: b.dataset.val === '1' });
        renderSetupChecklist(container, opts);
    });
    container.querySelector('#sc-hide').onclick = async () => {
        await updateDoc(doc(db, 'ai_projects', opts.projectId), { setupChecklistHidden: true });
        renderSetupChecklist(container, opts);
    };
}
