<script lang="ts">
	import "../app.css";
	import Sidebar from "$lib/components/Sidebar.svelte";
	import Toast from "$lib/components/Toast.svelte";
	import { page } from "$app/stores";
	import { onMount } from "svelte";
	import { browser } from "$app/environment";
import { Menu, PanelLeft } from "lucide-svelte";
	import { getNavLabel } from "$lib/nav";

	let { children } = $props();

	let isAuthenticated = $state(false);
	let isLoading = $state(true);
	let isSidebarOpen = $state(false);
	let isSidebarCollapsed = $state(false);

	const publicRoutes = ["/login"];

	onMount(async () => {
		if (!browser) return;

		const isPublicRoute = publicRoutes.includes($page.url.pathname);

		if (isPublicRoute) {
			isLoading = false;
			return;
		}

		try {
			const stored = localStorage.getItem("okastr8.sidebarCollapsed");
			if (stored === "true") isSidebarCollapsed = true;
		} catch {}

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
		if (browser) {
			isSidebarOpen = false;
		}
		if (
			browser &&
			!isLoading &&
			!isAuthenticated &&
			!publicRoutes.includes($page.url.pathname)
		) {
			window.location.href = "/login";
		}
	});

	const pageTitle = $derived(getNavLabel($page.url.pathname));

	function toggleSidebarCollapse() {
		isSidebarCollapsed = !isSidebarCollapsed;
		if (browser) {
			try {
				localStorage.setItem(
					"okastr8.sidebarCollapsed",
					String(isSidebarCollapsed),
				);
			} catch {}
		}
	}
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
	<div class="min-h-screen bg-[var(--bg-page)]">
		{#if isSidebarOpen}
			<button
				class="fixed inset-0 z-30 bg-[var(--overlay)] backdrop-blur-sm lg:hidden"
				aria-label="Close sidebar"
				onclick={() => (isSidebarOpen = false)}
			></button>
		{/if}
		<Sidebar isMobileOpen={isSidebarOpen} isCollapsed={isSidebarCollapsed} />
		<div class={isSidebarCollapsed ? "lg:pl-20" : "lg:pl-72"}>
			<header
				class="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg-page)] backdrop-blur"
			>
				<div class="flex items-center justify-between px-6 py-4">
					<div class="flex items-center gap-3">
						<button
							class="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-dark)] lg:hidden"
							aria-label="Open sidebar"
							onclick={() => (isSidebarOpen = true)}
						>
							<Menu size={18} />
						</button>
						<button
							class="hidden h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-dark)] lg:inline-flex"
							aria-label="Toggle sidebar"
							onclick={toggleSidebarCollapse}
						>
							<PanelLeft size={18} />
						</button>
						<div>
							<div class="text-xs uppercase tracking-wide text-[var(--text-muted)]">
								Okastr8
							</div>
							<div class="text-lg font-semibold text-[var(--text-primary)]">
								{pageTitle}
							</div>
						</div>
					</div>
					<div class="hidden items-center gap-3 text-sm text-[var(--text-secondary)] md:flex">
						<span class="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
							<span class="h-2 w-2 rounded-full bg-[var(--success)]"></span>
							Auto-refresh 30s
						</span>
					</div>
				</div>
			</header>
			<main class="px-6 pb-12 pt-6">
				{@render children()}
			</main>
		</div>
	</div>
	<Toast />
{/if}
