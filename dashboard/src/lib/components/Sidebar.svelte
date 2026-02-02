<script lang="ts">
    import { page } from "$app/stores";
    import { cn } from "$lib/utils";
    import { LogOut } from "lucide-svelte";
    import { navItems } from "$lib/nav";

    let { isMobileOpen = false } = $props<{
        isMobileOpen?: boolean;
    }>();

    function isActive(href: string, pathname: string): boolean {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    }
</script>

<aside
    class={cn(
        "fixed left-0 top-0 z-40 h-screen w-72 border-r border-[var(--border)] bg-[var(--bg-sidebar)] backdrop-blur transition-transform duration-300 lg:translate-x-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
    )}
>
    <div class="flex h-full flex-col">
        <!-- Logo -->
        <div
            class="flex h-16 items-center gap-3 border-b border-[var(--border)] px-6"
        >
            <img src="/logo.jpg" alt="Okastr8" class="h-10 w-auto rounded-lg" />
            <div class="leading-tight">
                <div class="text-sm font-semibold text-[var(--text-primary)]">
                    Okastr8
                </div>
                <div class="text-xs text-[var(--text-muted)]">
                    Control Center
                </div>
            </div>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 space-y-1 px-3 py-4">
            {#each navItems as item}
                <a
                    href={item.href}
                    class={cn(
                        "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive(item.href, $page.url.pathname)
                            ? "bg-[var(--bg-sidebar-active)] text-[var(--primary-strong)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--surface-dark)] hover:text-[var(--text-primary)]",
                    )}
                >
                    <span class="rounded-lg bg-[var(--surface-dark)] p-1.5">
                        <item.icon size={18} />
                    </span>
                    {item.label}
                </a>
            {/each}
        </nav>

        <!-- Footer -->
        <div class="border-t border-[var(--border)] p-4">
            <button
                class="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-dark)] hover:text-[var(--text-primary)]"
                onclick={() => {
                    fetch("/api/auth/logout", { method: "POST" }).then(() => {
                        window.location.href = "/login";
                    });
                }}
            >
                <LogOut size={20} />
                Logout
            </button>
        </div>
    </div>
</aside>
