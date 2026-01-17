<script lang="ts">
    import { Card, Badge } from "$lib/components/ui";
    import { get } from "$lib/api";
    import { onMount } from "svelte";
    import {
        Activity,
        Play,
        Square,
        TriangleAlert,
        HelpCircle,
    } from "lucide-svelte";

    // Service metrics from backend
    interface ServiceMetrics {
        name: string;
        cpu: number;
        memory: number;
        memoryPercent: number;
        diskUsage: number;
        uptime: string;
        uptimeSeconds: number;
        status: "running" | "stopped" | "failed" | "unknown";
        domain?: string;
        requestsTotal?: number;
        requestsPerSec?: number;
    }

    // Backend response structure
    interface BackendMetrics {
        system: {
            cpu: { usage: number; cores: number };
            memory: {
                used: number;
                total: number;
                percent: number;
                free: number;
            };
            disk: {
                used: number;
                total: number;
                percent: number;
                free: number;
            };
            uptime: string;
            uptimeSeconds: number;
            load: [number, number, number];
        };
        services: ServiceMetrics[];
        traffic: any;
        timestamp: string;
    }

    // Frontend display structure for system metrics
    interface SystemDisplayMetrics {
        cpu: { usage: number; cores: number };
        memory: { used: number; total: number; usedPercent: number };
        disk: { used: number; total: number; usedPercent: number };
        uptime: number;
        loadAvg: number[];
    }

    let metrics = $state<SystemDisplayMetrics | null>(null);
    let services = $state<ServiceMetrics[]>([]);
    let isLoading = $state(true);
    let error = $state("");

    onMount(() => {
        loadData();
        const interval = setInterval(loadData, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    });

    async function loadData() {
        try {
            const result = await get<BackendMetrics>("/system/metrics");
            if (result.success && result.data?.system) {
                const sys = result.data.system;
                // Map backend structure to frontend display structure
                metrics = {
                    cpu: sys.cpu,
                    memory: {
                        used: sys.memory.used * 1024 * 1024, // Convert MB to bytes for formatBytes
                        total: sys.memory.total * 1024 * 1024,
                        usedPercent: sys.memory.percent,
                    },
                    disk: {
                        used: sys.disk.used, // Already in bytes
                        total: sys.disk.total,
                        usedPercent: sys.disk.percent,
                    },
                    uptime: sys.uptimeSeconds,
                    loadAvg: sys.load,
                };
                // Extract services
                services = result.data.services || [];
            } else {
                error = result.message || "Failed to load metrics";
            }
        } catch (e) {
            error = "Failed to connect to server";
        } finally {
            isLoading = false;
        }
    }

    function formatBytes(bytes: number): string {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    }

    function getColor(percent: number): string {
        if (percent < 60) return "var(--success)";
        if (percent < 85) return "var(--warning)";
        return "var(--error)";
    }

    function getStatusIcon(status: string) {
        switch (status) {
            case "running":
                return Play;
            case "stopped":
                return Square;
            case "failed":
                return TriangleAlert;
            default:
                return HelpCircle;
        }
    }

    function getStatusLabel(status: string): string {
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
</script>

<div class="space-y-6">
    <!-- Header -->
    <div>
        <h1 class="text-2xl font-bold text-[var(--text-primary)]">
            System Metrics
        </h1>
        <p class="mt-1 text-[var(--text-secondary)]">
            Real-time server performance monitoring
        </p>
    </div>

    {#if isLoading}
        <div class="grid gap-6 md:grid-cols-3">
            {#each Array(3) as _}
                <Card class="flex animate-pulse flex-col items-center p-8">
                    <div
                        class="h-32 w-32 rounded-full bg-[var(--border)]"
                    ></div>
                    <div class="mt-4 h-4 w-20 rounded bg-[var(--border)]"></div>
                </Card>
            {/each}
        </div>
    {:else if error}
        <Card class="bg-[var(--error-light)] flex items-center gap-2">
            <TriangleAlert class="text-[var(--error)]" />
            <p class="text-[var(--error)]">{error}</p>
        </Card>
    {:else if metrics}
        <!-- Progress Rings -->
        <div class="grid gap-6 md:grid-cols-3">
            <!-- CPU -->
            <Card class="flex flex-col items-center p-8">
                <div class="relative h-32 w-32">
                    <svg class="h-full w-full -rotate-90" viewBox="0 0 100 100">
                        <circle
                            class="fill-none stroke-[var(--border)]"
                            cx="50"
                            cy="50"
                            r="42"
                            stroke-width="12"
                        />
                        <circle
                            class="fill-none transition-all duration-500"
                            cx="50"
                            cy="50"
                            r="42"
                            stroke-width="12"
                            stroke={getColor(metrics.cpu.usage)}
                            stroke-linecap="round"
                            stroke-dasharray="{metrics.cpu.usage * 2.64}, 264"
                        />
                    </svg>
                    <div
                        class="absolute inset-0 flex flex-col items-center justify-center"
                    >
                        <span
                            class="text-2xl font-bold text-[var(--text-primary)]"
                            >{metrics.cpu.usage.toFixed(0)}%</span
                        >
                    </div>
                </div>
                <h3
                    class="mt-4 text-lg font-semibold text-[var(--text-primary)]"
                >
                    CPU Usage
                </h3>
                <p class="text-sm text-[var(--text-secondary)]">
                    {metrics.cpu.cores} cores
                </p>
            </Card>

            <!-- Memory -->
            <Card class="flex flex-col items-center p-8">
                <div class="relative h-32 w-32">
                    <svg class="h-full w-full -rotate-90" viewBox="0 0 100 100">
                        <circle
                            class="fill-none stroke-[var(--border)]"
                            cx="50"
                            cy="50"
                            r="42"
                            stroke-width="12"
                        />
                        <circle
                            class="fill-none transition-all duration-500"
                            cx="50"
                            cy="50"
                            r="42"
                            stroke-width="12"
                            stroke={getColor(metrics.memory.usedPercent)}
                            stroke-linecap="round"
                            stroke-dasharray="{metrics.memory.usedPercent *
                                2.64}, 264"
                        />
                    </svg>
                    <div
                        class="absolute inset-0 flex flex-col items-center justify-center"
                    >
                        <span
                            class="text-2xl font-bold text-[var(--text-primary)]"
                            >{metrics.memory.usedPercent.toFixed(0)}%</span
                        >
                    </div>
                </div>
                <h3
                    class="mt-4 text-lg font-semibold text-[var(--text-primary)]"
                >
                    Memory
                </h3>
                <p class="text-sm text-[var(--text-secondary)]">
                    {formatBytes(metrics.memory.used)} / {formatBytes(
                        metrics.memory.total,
                    )}
                </p>
            </Card>

            <!-- Disk -->
            <Card class="flex flex-col items-center p-8">
                <div class="relative h-32 w-32">
                    <svg class="h-full w-full -rotate-90" viewBox="0 0 100 100">
                        <circle
                            class="fill-none stroke-[var(--border)]"
                            cx="50"
                            cy="50"
                            r="42"
                            stroke-width="12"
                        />
                        <circle
                            class="fill-none transition-all duration-500"
                            cx="50"
                            cy="50"
                            r="42"
                            stroke-width="12"
                            stroke={getColor(metrics.disk.usedPercent)}
                            stroke-linecap="round"
                            stroke-dasharray="{metrics.disk.usedPercent *
                                2.64}, 264"
                        />
                    </svg>
                    <div
                        class="absolute inset-0 flex flex-col items-center justify-center"
                    >
                        <span
                            class="text-2xl font-bold text-[var(--text-primary)]"
                            >{metrics.disk.usedPercent.toFixed(0)}%</span
                        >
                    </div>
                </div>
                <h3
                    class="mt-4 text-lg font-semibold text-[var(--text-primary)]"
                >
                    Disk
                </h3>
                <p class="text-sm text-[var(--text-secondary)]">
                    {formatBytes(metrics.disk.used)} / {formatBytes(
                        metrics.disk.total,
                    )}
                </p>
            </Card>
        </div>

        <!-- Load Average -->
        <Card>
            <h3 class="mb-4 text-lg font-semibold text-[var(--text-primary)]">
                System Load
            </h3>
            <div class="grid gap-4 md:grid-cols-3">
                {#each [1, 5, 15] as min, i}
                    <div
                        class="rounded-[var(--radius-md)] bg-[var(--bg-sidebar)] p-4"
                    >
                        <p class="text-sm text-[var(--text-secondary)]">
                            {min} min avg
                        </p>
                        <p
                            class="mt-1 text-2xl font-bold text-[var(--text-primary)]"
                        >
                            {metrics.loadAvg[i]?.toFixed(2) || "0.00"}
                        </p>
                    </div>
                {/each}
            </div>
        </Card>

        <!-- Uptime -->
        <Card class="bg-[var(--primary-light)]">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-sm text-[var(--primary)]">Server Uptime</p>
                    <p
                        class="mt-1 text-2xl font-bold text-[var(--text-primary)]"
                    >
                        {Math.floor(metrics.uptime / 86400)}d {Math.floor(
                            (metrics.uptime % 86400) / 3600,
                        )}h {Math.floor((metrics.uptime % 3600) / 60)}m
                    </p>
                </div>
                <Activity size={32} class="text-[var(--primary)]" />
            </div>
        </Card>

        <!-- Service Resource Usage -->
        {#if services.length > 0}
            <div>
                <h2
                    class="mb-4 text-xl font-semibold text-[var(--text-primary)]"
                >
                    Service Resource Usage
                </h2>
                <p class="mb-4 text-sm text-[var(--text-secondary)]">
                    Per-application CPU, memory, and disk consumption
                </p>
            </div>

            <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {#each services as service}
                    {@const Icon = getStatusIcon(service.status)}
                    <Card class="p-4">
                        <!-- Service Header -->
                        <div class="mb-4 flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <Icon size={24} />
                                <h3
                                    class="font-semibold text-[var(--text-primary)] truncate max-w-[150px]"
                                    title={service.name}
                                >
                                    {service.name}
                                </h3>
                            </div>
                            <Badge
                                variant={service.status === "running"
                                    ? "success"
                                    : service.status === "stopped"
                                      ? "error"
                                      : "warning"}
                            >
                                {service.uptime ||
                                    getStatusLabel(service.status)}
                            </Badge>
                        </div>

                        <!-- Metrics Progress Bars -->
                        <div class="space-y-3">
                            <!-- CPU -->
                            <div>
                                <div
                                    class="flex items-center justify-between text-sm mb-1"
                                >
                                    <span class="text-[var(--text-secondary)]"
                                        >CPU</span
                                    >
                                    <span
                                        class="font-medium text-[var(--text-primary)]"
                                        >{service.cpu.toFixed(1)}%</span
                                    >
                                </div>
                                <div
                                    class="h-2 w-full rounded-full bg-[var(--bg-sidebar)] overflow-hidden"
                                >
                                    <div
                                        class="h-full rounded-full transition-all duration-300"
                                        style="width: {Math.min(
                                            service.cpu,
                                            100,
                                        )}%; background-color: {getColor(
                                            service.cpu,
                                        )}"
                                    ></div>
                                </div>
                            </div>

                            <!-- Memory -->
                            <div>
                                <div
                                    class="flex items-center justify-between text-sm mb-1"
                                >
                                    <span class="text-[var(--text-secondary)]"
                                        >Memory</span
                                    >
                                    <span
                                        class="font-medium text-[var(--text-primary)]"
                                        >{service.memory} MB ({service.memoryPercent.toFixed(
                                            1,
                                        )}%)</span
                                    >
                                </div>
                                <div
                                    class="h-2 w-full rounded-full bg-[var(--bg-sidebar)] overflow-hidden"
                                >
                                    <div
                                        class="h-full rounded-full transition-all duration-300"
                                        style="width: {Math.min(
                                            service.memoryPercent,
                                            100,
                                        )}%; background-color: {getColor(
                                            service.memoryPercent,
                                        )}"
                                    ></div>
                                </div>
                            </div>

                            <!-- Disk -->
                            <div>
                                <div
                                    class="flex items-center justify-between text-sm mb-1"
                                >
                                    <span class="text-[var(--text-secondary)]"
                                        >Disk</span
                                    >
                                    <span
                                        class="font-medium text-[var(--text-primary)]"
                                        >{formatBytes(service.diskUsage)}</span
                                    >
                                </div>
                                <div
                                    class="h-2 w-full rounded-full bg-[var(--bg-primary)]"
                                    style="width: {Math.min(
                                        (service.diskUsage /
                                            (1024 * 1024 * 1024)) *
                                            100,
                                        100,
                                    )}%"
                                ></div>
                            </div>
                        </div>

                        <!-- Domain/Traffic Info (if available) -->
                        {#if service.domain}
                            <div
                                class="mt-4 pt-3 border-t border-[var(--border)]"
                            >
                                <div
                                    class="flex items-center justify-between text-sm"
                                >
                                    <span
                                        class="text-[var(--text-secondary)] truncate max-w-[120px]"
                                        title={service.domain}
                                    >
                                        {service.domain}
                                    </span>
                                    {#if service.requestsTotal !== undefined}
                                        <span
                                            class="text-[var(--text-primary)]"
                                        >
                                            {service.requestsTotal} reqs
                                            {#if service.requestsPerSec !== undefined && service.requestsPerSec > 0}
                                                <span
                                                    class="text-[var(--text-secondary)]"
                                                >
                                                    ({service.requestsPerSec}/s)
                                                </span>
                                            {/if}
                                        </span>
                                    {/if}
                                </div>
                            </div>
                        {/if}
                    </Card>
                {/each}
            </div>
        {/if}
    {/if}
</div>
