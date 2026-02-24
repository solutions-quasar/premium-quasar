console.log("Loading Vapi Tools & Handlers...");
const { getApp } = require('./firebase-manager');
const googleAuth = require('./google-auth');
const voiceAuth = require('./voice-auth');

// --- TOOL DEFINITIONS (Schemas) ---
const tools = [
    {
        type: "function",
        function: {
            name: "verify_voice_pin",
            description: "Verify the caller's identity using a secret voice PIN. Use this before performing sensitive operations.",
            parameters: {
                type: "object",
                properties: {
                    pin: { type: "string", description: "The 4 or 6 digit PIN provided by the user." }
                },
                required: ["pin"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "create_memory",
            description: "Store an important fact, preference, or rule for future reference. Use this for things you want all agents to 'remember' about this client or project.",
            parameters: {
                type: "object",
                properties: {
                    text: { type: "string", description: "The important fact or rule to remember." },
                    tags: { type: "array", items: { type: "string" }, description: "Tags for searching (e.g. ['preference', 'deadline', 'technical'])." }
                },
                required: ["text"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "search_memories",
            description: "Search the agent's long-term memory for specific facts, preferences, or project rules.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Keywords to search for in memories." }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "delete_memory",
            description: "Remove a fact from the agent's memory if it is no longer true or relevant.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "string", description: "The unique ID of the memory to delete." }
                },
                required: ["id"]
            }
        }
    }
];

// --- LOGGING UTILITY ---
async function logToolExecution(toolName, args, result, projectId, requestId) {
    try {
        const app = await getApp(projectId);
        const { admin } = require('./firebase-admin');

        await app.firestore().collection('logs').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'TOOL_EXECUTION',
            source: 'Server',
            action: toolName,
            requestId: requestId || 'unknown',
            projectId: projectId,
            data: args,
            result: result.success ? 'Success' : 'Error',
            message: result.message || result.error || null
        });
    } catch (err) {
        console.error("[Tool Logger Error]", err.message);
    }
}

