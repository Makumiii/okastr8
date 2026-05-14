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
        Info,
        Cpu,
        HardDrive,
        MemoryStick,
        Network,
        RefreshCw,
        Heart,
        ArrowDown,
        ArrowUp,
    } from "lucide-svelte";

    // App metrics from new backend structure
    interface AppMetrics {
        name: string;
        domain?: string;
        status: "running" | "stopped" | "failed" | "unknown";
        resources: {
            cpu: number;
            memory: number;
            memoryPercent: number;
            memoryLimit: number;
            throttling?: number;
        };
        uptime: {
            seconds: number;
            readable: string;
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
            p95Latency?: number;
            errorRate4xx: number;
            errorRate5xx: number;
        };
        disk: {
            used: number;
        };
    }

    // Backend response structure
    interface BackendMetrics {
        system: {
            cpu: {
                usage: number;
                cores: number;
                model: string;
                speed: number;
                steal: number;
            };
            memory: {
                used: number;
                total: number;
                percent: number;
                free: number;
                available: number;
                cached?: number; // Optional, might be added later
            };
            swap: {
                used: number;
                total: number;
                percent: number;
                inRate: number;
                outRate: number;
            };
            disk: {
                mounts: {
                    mount: string;
                    used: number;
                    total: number;
                    percent: number;
                    free: number;
                    inodesPercent: number;
                }[];
                io: {
                    readPerSec: number;
                    writePerSec: number;
                    busyPercent: number;
                };
            };
            network: {
                interfaces: {
                    name: string;
                    rxBytes: number;
                    txBytes: number;
                }[];
                totalRxPerSec: number;
                totalTxPerSec: number;
                retransmits: number;
                activeConnections: number;
            };
            limits: {
                fileDescriptors: {
                    used: number;
                    total: number;
                    percent: number;
                };
            };
            health: {
                oomKills: number;
                unexpectedReboot: boolean;
                bootTime?: number;
            };
            load: { avg1: number; avg5: number; avg15: number };
            uptime: { seconds: number; readable: string };
        };
        apps: AppMetrics[];
        timestamp: string;
    }

    // Metric Tooltips
    const TOOLTIPS: Record<string, string> = {
        cpu_usage:
            "Shows how much processing power is being used. High sustained CPU means apps will slow down.",
        ram_usage:
            "High memory use increases risk of crashes and OOM kills. Sustained pressure hurts performance.",
        swap_usage:
            "Swap usage indicates memory pressure. Apps may become slow and unstable when swapping starts.",
        disk_usage:
            "Running out of disk causes databases, logs, and deployments to fail.",
        load_avg:
            "Measures how many tasks are waiting to run. Useful to spot CPU queueing.",
        app_cpu:
            "Shows app CPU pressure. Sustained high CPU can starve other apps.",
        app_memory:
            "Best memory alert. Warns before OOM kills and avoids false alarms.",
        app_restarts:
            "Detects crashloops. Frequent restarts usually mean a broken release.",
        app_health:
            "Confirms functional health, not just 'process is running.'",
    };

    let metrics = $state<BackendMetrics | null>(null);
    let isLoading = $state(true);
    let error = $state("");
    let tooltipVisible = $state<string | null>(null);

    onMount(() => {
        loadData();
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);
    });

    async function loadData() {
        try {
            const result = await get<BackendMetrics>("/system/metrics");
            if (result.success && result.data?.system) {
                metrics = result.data;
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

    function formatRate(bytesPerSec: number): string {
        if (bytesPerSec === 0) return "0 B/s";
        const k = 1024;
        const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
        const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
        return (
            parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(1)) +
            " " +
            sizes[i]
        );
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

    function showTooltip(key: string) {
        tooltipVisible = key;
    }

    function hideTooltip() {
        tooltipVisible = null;
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
        <!-- System Metrics Section -->
        <div>
            <h2
                class="mb-4 text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2"
            >
                <Cpu size={20} /> System Resources
            </h2>
        </div>

        <!-- Progress Rings: CPU, Memory, Swap -->
        <div class="grid gap-6 md:grid-cols-4">
            <!-- CPU -->
            <Card class="flex flex-col items-center p-6 relative">
                <button
                    class="absolute top-2 right-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                    onmouseenter={() => showTooltip("cpu_usage")}
                    onmouseleave={hideTooltip}
                >
                    <Info size={14} />
                </button>
                {#if tooltipVisible === "cpu_usage"}
                    <div
                        class="absolute top-8 right-2 z-10 w-48 p-2 text-xs bg-[var(--surface-dark)] border border-[var(--border)] rounded shadow-lg"
                    >
                        {TOOLTIPS.cpu_usage}
                    </div>
                {/if}
                <div class="relative h-24 w-24">
                    <svg class="h-full w-full -rotate-90" viewBox="0 0 100 100">
                        <circle
                            class="fill-none stroke-[var(--border)]"
                            cx="50"
                            cy="50"
                            r="42"
                            stroke-width="10"
                        />
                        <circle
                            class="fill-none transition-all duration-500"
                            cx="50"
                            cy="50"
                            r="42"
                            stroke-width="10"
                            stroke={getColor(metrics.system.cpu.usage)}
                            stroke-linecap="round"
                            stroke-dasharray="{metrics.system.cpu.usage *
                                2.64}, 264"
                        />
                    </svg>
                    <div
                        class="absolute inset-0 flex flex-col items-center justify-center"
                    >
                        <span
                            class="text-xl font-bold text-[var(--text-primary)]"
                            >{metrics.system.cpu.usage.toFixed(0)}%</span
                        >
                    </div>
                </div>
                <h3
                    class="mt-3 text-sm font-semibold text-[var(--text-primary)]"
                >
                    CPU
                </h3>
                <p
                    class="text-[10px] text-[var(--text-secondary)] font-medium text-center px-2 truncate w-full"
                    title={metrics.system.cpu.model}
                >
                    {metrics.system.cpu.model}
                </p>
                <div class="mt-1 flex flex-col items-center gap-0.5">
                    <p
                        class="text-[10px] text-[var(--text-tertiary)] uppercase font-bold"
                    >
                        {metrics.system.cpu.cores} cores @ {metrics.system.cpu
                            .speed}MHz
                    </p>
                    {#if (metrics.system.cpu.steal || 0) > 0}
                        <p class="text-[10px] text-[var(--error)] font-bold">
                            Steal: {metrics.system.cpu.steal}%
                        </p>
                    {/if}
                </div>
            </Card>

            <!-- Memory -->
            <Card class="flex flex-col items-center p-6 relative">
                <button
                    class="absolute top-2 right-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                    onmouseenter={() => showTooltip("ram_usage")}
                    onmouseleave={hideTooltip}
                >
                    <Info size={14} />
                </button>
                {#if tooltipVisible === "ram_usage"}
                    <div
                        class="absolute top-8 right-2 z-10 w-48 p-2 text-xs bg-[var(--surface-dark)] border border-[var(--border)] rounded shadow-lg"
                    >
                        {TOOLTIPS.ram_usage}
                    </div>
                {/if}
                <div class="relative h-24 w-24">
                    <svg class="h-full w-full -rotate-90" viewBox="0 0 100 100">
                        <circle
                            class="fill-none stroke-[var(--border)]"
                            cx="50"
                            cy="50"
                            r="42"
                            stroke-width="10"
                        />
                        <circle
                            class="fill-none transition-all duration-500"
                            cx="50"
                            cy="50"
                            r="42"
                            stroke-width="10"
                            stroke={getColor(metrics.system.memory.percent)}
                            stroke-linecap="round"
                            stroke-dasharray="{metrics.system.memory.percent *
                                2.64}, 264"
                        />
                    </svg>
                    <div
                        class="absolute inset-0 flex flex-col items-center justify-center"
                    >
                        <span
                            class="text-xl font-bold text-[var(--text-primary)]"
                            >{metrics.system.memory.percent}%</span
                        >
                    </div>
                </div>
                <h3
                    class="mt-3 text-sm font-semibold text-[var(--text-primary)]"
                >
                    RAM
                </h3>
                <p class="text-xs text-[var(--text-secondary)]">
                    {metrics.system.memory.used} / {metrics.system.memory.total}
                    MB
                </p>
                <p
                    class="text-[10px] text-[var(--text-tertiary)] font-bold mt-1 uppercase"
                >
                    {metrics.system.memory.available} MB Available
                </p>
                {#if (metrics.system.memory.cached || 0) > 0}
                    <p
                        class="text-[10px] text-[var(--text-tertiary)] font-bold uppercase"
                    >
                        {metrics.system.memory.cached} MB Cached
                    </p>
                {/if}
            </Card>

            <!-- Swap -->
            <Card class="flex flex-col items-center p-6 relative">
                <button
                    class="absolute top-2 right-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                    onmouseenter={() => showTooltip("swap_usage")}
                    onmouseleave={hideTooltip}
                >
                    <Info size={14} />
                </button>
                {#if tooltipVisible === "swap_usage"}
                    <div
                        class="absolute top-8 right-2 z-10 w-48 p-2 text-xs bg-[var(--surface-dark)] border border-[var(--border)] rounded shadow-lg"
                    >
                        {TOOLTIPS.swap_usage}
                    </div>
                {/if}
                <div class="relative h-24 w-24">
                    <svg class="h-full w-full -rotate-90" viewBox="0 0 100 100">
                        <circle
                            class="fill-none stroke-[var(--border)]"
                            cx="50"
                            cy="50"
                            r="42"
                            stroke-width="10"
                        />
                        <circle
                            class="fill-none transition-all duration-500"
                            cx="50"
                            cy="50"
                            r="42"
                            stroke-width="10"
                            stroke={getColor(metrics.system.swap.percent)}
                            stroke-linecap="round"
                            stroke-dasharray="{metrics.system.swap.percent *
                                2.64}, 264"
                        />
                    </svg>
                    <div
                        class="absolute inset-0 flex flex-col items-center justify-center"
                    >
                        <span
                            class="text-xl font-bold text-[var(--text-primary)]"
                            >{metrics.system.swap.percent}%</span
                        >
                    </div>
                </div>
                <h3
                    class="mt-3 text-sm font-semibold text-[var(--text-primary)]"
                >
                    Swap
                </h3>
                <p class="text-xs text-[var(--text-secondary)]">
                    {metrics.system.swap.used} / {metrics.system.swap.total} MB
                </p>
                <div class="mt-1 flex gap-2 text-[9px] font-mono font-bold">
                    <span
                        class={(metrics.system.swap.inRate || 0) > 0
                            ? "text-[var(--warning)]"
                            : "text-[var(--text-tertiary)]"}
                        >IN: {metrics.system.swap.inRate || 0} MB/m</span
                    >
                    <span
                        class={(metrics.system.swap.outRate || 0) > 0
                            ? "text-[var(--warning)]"
                            : "text-[var(--text-tertiary)]"}
                        >OUT: {metrics.system.swap.outRate || 0} MB/m</span
                    >
                </div>
            </Card>

            <!-- Uptime -->
            <Card
                class="flex flex-col items-center justify-center p-6 bg-[var(--primary-light)]"
            >
                <Activity size={28} class="text-[var(--primary-strong)] mb-2" />
                <h3 class="text-sm font-semibold text-[var(--primary-strong)]">
                    Uptime
                </h3>
                <p class="text-xl font-bold text-[var(--text-primary)]">
                    {metrics.system.uptime.readable}
                </p>
            </Card>
            <!-- Network & I/O Advanced -->
            <Card>
                <div class="flex items-center justify-between mb-4">
                    <h3
                        class="flex items-center gap-2 font-bold uppercase text-[var(--text-tertiary)]"
                    >
                        <span
                            class="i-heroicons-globe-alt text-[var(--primary-strong)]"
                        ></span>
                        Network & I/O
                    </h3>
                </div>
                <div class="space-y-4">
                    <!-- Network Stats -->
                    <div class="grid grid-cols-2 gap-2">
                        <div
                            class="bg-[var(--surface-dark)] p-2 rounded-[var(--radius-sm)]"
                        >
                            <p
                                class="text-[9px] uppercase font-bold text-[var(--text-tertiary)] mb-0.5"
                            >
                                Active Conns
                            </p>
                            <p
                                class="text-sm font-mono font-bold text-[var(--text-primary)]"
                            >
                                {metrics.system.network.activeConnections || 0}
                            </p>
                        </div>
                        <div
                            class="bg-[var(--surface-dark)] p-2 rounded-[var(--radius-sm)]"
                        >
                            <p
                                class="text-[9px] uppercase font-bold text-[var(--text-tertiary)] mb-0.5"
                            >
                                TCP Retrans
                            </p>
                            <p
                                class="text-sm font-mono font-bold {metrics
                                    .system.network.retransmits > 50
                                    ? 'text-[var(--error)]'
                                    : 'text-[var(--text-primary)]'}"
                            >
                                {metrics.system.network.retransmits || 0}
                            </p>
                        </div>
                    </div>
                    <!-- Disk I/O -->
                    <div class="pt-2 border-t border-[var(--border)]">
                        <div class="flex justify-between items-center mb-1">
                            <span
                                class="text-[10px] uppercase font-bold text-[var(--text-tertiary)]"
                                >Disk I/O Saturation</span
                            >
                            <span
                                class="text-[10px] font-bold text-[var(--text-secondary)]"
                                >{metrics.system.disk.io.busyPercent}%</span
                            >
                        </div>
                        <div
                            class="h-1.5 w-full rounded-full bg-[var(--border)] overflow-hidden"
                        >
                            <div
                                class="h-full bg-[var(--warning)] rounded-full"
                                style="width: {metrics.system.disk.io
                                    .busyPercent}%"
                            ></div>
                        </div>
                        <div
                            class="flex justify-between mt-2 text-[10px] font-mono"
                        >
                            <span class="text-[var(--text-secondary)]"
                                >R: {metrics.system.disk.io
                                    .readPerSec}MB/s</span
                            >
                            <span class="text-[var(--text-secondary)]"
                                >W: {metrics.system.disk.io
                                    .writePerSec}MB/s</span
                            >
                        </div>
                    </div>
                </div>
            </Card>

            <!-- System Health & Status -->
            <Card>
                <div class="flex items-center justify-between mb-4">
                    <h3
                        class="flex items-center gap-2 font-bold uppercase text-[var(--text-tertiary)]"
                    >
                        <span class="i-heroicons-heart text-[var(--error)]"
                        ></span>
                        System Health
                    </h3>
                </div>
                <div class="space-y-3">
                    <div
                        class="flex justify-between items-center p-2 bg-[var(--surface-dark)] rounded-[var(--radius-sm)]"
                    >
                        <span
                            class="text-xs font-medium text-[var(--text-secondary)]"
                            >OOM Kills</span
                        >
                        <span
                            class="text-xs font-bold font-mono {metrics.system
                                .health.oomKills > 0
                                ? 'text-[var(--error)] animate-pulse'
                                : 'text-[var(--success)]'}"
                            >{metrics.system.health.oomKills || 0}</span
                        >
                    </div>
                    <div
                        class="flex justify-between items-center p-2 bg-[var(--surface-dark)] rounded-[var(--radius-sm)]"
                    >
                        <span
                            class="text-xs font-medium text-[var(--text-secondary)]"
                            >Reboot Status</span
                        >
                        <span
                            class="text-xs font-bold uppercase {metrics.system
                                .health.unexpectedReboot
                                ? 'text-[var(--error)]'
                                : 'text-[var(--success)]'}"
                        >
                            {metrics.system.health.unexpectedReboot
                                ? "UNEXPECTED"
                                : "Stable"}
                        </span>
                    </div>
                    <div class="pt-2 border-t border-[var(--border)]">
                        <div class="flex justify-between items-center mb-1">
                            <span
                                class="text-[10px] uppercase font-bold text-[var(--text-tertiary)]"
                                >File Descriptors</span
                            >
                            <span
                                class="text-[10px] font-bold text-[var(--text-secondary)]"
                                >{metrics.system.limits.fileDescriptors
                                    .percent || 0}%</span
                            >
                        </div>
                        <div
                            class="h-1.5 w-full rounded-full bg-[var(--border)] overflow-hidden"
                        >
                            <div
                                class="h-full bg-[var(--primary)] rounded-full"
                                style="width: {metrics.system.limits
                                    .fileDescriptors.percent}%"
                            ></div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>

        <!-- Disk Mounts -->
        <Card>
            <h3
                class="mb-4 text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2"
            >
                <HardDrive size={18} /> Disk Usage
                <button
                    class="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                    onmouseenter={() => showTooltip("disk_usage")}
                    onmouseleave={hideTooltip}
                >
                    <Info size={14} />
                </button>
                {#if tooltipVisible === "disk_usage"}
                    <span
                        class="text-xs font-normal text-[var(--text-secondary)] ml-2"
                        >{TOOLTIPS.disk_usage}</span
                    >
                {/if}
            </h3>
            <div class="grid gap-4 md:grid-cols-3">
                <div class="col-span-3 overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="bg-[var(--surface-dark)]">
                            <tr>
                                <th
                                    class="p-3 text-left text-xs font-bold uppercase text-[var(--text-tertiary)]"
                                    >Mount</th
                                >
                                <th
                                    class="p-3 text-left text-xs font-bold uppercase text-[var(--text-tertiary)]"
                                    >Usage</th
                                >
                                <th
                                    class="p-3 text-left text-xs font-bold uppercase text-[var(--text-tertiary)]"
                                    >Inodes</th
                                >
                                <th
                                    class="p-3 text-right text-xs font-bold uppercase text-[var(--text-tertiary)]"
                                    >Capacity</th
                                >
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[var(--border)]">
                            {#each metrics.system.disk.mounts as mount}
                                <tr class="hover:bg-[var(--surface-dark)]">
                                    <td
                                        class="p-3 text-sm font-medium text-[var(--text-primary)]"
                                        >{mount.mount}</td
                                    >
                                    <td class="p-3">
                                        <div class="flex items-center gap-2">
                                            <div
                                                class="h-2 w-24 rounded-full bg-[var(--border)]"
                                            >
                                                <div
                                                    class="h-full rounded-full bg-[var(--primary)]"
                                                    style="width: {mount.percent}%"
                                                ></div>
                                            </div>
                                            <span
                                                class="text-xs font-bold text-[var(--text-secondary)]"
                                                >{mount.percent}%</span
                                            >
                                        </div>
                                    </td>
                                    <td class="p-3">
                                        <span
                                            class="text-xs font-medium {(mount.inodesPercent ||
                                                0) > 80
                                                ? 'text-[var(--error)] animate-pulse'
                                                : 'text-[var(--text-secondary)]'}"
                                        >
                                            {mount.inodesPercent || 0}%
                                        </span>
                                    </td>
                                    <td
                                        class="p-3 text-right text-sm text-[var(--text-secondary)] italic"
                                    >
                                        {formatBytes(mount.total)}
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </div>
        </Card>

        <!-- Load Average -->
        <Card>
            <h3
                class="mb-4 text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2"
            >
                <Cpu size={18} /> Load Average
                <button
                    class="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                    onmouseenter={() => showTooltip("load_avg")}
                    onmouseleave={hideTooltip}
                >
                    <Info size={14} />
                </button>
                {#if tooltipVisible === "load_avg"}
                    <span
                        class="text-xs font-normal text-[var(--text-secondary)] ml-2"
                        >{TOOLTIPS.load_avg}</span
                    >
                {/if}
            </h3>
            <div class="grid gap-4 md:grid-cols-3">
                {#each [{ label: "1 min", value: metrics.system.load.avg1 }, { label: "5 min", value: metrics.system.load.avg5 }, { label: "15 min", value: metrics.system.load.avg15 }] as item}
                    <div
                        class="rounded-[var(--radius-md)] bg-[var(--bg-sidebar)] p-4"
                    >
                        <p class="text-sm text-[var(--text-secondary)]">
                            {item.label}
                        </p>
                        <p
                            class="mt-1 text-2xl font-bold text-[var(--text-primary)]"
                        >
                            {item.value.toFixed(2)}
                        </p>
                    </div>
                {/each}
            </div>
        </Card>

        <!-- Network Traffic -->
        <Card>
            <h3
                class="mb-4 text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2"
            >
                <Network size={18} /> Network Traffic
            </h3>

            <!-- Global Rates -->
            <div class="grid gap-4 md:grid-cols-2 mb-6">
                <div
                    class="rounded-[var(--radius-md)] bg-[var(--bg-sidebar)] p-4 border-l-4 border-[var(--success)]"
                >
                    <p
                        class="text-xs font-bold uppercase text-[var(--text-tertiary)] mb-1"
                    >
                        Total Download
                    </p>
                    <p class="text-2xl font-bold text-[var(--text-primary)]">
                        {formatRate(metrics.system.network.totalRxPerSec)}
                    </p>
                </div>
                <div
                    class="rounded-[var(--radius-md)] bg-[var(--bg-sidebar)] p-4 border-l-4 border-[var(--primary)]"
                >
                    <p
                        class="text-xs font-bold uppercase text-[var(--text-tertiary)] mb-1"
                    >
                        Total Upload
                    </p>
                    <p class="text-2xl font-bold text-[var(--text-primary)]">
                        {formatRate(metrics.system.network.totalTxPerSec)}
                    </p>
                </div>
            </div>

            <!-- per Interface -->
            <div class="space-y-2">
                <p
                    class="text-xs font-bold uppercase text-[var(--text-tertiary)] px-1"
                >
                    Interfaces
                </p>
                <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {#each metrics.system.network.interfaces as iface}
                        <div
                            class="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-sidebar)] hover:bg-[var(--border)] transition-colors"
                        >
                            <div class="flex items-center gap-2">
                                <Activity
                                    size={14}
                                    class="text-[var(--text-tertiary)]"
                                />
                                <span
                                    class="text-sm font-medium text-[var(--text-primary)]"
                                    >{iface.name}</span
                                >
                            </div>
                            <div
                                class="flex flex-col items-end text-[10px] font-mono"
                            >
                                <div
                                    class="flex items-center gap-1 text-[var(--success)]"
                                >
                                    <ArrowDown size={10} />
                                    <span>{formatBytes(iface.rxBytes)}</span>
                                </div>
                                <div
                                    class="flex items-center gap-1 text-[var(--primary-strong)]"
                                >
                                    <ArrowUp size={10} />
                                    <span>{formatBytes(iface.txBytes)}</span>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        </Card>

        <!-- Per-App Metrics -->
        {#if metrics.apps.length > 0}
            <div>
                <h2
                    class="mb-4 text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2"
                >
                    <MemoryStick size={20} /> Application Metrics
                </h2>
                <p class="mb-4 text-sm text-[var(--text-secondary)]">
                    Per-application CPU, memory, health, and traffic
                </p>
            </div>

            <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {#each metrics.apps as app}
                    {@const Icon = getStatusIcon(app.status)}
                    <Card class="p-4">
                        <!-- App Header -->
                        <div class="mb-4 flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <Icon
                                    size={20}
                                    class={app.status === "running"
                                        ? "text-[var(--success)]"
                                        : app.status === "failed"
                                          ? "text-[var(--error)]"
                                          : "text-[var(--text-secondary)]"}
                                />
                                <h3
                                    class="font-semibold text-[var(--text-primary)] truncate max-w-[150px]"
                                    title={app.name}
                                >
                                    {app.name}
                                </h3>
                            </div>
                            <Badge
                                variant={app.status === "running"
                                    ? "success"
                                    : app.status === "stopped"
                                      ? "error"
                                      : "warning"}
                            >
                                {app.uptime.readable || app.status}
                            </Badge>
                        </div>

                        <!-- Metrics Rows -->
                        <div class="space-y-3 text-sm">
                            <!-- CPU -->
                            <div class="flex items-center justify-between">
                                <span
                                    class="text-[var(--text-secondary)] flex items-center gap-1"
                                >
                                    <Cpu size={14} /> CPU
                                </span>
                                <span
                                    class="font-medium"
                                    style="color: {getColor(app.resources.cpu)}"
                                    >{app.resources.cpu.toFixed(1)}%</span
                                >
                            </div>

                            <!-- Memory -->
                            <div class="flex items-center justify-between">
                                <span
                                    class="text-[var(--text-secondary)] flex items-center gap-1"
                                >
                                    <MemoryStick size={14} /> Memory
                                </span>
                                <span class="font-medium"
                                    >{app.resources.memory} MB ({app.resources
                                        .memoryPercent}%)</span
                                >
                            </div>

                            <!-- Restarts -->
                            <div class="flex items-center justify-between">
                                <span
                                    class="text-[var(--text-secondary)] flex items-center gap-1"
                                >
                                    <RefreshCw size={14} /> Restarts
                                </span>
                                <span
                                    class="font-medium"
                                    style="color: {app.restarts.count >= 3
                                        ? 'var(--error)'
                                        : 'var(--text-primary)'}"
                                    >{app.restarts.count}</span
                                >
                            </div>

                            <!-- Health -->
                            <div class="flex items-center justify-between">
                                <span
                                    class="text-[var(--text-secondary)] flex items-center gap-1"
                                >
                                    <Heart size={14} /> Health
                                </span>
                                <div class="flex items-center gap-2">
                                    {#if app.health.failingStreak > 0}
                                        <span
                                            class="text-[10px] text-[var(--error)] font-bold"
                                        >
                                            {app.health.failingStreak} FAILS
                                        </span>
                                    {/if}
                                    <Badge
                                        variant={app.health.status === "healthy"
                                            ? "success"
                                            : app.health.status === "unhealthy"
                                              ? "error"
                                              : "warning"}
                                    >
                                        {app.health.status === "none"
                                            ? "N/A"
                                            : app.health.status}
                                    </Badge>
                                </div>
                            </div>

                            <!-- App Disk -->
                            <div class="flex items-center justify-between">
                                <span
                                    class="text-[var(--text-secondary)] flex items-center gap-1"
                                >
                                    <HardDrive size={14} /> Disk
                                </span>
                                <span
                                    class="font-medium text-[var(--text-primary)]"
                                >
                                    {formatBytes(app.disk.used)}
                                </span>
                            </div>
                        </div>

                        <!-- Traffic -->
                        <div class="mt-4 pt-3 border-t border-[var(--border)]">
                            <div
                                class="flex items-center justify-between text-sm mb-2"
                            >
                                <span
                                    class="text-[var(--text-secondary)] truncate max-w-[150px] flex items-center gap-1"
                                    title={app.domain || "No domain"}
                                >
                                    <Network size={14} />
                                    {app.domain || "No domain"}
                                </span>
                                <span
                                    class="font-medium text-[var(--text-primary)]"
                                >
                                    {app.traffic.totalRequests} reqs
                                </span>
                            </div>

                            <div
                                class="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] uppercase font-bold text-[var(--text-tertiary)]"
                            >
                                <div class="flex justify-between">
                                    <span>Rate</span>
                                    <span class="text-[var(--text-secondary)]"
                                        >{app.traffic.requestsPerSec}/s</span
                                    >
                                </div>
                                <div class="flex justify-between">
                                    <span>P95</span>
                                    <span class="text-[var(--text-secondary)]"
                                        >{app.traffic.p95Latency || 0}ms</span
                                    >
                                </div>
                                <div class="flex justify-between">
                                    <span>4xx</span>
                                    <span
                                        class={app.traffic.errorRate4xx > 0
                                            ? "text-[var(--warning)]"
                                            : "text-[var(--text-secondary)]"}
                                    >
                                        {app.traffic.errorRate4xx}
                                    </span>
                                </div>
                                <div class="flex justify-between">
                                    <span>5xx</span>
                                    <span
                                        class={app.traffic.errorRate5xx > 0
                                            ? "text-[var(--error)]"
                                            : "text-[var(--text-secondary)]"}
                                    >
                                        {app.traffic.errorRate5xx}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Card>
                {/each}
            </div>
        {/if}
    {/if}
</div>
