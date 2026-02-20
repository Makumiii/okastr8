/**
 * Advanced Resource Monitor with Duration-Based Alerts
 * Supports both System and Per-App metrics with configurable thresholds
 */

import * as os from "os";
import { sendAdminEmail } from "./email";
import { getSystemConfig } from "../config";
import { logActivity } from "../utils/activity";
import { collectMetrics, type MetricsResult } from "../commands/metrics";
import { writeUnifiedEntry } from "../utils/structured-logger";

// Alert State Tracking
interface AlertState {
    violationStart: number | null; // Timestamp when violation started
    lastAlertSent: number; // Timestamp of last alert sent (for cooldown)
}

// State Store: key = "system:cpu" or "app:my-app:cpu"
const alertStates: Record<string, AlertState> = {};

// Configuration
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between repeated alerts
const DEFAULT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Default Thresholds (used if not configured in system.yaml)
const SYSTEM_DEFAULTS: Record<string, { threshold: number; duration: string; unit?: string }> = {
    cpu_usage: { threshold: 90, duration: "5m", unit: "%" },
    cpu_steal: { threshold: 10, duration: "5m", unit: "%" },
    ram_usage: { threshold: 90, duration: "5m", unit: "%" },
    ram_available: { threshold: 500, duration: "5m", unit: "MB" }, // Trigger if < 500
    swap_usage: { threshold: 20, duration: "5m", unit: "%" },
    swap_rate: { threshold: 50, duration: "5m", unit: "MB/min" },
    oom_kills: { threshold: 1, duration: "10m", unit: "kills" },
    disk_usage: { threshold: 90, duration: "5m", unit: "%" },
    inode_usage: { threshold: 90, duration: "5m", unit: "%" },
    disk_latency: { threshold: 50, duration: "5m", unit: "ms" },
    disk_saturation: { threshold: 80, duration: "5m", unit: "%" },
    packet_drop_rate: { threshold: 1, duration: "5m", unit: "%" },
    packet_error_rate: { threshold: 1, duration: "5m", unit: "%" },
    fd_usage: { threshold: 80, duration: "5m", unit: "%" },
    load_per_core: { threshold: 1.5, duration: "5m", unit: "" },
};

const APP_DEFAULTS: Record<string, { threshold: number; duration: string; unit?: string }> = {
    cpu_usage: { threshold: 80, duration: "5m", unit: "%" },
    cpu_throttling: { threshold: 10, duration: "5m", unit: "%" },
    memory_percent: { threshold: 80, duration: "5m", unit: "%" },
    restart_count: { threshold: 3, duration: "10m", unit: "" },
    restarts_24h: { threshold: 10, duration: "24h", unit: "" },
    state_not_running: { threshold: 1, duration: "1m", unit: "" },
    healthcheck_failures: { threshold: 2, duration: "0m", unit: "" },
    error_rate_5xx: { threshold: 5, duration: "5m", unit: "%" },
    error_rate_4xx: { threshold: 30, duration: "5m", unit: "%" },
    upstream_timeout_rate: { threshold: 1, duration: "5m", unit: "%" },
    upstream_latency: { threshold: 2000, duration: "5m", unit: "ms" },
    volume_usage: { threshold: 80, duration: "5m", unit: "%" },
};

/**
 * Parse duration string (e.g., '5m', '1h', '30s') to milliseconds
 */
function parseDuration(durationStr: string): number {
    const match = durationStr.match(/^(\d+)(s|m|h)$/);
    if (!match || !match[1] || !match[2]) return DEFAULT_DURATION_MS;

    const val = parseInt(match[1]);
    const unit = match[2];
    if (unit === "s") return val * 1000;
    if (unit === "m") return val * 60 * 1000;
    if (unit === "h") return val * 60 * 60 * 1000;
    return DEFAULT_DURATION_MS;
}

/**
 * Check if alert should fire based on duration
 */
