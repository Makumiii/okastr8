<script lang="ts">
    import { cn } from "$lib/utils";
    import type { HTMLAttributes } from "svelte/elements";

    type Variant = "default" | "success" | "error" | "warning" | "outline";

    interface Props extends HTMLAttributes<HTMLSpanElement> {
        variant?: Variant;
        class?: string;
        children?: import("svelte").Snippet;
    }

    let {
        variant = "default",
        class: className,
        children,
        ...restProps
    }: Props = $props();

    const variants: Record<Variant, string> = {
        default: "bg-[var(--bg-sidebar)] text-[var(--text-primary)]",
        success: "bg-[var(--success-light)] text-[var(--success)]",
        error: "bg-[var(--error-light)] text-[var(--error)]",
        warning: "bg-[var(--warning-light)] text-[var(--warning)]",
        outline: "border border-[var(--border)] bg-transparent",
    };
</script>

<span
    class={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
    )}
    {...restProps}
>
    {@render children?.()}
</span>
