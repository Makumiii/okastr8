<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { fade } from "svelte/transition";
    import {
        Check,
        Terminal,
        ExternalLink,
        Settings,
        Database,
        Server,
        RefreshCw,
        Globe,
        Zap,
    } from "lucide-svelte";

    const props = $props<{
        appName?: string;
        config?: any;
        detectedRuntime?: string;
        hasUserDocker?: boolean;
        disabled?: boolean;
        showActions?: boolean;
        embedded?: boolean;
    }>();
    const appName = $derived(props.appName ?? "");
    const configData = $derived(props.config ?? {});
    const detectedRuntime = $derived(props.detectedRuntime ?? "custom");
    const hasUserDocker = $derived(props.hasUserDocker ?? false);
    const isDisabled = $derived(props.disabled ?? false);
    const showActions = $derived(props.showActions ?? true);
    const embedded = $derived(props.embedded ?? false);

    const dispatch = createEventDispatcher();

    // DB/Cache Types
    const DB_TYPES = [
        { value: "", label: "None" },
        { value: "postgres", label: "PostgreSQL" },
        { value: "mysql", label: "MySQL" },
        { value: "mongo", label: "MongoDB" },
        { value: "other", label: "Other (Full Image Name)" },
    ];

    const CACHE_TYPES = [
        { value: "", label: "None" },
        { value: "redis", label: "Redis" },
        { value: "other", label: "Other (Full Image Name)" },
    ];

    const DEFAULT_DB_VERSIONS: Record<string, string> = {
        postgres: "15",
        mysql: "8",
        mongo: "7",
        mongodb: "7",
    };

    const DEFAULT_CACHE_VERSIONS: Record<string, string> = {
        redis: "7",
    };

    function normalizeServiceType(type: string) {
        switch (type) {
            case "mongodb":
                return "mongo";
            case "postgresql":
                return "postgres";
            default:
                return type;
        }
    }

    // Helper to parse "type:version" -> { type, version }
    function parseServiceString(str: string, knownTypes: string[]) {
        if (!str) return { type: "", version: "" };

        const parts = str.split(":");
        const rawType = parts[0];
        const type = normalizeServiceType(rawType);
        const version =
            parts.slice(1).join(":") ||
            DEFAULT_DB_VERSIONS[type] ||
            DEFAULT_CACHE_VERSIONS[type] ||
            "latest";

        if (knownTypes.includes(type)) {
            return { type, version };
        }
        return { type: "other", version: str }; // "other" uses version field for full string
    }

    let dbType = $state("");
    let dbVersion = $state(""); // Used for version OR full string if other
    let cacheType = $state("");
    let cacheVersion = $state("");

    const runtimes = [
        { value: "node:22", label: "Node.js (LTS)" },
        { value: "python:3.12", label: "Python (3.12)" },
        { value: "go:1.22", label: "Go (1.22)" },
        { value: "bun:1", label: "Bun (1.x)" },
        { value: "deno:2", label: "Deno (2.x)" },
    ];

    const startRequired = $derived(!hasUserDocker);

    let runtime = $state<string>("custom");
    let port = $state<number>(3000);
    let startCommand = $state<string>("");
    let buildSteps = $state<string[]>([]);
    let domain = $state<string>("");
    let tunnelRouting = $state<boolean>(false);
    let isSubmitting = $state(false);
    let prevDbType = $state<string>("");
    let prevCacheType = $state<string>("");

    $effect(() => {
        const initDb = parseServiceString(configData.database, [
            "postgres",
            "mysql",
            "mongo",
        ]);
        dbType = initDb.type;
        dbVersion = initDb.version;

        const initCache = parseServiceString(configData.cache, ["redis"]);
        cacheType = initCache.type;
        cacheVersion = initCache.version;

        runtime = configData.runtime || detectedRuntime || "custom";
        port = configData.port ?? 3000;
        startCommand = configData.startCommand ?? "";

        const rawBuildSteps = Array.isArray(configData.buildSteps)
            ? configData.buildSteps
            : Array.isArray(configData.build)
              ? configData.build
              : typeof configData.buildSteps === "string"
                ? configData.buildSteps.split("\n")
                : typeof configData.build === "string"
                  ? configData.build.split("\n")
                  : [];
        buildSteps = rawBuildSteps
            .map((step: string) => String(step).trim())
            .filter((step: string) => step);

        domain = configData.domain ?? "";
        tunnelRouting = configData.tunnel_routing ?? false;
    });

    $effect(() => {
        if (dbType !== prevDbType) {
            if (dbType && dbType !== "other") {
                if (!dbVersion || dbVersion === "latest") {
                    dbVersion = DEFAULT_DB_VERSIONS[dbType] ?? dbVersion;
                }
            } else if (dbType === "other") {
                dbVersion = "";
            }
            prevDbType = dbType;
        }
    });

    $effect(() => {
        if (cacheType !== prevCacheType) {
            if (cacheType && cacheType !== "other") {
                if (!cacheVersion || cacheVersion === "latest") {
                    cacheVersion =
                        DEFAULT_CACHE_VERSIONS[cacheType] ?? cacheVersion;
                }
            } else if (cacheType === "other") {
                cacheVersion = "";
            }
            prevCacheType = cacheType;
        }
    });

    export function submit() {
        if (isDisabled) return;
        handleSubmit();
    }

    export function getConfig() {
        // Reconstruct DB string
        let database = "";
        if (dbType) {
            if (dbType === "other")
                database = dbVersion; // In 'other', dbVersion holds the full string
            else database = `${dbType}:${dbVersion}`;
        }

        // Reconstruct Cache string
        let cache = "";
        if (cacheType) {
            if (cacheType === "other") cache = cacheVersion;
            else cache = `${cacheType}:${cacheVersion}`;
        }

        return {
            runtime,
            port: Number(port),
            startCommand,
            buildSteps: buildSteps.map((s) => s.trim()).filter((s) => s),
            domain,
            tunnel_routing: tunnelRouting,
            database,
            cache,
        };
    }

    function addBuildStep() {
        buildSteps = [...buildSteps, ""];
    }

    function updateBuildStep(index: number, value: string) {
        const next = [...buildSteps];
        next[index] = value;
        buildSteps = next;
    }

    function removeBuildStep(index: number) {
        buildSteps = buildSteps.filter((_, i) => i !== index);
    }

    function handleSubmit() {
        isSubmitting = true;

        dispatch("deploy", getConfig());
    }
