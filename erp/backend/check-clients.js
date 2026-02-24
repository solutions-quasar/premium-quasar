const { getApp } = require('./firebase-manager');

async function check() {
    const projectId = 'Rb9kYRlkmaSFz3iReAsp';
    try {
        const app = await getApp(projectId);
        const db = app.firestore();
        const snap = await db.collection('clients').limit(1).get();
        if (snap.empty) {
            console.log("Empty: No clients found.");
        } else {
            snap.forEach(doc => {
                console.log(`FOUND_CLIENT: ${doc.id}`);
                console.log(JSON.stringify(doc.data(), null, 2));
            });
        }
    } catch (e) {
        console.error(e);
    }
}
check();
