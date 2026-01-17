<script lang="ts">
    import { Card, Badge } from "$lib/components/ui";
    import { get } from "$lib/api";
    import { onMount } from "svelte";
    import {
        Server,
        Zap,
        Clock,
        Package,
        Activity,
        TriangleAlert,
        ArrowRight,
    } from "lucide-svelte";

    interface SystemStatus {
        user: string;
        uptime: string;
        serverTime: string;
        hostname: string;
        environments: Record<string, { installed: boolean; version?: string }>;
        services: Array<{
            name: string;
            status: string;
            running: boolean;
            isApp?: boolean;
        }>;
        health: {
            status: string;
            counts: { info: number; warning: number; error: number };
        };
    }

    let data = $state<SystemStatus | null>(null);
    let isLoading = $state(true);
    let error = $state("");

    onMount(() => {
        loadData();
        // Auto-refresh every 30 seconds
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    });

    async function loadData() {
        try {
            const result = await get<SystemStatus>("/system/status");
            if (result.success && result.data) {
                data = result.data;
            } else {
                error = result.message || "Failed to load status";
            }
        } catch (e) {
            error = "Failed to connect to server";
        } finally {
            isLoading = false;
        }
    }

    function getHealthColor(status: string): "success" | "warning" | "error" {
        if (status === "healthy") return "success";
        if (status === "warning") return "warning";
        return "error";
    }
</script>

<div class="space-y-6">
    <!-- Header -->
    <div>
        <h1 class="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
        <p class="mt-1 text-[var(--text-secondary)]">
            Monitor your server and deployments
        </p>
    </div>

    {#if isLoading}
        <!-- Skeleton loaders -->
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {#each Array(4) as _}
                <Card class="animate-pulse">
                    <div class="h-4 w-24 rounded bg-[var(--border)]"></div>
                    <div class="mt-4 h-8 w-16 rounded bg-[var(--border)]"></div>
                </Card>
            {/each}
        </div>
    {:else if error}
        <Card class="bg-[var(--error-light)] flex items-center gap-2">
            <TriangleAlert class="text-[var(--error)]" />
            <p class="text-[var(--error)]">{error}</p>
        </Card>
    {:else if data}
        <!-- Welcome Card -->
        <Card
            class="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white"
        >
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-xl font-semibold">
                        Welcome back, {data.user}
                    </h2>
                    <p class="mt-1 opacity-80">
                        All systems operational. {data.health.counts.info} notifications
                        today.
                    </p>
                </div>
                <div class="flex items-center gap-3">
                    <Badge variant="success" class="!bg-white/20 !text-white">
                        <span
                            class="inline-block h-2 w-2 rounded-full bg-green-400"
                        ></span>
                        {data.health.status.toUpperCase()}
                    </Badge>
                    <span
                        class="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm"
                    >
                        <Server size={14} />
                        {data.hostname}
                    </span>
                </div>
            </div>
        </Card>

        <!-- Stats Grid -->
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <!-- Services -->
            <Card>
                <div class="flex items-start justify-between">
                    <span class="text-sm text-[var(--text-secondary)]"
                        >Services Active</span
                    >
                    <Zap size={20} />
                </div>
                <div class="mt-3 text-3xl font-bold text-[var(--text-primary)]">
                    {data.services.filter((s) => s.running).length}
                    <span class="text-lg font-normal text-[var(--text-muted)]"
                        >/ {data.services.length}</span
                    >
                </div>
                <div
                    class="mt-3 h-2 overflow-hidden rounded-full bg-[var(--border)]"
                >
                    <div
                        class="h-full bg-[var(--primary)]"
                        style="width: {(data.services.filter((s) => s.running)
                            .length /
                            data.services.length) *
                            100}%"
                    ></div>
                </div>
            </Card>

            <!-- Uptime -->
            <Card class="bg-[var(--text-primary)] text-white">
                <div class="flex items-start justify-between">
                    <span class="text-sm opacity-70">System Uptime</span>
                    <Clock size={20} />
                </div>
                <div class="mt-3 text-2xl font-bold">{data.uptime}</div>
                <div
                    class="mt-3 border-t border-white/10 pt-3 text-sm opacity-70"
                >
                    {new Date(data.serverTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                </div>
            </Card>

            <!-- Environments -->
            <Card>
                <div class="flex items-start justify-between">
                    <span class="text-sm text-[var(--text-secondary)]"
                        >Environments</span
                    >
                    <Package size={20} />
                </div>
                <div class="mt-3 text-3xl font-bold text-[var(--text-primary)]">
                    {Object.values(data.environments).filter((e) => e.installed)
                        .length}
                </div>
                <div class="mt-3 flex flex-wrap gap-1.5">
                    {#each Object.entries(data.environments).filter(([_, e]) => e.installed) as [name, info]}
                        <Badge variant="outline">
                            {name}
                            {info.version || ""}
                        </Badge>
                    {/each}
                </div>
            </Card>

            <!-- System Load -->
            <Card class="bg-[var(--warning-light)]">
                <div class="flex items-start justify-between">
                    <span class="text-sm text-[var(--warning)] opacity-80"
                        >System Load</span
                    >
                    <Activity size={20} class="text-[var(--warning)]" />
                </div>
                <div class="mt-3 text-3xl font-bold text-[var(--text-primary)]">
                    {data.health.counts.info + data.health.counts.warning}
                </div>
                <p class="mt-1 text-sm text-[var(--text-secondary)]">
                    Active processes
                </p>
            </Card>
        </div>

        <!-- Quick Actions -->
        <Card class="flex items-center justify-between">
            <div>
                <h3 class="text-lg font-semibold text-[var(--text-primary)]">
                    Deploy new app?
                </h3>
                <p class="mt-0.5 text-sm text-[var(--text-secondary)]">
                    Connect to GitHub and ship in seconds.
                </p>
            </div>
            <a
                href="/github"
                class="flex items-center gap-2 rounded-full bg-[var(--text-primary)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary)]"
            >
                Go to GitHub <ArrowRight size={16} />
            </a>
        </Card>

        <!-- Services List -->
        <div>
            <h3 class="mb-4 text-lg font-semibold text-[var(--text-primary)]">
                Active Services
            </h3>
            <div class="space-y-3">
                {#each data.services as service}
                    <Card class="flex items-center justify-between !p-4">
                        <div class="flex items-center gap-3">
                            <span
                                class="h-3 w-3 rounded-full {service.running
                                    ? 'bg-[var(--success)] shadow-[0_0_8px_var(--success)]'
                                    : 'bg-[var(--error)]'}"
                            ></span>
                            <span class="font-medium text-[var(--text-primary)]"
                                >{service.name}</span
                            >
                            {#if service.isApp}
                                <Badge variant="outline">App</Badge>
                            {/if}
                        </div>
                        <Badge variant={service.running ? "success" : "error"}>
                            {service.status}
                        </Badge>
                    </Card>
                {/each}
            </div>
        </div>
    {/if}
</div>
