// Voice registry. Single source of truth for what drums exist, how they
// encode in the wire format, what MIDI notes they emit, what synth makes
// their sound, and how they render on the staff.
//
// Adding a voice is editing this file plus, if its sound is genuinely new,
// adding the synth in `usePlayback.ts`. Everything else (codec, score,
// MIDI export) reads from here.

export type VoiceId = 'hh' | 'sn' | 'kk' | 't1' | 't2' | 't3' | 'ride' | 'crash'
export type VoiceKind = 'hat' | 'note'
export type VoiceGroup = 'tom' | 'cymbal'

// What the state bar can paint. A brush names a musical intent; each voice maps
// it to whichever of its own states means that, or to nothing when the voice
// has no such state (a snare has no "open", a hi-hat has no "ghost").
export type BrushState = 'normal' | 'accent' | 'ghost' | 'open' | 'pedal'

export interface VoiceState {
  // index 0 in `Voice.states` is "off" — empty object.
  // Active states declare:
  midi?: number // GM drum note number for MIDI export and (later) input
  velocity?: number // 0..1 velocity for both audio and MIDI
  symbol?: string // text symbol for the editor cell
  vexKey?: string // overrides the voice's default VexFlow key
  articulation?: string // VexFlow articulation type, e.g. 'a>' for accent
  annotation?: string // VexFlow annotation text, e.g. 'o' for open hat
  synthKey?: string // overrides the voice's default synth key
  brush?: BrushState // which state-bar brush paints this state
}

export interface Voice {
  id: VoiceId
  label: string
  kind: VoiceKind
  bitsPerCell: number
  vexKey: string // default VexFlow key when state has no override
  defaultSynthKey: string // default synth key in usePlayback's synth bank
  states: readonly VoiceState[]
  group?: VoiceGroup // editor-only: lets the Settings drawer collapse lane families
}

// Order is append-only. The codec's v4 presence bitmap is positional (bit i is
// VOICES[i]), so reordering or inserting silently reinterprets every existing
// URL. The bitmap is one byte, so the 8 entries below fill it: a ninth voice
// needs a format bump.
export const VOICES: readonly Voice[] = [
  {
    id: 'hh',
    label: 'HI-HAT',
    kind: 'hat',
    bitsPerCell: 3,
    vexKey: 'g/5/x2',
    defaultSynthKey: 'hh',
    states: [
      {},
      { midi: 42, velocity: 0.8, symbol: 'x', brush: 'normal' },
      { midi: 46, velocity: 0.9, symbol: 'o', annotation: 'o', synthKey: 'hho', brush: 'open' },
      { midi: 42, velocity: 1, symbol: 'X', articulation: 'a>', brush: 'accent' },
      {
        midi: 44,
        velocity: 0.9,
        symbol: 'f',
        vexKey: 'f/4/x2',
        synthKey: 'hhp',
        brush: 'pedal',
      },
    ],
  },
  {
    id: 'sn',
    label: 'SNARE',
    kind: 'note',
    bitsPerCell: 2,
    vexKey: 'c/5',
    defaultSynthKey: 'sn',
    states: [
      {},
      { midi: 38, velocity: 0.85, symbol: '●', brush: 'normal' },
      { midi: 38, velocity: 1, symbol: '◆', articulation: 'a>', brush: 'accent' },
      { midi: 38, velocity: 0.35, symbol: '○', annotation: '(·)', brush: 'ghost' },
    ],
  },
  {
    id: 'kk',
    label: 'KICK',
    kind: 'note',
    bitsPerCell: 2,
    vexKey: 'f/4',
    defaultSynthKey: 'kk',
    states: [
      {},
      { midi: 36, velocity: 0.9, symbol: '●', brush: 'normal' },
      { midi: 36, velocity: 1, symbol: '◆', articulation: 'a>', brush: 'accent' },
      { midi: 36, velocity: 0.55, symbol: '○', brush: 'ghost' },
    ],
  },
  {
    id: 't1',
    label: 'TOM 1',
    kind: 'note',
    bitsPerCell: 2,
    vexKey: 'e/5',
    defaultSynthKey: 't1',
    group: 'tom',
    states: [
      {},
      { midi: 50, velocity: 0.85, symbol: '●', brush: 'normal' },
      { midi: 50, velocity: 1, symbol: '◆', articulation: 'a>', brush: 'accent' },
      { midi: 50, velocity: 0.45, symbol: '○', brush: 'ghost' },
    ],
  },
  {
    id: 't2',
    label: 'TOM 2',
    kind: 'note',
    bitsPerCell: 2,
    vexKey: 'd/5',
    defaultSynthKey: 't2',
    group: 'tom',
    states: [
      {},
      { midi: 47, velocity: 0.85, symbol: '●', brush: 'normal' },
      { midi: 47, velocity: 1, symbol: '◆', articulation: 'a>', brush: 'accent' },
      { midi: 47, velocity: 0.45, symbol: '○', brush: 'ghost' },
    ],
  },
  {
    id: 't3',
    label: 'FLOOR TOM',
    kind: 'note',
    bitsPerCell: 2,
    vexKey: 'a/4',
    defaultSynthKey: 't3',
    group: 'tom',
    states: [
      {},
      { midi: 41, velocity: 0.85, symbol: '●', brush: 'normal' },
      { midi: 41, velocity: 1, symbol: '◆', articulation: 'a>', brush: 'accent' },
      { midi: 41, velocity: 0.45, symbol: '○', brush: 'ghost' },
    ],
  },
  {
    id: 'ride',
    label: 'RIDE',
    kind: 'note',
    bitsPerCell: 2,
    vexKey: 'f/5/x2',
    defaultSynthKey: 'ride',
    group: 'cymbal',
    states: [
      {},
      { midi: 51, velocity: 0.8, symbol: 'x', brush: 'normal' },
      { midi: 51, velocity: 1, symbol: 'X', articulation: 'a>', brush: 'accent' },
      { midi: 51, velocity: 0.5, symbol: 'x', brush: 'ghost' },
    ],
  },
  {
    id: 'crash',
    label: 'CRASH',
    kind: 'note',
    bitsPerCell: 2,
    // First ledger line above the staff, one position above the hi-hat, which
    // is where a drum chart puts a crash.
    vexKey: 'a/5/x2',
    defaultSynthKey: 'crash',
    group: 'cymbal',
    states: [
      {},
      { midi: 49, velocity: 0.9, symbol: 'x', brush: 'normal' },
      { midi: 49, velocity: 1, symbol: 'X', articulation: 'a>', brush: 'accent' },
    ],
  },
]

