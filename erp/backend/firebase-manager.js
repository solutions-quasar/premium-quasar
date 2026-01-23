const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Cache for initialized apps: { projectId: admin.app.App }
const apps = {};

const CREDENTIALS_DIR = path.join(__dirname, 'credentials');

// Ensure dir exists
if (!fs.existsSync(CREDENTIALS_DIR)) {
    fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
}

/**
 * loads or gets a firebase admin app for a specific project
 * @param {string} projectId 
 * @returns {Promise<admin.app.App>}
 */
async function getApp(projectId) {
    if (!projectId) throw new Error("ProjectId is required for isolation.");

    // Return cached app if exists
    if (apps[projectId]) return apps[projectId];

    // Check if named app already exists in admin SDK (recover from restart/warm)
    const existing = admin.apps.find(a => a && a.name === projectId);
    if (existing) {
        apps[projectId] = existing;
        return existing;
    }

    // Load Credential File
    const keyPath = path.join(CREDENTIALS_DIR, `${projectId}.json`);
    if (!fs.existsSync(keyPath)) {
        throw new Error(`No credentials found for Project ID: ${projectId}. Please upload serviceAccountKey.json.`);
    }

    try {
        const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

        // Initialize named app
        console.log(`[FirebaseManager] Initializing App: ${projectId}`);
        const app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        }, projectId); // Pass projectId as appName

        apps[projectId] = app;
        return app;
    } catch (e) {
        console.error(`[FirebaseManager] Failed to init app ${projectId}:`, e);
        throw e;
    }
}

/**
 * Verify if key works
 */
async function verifyConnection(projectId) {
    try {
        const app = await getApp(projectId);
        const db = app.firestore();
        // Try a lightweight read
        await db.listCollections();
        return true;
    } catch (e) {
        console.error("Verification Failed:", e.message);
        return false;
    }
}

/**
 * Save generic json credential
 */
function saveCredential(projectId, jsonContent) {
    const keyPath = path.join(CREDENTIALS_DIR, `${projectId}.json`);
    fs.writeFileSync(keyPath, JSON.stringify(jsonContent, null, 2));

    // Invalidate cache if exists to force reload
    if (apps[projectId]) {
        // Apps cannot be easily deleted, but we can verify later. 
        // Admin SDK doesn't support easy deleteApp without cleanup.
        // For now, assume restart or we handle it.
        // Actually, let's try to delete it to be safe.
        try {
            apps[projectId].delete().catch(e => console.warn(e));
        } catch (e) { }
        delete apps[projectId];
    }
}

module.exports = { getApp, verifyConnection, saveCredential, CREDENTIALS_DIR };