function shouldAlert(key: string, isViolating: boolean, requiredDurationMs: number): boolean {
    const now = Date.now();

    if (!alertStates[key]) {
        alertStates[key] = { violationStart: null, lastAlertSent: 0 };
    }

    const state = alertStates[key];

    if (!isViolating) {
        // Reset violation start when condition clears
        state.violationStart = null;
        return false;
    }

    // Mark when violation started
    if (state.violationStart === null) {
        state.violationStart = now;
    }

    const violatingFor = now - state.violationStart;

    // Check if violation has persisted long enough AND cooldown has passed
    if (violatingFor >= requiredDurationMs && now - state.lastAlertSent > ALERT_COOLDOWN_MS) {
        state.lastAlertSent = now;
        return true;
    }

    return false;
}

/**
 * Main Monitor Loop
 */
export function startResourceMonitor() {
    void writeUnifiedEntry({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "system",
        service: "resource-monitor",
        message: "Resource monitor started",
        action: "monitor-start",
    });
    setTimeout(runMonitorLoop, 10000); // Initial delay
}

async function runMonitorLoop() {
    try {
        const config = await getSystemConfig();
        const systemAlerts = config?.notifications?.alerts?.system;
        const appAlerts = config?.notifications?.alerts?.apps;
        const legacyAlerts = config?.notifications?.alerts?.resources;

        // Check if any alert system is enabled
        const anyEnabled = systemAlerts?.enabled || appAlerts?.enabled || legacyAlerts?.enabled;

        if (!anyEnabled) {
            setTimeout(runMonitorLoop, 5 * 60 * 1000);
            return;
        }

        // Collect current metrics
        const metrics = await collectMetrics();

        // Check System Alerts
        if (systemAlerts?.enabled || legacyAlerts?.enabled) {
            await checkSystemAlerts(metrics, systemAlerts?.rules || {}, legacyAlerts);
        }

        // Check App Alerts
        if (appAlerts?.enabled) {
            await checkAppAlerts(metrics, appAlerts.defaults || {}, appAlerts.overrides || {});
        }

        // Calculate next interval
        const intervalStr =
            systemAlerts?.interval || appAlerts?.interval || legacyAlerts?.interval || "5m";
        const intervalMs = parseDuration(intervalStr);

        setTimeout(runMonitorLoop, intervalMs);
    } catch (error) {
        console.error("Monitor loop error:", error);
        if (error instanceof Error) {
            void writeUnifiedEntry({
                timestamp: new Date().toISOString(),
                level: "error",
                source: "system",
                service: "resource-monitor",
                message: "Monitor loop error",
                action: "monitor-error",
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                },
            });
        }
        setTimeout(runMonitorLoop, 60000);
    }
}

/**
 * Check System-Level Alerts
 */
