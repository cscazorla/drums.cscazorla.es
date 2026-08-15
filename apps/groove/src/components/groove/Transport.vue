<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  Play,
  Square,
  Repeat,
  Timer,
  Waves,
  Hourglass,
  SlidersHorizontal,
  Gauge,
} from 'lucide-vue-next'
import { useGrooveStore } from '@/stores/groove'
import { usePracticeTimerStore } from '@/stores/practiceTimer'
import { useMidiStore } from '@/stores/midi'
import { useSpeedTrainerStore } from '@/stores/speedTrainer'
import Slider from '@/components/ui/Slider.vue'
import Switch from '@/components/ui/Switch.vue'
import MetronomeIcon from '@/components/icons/MetronomeIcon.vue'

const props = defineProps<{
  isPlaying: boolean
  readOnly?: boolean
}>()
const emit = defineEmits<{ (e: 'play'): void; (e: 'stop'): void }>()

const store = useGrooveStore()
const { groove } = storeToRefs(store)
const timerStore = usePracticeTimerStore()
const { enabled: timerEnabled, minutes: timerMinutes } = storeToRefs(timerStore)
const midi = useMidiStore()
const { practiceMode, practiceTimerSec } = storeToRefs(midi)
const speed = useSpeedTrainerStore()
const {
  enabled: speedEnabled,
  everyLoops: speedEvery,
  stepBpm: speedStep,
  targetBpm: speedTarget,
} = storeToRefs(speed)

// Mobile collapses the secondary toggles behind an "Options" disclosure to keep
// the transport short; desktop (md+) always shows them inline.
const optionsOpen = ref(false)
const optionsEl = ref<HTMLElement | null>(null)

