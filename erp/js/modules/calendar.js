// --- FullCalendar Integration ---
import { db } from '../firebase-config.js';
import { collection, addDoc, getDocs, query, where, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export async function initCalendar() {
    const container = document.getElementById('view-calendar');
    container.innerHTML = `<div id="calendar-wrapper" style="height: 100%; min-height: 600px;"></div>`;

    const calendarEl = document.getElementById('calendar-wrapper');

    // Check if FullCalendar is loaded
    if (typeof FullCalendar === 'undefined') {
        container.innerHTML = `<div class="text-danger">Error: FullCalendar library not loaded. Refresh.</div>`;
        return;
    }

    // Fetch Events from Firestore
    let dbEvents = [];
    try {
        const q = query(collection(db, "events"));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            dbEvents.push({ id: doc.id, ...doc.data() });
        });
    } catch (e) {
        console.error("Error fetching events:", e);
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
        themeSystem: 'standard', // Custom styled in CSS
        events: dbEvents, // Load real events
        select: function (arg) {
            // Open Custom Modal
            const modalHtml = `
            <div class="crm-modal-overlay" id="cal-modal-overlay" onclick="closeCalModal()">
                <div class="crm-modal-content" onclick="event.stopPropagation()">
                    <div class="crm-modal-header">
                        <div class="text-h">New Event</div>
                        <button class="icon-btn" onclick="closeCalModal()"><span class="material-icons">close</span></button>
                    </div>
                    <div class="crm-modal-body">
                        <div class="form-group">
                            <label class="form-label">Event Title</label>
                            <input type="text" id="cal-event-title" class="form-input" placeholder="Meeting with Client" autofocus>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Type</label>
                            <select id="cal-event-color" class="form-input">
                                <option value="var(--info)">General</option>
                                <option value="var(--success)">Call</option>
                                <option value="var(--gold)">Meeting</option>
                                <option value="var(--danger)">Deadline</option>
                            </select>
                        </div>
                    </div>
                    <div class="crm-modal-footer">
                        <button class="btn btn-secondary" onclick="closeCalModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="saveCalEvent('${arg.startStr}', '${arg.endStr}', ${arg.allDay})">Save Event</button>
                    </div>
                </div>
            </div>`;

            // Append modal to body or container
            const existing = document.getElementById('cal-modal-host');
            if (existing) existing.remove();

            const host = document.createElement('div');
            host.id = 'cal-modal-host';
            host.innerHTML = modalHtml;
            document.body.appendChild(host);

            // Focus input
            setTimeout(() => document.getElementById('cal-event-title').focus(), 50);

            // Unselect selection
            calendar.unselect();
        },
        eventClick: function (arg) {
            alert('Event: ' + arg.event.title + '\nTime: ' + (arg.event.start ? arg.event.start.toLocaleString() : 'All Day'));
            // In a real app, this would open a nice modal like CRM
        },
        eventDrop: function (info) {
            console.log(info.event.title + " was dropped on " + info.event.start.toISOString());
            updateEventInFirestore(info.event);
        },
        eventResize: function (info) {
            console.log(info.event.title + " was resized to " + (info.event.end ? info.event.end.toISOString() : 'null'));
            updateEventInFirestore(info.event);
        }
    });

    calendar.render();

    // Store calendar instance globally if needed for the helpers
    window.currentCalendar = calendar;

    // Fix resize issues when view changes
    setTimeout(() => { calendar.updateSize(); }, 200);
}

// --- GLOBAL HELPERS FOR CALENDAR MODAL ---
window.closeCalModal = () => {
    const host = document.getElementById('cal-modal-host');
    if (host) host.remove();
};

window.saveCalEvent = async (start, end, allDay) => {
    const title = document.getElementById('cal-event-title').value;
    const color = document.getElementById('cal-event-color').value;

    if (title && window.currentCalendar) {
        const newEvent = {
            title: title,
            start: start,
            end: end,
            allDay: allDay,
            color: color,
            created_at: new Date().toISOString()
        };

        // UI Update
        window.currentCalendar.addEvent(newEvent);

        // Firestore Save
        try {
            await addDoc(collection(db, "events"), newEvent);
        } catch (e) {
            console.error("Error saving event:", e);
            alert("Error saving event to database.");
        }
    }
    closeCalModal();
};

async function updateEventInFirestore(event) {
    if (!event.id) return;
    try {
        const eventRef = doc(db, "events", event.id);
        const updateData = {
            start: event.start.toISOString(),
            allDay: event.allDay
        };
        // end can be null for allDay or single-point events
        if (event.end) {
            updateData.end = event.end.toISOString();
        }
        await updateDoc(eventRef, updateData);
        console.log("Event updated in Firestore:", event.id);
    } catch (e) {
        console.error("Error updating event in Firestore:", e);
    }
}
