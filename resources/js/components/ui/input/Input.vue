<script setup lang="js">
import { reactiveOmit } from "@vueuse/core"
import { Primitive } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps({
  class: {
    type: [String, Array, Object],
    default: undefined,
  },
  type: {
    type: String,
    default: "text",
  },
})

const delegatedProps = reactiveOmit(props, "class")
</script>

<template>
  <Primitive
    data-slot="input"
    :as="'input'"
    :type="type"
    :class="cn('flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50', props.class)"
    v-bind="delegatedProps"
  />
</template>