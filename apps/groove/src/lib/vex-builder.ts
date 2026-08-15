import {
  Annotation,
  Articulation,
  Barline,
  Beam,
  Dot,
  Formatter,
  Fraction,
  GhostNote,
  Renderer,
  type RenderContext,
  Stave,
  StaveNote,
  Stem,
  Voice,
} from 'vexflow'
import type { Groove } from './model'
import { repeatFor } from './playback-order'
import { VOICES, type VoiceId } from './voices'

// Treble-clef line numbers per voice's `vexKey`. VexFlow's `getYForLine`
// treats line 0 as the top staff line and line 4 as the bottom; spaces and
// ledger positions are halves and negatives. Keeping this here means we
// derive marker Y from the rendered stave instead of guessing percentages.
const VOICE_LINE: Record<VoiceId, number> = {
  crash: -1, // a/5/x2 — first ledger line above the staff
  hh: -0.5, // g/5/x2 — above top line
  ride: 0, // f/5/x2 — top line
  t1: 0.5, // e/5
  t2: 1, // d/5
  sn: 1.5, // c/5
  t3: 2.5, // a/4
  kk: 3.5, // f/4
}

// Map { stepsPerBeat: { span → VexFlow duration } }. Covers 4/4 with the
// supported divisions. Dotted durations collapse "note + following empty"
// spans so beams read as one group per beat, without rest glyphs in the middle.
const DURATION_TABLE: Record<number, Record<number, string>> = {
  1: { 1: 'q' },
  2: { 1: '8', 2: 'q' },
  4: { 1: '16', 2: '8', 3: '8d', 4: 'q' },
  8: { 1: '32', 2: '16', 3: '16d', 4: '8', 6: '8d', 8: 'q' },
}

function durationForSpan(span: number, stepsPerBeat: number): string {
  const byBeat = DURATION_TABLE[stepsPerBeat]
  if (byBeat && byBeat[span]) return byBeat[span]
  // Fallback to the single-step duration (tolerates odd spans in div=32 etc.)
  const singleStep: Record<number, string> = { 1: 'q', 2: '8', 4: '16', 8: '32' }
  return singleStep[stepsPerBeat] ?? '16'
}

function hasAnyHit(g: Groove, step: number): boolean {
  for (const voice of VOICES) {
    const arr = g.voices[voice.id]
    if (arr && arr[step] !== 0) return true
  }
  return false
}

interface Built {
  keys: string[]
  duration: string
  articulations: { type: string; position: number }[]
  annotations: { text: string; justify: 'top' | 'bottom' }[]
  isRest: boolean
  span: number // number of base-division steps this tickable covers
}

function buildCellKeys(g: Groove, step: number) {
  const keys: string[] = []
  const articulations: { type: string; position: number }[] = []
  const annotations: { text: string; justify: 'top' | 'bottom' }[] = []

  for (const voice of VOICES) {
    const arr = g.voices[voice.id]
    if (!arr) continue
    const state = arr[step] ?? 0
    if (state === 0) continue
    const def = voice.states[state]
    if (!def) continue
    keys.push(def.vexKey ?? voice.vexKey)
    if (def.articulation) articulations.push({ type: def.articulation, position: 3 })
    if (def.annotation) annotations.push({ text: def.annotation, justify: 'top' })
  }
  return { keys, articulations, annotations }
}

