/**
 * Activity Logging System
 * Tracks persistent events (Login, Deploy, Resource) in ~/.okastr8/activity.jsonl
 */

import { join } from 'path';
import { homedir } from 'os';
import { appendFile, readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';

export type ActivityType = 'login' | 'deploy' | 'resource' | 'system';

export interface ActivityEntry {
    id: string;
    timestamp: string;
    type: ActivityType;
    data: any; // Flexible payload
    user?: string; // Masked email (for logins/actions)
}

const ACTIVITY_FILE = join(homedir(), '.okastr8', 'activity.jsonl');

/**
 * Mask email for privacy (johndoe@gmail.com -> joh***@gmail.com)
 */
export function maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email || 'unknown';
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;

    if (local.length <= 3) {
        return `${local[0]}***@${domain}`;
    }
    return `${local.substring(0, 3)}***@${domain}`;
}

/**
 * Log a new activity
 */
export async function logActivity(
    type: ActivityType,
    data: any,
    userEmail?: string
) {
    try {
        const dir = join(homedir(), '.okastr8');
        if (!existsSync(dir)) {
            await mkdir(dir, { recursive: true });
        }

        const entry: ActivityEntry = {
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            type,
            data,
            user: userEmail ? maskEmail(userEmail) : undefined
        };

        // Append to file (JSONL format)
        await appendFile(ACTIVITY_FILE, JSON.stringify(entry) + '\n');

        // Trigger cleanup occasionally (1% chance) to avoid performance hit on every write
        if (Math.random() < 0.01) {
            cleanOldActivities().catch(console.error);
        }
    } catch (error) {
        console.error('Failed to log activity:', error);
    }
}

/**
 * Get recent activity
 */
export async function getRecentActivity(
    limit: number = 50,
    type?: ActivityType,
    date?: string // YYYY-MM-DD
): Promise<ActivityEntry[]> {
    try {
        if (!existsSync(ACTIVITY_FILE)) return [];

        const content = await readFile(ACTIVITY_FILE, 'utf-8');
        const lines = content.trim().split('\n');

        // Parse and filter
        let entries = lines
            .map(line => {
                try { return JSON.parse(line); } catch { return null; }
            })
            .filter(e => e !== null) as ActivityEntry[];

        // Reverse to show newest first
        entries.reverse();

        if (type) {
            entries = entries.filter(e => e.type === type);
        }

        if (date) {
            const targetDate = new Date(date).toDateString(); // "Fri Feb 01 2026"
            entries = entries.filter(e => new Date(e.timestamp).toDateString() === targetDate);
        }

        return entries.slice(0, limit);
    } catch (error) {
        console.error('Failed to get activity:', error);
        return [];
    }
}

/**
 * Get stats for dashboard summary (Today's counts)
 */
export async function getActivityStats() {
    try {
        const entries = await getRecentActivity(1000); // Analyze last 1000 events

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        const todayEntries = entries.filter(e => new Date(e.timestamp).getTime() >= startOfDay);

        return {
            failedDeploysToday: todayEntries.filter(e => e.type === 'deploy' && e.data?.status === 'failed').length,
            resourceWarningsToday: todayEntries.filter(e => e.type === 'resource').length,
            loginsToday: todayEntries.filter(e => e.type === 'login').length
        };
    } catch {
        return { failedDeploysToday: 0, resourceWarningsToday: 0, loginsToday: 0 };
    }
}

/**
 * Cleanup activities older than 7 days
 */
export async function cleanOldActivities() {
    try {
        if (!existsSync(ACTIVITY_FILE)) return;

        const content = await readFile(ACTIVITY_FILE, 'utf-8');
        const lines = content.trim().split('\n');

        const now = Date.now();
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

        const validLines = lines.filter(line => {
            try {
                const entry = JSON.parse(line);
                const time = new Date(entry.timestamp).getTime();
                return (now - time) < SEVEN_DAYS_MS;
            } catch {
                return false;
            }
        });

        if (validLines.length < lines.length) {
            await writeFile(ACTIVITY_FILE, validLines.join('\n') + '\n');
        }
    } catch (error) {
        console.error('Failed to cleanup activity logs:', error);
    }
}
