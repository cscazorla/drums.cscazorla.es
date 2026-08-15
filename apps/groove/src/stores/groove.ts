import { defineStore } from 'pinia'
import {
  cycleSticking,
  cycleVoiceCell,
  emptyGroove,
  resizeArrays,
  MAX_REPEAT,
  type Division,
  type Groove,
  type Sticking,
} from '@/lib/model'
import { VOICES, stateForBrush, type BrushState, type VoiceId } from '@/lib/voices'
import { applyPreset, type Preset } from '@/lib/presets'

// What a tap on a cell paints. `erase` clears; `sticking` only applies to the
// sticking row and `state` only to the note lanes, so exactly one half of the
// grid is live at a time. `pan` paints nothing at all: it hands the horizontal
// axis back to the browser so a finger can scroll the grid, which is otherwise
// impossible once dragging means painting.
export type Brush =
  | { kind: 'state'; value: BrushState }
  | { kind: 'erase' }
  | { kind: 'sticking'; value: Exclude<Sticking, '-'> }
  | { kind: 'pan' }

const HISTORY_LIMIT = 60

interface State {
  groove: Groove
  selectedMeasure: number
  brush: Brush
  past: string[]
  future: string[]
  // Depth of the current paint stroke. A drag across twenty cells is one undo
  // step, not twenty, so history is suspended between pointerdown and pointerup.
  stroke: number
}

export const useGrooveStore = defineStore('groove', {
  state: (): State => ({
    groove: emptyGroove(),
    selectedMeasure: 0,
    brush: { kind: 'state', value: 'normal' },
    past: [],
    future: [],
    stroke: 0,
  }),
  getters: {
    canUndo: (s) => s.past.length > 0,
    canRedo: (s) => s.future.length > 0,
  },
  actions: {
    replace(g: Groove) {
      this.groove = resizeArrays(g)
      this.selectedMeasure = Math.max(0, Math.min(this.selectedMeasure, this.groove.measures - 1))
    },
    reset() {
      this.groove = emptyGroove()
      this.selectedMeasure = 0
      this.past = []
      this.future = []
    },
    setSelectedMeasure(m: number) {
      const max = this.groove.measures - 1
      this.selectedMeasure = Math.max(0, Math.min(max, Math.round(m)))
    },
    setTitle(t: string) {
      this.groove.title = t
    },
    setAuthor(a: string) {
      this.groove.author = a
    },
    setTempo(bpm: number) {
      this.groove.tempo = Math.max(30, Math.min(300, Math.round(bpm)))
    },
    setSwing(pct: number) {
      this.groove.swing = Math.max(0, Math.min(100, Math.round(pct)))
    },
    setDivision(d: Division) {
      this.pushHistory()
      this.groove.division = d
      this.groove = resizeArrays(this.groove)
    },
    setMeasures(m: number) {
      this.pushHistory()
      this.groove.measures = Math.max(1, Math.min(8, Math.round(m)))
      this.groove = resizeArrays(this.groove)
      if (this.selectedMeasure > this.groove.measures - 1) {
        this.selectedMeasure = this.groove.measures - 1
      }
    },
    setRepeat(measure: number, n: number) {
      if (measure < 0 || measure >= this.groove.measures) return
      const val = Math.max(1, Math.min(MAX_REPEAT, Math.round(n)))
      if (this.groove.repeats[measure] === val) return
      this.pushHistory()
      this.groove.repeats[measure] = val
    },
    toggleMetronome() {
      this.groove.metronome = !this.groove.metronome
    },
    toggleCountIn() {
      this.groove.countIn = !this.groove.countIn
    },
    toggleLoop() {
      this.groove.loop = !this.groove.loop
    },

    setBrush(b: Brush) {
      this.brush = b
    },

    pushHistory() {
      if (this.stroke > 0) return
      this.past.push(JSON.stringify(this.groove))
      if (this.past.length > HISTORY_LIMIT) this.past.shift()
      this.future = []
    },
    beginStroke() {
      if (this.stroke === 0) this.pushHistory()
      this.stroke++
    },
    endStroke() {
      this.stroke = Math.max(0, this.stroke - 1)
    },
    undo() {
      const prev = this.past.pop()
      if (!prev) return
      this.future.push(JSON.stringify(this.groove))
      this.groove = resizeArrays(JSON.parse(prev) as Groove)
      this.setSelectedMeasure(this.selectedMeasure)
    },
    redo() {
      const next = this.future.pop()
      if (!next) return
      this.past.push(JSON.stringify(this.groove))
      this.groove = resizeArrays(JSON.parse(next) as Groove)
      this.setSelectedMeasure(this.selectedMeasure)
    },

    // The value the active brush would write into this cell. Null means the
    // brush does not apply here (a sticking brush over a note lane, or a state
    // the voice does not have). A cell that already holds the brush's value
    // erases instead, which is what makes one brush a toggle.
    brushValueFor(voice: VoiceId, i: number): number | null {
      if (this.brush.kind === 'pan' || this.brush.kind === 'sticking') return null
      if (this.brush.kind === 'erase') return 0
      const target = stateForBrush(voice, this.brush.value)
      if (target === null) return null
      const current = this.groove.voices[voice]?.[i] ?? 0
      return current === target ? 0 : target
    },
    brushStickingFor(i: number): Sticking | null {
      if (this.brush.kind === 'pan' || this.brush.kind === 'state') return null
      if (this.brush.kind === 'erase') return '-'
      return this.groove.sticking[i] === this.brush.value ? '-' : this.brush.value
    },

    cycleCell(voice: VoiceId, i: number) {
      this.pushHistory()
      const n = this.groove.voices.hh.length
      if (!this.groove.voices[voice]) {
        this.groove.voices[voice] = new Array(n).fill(0)
      }
      const arr = this.groove.voices[voice]!
      arr[i] = cycleVoiceCell(voice, arr[i])
    },
    setCell(voice: VoiceId, i: number, val: number) {
      const n = this.groove.voices.hh.length
      if (!this.groove.voices[voice]) {
        this.groove.voices[voice] = new Array(n).fill(0)
      }
      if (this.groove.voices[voice]![i] === val) return
      this.pushHistory()
      this.groove.voices[voice]![i] = val
    },
    cycleSticking(i: number) {
      this.pushHistory()
      this.groove.sticking[i] = cycleSticking(this.groove.sticking[i])
    },
    setSticking(i: number, val: Sticking) {
      if (this.groove.sticking[i] === val) return
      this.pushHistory()
      this.groove.sticking[i] = val
    },
    // Fill the selected measure from a preset. One history entry, so a preset
    // that was not what you wanted costs a single undo.
    applyPreset(preset: Preset): number {
      this.pushHistory()
      const { voices, droppedNotes } = applyPreset(this.groove, preset, this.selectedMeasure)
      for (const [id, arr] of Object.entries(voices)) {
        this.groove.voices[id as VoiceId] = arr
      }
      return droppedNotes
    },
    clearAll() {
      this.pushHistory()
      const n = this.groove.voices.hh?.length ?? this.groove.division * this.groove.measures
      for (const v of VOICES) {
        const arr = this.groove.voices[v.id]
        if (arr) this.groove.voices[v.id] = new Array(n).fill(0)
      }
      this.groove.sticking = new Array(n).fill('-')
    },
  },
})
