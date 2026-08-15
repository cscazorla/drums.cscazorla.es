# Measure repeats

## Why

A groove is not always "play all bars once and loop the whole thing". A study piece is
usually "bar 1 four times, bar 2 twice, bar 3 once", which is exactly what a repeat sign
means on paper. Today the editor can only loop the whole track, so the only way to spell
"×4" is to duplicate the bar four times, which burns the 8-measure budget, bloats the URL,
and makes an edit four edits.

## Scope

- A per-measure repeat count, 1..16, part of the groove and therefore part of the URL.
- Playback expands the repeats: measure 1 sounds `repeats[0]` times before measure 2 starts.
- The staff draws real repeat barlines (`|: … :|`) plus a `×N` over the closing sign.
- The MIDI export writes the expanded track, so the file sounds like the app does.
- The grid shows which repetition is currently sounding, because otherwise the fourth pass
  through bar 1 is indistinguishable from the first.

## Out of scope

- Multi-measure repeat brackets (`|: bar1 bar2 :| ×2`). One repeat spans exactly one bar.
  Two adjacent bars with the same count render as two separate blocks, which is correct
  notation for what the model says, just not the most compact way to write it.
- Voltas (first/second endings). Nothing in the model can express a different ending.
- Repeats in the interaction/undo model beyond a plain history entry per change.

## Model

`Groove.repeats: number[]`, always exactly `measures` long, every entry in `1..MAX_REPEAT`
(16). `resizeArrays` normalizes it the same way it normalizes the cell arrays, so a groove
that comes from an old URL, an undo snapshot, or a hand-built literal always has a valid
array. A count of 1 means "no repeat", which is the default and what every existing groove
decodes to.

`repeats` lives in the URL, not in `localStorage`: it is part of the piece, not a practice
preference.

## Wire format

No version bump. v4 byte 6 had one spare flag bit:

- bit 7 = `hasRepeats`, set only when some measure repeats more than once.
- When set, `measures × 4` bits are written after the sticking block and before the
  title/author trailer, each holding `repeat - 1` (so 4 bits cover 1..16).

A groove with no repeats therefore encodes to exactly the bytes it encoded to before this
feature, and every URL already in the wild decodes with `repeats` filled with 1s.

## Playback

`expandTimeline(g)` (in `src/lib/playback-order.ts`) turns the groove into the list of slots
that actually sound: for each measure, `repeats[m]` copies of its steps. Each slot carries
the grid `step` it reads from, its `measure`, and its 1-based `pass`.

`usePlayback` schedules one event per slot instead of one per step. `currentStep` still
reports a **grid** step, so the score marker, the grid highlight and the MIDI grading keep
working untouched; the same step index simply comes round more than once. Loop detection
moved from "the drawn step wrapped to 0" to "the expanded index wrapped to 0", because with
repeats step 0 recurs inside a single pass through the track. `currentPass` is new and is
what the grid renders as "pass 2/4".

The transport-level `loop` toggle is unchanged and sits on top: it repeats the whole
expanded track.
