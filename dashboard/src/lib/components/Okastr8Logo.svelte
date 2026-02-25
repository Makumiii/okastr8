<script lang="ts">
    export let compact = false;
    export let className = "";
</script>

<div class={`flex items-center ${className}`} aria-label="Okastr8" role="img">
    {#if compact}
        <img
            src="/okastr8-icon-light.svg"
            alt="Okastr8"
            class="h-7 w-7 shrink-0"
            loading="eager"
            decoding="async"
        />
    {:else}
        <img
            src="/okastr8-wordmark-light.svg"
            alt="Okastr8"
            class="h-7 w-auto max-w-[170px]"
            loading="eager"
            decoding="async"
        />
    {/if}
</div>
