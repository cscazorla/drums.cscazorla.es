import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import * as Tone from 'tone'
import type { Groove } from '@/lib/model'
import { expandTimeline, type PlaySlot } from '@/lib/playback-order'
import { VOICES, effectiveSynthKey } from '@/lib/voices'

type SynthKey = 'kk' | 'sn' | 'hh' | 'hho' | 'hhp' | 't1' | 't2' | 't3' | 'ride' | 'crash' | 'click'
type Trigger = (time: number, velocity?: number) => void

/**
 * Synthesized drum voices. All sounds generated from WebAudio primitives — no sample loading.
 *
 * Design notes:
 *   kick:  MembraneSynth with tight pitch sweep → C2, 3 octaves (~260Hz → 65Hz thud)
 *   snare: white noise through bandpass (~2kHz, body) + short low tone (~200Hz, punch)
 *   hh closed: white noise → highpass 7kHz, ~35ms envelope (crisp tick)
 *   hh open:   white noise → highpass 5.5kHz, ~400ms envelope (sustained)
 *   hh pedal:  white noise → bandpass 4.5kHz, ~50ms envelope (muted chick)
 *   tom1 / t3: MembraneSynth tuned for high tom and floor tom
 *   ride:      filtered noise + tonal partial around 5kHz
 *   crash:     bright attack burst over a long noise wash (~1.6s), no bell partial
 *   click:     square wave, C6 on downbeat / G5 on other beats
 */
function makeSynth(kind: SynthKey): Trigger {
  if (kind === 'kk') {
    const synth = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 3,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.6 },
    }).toDestination()
    synth.volume.value = -6
    return (time, v = 1) => synth.triggerAttackRelease('C2', '8n', time, v)
  }

  if (kind === 'sn') {
    const noise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.08 },
    })
    const noiseBp = new Tone.Filter({ type: 'bandpass', frequency: 2200, Q: 0.9 })
    noise.chain(noiseBp, Tone.getDestination())
    noise.volume.value = -9
    const body = new Tone.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
    }).toDestination()
    body.volume.value = -16
    return (time, v = 1) => {
      noise.triggerAttackRelease('16n', time, v)
      body.triggerAttackRelease('A2', '16n', time, v * 0.7)
    }
  }

  if (kind === 'hh') {
    const noise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
    })
    const hp = new Tone.Filter({ type: 'highpass', frequency: 7000, Q: 0.7 })
    noise.chain(hp, Tone.getDestination())
    noise.volume.value = -17
    return (time, v = 1) => noise.triggerAttackRelease('32n', time, v)
  }

  if (kind === 'hho') {
    const noise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.25 },
    })
    const hp = new Tone.Filter({ type: 'highpass', frequency: 5500, Q: 0.7 })
    noise.chain(hp, Tone.getDestination())
    noise.volume.value = -14
    return (time, v = 1) => noise.triggerAttackRelease('8n', time, v)
  }

  if (kind === 'hhp') {
    const noise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 },
    })
    const bp = new Tone.Filter({ type: 'bandpass', frequency: 4500, Q: 1.6 })
    noise.chain(bp, Tone.getDestination())
    noise.volume.value = -20
    return (time, v = 1) => noise.triggerAttackRelease('32n', time, v)
  }

  if (kind === 't1') {
    const synth = new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 2.5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.4 },
    }).toDestination()
    synth.volume.value = -8
    return (time, v = 1) => synth.triggerAttackRelease('A3', '8n', time, v)
  }

  if (kind === 't2') {
    const synth = new Tone.MembraneSynth({
      pitchDecay: 0.035,
      octaves: 2.7,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.45 },
    }).toDestination()
    synth.volume.value = -8
    return (time, v = 1) => synth.triggerAttackRelease('F3', '8n', time, v)
  }

  if (kind === 't3') {
    const synth = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 3,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.5 },
    }).toDestination()
    synth.volume.value = -7
    return (time, v = 1) => synth.triggerAttackRelease('E2', '8n', time, v)
  }

  if (kind === 'ride') {
    const noise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.6, sustain: 0.02, release: 0.6 },
    })
    const hp = new Tone.Filter({ type: 'highpass', frequency: 4500, Q: 0.6 })
    noise.chain(hp, Tone.getDestination())
    noise.volume.value = -16
    const bell = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 },
    }).toDestination()
    bell.volume.value = -22
    return (time, v = 1) => {
      noise.triggerAttackRelease('4n', time, v)
      bell.triggerAttackRelease('E5', '8n', time, v * 0.5)
    }
  }

  if (kind === 'crash') {
    const wash = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.002, decay: 1.6, sustain: 0.04, release: 1.2 },
    })
    const hp = new Tone.Filter({ type: 'highpass', frequency: 3200, Q: 0.4 })
    wash.chain(hp, Tone.getDestination())
    wash.volume.value = -18
    const attack = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 },
    })
    const attackHp = new Tone.Filter({ type: 'highpass', frequency: 8000, Q: 0.5 })
    attack.chain(attackHp, Tone.getDestination())
    attack.volume.value = -20
    return (time, v = 1) => {
      wash.triggerAttackRelease('2n', time, v)
      attack.triggerAttackRelease('16n', time, v)
    }
  }

  // click (metronome)
  const synth = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
  }).toDestination()
  synth.volume.value = -16
  return (time, v = 1) => {
    const note = v >= 0.9 ? 'C6' : 'G5'
    synth.triggerAttackRelease(note, '32n', time, Math.min(v, 0.85))
  }
}

