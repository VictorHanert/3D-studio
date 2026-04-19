<template>
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Save Configuration</h2>

            <form @submit.prevent="handleSave">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Configuration Name
                    </label>
                    <input
                        v-model="configName"
                        type="text"
                        required
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter configuration name"
                        :disabled="saving"
                    />
                </div>

                <div class="flex gap-3">
                    <button
                        type="button"
                        @click="closeModal"
                        class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                        :disabled="saving"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        :disabled="saving || !configName.trim()"
                    >
                        <span v-if="saving">Saving...</span>
                        <span v-else>Save</span>
                    </button>
                </div>
            </form>

            <!-- Error Message -->
            <div v-if="error" class="mt-4 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">
                {{ error }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
    isOpen: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
    close: [];
    save: [configName: string];
}>();

const configName = ref('My Configuration');
const saving = ref(false);
const error = ref<string | null>(null);

const closeModal = (): void => {
    configName.value = 'My Configuration';
    error.value = null;
    emit('close');
};

const handleSave = async (): Promise<void> => {
    if (!configName.value.trim()) return;

    saving.value = true;
    error.value = null;

    try {
        emit('save', configName.value.trim());
        closeModal();
    } catch (err) {
        error.value = 'Failed to save configuration';
    }

    saving.value = false;
};
</script>