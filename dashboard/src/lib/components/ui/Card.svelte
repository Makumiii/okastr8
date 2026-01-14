<script lang="ts">
    import { cn } from "$lib/utils";
    import type { HTMLAttributes } from "svelte/elements";

    interface Props extends HTMLAttributes<HTMLDivElement> {
        class?: string;
        children?: import("svelte").Snippet;
    }

    let { class: className, children, ...restProps }: Props = $props();
</script>

<div
    class={cn(
        "rounded-[var(--radius-lg)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-md)] transition-shadow hover:shadow-[var(--shadow-lg)]",
        className,
    )}
    {...restProps}
>
    {@render children?.()}
</div>
