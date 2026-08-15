import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { emptyGroove, type Division } from '@/lib/model'
import { VOICE_BY_ID, type VoiceId } from '@/lib/voices'
import { useGrooveStore } from '@/stores/groove'

// The benchmark task from docs/specs/mobile-usability.md, expressed as code so
// the number is derived from the real interaction model instead of estimated,
// and so it moves the day that model moves.
//
// Task: one bar of basic rock. Hi-hat on the eight eighth notes, snare on 2
// and 4, kick on 1 and 3.

interface Target {
  voice: VoiceId
  step: number
  state: number
}

function basicRock(division: Division): Target[] {
  const perBeat = division / 4
  const eighth = division / 8
  const out: Target[] = []
  for (let i = 0; i < 8; i++) out.push({ voice: 'hh', step: i * eighth, state: 1 })
  for (const beat of [1, 3]) out.push({ voice: 'sn', step: beat * perBeat, state: 1 })
  for (const beat of [0, 2]) out.push({ voice: 'kk', step: beat * perBeat, state: 1 })
  return out
}

// Cycle-on-tap: a cell walks its state list one tap at a time from empty, so
// reaching state N costs N taps. This is the cost the editor has today.
function tapsByCycling(targets: Target[]): number {
  return targets.reduce((n, t) => {
    const states = VOICE_BY_ID[t.voice].states.length
    return n + (t.state % states)
  }, 0)
}

// Brush: one tap per cell, plus one tap on the state bar every time the brush
// has to change. Counted lane by lane, which is how a person actually works.
function tapsByBrush(targets: Target[], startingBrush = 1): number {
  let brush = startingBrush
  let taps = 0
  for (const t of targets) {
    if (t.state !== brush) {
      brush = t.state
      taps++
    }
    taps++
  }
  return taps
}

// Brush plus drag: a run of consecutive cells in the same lane that all want
// the same state collapses into one gesture.
function gesturesByBrushDrag(targets: Target[], startingBrush = 1): number {
  let brush = startingBrush
  let cost = 0
  let i = 0
  while (i < targets.length) {
    const t = targets[i]
    if (t.state !== brush) {
      brush = t.state
      cost++
    }
    let j = i
    while (
      j + 1 < targets.length &&
      targets[j + 1].voice === t.voice &&
      targets[j + 1].state === t.state &&
      targets[j + 1].step === targets[j].step + 1
    ) {
      j++
    }
    cost++
    i = j + 1
  }
  return cost
}

describe('benchmark: one bar of basic rock', () => {
  it('the default 16ths grid costs 12 taps with cycle-on-tap', () => {
    expect(emptyGroove().division).toBe(16)
    expect(tapsByCycling(basicRock(16))).toBe(12)
  })

  it('at 8ths it is 12 taps plus the division change, so 13', () => {
    expect(tapsByCycling(basicRock(8)) + 1).toBe(13)
  })

  it('ghost notes are where cycling compounds: three taps for one cell', () => {
    const withGhosts = basicRock(16).map((t) => (t.voice === 'sn' ? { ...t, state: 3 } : t))
    // Two snare cells go from 1 tap each to 3.
    expect(tapsByCycling(withGhosts)).toBe(16)
  })

  it('the brush alone does not beat cycling when every state is "normal"', () => {
    // Every target is state 1 and the brush starts on normal, so both models
    // cost one interaction per cell. The brush only wins on non-default states
    // and on runs — which is why 2.1 and 2.2 have to ship together.
    expect(tapsByBrush(basicRock(16))).toBe(12)
    expect(tapsByBrush(basicRock(16))).toBe(tapsByCycling(basicRock(16)))
  })

  it('the brush wins big on ghost notes', () => {
    const withGhosts = basicRock(16).map((t) => (t.voice === 'sn' ? { ...t, state: 3 } : t))
    // One trip to the state bar for ghost, one back to normal for the kick.
    expect(tapsByBrush(withGhosts)).toBe(14)
    expect(tapsByCycling(withGhosts)).toBe(16)
  })

  it('drag only collapses runs, so on a 16ths grid it saves nothing', () => {
    // Eighths on a sixteenths grid are alternating cells, never adjacent, so
    // there is no run to drag across. This is the finding that matters: the
    // "8 taps become 1 gesture" claim needs the division to match the pattern.
    expect(gesturesByBrushDrag(basicRock(16))).toBe(12)
  })

  it('at 8ths, brush plus drag hits the target of 8 or fewer', () => {
    // 1 division change + 1 drag across the hat lane + 2 snare + 2 kick.
    expect(gesturesByBrushDrag(basicRock(8)) + 1).toBe(6)
  })
})

// The counts above are a model. This walks the same six interactions through
// the real store so the model cannot quietly drift from the editor.
describe('the modelled interactions actually build the groove', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('six interactions produce basic rock at 8ths', () => {
    const store = useGrooveStore()

    store.setDivision(8) // 1
    // The hat drag: one stroke, eight cells, one undo step.
    store.beginStroke() // 2
    for (let s = 0; s < 8; s++) store.setCell('hh', s, 1)
    store.endStroke()
    store.setCell('sn', 2, 1) // 3
    store.setCell('sn', 6, 1) // 4
    store.setCell('kk', 0, 1) // 5
    store.setCell('kk', 4, 1) // 6

    expect(store.groove.voices.hh).toEqual([1, 1, 1, 1, 1, 1, 1, 1])
    expect(store.groove.voices.sn).toEqual([0, 0, 1, 0, 0, 0, 1, 0])
    expect(store.groove.voices.kk).toEqual([1, 0, 0, 0, 1, 0, 0, 0])
  })

  it('a drag is one undo step, not one per cell', () => {
    const store = useGrooveStore()
    const painted = [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]
    store.beginStroke()
    for (let s = 0; s < 8; s++) store.setCell('hh', s, 1)
    store.endStroke()
    expect(store.groove.voices.hh).toEqual(painted)

    expect(store.canUndo).toBe(true)
    store.undo()
    expect(store.groove.voices.hh.every((v) => v === 0)).toBe(true)
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(true)

    store.redo()
    expect(store.groove.voices.hh).toEqual(painted)
  })

  it('a brush toggles: painting the value it already holds clears the cell', () => {
    const store = useGrooveStore()
    store.setBrush({ kind: 'state', value: 'accent' })
    expect(store.brushValueFor('sn', 0)).toBe(2)
    store.setCell('sn', 0, 2)
    expect(store.brushValueFor('sn', 0)).toBe(0)
  })

  it('a brush a voice does not have is a no-op, not a wrong note', () => {
    const store = useGrooveStore()
    store.setBrush({ kind: 'state', value: 'open' })
    expect(store.brushValueFor('hh', 0)).toBe(2)
    expect(store.brushValueFor('sn', 0)).toBeNull()

    store.setBrush({ kind: 'sticking', value: 'R' })
    expect(store.brushValueFor('hh', 0)).toBeNull()
    expect(store.brushStickingFor(0)).toBe('R')
  })

  it('the eraser clears whatever it touches', () => {
    const store = useGrooveStore()
    store.setCell('hh', 0, 3)
    store.setSticking(0, 'L')
    store.setBrush({ kind: 'erase' })
    expect(store.brushValueFor('hh', 0)).toBe(0)
    expect(store.brushStickingFor(0)).toBe('-')
  })
})
