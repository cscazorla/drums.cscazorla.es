import { describe, it } from 'vitest'
import { encode } from '../src/lib/codec'
import { emptyGroove, type HatValue, type NoteValue } from '../src/lib/model'

describe('url sizes (informational)', () => {
  it('prints sizes for common grooves', () => {
    const samples: { name: string; g: ReturnType<typeof emptyGroove> }[] = []

    samples.push({ name: 'empty default (16ths × 1)', g: emptyGroove() })

    const twoBar = emptyGroove({
      division: 16,
      measures: 2,
      tempo: 120,
      swing: 40,
      title: 'Purdie Shuffle',
      author: 'me',
    })
    for (let i = 0; i < twoBar.voices.hh.length; i++) twoBar.voices.hh[i] = 1
    twoBar.voices.sn[4] = 1 as NoteValue
    twoBar.voices.sn[12] = 2 as NoteValue
    twoBar.voices.kk[0] = 1 as NoteValue
    twoBar.voices.kk[10] = 1 as NoteValue
    samples.push({ name: '2-measure w/ title+author', g: twoBar })

    const dense = emptyGroove({ division: 32, measures: 4 })
    for (let i = 0; i < dense.voices.hh.length; i++) {
      dense.voices.hh[i] = Math.floor(Math.random() * 5) as HatValue
      dense.voices.sn[i] = Math.floor(Math.random() * 4) as NoteValue
      dense.voices.kk[i] = Math.floor(Math.random() * 4) as NoteValue
    }
    samples.push({ name: 'dense 4-measure 32nds', g: dense })

    console.log('\n--- URL payload sizes ---')
    for (const s of samples) {
      const len = encode(s.g).length

      console.log(`  ${s.name.padEnd(32)} → ${len} chars`)
    }
  })
})
