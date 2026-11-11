/**
 * Voice agent (Vapi) for client projects.
 *
 * The Quasar "house" project(s) (master_admin by default) keep the original behaviour: Quasar's own
 * calendar, alerts to the Quasar admin. Every other project is a client and is fully isolated:
 *   - bookings go to the client's own Google Calendar (connected in the portal),
 *   - call notes and end-of-call summaries go to the client's alert phone / email,
 *   - each call is logged in the client's Messages inbox (channel "voice") and in voice_calls,
 *   - call minutes are counted for billing (included minutes + per-minute overage).
 *
 * Project settings: ai_projects/{id}.voice = { alertPhone, alertEmail, timeZone, slotMinutes, days,
 *   startHour, endHour, minNoticeHours, phoneNumber, vapiPhoneNumberId }
 * Call log:         ai_projects/{id}/voice_calls/{vapiCallId}
 */
const express = require('express');
const axios = require('axios');
const { db } = require('../firebase-admin');

const HOUSE = new Set(String(process.env.QUASAR_HOUSE_PROJECTS || 'master_admin').split(',').map(s => s.trim()).filter(Boolean));
const isHouse = (projectId) => !projectId || HOUSE.has(projectId);

const VAPI = 'https://api.vapi.ai';
const SERVER_URL = process.env.SERVER_URL || 'https://quasar-erp-b26d5.web.app';
const PORTAL_URL = (process.env.PUBLIC_APP_URL || 'https://solutionsquasar.ca') + '/portal.html';
const vapiHeaders = () => {
    if (!process.env.VAPI_PRIVATE_KEY) throw new Error('VAPI_PRIVATE_KEY is not configured on the server.');
    return { Authorization: `Bearer ${process.env.VAPI_PRIVATE_KEY}` };
};
const callbackUrl = (projectId) => `${SERVER_URL}/api/vapi/callback?projectId=${encodeURIComponent(projectId)}`;
const serverConfig = (projectId) => ({ url: callbackUrl(projectId), ...(process.env.VAPI_SECRET ? { headers: { 'x-vapi-secret': process.env.VAPI_SECRET } } : {}) });

const DEFAULTS = { alertPhone: '', alertEmail: '', timeZone: 'America/Toronto', slotMinutes: 30, days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, minNoticeHours: 2, phoneNumber: '', vapiPhoneNumberId: '' };
const nowIso = () => new Date().toISOString();
const projectRef = (projectId) => db.collection('ai_projects').doc(projectId);

async function getProject(projectId) {
    const snap = await projectRef(projectId).get();
    if (!snap.exists) throw new Error('Project not found.');
    return { id: snap.id, ...snap.data() };
}

async function getSettings(projectId) {
    const p = await getProject(projectId);
    return { ...DEFAULTS, ...(p.voice || {}) };
}

function cleanSettings(input, previous) {
    const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
    const int = (v, min, max, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
    const out = { ...previous };
    if ('alertPhone' in input) out.alertPhone = str(input.alertPhone, 30).replace(/[^\d+]/g, '');
    if ('alertEmail' in input) {
        const e = str(input.alertEmail, 200);
        if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Invalid email address.');
        out.alertEmail = e;
    }
    if ('timeZone' in input) {
        const tz = str(input.timeZone, 60);
        try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); out.timeZone = tz; } catch (_) { throw new Error('Unknown time zone.'); }
    }
    if ('slotMinutes' in input) out.slotMinutes = int(input.slotMinutes, 10, 240, DEFAULTS.slotMinutes);
    if ('startHour' in input) out.startHour = int(input.startHour, 0, 23, DEFAULTS.startHour);
    if ('endHour' in input) out.endHour = int(input.endHour, 1, 24, DEFAULTS.endHour);
    if ('minNoticeHours' in input) out.minNoticeHours = int(input.minNoticeHours, 0, 168, DEFAULTS.minNoticeHours);
    if ('days' in input && Array.isArray(input.days)) out.days = [...new Set(input.days.map(Number).filter(d => d >= 0 && d <= 6))].sort();
    if (out.endHour <= out.startHour) throw new Error('Closing hour must be after opening hour.');
    return out;
}

