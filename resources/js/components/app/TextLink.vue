<script setup lang="js">
import { Link } from '@inertiajs/vue3';

defineProps({
    href: {
        type: [String, Object],
        required: true,
    },
    tabindex: {
        type: Number,
        default: undefined,
    },
    method: {
        type: String,
        default: undefined,
    },
    as: {
        type: String,
        default: undefined,
    },
});
</script>

<template>
    <Link
        :href="href"
        :tabindex="tabindex"
        :method="method"
        :as="as"
        class="text-blue-600 hover:text-blue-700 underline underline-offset-4 transition-colors"
    >
        <slot />
    </Link>
</template>
