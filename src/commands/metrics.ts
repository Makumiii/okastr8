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
    diskUsage: number;     // Bytes of container storage
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
    disk: {
        used: number;      // Bytes
        total: number;     // Bytes
        percent: number;   // Percentage used
        free: number;      // Bytes
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

    // Get disk usage via df command
    let diskUsed = 0;
    let diskTotal = 0;
    let diskFree = 0;
    try {
        const dfResult = await runCommand('df', ['-B1', '/']);
        if (dfResult.exitCode === 0) {
            const lines = dfResult.stdout.trim().split('\n');
            if (lines.length >= 2 && lines[1]) {
                // Format: Filesystem     1B-blocks         Used    Available Use% Mounted on
                const parts = lines[1].split(/\s+/);
                if (parts.length >= 4) {
                    diskTotal = parseInt(parts[1] || '0', 10) || 0;
                    diskUsed = parseInt(parts[2] || '0', 10) || 0;
                    diskFree = parseInt(parts[3] || '0', 10) || 0;
                }
            }
        }
    } catch { }

    const diskPercent = diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0;

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
        disk: {
            used: diskUsed,
            total: diskTotal,
            percent: diskPercent,
            free: diskFree
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
 * Get metrics for a single application or service
 * Uses Docker for apps, systemctl for okastr8-manager
 */
async function getServiceMetrics(serviceName: string, diskUsage: number = 0): Promise<ServiceMetrics | null> {
    try {
        let status: ServiceMetrics['status'] = 'unknown';
        let cpu = 0;
        let memory = 0;
        let uptimeSeconds = 0;
        let pid: number | undefined;

        // okastr8-manager runs as systemd service, apps run as Docker containers
        const isManager = serviceName === 'okastr8-manager';

        if (isManager) {
            // Use systemctl for manager service
            const statusResult = await runCommand('systemctl', ['is-active', serviceName]);
            const statusOutput = statusResult.stdout.trim();

            if (statusOutput === 'active') status = 'running';
            else if (statusOutput === 'inactive') status = 'stopped';
            else if (statusOutput === 'failed') status = 'failed';
            else status = 'stopped';

            if (status === 'running') {
                // Get detailed properties from systemctl
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

                // Parse memory
                if (props.MemoryCurrent && !props.MemoryCurrent.includes('not set')) {
                    const memBytes = parseInt(props.MemoryCurrent, 10);
                    if (!isNaN(memBytes)) {
                        memory = Math.round(memBytes / 1024 / 1024);
                    }
                }

                // Parse CPU via ps if PID available
                if (pid) {
                    const psResult = await runCommand('ps', ['-p', pid.toString(), '-o', '%cpu', '--no-headers']);
                    const cpuStr = psResult.stdout.trim();
                    if (cpuStr) {
                        cpu = parseFloat(cpuStr) || 0;
                    }
                }

                // Parse uptime
                if (props.ActiveEnterTimestampMonotonic && props.ActiveEnterTimestampMonotonic !== '0') {
                    try {
                        const startMonotonicUSec = parseInt(props.ActiveEnterTimestampMonotonic, 10);
                        const systemUptimeSec = osUptime();
                        if (!isNaN(startMonotonicUSec)) {
                            uptimeSeconds = Math.max(0, Math.floor(systemUptimeSec - (startMonotonicUSec / 1000000)));
                        }
                    } catch { }
                }
            }
        } else {
            // Use Docker for app containers
            const { containerStatus } = await import('./docker');
            const dockerStatus = await containerStatus(serviceName);

            if (dockerStatus.running) {
                status = 'running';
            } else if (dockerStatus.status === 'exited' || dockerStatus.status === 'stopped') {
                status = 'stopped';
            } else if (dockerStatus.status === 'dead' || dockerStatus.status === 'unhealthy') {
                status = 'failed';
            } else {
                status = dockerStatus.status ? 'stopped' : 'unknown';
            }

            if (status === 'running') {
                // Get Docker stats for CPU and memory
                try {
                    const statsResult = await runCommand('sudo', [
                        'docker', 'stats', serviceName,
                        '--no-stream', '--format', '{{.CPUPerc}}\t{{.MemUsage}}'
                    ]);

                    if (statsResult.exitCode === 0 && statsResult.stdout.trim()) {
                        const [cpuPerc, memUsage] = statsResult.stdout.trim().split('\t');

                        // Parse CPU (e.g., "0.50%")
                        if (cpuPerc) {
                            cpu = parseFloat(cpuPerc.replace('%', '')) || 0;
                        }

                        // Parse memory (e.g., "64.5MiB / 1.94GiB")
                        if (memUsage) {
                            const memMatch = memUsage.match(/^([\d.]+)([A-Za-z]+)/);
                            if (memMatch && memMatch[1] && memMatch[2]) {
                                const value = parseFloat(memMatch[1]);
                                const unit = memMatch[2].toLowerCase();
                                if (unit.includes('gib') || unit.includes('gb')) {
                                    memory = Math.round(value * 1024);
                                } else if (unit.includes('mib') || unit.includes('mb')) {
                                    memory = Math.round(value);
                                } else if (unit.includes('kib') || unit.includes('kb')) {
                                    memory = Math.round(value / 1024);
                                }
                            }
                        }
                    }
                } catch { }

                // Get container uptime via inspect
                try {
                    const inspectResult = await runCommand('sudo', [
                        'docker', 'inspect', serviceName,
                        '--format', '{{.State.StartedAt}}'
                    ]);

                    if (inspectResult.exitCode === 0 && inspectResult.stdout.trim()) {
                        const startedAt = new Date(inspectResult.stdout.trim());
                        if (!isNaN(startedAt.getTime())) {
                            uptimeSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
                        }
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
            diskUsage,
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

// Cache for container disk usage (refreshed every 60 seconds)
let diskUsageCache: { data: Record<string, number>; timestamp: number } = { data: {}, timestamp: 0 };
const DISK_CACHE_TTL = 60000; // 60 seconds

/**
 * Get disk usage for all containers via docker system df -v
 * Returns a map of container name -> disk usage in bytes
 */
async function getContainerDiskUsage(): Promise<Record<string, number>> {
    const now = Date.now();

    // Return cached data if still fresh
    if (now - diskUsageCache.timestamp < DISK_CACHE_TTL) {
        return diskUsageCache.data;
    }

    const result: Record<string, number> = {};

    try {
        // docker system df -v outputs container disk usage in the "Containers space usage" section
        const dfResult = await runCommand('sudo', ['docker', 'system', 'df', '-v']);

        if (dfResult.exitCode === 0 && dfResult.stdout) {
            const lines = dfResult.stdout.split('\n');
            let inContainersSection = false;

            for (const line of lines) {
                // Detect the containers section
                if (line.includes('Containers space usage:')) {
                    inContainersSection = true;
                    continue;
                }

                // End of containers section (next section starts)
                if (inContainersSection && (line.includes('Local Volumes space usage:') || line.includes('Build cache usage:'))) {
                    break;
                }

                // Skip header line and empty lines
                if (inContainersSection && line.trim() && !line.startsWith('CONTAINER')) {
                    // Format: CONTAINER ID   IMAGE   COMMAND   LOCAL VOLUMES   SIZE   CREATED   STATUS   NAMES
                    // The SIZE column is what we want, and NAMES is the container name
                    const parts = line.split(/\s{2,}/); // Split by 2+ spaces

                    if (parts.length >= 6) {
                        // SIZE is typically at index 4, NAMES is the last column
                        const sizeStr = parts[4]?.trim();
                        const name = parts[parts.length - 1]?.trim();

                        if (name && sizeStr) {
                            const bytes = parseSizeToBytes(sizeStr);
                            result[name] = bytes;
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error getting container disk usage:', error);
    }

    // Update cache
    diskUsageCache = { data: result, timestamp: now };

    return result;
}

/**
 * Parse a size string like "2.82MB", "1.5GB", "500kB" to bytes
 */
function parseSizeToBytes(sizeStr: string): number {
    const match = sizeStr.match(/^([\d.]+)\s*([A-Za-z]+)$/);
    if (!match || !match[1] || !match[2]) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    if (unit.startsWith('G')) return Math.round(value * 1024 * 1024 * 1024);
    if (unit.startsWith('M')) return Math.round(value * 1024 * 1024);
    if (unit.startsWith('K')) return Math.round(value * 1024);
    if (unit.startsWith('B')) return Math.round(value);

    return 0;
}

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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

        // Use outer try/catch for error handling
        const response = await fetch('http://localhost:2019/metrics', {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

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
    const [system, serviceNames, traffic, domainToApp, containerDiskUsage] = await Promise.all([
        getSystemMetrics(),
        getOkastr8Services(),
        getCaddyMetrics(),
        getAppDomains(),
        getContainerDiskUsage()
    ]);

    // Build reverse mapping: app name -> domain
    const appToDomain: Record<string, string> = {};
    for (const [domain, appName] of Object.entries(domainToApp)) {
        appToDomain[appName] = domain;
    }

    const now = Date.now();
    const serviceMetrics: ServiceMetrics[] = [];

    for (const name of serviceNames) {
        const diskUsage = containerDiskUsage[name] || 0;
        const metrics = await getServiceMetrics(name, diskUsage);
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
