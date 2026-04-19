<script setup lang="js">
import { reactiveOmit } from "@vueuse/core"
import { PinInputInput } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps({
  class: {
    type: [String, Array, Object],
    default: undefined,
  },
  index: {
    type: Number,
    required: true,
  },
})

const delegatedProps = reactiveOmit(props, "class")
</script>

<template>
  <PinInputInput
    data-slot="input-otp-slot"
    :class="cn('relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md focus-within:z-10 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2', props.class)"
    v-bind="delegatedProps"
  >
    <slot />
  </PinInputInput>
</template>