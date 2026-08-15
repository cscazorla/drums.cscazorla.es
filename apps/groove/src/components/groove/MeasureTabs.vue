<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Plus, ChevronLeft, ChevronRight, Minus, Repeat } from 'lucide-vue-next'
import { useGrooveStore } from '@/stores/groove'
import { MAX_REPEAT } from '@/lib/model'
import { repeatFor } from '@/lib/playback-order'

const MAX_MEASURES = 8

const store = useGrooveStore()
const { groove, selectedMeasure } = storeToRefs(store)

const tabs = computed(() => Array.from({ length: groove.value.measures }, (_, i) => i))
const canAdd = computed(() => groove.value.measures < MAX_MEASURES)
const canPrev = computed(() => selectedMeasure.value > 0)
const canNext = computed(() => selectedMeasure.value < groove.value.measures - 1)

const repeat = computed(() => repeatFor(groove.value, selectedMeasure.value))
function bumpRepeat(delta: number) {
  store.setRepeat(selectedMeasure.value, repeat.value + delta)
}
function repeatOf(m: number) {
  return repeatFor(groove.value, m)
}

function addMeasure() {
  if (!canAdd.value) return
  const next = groove.value.measures + 1
  store.setMeasures(next)
  store.setSelectedMeasure(next - 1)
}

function step(delta: number) {
  store.setSelectedMeasure(selectedMeasure.value + delta)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <span
      class="hidden sm:inline text-[10px] font-mono uppercase tracking-widest text-muted-foreground pr-2"
    >
      Measures
    </span>

    <!-- Paging arrows. Numbered tabs are fine with a mouse and fiddly with a
         thumb, especially once eight of them wrap onto two rows. -->
    <button
      type="button"
      class="measure-tab measure-tab--page"
      :disabled="!canPrev"
      aria-label="Previous measure"
      title="Previous measure"
      @click="step(-1)"
    >
      <ChevronLeft class="h-4 w-4" :stroke-width="2.5" />
    </button>
    <button
      v-for="m in tabs"
      :key="m"
      type="button"
      class="measure-tab"
      :class="{ 'is-active': m === selectedMeasure }"
      @click="store.setSelectedMeasure(m)"
    >
      {{ m + 1 }}
      <span v-if="repeatOf(m) > 1" class="measure-tab__repeat">×{{ repeatOf(m) }}</span>
    </button>
    <button
      type="button"
      class="measure-tab measure-tab--page"
      :disabled="!canNext"
      aria-label="Next measure"
      title="Next measure"
      @click="step(1)"
    >
      <ChevronRight class="h-4 w-4" :stroke-width="2.5" />
    </button>

    <button
      type="button"
      class="measure-tab measure-tab--add"
      :disabled="!canAdd"
      :title="canAdd ? 'Add measure' : `Max ${MAX_MEASURES} measures`"
      aria-label="Add measure"
      @click="addMeasure"
    >
      <Plus class="h-3 w-3" :stroke-width="2.5" />
    </button>

    <!-- Repeat count for the selected bar. Sits with the tabs because it is the
         same question they answer: which bar am I working on, and how does it
         sit in the piece. -->
    <div class="repeat-group" data-tour="repeat">
      <Repeat class="h-3.5 w-3.5 text-muted-foreground" :stroke-width="2" />
      <span class="hidden sm:inline text-[10px] font-mono uppercase tracking-widest">Repeat</span>
      <button
        type="button"
        class="measure-tab"
        :disabled="repeat <= 1"
        :aria-label="`Repeat measure ${selectedMeasure + 1} one time less`"
        title="Repeat less"
        @click="bumpRepeat(-1)"
      >
        <Minus class="h-3 w-3" :stroke-width="2.5" />
      </button>
      <span class="repeat-value tabular">×{{ repeat }}</span>
      <button
        type="button"
        class="measure-tab"
        :disabled="repeat >= MAX_REPEAT"
        :aria-label="`Repeat measure ${selectedMeasure + 1} one time more`"
        title="Repeat more"
        @click="bumpRepeat(1)"
      >
        <Plus class="h-3 w-3" :stroke-width="2.5" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.measure-tab {
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  background: transparent;
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  cursor: pointer;
  transition:
    color 120ms ease-out,
    background 120ms ease-out,
    border-color 120ms ease-out;
}
.measure-tab:hover:not(:disabled) {
  color: hsl(var(--foreground));
  border-color: hsl(var(--primary) / 0.5);
}
.measure-tab.is-active {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-color: hsl(var(--primary));
}
.measure-tab__repeat {
  margin-left: 3px;
  font-size: 9px;
  opacity: 0.75;
}
.measure-tab--add {
  color: hsl(var(--muted-foreground));
}
.measure-tab:disabled,
.measure-tab--add:disabled,
.measure-tab--page:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.repeat-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 6px;
  padding-left: 8px;
  border-left: 1px solid hsl(var(--border));
  color: hsl(var(--muted-foreground));
}
.repeat-value {
  min-width: 26px;
  text-align: center;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  font-weight: 600;
  color: hsl(var(--foreground));
}
.measure-tab--page {
  color: hsl(var(--foreground));
}
@media (pointer: coarse) {
  .measure-tab {
    min-width: 44px;
    height: 44px;
    font-size: 13px;
  }
}
</style>