// The bottom brush bar is sticky and roughly 180px tall on a phone, so opening
// Options in the middle of a scrolled page can reveal it straight underneath
// the bar. `scroll-margin-bottom` on the panel tells the browser how much room
// to leave; doing the arithmetic by hand here was fragile and silently wrong.
function toggleOptions() {
  optionsOpen.value = !optionsOpen.value
  if (!optionsOpen.value) return
  nextTick(() => {
    const el = optionsEl.value
    if (!el) return
    // The panel just went from `display: none` to `flex`. Read a layout
    // property first: without it the browser can still be holding the stale
    // (zero-sized) box and decides no scrolling is needed.
    void el.offsetHeight
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

// Auto-disable the timer if the user turns loop off — without a loop the timer
// has nothing useful to bound, and leaving it visually "on" would mislead.
watch(
  () => groove.value.loop,
  (loopOn) => {
    if (!loopOn && timerEnabled.value) timerStore.setEnabled(false)
  },
)

function onToggleTimer(v: boolean) {
  if (v && !groove.value.loop) return
  timerStore.setEnabled(v)
}

function onMinutesInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  timerStore.setMinutes(v)
}

function onPauseSecInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  midi.setPracticeTimerSec(v)
}
</script>

<template>
  <section class="panel flex flex-wrap items-center gap-x-5 gap-y-3 p-3" data-tour="transport">
    <!-- Play and the tempo readout live in the bottom bar on a phone, inside the
         thumb's reach. Rendering them here too would be a duplicate control. -->
    <button
      v-if="!props.isPlaying"
      type="button"
      class="transport-play hidden md:inline-flex"
      aria-label="Play"
      @click="emit('play')"
    >
      <Play class="h-5 w-5 translate-x-0.5" :stroke-width="2.5" />
    </button>
    <button
      v-else
      type="button"
      class="transport-play playing hidden md:inline-flex"
      aria-label="Stop"
      @click="emit('stop')"
    >
      <Square class="h-4 w-4" :stroke-width="2.5" fill="currentColor" />
    </button>

    <div class="hidden md:flex items-baseline gap-1 px-1">
      <span class="tempo-display text-4xl">{{ groove.tempo }}</span>
      <span class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">bpm</span>
    </div>

    <!-- Loop carries its own word, not just the icon: the label is most of the
         click target, and it is the toggle people reach for constantly. -->
    <button
      v-if="!props.readOnly"
      type="button"
      class="loop-btn touch-target"
      :class="{ 'is-on': groove.loop }"
      :aria-pressed="groove.loop"
      :title="
        groove.loop ? 'Loop is on, click to play once through' : 'Loop the groove continuously'
      "
      @click="store.toggleLoop()"
    >
      <Repeat class="h-3.5 w-3.5" />
      <span>Loop</span>
    </button>

    <div class="hidden sm:block h-8 w-px bg-border" />

    <!-- Options sits beside Loop on the first row. Left to flex-wrap with
         `ml-auto`, it landed wherever the sliders happened to break, which read
         as a stray button in the middle of the panel. -->
    <button
      type="button"
      class="touch-target md:hidden ml-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      :aria-expanded="optionsOpen"
      @click="toggleOptions"
    >
      <SlidersHorizontal class="h-3.5 w-3.5" />
      Options
    </button>

    <div class="basis-full md:basis-auto flex items-center gap-2 min-w-[160px] md:flex-1">
      <label class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground w-14"
        >Tempo</label
      >
      <Slider
        :model-value="groove.tempo"
        :min="40"
        :max="260"
        :step="1"
        @update:model-value="store.setTempo($event)"
      />
    </div>

    <div
      v-if="!props.readOnly"
      class="basis-full md:basis-auto flex items-center gap-2 min-w-[150px] md:flex-1"
    >
      <label class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground w-14"
        >Swing</label
      >
      <Slider
        :model-value="groove.swing"
        :min="0"
        :max="80"
        :step="1"
        @update:model-value="store.setSwing($event)"
      />
      <span class="font-mono tabular text-xs text-muted-foreground w-8 text-right"
        >{{ groove.swing }}%</span
      >
    </div>

    <!-- Practice options. Below `md` these stack one per row, name on the left
         and controls on the right, because five multi-input toggles sharing a
         wrapping flex row read as a pile of loose numbers on a phone. -->
    <div
      ref="optionsEl"
      class="opt-group basis-full md:basis-auto md:ml-auto flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3 md:border-t-0 md:pt-0"
      :class="optionsOpen ? 'flex' : 'hidden md:flex'"
      data-tour="playback-options"
    >
      <!-- Speed training: raise the tempo every N loops up to a target. -->
      <label
        v-if="!props.readOnly"
        class="opt opt--wide"
        title="Speed training: add N BPM every M loops until the target tempo"
      >
        <span class="opt__name">
          <Gauge class="h-3.5 w-3.5" />
          <span>Speed</span>
        </span>
        <span class="opt__ctl">
          <Switch :model-value="speedEnabled" @update:model-value="speed.setEnabled($event)" />
          <span class="opt__unit">+</span>
          <input
            type="number"
            min="1"
            max="40"
            step="1"
            inputmode="numeric"
            aria-label="Speed training, BPM added each time"
            class="opt__num"
            :value="speedStep"
            @input="speed.setStepBpm(Number(($event.target as HTMLInputElement).value))"
          />
          <span class="opt__unit">bpm every</span>
          <input
            type="number"
            min="1"
            max="32"
            step="1"
            inputmode="numeric"
            aria-label="Speed training, loops between increases"
            class="opt__num"
            :value="speedEvery"
            @input="speed.setEveryLoops(Number(($event.target as HTMLInputElement).value))"
          />
          <span class="opt__unit">loops, to</span>
          <input
            type="number"
            min="40"
            max="260"
            step="1"
            inputmode="numeric"
            aria-label="Speed training, target tempo"
            class="opt__num opt__num--wide"
            :value="speedTarget"
            @input="speed.setTargetBpm(Number(($event.target as HTMLInputElement).value))"
          />
        </span>
      </label>

      <!-- Pause between loops: a silent review window before the loop repeats.
           A general player option now (not buried in MIDI settings, not gated on
           the loop toggle); it simply takes effect whenever a loop is running. -->
      <label
        class="opt"
        :title="
          practiceMode
            ? `Pause between loops: on (${practiceTimerSec}s review), a silent countdown before the loop repeats`
            : 'Pause between loops: off. Adds a silent review gap before each loop repeats'
        "
      >
        <span class="opt__name">
          <Hourglass class="h-3.5 w-3.5" />
          <span>Pause</span>
        </span>
        <span class="opt__ctl">
          <Switch :model-value="practiceMode" @update:model-value="midi.setPracticeMode($event)" />
          <input
            type="number"
            min="1"
            max="60"
            step="1"
            inputmode="numeric"
            aria-label="Pause between loops, seconds"
            class="opt__num"
            :value="practiceTimerSec"
            @input="onPauseSecInput"
          />
          <span class="opt__unit">s</span>
        </span>
      </label>

      <label
        class="opt"
        :class="!groove.loop && 'is-disabled'"
        :title="
          !groove.loop
            ? 'Practice timer: enable loop first'
            : timerEnabled
              ? `Practice timer: on (${timerMinutes} min), click to disable`
              : 'Practice timer: off. Auto-stops playback after N minutes'
        "
      >
        <span class="opt__name">
          <Timer class="h-3.5 w-3.5" />
          <span>Timer</span>
        </span>
        <span class="opt__ctl">
          <Switch :model-value="timerEnabled" @update:model-value="onToggleTimer($event)" />
          <input
            type="number"
            min="1"
            max="60"
            step="1"
            inputmode="numeric"
            aria-label="Practice timer minutes"
            class="opt__num"
            :value="timerMinutes"
            @input="onMinutesInput"
          />
          <span class="opt__unit">min</span>
        </span>
      </label>

      <label
        v-if="!props.readOnly"
        class="opt"
        :title="
          groove.metronome
            ? 'Metronome: on, click to silence'
            : 'Metronome: off. Clicks beats during playback'
        "
      >
        <span class="opt__name">
          <MetronomeIcon class="h-3.5 w-3.5" />
          <span>Metro</span>
        </span>
        <span class="opt__ctl">
          <Switch :model-value="groove.metronome" @update:model-value="store.toggleMetronome()" />
        </span>
      </label>

      <label
        v-if="!props.readOnly"
        class="opt"
        :title="
          groove.countIn
            ? 'Count-in: on, click to disable the lead-in bar'
            : 'Count-in: off. Plays a bar of clicks before starting'
        "
      >
        <span class="opt__name">
          <Waves class="h-3.5 w-3.5" />
          <span>Count-in</span>
        </span>
        <span class="opt__ctl">
          <Switch :model-value="groove.countIn" @update:model-value="store.toggleCountIn()" />
        </span>
      </label>
    </div>
  </section>
</template>

<style scoped>
.loop-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 34px;
  padding: 0 0.7rem;
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 0.2rem);
  background: transparent;
  color: hsl(var(--muted-foreground));
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition:
    color 120ms ease-out,
    background 120ms ease-out,
    border-color 120ms ease-out;
}
.loop-btn:hover:not(.is-on) {
  color: hsl(var(--foreground));
  border-color: hsl(var(--primary) / 0.5);
}
.loop-btn.is-on {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-color: hsl(var(--primary));
}

