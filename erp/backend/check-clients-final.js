const { getApp } = require('./firebase-manager');
const { db: mainDb } = require('./firebase-admin');

async function check() {
    console.log("--- TENANT ---");
    const tenantId = 'Rb9kYRlkmaSFz3iReAsp';
    try {
        const app = await getApp(tenantId);
        const db = app.firestore();
        const snap = await db.collection('clients').limit(1).get();
        snap.forEach(doc => console.log(JSON.stringify({ id: doc.id, ...doc.data() }, null, 2)));
    } catch (e) { }

    console.log("--- MAIN ---");
    try {
        const snap = await mainDb.collection('clients').limit(1).get();
        snap.forEach(doc => console.log(JSON.stringify({ id: doc.id, ...doc.data() }, null, 2)));
    } catch (e) { }
}
check();
