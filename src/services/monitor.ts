/**
 * Advanced Resource Monitor with Duration-Based Alerts
 * Supports both System and Per-App metrics with configurable thresholds
 */

import * as os from 'os';
import { sendAdminEmail } from './email';
import { getSystemConfig } from '../config';
import { logActivity } from '../utils/activity';
import { collectMetrics, type MetricsResult } from '../commands/metrics';

// Alert State Tracking
interface AlertState {
    violationStart: number | null; // Timestamp when violation started
    lastAlertSent: number;         // Timestamp of last alert sent (for cooldown)
}

// State Store: key = "system:cpu" or "app:my-app:cpu"
const alertStates: Record<string, AlertState> = {};

// Configuration
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between repeated alerts
const DEFAULT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Default Thresholds (used if not configured in system.yaml)
const SYSTEM_DEFAULTS: Record<string, { threshold: number; duration: string }> = {
    cpu_usage: { threshold: 90, duration: '5m' },
    ram_usage: { threshold: 90, duration: '5m' },
    swap_usage: { threshold: 20, duration: '5m' },
    disk_usage: { threshold: 90, duration: '5m' },
    load_per_core: { threshold: 1.5, duration: '5m' },
};

const APP_DEFAULTS: Record<string, { threshold: number; duration: string }> = {
    cpu_usage: { threshold: 80, duration: '5m' },
    memory_percent: { threshold: 80, duration: '5m' },
    restart_count: { threshold: 3, duration: '10m' },
    state_not_running: { threshold: 1, duration: '1m' },
    healthcheck_failures: { threshold: 2, duration: '0m' }, // Immediate
};

/**
 * Parse duration string (e.g., '5m', '1h', '30s') to milliseconds
 */
function parseDuration(durationStr: string): number {
    const match = durationStr.match(/^(\d+)(s|m|h)$/);
    if (!match || !match[1] || !match[2]) return DEFAULT_DURATION_MS;

    const val = parseInt(match[1]);
    const unit = match[2];
    if (unit === 's') return val * 1000;
    if (unit === 'm') return val * 60 * 1000;
    if (unit === 'h') return val * 60 * 60 * 1000;
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
    if (violatingFor >= requiredDurationMs && (now - state.lastAlertSent > ALERT_COOLDOWN_MS)) {
        state.lastAlertSent = now;
        return true;
    }

    return false;
}

/**
 * Main Monitor Loop
 */
export function startResourceMonitor() {
    console.log('Resource monitor started (advanced)');
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
        const intervalStr = systemAlerts?.interval || appAlerts?.interval || legacyAlerts?.interval || '5m';
        const intervalMs = parseDuration(intervalStr);

        setTimeout(runMonitorLoop, intervalMs);
    } catch (error) {
        console.error('Monitor loop error:', error);
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
    const getRule = (name: string) => rules[name] || SYSTEM_DEFAULTS[name] || { threshold: 90, duration: '5m' };

    // CPU Usage
    const cpuRule = getRule('cpu_usage');
    const cpuThreshold = legacy?.cpu_threshold ?? cpuRule.threshold;
    if (shouldAlert('system:cpu', metrics.system.cpu.usage > cpuThreshold, parseDuration(cpuRule.duration || '5m'))) {
        await sendSystemAlert('CPU', metrics.system.cpu.usage, cpuThreshold);
    }

    // RAM Usage
    const ramRule = getRule('ram_usage');
    const ramThreshold = legacy?.ram_threshold ?? ramRule.threshold;
    if (shouldAlert('system:ram', metrics.system.memory.percent > ramThreshold, parseDuration(ramRule.duration || '5m'))) {
        await sendSystemAlert('RAM', metrics.system.memory.percent, ramThreshold);
    }

    // Swap Usage
    const swapRule = getRule('swap_usage');
    if (shouldAlert('system:swap', metrics.system.swap.percent > swapRule.threshold, parseDuration(swapRule.duration || '5m'))) {
        await sendSystemAlert('Swap', metrics.system.swap.percent, swapRule.threshold);
    }

    // Disk Usage (per mount)
    const diskRule = getRule('disk_usage');
    const diskThreshold = legacy?.disk_threshold ?? diskRule.threshold;
    for (const mount of metrics.system.disk.mounts) {
        const key = `system:disk:${mount.mount}`;
        if (shouldAlert(key, mount.percent > diskThreshold, parseDuration(diskRule.duration || '5m'))) {
            await sendSystemAlert(`Disk (${mount.mount})`, mount.percent, diskThreshold);
        }
    }

    // Load per Core
    const loadRule = getRule('load_per_core');
    const loadPerCore = metrics.system.load.avg1 / metrics.system.cpu.cores;
    if (shouldAlert('system:load', loadPerCore > loadRule.threshold, parseDuration(loadRule.duration || '5m'))) {
        await sendSystemAlert('Load/Core', parseFloat(loadPerCore.toFixed(2)), loadRule.threshold);
    }
}