async function saveSettings(projectId, input, { staff }) {
    const previous = await getSettings(projectId);
    // Clients may only change where alerts go and their booking hours; numbers are linked by Quasar staff
    const allowed = staff ? input : Object.fromEntries(Object.entries(input || {}).filter(([k]) => ['alertPhone', 'alertEmail', 'timeZone', 'slotMinutes', 'days', 'startHour', 'endHour', 'minNoticeHours'].includes(k)));
    const next = cleanSettings(allowed || {}, previous);
    await projectRef(projectId).set({ voice: { ...next, updatedAt: nowIso() } }, { merge: true });
    return next;
}

/** The project's voice agent: an ERP agent with a Vapi assistant, the active one first. */
async function findVoiceAgent(projectId) {
    const snap = await db.collection('ai_agents').where('projectId', '==', projectId).get();
    const agents = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.vapiAssistantId);
    return agents.find(a => a.active === true) || agents[0] || null;
}

// ---------- Time zone helpers ----------

function tzOffsetMs(ts, timeZone) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        .formatToParts(new Date(ts)).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ts;
}
/** UTC instant of a wall-clock time in a time zone (DST-safe). */
function zonedToDate(y, mo, d, h, mi, timeZone) {
    const guess = Date.UTC(y, mo - 1, d, h, mi);
    let t = guess - tzOffsetMs(guess, timeZone);
    const second = guess - tzOffsetMs(t, timeZone);
    if (second !== t) t = second;
    return new Date(t);
}
function localParts(ts, timeZone) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(new Date(ts)).map(x => [x.type, x.value]));
    return { y: +p.year, m: +p.month, d: +p.day, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
}
const slotLabel = (date, timeZone) => new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);

// ---------- Client tools (called from vapi-tools for non-house projects) ----------

const CALENDAR_MISSING = {
    success: false,
    error: 'calendar_not_connected',
    message: 'Online booking is not available for this business. Take a message instead: ask for the caller\'s name, phone number and preferred day and time, then use send_call_note_sms.'
};

async function clientCalendar(projectId) {
    try { return await require('../google-auth').getCalendar(projectId); } catch (_) { return null; }
}

async function busyIntervals(calendar, from, to) {
    const fb = await calendar.freebusy.query({ requestBody: { timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: 'primary' }] } });
    return (fb.data.calendars?.primary?.busy || []).map(b => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
}

async function clientSlots(projectId, daysAhead = 5) {
    const s = await getSettings(projectId);
    const calendar = await clientCalendar(projectId);
    if (!calendar) return CALENDAR_MISSING;
    const days = Math.min(14, Math.max(1, Number(daysAhead) || 5));
    const now = Date.now();
    const earliest = now + s.minNoticeHours * 3600e3;
    const busy = await busyIntervals(calendar, new Date(now), new Date(now + (days + 1) * 86400e3));
    const slotMs = s.slotMinutes * 60e3;
    const slots = [];
    for (let i = 0; i <= days && slots.length < 12; i++) {
        const day = localParts(now + i * 86400e3, s.timeZone);
        if (!s.days.includes(day.dow)) continue;
        for (let min = s.startHour * 60; min + s.slotMinutes <= s.endHour * 60 && slots.length < 12; min += s.slotMinutes) {
            const start = zonedToDate(day.y, day.m, day.d, Math.floor(min / 60), min % 60, s.timeZone);
            const st = start.getTime();
            if (st < earliest) continue;
            if (busy.some(b => st < b.end && st + slotMs > b.start)) continue;
            slots.push({ start: start.toISOString(), label: slotLabel(start, s.timeZone) });
        }
    }
    return {
        success: true, timeZone: s.timeZone, durationMinutes: s.slotMinutes, slots,
        message: slots.length ? `Open times: ${slots.slice(0, 5).map(x => x.label).join('; ')}` : 'No opening in the coming days. Offer to take a message so the business calls back.'
    };
}

