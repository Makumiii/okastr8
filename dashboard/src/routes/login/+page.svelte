<script lang="ts">
    import { Button } from "$lib/components/ui";
    import { Card } from "$lib/components/ui";
    import { onMount } from "svelte";

    let token = $state("");
    let isLoading = $state(false);
    let error = $state("");
    let pendingApproval = $state(false);
    let requestId = $state("");

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
    };

    async function handleLogin() {
        if (!token.trim()) {
            error = "Please enter your API token";
            return;
        }

        isLoading = true;
        error = "";

        try {
            const res = await fetch("/api/auth/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: token.trim() }),
            });

            const data = await res.json();

            if (!data.success) {
                error = data.message || "Authentication failed";
                isLoading = false;
                return;
            }

            if (data.data?.pendingApproval) {
                pendingApproval = true;
                requestId = data.data.requestId;
                pollForApproval();
            } else {
                window.location.href = "/";
            }
        } catch (e) {
            error = "Failed to connect to server";
        } finally {
            isLoading = false;
        }
    }

    function handleGitHubLogin() {
        window.location.href = "/api/auth/github";
    }

    async function pollForApproval() {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/auth/approval/${requestId}`);
                const data = await res.json();

                if (data.data?.status === "approved") {
                    clearInterval(interval);
                    window.location.href = "/";
                } else if (data.data?.status === "rejected") {
                    clearInterval(interval);
                    pendingApproval = false;
                    error = "Login request was rejected by admin";
                }
            } catch {
                // Keep polling
            }
        }, 3000);
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            handleLogin();
        }
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
                <img
                    src="/logo.jpg"
                    alt="Okastr8"
                    class="h-16 w-auto rounded-xl"
                />
            </div>

            {#if pendingApproval}
                <!-- Pending Approval State -->
                <div class="flex flex-col items-center gap-4 text-center">
                    <div
                        class="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent"
                    ></div>
                    <div>
                        <h2
                            class="text-lg font-semibold text-[var(--text-primary)]"
                        >
                            Waiting for Approval
                        </h2>
                        <p class="mt-1 text-sm text-[var(--text-secondary)]">
                            An admin needs to approve your login request
                        </p>
                    </div>
                </div>
            {:else}
                <!-- Login Form -->
                <div class="w-full space-y-4">
                    <Button
                        onclick={handleGitHubLogin}
                        variant="outline"
                        class="w-full"
                    >
                        Sign in with GitHub
                    </Button>

                    <div class="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                        <div class="h-px flex-1 bg-[var(--border)]"></div>
                        <span>or</span>
                        <div class="h-px flex-1 bg-[var(--border)]"></div>
                    </div>

                    <div>
                        <label
                            for="token"
                            class="mb-2 block text-sm font-medium text-[var(--text-primary)]"
                        >
                            API Token
                        </label>
                        <input
                            id="token"
                            type="password"
                            bind:value={token}
                            onkeydown={handleKeydown}
                            placeholder="Enter your API token"
                            class="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
                        />
                    </div>

                    {#if error}
                        <div
                            class="rounded-[var(--radius-md)] bg-[var(--error-light)] px-4 py-3 text-sm text-[var(--error)]"
                        >
                            {error}
                        </div>
                    {/if}

                    <Button
                        onclick={handleLogin}
                        disabled={isLoading}
                        class="w-full"
                    >
                        {#if isLoading}
                            <div
                                class="h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary-ink)] border-t-transparent"
                            ></div>
                            Verifying...
                        {:else}
                            Sign In
                        {/if}
                    </Button>
                </div>

                <p class="text-center text-xs text-[var(--text-muted)]">
                    Generate tokens with <code class="font-mono"
                        >okastr8 auth token</code
                    >
                </p>
            {/if}
        </div>
    </Card>
</div>
