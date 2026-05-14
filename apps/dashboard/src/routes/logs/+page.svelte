<script lang="ts">
    import { Card, Badge, Button } from "$lib/components/ui";
    import { get } from "$lib/api";
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { Search, RefreshCcw, Filter, Link } from "lucide-svelte";

    type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";
    type LogSource =
        | "manager"
        | "cli"
        | "api"
        | "webhook"
        | "scheduler"
        | "deploy"
        | "system";

    interface LogEntry {
        timestamp: string;
        level: LogLevel;
        source: LogSource;
        service: string;
        message: string;
        traceId?: string;
        action?: string;
        user?: string;
        app?: {
            name?: string;
            repo?: string;
            branch?: string;
            versionId?: number | string;
        };
        request?: {
            method?: string;
            path?: string;
            status?: number;
            durationMs?: number;
        };
        error?: {
            name?: string;
            message?: string;
            stack?: string;
        };
        data?: Record<string, unknown>;
    }

    const levels: { value: LogLevel; label: string }[] = [
        { value: "debug", label: "Debug" },
        { value: "info", label: "Info" },
        { value: "warn", label: "Warn" },
        { value: "error", label: "Error" },
        { value: "fatal", label: "Fatal" },
    ];

    const sources: { value: LogSource; label: string }[] = [
        { value: "manager", label: "Manager" },
        { value: "cli", label: "CLI" },
        { value: "api", label: "API" },
        { value: "webhook", label: "Webhook" },
        { value: "scheduler", label: "Scheduler" },
        { value: "deploy", label: "Deploy" },
        { value: "system", label: "System" },
    ];

    let logs = $state<LogEntry[]>([]);
    let isLoading = $state(false);
    let error = $state("");
    let total = $state(0);
    let logsAbort: AbortController | null = null;
    let logsRequestId = 0;

    const today = new Date().toISOString().slice(0, 10);
    let date = $state(today);
    let fromTime = $state("00:00");
    let toTime = $state("23:59");
    let search = $state("");
    let traceId = $state("");
    let limit = $state(200);
    let offset = $state(0);

    let selectedLevels = $state<LogLevel[]>(["info", "warn", "error", "fatal"]);
    let selectedSources = $state<LogSource[]>([]);

    onMount(() => {
        const traceParam = $page.url.searchParams.get("traceId");
        if (traceParam) {
            traceId = traceParam;
        }
        loadLogs();
    });

    function toggleLevel(level: LogLevel) {
        if (selectedLevels.includes(level)) {
            selectedLevels = selectedLevels.filter((l) => l !== level);
        } else {
            selectedLevels = [...selectedLevels, level];
        }
    }

    function toggleSource(source: LogSource) {
        if (selectedSources.includes(source)) {
            selectedSources = selectedSources.filter((s) => s !== source);
        } else {
            selectedSources = [...selectedSources, source];
        }
    }

    function resetFilters() {
        date = today;
        fromTime = "00:00";
        toTime = "23:59";
        search = "";
        traceId = "";
        selectedLevels = ["info", "warn", "error", "fatal"];
        selectedSources = [];
        limit = 200;
        offset = 0;
        loadLogs();
    }

    function buildQuery(): string {
        const params = new URLSearchParams();
        if (date) params.set("date", date);
        if (fromTime) params.set("from", fromTime);
        if (toTime) params.set("to", toTime);
        if (search.trim()) params.set("q", search.trim());
        if (traceId.trim()) params.set("traceId", traceId.trim());
        if (selectedLevels.length) params.set("level", selectedLevels.join(","));
        if (selectedSources.length) params.set("source", selectedSources.join(","));
        if (limit) params.set("limit", String(limit));
        if (offset) params.set("offset", String(offset));
        return params.toString();
    }

    async function loadLogs(append = false) {
        isLoading = true;
        error = "";
        const requestId = ++logsRequestId;
        if (logsAbort) {
            logsAbort.abort();
            logsAbort = null;
        }
        const controller = new AbortController();
        logsAbort = controller;
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        try {
            const query = buildQuery();
            const result = await get<{ logs: LogEntry[]; total: number }>(
                `/logs/query?${query}`,
                { signal: controller.signal },
            );
            if (requestId !== logsRequestId) return;
            if (result.success && result.data?.logs) {
                total = result.data.total ?? result.data.logs.length;
                logs = append ? [...logs, ...result.data.logs] : result.data.logs;
            } else {
                error = result.message || "Failed to load logs";
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") return;
            error = "Failed to load logs";
            console.error("Logs load error:", err);
        } finally {
            clearTimeout(timeoutId);
            if (requestId === logsRequestId) {
                isLoading = false;
            }
        }
    }

    function applyQuickFilter(type: "errors" | "deploys") {
        if (type === "errors") {
            selectedLevels = ["error", "fatal"];
            selectedSources = [];
        } else {
            selectedLevels = ["info", "warn", "error", "fatal"];
            selectedSources = ["deploy"];
        }
        offset = 0;
        loadLogs();
    }

    function loadMore() {
        offset = offset + limit;
        loadLogs(true);
    }

    function exportLogs() {
        const query = buildQuery();
        const url = `/api/logs/query?${query}`;
        fetch(url, { headers: { Accept: "text/plain" } })
            .then((res) => res.text())
            .then((content) => {
                const blob = new Blob([content], { type: "text/plain" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `okastr8-logs-${date}.jsonl`;
                link.click();
                URL.revokeObjectURL(link.href);
            })
            .catch(() => {
                window.open(url, "_blank");
            });
    }

    function formatTime(timestamp: string) {
        return new Date(timestamp).toLocaleString();
    }

    function levelBadge(level: LogLevel) {
        if (level === "error" || level === "fatal") return "error";
        if (level === "warn") return "warning";
        return "default";
    }
</script>

<div class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
            <h1 class="text-2xl font-bold text-[var(--text-primary)]">Logs</h1>
            <p class="mt-1 text-[var(--text-secondary)]">
                Unified log trail across manager, CLI, deploys, and webhooks.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Button variant="outline" onclick={resetFilters}>
                Reset
            </Button>
            <Button variant="outline" onclick={exportLogs}>
                Export
            </Button>
            <Button onclick={() => loadLogs()}>
                <RefreshCcw size={14} /> Refresh
            </Button>
        </div>
    </div>

    <Card class="space-y-4">
        <div class="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Filter size={16} /> Filters
        </div>

        <div class="grid gap-4 lg:grid-cols-3">
            <div class="space-y-2">
                <label
                    for="logs-date"
                    class="text-xs font-semibold uppercase text-[var(--text-muted)]"
                    >Date</label
                >
                <input
                    id="logs-date"
                    type="date"
                    bind:value={date}
                    class="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
            </div>
            <div class="space-y-2">
                <span class="text-xs font-semibold uppercase text-[var(--text-muted)]"
                    >Time range</span
                >
                <div class="grid grid-cols-2 gap-2">
                    <input
                        id="logs-from"
                        type="time"
                        bind:value={fromTime}
                        class="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <input
                        id="logs-to"
                        type="time"
                        bind:value={toTime}
                        class="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                </div>
            </div>
            <div class="space-y-2">
                <label
                    for="logs-search"
                    class="text-xs font-semibold uppercase text-[var(--text-muted)]"
                    >Search</label
                >
                <div class="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3">
                    <Search size={14} class="text-[var(--text-muted)]" />
                    <input
                        id="logs-search"
                        type="text"
                        bind:value={search}
                        placeholder="Message, app, or action"
                        class="w-full bg-transparent py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                    />
                </div>
            </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-3">
            <div class="space-y-2">
                <label
                    for="logs-trace"
                    class="text-xs font-semibold uppercase text-[var(--text-muted)]"
                    >Trace ID</label
                >
                <div class="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3">
                    <Link size={14} class="text-[var(--text-muted)]" />
                    <input
                        id="logs-trace"
                        type="text"
                        bind:value={traceId}
                        placeholder="deploymentId or traceId"
                        class="w-full bg-transparent py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                    />
                </div>
            </div>
            <div class="space-y-2 lg:col-span-2">
                <span class="text-xs font-semibold uppercase text-[var(--text-muted)]"
                    >Quick filters</span
                >
                <div class="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onclick={() => applyQuickFilter("errors")}
                        class="rounded-full border px-3 py-1 text-xs font-medium transition-colors border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                        Errors only
                    </button>
                    <button
                        type="button"
                        onclick={() => applyQuickFilter("deploys")}
                        class="rounded-full border px-3 py-1 text-xs font-medium transition-colors border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                        Deploys
                    </button>
                </div>
            </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
            <div class="space-y-2">
                <span class="text-xs font-semibold uppercase text-[var(--text-muted)]"
                    >Levels</span
                >
                <div class="flex flex-wrap gap-2">
                    {#each levels as lvl}
                        <button
                            type="button"
                            onclick={() => toggleLevel(lvl.value)}
                            class="rounded-full border px-3 py-1 text-xs font-medium transition-colors {selectedLevels.includes(lvl.value)
                            ? 'border-[var(--primary)] bg-[var(--primary-light)] text-[var(--text-primary)]'
                            : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
                        >
                            {lvl.label}
                        </button>
                    {/each}
                </div>
            </div>
            <div class="space-y-2">
                <span class="text-xs font-semibold uppercase text-[var(--text-muted)]"
                    >Sources</span
                >
                <div class="flex flex-wrap gap-2">
                    {#each sources as src}
                        <button
                            type="button"
                            onclick={() => toggleSource(src.value)}
                            class="rounded-full border px-3 py-1 text-xs font-medium transition-colors {selectedSources.includes(src.value)
                            ? 'border-[var(--primary)] bg-[var(--primary-light)] text-[var(--text-primary)]'
                            : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
                        >
                            {src.label}
                        </button>
                    {/each}
                </div>
            </div>
        </div>

        <div class="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Showing {logs.length} of {total} entries</span>
            <div class="flex items-center gap-2">
                <span>Limit</span>
                <input
                    type="number"
                    min="50"
                    max="1000"
                    bind:value={limit}
                    class="w-20 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)]"
                />
            </div>
        </div>

        <div class="flex justify-end">
            <Button onclick={() => { offset = 0; loadLogs(); }}>Apply filters</Button>
        </div>
    </Card>

    {#if isLoading}
        <Card class="p-8 text-center text-[var(--text-secondary)]">
            Loading logs...
        </Card>
    {:else if error}
        <Card class="p-8 text-center text-[var(--error)]">
            {error}
        </Card>
    {:else if logs.length === 0}
        <Card class="p-8 text-center text-[var(--text-secondary)]">
            No logs found for this filter range.
        </Card>
    {:else}
        <div class="space-y-3">
            {#each logs as log}
                <Card class="space-y-3 !p-4">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <div class="flex items-center gap-2">
                            <Badge variant={levelBadge(log.level)}>{log.level}</Badge>
                            <span class="text-sm font-semibold text-[var(--text-primary)]">
                                {log.source}
                            </span>
                            <span class="text-xs text-[var(--text-secondary)]">
                                {log.service}
                            </span>
                        </div>
                        <span class="text-xs text-[var(--text-secondary)]">
                            {formatTime(log.timestamp)}
                        </span>
                    </div>
                    <div class="text-sm text-[var(--text-primary)]">
                        {log.message}
                    </div>
                    <div class="flex flex-wrap gap-3 text-xs text-[var(--text-secondary)]">
                        {#if log.action}
                            <span>Action: {log.action}</span>
                        {/if}
                        {#if log.traceId}
                            <span>Trace: {log.traceId}</span>
                        {/if}
                        {#if log.app?.name}
                            <span>App: {log.app.name}</span>
                        {/if}
                        {#if log.request?.status}
                            <span>Status: {log.request.status}</span>
                        {/if}
                    </div>
                    {#if log.data || log.error}
                        <details class="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-dark)] p-3 text-xs text-[var(--text-secondary)]">
                            <summary class="cursor-pointer text-[var(--text-primary)]">
                                Details
                            </summary>
                            <pre class="mt-2 whitespace-pre-wrap font-mono text-[11px] text-[var(--text-primary)]">
{JSON.stringify({ data: log.data, error: log.error, request: log.request, app: log.app }, null, 2)}
                            </pre>
                        </details>
                    {/if}
                </Card>
            {/each}
        </div>
        {#if logs.length < total}
            <div class="flex justify-center">
                <Button variant="outline" onclick={loadMore} disabled={isLoading}>
                    Load more
                </Button>
            </div>
        {/if}
    {/if}
</div>