</script>

<div
    class={embedded
        ? "w-full"
        : "bg-[var(--surface)] p-6 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-[var(--shadow-md)] w-full max-w-2xl mx-auto"}
    transition:fade
>
    {#if !embedded}
        <div class="flex items-center gap-3 mb-6 border-b border-[var(--border)] pb-4">
            <div class="p-2 bg-[var(--primary-light)] rounded-lg">
                <Settings class="w-6 h-6 text-[var(--primary-strong)]" />
            </div>
            <div>
                <h2 class="text-xl font-bold text-[var(--text-primary)]">
                    Deployment Configuration
                </h2>
                <p class="text-sm text-[var(--text-secondary)]">
                    Configure how {appName} should be built and run
                </p>
            </div>
        </div>
    {/if}

    <form
        onsubmit={(event) => {
            event.preventDefault();
            handleSubmit();
        }}
        class="space-y-6"
    >
        <!-- Runtime & Port Row -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2">
                <label
                    class="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2"
                >
                    <Server class="w-4 h-4" /> Runtime
                </label>
                <input
                    type="text"
                    bind:value={runtime}
                    list="runtime-options"
                    class="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                    placeholder="node:22"
                    disabled={isDisabled}
                />
                <datalist id="runtime-options">
                    {#each runtimes as r}
                        <option value={r.value}>{r.label}</option>
                    {/each}
                </datalist>
            </div>

            <div class="space-y-2">
                <label
                    class="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2"
                >
                    <ExternalLink class="w-4 h-4" /> Port
                </label>
                <input
                    type="number"
                    bind:value={port}
                    class="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                    placeholder="3000"
                    disabled={isDisabled}
                />
            </div>
        </div>

        <!-- Domain -->
        <div class="space-y-2">
            <label
                class="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2"
            >
                <Globe class="w-4 h-4" /> Domain (Optional)
            </label>
                <input
                    type="text"
                    bind:value={domain}
                    class="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                    placeholder="myapp.example.com"
                    disabled={isDisabled}
                />
            <div class="mt-2 flex items-center gap-2">
                <input
                    type="checkbox"
                    id="tunnel-routing"
                    bind:checked={tunnelRouting}
                    class="w-4 h-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] transition-colors"
                    disabled={isDisabled}
                />
                <label for="tunnel-routing" class="text-sm text-[var(--text-secondary)]">
                    Use Cloudflare Tunnel routing (bypasses default proxy)
                </label>
            </div>
        </div>

        <!-- Infrastructure / Services -->
        <div
            class="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-[var(--border)] pt-4 mt-4"
        >
            <div class="space-y-2">
                <label
                    class="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2"
                >
                    <Database class="w-4 h-4" /> Database
                </label>
                <div class="flex gap-2">
                    <div class="w-3/5">
                        <select
                            bind:value={dbType}
                            class="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                            disabled={isDisabled}
                        >
                            {#each DB_TYPES as t}
                                <option value={t.value}>{t.label}</option>
                            {/each}
                        </select>
                    </div>
                    {#if dbType && dbType !== "other"}
                        <div class="w-2/5">
                            <input
                                type="text"
                                bind:value={dbVersion}
                                class="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                                placeholder="Version (e.g. 15)"
                                disabled={isDisabled}
                            />
                        </div>
                    {/if}
                </div>
                {#if dbType === "other"}
                    <input
                        type="text"
                        bind:value={dbVersion}
                        class="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                        placeholder="Full Image (e.g. postgres:15-alpine)"
                        disabled={isDisabled}
                    />
                {/if}
            </div>

            <div class="space-y-2">
                <label
                    class="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2"
                >
                    <Zap class="w-4 h-4" /> Cache
                </label>
                <div class="flex gap-2">
                    <div class="w-3/5">
                        <select
                            bind:value={cacheType}
                            class="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                            disabled={isDisabled}
                        >
                            {#each CACHE_TYPES as t}
                                <option value={t.value}>{t.label}</option>
                            {/each}
                        </select>
                    </div>
                    {#if cacheType && cacheType !== "other"}
                        <div class="w-2/5">
                            <input
                                type="text"
                                bind:value={cacheVersion}
                                class="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                                placeholder="Version (e.g. 7)"
                                disabled={isDisabled}
                            />
                        </div>
                    {/if}
                </div>
                {#if cacheType === "other"}
                    <input
                        type="text"
                        bind:value={cacheVersion}
                        class="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                        placeholder="Full Image (e.g. redis:7-alpine)"
                        disabled={isDisabled}
                    />
                {/if}
            </div>
        </div>

        <!-- Commands -->
        <div class="space-y-4 border-t border-[var(--border)] pt-4">
            <div class="space-y-2">
                <label
                    class="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2"
                >
                    <Terminal class="w-4 h-4" /> Build Steps (Optional)
                </label>
                <div class="space-y-3 rounded-md border border-[var(--border)] bg-[var(--bg-card)] p-3">
                    {#if buildSteps.length === 0}
                        <p class="text-xs text-[var(--text-muted)]">
                            No build steps added yet. Add steps to run in order.
                        </p>
                    {:else}
                        <div class="space-y-2">
                            {#each buildSteps as step, index (index)}
                                <div class="flex items-center gap-2">
                                    <input
                                        type="text"
                                        class="flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] font-mono focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                                        placeholder={index === 0 ? "npm install" : "npm run build"}
                                        value={step}
                                        oninput={(event) => updateBuildStep(index, (event.currentTarget as HTMLInputElement).value)}
                                        disabled={isDisabled}
                                    />
                                    <button
                                        type="button"
                                        class="rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--error)]"
                                        onclick={() => removeBuildStep(index)}
                                        disabled={isDisabled}
                                    >
                                        Remove
                                    </button>
                                </div>
                            {/each}
                        </div>
                    {/if}
                    <div class="flex items-center justify-between text-xs text-[var(--text-muted)]">
                        <span>Runs in order from top to bottom.</span>
                        <button
                            type="button"
                            class="font-medium text-[var(--primary-strong)] hover:underline"
                            onclick={addBuildStep}
                            disabled={isDisabled}
                        >
                            + Add step
                        </button>
                    </div>
                </div>
            </div>

            <div class="space-y-2">
                <label
                    class="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2"
                >
                    <RefreshCw class="w-4 h-4" /> Start Command
                </label>
                <input
                    type="text"
                    bind:value={startCommand}
                    class="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors font-mono text-sm"
                    placeholder="npm run start"
                    required={startRequired}
                    disabled={isDisabled}
                />
                {#if !startRequired}
                    <p class="text-xs text-[var(--text-muted)]">
                        Optional when a Dockerfile or docker-compose.yml is present.
                    </p>
                {/if}
            </div>
        </div>

        <!-- Actions -->
        {#if showActions}
            <div
                class="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)] mt-6"
            >
                <button
                    type="button"
                    onclick={() => dispatch("cancel")}
                    class="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    disabled={isSubmitting || isDisabled}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting || isDisabled}
                    class="flex items-center gap-2 px-6 py-2 bg-[var(--primary)] hover:bg-[var(--primary-strong)] text-[var(--primary-ink)] rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {#if isSubmitting}
                        <div
                            class="w-4 h-4 border-2 border-[var(--primary-ink)] border-t-transparent rounded-full animate-spin"
                        ></div>
                        Deploying...
                    {:else}
                        <Check class="w-4 h-4" /> Run Deploy
                    {/if}
                </button>
            </div>
        {/if}
    </form>
</div>
