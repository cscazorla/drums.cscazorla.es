<!--
  Groove, a drum-groove editor.
  Copyright (C) 2026 Fernando Guisso
  This program is free software under the GNU General Public License,
  version 3 or (at your option) any later version. See the LICENSE file.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { VolumeX, X } from 'lucide-vue-next'

// The single most common "the app is broken" report on iPhone: the hardware
// side switch silences Web Audio (unlike an <audio> element), so playback runs
// with a moving playhead and no sound. There is no API to detect it, so the
// honest fix is to say it once, the first time the user presses play.
const props = defineProps<{
  isPlaying: boolean
  // Play ran and the audio context still would not start. Different problem
  // from silent mode, and it needs a different sentence.
  blocked?: boolean
  // The context's own word for what went wrong, shown so a bug report can say
  // something more useful than "no sound".
  state?: string
}>()

const KEY = 'groove:audioHintSeen'
const VISIBLE_MS = 12_000

// iPhone and iPad both silence Web Audio in silent mode, but they silence it
// with different controls, so the advice has to differ too. iPads have not had
// a side switch for years; theirs is the bell in Control Centre.
type Device = 'iphone' | 'ipad' | null

function iosDevice(): Device {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  if (/iPhone|iPod/.test(ua)) return 'iphone'
  if (/iPad/.test(ua)) return 'ipad'
  // iPadOS reports itself as a Mac; the touch points give it away.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ipad'
  return null
}

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true
  }
}

function markSeen() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // Private mode — the hint simply shows again next session.
  }
}

const show = ref(false)
const device = ref<Device>(null)
let timer: number | undefined

const message = computed(() => {
  if (props.blocked) {
    return `Audio would not start (${props.state ?? 'unknown'}). Safari sometimes wedges it after the app has been in the background. Reload the page to get sound back.`
  }
  return device.value === 'ipad'
    ? 'No sound? Silent mode mutes web audio too. Open Control Centre and turn the bell on.'
    : "No sound? The iPhone's side silent switch mutes web audio too. Flip it off and turn the volume up."
})

function dismiss() {
  show.value = false
  window.clearTimeout(timer)
}

function reload() {
  window.location.reload()
}

watch(
  () => props.isPlaying,
  (playing) => {
    if (!playing || show.value) return
    const d = iosDevice()
    if (!d || alreadySeen()) return
    device.value = d
    markSeen()
    show.value = true
    timer = window.setTimeout(dismiss, VISIBLE_MS)
  },
)

// A blocked context is not a "you might have muted it" hint, it is a failure.
// It stays until dismissed and is never suppressed by the seen-once flag.
watch(
  () => props.blocked,
  (isBlocked) => {
    if (!isBlocked) return
    device.value = iosDevice()
    show.value = true
    window.clearTimeout(timer)
  },
)

onBeforeUnmount(() => window.clearTimeout(timer))
</script>

<template>
  <Transition name="hint-fade">
    <div v-if="show" class="audio-hint">
      <VolumeX
        class="h-4 w-4 shrink-0"
        :class="props.blocked ? 'text-destructive' : 'text-warn'"
        :stroke-width="2"
      />
      <div class="flex-1">
        <p class="leading-snug">{{ message }}</p>
        <button
          v-if="props.blocked"
          type="button"
          class="mt-1.5 rounded border border-border px-2 py-1 text-[11px] font-mono uppercase tracking-widest text-foreground hover:bg-muted transition-colors"
          @click="reload"
        >
          Reload
        </button>
      </div>
      <button
        type="button"
        class="touch-target -m-1 inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
        @click="dismiss"
      >
        <X class="h-4 w-4" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.audio-hint {
  position: fixed;
  left: 0.75rem;
  right: 0.75rem;
  bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
  z-index: 50;
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  max-width: 26rem;
  margin: 0 auto;
  padding: 0.7rem 0.8rem;
  font-size: 0.78rem;
  color: hsl(var(--foreground));
  background: hsl(var(--popover));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  box-shadow: 0 12px 32px -12px hsl(220 40% 2% / 0.55);
}

.hint-fade-enter-active,
.hint-fade-leave-active {
  transition:
    opacity 160ms ease-out,
    transform 160ms ease-out;
}
.hint-fade-enter-from,
.hint-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
