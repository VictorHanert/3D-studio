<script setup lang="js">
defineProps({
    message: {
        type: String,
        default: undefined,
    },
});
</script>

<template>
    <div v-show="message">
        <p class="text-sm text-red-600 dark:text-red-500">
            {{ message }}
        </p>
    </div>
</template>
