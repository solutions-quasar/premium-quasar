const { db: mainDb } = require('./firebase-admin');

async function inspect() {
    const collections = ['clients', 'quotes', 'invoices', 'leads', 'prospects'];
    for (const col of collections) {
        console.log(`--- ${col.toUpperCase()} ---`);
        const snap = await mainDb.collection(col).get();
        snap.forEach(doc => {
            console.log(`[${col}] ${doc.id}`);
            console.log(JSON.stringify(doc.data(), null, 2));
        });
    }
}
inspect();
