import { writable } from "svelte/store";

export type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
    id: string;
    type: ToastType;
    message: string;
}

function createToastStore() {
    const { subscribe, update } = writable<Toast[]>([]);

    return {
        subscribe,
        add: (type: ToastType, message: string, duration = 3000) => {
            const id = crypto.randomUUID();
            update((toasts) => [...toasts, { id, type, message }]);

            if (duration > 0) {
                setTimeout(() => {
                    update((toasts) => toasts.filter((t) => t.id !== id));
                }, duration);
            }
        },
        remove: (id: string) => {
            update((toasts) => toasts.filter((t) => t.id !== id));
        },
        success: (message: string) => {
            const id = crypto.randomUUID();
            update((toasts) => [...toasts, { id, type: "success", message }]);
            setTimeout(() => {
                update((toasts) => toasts.filter((t) => t.id !== id));
            }, 3000);
        },
        error: (message: string) => {
            const id = crypto.randomUUID();
            update((toasts) => [...toasts, { id, type: "error", message }]);
        },
    };
}

export const toasts = createToastStore();
