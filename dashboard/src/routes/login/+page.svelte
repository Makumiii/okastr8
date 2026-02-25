<script lang="ts">
    import { Button } from "$lib/components/ui";
    import { Card } from "$lib/components/ui";
    import { onMount } from "svelte";
    import Okastr8Logo from "$lib/components/Okastr8Logo.svelte";
    import { Github } from "lucide-svelte";

    let isLoading = $state(false);
    let error = $state("");

    const errorMessages: Record<string, string> = {
        github_admin_not_set:
            "GitHub admin not set. Run okastr8 github connect on the server first.",
        github_not_allowed: "Your GitHub account isn't allowed to access this dashboard.",
        github_not_configured:
            "GitHub OAuth is not configured. Add client_id/client_secret to system.yaml.",
        github_auth_failed: "GitHub authentication failed. Try again.",
        no_code: "GitHub authentication failed. Try again.",
        config_missing:
            "GitHub OAuth is missing configuration. Add client_id/client_secret to system.yaml.",
        token_exchange_failed:
            "GitHub authentication failed to exchange token. Try again.",
        oauth_public_url_missing:
            "Public URL is required for OAuth in production. Set manager.public_url or tunnel.url in system.yaml.",
    };

    function handleGitHubLogin() {
        if (isLoading) return;
        isLoading = true;
        window.location.href = "/api/auth/github";
    }

    onMount(() => {
        const params = new URLSearchParams(window.location.search);
        const errorParam = params.get("error");
        if (errorParam && !error) {
            error = errorMessages[errorParam] || "Authentication failed";
        }
    });
</script>

<div class="flex min-h-screen items-center justify-center bg-[var(--bg-page)]">
    <Card class="w-full max-w-md">
        <div class="flex flex-col items-center gap-6">
            <!-- Logo -->
            <div class="flex items-center gap-3">
                <Okastr8Logo className="text-2xl" />
            </div>

            <div class="w-full space-y-4">
                <Button onclick={handleGitHubLogin} class="w-full">
                    {#if isLoading}
                        <div
                            class="h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary-ink)] border-t-transparent"
                        ></div>
                        Redirecting...
                    {:else}
                        <Github size={16} />
                        Sign in with GitHub
                    {/if}
                </Button>

                {#if error}
                    <div
                        class="rounded-[var(--radius-md)] bg-[var(--error-light)] px-4 py-3 text-sm text-[var(--error)]"
                    >
                        {error}
                    </div>
                {/if}
            </div>
        </div>
    </Card>
</div>
