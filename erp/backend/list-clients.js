const { getApp } = require('./firebase-manager');
const { db: mainDb } = require('./firebase-admin');

async function listAll() {
    console.log("--- MAIN DB CLIENTS ---");
    try {
        const mainSnap = await mainDb.collection('clients').get();
        mainSnap.forEach(doc => console.log(`[MAIN] ${doc.id}: ${doc.data().name}`));
    } catch (e) {
        console.error("Main DB Error:", e.message);
    }

    const tenantId = 'Rb9kYRlkmaSFz3iReAsp';
    console.log(`\n--- TENANT DB CLIENTS (${tenantId}) ---`);
    try {
        const app = await getApp(tenantId);
        const db = app.firestore();
        const tenantSnap = await db.collection('clients').get();
        tenantSnap.forEach(doc => console.log(`[TENANT] ${doc.id}: ${doc.data().name}`));
    } catch (e) {
        console.error("Tenant DB Error:", e.message);
    }
}
listAll();
