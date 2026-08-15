<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { Github, Share2, Trash2, Settings, HelpCircle, GraduationCap } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import GrooveLogo from '@/components/shell/GrooveLogo.vue'
import { useGrooveStore } from '@/stores/groove'
import { useMidiStore } from '@/stores/midi'
import { useTour } from '@/composables/useTour'

defineEmits<{
  (e: 'share'): void
}>()

const { startTour } = useTour()

const store = useGrooveStore()
const { groove } = storeToRefs(store)
const midi = useMidiStore()
const { connected: midiConnected, lessonMode } = storeToRefs(midi)

function onClear() {
  const hasAny =
    Object.values(groove.value.voices).some((arr) => arr?.some((v) => v !== 0)) ||
    groove.value.sticking.some((s) => s !== '-')
  if (!hasAny) return
  if (window.confirm('Clear all notes from this groove? This cannot be undone.')) {
    store.clearAll()
  }
}
</script>

<template>
  <header class="app-toolbar sticky top-0 z-20 flex flex-wrap items-center gap-3 px-4 py-2.5">
    <a
      href="#/"
      class="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
      aria-label="Go home"
    >
      <GrooveLogo :width="84" />
      <span
        class="hidden sm:inline text-[10px] font-mono uppercase tracking-widest text-muted-foreground border border-border rounded px-1.5 py-0.5"
      >
        v0.2
      </span>
    </a>

    <div class="flex-1 flex flex-wrap items-center gap-2 min-w-[200px]" data-tour="naming">
      <Input
        class="max-w-[240px]"
        placeholder="Untitled groove"
        :model-value="groove.title"
        @update:model-value="store.setTitle(String($event))"
      />
      <Input
        class="max-w-[180px]"
        placeholder="Author"
        :model-value="groove.author"
        @update:model-value="store.setAuthor(String($event))"
      />
    </div>

    <div class="flex items-center gap-1.5">
      <a
        href="https://github.com/fguisso/groove"
        target="_blank"
        rel="noopener"
        class="touch-target inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="View source on GitHub"
        aria-label="View source on GitHub"
      >
        <Github class="h-3.5 w-3.5" />
      </a>
      <button
        type="button"
        class="touch-target inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="Take the guided tour"
        aria-label="Take the guided tour"
        data-tour="help"
        @click="startTour"
      >
        <HelpCircle class="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        class="touch-target inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors"
        :class="
          lessonMode
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        "
        :title="
          lessonMode
            ? 'Lesson mode is on: grid and brush only. Click to bring back the staff and the practice tools.'
            : 'Lesson mode: hide the staff and the practice tools, leaving the grid, the brush and Play'
        "
        aria-label="Toggle lesson mode"
        :aria-pressed="lessonMode"
        data-tour="lesson"
        @click="midi.setLessonMode(!lessonMode)"
      >
        <GraduationCap class="h-3.5 w-3.5" />
      </button>
      <Button
        variant="ghost"
        size="sm"
        title="Clear all notes — asks for confirmation"
        @click="onClear"
      >
        <Trash2 class="h-3.5 w-3.5" /> Clear
      </Button>
      <Button
        variant="outline"
        size="sm"
        :title="midiConnected ? 'Settings (MIDI connected)' : 'Settings'"
        class="relative"
        data-tour="settings"
        @click="midi.togglePanel()"
      >
        <Settings class="h-3.5 w-3.5" /> Settings
        <span
          v-if="midiConnected"
          class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]"
          aria-hidden="true"
        />
      </Button>
      <Button size="sm" data-tour="share" @click="$emit('share')">
        <Share2 class="h-3.5 w-3.5" /> Share
      </Button>
    </div>
  </header>
</template>
