const { Timestamp } = require('firebase-admin/firestore');

/**
 * Scans Firestore collections and infers schema to build Vapi Tools.
 * @param {FirebaseFirestore.Firestore} db 
 */
async function discoverSchema(db) {
    console.log("Starting Schema Discovery...");
    const tools = [];
    const collections = await db.listCollections();

    for (const col of collections) {
        const name = col.id;
        // Skip system or internal collections if any
        if (name.startsWith('ai_') || name === 'users') continue;

        console.log(`Scanning collection: ${name}`);

        // Sample documents to infer fields
        const snapshot = await col.limit(3).get();
        if (snapshot.empty) {
            console.log(`  - No docs found, skipping.`);
            continue;
        }

        const schema = {};
        const required = [];

        // Simple inference strategy: correct types from the first non-null value found
        snapshot.forEach(doc => {
            const data = doc.data();
            for (const [key, value] of Object.entries(data)) {
                if (schema[key]) return; // Already found

                if (typeof value === 'string') {
                    schema[key] = { type: "string" };
                } else if (typeof value === 'number') {
                    schema[key] = { type: "number" };
                } else if (typeof value === 'boolean') {
                    schema[key] = { type: "boolean" };
                } else if (value instanceof Timestamp || key.includes('At') || key.includes('date')) {
                    schema[key] = { type: "string", description: "ISO Date string (YYYY-MM-DD)" };
                }
            }
        });

        // 1. Tool: Create Item
        tools.push({
            type: "function",
            function: {
                name: `create_${name}`, // e.g., create_leads
                description: `Create a new record in the ${name} collection.`,
                parameters: {
                    type: "object",
                    properties: schema,
                    required: Object.keys(schema).filter(k => !k.includes('At')) // heuristic: timestamp usually auto-generated
                }
            }
        });

        // 2. Tool: List/Search Items (Basic)
        // Only if there are searchable fields
        if (Object.keys(schema).length > 0) {
            tools.push({
                type: "function",
                function: {
                    name: `search_${name}`,
                    description: `Search for records in ${name}.`,
                    parameters: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "Search term" },
                            ...schema // Allow filtering by specific fields
                        }
                    }
                }
            });
        }
    }

    console.log(`Discovery complete. Found ${tools.length} potential tools.`);
    return tools;
}

module.exports = { discoverSchema };