// Single voice per measure. Within each beat, consecutive empty steps are
// absorbed into the preceding note's duration (16th → 8th → 8d → quarter).
// Leading/trailing empty steps become a rest at that beat edge, so beams can
// cover the remaining notes as one group.
// Also returns stepToBuiltIdx: for each base-division step in the measure,
// the index of the Built that covers it. Lets the step marker stay on the
// currently ringing note for steps that span multiple base positions.
function buildMainVoice(
  g: Groove,
  measureStart: number,
): { builts: Built[]; stepToBuiltIdx: number[] } {
  const div = g.division
  const stepsPerBeat = div / g.timeSig[0]
  const numBeats = g.timeSig[0]
  const builts: Built[] = []
  const stepToBuiltIdx: number[] = new Array(div)

  for (let beat = 0; beat < numBeats; beat++) {
    const beatStart = beat * stepsPerBeat
    let i = 0
    while (i < stepsPerBeat) {
      const step = measureStart + beatStart + i
      const hasNote = hasAnyHit(g, step)

      // Grow the span until the next hit or the end of the beat.
      let j = i + 1
      while (j < stepsPerBeat && !hasAnyHit(g, measureStart + beatStart + j)) {
        j++
      }
      const span = j - i
      const dur = durationForSpan(span, stepsPerBeat)
      const builtIdx = builts.length

      if (hasNote) {
        const cell = buildCellKeys(g, step)
        builts.push({
          keys: cell.keys,
          duration: dur,
          articulations: cell.articulations,
          annotations: cell.annotations,
          isRest: false,
          span,
        })
      } else {
        builts.push({
          keys: ['b/4'],
          duration: dur + 'r',
          articulations: [],
          annotations: [],
          isRest: true,
          span,
        })
      }

      for (let k = 0; k < span; k++) {
        stepToBuiltIdx[beatStart + i + k] = builtIdx
      }

      i = j
    }
  }
  return { builts, stepToBuiltIdx }
}

function toStaveNote(b: Built): StaveNote {
  const note = new StaveNote({
    keys: b.keys,
    duration: b.duration,
    auto_stem: false,
    stem_direction: Stem.UP,
  })
  note.setStemDirection(Stem.UP)
  for (const a of b.articulations) {
    note.addModifier(new Articulation(a.type).setPosition(a.position))
  }
  for (const an of b.annotations) {
    note.addModifier(new Annotation(an.text).setVerticalJustification(an.justify))
  }
  // Attach dots if the duration string ends in 'd'.
  if (b.duration.endsWith('d')) Dot.buildAndAttach([note])
  return note
}

// Lift the R/L glyphs clear of the staff top, the hi-hat x-heads (which sit
// just above the top line), and the beam group above them. Stickings live on
// invisible ghost notes, so VexFlow's 'top' justification parks them at the
// staff top — right on the x-heads — with no awareness of the main voice's
// beam. setYShift is a no-op under top/bottom justification, so we push them
// up by whole text lines instead; ~3 lines clears the beat-group beam.
const STICKING_TEXT_LINE = 3

function buildStickingNotes(g: Groove, measureStart: number): GhostNote[] {
  const div = g.division
  // Ghost notes at base step resolution. cellDuration for single step:
  const stepDur = ({ 4: 'q', 8: '8', 16: '16', 32: '32' } as Record<number, string>)[div] ?? '16'
  const notes: GhostNote[] = []
  for (let i = 0; i < div; i++) {
    const stk = g.sticking[measureStart + i]
    const n = new GhostNote(stepDur)
    if (stk && stk !== '-') {
      n.addModifier(
        new Annotation(stk).setVerticalJustification('top').setTextLine(STICKING_TEXT_LINE),
      )
    }
    notes.push(n)
  }
  return notes
}

// The "×4" over a closing repeat sign. Drawn by hand rather than as a Stave
// text modifier so it can be pinned to the barline itself: the formatter keeps
// noteheads well clear of the last ~40px of the measure, so nothing (including
// a sticking glyph, which rides above a notehead) can collide with it there.
function drawRepeatCount(ctx: RenderContext, text: string, barlineX: number, staveY: number) {
  ctx.save()
  ctx.setFont('Arial', 11, 'bold')
  let w = text.length * 6
  try {
    w = ctx.measureText(text).width
  } catch {
    // Older contexts without measureText: the estimate is close enough.
  }
  ctx.fillText(text, barlineX - w - 2, staveY - 8)
  ctx.restore()
}

export interface StepMarker {
  x: number // left edge of marker in svg pixels
  width: number // width of marker in svg pixels
  y: number // top of the row band this step lives in (drives the playhead bar + per-row marker offset)
  height: number // row band height in svg pixels
}

export interface MeasureBounds {
  x: number // left edge of the measure (incl. clef/time-sig area on m=0) in svg pixels
  width: number
  y: number // top of the row band this measure lives in
  height: number // row band height in svg pixels
}

