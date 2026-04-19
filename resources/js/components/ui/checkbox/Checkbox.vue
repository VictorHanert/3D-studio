<script setup lang="js">
import { reactiveOmit } from "@vueuse/core"
import { CheckboxRoot as Checkbox, CheckboxIndicator } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps({
  class: {
    type: [String, Array, Object],
    default: undefined,
  },
})

const delegatedProps = reactiveOmit(props, "class")
</script>

<template>
  <Checkbox
    data-slot="checkbox"
    :class="cn('peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground', props.class)"
    v-bind="delegatedProps"
  >
    <CheckboxIndicator class="flex items-center justify-center text-current">
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20,6 9,17 4,12"></polyline>
      </svg>
    </CheckboxIndicator>
    <slot />
  </Checkbox>
</template>