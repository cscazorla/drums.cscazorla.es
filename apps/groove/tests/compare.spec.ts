import { describe, expect, it } from 'vitest'
import { decode, encode } from '../src/lib/codec'
import { emptyGroove, type HatValue, type NoteValue } from '../src/lib/model'

// Reference GrooveScribe URL:
//   https://guisso.dev/GrooveScribe/?Mode=view&TimeSig=4/4&Div=16&Tempo=80&Measures=1
//   &H=|x-x-x-x-x-x-x-x-|   hi-hat normal closed on every 8th
//   &S=|----O-------O---|   snare accent on beats 2 and 4
//   &K=|o--o------o-----|   kick on 1, the "e" of 1, and on beat 3
//
// GrooveScribe char mapping:
//   hi-hat:  x = closed, o = open, X = accent, f = pedal
//   snare:   o = normal, O = accent, g = ghost
//   kick:    o = normal

describe('comparison grooves', () => {
  it('reproduces the guisso.dev/GrooveScribe sample', () => {
    const g = emptyGroove({ division: 16, measures: 1, tempo: 80 })

    const hh: HatValue[] = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
    const sn: NoteValue[] = [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0]
    const kk: NoteValue[] = [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]

    for (let i = 0; i < 16; i++) {
      g.voices.hh[i] = hh[i]
      g.voices.sn[i] = sn[i]
      g.voices.kk[i] = kk[i]
    }

    const payload = encode(g)

    console.log('\n--- Groove URLs ---')

    console.log('  payload         :', payload)

    console.log('  payload length  :', payload.length, 'chars')

    console.log('  editor (dev)    : http://localhost:5173/#/g/' + payload)

    console.log('  embed readonly  : http://localhost:5173/#/embed/g/' + payload + '?ro=1')

    console.log('  embed playable  : http://localhost:5173/#/embed/g/' + payload)

    const back = decode(payload)!
    expect(back.voices.hh).toEqual(hh)
    expect(back.voices.sn).toEqual(sn)
    expect(back.voices.kk).toEqual(kk)
    expect(back.tempo).toBe(80)
    expect(back.division).toBe(16)
    expect(back.measures).toBe(1)
  })
})
