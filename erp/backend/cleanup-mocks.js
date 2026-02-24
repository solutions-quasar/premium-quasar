const { db: mainDb } = require('./firebase-admin');

async function cleanup() {
    const mockIds = [
        'BGXQZBj0wvooiz1pzf9G', // John Smith
        'Rq7Dtmm3bqsOpuuYVFuX', // Michael Ross
        'fPomhwBs7YvDQSELt71D', // Jessica Day
        'rbnPW8pWFlp2bxxV8Bdt'  // Sarah Connor
    ];

    console.log("Cleaning up mock clients from Main DB...");
    for (const id of mockIds) {
        try {
            await mainDb.collection('clients').doc(id).delete();
            console.log(`Deleted: ${id}`);
        } catch (e) {
            console.error(`Error deleting ${id}:`, e.message);
        }
    }
}
cleanup();
