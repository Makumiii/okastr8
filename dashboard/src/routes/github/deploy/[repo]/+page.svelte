<script lang="ts">
    import { page } from "$app/stores";
    import { Card, Badge, Button } from "$lib/components/ui";
    import { get, post } from "$lib/api";
    import { onMount } from "svelte";
    import { toasts } from "$lib/stores/toasts";
    import {
        Check,
        TriangleAlert,
        Rocket,
        X,
        Clipboard,
        XCircle,
    } from "lucide-svelte";

    const repoFullName = decodeURIComponent($page.params.repo ?? "");
    const [owner, repoName] = repoFullName.split("/");

    let branches = $state<string[]>([]);
    let selectedBranch = $state("");
    let hasConfig = $state<boolean | null>(null);
    let webhookEnabled = $state(true);
    let envVars = $state("");
    let isLoading = $state(true);
    let isDeploying = $state(false);
    let deploymentId = $state("");
    let logs = $state<string[]>([]);
    let deployComplete = $state(false);
    let deploySuccess = $state(false);
    let isCancelling = $state(false);
    let eventSourceRef = $state<EventSource | null>(null);

    let logsContainer = $state<HTMLDivElement>();

    onMount(() => {
        loadBranches();
    });

    async function loadBranches() {
        const result = await post<{ branches: string[] }>("/github/branches", {
            repoFullName,
        });
        if (result.success && result.data?.branches) {
            branches = result.data.branches;
            if (branches.length > 0) {
                selectedBranch = branches[0]; // branches is string[], not object[]
                await checkConfig();
            }
        }
        isLoading = false;
    }

    async function checkConfig() {
        hasConfig = null;
        const result = await post<{ hasConfig: boolean }>(
            "/github/check-config",
            {
                repoFullName,
                ref: selectedBranch,
            },
        );
        hasConfig = result.data?.hasConfig ?? false;
    }

    async function startDeploy() {
        if (!selectedBranch || isDeploying) return;

        isDeploying = true;
        logs = [];
        deployComplete = false;
        deploySuccess = false;

        // Parse env vars
        const env: Record<string, string> = {};
        if (envVars.trim()) {
            envVars.split("\n").forEach((line) => {
                const [key, ...valueParts] = line.split("=");
                if (key) env[key.trim()] = valueParts.join("=").trim();
            });
        }

        const result = await post<{ deploymentId: string }>("/github/import", {
            repoFullName,
            branch: selectedBranch,
            webhookAutoDeploy: webhookEnabled,
            env,
        });

        if (result.success && result.data?.deploymentId) {
            deploymentId = result.data.deploymentId;
            connectToStream();
        } else {
            logs = [`❌ Failed to start deployment: ${result.message}`];
            isDeploying = false;
        }
    }

    function connectToStream() {
        const eventSource = new EventSource(
            `/api/github/deploy-stream/${deploymentId}`,
        );

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "log") {
                logs = [...logs, data.message];
                scrollToBottom();
            } else if (data.type === "end") {
                eventSource.close();
                eventSourceRef = null;
                isDeploying = false;
                deployComplete = true;
                deploySuccess = logs.some(
                    (l) => l.includes("✅") || l.includes("succeeded"),
                );
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
            eventSourceRef = null;
            isDeploying = false;
            deployComplete = true;
        };

        eventSourceRef = eventSource;
    }

    async function cancelDeploy() {
        if (!deploymentId || isCancelling) return;

        isCancelling = true;
        const result = await post(
            `/github/cancel-deployment/${deploymentId}`,
            {},
        );

        if (result.success) {
            toasts.success("Deployment cancellation requested");
        } else {
            toasts.error("Failed to cancel deployment");
        }
        isCancelling = false;
    }

    async function copyLogs() {
        const logsText = logs.join("\n");
        try {
            await navigator.clipboard.writeText(logsText);
            toasts.success("Logs copied to clipboard!");
        } catch (error) {
            toasts.error("Failed to copy logs");
        }
    }

    function scrollToBottom() {
        if (logsContainer) {
            logsContainer.scrollTop = logsContainer.scrollHeight;
        }
    }
</script>

