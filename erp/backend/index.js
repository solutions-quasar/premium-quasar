const { onRequest } = require("firebase-functions/v2/https");
const app = require("./server");

/**
 * Main ERP Backend Handler
 * This wraps the Express app for Firebase Cloud Functions
 */
exports.api = onRequest({
    memory: "256MiB",
    timeoutSeconds: 60,
    region: "us-central1", // Or your preferred region
    cors: true
}, app);
