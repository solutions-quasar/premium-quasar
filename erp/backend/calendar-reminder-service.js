/**
 * Solutions Quasar Inc. - Calendar & Triple Reminder Service (J-24h, H-1h, H-0)
 * 
 * Manages:
 * 1. Booking appointments and syncing to Google Calendar (Push notification on Benjamin's phone)
 * 2. Instant SMS alert to Admin (+1 506 233-7006) on new booking
 * 3. Triple automated reminder sequence:
 *    - Rappel 1 (J-24h): Confirmation d'horaire et préparation
 *    - Rappel 2 (H-1h): Rappel de courtoisie
 *    - Rappel 3 (H-0): Envoi instantané du lien Google Meet direct au moment précis du rendez-vous
 * 4. Respects global Dry-Run switch
 */

const { db } = require('./firebase-admin');
const twilioService = require('./twilio-service');
const smsSequenceService = require('./sms-sequence-service');
const googleAuth = require('./google-auth');

const ADMIN_PHONE = '+15062337006';
const DEFAULT_MEET_LINK = 'https://meet.google.com/qsr-auto-meet';

function getHumanTzName(tz, isEn = false) {
    if (!tz) return isEn ? 'Atlantic Time' : "heure de l'Atlantique";
    if (tz.includes('Moncton') || tz.includes('Halifax')) return isEn ? 'Atlantic Time' : "heure de l'Atlantique";
    if (tz.includes('Toronto') || tz.includes('Montreal')) return isEn ? 'Eastern Time (QC/ON)' : "heure du Québec";
    if (tz.includes('New_York')) return isEn ? 'Eastern Time' : "heure de l'Est";
    if (tz.includes('Chicago') || tz.includes('Winnipeg')) return isEn ? 'Central Time' : "heure du Centre";
    if (tz.includes('Denver') || tz.includes('Edmonton')) return isEn ? 'Mountain Time' : "heure des Rocheuses";
    if (tz.includes('Phoenix')) return isEn ? 'Arizona Time' : "heure de l'Arizona";
    if (tz.includes('Los_Angeles') || tz.includes('Vancouver')) return isEn ? 'Pacific Time' : "heure du Pacifique";
    if (tz.includes('St_Johns')) return isEn ? 'Newfoundland Time' : "heure de Terre-Neuve";
    return tz;
}

class CalendarReminderService {
    constructor() {
        this.workerInterval = null;
    }

    init() {
        this.startReminderWorker();
        console.log('[CalendarReminderService] Initialized and reminder worker started.');
    }

    startReminderWorker() {
        if (this.workerInterval) clearInterval(this.workerInterval);

        // Check reminders every 30 seconds
        this.workerInterval = setInterval(async () => {
            try {
                await this.processDueReminders();
            } catch (err) {
                console.error('[CalendarReminderService] Worker error:', err.message);
            }
        }, 30000);
    }

