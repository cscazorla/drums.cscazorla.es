<!--
  Groove, a drum-groove editor.
  Copyright (C) 2026 Fernando Guisso
  This program is free software under the GNU General Public License,
  version 3 or (at your option) any later version. See the LICENSE file.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useGrooveStore } from '@/stores/groove'
import { useMidiStore, type LiveMarkerGrade } from '@/stores/midi'
import { usePracticeTimerStore } from '@/stores/practiceTimer'
import { useSpeedTrainerStore } from '@/stores/speedTrainer'
import { useUrlSync } from '@/composables/useUrlSync'
import { usePlayback } from '@/composables/usePlayback'
import { useWakeLock } from '@/composables/useWakeLock'
import { useTour } from '@/composables/useTour'
import { DIVISIONS } from '@/lib/model'
import { VOICES } from '@/lib/voices'
import TopBar from '@/components/shell/TopBar.vue'
import ShareDialog from '@/components/shell/ShareDialog.vue'
import GrooveGrid from '@/components/groove/GrooveGrid.vue'
import Score from '@/components/groove/Score.vue'
import Transport from '@/components/groove/Transport.vue'
import StateBar from '@/components/groove/StateBar.vue'
import PracticeClock from '@/components/groove/PracticeClock.vue'
import AudioHint from '@/components/groove/AudioHint.vue'
import MidiPanel from '@/components/groove/MidiPanel.vue'
import Select from '@/components/ui/Select.vue'
import { exportMidi } from '@/lib/export-midi'
import { exportPng } from '@/lib/export-png'

const store = useGrooveStore()
const { groove } = storeToRefs(store)
const midi = useMidiStore()
const practiceTimer = usePracticeTimerStore()
const speed = useSpeedTrainerStore()
const { maybeAutoStart } = useTour()
useUrlSync()

const {
  isPlaying,
  currentStep,
  currentPass,
  countInBeat,
  practiceTimerVal,
  loopCount,
  play,
  stop,
  updateRuntime,
  setOnEnded,
  nearestStepNow,
  audioBlocked,
  audioState,
} = usePlayback()
const wakeLock = useWakeLock()
watch(
  () => [groove.value.tempo, groove.value.swing],
  () => updateRuntime(groove.value),
)

// Keep the screen awake while a groove is playing; release the moment it stops
// (manual stop, natural end, or timer expiry all flip isPlaying to false).
// Lesson mode holds the lock even when stopped: you are standing at the kit
// transcribing a bar between takes, and the screen dimming mid-thought is
// exactly the failure this is here to prevent.
watch(
  [isPlaying, () => midi.lessonMode],
  ([playing, lesson]) => {
    if (playing || lesson) wakeLock.request()
    else wakeLock.release()
  },
  { immediate: true },
)

// Speed training: every N completed loops, nudge the tempo toward the target.
// The tempo it reaches is kept when playback stops, because "I got it to 140"
// is the point of the exercise; the slider is right there to wind it back.
watch(loopCount, (n) => {
  const next = speed.tempoAfterLoops(n, groove.value.tempo)
  if (next !== null) store.setTempo(next)
})

// Brief on-screen verdict for the most recent hit on a correct pad (early /
// perfect / late + how many ms off), so the player gets immediate timing
// feedback without hunting for the dot on the staff.
const timingFeedback = ref<{ grade: 'perfect' | 'early' | 'late'; ms: number; id: number } | null>(
  null,
)
let feedbackToken = 0

// Live marker stamping: every MIDI hit during playback drops a marker on the
// grid + tablature, graded against the programmed groove. For a correct pad the
// grade refines into early / perfect / late using the audio-clock delta the
// store captured at hit time (h.timing), offset by the user's latency setting.
watch(
  () => midi.lastHit,
  (h) => {
    if (!h || !isPlaying.value) return
    const timing = h.timing
    const step = timing ? timing.step : currentStep.value
    if (step < 0) return
    const expected = (groove.value.voices[h.voiceId]?.[step] ?? 0) !== 0
    let grade: LiveMarkerGrade
    if (!expected) {
      grade = VOICES.some((v) => (groove.value.voices[v.id]?.[step] ?? 0) !== 0)
        ? 'wrong-voice'
        : 'off-time'
    } else if (timing) {
      const deltaMs = timing.deltaSec * 1000 - midi.latencyMs
      const perfectWin = Math.max(8, midi.toleranceMs * 0.4)
      if (deltaMs < -perfectWin) grade = 'early'
      else if (deltaMs > perfectWin) grade = 'late'
      else grade = 'perfect'
      const fid = ++feedbackToken
      timingFeedback.value = { grade, ms: Math.round(deltaMs), id: fid }
      window.setTimeout(() => {
        if (feedbackToken === fid) timingFeedback.value = null
      }, 900)
    } else {
      // Correct pad but no audio-clock data (e.g. a hit landing in count-in).
      grade = 'perfect'
    }
    midi.pushMarker({ voiceId: h.voiceId, step, atMs: h.atMs, grade })
  },
)

