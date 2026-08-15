import { Midi } from '@tonejs/midi'
import type { Groove } from './model'
import { expandTimeline } from './playback-order'
import { VOICES } from './voices'

function stepDurationSec(g: Groove): number {
  const beatsPerSec = g.tempo / 60
  const stepsPerBeat = g.division / g.timeSig[0]
  return 1 / (beatsPerSec * stepsPerBeat)
}

export async function exportMidi(g: Groove) {
  const midi = new Midi()
  midi.header.setTempo(g.tempo)
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: g.timeSig })
  const track = midi.addTrack()
  track.channel = 9 // GM drum channel (0-indexed)
  track.name = g.title || 'Groove'

  const step = stepDurationSec(g)
  const dur = step * 0.9
  // Repeats are written out rather than left implicit: a MIDI file has no
  // repeat sign, so the export has to sound like the app does.
  const slots = expandTimeline(g)

  for (const voice of VOICES) {
    const arr = g.voices[voice.id]
    if (!arr) continue
    for (let i = 0; i < slots.length; i++) {
      const state = arr[slots[i].step] ?? 0
      if (state === 0) continue
      const def = voice.states[state]
      if (!def || def.midi == null || def.velocity == null) continue
      track.addNote({
        midi: def.midi,
        time: step * i,
        duration: dur,
        velocity: def.velocity,
      })
    }
  }

  const blob = new Blob([midi.toArray()], { type: 'audio/midi' })
  download(blob, `${(g.title || 'groove').replace(/\s+/g, '_')}.mid`)
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
