<script lang="ts">
    import { Card, Badge } from "$lib/components/ui";
    import { get } from "$lib/api";
    import { onMount } from "svelte";

    interface App {
        name: string;
        status: string;
        running: boolean;
        uptime?: string;
        gitRepo?: string;
        gitBranch?: string;
        port?: number;
    }

    let apps = $state<App[]>([]);
    let isLoading = $state(true);

    onMount(async () => {
        await loadApps();
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
            href="/github"
            class="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)]"
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
            <div class="text-6xl">📦</div>
            <h2 class="mt-4 text-xl font-semibold text-[var(--text-primary)]">
                No Apps Deployed
            </h2>
            <p class="mt-2 text-center text-[var(--text-secondary)]">
                Deploy your first app from GitHub to get started
            </p>
            <a
                href="/github"
                class="mt-6 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)]"
            >
                Go to GitHub
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
                                    class="flex h-10 w-10 items-center justify-center rounded-lg text-lg {app.running
                                        ? 'bg-[var(--success-light)]'
                                        : 'bg-[var(--error-light)]'}"
                                >
                                    {app.running ? "🟢" : "🔴"}
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
                            <Badge variant={app.running ? "success" : "error"}>
                                {app.running ? "Running" : "Stopped"}
                            </Badge>
                        </div>

                        {#if app.uptime}
                            <div
                                class="mt-4 flex items-center gap-2 text-sm text-[var(--text-secondary)]"
                            >
                                <span>🕐</span>
                                <span>Up {app.uptime}</span>
                            </div>
                        {/if}

                        {#if app.port}
                            <div
                                class="mt-2 flex items-center gap-2 text-sm text-[var(--text-muted)]"
                            >
                                <span>📡</span>
                                <span>Port {app.port}</span>
                            </div>
                        {/if}

                        <div
                            class="mt-4 text-right text-sm font-medium text-[var(--primary)]"
                        >
                            Manage →
                        </div>
                    </Card>
                </a>
            {/each}
        </div>
    {/if}
</div>
