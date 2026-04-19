<script setup lang="js">
import { Head } from '@inertiajs/vue3';
import AppLogoIcon from '@/components/app/AppLogoIcon.vue';

defineProps({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: undefined,
    },
});
</script>

<template>
    <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div class="w-full max-w-md">
            <Head :title="title" />

            <div class="flex items-center justify-center mb-8">
                <AppLogoIcon size="lg" class="text-blue-600 dark:text-blue-400" />
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
                <div class="mb-6">
                    <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ title }}</h2>
                    <p v-if="description" class="mt-2 text-sm text-gray-600 dark:text-gray-300">{{ description }}</p>
                </div>
                <slot />
            </div>
        </div>
    </div>
</template>
