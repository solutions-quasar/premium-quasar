import { db } from '../erp/js/firebase-config.js';
import { doc, getDoc, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let calendar = null;

async function initMockupERP() {
    const urlParams = new URLSearchParams(window.location.search);
    const demoId = urlParams.get('id');

    if (!demoId) {
        document.body.innerHTML = '<div style="display:flex; height:100vh; align-items:center; justify-content:center;"><h2>Demo Link Missing</h2></div>';
        return;
    }

    try {
        const docRef = doc(db, 'demos', demoId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            document.body.innerHTML = '<div style="display:flex; height:100vh; align-items:center; justify-content:center;"><h2>Demo Not Found</h2></div>';
            return;
        }

        const data = docSnap.data();
        applyDemonstrationBranding(data, demoId);
        const appointments = await loadMockupAppointments(demoId);
        setupNavigation(appointments);

        // Hide Loader
        const loader = document.getElementById('demo-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }

    } catch (error) {
        console.error("Error fetching ERP data:", error);
        alert("Failed to load ERP mockup.");
    }
}

function applyDemonstrationBranding(data, demoId) {
    // Apply Title
    document.title = `${data.clinicName} | AI ERP`;

    // Apply Colors
    const root = document.documentElement;
    if (data.primaryColor) root.style.setProperty('--color-primary', data.primaryColor);
    if (data.secondaryColor) root.style.setProperty('--color-secondary', data.secondaryColor);

    // Apply Logo & Name
    document.querySelectorAll('.demo-erp-name').forEach(el => el.textContent = data.clinicName);
    if (data.logoUrl) {
        document.querySelectorAll('.demo-erp-logo').forEach(img => {
            img.src = data.logoUrl;
            img.style.display = 'block';
        });
        document.querySelectorAll('.demo-erp-name').forEach(el => el.style.display = 'none'); // Hide text if logo exists
    }

    // Update 'Back to Site' Link
    const backBtn = document.getElementById('back-to-site');
    if (backBtn) {
        backBtn.href = `/demo?id=${demoId}`;
    }
}

async function loadMockupAppointments(demoId) {
    const tbody = document.getElementById('leads-tbody');
    const kpiCount = document.getElementById('kpi-appointments');

    try {
        const q = query(collection(db, 'demos', demoId, 'mockup_appointments'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        const appointments = [];
        querySnapshot.forEach((doc) => {
            appointments.push({ id: doc.id, ...doc.data() });
        });

        // Update KPI
        if (kpiCount) kpiCount.textContent = appointments.length;

        // Render Table
        if (appointments.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">
                        <span class="material-icons" style="font-size: 48px; opacity: 0.5;">inbox</span>
                        <div style="margin-top: 10px;">No leads generated yet.</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = appointments.map(app => {
            // Format Date safely
            let dateStr = 'Just now';
            if (app.createdAt) {
                const d = app.createdAt.toDate ? app.createdAt.toDate() : new Date(app.createdAt);
                if (!isNaN(d)) {
                    dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                }
            }

            return `
                <tr>
                    <td>
                        <div style="font-weight: 600; color: var(--text-main);">${app.firstName} ${app.lastName}</div>
                        <div style="font-size: 0.8rem; margin-top: 4px; color: var(--text-muted);">${app.message || 'No specific notes'}</div>
                    </td>
                    <td>
                        <div>${app.email}</div>
                        <div style="font-size: 0.8rem; margin-top: 4px;">${app.phone}</div>
                    </td>
                    <td><span style="font-weight: 500; color: var(--color-primary);">${app.service}</span></td>
                    <td>${dateStr}</td>
                    <td><span class="badge" style="background: rgba(223, 165, 58, 0.1); color: #dfa53a; border-color: rgba(223, 165, 58, 0.2);">Pending</span></td>
                </tr>
            `;
        }).join('');

        return appointments;

    } catch (e) {
        console.error("Error loading appointments:", e);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #e74c3c;">Failed to load leads data.</td></tr>`;
        return [];
    }
}

function setupNavigation(appointments) {
    const navCrm = document.getElementById('nav-crm');
    const navCalendar = document.getElementById('nav-calendar');
    const viewCrm = document.getElementById('view-crm');
    const viewCalendar = document.getElementById('view-calendar');
    const headerTitle = document.querySelector('.topbar h2');

    if (navCrm) {
        navCrm.addEventListener('click', (e) => {
            e.preventDefault();
            navCrm.classList.add('active');
            navCalendar.classList.remove('active');
            viewCrm.style.display = 'block';
            viewCalendar.style.display = 'none';
            headerTitle.textContent = 'Lead Management';
        });
    }

    if (navCalendar) {
        navCalendar.addEventListener('click', (e) => {
            e.preventDefault();
            navCalendar.classList.add('active');
            navCrm.classList.remove('active');
            viewCrm.style.display = 'none';
            viewCalendar.style.display = 'flex';
            headerTitle.textContent = 'Schedule & Appointments';

            if (!calendar) {
                initCalendar(appointments);
            } else {
                // Must call render to correct layout when un-hiding the container
                calendar.render();
            }
        });
    }
}

function initCalendar(appointments) {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    // Convert leads directly into Calendar Demo Events
    const events = appointments.map((app, index) => {
        const baseDate = new Date();
        // Spread the events around the current dates
        baseDate.setDate(baseDate.getDate() + (index % 5));
        baseDate.setHours(9 + (index % 6), 0, 0, 0);

        const endDate = new Date(baseDate);
        endDate.setHours(baseDate.getHours() + 1);

        return {
            id: app.id,
            title: `${app.firstName} ${app.lastName} - ${app.service}`,
            start: baseDate.toISOString(),
            end: endDate.toISOString()
        };
    });

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        editable: true,
        droppable: true,
        selectable: true,
        slotMinTime: '08:00:00',
        slotMaxTime: '20:00:00',
        allDaySlot: false,
        events: events,
        eventClick: function (info) {
            alert(`Premium Appt Request:\\n\\nPatient: ${info.event.title}\\nTime: ${info.event.start.toLocaleTimeString()}`);
        }
    });

    calendar.render();
}

// Start sequence
document.addEventListener('DOMContentLoaded', initMockupERP);