    /**
     * Create / schedule a new appointment with triple reminders
     */
    async scheduleAppointment(appointmentData) {
        const {
            leadId,
            prospectName,
            prospectPhone,
            prospectEmail,
            appointmentTime, // ISO string
            notes,
            meetLink = DEFAULT_MEET_LINK
        } = appointmentData;

        if (!appointmentTime) {
            throw new Error('appointmentTime is required (ISO string)');
        }

        const apptDate = new Date(appointmentTime);
        if (isNaN(apptDate.getTime())) {
            throw new Error('Invalid appointmentTime format');
        }

        const nowMs = Date.now();
        const minNoticeMs = 2 * 60 * 60 * 1000; // Minimum 2 hours advance notice required

        if (apptDate.getTime() <= nowMs) {
            throw new Error(`CRITICAL: Appointment cannot be booked in the past (${apptDate.toISOString()}). Current time is ${new Date(nowMs).toISOString()}. Please select a future date and time.`);
        }

        if (apptDate.getTime() < nowMs + minNoticeMs) {
            throw new Error(`CRITICAL: Minimum advance notice of 2 hours is required. Requested time (${apptDate.toISOString()}) is too soon. Please choose a slot at least 2 hours from now.`);
        }

        // Calculate reminder trigger times
        const j24Time = new Date(apptDate.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const h1Time = new Date(apptDate.getTime() - 60 * 60 * 1000).toISOString();
        const h0Time = new Date(apptDate.getTime()).toISOString();

        // Safety: Do not arm reminders if their trigger window has already elapsed
        const isJ24Applicable = new Date(j24Time).getTime() > nowMs;
        const isH1Applicable = new Date(h1Time).getTime() > nowMs;

        const prospectTimezone = appointmentData.prospectTimezone || smsSequenceService.resolveTimezone({
            phone: prospectPhone,
            city: appointmentData.city || appointmentData.businessCity,
            state: appointmentData.state || appointmentData.province || appointmentData.businessState,
            postalCode: appointmentData.postalCode || appointmentData.postal_code,
            address: appointmentData.address || appointmentData.formattedAddress || appointmentData.businessLocation,
            country: appointmentData.country,
            timezone: appointmentData.timezone || appointmentData.businessTimezone
        });

        const businessLocation = appointmentData.businessLocation || appointmentData.businessLocationStr || null;

        const appointment = {
            leadId: leadId || null,
            prospectName: prospectName || 'Client',
            prospectPhone: prospectPhone || '',
            prospectEmail: prospectEmail || '',
            businessLocation: businessLocation || null,
            prospectTimezone: prospectTimezone || 'America/Moncton',
            appointmentTime: apptDate.toISOString(),
            meetLink,
            notes: notes || '',
            status: 'confirmed', // confirmed, cancelled, completed
            created_at: new Date().toISOString(),
            google_calendar_synced: false,
            google_event_id: null,
            reminders: {
                j24: {
                    type: 'J-24h',
                    scheduledTime: j24Time,
                    sent: false,
                    sentAt: null,
                    status: isJ24Applicable ? 'pending' : 'skipped',
                    note: isJ24Applicable ? undefined : 'Skipped: booked within 24h of meeting'
                },
                h1: {
                    type: 'H-1h',
                    scheduledTime: h1Time,
                    sent: false,
                    sentAt: null,
                    status: isH1Applicable ? 'pending' : 'skipped',
                    note: isH1Applicable ? undefined : 'Skipped: booked within 1h of meeting'
                },
                h0: {
                    type: 'H-0',
                    scheduledTime: h0Time,
                    sent: false,
                    sentAt: null,
                    status: 'pending'
                }
            }
        };

        // Save appointment to Firestore
        const docRef = await db.collection('appointments').add(appointment);
        const appointmentId = docRef.id;

        // Also save to `events` collection for ERP Calendar view
        try {
            await db.collection('events').add({
                appointmentId,
                title: `RDV Découverte: ${prospectName}`,
                start: apptDate.toISOString(),
                end: new Date(apptDate.getTime() + 45 * 60 * 1000).toISOString(),
                color: 'var(--gold)',
                service: 'RDV Stratégique Solutions Quasar',
                meetLink,
                phone: prospectPhone,
                created_at: new Date().toISOString()
            });
        } catch (evErr) {
            console.warn('[CalendarReminderService] Could not save to events collection:', evErr.message);
        }

        // 1. Google Calendar Push (sync to smartphone & create Google Meet link)
        try {
            const syncRes = await this.syncToGoogleCalendar(appointmentId, appointment);
            if (syncRes && syncRes.meetUrl) {
                meetLink = syncRes.meetUrl;
                appointment.meetLink = syncRes.meetUrl;
            }
        } catch (gErr) {
            console.warn('[CalendarReminderService] Google Calendar sync note:', gErr.message);
        }

        // 2. Alert Admin on phone (+1 506 233-7006)
        try {
            const formattedDate = apptDate.toLocaleDateString('fr-CA', {
                weekday: 'long',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                timeZone: 'America/Moncton'
            });
            const formattedTime = apptDate.toLocaleTimeString('fr-CA', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Moncton'
            });

            let prospectTzNotice = '';
            if (prospectTimezone && prospectTimezone !== 'America/Moncton') {
                const pTime = apptDate.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', timeZone: prospectTimezone });
                prospectTzNotice = ` (${pTime} ${getHumanTzName(prospectTimezone)})`;
            }

            await smsSequenceService.notifyAdminOnProspectAction({
                leadId: appointmentId,
                phoneNumber: prospectPhone,
                clientName: prospectName,
                companyName: prospectEmail || prospectPhone || 'Solutions Quasar Lead',
                actionType: 'booking',
                text: `📅 RDV fixé le ${formattedDate} à ${formattedTime} (Atlantique)${prospectTzNotice}. Meet: ${meetLink}`
            });
        } catch (alertErr) {
            console.error('[CalendarReminderService] Error notifying admin on booking:', alertErr.message);
        }

        // 3. Update lead status in CRM to 'Appointment Booked' (MEETING_SCHEDULED)
        try {
            await smsSequenceService.cancelSequenceOnReply({
                leadId,
                phone: prospectPhone,
                reason: 'STOPPED_MEETING',
                status: 'MEETING_SCHEDULED'
            });
        } catch (leadErr) {
            console.warn('[CalendarReminderService] Could not update lead status:', leadErr.message);
        }

        return {
            success: true,
            appointmentId,
            appointment
        };
    }

