import { readFile } from "fs/promises";
import { runCommand } from "./command";
import { formatUptime } from "./systemMetrics";

export interface AppMetrics {
    name: string;
    domain?: string;
    status: "running" | "stopped" | "failed" | "unknown";
    pid?: number;
    resources: {
        cpu: number; // %
        memory: number; // MB
        memoryPercent: number; // % of limit or system
        memoryLimit: number; // MB
        throttling?: number; // % of time throttled
    };
    uptime: {
        seconds: number;
        readable: string;
        since: string; // ISO date
    };
    health: {
        status: "healthy" | "unhealthy" | "starting" | "none";
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
export async function getAppMetrics(
    appName: string,
    domain?: string,
    caddyMetrics?: any
): Promise<AppMetrics> {
    const metrics: AppMetrics = {
        name: appName,
        domain,
        status: "unknown",
        resources: { cpu: 0, memory: 0, memoryPercent: 0, memoryLimit: 0 },
        uptime: { seconds: 0, readable: "0m", since: "" },
        health: { status: "none", failingStreak: 0 },
        restarts: { count: 0 },
        traffic: { totalRequests: 0, requestsPerSec: 0, errorRate4xx: 0, errorRate5xx: 0 },
        disk: { used: 0 },
    };

    try {
        // 1. Docker Inspect (State, Health, Restarts, Config)
        const inspect = await runCommand("sudo", ["docker", "inspect", appName]);
        if (inspect.exitCode === 0) {
            const data = JSON.parse(inspect.stdout)[0];
            const state = data.State;

            // Status
            if (state.Running) metrics.status = "running";
            else if (state.ExitCode !== 0) metrics.status = "failed";
            else metrics.status = "stopped";

            metrics.pid = state.Pid;
            metrics.restarts.count = data.RestartCount || 0;
            metrics.restarts.lastExitCode = state.ExitCode;
            metrics.restarts.lastExitReason = state.Error || "";

            // Uptime
            if (state.StartedAt) {
                metrics.uptime.since = state.StartedAt;
                if (metrics.status === "running") {
                    const started = new Date(state.StartedAt).getTime();
                    metrics.uptime.seconds = Math.floor((Date.now() - started) / 1000);
                    metrics.uptime.readable = formatUptime(metrics.uptime.seconds);
                }
            }

            // Health - Only if container has HEALTHCHECK configured AND is running
            if (state.Health && metrics.status === "running") {
                const dockerHealthStatus = state.Health.Status?.toLowerCase();
                if (dockerHealthStatus === "healthy") metrics.health.status = "healthy";
                else if (dockerHealthStatus === "unhealthy") metrics.health.status = "unhealthy";
                else if (dockerHealthStatus === "starting") metrics.health.status = "starting";
                metrics.health.failingStreak = state.Health.FailingStreak || 0;
            }

            // Memory Limit
            if (data.HostConfig && data.HostConfig.Memory) {
                metrics.resources.memoryLimit = Math.round(data.HostConfig.Memory / 1024 / 1024);
            }

            // 2. CPU Throttling (Cgroup v2)
            if (metrics.status === "running" && data.Id) {
                try {
                    const cpuStat = await readFile(
                        `/sys/fs/cgroup/system.slice/docker-${data.Id}.scope/cpu.stat`,
                        "utf-8"
                    );
                    const throttledLine = cpuStat
                        .split("\n")
                        .find((l) => l.startsWith("throttled_usec"));
                    const usageLine = cpuStat.split("\n").find((l) => l.startsWith("usage_usec"));
                    if (throttledLine && usageLine) {
                        const throttled = parseInt(throttledLine.split(/\s+/)[1] || "0", 10);
                        const usage = parseInt(usageLine.split(/\s+/)[1] || "0", 10);
                        if (usage > 0) metrics.resources.throttling = (throttled / usage) * 100;
                    }
                } catch {}
            }
        }

        // 3. Docker Stats (CPU, Mem) - Only if running
        if (metrics.status === "running") {
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
    if (unit.startsWith("G")) return Math.round(val * 1024); // MB
    if (unit.startsWith("M")) return Math.round(val); // MB
    if (unit.startsWith("K")) return Math.round(val / 1024); // MB
    return 0;
}
