<script lang="ts">
    import { Button } from "$lib/components/ui";
    import { Card } from "$lib/components/ui";
    import { onMount } from "svelte";
    import Okastr8Logo from "$lib/components/Okastr8Logo.svelte";

    let isLoading = $state(false);
    let error = $state("");
    let token = $state("");

    async function handleTokenLogin(e: Event) {
        e.preventDefault();
        if (isLoading || !token) return;
        isLoading = true;
        error = "";

        try {
            const res = await fetch("/api/auth/token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            });

            if (res.ok) {
                window.location.href = "/";
            } else {
                const data = await res.json();
                error = data.message || "Invalid token";
            }
        } catch (err: any) {
            error = "Connection failed";
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        const params = new URLSearchParams(window.location.search);
        const errorParam = params.get("error");
        if (errorParam && !error) {
            error = "Authentication failed. Please try again.";
        }
    });
</script>

<div class="flex min-h-screen items-center justify-center bg-[var(--bg-page)]">
    <Card class="w-full max-w-md">
        <div class="flex flex-col items-center gap-6">
            <!-- Logo -->
            <div class="flex items-center gap-3">
                <Okastr8Logo />
            </div>

            <form class="w-full space-y-4" onsubmit={handleTokenLogin}>
                <p class="text-sm text-[var(--text-muted)] text-center">
                    Run <code class="bg-[var(--bg-card-hover)] px-1 rounded">okastr8 dashboard token</code> on your server to get your login token.
                </p>
                <input
                    type="password"
                    placeholder="Paste your server token here"
                    class="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
                    bind:value={token}
                />
                <Button type="submit" class="w-full" disabled={isLoading || !token}>
                    {#if isLoading}
                        <div
                            class="h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary-ink)] border-t-transparent mr-2"
                        ></div>
                        Verifying...
                    {:else}
                        Sign in
                    {/if}
                </Button>

                {#if error}
                    <div
                        class="rounded-[var(--radius-md)] bg-[var(--error-light)] px-4 py-3 text-sm text-[var(--error)]"
                    >
                        {error}
                    </div>
                {/if}
            </form>
        </div>
    </Card>
</div>

