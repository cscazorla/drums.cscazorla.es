<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import { VOICE_BY_ID, type VoiceId } from '@/lib/voices'
import type { LiveMarkerGrade } from '@/stores/midi'

const props = defineProps<{
  value: number
  kind: 'hat' | 'note' | 'sticking'
  voiceId?: VoiceId
  active?: boolean
  beat?: boolean
  downbeat?: boolean
  beatStart?: boolean
  label?: string
  liveHit?: boolean
  liveMarker?: LiveMarkerGrade
  // The active brush cannot paint this lane (a sticking brush over a note lane,
  // or "open" over a snare). Dimmed and non-interactive so a tap that would do
  // nothing never looks like it should have worked.
  inertLane?: boolean
}>()

const symbol = computed(() => {
  if (props.kind === 'sticking') return props.label ?? ''
  if (props.voiceId) {
    return VOICE_BY_ID[props.voiceId].states[props.value]?.symbol ?? ''
  }
  if (props.kind === 'hat') {
    return ({ 0: '', 1: 'x', 2: 'o', 3: 'X', 4: 'f' } as Record<number, string>)[props.value] ?? ''
  }
  return ({ 0: '', 1: '●', 2: '◆', 3: '○' } as Record<number, string>)[props.value] ?? ''
})

const filled = computed(() => props.value !== 0 && props.kind !== 'sticking')
const accent = computed(() => {
  if (props.kind === 'sticking') return false
  if (props.voiceId) {
    return !!VOICE_BY_ID[props.voiceId].states[props.value]?.articulation
  }
  return (props.kind === 'hat' && props.value === 3) || (props.kind === 'note' && props.value === 2)
})

const liveMarkerClass = computed(() => {
  switch (props.liveMarker) {
    case 'perfect':
      return 'live-marker live-marker-perfect'
    case 'early':
      return 'live-marker live-marker-early'
    case 'late':
      return 'live-marker live-marker-late'
    case 'wrong-voice':
      return 'live-marker live-marker-wrong-voice'
    case 'off-time':
      return 'live-marker live-marker-off-time'
    default:
      return ''
  }
})
</script>

<template>
  <button
    type="button"
    :disabled="inertLane"
    :class="
      cn(
        'led-cell h-9 w-full select-none text-[11px] font-mono font-semibold',
        'flex items-center justify-center',
        beat && 'beat',
        beatStart && !downbeat && 'cell-gap',
        beatStart && downbeat && 'cell-gap-lg',
        filled && 'filled',
        filled && accent && 'accent',
        active && 'active-step',
        liveHit && 'live-hit',
        inertLane && 'inert-lane',
        liveMarkerClass,
      )
    "
  >
    <span>{{ symbol }}</span>
  </button>
</template>
