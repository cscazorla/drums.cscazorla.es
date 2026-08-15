<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Download, Image as ImageIcon, X } from 'lucide-vue-next'
import { useMidiStore } from '@/stores/midi'
import { VOICE_BY_ID } from '@/lib/voices'

const midi = useMidiStore()
const {
  supported,
  connected,
  panelOpen,
  error,
  deviceName,
  lastHit,
  latencyMs,
  toleranceMs,
  showToms,
  showCymbals,
} = storeToRefs(midi)

defineEmits<{
  (e: 'exportMidi'): void
  (e: 'exportPng'): void
}>()

const lastHitVoiceLabel = computed(() =>
  lastHit.value ? VOICE_BY_ID[lastHit.value.voiceId].label : null,
)

// Latency-compensated timing of the most recent hit (negative = early, positive
// = late). Dial the latency offset until steady hits read near 0 ms.
const lastTimingMs = computed(() => {
  const t = lastHit.value?.timing
  if (!t) return null
  return Math.round(t.deltaSec * 1000 - latencyMs.value)
})
</script>

<template>
  <Transition name="midi-fade">
    <div
      v-if="panelOpen"
      class="midi-backdrop fixed inset-0 z-40"
      aria-hidden="true"
      @click="midi.closePanel()"
    />
  </Transition>

  <Transition name="midi-slide">
    <aside
      v-if="panelOpen"
      class="midi-drawer fixed right-0 top-0 z-50 flex h-full w-[min(92vw,400px)] flex-col gap-5 border-l bg-card p-4 shadow-2xl overflow-y-auto"
      role="dialog"
      aria-label="Settings"
    >
      <header class="flex items-center justify-between">
        <h3 class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Settings
        </h3>
        <div class="flex items-center gap-2">
          <span
            v-if="connected"
            class="inline-flex items-center gap-1.5 text-[10px] font-mono text-primary"
          >
            <span
              class="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]"
            />
            live
          </span>
          <button
            type="button"
            class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close panel"
            @click="midi.closePanel()"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      </header>

      <!-- Export -->
      <section class="space-y-2">
        <h4 class="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Export</h4>
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs hover:bg-muted"
            @click="$emit('exportPng')"
          >
            <ImageIcon class="h-3.5 w-3.5" /> PNG
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs hover:bg-muted"
            @click="$emit('exportMidi')"
          >
            <Download class="h-3.5 w-3.5" /> MIDI
          </button>
        </div>
      </section>

      <!-- Editor -->
      <section class="space-y-2">
        <h4 class="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Editor</h4>
        <label class="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            :checked="showToms"
            class="accent-[hsl(var(--primary))]"
            @change="midi.setShowToms(($event.target as HTMLInputElement).checked)"
          />
          <span>Show toms</span>
        </label>
        <label class="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            :checked="showCymbals"
            class="accent-[hsl(var(--primary))]"
            @change="midi.setShowCymbals(($event.target as HTMLInputElement).checked)"
          />
          <span>Show cymbals</span>
        </label>
        <p class="text-[11px] leading-snug text-muted-foreground">
          Hides lanes from the editor grid only — the staff and playback always reflect every note
          in the groove.
        </p>
      </section>

      <!-- MIDI Device -->
      <section class="space-y-2">
        <h4 class="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          MIDI device
        </h4>
        <p v-if="!supported" class="text-xs text-warn">
          Web MIDI is not available here. Needs Chrome/Edge/Firefox or Safari 18+ over HTTPS.
        </p>
        <div v-else-if="!connected" class="space-y-2">
          <button
            type="button"
            class="w-full rounded-md border bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
            @click="midi.connect()"
          >
            Connect MIDI device
          </button>
          <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
        </div>
        <div v-else class="space-y-2">
          <div class="rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs font-mono">
            {{ deviceName }}
          </div>
          <button
            type="button"
            class="w-full rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
            @click="midi.disconnect()"
          >
            Disconnect
          </button>
          <p class="text-[11px] leading-snug text-muted-foreground">
            Hits during play drop colored markers on the grid and the tablature. Markers stay until
            the next loop restarts.
          </p>
        </div>
      </section>

      <!-- MIDI tuning -->
      <section v-if="connected" class="space-y-3">
        <h4 class="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          MIDI tuning
        </h4>
        <div class="space-y-3 text-xs">
          <label class="block space-y-1">
            <div class="flex items-baseline justify-between">
              <span class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Latency offset
              </span>
              <span class="font-mono tabular text-[10px] text-muted-foreground">
                {{ latencyMs }} ms
              </span>
            </div>
            <input
              :value="latencyMs"
              type="range"
              min="-100"
              max="100"
              step="5"
              class="w-full accent-[hsl(var(--primary))]"
              @input="midi.setLatency(Number(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="block space-y-1">
            <div class="flex items-baseline justify-between">
              <span class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Tolerance
              </span>
              <span class="font-mono tabular text-[10px] text-muted-foreground">
                ±{{ toleranceMs }} ms
              </span>
            </div>
            <input
              :value="toleranceMs"
              type="range"
              min="10"
              max="200"
              step="5"
              class="w-full accent-[hsl(var(--primary))]"
              @input="midi.setTolerance(Number(($event.target as HTMLInputElement).value))"
            />
          </label>

          <!-- Calibration readout: dial the latency offset until steady hits
               read near 0 ms (early < 0, late > 0). -->
          <div
            class="flex items-baseline justify-between rounded-md border bg-muted/20 px-2.5 py-1.5"
          >
            <span class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Last hit
            </span>
            <span
              class="font-mono tabular text-xs font-semibold"
              :class="
                lastTimingMs == null
                  ? 'text-muted-foreground'
                  : Math.abs(lastTimingMs) <= Math.max(8, toleranceMs * 0.4)
                    ? 'text-[hsl(160_70%_45%)]'
                    : lastTimingMs < 0
                      ? 'text-[hsl(200_85%_58%)]'
                      : 'text-[hsl(28_90%_56%)]'
              "
            >
              {{
                lastTimingMs == null ? '—' : (lastTimingMs > 0 ? '+' : '') + lastTimingMs + ' ms'
              }}
            </span>
          </div>
          <p class="text-[11px] leading-snug text-muted-foreground">
            Play the chart and adjust the latency offset until your on-beat hits read near 0 ms.
            <span class="text-[hsl(200_85%_58%)]">Blue</span> = early,
            <span class="text-[hsl(160_70%_45%)]">green</span> = perfect,
            <span class="text-[hsl(28_90%_56%)]">orange</span> = late.
          </p>
        </div>
      </section>

      <!-- Last pad -->
      <section v-if="connected" class="space-y-2">
        <h4 class="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Last pad
        </h4>
        <div class="rounded-md border bg-muted/20 px-3 py-2">
          <div v-if="lastHit" class="space-y-1">
            <div class="flex items-baseline justify-between">
              <span class="text-sm font-semibold">{{ lastHitVoiceLabel }}</span>
              <span class="font-mono tabular text-[10px] text-muted-foreground">
                GM {{ lastHit.rawNote }}
              </span>
            </div>
            <div class="h-1 w-full overflow-hidden rounded-full bg-border">
              <div
                class="h-full bg-primary transition-[width] duration-100"
                :style="{ width: Math.round(lastHit.velocity * 100) + '%' }"
              />
            </div>
          </div>
          <p v-else class="text-[11px] text-muted-foreground">
            Hit any pad to verify it maps to the right voice.
          </p>
        </div>
      </section>

      <!-- Shortcuts -->
      <section class="space-y-2">
        <h4 class="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Shortcuts
        </h4>
        <dl class="space-y-1 text-[11px]">
          <div class="flex items-center justify-between">
            <dt class="text-muted-foreground">Play / pause</dt>
            <dd>
              <kbd
                class="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground"
              >
                Space
              </kbd>
            </dd>
          </div>
        </dl>
      </section>
    </aside>
  </Transition>
</template>

<style scoped>
.midi-backdrop {
  background: hsl(var(--foreground) / 0.35);
  backdrop-filter: blur(2px);
}

.midi-fade-enter-active,
.midi-fade-leave-active {
  transition: opacity 160ms ease-out;
}
.midi-fade-enter-from,
.midi-fade-leave-to {
  opacity: 0;
}

.midi-slide-enter-active,
.midi-slide-leave-active {
  transition:
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 220ms ease-out;
}
.midi-slide-enter-from,
.midi-slide-leave-to {
  transform: translateX(100%);
  opacity: 0.6;
}
</style>
