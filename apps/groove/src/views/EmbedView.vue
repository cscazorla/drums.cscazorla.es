<!--
  Groove, a drum-groove editor.
  Copyright (C) 2026 Fernando Guisso
  This program is free software under the GNU General Public License,
  version 3 or (at your option) any later version. See the LICENSE file.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ExternalLink } from 'lucide-vue-next'
import { useGrooveStore } from '@/stores/groove'
import { usePracticeTimerStore } from '@/stores/practiceTimer'
import { useSpeedTrainerStore } from '@/stores/speedTrainer'
import { useUrlSync } from '@/composables/useUrlSync'
import { usePlayback } from '@/composables/usePlayback'
import { useWakeLock } from '@/composables/useWakeLock'
import Score from '@/components/groove/Score.vue'
import Transport from '@/components/groove/Transport.vue'
import PracticeClock from '@/components/groove/PracticeClock.vue'

const store = useGrooveStore()
const { groove } = storeToRefs(store)
const practiceTimer = usePracticeTimerStore()
const speed = useSpeedTrainerStore()
const route = useRoute()

// Read-only when ?ro=1 appears in the hash's query part
const readOnly = computed(() => route.query.ro === '1')

const editorUrl = computed(() => {
  const payload = route.params.payload as string | undefined
  const base = `${location.origin}${location.pathname}`
  return payload ? `${base}#/g/${payload}` : `${base}#/`
})

useUrlSync({ writeBack: false })

const { isPlaying, currentStep, countInBeat, loopCount, play, stop, updateRuntime, setOnEnded } =
  usePlayback()
const wakeLock = useWakeLock()

// Same speed-training rule as the editor; the embed is a practice surface too.
watch(loopCount, (n) => {
  const next = speed.tempoAfterLoops(n, groove.value.tempo)
  if (next !== null) store.setTempo(next)
})
watch(
  () => [groove.value.tempo, groove.value.swing],
  () => updateRuntime(groove.value),
)

watch(isPlaying, (playing) => {
  if (playing) wakeLock.request()
  else wakeLock.release()
})

function onPlay() {
  play(groove.value)
  if (practiceTimer.enabled && groove.value.loop) practiceTimer.start()
}
function onStop() {
  practiceTimer.stop()
  stop()
}

const host = ref<HTMLDivElement | null>(null)
let ro: ResizeObserver | null = null

function postHeight() {
  if (!host.value) return
  const h = host.value.getBoundingClientRect().height
  window.parent?.postMessage({ type: 'groove:resize', height: Math.ceil(h) }, '*')
}

onMounted(() => {
  // Mark the document as embed so global styles can strip the body gradient
  // and background color, letting the host page show through.
  document.documentElement.classList.add('is-embed')
  document.body.classList.add('is-embed')
  ro = new ResizeObserver(() => postHeight())
  if (host.value) ro.observe(host.value)
  postHeight()
  practiceTimer.setOnExpire(() => onStop())
  setOnEnded(() => practiceTimer.stop())
})
onBeforeUnmount(() => {
  ro?.disconnect()
  document.documentElement.classList.remove('is-embed')
  document.body.classList.remove('is-embed')
  practiceTimer.setOnExpire(null)
  practiceTimer.stop()
})

watch(groove, postHeight, { deep: true })
</script>

<template>
  <div ref="host" class="w-full p-3 space-y-3 relative">
    <div class="flex items-center gap-3 text-sm">
      <div v-if="groove.title || groove.author" class="min-w-0 flex-1 truncate">
        <span class="font-semibold">{{ groove.title }}</span>
        <span v-if="groove.author" class="text-muted-foreground"> — {{ groove.author }}</span>
      </div>
      <a
        :href="editorUrl"
        target="_blank"
        rel="noopener"
        class="ml-auto inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
        title="Open this groove in the editor"
      >
        <ExternalLink class="h-3 w-3" :stroke-width="2" />
        <span>Edit</span>
      </a>
    </div>
    <div class="relative">
      <Score :active-step="currentStep" :is-playing="isPlaying" :selectable="false" />
      <PracticeClock />
    </div>
    <Transport :is-playing="isPlaying" :read-only="readOnly" @play="onPlay" @stop="onStop" />

    <Transition name="count-fade">
      <div
        v-if="countInBeat > 0"
        class="count-in-overlay pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
      >
        <div :key="countInBeat" class="count-in-number">{{ countInBeat }}</div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.count-in-number {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 800;
  font-size: 6rem;
  line-height: 1;
  letter-spacing: -0.05em;
  color: hsl(var(--destructive));
  text-shadow:
    0 0 24px hsl(var(--destructive) / 0.55),
    0 0 60px hsl(var(--destructive) / 0.3);
  animation: count-pulse 260ms cubic-bezier(0.2, 0.9, 0.3, 1);
}

@keyframes count-pulse {
  0% {
    transform: scale(0.4);
    opacity: 0;
  }
  35% {
    transform: scale(1.15);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.count-fade-leave-active {
  transition: opacity 120ms ease-out;
}
.count-fade-leave-to {
  opacity: 0;
}
</style>