async function checkSystemAlerts(
    metrics: MetricsResult,
    rules: Record<string, { threshold: number; duration?: string }>,
    legacy?: { cpu_threshold?: number; ram_threshold?: number; disk_threshold?: number }
) {
    const getRule = (name: string) =>
        rules[name] || SYSTEM_DEFAULTS[name] || { threshold: 90, duration: "5m" };

    // CPU Usage & Steal
    const cpuRule = getRule("cpu_usage");
    const cpuThreshold = legacy?.cpu_threshold ?? cpuRule.threshold;
    if (
        shouldAlert(
            "system:cpu",
            metrics.system.cpu.usage > cpuThreshold,
            parseDuration(cpuRule.duration || "5m")
        )
    ) {
        await sendSystemAlert("CPU Usage", metrics.system.cpu.usage, cpuThreshold, "%");
    }
    const stealRule = getRule("cpu_steal");
    if (
        shouldAlert(
            "system:steal",
            metrics.system.cpu.steal > stealRule.threshold,
            parseDuration(stealRule.duration || "5m")
        )
    ) {
        await sendSystemAlert("CPU Steal", metrics.system.cpu.steal, stealRule.threshold, "%");
    }

    // RAM Usage & Available
    const ramRule = getRule("ram_usage");
    const ramThreshold = legacy?.ram_threshold ?? ramRule.threshold;
    if (
        shouldAlert(
            "system:ram",
            metrics.system.memory.percent > ramThreshold,
            parseDuration(ramRule.duration || "5m")
        )
    ) {
        await sendSystemAlert("RAM Usage", metrics.system.memory.percent, ramThreshold, "%");
    }
    const availRule = getRule("ram_available");
    if (
        shouldAlert(
            "system:ram_avail",
            metrics.system.memory.available < availRule.threshold,
            parseDuration(availRule.duration || "5m")
        )
    ) {
        await sendSystemAlert(
            "RAM Available",
            metrics.system.memory.available,
            availRule.threshold,
            "MB",
            true
        );
    }

    // Swap Usage & Rate
    const swapRule = getRule("swap_usage");
    if (
        shouldAlert(
            "system:swap",
            metrics.system.swap.percent > swapRule.threshold,
            parseDuration(swapRule.duration || "5m")
        )
    ) {
        await sendSystemAlert("Swap Usage", metrics.system.swap.percent, swapRule.threshold, "%");
    }
    const swapRateRule = getRule("swap_rate");
    const maxSwapRate = Math.max(metrics.system.swap.inRate, metrics.system.swap.outRate);
    if (
        shouldAlert(
            "system:swap_rate",
            maxSwapRate > swapRateRule.threshold,
            parseDuration(swapRateRule.duration || "5m")
        )
    ) {
        await sendSystemAlert("Swap Rate", maxSwapRate, swapRateRule.threshold, "MB/min");
    }

    // Health: OOM Kills
    const oomRule = getRule("oom_kills");
    if (
        shouldAlert(
            "system:oom",
            metrics.system.health.oomKills >= oomRule.threshold,
            parseDuration(oomRule.duration || "10m")
        )
    ) {
        await sendSystemAlert(
            "OOM Kills",
            metrics.system.health.oomKills,
            oomRule.threshold,
            "kills"
        );
    }

    // Disk Usage & Inodes & I/O
    const diskRule = getRule("disk_usage");
    const diskThreshold = legacy?.disk_threshold ?? diskRule.threshold;
    const inodeRule = getRule("inode_usage");
    const ioRule = getRule("disk_saturation");

    for (const mount of metrics.system.disk.mounts) {
        // Space
        if (
            shouldAlert(
                `system:disk:${mount.mount}:space`,
                mount.percent > diskThreshold,
                parseDuration(diskRule.duration || "5m")
            )
        ) {
            await sendSystemAlert(`Disk Space (${mount.mount})`, mount.percent, diskThreshold, "%");
        }
        // Inodes
        if (
            shouldAlert(
                `system:disk:${mount.mount}:inodes`,
                mount.inodesPercent > inodeRule.threshold,
                parseDuration(inodeRule.duration || "5m")
            )
        ) {
            await sendSystemAlert(
                `Disk Inodes (${mount.mount})`,
                mount.inodesPercent,
                inodeRule.threshold,
                "%"
            );
        }
    }
    // Saturation
    if (
        shouldAlert(
            "system:disk_busy",
            metrics.system.disk.io.busyPercent > ioRule.threshold,
            parseDuration(ioRule.duration || "5m")
        )
    ) {
        await sendSystemAlert(
            "Disk Saturation",
            metrics.system.disk.io.busyPercent,
            ioRule.threshold,
            "%"
        );
    }

    // Network & Connections
    const dropRule = getRule("packet_drop_rate");
    const errRule = getRule("packet_error_rate");
    const fdRule = getRule("fd_usage");

    // Limits
    if (
        shouldAlert(
            "system:fd",
            metrics.system.limits.fileDescriptors.percent > fdRule.threshold,
            parseDuration(fdRule.duration || "5m")
        )
    ) {
        await sendSystemAlert(
            "File Descriptors",
            metrics.system.limits.fileDescriptors.percent,
            fdRule.threshold,
            "%"
        );
    }

    // Load per Core
    const loadRule = getRule("load_per_core");
    const loadPerCore = metrics.system.load.avg1 / metrics.system.cpu.cores;
    if (
        shouldAlert(
            "system:load",
            loadPerCore > loadRule.threshold,
            parseDuration(loadRule.duration || "5m")
        )
    ) {
        await sendSystemAlert(
            "Load/Core",
            parseFloat(loadPerCore.toFixed(2)),
            loadRule.threshold,
            ""
        );
    }
}

