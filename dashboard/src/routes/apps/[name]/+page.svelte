<script lang="ts">
    import { page } from "$app/stores";
    import { Card, Badge, Button } from "$lib/components/ui";
    import { get, post } from "$lib/api";
    import { onMount } from "svelte";
    import { toasts } from "$lib/stores/toasts";
    import {
        GitBranch,
        Globe,
        Cpu,
        FileText,
        RefreshCw,
        Square,
        Play,
        Trash2,
        Check,
        Rocket,
        X,
        TriangleAlert,
    } from "lucide-svelte";

    interface Version {
        id: number;
        deployedAt: string;
        commitHash?: string;
        branch?: string;
        isCurrent: boolean;
    }
    // ... existing interfaces ...
    interface AppMeta {
        name: string;
        gitRepo?: string;
        gitBranch?: string;
        port?: number;
        domain?: string;
        runtime?: string;
        webhookAutoDeploy?: boolean;
    }

    const appName = $page.params.name;

    let versions = $state<Version[]>([]);
    let meta = $state<AppMeta | null>(null);
    let logs = $state<string>("");
    let isLoading = $state(true);
    let isControlling = $state(false);
    let showLogs = $state(false);
    let showConfirmDelete = $state(false);
    let deleteTarget = $state<{
        type: "app" | "version";
        versionId?: number;
    } | null>(null);

    // ... existing onMount and loadData ...
    onMount(async () => {
        await loadData();
    });

    async function loadData() {
        isLoading = true;

        // Load versions - API returns { versions, current, maxVersions }
        try {
            const versionsResult = await post<{
                versions: Array<{
                    id: number;
                    timestamp: string;
                    commit?: string;
                    branch?: string;
                    status?: string;
                }>;
                current: number | null;
                maxVersions: number;
            }>("/app/versions", { name: appName });

            console.log("Versions API result:", versionsResult);

            if (versionsResult.success && versionsResult.data?.versions) {
                const currentId = versionsResult.data.current;
                versions = versionsResult.data.versions
                    .map((v) => ({
                        id: v.id,
                        deployedAt: v.timestamp,
                        commitHash: v.commit,
                        branch: v.branch,
                        isCurrent: v.id === currentId,
                    }))
                    .sort((a, b) => b.id - a.id);
            }
        } catch (e) {
            console.error("Failed to load versions:", e);
        }

        // Load app status (to get metadata like running state)
        try {
            const statusResult = await get<{ apps: AppMeta[] }>("/app/list");
            console.log("App list API result:", statusResult);

            if (statusResult.success && statusResult.data?.apps) {
                meta =
                    statusResult.data.apps.find((a) => a.name === appName) ||
                    null;
            }
        } catch (e) {
            console.error("Failed to load app list:", e);
            toasts.error("Failed to load app data");
        }

        isLoading = false;
    }

    async function controlApp(action: "start" | "stop" | "restart") {
        isControlling = true;
        const result = await post(`/app/${action}`, { name: appName });
        if (result.success) {
            toasts.success(`App ${action}ed successfully`);
            await loadData();
        } else {
            toasts.error(result.message || `Failed to ${action} app`);
        }
        isControlling = false;
    }

    async function promoteVersion(versionId: number) {
        isControlling = true;
        const result = await post("/app/rollback", {
            name: appName,
            versionId,
        });
        if (result.success) {
            toasts.success("Version promoted successfully");
            await loadData();
        } else {
            toasts.error(result.message || "Failed to promote version");
        }
        isControlling = false;
    }

    async function viewLogs() {
        const result = await post<string>("/app/logs", {
            name: appName,
            lines: 100,
        });
        if (result.success) {
            logs = result.message || "No logs available";
            showLogs = true;
        } else {
            toasts.error("Failed to load logs");
        }
    }

    async function deleteApp() {
        isControlling = true;
        const result = await post("/app/delete", { name: appName });
        if (result.success) {
            toasts.success("App deleted");
            window.location.href = "/apps";
        } else {
            toasts.error(result.message || "Failed to delete app");
        }
        isControlling = false;
        showConfirmDelete = false;
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }
</script>

