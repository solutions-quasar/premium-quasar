const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
console.log("------------------------------------------");
console.log("DEBUG ENV VARS:");
console.log("Email User:", process.env.EMAIL_USER);
console.log("Email Pass (Length):", process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : "MISSING");
console.log("------------------------------------------");

const app = express();
const PORT = process.env.PORT || 5000;
const admin = require('firebase-admin');

// CORS Setup (Restrict to Frontend)
app.use(cors({
    origin: ['http://localhost:3000', 'https://solutionsquasar.ca', 'http://127.0.0.1:3000']
}));
app.use(express.json());

// Initialize Firebase Admin
try {
    // Check if the file exists to avoid immediate crash on require
    // If you haven't added the file yet, this block will be skipped/caught
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin Initialized Successfully");
} catch (error) {
    console.warn("⚠️ Firebase Admin Init Failed: Missing ./serviceAccountKey.json");
    console.warn("   To fix: Download service account from Firebase Console > Project Settings > Service Accounts");
    console.warn("   and save it as 'serviceAccountKey.json' in the backend folder.");
}

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

    const fromEmail = process.env.EMAIL_FROM || 'noreply@solutionsquasar.ca';

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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