/**
 * Check Per-App Alerts
 */
async function checkAppAlerts(
    metrics: MetricsResult,
    defaults: Record<string, { threshold: number; duration?: string }>,
    overrides: Record<string, Record<string, { threshold: number; duration?: string }>>
) {
    for (const app of metrics.apps) {
        const appName = app.name;
        const appOverrides = overrides[appName] || {};

        const getRule = (name: string) => appOverrides[name] || defaults[name] || APP_DEFAULTS[name] || { threshold: 80, duration: '5m' };

        // State (Not Running)
        const stateRule = getRule('state_not_running');
        const isNotRunning = app.status !== 'running';
        if (shouldAlert(`app:${appName}:state`, isNotRunning, parseDuration(stateRule.duration || '1m'))) {
            await sendAppAlert(appName, 'State', app.status, 'running');
        }

        // CPU Usage
        const cpuRule = getRule('cpu_usage');
        if (shouldAlert(`app:${appName}:cpu`, app.resources.cpu > cpuRule.threshold, parseDuration(cpuRule.duration || '5m'))) {
            await sendAppAlert(appName, 'CPU', app.resources.cpu, cpuRule.threshold);
        }

        // Memory Percent
        const memRule = getRule('memory_percent');
        if (app.resources.memoryLimit > 0 && shouldAlert(`app:${appName}:mem`, app.resources.memoryPercent > memRule.threshold, parseDuration(memRule.duration || '5m'))) {
            await sendAppAlert(appName, 'Memory', app.resources.memoryPercent, memRule.threshold);
        }

        // Restart Count (if available, detected from Docker inspect)
        const restartRule = getRule('restart_count');
        if (shouldAlert(`app:${appName}:restarts`, app.restarts.count >= restartRule.threshold, parseDuration(restartRule.duration || '10m'))) {
            await sendAppAlert(appName, 'Restart Count', app.restarts.count, restartRule.threshold);
        }

        // Healthcheck Failures
        const healthRule = getRule('healthcheck_failures');
        if (shouldAlert(`app:${appName}:health`, app.health.failingStreak >= healthRule.threshold, parseDuration(healthRule.duration || '0m'))) {
            await sendAppAlert(appName, 'Healthcheck Failures', app.health.failingStreak, healthRule.threshold);
        }
    }
}

/**
 * Send System Alert Email
 */
async function sendSystemAlert(resource: string, current: number | string, threshold: number) {
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; color: #333;">
    <h2 style="color: #DC2626;">🚨 High ${resource} Usage Alert</h2>
    <p>Your server resource usage has exceeded the configured threshold for the required duration.</p>
    
    <div style="background: #FEF2F2; border: 1px solid #FCA5A5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; font-size: 18px;">
            <strong>${resource} Usage:</strong> <span style="color: #DC2626; font-size: 24px;">${current}%</span>
        </p>
        <p style="margin: 5px 0 0 0; color: #7F1D1D; font-size: 14px;">
            Threshold: ${threshold}%
        </p>
    </div>

    <p style="font-size: 13px; color: #666;">
        Monitor Host: ${os.hostname()}
    </p>
</body>
</html>`;

    console.log(`[ALERT] System ${resource}: ${current}% > ${threshold}%`);
    await logActivity('resource', { resource, current, threshold, type: 'system' });
    await sendAdminEmail(`Alert: High ${resource} Usage (${current}%)`, html);
}

/**
 * Send Per-App Alert Email
 */
async function sendAppAlert(appName: string, metric: string, current: number | string, threshold: number | string) {
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; color: #333;">
    <h2 style="color: #DC2626;">🚨 App Alert: ${appName}</h2>
    <p>An application metric has exceeded its configured threshold.</p>
    
    <div style="background: #FEF2F2; border: 1px solid #FCA5A5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; font-size: 18px;">
            <strong>App:</strong> ${appName}
        </p>
        <p style="margin: 5px 0 0 0; font-size: 16px;">
            <strong>${metric}:</strong> <span style="color: #DC2626;">${current}</span> (Threshold: ${threshold})
        </p>
    </div>

    <p style="font-size: 13px; color: #666;">
        Monitor Host: ${os.hostname()}
    </p>
</body>
</html>`;

    console.log(`[ALERT] App ${appName} - ${metric}: ${current} > ${threshold}`);
    await logActivity('resource', { resource: metric, current, threshold, type: 'app', app: appName });
    await sendAdminEmail(`Alert: ${appName} - High ${metric} (${current})`, html);
}
