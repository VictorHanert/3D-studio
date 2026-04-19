import { ref, readonly } from 'vue';

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

const toasts = ref<Toast[]>([]);
let toastId = 0;

export const useToast = () => {
    const addToast = (message: string, type: Toast['type'] = 'info', duration: number = 3000): void => {
        const id = ++toastId;
        toasts.value.push({ id, message, type });

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    };

    const removeToast = (id: number): void => {
        const index = toasts.value.findIndex(toast => toast.id === id);
        if (index > -1) {
            toasts.value.splice(index, 1);
        }
    };

    const success = (message: string, duration?: number) => addToast(message, 'success', duration);
    const error = (message: string, duration?: number) => addToast(message, 'error', duration);
    const info = (message: string, duration?: number) => addToast(message, 'info', duration);
    const warning = (message: string, duration?: number) => addToast(message, 'warning', duration);

    return {
        toasts: readonly(toasts),
        addToast,
        removeToast,
        success,
        error,
        info,
        warning
    };
};