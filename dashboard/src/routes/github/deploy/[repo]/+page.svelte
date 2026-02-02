<script lang="ts">
    import { page } from "$app/stores";
    import { Card, Badge, Button } from "$lib/components/ui";
    import { post } from "$lib/api";
    import { onMount } from "svelte";
    import { toasts } from "$lib/stores/toasts";
    import DeployConfig from "$lib/components/DeployConfig.svelte";
    import {
        Check,
        TriangleAlert,
        Rocket,
        X,
        Clipboard,
        XCircle,
        Loader2,
    } from "lucide-svelte";

    const repoFullName = decodeURIComponent($page.params.repo ?? "");
    const [owner, repoName] = repoFullName.split("/");

    // State machine
    type DeployState = "idle" | "loading" | "deploying" | "finished";
    let deployState = $state<DeployState>("idle");

    let branches = $state<string[]>([]);
    let selectedBranch = $state("");
    let hasConfig = $state<boolean | null>(null);
    let webhookEnabled = $state(true);
    type EnvEntry = { id: number; key: string; value: string };
    let envEntries = $state<EnvEntry[]>([{ id: 1, key: "", value: "" }]);
    let nextEnvId = $state(2);

    let isLoading = $state(true);
    let activeDeploymentId = $state("");
    let logs = $state<string[]>([]);
    let deploySuccess = $state(false);
    let isCancelling = $state(false);
    let eventSourceRef = $state<EventSource | null>(null);
    let logsContainer = $state<HTMLDivElement>();

    // Config inspection result
    let preparedConfig = $state<any>({});
    let preparedAppName = $state<string>("");
    let preparedRuntime = $state<string>("");
    let preparedHasUserDocker = $state<boolean>(false);
    let preparedHasUserCompose = $state<boolean>(false);
    let deployConfigRef = $state<any>(null);
    let showConfirm = $state(false);
    let pendingConfig = $state<any>(null);

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
                selectedBranch = branches[0];
                await loadConfig();
            }
        }
        isLoading = false;
    }

    async function loadConfig() {
        if (!selectedBranch) return;
        hasConfig = null;
        deployState = "loading";
        const result = await post<any>("/github/inspect-config", {
            repoFullName,
            ref: selectedBranch,
        });

        if (result.success && result.data) {
            hasConfig = result.data.hasConfig ?? false;
            preparedConfig = result.data.config ?? {};
            preparedRuntime = result.data.detectedRuntime ?? "";
            preparedHasUserDocker = result.data.hasUserDocker ?? false;
            preparedHasUserCompose = result.data.hasUserCompose ?? false;
            if (result.data.config?.env) {
                setEntriesFromEnv(result.data.config.env);
            }
            deployState = "idle";
        } else {
            hasConfig = false;
            deployState = "idle";
            toasts.error(result.message || "Failed to inspect config");
        }
    }

    function parseEnvText(text: string): Record<string, string> {
        const env: Record<string, string> = {};
        text.split("\n").forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) return;
            const [key, ...valueParts] = trimmed.split("=");
            if (!key) return;
            env[key.trim()] = valueParts.join("=").trim();
        });
        return env;
    }

    function entriesToEnv(entries: EnvEntry[]): Record<string, string> {
        const env: Record<string, string> = {};
        entries.forEach((entry) => {
            if (!entry.key.trim()) return;
            env[entry.key.trim()] = entry.value?.trim?.() ?? entry.value;
        });
        return env;
    }

    function setEntriesFromEnv(env: Record<string, string> | undefined) {
        if (!env || typeof env !== "object") {
            envEntries = [{ id: 1, key: "", value: "" }];
            nextEnvId = 2;
            return;
        }
        const items = Object.entries(env).map(([key, value]) => ({
            id: nextEnvId++,
            key,
            value: value ?? "",
        }));
        envEntries = items.length ? items : [{ id: 1, key: "", value: "" }];
    }

    function addEnvEntry() {
        envEntries = [...envEntries, { id: nextEnvId++, key: "", value: "" }];
    }

    function removeEnvEntry(id: number) {
        const next = envEntries.filter((entry) => entry.id !== id);
        envEntries = next.length ? next : [{ id: nextEnvId++, key: "", value: "" }];
    }

    function clearEnvEntries() {
        envEntries = [{ id: nextEnvId++, key: "", value: "" }];
    }

    function isValidEnvKey(key: string) {
        return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
    }

    const invalidEnvKeys = $derived(
        envEntries
            .map((entry) => entry.key.trim())
            .filter((key) => key.length > 0 && !isValidEnvKey(key)),
    );

    const duplicateEnvKeys = $derived(
        (() => {
            const counts: Record<string, number> = {};
            envEntries.forEach((entry) => {
                const key = entry.key.trim();
                if (!key) return;
                counts[key] = (counts[key] || 0) + 1;
            });
            return Object.keys(counts).filter((key) => counts[key] > 1);
        })(),
    );

    const hasEnvIssues = $derived(
        invalidEnvKeys.length > 0 || duplicateEnvKeys.length > 0,
    );

    async function handleEnvFile(file: File) {
        const text = await file.text();
        const parsed = parseEnvText(text);
        const merged = { ...entriesToEnv(envEntries), ...parsed };
        setEntriesFromEnv(merged);
    }

    async function handleEnvDrop(event: DragEvent) {
        event.preventDefault();
        if (!event.dataTransfer?.files?.length) return;
        await handleEnvFile(event.dataTransfer.files[0]);
    }

    function handleEnvPaste(event: ClipboardEvent) {
        const text = event.clipboardData?.getData("text");
        if (!text) return;
        const parsed = parseEnvText(text);
        const merged = { ...entriesToEnv(envEntries), ...parsed };
        setEntriesFromEnv(merged);
    }

    function openConfirm() {
        if (deployState !== "idle") return;
        if (hasEnvIssues) {
            toasts.error("Fix environment variable errors before deploying.");
            return;
        }
        const config = deployConfigRef?.getConfig?.();
        if (!config) return;
        pendingConfig = config;
        showConfirm = true;
    }

    async function deployWithConfig(config: any) {
        const env = entriesToEnv(envEntries);
        const finalConfig = { ...config, env };
        deployState = "deploying";
        logs = [];
        deploySuccess = false;

        const result = await post<any>("/github/deploy", {
            repoFullName,
            branch: selectedBranch,
            config: finalConfig,
        });

        if (result.success && result.data?.deploymentId) {
            activeDeploymentId = result.data.deploymentId;
            connectToStream(activeDeploymentId, (finalSuccess) => {
                deployState = "finished";
                deploySuccess = finalSuccess;
            });
        } else {
            logs = [`❌ Deployment failed to start: ${result.message}`];
            deployState = "finished";
            deploySuccess = false;
        }
    }

    function confirmDeploy() {
        if (!pendingConfig) return;
        showConfirm = false;
        deployWithConfig(pendingConfig);
    }

    function getStrategySummary(config: any) {
        if (preparedHasUserCompose) {
            return "Use existing docker-compose.yml";
        }
        if (preparedHasUserDocker) {
            return "Use existing Dockerfile";
        }
        if (config?.database || config?.cache) {
            return "Auto-generate docker-compose with database/cache services";
        }
        return "Auto-generate Dockerfile";
    }

    function connectToStream(
        id: string,
        onComplete: (success: boolean) => void,
    ) {
        if (eventSourceRef) {
            eventSourceRef.close();
        }

        const eventSource = new EventSource(`/api/github/deploy-stream/${id}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "log") {
                logs = [...logs, data.message];
                scrollToBottom();
            } else if (data.type === "end") {
                eventSource.close();
                eventSourceRef = null;
                const success = logs.some(
                    (l) => l.includes("✅") || l.includes("succeeded"),
                );
                onComplete(success);
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
            eventSourceRef = null;
            // Assume failure on error if not explicit end
            // But let's check logs
            const success = logs.some(
                (l) => l.includes("✅") || l.includes("succeeded"),
            );
            onComplete(success);
        };

        eventSourceRef = eventSource;
    }

    async function cancelDeploy() {
        if (!activeDeploymentId || isCancelling) return;

        isCancelling = true;
        const result = await post(
            `/github/cancel-deployment/${activeDeploymentId}`,
            {},
        );

        if (result.success) {
            toasts.success("Cancellation requested");
        } else {
            toasts.error("Failed to cancel");
        }
        isCancelling = false;
    }

    async function copyLogs() {
        const logsText = logs.join("\n");
        try {
            await navigator.clipboard.writeText(logsText);
            toasts.success("Logs copied!");
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
        <a href="/github" class="hover:text-[var(--primary-strong)]">GitHub</a>
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
            <!-- Configuration / Inputs -->
            <Card>
                <h2 class="text-lg font-semibold text-[var(--text-primary)]">
                    Setup Deployment
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
                        onchange={loadConfig}
                        disabled={deployState === "loading" || deployState === "deploying"}
                        class="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none disabled:opacity-50"
                    >
                        {#each branches as branch}
                            <option
                                value={branch}
                                class="text-[var(--text-primary)]"
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
                            disabled={deployState === "loading" || deployState === "deploying"}
                            class="h-4 w-4 rounded border-[var(--border)] text-[var(--primary-strong)] focus:ring-[var(--primary)]"
                        />
                        <span class="text-sm text-[var(--text-primary)]"
                            >Enable auto-deploy on push</span
                        >
                    </label>
                </div>

                <!-- Config Form -->
                <div class="mt-6 border-t border-[var(--border)] pt-6 space-y-2">
                    {#if deployState === "loading"}
                        <p class="text-sm text-[var(--text-secondary)]">
                            Loading configuration for this branch...
                        </p>
                    {:else if !hasConfig}
                        <p class="text-sm text-[var(--text-secondary)]">
                            No okastr8.yaml found. Fill in the settings below.
                        </p>
                    {/if}
                    <DeployConfig
                        bind:this={deployConfigRef}
                        appName={preparedAppName}
                        config={preparedConfig ?? {}}
                        detectedRuntime={preparedRuntime}
                        hasUserDocker={preparedHasUserDocker}
                        disabled={deployState === "loading" || deployState === "deploying"}
                        showActions={false}
                        embedded={true}
                    />
                </div>

                <!-- Env Vars -->
                <div class="mt-6 space-y-3">
                    <div class="flex items-center justify-between">
                        <span
                            id="env-vars-label"
                            class="block text-sm font-medium text-[var(--text-primary)]"
                        >
                            Environment Variables (optional)
                        </span>
                        <div class="flex items-center gap-3 text-xs">
                            <button
                                type="button"
                                class="font-medium text-[var(--primary-strong)] hover:underline"
                                onclick={addEnvEntry}
                                disabled={deployState === "loading" || deployState === "deploying"}
                            >
                                + Add variable
                            </button>
                            <button
                                type="button"
                                class="font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                onclick={clearEnvEntries}
                                disabled={deployState === "loading" || deployState === "deploying"}
                            >
                                Clear all
                            </button>
                        </div>
                    </div>

                    <div
                        role="region"
                        aria-labelledby="env-vars-label"
                        class="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] p-3"
                        ondrop={handleEnvDrop}
                        ondragover={(event) => event.preventDefault()}
                        onpaste={handleEnvPaste}
                    >
                        <div class="grid gap-3">
                            {#each envEntries as entry (entry.id)}
                                <div class="grid grid-cols-12 gap-2 items-center">
                                    <input
                                        type="text"
                                        class="col-span-5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                                        placeholder="KEY"
                                        bind:value={entry.key}
                                        disabled={deployState === "loading" || deployState === "deploying"}
                                    />
                                    <input
                                        type="text"
                                        class="col-span-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                                        placeholder="VALUE"
                                        bind:value={entry.value}
                                        disabled={deployState === "loading" || deployState === "deploying"}
                                    />
                                    <button
                                        type="button"
                                        class="col-span-1 text-xs text-[var(--text-secondary)] hover:text-[var(--error)]"
                                        onclick={() => removeEnvEntry(entry.id)}
                                        disabled={deployState === "loading" || deployState === "deploying"}
                                        title="Remove"
                                    >
                                        ✕
                                    </button>
                                </div>
                            {/each}
                        </div>
                        <div class="mt-3 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                            <span>Paste or drag & drop a .env file here</span>
                            <label class="cursor-pointer text-[var(--primary-strong)] hover:underline">
                                Import .env
                                <input
                                    type="file"
                                    accept=".env,text/plain"
                                    class="hidden"
                                    disabled={deployState === "loading" || deployState === "deploying"}
                                    onchange={async (event) => {
                                        const file = event.currentTarget.files?.[0];
                                        if (file) await handleEnvFile(file);
                                        event.currentTarget.value = "";
                                    }}
                                />
                            </label>
                        </div>
                        {#if invalidEnvKeys.length > 0}
                            <p class="mt-3 text-xs text-[var(--error)]">
                                Invalid keys: {invalidEnvKeys.join(", ")}. Use
                                letters, numbers, and underscores only.
                            </p>
                        {/if}
                        {#if duplicateEnvKeys.length > 0}
                            <p class="mt-1 text-xs text-[var(--error)]">
                                Duplicate keys: {duplicateEnvKeys.join(", ")}.
                            </p>
                        {/if}
                    </div>
                </div>

                <!-- Actions -->
                <div class="mt-6 flex flex-col gap-3">
                    {#if deployState === "loading" || deployState === "deploying"}
                        <div
                            class="flex items-center justify-center p-4 bg-[var(--bg-secondary)] rounded-lg"
                        >
                            <Loader2 class="animate-spin text-[var(--primary-strong)] mr-2" />
                            <span
                                class="text-sm text-[var(--text-secondary)] capitalize"
                                >{deployState}...</span
                            >
                        </div>
                        <button
                            onclick={cancelDeploy}
                            disabled={isCancelling}
                            class="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-[var(--error)] rounded-xl border border-[var(--error)] hover:bg-[var(--error)] hover:text-[var(--text-inverse)] transition-colors disabled:opacity-50"
                        >
                            {#if isCancelling}
                                <Loader2 size={16} class="animate-spin" />
                            {:else}
                                <XCircle size={16} />
                            {/if}
                            Cancel
                        </button>
                    {:else}
                        <Button
                            class="w-full"
                            onclick={openConfirm}
                            disabled={!selectedBranch || deployState !== "idle"}
                        >
                            <Rocket size={16} class="mr-2" /> Confirm Deployment
                        </Button>
                    {/if}
                </div>
            </Card>

            <!-- Logs -->
            <Card class="flex flex-col">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <h2
                            class="text-lg font-semibold text-[var(--text-primary)]"
                        >
                            Logs
                        </h2>
                        {#if logs.length > 0}
                            <button
                                onclick={copyLogs}
                                class="p-1.5 rounded hover:bg-[var(--border)] transition-colors"
                                title="Copy logs"
                            >
                                <Clipboard
                                    size={16}
                                    class="text-[var(--text-secondary)]"
                                />
                            </button>
                        {/if}
                    </div>
                    <div>
                        {#if deployState === "finished"}
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
                    class="mt-4 flex-1 overflow-auto rounded-[var(--radius-md)] bg-[var(--bg-terminal)] p-4 font-mono text-sm text-[var(--accent)] border border-[var(--border)]"
                    style="min-height: 300px; max-height: 500px;"
                >
                    {#if logs.length === 0}
                        <p class="text-[var(--text-muted)] italic">
                            Logs will appear here...
                        </p>
                    {:else}
                        {#each logs as log}
                            <p
                                class="whitespace-pre-wrap font-mono text-xs md:text-sm"
                            >
                                {log}
                            </p>
                        {/each}
                    {/if}
                </div>

                {#if deployState === "finished" && deploySuccess}
                    <a
                        href="/apps"
                        class="mt-4 inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--success)] px-4 py-2.5 text-sm font-medium text-[var(--primary-ink)] transition-colors hover:bg-[var(--primary-strong)]"
                    >
                        View Apps →
                    </a>
                {/if}
            </Card>
        </div>
    {/if}

    {#if showConfirm}
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4">
            <div class="w-full max-w-xl rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] p-6 text-[var(--text-primary)] shadow-xl">
                <h3 class="text-lg font-semibold text-[var(--text-primary)]">
                    Confirm deployment settings
                </h3>
                <p class="mt-1 text-sm text-[var(--text-secondary)]">
                    Review the generated okastr8.yaml and deployment strategy before continuing.
                </p>

                <div class="mt-4 space-y-2 text-sm">
                    <div class="flex items-center justify-between">
                        <span class="text-[var(--text-secondary)]">Strategy</span>
                        <span class="font-medium">{getStrategySummary(pendingConfig)}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-[var(--text-secondary)]">Runtime</span>
                        <span class="font-medium">{pendingConfig?.runtime || "custom"}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-[var(--text-secondary)]">Port</span>
                        <span class="font-medium">{pendingConfig?.port ?? "—"}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-[var(--text-secondary)]">Start Command</span>
                        <span class="font-medium">{pendingConfig?.startCommand || "—"}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-[var(--text-secondary)]">Build Steps</span>
                        <span class="font-medium">
                            {pendingConfig?.buildSteps?.length ?? 0}
                        </span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-[var(--text-secondary)]">Domain</span>
                        <span class="font-medium">{pendingConfig?.domain || "—"}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-[var(--text-secondary)]">Database</span>
                        <span class="font-medium">{pendingConfig?.database || "—"}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-[var(--text-secondary)]">Cache</span>
                        <span class="font-medium">{pendingConfig?.cache || "—"}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-[var(--text-secondary)]">Env Vars</span>
                        <span class="font-medium">
                            {Object.keys(entriesToEnv(envEntries)).length}
                        </span>
                    </div>
                </div>

                <div class="mt-6 flex items-center justify-end gap-3">
                    <button
                        class="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        onclick={() => {
                            showConfirm = false;
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        class="rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-ink)] hover:bg-[var(--primary-strong)]"
                        onclick={confirmDeploy}
                    >
                        Deploy now
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>
