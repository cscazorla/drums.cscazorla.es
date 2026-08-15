<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    step?: number
    class?: string
    disabled?: boolean
  }>(),
  { min: 0, max: 100, step: 1 },
)
const emit = defineEmits<{ (e: 'update:modelValue', v: number): void }>()

const pct = computed(() => {
  const range = props.max - props.min
  if (range === 0) return 0
  const clamped = Math.max(props.min, Math.min(props.max, props.modelValue))
  return ((clamped - props.min) / range) * 100
})
</script>

<template>
  <input
    type="range"
    :min="props.min"
    :max="props.max"
    :step="props.step"
    :value="modelValue"
    :disabled="disabled"
    :style="{ '--pct': pct + '%' }"
    :class="
      cn(
        'groove-slider w-full appearance-none bg-transparent cursor-pointer',
        'disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
    @input="(e) => emit('update:modelValue', Number((e.target as HTMLInputElement).value))"
  />
</template>

<style>
.groove-slider {
  height: 14px;
}
.groove-slider::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    hsl(var(--primary)) 0 var(--pct, 50%),
    hsl(var(--muted)) var(--pct, 50%) 100%
  );
}
.groove-slider::-moz-range-track {
  height: 4px;
  border-radius: 999px;
  background: hsl(var(--muted));
}
.groove-slider::-moz-range-progress {
  height: 4px;
  border-radius: 999px;
  background: hsl(var(--primary));
}
.groove-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: hsl(var(--foreground));
  border: 2px solid hsl(var(--primary));
  margin-top: -5px;
  box-shadow:
    0 0 0 2px hsl(var(--background)),
    0 0 10px -2px hsl(var(--primary) / 0.6);
  transition: transform 0.1s;
}
.groove-slider:hover::-webkit-slider-thumb {
  transform: scale(1.15);
}
.groove-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: hsl(var(--foreground));
  border: 2px solid hsl(var(--primary));
  box-shadow:
    0 0 0 2px hsl(var(--background)),
    0 0 10px -2px hsl(var(--primary) / 0.6);
}

/* A 14px thumb is fine under a mouse and impossible under a thumb. The track
   keeps its 4px look; only the grab handle and the row height grow. */
@media (pointer: coarse) {
  .groove-slider {
    height: 28px;
  }
  .groove-slider::-webkit-slider-thumb {
    width: 24px;
    height: 24px;
    margin-top: -10px;
  }
  .groove-slider::-moz-range-thumb {
    width: 24px;
    height: 24px;
  }
}
</style>
