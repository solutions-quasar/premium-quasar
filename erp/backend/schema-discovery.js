const { Timestamp } = require('firebase-admin/firestore');
const { db: mainDb } = require('./firebase-admin');

/**
 * Scans Firestore collections and infers schema to build Vapi Tools.
 * @param {FirebaseFirestore.Firestore} db 
 */
async function discoverSchema(db) {
    console.log("Starting Schema Discovery...");
    const tools = [];
    const collections = await db.listCollections();
    const processedNormalizedNames = new Set();

    for (const col of collections) {
        const name = col.id;
        // OpenAI tool names must be regex ^[a-zA-Z0-9_-]{1,64}$
        // We normalize to check for logical duplicates (e.g. email-templates vs email_templates)
        const normalizedName = name.toLowerCase().replace(/[-_]/g, '');

        // Skip system or internal collections if any
        if (name.startsWith('ai_') || name === 'users') continue;

        if (processedNormalizedNames.has(normalizedName)) {
            console.log(`Skipping logical duplicate collection: ${name} (already processed ${normalizedName})`);
            continue;
        }
        processedNormalizedNames.add(normalizedName);

        console.log(`Scanning collection: ${name}`);

        // Sample documents to infer fields
        const snapshot = await col.limit(3).get();
        if (snapshot.empty) {
            console.log(`  - No docs found, skipping.`);
            continue;
        }

        const schema = {};

        // Simple inference strategy: correct types from the first non-null value found
        snapshot.forEach(doc => {
            const data = doc.data();
            for (const [key, value] of Object.entries(data)) {
                if (schema[key] || key === 'id') continue; // Already found or reserved

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

        // 0. Heuristic: Add common CRM fields if collection name matches
        const crmCollections = ['clients', 'leads', 'prospects', 'contacts', 'customers'];
        if (crmCollections.includes(name.toLowerCase())) {
            const commonFields = {
                email: { type: "string", description: "Email address" },
                phone: { type: "string", description: "Phone number" },
                address: { type: "string", description: "Physical address / Location" },
                company: { type: "string", description: "Company name" },
                notes: { type: "string", description: "Internal notes or description" }
            };
            for (const [key, field] of Object.entries(commonFields)) {
                if (!schema[key]) schema[key] = field;
            }
        }

        // 0b. Heuristic: Add fields for email templates
        const emailCollections = ['email_templates', 'templates'];
        if (emailCollections.includes(name.toLowerCase())) {
            const emailFields = {
                subject: { type: "string", description: "The email subject line" },
                content: { type: "string", description: "The main HTML/text body of the email" },
                body: { type: "string", description: "Alternative body content (fallback for content)" },
                title: { type: "string", description: "A friendly title for identifying the template" }
            };
            for (const [key, field] of Object.entries(emailFields)) {
                if (!schema[key]) schema[key] = field;
            }
        }

        // 1. Tool: Create Item
        tools.push({
            type: "function",
            function: {
                name: `create_${name}`, // e.g., create_leads
                description: `Create a new record in the ${name} collection.`,
                parameters: {
                    type: "object",
                    properties: schema,
                    required: schema.name ? ["name"] : [] // Only require name if it was discovered
                }
            }
        });

        // 2. Tool: List/Search Items (Basic)
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

            // 3. Generate UPDATE tool
            tools.push({
                type: "function",
                function: {
                    name: `update_${name}`,
                    description: `Update an existing record in the '${name}' collection by ID.`,
                    parameters: {
                        type: "object",
                        properties: {
                            id: { type: "string", description: "ID of the record to update" },
                            ...schema
                        },
                        required: ["id"]
                    }
                }
            });

            // 4. [NEW] Generate LIST tool (View All)
            tools.push({
                type: "function",
                function: {
                    name: `list_${name}`,
                    description: `Retrieve all or the top 50 records from the '${name}' collection.`,
                    parameters: {
                        type: "object",
                        properties: {
                            limit: { type: "number", description: "Maximum number of records (default 20, max 50)", default: 20 }
                        }
                    }
                }
            });

            // 5. [NEW] Generate GET tool (View One)
            tools.push({
                type: "function",
                function: {
                    name: `get_${name}`,
                    description: `Retrieve full details of a single record from '${name}' by its ID.`,
                    parameters: {
                        type: "object",
                        properties: {
                            id: { type: "string", description: "Unique ID of the record." }
                        },
                        required: ["id"]
                    }
                }
            });
        }
    }

    // --- Dynamic Email Template Discovery ---
    try {
        const templateMap = new Map();

        const processTemplates = (snap, sourceLabel) => {
            if (snap.empty) return;
            console.log(`[Discovery] Found ${snap.size} templates from ${sourceLabel}`);
            snap.forEach(doc => {
                const template = doc.data();
                const rawName = doc.id;
                // OpenAI tool names must be regex ^[a-zA-Z0-9_-]{1,64}$
                const templateName = rawName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');

                // Find placeholders in content like {{client_name}}
                const placeholders = {};
                const content = (template.content || template.body || '') + (template.subject || '');
                const matches = content.matchAll(/\{\{(.+?)\}\}/g);
                for (const match of matches) {
                    const key = match[1].trim();
                    placeholders[key] = { type: "string", description: `Value for placeholder {{${key}}}` };
                }

                templateMap.set(templateName, {
                    type: "function",
                    function: {
                        name: `send_${templateName}_email`,
                        description: `Send the '${templateName}' email template to a recipient.`,
                        parameters: {
                            type: "object",
                            properties: {
                                to: { type: "string", description: "Recipient email address" },
                                subject: { type: "string", description: "Optional custom subject (overrides template default)" },
                                ...placeholders
                            },
                            required: ["to"]
                        }
                    }
                });
            });
        };

        // 1. Fetch from Tenant Project (Project Specific)
        const tenantSnap = await db.collection('email_templates').get();
        processTemplates(tenantSnap, "Tenant DB");

        // Add to final tools
        for (const toolDef of templateMap.values()) {
            tools.push(toolDef);
        }
    } catch (e) {
        console.warn("Email Template Discovery failed (collection may not exist yet):", e.message);
    }

    console.log(`Discovery complete. Found ${tools.length} potential tools.`);
    return tools;
}

module.exports = { discoverSchema };