// Persisted state for reboot detection
let lastBootTime: number | null = null;

async function checkAppAlerts(
    metrics: MetricsResult,
    defaults: Record<string, { threshold: number; duration?: string }>,
    overrides: Record<string, Record<string, { threshold: number; duration?: string }>>
) {
    // 1. System Reboot Check
    if (metrics.system.health.bootTime) {
        if (lastBootTime !== null && metrics.system.health.bootTime > lastBootTime + 5) {
            // Boot time changed significantly -> Reboot
            await sendSystemAlert(
                "System Reboot",
                new Date(metrics.system.health.bootTime * 1000).toLocaleString(),
                0,
                "",
                true
            );
            await logActivity("system", {
                event: "reboot",
                bootTime: metrics.system.health.bootTime,
            });
        }
        lastBootTime = metrics.system.health.bootTime;
    }

    for (const app of metrics.apps) {
        const appName = app.name;
        const appOverrides = overrides[appName] || {};
        const getRule = (name: string) =>
            appOverrides[name] ||
            defaults[name] ||
            APP_DEFAULTS[name] || { threshold: 80, duration: "5m" };

        // State (Not Running)
        const stateRule = getRule("state_not_running");
        if (
            shouldAlert(
                `app:${appName}:state`,
                app.status !== "running",
                parseDuration(stateRule.duration || "1m")
            )
        ) {
            await sendAppAlert(appName, "State", app.status, "running");
        }

        // Resources
        const cpuRule = getRule("cpu_usage");
        if (
            shouldAlert(
                `app:${appName}:cpu`,
                app.resources.cpu > cpuRule.threshold,
                parseDuration(cpuRule.duration || "5m")
            )
        ) {
            await sendAppAlert(appName, "CPU Usage", app.resources.cpu, cpuRule.threshold, "%");
        }
        const throttleRule = getRule("cpu_throttling");
        if (
            app.resources.throttling &&
            shouldAlert(
                `app:${appName}:throttle`,
                app.resources.throttling > throttleRule.threshold,
                parseDuration(throttleRule.duration || "5m")
            )
        ) {
            await sendAppAlert(
                appName,
                "CPU Throttling",
                app.resources.throttling,
                throttleRule.threshold,
                "%"
            );
        }
        const memRule = getRule("memory_percent");
        if (
            app.resources.memoryLimit > 0 &&
            shouldAlert(
                `app:${appName}:mem`,
                app.resources.memoryPercent > memRule.threshold,
                parseDuration(memRule.duration || "5m")
            )
        ) {
            await sendAppAlert(
                appName,
                "Memory Usage",
                app.resources.memoryPercent,
                memRule.threshold,
                "%"
            );
        }

        // Restarts & Health
        const restartRule = getRule("restart_count");
        if (
            shouldAlert(
                `app:${appName}:restarts`,
                app.restarts.count >= restartRule.threshold,
                parseDuration(restartRule.duration || "10m")
            )
        ) {
            await sendAppAlert(appName, "Restart Count", app.restarts.count, restartRule.threshold);
        }
        const healthRule = getRule("healthcheck_failures");
        if (
            shouldAlert(
                `app:${appName}:health`,
                app.health.failingStreak >= healthRule.threshold,
                parseDuration(healthRule.duration || "0m")
            )
        ) {
            await sendAppAlert(
                appName,
                "Healthcheck Failures",
                app.health.failingStreak,
                healthRule.threshold
            );
        }

        // Traffic & Latency
        const err5Rule = getRule("error_rate_5xx");
        if (
            app.traffic.totalRequests > 50 &&
            shouldAlert(
                `app:${appName}:5xx`,
                app.traffic.errorRate5xx > err5Rule.threshold,
                parseDuration(err5Rule.duration || "5m")
            )
        ) {
            await sendAppAlert(
                appName,
                "5xx Error Rate",
                app.traffic.errorRate5xx,
                err5Rule.threshold,
                "%"
            );
        }
        const latRule = getRule("upstream_latency");
        if (
            app.traffic.p95Latency &&
            shouldAlert(
                `app:${appName}:latency`,
                app.traffic.p95Latency > latRule.threshold,
                parseDuration(latRule.duration || "5m")
            )
        ) {
            await sendAppAlert(
                appName,
                "p95 Latency",
                app.traffic.p95Latency,
                latRule.threshold,
                "ms"
            );
        }
    }
}

