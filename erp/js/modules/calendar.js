export async function initCalendar() {
    const container = document.getElementById('view-calendar');

    // Generate dates
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    let gridHtml = '';

    // Header
    days.forEach(d => gridHtml += `<div class="text-center text-muted text-sm">${d}</div>`);

    // Days (Mock 30 days)
    for (let i = 1; i <= 30; i++) {
        const isToday = i === new Date().getDate();
        const hasEvent = [5, 12, 15, 22].includes(i);
        gridHtml += `<div class="cal-day ${isToday ? 'today' : ''} ${hasEvent ? 'has-event' : ''}">
            ${i}
        </div>`;
    }

    container.innerHTML = `
        <div class="card">
            <div class="text-h text-center" style="margin-bottom: 1rem;">January 2026</div>
            <div class="calendar-grid">
                ${gridHtml}
            </div>
        </div>
        
        <div class="text-h" style="margin-top: 2rem;">Upcoming</div>
        <div class="list-item">
            <div class="item-avatar" style="background:var(--info); color:white;">15</div>
             <div class="item-content">
                <div class="item-title">Sales Meeting</div>
                <div class="item-subtitle">10:00 AM - Microsoft Teams</div>
            </div>
        </div>
    `;
}