async function clientBook(projectId, args = {}) {
    const s = await getSettings(projectId);
    const calendar = await clientCalendar(projectId);
    if (!calendar) return CALENDAR_MISSING;
    const start = new Date(args.appointmentTime);
    if (isNaN(start)) return { success: false, error: 'invalid_time', message: 'The time is not valid. Use one of the times returned by get_available_slots.' };
    if (start.getTime() < Date.now() + s.minNoticeHours * 3600e3) return { success: false, error: 'too_soon', message: 'This time is too soon. Offer another time.' };
    const end = new Date(start.getTime() + s.slotMinutes * 60e3);
    // Re-check the slot right before booking (someone may have taken it during the call)
    const busy = await busyIntervals(calendar, start, end);
    if (busy.some(b => start.getTime() < b.end && end.getTime() > b.start)) return { success: false, error: 'slot_taken', message: 'This time was just taken. Check get_available_slots again.' };

    const name = String(args.prospectName || 'Caller').slice(0, 100);
    const phone = String(args.prospectPhone || args.phoneNumber || '').slice(0, 30);
    const email = String(args.prospectEmail || '').trim();
    const description = [`Booked by the phone assistant.`, phone && `Phone: ${phone}`, email && `Email: ${email}`, args.notes && `Notes: ${String(args.notes).slice(0, 1000)}`].filter(Boolean).join('\n');
    const event = await calendar.events.insert({
        calendarId: 'primary',
        sendUpdates: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? 'all' : 'none',
        requestBody: {
            summary: `${name} (phone booking)`,
            description,
            start: { dateTime: start.toISOString(), timeZone: s.timeZone },
            end: { dateTime: end.toISOString(), timeZone: s.timeZone },
            ...(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? { attendees: [{ email }] } : {})
        }
    });
    await projectRef(projectId).collection('voice_appointments').add({ name, phone, email, notes: args.notes || '', start: start.toISOString(), end: end.toISOString(), eventId: event.data.id || null, createdAt: nowIso() });
    notifyClient(projectId, {
        subject: `New appointment: ${name}`,
        title: `${name} booked ${slotLabel(start, s.timeZone)}`,
        sms: `📅 New appointment\n${name}${phone ? ` (${phone})` : ''}\n${slotLabel(start, s.timeZone)}`,
        details: [{ label: 'Caller', value: name }, { label: 'Phone', value: phone || '-' }, { label: 'When', value: slotLabel(start, s.timeZone) }],
        snippet: args.notes || ''
    });
    return { success: true, message: `Appointment booked for ${slotLabel(start, s.timeZone)}.` };
}

async function clientCallNote(projectId, args = {}) {
    const caller = args.callerName ? `${args.callerName}${args.callerPhone ? ` (${args.callerPhone})` : ''}` : (args.callerPhone || args.phoneNumber || 'Unknown caller');
    // Always keep the message in the client's Messages inbox (same conversation as the call),
    // even when no alert phone / email is set
    try {
        const digits = String(args.phoneNumber || args.callerPhone || '').replace(/\D/g, '') || 'hidden';
        const lines = [
            '📝 Message left on the phone',
            args.callerName ? `Name: ${args.callerName}` : '',
            args.callerPhone ? `Call back: ${args.callerPhone}` : '',
            String(args.summary || '').slice(0, 1500)
        ].filter(Boolean).join('\n');
        await require('../messaging-platform/core').appendMessage(projectId, `voice_${digits}`, {
            role: 'user', author: 'user', content: lines, messageId: `note_${args.callId || Date.now()}_${Date.now()}`, timestamp: nowIso()
        }, { projectId, channel: 'voice', channelId: null, contactId: args.phoneNumber || args.callerPhone || 'Hidden number', contactName: args.callerName || undefined, unread: true, lastCustomerMessageAt: nowIso() });
    } catch (e) { console.warn('[Voice] Message not saved in inbox:', e.message); }
    const sent = await notifyClient(projectId, {
        subject: `Phone message from ${caller}`,
        title: `Message from ${caller}`,
        sms: `📞 Phone message\nFrom: ${caller}\n${String(args.summary || '').slice(0, 400)}`,
        details: [{ label: 'Caller', value: caller }],
        snippet: String(args.summary || '')
    });
    return sent
        ? { success: true, message: 'The message was sent to the business. Tell the caller someone will get back to them.' }
        : { success: true, message: 'The message was saved. Tell the caller someone will get back to them.' };
}

/** SMS and/or email to the client's alert contacts. Never to Quasar. Returns true when something was sent. */
async function notifyClient(projectId, { subject, title, sms, details = [], snippet = '' }) {
    let sent = false;
    try {
        const s = await getSettings(projectId);
        if (s.alertPhone) {
            try { await require('../twilio-service').sendSms({ to: s.alertPhone, message: sms.slice(0, 600), allowLandline: true }); sent = true; }
            catch (e) { console.warn('[Voice] Client SMS alert failed:', e.message); }
        }
        if (s.alertEmail) {
            try {
                await require('../email-alert-service').sendAdminAlertEmail({
                    to: s.alertEmail, subject, title, badgeText: 'Phone assistant', badgeColor: '#a855f7',
                    details, snippet: String(snippet || '').slice(0, 600), ctaUrl: PORTAL_URL, ctaText: 'Open my inbox'
                });
                sent = true;
            } catch (e) { console.warn('[Voice] Client email alert failed:', e.message); }
        }
    } catch (e) { console.warn('[Voice] Alert skipped:', e.message); }
    return sent;
}

