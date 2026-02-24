const { getApp } = require('./firebase-manager');
const { db: mainDb } = require('./firebase-admin');

async function debug() {
    const tenantId = 'Rb9kYRlkmaSFz3iReAsp';
    const collections = ['email-templates', 'email_templates'];

    console.log("--- MAIN PROJECT DB CHECK ---");
    for (const colName of collections) {
        const snap = await mainDb.collection(colName).get();
        console.log(`Collection: ${colName} - Found ${snap.size} docs`);
        snap.forEach(doc => {
            console.log(`  - Doc ID: ${doc.id}`);
            console.log(JSON.stringify(doc.data(), null, 2));
        });
    }

    console.log(`\n--- TENANT PROJECT DB CHECK (${tenantId}) ---`);
    try {
        const app = await getApp(tenantId);
        const tenantDb = app.firestore();
        for (const colName of collections) {
            const snap = await tenantDb.collection(colName).get();
            console.log(`Collection: ${colName} - Found ${snap.size} docs`);
            snap.forEach(doc => {
                console.log(`  - Doc ID: ${doc.id}`);
                console.log(JSON.stringify(doc.data(), null, 2));
            });
        }
    } catch (e) {
        console.error("Tenant Fetch Error:", e.message);
    }
}

debug();
