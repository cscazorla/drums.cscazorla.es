<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useGrooveStore } from '@/stores/groove'
import { useMidiStore, type LiveMarkerGrade } from '@/stores/midi'
import { VOICE_BY_ID, stateForBrush, type VoiceId } from '@/lib/voices'
import { repeatFor } from '@/lib/playback-order'
import type { Sticking } from '@/lib/model'
import NoteCell from './NoteCell.vue'
import MeasureTabs from './MeasureTabs.vue'
import PresetPicker from './PresetPicker.vue'

const props = defineProps<{ activeStep?: number; isPlaying?: boolean; activePass?: number }>()
const store = useGrooveStore()
const { groove, selectedMeasure, brush } = storeToRefs(store)
const midi = useMidiStore()

const stepsPerMeasure = computed(() => groove.value.division)
const perBeat = computed(() => groove.value.division / (groove.value.timeSig[1] === 8 ? 2 : 1))

// In single mode (paused) only the selected measure is rendered. In stack
// mode (playing) every measure is rendered as its own block, vertically.
const visibleMeasures = computed(() =>
  props.isPlaying
    ? Array.from({ length: groove.value.measures }, (_, i) => i)
    : [selectedMeasure.value],
)

// Column count only. Widths (and their touch-device floors) live in the
// `.note-grid` class so the coarse-pointer override is a media query, not JS.
const gridStyle = computed(() => ({ '--steps': String(stepsPerMeasure.value) }))

function isBeat(localIdx: number) {
  return localIdx % perBeat.value === 0
}
function isDownbeat(localIdx: number) {
  return localIdx % (perBeat.value * groove.value.timeSig[0]) === 0
}
function globalIdx(measure: number, localIdx: number) {
  return measure * stepsPerMeasure.value + localIdx
}

const VISIBLE_LANES: VoiceId[] = ['hh', 'crash', 'ride', 't1', 't2', 't3', 'sn', 'kk']
const lanes = computed(() =>
  VISIBLE_LANES.filter((id) => {
    const v = VOICE_BY_ID[id]
    if (v.group === 'tom' && !midi.showToms) return false
    if (v.group === 'cymbal' && !midi.showCymbals) return false
    return true
  }).map((id) => {
    const v = VOICE_BY_ID[id]
    return { key: id, label: v.label, kind: v.kind }
  }),
)

// Brush painting. A tap applies the active brush; a tap on a cell that already
// holds it erases; a drag paints the run. The whole drag is one undo step.
//
// The origin cell decides the value once and the rest of the stroke repeats it,
// so dragging never flip-flops cells on and off as the finger passes over them.
const strokeLane = ref<VoiceId | 'sticking' | null>(null)
let strokeValue: number | Sticking = 0
let strokeLastStep = -1

// Pan is not "inert": the cells stay lit and normal-looking, they simply do not
// paint, because dimming the whole grid just to scroll it would be absurd.
const panning = computed(() => brush.value.kind === 'pan')

function laneInert(voice: VoiceId): boolean {
  if (brush.value.kind === 'pan') return false
  if (brush.value.kind === 'sticking') return true
  if (brush.value.kind === 'erase') return false
  return stateForBrush(voice, brush.value.value) === null
}
const stickingInert = computed(() => brush.value.kind === 'state')

function paintNote(voice: VoiceId, i: number, val: number) {
  store.setCell(voice, i, val)
}
function paintSticking(i: number, val: Sticking) {
  store.setSticking(i, val)
}

function endStroke() {
  if (strokeLane.value === null) return
  strokeLane.value = null
  strokeLastStep = -1
  store.endStroke()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', endStroke)
  window.removeEventListener('pointercancel', endStroke)
}

function paintStep(lane: VoiceId | 'sticking', step: number) {
  if (lane === 'sticking') paintSticking(step, strokeValue as Sticking)
  else paintNote(lane, step, strokeValue as number)
}

function onPointerMove(e: PointerEvent) {
  const lane = strokeLane.value
  if (lane === null) return
  // Touch pointers get implicit capture on the origin element, so the event
  // target is useless mid-drag — resolve the cell under the finger by position.
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-cell]')
  if (!el) return
  const voice = el.dataset.voice
  const step = Number(el.dataset.step)
  if (voice !== lane || Number.isNaN(step) || step === strokeLastStep) return
  // pointermove is sampled, not continuous: a quick flick across sixteen cells
  // may only report four of them. Fill everything between the last painted step
  // and this one so a fast drag paints the same run as a slow one.
  const from = strokeLastStep < 0 ? step : strokeLastStep
  const dir = step > from ? 1 : -1
  for (let s = from + dir; s !== step + dir; s += dir) paintStep(lane, s)
  strokeLastStep = step
}

