<script lang="ts">
    import { toasts } from "$lib/stores/toasts";
    import { cn } from "$lib/utils";

    const typeStyles = {
        success: "bg-[var(--success)] text-[var(--primary-ink)]",
        error: "bg-[var(--error)] text-[var(--text-inverse)]",
        warning: "bg-[var(--warning)] text-[var(--text-inverse)]",
        info: "bg-[var(--primary)] text-[var(--primary-ink)]",
    };

    const icons = {
        success: "✓",
        error: "✕",
        warning: "⚠",
        info: "ℹ",
    };
</script>

<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
    {#each $toasts as toast (toast.id)}
        <div
            class={cn(
                "flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-3 shadow-lg transition-all animate-in slide-in-from-right",
                typeStyles[toast.type],
            )}
        >
            <span class="text-lg font-bold">{icons[toast.type]}</span>
            <span class="text-sm font-medium">{toast.message}</span>
            <button
                onclick={() => toasts.remove(toast.id)}
                class="ml-2 opacity-70 hover:opacity-100"
            >
                ✕
            </button>
        </div>
    {/each}
</div>