<div class="space-y-6">
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <a href="/apps" class="hover:text-[var(--primary)]">Apps</a>
        <span>→</span>
        <span class="font-medium text-[var(--text-primary)]">{appName}</span>
    </div>

    {#if isLoading}
        <Card class="animate-pulse p-8">
            <div class="h-8 w-48 rounded bg-[var(--border)]"></div>
            <div class="mt-4 h-4 w-64 rounded bg-[var(--border)]"></div>
        </Card>
    {:else}
        <!-- Header -->
        <Card
            class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        >
            <div>
                <h1 class="text-2xl font-bold text-[var(--text-primary)]">
                    {appName}
                </h1>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                    {#if meta?.gitBranch}
                        <Badge variant="outline" class="flex gap-1 items-center"
                            ><GitBranch size={14} /> {meta.gitBranch}</Badge
                        >
                    {/if}
                    {#if meta?.port}
                        <Badge variant="outline" class="flex gap-1 items-center"
                            ><Globe size={14} /> Port {meta.port}</Badge
                        >
                    {/if}
                    {#if meta?.runtime}
                        <Badge variant="outline" class="flex gap-1 items-center"
                            ><Cpu size={14} /> {meta.runtime}</Badge
                        >
                    {/if}
                </div>
            </div>
            <div class="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onclick={viewLogs}
                    ><FileText size={16} class="mr-2" /> Logs</Button
                >
                <Button
                    variant="outline"
                    size="sm"
                    onclick={() => controlApp("restart")}
                    disabled={isControlling}
                >
                    <RefreshCw size={16} class="mr-2" /> Restart
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onclick={() => controlApp("stop")}
                    disabled={isControlling}
                >
                    <Square size={16} class="mr-2" /> Stop
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onclick={() => controlApp("start")}
                    disabled={isControlling}
                >
                    <Play size={16} class="mr-2" /> Start
                </Button>
                <Button
                    variant="destructive"
                    size="sm"
                    onclick={() => {
                        showConfirmDelete = true;
                        deleteTarget = { type: "app" };
                    }}
                >
                    <Trash2 size={16} class="mr-2" /> Delete
                </Button>
            </div>
        </Card>

        <!-- Releases -->
        <div>
            <h2 class="mb-4 text-lg font-semibold text-[var(--text-primary)]">
                Deployments
            </h2>
            <div class="space-y-3">
                {#each versions as version}
                    <Card
                        class="flex items-center justify-between !p-4 {version.isCurrent
                            ? 'border-2 border-[var(--primary)]'
                            : ''}"
                    >
                        <div class="flex items-center gap-4">
                            {#if version.isCurrent}
                                <span
                                    class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--success-light)] text-[var(--success)]"
                                >
                                    <Check size={18} />
                                </span>
                            {:else}
                                <span
                                    class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-sidebar)] text-[var(--text-muted)]"
                                >
                                    {version.id}
                                </span>
                            {/if}
                            <div>
                                <div class="flex items-center gap-2">
                                    <span
                                        class="font-medium text-[var(--text-primary)]"
                                        >v{version.id}</span
                                    >
                                    {#if version.isCurrent}
                                        <Badge variant="success">Current</Badge>
                                    {/if}
                                </div>
                                <div
                                    class="mt-1 flex items-center gap-3 text-xs text-[var(--text-muted)]"
                                >
                                    <span>{formatDate(version.deployedAt)}</span
                                    >
                                    {#if version.commitHash}
                                        <span class="font-mono"
                                            >{version.commitHash.slice(
                                                0,
                                                7,
                                            )}</span
                                        >
                                    {/if}
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            {#if !version.isCurrent}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onclick={() => promoteVersion(version.id)}
                                    disabled={isControlling}
                                >
                                    <Rocket size={16} class="mr-2" /> Promote
                                </Button>
                            {/if}
                        </div>
                    </Card>
                {/each}

                {#if versions.length === 0}
                    <Card class="p-8 text-center text-[var(--text-secondary)]">
                        No deployments found for this app
                    </Card>
                {/if}
            </div>
        </div>
    {/if}
</div>

<!-- Logs Modal -->
{#if showLogs}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="button"
        tabindex="0"
        onclick={() => (showLogs = false)}
        onkeydown={(e) => e.key === "Escape" && (showLogs = false)}
    >
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
            class="max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-[var(--radius-lg)] bg-white shadow-xl"
            role="document"
            tabindex="-1"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
        >
            <div
                class="flex items-center justify-between border-b border-[var(--border)] p-4"
            >
                <h3 class="text-lg font-semibold text-[var(--text-primary)]">
                    Logs - {appName}
                </h3>
                <button
                    onclick={() => (showLogs = false)}
                    class="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                    <X size={24} />
                </button>
            </div>
            <div class="max-h-[60vh] overflow-auto bg-[var(--bg-terminal)] p-4">
                <pre
                    class="whitespace-pre-wrap font-mono text-sm text-green-400">{logs}</pre>
            </div>
        </div>
    </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showConfirmDelete}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="button"
        tabindex="0"
        onclick={() => (showConfirmDelete = false)}
        onkeydown={(e) => e.key === "Escape" && (showConfirmDelete = false)}
    >
        <Card class="w-full max-w-md" onclick={(e) => e.stopPropagation()}>
            <h3
                class="flex items-center gap-2 text-lg font-semibold text-[var(--error)]"
            >
                <TriangleAlert size={20} /> Confirm Deletion
            </h3>
            <p class="mt-2 text-[var(--text-secondary)]">
                Are you sure you want to delete <strong>{appName}</strong>? This
                action cannot be undone.
            </p>
            <div class="mt-4 flex justify-end gap-3">
                <Button
                    variant="outline"
                    onclick={() => (showConfirmDelete = false)}>Cancel</Button
                >
                <Button
                    variant="destructive"
                    onclick={deleteApp}
                    disabled={isControlling}
                >
                    {isControlling ? "Deleting..." : "Delete App"}
                </Button>
            </div>
        </Card>
    </div>
{/if}
