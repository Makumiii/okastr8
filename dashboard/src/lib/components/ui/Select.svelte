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
        class="flex h-10 w-full items-center justify-between rounded-xl border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
        style="background-color: #ffffff; color: #1a1a1a; border-color: #e5e7eb;"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
    >
        <span style="color: #1a1a1a;">{getSelectedLabel()}</span>
        <ChevronDown size={16} style="color: #6b7280;" />
    </button>

    {#if isOpen}
        <ul
            role="listbox"
            class="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-xl border shadow-lg"
            style="background-color: #ffffff; border-color: #e5e7eb;"
        >
            {#each options as opt}
                <li
                    role="option"
                    aria-selected={opt.value === value}
                    tabindex="0"
                    class="cursor-pointer px-3 py-2 text-sm transition-colors"
                    style="color: #1a1a1a; background-color: {opt.value ===
                    value
                        ? '#e8f5e9'
                        : '#ffffff'};"
                    onclick={() => selectOption(opt)}
                    onkeydown={(e) => e.key === "Enter" && selectOption(opt)}
                    onmouseenter={(e) =>
                        (e.currentTarget.style.backgroundColor = "#f3f4f6")}
                    onmouseleave={(e) =>
                        (e.currentTarget.style.backgroundColor =
                            opt.value === value ? "#e8f5e9" : "#ffffff")}
                >
                    {opt.label}
                </li>
            {/each}
        </ul>
    {/if}
</div>
