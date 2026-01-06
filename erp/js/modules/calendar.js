// --- FullCalendar Integration ---
export async function initCalendar() {
    const container = document.getElementById('view-calendar');
    container.innerHTML = `<div id="calendar-wrapper" style="height: 100%; min-height: 600px;"></div>`;

    const calendarEl = document.getElementById('calendar-wrapper');

    // Check if FullCalendar is loaded
    if (typeof FullCalendar === 'undefined') {
        container.innerHTML = `<div class="text-danger">Error: FullCalendar library not loaded. Refresh.</div>`;
        return;
    }

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
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
        events: [
            { title: 'Screening: Tech Corp', start: new Date().toISOString().split('T')[0] + 'T10:00:00', end: new Date().toISOString().split('T')[0] + 'T11:00:00', color: 'var(--info)' },
            { title: 'Follow-up Call', start: new Date(Date.now() + 86400000).toISOString().split('T')[0] + 'T14:30:00', color: 'var(--success)' },
            { title: 'Quarterly Review', start: new Date(Date.now() + 172800000).toISOString().split('T')[0], color: 'var(--gold)' }
        ],
        select: function (arg) {
            // Create event prompt
            const title = prompt('Event Title:');
            if (title) {
                calendar.addEvent({
                    title: title,
                    start: arg.start,
                    end: arg.end,
                    allDay: arg.allDay,
                    color: 'var(--info)'
                })
            }
            calendar.unselect()
        },
        eventClick: function (arg) {
            alert('Event: ' + arg.event.title + '\nTime: ' + (arg.event.start ? arg.event.start.toLocaleString() : 'All Day'));
            // In a real app, this would open a nice modal like CRM
        },
        eventDrop: function (info) {
            console.log(info.event.title + " was dropped on " + info.event.start.toISOString());
            // Sync with DB
        }
    });

    calendar.render();

    // Fix resize issues when view changes
    setTimeout(() => { calendar.updateSize(); }, 200);
}
