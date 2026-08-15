<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useGrooveStore } from '@/stores/groove'
import { useMidiStore } from '@/stores/midi'
import { renderScore, type MeasureBounds, type StepMarker } from '@/lib/vex-builder'
import type { VoiceId } from '@/lib/voices'

const props = withDefaults(
  defineProps<{ activeStep?: number; isPlaying?: boolean; selectable?: boolean }>(),
  { selectable: true },
)

const store = useGrooveStore()
const { groove, selectedMeasure } = storeToRefs(store)
const midi = useMidiStore()
const { markers } = storeToRefs(midi)
const hostRoot = ref<HTMLDivElement | null>(null)
const host = ref<HTMLDivElement | null>(null)
const stepMarkers = ref<StepMarker[]>([])
const voiceY = ref<Record<VoiceId, number>>({} as Record<VoiceId, number>)
const measureBounds = ref<MeasureBounds[]>([])

function availableWidth(): number {
  // The inner host div is inside an `inline-block` wrap, so its clientWidth is
  // 0 before the SVG is drawn. Read from the outer score-host (block-level)
  // and subtract its horizontal padding so the SVG fits exactly.
  const root = hostRoot.value
  if (!root) return 720
  const cs = getComputedStyle(root)
  const padL = parseFloat(cs.paddingLeft) || 0
  const padR = parseFloat(cs.paddingRight) || 0
  return Math.max(0, root.clientWidth - padL - padR)
}

function redraw() {
  if (!host.value) return
  try {
    const res = renderScore(host.value, groove.value, {
      width: availableWidth(),
      singleRow: props.isPlaying,
    })
    stepMarkers.value = res.stepMarkers
    voiceY.value = res.voiceY
    measureBounds.value = res.measureBounds
  } catch (e) {
    console.warn('[score] render failed', e)
  }
}

// During playback keep the active step pinned to the horizontal center so the
// player never has to scroll by hand: the playhead stays put and the chart
// slides behind it. Snaps instantly (no smooth animation) so it can't lag the
// beat at fast tempos. When paused, scrolling is left to the user.
function scrollActiveIntoView() {
  if (!props.isPlaying) return
  const root = hostRoot.value
  const m = marker.value
  if (!root || !m) return
  const center = m.x + m.width / 2
  const target = center - root.clientWidth / 2
  const max = root.scrollWidth - root.clientWidth
  root.scrollLeft = Math.max(0, Math.min(target, max))
}

let ro: ResizeObserver | null = null

onMounted(() => {
  redraw()
  window.addEventListener('resize', redraw)
  if (hostRoot.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => redraw())
    ro.observe(hostRoot.value)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', redraw)
  ro?.disconnect()
})
watch(groove, redraw, { deep: true })

// Re-render when entering/leaving playback so the staff switches between the
// wrapped (paused, readable) and single-row (playing, scrollable) layouts.
watch(
  () => props.isPlaying,
  () => {
    redraw()
    nextTick(scrollActiveIntoView)
  },
)

// Follow the playhead while it moves.
watch(
  () => props.activeStep,
  () => scrollActiveIntoView(),
)

const marker = computed(() => {
  const i = props.activeStep ?? -1
  if (i < 0 || i >= stepMarkers.value.length) return null
  return stepMarkers.value[i]
})

interface MarkerPosition {
  id: number
  x: number
  y: number
  cls: string
}

const markerPositions = computed<MarkerPosition[]>(() => {
  const out: MarkerPosition[] = []
  for (const m of markers.value) {
    const sm = stepMarkers.value[m.step]
    if (!sm) continue
    const y = voiceY.value[m.voiceId]
    if (y == null) continue
    out.push({
      id: m.id,
      x: sm.x + sm.width / 2,
      // voiceY is the row-0 baseline; sm.y shifts it down to the step's row.
      y: y + sm.y,
      cls: `score-live-marker score-live-marker--${m.grade}`,
    })
  }
  return out
})

defineExpose({
  getSvg: () => host.value?.querySelector('svg') as SVGSVGElement | null,
})
</script>

<template>
  <div ref="hostRoot" class="score-host w-full overflow-x-auto text-center">
    <div class="score-wrap">
      <div ref="host" />
      <button
        v-for="(b, m) in measureBounds"
        v-show="props.selectable"
        :key="'mh-' + m"
        type="button"
        class="score-measure-hit"
        :class="{ 'is-selected': !props.isPlaying && m === selectedMeasure }"
        :style="{
          left: b.x + 'px',
          top: b.y + 'px',
          width: b.width + 'px',
          height: b.height + 'px',
        }"
        :disabled="props.isPlaying"
        :aria-label="`Select measure ${m + 1}`"
        @click="store.setSelectedMeasure(m)"
      />
      <div
        v-if="marker"
        class="score-marker"
        :style="{
          left: marker.x + 'px',
          top: marker.y + 'px',
          width: marker.width + 'px',
          height: marker.height + 'px',
        }"
      />
      <div
        v-for="m in markerPositions"
        :key="m.id"
        :class="m.cls"
        :style="{ left: m.x + 'px', top: m.y + 'px' }"
      />
    </div>
  </div>
</template>

<style scoped>
.score-wrap {
  position: relative;
  display: inline-block;
  vertical-align: top;
}

.score-marker {
  position: absolute;
  top: 0;
  background: hsl(var(--primary) / 0.22);
  border-left: 1px solid hsl(var(--primary) / 0.6);
  border-right: 1px solid hsl(var(--primary) / 0.6);
  pointer-events: none;
  transition:
    left 60ms linear,
    width 60ms linear;
  border-radius: 2px;
}

.score-measure-hit {
  position: absolute;
  top: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  transition: background 120ms ease-out;
  z-index: 1;
}
.score-measure-hit:hover:not(:disabled) {
  background: hsl(var(--primary) / 0.05);
}
.score-measure-hit.is-selected {
  background: hsl(var(--primary) / 0.08);
  box-shadow: inset 0 -2px 0 0 hsl(var(--primary) / 0.55);
}
.score-measure-hit:disabled {
  cursor: default;
}

/* Live MIDI marker — sits on top of the actual notehead so the user can read
   "I hit this note" at a glance. Semi-transparent on purpose: lets the
   notehead glyph beneath show through, and avoids covering accents/dots. */
.score-live-marker {
  position: absolute;
  width: 18px;
  height: 18px;
  margin-left: -9px;
  margin-top: -9px;
  border-radius: 50%;
  pointer-events: none;
  animation: score-marker-appear 220ms ease-out;
  z-index: 2;
}
.score-live-marker--perfect {
  background: hsl(160 70% 45% / 0.55);
  box-shadow: 0 0 14px hsl(160 70% 45% / 0.7);
}
.score-live-marker--early {
  background: hsl(200 85% 58% / 0.55);
  box-shadow: 0 0 14px hsl(200 85% 58% / 0.7);
}
.score-live-marker--late {
  background: hsl(28 90% 56% / 0.55);
  box-shadow: 0 0 14px hsl(28 90% 56% / 0.7);
}
.score-live-marker--wrong-voice {
  background: hsl(var(--warn) / 0.55);
  box-shadow: 0 0 14px hsl(var(--warn) / 0.7);
}
.score-live-marker--off-time {
  background: hsl(var(--destructive) / 0.55);
  box-shadow: 0 0 14px hsl(var(--destructive) / 0.7);
}

@keyframes score-marker-appear {
  0% {
    opacity: 0;
    transform: scale(2.2);
  }
  60% {
    opacity: 1;
    transform: scale(1.2);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
