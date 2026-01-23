const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { tools, handlers, dynamicHandler } = require('./vapi-tools');
const { saveCredential, verifyConnection, getApp } = require('./firebase-manager'); // Import Manager
const { discoverSchema } = require('./schema-discovery');
const OpenAI = require('openai');



dotenv.config();
console.log("------------------------------------------");
console.log("DEBUG ENV VARS:");
console.log("Email User:", process.env.EMAIL_USER);
console.log("Email Pass (Length):", process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : "MISSING");
console.log("Server URL:", process.env.SERVER_URL || "NOT SET (using example.com)");
console.log("------------------------------------------");

const app = express();
const PORT = process.env.PORT || 5000;
const { admin, auth, db } = require('./firebase-admin'); // Shared Module

// CORS Setup (Updated for Embeddable Widgets)
app.use(cors({
    origin: '*', // Allow all for public widgets
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve Widget JS
app.get('/chat-widget.js', (req, res) => {
    res.sendFile(__dirname + '/chat-widget.js');
});

// Firebase Init handled by module above


// Authentication Middleware
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        // Only works if Admin is initialized
        if (admin.apps.length === 0) {
            throw new Error("Admin SDK not initialized");
        }
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error("Token Verification Failed:", error.message);
        return res.status(403).json({ success: false, message: 'Unauthorized: Invalid token' });
    }
};

// Routes
app.get('/', (req, res) => {
    res.send('Premium Quasar ERP Backend is Running and Secured');
});

const { Resend } = require('resend');

const resendApiKey = process.env.RESEND_API_KEY;
let resend;

if (resendApiKey) {
    resend = new Resend(resendApiKey);
} else {
    console.warn("⚠️ RESEND_API_KEY is missing in .env! Emails will fail.");
}

// Custom Password Reset Endpoint
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;

    // Note: This endpoint is public so users can reset password without login.
    // However, we should rate limit this in production.

    try {
        if (admin.apps.length === 0) throw new Error("Admin not initialized");

        // Generate Link
        const link = await admin.auth().generatePasswordResetLink(email);

        // Custom Email Template
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { background-color: #0B0D10; color: #F0F2F5; font-family: sans-serif; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 40px auto; background: #15171C; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); }
                .header { background: #15171C; padding: 30px; text-align: center; border-bottom: 2px solid #DFA53A; }
                .content { padding: 40px; text-align: center; }
                .btn { display: inline-block; background-color: #DFA53A; color: #000; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 20px; }
                .footer { padding: 20px; text-align: center; color: #555; font-size: 12px; background: #0B0D10; }
                .link { color: #DFA53A; word-break: break-all; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="color: #DFA53A; margin: 0;">Premium Quasar</h1>
                </div>
                <div class="content">
                    <h2 style="margin-top: 0;">Reset Your Credentials</h2>
                    <p style="color: #A0A5B0; line-height: 1.6;">You have requested to reset your secure access key. Click the button below to proceed.</p>
                    
                    <a href="${link}" class="btn">Reset Password</a>
                    
                    <p style="margin-top: 30px; font-size: 12px; color: #555;">Or copy this link:</p>
                    <a href="${link}" class="link" style="font-size:11px;">${link}</a>
                    
                    <p style="color: #555; font-size: 12px; margin-top: 30px;">If you did not request this, please ignore this email.</p>
                </div>
                <div class="footer">
                    &copy; ${new Date().getFullYear()} Premium Quasar ERP. All rights reserved.
                </div>
            </div>
        </body>
        </html>
        `;

        const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

        if (!resend) throw new Error("Server Email Config Missing (Resend API Key)");

        const data = await resend.emails.send({
            from: 'Premium Quasar Security <' + fromEmail + '>',
            // If strictly testing without domain verify, send only to your account email
            to: [email],
            subject: 'Secure Password Reset Request',
            html: htmlContent
        });

        if (data.error) throw new Error(data.error.message);

        res.json({ success: true, message: 'Custom reset email sent via Resend.' });

    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/send-email', verifyToken, async (req, res) => {
    const { to, subject, body } = req.body;

    if (!resend) {
        return res.status(500).json({ success: false, message: 'Server Email Config Missing (Resend API Key)' });
    }

    // Force usage of the verified domain if possible, ignoring the sandbox default from env
    let fromEmail = process.env.EMAIL_FROM;
    if (!fromEmail || fromEmail.includes('resend.dev')) {
        fromEmail = 'noreply@solutionsquasar.ca';
    }

    console.log(`Attempting to send email FROM: ${fromEmail} TO: ${to}`);

    try {
        const data = await resend.emails.send({
            from: 'Premium Quasar <' + fromEmail + '>',
            to: [to],
            subject: subject,
            html: body.replace(/\n/g, '<br>')
        });

        if (data.error) throw new Error(data.error.message);

        console.log('Resend Email Sent:', data.id);
        res.json({ success: true, message: 'Email sent successfully via Resend!' });
    } catch (error) {
        console.error('Email Initial Send Error:', error.message);

        // --- SANDBOX FALLBACK ---
        // Resend restricts free accounts to only send to the verified email.
        // We catch this error and redirect to the verified email so the flow completes.
        if (error.message && (error.message.includes('only send testing emails') || error.message.includes('verify a domain'))) {
            try {
                const sandboxEmail = 'bensult78@gmail.com';
                const fallbackSender = 'onboarding@resend.dev'; // Force safe sender for sandbox

                console.log(`REDIRECTING email to sandbox: ${sandboxEmail} from ${fallbackSender}`);

                const retryData = await resend.emails.send({
                    from: fallbackSender,
                    to: [sandboxEmail],
                    subject: `[SANDBOX REDIRECT: ${to}] ${subject}`,
                    html: `<p><strong>Original Recipient:</strong> ${to}</p><hr>${body.replace(/\n/g, '<br>')}`
                });

                if (retryData.error) throw new Error(retryData.error.message);

                return res.json({
                    success: true,
                    message: `Sandbox Mode: Email redirected to ${sandboxEmail} (using onboarding@resend.dev)`
                });

            } catch (retryError) {
                console.error('Email Retry Error:', retryError);
                // Return original error to allow user to debug their domain
                return res.status(500).json({ success: false, error: 'Sandbox Retry Failed: ' + retryError.message });
            }
        }

        res.status(500).json({ success: false, error: error.message });
    }
});

const axios = require('axios');

// ... (Email routes) ...

// --- VAPI INTEGRATION ---

// 1. Get Public Key (for Frontend SDK)
app.get('/api/vapi/public-key', verifyToken, (req, res) => {
    const key = process.env.VAPI_PUBLIC_KEY;
    if (!key) return res.status(500).json({ success: false, error: 'VAPI_PUBLIC_KEY not configured on server.' });
    res.json({ success: true, publicKey: key });
});

// 2. Create Agent (Proxy to Vapi API)
app.post('/api/vapi/create-agent', verifyToken, async (req, res) => {
    const { name, type, prompt, model } = req.body;
    const apiKey = process.env.VAPI_PRIVATE_KEY;

    if (!apiKey) return res.status(500).json({ success: false, error: 'VAPI_PRIVATE_KEY not configured on server.' });

    try {
        // Construct Vapi Assistant Object
        // This is a minimal configuration. Vapi allows much more.
        const assistantConfig = {
            name: name,
            transcriber: { provider: "deepgram" },
            model: {
                provider: "openai",
                model: model || "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: prompt || "You are a helpful assistant." }
                ]
            },
            voice: { provider: "11labs", voiceId: "burt" }, // Default Voice
            firstMessage: "Hello, how can I help you today?"
        };

        const response = await axios.post('https://api.vapi.ai/assistant', assistantConfig, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        res.json({ success: true, data: response.data });

    } catch (error) {
        console.error("Vapi Create Error:", error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.response?.data?.message || error.message });
    }
});

// 3. Update Agent (Sync changes to Vapi)
app.patch('/api/vapi/update-agent/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { name, prompt, model, tools: selectedTools, projectId } = req.body;
    const apiKey = process.env.VAPI_PRIVATE_KEY;

    if (!apiKey) return res.status(500).json({ success: false, error: 'VAPI_PRIVATE_KEY not configured.' });
    if (!projectId) return res.status(400).json({ success: false, error: 'projectId is required.' });

    try {
        // 1. Get Isolated DB & Discover Dynamic Tools
        const appInstance = await getApp(projectId);
        const db = appInstance.firestore();
        const dynamicToolsList = await discoverSchema(db);

        // 2. Merge Static + Dynamic Tools
        const allPotentialTools = [...tools, ...dynamicToolsList];

        // 3. Filter Enabled Tools
        const functionsToEnable = [];
        if (selectedTools) {
            allPotentialTools.forEach(t => {
                // Check if tool is enabled in the request (true/false)
                if (selectedTools[t.function.name]) {
                    functionsToEnable.push(t);
                }
            });
        }

        // Determine Base URL
        const baseUrl = process.env.SERVER_URL || 'https://example.com';
        const callbackUrl = `${baseUrl}/api/vapi/callback?projectId=${projectId}`;

        // Construct Update Payload
        const updatePayload = {
            name: name,
            model: {
                provider: "openai",
                model: model || "gpt-3.5-turbo",
                messages: [{ role: "system", content: prompt }],
                tools: functionsToEnable.length > 0 ? functionsToEnable : undefined
            },
            // IMPORTANT: Set Server Webhook URL for these tools to work
            serverUrl: callbackUrl
        };

        const response = await axios.patch(`https://api.vapi.ai/assistant/${id}`, updatePayload, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        res.json({ success: true, data: response.data });

    } catch (error) {
        console.error("Vapi Update Error:", error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.response?.data?.message || error.message });
    }
});

// 4. Delete Agent
app.delete('/api/vapi/delete-agent/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const apiKey = process.env.VAPI_PRIVATE_KEY;

    if (!apiKey) return res.status(500).json({ success: false, error: 'VAPI_PRIVATE_KEY not configured.' });

    try {
        await axios.delete(`https://api.vapi.ai/assistant/${id}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        res.json({ success: true, message: "Agent deleted from Vapi" });
    } catch (error) {
        console.error("Vapi Delete Error:", error.response?.data || error.message);
        // Even if Vapi fails (e.g. 404), we should probably allow local delete, but let's report it.
        res.status(500).json({ success: false, error: error.response?.data?.message || error.message });
    }
});


// --- DEBUG LOGGING ---
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// 5. Vapi Webhook for Tool Calls
app.get('/api/vapi/callback', (req, res) => {
    res.json({ success: true, message: "Vapi Callback Endpoint is alive and reachable via GET." });
});

app.post('/api/vapi/callback', async (req, res) => {
    try {
        const payload = req.body;
        const { projectId } = req.query; // MUST be present

        // SECURITY: Strict Isolation Check
        if (!projectId) {
            console.warn("BLOCKED: Vapi Callback missing projectId");
            return res.status(400).json({ error: "Missing projectId in webhook URL." });
        }

        console.log(`[Vapi Webhook] Project: ${projectId}`);
        // console.log("Vapi Webhook Payload:", JSON.stringify(payload, null, 2));

        // Handle Function Calls
        // Vapi sends: { message: { type: "tool-calls", toolCalls: [...] } }
        let toolCalls = payload.toolCalls;
        if (!toolCalls && payload.message && payload.message.toolCalls) {
            toolCalls = payload.message.toolCalls;
        }

        if (toolCalls) {
            console.log(`Processing ${toolCalls.length} tool calls for ${projectId}...`);
            const results = [];
            for (const call of toolCalls) {
                const fnName = call.function.name;
                let args = call.function.arguments;
                if (typeof args === 'string') args = JSON.parse(args);

                console.log(`[Vapi] Tool Call: ${fnName}`, args);

                let result;
                if (handlers[fnName]) {
                    result = await handlers[fnName](args, projectId);
                } else {
                    // Try dynamic handler (handles create_*, search_*)
                    result = await dynamicHandler(fnName, args, projectId);
                }

                results.push({
                    toolCallId: call.id,
                    result: JSON.stringify(result)
                });
            }

            // Return results to Vapi
            return res.json({
                results: results
            });
        }

        res.json({ success: true }); // Acknowledge other events

    } catch (e) {
        console.error("Webhook Error:", e);
        res.status(500).json({ error: e.message });
    }
});



// Save PDF Report to Lead


// 5. Credential Management & Testing

// Upload Service Account
app.post('/api/projects/:id/credentials', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { key } = req.body; // Expecting JSON content of the file

        if (!key || !key.project_id) return res.status(400).json({ error: "Invalid Service Account JSON" });

        console.log(`Uploading credentials for Project ${id}`);
        saveCredential(id, key);

        // Verify immediately
        const isValid = await verifyConnection(id);
        res.json({ success: true, verified: isValid });

    } catch (e) {
        console.error("Upload Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Verify Connection
app.get('/api/projects/:id/verify', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const isValid = await verifyConnection(id);
        res.json({ success: true, verified: isValid });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Auto-Discovery Endpoint
app.post('/api/projects/:id/discover', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`Discovering schema for Project: ${id}`);
        // 1. Get isolated DB
        const app = await getApp(id);
        const db = app.firestore();

        // 2. Run discovery
        const tools = await discoverSchema(db);

        // 3. Return tool definitions
        res.json({ success: true, tools });

    } catch (e) {
        console.error("Discovery Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Test Tool Execution
app.post('/api/tools/test', verifyToken, async (req, res) => {
    try {
        const { toolName, args, projectId } = req.body;

        if (!handlers[toolName]) return res.status(400).json({ error: "Unknown Tool" });
        if (!projectId) return res.status(400).json({ error: "Missing Project ID" });

        console.log(`[Test] Running ${toolName} for ${projectId}`);
        const result = await handlers[toolName](args, projectId);

        res.json({ success: true, result });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// --- CHAT INTERFACE (PHASE 3) ---
app.post('/api/chat', verifyToken, async (req, res) => {
    try {
        const { projectId, agentId, messages } = req.body;
        if (!projectId || !agentId || !messages) return res.status(400).json({ error: "Missing required fields" });

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: "Server OpenAI Key not configured" });

        const openai = new OpenAI({ apiKey });

        // 1. Get Agent Config from MAIN DB
        const agentDoc = await db.collection('ai_agents').doc(agentId).get();
        if (!agentDoc.exists) return res.status(404).json({ error: "Agent not found" });
        const agentData = agentDoc.data();

        // 2. Get Project DB (Tenant) & Discover Dynamic Tools
        const appInstance = await getApp(projectId);
        const tenantDb = appInstance.firestore();
        const dynamicTools = await discoverSchema(tenantDb);
        const availableTools = [...tools, ...dynamicTools];

        // 3. Prepare Messages
        const systemMessage = { role: "system", content: agentData.prompt || "You are a helpful assistant." };
        // Prepend system prompt to history (user messages usually come first in request if we are not careful)
        const fullHistory = [systemMessage, ...messages];

        // 4. OpenAI Loop (Handle Tool Calls)
        let keepGoing = true;
        let currentHistory = fullHistory;
        let finalResponse = null;
        let loops = 0;

        while (keepGoing && loops < 5) {
            loops++;
            const completion = await openai.chat.completions.create({
                model: agentData.model || "gpt-3.5-turbo",
                messages: currentHistory,
                tools: availableTools.length > 0 ? availableTools : undefined,
                tool_choice: "auto"
            });

            const assistantMsg = completion.choices[0].message;
            currentHistory.push(assistantMsg);

            if (assistantMsg.tool_calls) {
                console.log(`[Chatbot] Executing ${assistantMsg.tool_calls.length} tools...`);

                for (const toolCall of assistantMsg.tool_calls) {
                    const fnName = toolCall.function.name;
                    const fnArgs = JSON.parse(toolCall.function.arguments);
                    let result = { error: "Tool not found" };

                    try {
                        if (handlers[fnName]) {
                            result = await handlers[fnName](fnArgs, projectId);
                        } else {
                            // Unified Dynamic Handler
                            result = await dynamicHandler(fnName, fnArgs, projectId);
                        }
                    } catch (err) {
                        result = { error: err.message };
                    }

                    // Append Tool Output
                    currentHistory.push({
                        tool_call_id: toolCall.id,
                        role: "tool",
                        name: fnName,
                        content: JSON.stringify(result)
                    });
                }
            } else {
                finalResponse = assistantMsg.content;
                keepGoing = false;
            }
        }

        res.json({ success: true, message: finalResponse, history: currentHistory });

    } catch (e) {
        console.error("Chat API Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- PUBLIC CHAT ENDPOINT (PHASE 4) ---
// No verifyToken here so it can be called from external websites
app.post('/api/public/chat/:agentId', async (req, res) => {
    try {
        const { agentId } = req.params;
        const { messages } = req.body;

        if (!agentId || !messages) return res.status(400).json({ error: "Missing required fields" });

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: "Server OpenAI Key not configured" });

        const openai = new OpenAI({ apiKey });

        // 1. Get Agent Config from MAIN DB (Search across all agents)
        const agentDoc = await db.collection('ai_agents').doc(agentId).get();
        if (!agentDoc.exists) return res.status(404).json({ error: "Agent not found" });
        const agentData = agentDoc.data();
        const projectId = agentData.projectId;

        // 2. Get Project DB (Tenant) & Discover Dynamic Tools
        const appInstance = await getApp(projectId);
        const tenantDb = appInstance.firestore();
        const dynamicTools = await discoverSchema(tenantDb);
        const availableTools = [...tools, ...dynamicTools];

        // 3. Prepare Messages
        const systemMessage = { role: "system", content: agentData.prompt || "You are a helpful assistant." };
        const fullHistory = [systemMessage, ...messages];

        // 4. OpenAI Loop (Handle Tool Calls) - REUSED FROM PRIVATE CHAT
        let currentHistory = fullHistory;
        let finalResponse = null;
        let loops = 0;

        while (loops < 5) {
            loops++;
            const completion = await openai.chat.completions.create({
                model: agentData.model || "gpt-3.5-turbo",
                messages: currentHistory,
                tools: availableTools.length > 0 ? availableTools : undefined,
                tool_choice: "auto"
            });

            const assistantMsg = completion.choices[0].message;
            currentHistory.push(assistantMsg);

            if (assistantMsg.tool_calls) {
                console.log(`[Public Chat] Agent ${agentId} executing ${assistantMsg.tool_calls.length} tools...`);
                for (const toolCall of assistantMsg.tool_calls) {
                    const fnName = toolCall.function.name;
                    const fnArgs = JSON.parse(toolCall.function.arguments);
                    let result = { error: "Tool not found" };

                    try {
                        if (handlers[fnName]) {
                            result = await handlers[fnName](fnArgs, projectId);
                        } else {
                            // Unified Dynamic Handler
                            result = await dynamicHandler(fnName, fnArgs, projectId);
                        }
                    } catch (err) { result = { error: err.message }; }

                    currentHistory.push({ tool_call_id: toolCall.id, role: "tool", name: fnName, content: JSON.stringify(result) });
                }
            } else {
                finalResponse = assistantMsg.content;
                break;
            }
        }

        res.json({ success: true, message: finalResponse, history: currentHistory });

    } catch (e) {
        console.error("Public Chat API Error:", e);
        res.status(500).json({ error: e.message });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