// --- TOOL HANDLERS (Execution) ---
const handlers = {
    /**
     * verify_voice_pin
     * Checks if the provided PIN matches the one stored in the user's profile.
     */
    verify_voice_pin: async (args, projectId, requestId) => {
        let result;
        try {
            const { pin, phoneNumber } = args;
            if (!pin) result = { success: false, error: "PIN is required." };
            else if (!phoneNumber) result = { success: false, error: "System Error: Caller ID not detected. Cannot verify PIN." };
            else {
                const app = await getApp(projectId);
                const db = app.firestore();
                const userQuery = await db.collection('team').where('voicePhone', '==', phoneNumber).limit(1).get();

                if (userQuery.empty) {
                    result = { success: false, error: "Identité non reconnue pour ce numéro." };
                } else {
                    const userData = userQuery.docs[0].data();
                    if (userData.voicePin === pin) {
                        result = {
                            success: true,
                            message: `PIN vérifié avec succès. Bienvenue, ${userData.name || 'Utilisateur'}.`,
                            authorized: true
                        };
                    } else {
                        result = { success: false, error: "PIN incorrect. Veuillez réessayer." };
                    }
                }
            }
        } catch (e) {
            console.error("PIN Verification Error:", e);
            result = { success: false, error: "Internal error during verification." };
        }
        await logToolExecution('verify_voice_pin', args, result, projectId, requestId);
        return result;
    },

    /**
     * create_memory
     * Stores a distilled fact in the 'memories' collection.
     */
    create_memory: async (args, projectId, requestId) => {
        let result;
        try {
            const { text, tags = [] } = args;
            if (!text) result = { success: false, error: "Memory text is required." };
            else {
                const app = await getApp(projectId);
                const db = app.firestore();
                const memoryDoc = {
                    text,
                    tags: tags.map(t => t.toLowerCase()),
                    projectId,
                    createdAt: new Date().toISOString(),
                    source: 'AI Agent'
                };
                const docRef = await db.collection('memories').add(memoryDoc);
                result = { success: true, id: docRef.id, message: "Fact remembered successfully." };
            }
        } catch (e) {
            console.error("Memory Creation Error:", e);
            result = { success: false, error: e.message };
        }
        await logToolExecution('create_memory', args, result, projectId, requestId);
        return result;
    },

    /**
     * search_memories
     * Searches memories in both Project (Tenant) and Global pools.
     */
    search_memories: async (args, projectId, requestId) => {
        let result;
        try {
            const { query: searchQuery } = args;
            const app = await getApp(projectId);
            const db = app.firestore();
            const { db: mainDb } = require('./firebase-admin');

            let projectQ = db.collection('memories').orderBy('createdAt', 'desc');
            let globalQ = mainDb.collection('memories').orderBy('createdAt', 'desc');

            const [projectSnap, globalSnap] = await Promise.all([
                projectQ.limit(20).get(),
                globalQ.where('isGlobal', '==', true).limit(20).get()
            ]);

            const allMemories = [];
            projectSnap.forEach(doc => allMemories.push({ id: doc.id, ...doc.data(), _scope: 'project' }));
            globalSnap.forEach(doc => allMemories.push({ id: doc.id, ...doc.data(), _scope: 'global' }));

            let filtered = allMemories;
            if (searchQuery) {
                const words = searchQuery.toLowerCase().split(' ');
                filtered = allMemories.filter(m => {
                    const content = (m.text + ' ' + (m.tags || []).join(' ')).toLowerCase();
                    return words.some(w => content.includes(w));
                });
            }
            result = { success: true, count: filtered.length, memories: filtered.slice(0, 10) };
        } catch (e) {
            console.error("Memory Search Error:", e);
            result = { success: false, error: e.message };
        }
        await logToolExecution('search_memories', args, result, projectId, requestId);
        return result;
    },

    delete_memory: async (args, projectId, requestId) => {
        let result;
        try {
            const { id } = args;
            if (!id) result = { success: false, error: "Memory ID is required." };
            else {
                const app = await getApp(projectId);
                const db = app.firestore();
                await db.collection('memories').doc(id).delete();
                result = { success: true, message: "Memory deleted successfully." };
            }
        } catch (e) {
            console.error("Memory Deletion Error:", e);
            result = { success: false, error: e.message };
        }
        await logToolExecution('delete_memory', args, result, projectId, requestId);
        return result;
    }
};

/**
 * Dynamic Tool Handler (The "Virtual MCP")
 */
