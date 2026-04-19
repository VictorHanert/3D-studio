<script setup lang="js">
import { ref } from 'vue';
import { Head } from '@inertiajs/vue3';
import Configurator from '@/components/configurator/Configurator.vue';
import ModulePanel from '@/components/configurator/ModulePanel.vue';
import MainLayout from '@/layouts/MainLayout.vue';

const configuratorRef = ref(null);

const handleLoadModel = (modelPath) => {
    if (configuratorRef.value) {
        configuratorRef.value.loadModel(modelPath);
    }
};
</script>

<template>
    <Head title="3D Editor" />

    <MainLayout>
        <div class="h-[calc(100vh-8rem)] flex">
            <!-- Left Panel - Module Selection -->
            <ModulePanel 
                ref="modulePanelRef"
                class="border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-300 ease-in-out"
                @loadModel="handleLoadModel"
            />

            <!-- Main Canvas Area - 3D Configurator -->
            <Configurator 
                ref="configuratorRef"
                class="flex-1" 
            />
        </div>
    </MainLayout>
</template>
