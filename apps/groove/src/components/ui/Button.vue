<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
    size?: 'sm' | 'md' | 'lg' | 'icon'
    disabled?: boolean
    type?: 'button' | 'submit'
  }>(),
  { variant: 'default', size: 'md', type: 'button' },
)

const emit = defineEmits<{ (e: 'click', ev: MouseEvent): void }>()

const classes = computed(() =>
  cn(
    'touch-target inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[12px] font-medium tracking-tight transition-all',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50 active:translate-y-px',
    {
      default:
        'bg-primary text-primary-foreground shadow-sm hover:brightness-110 ring-1 ring-primary/40',
      secondary:
        'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border',
      outline:
        'border border-border bg-transparent hover:bg-accent/10 hover:text-accent hover:border-accent/40',
      ghost: 'hover:bg-muted text-muted-foreground hover:text-foreground',
      destructive: 'bg-destructive text-destructive-foreground hover:brightness-110',
    }[props.variant],
    {
      sm: 'h-7 px-2.5',
      md: 'h-8 px-3',
      lg: 'h-10 px-5',
      icon: 'h-9 w-9',
    }[props.size],
  ),
)
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled" @click="(e) => emit('click', e)">
    <slot />
  </button>
</template>