/**
 * Send System Alert Email
 */
async function sendSystemAlert(
    resource: string,
    current: number | string,
    threshold: number,
    unit: string = "%",
    lowerThan: boolean = false
) {
    const operator = lowerThan ? "<" : ">";
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; color: #333;">
    <h2 style="color: #DC2626;"> System Alert: ${resource}</h2>
    <p>Your server resource ${resource} has crossed the threshold.</p>
    
    <div style="background: #FEF2F2; border: 1px solid #FCA5A5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; font-size: 18px;">
            <strong>${resource}:</strong> <span style="color: #DC2626; font-size: 24px;">${current}${unit}</span>
        </p>
        <p style="margin: 5px 0 0 0; color: #7F1D1D; font-size: 14px;">
            Threshold: ${operator} ${threshold}${unit}
        </p>
    </div>

    <p style="font-size: 13px; color: #666;">
        Monitor Host: ${os.hostname()}
    </p>
</body>
</html>`;

    void writeUnifiedEntry({
        timestamp: new Date().toISOString(),
        level: "warn",
        source: "system",
        service: "resource-monitor",
        message: `System alert: ${resource}`,
        action: "system-alert",
        data: { resource, current, threshold, unit, operator },
    });
    await logActivity("resource", { resource, current, threshold, type: "system", unit });
    await sendAdminEmail(`Alert: ${resource} (${current}${unit})`, html);
}

/**
 * Send Per-App Alert Email
 */
async function sendAppAlert(
    appName: string,
    metric: string,
    current: number | string,
    threshold: number | string,
    unit: string = ""
) {
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; color: #333;">
    <h2 style="color: #DC2626;"> App Alert: ${appName}</h2>
    <p>An application metric has exceeded its configured threshold.</p>
    
    <div style="background: #FEF2F2; border: 1px solid #FCA5A5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; font-size: 18px;">
            <strong>App:</strong> ${appName}
        </p>
        <p style="margin: 5px 0 0 0; font-size: 16px;">
            <strong>${metric}:</strong> <span style="color: #DC2626;">${current}${unit}</span> (Threshold: ${threshold}${unit})
        </p>
    </div>

    <p style="font-size: 13px; color: #666;">
        Monitor Host: ${os.hostname()}
    </p>
</body>
</html>`;

    void writeUnifiedEntry({
        timestamp: new Date().toISOString(),
        level: "warn",
        source: "system",
        service: "resource-monitor",
        message: `App alert: ${appName} - ${metric}`,
        action: "app-alert",
        data: { appName, metric, current, threshold, unit },
    });
    await logActivity("resource", {
        resource: metric,
        current,
        threshold,
        type: "app",
        app: appName,
        unit,
    });
    await sendAdminEmail(`Alert: ${appName} - ${metric} (${current}${unit})`, html);
}

export async function triggerResourceAlertTest() {
    const now = new Date().toISOString();
    void writeUnifiedEntry({
        timestamp: now,
        level: "info",
        source: "system",
        service: "resource-monitor",
        message: "Manual resource alert test triggered",
        action: "resource-alert-test",
    });

    await sendSystemAlert("CPU Usage", 95, 80, "%");
    await sendSystemAlert("RAM Usage", 92, 80, "%");
    await sendSystemAlert("Disk Usage", 91, 85, "%");
    await sendSystemAlert("RAM Available", 350, 500, "MB", true);

    await sendAppAlert("test-app", "CPU Usage", 88, 75, "%");
    await sendAppAlert("test-app", "Memory Usage", 86, 75, "%");
    await sendAppAlert("test-app", "p95 Latency", 2500, 2000, "ms");
}