// ---------- End of call: log, inbox, alerts, billing ----------

const fmtDuration = (sec) => { const m = Math.floor(sec / 60), s = Math.round(sec % 60); return m ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`; };

async function recordCall(projectId, message = {}) {
    const call = message.call || {};
    const callId = call.id;
    if (!callId || isHouse(projectId)) return { skipped: true };
    const ref = projectRef(projectId).collection('voice_calls').doc(String(callId));
    if ((await ref.get()).exists) return { duplicate: true };

    const started = message.startedAt || call.startedAt || null;
    const ended = message.endedAt || call.endedAt || null;
    let seconds = Number(message.durationSeconds ?? message.durationMs / 1000 ?? NaN);
    if (!Number.isFinite(seconds)) seconds = started && ended ? Math.max(0, (Date.parse(ended) - Date.parse(started)) / 1000) : 0;
    const caller = call.customer?.number || 'Hidden number';
    const summary = message.analysis?.summary || message.summary || '';
    const transcript = String(message.artifact?.transcript || message.transcript || '').slice(0, 20000);
    const record = {
        callId, caller, type: call.type || null, startedAt: started, endedAt: ended || nowIso(), durationSeconds: Math.round(seconds),
        summary, transcript, recordingUrl: message.artifact?.recordingUrl || message.recordingUrl || null,
        endedReason: message.endedReason || null, assistantId: call.assistantId || null, createdAt: nowIso()
    };
    await ref.set(record);

    // Messages inbox: one conversation per caller, one entry per call
    try {
        const digits = String(caller).replace(/\D/g, '') || 'hidden';
        const lines = [`📞 Phone call · ${fmtDuration(seconds)}`, summary ? `\n${summary}` : '', !summary && record.endedReason ? `\n(${record.endedReason})` : ''].join('');
        await require('../messaging-platform/core').appendMessage(projectId, `voice_${digits}`, {
            role: 'user', author: 'user', content: lines, messageId: `call_${callId}`, callId, timestamp: record.endedAt
        }, { projectId, channel: 'voice', channelId: null, contactId: caller, unread: true, lastCustomerMessageAt: nowIso() });
    } catch (e) { console.warn('[Voice] Inbox log failed:', e.message); }

    notifyClient(projectId, {
        subject: `Call from ${caller} (${fmtDuration(seconds)})`,
        title: `Call with ${caller}`,
        sms: `📞 Call with ${caller} (${fmtDuration(seconds)})\n${(summary || 'No summary.').slice(0, 400)}`,
        details: [{ label: 'Caller', value: caller }, { label: 'Duration', value: fmtDuration(seconds) }],
        snippet: summary
    });

    if (seconds > 0) await require('../billing').recordVoiceMinutes(projectId, callId, seconds);
    return { saved: true };
}

/** Billing gate: a subscribed client must have the voice option; projects without a subscription are managed by hand. */
async function voiceAllowed(projectId) {
    if (isHouse(projectId)) return { allowed: true };
    try { return await require('../billing').voiceStatus(projectId); }
    catch (e) { console.warn('[Voice] Billing check failed, call allowed:', e.message); return { allowed: true }; }
}

// ---------- Phone numbers (Vapi) ----------

async function listNumbers() {
    const nums = (await axios.get(`${VAPI}/phone-number`, { headers: vapiHeaders() })).data || [];
    const linked = await db.collection('ai_projects').where('voice.vapiPhoneNumberId', '>', '').get();
    const owner = new Map(linked.docs.map(d => [d.data().voice.vapiPhoneNumberId, { projectId: d.id, name: d.data().name || d.id }]));
    return nums.map(n => ({ id: n.id, number: n.number || n.sipUri || '', provider: n.provider, name: n.name || '', linkedTo: owner.get(n.id) || null, hasFixedAssistant: !!n.assistantId }));
}

/** Points a Vapi number at this project: calls are routed by our server (assistant-request), so billing and routing apply. */
async function linkNumber(projectId, numberId) {
    const nums = await listNumbers();
    const n = nums.find(x => x.id === numberId);
    if (!n) throw new Error('Number not found in Vapi.');
    if (n.linkedTo && n.linkedTo.projectId !== projectId) throw new Error(`This number is already linked to ${n.linkedTo.name}.`);
    if (!(await findVoiceAgent(projectId))) throw new Error('Create a voice agent for this project first (AI Agents › agent › Voice).');
    await axios.patch(`${VAPI}/phone-number/${numberId}`, { assistantId: null, squadId: null, server: serverConfig(projectId) }, { headers: vapiHeaders() });
    await projectRef(projectId).set({ voice: { vapiPhoneNumberId: numberId, phoneNumber: n.number, updatedAt: nowIso() } }, { merge: true });
    return { number: n.number };
}

async function unlinkNumber(projectId) {
    const s = await getSettings(projectId);
    if (s.vapiPhoneNumberId) {
        // Leave the number without a destination rather than routing it anywhere unexpected
        await axios.patch(`${VAPI}/phone-number/${s.vapiPhoneNumberId}`, { assistantId: null, server: { url: callbackUrl('unlinked'), ...(process.env.VAPI_SECRET ? { headers: { 'x-vapi-secret': process.env.VAPI_SECRET } } : {}) } }, { headers: vapiHeaders() }).catch(e => console.warn('[Voice] Unlink in Vapi failed:', e.message));
    }
    await projectRef(projectId).set({ voice: { vapiPhoneNumberId: '', phoneNumber: '', updatedAt: nowIso() } }, { merge: true });
    return {};
}

async function summary(projectId, { staff }) {
    const [s, agent, project] = await Promise.all([getSettings(projectId), findVoiceAgent(projectId), getProject(projectId)]);
    const callsSnap = await projectRef(projectId).collection('voice_calls').orderBy('endedAt', 'desc').limit(20).get();
    const calls = callsSnap.docs.map(d => { const c = d.data(); return { callId: c.callId, caller: c.caller, endedAt: c.endedAt, durationSeconds: c.durationSeconds, summary: c.summary, ...(staff ? { endedReason: c.endedReason } : {}) }; });
    const access = await voiceAllowed(projectId);
    return {
        settings: s, phoneNumber: s.phoneNumber || null, agent: agent ? { id: agent.id, name: agent.name, active: agent.active !== false } : null,
        calendarConnected: !!project.googleTokens, allowed: access.allowed, reason: access.reason || null, calls
    };
}

// ---------- Routes: /api/voice ----------

function mountVoice(app, { verifyToken }) {
    const router = express.Router();
    const isStaff = (req) => req.user?.role !== 'client';
    const staff = (req, res, next) => isStaff(req) ? next() : res.status(403).json({ success: false, error: 'Staff only.' });
    const projectAccess = (req, res, next) => (isStaff(req) || req.user?.projectId === req.params.projectId) ? next() : res.status(403).json({ success: false, error: 'Access denied.' });
    const handle = (fn) => async (req, res) => {
        try { res.json({ success: true, ...(await fn(req)) }); }
        catch (e) { console.error('[Voice]', e.response?.data || e.message); res.status(400).json({ success: false, error: e.response?.data?.message || e.message }); }
    };
    router.use(express.json());
    router.get('/numbers', verifyToken, staff, handle(async () => ({ numbers: await listNumbers() })));
    router.get('/projects/:projectId', verifyToken, projectAccess, handle(async (req) => summary(req.params.projectId, { staff: isStaff(req) })));
    router.put('/projects/:projectId/settings', verifyToken, projectAccess, handle(async (req) => ({ settings: await saveSettings(req.params.projectId, req.body || {}, { staff: isStaff(req) }) })));
    router.post('/projects/:projectId/number', verifyToken, staff, handle(async (req) => linkNumber(req.params.projectId, String(req.body?.numberId || ''))));
    router.delete('/projects/:projectId/number', verifyToken, staff, handle(async (req) => unlinkNumber(req.params.projectId)));
    app.use('/api/voice', router);
    console.log('[Voice] Routes mounted on /api/voice');
}

module.exports = {
    isHouse, getSettings, findVoiceAgent, clientSlots, clientBook, clientCallNote, recordCall, voiceAllowed, mountVoice,
    // exported for tests
    _zonedToDate: zonedToDate, _cleanSettings: cleanSettings
};
