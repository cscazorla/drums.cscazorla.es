import { describe, expect, it } from 'vitest'
import { decode, encode } from '../src/lib/codec'
import { emptyGroove, resizeArrays, type HatValue, type NoteValue } from '../src/lib/model'
import { VOICE_BY_ID, VOICE_IDS } from '../src/lib/voices'

function random<T>(xs: readonly T[]): T {
  return xs[Math.floor(Math.random() * xs.length)]
}

describe('codec', () => {
  it('round-trips an empty groove', () => {
    const g = emptyGroove()
    const decoded = decode(encode(g))
    expect(decoded).toEqual(g)
  })

  it('encodes the default empty groove to a very short URL', () => {
    const g = emptyGroove()
    const p = encode(g)
    expect(p.length).toBeLessThan(20)
  })

  it('round-trips 50 random grooves with title/author', () => {
    for (let iter = 0; iter < 50; iter++) {
      const g = resizeArrays(
        emptyGroove({
          tempo: 60 + Math.floor(Math.random() * 180),
          swing: Math.floor(Math.random() * 80),
          division: random([8, 12, 16, 24] as const),
          measures: 1 + Math.floor(Math.random() * 4),
          title: 'G' + iter,
          author: iter % 2 ? 'me' : '',
        }),
      )
      for (let i = 0; i < g.voices.hh.length; i++) {
        g.voices.hh[i] = Math.floor(Math.random() * 5) as HatValue
        g.voices.sn[i] = Math.floor(Math.random() * 4) as NoteValue
        g.voices.kk[i] = Math.floor(Math.random() * 4) as NoteValue
        g.sticking[i] = random(['-', 'R', 'L', 'B'] as const)
      }
      const decoded = decode(encode(g))
      expect(decoded).toEqual(g)
    }
  })

  it('keeps typical 16-step grooves under 50 url chars', () => {
    const g = emptyGroove()
    for (let i = 0; i < 16; i++) g.voices.hh[i] = 1 as HatValue
    g.voices.sn[4] = 1
    g.voices.sn[12] = 1
    g.voices.kk[0] = 1
    g.voices.kk[8] = 1
    const p = encode(g)
    expect(p.length).toBeLessThan(50)
  })

  it('returns null for garbage', () => {
    expect(decode('!!!not-valid!!!')).toBeNull()
    expect(decode('')).toBeNull()
  })

  it('round-trips a groove with toms and ride', () => {
    const g = emptyGroove()
    const n = g.voices.hh.length
    g.voices.t1 = new Array(n).fill(0)
    g.voices.t2 = new Array(n).fill(0)
    g.voices.t3 = new Array(n).fill(0)
    g.voices.ride = new Array(n).fill(0)
    g.voices.t1[0] = 1
    g.voices.t1[4] = 2
    g.voices.t2[2] = 1
    g.voices.t2[6] = 3
    g.voices.t3[8] = 1
    g.voices.t3[12] = 3
    g.voices.ride[0] = 1
    g.voices.ride[2] = 2
    const decoded = decode(encode(g))!
    expect(decoded.voices.t1).toEqual(g.voices.t1)
    expect(decoded.voices.t2).toEqual(g.voices.t2)
    expect(decoded.voices.t3).toEqual(g.voices.t3)
    expect(decoded.voices.ride).toEqual(g.voices.ride)
  })

  it('round-trips a groove with every voice present', () => {
    const g = emptyGroove()
    const n = g.voices.hh.length
    for (const [i, id] of VOICE_IDS.entries()) {
      const states = VOICE_BY_ID[id].states.length
      g.voices[id] = new Array(n).fill(0)
      // Something non-zero in every voice, so each presence bit is exercised.
      g.voices[id]![i] = 1 + (i % (states - 1))
    }
    const decoded = decode(encode(g))!
    for (const id of VOICE_IDS) expect(decoded.voices[id]).toEqual(g.voices[id])
  })

  it('omits a voice whose presence bit is clear', () => {
    // Appending a voice must not shift the layout: a groove with no crash
    // encodes the same bytes a pre-crash build produced, and its clear bit 7
    // must leave the crash lane absent rather than eat the trailer.
    const g = emptyGroove()
    g.voices.hh[0] = 1
    g.voices.sn[4] = 1
    const decoded = decode(encode(g))!
    expect(decoded.voices.crash).toBeUndefined()
  })

  it('decodes a known v3 payload (legacy URL compat)', () => {
    // Captured from the previous codec on the GrooveScribe sample groove
    // (16 steps, tempo 80, hh on every 8th, snare on 2 and 4, kick on 1, "e" of 1, and 3).
    const v3Payload = 'A1AAAEQBBEQggggggggAgACAQQAEAA'
    const decoded = decode(v3Payload)!
    expect(decoded).not.toBeNull()
    expect(decoded.tempo).toBe(80)
    expect(decoded.division).toBe(16)
    expect(decoded.measures).toBe(1)
    expect(decoded.voices.hh).toEqual([1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0])
    expect(decoded.voices.sn).toEqual([0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0])
    expect(decoded.voices.kk).toEqual([1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0])
  })
})