    /**
     * Try syncing to Google Calendar via googleAuth
     */
    async syncToGoogleCalendar(appointmentId, appointment) {
        try {
            const calendar = await googleAuth.getCalendar('master_admin');
            const apptDate = new Date(appointment.appointmentTime);
            const endDate = new Date(apptDate.getTime() + 45 * 60 * 1000);

            const prospectTz = appointment.prospectTimezone || 'America/Moncton';
            const businessLoc = appointment.businessLocation || '';
            const locExtra = businessLoc ? `\nLocalisation entreprise : ${businessLoc}` : '';
            let tzExtra = '';
            if (prospectTz && prospectTz !== 'America/Moncton') {
                const pTime = apptDate.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', timeZone: prospectTz });
                tzExtra = `\nHeure locale prospect (${getHumanTzName(prospectTz)}): ${pTime}`;
            }

            const eventRes = await calendar.events.insert({
                calendarId: 'primary',
                conferenceDataVersion: 1,
                requestBody: {
                    summary: `RDV Solutions Quasar - ${appointment.prospectName}`,
                    location: businessLoc || '',
                    description: `Rendez-vous stratégique Solutions Quasar avec ${appointment.prospectName}.${locExtra}${tzExtra}\nNotes: ${appointment.notes || 'Aucune'}\nTéléphone: ${appointment.prospectPhone}\nMeet: ${appointment.meetLink}`,
                    start: { dateTime: apptDate.toISOString(), timeZone: 'America/Moncton' },
                    end: { dateTime: endDate.toISOString(), timeZone: 'America/Moncton' },
                    attendees: appointment.prospectEmail ? [{ email: appointment.prospectEmail }] : [],
                    conferenceData: {
                        createRequest: {
                            requestId: `qsr-${appointmentId}-${Date.now()}`,
                            conferenceSolutionKey: { type: 'hangoutsMeet' }
                        }
                    }
                }
            });

            const googleEventId = eventRes.data.id;
            const meetUrl = eventRes.data.hangoutLink || appointment.meetLink;

            await db.collection('appointments').doc(appointmentId).update({
                google_calendar_synced: true,
                google_event_id: googleEventId,
                meetLink: meetUrl
            });

            // Update in-memory appointment object so callers receive the real Google Meet link
            appointment.meetLink = meetUrl;
            appointment.google_calendar_synced = true;
            appointment.google_event_id = googleEventId;

            console.log(`[CalendarReminderService] Synced event to Google Calendar! ID: ${googleEventId}, Meet: ${meetUrl}`);
            return { googleEventId, meetUrl };
        } catch (e) {
            console.error('[CalendarReminderService] Google Calendar API error:', e.message);
            return { googleEventId: null, meetUrl: appointment.meetLink };
        }
    }

