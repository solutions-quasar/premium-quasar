// --- FullCalendar Integration - Direct Real-Time Google Calendar Sync ---
import { db, auth } from '../firebase-config.js';
import { collection, getDocs, query } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const API_BASE = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : '';

export async function initCalendar() {
    const container = document.getElementById('view-calendar');
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px;">
                <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:#F8FAFC;">Calendrier des Rendez-vous & Appels</h3>
                <div id="cal-google-badge" style="font-size:0.75rem; font-weight:600; padding:2px 10px; border-radius:6px; background:rgba(255,255,255,0.05); color:#94A3B8; display:flex; align-items:center; gap:6px;">
                    <span>📅</span>
                    <span id="cal-google-text">Vérification Google Agenda...</span>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <button id="cal-btn-settings" class="btn btn-xs btn-outline-gold" onclick="window.openBookingSettingsModal()" style="font-weight:600; padding:5px 12px; font-size:0.76rem;">
                    ⚙️ Horaires réservables
                </button>
                <button id="cal-btn-sync" class="btn btn-xs btn-secondary" onclick="window.refreshAllCalendarEvents()" style="font-weight:600; padding:5px 12px; font-size:0.76rem; border:1px solid rgba(255,255,255,0.15);">
                    🔄 Synchroniser
                </button>
                <button id="cal-btn-google-connect" class="btn btn-xs btn-outline-gold" onclick="window.connectGoogleCalendar()" style="display:none; font-weight:600; padding:5px 12px; font-size:0.76rem;">
                    🔗 Connecter mon Google Agenda
                </button>
                <button id="cal-btn-google-disconnect" class="btn btn-xs" onclick="window.disconnectGoogleCalendar()" style="display:none; color:#EF4444; border-color:rgba(239,68,68,0.3); padding:5px 12px; font-size:0.76rem;">
                    Déconnecter
                </button>
            </div>
        </div>
        <div id="cal-unconnected-banner" style="display:none; margin-bottom:12px; padding:12px 16px; border-radius:8px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); color:#FBBF24; font-size:0.85rem; display:none; align-items:center; justify-content:space-between;">
            <div>
                <strong>Google Agenda non connecté :</strong> Connectez votre compte Google pour afficher et synchroniser vos rendez-vous réels en temps réel.
            </div>
            <button class="btn btn-xs btn-outline-gold" onclick="window.connectGoogleCalendar()" style="margin-left:10px; font-weight:600;">
                Connecter maintenant
            </button>
        </div>
        <div id="calendar-wrapper" style="height: calc(100% - 60px); min-height: 600px;"></div>
    `;

    window.isGoogleCalendarConnected = false;

    // Check if coming back from Google OAuth redirect
    if (window.location.search.includes('google=connected') || window.location.hash.includes('google=connected')) {
        setTimeout(() => {
            window.showToast?.("✓ Votre Google Calendar est maintenant connecté avec succès !", "success");
        }, 500);
    }

    // Load Clients for modal selector
    window.allClients = [];
    try {
        const clSnap = await getDocs(query(collection(db, "clients")));
        clSnap.forEach(doc => window.allClients.push({ id: doc.id, ...doc.data() }));
    } catch (_) {}

    // Check Google Calendar Status
    fetch(`${API_BASE}/api/integrations/google/status`)
        .then(r => r.json())
        .then(data => {
            const badge = document.getElementById('cal-google-badge');
            const text = document.getElementById('cal-google-text');
            const btnConn = document.getElementById('cal-btn-google-connect');
            const btnDisc = document.getElementById('cal-btn-google-disconnect');
            const banner = document.getElementById('cal-unconnected-banner');

            if (data.connected) {
                window.isGoogleCalendarConnected = true;
                if (badge) {
                    badge.style.background = 'rgba(16,185,129,0.12)';
                    badge.style.color = '#10B981';
                    badge.style.border = '1px solid rgba(16,185,129,0.25)';
                }
                if (text) text.textContent = `Google Agenda Connecté (${data.email || 'Temps réel'})`;
                if (btnDisc) btnDisc.style.display = 'inline-flex';
                if (btnConn) btnConn.style.display = 'none';
                if (banner) banner.style.display = 'none';
                // Trigger live refetch
                if (window.currentCalendar) {
                    window.currentCalendar.refetchEvents();
                }
            } else {
                window.isGoogleCalendarConnected = false;
                if (badge) {
                    badge.style.background = 'rgba(245,158,11,0.12)';
                    badge.style.color = '#F59E0B';
                    badge.style.border = '1px solid rgba(245,158,11,0.25)';
                }
                if (text) text.textContent = 'Google Agenda Non Connecté';
                if (btnConn) btnConn.style.display = 'inline-flex';
                if (btnDisc) btnDisc.style.display = 'none';
                if (banner) banner.style.display = 'flex';
            }
        }).catch(() => {});

    const calendarEl = document.getElementById('calendar-wrapper');

    // Check if FullCalendar is loaded
    if (typeof FullCalendar === 'undefined') {
        container.innerHTML = `<div class="text-danger">Error: FullCalendar library not loaded. Refresh.</div>`;
        return;
    }

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        height: '100%',
        editable: true,
        selectable: true,
        selectMirror: true,
        dayMaxEvents: true,
        themeSystem: 'standard',
        // Fetch ONLY real data from Google Calendar
        events: async function (fetchInfo, successCallback, failureCallback) {
            try {
                const resp = await fetch(`${API_BASE}/api/integrations/google/events?timeMin=${encodeURIComponent(fetchInfo.startStr)}&timeMax=${encodeURIComponent(fetchInfo.endStr)}`);
                const data = await resp.json();
                if (data.success && Array.isArray(data.events)) {
                    console.log(`[Google Calendar Sync] Loaded ${data.events.length} real Google Calendar events in view.`);
                    successCallback(data.events);
                } else {
                    successCallback([]);
                }
            } catch (err) {
                console.warn("[Google Calendar Sync] Notice fetching events:", err.message);
                successCallback([]);
            }
        },
        select: function (arg) {
            // Open Create Event Modal
            const modalHtml = `
            <div class="crm-modal-overlay" id="cal-modal-overlay" onclick="closeCalModal()">
                <div class="crm-modal-content" onclick="event.stopPropagation()">
                    <div class="crm-modal-header">
                        <div class="text-h">Nouveau Rendez-vous (Google Calendar)</div>
                        <button class="icon-btn" onclick="closeCalModal()"><span class="material-icons">close</span></button>
                    </div>
                    <div class="crm-modal-body">
                        <div class="form-group" style="margin-bottom:12px;">
                            <label class="form-label">Client / Prospect</label>
                            <select id="cal-event-client" class="form-input">
                                <option value="">-- Sélectionner un contact (Optionnel) --</option>
                                ${(window.allClients || []).map(c => `<option value="${c.id}">${c.name || c.displayName || c.email || 'Client'}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom:12px;">
                            <label class="form-label">Titre du Rendez-vous</label>
                            <input type="text" id="cal-event-title" class="form-input" placeholder="RDV Découverte Solutions Quasar" autofocus>
                        </div>
                        <div class="form-group" style="margin-bottom:12px;">
                            <label class="form-label">Service / Objet</label>
                            <input type="text" id="cal-event-service" class="form-input" placeholder="Audit IA / Refonte Web / Agent Vocal">
                        </div>
                        <div class="form-group" style="margin-bottom:12px;">
                            <label class="form-label">Numéro Mobile du Client (pour Rappels SMS)</label>
                            <input type="tel" id="cal-event-phone" class="form-input" placeholder="+15061234567">
                        </div>
                        <div class="form-group" style="margin-bottom:12px;">
                            <label class="form-label">Lien Visioconférence (Google Meet)</label>
                            <input type="text" id="cal-event-meet" class="form-input" value="https://meet.google.com/qsr-auto-meet" placeholder="https://meet.google.com/...">
                        </div>
                        <div class="form-group" style="margin-bottom:12px; background:rgba(223,165,58,0.08); padding:10px; border-radius:8px; border:1px solid rgba(223,165,58,0.2);">
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                                <input type="checkbox" id="cal-event-reminders" checked style="accent-color:var(--gold); width:18px; height:18px;">
                                <div>
                                    <div style="font-size:0.85rem; font-weight:700; color:var(--gold);">Activer le Triple Rappel SMS (J-24h, H-1h, H-0)</div>
                                    <div class="text-xs text-muted">Alerte Benjamin (+1 506 233-7006) + Envoi automatique du lien Meet à l'heure pile</div>
                                </div>
                            </label>
                        </div>
                    </div>
                    <div class="crm-modal-footer">
                        <button class="btn btn-secondary" onclick="closeCalModal()">Annuler</button>
                        <button class="btn btn-primary" onclick="saveCalEvent('${arg.startStr}', '${arg.endStr}', ${arg.allDay})">Enregistrer dans Google Calendar</button>
                    </div>
                </div>
            </div>`;

            const existing = document.getElementById('cal-modal-host');
            if (existing) existing.remove();

            const host = document.createElement('div');
            host.id = 'cal-modal-host';
            host.innerHTML = modalHtml;
            document.body.appendChild(host);

            setTimeout(() => document.getElementById('cal-event-title')?.focus(), 50);
            calendar.unselect();
        },
        eventClick: function (arg) {
            const event = arg.event;
            const extended = event.extendedProps || {};
            const eventId = event.id || extended.googleEventId;

            const modalHtml = `
            <div class="crm-modal-overlay" id="cal-modal-overlay" onclick="closeCalModal()">
                <div class="crm-modal-content" onclick="event.stopPropagation()" style="max-width:540px;">
                    <div class="crm-modal-header">
                        <div class="text-h">Détails Google Calendar</div>
                        <button class="icon-btn" onclick="closeCalModal()"><span class="material-icons">close</span></button>
                    </div>
                    <div class="crm-modal-body">
                        <div style="margin-bottom:15px;">
                            <strong style="color:var(--text-grey);">Événement :</strong>
                            <div style="font-size:1.15rem; margin-top:4px; font-weight:700; color:#F8FAFC;">${event.title}</div>
                        </div>
                        <div style="margin-bottom:15px;">
                            <strong style="color:var(--text-grey);">Horaire :</strong>
                            <div style="margin-top:4px; font-size:0.95rem; color:#CBD5E1;">
                                ${event.start ? event.start.toLocaleString('fr-CA') : "N/A"} 
                                ${event.end ? ' - ' + event.end.toLocaleString('fr-CA') : ''}
                            </div>
                        </div>
                        ${extended.prospectPhone ? `
                        <div style="margin-bottom:15px;">
                            <strong style="color:var(--text-grey);">Téléphone Client :</strong>
                            <div style="margin-top:4px; font-size:0.95rem; color:#DFAB3A; font-weight:600;">
                                📞 ${extended.prospectPhone}
                            </div>
                        </div>` : ''}
                        ${extended.remindersActive ? `
                        <div style="margin-bottom:15px; background:rgba(223,165,58,0.08); padding:8px 12px; border-radius:6px; border:1px solid rgba(223,165,58,0.25); font-size:0.85rem; color:#FBBF24;">
                            🔔 <strong>Triple Rappel SMS Actif :</strong> J-24h, H-1h et H-0 programmés
                        </div>` : ''}
                        ${extended.description ? `
                        <div style="margin-bottom:15px;">
                            <strong style="color:var(--text-grey);">Description / Notes :</strong>
                            <div style="margin-top:4px; font-size:0.9rem; white-space:pre-wrap; color:#94A3B8;">${extended.description}</div>
                        </div>` : ''}
                        ${extended.meetLink ? `
                        <div style="margin-bottom:15px;">
                            <strong style="color:var(--text-grey);">Visioconférence Google Meet :</strong>
                            <div style="margin-top:6px;">
                                <a href="${extended.meetLink}" target="_blank" class="btn btn-sm btn-primary" style="display:inline-flex; align-items:center; gap:6px; font-weight:600;">
                                    📹 Rejoindre Google Meet
                                </a>
                            </div>
                        </div>` : ''}
                        ${extended.htmlLink ? `
                        <div style="margin-bottom:10px;">
                            <a href="${extended.htmlLink}" target="_blank" style="color:#3B82F6; text-decoration:underline; font-size:0.85rem;">
                                Ouvrir dans Google Calendar ↗
                            </a>
                        </div>` : ''}

                        <!-- App-Native Confirmation Box (No browser popups) -->
                        <div id="cal-delete-confirm-box" style="display:none; margin-top:14px; padding:12px; border-radius:8px; background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3);">
                            <div style="color:#FCA5A5; font-size:0.85rem; font-weight:600; margin-bottom:8px;">
                                ⚠️ Supprimer définitivement ce rendez-vous de Google Agenda et annuler tous les rappels ?
                            </div>
                            <div style="display:flex; gap:8px;">
                                <button class="btn btn-xs btn-danger" onclick="confirmDeleteGoogleCalEvent('${eventId}')" style="font-weight:700;">Confirmer la suppression</button>
                                <button class="btn btn-xs btn-secondary" onclick="document.getElementById('cal-delete-confirm-box').style.display='none'">Annuler</button>
                            </div>
                        </div>
                    </div>
                    <div class="crm-modal-footer">
                        <button class="btn btn-danger" onclick="document.getElementById('cal-delete-confirm-box').style.display='block'" style="margin-right:auto;">Supprimer de Google Agenda</button>
                        <button class="btn btn-primary" onclick="openEditEventModal('${eventId}')">✏️ Modifier</button>
                        <button class="btn btn-secondary" onclick="closeCalModal()">Fermer</button>
                    </div>
                </div>
            </div>`;

            const existing = document.getElementById('cal-modal-host');
            if (existing) existing.remove();

            const host = document.createElement('div');
            host.id = 'cal-modal-host';
            host.innerHTML = modalHtml;
            document.body.appendChild(host);
        },
        eventDrop: async function (info) {
            const eventId = info.event.id || info.event.extendedProps?.googleEventId;
            if (!eventId) return;

            try {
                window.showToast?.("Mise à jour dans Google Calendar en cours...", "info");
                const res = await fetch(`${API_BASE}/api/integrations/google/events/${encodeURIComponent(eventId)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        start: info.event.start.toISOString(),
                        end: info.event.end ? info.event.end.toISOString() : null
                    })
                });
                const data = await res.json();
                if (data.success) {
                    window.showToast?.("✓ Événement déplacé avec succès dans Google Calendar !", "success");
                    if (window.currentCalendar) window.currentCalendar.refetchEvents();
                } else {
                    info.revert();
                    window.showToast?.(`Erreur de déplacement : ${data.error || 'Échec'}`, "error");
                }
            } catch (err) {
                info.revert();
                window.showToast?.(`Erreur : ${err.message}`, "error");
            }
        },
        eventResize: async function (info) {
            const eventId = info.event.id || info.event.extendedProps?.googleEventId;
            if (!eventId) return;

            try {
                window.showToast?.("Mise à jour dans Google Calendar en cours...", "info");
                const res = await fetch(`${API_BASE}/api/integrations/google/events/${encodeURIComponent(eventId)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        end: info.event.end ? info.event.end.toISOString() : null
                    })
                });
                const data = await res.json();
                if (data.success) {
                    window.showToast?.("✓ Durée mise à jour avec succès dans Google Calendar !", "success");
                    if (window.currentCalendar) window.currentCalendar.refetchEvents();
                } else {
                    info.revert();
                    window.showToast?.(`Erreur de redimensionnement : ${data.error || 'Échec'}`, "error");
                }
            } catch (err) {
                info.revert();
                window.showToast?.(`Erreur : ${err.message}`, "error");
            }
        }
    });

    calendar.render();
    window.currentCalendar = calendar;

    // Real-time synchronization interval: auto-refetch every 10 seconds
    if (window._calSyncInterval) clearInterval(window._calSyncInterval);
    window._calSyncInterval = setInterval(() => {
        if (window.currentCalendar && window.isGoogleCalendarConnected) {
            window.currentCalendar.refetchEvents();
        }
    }, 10000);

    // Auto-refetch immediately when user returns to this tab (focus or visibilitychange)
    if (!window._calFocusListenerAdded) {
        const triggerLiveSync = () => {
            if (window.currentCalendar && window.isGoogleCalendarConnected) {
                window.currentCalendar.refetchEvents();
            }
        };
        window.addEventListener('focus', triggerLiveSync);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) triggerLiveSync();
        });
        window._calFocusListenerAdded = true;
    }

    setTimeout(() => { calendar.updateSize(); }, 200);
}