// Clear feedback markers right before the next loop starts so the user sees
// their last bar's verdicts during the review window, then a clean slate.
// With count-in: clear at beat 3 (so 3 + 4 of count play with empty board).
// Without count-in: clear when playback wraps from the last step back to 0.
// `lastTrackStep` tracks the most recent positive step, so transitions through
// `-1` during the practice pause don't break the wrap detection.
watch(countInBeat, (v) => {
  if (v === 3) midi.clearMarkers()
})
let lastTrackStep = -1
watch(currentStep, (s) => {
  if (s < 0) return
  if (!groove.value.countIn && s === 0 && lastTrackStep > 0) midi.clearMarkers()
  lastTrackStep = s
})

function onPlay() {
  midi.clearMarkers()
  lastTrackStep = -1
  play(groove.value, {
    practicePauseSec: midi.practiceMode ? midi.practiceTimerSec : 0,
  })
  if (practiceTimer.enabled && groove.value.loop) practiceTimer.start()
}
function onStop() {
  // Snapshot the playing measure before stop() resets currentStep, so the
  // single-mode grid resumes on whatever bar the user paused on.
  const s = currentStep.value
  if (s >= 0) {
    const m = Math.floor(s / groove.value.division) % groove.value.measures
    store.setSelectedMeasure(m)
  }
  // In practice mode the user explicitly wants to keep markers visible after
  // pausing — only the next Play press clears them.
  if (!midi.practiceMode) midi.clearMarkers()
  practiceTimer.stop()
  stop()
}

// Global shortcuts: Space toggles play/pause, Cmd/Ctrl+Z undoes.
function onKeydown(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
  if (typing) return

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    if (e.shiftKey) store.redo()
    else store.undo()
    return
  }
  if (e.code !== 'Space') return
  e.preventDefault()
  if (isPlaying.value) onStop()
  else onPlay()
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  practiceTimer.setOnExpire(() => onStop())
  // A non-looping track that reaches its end resets to the first bar and clears
  // the board (markers stay only in practice mode, matching manual stop).
  setOnEnded(() => {
    if (!midi.practiceMode) midi.clearMarkers()
    practiceTimer.stop()
    store.setSelectedMeasure(0)
  })
  // Grade incoming hits against the audio clock (captured synchronously in the
  // store's MIDI handler, before Vue's flush moves the transport on).
  midi.setHitTimingProvider(() => nearestStepNow())
  // Defer so the grid/score have painted before the tour anchors to them.
  nextTick(() => maybeAutoStart())
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  practiceTimer.setOnExpire(null)
  practiceTimer.stop()
  midi.setHitTimingProvider(null)
})

const shareOpen = ref(false)
const scoreRef = ref<InstanceType<typeof Score> | null>(null)

async function onExportMidi() {
  await exportMidi(groove.value)
}
async function onExportPng() {
  const svg = scoreRef.value?.getSvg()
  if (svg) await exportPng(svg, groove.value.title || 'groove')
}
</script>

