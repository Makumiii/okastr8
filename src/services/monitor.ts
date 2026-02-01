import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { sendAdminEmail } from './email';
import { getSystemConfig } from '../config';
import { logActivity } from '../utils/activity';

const execAsync = promisify(exec);

interface MonitorState {
    lastCpuAlert: number;
    lastRamAlert: number;
    lastDiskAlert: number;
}

interface ResourceAlertSettings {
    enabled?: boolean;
    interval?: string;
    ram_threshold?: number;
    cpu_threshold?: number;
    disk_threshold?: number;
}

const state: MonitorState = {
    lastCpuAlert: 0,
    lastRamAlert: 0,
    lastDiskAlert: 0
};

// 1 hour debounce for repeated alerts
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;

export function startResourceMonitor() {
    console.log('Resource monitor started');

    // Initial delay to let system settle
    setTimeout(runMonitorLoop, 10000);
}

async function runMonitorLoop() {
    try {
        const config = await getSystemConfig();
        const settings: ResourceAlertSettings | undefined = config?.notifications?.alerts?.resources;

        if (!settings || !settings.enabled) {
            // Check again in 5m
            setTimeout(runMonitorLoop, 5 * 60 * 1000);
            return;
        }

        // Parse interval (e.g., '5m')
        const intervalStr = settings.interval || '5m';
        const match = intervalStr.match(/^(\d+)(m|h|s)$/);
        let intervalMs = 5 * 60 * 1000;

        if (match) {
            const val = parseInt(match[1]!);
            const unit = match[2];
            if (unit === 's') intervalMs = val * 1000;
            if (unit === 'm') intervalMs = val * 60 * 1000;
            if (unit === 'h') intervalMs = val * 60 * 60 * 1000;
        }

        await checkResources(settings);

        setTimeout(runMonitorLoop, intervalMs);
    } catch (error) {
        console.error('Monitor loop error:', error);
        setTimeout(runMonitorLoop, 60000); // Retry in 1m on error
    }
}

async function checkResources(settings: ResourceAlertSettings) {
    const now = Date.now();

    // 1. RAM Check
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPercent = Math.round((usedMem / totalMem) * 100);

    if (ramPercent > (settings.ram_threshold || 90)) {
        if (now - state.lastRamAlert > ALERT_COOLDOWN_MS) {
            await sendResourceAlert('RAM', ramPercent, settings.ram_threshold || 90);
            state.lastRamAlert = now;
        }
    }

    // 2. CPU Check
    const cpuPercent = await getCpuUsage();
    if (cpuPercent > (settings.cpu_threshold || 90)) {
        if (now - state.lastCpuAlert > ALERT_COOLDOWN_MS) {
            await sendResourceAlert('CPU', cpuPercent, settings.cpu_threshold || 90);
            state.lastCpuAlert = now;
        }
    }

    // 3. Disk Check
    try {
        const diskPercent = await getDiskUsage();
        if (diskPercent > (settings.disk_threshold || 90)) {
            if (now - state.lastDiskAlert > ALERT_COOLDOWN_MS) {
                await sendResourceAlert('Disk', diskPercent, settings.disk_threshold || 90);
                state.lastDiskAlert = now;
            }
        }
    } catch (e) {
        console.error('Failed to check disk:', e);
    }
}

async function getCpuUsage(): Promise<number> {
    const start = os.cpus();

    await new Promise(resolve => setTimeout(resolve, 1000)); // Sample 1 second

    const end = os.cpus();

    let idle = 0;
    let total = 0;

    for (let i = 0; i < start.length; i++) {
        const cpuStart = start[i];
        const cpuEnd = end[i];

        if (!cpuStart || !cpuEnd) continue;

        const startTimes = cpuStart.times;
        const endTimes = cpuEnd.times;

        const startTotal = startTimes.user + startTimes.nice + startTimes.sys + startTimes.idle + startTimes.irq;
        const endTotal = endTimes.user + endTimes.nice + endTimes.sys + endTimes.idle + endTimes.irq;

        const tickIdle = endTimes.idle - startTimes.idle;
        const tickTotal = endTotal - startTotal;

        idle += tickIdle;
        total += tickTotal;
    }

    // Average across all cores
    return total === 0 ? 0 : Math.round(100 - (100 * idle / total));
}

async function getDiskUsage(): Promise<number> {
    // Check root partition
    const { stdout } = await execAsync('df -P /');
    const lines = stdout.trim().split('\n');
    if (lines.length < 2) return 0;

    // Filesystem 1024-blocks Used Available Capacity Mounted on
    // /dev/sda1  ... ... ... 45% /
    const parts = lines[1]!.split(/\s+/);
    const capacityStr = parts.find((p: string) => p.endsWith('%')); // Find the one with %

    if (capacityStr) {
        return parseInt(capacityStr.replace('%', ''));
    }
    return 0;
}

async function sendResourceAlert(resource: string, current: number, threshold: number) {
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; color: #333;">
    <h2 style="color: #DC2626;">🚨 High ${resource} Usage Alert</h2>
    <p>Your server resource usage has exceeded the configured threshold.</p>
    
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

    console.log(`Sending ${resource} alert: ${current}% > ${threshold}%`);
    await logActivity('resource', { resource, current, threshold });
    await sendAdminEmail(`Alert: High ${resource} Usage (${current}%)`, html);
}
