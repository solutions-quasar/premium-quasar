const { getApp } = require('./firebase-manager');

// --- TOOL DEFINITIONS (Schemas) ---
// These are sent to Vapi so the AI knows what it can do.
const tools = []; // All tools are now dynamically discovered

// --- TOOL HANDLERS (Execution) ---
// These run on the server when Vapi calls the webhook.
const handlers = {
    // Legacy mapping support if needed, otherwise empty.
    // Dynamic tools (create_*, search_*) are handled by dynamicHandler.
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
