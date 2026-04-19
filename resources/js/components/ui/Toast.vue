<template>
    <TransitionGroup
        name="toast"
        tag="div"
        class="fixed top-20 right-4 z-50 space-y-2"
    >
        <div
            v-for="toast in toasts"
            :key="toast.id"
            :class="[
                'flex items-center p-4 rounded-lg shadow-lg max-w-sm',
                toast.type === 'success' && 'bg-green-500 text-white',
                toast.type === 'error' && 'bg-red-500 text-white',
                toast.type === 'info' && 'bg-blue-500 text-white',
                toast.type === 'warning' && 'bg-yellow-500 text-black'
            ]"
        >
            <div class="flex-1">
                {{ toast.message }}
            </div>
            <button
                @click="removeToast(toast.id)"
                class="ml-4 text-current hover:opacity-75"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    </TransitionGroup>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast';

const { toasts, removeToast } = useToast();
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
    transition: all 0.3s ease;
}

.toast-enter-from {
    opacity: 0;
    transform: translateX(100%);
}

.toast-leave-to {
    opacity: 0;
    transform: translateX(100%);
}

.toast-move {
    transition: transform 0.3s ease;
}
</style>