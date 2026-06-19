<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Lineicons } from "@lineiconshq/vue-lineicons";
import { RefreshCircle1ClockwiseOutlined, Trash3Outlined } from "@lineiconshq/free-icons";
import { Planner } from '@/system/Planner';
import LoadConfigurationModal from './LoadConfigurationModal.vue';
import SaveConfigurationModal from './SaveConfigurationModal.vue';
import ClearConfirmationModal from './ClearConfirmationModal.vue';
import { useToast } from '@/composables/useToast';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const planner = Planner.getInstance();
const isSaving = ref(false);
const savedConfigs = ref<any[]>([]);
const showLoadModal = ref(false);
const showSaveModal = ref(false);
const showClearModal = ref(false);
const isInitializing = ref(true);

const { success: toastSuccess, error: toastError } = useToast();

onMounted(() => {
    if (canvasRef.value) {
        planner.init(canvasRef.value);
        // Show loading for a bit to allow deferred operations to complete
        setTimeout(() => {
            isInitializing.value = false;
        }, 500);
    }
});

onUnmounted(() => {
    planner.cleanup();
});

const handleClearAll = (): void => {
    showClearModal.value = true;
};

const confirmClearAll = (): void => {
    planner.clearAll();
    showClearModal.value = false;
    toastSuccess('All models cleared successfully!');
};

const handleSaveToBackend = async (configName: string): Promise<void> => {
    isSaving.value = true;

    const success = await planner.saveToBackend(configName);

    if (success) {
        toastSuccess('Configuration saved successfully!');
    } else {
        toastError('Failed to save configuration to database');
    }

    isSaving.value = false;
};

const openLoadModal = async (): Promise<void> => {
    savedConfigs.value = await planner.getUserConfigurations();
    showLoadModal.value = true;
};

const openSaveModal = (): void => {
    showSaveModal.value = true;
};

const loadConfiguration = async (configId: number): Promise<void> => {
    planner.clearCanvasForNewConfig();
    const configs = await planner.getUserConfigurations();
    const config = configs.find((c: any) => c.id === configId);

    if (config && config.configuration_data) {
        await planner.loadFromConfiguration(config.configuration_data);
        showLoadModal.value = false;
        toastSuccess('Configuration loaded successfully!');
    } else {
        toastError('Failed to load configuration');
    }
};

const loadConfigByShareCode = async (code: string): Promise<void> => {
    const success = await planner.loadConfigurationByCode(code);
    if (success) {
        toastSuccess('Configuration loaded from share code!');
    } else {
        toastError('Failed to load configuration from share code');
    }
};

defineExpose({
    loadModel: (modelPath: string): Promise<void> => planner.loadModel(modelPath),
});
</script>

<template>
    <div class="relative w-full h-full bg-gray-100 dark:bg-gray-900">
        <!-- Loading Overlay -->
        <div
            v-if="isInitializing"
            class="absolute inset-0 z-50 flex items-center justify-center bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm"
        >
            <div class="text-center">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p class="text-gray-600 dark:text-gray-400">Initializing 3D environment...</p>
            </div>
        </div>

        <!-- Canvas Container -->
        <div class="absolute inset-0">
            <canvas
                ref="canvasRef"
                class="w-full h-full block"
            />
        </div>

        <!-- Toolbar -->
        <div class="absolute bottom-8 left-0 right-0 z-20 pointer-events-none">
            <div class="flex gap-5 pointer-events-auto justify-center">
                <button
                    @click="openLoadModal"
                    class="px-4 py-2 bg-white hover:bg-gray-100 active:bg-blue-700 text-gray-900 rounded-md transition-colors font-medium cursor-pointer shadow-lg hover:shadow-xl"
                    title="Load saved configuration"
                >
                    Load Saved Configuration
                </button>

                <button
                    @click="openSaveModal"
                    :disabled="isSaving || planner.state.models.length === 0"
                    class="px-4 py-2 bg-white hover:bg-gray-100 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 rounded-md transition-colors font-medium cursor-pointer shadow-lg hover:shadow-xl disabled:shadow-none"
                    title="Save configuration to database"
                >
                    {{ isSaving ? 'Saving...' : 'Save' }}
                </button>

                <button
                    @click="handleClearAll"
                    :disabled="planner.state.models.length === 0"
                    class="px-4 py-2 bg-white hover:bg-gray-100 active:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed text-red-700 rounded-md transition-colors font-medium cursor-pointer shadow-lg hover:shadow-xl disabled:shadow-none"
                    title="Clear all models"
                >
                    Clear
                </button>
            </div>
        </div>

        <!-- Model Controls Overlay -->
        <div
            v-if="planner.state.showControls && planner.state.hoveredModel"
            class="absolute z-10 bg-white/80 dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 flex gap-1"
            :style="{ left: planner.state.controlPosition.x + 'px', top: planner.state.controlPosition.y + 'px' }"
        >
            <!-- Rotate Button -->
            <button
                @click="planner.rotateModel(planner.state.hoveredModel.id)"
                class="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900/20 rounded transition-colors"
                title="Rotate 90°"
            >
                <Lineicons :icon="RefreshCircle1ClockwiseOutlined" :size="24" :stroke-width="2" />
            </button>

            <!-- Delete Button -->
            <button
                @click="planner.deleteModel(planner.state.hoveredModel.id)"
                class="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                title="Delete Model"
            >
                <Lineicons :icon="Trash3Outlined" :size="24" :stroke-width="2" />
            </button>
        </div>

        <!-- Load Configuration Modal -->
        <LoadConfigurationModal
            :isOpen="showLoadModal"
            :savedConfigs="savedConfigs"
            @close="showLoadModal = false"
            @loadConfig="loadConfiguration"
            @loadByCode="loadConfigByShareCode"
        />

        <!-- Save Configuration Modal -->
        <SaveConfigurationModal
            :isOpen="showSaveModal"
            @close="showSaveModal = false"
            @save="handleSaveToBackend"
        />

        <!-- Clear Confirmation Modal -->
        <ClearConfirmationModal
            :isOpen="showClearModal"
            @close="showClearModal = false"
            @confirm="confirmClearAll"
        />
    </div>
</template>
