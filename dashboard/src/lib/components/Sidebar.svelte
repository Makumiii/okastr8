<script lang="ts">
    import { page } from "$app/stores";
    import { cn } from "$lib/utils";
    import {
        LayoutDashboard,
        Github,
        Box,
        ChartLine,
        LogOut,
        Inbox,
    } from "lucide-svelte";

    interface NavItem {
        href: string;
        label: string;
        icon: typeof LayoutDashboard;
    }

    const navItems: NavItem[] = [
        { href: "/", label: "Dashboard", icon: LayoutDashboard },
        { href: "/github", label: "GitHub", icon: Github },
        { href: "/apps", label: "Apps", icon: Box },
        { href: "/metrics", label: "Metrics", icon: ChartLine },
        { href: "/activity", label: "Activity", icon: Inbox },
    ];

    function isActive(href: string, pathname: string): boolean {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    }
</script>

<aside
    class="fixed left-0 top-0 z-40 h-screen w-64 border-r border-[var(--border)] bg-[var(--bg-sidebar)]"
>
    <div class="flex h-full flex-col">
        <!-- Logo -->
        <div
            class="flex h-16 items-center gap-2 border-b border-[var(--border)] px-6"
        >
            <img src="/logo.jpg" alt="Okastr8" class="h-10 w-auto rounded-lg" />
        </div>

        <!-- Navigation -->
        <nav class="flex-1 space-y-1 px-3 py-4">
            {#each navItems as item}
                <a
                    href={item.href}
                    class={cn(
                        "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive(item.href, $page.url.pathname)
                            ? "bg-[var(--bg-sidebar-active)] text-[var(--primary)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]",
                    )}
                >
                    <item.icon size={20} />
                    {item.label}
                </a>
            {/each}
        </nav>

        <!-- Footer -->
        <div class="border-t border-[var(--border)] p-4">
            <button
                class="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--error)]"
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
