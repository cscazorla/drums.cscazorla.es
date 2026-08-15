import { describe, expect, it } from 'vitest'
import { VOICES, stateForBrush, voiceForMidiNote } from '../src/lib/voices'

describe('voices', () => {
  it('fits the codec 1-byte presence bitmap', () => {
    expect(VOICES.length).toBeLessThanOrEqual(8)
  })

  it('maps a kit cymbal hit to the voice that plays it', () => {
    expect(voiceForMidiNote(49)).toBe('crash')
    expect(voiceForMidiNote(57)).toBe('crash') // crash 2
    expect(voiceForMidiNote(52)).toBe('crash') // china
    expect(voiceForMidiNote(55)).toBe('crash') // splash
    expect(voiceForMidiNote(51)).toBe('ride')
    expect(voiceForMidiNote(53)).toBe('ride') // ride bell
    expect(voiceForMidiNote(59)).toBe('ride') // ride 2
    expect(voiceForMidiNote(42)).toBe('hh')
    expect(voiceForMidiNote(46)).toBe('hh') // open
    expect(voiceForMidiNote(44)).toBe('hh') // pedal
  })

  it('maps the kit pads that share a voice with a drum', () => {
    expect(voiceForMidiNote(38)).toBe('sn')
    expect(voiceForMidiNote(37)).toBe('sn') // rim
    expect(voiceForMidiNote(36)).toBe('kk')
    expect(voiceForMidiNote(48)).toBe('t1')
    expect(voiceForMidiNote(45)).toBe('t2')
    expect(voiceForMidiNote(43)).toBe('t3')
  })

  it('returns null for a note no voice claims', () => {
    expect(voiceForMidiNote(60)).toBeNull()
  })

  it('gives the crash no ghost state', () => {
    expect(stateForBrush('crash', 'normal')).toBe(1)
    expect(stateForBrush('crash', 'accent')).toBe(2)
    expect(stateForBrush('crash', 'ghost')).toBeNull()
  })
})
