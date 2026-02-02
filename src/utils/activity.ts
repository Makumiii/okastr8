/**
 * Activity Logging System
 * Tracks persistent events (Login, Deploy, Resource) in unified log
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { logPaths, type LogEntry, writeUnifiedEntry } from './structured-logger';

export type ActivityType = 'login' | 'deploy' | 'resource' | 'system';

export interface ActivityEntry {
    id: string;
    timestamp: string;
    type: ActivityType;
    data: any; // Flexible payload
    user?: string; // Masked email (for logins/actions)
}

const UNIFIED_LOG = logPaths.unified;

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
        const entryId = data?.id || randomUUID();
        const timestamp = new Date().toISOString();
        const level =
            type === 'resource'
                ? 'warn'
                : type === 'deploy' && data?.status === 'failed'
                  ? 'error'
                  : 'info';

        await writeUnifiedEntry({
            timestamp,
            level,
            source: 'system',
            service: 'activity',
            message: `${type} activity`,
            traceId: entryId,
            action: type,
            user: userEmail ? maskEmail(userEmail) : undefined,
            app: data?.appName ? { name: data.appName, branch: data.branch, versionId: data.versionId } : undefined,
            data,
        });
    } catch (error) {
        console.error('Failed to log activity:', error);
    }
}

async function readUnifiedEntries(): Promise<LogEntry[]> {
    try {
        if (!existsSync(UNIFIED_LOG)) return [];
        const content = await readFile(UNIFIED_LOG, 'utf-8');
        if (!content.trim()) return [];
        return content
            .trim()
            .split('\n')
            .map((line) => {
                try {
                    return JSON.parse(line) as LogEntry;
                } catch {
                    return null;
                }
            })
            .filter((entry): entry is LogEntry => !!entry);
    } catch (error) {
        console.error('Failed to read unified logs:', error);
        return [];
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
        let entries = await readUnifiedEntries();
        entries = entries.filter((entry) =>
            entry.service === 'activity' &&
            (entry.action === 'login' || entry.action === 'deploy' || entry.action === 'resource' || entry.action === 'system')
        );

        if (type) {
            entries = entries.filter((entry) => entry.action === type);
        }

        if (date) {
            const targetDate = new Date(date).toDateString();
            entries = entries.filter((entry) => new Date(entry.timestamp).toDateString() === targetDate);
        }

        const mapped = entries
            .map((entry): ActivityEntry => ({
                id: entry.traceId || randomUUID(),
                timestamp: entry.timestamp,
                type: entry.action as ActivityType,
                data: entry.data,
                user: entry.user,
            }))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return mapped.slice(0, limit);
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

export async function getDeploymentLog(deploymentId: string): Promise<string | null> {
    const entries = await readUnifiedEntries();
    const lines = entries
        .filter((entry) => entry.traceId === deploymentId && entry.action === 'deploy-log')
        .map((entry) => entry.message);
    if (lines.length === 0) return null;
    return lines.join('\n');
}
