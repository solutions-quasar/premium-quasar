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
const voiceAuth = require('./voice-auth');


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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- Activity Logging & Correlation Middleware ---
app.use(async (req, res, next) => {
    // Generate Correlation ID
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    // Skip logging for non-API routes or preflights
    if (!req.path.startsWith('/api') || req.method === 'OPTIONS') {
        return next();
    }

    const projectId = req.query.projectId || 'main'; // Default to main if not provided

    // Capture start time
    const start = Date.now();

    // Log after response finishes
    res.on('finish', async () => {
        try {
            const duration = Date.now() - start;
            const logEntry = {
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'API_REQUEST',
                source: 'Server',
                method: req.method,
                path: req.path,
                status: res.statusCode,
                duration: `${duration}ms`,
                requestId: requestId,
                projectId: projectId,
                userId: req.user?.uid || 'anonymous',
                userEmail: req.user?.email || null,
                ip: req.ip
            };

            // Don't log full bodies for security/privacy, but can add filtered metadata if needed
            // Only log errors if status >= 400
            if (res.statusCode >= 400) {
                logEntry.error = true;
            }

            // Persist to logs collection (isolated tenant if specified and not 'main', otherwise system database)
            if (projectId && projectId !== 'main') {
                try {
                    const app = await getApp(projectId);
                    await app.firestore().collection('logs').add(logEntry);
                } catch (e) {
                    await db.collection('logs').add(logEntry);
                }
            } else {
                await db.collection('logs').add(logEntry);
            }
        } catch (err) {
            console.error("[Logger Error]", err.message);
        }
    });

    next();
});

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

