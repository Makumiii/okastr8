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
        Inbox,
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
        activityStats?: {
            failedDeploysToday: number;
            resourceWarningsToday: number;
            loginsToday: number;
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

    const healthVariant = $derived(
        data ? getHealthColor(data.health.status) : "success",
    );
</script>

<div class="space-y-8">
    <!-- Header -->
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
            <h1 class="text-2xl font-bold text-[var(--text-primary)]">
                Dashboard
            </h1>
            <p class="mt-1 text-[var(--text-secondary)]">
                Monitor your server, deployments, and runtime health.
            </p>
        </div>

        {#if data && data.activityStats}
            {@const totalCount =
                data.activityStats.failedDeploysToday +
                data.activityStats.resourceWarningsToday +
                data.activityStats.loginsToday}
            <a
                href="/activity"
                class="relative inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-dark)] hover:text-[var(--text-primary)]"
            >
                <Inbox size={18} />
                <span>Inbox</span>
                {#if totalCount > 0}
                    <span
                        class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-[var(--primary-ink)] shadow-sm"
                    >
                        {totalCount > 99 ? "99+" : totalCount}
                    </span>
                {/if}
            </a>
        {/if}
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
        <!-- Hero Row -->
        <section class="grid gap-6 lg:grid-cols-12">
            <Card
                class="relative overflow-hidden bg-gradient-to-br from-[var(--primary)] to-[var(--primary-strong)] text-[var(--primary-ink)] lg:col-span-8"
            >
                <div class="relative z-10 flex flex-col gap-6">
                    <div class="flex items-start justify-between gap-4">
                        <div>
                            <p class="text-xs uppercase tracking-wide opacity-70">
                                Welcome
                            </p>
                            <h2 class="text-2xl font-semibold">
                                {data.user}, your systems are live.
                            </h2>
                            <p class="mt-2 text-sm opacity-80">
                                Review today's health signals and recent activity.
                            </p>
                        </div>
                        <div class="flex flex-col items-end gap-2">
                            <Badge variant={healthVariant} class="!bg-[var(--surface-glass)]">
                                <span
                                    class="inline-block h-2 w-2 rounded-full {healthVariant ===
                                    'success'
                                        ? 'bg-[var(--success)]'
                                        : healthVariant === 'warning'
                                          ? 'bg-[var(--warning)]'
                                          : 'bg-[var(--error)]'}"
                                ></span>
                                {data.health.status.toUpperCase()}
                            </Badge>
                            <span
                                class="flex items-center gap-2 rounded-full bg-[var(--surface-glass)] px-3 py-1.5 text-xs"
                            >
                                <Server size={14} />
                                {data.hostname}
                            </span>
                        </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-3 text-xs font-medium">
                        <span class="rounded-full bg-[var(--surface-glass-muted)] px-3 py-1.5">
                            {data.health.counts.info} Info
                        </span>
                        <span class="rounded-full bg-[var(--surface-glass-muted)] px-3 py-1.5">
                            {data.health.counts.warning} Warnings
                        </span>
                        <span class="rounded-full bg-[var(--surface-glass-muted)] px-3 py-1.5">
                            {data.health.counts.error} Errors
                        </span>
                    </div>
                </div>
                <div
                    class="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[var(--accent-glow)] blur-3xl"
                ></div>
            </Card>

            <Card class="flex flex-col justify-between lg:col-span-4">
                <div class="flex items-start justify-between">
                    <div>
                        <p class="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                            System Uptime
                        </p>
                        <div class="mt-3 text-2xl font-bold text-[var(--text-primary)]">
                            {data.uptime}
                        </div>
                    </div>
                    <span class="rounded-full bg-[var(--surface-dark)] p-2">
                        <Clock size={18} />
                    </span>
                </div>
                <div class="mt-6 space-y-2 text-sm text-[var(--text-secondary)]">
                    <div class="flex items-center justify-between">
                        <span>Server time</span>
                        <span class="font-medium text-[var(--text-primary)]">
                            {new Date(data.serverTime).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span>Host</span>
                        <span class="font-medium text-[var(--text-primary)]">
                            {data.hostname}
                        </span>
                    </div>
                </div>
            </Card>
        </section>

        <!-- Stats Grid -->
        <section class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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

            <!-- Activity -->
            <Card>
                <div class="flex items-start justify-between">
                    <span class="text-sm text-[var(--text-secondary)]"
                        >Today's Activity</span
                    >
                    <Inbox size={20} />
                </div>
                <div class="mt-3 text-3xl font-bold text-[var(--text-primary)]">
                    {data.activityStats
                        ? data.activityStats.failedDeploysToday +
                            data.activityStats.resourceWarningsToday +
                            data.activityStats.loginsToday
                        : 0}
                </div>
                <p class="mt-1 text-sm text-[var(--text-secondary)]">
                    Logins & alerts today
                </p>
            </Card>

            <!-- System Load -->
            <Card>
                <div class="flex items-start justify-between">
                    <span class="text-sm text-[var(--text-secondary)]"
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
        </section>

        <section class="grid gap-6 lg:grid-cols-12">
            <!-- Services List -->
            <Card class="lg:col-span-8">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-lg font-semibold text-[var(--text-primary)]">
                            Active Services
                        </h3>
                        <p class="mt-1 text-sm text-[var(--text-secondary)]">
                            Live services and application status.
                        </p>
                    </div>
                    <span class="text-xs text-[var(--text-muted)]">
                        {data.services.length} total
                    </span>
                </div>
                <div class="mt-5 divide-y divide-[var(--border)]">
                    {#each data.services as service}
                        <div class="flex items-center justify-between py-4">
                            <div class="flex items-center gap-3">
                                <span
                                    class="h-2.5 w-2.5 rounded-full {service.running
                                        ? 'bg-[var(--success)] shadow-[0_0_10px_var(--success)]'
                                        : 'bg-[var(--error)]'}"
                                ></span>
                                <div>
                                    <div class="font-medium text-[var(--text-primary)]">
                                        {service.name}
                                    </div>
                                    <div class="text-xs text-[var(--text-muted)]">
                                        {service.isApp ? "Application" : "Service"}
                                    </div>
                                </div>
                            </div>
                            <Badge variant={service.running ? "success" : "error"}>
                                {service.status}
                            </Badge>
                        </div>
                    {/each}
                </div>
            </Card>

            <!-- Actions & Health -->
            <div class="grid gap-6 lg:col-span-4">
                <Card class="flex flex-col gap-4">
                    <div>
                        <h3 class="text-lg font-semibold text-[var(--text-primary)]">
                            Deploy new app?
                        </h3>
                        <p class="mt-1 text-sm text-[var(--text-secondary)]">
                            Connect to GitHub and ship in seconds.
                        </p>
                    </div>
                    <a
                        href="/github"
                        class="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-[var(--primary-ink)] transition-colors hover:bg-[var(--primary-strong)]"
                    >
                        Go to GitHub <ArrowRight size={16} />
                    </a>
                </Card>

                <Card>
                    <div class="flex items-center justify-between">
                        <h3 class="text-base font-semibold text-[var(--text-primary)]">
                            Activity Snapshot
                        </h3>
                        <Badge variant="outline">Today</Badge>
                    </div>
                    <div class="mt-4 space-y-3 text-sm">
                        <div class="flex items-center justify-between">
                            <span class="text-[var(--text-secondary)]">
                                Failed deploys
                            </span>
                            <span class="font-semibold text-[var(--text-primary)]">
                                {data.activityStats?.failedDeploysToday ?? 0}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-[var(--text-secondary)]">
                                Resource warnings
                            </span>
                            <span class="font-semibold text-[var(--text-primary)]">
                                {data.activityStats?.resourceWarningsToday ?? 0}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-[var(--text-secondary)]">
                                Logins
                            </span>
                            <span class="font-semibold text-[var(--text-primary)]">
                                {data.activityStats?.loginsToday ?? 0}
                            </span>
                        </div>
                    </div>
                </Card>
            </div>
        </section>
    {/if}
</div>
