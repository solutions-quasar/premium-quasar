const { google } = require('googleapis');
const { db } = require('./firebase-admin');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = (process.env.SERVER_URL || 'https://quasar-erp-b26d5.web.app') + '/api/integrations/google/callback';

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

const getAuthUrl = (projectId) => {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/userinfo.email'
        ],
        state: projectId,
        prompt: 'consent'
    });
};

const getTokensFromCode = async (code) => {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
};

const getAuthorizedClient = async (projectId) => {
    const projectDoc = await db.collection('ai_projects').doc(projectId).get();
    if (!projectDoc.exists) throw new Error("Project not found");

    const tokens = projectDoc.data().googleTokens;
    if (!tokens) throw new Error("Google Calendar not connected for this project");

    const client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    client.setCredentials(tokens);

    // Handle token refresh
    client.on('tokens', async (newTokens) => {
        if (newTokens.refresh_token) {
            // Store new refresh token
            await db.collection('ai_projects').doc(projectId).update({
                'googleTokens.refresh_token': newTokens.refresh_token,
                'googleTokens.expiry_date': newTokens.expiry_date
            });
        }
    });

    return client;
};

const getCalendar = async (projectId) => {
    const auth = await getAuthorizedClient(projectId);
    return google.calendar({ version: 'v3', auth });
};

module.exports = { getAuthUrl, getTokensFromCode, getCalendar };
