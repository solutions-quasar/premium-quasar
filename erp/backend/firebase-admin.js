const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

let serviceAccount;
try {
    serviceAccount = require('./serviceAccountKey.json');
} catch (e) {
    console.warn("⚠️ serviceAccountKey.json not found.");
}

if (!admin.apps.length) {
    try {
        if (serviceAccount || process.env.FIREBASE_CONFIG) {
            admin.initializeApp({
                credential: serviceAccount ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault()
            });
            console.log("Firebase Admin Initialized (Full Config)");
        } else {
            // Minimal init for Cloud Functions
            admin.initializeApp();
            console.log("Firebase Admin Initialized (Default)");
        }
    } catch (error) {
        console.error("Firebase Init Error:", error.message);
    }
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
