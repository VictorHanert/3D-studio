<template>
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Load Configuration</h2>

            <!-- Load by Share Code -->
            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Or paste a share code:
                </label>
                <div class="flex gap-2">
                    <input
                        v-model="shareCode"
                        type="text"
                        placeholder="Enter share code"
                        class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <button
                        @click="loadConfigByShareCode"
                        :disabled="loadingByCode"
                        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors font-medium cursor-pointer"
                    >
                        {{ loadingByCode ? '...' : 'Enter' }}
                    </button>
                </div>
            </div>

            <!-- Divider -->
            <div class="relative my-10">
                <div class="absolute inset-0 flex items-center">
                    <div class="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div class="relative flex justify-center text-sm">
                    <span class="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">Your Configurations</span>
                </div>
            </div>

            <!-- Saved Configurations List -->
            <div class="max-h-64 overflow-y-auto mb-4">
                <div v-if="savedConfigs.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-8">
                    No saved configurations yet
                </div>
                <div v-else class="space-y-2">
                    <div
                        v-for="config in savedConfigs"
                        :key="config.id"
                        class="p-3 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <p class="font-medium text-gray-900 dark:text-white">{{ config.name }}</p>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Share Code: <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">{{ config.share_code }}</code>
                                </p>
                            </div>
                            <button
                                @click="loadConfiguration(config.id)"
                                class="ml-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium cursor-pointer"
                            >
                                Load
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Error Message -->
            <div v-if="loadError" class="mb-4 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">
                {{ loadError }}
            </div>

            <!-- Close Button -->
            <button
                @click="closeModal"
                class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
                Close
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Ref } from 'vue';

interface Props {
    isOpen: boolean;
    savedConfigs: any[];
}

defineProps<Props>();

const emit = defineEmits<{
    close: [];
    loadConfig: [configId: number];
    loadByCode: [code: string];
}>();

const shareCode: Ref<string> = ref('');
const loadingByCode: Ref<boolean> = ref(false);
const loadError: Ref<string | null> = ref(null);

const closeModal = (): void => {
    shareCode.value = '';
    loadError.value = null;
    emit('close');
};

const loadConfiguration = async (configId: number): Promise<void> => {
    if (!confirm('Loading a configuration will erase your current work. Continue?')) {
        return;
    }
    emit('loadConfig', configId);
    closeModal();
};

const loadConfigByShareCode = async (): Promise<void> => {
    if (!shareCode.value.trim()) {
        loadError.value = 'Please enter a share code';
        return;
    }

    if (!confirm('Loading a configuration will erase your current work. Continue?')) {
        return;
    }

    loadingByCode.value = true;
    loadError.value = null;

    try {
        emit('loadByCode', shareCode.value.trim());
        closeModal();
    } catch (error) {
        loadError.value = 'Configuration not found. Check the share code and try again.';
    }

    loadingByCode.value = false;
};
</script>
