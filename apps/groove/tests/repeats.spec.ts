import { describe, expect, it } from 'vitest'
import { decode, encode } from '../src/lib/codec'
import { emptyGroove, normalizeRepeats, resizeArrays, MAX_REPEAT } from '../src/lib/model'
import { expandTimeline, hasRepeats, playedStepCount, repeatFor } from '../src/lib/playback-order'

describe('repeats model', () => {
  it('defaults every measure to one pass', () => {
    const g = emptyGroove({ measures: 3 })
    expect(g.repeats).toEqual([1, 1, 1])
    expect(hasRepeats(g)).toBe(false)
  })

  it('keeps the array the same length as the measure count', () => {
    const g = emptyGroove({ division: 8, measures: 3, repeats: [4, 2, 1] })
    const grown = resizeArrays({ ...g, measures: 4 })
    expect(grown.repeats).toEqual([4, 2, 1, 1])
    const shrunk = resizeArrays({ ...g, measures: 2 })
    expect(shrunk.repeats).toEqual([4, 2])
  })

  it('clamps out-of-range and junk values', () => {
    expect(normalizeRepeats([0, -3, 99, Number.NaN], 4)).toEqual([1, 1, MAX_REPEAT, 1])
    expect(normalizeRepeats(undefined, 2)).toEqual([1, 1])
    expect(repeatFor({ division: 16, measures: 1, repeats: [0] }, 0)).toBe(1)
    // A measure the array does not reach reads as a single pass, not undefined.
    expect(repeatFor({ division: 16, measures: 2, repeats: [3] }, 1)).toBe(1)
  })
})

describe('expandTimeline', () => {
  it('is the identity when nothing repeats', () => {
    const g = emptyGroove({ division: 4, measures: 2 })
    expect(expandTimeline(g).map((s) => s.step)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('plays each measure its own number of times, in order', () => {
    const slots = expandTimeline({ division: 4, measures: 2, repeats: [3, 2] })
    expect(slots.map((s) => s.step)).toEqual([
      0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 4, 5, 6, 7, 4, 5, 6, 7,
    ])
    expect(slots.map((s) => s.pass)).toEqual([
      1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 1, 1, 1, 1, 2, 2, 2, 2,
    ])
    expect(new Set(slots.slice(0, 12).map((s) => s.measure))).toEqual(new Set([0]))
    expect(new Set(slots.slice(12).map((s) => s.measure))).toEqual(new Set([1]))
  })

  it('counts the expanded length', () => {
    const g = emptyGroove({ division: 16, measures: 2, repeats: [4, 2] })
    expect(playedStepCount(g)).toBe(16 * 6)
    expect(expandTimeline(g)).toHaveLength(16 * 6)
  })
})

describe('repeats codec', () => {
  it('round-trips per-measure repeat counts', () => {
    const g = resizeArrays(emptyGroove({ division: 8, measures: 3, repeats: [4, 2, 1] }))
    g.voices.kk[0] = 1
    const decoded = decode(encode(g))!
    expect(decoded.repeats).toEqual([4, 2, 1])
    expect(decoded).toEqual(g)
  })

  it('round-trips the maximum count alongside sticking and a title', () => {
    const g = resizeArrays(
      emptyGroove({ division: 8, measures: 2, repeats: [MAX_REPEAT, 7], title: 'Tocata' }),
    )
    g.sticking[0] = 'R'
    g.sticking[3] = 'L'
    const decoded = decode(encode(g))!
    expect(decoded).toEqual(g)
  })

  it('costs nothing when no measure repeats', () => {
    // The flag bit was spare in v4, so a groove without repeats has to encode to
    // exactly the bytes it did before repeats existed, and every URL already
    // shared has to come back with a full array of ones.
    const g = emptyGroove({ measures: 2 })
    g.voices.hh[0] = 1
    const withField = encode(g)
    const legacy = encode({ ...g, repeats: [] as number[] })
    expect(withField).toEqual(legacy)
    expect(decode(withField)!.repeats).toEqual([1, 1])
  })

  it('gives a legacy v3 payload a default repeat array', () => {
    const decoded = decode('A1AAAEQBBEQggggggggAgACAQQAEAA')!
    expect(decoded.repeats).toEqual([1])
  })
})