function beginStroke(lane: VoiceId | 'sticking', value: number | Sticking, step: number) {
  store.beginStroke()
  strokeLane.value = lane
  strokeValue = value
  strokeLastStep = step
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', endStroke)
  window.addEventListener('pointercancel', endStroke)
}

function onNotePointerDown(voice: VoiceId, i: number) {
  if (props.isPlaying) return
  const val = store.brushValueFor(voice, i)
  if (val === null) return
  // Open the stroke first: it snapshots history once, and every paint inside it
  // (including this origin cell) then collapses into that single undo step.
  beginStroke(voice, val, i)
  paintNote(voice, i, val)
}

function onStickingPointerDown(i: number) {
  if (props.isPlaying) return
  const val = store.brushStickingFor(i)
  if (val === null) return
  beginStroke('sticking', val, i)
  paintSticking(i, val)
}

// A click with `detail === 0` came from the keyboard, which never fires
// pointerdown. Everything else was already handled by the stroke above.
function onNoteClick(e: MouseEvent, voice: VoiceId, i: number) {
  if (e.detail !== 0 || props.isPlaying) return
  const val = store.brushValueFor(voice, i)
  if (val !== null) paintNote(voice, i, val)
}
function onStickingClick(e: MouseEvent, i: number) {
  if (e.detail !== 0 || props.isPlaying) return
  const val = store.brushStickingFor(i)
  if (val !== null) paintSticking(i, val)
}

onBeforeUnmount(endStroke)

const userWantsSticking = ref<boolean | null>(null)
const hasAnySticking = computed(() => groove.value.sticking.some((s) => s !== '-'))
const showSticking = computed(() => {
  // Picking a sticking brush reveals the row it paints — otherwise the button
  // would silently do nothing.
  if (brush.value.kind === 'sticking') return true
  return userWantsSticking.value !== null ? userWantsSticking.value : hasAnySticking.value
})

function toggleSticking() {
  userWantsSticking.value = !showSticking.value
}

// Live pad feedback: when playback is stopped and MIDI is connected, the
// step-0 cell of the matching lane lights up briefly so the user can verify
// pad → voice mapping by ear AND eye.
const LIVE_HIT_MS = 250
const recentlyHit = ref<Record<string, number>>({})
const showLiveMonitor = computed(() => midi.connected && !props.isPlaying)

watch(
  () => midi.lastHit,
  (h) => {
    if (!h) return
    const t = h.atMs
    recentlyHit.value = { ...recentlyHit.value, [h.voiceId]: t }
    setTimeout(() => {
      if (recentlyHit.value[h.voiceId] === t) {
        const next = { ...recentlyHit.value }
        delete next[h.voiceId]
        recentlyHit.value = next
      }
    }, LIVE_HIT_MS)
  },
)

function liveHitFor(voiceId: VoiceId, measure: number, localIdx: number): boolean {
  if (!showLiveMonitor.value) return false
  // The monitor only flashes column 0 of the currently-edited measure.
  if (measure !== selectedMeasure.value) return false
  if (localIdx !== 0) return false
  return recentlyHit.value[voiceId] !== undefined
}

const liveMarkerByCell = computed<Record<string, LiveMarkerGrade>>(() => {
  const out: Record<string, LiveMarkerGrade> = {}
  for (const m of midi.markers) {
    out[`${m.voiceId}-${m.step}`] = m.grade
  }
  return out
})

function liveMarkerFor(
  voiceId: VoiceId,
  measure: number,
  localIdx: number,
): LiveMarkerGrade | undefined {
  return liveMarkerByCell.value[`${voiceId}-${globalIdx(measure, localIdx)}`]
}

function isActive(measure: number, localIdx: number): boolean {
  return props.activeStep === globalIdx(measure, localIdx)
}

// Auto-scroll the stack so the currently-playing measure stays centered.
// Only fires on measure boundaries — scrolling on every step would fight the
// browser's smooth-scroll animation.
const stackHost = ref<HTMLElement | null>(null)
const measureRefs = ref<HTMLElement[]>([])
const activeMeasure = computed(() => {
  const s = props.activeStep ?? -1
  if (s < 0) return -1
  return Math.floor(s / stepsPerMeasure.value)
})

function repeatOf(m: number) {
  return repeatFor(groove.value, m)
}
// The bar that is sounding says which time through it is; the others just say
// how many times they will run.
function passLabel(m: number) {
  const total = repeatOf(m)
  const pass = props.activePass ?? 0
  if (m === activeMeasure.value && pass > 0) return `· ${pass}/${total}`
  return `×${total}`
}

