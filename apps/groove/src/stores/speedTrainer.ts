import { defineStore } from 'pinia'
import { ref } from 'vue'

// Speed training: raise the tempo every N loops until it reaches a target.
// Absolute BPM, not a percentage, because that is the unit a drummer thinks in
// and the one the transport already shows.
//
// Preferences persist locally; they are practice settings, never part of the
// groove, so they must not leak into the shared URL (see docs/conventions).

const KEY_EVERY = 'groove:speedEveryLoops'
const KEY_STEP = 'groove:speedStepBpm'
const KEY_TARGET = 'groove:speedTargetBpm'

function readNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    const n = raw === null ? NaN : Number(raw)
    return Number.isFinite(n) ? n : fallback
  } catch {
    return fallback
  }
}

function writeNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // Private mode: the setting just does not survive the session.
  }
}

export const useSpeedTrainerStore = defineStore('speedTrainer', () => {
  const enabled = ref(false)
  const everyLoops = ref(readNumber(KEY_EVERY, 2))
  const stepBpm = ref(readNumber(KEY_STEP, 5))
  const targetBpm = ref(readNumber(KEY_TARGET, 140))

  function setEnabled(v: boolean) {
    enabled.value = v
  }
  function setEveryLoops(v: number) {
    everyLoops.value = Math.max(1, Math.min(32, Math.round(v) || 1))
    writeNumber(KEY_EVERY, everyLoops.value)
  }
  function setStepBpm(v: number) {
    stepBpm.value = Math.max(1, Math.min(40, Math.round(v) || 1))
    writeNumber(KEY_STEP, stepBpm.value)
  }
  function setTargetBpm(v: number) {
    targetBpm.value = Math.max(40, Math.min(260, Math.round(v) || 40))
    writeNumber(KEY_TARGET, targetBpm.value)
  }

  // Given how many loops have completed and the current tempo, what should the
  // tempo be now? Returns null when nothing should change, so the caller never
  // writes a no-op tempo (which would spam the URL rewrite).
  function tempoAfterLoops(loopsDone: number, currentTempo: number): number | null {
    if (!enabled.value || loopsDone <= 0) return null
    if (loopsDone % everyLoops.value !== 0) return null
    if (currentTempo >= targetBpm.value) return null
    return Math.min(targetBpm.value, currentTempo + stepBpm.value)
  }

  return {
    enabled,
    everyLoops,
    stepBpm,
    targetBpm,
    setEnabled,
    setEveryLoops,
    setStepBpm,
    setTargetBpm,
    tempoAfterLoops,
  }
})
