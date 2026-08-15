import { describe, expect, it } from 'vitest'
import { applyPreset, PRESETS } from '@/lib/presets'
import { emptyGroove, type Division } from '@/lib/model'

function preset(id: string) {
  const p = PRESETS.find((x) => x.id === id)
  if (!p) throw new Error(`no preset ${id}`)
  return p
}

describe('presets', () => {
  it('fills basic rock correctly at 16ths', () => {
    const g = emptyGroove({ division: 16 })
    const { voices, droppedNotes } = applyPreset(g, preset('rock'), 0)
    expect(droppedNotes).toBe(0)
    expect(voices.hh).toEqual([1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0])
    expect(voices.sn).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0])
    expect(voices.kk).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0])
  })

  it('fills the same shape at 8ths', () => {
    const g = emptyGroove({ division: 8 })
    const { voices, droppedNotes } = applyPreset(g, preset('rock'), 0)
    expect(droppedNotes).toBe(0)
    expect(voices.hh).toEqual([1, 1, 1, 1, 1, 1, 1, 1])
    expect(voices.sn).toEqual([0, 0, 1, 0, 0, 0, 1, 0])
    expect(voices.kk).toEqual([1, 0, 0, 0, 1, 0, 0, 0])
  })

  it('reports notes the division is too coarse to hold', () => {
    // Sixteenth-note hats cannot land on an eighth-note grid: the eight
    // off-grid positions are dropped and counted, not silently lost.
    const g = emptyGroove({ division: 8 })
    const { voices, droppedNotes } = applyPreset(g, preset('hats16'), 0)
    expect(droppedNotes).toBe(8)
    expect(voices.hh).toEqual([1, 1, 1, 1, 1, 1, 1, 1])
  })

  it('only touches the selected measure', () => {
    const g = emptyGroove({ division: 8, measures: 2 })
    g.voices.sn = [0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3]
    const { voices } = applyPreset(g, preset('rock'), 0)
    // Bar 2 keeps its ghost notes untouched.
    expect(voices.sn?.slice(8)).toEqual([3, 3, 3, 3, 3, 3, 3, 3])
    expect(voices.sn?.slice(0, 8)).toEqual([0, 0, 1, 0, 0, 0, 1, 0])
  })

  it('replaces rather than merges, so a preset is predictable', () => {
    const g = emptyGroove({ division: 8 })
    g.voices.hh = [1, 1, 1, 1, 1, 1, 1, 1]
    const { voices } = applyPreset(g, preset('four'), 0)
    expect(voices.kk).toEqual([1, 0, 1, 0, 1, 0, 1, 0])
    expect(voices.hh).toEqual([1, 1, 1, 1, 1, 1, 1, 1])
  })

  it('every preset applies cleanly at 16ths', () => {
    const divisions: Division[] = [16]
    for (const d of divisions) {
      for (const p of PRESETS) {
        const g = emptyGroove({ division: d })
        expect(applyPreset(g, p, 0).droppedNotes).toBe(0)
      }
    }
  })
})