// --- NEURAL SEARCH ENDPOINT (OSINT FALLBACK) ---
// This uses Bing + Window-based Context Extraction for maximum reliability
app.get('/api/neural/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ success: false, error: "Query 'q' is required." });

    try {
        const axios = require('axios');
        // Bing is currently more reliable for simple scraping than DDG
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(q)}`;

        console.log(`[Neural Search] Searching Bing: ${q}`);

        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const html = response.data.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
        const cleanText = html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ');

        const results = [];
        // Extract windows around keywords to capture contact info
        const keywords = q.split(' ').filter(w => w.length > 2);

        keywords.forEach(kw => {
            let index = -1;
            while ((index = cleanText.indexOf(kw, index + 1)) !== -1) {
                const start = Math.max(0, index - 250);
                const end = Math.min(cleanText.length, index + 250);
                const window = cleanText.substring(start, end).trim();
                // Avoid redundant overlaps
                if (!results.some(r => r.includes(window.substring(0, 50)))) {
                    results.push(window);
                }
                if (results.length > 15) break;
            }
        });

        res.json({ success: true, results: results.slice(0, 15) });
    } catch (error) {
        console.error("[Neural Search Error]", error.message);
        res.status(500).json({ success: false, error: "Failed to perform search lookup." });
    }
});

// Custom Password Reset Endpoint
app.post('/api/forgot-password', async (req, res) => {
    const { email, lang } = req.body;

    // Note: This endpoint is public so users can reset password without login.
    // However, we should rate limit this in production.

    try {
        if (admin.apps.length === 0) throw new Error("Admin not initialized");

        // Generate Standard Firebase Link (we only need this to get the oobCode)
        const firebaseLink = await admin.auth().generatePasswordResetLink(email);

        // Extract oobCode from the Firebase link
        const urlObj = new URL(firebaseLink);
        const oobCode = urlObj.searchParams.get('oobCode');

        if (!oobCode) throw new Error("Failed to generate secure reset code.");

        // Determine App URL based on origin or default
        const appUrl = req.headers.origin || 'https://quasar-erp-b26d5.web.app';

        // Construct DIRECT LINK to our custom page (Now correctly pointing to the /erp/ subfolder)
        const directLink = `${appUrl}/erp/reset-password.html?oobCode=${oobCode}`;

        const isFr = lang === 'fr';

        // Custom Email Template (Premium Aesthetics)
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { background-color: #0B0D10; color: #F0F2F5; font-family: 'Inter', sans-serif; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 40px auto; background: #15171C; border-radius: 16px; overflow: hidden; border: 1px solid rgba(223,165,58,0.2); box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
                .header { background: #15171C; padding: 40px 30px; text-align: center; border-bottom: 1px solid rgba(223,165,58,0.1); }
                .content { padding: 40px; text-align: center; }
                .btn { display: inline-block; background-color: #DFA53A; color: #000 !important; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; margin-top: 25px; transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 1px; }
                .footer { padding: 30px; text-align: center; color: #555; font-size: 11px; background: #0B0D10; border-top: 1px solid rgba(255,255,255,0.05); }
                .link { color: #DFA53A; word-break: break-all; opacity: 0.7; }
                .neural-text { color: #DFA53A; font-weight: 600; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div style="font-size: 24px; font-weight: 800; color: #DFA53A; letter-spacing: 2px;">SOLUTIONS QUASAR INC.</div>
                    <div style="font-size: 10px; color: #555; margin-top: 5px; text-transform: uppercase;">A.I. Powered Neural ERP</div>
                </div>
                <div class="content">
                    <h2 style="margin-top: 0; font-size: 20px;">${isFr ? "REINITIALISATION DES ACCES" : "SECURE ACCESS RESET"}</h2>
                    <p style="color: #A0A5B0; line-height: 1.6; font-size: 15px;">
                        ${isFr ? "Nous avons reçu une demande de réinitialisation pour votre compte. Veuillez utiliser le lien sécurisé ci-dessous pour définir votre nouvelle clé d'accès." : "We received a request to reset your account credentials. Please use the secure link below to establish your new access key."}
                    </p>
                    
                    <a href="${directLink}" class="btn">${isFr ? "REINITIALISER MAINTENANT" : "RESET PASSWORD NOW"}</a>
                    
                    <p style="margin-top: 40px; font-size: 12px; color: #555;">${isFr ? "Ou copiez manuellement ce lien :" : "Or manually copy this neural link:"}</p>
                    <a href="${directLink}" class="link" style="font-size:10px;">${directLink}</a>
                    
                    <p style="color: #444; font-size: 11px; margin-top: 40px; font-style: italic;">
                        ${isFr ? "Si vous n'êtes pas à l'origine de cette demande, aucune action n'est requise. Ce lien expirera pour votre sécurité." : "If you did not initiate this request, no further action is required. This link will expire for your security."}
                    </p>
                </div>
                <div class="footer">
                    &copy; ${new Date().getFullYear()} Solutions Quasar Inc. <br>
                    <span style="color: #DFA53A;">Premium Operations Unit</span>
                </div>
            </div>
        </body>
        </html>
        `;

        const fromEmail = process.env.EMAIL_FROM || 'info@solutionsquasar.ca';

        if (!resend) throw new Error("Server Email Config Missing (Resend API Key)");

        const data = await resend.emails.send({
            from: 'Solutions Quasar Inc. <' + fromEmail + '>',
            to: [email],
            subject: isFr ? '🔑 Réinitialisation de votre clé d\'accès' : '🔑 Secure Access Key Reset',
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
    const { name, email, phone, company, contact_method, interest, message, sms_consent, lang, _gotcha } = req.body;

    // 1. Strict Client Token Check (Secret Header)
    const clientToken = req.headers['x-quasar-client'];
    if (clientToken !== 'pq-secure-form-v1') {
        console.warn(`Blocked request missing valid client token from IP: ${req.ip}`);
        return res.status(200).json({ success: true }); // Fake success for bots
    }

    // 2. Honeypot Check
    if (_gotcha) {
        return res.status(200).json({ success: true });
    }

    // 3. Spam Content Filter (Cyrillic & Known bots)
    const suspiciousNames = ['RobertTox', 'Eric Jones', 'TalkWithCustomer'];
    const isSuspiciousName = suspiciousNames.some(n => (name || '').toLowerCase().includes(n.toLowerCase()));
    const hasRussianCyrillic = /[А-Яа-яЁё]/.test(message || '') || /[А-Яа-яЁё]/.test(name || '');
    
    if (isSuspiciousName || hasRussianCyrillic) {
        console.warn(`Blocked spam content for name: ${name}`);
        return res.status(200).json({ success: true });
    }

    // Basic validation
    const contactValue = phone || email || contact_method;
    if (!name || !contactValue) {
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
        <p><strong>Email:</strong> ${email || 'N/A'}</p>
        <p><strong>Phone:</strong> ${phone || contact_method || 'N/A'}</p>
        <p><strong>Company:</strong> ${company || 'N/A'}</p>
        <p><strong>SMS Opt-In Consent:</strong> ${sms_consent ? '✅ YES (10DLC Consented)' : '❌ NO'}</p>
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
            const isFr = lang === 'fr';
            const subject = isFr ? 'Nous avons bien reçu votre demande - Solutions Quasar' : 'We received your request - Solutions Quasar';

            const title = isFr ? 'Demande Reçue' : 'Request Received';
            const greeting = isFr ? `Bonjour ${name},` : `Hello ${name},`;
            const p1 = isFr
                ? `Merci d'avoir contacté Solutions Quasar. Nous avons bien reçu votre demande concernant <strong>${interest}</strong>.`
                : `Thank you for reaching out to Solutions Quasar. We have received your inquiry regarding <strong>${interest}</strong>.`;
            const p2 = isFr
                ? `Notre équipe examine chaque demande avec attention. Nous vous recontacterons sous peu pour discuter de la façon dont nous pouvons élever votre présence numérique.`
                : `Our team reviews every request carefully. We will get back to you shortly to discuss how we can elevate your digital presence.`;
            const footer = isFr
                ? `Si vous avez des questions urgentes, n'hésitez pas à répondre directement à cet email.`
                : `If you have any urgent questions, feel free to reply to this email.`;

            const userHtml = `
            <div style="font-family: sans-serif; background-color: #0B0D10; color: #F0F2F5; padding: 40px 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #15171C; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="background-color: #0B0D10; padding: 20px; text-align: center; border-bottom: 2px solid #DFA53A;">
                        <h1 style="color: #DFA53A; margin: 0; font-size: 24px; letter-spacing: 2px;">SOLUTIONS QUASAR</h1>
                    </div>
                    <div style="padding: 30px;">
                        <h2 style="color: #F0C468; margin-top: 0;">${title}</h2>
                        <p>${greeting}</p>
                        <p>${p1}</p>
                        <p>${p2}</p>
                        <br>
                        <p style="color: #A0A5B0; font-size: 14px;">${footer}</p>
                    </div>
                    <div style="background-color: #0B0D10; padding: 15px; text-align: center; color: #555; font-size: 12px;">
                        &copy; ${new Date().getFullYear()} Solutions Quasar Inc.
                    </div>
                </div>
            </div>`;

            try {
                // *** CRITICAL SECURITY FIX ***
                // Auto-responder has been disabled to prevent Open Relay Spam attacks.
                // Bots were using this to send spam to third parties.
                /*
                await resend.emails.send({
                    from: 'Solutions Quasar <' + fromEmail + '>',
                    to: [contact_method],
                    subject: subject,
                    html: userHtml
                });
                */
                console.log(`Auto-confirmation temporarily disabled for security. Suppressed email to ${contact_method}`);
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
                const fallbackSender = 'info@solutionsquasar.ca';

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

// Generic Email Sending Endpoint (Used by Web Demos)
app.post('/api/emails/send', async (req, res) => {
    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
        return res.status(400).json({ success: false, error: "Missing required fields: to, subject, html" });
    }

    if (!resend) {
        return res.status(500).json({ success: false, error: "Email service not configured. Please check server logs." });
    }

    try {
        const fromEmail = process.env.EMAIL_FROM && !process.env.EMAIL_FROM.includes('resend.dev')
            ? process.env.EMAIL_FROM
            : 'info@solutionsquasar.ca';

        const data = await resend.emails.send({
            from: 'AI ERP Demo <' + fromEmail + '>',
            to: [to],
            subject: subject,
            html: html
        });

        if (data.error) throw new Error(data.error.message);

        res.json({ success: true, message: "Email sent successfully." });
    } catch (error) {
        console.error("API Email Send Error:", error);

        // --- SANDBOX FALLBACK ---
        if (error.message && (error.message.includes('only send testing emails') || error.message.includes('verify a domain'))) {
            try {
                const sandboxEmail = 'bensult78@gmail.com';
                const fromEmail = 'info@solutionsquasar.ca';

                console.log(`REDIRECTING API email to sandbox: ${sandboxEmail}`);

                await resend.emails.send({
                    from: 'AI ERP Demo <' + fromEmail + '>',
                    to: [sandboxEmail],
                    subject: `[SANDBOX] ${subject}`,
                    html: `<p><strong>Original Destination:</strong> ${to}</p><hr>${html}`
                });

                return res.json({ success: true, message: "Email sent (Sandbox Mode)." });
            } catch (retryError) {
                console.error('API Email Sandbox Retry Failed:', retryError);
            }
        }

        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/send-email', verifyToken, async (req, res) => {
    const { to, subject, body, attachments } = req.body;

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
        const payload = {
            from: 'Solutions Quasar Inc. <' + fromEmail + '>',
            to: [to],
            subject: subject,
            html: body // Frontend sends full HTML now
        };

        if (attachments && Array.isArray(attachments)) {
            payload.attachments = attachments.map(att => ({
                filename: att.filename,
                content: att.content // Base64 string
            }));
        }

        const data = await resend.emails.send(payload);

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
                const fallbackSender = 'info@solutionsquasar.ca'; // Force safe sender for sandbox

                console.log(`REDIRECTING email to sandbox: ${sandboxEmail} from ${fallbackSender}`);

                const retryData = await resend.emails.send({
                    from: 'Solutions Quasar Inc. <' + fallbackSender + '>',
                    to: [sandboxEmail],
                    subject: `[SANDBOX REDIRECT: ${to}] ${subject}`,
                    html: `<p><strong>Original Recipient:</strong> ${to}</p><hr>${body.replace(/\n/g, '<br>')}`
                });

                if (retryData.error) throw new Error(retryData.error.message);

                return res.json({
                    success: true,
                    message: `Sandbox Mode: Email redirected to ${sandboxEmail} (using info@solutionsquasar.ca)`
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

// --- STRIPE SUBSCRIPTION ENDPOINTS ---

// 1.1 Create Subscription Checkout Session
app.post('/api/subscriptions/create-checkout-session', verifyToken, async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ success: false, error: "Stripe is not configured on the server." });
    }
    const { clientId, clientEmail, clientName, planName, amount, interval, currency, lang } = req.body;
    const prefLang = (lang === 'en') ? 'en' : 'fr';

    if (!clientEmail || !amount || Number(amount) <= 0) {
        return res.status(400).json({ success: false, error: "Missing or invalid clientEmail or amount" });
    }

    try {
        // 1. Find or create Stripe Customer
        let customer;
        const existingCustomers = await stripe.customers.list({ email: clientEmail, limit: 1 });
        if (existingCustomers.data && existingCustomers.data.length > 0) {
            customer = existingCustomers.data[0];
            if (clientName && customer.name !== clientName) {
                await stripe.customers.update(customer.id, { name: clientName });
            }
        } else {
            customer = await stripe.customers.create({
                email: clientEmail,
                name: clientName || 'Client',
                metadata: { clientId: clientId || '', lang: prefLang }
            });
        }

        // 2. Create Checkout Session with mode: 'subscription'
        const validInterval = (interval === 'year' || interval === 'yearly') ? 'year' : 'month';
        const validCurrency = (currency || 'cad').toLowerCase();

        const session = await stripe.checkout.sessions.create({
            customer: customer.id,
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: validCurrency,
                    product_data: {
                        name: planName || 'Monthly Subscription Plan',
                        description: `Recurring subscription for ${clientName || clientEmail}`,
                    },
                    unit_amount: Math.round(Number(amount) * 100), // in cents
                    recurring: {
                        interval: validInterval
                    }
                },
                quantity: 1,
            }],
            mode: 'subscription',
            subscription_data: {
                metadata: {
                    clientId: clientId || '',
                    clientName: clientName || '',
                    clientEmail: clientEmail,
                    planName: planName || 'Monthly Subscription Plan',
                    amount: String(amount),
                    currency: validCurrency,
                    interval: validInterval,
                    lang: prefLang
                }
            },
            success_url: `${SERVER_URL}/erp/payment_success.html?session_id={CHECKOUT_SESSION_ID}&type=subscription`,
            cancel_url: `${SERVER_URL}/erp/index.html#sales?subscription=cancelled`,
            metadata: {
                clientId: clientId || '',
                clientName: clientName || '',
                clientEmail: clientEmail,
                planName: planName || 'Monthly Subscription Plan',
                amount: String(amount),
                currency: validCurrency,
                interval: validInterval,
                type: 'client_subscription',
                lang: prefLang
            }
        });

        // NOTE: Strictly no Firestore document saved per requirement!
        // Stripe is the single source of truth for accurate, up-to-date data.
        res.json({ success: true, url: session.url, sessionId: session.id });
    } catch (error) {
        console.error("Stripe Subscription Session Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 1.2 Get Live Subscriptions Directly from Stripe (Real-time single source of truth)
app.get('/api/subscriptions', verifyToken, async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ success: false, error: "Stripe is not configured on the server." });
    }

    try {
        // Fetch all subscriptions directly from Stripe (active, trialing, past_due, canceled, etc.)
        const stripeSubs = await stripe.subscriptions.list({
            limit: 100,
            status: 'all',
            expand: ['data.customer', 'data.latest_invoice', 'data.items.data.price']
        });

        // Also fetch pending/open checkout sessions with mode 'subscription'
        let openSessions = [];
        try {
            const sessionsRes = await stripe.checkout.sessions.list({
                limit: 50,
                status: 'open'
            });
            openSessions = (sessionsRes.data || []).filter(s => s.mode === 'subscription');
        } catch (err) {
            console.warn("[Subscriptions] Warning fetching open checkout sessions:", err.message);
        }

        const activeOrPastSubs = (stripeSubs.data || []).map(sub => {
            const customer = sub.customer || {};
            const firstItem = sub.items?.data?.[0];
            const price = firstItem?.price;
            const amount = price?.unit_amount ? price.unit_amount / 100 : 0;
            const currency = (price?.currency || 'cad').toUpperCase();
            const interval = price?.recurring?.interval || 'month';
            const planName = sub.metadata?.planName || (price?.product && typeof price.product === 'object' ? price.product.name : null) || 'Subscription Plan';
            const clientName = sub.metadata?.clientName || (typeof customer === 'object' ? (customer.name || customer.email) : 'Client');
            const clientEmail = sub.metadata?.clientEmail || (typeof customer === 'object' ? customer.email : '');
            const clientId = sub.metadata?.clientId || (typeof customer === 'object' ? customer.metadata?.clientId : '');
            const preferredLanguage = sub.metadata?.lang || (typeof customer === 'object' ? customer.metadata?.lang : null) || 'fr';

            return {
                id: sub.id,
                stripeSubscriptionId: sub.id,
                stripeCustomerId: typeof customer === 'string' ? customer : customer.id,
                clientName: clientName || 'Client',
                clientEmail: clientEmail || '',
                clientId: clientId || '',
                planName,
                amount,
                currency,
                interval,
                preferredLanguage,
                status: sub.status, // 'active', 'past_due', 'canceled', 'trialing', 'unpaid', 'incomplete'
                currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
                cancelAtPeriodEnd: sub.cancel_at_period_end || false,
                canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
                createdAt: new Date(sub.created * 1000).toISOString(),
                latestInvoiceUrl: (typeof sub.latest_invoice === 'object' && sub.latest_invoice?.hosted_invoice_url) ? sub.latest_invoice.hosted_invoice_url : null,
                type: 'subscription'
            };
        });

        const pendingSessions = openSessions.map(session => {
            const amount = Number(session.metadata?.amount) || (session.amount_total ? session.amount_total / 100 : 0);
            const currency = (session.metadata?.currency || session.currency || 'cad').toUpperCase();
            const interval = session.metadata?.interval || 'month';
            const planName = session.metadata?.planName || 'Subscription Plan';
            const clientName = session.metadata?.clientName || session.customer_details?.name || 'Pending Client';
            const clientEmail = session.metadata?.clientEmail || session.customer_details?.email || '';
            const clientId = session.metadata?.clientId || '';
            const preferredLanguage = session.metadata?.lang || 'fr';

            return {
                id: session.id,
                stripeCheckoutSessionId: session.id,
                stripeCustomerId: session.customer,
                clientName,
                clientEmail,
                clientId,
                planName,
                amount,
                currency,
                interval,
                preferredLanguage,
                status: 'pending',
                paymentLink: session.url,
                createdAt: new Date(session.created * 1000).toISOString(),
                type: 'checkout_session'
            };
        });

        // Combine: pending checkout links first, then all subscriptions sorted newest to oldest
        const allItems = [...pendingSessions, ...activeOrPastSubs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ success: true, subscriptions: allItems });
    } catch (error) {
        console.error("Live Stripe Subscriptions Fetch Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 1.3 Create Stripe Billing Portal Session (Self-service card update / cancellation)
app.post('/api/subscriptions/portal-session', verifyToken, async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ success: false, error: "Stripe is not configured on the server." });
    }
    const { stripeCustomerId, clientId } = req.body;
    let customerId = stripeCustomerId;

    try {
        if (!customerId && clientId) {
            const clientDoc = await db.collection('clients').doc(clientId).get();
            if (clientDoc.exists) customerId = clientDoc.data().stripeCustomerId;
        }

        if (!customerId) {
            return res.status(400).json({ success: false, error: "No Stripe customer associated with this account." });
        }

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${SERVER_URL}/erp/index.html#sales`
        });

        res.json({ success: true, url: portalSession.url });
    } catch (error) {
        console.error("Billing Portal Session Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 1.4 Cancel Subscription directly in Stripe
app.post('/api/subscriptions/cancel', verifyToken, async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ success: false, error: "Stripe is not configured on the server." });
    }
    const { stripeSubscriptionId, stripeCheckoutSessionId } = req.body;

    if (!stripeSubscriptionId && !stripeCheckoutSessionId) {
        return res.status(400).json({ success: false, error: "Missing stripeSubscriptionId or stripeCheckoutSessionId." });
    }

    try {
        if (stripeSubscriptionId) {
            await stripe.subscriptions.cancel(stripeSubscriptionId);
        } else if (stripeCheckoutSessionId) {
            await stripe.checkout.sessions.expire(stripeCheckoutSessionId);
        }

        res.json({ success: true, message: "Subscription cancelled successfully in Stripe." });
    } catch (error) {
        console.error("Stripe Cancel Error:", error);
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

    // 1. Checkout Session Completed
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const invoiceId = session.metadata ? session.metadata.invoiceId : null;

        // One-time invoice payment
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

        // Recurring Subscription Checkout
        if (session.mode === 'subscription') {
            console.log(`Subscription checkout completed: session=${session.id}, sub=${session.subscription}`);
            const custId = session.customer;
            const clientId = session.metadata?.clientId;

            try {
                if (clientId) {
                    await db.collection('clients').doc(clientId).update({
                        subscriptionStatus: 'Active',
                        stripeCustomerId: custId,
                        updatedAt: new Date().toISOString()
                    });
                }
            } catch (err) {
                console.error("Error updating client on checkout.completed:", err);
            }
        }
    }

    // 2. Recurring Invoice Succeeded (Monthly billing charge)
    else if (event.type === 'invoice.payment_succeeded') {
        const invoice = event.data.object;
        if (invoice.subscription) {
            console.log(`Subscription invoice payment succeeded: ${invoice.id} for sub ${invoice.subscription}`);
            try {
                const existing = await db.collection('invoices')
                    .where('stripeInvoiceId', '==', invoice.id)
                    .limit(1)
                    .get();

                if (existing.empty) {
                    let planName = 'Recurring Subscription';
                    let clientId = '';
                    let clientName = invoice.customer_name || 'Subscriber';
                    let clientEmail = invoice.customer_email || '';

                    try {
                        const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription);
                        if (stripeSub) {
                            if (stripeSub.metadata?.planName) planName = stripeSub.metadata.planName;
                            if (stripeSub.metadata?.clientId) clientId = stripeSub.metadata.clientId;
                            if (stripeSub.metadata?.clientName) clientName = stripeSub.metadata.clientName;
                            if (stripeSub.metadata?.clientEmail) clientEmail = stripeSub.metadata.clientEmail;
                        }
                    } catch (subFetchErr) {
                        console.warn("Could not retrieve subscription details from Stripe:", subFetchErr.message);
                    }

                    await db.collection('invoices').add({
                        number: invoice.number || `INV-SUB-${Date.now().toString().slice(-6)}`,
                        clientId: clientId,
                        clientName: clientName,
                        clientEmail: clientEmail,
                        amount: (invoice.amount_paid || 0) / 100,
                        total: (invoice.amount_paid || 0) / 100,
                        status: 'Paid',
                        type: 'Subscription',
                        planName: planName,
                        date: new Date().toISOString().split('T')[0],
                        paidAt: new Date().toISOString(),
                        stripeInvoiceId: invoice.id,
                        stripeSubscriptionId: invoice.subscription,
                        hostedInvoiceUrl: invoice.hosted_invoice_url || null,
                        createdAt: new Date().toISOString()
                    });
                }
            } catch (err) {
                console.error("Error handling invoice.payment_succeeded:", err);
            }
        }
    }

    // 3. Recurring Invoice Failed
    else if (event.type === 'invoice.payment_failed') {
        const invoice = event.data.object;
        if (invoice.subscription) {
            console.warn(`Subscription invoice payment failed: ${invoice.id} for sub ${invoice.subscription}`);
        }
    }

    // 4. Subscription Updated
    else if (event.type === 'customer.subscription.updated') {
        const sub = event.data.object;
        console.log(`Subscription updated in Stripe: ${sub.id}, status: ${sub.status}`);
        if (sub.metadata?.clientId) {
            try {
                await db.collection('clients').doc(sub.metadata.clientId).update({
                    subscriptionStatus: sub.status === 'active' ? 'Active' : (sub.status === 'past_due' ? 'Past Due' : (sub.status === 'canceled' ? 'Canceled' : sub.status)),
                    updatedAt: new Date().toISOString()
                });
            } catch (err) {
                console.error("Error updating client subscriptionStatus on updated:", err);
            }
        }
    }

    // 5. Subscription Deleted / Canceled
    else if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object;
        console.log(`Subscription terminated in Stripe: ${sub.id}`);
        if (sub.metadata?.clientId) {
            try {
                await db.collection('clients').doc(sub.metadata.clientId).update({
                    subscriptionStatus: 'Canceled',
                    updatedAt: new Date().toISOString()
                });
            } catch (err) {
                console.error("Error updating client subscriptionStatus on deleted:", err);
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
    const { projectId = 'master_admin', redirectUri, returnTo } = req.query;
    try {
        const host = req.get('host') || 'localhost:5000';
        const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
        const resolvedRedirectUri = redirectUri || (isLocal 
            ? `http://${host}/api/integrations/google/callback`
            : `${SERVER_URL}/api/integrations/google/callback`);

        const statePayload = JSON.stringify({
            projectId: projectId || 'master_admin',
            returnTo: returnTo || null,
            redirectUri: resolvedRedirectUri
        });
        const stateEncoded = Buffer.from(statePayload).toString('base64url');

        const url = googleAuth.getAuthUrl(stateEncoded, resolvedRedirectUri);
        res.json({ success: true, url, redirectUri: resolvedRedirectUri });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/integrations/google/status', async (req, res) => {
    try {
        const status = await googleAuth.isGoogleConnected();
        res.json({ success: true, ...status });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/integrations/google/events', async (req, res) => {
    try {
        const { projectId = 'master_admin', timeMin, timeMax } = req.query;
        const calendar = await googleAuth.getCalendar(projectId);
        
        const now = new Date();
        const start = timeMin || new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
        const end = timeMax || new Date(now.getTime() + 90 * 24 * 3600 * 1000).toISOString();

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: start,
            timeMax: end,
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 250
        });

        // Fetch matching Firestore appointments for bidirectional reconciliation
        let apptMap = new Map();
        try {
            const apptsSnap = await db.collection('appointments').where('status', 'in', ['confirmed', 'scheduled']).get();
            apptsSnap.forEach(doc => {
                const data = doc.data();
                if (data.google_event_id) {
                    apptMap.set(data.google_event_id, { id: doc.id, ...data, ref: doc.ref });
                }
            });
        } catch (_) {}

        const items = (response.data.items || []).map(item => {
            const hasTime = !!item.start?.dateTime;
            const isQuasar = (item.summary || '').toLowerCase().includes('quasar') || (item.summary || '').toLowerCase().includes('rdv');
            
            // Reconcile with Firestore if an appointment matches this Google Calendar event
            let linkedAppt = apptMap.get(item.id) || null;
            if (linkedAppt && item.start?.dateTime) {
                const gStart = new Date(item.start.dateTime).getTime();
                const fStart = new Date(linkedAppt.appointmentTime).getTime();
                // If event was moved on phone (Google Calendar), sync to Firestore immediately
                if (gStart !== fStart) {
                    calendarReminderService.rescheduleAppointment(linkedAppt.id, item.start.dateTime, {
                        notes: item.description || linkedAppt.notes,
                        prospectName: linkedAppt.prospectName
                    }).catch(err => console.warn('[Calendar Sync Note]', err.message));
                }
            }

            return {
                id: item.id,
                title: item.summary || '(Sans titre)',
                start: item.start?.dateTime || item.start?.date,
                end: item.end?.dateTime || item.end?.date,
                allDay: !hasTime,
                color: isQuasar ? '#DFAB3A' : '#3B82F6',
                textColor: '#FFFFFF',
                extendedProps: {
                    isGoogle: true,
                    googleEventId: item.id,
                    description: item.description || '',
                    location: item.location || '',
                    htmlLink: item.htmlLink || null,
                    meetLink: item.hangoutLink || item.conferenceData?.entryPoints?.[0]?.uri || null,
                    appointmentId: linkedAppt?.id || null,
                    prospectPhone: linkedAppt?.prospectPhone || null,
                    prospectName: linkedAppt?.prospectName || null,
                    remindersActive: !!(linkedAppt?.reminders && Object.values(linkedAppt.reminders).some(r => r.status === 'pending')),
                    reminders: linkedAppt?.reminders || null
                }
            };
        });

        res.json({ success: true, events: items });
    } catch (e) {
        res.json({ success: false, events: [], error: e.message });
    }
});

