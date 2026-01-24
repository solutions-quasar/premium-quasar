const admin = require('firebase-admin');
const { db: systemDb } = require('./firebase-admin'); // The main ERP database

// Cache for initialized apps: { projectId: admin.app.App }
const apps = {};

/**
 * loads or gets a firebase admin app for a specific project
 * @param {string} projectId 
 * @returns {Promise<admin.app.App>}
 */
async function getApp(projectId) {
    if (!projectId) throw new Error("ProjectId is required for isolation.");

    // 1. Return cached app if exists
    if (apps[projectId]) return apps[projectId];

    // 2. Check if named app already exists in admin SDK
    const existing = admin.apps.find(a => a && a.name === projectId);
    if (existing) {
        apps[projectId] = existing;
        return existing;
    }

    // 3. Load Credential from SYSTEM DB (Firestore)
    // We look in 'ai_projects' collection for the 'serviceAccountKey' field
    try {
        const projectDoc = await systemDb.collection('ai_projects').doc(projectId).get();
        if (!projectDoc.exists) {
            throw new Error(`Project ${projectId} not found in ERP database.`);
        }

        const projectData = projectDoc.data();
        const serviceAccount = projectData.serviceAccountKey;

        if (!serviceAccount) {
            throw new Error(`No credentials found for Project: ${projectId}. Please set them in Project Settings.`);
        }

        // Initialize named app
        console.log(`[FirebaseManager] Initializing App: ${projectId}`);
        const app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        }, projectId);

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
        await db.listCollections();
        return true;
    } catch (e) {
        console.error("Verification Failed:", e.message);
        return false;
    }
}

/**
 * Save generic json credential to SYSTEM DB
 */
async function saveCredential(projectId, jsonContent) {
    console.log(`[FirebaseManager] Saving credential for Project ${projectId} to Firestore`);

    // Save to Firestore instead of Local FS
    await systemDb.collection('ai_projects').doc(projectId).update({
        serviceAccountKey: jsonContent,
        updatedAt: new Date().toISOString(),
        verified: true // Assuming it will be verified immediately after
    });

    // Invalidate cache
    if (apps[projectId]) {
        try {
            await apps[projectId].delete();
        } catch (e) { }
        delete apps[projectId];
    }
}

module.exports = { getApp, verifyConnection, saveCredential };
