const { google } = require('googleapis');
const { db } = require('./firebase-admin');

function getOAuthClient(customRedirectUri) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = customRedirectUri || (process.env.SERVER_URL || 'https://quasar-erp-b26d5.web.app') + '/api/integrations/google/callback';

    return new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
    );
}

const getAuthUrl = (projectId = 'master_admin', customRedirectUri) => {
    const client = getOAuthClient(customRedirectUri);
    return client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ],
        state: projectId || 'master_admin',
        prompt: 'consent'
    });
};

const getTokensFromCode = async (code, customRedirectUri) => {
    const client = getOAuthClient(customRedirectUri);
    const { tokens } = await client.getToken(code);
    return tokens;
};

const getAuthorizedClient = async (projectId = 'master_admin', customRedirectUri) => {
    let tokens = null;
    let docRef = null;

    if (projectId === 'master_admin' || !projectId) {
        // Master Quasar ERP Google Calendar (Settings collection)
        docRef = db.collection('settings').doc('google_calendar_config');
        const snap = await docRef.get();
        if (snap.exists && snap.data().googleTokens) {
            tokens = snap.data().googleTokens;
        }
        // Fallback: Check if an ai_project has tokens
        if (!tokens) {
            const pSnap = await db.collection('ai_projects').limit(5).get();
            pSnap.forEach(d => {
                const data = d.data();
                if (data.googleTokens?.refresh_token) {
                    tokens = data.googleTokens;
                    docRef = d.ref;
                }
            });
        }
    } else {
        docRef = db.collection('ai_projects').doc(projectId);
        const snap = await docRef.get();
        if (snap.exists) {
            tokens = snap.data().googleTokens;
        }
    }

    if (!tokens) throw new Error("Google Calendar not connected");

    const client = getOAuthClient(customRedirectUri);
    client.setCredentials(tokens);

    // Auto-refresh token listener
    client.on('tokens', async (newTokens) => {
        if (newTokens.refresh_token && docRef) {
            await docRef.update({
                'googleTokens.refresh_token': newTokens.refresh_token,
                'googleTokens.expiry_date': newTokens.expiry_date,
                updatedAt: new Date().toISOString()
            });
        }
    });

    return client;
};

const getCalendar = async (projectId = 'master_admin', customRedirectUri) => {
    const auth = await getAuthorizedClient(projectId, customRedirectUri);
    return google.calendar({ version: 'v3', auth });
};

const isGoogleConnected = async () => {
    try {
        const snap = await db.collection('settings').doc('google_calendar_config').get();
        if (snap.exists && snap.data().googleTokens?.refresh_token) {
            return {
                connected: true,
                email: snap.data().googleEmail || null,
                connectedAt: snap.data().connectedAt || null
            };
        }
        // Check if fallback project exists
        const pSnap = await db.collection('ai_projects').limit(5).get();
        let fallbackEmail = null;
        let isConn = false;
        pSnap.forEach(d => {
            const data = d.data();
            if (data.googleTokens?.refresh_token) {
                isConn = true;
                fallbackEmail = data.googleEmail || null;
            }
        });
        return { connected: isConn, email: fallbackEmail };
    } catch (_) {
        return { connected: false };
    }
};

const disconnectGoogle = async () => {
    await db.collection('settings').doc('google_calendar_config').delete();
    return { success: true };
};

module.exports = {
    getAuthUrl,
    getTokensFromCode,
    getCalendar,
    getAuthorizedClient,
    isGoogleConnected,
    disconnectGoogle,
    getOAuthClient
};
