/**
 * Server Metrics Collection
 * Collects CPU, RAM, uptime for system and per-service
 */

import { cpus, freemem, totalmem, uptime as osUptime, loadavg } from 'os';
import { runCommand } from '../utils/command';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';

export interface ServiceMetrics {
    name: string;
    cpu: number;           // Percentage (0-100+)
    memory: number;        // MB used
    memoryPercent: number; // Percentage of system RAM
    uptime: string;        // e.g., "2d 5h 30m"
    uptimeSeconds: number;
    status: 'running' | 'stopped' | 'failed' | 'unknown';
    pid?: number;
    domain?: string;       // Associated domain (for traffic mapping)
    requestsTotal?: number; // Total requests (from Caddy)
    requestsPerSec?: number; // Requests per second (calculated)
}

export interface SystemMetrics {
    cpu: {
        usage: number;     // Percentage (0-100)
        cores: number;
    };
    memory: {
        used: number;      // MB
        total: number;     // MB
        percent: number;   // Percentage used
        free: number;      // MB
    };
    uptime: string;
    uptimeSeconds: number;
    load: [number, number, number]; // 1m, 5m, 15m load averages
}

export interface TrafficMetrics {
    totalRequests: number;
    byDomain: Record<string, number>; // domain -> request count
}

export interface MetricsResult {
    system: SystemMetrics;
    services: ServiceMetrics[];
    traffic: TrafficMetrics;
    timestamp: string;
}

/**
 * Format seconds into human-readable uptime string
 */
function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

/**
 * Get system-wide metrics
 */
async function getSystemMetrics(): Promise<SystemMetrics> {
    const totalMem = totalmem();
    const freeMem = freemem();
    const usedMem = totalMem - freeMem;
    const uptimeSec = osUptime();
    const load = loadavg() as [number, number, number];
    const cores = cpus().length;

    // Calculate CPU usage from load average (rough approximation)
    // Load average / cores * 100 gives percentage
    const cpuUsage = Math.min(100, (load[0] / cores) * 100);

    return {
        cpu: {
            usage: Math.round(cpuUsage * 10) / 10,
            cores
        },
        memory: {
            used: Math.round(usedMem / 1024 / 1024),
            total: Math.round(totalMem / 1024 / 1024),
            percent: Math.round((usedMem / totalMem) * 100),
            free: Math.round(freeMem / 1024 / 1024)
        },
        uptime: formatUptime(uptimeSec),
        uptimeSeconds: Math.floor(uptimeSec),
        load: [
            Math.round(load[0] * 100) / 100,
            Math.round(load[1] * 100) / 100,
            Math.round(load[2] * 100) / 100
        ]
    };
}

/**
 * Get metrics for a single systemd service
 */
async function getServiceMetrics(serviceName: string): Promise<ServiceMetrics | null> {
    try {
        // Check if service is active
        const statusResult = await runCommand('systemctl', ['is-active', serviceName]);
        const statusOutput = statusResult.stdout.trim();

        let status: ServiceMetrics['status'] = 'unknown';
        if (statusOutput === 'active') status = 'running';
        else if (statusOutput === 'inactive') status = 'stopped';
        else if (statusOutput === 'failed') status = 'failed';
        else status = 'stopped';

        // Default values
        let cpu = 0;
        let memory = 0;
        let uptimeSeconds = 0;
        let pid: number | undefined;

        if (status === 'running') {
            // Get detailed properties
            const showResult = await runCommand('systemctl', [
                'show', serviceName,
                '--property=MainPID,CPUUsageNSec,MemoryCurrent,ActiveEnterTimestampMonotonic'
            ]);

            const props: Record<string, string> = {};
            for (const line of showResult.stdout.split('\n')) {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length) {
                    props[key.trim()] = valueParts.join('=').trim();
                }
            }

            // Parse PID
            if (props.MainPID && props.MainPID !== '0') {
                pid = parseInt(props.MainPID, 10);
            }

            // Parse memory (MemoryCurrent is in bytes, may be "[not set]")
            if (props.MemoryCurrent && !props.MemoryCurrent.includes('not set')) {
                const memBytes = parseInt(props.MemoryCurrent, 10);
                if (!isNaN(memBytes)) {
                    memory = Math.round(memBytes / 1024 / 1024); // MB
                }
            }

            // Fallback: try cgroup memory file
            if (memory === 0) {
                const cgroupPath = `/sys/fs/cgroup/system.slice/${serviceName}.service/memory.current`;
                if (existsSync(cgroupPath)) {
                    try {
                        const memContent = await readFile(cgroupPath, 'utf-8');
                        const memBytes = parseInt(memContent.trim(), 10);
                        if (!isNaN(memBytes)) {
                            memory = Math.round(memBytes / 1024 / 1024);
                        }
                    } catch { }
                }
            }

            // Parse CPU (CPUUsageNSec is nanoseconds since service start)
            // This is cumulative, so we'd need to track delta for real %
            // For now, we'll use a simpler approach via ps if PID available
            if (pid) {
                const psResult = await runCommand('ps', ['-p', pid.toString(), '-o', '%cpu', '--no-headers']);
                const cpuStr = psResult.stdout.trim();
                if (cpuStr) {
                    cpu = parseFloat(cpuStr) || 0;
                }
            }

            // Parse uptime from ActiveEnterTimestampMonotonic (microseconds)
            if (props.ActiveEnterTimestampMonotonic && props.ActiveEnterTimestampMonotonic !== '0') {
                try {
                    const startMonotonicUSec = parseInt(props.ActiveEnterTimestampMonotonic, 10);
                    const systemUptimeSec = osUptime();
                    // System uptime is in seconds, convert to microseconds roughly or just compare seconds
                    // Actually, simple math: uptime = system_uptime - (start_monotonic / 1M)
                    if (!isNaN(startMonotonicUSec)) {
                        uptimeSeconds = Math.max(0, Math.floor(systemUptimeSec - (startMonotonicUSec / 1000000)));
                    }
                } catch { }
            }
        }

        const totalMem = totalmem() / 1024 / 1024; // MB

        return {
            name: serviceName,
            cpu: Math.round(cpu * 10) / 10,
            memory,
            memoryPercent: Math.round((memory / totalMem) * 100 * 10) / 10,
            uptime: formatUptime(uptimeSeconds),
            uptimeSeconds,
            status,
            pid
        };
    } catch (error) {
        console.error(`Error getting metrics for ${serviceName}:`, error);
        return null;
    }
}

