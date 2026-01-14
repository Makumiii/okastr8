<script lang="ts">
    import { Card, Badge } from "$lib/components/ui";
    import { get } from "$lib/api";
    import { onMount } from "svelte";

    interface Metrics {
        cpu: { usage: number; cores: number };
        memory: { used: number; total: number; usedPercent: number };
        disk: { used: number; total: number; usedPercent: number };
        uptime: number;
        loadAvg: number[];
    }

    let metrics = $state<Metrics | null>(null);
    let isLoading = $state(true);
    let error = $state("");

    onMount(async () => {
        await loadData();
        const interval = setInterval(loadData, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    });

    async function loadData() {
        try {
            const result = await get<Metrics>("/system/metrics");
            if (result.success && result.data) {
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

    function getColor(percent: number): string {
        if (percent < 60) return "var(--success)";
        if (percent < 85) return "var(--warning)";
        return "var(--error)";
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
        <Card class="bg-[var(--error-light)]">
            <p class="text-[var(--error)]">❌ {error}</p>
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
                <span class="text-4xl">🟢</span>
            </div>
        </Card>
    {/if}
</div>
