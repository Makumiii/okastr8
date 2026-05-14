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
        Calendar,
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
    let activities = $state<ActivityEntry[]>([]);
    let isLoading = $state(true);
    let filter = $state<ActivityType | "all">("all");
    let selectedDate = $state<string>(new Date().toISOString().split("T")[0]); // Default today (YYYY-MM-DD)
    let expandedLogId = $state<string | null>(null);
    let logContent = $state<string | null>(null);
    let isLoadingLog = $state(false);
    let interval: ReturnType<typeof setInterval> | null = null;
    let activityAbort = $state<AbortController | null>(null);

    onMount(() => {
        loadActivity();
        interval = setInterval(() => loadActivity(false), 10000); // Polling every 10s
    });

    onDestroy(() => {
        if (interval) clearInterval(interval);
        if (activityAbort) activityAbort.abort();
    });

    async function loadActivity(cancelPrevious = false) {
        if (activityAbort && !cancelPrevious) return;

        const url =
            filter === "all"
                ? `/activity/list?limit=100&date=${selectedDate}`
                : `/activity/list?limit=100&type=${filter}&date=${selectedDate}`;

        if (cancelPrevious && activityAbort) {
            activityAbort.abort();
            activityAbort = null;
        }

        const controller = new AbortController();
        activityAbort = controller;
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        try {
            const res = await get<ActivityEntry[]>(url, {
                signal: controller.signal,
            });
            if (res.success && res.data) {
                activities = res.data;
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
                return;
            }
            console.error("Failed to load activity:", err);
        } finally {
            clearTimeout(timeoutId);
            if (activityAbort === controller) {
                activityAbort = null;
            }
            isLoading = false;
        }
    }

    function setFilter(f: ActivityType | "all") {
        filter = f;
        isLoading = true;
        activities = [];
        loadActivity(true);
    }

    function setDate(date: string) {
        selectedDate = date;
        isLoading = true;
        activities = [];
        loadActivity(true);
    }

    // Generate past 7 days
    function getPast7Days() {
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().split("T")[0]);
        }
        return dates;
    }

    function formatDateLabel(dateStr: string) {
        const d = new Date(dateStr);
        const today = new Date().toISOString().split("T")[0];
        if (dateStr === today) return "Today";
        return d.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
        });
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

        try {
            const res = await get<DeployLogResponse>(`/activity/log/${id}`);
            if (res.success && res.data) {
                logContent = res.data.log;
            } else {
                logContent = "Failed to load logs or log file missing.";
            }
        } catch (err) {
            console.error("Failed to load activity log:", err);
            logContent = "Failed to load logs or log file missing.";
        } finally {
            isLoadingLog = false;
        }
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
        return "text-[var(--primary-strong)]";
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
        <div class="flex flex-col gap-4 items-end">
            <!-- Date Filter -->
            <div class="relative">
                <div
                    class="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-[var(--text-secondary)]"
                >
                    <Calendar size={16} />
                </div>
                <select
                    class="h-9 w-40 appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] pl-9 pr-8 text-sm font-medium text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    value={selectedDate}
                    onchange={(e) => setDate((e.currentTarget as HTMLSelectElement).value)}
                >
                    {#each getPast7Days() as date}
                        <option value={date}>{formatDateLabel(date)}</option>
                    {/each}
                </select>
                <!-- Custom arrow -->
                <div
                    class="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-[var(--text-secondary)]"
                >
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M3 4.5L6 7.5L9 4.5"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                </div>
            </div>

            <div class="flex gap-2 rounded-lg bg-[var(--surface-dark)] p-1">
                <button
                    class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {filter ===
                    'all'
                        ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
                    onclick={() => setFilter("all")}
                >
                    All
                </button>
                <button
                    class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {filter ===
                    'deploy'
                        ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
                    onclick={() => setFilter("deploy")}
                >
                    Deploys
                </button>
                <button
                    class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {filter ===
                    'login'
                        ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
                    onclick={() => setFilter("login")}
                >
                    Logins
                </button>
                <button
                    class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {filter ===
                    'resource'
                        ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
                    onclick={() => setFilter("resource")}
                >
                    Resources
                </button>
            </div>
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
                {@const Icon = getIcon(item.type)}
                <Card
                    class="flex flex-col gap-4 !p-4 transition-all hover:bg-[var(--surface-dark)]"
                >
                    <div class="flex items-start gap-4">
                        <div
                            class="mt-1 rounded-full bg-[var(--surface-dark)] p-2 {getColor(
                                item.type,
                                item.data,
                            )}"
                        >
                            <Icon size={20} />
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
                                        class="flex items-center gap-1 text-xs font-medium text-[var(--primary-strong)] hover:underline"
                                        onclick={() =>
                                            toggleLog(item.data.id || item.id)}
                                    >
                                        <Terminal size={12} />
                                        {expandedLogId ===
                                        (item.data.id || item.id)
                                            ? "Hide Logs"
                                            : "View Build Logs"}
                                    </button>
                                    <a
                                        href={`/logs?traceId=${item.data.id || item.id}`}
                                        class="ml-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                    >
                                        <Activity size={12} /> View in Logs
                                    </a>
                                </div>
                            {/if}
                        </div>
                    </div>

                    <!-- Expanded Logs -->
                    {#if expandedLogId === (item.data.id || item.id)}
                        <div
                            class="mt-2 rounded-lg bg-[var(--bg-terminal)] p-4 font-mono text-xs text-[var(--accent)] overflow-x-auto"
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
