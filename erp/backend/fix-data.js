const { getApp } = require('./firebase-manager');

async function fixData() {
    const projectId = 'Rb9kYRlkmaSFz3iReAsp';
    try {
        const app = await getApp(projectId);
        const db = app.firestore();

        await db.collection('email-templates').doc('U0e3qx9CfpGT92Kz40vV').set({
            title: "Send Quote",
            subject: "Your Premium Quote from TradePro",
            content: "Hi {{client_name}},\n\nPlease find your quote details attached: {{quote_id}}.\n\nBest regards,\nThe Team",
            updatedAt: new Date().toISOString()
        });
        console.log("Template U0e3qx9CfpGT92Kz40vV updated with subject and content.");
    } catch (e) {
        console.error(e);
    }
}

fixData();
