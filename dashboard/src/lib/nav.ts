import {
    LayoutDashboard,
    Box,
    ChartLine,
    Inbox,
    FileText,
    Rocket,
} from "lucide-svelte";

export interface NavItem {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
}

export const navItems: NavItem[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/deploy", label: "Deploy", icon: Rocket },
    { href: "/apps", label: "Apps", icon: Box },
    { href: "/metrics", label: "Metrics", icon: ChartLine },
    { href: "/activity", label: "Activity", icon: Inbox },
    { href: "/logs", label: "Logs", icon: FileText },
];

export function getNavLabel(pathname: string): string {
    const found = navItems.find((item) => {
        if (item.href === "/") return pathname === "/";
        return pathname.startsWith(item.href);
    });
    return found?.label ?? "Dashboard";
}
