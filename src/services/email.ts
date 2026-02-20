/**
 * Brevo Email Service
 * Handles sending automated emails for alerts and notifications
 */

import { join } from "path";
import { homedir } from "os";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { parse as parseYaml } from "yaml";
import { writeUnifiedEntry } from "../utils/structured-logger";

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

const SYSTEM_YAML_PATH = join(homedir(), ".okastr8", "system.yaml");

async function getBrevoConfig(): Promise<BrevoConfig | null> {
    try {
        if (!existsSync(SYSTEM_YAML_PATH)) {
            void writeUnifiedEntry({
                timestamp: new Date().toISOString(),
                level: "warn",
                source: "email",
                service: "email",
                message: "system.yaml not found",
                action: "email-config-missing",
            });
            return null;
        }

        const content = await readFile(SYSTEM_YAML_PATH, "utf-8");
        const config = parseYaml(content);

        const brevo = config?.notifications?.brevo;
        if (!brevo?.api_key) {
            void writeUnifiedEntry({
                timestamp: new Date().toISOString(),
                level: "warn",
                source: "email",
                service: "email",
                message: "Brevo config not found in system.yaml",
                action: "email-config-missing",
            });
            return null;
        }

        return {
            apiKey: brevo.api_key,
            senderEmail: brevo.sender_email || "robot@makumitech.co.ke",
            senderName: brevo.sender_name || "okastr8",
            adminEmail: brevo.admin_email || "",
        };
    } catch (error: any) {
        void writeUnifiedEntry({
            timestamp: new Date().toISOString(),
            level: "error",
            source: "email",
            service: "email",
            message: "Failed to load email config",
            action: "email-config-error",
            error: { name: error?.name || "Error", message: error?.message || "Unknown error" },
        });
        return null;
    }
}

// ============ Email Sending ============

/**
 * Send an email via Brevo SMTP API
 */
export async function sendEmail(
    options: EmailOptions
): Promise<{ success: boolean; error?: string }> {
    const config = await getBrevoConfig();
    if (!config) {
        return { success: false, error: "Email not configured. Add brevo config to system.yaml" };
    }

    const mailOptions = {
        sender: {
            name: config.senderName,
            email: config.senderEmail,
        },
        to: [{ email: options.to }],
        subject: options.subject,
        htmlContent: options.html,
        textContent: options.text,
    };

    try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "api-key": config.apiKey,
                Accept: "application/json",
            },
            body: JSON.stringify(mailOptions),
        });

        if (!response.ok) {
            const errorData = (await response.json()) as { message?: string };
            void writeUnifiedEntry({
                timestamp: new Date().toISOString(),
                level: "error",
                source: "email",
                service: "email",
                message: "Email send failed",
                action: "email-send-failed",
                data: { message: errorData.message || "Unknown error" },
            });
            return { success: false, error: errorData.message || "Failed to send email" };
        }

        const result = (await response.json()) as { messageId?: string };
        void writeUnifiedEntry({
            timestamp: new Date().toISOString(),
            level: "info",
            source: "email",
            service: "email",
            message: "Email sent",
            action: "email-sent",
            data: { messageId: result.messageId },
        });
        return { success: true };
    } catch (error: any) {
        void writeUnifiedEntry({
            timestamp: new Date().toISOString(),
            level: "error",
            source: "email",
            service: "email",
            message: "Email send error",
            action: "email-send-error",
            error: { name: error?.name || "Error", message: error?.message || "Unknown error" },
        });
        return { success: false, error: error.message };
    }
}

/**
 * Send email to admin
 */
export async function sendAdminEmail(
    subject: string,
    html: string
): Promise<{ success: boolean; error?: string }> {
    const config = await getBrevoConfig();
    if (!config?.adminEmail) {
        return { success: false, error: "Admin email not configured in system.yaml" };
    }

    return sendEmail({
        to: config.adminEmail,
        subject: `[okastr8] ${subject}`,
        html,
    });
}

// ============ Email Templates ============

/**
 * Send deployment alert email
 */
export async function sendDeploymentAlertEmail(
    appName: string,
    status: "success" | "failed",
    details: string
): Promise<{ success: boolean; error?: string }> {
    const statusColor = status === "success" ? "#10B981" : "#EF4444";
    const statusText = status === "success" ? "Successful" : "Failed";

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
            <h2 style="margin: 0;">Deployment ${statusText}</h2>
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
            <h2 style="margin: 0;">Service Down Alert</h2>
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
