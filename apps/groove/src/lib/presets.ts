// Groove presets. The cheapest interaction is the one that never happens: a
// preset fills whole lanes at once, which is the only thing that beats a drag.
//
// Patterns are written per beat rather than per cell so one definition covers
// every division. `on` lists the beat positions in quarter notes: 0, 0.5 and
// 0.75 are the downbeat, the "and", and the "a" of beat 1. Anything that does
// not land on a cell at the current division is dropped, so a preset applied at
// 8ths quietly loses its 16th-note detail instead of refusing to apply.

import type { Groove } from './model'
import { stepCount } from './model'
import { stateForBrush, type BrushState, type VoiceId } from './voices'

export interface PresetLane {
  voice: VoiceId
  brush: BrushState
  // Beat offsets within a bar, in quarter notes.
  on: number[]
}

export interface Preset {
  id: string
  label: string
  hint: string
  lanes: PresetLane[]
}

const EIGHTHS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
const SIXTEENTHS = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75]

export const PRESETS: readonly Preset[] = [
  {
    id: 'rock',
    label: 'Basic rock',
    hint: 'Hi-hat on the eighths, snare on 2 and 4, kick on 1 and 3',
    lanes: [
      { voice: 'hh', brush: 'normal', on: EIGHTHS },
      { voice: 'sn', brush: 'normal', on: [1, 3] },
      { voice: 'kk', brush: 'normal', on: [0, 2] },
    ],
  },
  {
    id: 'hats8',
    label: 'Hats in 8ths',
    hint: 'Just the hi-hat lane, eight notes to the bar',
    lanes: [{ voice: 'hh', brush: 'normal', on: EIGHTHS }],
  },
  {
    id: 'hats16',
    label: 'Hats in 16ths',
    hint: 'Just the hi-hat lane, sixteen notes to the bar',
    lanes: [{ voice: 'hh', brush: 'normal', on: SIXTEENTHS }],
  },
  {
    id: 'four',
    label: 'Four on the floor',
    hint: 'Kick on every beat, hi-hat on the eighths, snare on 2 and 4',
    lanes: [
      { voice: 'kk', brush: 'normal', on: [0, 1, 2, 3] },
      { voice: 'hh', brush: 'normal', on: EIGHTHS },
      { voice: 'sn', brush: 'normal', on: [1, 3] },
    ],
  },
]

export interface AppliedPreset {
  voices: Partial<Record<VoiceId, number[]>>
  // Positions the current division was too coarse to represent. Surfaced so the
  // UI can say so rather than silently dropping notes.
  droppedNotes: number
}

/**
 * Render a preset into cell arrays for one measure of `g`, leaving every other
 * measure untouched. Returns the full-length arrays ready to assign.
 */
export function applyPreset(g: Groove, preset: Preset, measure: number): AppliedPreset {
  const n = stepCount(g)
  const perMeasure = g.division
  const beatsPerMeasure = g.timeSig[0]
  const stepsPerBeat = perMeasure / beatsPerMeasure
  const offset = measure * perMeasure

  const voices: Partial<Record<VoiceId, number[]>> = {}
  let droppedNotes = 0

  for (const lane of preset.lanes) {
    const state = stateForBrush(lane.voice, lane.brush)
    if (state === null) continue
    const arr = [...(g.voices[lane.voice] ?? new Array(n).fill(0))]
    // Clear only this measure; the rest of the groove is not ours to touch.
    for (let i = 0; i < perMeasure; i++) arr[offset + i] = 0
    for (const beat of lane.on) {
      const step = beat * stepsPerBeat
      if (!Number.isInteger(step) || step >= perMeasure) {
        droppedNotes++
        continue
      }
      arr[offset + step] = state
    }
    voices[lane.voice] = arr
  }

  return { voices, droppedNotes }
}