// --- GLOBAL HELPERS FOR CALENDAR MODAL ---
window.closeCalModal = () => {
    const host = document.getElementById('cal-modal-host');
    if (host) host.remove();
};

window.saveCalEvent = async (start, end, allDay) => {
    const title = document.getElementById('cal-event-title')?.value.trim();
    const clientId = document.getElementById('cal-event-client')?.value || "";
    const service = document.getElementById('cal-event-service')?.value.trim() || "";
    const phone = document.getElementById('cal-event-phone')?.value.trim() || "";
    const meetLink = document.getElementById('cal-event-meet')?.value.trim() || "https://meet.google.com/qsr-auto-meet";
    const remindersEnabled = document.getElementById('cal-event-reminders')?.checked || false;

    if (!title) {
        window.showToast?.("Veuillez saisir un titre.", "warning");
        return;
    }

    let finalTitle = title;
    let prospectName = title;
    if (clientId && window.allClients) {
        const cl = window.allClients.find(c => c.id === clientId);
        if (cl) {
            prospectName = cl.name || cl.displayName || 'Client';
            finalTitle = `${title} (${prospectName})`;
        }
    }

    const eventPayload = {
        title: finalTitle,
        start: start,
        end: end || new Date(new Date(start).getTime() + 45 * 60 * 1000).toISOString(),
        service: service,
        phone: phone,
        meetLink: meetLink
    };

    try {
        window.showToast?.("Envoi du rendez-vous à Google Calendar...", "info");

        // 1. If reminders enabled, schedule through backend reminder engine
        if (remindersEnabled && phone) {
            const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
            await fetch(`${API_BASE}/api/appointments/schedule`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    leadId: clientId || null,
                    prospectName: prospectName,
                    prospectPhone: phone,
                    appointmentTime: start,
                    meetLink: meetLink,
                    notes: service
                })
            });
            window.showToast?.("✓ RDV créé dans Google Calendar ! Rappels SMS et alerte mobile activés.", "success");
        } else {
            // Direct insert into Google Calendar
            const resp = await fetch(`${API_BASE}/api/integrations/google/sync-event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: eventPayload })
            });
            const data = await resp.json();
            if (data.success) {
                window.showToast?.("✓ Événement enregistré dans Google Calendar avec succès !", "success");
            } else {
                throw new Error(data.error || "Échec d'enregistrement Google");
            }
        }

        // Live real-time refetch from Google Calendar
        if (window.currentCalendar) {
            window.currentCalendar.refetchEvents();
        }
    } catch (err) {
        console.error("Error creating Google Calendar event:", err);
        window.showToast?.(`Erreur Google Calendar : ${err.message}`, "error");
    }

    closeCalModal();
};

window.confirmDeleteGoogleCalEvent = async (eventId) => {
    if (!eventId) return;

    try {
        window.showToast?.("Suppression dans Google Calendar...", "info");
        const resp = await fetch(`${API_BASE}/api/integrations/google/events/${encodeURIComponent(eventId)}`, {
            method: 'DELETE'
        });
        const data = await resp.json();
        if (data.success) {
            window.showToast?.("✓ Événement supprimé de Google Calendar avec succès.", "success");
            if (window.currentCalendar) {
                window.currentCalendar.refetchEvents();
            }
        } else {
            throw new Error(data.error || "Erreur de suppression");
        }
    } catch (e) {
        console.error("Error deleting event:", e);
        window.showToast?.(`Erreur de suppression : ${e.message}`, "error");
    }
    closeCalModal();
};

window.openEditEventModal = (eventId) => {
    if (!window.currentCalendar || !eventId) return;
    const event = window.currentCalendar.getEventById(eventId) || 
                  window.currentCalendar.getEvents().find(e => e.id === eventId || e.extendedProps?.googleEventId === eventId);
    if (!event) {
        window.showToast?.("Impossible de charger les données de cet événement.", "warning");
        return;
    }

    const extended = event.extendedProps || {};
    const pad = n => String(n).padStart(2, '0');
    const toDatetimeLocal = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    };

    const startVal = toDatetimeLocal(event.start);
    const endVal = toDatetimeLocal(event.end || new Date(event.start.getTime() + 45 * 60 * 1000));

    const editHtml = `
    <div class="crm-modal-overlay" id="cal-modal-overlay" onclick="closeCalModal()">
        <div class="crm-modal-content" onclick="event.stopPropagation()" style="max-width:540px;">
            <div class="crm-modal-header">
                <div class="text-h">✏️ Modifier le Rendez-vous</div>
                <button class="icon-btn" onclick="closeCalModal()"><span class="material-icons">close</span></button>
            </div>
            <div class="crm-modal-body">
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label" style="font-weight:600; color:#F8FAFC;">Titre de l'événement</label>
                    <input type="text" id="cal-edit-title" class="form-input" value="${(event.title || '').replace(/"/g, '&quot;')}" autofocus>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
                    <div class="form-group">
                        <label class="form-label" style="font-weight:600; color:#F8FAFC;">Début</label>
                        <input type="datetime-local" id="cal-edit-start" class="form-input" value="${startVal}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" style="font-weight:600; color:#F8FAFC;">Fin</label>
                        <input type="datetime-local" id="cal-edit-end" class="form-input" value="${endVal}">
                    </div>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label" style="font-weight:600; color:#F8FAFC;">Numéro Mobile du Prospect (pour Rappels SMS)</label>
                    <input type="tel" id="cal-edit-phone" class="form-input" value="${(extended.prospectPhone || '').replace(/"/g, '&quot;')}" placeholder="+15061234567">
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label" style="font-weight:600; color:#F8FAFC;">Description / Notes</label>
                    <textarea id="cal-edit-desc" class="form-input" rows="3" placeholder="Notes, service ou sujet...">${(extended.description || '').replace(/</g, '&lt;')}</textarea>
                </div>
                ${extended.meetLink ? `
                <div style="margin-bottom:12px; background:rgba(59,130,246,0.08); padding:8px 12px; border-radius:6px; border:1px solid rgba(59,130,246,0.2); font-size:0.8rem; color:#93C5FD;">
                    📹 <strong>Google Meet :</strong> ${extended.meetLink}
                </div>` : ''}
            </div>
            <div class="crm-modal-footer">
                <button class="btn btn-secondary" onclick="closeCalModal()">Annuler</button>
                <button class="btn btn-primary" onclick="updateGoogleCalEvent('${eventId}')">Enregistrer dans Google Calendar</button>
            </div>
        </div>
    </div>`;

    const existing = document.getElementById('cal-modal-host');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'cal-modal-host';
    host.innerHTML = editHtml;
    document.body.appendChild(host);
};

window.updateGoogleCalEvent = async (eventId) => {
    if (!eventId) return;
    const title = document.getElementById('cal-edit-title')?.value.trim();
    const start = document.getElementById('cal-edit-start')?.value;
    const end = document.getElementById('cal-edit-end')?.value;
    const phone = document.getElementById('cal-edit-phone')?.value.trim();
    const description = document.getElementById('cal-edit-desc')?.value.trim();

    if (!title) {
        window.showToast?.("Veuillez saisir un titre.", "warning");
        return;
    }
    if (!start) {
        window.showToast?.("Veuillez choisir une heure de début.", "warning");
        return;
    }

    try {
        window.showToast?.("Mise à jour dans Google Calendar en cours...", "info");
        const resp = await fetch(`${API_BASE}/api/integrations/google/events/${encodeURIComponent(eventId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                start: new Date(start).toISOString(),
                end: end ? new Date(end).toISOString() : null,
                phone: phone || undefined,
                description
            })
        });
        const data = await resp.json();
        if (data.success) {
            window.showToast?.("✓ Rendez-vous synchronisé avec succès dans Google Agenda !", "success");
            if (window.currentCalendar) {
                window.currentCalendar.refetchEvents();
            }
        } else {
            throw new Error(data.error || "Erreur lors de la mise à jour");
        }
    } catch (err) {
        console.error("Error updating Google Calendar event:", err);
        window.showToast?.(`Erreur de mise à jour : ${err.message}`, "error");
    }

    closeCalModal();
};

