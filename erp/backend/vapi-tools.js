const { getApp } = require('./firebase-manager');
const googleAuth = require('./google-auth');

// --- TOOL DEFINITIONS (Schemas) ---
const tools = [
    {
        type: "function",
        function: {
            name: "check_availability",
            description: "Check for free time slots on the connected Google Calendar for a given date.",
            parameters: {
                type: "object",
                properties: {
                    date: { type: "string", description: "The date to check (YYYY-MM-DD)" }
                },
                required: ["date"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "book_appointment",
            description: "Book an appointment on the connected Google Calendar.",
            parameters: {
                type: "object",
                properties: {
                    summary: { type: "string", description: "Title of the meeting" },
                    startDateTime: { type: "string", description: "Start time in ISO format (e.g. 2024-01-24T14:00:00Z)" },
                    durationMinutes: { type: "number", description: "Duration in minutes" },
                    guestEmail: { type: "string", description: "Email of the guest" }
                },
                required: ["summary", "startDateTime"]
            }
        }
    }
];

// --- TOOL HANDLERS (Execution) ---
const handlers = {
    check_availability: async (args, projectId) => {
        try {
            const calendar = await googleAuth.getCalendar(projectId);
            const date = args.date;
            const timeMin = `${date}T00:00:00Z`;
            const timeMax = `${date}T23:59:59Z`;

            const response = await calendar.events.list({
                calendarId: 'primary',
                timeMin,
                timeMax,
                singleEvents: true,
                orderBy: 'startTime',
            });

            const events = response.data.items;
            if (!events || events.length === 0) {
                return { success: true, message: "The entire day is free." };
            }

            const busySlots = events.map(e => ({
                start: e.start.dateTime || e.start.date,
                end: e.end.dateTime || e.end.date,
                summary: e.summary
            }));

            return { success: true, busySlots, message: "Checked availability for " + date };
        } catch (e) {
            return { success: false, error: "Calendar Error: " + e.message };
        }
    },

    book_appointment: async (args, projectId) => {
        try {
            const calendar = await googleAuth.getCalendar(projectId);
            const { summary, startDateTime, durationMinutes, guestEmail } = args;

            const start = new Date(startDateTime);
            const end = new Date(start.getTime() + (durationMinutes || 30) * 60000);

            const event = {
                summary,
                start: { dateTime: start.toISOString() },
                end: { dateTime: end.toISOString() },
                attendees: guestEmail ? [{ email: guestEmail }] : []
            };

            const response = await calendar.events.insert({
                calendarId: 'primary',
                resource: event,
            });

            return { success: true, eventId: response.data.id, link: response.data.htmlLink, message: "Appointment booked successfully!" };
        } catch (e) {
            return { success: false, error: "Booking Error: " + e.message };
        }
    }
};

/**
 * Dynamic Tool Handler (The "Virtual MCP")
 * Intercepts calls for tools not explicitly defined in 'handlers'.
 */
async function dynamicHandler(toolName, args, projectId) {
    try {
        const app = await getApp(projectId);
        const db = app.firestore();

        // 1. CREATE Action (e.g. create_leads, create_products)
        if (toolName.startsWith('create_')) {
            const collectionName = toolName.replace('create_', '');
            console.log(`[${projectId}] Dynamic Create: ${collectionName}`, args);

            // Add metadata
            const data = { ...args, createdAt: new Date().toISOString(), source: 'AI Agent (Dynamic)' };
            const docRef = await db.collection(collectionName).add(data);

            return { success: true, id: docRef.id, message: `Created record in ${collectionName}` };
        }

        // 2. SEARCH Action (e.g. search_products)
        if (toolName.startsWith('search_')) {
            const collectionName = toolName.replace('search_', '');
            console.log(`[${projectId}] Dynamic Search: ${collectionName}`, args);

            let q = db.collection(collectionName);

            // Apply generic filters
            if (args.query) {
                // Simple case-sensitive search simulation
                q = q.orderBy('createdAt', 'desc').limit(5);
            } else {
                q = q.limit(5);
            }

            const snapshot = await q.get();
            const results = [];
            snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));

            return { success: true, count: results.length, results };
        }

        return { success: false, error: `Tool ${toolName} not found and no dynamic handler found.` };
    } catch (e) {
        console.error("Dynamic Handler Error:", e);
        return { success: false, error: e.message };
    }
}

module.exports = { tools, handlers, dynamicHandler };
