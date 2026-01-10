
import { loadAuthData, saveAuthData } from '../commands/auth';
import { sendAdminEmail } from './email';

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const ALERT_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

export function startScheduler() {
    console.log('⏰ Expiry alert scheduler started');

    // Run immediately
    checkExpiringTokens();

    // Loop
    setInterval(checkExpiringTokens, CHECK_INTERVAL_MS);
}

async function checkExpiringTokens() {
    try {
        const data = await loadAuthData();
        const now = Date.now();
        const expiringTokens = [];
        let updated = false;

        for (const token of data.tokens) {
            const expiry = new Date(token.expiresAt).getTime();
            const timeLeft = expiry - now;

            // Conditions:
            // 1. Not expired yet (timeLeft > 0)
            // 2. Expiring soon (timeLeft < threshold)
            // 3. Alert not sent yet
            if (timeLeft > 0 && timeLeft < ALERT_THRESHOLD_MS && !token.renewalAlertSent) {
                expiringTokens.push({
                    userId: token.userId,
                    expiresInMinutes: Math.round(timeLeft / 1000 / 60)
                });

                token.renewalAlertSent = true;
                updated = true;
            }
        }

        if (updated) {
            await saveAuthData(data);
        }

        if (expiringTokens.length > 0) {
            console.log(`⏰ Found ${expiringTokens.length} tokens expiring soon`);
            await sendExpiryAlert(expiringTokens);
        }

    } catch (error) {
        console.error('Scheduler error:', error);
    }
}

async function sendExpiryAlert(users: { userId: string; expiresInMinutes: number }[]) {
    const userList = users.map(u =>
        `<li><strong>${u.userId}</strong> (Expires in ${u.expiresInMinutes} mins)</li>`
    ).join('');

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; color: #333;">
    <h2 style="color: #D97706;">⚠️ Access Expiring Soon</h2>
    <p>The following users have access tokens that will expire in less than 2 hours:</p>
    <ul>
        ${userList}
    </ul>
    <p>
        To renew their access for another 24 hours, run:
    </p>
    <pre style="background: #f3f4f6; padding: 10px; border-radius: 4px;">
${users.map(u => `okastr8 access renew ${u.userId}`).join('\n')}
    </pre>
    <p style="font-size: 12px; color: #666;">
        Running the renew command will generate a NEW token and email it to them automatically.
    </p>
</body>
</html>`;

    await sendAdminEmail('Alert: Access Tokens Expiring Soon', html);
}
