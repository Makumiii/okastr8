<script lang="ts">
    import { onMount } from "svelte";
    import { get, post } from "$lib/api";
    import { Card, Button, Badge } from "$lib/components/ui";
    import { toasts } from "$lib/stores/toasts";
    import { RefreshCcw } from "lucide-svelte";

    type Provider = "ghcr" | "dockerhub" | "ecr" | "generic";
    type PullPolicy = "always" | "if-not-present";

    interface RegistryCredentialSummary {
        id: string;
        provider: Provider;
        server: string;
        username: string;
        createdAt: string;
    }

    interface GhcrPackage {
        name: string;
        visibility?: string;
        updatedAt?: string;
    }

    interface GhcrVersion {
        id: string;
        tags: string[];
        digest?: string;
        updatedAt?: string;
    }

    interface AppRow {
        name: string;
    }

    let isLoading = $state(true);
    let isDeploying = $state(false);

    let provider = $state<Provider>("ghcr");
    let appName = $state("");
    let imageRef = $state("");
    let port = $state(8080);
    let containerPort = $state(80);
    let pullPolicy = $state<PullPolicy>("always");
    let releaseRetention = $state(50);
    let ownerType = $state<"user" | "org">("user");
    let owner = $state("");

    let credentials = $state<RegistryCredentialSummary[]>([]);
    let selectedCredentialId = $state("");

    let ghcrPackages = $state<GhcrPackage[]>([]);
    let ghcrTags = $state<GhcrVersion[]>([]);
    let selectedPackage = $state("");
    let selectedTag = $state("");

    let appNames = $state<Set<string>>(new Set());
    const appExists = $derived(appNames.has(appName.trim()));

    const filteredCredentials = $derived(
        credentials.filter(
            (credential) =>
                credential.provider === provider || credential.provider === "generic",
        ),
    );

    onMount(async () => {
        await Promise.all([loadCredentials(), loadApps()]);
        isLoading = false;
    });

    async function loadCredentials() {
        const result = await get<{ credentials: RegistryCredentialSummary[] }>(
            "/registry/credentials",
        );
        if (result.success && result.data?.credentials) {
            credentials = result.data.credentials;
            if (!selectedCredentialId && credentials.length > 0) {
                selectedCredentialId = credentials[0].id;
            }
        }
    }

    async function loadApps() {
        const result = await get<{ apps: AppRow[] }>("/app/list");
        if (result.success && result.data?.apps) {
            appNames = new Set(result.data.apps.map((app) => app.name));
        }
    }

    async function refreshGhcrPackages() {
        if (provider !== "ghcr" || !selectedCredentialId) return;
        const result = await post<{
            owner?: string;
            packages?: GhcrPackage[];
        }>("/registry/ghcr/packages", {
            credentialId: selectedCredentialId,
            ownerType,
            owner: owner.trim() || undefined,
        });
        if (!result.success) {
            toasts.error(result.message || "Failed to load GHCR packages");
            ghcrPackages = [];
            return;
        }
        ghcrPackages = result.data?.packages || [];
        if (ghcrPackages.length === 0) {
            toasts.error("No GHCR container packages found for that scope.");
        }
    }

    async function refreshGhcrTags() {
        if (provider !== "ghcr" || !selectedCredentialId || !selectedPackage) return;
        const result = await post<{
            owner?: string;
            packageName?: string;
            versions?: GhcrVersion[];
        }>("/registry/ghcr/tags", {
            credentialId: selectedCredentialId,
            packageName: selectedPackage,
            ownerType,
            owner: owner.trim() || undefined,
        });
        if (!result.success) {
            toasts.error(result.message || "Failed to load GHCR tags");
            ghcrTags = [];
            return;
        }
        ghcrTags = result.data?.versions || [];
        if (ghcrTags.length === 0) {
            toasts.error("No tags found for selected package.");
        }
    }

    function applyGhcrSelection() {
        if (!selectedPackage || !selectedTag) return;
        const resolvedOwner = owner.trim() || currentCredentialUsername();
        imageRef = `ghcr.io/${resolvedOwner}/${selectedPackage}:${selectedTag}`;
    }

    function currentCredentialUsername() {
        return credentials.find((credential) => credential.id === selectedCredentialId)?.username || "";
    }

    async function deployContainer() {
        if (!appName.trim()) {
            toasts.error("App name is required.");
            return;
        }
        if (!imageRef.trim()) {
            toasts.error("Image reference is required.");
            return;
        }
        if (!selectedCredentialId) {
            toasts.error("Select a registry credential.");
            return;
        }

        isDeploying = true;
        try {
            if (appExists) {
                const updateResult = await post("/app/update-image", {
                    name: appName.trim(),
                    imageRef: imageRef.trim(),
                    pullPolicy,
                    port: Number(port),
                    containerPort: Number(containerPort),
                    registryCredentialId: selectedCredentialId,
                    registryProvider: provider,
                });
                if (!updateResult.success) {
                    toasts.error(updateResult.message || "Failed to update existing app");
                    return;
                }
            } else {
                const createResult = await post("/app/create", {
                    name: appName.trim(),
                    description: `Container deploy (${provider})`,
                    execStart: "docker run",
                    workingDirectory: "",
                    user: "root",
                    port: Number(port),
                    containerPort: Number(containerPort),
                    deployStrategy: "image",
                    imageRef: imageRef.trim(),
                    pullPolicy,
                    registryCredentialId: selectedCredentialId,
                    registryProvider: provider,
                    imageReleaseRetention: Number(releaseRetention),
                    webhookAutoDeploy: false,
                });
                if (!createResult.success) {
                    toasts.error(createResult.message || "Failed to create app");
                    return;
                }
                await loadApps();
            }

            const deployResult = await post("/deploy/trigger", {
                appName: appName.trim(),
            });
            if (!deployResult.success) {
                toasts.error(deployResult.message || "Container deployment failed");
                return;
            }

            toasts.success(deployResult.message || "Container deployment started");
        } finally {
            isDeploying = false;
        }
    }
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between gap-4">
        <div>
            <h1 class="text-2xl font-bold text-[var(--text-primary)]">Container Deploy</h1>
            <p class="mt-1 text-[var(--text-secondary)]">
                Deploy from GHCR or any OCR image reference.
            </p>
        </div>
        <a href="/deploy" class="text-sm font-medium text-[var(--primary-strong)] hover:underline">
            ← Back to strategy
        </a>
    </div>

    {#if isLoading}
        <Card class="animate-pulse p-8">
            <div class="h-8 w-40 rounded bg-[var(--border)]"></div>
        </Card>
    {:else}
        <Card class="space-y-5">
            <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-2">
                    <label for="provider" class="text-sm font-medium text-[var(--text-primary)]">Provider</label>
                    <select
                        id="provider"
                        bind:value={provider}
                        class="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    >
                        <option value="ghcr">GHCR</option>
                        <option value="dockerhub">Docker Hub</option>
                        <option value="ecr">AWS ECR</option>
                        <option value="generic">Generic</option>
                    </select>
                </div>
                <div class="space-y-2">
                    <label for="registry-credential" class="text-sm font-medium text-[var(--text-primary)]">Registry Credential</label>
                    <select
                        id="registry-credential"
                        bind:value={selectedCredentialId}
                        class="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    >
                        <option value="">Select credential</option>
                        {#each filteredCredentials as credential}
                            <option value={credential.id}>
                                {credential.id} ({credential.provider})
                            </option>
                        {/each}
                    </select>
                </div>
            </div>

            {#if provider === "ghcr"}
                <div class="space-y-4 rounded-[var(--radius-md)] border border-[var(--border)] p-4">
                    <div class="flex items-center justify-between">
                        <h2 class="text-sm font-semibold text-[var(--text-primary)]">Browse GHCR Containers</h2>
                        <Button variant="outline" size="sm" onclick={refreshGhcrPackages}>
                            <RefreshCcw size={14} class="mr-1" />
                            Load Packages
                        </Button>
                    </div>
                    <div class="grid gap-4 md:grid-cols-2">
                        <div class="space-y-2">
                            <label for="ghcr-owner-type" class="text-sm text-[var(--text-secondary)]">Owner type</label>
                            <select
                                id="ghcr-owner-type"
                                bind:value={ownerType}
                                class="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm"
                            >
                                <option value="user">User</option>
                                <option value="org">Org</option>
                            </select>
                        </div>
                        <div class="space-y-2">
                            <label for="ghcr-owner" class="text-sm text-[var(--text-secondary)]">Owner (optional)</label>
                            <input
                                id="ghcr-owner"
                                bind:value={owner}
                                class="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm"
                                placeholder={currentCredentialUsername() || "ghcr owner"}
                            />
                        </div>
                    </div>

                    <div class="grid gap-4 md:grid-cols-3">
                        <div class="space-y-2 md:col-span-2">
                            <label for="ghcr-package" class="text-sm text-[var(--text-secondary)]">Package</label>
                            <select
                                id="ghcr-package"
                                bind:value={selectedPackage}
                                onchange={refreshGhcrTags}
                                class="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm"
                            >
                                <option value="">Select package</option>
                                {#each ghcrPackages as pkg}
                                    <option value={pkg.name}>{pkg.name}</option>
                                {/each}
                            </select>
                        </div>
                        <div class="space-y-2">
                            <label for="ghcr-tag" class="text-sm text-[var(--text-secondary)]">Tag</label>
                            <select
                                id="ghcr-tag"
                                bind:value={selectedTag}
                                onchange={applyGhcrSelection}
                                class="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm"
                            >
                                <option value="">Select tag</option>
                                {#each ghcrTags as row}
                                    {#each row.tags as tag}
                                        <option value={tag}>{tag}</option>
                                    {/each}
                                {/each}
                            </select>
                        </div>
                    </div>
                </div>
            {/if}

            <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-2">
                    <label for="app-name" class="text-sm font-medium text-[var(--text-primary)]">App name</label>
                    <input
                        id="app-name"
                        bind:value={appName}
                        class="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm"
                        placeholder="my-container-app"
                    />
                    {#if appExists}
                        <Badge variant="outline">Existing app will be updated</Badge>
                    {/if}
                </div>
                <div class="space-y-2">
                    <label for="image-ref" class="text-sm font-medium text-[var(--text-primary)]">Image reference</label>
                    <input
                        id="image-ref"
                        bind:value={imageRef}
                        class="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm"
                        placeholder="ghcr.io/org/app:tag"
                    />
                </div>
            </div>

            <div class="grid gap-4 md:grid-cols-4">
                <div class="space-y-2">
                    <label for="host-port" class="text-sm text-[var(--text-secondary)]">Host port</label>
                    <input id="host-port" type="number" bind:value={port} class="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm" />
                </div>
                <div class="space-y-2">
                    <label for="container-port" class="text-sm text-[var(--text-secondary)]">Container port</label>
                    <input id="container-port" type="number" bind:value={containerPort} class="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm" />
                </div>
                <div class="space-y-2">
                    <label for="pull-policy" class="text-sm text-[var(--text-secondary)]">Pull policy</label>
                    <select id="pull-policy" bind:value={pullPolicy} class="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm">
                        <option value="always">always</option>
                        <option value="if-not-present">if-not-present</option>
                    </select>
                </div>
                <div class="space-y-2">
                    <label for="release-retention" class="text-sm text-[var(--text-secondary)]">Release retention</label>
                    <input id="release-retention" type="number" min="1" bind:value={releaseRetention} class="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm" />
                </div>
            </div>

            <div class="flex justify-end">
                <Button onclick={deployContainer} disabled={isDeploying}>
                    {#if isDeploying}
                        Deploying...
                    {:else}
                        Deploy Container
                    {/if}
                </Button>
            </div>
        </Card>
    {/if}
</div>
