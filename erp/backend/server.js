const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const OpenAI = require('openai');
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

if (!stripe) {
    console.warn("⚠️ STRIPE_SECRET_KEY is missing in .env! Payments will be disabled.");
}
const { tools, handlers, dynamicHandler } = require('./vapi-tools');
const googleAuth = require('./google-auth');
const { saveCredential, verifyConnection, getApp } = require('./firebase-manager');
const { discoverSchema } = require('./schema-discovery');


const PROD_URL = 'https://quasar-erp-b26d5.web.app';
const SERVER_URL = process.env.SERVER_URL || PROD_URL;

console.log("------------------------------------------");
console.log("DEBUG ENV VARS:");
console.log("Email User:", process.env.EMAIL_USER);
console.log("Server URL:", SERVER_URL);
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

// Public Contact Form Endpoint
app.post('/api/contact', async (req, res) => {
    const { name, company, contact_method, interest, message } = req.body;

    // Basic validation
    if (!name || !contact_method) {
        return res.status(400).json({ success: false, error: "Name and Contact Method are required." });
    }

    if (!resend) {
        console.error("Resend not configured");
        return res.status(500).json({ success: false, error: "Email service not configured. Please check server logs." });
    }

    const htmlContent = `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #dfa53a;">New Strategy Call Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Company:</strong> ${company || 'N/A'}</p>
        <p><strong>Contact:</strong> ${contact_method}</p>
        <p><strong>Interest:</strong> ${interest || 'N/A'}</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin-top: 10px;">
            <strong>Message:</strong><br>
            ${(message || '').replace(/\n/g, '<br>')}
        </div>
    </div>
    `;

    try {
        // Use verified domain sender by default
        const fromEmail = process.env.EMAIL_FROM && !process.env.EMAIL_FROM.includes('resend.dev')
            ? process.env.EMAIL_FROM
            : 'info@solutionsquasar.ca';

        // Use the hardcoded email found in the file as a safe default for notifications
        const notificationEmail = 'info@solutionsquasar.ca';

        // 1. Send Email via Resend
        await resend.emails.send({
            from: 'Website Lead <' + fromEmail + '>',
            to: [notificationEmail],
            reply_to: contact_method.includes('@') ? contact_method : undefined,
            subject: `New Lead: ${name} - ${interest}`,
            html: htmlContent
        });

        // 1b. Send Auto-Confirmation to Client (if email is provided)
        if (contact_method.includes('@')) {
            const userHtml = `
            <div style="font-family: sans-serif; background-color: #0B0D10; color: #F0F2F5; padding: 40px 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #15171C; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="background-color: #0B0D10; padding: 20px; text-align: center; border-bottom: 2px solid #DFA53A;">
                        <h1 style="color: #DFA53A; margin: 0; font-size: 24px; letter-spacing: 2px;">SOLUTIONS QUASAR</h1>
                    </div>
                    <div style="padding: 30px;">
                        <h2 style="color: #F0C468; margin-top: 0;">Request Received</h2>
                        <p>Hello ${name},</p>
                        <p>Thank you for reaching out to Solutions Quasar. We have received your inquiry regarding <strong>${interest}</strong>.</p>
                        <p>Our team reviews every request carefully. We will get back to you shortly to discuss how we can elevate your digital presence.</p>
                        <br>
                        <p style="color: #A0A5B0; font-size: 14px;">If you have any urgent questions, feel free to reply to this email.</p>
                    </div>
                    <div style="background-color: #0B0D10; padding: 15px; text-align: center; color: #555; font-size: 12px;">
                        &copy; ${new Date().getFullYear()} Solutions Quasar Inc.
                    </div>
                </div>
            </div>`;

            try {
                await resend.emails.send({
                    from: 'Solutions Quasar <' + fromEmail + '>',
                    to: [contact_method],
                    subject: 'We received your request - Solutions Quasar',
                    html: userHtml
                });
                console.log(`Confirmation sent to ${contact_method}`);
            } catch (confError) {
                console.error("Confirmation Email Failed:", confError);
                // Don't block the main flow
            }
        }

        // 2. Sync to Firebase (Save to Firestore)
        await db.collection('crm_leads').add({
            name,
            company: company || null,
            contactMethod: contact_method,
            interest: interest || 'General',
            message: message || '',
            status: 'New',
            source: 'website_contact_form',
            createdAt: new Date().toISOString()
        });

        console.log(`Lead saved and emailed: ${name}`);

        res.json({ success: true, message: "Request received successfully." });

    } catch (error) {
        console.error("Contact Form Error:", error);

        // --- SANDBOX FALLBACK (Duplicate from send-email) ---
        if (error.message && (error.message.includes('only send testing emails') || error.message.includes('verify a domain'))) {
            try {
                const sandboxEmail = 'bensult78@gmail.com'; // Hardcoded dev email
                const fallbackSender = 'onboarding@resend.dev';

                console.log(`REDIRECTING contact form to sandbox: ${sandboxEmail}`);

                await resend.emails.send({
                    from: 'Website Lead <' + fallbackSender + '>',
                    to: [sandboxEmail],
                    subject: `[SANDBOX] New Lead: ${name}`,
                    html: `<p><strong>Original Destination:</strong> info@solutionsquasar.ca</p><hr>${htmlContent}`
                });

                // Still save to DB
                try {
                    await db.collection('crm_leads').add({
                        name,
                        company: company || null,
                        contactMethod: contact_method,
                        interest: interest || 'General',
                        message: message || '',
                        status: 'New',
                        source: 'website_contact_form (sandbox_redirect)',
                        createdAt: new Date().toISOString()
                    });
                } catch (dbErr) { console.error("DB Save Error:", dbErr); }

                return res.json({ success: true, message: "Request received (Sandbox Mode)." });

            } catch (retryError) {
                console.error('Contact Sandbox Retry Failed:', retryError);
            }
        }

        res.status(500).json({ success: false, error: "Failed to send email. Please try again later." });
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
        fromEmail = 'info@solutionsquasar.ca';
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

// --- STRIPE INTEGRATION ---

// 1. Create Checkout Session for an Invoice
app.post('/api/sales/create-checkout-session', verifyToken, async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ success: false, error: "Stripe is not configured on the server." });
    }
    const { invoiceId, amount, clientName, clientEmail, number } = req.body;

    if (!invoiceId || !amount) {
        return res.status(400).json({ success: false, error: "Missing invoiceId or amount" });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: clientEmail,
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `Invoice #${number || invoiceId}`,
                        description: `Payment for ${clientName || 'Invoice'}`,
                    },
                    unit_amount: Math.round(amount * 100), // Stripe expects cents
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${SERVER_URL}/erp/payment_success.html?invoice_id=${invoiceId}&number=${number || invoiceId}`,
            cancel_url: `${SERVER_URL}/erp/index.html#sales?payment=cancelled&id=${invoiceId}`,
            metadata: {
                invoiceId: invoiceId,
                type: 'invoice_payment'
            }
        });

        res.json({ success: true, url: session.url });
    } catch (error) {
        console.error("Stripe Session Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Stripe Webhook Handler
// Note: This requires the raw body for signature verification.
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        if (endpointSecret) {
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } else {
            // If no secret, we trust the body (NOT RECOMMENDED for production)
            event = JSON.parse(req.body);
        }
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const invoiceId = session.metadata.invoiceId;

        if (invoiceId) {
            console.log(`Payment successful for Invoice: ${invoiceId}`);
            try {
                // Update Invoice Status in Firestore
                await db.collection('invoices').doc(invoiceId).update({
                    status: 'Paid',
                    paidAt: new Date().toISOString(),
                    stripeSessionId: session.id
                });
            } catch (error) {
                console.error("Failed to update invoice status:", error);
            }
        }
    }

    res.json({ received: true });
});

