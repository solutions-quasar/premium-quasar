const { Resend } = require('resend');

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const FROM_EMAIL = process.env.EMAIL_FROM && !process.env.EMAIL_FROM.includes('resend.dev')
    ? process.env.EMAIL_FROM
    : 'info@solutionsquasar.ca';

/**
 * Sends a premium luxury dark-themed email notification to the administrator
 */
async function sendAdminAlertEmail({ to, subject, title, badgeText = 'Alerte Quasar', badgeColor = '#DFAB3A', details = [], snippet = '', ctaUrl = 'https://quasar-erp-b26d5.web.app/#sms', ctaText = "Ouvrir l'ERP" }) {
    if (!resend) {
        console.warn("[EmailAlertService] RESEND_API_KEY is missing. Cannot send alert email.");
        return { success: false, error: 'Email service not configured.' };
    }

    const recipient = to || 'benjamin@solutionsquasar.ca';

    const detailsHtml = details.map(d => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
            <td style="padding: 10px 0; color: #94A3B8; font-size: 13px; width: 35%; font-weight: 500;">${d.label}</td>
            <td style="padding: 10px 0; color: #F8FAFC; font-size: 14px; font-weight: 600;">${d.value}</td>
        </tr>
    `).join('');

    const snippetHtml = snippet ? `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-left: 3px solid ${badgeColor}; border-radius: 8px; padding: 14px 16px; margin: 18px 0; font-family: monospace; font-size: 13px; color: #E2E8F0; line-height: 1.5; white-space: pre-wrap;">
            ${snippet}
        </div>
    ` : '';

    const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #090B0F; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F8FAFC;">
        <center style="width: 100%; padding: 40px 10px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 580px; background-color: #12151B; border: 1px solid rgba(255,255,255,0.08); border-top: 3px solid #DFAB3A; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <!-- Header -->
                <tr>
                    <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #DFAB3A;">✦ SOLUTIONS QUASAR INC.</div>
                            <div style="font-size: 18px; font-weight: 700; color: #FFFFFF; margin-top: 4px;">Système d'Alertes IA</div>
                        </div>
                        <span style="background: rgba(223,171,58,0.12); border: 1px solid rgba(223,171,58,0.3); color: #DFAB3A; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; text-transform: uppercase;">
                            ${badgeText}
                        </span>
                    </td>
                </tr>

                <!-- Content -->
                <tr>
                    <td style="padding: 30px 32px;">
                        <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #F8FAFC; line-height: 1.4;">
                            ${title}
                        </h2>

                        ${snippetHtml}

                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 14px; margin-bottom: 24px;">
                            ${detailsHtml}
                        </table>

                        <!-- CTA Button -->
                        <div style="text-align: center; margin-top: 28px;">
                            <a href="${ctaUrl}" target="_blank" style="background: #DFAB3A; color: #090B0F; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 14px rgba(223,171,58,0.35);">
                                ${ctaText} →
                            </a>
                        </div>
                    </td>
                </tr>

                <!-- Footer -->
                <tr>
                    <td style="padding: 16px 32px; background-color: #0D1016; border-top: 1px solid rgba(255,255,255,0.05); text-align: center; font-size: 11px; color: #64748B;">
                        Notification directe expédiée par Solutions Quasar Inc. • <a href="https://quasar-erp-b26d5.web.app" style="color: #94A3B8; text-decoration: none;">Accès ERP</a>
                    </td>
                </tr>
            </table>
        </center>
    </body>
    </html>
    `;

    try {
        const result = await resend.emails.send({
            from: `Solutions Quasar <${FROM_EMAIL}>`,
            to: [recipient],
            subject: subject || `[Quasar Alerte] ${title}`,
            html: htmlBody
        });
        console.log(`[EmailAlertService] Alert email successfully sent to ${recipient} (ID: ${result?.data?.id || 'OK'})`);
        return { success: true, id: result?.data?.id };
    } catch (err) {
        console.error('[EmailAlertService] Failed to send alert email:', err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    sendAdminAlertEmail,
    FROM_EMAIL
};