window.refreshAllCalendarEvents = async () => {
    if (!window.currentCalendar) return;
    const btn = document.getElementById('cal-btn-sync');
    if (btn) btn.textContent = '⏳ Synchro...';

    try {
        await window.currentCalendar.refetchEvents();
        window.showToast?.("Calendrier synchronisé en temps réel avec Google Agenda !", "success");
    } catch (e) {
        console.error("Error refreshing calendar events:", e);
    } finally {
        if (btn) btn.textContent = '🔄 Synchroniser';
    }
};

window.connectGoogleCalendar = async () => {
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const returnUrl = encodeURIComponent(window.location.href);
        const resp = await fetch(`${API_BASE}/api/integrations/google/auth-url?projectId=master_admin&returnTo=${returnUrl}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error(data.error || "Impossible de générer le lien de connexion Google.");
        }
    } catch (e) {
        window.showToast?.(`Erreur Google Auth : ${e.message}`, "error");
    }
};

window.disconnectGoogleCalendar = async () => {
    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/integrations/google/disconnect`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.success) {
            window.showToast?.("Google Calendar déconnecté avec succès.", "info");
            initCalendar();
        }
    } catch (e) {
        window.showToast?.(`Erreur déconnexion : ${e.message}`, "error");
    }
};

window.openBookingSettingsModal = async () => {
    let settings = {
        startHour: 11,
        endHour: 18,
        daysOfWeek: [1, 2, 3, 4, 5],
        slotDurationMinutes: 45,
        minNoticeHours: 2,
        timeZone: 'America/Moncton'
    };

    try {
        const resp = await fetch(`${API_BASE}/api/calendar/settings`);
        const data = await resp.json();
        if (data.success && data.settings) {
            settings = { ...settings, ...data.settings };
        }
    } catch (_) {}

    const daysList = [
        { id: 1, label: 'Lundi' },
        { id: 2, label: 'Mardi' },
        { id: 3, label: 'Mercredi' },
        { id: 4, label: 'Jeudi' },
        { id: 5, label: 'Vendredi' },
        { id: 6, label: 'Samedi' },
        { id: 0, label: 'Dimanche' }
    ];

    const daysHtml = daysList.map(d => `
        <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; background:rgba(255,255,255,0.04); padding:6px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.08); font-size:0.8rem; color:#CBD5E1;">
            <input type="checkbox" class="cal-setting-day" value="${d.id}" ${settings.daysOfWeek.includes(d.id) ? 'checked' : ''} style="accent-color:var(--gold); width:15px; height:15px;">
            <span>${d.label}</span>
        </label>
    `).join('');

    const modalHtml = `
    <div class="crm-modal-overlay" id="cal-modal-overlay" onclick="closeCalModal()">
        <div class="crm-modal-content" onclick="event.stopPropagation()" style="max-width:540px;">
            <div class="crm-modal-header">
                <div class="text-h">⚙️ Configuration des Horaires Réservables</div>
                <button class="icon-btn" onclick="closeCalModal()"><span class="material-icons">close</span></button>
            </div>
            <div class="crm-modal-body">
                <div class="text-xs text-muted" style="margin-bottom:16px; color:#94A3B8; line-height:1.4;">
                    Définissez les créneaux où l'IA SMS a l'autorisation de planifier des rendez-vous. L'IA consultera votre Google Calendar et ne proposera que des créneaux libres à l'intérieur de ces horaires.
                </div>

                <div class="form-group" style="margin-bottom:14px;">
                    <label class="form-label" style="font-weight:600; color:#F8FAFC;">Jours ouvrables réservables</label>
                    <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:6px;">
                        ${daysHtml}
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                    <div class="form-group">
                        <label class="form-label" style="font-weight:600; color:#F8FAFC;">Heure de début</label>
                        <select id="cal-setting-start" class="form-input">
                            ${[7, 8, 9, 10, 11, 12, 13, 14].map(h => `<option value="${h}" ${settings.startHour === h ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" style="font-weight:600; color:#F8FAFC;">Heure de fin</label>
                        <select id="cal-setting-end" class="form-input">
                            ${[14, 15, 16, 17, 18, 19, 20, 21].map(h => `<option value="${h}" ${settings.endHour === h ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                    <div class="form-group">
                        <label class="form-label" style="font-weight:600; color:#F8FAFC;">Durée des rendez-vous</label>
                        <select id="cal-setting-duration" class="form-input">
                            <option value="15" ${settings.slotDurationMinutes === 15 ? 'selected' : ''}>15 minutes</option>
                            <option value="30" ${settings.slotDurationMinutes === 30 ? 'selected' : ''}>30 minutes</option>
                            <option value="45" ${settings.slotDurationMinutes === 45 ? 'selected' : ''}>45 minutes (Recommandé)</option>
                            <option value="60" ${settings.slotDurationMinutes === 60 ? 'selected' : ''}>60 minutes</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" style="font-weight:600; color:#F8FAFC;">Délai minimum de préavis</label>
                        <select id="cal-setting-notice" class="form-input">
                            <option value="1" ${settings.minNoticeHours === 1 ? 'selected' : ''}>1 heure à l'avance</option>
                            <option value="2" ${settings.minNoticeHours === 2 ? 'selected' : ''}>2 heures à l'avance</option>
                            <option value="4" ${settings.minNoticeHours === 4 ? 'selected' : ''}>4 heures à l'avance</option>
                            <option value="24" ${settings.minNoticeHours === 24 ? 'selected' : ''}>24 heures à l'avance</option>
                        </select>
                    </div>
                </div>

                <div class="form-group" style="margin-bottom:10px;">
                    <label class="form-label" style="font-weight:600; color:#F8FAFC;">Fuseau horaire</label>
                    <select id="cal-setting-tz" class="form-input">
                        <option value="America/Moncton" ${settings.timeZone === 'America/Moncton' || !settings.timeZone ? 'selected' : ''}>Heure de l'Atlantique (Moncton, N.-B. - AST/ADT)</option>
                        <option value="America/Halifax" ${settings.timeZone === 'America/Halifax' ? 'selected' : ''}>Heure de l'Atlantique (Halifax, N.-É. - AST/ADT)</option>
                        <option value="America/Montreal" ${settings.timeZone === 'America/Montreal' ? 'selected' : ''}>Heure de l'Est (Québec / Montréal - EST/EDT)</option>
                        <option value="America/Toronto" ${settings.timeZone === 'America/Toronto' ? 'selected' : ''}>Heure de l'Est (Toronto / Ontario)</option>
                        <option value="America/Vancouver" ${settings.timeZone === 'America/Vancouver' ? 'selected' : ''}>Heure du Pacifique (Vancouver - PST/PDT)</option>
                    </select>
                    <div class="text-xs text-muted" style="margin-top:3px; font-size:0.7rem; color:#64748B;">Votre fuseau horaire de référence pour les rendez-vous et l'agent IA.</div>
                </div>
            </div>
            <div class="crm-modal-footer">
                <button class="btn btn-secondary" onclick="closeCalModal()">Annuler</button>
                <button class="btn btn-primary" onclick="saveBookingSettingsFromModal()">Enregistrer mes horaires</button>
            </div>
        </div>
    </div>`;

    const existing = document.getElementById('cal-modal-host');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'cal-modal-host';
    host.innerHTML = modalHtml;
    document.body.appendChild(host);
};

window.saveBookingSettingsFromModal = async () => {
    const dayCheckboxes = document.querySelectorAll('.cal-setting-day:checked');
    const daysOfWeek = Array.from(dayCheckboxes).map(cb => parseInt(cb.value, 10));
    const startHour = parseInt(document.getElementById('cal-setting-start')?.value || 11, 10);
    const endHour = parseInt(document.getElementById('cal-setting-end')?.value || 18, 10);
    const slotDurationMinutes = parseInt(document.getElementById('cal-setting-duration')?.value || 45, 10);
    const minNoticeHours = parseInt(document.getElementById('cal-setting-notice')?.value || 2, 10);
    const timeZone = document.getElementById('cal-setting-tz')?.value || 'America/Moncton';

    if (daysOfWeek.length === 0) {
        window.showToast?.("Veuillez sélectionner au moins un jour ouvrable.", "warning");
        return;
    }
    if (startHour >= endHour) {
        window.showToast?.("L'heure de début doit être inférieure à l'heure de fin.", "warning");
        return;
    }

    try {
        const resp = await fetch(`${API_BASE}/api/calendar/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                daysOfWeek,
                startHour,
                endHour,
                slotDurationMinutes,
                minNoticeHours,
                timeZone
            })
        });
        const data = await resp.json();
        if (data.success) {
            window.showToast?.("✓ Horaires réservables enregistrés avec succès !", "success");
            closeCalModal();
        } else {
            throw new Error(data.error || "Erreur de sauvegarde");
        }
    } catch (e) {
        window.showToast?.(`Erreur : ${e.message}`, "error");
    }
};

