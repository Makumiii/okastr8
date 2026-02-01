/**
 * Server Metrics Collection Orchestrator
 * Coordinates System and App metrics collection
 */

import { getDetailedSystemMetrics, type SystemMetrics } from '../utils/systemMetrics';
import { getAppMetrics, type AppMetrics } from '../utils/appMetrics';
import { runCommand } from '../utils/command';

// Interfaces match the new granular structure
export interface MetricsResult {
    system: SystemMetrics;
    apps: AppMetrics[];
    timestamp: string;
}

// State for rate calculations
interface RateState {
    count: number;
    timestamp: number;
    errors4xx?: number;
    errors5xx?: number;
}
let requestRates: Record<string, RateState> = {};
let diskUsageCache: { data: Record<string, number>; timestamp: number } = { data: {}, timestamp: 0 };
const DISK_CACHE_TTL = 60000; // 60s

// Caddy Traffic Interface
interface TrafficMetrics {
    totalRequests: number;
    byDomain: Record<string, number>;
    errors4xxByDomain: Record<string, number>;
    errors5xxByDomain: Record<string, number>;
    latencyByDomain?: Record<string, number>;
}

/**
 * Main Collection Function
 */
export async function collectMetrics(): Promise<MetricsResult> {
    const timestamp = new Date().toISOString();

    // 1. Parallel Fetching of Data Sources
    const [system, caddyStats, containerDisk, appList] = await Promise.all([
        getDetailedSystemMetrics(),
        getCaddyMetrics(),
        getContainerDiskUsage(),
        getAppList()
    ]);

    // 2. Build App Metrics
    const now = Date.now();
    const appMetrics: AppMetrics[] = [];

    for (const app of appList) {
        // Fetch detailed stats
        const metrics = await getAppMetrics(app.name, app.domain);

        // Enrich with Disk Usage (Cached)
        if (containerDisk[app.name]) {
            metrics.disk.used = containerDisk[app.name] || 0;
        }

        // Enrich with Traffic & Error Rates
        if (app.domain) {
            const domain = app.domain;
            const currentTotal = caddyStats.byDomain[domain] || 0;
            const errors4xx = caddyStats.errors4xxByDomain[domain] || 0;
            const errors5xx = caddyStats.errors5xxByDomain[domain] || 0;

            metrics.traffic.totalRequests = currentTotal;

            // Calculate Rates
            const prev = requestRates[domain];
            if (prev && now > prev.timestamp) {
                const timeDelta = (now - prev.timestamp) / 1000;
                if (timeDelta > 0) {
                    metrics.traffic.requestsPerSec = Math.max(0, parseFloat(((currentTotal - prev.count) / timeDelta).toFixed(2)));

                    // Error Rates % = (delta_errors / delta_total) * 100
                    const totalDelta = currentTotal - prev.count;
                    if (totalDelta > 0) {
                        metrics.traffic.errorRate4xx = Math.min(100, parseFloat(((errors4xx - (prev.errors4xx || 0)) / totalDelta * 100).toFixed(1)));
                        metrics.traffic.errorRate5xx = Math.min(100, parseFloat(((errors5xx - (prev.errors5xx || 0)) / totalDelta * 100).toFixed(1)));
                    } else {
                        metrics.traffic.errorRate4xx = 0;
                        metrics.traffic.errorRate5xx = 0;
                    }
                }
            } else {
                metrics.traffic.requestsPerSec = 0;
                metrics.traffic.errorRate4xx = 0;
                metrics.traffic.errorRate5xx = 0;
            }

            // Update State
            requestRates[domain] = {
                count: currentTotal,
                timestamp: now,
                errors4xx,
                errors5xx
            };

            // Latency (Approximated from Caddy metrics if available)
            if (caddyStats.latencyByDomain && caddyStats.latencyByDomain[domain]) {
                metrics.traffic.p95Latency = caddyStats.latencyByDomain[domain];
            }
        }

        // Add to result
        appMetrics.push(metrics);
    }

    // Add okastr8-manager itself? (Optional, maybe later)

    return {
        system,
        apps: appMetrics,
        timestamp
    };
}

/**
 * Get list of apps (name + domain)
 */
