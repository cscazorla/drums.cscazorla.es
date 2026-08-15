<script setup lang="ts" generic="T extends string | number">
import { cn } from '@/lib/utils'

defineProps<{ modelValue: T; options: { label: string; value: T }[]; class?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: T): void }>()
</script>

<template>
  <select
    :value="modelValue"
    :class="
      cn(
        'h-8 rounded-md border border-border bg-background/60 pl-2 pr-6 text-[12px] font-mono tabular',
        'focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-1 focus-visible:ring-primary/40',
        'appearance-none bg-no-repeat bg-[length:10px] bg-[position:right_0.5rem_center]',
        $props.class,
      )
    "
    style="
      background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22currentColor%22><path fill-rule=%22evenodd%22 d=%22M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06z%22 clip-rule=%22evenodd%22/></svg>');
    "
    @change="
      (e) => {
        // A native select's value is always a string. Map it back to the
        // matching option so we emit the original typed value (e.g. number),
        // not the string — otherwise numeric model-values silently become
        // strings, which breaks downstream `===` checks and `v-for` counts.
        const raw = (e.target as HTMLSelectElement).value
        const match = options.find((o) => String(o.value) === raw)
        emit('update:modelValue', match ? match.value : (raw as unknown as T))
      }
    "
  >
    <option v-for="o in options" :key="String(o.value)" :value="o.value">{{ o.label }}</option>
  </select>
</template>