<template>
  <div class="app-shell flex flex-col">
    <TopBar @share="shareOpen = true" />

    <main class="flex-1 px-4 py-5 space-y-4 max-w-[1200px] w-full mx-auto">
      <div v-if="!midi.lessonMode" class="flex flex-wrap items-center gap-4 text-sm">
        <div class="flex items-center gap-2" data-tour="division">
          <label class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
            >Division</label
          >
          <Select
            :model-value="groove.division"
            :options="DIVISIONS.map((d) => ({ label: d + (d === 32 ? 'nds' : 'ths'), value: d }))"
            @update:model-value="store.setDivision($event as typeof groove.division)"
          />
        </div>
        <div
          class="ml-auto flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
        >
          <span>Time</span>
          <span class="text-foreground tabular"
            >{{ groove.timeSig[0] }}/{{ groove.timeSig[1] }}</span
          >
        </div>
      </div>

      <!-- Lesson mode: standing at a kit with a teacher talking. The staff and
           the practice tools are for studying afterwards, not for catching a
           bar as it is dictated, so they step aside and the grid gets the room. -->
      <div v-if="!midi.lessonMode" class="relative" data-tour="score">
        <Score ref="scoreRef" :active-step="currentStep" :is-playing="isPlaying" />
        <PracticeClock />
      </div>
      <Transport v-if="!midi.lessonMode" :is-playing="isPlaying" @play="onPlay" @stop="onStop" />
      <GrooveGrid :active-step="currentStep" :active-pass="currentPass" :is-playing="isPlaying" />
      <StateBar :is-playing="isPlaying" @play="onPlay" @stop="onStop" />
    </main>

    <MidiPanel @export-midi="onExportMidi" @export-png="onExportPng" />

    <ShareDialog v-model:open="shareOpen" />

    <!-- Editor only: a position:fixed banner inside an embed iframe would fight
         whatever height the host page gave the frame. -->
    <AudioHint :is-playing="isPlaying" :blocked="audioBlocked" :state="audioState()" />

    <Transition name="count-fade">
      <div
        v-if="countInBeat > 0"
        class="count-in-overlay pointer-events-none fixed inset-x-0 top-24 z-40 flex justify-center"
      >
        <div :key="countInBeat" class="count-in-number">{{ countInBeat }}</div>
      </div>
    </Transition>

    <Transition name="count-fade">
      <div
        v-if="timingFeedback"
        class="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center"
      >
        <div
          :key="timingFeedback.id"
          class="timing-badge"
          :class="`timing-badge--${timingFeedback.grade}`"
        >
          <span>{{
            timingFeedback.grade === 'perfect'
              ? 'PERFECT'
              : timingFeedback.grade === 'early'
                ? 'EARLY'
                : 'LATE'
          }}</span>
          <span v-if="timingFeedback.grade !== 'perfect'" class="timing-badge__ms">
            {{ timingFeedback.ms > 0 ? '+' : '' }}{{ timingFeedback.ms }}ms
          </span>
        </div>
      </div>
    </Transition>

    <Transition name="count-fade">
      <div
        v-if="practiceTimerVal > 0"
        class="pointer-events-none fixed inset-x-0 top-24 z-40 flex flex-col items-center"
      >
        <span class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          review
        </span>
        <div :key="practiceTimerVal" class="practice-timer-number">{{ practiceTimerVal }}</div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.count-in-number {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 800;
  font-size: 10rem;
  line-height: 1;
  letter-spacing: -0.05em;
  color: hsl(var(--destructive));
  text-shadow:
    0 0 32px hsl(var(--destructive) / 0.55),
    0 0 80px hsl(var(--destructive) / 0.3);
  animation: count-pulse 260ms cubic-bezier(0.2, 0.9, 0.3, 1);
}

.practice-timer-number {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 800;
  font-size: 8rem;
  line-height: 1;
  letter-spacing: -0.05em;
  color: hsl(var(--primary));
  text-shadow:
    0 0 28px hsl(var(--primary) / 0.5),
    0 0 64px hsl(var(--primary) / 0.25);
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

.timing-badge {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 800;
  font-size: 1.4rem;
  letter-spacing: 0.06em;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  animation: count-pulse 220ms cubic-bezier(0.2, 0.9, 0.3, 1);
}
.timing-badge__ms {
  font-size: 0.85rem;
  font-weight: 600;
  opacity: 0.8;
}
.timing-badge--perfect {
  color: hsl(160 70% 45%);
  background: hsl(160 70% 45% / 0.14);
  text-shadow: 0 0 22px hsl(160 70% 45% / 0.5);
}
.timing-badge--early {
  color: hsl(200 85% 58%);
  background: hsl(200 85% 58% / 0.14);
  text-shadow: 0 0 22px hsl(200 85% 58% / 0.5);
}
.timing-badge--late {
  color: hsl(28 90% 56%);
  background: hsl(28 90% 56% / 0.14);
  text-shadow: 0 0 22px hsl(28 90% 56% / 0.5);
}
</style>
