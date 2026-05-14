<script lang="ts">
    import { Card, Badge } from "$lib/components/ui";
    import { get } from "$lib/api";
    import { onMount } from "svelte";
    import { Box, Play, Square, Clock, Globe, ArrowRight } from "lucide-svelte";

    interface App {
        name: string;
        status: string;
        running: boolean;
        health?: string;
        uptime?: string;
        gitRepo?: string;
        gitBranch?: string;
        port?: number;
        domain?: string;
    }
    // ... existing code ...
    let apps = $state<App[]>([]);
    let isLoading = $state(true);

    onMount(() => {
        loadApps();
        const interval = setInterval(loadApps, 15000);
        return () => clearInterval(interval);
    });

    async function loadApps() {
        const result = await get<{ apps: App[] }>("/app/list");
        if (result.success && result.data?.apps) {
            apps = result.data.apps;
        }
        isLoading = false;
    }
</script>

<div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold text-[var(--text-primary)]">
                Applications
            </h1>
            <p class="mt-1 text-[var(--text-secondary)]">
                Manage your deployed apps
            </p>
        </div>
        <a
            href="/deploy"
            class="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-ink)] transition-colors hover:bg-[var(--primary-strong)]"
        >
            + Deploy New
        </a>
    </div>

    {#if isLoading}
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {#each Array(3) as _}
                <Card class="animate-pulse">
                    <div class="flex items-center gap-3">
                        <div
                            class="h-10 w-10 rounded-lg bg-[var(--border)]"
                        ></div>
                        <div class="flex-1">
                            <div
                                class="h-4 w-32 rounded bg-[var(--border)]"
                            ></div>
                            <div
                                class="mt-2 h-3 w-24 rounded bg-[var(--border)]"
                            ></div>
                        </div>
                    </div>
                </Card>
            {/each}
        </div>
    {:else if apps.length === 0}
        <Card class="flex flex-col items-center p-12">
            <div class="text-[var(--text-muted)]">
                <Box size={48} />
            </div>
            <h2 class="mt-4 text-xl font-semibold text-[var(--text-primary)]">
                No Apps Deployed
            </h2>
            <p class="mt-2 text-center text-[var(--text-secondary)]">
                Deploy your first app from GitHub or a container registry
            </p>
            <a
                href="/deploy"
                class="mt-6 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-6 py-2.5 text-sm font-medium text-[var(--primary-ink)] transition-colors hover:bg-[var(--primary-strong)]"
            >
                Go to Deploy
            </a>
        </Card>
    {:else}
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {#each apps as app}
                <a href="/apps/{app.name}" class="block">
                    <Card
                        class="cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg"
                    >
                        <div class="flex items-start justify-between">
                            <div class="flex items-center gap-3">
                                <div
                                    class="flex h-10 w-10 items-center justify-center rounded-lg {app.running
                                        ? 'bg-[var(--success-light)] text-[var(--success)]'
                                        : 'bg-[var(--error-light)] text-[var(--error)]'}"
                                >
                                    {#if app.running}
                                        <Play size={20} fill="currentColor" />
                                    {:else}
                                        <Square size={20} fill="currentColor" />
                                    {/if}
                                </div>
                                <div>
                                    <h3
                                        class="font-semibold text-[var(--text-primary)]"
                                    >
                                        {app.name}
                                    </h3>
                                    {#if app.gitBranch}
                                        <p
                                            class="text-xs text-[var(--text-muted)]"
                                        >
                                            {app.gitBranch}
                                        </p>
                                    {/if}
                                </div>
                            </div>
                            <div class="flex flex-col items-end gap-2">
                                <Badge
                                    variant={app.running ? "success" : "error"}
                                >
                                    {app.running ? "Running" : "Stopped"}
                                </Badge>
                                {#if app.health}
                                    <Badge
                                        variant={app.health === "healthy"
                                            ? "success"
                                            : app.health === "unhealthy"
                                              ? "error"
                                              : "warning"}
                                        class="text-[10px] uppercase py-0 px-1"
                                    >
                                        {app.health}
                                    </Badge>
                                {/if}
                            </div>
                        </div>

                        {#if app.uptime}
                            <div
                                class="mt-4 flex items-center gap-2 text-sm text-[var(--text-secondary)]"
                            >
                                <Clock size={16} />
                                <span>Up {app.uptime}</span>
                            </div>
                        {/if}

                        {#if app.port}
                            <div
                                class="mt-2 flex items-center gap-2 text-sm text-[var(--text-muted)]"
                            >
                                <Globe size={16} />
                                <span>Port {app.port}</span>
                            </div>
                        {/if}

                        {#if app.domain}
                            <div
                                class="mt-2 flex items-center gap-2 text-sm text-[var(--text-muted)]"
                            >
                                <Globe size={16} />
                                <span class="truncate" title={app.domain}>
                                    {app.domain}
                                </span>
                            </div>
                        {/if}

                        <div
                            class="mt-4 flex items-center justify-end gap-1 text-sm font-medium text-[var(--primary-strong)]"
                        >
                            Manage <ArrowRight size={16} />
                        </div>
                    </Card>
                </a>
            {/each}
        </div>
    {/if}
</div>