// --- VAPI INTEGRATION ---

// 1. Get Public Key (Protected - Internal Use)
app.get('/api/vapi/public-key', verifyToken, (req, res) => {
    const key = process.env.VAPI_PUBLIC_KEY;
    if (!key) return res.status(500).json({ success: false, error: 'VAPI_PUBLIC_KEY not configured on server.' });
    res.json({ success: true, publicKey: key });
});

// 1.1 Get Public Key (Public - Widget Use)
app.get('/api/public/vapi/key', (req, res) => {
    const key = process.env.VAPI_PUBLIC_KEY;
    if (!key) return res.status(500).json({ success: false, error: 'VAPI_PUBLIC_KEY not configured on server.' });
    res.json({ success: true, publicKey: key });
});

// 1.2 Get Public Widget Configuration (Gateway)
app.get('/api/public/widget-config/:agentId', async (req, res) => {
    try {
        const { agentId } = req.params;
        const docSnap = await db.collection('ai_agents').doc(agentId).get();

        if (!docSnap.exists) {
            return res.status(404).json({ success: false, error: 'Agent not found' });
        }

        const data = docSnap.data();

        // Return only safe, public configuration
        res.json({
            success: true,
            config: {
                title: data.name || 'AI Assistant', // Use Agent Name as default title or add specific field later
                color: data.color || '#dfa53a', // We need to make sure we save these to the DB now
                welcome: data.welcomeMessage || 'Hello! How can I help you today?',
                vapiId: data.vapiAssistantId || null,
                toggleIcon: data.toggleIcon || 'chat',
                voiceHint: data.voiceHint !== false, // Default to true
                avatar: data.avatarUrl || null
            }
        });

    } catch (e) {
        console.error("Config Fetch Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- GOOGLE INTEGRATIONS ---

app.get('/api/integrations/google/auth-url', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: "Missing projectId" });
    const url = googleAuth.getAuthUrl(projectId);
    res.json({ url });
});

app.get('/api/integrations/google/callback', async (req, res) => {
    const { code, state: projectId } = req.query;
    try {
        const tokens = await googleAuth.getTokensFromCode(code);
        await db.collection('ai_projects').doc(projectId).update({
            googleTokens: tokens,
            googleConnectedAt: new Date().toISOString()
        });
        // Redirect back to portal
        res.redirect(`${SERVER_URL}/erp/portal.html?pid=${projectId}`);
    } catch (e) {
        console.error("Google Callback Error:", e);
        res.status(500).send("Failed to connect Google account.");
    }
});

// --- CLIENT PORTAL USER MANAGEMENT ---

app.post('/api/projects/:projectId/portal-user', verifyToken, async (req, res) => {
    const { projectId } = req.params;
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    try {
        let user;
        try {
            user = await admin.auth().getUserByEmail(email);
            // User exists, update password if provided
            await admin.auth().updateUser(user.uid, { password });
        } catch (e) {
            // Create New User
            user = await admin.auth().createUser({
                email,
                password,
                emailVerified: true
            });
        }

        // Set Custom Claims for Project Isolation
        await admin.auth().setCustomUserClaims(user.uid, {
            role: 'client',
            projectId: projectId
        });

        // Update Project Doc
        await db.collection('ai_projects').doc(projectId).update({
            portalEmail: email,
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true, message: `Portal access granted to ${email}` });

    } catch (e) {
        console.error("Portal User Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- CLIENT INVITATION FLOW ---

app.post('/api/projects/:projectId/invite-client', verifyToken, async (req, res) => {
    const { projectId } = req.params;
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: "Email is required" });

    try {
        const projectDoc = await db.collection('ai_projects').doc(projectId).get();
        if (!projectDoc.exists) return res.status(404).json({ error: "Project not found" });
        const projectName = projectDoc.data().name;

        // 1. Generate Token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 48); // 48 hour expiry

        // 2. Store Invitation
        await db.collection('ai_invitations').doc(token).set({
            email,
            projectId,
            projectName,
            expiresAt: expiresAt.toISOString(),
            used: false
        });

        // 3. Send Email
        const inviteLink = `${PROD_URL}/erp/portal.html?invite=${token}`;
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { background-color: #08090a; color: #f0f2f5; font-family: 'Outfit', sans-serif; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 40px auto; background: #121418; border-radius: 24px; overflow: hidden; border: 1px solid #2d3139; }
                .header { padding: 40px; text-align: center; border-bottom: 1px solid #2d3139; }
                .content { padding: 40px; text-align: center; }
                .btn { display: inline-block; background-color: #dfa53a; color: #000; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; margin-top: 24px; }
                .footer { padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="color: #dfa53a; margin: 0; font-size: 24px; letter-spacing: 2px;">QUASAR AI</h1>
                </div>
                <div class="content">
                    <h2 style="margin-top: 0; font-size: 20px;">Welcome to your Portal</h2>
                    <p style="color: #94a3b8; line-height: 1.6;">You have been invited to manage your AI workforce for <strong>${projectName}</strong>.</p>
                    <p style="color: #94a3b8;">Click the button below to secure your account and set your password.</p>
                    
                    <a href="${inviteLink}" class="btn">Setup My Portal</a>
                    
                    <p style="margin-top: 30px; font-size: 12px; color: #555;">This invitation link expires in 48 hours.</p>
                </div>
                <div class="footer">
                    &copy; ${new Date().getFullYear()} Solutions Quasar Inc.
                </div>
            </div>
        </body>
        </html>
        `;

        const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';
        if (!resend) throw new Error("Email service not configured");

        await resend.emails.send({
            from: 'Quasar AI <' + fromEmail + '>',
            to: [email],
            subject: `Invitation: Access your portal for ${projectName}`,
            html: htmlContent
        });

        res.json({ success: true, message: `Invitation sent to ${email}` });

    } catch (e) {
        console.error("Invite Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/public/portal/verify-invite/:token', async (req, res) => {
    const { token } = req.params;
    try {
        const doc = await db.collection('ai_invitations').doc(token).get();
        if (!doc.exists) return res.status(404).json({ error: "Invalid invitation link." });

        const data = doc.data();
        if (data.used) return res.status(400).json({ error: "This invitation has already been used." });
        if (new Date(data.expiresAt) < new Date()) return res.status(400).json({ error: "This invitation has expired." });

        res.json({
            success: true,
            email: data.email,
            projectName: data.projectName
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/public/portal/setup-account', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Missing required fields" });

    try {
        const inviteDoc = await db.collection('ai_invitations').doc(token).get();
        if (!inviteDoc.exists || inviteDoc.data().used) throw new Error("Invalid or used token");

        const inviteData = inviteDoc.data();
        if (new Date(inviteData.expiresAt) < new Date()) throw new Error("Token expired");

        const { email, projectId } = inviteData;

        // 1. Create or Update User
        let user;
        try {
            user = await admin.auth().getUserByEmail(email);
            await admin.auth().updateUser(user.uid, { password });
        } catch (e) {
            user = await admin.auth().createUser({ email, password, emailVerified: true });
        }

        // 2. Set Claims
        await admin.auth().setCustomUserClaims(user.uid, {
            role: 'client',
            projectId: projectId
        });

        // 3. Mark Invite as Used
        await db.collection('ai_invitations').doc(token).update({ used: true });

        // 4. Update Project
        await db.collection('ai_projects').doc(projectId).update({
            portalEmail: email,
            portalSetupAt: new Date().toISOString()
        });

        res.json({ success: true, message: "Account secured successfully." });

    } catch (e) {
        console.error("Setup Account Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Helper to get project info for a logged in client
app.get('/api/public/portal/session', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token" });

    try {
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        if (decodedToken.role !== 'client' || !decodedToken.projectId) {
            return res.json({ success: false, error: "Not a client portal user (ERP Admin detected)" });
        }

        const projectDoc = await db.collection('ai_projects').doc(decodedToken.projectId).get();
        if (!projectDoc.exists) return res.status(404).json({ error: "Project lost" });

        res.json({
            success: true,
            projectId: decodedToken.projectId,
            projectName: projectDoc.data().name,
            projectData: projectDoc.data()
        });

    } catch (e) { res.status(401).json({ error: "Invalid session" }); }
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
        const callbackUrl = `${SERVER_URL}/api/vapi/callback?projectId=${projectId}`;

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

                // --- SECURITY CHECK (UI RESTRICTIONS) ---
                // We need to fetch the Agent config to see if this tool is enabled.
                // Vapi sends 'assistantId' in the call.assistantId field but sometimes at payload root.
                // We'll search for the agent using the Vapi ID if available, or assume the user wants strictness.

                // Ideally, Vapi webhook should include the assistantId.
                const vapiAssistantId = payload.assistant ? payload.assistant.id : (payload.call ? payload.call.assistantId : null);
                let isAllowed = true;

                if (vapiAssistantId) {
                    // Find Agent by Vapi ID to check permissions
                    const agentQuery = await db.collection('ai_agents').where('vapiAssistantId', '==', vapiAssistantId).limit(1).get();
                    if (!agentQuery.empty) {
                        const agentData = agentQuery.docs[0].data();
                        // If tools config exists, check if this specific tool is enabled
                        if (agentData.tools && agentData.tools[fnName] === false) {
                            isAllowed = false;
                            console.warn(`[Security] Blocked disabled tool: ${fnName}`);
                        }
                    }
                }

                if (!isAllowed) {
                    result = { error: "Access to this tool is disabled by the administrator." };
                } else {
                    if (handlers[fnName]) {
                        result = await handlers[fnName](args, projectId);
                    } else {
                        // Try dynamic handler (handles create_*, search_*)
                        result = await dynamicHandler(fnName, args, projectId);
                    }
                }
                // ----------------------------------------

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
                model: agentData.model || "gpt-4o-mini",
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
                        // --- SECURITY CHECK (CHATBOT) ---
                        if (agentData.tools && agentData.tools[fnName] === false) {
                            result = { error: "Access to this tool is disabled by the administrator." };
                        } else {
                            if (handlers[fnName]) {
                                result = await handlers[fnName](fnArgs, projectId);
                            } else {
                                // Unified Dynamic Handler
                                result = await dynamicHandler(fnName, fnArgs, projectId);
                            }
                        }
                        // --------------------------------
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
        const { messages, sessionId } = req.body;

        if (!agentId || !messages) return res.status(400).json({ error: "Missing required fields" });

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: "Server OpenAI Key not configured" });

        const openai = new OpenAI({ apiKey });

        // 1. Get Agent Config from MAIN DB
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

        // 4. OpenAI Loop (Handle Tool Calls)
        let currentHistory = fullHistory;
        let finalResponse = null;
        let loops = 0;

        while (loops < 5) {
            loops++;
            const completion = await openai.chat.completions.create({
                model: agentData.model || "gpt-4o-mini",
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
                        if (agentData.tools && agentData.tools[fnName] === false) {
                            result = { error: "Access to this tool is disabled by the administrator." };
                        } else {
                            if (handlers[fnName]) {
                                result = await handlers[fnName](fnArgs, projectId);
                            } else {
                                result = await dynamicHandler(fnName, fnArgs, projectId);
                            }
                        }
                    } catch (err) { result = { error: err.message }; }

                    currentHistory.push({ tool_call_id: toolCall.id, role: "tool", name: fnName, content: JSON.stringify(result) });
                }
            } else {
                finalResponse = assistantMsg.content;
                break;
            }
        }

        // 5. ASYNC LOGGING
        if (sessionId) {
            const lastMsg = currentHistory[currentHistory.length - 1];
            const logData = {
                agentId,
                projectId,
                sessionId,
                agentName: agentData.name || 'AI Assistant',
                updatedAt: new Date().toISOString(),
                messages: currentHistory.map(m => ({
                    role: m.role,
                    content: m.content || (m.tool_calls ? "Executed tools" : ""),
                    timestamp: new Date().toISOString()
                })).slice(-50),
                preview: lastMsg.content ? lastMsg.content.substring(0, 100) : "Conversation update"
            };
            db.collection('conversations').doc(sessionId).set(logData, { merge: true }).catch(e => console.error("Logging Error:", e));
        }

        res.json({ success: true, message: finalResponse, history: currentHistory });

    } catch (e) {
        console.error("Public Chat API Error:", e);
        res.status(500).json({ error: e.message });
    }
});


if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