/**
 * Get all okastr8-managed services
 */
async function getOkastr8Services(): Promise<string[]> {
    const services: string[] = ['okastr8-manager'];

    // Get all deployed apps
    try {
        const { listApps } = await import('./app');
        const result = await listApps();
        if (result.success && Array.isArray(result.apps)) {
            for (const app of result.apps) {
                if (app?.name) {
                    services.push(app.name);
                }
            }
        }
    } catch { }

    return services;
}

// Store previous request counts for rate calculation
let previousRequestCounts: Record<string, { count: number; timestamp: number }> = {};

/**
 * Scrape Caddy metrics from admin API
 * Returns request counts per domain/host
 */
async function getCaddyMetrics(): Promise<TrafficMetrics> {
    const result: TrafficMetrics = {
        totalRequests: 0,
        byDomain: {}
    };

    try {
        // Caddy admin API serves Prometheus metrics at localhost:2019/metrics
        const response = await fetch('http://localhost:2019/metrics');
        if (!response.ok) {
            return result;
        }

        const text = await response.text();

        // Parse Prometheus format for caddy_http_requests_total
        // Format: caddy_http_requests_total{handler="...",host="example.com",...} 123
        const lines = text.split('\n');

        for (const line of lines) {
            // Skip comments and empty lines
            if (line.startsWith('#') || !line.trim()) continue;

            // Match caddy_http_requests_total metric
            if (line.startsWith('caddy_http_requests_total')) {
                // Extract host label and value
                const hostMatch = line.match(/host="([^"]+)"/);
                const valueMatch = line.match(/\}\s+(\d+(?:\.\d+)?)/);

                if (hostMatch && hostMatch[1] && valueMatch && valueMatch[1]) {
                    const host = hostMatch[1];
                    const count = parseInt(valueMatch[1], 10);

                    if (!isNaN(count)) {
                        // Accumulate per host (there may be multiple lines per host with different handlers)
                        result.byDomain[host] = (result.byDomain[host] || 0) + count;
                        result.totalRequests += count;
                    }
                }
            }
        }
    } catch (error) {
        // Caddy metrics not available (Caddy not running or metrics not enabled)
        // Silently return empty result
    }

    return result;
}

/**
 * Get app metadata to find domain mappings
 */
async function getAppDomains(): Promise<Record<string, string>> {
    const domainToApp: Record<string, string> = {};

    try {
        const { listApps } = await import('./app');
        const result = await listApps();
        if (result.success && Array.isArray(result.apps)) {
            for (const app of result.apps) {
                if (app?.name && app?.domain) {
                    domainToApp[app.domain] = app.name;
                }
            }
        }
    } catch { }

    return domainToApp;
}

/**
 * Collect all metrics
 */
export async function collectMetrics(): Promise<MetricsResult> {
    const [system, serviceNames, traffic, domainToApp] = await Promise.all([
        getSystemMetrics(),
        getOkastr8Services(),
        getCaddyMetrics(),
        getAppDomains()
    ]);

    // Build reverse mapping: app name -> domain
    const appToDomain: Record<string, string> = {};
    for (const [domain, appName] of Object.entries(domainToApp)) {
        appToDomain[appName] = domain;
    }

    const now = Date.now();
    const serviceMetrics: ServiceMetrics[] = [];

    for (const name of serviceNames) {
        const metrics = await getServiceMetrics(name);
        if (metrics) {
            // Add domain and traffic info
            const domain = appToDomain[name];
            if (domain) {
                metrics.domain = domain;
                metrics.requestsTotal = traffic.byDomain[domain] || 0;

                // Calculate requests per second from previous reading
                const prev = previousRequestCounts[domain];
                if (prev && now > prev.timestamp) {
                    const timeDelta = (now - prev.timestamp) / 1000; // seconds
                    const countDelta = metrics.requestsTotal - prev.count;
                    metrics.requestsPerSec = Math.max(0, Math.round((countDelta / timeDelta) * 10) / 10);
                } else {
                    metrics.requestsPerSec = 0;
                }

                // Store current reading for next rate calculation
                previousRequestCounts[domain] = {
                    count: metrics.requestsTotal,
                    timestamp: now
                };
            }

            serviceMetrics.push(metrics);
        }
    }

    return {
        system,
        services: serviceMetrics,
        traffic,
        timestamp: new Date().toISOString()
    };
}
