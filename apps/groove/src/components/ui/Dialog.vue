<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'

const props = defineProps<{ open: boolean; title?: string }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('update:open', false)
}
watch(
  () => props.open,
  (v) => {
    if (v) document.addEventListener('keydown', onKey)
    else document.removeEventListener('keydown', onKey)
  },
)
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="emit('update:open', false)"
    >
      <div class="w-full max-w-lg rounded-lg border bg-card p-6 text-card-foreground shadow-lg">
        <div v-if="title" class="mb-4 text-lg font-semibold">{{ title }}</div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
