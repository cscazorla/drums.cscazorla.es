<!--
  Groove, a drum-groove editor.
  Copyright (C) 2026 Fernando Guisso
  This program is free software under the GNU General Public License,
  version 3 or (at your option) any later version. See the LICENSE file.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Eraser, Undo2, Redo2, Play, Square, Minus, Plus, Hand } from 'lucide-vue-next'
import { useGrooveStore } from '@/stores/groove'
import { useMidiStore } from '@/stores/midi'
import { BRUSHES, voicesForBrush, VOICE_BY_ID, type BrushState } from '@/lib/voices'

// The bottom bar. Two jobs, both about the thumb:
//   1. Hold the brush. Picking a value and applying it are separate acts, which
//      is what replaces cycling six states inside a fingertip-sized cell.
//   2. On a phone, carry Play and the tempo, which otherwise sit at the top of
//      a scrolled page far out of reach.
const props = defineProps<{ isPlaying?: boolean }>()
const emit = defineEmits<{ (e: 'play'): void; (e: 'stop'): void }>()

const store = useGrooveStore()
const { groove, brush, canUndo, canRedo } = storeToRefs(store)
const { lessonMode } = storeToRefs(useMidiStore())

const TEMPO_NUDGE = 5

const STICKINGS = ['R', 'L', 'B'] as const

function isState(id: BrushState) {
  return brush.value.kind === 'state' && brush.value.value === id
}
function isSticking(v: (typeof STICKINGS)[number]) {
  return brush.value.kind === 'sticking' && brush.value.value === v
}

// "Open" and "Pedal" only exist on the hi-hat. Rather than hide them, say which
// lanes they reach so a tap that does nothing is never a surprise.
const scope = computed<Record<BrushState, string>>(() => {
  const out = {} as Record<BrushState, string>
  for (const b of BRUSHES) {
    const ids = voicesForBrush(b.id)
    out[b.id] =
      ids.length >= 6
        ? 'all lanes'
        : ids.map((id) => VOICE_BY_ID[id].label.toLowerCase()).join(', ')
  }
  return out
})
</script>