    /**
     * Cancel an appointment and deactivate all pending reminders
     */
    async cancelAppointment(appointmentId, reason = 'deleted_from_calendar') {
        try {
            const docRef = db.collection('appointments').doc(appointmentId);
            const doc = await docRef.get();
            if (!doc.exists) return false;

            const data = doc.data();
            const reminders = data.reminders || {};
            for (const key of Object.keys(reminders)) {
                if (!reminders[key].sent) {
                    reminders[key].status = 'cancelled';
                    reminders[key].cancelledAt = new Date().toISOString();
                }
            }

            await docRef.update({
                status: 'cancelled',
                cancelledReason: reason,
                cancelledAt: new Date().toISOString(),
                reminders
            });

            // Clean up matching items in events collection
            try {
                const evSnap = await db.collection('events').where('appointmentId', '==', appointmentId).get();
                for (const evDoc of evSnap.docs) {
                    await evDoc.ref.delete();
                }
            } catch (_) {}

            console.log(`[CalendarReminderService] Cancelled appointment ${appointmentId} and pending reminders (Reason: ${reason}).`);
            return true;
        } catch (e) {
            console.error(`[CalendarReminderService] Error cancelling appointment ${appointmentId}:`, e.message);
            return false;
        }
    }

    /**
     * Reschedule appointment in Firestore and recalculate SMS reminder triggers
     */
    async rescheduleAppointment(appointmentId, newTimeIso, updates = {}) {
        try {
            const docRef = db.collection('appointments').doc(appointmentId);
            const doc = await docRef.get();
            if (!doc.exists) return false;

            const data = doc.data();
            const newDate = new Date(newTimeIso);
            if (isNaN(newDate.getTime())) return false;

            const j24Time = new Date(newDate.getTime() - 24 * 60 * 60 * 1000).toISOString();
            const h1Time = new Date(newDate.getTime() - 60 * 60 * 1000).toISOString();
            const h0Time = new Date(newDate.getTime()).toISOString();

            const now = new Date();
            const reminders = data.reminders || {};

            if (reminders.j24) {
                reminders.j24.scheduledTime = j24Time;
                if (new Date(j24Time) > now) {
                    reminders.j24.sent = false;
                    reminders.j24.status = 'pending';
                    reminders.j24.sentAt = null;
                }
            }
            if (reminders.h1) {
                reminders.h1.scheduledTime = h1Time;
                if (new Date(h1Time) > now) {
                    reminders.h1.sent = false;
                    reminders.h1.status = 'pending';
                    reminders.h1.sentAt = null;
                }
            }
            if (reminders.h0) {
                reminders.h0.scheduledTime = h0Time;
                if (new Date(h0Time) > now) {
                    reminders.h0.sent = false;
                    reminders.h0.status = 'pending';
                    reminders.h0.sentAt = null;
                }
            }

            const updatePayload = {
                appointmentTime: newDate.toISOString(),
                status: 'confirmed',
                reminders,
                updated_at: new Date().toISOString()
            };

            if (updates.notes !== undefined) updatePayload.notes = updates.notes;
            if (updates.prospectName) updatePayload.prospectName = updates.prospectName;
            if (updates.prospectPhone) updatePayload.prospectPhone = updates.prospectPhone;

            await docRef.update(updatePayload);

            // Sync to Google Calendar if event exists
            if (data.google_event_id) {
                try {
                    const calendar = await googleAuth.getCalendar('master_admin');
                    await calendar.events.patch({
                        calendarId: 'primary',
                        eventId: data.google_event_id,
                        requestBody: {
                            start: { dateTime: newDate.toISOString(), timeZone: 'America/Moncton' },
                            end: { dateTime: new Date(newDate.getTime() + 45 * 60 * 1000).toISOString(), timeZone: 'America/Moncton' }
                        }
                    });
                    console.log(`[CalendarReminderService] Synced reschedule for event ${data.google_event_id} on Google Calendar.`);
                } catch (gErr) {
                    console.warn('[CalendarReminderService] Note updating Google Calendar event on reschedule:', gErr.message);
                }
            }

            // Also update events collection
            try {
                const evSnap = await db.collection('events').where('appointmentId', '==', appointmentId).get();
                for (const evDoc of evSnap.docs) {
                    const evUpdates = {
                        start: newDate.toISOString(),
                        end: new Date(newDate.getTime() + 45 * 60 * 1000).toISOString(),
                        updated_at: new Date().toISOString()
                    };
                    if (updates.prospectName) evUpdates.title = `RDV Découverte: ${updates.prospectName}`;
                    await evDoc.ref.update(evUpdates);
                }
            } catch (_) {}

            console.log(`[CalendarReminderService] Rescheduled appointment ${appointmentId} to ${newDate.toISOString()}`);
            return true;
        } catch (err) {
            console.error(`[CalendarReminderService] Error rescheduling appointment ${appointmentId}:`, err.message);
            return false;
        }
    }