app.post('/api/integrations/google/sync-event', async (req, res) => {
    try {
        const { event } = req.body;
        if (!event || !event.start) return res.status(400).json({ success: false, error: 'Event start is required' });
        
        const calendar = await googleAuth.getCalendar('master_admin');
        const start = event.start;
        const end = event.end || new Date(new Date(start).getTime() + 45 * 60 * 1000).toISOString();

        const inserted = await calendar.events.insert({
            calendarId: 'primary',
            conferenceDataVersion: 1,
            requestBody: {
                summary: event.title,
                description: event.description || `Créé depuis Solutions Quasar ERP.\nService: ${event.service || 'Non spécifié'}\nTéléphone: ${event.phone || ''}\nMeet: ${event.meetLink || ''}`,
                start: { dateTime: new Date(start).toISOString(), timeZone: 'America/Moncton' },
                end: { dateTime: new Date(end).toISOString(), timeZone: 'America/Moncton' },
                conferenceData: {
                    createRequest: {
                        requestId: `qsr-ev-${Date.now()}`,
                        conferenceSolutionKey: { type: 'hangoutsMeet' }
                    }
                }
            }
        });

        res.json({ 
            success: true, 
            googleEventId: inserted.data.id, 
            meetLink: inserted.data.hangoutLink || null 
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.patch('/api/integrations/google/events/:id', async (req, res) => {
    try {
        const calendar = await googleAuth.getCalendar('master_admin');
        const { start, end, title, summary, description, phone, prospectPhone } = req.body;
        const patchBody = {};
        if (title || summary) patchBody.summary = title || summary;
        if (description !== undefined) patchBody.description = description;
        if (start) patchBody.start = { dateTime: new Date(start).toISOString(), timeZone: 'America/Moncton' };
        if (end) patchBody.end = { dateTime: new Date(end).toISOString(), timeZone: 'America/Moncton' };

        const updated = await calendar.events.patch({
            calendarId: 'primary',
            eventId: req.params.id,
            requestBody: patchBody
        });

        // Also update / reschedule matching Firestore appointment if it exists
        try {
            const apptsSnap = await db.collection('appointments').where('google_event_id', '==', req.params.id).get();
            const contactPhone = phone || prospectPhone;
            for (const doc of apptsSnap.docs) {
                if (start) {
                    await calendarReminderService.rescheduleAppointment(doc.id, new Date(start).toISOString(), {
                        notes: patchBody.description,
                        prospectName: patchBody.summary?.replace(/^RDV (Solutions Quasar|Découverte)( - )?/i, ''),
                        prospectPhone: contactPhone || undefined
                    });
                } else {
                    const updateData = {};
                    if (patchBody.summary) updateData.title = patchBody.summary;
                    if (patchBody.description !== undefined) updateData.notes = patchBody.description;
                    if (contactPhone) updateData.prospectPhone = contactPhone;
                    await doc.ref.update(updateData);
                }
            }
        } catch (_) {}

        res.json({ success: true, event: updated.data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/appointments/schedule', async (req, res) => {
    try {
        const result = await calendarReminderService.scheduleAppointment(req.body);
        res.json(result);
    } catch (e) {
        console.error('[Schedule Appointment Error]', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/integrations/google/events/:id', async (req, res) => {
    try {
        const eventId = req.params.id;
        const calendar = await googleAuth.getCalendar('master_admin');
        try {
            await calendar.events.delete({
                calendarId: 'primary',
                eventId: eventId
            });
        } catch (gErr) {
            // If already deleted in Google (404/410), proceed with Firestore cleanup gracefully
            if (gErr.code !== 404 && gErr.code !== 410 && gErr.status !== 404 && gErr.status !== 410) {
                throw gErr;
            }
        }

        // Also cancel matching appointments in Firestore and deactivate their reminders
        try {
            const apptsSnap = await db.collection('appointments').where('google_event_id', '==', eventId).get();
            for (const doc of apptsSnap.docs) {
                await calendarReminderService.cancelAppointment(doc.id, 'deleted_from_erp_calendar');
            }
        } catch (_) {}

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/calendar/settings', async (req, res) => {
    try {
        const settings = await calendarReminderService.getBookingSettings();
        res.json({ success: true, settings });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/calendar/settings', async (req, res) => {
    try {
        const saved = await calendarReminderService.saveBookingSettings(req.body);
        res.json({ success: true, settings: saved });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/integrations/google/disconnect', verifyToken, async (req, res) => {
    try {
        await googleAuth.disconnectGoogle();
        res.json({ success: true, message: "Google Calendar disconnected." });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/integrations/google/callback', async (req, res) => {
    const { code, state } = req.query;
    try {
        let projectId = 'master_admin';
        let returnTo = null;
        let redirectUri = null;

        if (state) {
            try {
                const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
                projectId = decoded.projectId || 'master_admin';
                returnTo = decoded.returnTo || null;
                redirectUri = decoded.redirectUri || null;
            } catch (_) {
                projectId = state;
            }
        }

        const host = req.get('host') || 'localhost:5000';
        const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
        const fallbackRedirectUri = isLocal 
            ? `http://${host}/api/integrations/google/callback`
            : `${SERVER_URL}/api/integrations/google/callback`;

        const tokens = await googleAuth.getTokensFromCode(code, redirectUri || fallbackRedirectUri);
        let googleEmail = null;
        try {
            const client = googleAuth.getOAuthClient(redirectUri || fallbackRedirectUri);
            client.setCredentials(tokens);
            const { google } = require('googleapis');
            const oauth2 = google.oauth2({ version: 'v2', auth: client });
            const userinfo = await oauth2.userinfo.get();
            googleEmail = userinfo.data?.email || null;
        } catch (_) {}

        if (projectId === 'master_admin' || !projectId) {
            await db.collection('settings').doc('google_calendar_config').set({
                connected: true,
                googleTokens: tokens,
                googleEmail,
                connectedAt: new Date().toISOString()
            }, { merge: true });

            const targetUrl = returnTo || `${SERVER_URL}/erp/index.html#calendar`;
            const finalRedirect = targetUrl.includes('?') ? `${targetUrl}&google=connected` : `${targetUrl}?google=connected`;
            res.redirect(finalRedirect);
        } else {
            await db.collection('ai_projects').doc(projectId).update({
                googleTokens: tokens,
                googleEmail,
                googleConnectedAt: new Date().toISOString()
            });
            const targetUrl = returnTo || `${SERVER_URL}/portal.html?pid=${projectId}`;
            const finalRedirect = targetUrl.includes('?') ? `${targetUrl}&google=connected` : `${targetUrl}?google=connected`;
            res.redirect(finalRedirect);
        }
    } catch (e) {
        console.error("Google Callback Error:", e);
        res.status(500).send("Failed to connect Google account: " + e.message);
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
    const { email, lang } = req.body;

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
        const inviteLink = `${PROD_URL}/portal.html?invite=${token}`;
        const isFr = lang === 'fr';

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
                    <h2 style="margin-top: 0; font-size: 20px;">${isFr ? "Bienvenue sur votre portail" : "Welcome to your Portal"}</h2>
                    <p style="color: #94a3b8; line-height: 1.6;">${isFr ? `Vous avez été invité à gérer vos agents IA pour <strong>${projectName}</strong>.` : `You have been invited to manage your AI workforce for <strong>${projectName}</strong>.`}</p>
                    <p style="color: #94a3b8;">${isFr ? "Cliquez sur le bouton ci-dessous pour sécuriser votre compte et définir votre mot de passe." : "Click the button below to secure your account and set your password."}</p>
                    
                    <a href="${inviteLink}" class="btn">${isFr ? "Configurer mon portail" : "Setup My Portal"}</a>
                    
                    <p style="margin-top: 30px; font-size: 12px; color: #555;">${isFr ? "Ce lien d'invitation expire dans 48 heures." : "This invitation link expires in 48 hours."}</p>
                </div>
                <div class="footer">
                    &copy; ${new Date().getFullYear()} Solutions Quasar Inc. ${isFr ? "Tous droits réservés." : ""}
                </div>
            </div>
        </body>
        </html>
        `;

        const fromEmail = process.env.EMAIL_FROM || 'info@solutionsquasar.ca';
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

// 3. Update Agent (Sync tools/prompt to Vapi & preserve config)
app.patch('/api/vapi/update-agent/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { name, prompt, model, tools: selectedTools, projectId } = req.body;
    const apiKey = process.env.VAPI_PRIVATE_KEY;

    if (!apiKey) return res.status(500).json({ success: false, error: 'VAPI_PRIVATE_KEY not configured.' });
    if (!projectId) return res.status(400).json({ success: false, error: 'projectId is required.' });

    try {
        // 0. Fetch existing assistant to preserve Widget Customizer config
        let existingModel = { provider: "openai", model: model || "gpt-3.5-turbo", messages: [] };
        try {
            const existingRes = await axios.get(`https://api.vapi.ai/assistant/${id}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (existingRes.data && existingRes.data.model) {
                existingModel = existingRes.data.model;
            }
        } catch (e) {
            console.warn("Could not fetch existing assistant config, proceeding with defaults.", e.message);
        }

        // 1. Get Isolated DB & Discover Dynamic Tools
        const appInstance = await getApp(projectId);
        const db = appInstance.firestore();
        const dynamicToolsList = await discoverSchema(db);

        // 2. Merge Static + Dynamic Tools
        const allPotentialTools = [...tools, ...dynamicToolsList];

        // 3. Filter Enabled Tools
        const functionsToEnable = [];
        let pinEnabled = false;
        if (selectedTools) {
            allPotentialTools.forEach(t => {
                const name = t.function.name;
                // Enable if explicitly true OR if missing (default true)
                if (selectedTools[name] !== false) {
                    functionsToEnable.push(t);
                    if (name === 'verify_voice_pin') pinEnabled = true;
                }
            });
        }

        // 4. Update System Prompt & Enforce Security Instructions
        let adjustedPrompt = prompt;
        if (pinEnabled && !adjustedPrompt.includes('verify_voice_pin')) {
            adjustedPrompt += "\n\nCRITICAL SECURITY RULE: You MUST verify the caller's identity using the `verify_voice_pin` tool BEFORE performing any sensitive operations (like accessing private data, changing settings, or booking appointments on their behalf). Simply ask the caller for their PIN if it hasn't been verified yet.";
        }

        let newMessages = existingModel.messages || [];
        const sysMsgIndex = newMessages.findIndex(m => m.role === 'system');
        if (sysMsgIndex >= 0) {
            newMessages[sysMsgIndex].content = adjustedPrompt;
        } else {
            newMessages.unshift({ role: "system", content: adjustedPrompt });
        }

        // Determine Base URL
        const callbackUrl = `${SERVER_URL}/api/vapi/callback?projectId=${projectId}`;

        // Construct Update Payload
        const updatePayload = {
            name: name,
            model: {
                ...existingModel, // Preserve provider, model, etc.
                messages: newMessages,
                tools: functionsToEnable.length > 0 ? functionsToEnable : undefined
            },
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

// 3b. Update Agent Config (Sync Widget Customizer to Vapi)
app.patch('/api/vapi/update-agent-config/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { name, provider, model, firstMessageMode, firstMessage } = req.body;
    const apiKey = process.env.VAPI_PRIVATE_KEY;

    if (!apiKey) return res.status(500).json({ success: false, error: 'VAPI_PRIVATE_KEY not configured.' });

    try {
        // Fetch existing assistant to preserve tools and system prompt
        let existingModel = { provider: "openai", model: "gpt-3.5-turbo", messages: [] };
        try {
            const existingRes = await axios.get(`https://api.vapi.ai/assistant/${id}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (existingRes.data && existingRes.data.model) {
                existingModel = existingRes.data.model;
            }
        } catch (e) {
            console.warn("Could not fetch existing assistant config.", e.message);
        }

        // Construct Update Payload
        const updatePayload = {
            name: name,
            firstMessageMode: firstMessageMode,
            firstMessage: firstMessage,
            model: {
                ...existingModel, // Preserve tools, messages
                provider: provider || existingModel.provider,
                model: model || existingModel.model
            }
        };

        const response = await axios.patch(`https://api.vapi.ai/assistant/${id}`, updatePayload, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        res.json({ success: true, data: response.data });

    } catch (error) {
        console.error("Vapi Config Update Error:", error.response?.data || error.message);
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
        const projectId = req.query.projectId || req.body?.projectId || 'master_admin';

        // --- 0. BULLETPROOF SECURITY: Vapi Secret Check ---
        const vapiSecret = req.headers['x-vapi-secret'];
        if (process.env.VAPI_SECRET && vapiSecret !== process.env.VAPI_SECRET) {
            console.warn(`[Security Check] BLOCKED: Missing or invalid X-Vapi-Secret from Project ${projectId}`);
            return res.status(401).json({ error: "Unauthorized. Invalid handshake." });
        }

        console.log(`[Vapi Webhook] Project: ${projectId} - Event: ${payload.message?.type || 'unknown'}`);

        // --- 1. PRE-CALL SECURITY CHECK (Assistant Request) ---
        // Vapi sends 'assistant-request' before starting the call.
        if (payload.message?.type === 'assistant-request') {
            const callerNumber = payload.message?.call?.customer?.number || payload.call?.customer?.number || payload.customer?.number || payload.call?.customerNumber;
            const auth = await voiceAuth.verifyCaller(callerNumber, projectId);

            if (!auth.authorized) {
                // If caller is not an internal team member, check if there is an active public concierge agent
                const publicAgentsSnap = await db.collection('ai_agents')
                    .where('projectId', '==', projectId)
                    .where('active', '==', true)
                    .limit(1)
                    .get();

                if (!publicAgentsSnap.empty && publicAgentsSnap.docs[0].data().vapiAssistantId) {
                    const pubId = publicAgentsSnap.docs[0].data().vapiAssistantId;
                    console.log(`[Vapi Security] Public caller ${callerNumber} routed to public agent: ${pubId}`);
                    return res.json({ assistantId: pubId });
                }

                console.warn(`[Vapi Security] Blocking incoming call from ${callerNumber}: ${auth.reason}`);
                // Return a "Hanging Up" assistant configuration
                return res.json({
                    assistant: {
                        name: "Security Guard",
                        model: {
                            provider: "openai",
                            model: "gpt-4o-mini",
                            messages: [{ role: "system", content: "Hang up immediately." }]
                        },
                        firstMessage: "Désolé, votre numéro n'est pas autorisé à contacter cet agent. Accès refusé.",
                        endCallOnAssistantGreetingPossible: true,
                        voice: { provider: "11labs", voiceId: "burt" }
                    }
                });
            }
            // If authorized, we MUST tell Vapi which assistant to connect to, 
            // since the phone number no longer has a hardcoded assistant attached.
            try {
                // Find the active voice agent for this project in the CENTRAL management database
                const agentsSnapshot = await db.collection('ai_agents')
                    .where('projectId', '==', projectId)
                    .where('active', '==', true)
                    .limit(1)
                    .get();

                if (!agentsSnapshot.empty) {
                    const agentData = agentsSnapshot.docs[0].data();
                    if (agentData.vapiAssistantId) {
                        console.log(`[Vapi Routing] Connecting call to Assistant: ${agentData.vapiAssistantId}`);
                        return res.json({
                            assistantId: agentData.vapiAssistantId
                        });
                    }
                }

                // Fallback: If no specific active agent is found, try to find ANY agent for this project with a Vapi ID.
                const anyAgentSnapshot = await db.collection('ai_agents')
                    .where('projectId', '==', projectId)
                    .limit(5)
                    .get();

                if (!anyAgentSnapshot.empty) {
                    // Loop to find the first one that has a Vapi ID
                    for (const adoc of anyAgentSnapshot.docs) {
                        const fallbackData = adoc.data();
                        if (fallbackData.vapiAssistantId) {
                            console.log(`[Vapi Routing] Connecting call to Assistant: ${fallbackData.vapiAssistantId}`);
                            return res.json({
                                assistantId: fallbackData.vapiAssistantId
                            });
                        }
                    }
                }
                console.warn(`[Vapi Routing] No Vapi Assistant ID found for project ${projectId}. Call will likely fail.`);
                return res.status(500).json({ error: "No voice assistant configured for this project." });

            } catch (dbError) {
                console.error(`[Vapi Routing] Error fetching assistant ID:`, dbError);
                return res.status(500).json({ error: "Internal error routing the call." });
            }
        }

        // --- 2. TOOL CALL SECURITY (Secondary Check) ---

        // Handle Function Calls
        // Vapi sends: { message: { type: "tool-calls", toolCalls: [...] } }
        let toolCalls = payload.toolCalls;
        if (!toolCalls && payload.message && payload.message.toolCalls) {
            toolCalls = payload.message.toolCalls;
        }

        if (toolCalls) {
            console.log(`Processing ${toolCalls.length} tool calls for ${projectId}...`);
            const results = [];

            // Extract Caller Phone Number from Vapi Payload (Robust multi-path)
            const callerNumber = payload.message?.call?.customer?.number || payload.call?.customer?.number || payload.customer?.number || payload.call?.customerNumber;
            if (callerNumber) console.log(`[Vapi] Detected Caller ID for tool call: ${callerNumber}`);

            for (const call of toolCalls) {
                const fnName = call.function.name;
                let args = call.function.arguments;
                if (typeof args === 'string') args = JSON.parse(args);

                // Inject Caller Number for verification tools
                if (fnName === 'verify_voice_pin') {
                    args.phoneNumber = callerNumber;
                }

                // --- STRICT SECURITY CHECK ---
                // Public tools (calendar booking, free slots, call notes) do not require internal team voice auth
                const publicTools = ['get_available_slots', 'book_appointment', 'send_call_note_sms'];
                if (!publicTools.includes(fnName)) {
                    const authStatus = await voiceAuth.verifyCaller(callerNumber, projectId);
                    if (!authStatus.authorized) {
                        console.error(`[Security] Tool call blocked mid-conversation: ${fnName} - Reason: ${authStatus.reason}`);
                        results.push({
                            toolCallId: call.id,
                            result: JSON.stringify({ error: "Access Denied. Your identity could not be verified." })
                        });
                        continue;
                    }
                }

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
                        result = await handlers[fnName](args, projectId, req.requestId);
                    } else {
                        // Try dynamic handler (handles create_*, search_*, update_*, send_email_*)
                        result = await dynamicHandler(fnName, args, projectId, {
                            resend,
                            requestId: req.requestId
                        });
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

        // --- 3. END OF CALL REPORT & AUTOMATIC SMS SUMMARY ---
        if (payload.message?.type === 'end-of-call-report') {
            const summary = payload.message.summary || payload.message.analysis?.summary || '';
            const callerNumber = payload.message?.call?.customer?.number || payload.call?.customer?.number || payload.customer?.number || 'Numéro masqué';
            const endedReason = payload.message?.endedReason || payload.message?.call?.endedReason || '';

            console.log(`[Vapi End-of-Call] Caller: ${callerNumber}, Reason: ${endedReason}`);

            if (summary || endedReason === 'customer-ended-call' || endedReason === 'assistant-ended-call') {
                try {
                    const smsSequenceService = require('./sms-sequence-service');
                    const seqSettings = await smsSequenceService.getSequenceSettings();
                    if (seqSettings.adminAlertsEnabled === false || seqSettings.notifyOnVapiCall === false) {
                        console.log('[Vapi End-of-Call] Admin SMS alerts disabled or notifyOnVapiCall is off. Skipping SMS.');
                        return res.json({ success: true, processed: 'end-of-call-report' });
                    }

                    if (seqSettings.adminAlertsEnabled !== false && seqSettings.notifyOnVapiCall !== false) {
                        const twilioService = require('./twilio-service');
                        const targetPhone = seqSettings.adminAlertPhone || process.env.ADMIN_PHONE || '+15062337006';
                        const cleanSummary = summary ? summary.slice(0, 450) : 'Appel vocal terminé.';
                        const smsBody = `📞 [Quasar Voice]\nAppel avec ${callerNumber}\nRésumé : ${cleanSummary}`;

                        await twilioService.sendSms({
                            to: targetPhone,
                            message: smsBody,
                            allowLandline: true
                        });
                        console.log(`[Vapi End-of-Call] Notification SMS sent to ${targetPhone}`);
                    }

                    // Dispatch Email alert if enabled
                    if (seqSettings.adminEmailAlertsEnabled !== false && seqSettings.adminAlertEmail && seqSettings.notifyOnVapiCall !== false) {
                        try {
                            const emailAlertService = require('./email-alert-service');
                            const cleanSummary = summary ? summary.slice(0, 450) : 'Appel vocal terminé.';
                            await emailAlertService.sendAdminAlertEmail({
                                to: seqSettings.adminAlertEmail,
                                subject: `📞 Résumé d'Appel Vocal : ${callerNumber}`,
                                title: `Appel Vocal Terminé avec ${callerNumber}`,
                                badgeText: 'Assistant Vapi',
                                badgeColor: '#38BDF8',
                                details: [
                                    { label: 'Numéro Appelant', value: callerNumber },
                                    { label: 'Motif de fin', value: endedReason || 'Appel complété' },
                                    { label: 'Date & Heure', value: new Date().toLocaleString('fr-CA', { timeZone: 'America/Moncton' }) }
                                ],
                                snippet: cleanSummary,
                                ctaUrl: 'https://quasar-erp-b26d5.web.app/#coldcall',
                                ctaText: 'Consulter dans le Journal Vocal'
                            });
                        } catch (emailErr) {
                            console.error('[Vapi End-of-Call] Failed to send notification Email:', emailErr.message);
                        }
                    }
                } catch (vapiErr) {
                    console.error('[Vapi End-of-Call] Notification error:', vapiErr.message);
                }
            }
            return res.json({ success: true, processed: 'end-of-call-report' });
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

// Update Project Settings (Generic)
app.post('/api/projects/:id/settings', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const settings = req.body;

        console.log(`Updating settings for Project ${id}:`, Object.keys(settings));

        await db.collection('ai_projects').doc(id).update({
            ...settings,
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true, message: "Project settings updated." });
    } catch (e) {
        console.error("Settings Update Error:", e);
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

// Get Project Logs for AI Agent Window
app.get('/api/projects/:id/logs', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const appInstance = await getApp(id);
        const dbInstance = appInstance.firestore();

        const snapshot = await dbInstance.collection('logs')
            .orderBy('timestamp', 'desc')
            .limit(50)
            .get();

        const logs = [];
        snapshot.forEach(doc => {
            logs.push({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp ? doc.data().timestamp.toDate().toISOString() : new Date().toISOString()
            });
        });

        res.json({ success: true, count: logs.length, logs });
    } catch (e) {
        console.error("Fetch Logs Error:", e);
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
        const dynamicTools = await discoverSchema(db);
        const { tools: staticTools } = require('./vapi-tools');

        // 3. Return combined tool definitions
        res.json({ success: true, tools: [...staticTools, ...dynamicTools] });

    } catch (e) {
        console.error("Discovery Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/tools/test', verifyToken, async (req, res) => {
    try {
        const { toolName, args, projectId } = req.body;
        console.log(`[Test Request] toolName: ${toolName}, projectId: ${projectId}`);

        if (!handlers[toolName]) {
            console.warn(`[Test Error] Unknown Tool: ${toolName}. Available tools: ${Object.keys(handlers).join(', ')}`);
            return res.status(400).json({ error: "Unknown Tool", available: Object.keys(handlers) });
        }
        if (!projectId) return res.status(400).json({ error: "Missing Project ID" });

        console.log(`[Test] Running ${toolName} for ${projectId}`);
        const result = await handlers[toolName](args, projectId);

        res.json({ success: true, result });

    } catch (e) {
        console.error("Tool Execution Error:", e);
        res.status(500).json({ error: e.message });
    }
});


// --- CHAT INTERFACE (PHASE 3) ---
app.post('/api/chat', verifyToken, async (req, res) => {
    try {
        const { projectId, agentId, messages, sessionId } = req.body;
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

        // 3. Smart Context Injection: Fetch Relevant Memories
        const lastUserMsg = messages[messages.length - 1]?.content || "";
        let contextKnowledge = "";

        if (lastUserMsg) {
            try {
                const memoryResults = await handlers.search_memories({ query: lastUserMsg }, projectId);
                if (memoryResults.success && memoryResults.memories.length > 0) {
                    contextKnowledge = "\n\nRELEVANT DISCOVERED MEMORIES:\n" +
                        memoryResults.memories.map(m => `- ${m.text}`).join('\n');
                    console.log(`[Chat] Injected ${memoryResults.memories.length} memories into prompt.`);
                }
            } catch (memErr) {
                console.warn("Memory lookup failed for chat prompt:", memErr.message);
            }
        }

        // 3b. Prepare Messages
        const systemPrompt = (agentData.prompt || "You are a helpful assistant.") + contextKnowledge;
        const systemMessage = { role: "system", content: systemPrompt };

        // Load existing session history if requested and not provided in full
        let sessionHistory = messages;
        if (sessionId && messages.length <= 1) {
            const sessionDoc = await db.collection('conversations').doc(sessionId).get();
            if (sessionDoc.exists) {
                const data = sessionDoc.data();
                if (data.messages) {
                    const rawHistory = data.messages.slice(-15);
                    const cleanedHistory = [];
                    for (let i = 0; i < rawHistory.length; i++) {
                        const m = rawHistory[i];
                        if (m.role === 'tool') {
                            const prev = cleanedHistory[cleanedHistory.length - 1];
                            if (!prev || prev.role !== 'assistant' || !prev.tool_calls) {
                                console.warn(`[History] Skipping orphaned tool message at index ${i}`);
                                continue;
                            }
                        }
                        cleanedHistory.push(m);
                    }
                    sessionHistory = [...cleanedHistory, ...messages];
                }
            }
        }

        const fullHistory = [systemMessage, ...sessionHistory];

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

            const assistantMsgSource = completion.choices[0].message;
            // Convert to Plain Object to ensure getters/non-enumerable structures like tool_calls serialize perfectly to Firestore
            const assistantMsg = {
                role: "assistant",
                content: assistantMsgSource.content || null
            };
            if (assistantMsgSource.tool_calls) {
                assistantMsg.tool_calls = assistantMsgSource.tool_calls;
            }
            currentHistory.push(assistantMsg);

            if (assistantMsg.tool_calls) {
                console.log(`[Chat] Executing ${assistantMsg.tool_calls.length} tools...`);

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
                                result = await dynamicHandler(fnName, fnArgs, projectId, { resend });
                            }
                        }
                    } catch (err) {
                        result = { error: err.message };
                    }

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

        // 5. Save History & Return
        if (sessionId) {
            const chatToSave = currentHistory.filter(m => m.role !== 'system');
            const preview = finalResponse ? finalResponse.substring(0, 100) : "Tool interaction";

            await db.collection('conversations').doc(sessionId).set({
                agentId,
                projectId,
                agentName: agentData.name || 'AI Agent',
                updatedAt: new Date().toISOString(),
                messages: chatToSave.slice(-50), // Keep last 50
                preview
            }, { merge: true });
        }

        res.json({ success: true, message: finalResponse, history: currentHistory });

    } catch (e) {
        console.error("Chat API Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- PUBLIC AGENT CONFIG ENDPOINT ---
app.get('/api/public/agent/:agentId/config', async (req, res) => {
    try {
        const { agentId } = req.params;
        const agentDoc = await db.collection('ai_agents').doc(agentId).get();
        if (!agentDoc.exists) return res.status(404).json({ error: "Agent not found" });

        const data = agentDoc.data();
        res.json({
            success: true,
            config: {
                title: data.name || data.welcomeMessage || 'AI Assistant',
                primaryColor: data.color || '#dfa53a',
                welcomeMsg: data.welcomeMessage || data.firstMessage || 'Hello!',
                toggleIcon: data.toggleIcon || 'chat',
                vapiId: data.vapiAssistantId || null
            }
        });
    } catch (e) {
        console.error("Public Config Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- PUBLIC HISTORY ENDPOINT ---
app.get('/api/public/chat/history/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const sessionDoc = await db.collection('conversations').doc(sessionId).get();

        if (!sessionDoc.exists) {
            return res.json({ success: true, messages: [] });
        }

        const data = sessionDoc.data();
        // Return last 10 messages for context
        const history = (data.messages || []).slice(-10).filter(m => m.role !== 'system');
        res.json({ success: true, messages: history });
    } catch (e) {
        console.error("Public History Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- AI CHAT HELPER (SHARED) ---
async function processAiChat({ agentId, messages, sessionId, clientContext = "" }) {
    if (!agentId || !messages) throw new Error("Missing required fields");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Server OpenAI Key not configured");

    const openai = new OpenAI({ apiKey });

    // 1. Get Agent Config from MAIN DB
    const agentDoc = await db.collection('ai_agents').doc(agentId).get();
    if (!agentDoc.exists) throw new Error("Agent not found");
    const agentData = agentDoc.data();

    // Support nested fields inside knowledgeBase map (fallback to root if needed)
    const projectId = agentData.knowledgeBase?.projectId || agentData.projectId;
    const agentModel = agentData.knowledgeBase?.model || agentData.model || "gpt-4o-mini";

    // 2. Get Project DB (Tenant) & Discover Dynamic Tools
    const appInstance = await getApp(projectId);
    const tenantDb = appInstance.firestore();
    const dynamicTools = await discoverSchema(tenantDb);
    const availableTools = [...tools, ...dynamicTools];

    // 3. Prepare Messages
    const lastUserMsg = messages[messages.length - 1]?.content || "";
    let contextKnowledge = "";

    if (lastUserMsg) {
        try {
            const memoryResults = await handlers.search_memories({ query: lastUserMsg }, projectId);
            if (memoryResults.success && memoryResults.memories.length > 0) {
                contextKnowledge = "\n\nRELEVANT DISCOVERED MEMORIES:\n" +
                    memoryResults.memories.map(m => `- ${m.text}`).join('\n');
                console.log(`[processAiChat] Injected ${memoryResults.memories.length} memories for Agent ${agentId}.`);
            }
        } catch (memErr) {
            console.warn("Memory lookup failed for processAiChat:", memErr.message);
        }
    }


    let basePrompt = agentData.knowledgeBase?.prompt || agentData.prompt || "You are a helpful assistant.";

    // Replace context variables if defined in dashboard layouts
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    basePrompt = basePrompt.replace('{{CURRENT_DATE}}', dateStr);
    basePrompt = basePrompt.replace('{{CURRENT_TIME}}', timeStr);

    const systemPrompt = basePrompt +
        contextKnowledge +
        (clientContext || "") +
        `\n\n[SYSTEM INFO]\n- Today's Date: ${dateStr}\n- Current Time: ${timeStr}\n- Note: Use this date for any tool calls you run!`;
    const systemMessage = { role: "system", content: systemPrompt };

    // Load existing session history if requested and not provided in full
    let sessionHistory = messages;
    if (sessionId && messages.length <= 1) {
        const sessionDoc = await db.collection('conversations').doc(sessionId).get();
        if (sessionDoc.exists) {
            const data = sessionDoc.data();
            if (data.messages) {
                const validHistory = data.messages.filter(m => {
                    if (m.role === 'tool' && !m.tool_call_id) return false;
                    return true;
                });

                // --- REPAIR DANGLING TOOL CALLS ---
                const repairedHistory = [];
                for (let i = 0; i < validHistory.length; i++) {
                    const msg = validHistory[i];
                    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
                        let allReplied = true;
                        for (let j = 1; j <= msg.tool_calls.length; j++) {
                            const nextMsg = validHistory[i + j];
                            if (!nextMsg || nextMsg.role !== 'tool') { allReplied = false; break; }
                        }
                        if (!allReplied) {
                            console.log(`[processAiChat] Pruning unanswered assistant tool_calls at index ${i}`);
                            continue;
                        }
                    }
                    if (msg.role === 'tool') {
                        const prevMsg = repairedHistory[repairedHistory.length - 1];
                        if (!prevMsg || prevMsg.role !== 'assistant' || !prevMsg.tool_calls) {
                            console.log(`[processAiChat] Pruning stray tool response at index ${i}`);
                            continue;
                        }
                    }
                    repairedHistory.push(msg);
                }

                let slicedHistory = repairedHistory.slice(-10);
                while (slicedHistory.length > 0 && slicedHistory[0].role === 'tool') {
                    console.log(`[processAiChat] Pruning leading orphaned tool message in sliced history`);
                    slicedHistory.shift();
                }
                sessionHistory = [...slicedHistory, ...messages];
            }
        }
    }

    const fullHistory = [systemMessage, ...sessionHistory];


    // 4. OpenAI Loop (Handle Tool Calls)
    let currentHistory = fullHistory;
    let finalResponse = null;
    let loops = 0;

    while (loops < 5) {
        loops++;
        const completion = await openai.chat.completions.create({
            model: agentModel,
            messages: currentHistory,
            tools: availableTools.length > 0 ? availableTools : undefined,
            tool_choice: "auto"
        });

        const assistantMsg = completion.choices[0].message;
        currentHistory.push(assistantMsg);

        if (assistantMsg.tool_calls) {
            console.log(`[processAiChat] Agent ${agentId} executing ${assistantMsg.tool_calls.length} tools...`);
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
                            result = await dynamicHandler(fnName, fnArgs, projectId, { resend });
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
            agentName: agentData.knowledgeBase?.name || agentData.name || 'AI Assistant',
            updatedAt: new Date().toISOString(),
            messages: currentHistory.map(m => ({
                role: m.role,
                content: m.content || (m.tool_calls ? "Executed tools" : ""),
                tool_calls: m.tool_calls || null,
                tool_call_id: m.tool_call_id || null,
                timestamp: m.timestamp || new Date().toISOString()
            })).slice(-50),
            preview: lastMsg.content ? lastMsg.content.substring(0, 100) : "Conversation update"
        };
        db.collection('conversations').doc(sessionId).set(logData, { merge: true }).catch(e => console.error("Logging Error:", e));
    }

    return { message: finalResponse, history: currentHistory };
}

// Helper to lookup agentId by Meta IDs
async function lookupAgentByPage(pageId) {
    try {
        const idStr = String(pageId);
        // Also support numbers if Meta sent it unquoted
        const idNum = isNaN(Number(pageId)) ? null : Number(pageId);
        const lookups = [idStr];
        if (idNum !== null) lookups.push(idNum);

        let snapshot = await db.collection('ai_agents')
            .where('facebookPageId', 'in', lookups)
            .limit(1)
            .get();

        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            return {
                id: snapshot.docs[0].id,
                projectId: data.knowledgeBase?.projectId || data.projectId || 'main',
                facebookAccessToken: data.facebookAccessToken,
                instagramAccessToken: data.instagramAccessToken
            };
        }

        snapshot = await db.collection('ai_agents')
            .where('instagramAccountId', 'in', lookups)
            .limit(1)
            .get();

        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            return {
                id: snapshot.docs[0].id,
                projectId: data.knowledgeBase?.projectId || data.projectId || 'main',
                facebookAccessToken: data.facebookAccessToken,
                instagramAccessToken: data.instagramAccessToken
            };
        }

        return null;
    } catch (e) {
        console.error("Error in lookupAgentByPage:", e);
        return null;
    }
}

// Helper to send message back to Meta
async function sendMetaMessage(senderId, textOrAction, source = 'facebook', tokenOverride = null) {
    const axios = require('axios'); // Ensure axios is loaded
    const token = tokenOverride || (source === 'instagram' ? process.env.INSTAGRAM_ACCESS_TOKEN : process.env.META_PAGE_ACCESS_TOKEN);

    if (!token) {
        console.warn(`[Meta API] No token available for ${source}. Cannot send ${textOrAction}. Check environment variables or Agent configuration.`);
        return;
    }

    const payload = { recipient: { id: senderId } };

    // Support Meta sender actions (typing_on, typing_off, mark_seen)
    if (typeof textOrAction === 'string' && (textOrAction === 'typing_on' || textOrAction === 'typing_off' || textOrAction === 'mark_seen')) {
        payload.sender_action = textOrAction;
    } else {
        payload.message = { text: textOrAction };
    }

    try {
        console.log(`[Meta API] Attempting to send ${textOrAction === 'typing_on' ? 'typing' : textOrAction} to ${senderId} via ${source}...`);
        const res = await axios.post(`https://graph.facebook.com/v21.0/me/messages?access_token=${token}`, payload);
        console.log(`[Meta API] Success: HTTP ${res.status} for ${textOrAction}`);
    } catch (err) {
        const errDetails = err.response?.data?.error || err.message;
        console.error(`[Meta API] CRITICAL FAILURE sending ${textOrAction}:`, JSON.stringify(errDetails));
        throw err;
    }
}

// --- DEBUG LOG VIEW ENDPOINT ---
app.get('/api/debug/logs', async (req, res) => {
    try {
        const snapshot = await db.collection('debug_webhooks').orderBy('timestamp', 'desc').limit(10).get();
        const logs = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            logs.push({
                id: doc.id,
                object: data.object,
                timestamp: data.timestamp ? data.timestamp.toDate() : null,
                body: data.body
            });
        });
        res.json({ success: true, logs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- PUBLIC CHAT ENDPOINT (PHASE 4) ---
// No verifyToken here so it can be called from external websites
app.post('/api/public/chat/:agentId', async (req, res) => {
    try {
        const { agentId } = req.params;
        const { messages, sessionId } = req.body;

        const result = await processAiChat({ agentId, messages, sessionId });
        res.json({ success: true, ...result });

    } catch (e) {
        console.error("Public Chat API Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- META WEBHOOK (FACEBOOK & INSTAGRAM) ---

// Verification
app.get('/api/webhook/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === process.env.META_VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }
    res.status(403).end();
});

// Event Handler
// Helper to log dense meta webhook traffic
async function logMetaWebhookEvent(projectId, action, data, status = 'Success', message = null) {
    try {
        const { getApp } = require('./firebase-manager');
        const { admin } = require('./firebase-admin');
        const app = await getApp(projectId);
        await app.firestore().collection('logs').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'META_WEBHOOK',
            source: 'Meta',
            action: action,
            projectId: projectId,
            data: data,
            result: status,
            message: message
        });
    } catch (err) {
        console.error("[Meta Logger Error]", err.message);
    }
}

async function getFacebookUserProfile(senderId, source = 'facebook', tokenOverride = null) {
    const token = tokenOverride || (source === 'instagram' ? process.env.INSTAGRAM_ACCESS_TOKEN : process.env.META_PAGE_ACCESS_TOKEN);
    if (!token) return null;
    try {
        const fields = source === 'instagram' ? 'name,profile_pic' : 'first_name,last_name,profile_pic';
        const url = `https://graph.facebook.com/v19.0/${senderId}?fields=${fields}&access_token=${token}`;
        const response = await fetch(url);
        const data = await response.json();
        return data;
    } catch (e) {
        console.error("[FB Profile] Error fetching profile for " + senderId + ":", e);
        return null;
    }
}

app.post('/api/webhook/meta', async (req, res) => {
    try {
        const body = req.body;
        console.log(`[Meta Webhook] Received webhook payload:`, JSON.stringify(body));

        // Let's force-log to the default database for diagnostics so I can read it
        try {
            await db.collection('debug_webhooks').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                object: body.object,
                body: body
            });
        } catch (e) {
            console.error("Debug webhook log failed:", e.message);
        }

        if (body.object !== 'page' && body.object !== 'instagram') {
            return res.sendStatus(404);
        }

        const messagingEvent = body.entry?.[0]?.messaging?.[0];
        if (messagingEvent && messagingEvent.message && !messagingEvent.message.is_echo) {
            const senderId = messagingEvent.sender.id;
            const messageText = messagingEvent.message.text;
            const pageId = body.entry?.[0]?.id; // Recipient Page ID
            const source = body.object === 'instagram' ? 'instagram' : 'facebook';

            console.log(`[Meta Webhook] ${source.toUpperCase()} Message from ${senderId} on Page ${pageId}: ${messageText}`);

            if (!messageText) {
                return res.sendStatus(200); // Ignore non-text messages for now
            }

            // 1. Lookup Agent ID & Project ID
            const agentInfo = await lookupAgentByPage(pageId);
            const agentId = agentInfo?.id;
            const projectId = agentInfo?.projectId || 'main';

            await logMetaWebhookEvent(projectId, 'Webhook Received', { senderId, pageId, message: messageText });

            if (!agentId) {
                console.warn(`[Meta Webhook] No agent linked to Page/Account ID ${pageId}`);
                await logMetaWebhookEvent(projectId, 'Agent Match Failed', { pageId }, 'Error', `No agent linked to Page ${pageId}`);
                return res.sendStatus(200);
            }

            // 2. Process via AI
            let clientContext = "";
            let limit = 50;

            try {
                const appInstance = await getApp(projectId);
                const tenantDb = appInstance.firestore();
                const messageId = messagingEvent.message.mid;

                // --- 1. ATOMIC DEDUPLICATION ---
                // Meta retries if AI takes > 20s. We use 'mid' to process ONLY the first attempt.
                if (messageId) {
                    try {
                        await tenantDb.collection('webhook_events').doc(messageId).create({
                            timestamp: new Date().toISOString(),
                            senderId,
                            source,
                            text: messageText
                        });
                        console.log(`[Meta Webhook] Processing new message ${messageId}`);

                        // --- 2. START TYPING ANIMATION (AWAITED) ---
                        // We await these to ensure Cloud Function doesn't freeze before sending.
                        const metaToken = source === 'instagram' ? agentInfo.instagramAccessToken : agentInfo.facebookAccessToken;
                        await sendMetaMessage(senderId, 'mark_seen', source, metaToken).catch(e => console.error("[Mark Seen Error]", e.message));

                        // Small delay to ensure state propagates in Meta's servers
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        await sendMetaMessage(senderId, 'typing_on', source, metaToken).catch(e => console.error("[Typing Animation Error]", e.message));

                    } catch (dupErr) {
                        if (dupErr.code === 6) { // 6 = ALREADY_EXISTS (gRPC/Firestore)
                            console.log(`[Meta Webhook] Duplicate message ${messageId} ignored.`);
                            return res.sendStatus(200);
                        }
                        console.warn(`[Meta Webhook] Dedup check error for ${messageId}:`, dupErr.message);
                    }
                }

                // --- FLOOD PROTECTION LIMITS ---
                try {
                    const agentDoc = await tenantDb.collection('ai_agents').doc(agentId).get();
                    const agentData = agentDoc.data() || {};
                    limit = agentData.maxMessagesPerDay !== undefined ? parseInt(agentData.maxMessagesPerDay) : 50;

                    const todayStr = new Date().toISOString().split('T')[0];
                    const usageId = `${senderId}_${agentId}_${todayStr}`;
                    const usageRef = tenantDb.collection('agent_usage').doc(usageId);

                    const usageDoc = await usageRef.get();
                    const currentCount = usageDoc.exists ? (usageDoc.data().count || 0) : 0;

                    if (currentCount >= limit) {
                        console.log(`[Meta Webhook] Rate-limited sender ${senderId} (Limit crossed: ${limit})`);
                        await logMetaWebhookEvent(projectId, 'Rate Limited', { senderId, limit });
                        return res.sendStatus(200);
                    }

                    await usageRef.set({ count: currentCount + 1, last_time: new Date().toISOString() }, { merge: true });

                    // --- ITEMISED AUDIT LOG FOR BILLING ---
                    await tenantDb.collection('agent_billing_logs').add({
                        senderId,
                        agentId,
                        projectId,
                        message: messageText,
                        timestamp: new Date().toISOString(),
                        cost: agentData.pricing?.pricePerMessage !== undefined ? parseFloat(agentData.pricing.pricePerMessage) : 0.05,
                        type: 'incoming_chat',
                        source: source
                    });

                    console.log(`[Meta Webhook] Allowed message ${currentCount + 1}/${limit} for ${senderId}`);

                } catch (limitErr) {
                    console.warn("[Meta Webhook] Daily limit lookup failed:", limitErr.message);
                }

                const clientSnap = await tenantDb.collection('clients').where('facebookPsid', '==', senderId).get();
                if (!clientSnap.empty) {
                    const cl = clientSnap.docs[0].data();
                    clientContext = `\n\n[CLIENT INFO]\n- Name: ${cl.name || cl.displayName}\n- Email: ${cl.email || "N/A"}\n- Status: Existing Customer`;
                    console.log(`[Meta Webhook] Matched sender ${senderId} to Existing Client: ${cl.name || cl.displayName}`);
                } else {
                    const fbProfile = await getFacebookUserProfile(senderId, source, source === 'instagram' ? agentInfo.instagramAccessToken : agentInfo.facebookAccessToken);
                    if (fbProfile && (fbProfile.first_name || fbProfile.name)) {
                        const fullName = source === 'instagram' ? fbProfile.name : `${fbProfile.first_name} ${fbProfile.last_name}`;
                        clientContext = `\n\n[CLIENT INFO]\n- Name: ${fullName}\n- Status: New Connection (${source === 'instagram' ? 'Instagram' : 'Facebook'})`;
                        console.log(`[Meta Webhook] Fetched Profile for ${senderId}: ${fullName}`);
                    }
                }
            } catch (err) {
                console.warn("[Meta Webhook] Client context lookup failed:", err.message);
            }

            await logMetaWebhookEvent(projectId, 'Processing AI', { agentId, text: messageText, clientContext });

            // --- 2. START TYPING ANIMATION (HEARTBEAT) ---
            const metaToken = source === 'instagram' ? agentInfo.instagramAccessToken : agentInfo.facebookAccessToken;
            await sendMetaMessage(senderId, 'mark_seen', source, metaToken).catch(e => console.error("[Mark Seen Error]", e.message));

            // Heartbeat to keep typing active every 4s (Meta auto-clears it after ~20s)
            const heartbeat = setInterval(() => {
                sendMetaMessage(senderId, 'typing_on', source, metaToken).catch(e => {
                    console.warn("[Typing Heartbeat Error]", e.message);
                    clearInterval(heartbeat);
                });
            }, 4000);

            // First one immediately
            await sendMetaMessage(senderId, 'typing_on', source, metaToken).catch(e => console.error("[Initial Typing Error]", e.message));

            const aiRes = await processAiChat({
                agentId,
                messages: [{ role: 'user', content: messageText }],
                sessionId: `meta_${senderId}`,
                clientContext: clientContext
            });

            // STOP Heartbeat before sending message
            clearInterval(heartbeat);

            // 3. Send Reply
            if (aiRes.message) {
                await logMetaWebhookEvent(projectId, 'Sending Reply to Meta', { senderId, reply: aiRes.message });
                try {
                    await sendMetaMessage(senderId, aiRes.message, source, source === 'instagram' ? agentInfo.instagramAccessToken : agentInfo.facebookAccessToken);
                    console.log(`[Meta Webhook] Replied to ${senderId}`);
                    await logMetaWebhookEvent(projectId, 'Reply Sent', { senderId });
                } catch (sendError) {
                    console.error("[Meta Send Error]", sendError);
                    await logMetaWebhookEvent(projectId, 'Reply Sent Failed', { senderId }, 'Error', sendError.message);
                    throw sendError;
                }
            } else {
                await logMetaWebhookEvent(projectId, 'AI Empty Response', { aiRes }, 'Warning', 'AI chatbot returned no content message');
            }
        }

        res.sendStatus(200);

    } catch (e) {
        console.error("Meta Webhook Error:", e);
        await logMetaWebhookEvent('main', 'Webhook Crash', { error: e.message }, 'Error', e.stack);
        res.sendStatus(500);
    }
});

// --- TWILIO AI SMS OUTREACH & CONVERSATIONAL WEBHOOK ---
const twilioService = require('./twilio-service');

// 0. Get SMS AI Config (Prompt & Documentation)
app.get('/api/sms/config', verifyToken, async (req, res) => {
    try {
        const config = await twilioService.getSmsAiConfig();
        res.json({ success: true, config });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Update SMS AI Config (Prompt & Documentation & Typing Simulation)
app.post('/api/sms/config', verifyToken, async (req, res) => {
    try {
        const { systemPrompt, outboundPrompt, knowledgeDocumentation, model, temperature, typingSimulationEnabled, minTypingDelaySeconds, maxTypingDelaySeconds } = req.body;
        const saved = await twilioService.saveSmsAiConfig({
            systemPrompt,
            outboundPrompt,
            knowledgeDocumentation,
            model,
            temperature,
            typingSimulationEnabled,
            minTypingDelaySeconds,
            maxTypingDelaySeconds
        });
        res.json({ success: true, config: saved, message: "Configuration SMS IA sauvegardée avec succès !" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// AI Meta-Prompt Optimizer (Refine & enhance prompts autonomously)
app.post('/api/ai/optimize-prompt', verifyToken, async (req, res) => {
    try {
        const { currentPrompt, promptType, userInstruction } = req.body;
        if (!currentPrompt || typeof currentPrompt !== 'string' || !currentPrompt.trim()) {
            return res.status(400).json({ success: false, error: "currentPrompt is required" });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ success: false, error: "Clé OPENAI_API_KEY manquante sur le serveur." });
        }

        const openaiClient = new OpenAI({ apiKey });

        const promptDescriptions = {
            audit: "Agent d'Audit IA (analyse le commerce, vérifie le site web et assigne la séquence appropriée)",
            sms_conversation: "Agent Conversationnel SMS IA (dialogue avec le prospect par SMS, répond aux questions et réserve des rendez-vous)",
            sms_outbound: "Générateur d'accroches SMS (SMS percutant < 160 caractères, identification Solutions Quasar, mention légale STOP)",
            documentation: "Base de connaissances d'entreprise pour les réponses de l'IA par SMS"
        };

        const targetDescription = promptDescriptions[promptType] || "Agent IA commercial Solutions Quasar";

        const systemInstruction = `Tu es un expert en ingénierie de prompts pour agents IA commerciaux (Prospection commerciale, Audit IA et Conversation SMS).
Ton rôle est de réécrire, structurer et décupler la performance du prompt système qui t'est soumis.

CONTEXTE DU PROMPT :
${targetDescription}

CRITÈRES D'OPTIMISATION :
1. Clarté & Rôle : Définis avec autorité l'identité, la mission et le périmètre exact de l'agent.
2. Directives Négatives & Anti-Hallucination : Formule des règles d'interdiction strictes (ce que l'agent ne doit JAMAIS faire).
3. Concision & Punch : Élimine le verbiage inutile, utilise des sections claires et numérotées.
4. Préservation intégrale des variables et balises : Conserve ABSOLUMENT toutes les variables dynamiques (ex: {{name}}, {{company}}, {{city}}, {{industry}}, etc.) et les noms d'outils/fonctions (ex: get_available_slots, book_appointment).
5. Prise en compte de la demande de l'utilisateur : Si l'utilisateur a fourni une instruction spécifique, applique-la en priorité absolue.

FORMAT DE SORTIE OBLIGATOIRE :
Renvoie UNIQUEMENT le texte du prompt optimisé, prêt à l'emploi. Aucun texte d'introduction, aucun commentaire préliminaire, aucune conclusion.`;

        const userMessage = `VOICI LE PROMPT ACTUEL À AMÉLIORER :
"""
${currentPrompt}
"""

INSTRUCTION SPÉCIFIQUE DE L'UTILISATEUR :
${userInstruction && userInstruction.trim() ? userInstruction.trim() : "Optimise ce prompt pour une clarté maximale, une rigueur exemplaire, l'élimination des hallucinations et un taux de conversion maximal."}`;

        const completion = await openaiClient.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: userMessage }
            ],
            temperature: 0.3
        });

        const optimizedPrompt = completion.choices[0]?.message?.content?.trim() || currentPrompt;

        res.json({
            success: true,
            optimizedPrompt,
            message: "Prompt optimisé avec succès par l'IA !"
        });
    } catch (e) {
        console.error("[Optimize Prompt Error]", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 1. Generate AI Outreach SMS Draft
app.post('/api/sms/generate-outreach', verifyToken, async (req, res) => {
    try {
        const { name, company, language, angle, customPrompt } = req.body;
        const text = await twilioService.generateAiOutreachSms({
            name,
            company,
            language: language || 'fr',
            angle: angle || 'audit',
            customPrompt
        });
        res.json({ success: true, text });
    } catch (e) {
        console.error("[SMS Outreach Generator Error]", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 2. Send SMS Outreach to Lead or Client
app.post('/api/sms/send-outreach', verifyToken, async (req, res) => {
    try {
        const { to, message, leadId, clientId, name, company } = req.body;
        if (!to || !message) {
            return res.status(400).json({ success: false, error: "Missing 'to' or 'message'" });
        }

        const result = await twilioService.sendSms({ to, message });

        const normalizedPhone = twilioService.normalizePhone(to);
        const sessionId = `sms_${normalizedPhone.replace('+', '')}`;

        // Initialize or update conversation thread in Firestore
        const sessionRef = db.collection('conversations').doc(sessionId);
        const sessionDoc = await sessionRef.get();
        let history = [];
        if (sessionDoc.exists) {
            history = sessionDoc.data().messages || [];
        }
        history.push({
            role: "assistant",
            content: message.trim(),
            timestamp: new Date().toISOString()
        });

        await sessionRef.set({
            sessionId,
            channel: 'sms',
            phoneNumber: normalizedPhone,
            clientName: name || null,
            companyName: company || null,
            leadId: leadId || null,
            clientId: clientId || null,
            updatedAt: new Date().toISOString(),
            messages: history.slice(-20)
        }, { merge: true });

        // Update Lead status if linked
        if (leadId) {
            try {
                await db.collection('crm_leads').doc(leadId).update({
                    status: 'Contacted',
                    smsStatus: 'Sent',
                    lastSmsSent: new Date().toISOString()
                });
            } catch (leadErr) {
                console.warn("[SMS Outreach] Lead update notice:", leadErr.message);
            }
        }

        res.json({ success: true, ...result });

    } catch (e) {
        console.error("[SMS Outreach Send Error]", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Phone Carrier & Line Type Validation (Telnyx Lookup + Firestore Cache)
const phoneValidatorService = require('./phone-validator-service');

app.post('/api/phone/validate', verifyToken, async (req, res) => {
    try {
        const { phone, leadId } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, error: "Le numéro de téléphone est requis." });
        }
        let leadData = null;
        if (leadId) {
            let leadSnap = await db.collection('crm_leads').doc(leadId).get();
            if (!leadSnap.exists) {
                leadSnap = await db.collection('leads').doc(leadId).get();
            }
            if (leadSnap.exists) {
                leadData = { id: leadId, ...leadSnap.data() };
            }
        }
        const result = await phoneValidatorService.validatePhoneNumber(phone, leadData || { id: leadId });
        if (leadId && result.phone_type) {
            let targetRef = db.collection('crm_leads').doc(leadId);
            let s = await targetRef.get();
            if (!s.exists) targetRef = db.collection('leads').doc(leadId);
            await targetRef.set({
                phone_type: result.phone_type,
                carrier_name: result.carrier_name || null,
                sms_eligible: result.sms_eligible,
                recommended_channel: result.recommended_channel || (result.sms_eligible ? 'sms' : 'call'),
                phone_validated_at: result.checked_at || new Date().toISOString()
            }, { merge: true });
        }
        res.json({ success: true, result });
    } catch (e) {
        console.error("[Phone Validate Error]", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 3. List SMS Conversations
app.get('/api/sms/conversations', verifyToken, async (req, res) => {
    try {
        const snap = await db.collection('conversations')
            .where('channel', '==', 'sms')
            .get();

        let list = [];
        snap.forEach(doc => {
            const data = doc.data();
            const msgs = data.messages || [];
            const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
            list.push({
                id: doc.id,
                phoneNumber: data.phoneNumber || '',
                clientName: data.clientName || '',
                companyName: data.companyName || '',
                leadId: data.leadId || null,
                clientId: data.clientId || null,
                aiEnabled: data.aiEnabled !== false, // default true
                unread: data.unread || false,
                updatedAt: data.updatedAt || (lastMsg ? lastMsg.timestamp : new Date().toISOString()),
                messageCount: msgs.length,
                lastMessage: lastMsg ? {
                    role: lastMsg.role,
                    content: lastMsg.content,
                    timestamp: lastMsg.timestamp,
                    author: lastMsg.author || (lastMsg.role === 'assistant' ? 'ai' : 'user')
                } : null
            });
        });

        // Sort descending by updatedAt
        list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

        res.json({ success: true, conversations: list });
    } catch (e) {
        console.error("[SMS Conversations List Error]", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 4. Get Single SMS Conversation with Thread
app.get('/api/sms/conversations/:id', verifyToken, async (req, res) => {
    try {
        const docRef = db.collection('conversations').doc(req.params.id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            return res.status(404).json({ success: false, error: "Conversation SMS introuvable" });
        }
        const data = docSnap.data();

        // Mark as read
        if (data.unread) {
            await docRef.update({ unread: false }).catch(() => {});
        }

        res.json({
            success: true,
            conversation: {
                id: docSnap.id,
                ...data,
                unread: false,
                aiEnabled: data.aiEnabled !== false
            }
        });
    } catch (e) {
        console.error("[SMS Conversation Detail Error]", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 5. Send Manual Agent Reply to SMS Thread
app.post('/api/sms/conversations/:id/reply', verifyToken, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, error: "Le message ne peut pas être vide" });
        }

        const docRef = db.collection('conversations').doc(req.params.id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            return res.status(404).json({ success: false, error: "Conversation introuvable" });
        }

        const conv = docSnap.data();
        const targetPhone = conv.phoneNumber;
        if (!targetPhone) {
            return res.status(400).json({ success: false, error: "Numéro de téléphone manquant pour cette conversation." });
        }

        // Send SMS via Twilio from official company number
        const sendRes = await twilioService.sendSms({ to: targetPhone, message: message.trim() });

        // Append to messages array
        const history = conv.messages || [];
        const senderName = req.user?.name || req.user?.email || 'Agent Solutions Quasar';
        const newMsg = {
            role: 'assistant',
            author: 'human',
            senderName,
            content: message.trim(),
            timestamp: new Date().toISOString()
        };
        history.push(newMsg);

        await docRef.update({
            messages: history.slice(-50),
            updatedAt: new Date().toISOString(),
            unread: false
        });

        // Also update lead if linked
        if (conv.leadId) {
            try {
                await db.collection('crm_leads').doc(conv.leadId).update({
                    lastSmsSent: new Date().toISOString(),
                    lastContactDate: new Date().toISOString()
                });
            } catch (_) {}
        }

        res.json({ success: true, message: newMsg, twilioSid: sendRes.messageSid });
    } catch (e) {
        console.error("[SMS Reply Error]", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 6. Toggle AI Autonomous Mode (Human Takeover)
app.patch('/api/sms/conversations/:id/toggle-ai', verifyToken, async (req, res) => {
    try {
        const { aiEnabled } = req.body;
        const targetState = Boolean(aiEnabled);
        const docRef = db.collection('conversations').doc(req.params.id);
        await docRef.update({
            aiEnabled: targetState,
            updatedAt: new Date().toISOString()
        });
        res.json({ success: true, aiEnabled: targetState });
    } catch (e) {
        console.error("[SMS Toggle AI Error]", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 7. Suggest AI Reply Draft for Human Agent
app.post('/api/sms/conversations/:id/suggest-reply', verifyToken, async (req, res) => {
    try {
        const { customPrompt } = req.body || {};
        const suggestion = await twilioService.suggestReply({
            conversationId: req.params.id,
            customPrompt
        });
        res.json({ success: true, suggestion });
    } catch (e) {
        console.error("[SMS Suggest Reply Error]", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 8. Start New SMS Conversation (Ad-hoc SMS)
app.post('/api/sms/conversations/start', verifyToken, async (req, res) => {
    try {
        const { to, message, clientName, companyName, leadId, clientId } = req.body;
        if (!to || !message) {
            return res.status(400).json({ success: false, error: "Numéro de téléphone ('to') et message requis" });
        }

        const normalizedPhone = twilioService.normalizePhone(to);
        const sessionId = `sms_${normalizedPhone.replace('+', '')}`;

        const sendRes = await twilioService.sendSms({ to: normalizedPhone, message: message.trim() });

        const sessionRef = db.collection('conversations').doc(sessionId);
        const sessionDoc = await sessionRef.get();
        let history = [];
        if (sessionDoc.exists) {
            history = sessionDoc.data().messages || [];
        }

        const senderName = req.user?.name || req.user?.email || 'Agent Solutions Quasar';
        const newMsg = {
            role: 'assistant',
            author: 'human',
            senderName,
            content: message.trim(),
            timestamp: new Date().toISOString()
        };
        history.push(newMsg);

        await sessionRef.set({
            sessionId,
            channel: 'sms',
            phoneNumber: normalizedPhone,
            clientName: clientName || null,
            companyName: companyName || null,
            leadId: leadId || null,
            clientId: clientId || null,
            aiEnabled: true,
            unread: false,
            updatedAt: new Date().toISOString(),
            messages: history.slice(-50)
        }, { merge: true });

        res.json({ success: true, sessionId, message: newMsg, twilioSid: sendRes.messageSid });
    } catch (e) {
        console.error("[SMS Start Conversation Error]", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 9. Twilio Incoming SMS Webhook
app.post('/api/webhook/twilio/sms', async (req, res) => {
    try {
        const { From, Body, MessageSid } = req.body;
        if (!From || !Body) {
            return res.status(400).send("Missing From or Body");
        }

        const aiReply = await twilioService.handleIncomingSms({ from: From, body: Body, messageSid: MessageSid });

        // TwiML Response format: If AI is disabled or returned null, send empty <Response/>
        const twiml = aiReply 
            ? `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n    <Message>${aiReply}</Message>\n</Response>`
            : `<?xml version="1.0" encoding="UTF-8"?>\n<Response/>`;

        res.type('text/xml').send(twiml);

    } catch (e) {
        console.error("[Twilio Webhook Error]", e);
        const incomingText = req.body?.Body || req.body?.body || '';
        const incomingPhone = req.body?.From || req.body?.from || '';
        const isEnErr = twilioService.detectMessageLanguage(incomingText, [], twilioService.isPhoneFrancophone(incomingPhone) ? 'fr' : 'en') === 'en';
        const fallbackMsg = isEnErr
            ? "Solutions Quasar Inc.: Thank you for your message. Our team will get back to you shortly."
            : "Solutions Quasar Inc. : Merci pour votre message. Notre equipe vous repondra rapidement.";
        res.status(500).type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${fallbackMsg}</Message>
</Response>`);
    }
});

// 9b. Telnyx / Unified Inbound SMS Webhook
async function handleTelnyxOrUnifiedInboundSms(req, res) {
    try {
        console.log('[Inbound SMS Webhook] Received payload:', JSON.stringify(req.body).slice(0, 300));

        let fromPhone = '';
        let messageText = '';
        let messageId = '';
        let isTelnyx = false;

        // A. Telnyx API v2 Webhook
        if (req.body?.data?.event_type === 'message.received') {
            isTelnyx = true;
            const payload = req.body.data.payload;
            fromPhone = payload?.from?.phone_number || '';
            messageText = payload?.text || '';
            messageId = payload?.id || req.body.data.id || `telnyx_${Date.now()}`;
        } 
        // B. Standard / Twilio Form-Encoded or JSON
        else {
            fromPhone = req.body.From || req.body.from || '';
            messageText = req.body.Body || req.body.body || req.body.text || '';
            messageId = req.body.MessageSid || req.body.messageSid || req.body.id || `sms_${Date.now()}`;
        }

        if (!fromPhone || !messageText) {
            return res.status(200).json({ received: true, note: 'Ignored: No from or text' });
        }

        console.log(`[Inbound SMS Webhook] (${isTelnyx ? 'Telnyx' : 'Twilio'}) From: ${fromPhone} | Body: "${messageText}"`);

        // Process incoming SMS in conversation thread & trigger AI response if enabled
        const aiReply = await twilioService.handleIncomingSms({
            from: fromPhone,
            body: messageText,
            messageSid: messageId
        });

        // If Telnyx webhook and AI replied, dispatch reply via sendSms
        if (isTelnyx) {
            if (aiReply) {
                try {
                    await twilioService.sendSms({
                        to: fromPhone,
                        message: aiReply,
                        forceProvider: 'telnyx',
                        allowLandline: true
                    });
                } catch (replyErr) {
                    console.error('[Telnyx Inbound Auto-Reply Error]', replyErr.message);
                }
            }
            return res.status(200).json({ received: true, replied: Boolean(aiReply) });
        }

        // If Twilio: send TwiML
        const twiml = aiReply 
            ? `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n    <Message>${aiReply}</Message>\n</Response>`
            : `<?xml version="1.0" encoding="UTF-8"?>\n<Response/>`;

        res.type('text/xml').send(twiml);

    } catch (e) {
        console.error("[Inbound SMS Webhook Error]", e);
        res.status(200).json({ received: true, error: e.message });
    }
}

app.post('/api/sms/inbound', handleTelnyxOrUnifiedInboundSms);
app.post('/api/webhook/telnyx/sms', handleTelnyxOrUnifiedInboundSms);

// --- SMS SEQUENCES & TIMEZONE AUTOMATION ENGINE ---
const smsSequenceService = require('./sms-sequence-service');

// 1. Get Sequence Settings (Dry-Run, Admin Phone, etc.)
app.get('/api/sequences/settings', verifyToken, async (req, res) => {
    try {
        const settings = await smsSequenceService.getSequenceSettings();
        res.json({ success: true, settings });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Update Sequence Settings
app.post('/api/sequences/settings', verifyToken, async (req, res) => {
    try {
        const updated = await smsSequenceService.saveSequenceSettings(req.body);
        res.json({ success: true, settings: updated });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Get Master Auto-Send Status
app.get('/api/sms/auto-send-status', verifyToken, async (req, res) => {
    try {
        const settings = await smsSequenceService.getSequenceSettings();
        res.json({
            success: true,
            autoSendEnabled: settings.autoSendEnabled !== false
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Toggle Master Auto-Send Status
app.post('/api/sms/toggle-auto-send', verifyToken, async (req, res) => {
    try {
        const { enabled } = req.body;
        const currentSettings = await smsSequenceService.getSequenceSettings();
        const newStatus = enabled !== undefined ? Boolean(enabled) : !currentSettings.autoSendEnabled;
        const updated = await smsSequenceService.saveSequenceSettings({
            ...currentSettings,
            autoSendEnabled: newStatus
        });
        res.json({
            success: true,
            autoSendEnabled: updated.autoSendEnabled,
            message: updated.autoSendEnabled ? "Envois automatiques de SMS activés." : "Envois automatiques de SMS suspendus."
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Batch Validate Phones for Leads (up to 15 at a time)
app.post('/api/leads/batch-validate-phones', verifyToken, async (req, res) => {
    try {
        const { leadIds } = req.body;
        if (!Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ success: false, error: "leadIds array is required" });
        }
        const results = [];
        const targetIds = leadIds.slice(0, 15);

        for (const id of targetIds) {
            let leadRef = db.collection('crm_leads').doc(id);
            let snap = await leadRef.get();
            if (!snap.exists) {
                leadRef = db.collection('leads').doc(id);
                snap = await leadRef.get();
            }
            if (!snap.exists) continue;
            const data = snap.data();
            const phone = data.phone || data.phone_number;
            if (!phone) continue;

            const validated = await phoneValidatorService.validatePhoneNumber(phone, { id, ...data });
            await leadRef.set({
                phone_type: validated.phone_type,
                carrier_name: validated.carrier_name || null,
                sms_eligible: validated.sms_eligible,
                recommended_channel: validated.recommended_channel || (validated.sms_eligible ? 'sms' : 'call'),
                phone_validated_at: validated.checked_at || new Date().toISOString()
            }, { merge: true });
            results.push({ leadId: id, ...validated });
        }

        res.json({ success: true, count: results.length, results });
    } catch (e) {
        console.error("[Batch Validate Phones Error]", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 2. List Sequences
app.get('/api/sequences', verifyToken, async (req, res) => {
    try {
        const sequences = await smsSequenceService.getSequences();
        res.json({ success: true, sequences });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 3. Save / Update Custom Sequence
app.post('/api/sequences', verifyToken, async (req, res) => {
    try {
        const seqData = req.body;
        if (!seqData.name || !seqData.targetCategory) {
            return res.status(400).json({ success: false, error: "Nom et catégorie cible requis" });
        }
        const seqId = seqData.id || `seq_${seqData.targetCategory}_${Date.now()}`;
        await db.collection('sms_sequences').doc(seqId).set({
            ...seqData,
            targetCountry: seqData.targetCountry || 'ALL',
            id: seqId,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        res.json({ success: true, sequence: { id: seqId, ...seqData } });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 3b. Reset / Sync All Default Sequences
app.post('/api/sequences/reset-defaults', verifyToken, async (req, res) => {
    try {
        const sequences = await smsSequenceService.syncDefaultSequences();
        res.json({ success: true, sequences });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 3c. Reset Single Sequence to Seed Default
app.post('/api/sequences/reset', verifyToken, async (req, res) => {
    try {
        const { sequenceId } = req.body;
        const defaultSeq = smsSequenceService.DEFAULT_SEQUENCES.find(s => s.id === sequenceId);
        if (!defaultSeq) {
            return res.status(404).json({ success: false, error: "Modèle par défaut introuvable pour cet identifiant." });
        }
        await db.collection('sms_sequences').doc(sequenceId).set(defaultSeq);
        res.json({ success: true, sequence: defaultSeq });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 3d. Delete Custom Sequence
app.delete('/api/sequences/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const isDefault = smsSequenceService.DEFAULT_SEQUENCES.some(s => s.id === id);
        if (isDefault) {
            return res.status(403).json({ success: false, error: "Impossible de supprimer une séquence native du système." });
        }
        await db.collection('sms_sequences').doc(id).delete();
        res.json({ success: true, message: "Séquence supprimée avec succès." });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 4. Trigger Sequence on a Lead (Supports Force Live & Bypass Pause for individual testing)
app.post('/api/sequences/trigger', verifyToken, async (req, res) => {
    try {
        const { leadId, sequenceId, dryRun, bypassPause, forceLive } = req.body;
        const result = await smsSequenceService.triggerLeadSequence({
            leadId,
            sequenceId,
            dryRunOverride: forceLive ? false : dryRun,
            bypassPause: Boolean(bypassPause || forceLive),
            forceLive: Boolean(forceLive)
        });
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 4b. Stop Sequence on a Lead
app.post('/api/sequences/stop', verifyToken, async (req, res) => {
    try {
        const { leadId, instanceId } = req.body;
        const result = await smsSequenceService.stopLeadSequence({ leadId, instanceId });
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 5. List Sequence Instances (Active / Completed / Simulated)
app.get('/api/sequences/instances', verifyToken, async (req, res) => {
    try {
        const snap = await db.collection('sequence_instances')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        let list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        res.json({ success: true, instances: list });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 5b. Get Detailed Sequence Timeline for a Specific Lead (Active or Projected)
app.get('/api/sequences/leads/:leadId/timeline', verifyToken, async (req, res) => {
    try {
        const { leadId } = req.params;
        const timeline = await smsSequenceService.getLeadSequenceTimeline(leadId);
        res.json(timeline);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 5c. Update Lead Preferred Language & Sync Sequence Instance Language
app.post('/api/leads/:leadId/language', verifyToken, async (req, res) => {
    try {
        const { leadId } = req.params;
        const { language } = req.body || {};
        const lang = String(language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';
        const isFr = (lang === 'fr');

        let leadRef = db.collection('crm_leads').doc(leadId);
        let leadSnap = await leadRef.get();
        if (!leadSnap.exists) {
            leadRef = db.collection('leads').doc(leadId);
            leadSnap = await leadRef.get();
        }

        if (leadSnap.exists) {
            await leadRef.update({
                preferredLanguage: lang,
                updatedAt: new Date().toISOString()
            });

            const leadData = leadSnap.data();
            if (leadData.sequenceInstanceId) {
                const instRef = db.collection('sequence_instances').doc(leadData.sequenceInstanceId);
                const instSnap = await instRef.get();
                if (instSnap.exists) {
                    await instRef.update({
                        isFrancophone: isFr,
                        updatedAt: new Date().toISOString()
                    });
                }
            } else {
                const qSnap = await db.collection('sequence_instances')
                    .where('leadId', '==', leadId)
                    .limit(5)
                    .get();
                if (!qSnap.empty) {
                    for (const docSnap of qSnap.docs) {
                        await docSnap.ref.update({
                            isFrancophone: isFr,
                            updatedAt: new Date().toISOString()
                        });
                    }
                }
            }
        }

        res.json({ success: true, language: lang, isFrancophone: isFr });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 6. Test Admin Alert SMS
app.post('/api/sequences/test-admin-alert', verifyToken, async (req, res) => {
    try {
        await smsSequenceService.notifyAdminOnProspectAction({
            leadId: 'test_demo',
            phoneNumber: '+15062337006',
            clientName: 'Test Admin Alert',
            companyName: 'Solutions Quasar Inc.',
            actionType: 'reply',
            text: 'Ceci est un test de notification SMS direct vers votre mobile.'
        });
        res.json({ success: true, message: "Alerte test envoyée au +1 506 233-7006 !" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 6b. Test Admin Alert Email
app.post('/api/sequences/test-admin-email', verifyToken, async (req, res) => {
    try {
        const { targetEmail } = req.body || {};
        const settings = await smsSequenceService.getSequenceSettings();
        const email = targetEmail || settings.adminAlertEmail || 'benjamin@solutionsquasar.ca';
        const emailAlertService = require('./email-alert-service');

        const result = await emailAlertService.sendAdminAlertEmail({
            to: email,
            subject: '✦ [TEST] Alerte Courriel Quasar ERP',
            title: 'Test de Configuration du Canal Courriel',
            badgeText: 'Test de Réception',
            badgeColor: '#10B981',
            details: [
                { label: 'Canal', value: 'Courriel Direct (Resend API)' },
                { label: 'Destinataire', value: email },
                { label: 'Statut', value: 'Opérationnel ✓' },
                { label: 'Heure locale', value: new Date().toLocaleString('fr-CA', { timeZone: 'America/Moncton' }) }
            ],
            snippet: 'Votre adresse courriel est correctement configurée pour recevoir les notifications d\'événements critiques du cockpit IA Quasar.',
            ctaUrl: 'https://quasar-erp-b26d5.web.app/#prospection',
            ctaText: 'Accéder aux Réglages IA'
        });

        if (result.success) {
            res.json({ success: true, message: `Courriel test envoyé avec succès à ${email} !` });
        } else {
            res.status(500).json({ success: false, error: result.error || "Échec d'envoi du courriel" });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 7. Test Single Step SMS
app.post('/api/sequences/test-step', verifyToken, async (req, res) => {
    try {
        const { text, targetPhone } = req.body;
        const settings = await smsSequenceService.getSequenceSettings();
        const phone = targetPhone || settings.adminAlertPhone || '+15062337006';

        let sampleText = (text || '')
            .replace(/\{\{name\}\}/gi, 'Benjamin')
            .replace(/\{\{company\}\}/gi, 'Solutions Quasar Inc.')
            .replace(/\{\{city\}\}/gi, 'Moncton')
            .replace(/\{\{industry\}\}/gi, 'Technologie');

        const twilioService = require('./twilio-service');
        const resTwilio = await twilioService.sendSms({
            to: phone,
            message: `[TEST ÉTAPE SMS QUASAR]\n${sampleText}`
        });

        res.json({ success: true, message: `SMS test envoyé avec succès au ${phone} !`, sid: resTwilio.sid });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});



// --- LEAD AUDIT & TRIANGULATION IA SERVICE & ENDPOINTS ---
const leadAuditService = require('./lead-audit-service');
const calendarReminderService = require('./calendar-reminder-service');

// 1. Get Audit Config & System Prompt
app.get('/api/audit/config', verifyToken, async (req, res) => {
    try {
        const config = await leadAuditService.loadConfig();
        res.json({ success: true, config });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 2. Save Audit Config & System Prompt
app.post('/api/audit/config', verifyToken, async (req, res) => {
    try {
        const result = await leadAuditService.saveConfig(req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 3. Reset Audit System Prompt to Default
app.post('/api/audit/reset-prompt', verifyToken, async (req, res) => {
    try {
        const result = await leadAuditService.resetPrompt();
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 4. Run Audit Batch on Demand
app.post('/api/audit/run-batch', verifyToken, async (req, res) => {
    try {
        const batchSize = parseInt(req.body.batchSize) || 10;
        const result = await leadAuditService.runAuditBatch(batchSize);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 5. Audit Single Lead on Demand
app.post('/api/audit/lead/:id', verifyToken, async (req, res) => {
    try {
        const result = await leadAuditService.auditLead(req.params.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 5b. Enrich Lead Contacts on Demand (Phone, Email, Socials)
app.post('/api/leads/:id/enrich-contacts', verifyToken, async (req, res) => {
    try {
        const result = await leadAuditService.enrichLeadContacts(req.params.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 5c. Verify CASL / LCAP Compliance on demand
app.post('/api/leads/:id/casl-verify', verifyToken, async (req, res) => {
    try {
        const result = await leadAuditService.verifyLeadCasl(req.params.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 5d-ps. Test Google PageSpeed Insights on demand
app.post('/api/audit/pagespeed', verifyToken, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, error: 'URL requise' });
        const metrics = await leadAuditService.fetchPageSpeedMetrics(url);
        res.json({ success: Boolean(metrics), metrics });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 5d. Scrape Contacts from a Website URL (Used by Lead Hunter in real-time)
app.post('/api/leads/enrich-website', async (req, res) => {
    try {
        const { website } = req.body;
        if (!website) {
            return res.status(400).json({ success: false, error: 'Website URL is required' });
        }
        const result = await leadAuditService.extractContactsFromWebsite(website, req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 6. Get Audit Statistics
app.get('/api/audit/stats', verifyToken, async (req, res) => {
    try {
        const stats = await leadAuditService.getAuditStats();
        res.json({ success: true, stats });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- APPOINTMENTS & TRIPLE REMINDER (CALENDAR) ENDPOINTS ---

// 1. Book Appointment with Triple Reminder (J-24h, H-1h, H-0)
app.post('/api/appointments/schedule', verifyToken, async (req, res) => {
    try {
        const result = await calendarReminderService.scheduleAppointment(req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 2. List Appointments
app.get('/api/appointments', verifyToken, async (req, res) => {
    try {
        const snap = await db.collection('appointments').orderBy('appointmentTime', 'asc').limit(50).get();
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        res.json({ success: true, appointments: list });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 3. Cancel Appointment
app.post('/api/appointments/:id/cancel', verifyToken, async (req, res) => {
    try {
        const result = await calendarReminderService.cancelAppointment(req.params.id, req.body?.reason);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- AUTONOMOUS LEAD HUNTER AUTO-PILOT SERVICE & ENDPOINTS ---
const leadHunterService = require('./lead-hunter-service');

// 1. Get Hunter Auto-Pilot Config
app.get('/api/hunter/config', verifyToken, async (req, res) => {
    try {
        const config = await leadHunterService.loadConfig();
        res.json({ success: true, config, regions: leadHunterService.REGIONS_DATA });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 2. Save Hunter Auto-Pilot Config
app.post('/api/hunter/config', verifyToken, async (req, res) => {
    try {
        const result = await leadHunterService.saveConfig(req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 3. Trigger Immediate Auto-Pilot Hunt Run
app.post('/api/hunter/run-now', verifyToken, async (req, res) => {
    try {
        const result = await leadHunterService.runAutonomousHunt({
            manual: true,
            customCity: req.body?.city,
            customIndustry: req.body?.industry,
            customCountry: req.body?.country,
            customRegion: req.body?.region,
            referer: req.headers.referer || req.headers.origin || 'http://localhost:3002/'
        });
        res.json(result);
    } catch (e) {
        console.error("[LeadHunterService Error in /run-now]:", e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 4. Get Hunter Status & Statistics
app.get('/api/hunter/status', verifyToken, async (req, res) => {
    try {
        const status = leadHunterService.getStatus();
        res.json({ success: true, status });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- REAL-TIME AI ACTIVITY FEED & SSE STREAMING (LEAD HUNTER & SMS) ---
const aiActivityService = require('./ai-activity-service');

// 1. SSE Stream: Real-time event push to browser
app.get('/api/ai/activity/stream', (req, res) => {
    aiActivityService.addSseClient(req, res, req.query.category || 'all');
});

// 2. REST Endpoint: Get recent buffered activities
app.get('/api/ai/activity/recent', (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 50;
        const category = req.query.category || 'all';
        const events = aiActivityService.getRecent(limit, category);
        res.json({ success: true, events });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 3. Clear activity console
app.post('/api/ai/activity/clear', verifyToken, (req, res) => {
    try {
        aiActivityService.clear();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- PERPLEXITY AGENT API ENDPOINTS ---
const perplexityAgentService = require('./perplexity-agent-service');

// 1. Generic Agent API Runner
app.post('/api/perplexity/agent', verifyToken, async (req, res) => {
    try {
        if (!perplexityAgentService.isConfigured()) {
            return res.status(503).json({ success: false, error: 'PERPLEXITY_API_KEY is not configured.' });
        }
        const result = await perplexityAgentService.runAgent(req.body);
        res.json({ success: true, ...result });
    } catch (e) {
        console.error('[Perplexity Agent API Error]', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 2. Discover & Enrich Decision Maker for a Lead
app.post('/api/leads/:id/enrich-decision-maker', verifyToken, async (req, res) => {
    try {
        const leadId = req.params.id;
        const leadDoc = await db.collection('leads').doc(leadId).get();
        if (!leadDoc.exists) {
            return res.status(404).json({ success: false, error: 'Lead not found' });
        }

        const leadData = leadDoc.data();
        const businessName = leadData.business_name || leadData.name || '';
        const city = leadData.city || '';
        const provinceState = leadData.state || '';
        const websiteUrl = leadData.website || '';

        const result = await perplexityAgentService.findDecisionMaker({
            businessName,
            city,
            provinceState,
            websiteUrl
        });

        if (result.success && result.found) {
            const updates = {
                dm_name: result.dm_name,
                dm_title: result.dm_title || 'Dirigeant',
                dm_enriched_by: 'perplexity',
                dm_enriched_at: new Date().toISOString(),
                dm_confidence: result.confidence,
                dm_source_summary: result.source_summary
            };

            if (result.dm_email && !leadData.dm_email) updates.dm_email = result.dm_email;
            if (result.dm_phone && !leadData.dm_phone) updates.dm_phone = result.dm_phone;
            if (result.dm_linkedin && !leadData.dm_linkedin) updates.dm_linkedin = result.dm_linkedin;

            await db.collection('leads').doc(leadId).update(updates);

            aiActivityService.log({
                type: 'lead_dm_enriched',
                category: 'audit',
                leadName: businessName,
                title: `Décideur trouvé : ${result.dm_name} (${result.dm_title})`,
                detail: `Source : ${result.source_summary || 'Perplexity Web Grounding'}`,
                level: 'success'
            });

            return res.json({ success: true, lead: { ...leadData, ...updates }, result });
        }

        res.json({ success: true, found: false, result });
    } catch (e) {
        console.error('[Enrich Decision Maker Error]', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- AUTONOMOUS LONG-TERM FOLLOW-UP ENGINE ENDPOINTS ---
const followupService = require('./followup-service');

// 1. List All Follow-ups (with optional status filter)
app.get('/api/followups', verifyToken, async (req, res) => {
    try {
        const list = await followupService.listFollowups({
            status: req.query.status,
            limit: parseInt(req.query.limit, 10) || 50
        });
        res.json({ success: true, followups: list });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 2. Get Follow-ups for a Specific Lead
app.get('/api/followups/lead/:leadId', verifyToken, async (req, res) => {
    try {
        const list = await followupService.getFollowupsForLead(req.params.leadId);
        res.json({ success: true, followups: list });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 3. Manually or Programmatically Schedule a Follow-up
app.post('/api/followups/schedule', verifyToken, async (req, res) => {
    try {
        const result = await followupService.scheduleFollowup({
            ...req.body,
            createdBy: req.body?.createdBy || 'crm_user'
        });
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 4. Cancel a Follow-up
app.post('/api/followups/:id/cancel', verifyToken, async (req, res) => {
    try {
        const result = await followupService.cancelFollowup(req.params.id, req.body?.reason);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 5. Force Execute a Follow-up Now (Test Run)
app.post('/api/followups/:id/execute-now', verifyToken, async (req, res) => {
    try {
        const result = await followupService.executeFollowup(req.params.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 6. Process Due Follow-ups (Trigger on Demand)
app.post('/api/followups/process-due', verifyToken, async (req, res) => {
    try {
        await followupService.processDueFollowups();
        res.json({ success: true, message: "Due follow-ups processed successfully." });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        // Run sequence step checker every 30 seconds
        setInterval(() => {
            smsSequenceService.processDueSequenceSteps().catch(err => {
                console.error("[Sequence Worker Error]", err.message);
            });
        }, 30000);

        // Initialize Audit, Hunter, Calendar & Autonomous Follow-up background services
        leadAuditService.init().catch(err => console.error("[LeadAuditService Init Error]", err.message));
        leadHunterService.init().catch(err => console.error("[LeadHunterService Init Error]", err.message));
        calendarReminderService.init();
        followupService.init();
    });
}

module.exports = app;

