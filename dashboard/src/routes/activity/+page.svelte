<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { Card, Badge, Button } from "$lib/components/ui";
    import { get } from "$lib/api";
    import {
        Activity,
        AlertCircle,
        CheckCircle2,
        Clock,
        FileText,
        Server,
        User,
        XCircle,
        Terminal,
    } from "lucide-svelte";

    // Types
    type ActivityType = "login" | "deploy" | "resource";
    interface ActivityEntry {
        id: string;
        timestamp: string;
        type: ActivityType;
        data: any;
        user?: string;
    }

    interface DeployLogResponse {
        log: string;
    }

    // State
    let activities: ActivityEntry[] = [];
    let isLoading = true;
    let filter: ActivityType | "all" = "all";
    let expandedLogId: string | null = null;
    let logContent: string | null = null;
    let isLoadingLog = false;
    let interval: any;

    onMount(() => {
        loadActivity();
        interval = setInterval(loadActivity, 10000); // Polling every 10s
    });

    onDestroy(() => {
        if (interval) clearInterval(interval);
    });

    async function loadActivity() {
        const url =
            filter === "all"
                ? "/activity/list?limit=100"
                : `/activity/list?limit=100&type=${filter}`;

        const res = await get<ActivityEntry[]>(url);
        if (res.success && res.data) {
            activities = res.data;
        }
        isLoading = false;
    }

    function setFilter(f: ActivityType | "all") {
        filter = f;
        isLoading = true;
        loadActivity();
    }

    async function toggleLog(id: string) {
        if (expandedLogId === id) {
            expandedLogId = null;
            logContent = null;
            return;
        }

        expandedLogId = id;
        isLoadingLog = true;
        logContent = null;

        const res = await get<DeployLogResponse>(`/activity/log/${id}`);
        if (res.success && res.data) {
            logContent = res.data.log;
        } else {
            logContent = "Failed to load logs or log file missing.";
        }
        isLoadingLog = false;
    }

    function formatTime(iso: string) {
        return new Date(iso).toLocaleString();
    }

    function getIcon(type: ActivityType) {
        if (type === "login") return User;
        if (type === "deploy") return FileText;
        if (type === "resource") return Server;
        return Activity;
    }

    function getColor(type: ActivityType, data: any) {
        if (type === "resource") return "text-[var(--warning)]";
        if (type === "deploy") {
            if (data.status === "failed") return "text-[var(--error)]";
            if (data.status === "success") return "text-[var(--success)]";
        }
        return "text-[var(--primary)]";
    }
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold text-[var(--text-primary)]">
                System Activity
            </h1>
            <p class="mt-1 text-[var(--text-secondary)]">
                Audit logs, deployments, and alerts.
            </p>
        </div>

        <!-- Filters -->
        <div class="flex gap-2 rounded-lg bg-[var(--surface-dark)] p-1">
            <button
                class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {filter ===
                'all'
                    ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
                on:click={() => setFilter("all")}
            >
                All
            </button>
            <button
                class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {filter ===
                'deploy'
                    ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
                on:click={() => setFilter("deploy")}
            >
                Deploys
            </button>
            <button
                class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {filter ===
                'login'
                    ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
                on:click={() => setFilter("login")}
            >
                Logins
            </button>
            <button
                class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {filter ===
                'resource'
                    ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
                on:click={() => setFilter("resource")}
            >
                System
            </button>
        </div>
    </div>

    <!-- Feed -->
    <div class="space-y-4">
        {#if isLoading && activities.length === 0}
            <div class="py-12 text-center text-[var(--text-secondary)]">
                Loading activity...
            </div>
        {:else if activities.length === 0}
            <div class="py-12 text-center text-[var(--text-secondary)]">
                No activity found.
            </div>
        {:else}
            {#each activities as item (item.id)}
                <Card
                    class="flex flex-col gap-4 !p-4 transition-all hover:bg-[var(--surface-dark)]/50"
                >
                    <div class="flex items-start gap-4">
                        <div
                            class="mt-1 rounded-full bg-[var(--surface-dark)] p-2 {getColor(
                                item.type,
                                item.data,
                            )}"
                        >
                            <svelte:component
                                this={getIcon(item.type)}
                                size={20}
                            />
                        </div>

                        <div class="flex-1">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span
                                        class="font-semibold text-[var(--text-primary)]"
                                    >
                                        {#if item.type === "login"}
                                            User Login
                                        {:else if item.type === "deploy"}
                                            Deployment: {item.data.appName}
                                        {:else if item.type === "resource"}
                                            Resource Alert: {item.data.resource}
                                        {/if}
                                    </span>
                                    {#if item.user}
                                        <Badge variant="outline" class="text-xs"
                                            >{item.user}</Badge
                                        >
                                    {/if}
                                </div>
                                <span
                                    class="text-xs text-[var(--text-secondary)] flex items-center gap-1"
                                >
                                    <Clock size={12} />
                                    {formatTime(item.timestamp)}
                                </span>
                            </div>

                            <p
                                class="mt-1 text-sm text-[var(--text-secondary)]"
                            >
                                {#if item.type === "login"}
                                    Successful login via token. Expiry: {item
                                        .data.expiry || "unknown"}.
                                {:else if item.type === "deploy"}
                                    {#if item.data.status === "started"}
                                        Deployment initiated on branch <code
                                            >{item.data.branch}</code
                                        >
                                    {:else if item.data.status === "success"}
                                        Successfully deployed version {item.data
                                            .versionId} in {item.data.duration?.toFixed(
                                            1,
                                        )}s.
                                    {:else}
                                        Deployment failed: {item.data.error}
                                    {/if}
                                {:else if item.type === "resource"}
                                    Usage reached {item.data.current}%,
                                    exceeding threshold of {item.data
                                        .threshold}%.
                                {/if}
                            </p>

                            <!-- Actions -->
                            {#if item.type === "deploy" && (item.data.status === "success" || item.data.status === "failed")}
                                <div class="mt-3">
                                    <button
                                        class="flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
                                        on:click={() =>
                                            toggleLog(item.data.id || item.id)}
                                    >
                                        <Terminal size={12} />
                                        {expandedLogId ===
                                        (item.data.id || item.id)
                                            ? "Hide Logs"
                                            : "View Build Logs"}
                                    </button>
                                </div>
                            {/if}
                        </div>
                    </div>

                    <!-- Expanded Logs -->
                    {#if expandedLogId === (item.data.id || item.id)}
                        <div
                            class="mt-2 rounded-lg bg-black/90 p-4 font-mono text-xs text-gray-300 overflow-x-auto"
                        >
                            {#if isLoadingLog}
                                <div class="flex items-center gap-2">
                                    <Activity class="animate-spin" size={14} /> Loading
                                    logs...
                                </div>
                            {:else}
                                <pre>{logContent}</pre>
                            {/if}
                        </div>
                    {/if}
                </Card>
            {/each}
        {/if}
    </div>
</div>
