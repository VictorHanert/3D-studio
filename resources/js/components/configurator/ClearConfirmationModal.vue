<template>
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Clear All Models</h2>

            <div class="mb-6">
                <p class="text-gray-600 dark:text-gray-400">
                    Are you sure you want to delete all models? This action cannot be undone.
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    Save your configuration first if you want to keep it.
                </p>
            </div>

            <div class="flex gap-3">
                <button
                    type="button"
                    @click="closeModal"
                    class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    @click="handleConfirm"
                    class="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors cursor-pointer"
                >
                    Clear All
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
interface Props {
    isOpen: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
    close: [];
    confirm: [];
}>();

const closeModal = (): void => {
    emit('close');
};

const handleConfirm = (): void => {
    emit('confirm');
    closeModal();
};
</script>