<template>
  <section class="state-bar panel" data-tour="state-bar">
    <!-- Thumb-zone transport. Phone only: on md+ the real transport panel is
         already on screen and a second Play would be clutter. Lesson mode hides
         that panel entirely, so there this row is the only transport there is. -->
    <div
      class="flex items-center gap-2 px-2 py-2"
      :class="[lessonMode ? '' : 'md:hidden', !props.isPlaying && 'border-b border-border/60']"
    >
      <button
        v-if="!props.isPlaying"
        type="button"
        class="transport-play shrink-0"
        aria-label="Play"
        @click="emit('play')"
      >
        <Play class="h-5 w-5 translate-x-0.5" :stroke-width="2.5" />
      </button>
      <button
        v-else
        type="button"
        class="transport-play playing shrink-0"
        aria-label="Stop"
        @click="emit('stop')"
      >
        <Square class="h-4 w-4" :stroke-width="2.5" fill="currentColor" />
      </button>

      <button
        type="button"
        class="brush shrink-0"
        aria-label="Slower"
        :disabled="groove.tempo <= 40"
        @click="store.setTempo(groove.tempo - TEMPO_NUDGE)"
      >
        <Minus class="h-4 w-4" />
      </button>
      <div class="flex items-baseline gap-1">
        <span class="tempo-display text-2xl">{{ groove.tempo }}</span>
        <span class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          bpm
        </span>
      </div>
      <button
        type="button"
        class="brush shrink-0"
        aria-label="Faster"
        :disabled="groove.tempo >= 260"
        @click="store.setTempo(groove.tempo + TEMPO_NUDGE)"
      >
        <Plus class="h-4 w-4" />
      </button>

      <div class="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          class="brush"
          :disabled="!canUndo"
          title="Undo"
          aria-label="Undo"
          @click="store.undo()"
        >
          <Undo2 class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="brush"
          :disabled="!canRedo"
          title="Redo"
          aria-label="Redo"
          @click="store.redo()"
        >
          <Redo2 class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div v-if="!props.isPlaying" class="flex flex-wrap items-center gap-x-4 gap-y-2 p-2">
      <div class="brush-row flex flex-wrap items-center">
        <button
          v-for="b in BRUSHES"
          :key="b.id"
          type="button"
          class="brush"
          :class="{ 'is-active': isState(b.id) }"
          :title="`${b.label} — paints ${scope[b.id]}`"
          :aria-pressed="isState(b.id)"
          @click="store.setBrush({ kind: 'state', value: b.id })"
        >
          <span class="brush__glyph">{{ b.symbol }}</span>
          <span class="brush__label">{{ b.label }}</span>
        </button>

        <button
          type="button"
          class="brush brush--erase"
          :class="{ 'is-active': brush.kind === 'erase' }"
          title="Eraser: clears any cell, notes or sticking"
          :aria-pressed="brush.kind === 'erase'"
          @click="store.setBrush({ kind: 'erase' })"
        >
          <Eraser class="h-4 w-4" />
          <span class="brush__label">Erase</span>
        </button>

        <!-- Not a brush at all: it turns painting off so a finger drag scrolls
             the grid sideways again. Dragging cannot mean two things at once. -->
        <button
          type="button"
          class="brush brush--pan"
          :class="{ 'is-active': brush.kind === 'pan' }"
          title="Scroll: stop painting so you can drag the grid sideways"
          :aria-pressed="brush.kind === 'pan'"
          @click="store.setBrush({ kind: 'pan' })"
        >
          <Hand class="h-4 w-4" />
          <span class="brush__label">Scroll</span>
        </button>
      </div>

      <div class="hidden sm:block h-7 w-px bg-border" />

      <div class="flex items-center gap-1.5">
        <span class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground pr-0.5">
          Stick
        </span>
        <button
          v-for="s in STICKINGS"
          :key="s"
          type="button"
          class="brush brush--stick"
          :class="{ 'is-active': isSticking(s) }"
          :title="`Sticking ${s} — paints the sticking row`"
          :aria-pressed="isSticking(s)"
          @click="store.setBrush({ kind: 'sticking', value: s })"
        >
          {{ s }}
        </button>
      </div>

      <!-- Undo/redo ride in the transport row on a phone, so this copy is for
           md+ only, where there is no transport row. -->
      <div class="ml-auto hidden md:flex items-center gap-1.5">
        <button
          type="button"
          class="brush brush--history"
          :disabled="!canUndo"
          title="Undo"
          aria-label="Undo"
          @click="store.undo()"
        >
          <Undo2 class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="brush brush--history"
          :disabled="!canRedo"
          title="Redo"
          aria-label="Redo"
          @click="store.redo()"
        >
          <Redo2 class="h-4 w-4" />
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.state-bar {
  position: sticky;
  bottom: 0;
  z-index: 20;
  background: hsl(var(--card) / 0.92);
  backdrop-filter: blur(8px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.brush {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  height: 34px;
  min-width: 34px;
  padding: 0 0.55rem;
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 0.2rem);
  background: transparent;
  color: hsl(var(--muted-foreground));
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 120ms ease-out,
    background 120ms ease-out,
    border-color 120ms ease-out;
}
.brush:hover:not(:disabled):not(.is-active) {
  color: hsl(var(--foreground));
  border-color: hsl(var(--primary) / 0.5);
}
.brush:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
/* The active brush has to read at a glance — the user must know what is in
   their hand without stopping to think. Deliberately loud, not subtle. */
.brush.is-active {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-color: hsl(var(--primary));
  box-shadow:
    0 0 0 1px hsl(var(--primary) / 0.4),
    0 0 12px -2px hsl(var(--led-shadow) / 0.7);
}
.brush--erase.is-active {
  background: hsl(var(--destructive));
  border-color: hsl(var(--destructive));
  color: hsl(var(--destructive-foreground));
  box-shadow: 0 0 12px -2px hsl(var(--destructive) / 0.6);
}
.brush__glyph {
  font-size: 13px;
  line-height: 1;
}

.brush-row {
  gap: 0.375rem;
}

/* Labels always show. Hiding them on a narrow screen left a row of bare glyphs
   with no way to find out what they meant: a tooltip needs a hover, and a
   finger has none. Below 520px the button stacks instead, glyph over word, so
   the name survives without eating the row's width. */
@media (max-width: 519px) {
  /* Seven 44px buttons plus six 6px gaps overflow a 390px screen by a hair and
     wrap the last one onto a row of its own. 4px gets them all on one line. */
  .brush-row {
    gap: 4px;
  }
  .brush {
    flex-direction: column;
    gap: 0.1rem;
    height: 46px;
    padding: 0 0.3rem;
    line-height: 1.1;
  }
  .brush__label {
    font-size: 8px;
    letter-spacing: 0.02em;
  }
  /* Icon-only controls (undo, redo, tempo nudges) have no label to stack. */
  .brush--history,
  .brush--stick {
    flex-direction: row;
  }
}

@media (pointer: coarse) {
  .brush {
    min-height: 44px;
    min-width: 44px;
  }
}
</style>
