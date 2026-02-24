/**
 * Migration Script: Unify Email Templates Collections
 * Copies all documents from 'email-templates' to 'email_templates'.
 */
const admin = require('firebase-admin');
const { getApp } = require('./firebase-manager');
const { db: mainDb } = require('./firebase-admin');

async function migrateProject(projectId) {
    try {
        console.log(`\n--- Migrating Project: ${projectId} ---`);
        const app = await getApp(projectId);
        const db = app.firestore();

        const sourceCol = db.collection('email-templates');
        const targetCol = db.collection('email_templates');

        const snapshot = await sourceCol.get();
        if (snapshot.empty) {
            console.log(`[${projectId}] No hyphenated templates found. Skipping.`);
            return;
        }

        console.log(`[${projectId}] Found ${snapshot.size} templates to migrate.`);

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const targetDoc = targetCol.doc(doc.id);
            const targetSnap = await targetDoc.get();

            if (!targetSnap.exists) {
                console.log(`  + Migrating: ${doc.id} (${data.title || data.name || 'Untitled'})`);
                await targetDoc.set({
                    ...data,
                    migratedFromHyphen: true,
                    migratedAt: new Date().toISOString()
                });
            } else {
                console.log(`  . Skipping: ${doc.id} (Already exists in target)`);
            }
        }

        console.log(`[${projectId}] Migration complete.`);
    } catch (e) {
        console.error(`[${projectId}] Migration FAILED:`, e.message);
    }
}

async function migrateAll() {
    console.log("Starting Global Email Template Migration...");

    // 1. Migrate Main ERP Database (the central one)
    console.log("\n--- Migrating MAIN ERP DATABASE ---");
    const mainSource = mainDb.collection('email-templates');
    const mainTarget = mainDb.collection('email_templates');
    const mainSnap = await mainSource.get();

    for (const doc of mainSnap.docs) {
        const targetDoc = mainTarget.doc(doc.id);
        const targetSnap = await targetDoc.get();
        if (!targetSnap.exists) {
            console.log(`  + Migrating Main: ${doc.id}`);
            await targetDoc.set({ ...doc.data(), migratedAt: new Date().toISOString() });
        }
    }

    // 2. Migrate Tenant Projects
    const projectsSnap = await mainDb.collection('ai_projects').get();
    const projectIds = projectsSnap.docs.map(doc => doc.id);

    console.log(`Found ${projectIds.length} projects to check.`);

    for (const projectId of projectIds) {
        await migrateProject(projectId);
    }

    console.log("\nGlobal Migration Finished.");
    process.exit(0);
}

migrateAll();
