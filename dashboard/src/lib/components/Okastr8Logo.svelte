<script lang="ts">
    export let compact = false;
    export let className = "";
</script>

<div
    class={`flex items-center whitespace-nowrap font-semibold tracking-tight ${className}`}
    aria-label="Okastr8"
    role="img"
>
    {#if compact}
        <span class="text-[var(--text-primary)]">O</span>
        <span class="ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-[var(--primary)] text-[0.8em] font-semibold leading-none text-[var(--primary-ink)]">
            8
        </span>
    {:else}
        <span class="text-[var(--text-primary)]">Oka</span>
        <span class="text-[var(--text-primary)]">str</span>
        <span class="ml-1 inline-flex items-center justify-center rounded-md bg-[var(--primary)] px-1.5 text-[0.8em] font-semibold leading-none text-[var(--primary-ink)]">
            8
        </span>
    {/if}
</div>
