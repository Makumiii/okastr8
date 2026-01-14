<script lang="ts">
    import { Card, Badge, Button } from "$lib/components/ui";
    import { get, post } from "$lib/api";
    import { onMount } from "svelte";
    import { toasts } from "$lib/stores/toasts";

    interface GitHubStatus {
        connected: boolean;
        username?: string;
        connectedAt?: string;
    }

    interface Repo {
        name: string;
        full_name: string;
        description: string | null;
        private: boolean;
        html_url: string;
        default_branch: string;
        updated_at: string;
    }

    let status = $state<GitHubStatus | null>(null);
    let repos = $state<Repo[]>([]);
    let isLoading = $state(true);
    let search = $state("");

    $effect(() => {
        filteredRepos = repos.filter(
            (r) =>
                r.name.toLowerCase().includes(search.toLowerCase()) ||
                r.description?.toLowerCase().includes(search.toLowerCase()),
        );
    });

    let filteredRepos = $state<Repo[]>([]);

    onMount(async () => {
        await loadStatus();
    });

    async function loadStatus() {
        isLoading = true;
        try {
            const result = await get<GitHubStatus>("/github/status");
            status = result.data || { connected: false };

            if (status?.connected) {
                await loadRepos();
            }
        } catch (e) {
            toasts.error("Failed to load GitHub status");
        } finally {
            isLoading = false;
        }
    }

    async function loadRepos() {
        const result = await get<{ repos: Repo[] }>("/github/repos");
        if (result.success && result.data?.repos) {
            repos = result.data.repos;
            filteredRepos = repos;
        }
    }

    async function connectGitHub() {
        try {
            const result = await get<{ authUrl: string }>("/github/auth-url");
            if (result.success && result.data?.authUrl) {
                window.location.href = result.data.authUrl;
            } else {
                toasts.error(result.message || "Failed to get auth URL");
            }
        } catch (e) {
            toasts.error("Failed to connect to GitHub");
        }
    }

    async function disconnect() {
        await post("/github/disconnect");
        toasts.success("GitHub disconnected");
        status = { connected: false };
        repos = [];
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }
</script>

<div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold text-[var(--text-primary)]">
                GitHub
            </h1>
            <p class="mt-1 text-[var(--text-secondary)]">
                Connect and deploy from your repositories
            </p>
        </div>
        {#if status?.connected}
            <div class="flex items-center gap-3">
                <Badge variant="success">
                    <span class="inline-block h-2 w-2 rounded-full bg-green-500"
                    ></span>
                    Connected as @{status.username}
                </Badge>
                <Button variant="outline" size="sm" onclick={disconnect}
                    >Disconnect</Button
                >
            </div>
        {/if}
    </div>

    {#if isLoading}
        <Card class="flex animate-pulse flex-col items-center p-12">
            <div
                class="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent"
            ></div>
            <p class="mt-4 text-[var(--text-secondary)]">Loading...</p>
        </Card>
    {:else if !status?.connected}
        <!-- Not connected -->
        <Card class="flex flex-col items-center p-12">
            <div class="text-6xl">🐙</div>
            <h2 class="mt-4 text-xl font-semibold text-[var(--text-primary)]">
                Connect to GitHub
            </h2>
            <p class="mt-2 text-center text-[var(--text-secondary)]">
                Link your GitHub account to import and deploy repositories
            </p>
            <Button class="mt-6" onclick={connectGitHub}>
                Connect GitHub Account
            </Button>
        </Card>
    {:else}
        <!-- Connected - Show repos -->
        <Card class="!p-4">
            <input
                type="text"
                bind:value={search}
                placeholder="Search repositories..."
                class="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none"
            />
        </Card>

        {#if filteredRepos.length === 0}
            <Card class="flex flex-col items-center p-8">
                <p class="text-[var(--text-secondary)]">
                    {search
                        ? "No repositories match your search"
                        : "No repositories found"}
                </p>
            </Card>
        {:else}
            <div class="space-y-3">
                {#each filteredRepos as repo}
                    <Card
                        class="flex items-center justify-between !p-4 transition-all hover:shadow-lg"
                    >
                        <div class="flex items-center gap-4">
                            <div
                                class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-sidebar)] text-lg"
                            >
                                {repo.private ? "🔒" : "📦"}
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <span
                                        class="font-semibold text-[var(--text-primary)]"
                                        >{repo.name}</span
                                    >
                                    {#if repo.private}
                                        <Badge variant="outline">Private</Badge>
                                    {/if}
                                </div>
                                {#if repo.description}
                                    <p
                                        class="mt-0.5 text-sm text-[var(--text-secondary)] line-clamp-1"
                                    >
                                        {repo.description}
                                    </p>
                                {/if}
                                <p
                                    class="mt-1 text-xs text-[var(--text-muted)]"
                                >
                                    Updated {formatDate(repo.updated_at)}
                                </p>
                            </div>
                        </div>
                        <a
                            href="/github/deploy/{encodeURIComponent(
                                repo.full_name,
                            )}"
                            class="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)]"
                        >
                            Deploy
                        </a>
                    </Card>
                {/each}
            </div>
        {/if}
    {/if}
</div>