    /**
     * Get booking settings from Firestore or default configuration
     */
    async getBookingSettings() {
        try {
            const doc = await db.collection('settings').doc('booking_settings').get();
            if (doc.exists) {
                const data = doc.data();
                return {
                    startHour: data.startHour !== undefined ? parseInt(data.startHour, 10) : 11,
                    endHour: data.endHour !== undefined ? parseInt(data.endHour, 10) : 18,
                    daysOfWeek: Array.isArray(data.daysOfWeek) ? data.daysOfWeek.map(Number) : [1, 2, 3, 4, 5],
                    slotDurationMinutes: data.slotDurationMinutes !== undefined ? parseInt(data.slotDurationMinutes, 10) : 45,
                    minNoticeHours: data.minNoticeHours !== undefined ? parseInt(data.minNoticeHours, 10) : 2,
                    timeZone: data.timeZone || 'America/Moncton',
                    updatedAt: data.updatedAt || null
                };
            }
        } catch (err) {
            console.warn('[CalendarReminderService] Notice fetching booking_settings:', err.message);
        }
        return {
            startHour: 11,
            endHour: 18,
            daysOfWeek: [1, 2, 3, 4, 5],
            slotDurationMinutes: 45,
            minNoticeHours: 2,
            timeZone: 'America/Moncton',
            updatedAt: null
        };
    }

    /**
     * Save updated booking settings to Firestore
     */
    async saveBookingSettings(settings) {
        const toSave = {
            startHour: parseInt(settings.startHour, 10) || 11,
            endHour: parseInt(settings.endHour, 10) || 18,
            daysOfWeek: Array.isArray(settings.daysOfWeek) ? settings.daysOfWeek.map(Number) : [1, 2, 3, 4, 5],
            slotDurationMinutes: parseInt(settings.slotDurationMinutes, 10) || 45,
            minNoticeHours: parseInt(settings.minNoticeHours, 10) || 2,
            timeZone: settings.timeZone || 'America/Moncton',
            updatedAt: new Date().toISOString()
        };
        await db.collection('settings').doc('booking_settings').set(toSave, { merge: true });
        console.log('[CalendarReminderService] Saved updated booking settings (Atlantic):', toSave);
        return toSave;
    }

