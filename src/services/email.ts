/**
 * Brevo Email Service
 * Handles sending automated emails for alerts and notifications
 */

import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { parse as parseYaml } from 'yaml';

// ============ Types ============

interface BrevoConfig {
    apiKey: string;
    senderEmail: string;
    senderName: string;
    adminEmail: string;
}

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

// ============ Config ============

const SYSTEM_YAML_PATH = join(homedir(), '.okastr8', 'system.yaml');

async function getBrevoConfig(): Promise<BrevoConfig | null> {
    try {
        if (!existsSync(SYSTEM_YAML_PATH)) {
            console.error('Email: system.yaml not found');
            return null;
        }

        const content = await readFile(SYSTEM_YAML_PATH, 'utf-8');
        const config = parseYaml(content);

        const brevo = config?.notifications?.brevo;
        if (!brevo?.api_key) {
            console.error('Email: Brevo config not found in system.yaml');
            return null;
        }

        return {
            apiKey: brevo.api_key,
            senderEmail: brevo.sender_email || 'robot@makumitech.co.ke',
            senderName: brevo.sender_name || 'okastr8',
            adminEmail: brevo.admin_email || ''
        };
    } catch (error: any) {
        console.error('Email: Failed to load config:', error.message);
        return null;
    }
}

// ============ Email Sending ============

/**
 * Send an email via Brevo SMTP API
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    const config = await getBrevoConfig();
    if (!config) {
        return { success: false, error: 'Email not configured. Add brevo config to system.yaml' };
    }

    const mailOptions = {
        sender: {
            name: config.senderName,
            email: config.senderEmail
        },
        to: [{ email: options.to }],
        subject: options.subject,
        htmlContent: options.html,
        textContent: options.text
    };

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': config.apiKey,
                'Accept': 'application/json'
            },
            body: JSON.stringify(mailOptions)
        });

        if (!response.ok) {
            const errorData = await response.json() as { message?: string };
            console.error('Email send failed:', errorData);
            return { success: false, error: errorData.message || 'Failed to send email' };
        }

        const result = await response.json() as { messageId?: string };
        console.log('Email sent successfully:', result.messageId);
        return { success: true };
    } catch (error: any) {
        console.error('Email error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Send email to admin
 */
export async function sendAdminEmail(subject: string, html: string): Promise<{ success: boolean; error?: string }> {
    const config = await getBrevoConfig();
    if (!config?.adminEmail) {
        return { success: false, error: 'Admin email not configured in system.yaml' };
    }

    return sendEmail({
        to: config.adminEmail,
        subject: `[okastr8] ${subject}`,
        html
    });
}

// ============ Email Templates ============

/**
 * Send login approval request email to admin
 */