async function dynamicHandler(toolName, args, projectId, context = {}) {
    const requestId = context.requestId || 'unknown';
    let result;
    try {
        const app = await getApp(projectId);
        const db = app.firestore();

        console.log(`[DynamicHandler] Executing: ${toolName}`, { args, projectId, requestId });

        // 1. CREATE Action
        if (toolName.startsWith('create_')) {
            const collectionName = toolName.replace('create_', '');
            const data = { ...args, createdAt: new Date().toISOString(), source: 'AI Agent (Dynamic)' };
            const docRef = await db.collection(collectionName).add(data);
            result = { success: true, id: docRef.id, message: `Created record in ${collectionName}` };
        }
        // 2. SEARCH Action
        else if (toolName.startsWith('search_')) {
            const collectionName = toolName.replace('search_', '');
            let q = db.collection(collectionName);
            for (const [key, value] of Object.entries(args)) {
                if (key === 'query') continue;
                if (value !== undefined && value !== null) q = q.where(key, '==', value);
            }
            if (args.query) q = q.orderBy('createdAt', 'desc').limit(10);
            else q = q.limit(10);
            const snapshot = await q.get();
            const results = [];
            snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
            result = { success: true, count: results.length, results };
        }
        // 3. UPDATE Action
        else if (toolName.startsWith('update_')) {
            const collectionName = toolName.replace('update_', '');
            const { id, ...data } = args;
            if (!id) result = { success: false, error: "Document ID is required for updates." };
            else {
                const docRef = db.collection(collectionName).doc(id);
                const docSnap = await docRef.get();
                if (!docSnap.exists) result = { success: false, error: `Document with ID ${id} not found.` };
                else {
                    await docRef.update({ ...data, updatedAt: new Date().toISOString() });
                    result = { success: true, message: `Updated record ${id} in ${collectionName}` };
                }
            }
        }
        // 4. LIST Action
        else if (toolName.startsWith('list_')) {
            const collectionName = toolName.replace('list_', '');
            const limit = args.limit || 20;
            if (collectionName === 'email_templates' || collectionName === 'email-templates') {
                const { db: mainDb } = require('./firebase-admin');
                const [tenantSnap, mainSnap] = await Promise.all([
                    db.collection('email_templates').limit(limit).get(),
                    mainDb.collection('email_templates').limit(limit).get()
                ]);
                const resultMap = new Map();
                mainSnap.forEach(doc => resultMap.set(doc.id, { id: doc.id, ...doc.data(), _source: 'global' }));
                tenantSnap.forEach(doc => resultMap.set(doc.id, { id: doc.id, ...doc.data(), _source: 'project' }));
                result = { success: true, count: resultMap.size, results: Array.from(resultMap.values()) };
            } else {
                const snapshot = await db.collection(collectionName).limit(limit).get();
                const results = [];
                snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
                result = { success: true, count: results.length, results };
            }
        }
        // 5. GET Action
        else if (toolName.startsWith('get_')) {
            const collectionName = toolName.replace('get_', '');
            const { id } = args;
            if (!id) result = { success: false, error: "ID is required." };
            else {
                const docSnap = await db.collection(collectionName).doc(id).get();
                if (!docSnap.exists) result = { success: false, error: `Record ${id} not found.` };
                else result = { success: true, data: { id: docSnap.id, ...docSnap.data() } };
            }
        }
        // 6. SEND EMAIL Action
        else if (toolName.startsWith('send_') && toolName.endsWith('_email')) {
            const templateName = toolName.replace('send_', '').replace('_email', '');
            const { to, subject: customSubject, ...placeholders } = args;
            if (!to) result = { success: false, error: "Recipient 'to' is required." };
            else {
                const { db: systemDb } = require('./firebase-admin');
                const projectDoc = await systemDb.collection('ai_projects').doc(projectId).get();
                const projectData = projectDoc.exists ? projectDoc.data() : {};

                let localResend = context.resend;
                if (projectData.resendApiKey) {
                    const { Resend: ResendLib } = require('resend');
                    localResend = new ResendLib(projectData.resendApiKey);
                }

                if (!localResend) result = { success: false, error: "Email service not configured." };
                else {
                    let templateSnap = await db.collection('email_templates').doc(templateName).get();
                    if (!templateSnap.exists) templateSnap = await db.collection('email_templates').doc(templateName.replace(/_/g, ' ')).get();

                    if (!templateSnap.exists) result = { success: false, error: `Template '${templateName}' not found.` };
                    else {
                        const template = templateSnap.data();
                        let body = template.content || template.body || '';
                        let subject = customSubject || template.subject || `Email from AI Agent`;
                        for (const [key, value] of Object.entries(placeholders)) {
                            const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
                            body = body.replace(regex, value);
                            subject = subject.replace(regex, value);
                        }
                        const fromName = projectData.resendFromName || 'AI Assistant';
                        const fromEmail = projectData.resendFromEmail;
                        if (!fromEmail) result = { success: false, error: "From email not configured in project settings." };
                        else {
                            const emailRes = await localResend.emails.send({ from: `${fromName} <${fromEmail}>`, to: [to], subject, html: body });
                            if (emailRes.error) result = { success: false, error: emailRes.error.message };
                            else result = { success: true, message: `Email sent to ${to}`, id: emailRes.data.id };
                        }
                    }
                }
            }
        }

        if (!result) result = { success: false, error: `Tool ${toolName} not implemented.` };

        await logToolExecution(toolName, args, result, projectId, requestId);
        return result;

    } catch (e) {
        console.error(`[DynamicHandler Error]`, e);
        const errorResult = { success: false, error: e.message };
        await logToolExecution(toolName, args, errorResult, projectId, requestId);
        return errorResult;
    }
}

module.exports = { tools, handlers, dynamicHandler };