.opt-group {
  /* Room for the sticky brush bar underneath, so scrollIntoView does not park
     the panel behind it. Generous on purpose: overshooting costs nothing. */
  scroll-margin-bottom: 220px;
}

.opt {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
}
.opt.is-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.opt__name {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}
.opt__ctl {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}
.opt__unit {
  font-size: 10px;
  text-transform: lowercase;
  letter-spacing: 0;
  white-space: nowrap;
}
.opt__num {
  width: 2.5rem;
  padding: 0.125rem 0.25rem;
  font-family: inherit;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: hsl(var(--foreground));
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 0.25rem;
  touch-action: manipulation;
  /* Kill the number spinner. It is unhittable with a thumb and it steals about
     15px from the field, which was clipping "140" to "14". */
  appearance: textfield;
  -moz-appearance: textfield;
}
.opt__num::-webkit-outer-spin-button,
.opt__num::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.opt__num--wide {
  width: 3rem;
}
.opt__num:focus {
  outline: none;
  box-shadow: 0 0 0 1px hsl(var(--primary) / 0.6);
}

/* One option per row on a phone: name pinned left, controls pinned right. In a
   shared wrapping flex row these five toggles broke wherever they happened to
   fit, which read as a pile of loose numbers rather than a settings list. */
@media (max-width: 767px) {
  .opt-group {
    flex-direction: column;
    align-items: stretch;
    gap: 0;
  }
  .opt {
    justify-content: space-between;
    width: 100%;
    min-height: 44px;
    padding: 0.25rem 0;
    border-bottom: 1px solid hsl(var(--border) / 0.5);
  }
  .opt:last-child {
    border-bottom: 0;
  }
  /* Speed has three inputs and cannot share a line with its own name. */
  .opt--wide {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.4rem;
    padding: 0.5rem 0;
  }
  /* Speed's controls are a sentence, not a pair: they need the full width and
     permission to wrap, which the shrink-proofing below would otherwise deny. */
  .opt--wide .opt__ctl {
    flex-wrap: wrap;
    flex-shrink: 1;
    width: 100%;
  }
  .opt__num {
    min-height: 34px;
  }
  /* Claw back the last few px so "s" and "min" are not flush with the edge. */
  .opt {
    letter-spacing: 0.06em;
  }
  .opt__ctl {
    gap: 0.25rem;
  }
  /* The name yields first when a row is tight; the controls must stay whole. */
  .opt__name {
    min-width: 0;
  }
  .opt__ctl {
    flex-shrink: 0;
  }
}
</style>
