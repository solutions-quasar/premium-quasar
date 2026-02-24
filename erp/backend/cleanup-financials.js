const { db: mainDb } = require('./firebase-admin');

async function cleanup() {
    const collections = ['quotes', 'invoices'];
    for (const col of collections) {
        console.log(`Checking ${col}...`);
        const snap = await mainDb.collection(col).get();
        console.log(`Found ${snap.size} docs in ${col}`);
        for (const doc of snap.docs) {
            const data = doc.data();
            // Delete if linked to mock clients or has mock project names
            const isMock = (
                data.clientName === 'Jessica Day' ||
                data.clientName === 'Michael Ross' ||
                data.clientName === 'Sarah Connor' ||
                data.clientName === 'John Smith' ||
                data.company === 'New Girl LLC' ||
                data.company === 'Pearson Specter' ||
                data.company === 'SkyNet Systems'
            );

            if (isMock) {
                await doc.ref.delete();
                console.log(`Deleted mock ${col}: ${doc.id} (${data.clientName})`);
            }
        }
    }
}
cleanup();
