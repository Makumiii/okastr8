<script lang="ts">
    import { cn } from "$lib/utils";
    import type { HTMLButtonAttributes } from "svelte/elements";

    type Variant =
        | "default"
        | "destructive"
        | "outline"
        | "secondary"
        | "ghost"
        | "link";
    type Size = "default" | "sm" | "lg" | "icon";

    interface Props extends HTMLButtonAttributes {
        variant?: Variant;
        size?: Size;
        class?: string;
        children?: import("svelte").Snippet;
    }

    let {
        variant = "default",
        size = "default",
        class: className,
        children,
        ...restProps
    }: Props = $props();

    const variants: Record<Variant, string> = {
        default:
            "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]",
        destructive: "bg-[var(--error)] text-white hover:bg-red-700",
        outline:
            "border border-[var(--border)] bg-transparent hover:bg-[var(--bg-sidebar)]",
        secondary:
            "bg-[var(--bg-sidebar)] text-[var(--text-primary)] hover:bg-[var(--border)]",
        ghost: "hover:bg-[var(--bg-sidebar)]",
        link: "text-[var(--primary)] underline-offset-4 hover:underline",
    };

    const sizes: Record<Size, string> = {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-sm",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
    };
</script>

<button
    class={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
    )}
    {...restProps}
>
    {@render children?.()}
</button>