export const VOICE_IDS: readonly VoiceId[] = VOICES.map((v) => v.id)

export const VOICE_BY_ID: Record<VoiceId, Voice> = Object.fromEntries(
  VOICES.map((v) => [v.id, v]),
) as Record<VoiceId, Voice>

export function nextState(voiceId: VoiceId, current: number): number {
  const v = VOICE_BY_ID[voiceId]
  return (current + 1) % v.states.length
}

// The state bar's palette, in the order it is shown. Symbols are the snare /
// kick glyphs, which read as the generic case; a hi-hat renders its own.
export const BRUSHES: readonly { id: BrushState; label: string; symbol: string }[] = [
  { id: 'normal', label: 'Normal', symbol: '●' },
  { id: 'accent', label: 'Accent', symbol: '◆' },
  { id: 'ghost', label: 'Ghost', symbol: '○' },
  { id: 'open', label: 'Open', symbol: 'o' },
  { id: 'pedal', label: 'Pedal', symbol: 'f' },
]

// Which of this voice's states the brush paints, or null when the voice has no
// equivalent (asking a snare for "open" is not an error, it is a no-op).
export function stateForBrush(voiceId: VoiceId, brush: BrushState): number | null {
  const i = VOICE_BY_ID[voiceId].states.findIndex((s) => s.brush === brush)
  return i < 0 ? null : i
}

export function voicesForBrush(brush: BrushState): VoiceId[] {
  return VOICE_IDS.filter((id) => stateForBrush(id, brush) !== null)
}

export function effectiveSynthKey(voiceId: VoiceId, state: number): string | null {
  const v = VOICE_BY_ID[voiceId]
  const s = v.states[state]
  if (!s) return null
  return s.synthKey ?? v.defaultSynthKey
}

// Extra GM input mappings beyond what the registry's states declare. The
// Aroma TDX 15S and similar kits send these notes for sounds that share
// a voice in our model (rim shots count as snare, kit's specific tom
// ranges, etc).
const INPUT_ONLY_MIDI: Record<number, VoiceId> = {
  37: 'sn', // side stick / rim
  39: 'sn', // hand clap
  40: 'sn', // electric snare
  43: 't3', // high floor tom
  45: 't2', // low tom
  48: 't1', // hi-mid tom
  52: 'crash', // china
  53: 'ride', // ride bell
  55: 'crash', // splash
  57: 'crash', // crash 2
  59: 'ride', // ride 2
}

export function voiceForMidiNote(note: number): VoiceId | null {
  for (const voice of VOICES) {
    for (const state of voice.states) {
      if (state.midi === note) return voice.id
    }
  }
  return INPUT_ONLY_MIDI[note] ?? null
}
