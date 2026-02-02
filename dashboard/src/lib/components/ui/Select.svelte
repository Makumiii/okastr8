<script lang="ts">
    import { ChevronDown } from "lucide-svelte";

    interface Option {
        value: string;
        label: string;
    }

    let {
        id = "",
        value = $bindable(""),
        options = [] as Option[],
        placeholder = "Select an option...",
        onchange = () => {},
    }: {
        id?: string;
        value?: string;
        options?: Option[];
        placeholder?: string;
        onchange?: () => void;
    } = $props();

    let isOpen = $state(false);
    let triggerRef = $state<HTMLButtonElement | null>(null);

    function getSelectedLabel(): string {
        const found = options.find((o) => o.value === value);
        return found ? found.label : placeholder;
    }

    function toggle() {
        isOpen = !isOpen;
    }

    function selectOption(opt: Option) {
        value = opt.value;
        isOpen = false;
        onchange();
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            isOpen = false;
            triggerRef?.focus();
        }
    }

    function handleClickOutside(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (triggerRef && !triggerRef.contains(target)) {
            isOpen = false;
        }
    }
</script>

<svelte:document onclick={handleClickOutside} onkeydown={handleKeydown} />

<div class="relative w-full" {id}>
    <button
        bind:this={triggerRef}
        type="button"
        onclick={toggle}
        class="flex h-10 w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-[var(--bg-page)]"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
    >
        <span class="text-[var(--text-primary)]">{getSelectedLabel()}</span>
        <ChevronDown size={16} class="text-[var(--text-secondary)]" />
    </button>

    {#if isOpen}
        <ul
            role="listbox"
            class="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-lg)]"
        >
            {#each options as opt}
                <li
                    role="option"
                    aria-selected={opt.value === value}
                    tabindex="0"
                    class="cursor-pointer px-3 py-2 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-dark)] {opt.value ===
                    value
                        ? 'bg-[var(--bg-sidebar-active)]'
                        : ''}"
                    onclick={() => selectOption(opt)}
                    onkeydown={(e) => e.key === "Enter" && selectOption(opt)}
                >
                    {opt.label}
                </li>
            {/each}
        </ul>
    {/if}
</div>
