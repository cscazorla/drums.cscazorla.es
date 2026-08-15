<!--
  Groove, a drum-groove editor.
  Copyright (C) 2026 Fernando Guisso
  This program is free software under the GNU General Public License,
  version 3 or (at your option) any later version. See the LICENSE file.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<script setup lang="ts">
import { ref } from 'vue'
import { Sparkles } from 'lucide-vue-next'
import { useGrooveStore } from '@/stores/groove'
import { PRESETS, type Preset } from '@/lib/presets'

// The best interaction is the one that never happens. A preset fills the whole
// measure at once, which is the only thing that beats a drag.
const store = useGrooveStore()
const open = ref(false)
const note = ref<string | null>(null)
let noteTimer: number | undefined

function pick(p: Preset) {
  const dropped = store.applyPreset(p)
  open.value = false
  // A preset written in sixteenths cannot land on an eighths grid. Say so
  // instead of quietly dropping half the pattern.
  if (dropped > 0) {
    note.value = `${dropped} note${dropped === 1 ? '' : 's'} did not fit this division`
    window.clearTimeout(noteTimer)
    noteTimer = window.setTimeout(() => (note.value = null), 4000)
  }
}
</script>

<template>
  <div class="relative" data-tour="presets">
    <button
      type="button"
      class="touch-target inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      :aria-expanded="open"
      title="Fill this measure from a preset"
      @click="open = !open"
    >
      <Sparkles class="h-3.5 w-3.5" />
      Presets
    </button>

    <Transition name="preset-pop">
      <div v-if="open" class="preset-menu panel">
        <p class="px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-widest text-primary">
          Fill measure {{ store.selectedMeasure + 1 }}
        </p>
        <button v-for="p in PRESETS" :key="p.id" type="button" class="preset-item" @click="pick(p)">
          <span class="preset-item__label">{{ p.label }}</span>
          <span class="preset-item__hint">{{ p.hint }}</span>
        </button>
      </div>
    </Transition>

    <!-- Click-away. Behind the menu, in front of everything else. -->
    <div v-if="open" class="fixed inset-0 z-30" @click="open = false" />

    <Transition name="preset-pop">
      <p
        v-if="note"
        class="absolute left-0 top-full mt-1 whitespace-nowrap rounded bg-warn/15 px-2 py-1 text-[10px] text-warn"
      >
        {{ note }}
      </p>
    </Transition>
  </div>
</template>

<style scoped>
.preset-menu {
  position: absolute;
  left: 0;
  top: calc(100% + 0.35rem);
  z-index: 40;
  min-width: 15rem;
  max-width: min(20rem, calc(100vw - 2rem));
  padding-bottom: 0.35rem;
  background: hsl(var(--popover));
  box-shadow: 0 16px 40px -12px hsl(220 40% 2% / 0.5);
}
.preset-item {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
  transition: background 120ms ease-out;
}
.preset-item:hover {
  background: hsl(var(--primary) / 0.1);
}
.preset-item__label {
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--foreground));
}
.preset-item__hint {
  font-size: 10px;
  line-height: 1.35;
  color: hsl(var(--muted-foreground));
}
@media (pointer: coarse) {
  .preset-item {
    padding: 0.7rem 0.75rem;
  }
}

.preset-pop-enter-active,
.preset-pop-leave-active {
  transition:
    opacity 120ms ease-out,
    transform 120ms ease-out;
}
.preset-pop-enter-from,
.preset-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
