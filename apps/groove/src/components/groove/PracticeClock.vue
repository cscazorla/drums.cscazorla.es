<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Timer } from 'lucide-vue-next'
import { usePracticeTimerStore } from '@/stores/practiceTimer'

const store = usePracticeTimerStore()
const { enabled, running, remainingMs, minutes } = storeToRefs(store)

// Show the clock whenever the user has the timer on so they can see the
// configured duration even before pressing play. Once running, the readout
// updates every tick. We always render the full minutes when not running, so
// the player knows how long the session will be.
const visible = computed(() => enabled.value)

const display = computed(() => {
  const ms = running.value ? remainingMs.value : minutes.value * 60_000
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})
</script>

<template>
  <div
    v-if="visible"
    class="practice-clock-overlay pointer-events-none absolute inset-x-0 bottom-2 z-30 flex justify-center"
  >
    <div
      class="pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-background/90 ring-1 ring-border shadow-sm backdrop-blur-sm"
      :class="running ? 'is-running' : 'is-idle'"
    >
      <Timer class="h-3.5 w-3.5 text-muted-foreground" :stroke-width="2" />
      <span class="practice-clock-readout tabular">{{ display }}</span>
    </div>
  </div>
</template>

<style scoped>
.practice-clock-readout {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 700;
  font-size: 1.25rem;
  line-height: 1;
  letter-spacing: 0.02em;
  color: hsl(var(--muted-foreground));
}

.is-running .practice-clock-readout {
  color: hsl(var(--primary));
  text-shadow: 0 0 12px hsl(var(--primary) / 0.35);
}
</style>