const ALL_SYNTH_KEYS: SynthKey[] = [
  'kk',
  'sn',
  'hh',
  'hho',
  'hhp',
  't1',
  't2',
  't3',
  'ride',
  'crash',
  'click',
]

export interface PlayOptions {
  // Silent gap inserted between loop iterations (in seconds). The countdown
  // is exposed via `practiceTimerVal` so the UI can render numbers without
  // any metronome click — pure visual review time.
  practicePauseSec?: number
}

export function usePlayback() {
  const isPlaying = ref(false)
  const currentStep = ref(-1)
  // Which repetition of the sounding measure is playing, 1-based (0 = stopped).
  // Without it the fourth pass through a repeated bar looks exactly like the
  // first, since `currentStep` is a grid step and comes round again unchanged.
  const currentPass = ref(0)
  const countInBeat = ref(0)
  const practiceTimerVal = ref(0)
  // Completed passes through the track since play() started. Speed training
  // watches this to decide when to nudge the tempo.
  const loopCount = ref(0)
  // True when Play ran but the audio context refused to start. Surfaced so the
  // user is told "there is no sound" instead of watching a silent playhead.
  const audioBlocked = ref(false)
  const part = shallowRef<Tone.Part | null>(null)
  const players = shallowRef<Record<SynthKey, Trigger> | null>(null)
  let onEnded: (() => void) | null = null

  // Geometry of the currently-playing timeline, captured at play() time. Used to
  // grade an incoming MIDI hit against the step grid using the audio clock (see
  // nearestStepNow). Null while stopped.
  interface Timeline {
    stepSec: number
    countInLen: number
    slots: PlaySlot[]
    loopLen: number
    loop: boolean
  }
  let timeline: Timeline | null = null

  // Fires once when a non-looping track reaches its end and tears itself down,
  // so the view can reset the editor (back to the first bar) and drop the wake
  // lock. Manual stop() does NOT call this — it has its own teardown path.
  function setOnEnded(fn: (() => void) | null) {
    onEnded = fn
  }

  function ensurePlayers() {
    if (players.value) return players.value
    const map = {} as Record<SynthKey, Trigger>
    for (const k of ALL_SYNTH_KEYS) map[k] = makeSynth(k)
    players.value = map
    return map
  }

  function applySwing(g: Groove) {
    Tone.getTransport().swing = Math.max(0, Math.min(0.5, g.swing / 200))
    Tone.getTransport().swingSubdivision = g.division >= 16 ? '16n' : '8n'
  }

  function subdivision(g: Groove): string {
    switch (g.division) {
      case 4:
        return '4n'
      case 6:
        return '8t'
      case 8:
        return '8n'
      case 12:
        return '8t'
      case 16:
        return '16n'
      case 24:
        return '16t'
      case 32:
        return '32n'
    }
  }

  // Backgrounding Safari kills audio, and not always recoverably. iOS suspends
  // the AudioContext, and WebKit has a third state beyond running/suspended,
  // `interrupted`, which a plain resume() outside a user gesture will not lift.
  // Once a context is stuck there it stays dead for the rest of the page's life:
  // the transport keeps counting, the UI keeps saying "playing", and nothing
  // sounds. So: try the cheap fixes first, and if the context is still not
  // running, throw it away and build a new one.
  function audioState(): string {
    // WebKit reports a fourth state, `interrupted`, that the DOM typings do not
    // know about. Read it as a plain string rather than lying to the compiler.
    return Tone.getContext().state as string
  }

  function audioRunning(): boolean {
    return audioState() === 'running'
  }

  type RawContext = AudioContext & { resume?: () => Promise<void>; close?: () => Promise<void> }

  function rawContext(): RawContext | null {
    try {
      return Tone.getContext().rawContext as unknown as RawContext
    } catch {
      return null
    }
  }

  // Playing a one-sample silent buffer is the gesture iOS actually accepts as
  // "the user asked for audio". resume() alone is not always enough, especially
  // for a context coming back from `interrupted`.
  function pokeSilentBuffer(ctx: RawContext) {
    try {
      const buf = ctx.createBuffer(1, 1, 22050)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(ctx.destination)
      src.start(0)
    } catch {
      // Context already gone; the caller will swap it.
    }
  }

  // Swap in a brand new context, dropping the synths that belonged to the old
  // one. Must run synchronously inside a gesture: constructing an AudioContext
  // outside one gives you a context that starts suspended and stays there.
  function swapContext() {
    const old = rawContext()
    try {
      part.value?.dispose()
    } catch {
      // Belonged to the dead context; nothing to salvage.
    }
    part.value = null
    players.value = null
    timeline = null
    try {
      const fresh = new Tone.Context({ latencyHint: 'interactive' })
      Tone.setContext(fresh)
      const raw = fresh.rawContext as unknown as RawContext
      void raw.resume?.()
      pokeSilentBuffer(raw)
    } catch {
      return
    }
    // Safari caps how many contexts a page may hold, so the corpse has to go or
    // a few backgrounding cycles would exhaust the budget.
    void old?.close?.().catch(() => {})
  }

  /**
   * Everything that must happen in the SAME TASK as the user's gesture.
   *
   * This is the whole fix: iOS only honours audio unlocking synchronously
   * inside the handler. The previous attempt did its repair work after
   * `await Tone.start()`, by which point the activation is spent, so a context
   * stuck in `interrupted` stayed stuck and the app was silent for good.
   * Call this first, before any await, then let play() do the async parts.
   */
  function unlockAudioSync() {
    const state = audioState()
    if (state === 'running') return
    if (state === 'closed') {
      swapContext()
      return
    }
    const ctx = rawContext()
    if (!ctx) return
    void ctx.resume?.()
    pokeSilentBuffer(ctx)
  }

  async function resumeAudio(): Promise<boolean> {
    if (audioRunning()) return true
    try {
      await Tone.getContext().resume()
    } catch {
      // Needs a gesture, or the context is interrupted. Fall through.
    }
    if (audioRunning()) return true
    try {
      await rawContext()?.resume?.()
    } catch {
      // Nothing more to try without rebuilding.
    }
    return audioRunning()
  }

  function onVisibility() {
    if (document.visibilityState !== 'visible') return
    void resumeAudio().then((ok) => {
      // Coming back to a dead context while the UI still says "playing" is the
      // worst state to leave the user in: Stop looks like the only control and
      // pressing it does not fix anything. Tear playback down so the Play
      // button comes back, and let the next press rebuild the audio.
      if (!ok && isPlaying.value) stop()
    })
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
    onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisibility))
  }

  let lastIndexDrawn = -1

  async function play(g: Groove, opts: PlayOptions = {}) {
    // FIRST, and before any await: the gesture's activation dies the moment we
    // yield, and iOS will not unlock audio afterwards.
    unlockAudioSync()

    await Tone.start()
    if (!(await resumeAudio())) {
      // The context is beyond reviving. We have already spent the gesture, so
      // this swap is a long shot, but a fresh context at least leaves the app
      // in a state the next Play press can unlock.
      swapContext()
      await Tone.start()
      await resumeAudio()
    }
    audioBlocked.value = !audioRunning()
    const p = ensurePlayers()
    stopInternal()
    loopCount.value = 0
    lastIndexDrawn = -1
    Tone.getTransport().bpm.value = g.tempo
    applySwing(g)

    // The track that actually sounds: a measure with `repeats[m] = 4` appears
    // four times here, so everything below counts expanded positions while
    // `slot.step` still points back at the one set of cells the editor holds.
    const slots = expandTimeline(g)
    const n = slots.length
    const stepDur = subdivision(g)
    const beatsPerMeasure = g.timeSig[0]
    const stepsPerBeat = g.division / beatsPerMeasure
    const stepsPerMeasure = g.division

    const beatSec = 60 / g.tempo
    const stepSec = Tone.Time(stepDur).toSeconds()
    const countInLen = g.countIn ? beatsPerMeasure * beatSec : 0
    const trackEnd = countInLen + stepSec * n

    // Practice pause is only meaningful when looping — it's the review window
    // before the next iteration kicks off.
    const pauseSec = g.loop ? Math.max(0, Math.floor(opts.practicePauseSec ?? 0)) : 0

    // Single Part that contains count-in beats, track steps, and (optionally)
    // a per-second timer countdown. Looping replays everything cleanly.
    type Ev =
      | { kind: 'count'; beat: number }
      | { kind: 'step'; index: number; slot: PlaySlot }
      | { kind: 'timer'; secLeft: number }
      | { kind: 'end' }
    const events: [string, Ev][] = []
    if (g.countIn) {
      for (let i = 0; i < beatsPerMeasure; i++) {
        events.push([i * beatSec + '', { kind: 'count', beat: i + 1 }])
      }
    }
    for (let i = 0; i < n; i++) {
      events.push([countInLen + stepSec * i + '', { kind: 'step', index: i, slot: slots[i] }])
    }
    for (let i = 0; i < pauseSec; i++) {
      events.push([trackEnd + i + '', { kind: 'timer', secLeft: pauseSec - i }])
    }
    // Without a loop the transport would keep running silently after the last
    // step, leaving the UI stuck in "playing". Schedule an explicit end one
    // step past the final note so we tear down and reset to the top.
    if (!g.loop) {
      events.push([trackEnd + '', { kind: 'end' }])
    }

    const newPart = new Tone.Part((time, ev: Ev) => {
      if (ev.kind === 'count') {
        p.click(time, ev.beat === 1 ? 1 : 0.6)
        Tone.getDraw().schedule(() => {
          countInBeat.value = ev.beat
          practiceTimerVal.value = 0
          currentStep.value = -1
          currentPass.value = 0
        }, time)
        return
      }

      if (ev.kind === 'timer') {
        Tone.getDraw().schedule(() => {
          practiceTimerVal.value = ev.secLeft
          countInBeat.value = 0
          currentStep.value = -1
          currentPass.value = 0
        }, time)
        return
      }

      if (ev.kind === 'end') {
        Tone.getDraw().schedule(() => {
          stop()
          onEnded?.()
        }, time)
        return
      }

      const step = ev.slot.step
      for (const voice of VOICES) {
        const arr = g.voices[voice.id]
        if (!arr) continue
        const state = arr[step] ?? 0
        if (state === 0) continue
        const synthKey = effectiveSynthKey(voice.id, state)
        if (!synthKey) continue
        const trigger = p[synthKey as SynthKey]
        if (!trigger) continue
        const def = voice.states[state]
        trigger(time, def.velocity ?? 1)
      }

      if (g.metronome && step % stepsPerBeat === 0) {
        const isDownbeat = step % stepsPerMeasure === 0
        p.click(time, isDownbeat ? 1 : 0.55)
      }

      Tone.getDraw().schedule(() => {
        // Wrapping back to the top of the expanded track having already played
        // past it means the Part restarted, which is one completed loop. This
        // watches the expanded index, not the grid step: a repeated bar brings
        // step 0 round again in the middle of a single pass.
        if (ev.index === 0 && lastIndexDrawn > 0) loopCount.value++
        lastIndexDrawn = ev.index
        countInBeat.value = 0
        practiceTimerVal.value = 0
        currentStep.value = step
        currentPass.value = ev.slot.pass
      }, time)
    }, events)

    newPart.loop = g.loop
    newPart.loopEnd = trackEnd + pauseSec + 's'
    newPart.start(0)
    part.value = newPart
    timeline = { stepSec, countInLen, slots, loopLen: trackEnd + pauseSec, loop: g.loop }

    Tone.getTransport().stop()
    Tone.getTransport().position = 0
    Tone.getTransport().start()
    isPlaying.value = true
  }

  function stopInternal() {
    if (part.value) {
      part.value.stop()
      part.value.dispose()
      part.value = null
    }
    Tone.getTransport().stop()
  }

  function stop() {
    stopInternal()
    timeline = null
    isPlaying.value = false
    currentStep.value = -1
    currentPass.value = 0
    countInBeat.value = 0
    practiceTimerVal.value = 0
  }

  // Project the live transport position onto the step grid so a MIDI hit can be
  // graded for timing. Reads the audio clock (`transport.seconds`) directly —
  // it must be called synchronously from the MIDI handler, before Vue's async
  // flush advances the clock. Returns null during count-in / the loop tail or
  // when stopped. `deltaSec` is signed: negative = early, positive = late.
  function nearestStepNow(): { step: number; deltaSec: number } | null {
    if (!isPlaying.value || !timeline) return null
    const tl = timeline
    const ts = Tone.getTransport().seconds
    const phase = tl.loop ? ((ts % tl.loopLen) + tl.loopLen) % tl.loopLen : ts
    const rel = phase - tl.countInLen
    const index = Math.round(rel / tl.stepSec)
    if (index < 0 || index >= tl.slots.length) return null
    // Grading is against the grid, so hand back the cell the slot reads from.
    return { step: tl.slots[index].step, deltaSec: rel - index * tl.stepSec }
  }

  function updateRuntime(g: Groove) {
    if (!isPlaying.value) return
    Tone.getTransport().bpm.value = g.tempo
    applySwing(g)
  }

  watch(isPlaying, (v) => {
    if (!v) {
      currentStep.value = -1
      currentPass.value = 0
    }
  })

  return {
    isPlaying,
    currentStep,
    currentPass,
    countInBeat,
    practiceTimerVal,
    loopCount,
    play,
    stop,
    updateRuntime,
    setOnEnded,
    nearestStepNow,
    resumeAudio,
    audioBlocked,
    audioState,
  }
}