<div class="space-y-6">
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <a href="/github" class="hover:text-[var(--primary)]">GitHub</a>
        <span>→</span>
        <span class="font-medium text-[var(--text-primary)]"
            >{repoFullName}</span
        >
    </div>

    <!-- Header -->
    <div>
        <h1 class="text-2xl font-bold text-[var(--text-primary)]">
            Deploy {repoName}
        </h1>
        <p class="mt-1 text-[var(--text-secondary)]">
            Configure and deploy from {repoFullName}
        </p>
    </div>

    {#if isLoading}
        <Card class="animate-pulse p-8">
            <div class="h-10 w-48 rounded bg-[var(--border)]"></div>
            <div class="mt-4 h-4 w-64 rounded bg-[var(--border)]"></div>
        </Card>
    {:else}
        <div class="grid gap-6 lg:grid-cols-2">
            <!-- Configuration -->
            <Card>
                <h2 class="text-lg font-semibold text-[var(--text-primary)]">
                    Configuration
                </h2>

                <!-- Branch -->
                <div class="mt-4">
                    <label
                        for="branch-select"
                        class="mb-2 block text-sm font-medium text-[var(--text-primary)]"
                        >Branch</label
                    >
                    <select
                        id="branch-select"
                        bind:value={selectedBranch}
                        onchange={checkConfig}
                        class="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm focus:border-[var(--primary)] focus:outline-none"
                        style="color: #1a1a1a; background-color: #ffffff;"
                    >
                        {#each branches as branch}
                            <option
                                value={branch}
                                style="color: #1a1a1a; background-color: #ffffff;"
                                >{branch}</option
                            >
                        {/each}
                    </select>
                </div>

                <!-- Config Status -->
                <div class="mt-4">
                    {#if hasConfig === null}
                        <Badge variant="outline">Checking okastr8.yaml...</Badge
                        >
                    {:else if hasConfig}
                        <Badge variant="success" class="flex gap-1 items-center"
                            ><Check size={14} /> okastr8.yaml found</Badge
                        >
                    {:else}
                        <Badge variant="warning" class="flex gap-1 items-center"
                            ><TriangleAlert size={14} /> No okastr8.yaml found</Badge
                        >
                    {/if}
                </div>

                <!-- Webhook -->
                <div class="mt-4">
                    <label class="flex items-center gap-3">
                        <input
                            type="checkbox"
                            bind:checked={webhookEnabled}
                            class="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                        />
                        <span class="text-sm text-[var(--text-primary)]"
                            >Enable auto-deploy on push</span
                        >
                    </label>
                </div>

                <!-- Env Vars -->
                <div class="mt-4">
                    <label
                        for="env-vars"
                        class="mb-2 block text-sm font-medium text-[var(--text-primary)]"
                    >
                        Environment Variables (optional)
                    </label>
                    <textarea
                        id="env-vars"
                        bind:value={envVars}
                        placeholder="KEY=value&#10;ANOTHER_KEY=another_value"
                        rows="4"
                        class="w-full rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2.5 font-mono text-sm placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none"
                        style="color: #000000 !important; background-color: #ffffff !important;"
                    ></textarea>
                </div>

                <!-- Deploy Button -->
                <Button
                    class="mt-6 w-full"
                    onclick={startDeploy}
                    disabled={isDeploying || !hasConfig}
                >
                    {#if isDeploying}
                        <div
                            class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                        ></div>
                        Deploying...
                    {:else}
                        <Rocket size={16} class="mr-2" /> Start Deploy
                    {/if}
                </Button>

                <!-- Cancel Button (shown during deployment) -->
                {#if isDeploying}
                    <button
                        onclick={cancelDeploy}
                        disabled={isCancelling}
                        class="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-500 rounded-xl border border-red-500 hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50"
                    >
                        {#if isCancelling}
                            <div
                                class="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent"
                            ></div>
                        {:else}
                            <XCircle size={16} />
                        {/if}
                        Cancel Deployment
                    </button>
                {/if}
            </Card>

            <!-- Logs -->
            <Card class="flex flex-col">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <h2
                            class="text-lg font-semibold text-[var(--text-primary)]"
                        >
                            Deployment Logs
                        </h2>
                        {#if logs.length > 0}
                            <button
                                onclick={copyLogs}
                                class="p-1.5 rounded hover:bg-[var(--border)] transition-colors"
                                title="Copy logs to clipboard"
                            >
                                <Clipboard
                                    size={16}
                                    class="text-[var(--text-secondary)]"
                                />
                            </button>
                        {/if}
                    </div>
                    <div class="flex items-center gap-2">
                        {#if isDeploying}
                            <Badge variant="warning">
                                <div
                                    class="h-2 w-2 animate-pulse rounded-full bg-yellow-500"
                                ></div>
                                Deploying
                            </Badge>
                        {:else if deployComplete}
                            <Badge
                                variant={deploySuccess ? "success" : "error"}
                                class="flex gap-1 items-center"
                            >
                                {#if deploySuccess}
                                    <Check size={14} /> Success
                                {:else}
                                    <X size={14} /> Failed
                                {/if}
                            </Badge>
                        {/if}
                    </div>
                </div>

                <div
                    bind:this={logsContainer}
                    class="mt-4 flex-1 overflow-auto rounded-[var(--radius-md)] bg-[var(--bg-terminal)] p-4 font-mono text-sm text-green-400"
                    style="min-height: 300px; max-height: 400px;"
                >
                    {#if logs.length === 0}
                        <p class="text-[var(--text-muted)]">
                            Waiting to start deployment...
                        </p>
                    {:else}
                        {#each logs as log}
                            <p class="whitespace-pre-wrap">{log}</p>
                        {/each}
                    {/if}
                </div>

                {#if deployComplete && deploySuccess}
                    <a
                        href="/apps"
                        class="mt-4 inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--success)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-600"
                    >
                        View Apps →
                    </a>
                {/if}
            </Card>
        </div>
    {/if}
</div>
