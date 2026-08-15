import { defineStore } from 'pinia'
import { ref } from 'vue'

const MINUTES_KEY = 'groove:practiceTimerMinutes'
const TICK_MS = 250

function readNumber(key: string, fallback: number): number {
  if (typeof localStorage === 'undefined') return fallback
  const raw = localStorage.getItem(key)
  const n = raw == null ? NaN : Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function writeNumber(key: string, v: number) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, String(v))
}

function clampMinutes(n: number): number {
  if (!Number.isFinite(n)) return 4
  return Math.max(1, Math.min(60, Math.round(n)))
}

export const usePracticeTimerStore = defineStore('practiceTimer', () => {
  const minutes = ref(clampMinutes(readNumber(MINUTES_KEY, 4)))
  const enabled = ref(false)
  const remainingMs = ref(0)
  const running = ref(false)

  let interval: ReturnType<typeof setInterval> | null = null
  let expiresAt = 0
  let onExpire: (() => void) | null = null

  function setMinutes(v: number) {
    minutes.value = clampMinutes(v)
    writeNumber(MINUTES_KEY, minutes.value)
    // If the timer is currently running, leave the countdown alone — restarting
    // mid-session would be surprising. The new value applies to the next start.
  }

  function setEnabled(v: boolean) {
    enabled.value = v
    if (!v) stop()
  }

  function setOnExpire(fn: (() => void) | null) {
    onExpire = fn
  }

  function clearInterval_() {
    if (interval !== null) {
      clearInterval(interval)
      interval = null
    }
  }

  function start() {
    clearInterval_()
    const totalMs = minutes.value * 60_000
    expiresAt = Date.now() + totalMs
    remainingMs.value = totalMs
    running.value = true
    interval = setInterval(() => {
      const left = expiresAt - Date.now()
      if (left <= 0) {
        remainingMs.value = 0
        running.value = false
        clearInterval_()
        if (onExpire) onExpire()
        return
      }
      remainingMs.value = left
    }, TICK_MS)
  }

  function stop() {
    clearInterval_()
    running.value = false
    remainingMs.value = 0
  }

  return {
    minutes,
    enabled,
    remainingMs,
    running,
    setMinutes,
    setEnabled,
    setOnExpire,
    start,
    stop,
  }
})
