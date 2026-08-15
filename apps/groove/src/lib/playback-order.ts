import { MAX_REPEAT, type Groove } from './model'

/**
 * One sounding position in the expanded track. `step` indexes the groove's cell
 * arrays; `measure` and `pass` say where that position sits in the structure,
 * which is what the UI needs to say "bar 2, third time through".
 */
export interface PlaySlot {
  step: number
  measure: number
  pass: number // 1-based
}

type RepeatSource = Pick<Groove, 'division' | 'measures'> & { repeats?: number[] }

export function repeatFor(g: RepeatSource, measure: number): number {
  const r = Math.round(g.repeats?.[measure] ?? 1)
  if (!Number.isFinite(r)) return 1
  return Math.max(1, Math.min(MAX_REPEAT, r))
}

export function hasRepeats(g: RepeatSource): boolean {
  for (let m = 0; m < g.measures; m++) if (repeatFor(g, m) > 1) return true
  return false
}

/**
 * The steps that actually sound, in order. With every repeat at 1 this is the
 * identity over 0..stepCount-1, which is why nothing downstream needs a special
 * case for "no repeats".
 */
export function expandTimeline(g: RepeatSource): PlaySlot[] {
  const stepsPerMeasure = g.division
  const slots: PlaySlot[] = []
  for (let m = 0; m < g.measures; m++) {
    const times = repeatFor(g, m)
    const start = m * stepsPerMeasure
    for (let pass = 1; pass <= times; pass++) {
      for (let i = 0; i < stepsPerMeasure; i++) slots.push({ step: start + i, measure: m, pass })
    }
  }
  return slots
}

/** Length of the expanded track in steps. */
export function playedStepCount(g: RepeatSource): number {
  let total = 0
  for (let m = 0; m < g.measures; m++) total += repeatFor(g, m) * g.division
  return total
}