function setMeasureRef(el: Element | null, idx: number) {
  if (el instanceof HTMLElement) measureRefs.value[idx] = el
}

watch(
  () => [props.isPlaying, activeMeasure.value] as const,
  ([playing, m], prev) => {
    if (!playing || m < 0) return
    if (prev && prev[1] === m && prev[0] === playing) return
    nextTick(() => {
      const el = measureRefs.value[m]
      const host = stackHost.value
      if (!el || !host) return
      const top = el.offsetTop - host.clientHeight / 2 + el.clientHeight / 2
      host.scrollTo({ top, behavior: 'smooth' })
    })
  },
)

// Follow the playhead horizontally too. At 24/32 divisions a bar is far wider
// than a phone, so without this the sounding column spends most of the loop
// off-screen. Instant (not smooth) so it cannot lag the beat, mirroring what
// Score.vue does for the staff.
function scrollActiveStepIntoView() {
  const host = stackHost.value
  const s = props.activeStep ?? -1
  if (!host || !props.isPlaying || s < 0) return
  const max = host.scrollWidth - host.clientWidth
  if (max <= 0) return
  const cell = host.querySelector<HTMLElement>(`[data-step="${s}"]`)
  if (!cell) return
  const hostBox = host.getBoundingClientRect()
  const cellBox = cell.getBoundingClientRect()
  const delta = cellBox.left + cellBox.width / 2 - (hostBox.left + hostBox.width / 2)
  host.scrollLeft = Math.max(0, Math.min(host.scrollLeft + delta, max))
}

watch(() => props.activeStep, scrollActiveStepIntoView)
watch(
  () => props.isPlaying,
  () => nextTick(scrollActiveStepIntoView),
)

// Edge gradients: the only cue a phone user gets that the bar continues past
// the right edge (touch scrollbars are invisible until you already scroll).
const atStart = ref(true)
const atEnd = ref(true)

function measureScroll() {
  const host = stackHost.value
  if (!host) return
  const max = host.scrollWidth - host.clientWidth
  atStart.value = host.scrollLeft <= 1
  atEnd.value = max <= 1 || host.scrollLeft >= max - 1
}

let edgeObserver: ResizeObserver | null = null
onMounted(() => {
  nextTick(measureScroll)
  const host = stackHost.value
  if (typeof ResizeObserver === 'undefined' || !host) return
  edgeObserver = new ResizeObserver(() => measureScroll())
  edgeObserver.observe(host)
  // The host can keep its size while the content inside it grows (a division
  // change, a lane toggled back on), which moves the right edge without ever
  // resizing the scroller.
  if (host.firstElementChild) edgeObserver.observe(host.firstElementChild)
})
onBeforeUnmount(() => edgeObserver?.disconnect())
watch([() => stepsPerMeasure.value, () => props.isPlaying, lanes], () => nextTick(measureScroll))
</script>

