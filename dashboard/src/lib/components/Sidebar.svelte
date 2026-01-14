<script lang="ts">
    import { page } from "$app/stores";
    import { cn } from "$lib/utils";

    interface NavItem {
        href: string;
        label: string;
        icon: string;
    }

    const navItems: NavItem[] = [
        { href: "/", label: "Dashboard", icon: "📊" },
        { href: "/github", label: "GitHub", icon: "🐙" },
        { href: "/apps", label: "Apps", icon: "📦" },
        { href: "/metrics", label: "Metrics", icon: "📈" },
    ];

    function isActive(href: string, pathname: string): boolean {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    }
</script>

<aside
    class="fixed left-0 top-0 z-40 h-screen w-64 bg-[var(--bg-sidebar)] border-r border-[var(--border)]"
>
    <div class="flex h-full flex-col">
        <!-- Logo -->
        <div
            class="flex h-16 items-center gap-2 border-b border-[var(--border)] px-6"
        >
            <div
                class="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)] text-white font-bold"
            >
                O
            </div>
            <span class="text-lg font-semibold text-[var(--text-primary)]"
                >okastr8</span
            >
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
                    <span class="text-lg">{item.icon}</span>
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
                <span class="text-lg">🚪</span>
                Logout
            </button>
        </div>
    </div>
</aside>
