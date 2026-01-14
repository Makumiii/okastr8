<script lang="ts">
	import "../app.css";
	import Sidebar from "$lib/components/Sidebar.svelte";
	import Toast from "$lib/components/Toast.svelte";
	import { page } from "$app/stores";
	import { onMount } from "svelte";
	import { browser } from "$app/environment";

	let { children } = $props();

	let isAuthenticated = $state(false);
	let isLoading = $state(true);

	const publicRoutes = ["/login"];

	onMount(async () => {
		if (!browser) return;

		const isPublicRoute = publicRoutes.includes($page.url.pathname);

		if (isPublicRoute) {
			isLoading = false;
			return;
		}

		// Check auth status
		try {
			const res = await fetch("/api/auth/me");
			if (res.ok) {
				isAuthenticated = true;
			} else {
				window.location.href = "/login";
				return;
			}
		} catch {
			window.location.href = "/login";
			return;
		}

		isLoading = false;
	});

	$effect(() => {
		if (
			browser &&
			!isLoading &&
			!isAuthenticated &&
			!publicRoutes.includes($page.url.pathname)
		) {
			window.location.href = "/login";
		}
	});
</script>

{#if isLoading}
	<div class="flex h-screen items-center justify-center bg-[var(--bg-page)]">
		<div class="flex flex-col items-center gap-4">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent"
			></div>
			<p class="text-sm text-[var(--text-secondary)]">Loading...</p>
		</div>
	</div>
{:else if publicRoutes.includes($page.url.pathname)}
	<!-- Public routes without sidebar -->
	{@render children()}
{:else}
	<!-- Authenticated layout with sidebar -->
	<div class="flex min-h-screen bg-[var(--bg-page)]">
		<Sidebar />
		<main class="ml-64 flex-1 p-8">
			{@render children()}
		</main>
	</div>
	<Toast />
{/if}