export async function sendLoginApprovalEmail(
    userEmail: string,
    requestId: string,
    requestTime: string
): Promise<{ success: boolean; error?: string }> {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #8B5CF6, #6366F1); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
        .user-badge { background: #E0E7FF; color: #4338CA; padding: 4px 12px; border-radius: 20px; font-weight: 500; }
        .request-id { font-family: monospace; background: #f3f4f6; padding: 8px 12px; border-radius: 4px; }
        .actions { margin-top: 20px; }
        .action-btn { display: inline-block; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin-right: 10px; }
        .approve { background: #10B981; color: white; }
        .reject { background: #EF4444; color: white; }
        .cli-cmd { background: #1f2937; color: #10B981; padding: 12px 16px; border-radius: 6px; font-family: monospace; margin-top: 16px; }
        .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin: 0;">🔐 Login Approval Request</h2>
        </div>
        <div class="content">
            <p>A user is requesting access to okastr8:</p>
            
            <p><strong>User:</strong> <span class="user-badge">${userEmail}</span></p>
            <p><strong>Time:</strong> ${requestTime}</p>
            <p><strong>Request ID:</strong> <span class="request-id">${requestId.slice(0, 8)}...</span></p>
            
            <p>To approve or reject, run one of these commands:</p>
            
            <div class="cli-cmd">
                okastr8 auth approve ${requestId.slice(0, 8)}<br>
                okastr8 auth reject ${requestId.slice(0, 8)}
            </div>
            
            <p class="footer">
                This request will expire in 5 minutes if not approved.<br>
                If you didn't expect this request, you can safely ignore it.
            </p>
        </div>
    </div>
</body>
</html>`;

    return sendAdminEmail('Login Approval Requested', html);
}

/**
 * Send deployment alert email
 */
export async function sendDeploymentAlertEmail(
    appName: string,
    status: 'success' | 'failed',
    details: string
): Promise<{ success: boolean; error?: string }> {
    const statusEmoji = status === 'success' ? '✅' : '❌';
    const statusColor = status === 'success' ? '#10B981' : '#EF4444';
    const statusText = status === 'success' ? 'Successful' : 'Failed';

    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${statusColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
        .app-name { font-family: monospace; background: #e5e7eb; padding: 4px 8px; border-radius: 4px; }
        .details { background: #1f2937; color: #d1d5db; padding: 12px 16px; border-radius: 6px; font-family: monospace; font-size: 13px; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin: 0;">${statusEmoji} Deployment ${statusText}</h2>
        </div>
        <div class="content">
            <p><strong>Application:</strong> <span class="app-name">${appName}</span></p>
            <p><strong>Status:</strong> ${statusText}</p>
            <p><strong>Details:</strong></p>
            <div class="details">${details}</div>
        </div>
    </div>
</body>
</html>`;

    return sendAdminEmail(`Deployment ${statusText}: ${appName}`, html);
}

/**
 * Send service down alert
 */
export async function sendServiceDownEmail(
    serviceName: string,
    error: string
): Promise<{ success: boolean; error?: string }> {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #EF4444; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
        .service-name { font-family: monospace; background: #FEE2E2; color: #DC2626; padding: 4px 8px; border-radius: 4px; }
        .error { background: #1f2937; color: #FCA5A5; padding: 12px 16px; border-radius: 6px; font-family: monospace; }
        .cli-cmd { background: #1f2937; color: #10B981; padding: 12px 16px; border-radius: 6px; font-family: monospace; margin-top: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin: 0;">🚨 Service Down Alert</h2>
        </div>
        <div class="content">
            <p><strong>Service:</strong> <span class="service-name">${serviceName}</span></p>
            <p><strong>Error:</strong></p>
            <div class="error">${error}</div>
            <p>To restart the service:</p>
            <div class="cli-cmd">okastr8 service restart ${serviceName}</div>
        </div>
    </div>
</body>
</html>`;

    return sendAdminEmail(`Service Down: ${serviceName}`, html);
}

/**
 * Test email configuration
 */
export async function testEmailConfig(): Promise<{ success: boolean; error?: string }> {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #8B5CF6, #6366F1); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin: 0;">✅ Email Configuration Test</h2>
        </div>
        <div class="content">
            <p style="font-size: 18px;">Your okastr8 email notifications are working!</p>
            <p>You will receive alerts for:</p>
            <ul style="text-align: left;">
                <li>Login approval requests</li>
                <li>Deployment status</li>
                <li>Service down alerts</li>
            </ul>
        </div>
    </div>
</body>
</html>`;

    return sendAdminEmail('Email Configuration Test', html);
}

/**
 * Send welcome email with token
 */
export async function sendWelcomeEmail(
    userEmail: string,
    token: string
): Promise<{ success: boolean; error?: string }> {
    const config = await getBrevoConfig();
    if (!config) {
        return { success: false, error: 'Email not configured' };
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #8B5CF6, #6366F1); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
        .token-box { background: #1f2937; color: #10B981; padding: 16px; border-radius: 6px; font-family: monospace; word-break: break-all; margin: 20px 0; font-size: 14px; }
        .footer { margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin: 0;">👋 Welcome to okastr8</h2>
        </div>
        <div class="content">
            <p>You have been granted access to the okastr8 dashboard.</p>
            
            <p><strong>Your Access Token:</strong></p>
            <div class="token-box">${token}</div>
            
            <p style="margin-top: 20px;">
                <strong>How to login:</strong><br>
                1. Go to your dashboard URL<br>
                2. Paste the token above<br>
                3. Wait for admin approval (if enabled)
            </p>
            
            <p class="footer">
                Keep this token safe! It is your only way to access the system.
            </p>
        </div>
    </div>
</body>
</html>`;

    return sendEmail({
        to: userEmail,
        subject: '[okastr8] Your Access Token',
        html
    });
}