<template>
  <section class="panel" :class="panning && 'is-panning'" data-tour="grid">
    <div
      v-if="!props.isPlaying"
      class="flex flex-wrap items-center gap-2 px-3 pt-3"
      data-tour="measures"
    >
      <MeasureTabs />
      <PresetPicker class="ml-auto" />
    </div>

    <div class="scroll-shell">
      <div
        ref="stackHost"
        class="touch-scroll"
        :class="props.isPlaying ? 'play-stack' : 'overflow-x-auto'"
        @scroll="measureScroll"
      >
        <div
          v-for="(m, i) in visibleMeasures"
          :key="'measure-' + m"
          :ref="(el) => setMeasureRef(el as Element | null, i)"
          :class="[
            props.isPlaying ? 'play-stack__measure' : '',
            props.isPlaying && m === activeMeasure ? 'is-active' : '',
          ]"
        >
          <div
            v-if="props.isPlaying"
            class="px-3 pt-2 text-[10px] font-mono uppercase tracking-widest"
            :class="m === activeMeasure ? 'text-primary' : 'text-muted-foreground'"
          >
            Measure {{ m + 1 }}
            <span v-if="repeatOf(m) > 1" class="opacity-80">{{ passLabel(m) }}</span>
          </div>

          <div v-if="!showSticking && i === 0 && !props.isPlaying" class="px-3 pt-3">
            <button
              type="button"
              class="touch-target inline-flex items-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
              @click="toggleSticking"
            >
              + Sticking
            </button>
          </div>

          <div class="note-grid p-3" :class="!showSticking && 'pt-2'" :style="gridStyle">
            <template v-if="showSticking">
              <button
                type="button"
                class="pr-3 flex items-center text-[10px] font-mono tracking-wider text-primary hover:text-primary/70 transition-colors"
                :title="props.isPlaying ? 'Sticking' : 'Hide sticking'"
                :disabled="props.isPlaying"
                @click="toggleSticking"
              >
                STICKING
              </button>
              <NoteCell
                v-for="i2 in stepsPerMeasure"
                :key="'stk-' + m + '-' + (i2 - 1)"
                :value="0"
                kind="sticking"
                data-cell
                data-voice="sticking"
                :data-step="globalIdx(m, i2 - 1)"
                :inert-lane="stickingInert"
                :label="
                  groove.sticking[globalIdx(m, i2 - 1)] === '-'
                    ? ''
                    : groove.sticking[globalIdx(m, i2 - 1)]
                "
                :beat="isBeat(i2 - 1)"
                :downbeat="isDownbeat(i2 - 1)"
                :beat-start="i2 - 1 > 0 && isBeat(i2 - 1)"
                :active="isActive(m, i2 - 1)"
                @pointerdown="onStickingPointerDown(globalIdx(m, i2 - 1))"
                @click="onStickingClick($event, globalIdx(m, i2 - 1))"
              />
            </template>

            <template v-for="v in lanes" :key="v.key + '-m' + m">
              <div
                class="pr-3 flex items-center text-[10px] font-mono tracking-wider text-muted-foreground"
              >
                {{ v.label }}
              </div>
              <NoteCell
                v-for="i3 in stepsPerMeasure"
                :key="v.key + '-' + m + '-' + (i3 - 1)"
                :value="(groove.voices[v.key] ?? [])[globalIdx(m, i3 - 1)] ?? 0"
                :kind="v.kind"
                :voice-id="v.key"
                data-cell
                :data-voice="v.key"
                :data-step="globalIdx(m, i3 - 1)"
                :inert-lane="laneInert(v.key)"
                :beat="isBeat(i3 - 1)"
                :downbeat="isDownbeat(i3 - 1)"
                :beat-start="i3 - 1 > 0 && isBeat(i3 - 1)"
                :active="isActive(m, i3 - 1)"
                :live-hit="liveHitFor(v.key, m, i3 - 1)"
                :live-marker="liveMarkerFor(v.key, m, i3 - 1)"
                @pointerdown="onNotePointerDown(v.key, globalIdx(m, i3 - 1))"
                @click="onNoteClick($event, v.key, globalIdx(m, i3 - 1))"
              />
            </template>
          </div>
        </div>
      </div>

      <div v-show="!atStart" class="scroll-edge scroll-edge--left" aria-hidden="true" />
      <div v-show="!atEnd" class="scroll-edge scroll-edge--right" aria-hidden="true" />
    </div>

    <p class="border-t bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground">
      Pick a brush below, then tap a cell to paint it and tap again to clear. Drag along a lane to
      fill a run. Hi-hat: <span class="font-mono text-foreground">x</span> closed,
      <span class="font-mono text-foreground">o</span> open,
      <span class="font-mono text-warn">X</span> accent,
      <span class="font-mono text-foreground">f</span> foot. Snare / kick:
      <span class="font-mono text-foreground">●</span> normal,
      <span class="font-mono text-warn">◆</span> accent,
      <span class="font-mono text-foreground">○</span> ghost.
    </p>
  </section>
</template>

<style scoped>
.touch-scroll {
  -webkit-overflow-scrolling: touch;
  /* Keep a horizontal flick inside the grid instead of triggering the browser's
     back-swipe or rubber-banding the whole page. */
  overscroll-behavior-x: contain;
}
.play-stack {
  max-height: min(70vh, 720px);
  max-height: min(70svh, 720px);
  overflow-y: auto;
  /* Contain dense rows (24ths/32nds) on narrow screens instead of letting the
     grid blow out the panel width. */
  overflow-x: auto;
  /* No `scroll-behavior: smooth` here: the vertical measure follow passes
     `behavior: 'smooth'` explicitly, while the horizontal playhead follow sets
     scrollLeft directly and must land instantly to stay on the beat. */
}
.play-stack__measure + .play-stack__measure {
  border-top: 1px solid hsl(var(--border));
}
/* Highlight the bar that is currently sounding so the eye can follow the loop
   through the stack without hunting for the (subtler) label colour. */
.play-stack__measure.is-active {
  background: hsl(var(--primary) / 0.06);
  box-shadow: inset 3px 0 0 0 hsl(var(--primary) / 0.65);
}
</style>
