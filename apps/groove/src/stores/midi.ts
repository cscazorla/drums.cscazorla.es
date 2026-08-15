import { defineStore } from 'pinia'
import { ref } from 'vue'
import { voiceForMidiNote, type VoiceId } from '@/lib/voices'

export interface HitTiming {
  step: number
  deltaSec: number // signed: negative = early, positive = late
}

export interface MidiHit {
  voiceId: VoiceId
  rawNote: number
  velocity: number
  atMs: number
  // Step + timing delta captured against the audio clock at hit time. Null when
  // not playing or during count-in / the loop tail.
  timing: HitTiming | null
}

export type LiveMarkerGrade = 'perfect' | 'early' | 'late' | 'wrong-voice' | 'off-time'

export interface LiveMarker {
  id: number
  voiceId: VoiceId
  step: number
  atMs: number
  grade: LiveMarkerGrade
}

const LATENCY_KEY = 'groove:midiLatency'
const TOLERANCE_KEY = 'groove:midiTolerance'
const PRACTICE_MODE_KEY = 'groove:midiPracticeMode'
const PRACTICE_SEC_KEY = 'groove:midiPracticeSec'
const SHOW_TOMS_KEY = 'groove:showToms'
const SHOW_CYMBALS_KEY = 'groove:showCymbals'
const LESSON_KEY = 'groove:lessonMode'

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

function readBool(key: string, fallback: boolean): boolean {
  if (typeof localStorage === 'undefined') return fallback
  const raw = localStorage.getItem(key)
  if (raw === 'true') return true
  if (raw === 'false') return false
  return fallback
}

function writeBool(key: string, v: boolean) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, v ? 'true' : 'false')
}

export const useMidiStore = defineStore('midi', () => {
  // Wrapped in a ref so `storeToRefs` exposes it — a plain primitive returned
  // from a Pinia setup store is dropped by `storeToRefs`, which previously
  // made the panel always render the "not supported" branch.
  const supported = ref('requestMIDIAccess' in navigator)
  const connected = ref(false)
  const panelOpen = ref(false)
  const error = ref<string | null>(null)
  const deviceName = ref<string | null>(null)
  const lastHit = ref<MidiHit | null>(null)
  let cleanups: Array<() => void> = []

  // Supplies the step + timing delta for an incoming hit, read straight off the
  // audio clock. Registered by the editor (which owns the playback timeline) so
  // the store stays decoupled from Tone. Called synchronously in onMessage.
  let hitTimingProvider: (() => HitTiming | null) | null = null
  function setHitTimingProvider(fn: (() => HitTiming | null) | null) {
    hitTimingProvider = fn
  }

  const latencyMs = ref(readNumber(LATENCY_KEY, 0))
  const toleranceMs = ref(readNumber(TOLERANCE_KEY, 40))
  const practiceMode = ref(readBool(PRACTICE_MODE_KEY, false))
  const practiceTimerSec = ref(readNumber(PRACTICE_SEC_KEY, 10))
  const showToms = ref(readBool(SHOW_TOMS_KEY, true))
  const showCymbals = ref(readBool(SHOW_CYMBALS_KEY, true))
  // Lesson mode: standing up, teacher talking, attention on the board. Strips
  // the editor down to the grid, the brush and Play; everything analytical
  // (staff, MIDI feedback, practice metrics) gets out of the way.
  const lessonMode = ref(readBool(LESSON_KEY, false))

  function setLatency(v: number) {
    latencyMs.value = v
    writeNumber(LATENCY_KEY, v)
  }
  function setTolerance(v: number) {
    toleranceMs.value = Math.max(5, Math.min(300, v))
    writeNumber(TOLERANCE_KEY, toleranceMs.value)
  }
  function setPracticeMode(v: boolean) {
    practiceMode.value = v
    writeBool(PRACTICE_MODE_KEY, v)
  }
  function setPracticeTimerSec(v: number) {
    practiceTimerSec.value = Math.max(1, Math.min(60, Math.round(v)))
    writeNumber(PRACTICE_SEC_KEY, practiceTimerSec.value)
  }
  function setShowToms(v: boolean) {
    showToms.value = v
    writeBool(SHOW_TOMS_KEY, v)
  }
  function setShowCymbals(v: boolean) {
    showCymbals.value = v
    writeBool(SHOW_CYMBALS_KEY, v)
  }
  function setLessonMode(v: boolean) {
    lessonMode.value = v
    writeBool(LESSON_KEY, v)
  }

  // Live markers — feedback dots dropped onto the grid and tablature for each
  // MIDI hit during playback. They persist until the loop restarts (cleared
  // explicitly by the editor on count-in beat 3 or when the track wraps).
  const markers = ref<LiveMarker[]>([])
  let nextMarkerId = 1

  function pushMarker(m: Omit<LiveMarker, 'id'>) {
    const id = nextMarkerId++
    markers.value = [...markers.value, { ...m, id }]
  }

  function clearMarkers() {
    markers.value = []
  }

  function openPanel() {
    panelOpen.value = true
  }
  function closePanel() {
    panelOpen.value = false
  }
  function togglePanel() {
    panelOpen.value = !panelOpen.value
  }

  async function connect() {
    if (!supported.value) {
      error.value = 'Web MIDI is not supported in this browser. Try Chrome, Edge, or Firefox.'
      return
    }
    try {
      const a = await navigator.requestMIDIAccess()
      const inputs = Array.from(a.inputs.values())
      if (inputs.length === 0) {
        error.value = 'No MIDI input devices found. Connect your kit and try again.'
        return
      }
      const input = inputs[0]
      deviceName.value = input.name ?? 'MIDI device'
      const handler = (ev: Event) => onMessage(ev as MIDIMessageEvent)
      input.addEventListener('midimessage', handler)
      cleanups.push(() => input.removeEventListener('midimessage', handler))
      connected.value = true
      error.value = null
    } catch (e) {
      error.value = (e as Error).message ?? 'Failed to access MIDI devices.'
    }
  }

  function disconnect() {
    cleanups.forEach((c) => c())
    cleanups = []
    connected.value = false
    deviceName.value = null
  }

  function onMessage(ev: MIDIMessageEvent) {
    const data = ev.data
    if (!data || data.length < 3) return
    const status = data[0] & 0xf0
    if (status !== 0x90) return
    const note = data[1]
    const velocity = data[2]
    if (velocity === 0) return
    const voiceId = voiceForMidiNote(note)
    if (!voiceId) return
    lastHit.value = {
      voiceId,
      rawNote: note,
      velocity: velocity / 127,
      atMs: performance.now(),
      timing: hitTimingProvider ? hitTimingProvider() : null,
    }
  }

  return {
    supported,
    connected,
    panelOpen,
    error,
    deviceName,
    lastHit,
    latencyMs,
    toleranceMs,
    practiceMode,
    practiceTimerSec,
    showToms,
    showCymbals,
    lessonMode,
    setLessonMode,
    markers,
    setLatency,
    setTolerance,
    setPracticeMode,
    setPracticeTimerSec,
    setShowToms,
    setShowCymbals,
    setHitTimingProvider,
    openPanel,
    closePanel,
    togglePanel,
    connect,
    disconnect,
    pushMarker,
    clearMarkers,
  }
})