export interface RenderResult {
  svg: SVGSVGElement | null
  height: number
  stepMarkers: StepMarker[] // one per step in the whole groove, pointing at the note that rings during that step
  voiceY: Record<VoiceId, number> // exact Y in svg pixels per voice — drives live MIDI marker placement on the staff
  measureBounds: MeasureBounds[] // one per measure — drives click-to-select-measure in the editor
}

/**
 * Widest measure in the groove, as the formatter measures it.
 *
 * VexFlow can tell us the minimum room a set of voices needs, so we ask rather
 * than estimate. The voices built here are throwaway: formatting mutates note
 * state, so the render loop builds its own.
 */
function measureContentWidth(g: Groove): number {
  const stepsPerMeasure = g.division
  let widest = 0

  for (let m = 0; m < g.measures; m++) {
    const measureStart = m * stepsPerMeasure
    const { builts } = buildMainVoice(g, measureStart)

    const mainVoice = new Voice({ num_beats: g.timeSig[0], beat_value: g.timeSig[1] })
    mainVoice.setStrict(false)
    mainVoice.addTickables(builts.map((b) => toStaveNote(b)))

    const stickingVoice = new Voice({ num_beats: g.timeSig[0], beat_value: g.timeSig[1] })
    stickingVoice.setStrict(false)
    stickingVoice.addTickables(buildStickingNotes(g, measureStart))

    const voices = [mainVoice, stickingVoice]
    const formatter = new Formatter().joinVoices(voices)
    widest = Math.max(widest, formatter.preCalculateMinTotalWidth(voices))
  }

  return widest
}