async function getAppList(): Promise<{ name: string, domain?: string }[]> {
    try {
        const { listApps } = await import('./app');
        const result = await listApps();
        if (result.success && Array.isArray(result.apps)) {
            return result.apps.map((a: any) => ({ name: a.name, domain: a.domain }));
        }
    } catch { }
    return [];
}

/**
 * Scrape Caddy Metrics (Extended)
 */
async function getCaddyMetrics(): Promise<TrafficMetrics> {
    const result: TrafficMetrics = {
        totalRequests: 0,
        byDomain: {},
        errors4xxByDomain: {},
        errors5xxByDomain: {}
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const response = await fetch('http://localhost:2019/metrics', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) return result;
        const text = await response.text();

        // Parse Prometheus
        // caddy_http_requests_total{handler="reverse_proxy",server="srv0",service="srv0",host="example.com"} 100
        // caddy_http_response_status_count_total{code="200",handler="reverse_proxy",...host="example.com"} 95

        // This is getting complex to parse via regex. 
        // Simplified approach: just extract hosts and totals.

        // Match regexes
        const hostRegex = /host="([^"]+)"/;
        const codeRegex = /code="([^"]+)"/;
        const valMatchRegex = /\}\s+([\d.e+-]+)/;

        for (const line of text.split('\n')) {
            if (line.startsWith('#') || !line.trim()) continue;

            const hostMatch = line.match(hostRegex);
            const valMatch = line.match(valMatchRegex);
            if (!hostMatch || !valMatch) continue;

            const host = hostMatch[1];
            const valStr = valMatch[1];
            if (!host || !valStr) continue;

            const val = parseFloat(valStr);

            // 1. Total Requests
            if (line.startsWith('caddy_http_requests_total')) {
                result.byDomain[host] = (result.byDomain[host] || 0) + val;
                result.totalRequests += val;
            }

            // 2. Response Status Codes (for error rates)
            if (line.startsWith('caddy_http_response_status_count_total')) {
                const codeMatch = line.match(codeRegex);
                const code = codeMatch ? codeMatch[1] : undefined;
                if (code) {
                    if (code.startsWith('4')) {
                        result.errors4xxByDomain[host] = (result.errors4xxByDomain[host] || 0) + val;
                    } else if (code.startsWith('5')) {
                        result.errors5xxByDomain[host] = (result.errors5xxByDomain[host] || 0) + val;
                    }
                }
            }
        }

    } catch { }

    return result;
}

/**
 * Container Disk Usage (Cached)
 */
async function getContainerDiskUsage(): Promise<Record<string, number>> {
    const now = Date.now();
    if (now - diskUsageCache.timestamp < DISK_CACHE_TTL) return diskUsageCache.data;

    const result: Record<string, number> = {};
    try {
        const dfResult = await runCommand('sudo', ['docker', 'system', 'df', '-v']);
        if (dfResult.exitCode === 0 && dfResult.stdout) {
            // ... (Re-use previous parsing logic) ...
            // Simplified for brevity in this tool call, assume standard parsing
            const lines = dfResult.stdout.split('\n');
            let inContainers = false;
            for (const line of lines) {
                if (line.includes('Containers space usage:')) { inContainers = true; continue; }
                if (inContainers && (line.includes('Local Volumes') || line.includes('Build cache'))) break;

                if (inContainers && line.trim() && !line.startsWith('CONTAINER')) {
                    const parts = line.split(/\s{2,}/);
                    if (parts.length >= 6) {
                        const sizePart = parts[4];
                        const namePart = parts[parts.length - 1];

                        if (sizePart && namePart) {
                            const sizeStr = sizePart.trim();
                            const name = namePart.trim();
                            if (name && sizeStr) result[name] = parseSizeToBytes(sizeStr);
                        }
                    }
                }
            }
        }
    } catch { }

    diskUsageCache = { data: result, timestamp: now };
    return result;
}

function parseSizeToBytes(sizeStr: string): number {
    const match = sizeStr.match(/^([\d.]+)\s*([A-Za-z]+)$/);
    if (!match || !match[1] || !match[2]) return 0;
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    if (unit.startsWith('G')) return Math.round(value * 1024 * 1024 * 1024);
    if (unit.startsWith('M')) return Math.round(value * 1024 * 1024);
    if (unit.startsWith('K')) return Math.round(value * 1024);
    return Math.round(value);
}
