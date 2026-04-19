<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Lineicons } from "@lineiconshq/vue-lineicons";
import { AngleDoubleLeftOutlined, AngleDoubleRightOutlined } from "@lineiconshq/free-icons";
import { Planner } from '@/system/Planner';
import { GROUND_TEXTURES, type GroundTextureType } from '@/system/utilities/GroundTextureManager';
import type { ModuleInfo, MaterialInfo } from '@/system/utilities/types';

const modules = ref<ModuleInfo[]>([]);
const materials = ref<MaterialInfo[]>([]);
const selectedMaterial = ref<string | undefined>(undefined);
const materialPreview = ref<string | undefined>(undefined);
const loadingModules = ref(false);
const isCollapsed = ref(false);
const selectedGroundTexture = ref<GroundTextureType>('neutral');

const emit = defineEmits(['loadModel']);
const planner = Planner.getInstance();

onMounted(async () => {
    loadingModules.value = true;
    try {
        // Load saved ground texture
        selectedGroundTexture.value = planner.state.groundTextureType;

        const moduleData = await planner.loadModuleList();
        modules.value = moduleData.modules;
        materials.value = moduleData.materials;
        
        // Set default material to "Divina"
        if (materials.value.length > 0) {
            const divinaMaterial = materials.value.find(m => m.name === 'Divina');
            selectedMaterial.value = divinaMaterial ? divinaMaterial.name : (materials.value[7] ? materials.value[7].name : materials.value[0].name);
        }
        
        // Generate thumbnails with the same default material
        const thumbnailMaterial = materials.value.find(m => m.name === selectedMaterial.value) || materials.value[0];
        if (thumbnailMaterial) {
            for (const module of modules.value) {
                const modelPath = `/models/${module.folder}/${thumbnailMaterial.defaultFile}`;
                try {
                    module.thumbnail = await planner.generateThumbnail(modelPath, 300);
                } catch (error) {
                    console.error('Failed to generate thumbnail for', module.name, error);
                }
            }
            
            // Generate initial material preview
            await generateMaterialPreview();
        }
    } catch (error) {
        console.error('Failed to load modules:', error);
    }
    loadingModules.value = false;
});

const handleMaterialChange = async (materialName: string): Promise<void> => {
    selectedMaterial.value = materialName;
    // Thumbnails stay the same - only update material preview
    await generateMaterialPreview();
};

const handleGroundTextureChange = async (textureType: GroundTextureType): Promise<void> => {
    selectedGroundTexture.value = textureType;
    await planner.changeGroundTexture(textureType);
};

const generateMaterialPreview = async () => {
    if (!selectedMaterial.value || modules.value.length === 0) return;
    
    const material = materials.value.find(m => m.name === selectedMaterial.value);
    if (!material?.defaultFile) return;
    
    // Use first module for preview
    const modelPath = `/models/${modules.value[0].folder}/${material.defaultFile}`;
    
    try {
        materialPreview.value = await planner.generateThumbnail(modelPath, 200);
    } catch (error) {
        console.error('Failed to generate material preview:', error);
        materialPreview.value = undefined;
    }
};

const handleModuleClick = (module: ModuleInfo): void => {
    if (!selectedMaterial.value) return;
    
    // Find the material object to get the default file
    const material = materials.value.find(m => m.name === selectedMaterial.value);
    if (!material?.defaultFile) {
        console.error('No default file found for material:', selectedMaterial.value);
        return;
    }
    
    const modelPath = `/models/${module.folder}/${material.defaultFile}`;
    emit('loadModel', modelPath);
};

const togglePanel = () => {
    isCollapsed.value = !isCollapsed.value;
};
</script>

<template>
    <div :class="[
        'h-full flex flex-col bg-white dark:bg-gray-800 overflow-hidden transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-16' : 'w-80'
    ]">
        <!-- Panel Header -->
        <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
            <h2 v-if="!isCollapsed" class="text-lg font-semibold text-gray-900 dark:text-white">System Modules</h2>
            <button
                @click="togglePanel"
                class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center cursor-pointer"
                :title="isCollapsed ? 'Expand panel' : 'Collapse panel'"
            >
                <Lineicons :icon="isCollapsed ? AngleDoubleRightOutlined : AngleDoubleLeftOutlined" :size="24" :stroke-width="2" />
            </button>
        </div>

        <!-- Panel Content (hidden when collapsed) -->
        <div v-if="!isCollapsed" class="flex-1 flex flex-col overflow-hidden">
            <!-- Floor Texture Selector -->
            <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <label class="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-2">Floor Texture</label>
                <select
                    v-model="selectedGroundTexture"
                    @change="handleGroundTextureChange(selectedGroundTexture)"
                    class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 cursor-pointer border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white hover:border-blue-400 focus:border-blue-500 focus:outline-none transition-colors"
                >
                    <option v-for="texture in GROUND_TEXTURES" :key="texture.type" :value="texture.type">
                        {{ texture.name }}
                    </option>
                </select>
            </div>

            <!-- Material Selector -->
            <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <label class="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-2">Material</label>
                <div class="flex gap-3 items-center">
                <select
                    :value="selectedMaterial"
                    @change="handleMaterialChange(($event.target as HTMLSelectElement).value)"
                    class="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-700 cursor-pointer border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white hover:border-blue-400 focus:border-blue-500 focus:outline-none transition-colors h-10"
                >
                    <option v-for="material in materials" :key="material.name" :value="material.name">
                    {{ material.name }}
                    </option>
                </select>
                
                <!-- Material Preview -->
                <div class="w-10 h-10 flex-shrink-0 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden">
                    <img
                    v-if="materialPreview"
                    :src="materialPreview"
                    :alt="selectedMaterial"
                    class="w-full h-full object-cover"
                    />
                    <svg v-else class="h-5 w-5 text-gray-400 dark:text-gray-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                </div>
                </div>
            </div>

            <!-- Modules List -->
            <div class="flex-1 overflow-y-auto">
                <div class="p-4 space-y-3">
                    <div v-if="loadingModules" class="text-center py-8 text-gray-500">
                        <svg class="h-6 w-6 text-gray-400 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <p class="text-xs">Loading modules...</p>
                    </div>

                    <button
                        v-for="module in modules"
                        v-else
                        :key="module.folder"
                        @click="handleModuleClick(module)"
                        class="w-full text-left p-3 cursor-pointer border border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                        <!-- Module Thumbnail -->
                        <div class="aspect-video bg-gray-100 dark:bg-gray-700 rounded-md mb-2 flex items-center justify-center overflow-hidden">
                            <img
                                v-if="module.thumbnail"
                                :src="module.thumbnail"
                                :alt="module.name"
                                class="w-full h-full object-cover"
                            />
                            <svg v-else class="h-8 w-8 text-gray-400 dark:text-gray-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>

                        <!-- Module Info -->
                        <h3 class="font-medium text-gray-900 dark:text-white text-sm">{{ module.name }}</h3>
                    </button>
                </div>
            </div>
        </div>

        <!-- Collapsed State - Only show arrow button -->
        <div v-else class="flex-1"></div>
    </div>
</template>
