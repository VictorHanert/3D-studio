<script setup lang="js">
import { cn } from "@/lib/utils"

const props = defineProps({
  class: {
    type: [String, Array, Object],
    default: undefined,
  },
})
</script>

<template>
  <div
    data-slot="input-otp-group"
    :class="cn('flex items-center', props.class)"
  >
    <slot />
  </div>
</template>