    /**
     * Get upcoming available appointment slots by reading Google Calendar & Firestore events
     */
    async getAvailableSlots(daysAhead = 5, prospectTimezone = null) {
        const now = new Date();
        const maxDays = Math.min(Math.max(1, daysAhead || 5), 14);
        
        // Load customizable booking settings
        const settings = await this.getBookingSettings();
        const timeZone = settings.timeZone || process.env.TIMEZONE || 'America/Moncton';
        const slotDurationMs = (settings.slotDurationMinutes || 45) * 60 * 1000;
        const minNoticeMs = (settings.minNoticeHours || 2) * 60 * 60 * 1000;
        const allowedDays = settings.daysOfWeek || [1, 2, 3, 4, 5];

        const getHumanTzName = (tz, isEn = false) => {
            if (!tz) return isEn ? 'Atlantic Time' : "heure de l'Atlantique";
            if (tz.includes('Moncton') || tz.includes('Halifax')) return isEn ? 'Atlantic Time' : "heure de l'Atlantique";
            if (tz.includes('Toronto') || tz.includes('Montreal')) return isEn ? 'Eastern Time (QC/ON)' : "heure du Québec";
            if (tz.includes('New_York')) return isEn ? 'Eastern Time' : "heure de l'Est";
            if (tz.includes('Chicago') || tz.includes('Winnipeg')) return isEn ? 'Central Time' : "heure du Centre";
            if (tz.includes('Denver') || tz.includes('Edmonton')) return isEn ? 'Mountain Time' : "heure des Rocheuses";
            if (tz.includes('Phoenix')) return isEn ? 'Arizona Time' : "heure de l'Arizona";
            if (tz.includes('Los_Angeles') || tz.includes('Vancouver')) return isEn ? 'Pacific Time' : "heure du Pacifique";
            if (tz.includes('St_Johns')) return isEn ? 'Newfoundland Time' : "heure de Terre-Neuve";
            return tz;
        };

        // 1. Fetch busy intervals from Google Calendar
        let busyIntervals = [];
        try {
            const calendar = await googleAuth.getCalendar('master_admin');
            const endHorizon = new Date(now.getTime() + (maxDays + 2) * 24 * 60 * 60 * 1000);
            const gEvents = await calendar.events.list({
                calendarId: 'primary',
                timeMin: now.toISOString(),
                timeMax: endHorizon.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
                maxResults: 250
            });

            (gEvents.data.items || []).forEach(item => {
                const s = item.start?.dateTime || item.start?.date;
                const e = item.end?.dateTime || item.end?.date;
                if (s && e) {
                    busyIntervals.push({ start: new Date(s).getTime(), end: new Date(e).getTime() });
                }
            });
        } catch (gErr) {
            console.warn('[CalendarReminderService] Google Calendar availability check note:', gErr.message);
        }

        // 2. Fetch busy intervals from Firestore appointments
        try {
            const apptsSnap = await db.collection('appointments')
                .where('status', '==', 'confirmed')
                .get();
            apptsSnap.forEach(d => {
                const data = d.data();
                if (data.appointmentTime) {
                    const st = new Date(data.appointmentTime).getTime();
                    busyIntervals.push({ start: st, end: st + slotDurationMs });
                }
            });
        } catch (fErr) {
            console.warn('[CalendarReminderService] Firestore appointments check note:', fErr.message);
        }

        // 3. Helper to create Zoned Date in Atlantic timezone
        const createZonedDate = (year, month, day, hour, min = 0) => {
            const guess = new Date(Date.UTC(year, month - 1, day, 12, 0));
            const tzStr = guess.toLocaleString('en-US', { timeZone, timeZoneName: 'shortOffset' });
            const match = tzStr.match(/GMT([+-]\d+)/);
            const off = match ? parseInt(match[1], 10) : -3;
            return new Date(Date.UTC(year, month - 1, day, hour - off, min));
        };

        const availableSlots = [];

        // Build business hours array from settings.startHour to settings.endHour
        const businessHours = [];
        for (let h = settings.startHour; h < settings.endHour; h++) {
            businessHours.push(h);
        }

        for (let d = 0; d < maxDays + 3 && availableSlots.length < 8; d++) {
            const checkDay = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
            
            // Check if day of week is allowed (0=Sun, 1=Mon, ..., 6=Sat)
            const dayOfWeekStr = checkDay.toLocaleDateString('en-US', { weekday: 'short', timeZone });
            const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
            const dayIdx = dayMap[dayOfWeekStr];
            if (!allowedDays.includes(dayIdx)) continue;

            const yStr = checkDay.toLocaleDateString('en-CA', { year: 'numeric', timeZone });
            const mStr = checkDay.toLocaleDateString('en-CA', { month: 'numeric', timeZone });
            const dStr = checkDay.toLocaleDateString('en-CA', { day: 'numeric', timeZone });
            const year = parseInt(yStr, 10);
            const month = parseInt(mStr, 10);
            const day = parseInt(dStr, 10);

            for (const hour of businessHours) {
                if (availableSlots.length >= 8) break;
                const slotCandidate = createZonedDate(year, month, day, hour, 0);
                const slotTimeMs = slotCandidate.getTime();

                if (slotTimeMs < now.getTime() + minNoticeMs) continue;

                const slotEndMs = slotTimeMs + slotDurationMs;
                const collides = busyIntervals.some(b => (slotTimeMs < b.end && slotEndMs > b.start));

                if (!collides) {
                    const labelFr = slotCandidate.toLocaleDateString('fr-CA', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone
                    });
                    const labelEn = slotCandidate.toLocaleDateString('en-CA', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone
                    });

                    if (prospectTimezone && prospectTimezone !== timeZone) {
                        const prospectLabelFr = slotCandidate.toLocaleDateString('fr-CA', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: prospectTimezone
                        });
                        const prospectLabelEn = slotCandidate.toLocaleDateString('en-CA', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: prospectTimezone
                        });
                        const pTzFr = getHumanTzName(prospectTimezone, false);
                        const aTzFr = getHumanTzName(timeZone, false);
                        const pTzEn = getHumanTzName(prospectTimezone, true);
                        const aTzEn = getHumanTzName(timeZone, true);

                        availableSlots.push({
                            iso: slotCandidate.toISOString(),
                            label_fr: `${prospectLabelFr} (${pTzFr}) [${labelFr} ${aTzFr}]`,
                            label_en: `${prospectLabelEn} (${pTzEn}) [${labelEn} ${aTzEn}]`,
                            prospectTime: prospectLabelFr,
                            prospectTimezoneName: pTzFr,
                            agencyTime: labelFr,
                            agencyTimezoneName: aTzFr
                        });
                    } else {
                        availableSlots.push({
                            iso: slotCandidate.toISOString(),
                            label_fr: labelFr,
                            label_en: labelEn
                        });
                    }
                }
            }
        }

        return availableSlots;
    }

    /**
     * Process due reminders (J-24h, H-1h, H-0)
     */
    async processDueReminders() {
        const snap = await db.collection('appointments')
            .where('status', '==', 'confirmed')
            .get();

        if (snap.empty) return;

        const now = new Date();
        const settings = await smsSequenceService.getSettings();
        const isDryRun = settings.dryRunMode;

        for (const doc of snap.docs) {
            const appt = doc.data();
            const apptId = doc.id;
            const phone = appt.prospectPhone;

            if (!phone || !appt.reminders) continue;

            const apptTime = new Date(appt.appointmentTime);
            const prospectTz = appt.prospectTimezone || smsSequenceService.resolveTimezone({ phone }) || 'America/Moncton';
            const timeString = apptTime.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', timeZone: prospectTz });
            const dateString = apptTime.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'short', timeZone: prospectTz });

            const reminderTypes = ['j24', 'h1', 'h0'];
            let modified = false;

            // Check if any reminder is due right now for this appointment
            const hasDueReminders = reminderTypes.some(rKey => {
                const r = appt.reminders[rKey];
                return r && !r.sent && r.status === 'pending' && now >= new Date(r.scheduledTime);
            });

            // Liveness & Time Synchronization check: Verify in real-time that Google Calendar event still exists and check if time was changed
            if (hasDueReminders && appt.google_event_id) {
                try {
                    const calendar = await googleAuth.getCalendar('master_admin');
                    const gRes = await calendar.events.get({
                        calendarId: 'primary',
                        eventId: appt.google_event_id
                    });
                    if (gRes.data && gRes.data.status === 'cancelled') {
                        console.log(`[CalendarReminderService] Google Calendar event ${appt.google_event_id} is CANCELLED. Auto-cancelling reminders for ${apptId}...`);
                        await this.cancelAppointment(apptId, 'cancelled_in_google_calendar');
                        continue;
                    }

                    // Check if event was moved/rescheduled on mobile Google Calendar
                    const gStart = gRes.data?.start?.dateTime;
                    if (gStart && new Date(gStart).getTime() !== new Date(appt.appointmentTime).getTime()) {
                        console.log(`[CalendarReminderService] Google Calendar event ${appt.google_event_id} was rescheduled to ${gStart} on Google Calendar. Syncing Firestore & recalculating reminders...`);
                        await this.rescheduleAppointment(apptId, gStart, {
                            notes: gRes.data.description || appt.notes,
                            prospectName: gRes.data.summary?.replace(/^RDV (Solutions Quasar|Découverte)( - )?/i, '') || appt.prospectName
                        });
                        continue; // Skip sending reminder at old time, wait for rescheduled times!
                    }
                } catch (gErr) {
                    if (gErr.code === 404 || gErr.status === 404 || gErr.message?.includes('Not Found') || gErr.message?.includes('deleted')) {
                        console.log(`[CalendarReminderService] Google Calendar event ${appt.google_event_id} was DELETED (404). Auto-cancelling reminders for ${apptId}...`);
                        await this.cancelAppointment(apptId, 'deleted_in_google_calendar');
                        continue;
                    }
                }
            }

            for (const rKey of reminderTypes) {
                const rem = appt.reminders[rKey];
                if (!rem || rem.sent || rem.status === 'skipped' || rem.status === 'cancelled' || rem.status === 'expired') continue;

                // Safety: If the meeting has already occurred (past by more than 15 min), expire remaining reminders without sending
                if (now.getTime() - apptTime.getTime() > 15 * 60 * 1000) {
                    rem.status = 'expired';
                    rem.note = 'Appointment time already elapsed';
                    modified = true;
                    continue;
                }

                const scheduled = new Date(rem.scheduledTime);
                if (now >= scheduled) {
                    // Compose reminder message
                    let text = '';
                    if (rKey === 'j24') {
                        text = `Bonjour ${appt.prospectName}, rappel de notre rendez-vous stratégique prévu demain (${dateString}) à ${timeString}. Pour toute modification, répondez directement à ce SMS. - Benjamin, Solutions Quasar`;
                    } else if (rKey === 'h1') {
                        text = `Bonjour ${appt.prospectName}, notre rendez-vous Solutions Quasar débute dans 1 heure (${timeString}). À très bientôt ! - Benjamin`;
                    } else if (rKey === 'h0') {
                        text = `Bonjour ${appt.prospectName}, c'est l'heure ! Rejoignez directement notre visioconférence Google Meet ici : ${appt.meetLink}. À tout de suite ! - Benjamin, Solutions Quasar`;
                    }

                    if (isDryRun) {
                        console.log(`[CalendarReminderService] [DRY-RUN] Simulating reminder ${rem.type} to ${phone}: "${text}"`);
                        rem.sent = true;
                        rem.sentAt = now.toISOString();
                        rem.status = 'simulated';
                        rem.text = text;
                        modified = true;
                    } else {
                        try {
                            console.log(`[CalendarReminderService] Sending REAL reminder ${rem.type} to ${phone}...`);
                            await twilioService.sendSms({ to: phone, message: text });
                            rem.sent = true;
                            rem.sentAt = now.toISOString();
                            rem.status = 'sent';
                            rem.text = text;
                            modified = true;
                        } catch (sendErr) {
                            console.error(`[CalendarReminderService] Failed sending reminder ${rem.type} to ${phone}:`, sendErr.message);
                            rem.status = 'failed';
                            rem.lastError = sendErr.message;
                            modified = true;
                        }
                    }
                }
            }

            if (modified) {
                await db.collection('appointments').doc(apptId).update({
                    reminders: appt.reminders,
                    updated_at: now.toISOString()
                });
            }
        }
    }

    /**
     * Finds active confirmed upcoming appointment for a phone or leadId
     */
    async findActiveAppointment(phone, leadId = null) {
        try {
            const phoneVars = twilioService.getPhoneVariations ? twilioService.getPhoneVariations(phone) : [phone];

            // 1. Search by phone
            if (phoneVars && phoneVars.length > 0) {
                const snap = await db.collection('appointments')
                    .where('status', '==', 'confirmed')
                    .where('prospectPhone', 'in', phoneVars)
                    .get();

                const valid = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(a => a.appointmentTime && new Date(a.appointmentTime).getTime() >= Date.now() - 30 * 60 * 1000)
                    .sort((a, b) => new Date(a.appointmentTime) - new Date(b.appointmentTime));

                if (valid.length > 0) return valid[0];
            }

            // 2. Search by leadId
            if (leadId) {
                const snapLead = await db.collection('appointments')
                    .where('status', '==', 'confirmed')
                    .where('leadId', '==', leadId)
                    .get();

                const validLead = snapLead.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(a => a.appointmentTime && new Date(a.appointmentTime).getTime() >= Date.now() - 30 * 60 * 1000)
                    .sort((a, b) => new Date(a.appointmentTime) - new Date(b.appointmentTime));

                if (validLead.length > 0) return validLead[0];
            }

            return null;
        } catch (err) {
            console.error('[CalendarReminderService] findActiveAppointment error:', err.message);
            return null;
        }
    }
}

const instance = new CalendarReminderService();
module.exports = instance;
