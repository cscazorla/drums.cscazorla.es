<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{ modelValue?: string | number; placeholder?: string; type?: string; class?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string | number): void }>()
</script>

<template>
  <input
    :type="type ?? 'text'"
    :value="modelValue"
    :placeholder="placeholder"
    :class="
      cn(
        'flex h-8 w-full rounded-md border border-border bg-background/60 px-2.5 text-[13px]',
        'placeholder:text-muted-foreground/70',
        'transition-colors hover:border-border focus-visible:outline-none',
        'focus-visible:border-primary/60 focus-visible:ring-1 focus-visible:ring-primary/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        $props.class,
      )
    "
    @input="(e) => emit('update:modelValue', (e.target as HTMLInputElement).value)"
  />
</template>
