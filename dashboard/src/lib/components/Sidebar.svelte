<script lang="ts">
    import { page } from "$app/stores";
    import { cn } from "$lib/utils";
    import { LogOut } from "lucide-svelte";
    import { navItems } from "$lib/nav";
    import Okastr8Logo from "$lib/components/Okastr8Logo.svelte";

    let { isMobileOpen = false, isCollapsed = false } = $props<{
        isMobileOpen?: boolean;
        isCollapsed?: boolean;
    }>();

    function isActive(href: string, pathname: string): boolean {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    }
</script>

<aside
    class={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-[var(--border)] bg-[var(--bg-sidebar)] backdrop-blur transition-[transform,width] duration-300 lg:translate-x-0",
        isCollapsed ? "w-20" : "w-72",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
    )}
>
    <div class="flex h-full flex-col">
        <!-- Logo -->
        <div
            class={cn(
                "flex h-16 items-center gap-3 border-b border-[var(--border)]",
                isCollapsed ? "justify-center px-3" : "px-6",
            )}
        >
            <Okastr8Logo
                compact={isCollapsed}
                className={isCollapsed ? "text-base" : "text-lg"}
            />
        </div>

        <!-- Navigation -->
        <nav class={cn("flex-1 space-y-1 py-4", isCollapsed ? "px-2" : "px-3")}>
            {#each navItems as item}
                <a
                    href={item.href}
                    class={cn(
                        "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive(item.href, $page.url.pathname)
                            ? "bg-[var(--bg-sidebar-active)] text-[var(--primary-strong)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--surface-dark)] hover:text-[var(--text-primary)]",
                        isCollapsed ? "justify-center" : "",
                    )}
                >
                    <span class="rounded-lg bg-[var(--surface-dark)] p-1.5">
                        <item.icon size={18} />
                    </span>
                    {#if !isCollapsed}
                        {item.label}
                    {/if}
                </a>
            {/each}
        </nav>

        <!-- Footer -->
        <div class={cn("border-t border-[var(--border)]", isCollapsed ? "p-3" : "p-4")}>
            <button
                class={cn(
                    "flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-dark)] hover:text-[var(--text-primary)]",
                    isCollapsed ? "justify-center" : "",
                )}
                onclick={() => {
                    fetch("/api/auth/logout", { method: "POST" }).then(() => {
                        window.location.href = "/login";
                    });
                }}
            >
                <LogOut size={20} />
                {#if !isCollapsed}
                    Logout
                {/if}
            </button>
        </div>
    </div>
</aside>
