<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{ modelValue: boolean; class?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :class="
      cn(
        'relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors',
        'ring-1 ring-inset',
        modelValue ? 'bg-primary/90 ring-primary shadow-led-primary' : 'bg-muted ring-border',
        props.class,
      )
    "
    @click="emit('update:modelValue', !modelValue)"
  >
    <span
      :class="
        cn(
          'pointer-events-none block h-3 w-3 rounded-full bg-background shadow',
          'transition-transform',
          modelValue ? 'translate-x-3.5' : 'translate-x-0.5',
        )
      "
    />
  </button>
</template>
