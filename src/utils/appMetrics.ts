import { runCommand } from './command';
import { formatUptime } from './systemMetrics';

export interface AppMetrics {
    name: string;
    domain?: string;
    status: 'running' | 'stopped' | 'failed' | 'unknown';
    pid?: number;
    resources: {
        cpu: number;          // %
        memory: number;       // MB
        memoryPercent: number;// % of limit or system
        memoryLimit: number;  // MB
        throttling?: number;  // % of time throttled
    };
    uptime: {
        seconds: number;
        readable: string;
        since: string;        // ISO date
    };
    health: {
        status: 'healthy' | 'unhealthy' | 'starting' | 'none';
        failingStreak: number;
    };
    restarts: {
        count: number;
        lastExitCode?: number;
        lastExitReason?: string;
    };
    traffic: {
        totalRequests: number;
        requestsPerSec: number;
        p95Latency?: number; // ms
        errorRate4xx: number; // %
        errorRate5xx: number; // %
    };
    disk: {
        used: number; // Bytes
    };
}

export interface DockerStat {
    CPUPerc: string;
    MemUsage: string;
    MemPerc: string;
    NetIO: string;
    BlockIO: string;
    PIDs: string;
}

/**
 * Get detailed metrics for an app
 */
export async function getAppMetrics(appName: string, domain?: string, caddyMetrics?: any): Promise<AppMetrics> {
    const metrics: AppMetrics = {
        name: appName,
        domain,
        status: 'unknown',
        resources: { cpu: 0, memory: 0, memoryPercent: 0, memoryLimit: 0 },
        uptime: { seconds: 0, readable: '0m', since: '' },
        health: { status: 'none', failingStreak: 0 },
        restarts: { count: 0 },
        traffic: { totalRequests: 0, requestsPerSec: 0, errorRate4xx: 0, errorRate5xx: 0 },
        disk: { used: 0 }
    };

    try {
        // 1. Docker Inspect (State, Health, Restarts, Config)
        const inspect = await runCommand('sudo', ['docker', 'inspect', appName]);
        if (inspect.exitCode === 0) {
            const data = JSON.parse(inspect.stdout)[0];
            const state = data.State;

            // Status
            if (state.Running) metrics.status = 'running';
            else if (state.ExitCode !== 0) metrics.status = 'failed';
            else metrics.status = 'stopped';

            metrics.pid = state.Pid;
            metrics.restarts.count = data.RestartCount || 0;
            metrics.restarts.lastExitCode = state.ExitCode;
            metrics.restarts.lastExitReason = state.Error || '';

            // Uptime
            if (state.StartedAt) {
                metrics.uptime.since = state.StartedAt;
                if (metrics.status === 'running') {
                    const started = new Date(state.StartedAt).getTime();
                    metrics.uptime.seconds = Math.floor((Date.now() - started) / 1000);
                    metrics.uptime.readable = formatUptime(metrics.uptime.seconds);
                }
            }

            // Health - Only if container has HEALTHCHECK configured AND is running
            if (state.Health && metrics.status === 'running') {
                const dockerHealthStatus = state.Health.Status?.toLowerCase();
                // Map Docker health status to our enum
                if (dockerHealthStatus === 'healthy') {
                    metrics.health.status = 'healthy';
                } else if (dockerHealthStatus === 'unhealthy') {
                    metrics.health.status = 'unhealthy';
                } else if (dockerHealthStatus === 'starting') {
                    metrics.health.status = 'starting';
                }
                // else keep default 'none'
                metrics.health.failingStreak = state.Health.FailingStreak || 0;
            }

            // Memory Limit
            if (data.HostConfig && data.HostConfig.Memory) {
                metrics.resources.memoryLimit = Math.round(data.HostConfig.Memory / 1024 / 1024);
            }
        }

        // 2. Docker Stats (CPU, Mem) - Only if running
        if (metrics.status === 'running') {
            const statsCmd = await runCommand('sudo', [
                'docker', 'stats', appName,
                '--no-stream',
                '--format', '{{.CPUPerc}}\t{{.MemUsage}}'
            ]);

            if (statsCmd.exitCode === 0) {
                const [cpu, mem] = statsCmd.stdout.trim().split('\t');

                // CPU: "0.56%" -> 0.56
                if (cpu) metrics.resources.cpu = parseFloat(cpu.replace('%', '')) || 0;

                // Mem: "12MiB / 1GiB"
                if (mem) {
                    const [usedStr, limitStr] = mem.split('/').map((s: string) => s.trim());
                    if (usedStr) metrics.resources.memory = parseBytes(usedStr);
                    if (limitStr && metrics.resources.memoryLimit === 0) {
                        metrics.resources.memoryLimit = parseBytes(limitStr);
                    }
                    if (metrics.resources.memoryLimit > 0) {
                        metrics.resources.memoryPercent = Math.round((metrics.resources.memory / metrics.resources.memoryLimit) * 100);
                    }
                }
            }
        }

        // 3. Disk Usage (docker system df -v logic)
        // ... (This is expensive to run per-app every poll. We should probably cache this at the 'commands/metrics.ts' orchestration layer like before)

        // 4. Traffic Integration (Passed from orchestration layer)
        if (caddyMetrics && domain) {
            // We'll calculate rates in the orchestration layer state, here we just populate if passed
            // For now, placeholders are populated by 'collectMetrics'
        }

    } catch (error) {
        // console.error(`Error collecting app metrics for ${appName}:`, error);
    }

    return metrics;
}

function parseBytes(str: string): number {
    const match = str.match(/^([\d.]+)\s*([A-Za-z]+)$/);
    if (!match || !match[1] || !match[2]) return 0;
    const val = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    if (unit.startsWith('G')) return Math.round(val * 1024); // MB
    if (unit.startsWith('M')) return Math.round(val);      // MB
    if (unit.startsWith('K')) return Math.round(val / 1024); // MB
    return 0;
}
