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
        "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]",
        className,
    )}
    {...restProps}
>
    {@render children?.()}
</div>
