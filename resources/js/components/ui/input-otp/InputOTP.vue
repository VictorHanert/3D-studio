<script setup lang="js">
import { PinInputRoot, useForwardPropsEmits } from "reka-ui"

const props = defineProps()
const emits = defineEmits()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <PinInputRoot
    v-slot="slotProps"
    data-slot="input-otp"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </PinInputRoot>
</template>