export function renderScore(
  container: HTMLDivElement,
  g: Groove,
  opts: { width?: number; singleRow?: boolean } = {},
): RenderResult {
  container.innerHTML = ''
  const stepsPerMeasure = g.division
  const measures = g.measures
  const width = opts.width ?? Math.max(360, container.clientWidth || 720)

  // Wrap measures onto new rows once they'd get too narrow to read, like a real
  // score. A handful of measures still stretch to fill the available width.
  const PADDING_X = 20
  const ROW_HEIGHT = 120
  const STAVE_TOP_IN_ROW = 40 // headroom above each stave for the sticking glyphs
  // Room reserved on a stave for the clef and time signature, which only the
  // first measure carries. Measured from the stave itself further down; this is
  // the up-front allowance so the width maths can account for it.
  const FIRST_MEASURE_CHROME = 60
  // Padding between the last notehead and the closing barline.
  const NOTE_AREA_PAD = 20

  // Each measure needs room to space its steps legibly. Rather than guess from
  // the step count — `stepsPerMeasure * 16` under-reserved badly, leaving 16ths
  // with roughly half the room they need and spilling them past the barline —
  // ask the formatter what the notes actually measure.
  //
  // If even one measure can't fit the container we keep it at this width and let
  // the score-host scroll, rather than handing the formatter too little width
  // and pushing notes past the barline.
  const minMeasureW = Math.max(240, measureContentWidth(g) + FIRST_MEASURE_CHROME + NOTE_AREA_PAD)
  const avail = Math.max(minMeasureW, width - PADDING_X * 2)
  // During playback we lay every measure on one horizontal row so the chart can
  // scroll behind a centered playhead instead of wrapping out of view.
  const perRow = opts.singleRow
    ? measures
    : Math.min(measures, Math.max(1, Math.floor(avail / minMeasureW)))
  const rows = Math.ceil(measures / perRow)
  const measureWidth = Math.max(minMeasureW, avail / perRow)
  const totalWidth = PADDING_X * 2 + measureWidth * perRow
  const height = rows * ROW_HEIGHT + 20

  const renderer = new Renderer(container, Renderer.Backends.SVG)
  renderer.resize(totalWidth, height)
  const ctx = renderer.getContext()
  ctx.setFont('Arial', 10)

  // Simple meters only for now — beat group = 1/4. TODO: 6/8 etc.
  const beatGroup = new Fraction(1, 4)
  const stepMarkers: StepMarker[] = []
  const voiceY = {} as Record<VoiceId, number>
  const measureBounds: MeasureBounds[] = []

  for (let m = 0; m < measures; m++) {
    const row = Math.floor(m / perRow)
    const col = m % perRow
    const rowTop = row * ROW_HEIGHT
    const staveX = PADDING_X + col * measureWidth
    const staveY = rowTop + STAVE_TOP_IN_ROW
    measureBounds.push({ x: staveX, y: rowTop, width: measureWidth, height: ROW_HEIGHT })
    const stave = new Stave(staveX, staveY, measureWidth)
    if (m === 0) stave.addClef('percussion').addTimeSignature(`${g.timeSig[0]}/${g.timeSig[1]}`)
    // One repeat block per measure. Two adjacent bars that both repeat get two
    // blocks rather than one bracket around the pair, which is what the model
    // says: each measure repeats on its own before the next one starts.
    const repeat = repeatFor(g, m)
    if (repeat > 1) {
      stave.setBegBarType(Barline.type.REPEAT_BEGIN)
      stave.setEndBarType(Barline.type.REPEAT_END)
    }
    stave.setContext(ctx).draw()
    if (repeat > 1) drawRepeatCount(ctx, `×${repeat}`, staveX + measureWidth, staveY)

    // Lines are identical across rows — capture the row-0 stave Y per voice.
    // Live markers on lower rows reuse this base and add their rowTop offset.
    if (m === 0) {
      for (const v of VOICES) voiceY[v.id] = stave.getYForLine(VOICE_LINE[v.id])
    }

    const measureStart = m * stepsPerMeasure
    const { builts, stepToBuiltIdx } = buildMainVoice(g, measureStart)
    const mainNotes = builts.map((b) => toStaveNote(b))

    const mainVoice = new Voice({ num_beats: g.timeSig[0], beat_value: g.timeSig[1] })
    mainVoice.setStrict(false)
    mainVoice.addTickables(mainNotes)

    const stickingNotes = buildStickingNotes(g, measureStart)
    const stickingVoice = new Voice({ num_beats: g.timeSig[0], beat_value: g.timeSig[1] })
    stickingVoice.setStrict(false)
    stickingVoice.addTickables(stickingNotes)

    // Format into the stave's real note area. A flat allowance would ignore the
    // clef and time signature that only the first measure carries, so its notes
    // would be laid out for more room than they have and run past the barline.
    const noteAreaW = Math.max(40, measureWidth - (stave.getNoteStartX() - staveX) - NOTE_AREA_PAD)

    new Formatter()
      .joinVoices([mainVoice, stickingVoice])
      .format([mainVoice, stickingVoice], noteAreaW)

    for (const n of mainNotes) if (!n.isRest()) n.setStemDirection(Stem.UP)

    const mainBeams = Beam.generateBeams(mainNotes, {
      groups: [beatGroup],
      beam_rests: false,
      maintain_stem_directions: true,
      stem_direction: Stem.UP,
    })

    // NOTE: don't call setStemDirection on notes after beam generation — it
    // calls reset() internally, which clears the note's beam reference and
    // causes flags to render alongside the beam.

    mainVoice.draw(ctx, stave)
    stickingVoice.draw(ctx, stave)
    mainBeams.forEach((b) => b.setContext(ctx).draw())

    // Per-step markers: fixed-width highlight centered on the notehead of the
    // note currently ringing. Steps that share a note (e.g. an 8th covering
    // two 16th positions) resolve to the same marker, so the highlight stays
    // put while the note sustains.
    // getNoteHeadBeginX/EndX give the actual notehead glyph bounds — cleaner
    // than getAbsoluteX which is the tick-context X and sits slightly left.
    const markerWidth = 18
    for (let s = 0; s < stepsPerMeasure; s++) {
      const bIdx = stepToBuiltIdx[s]
      const note = mainNotes[bIdx] as StaveNote & {
        getNoteHeadBeginX?: () => number
        getNoteHeadEndX?: () => number
      }
      const headBegin = note.getNoteHeadBeginX?.() ?? note.getAbsoluteX()
      const headEnd = note.getNoteHeadEndX?.() ?? headBegin + 10
      const center = (headBegin + headEnd) / 2
      stepMarkers.push({
        x: center - markerWidth / 2,
        width: markerWidth,
        y: row * ROW_HEIGHT,
        height: ROW_HEIGHT,
      })
    }
  }

  return {
    svg: container.querySelector('svg') as SVGSVGElement | null,
    height,
    stepMarkers,
    voiceY,
    measureBounds,
  }
}
