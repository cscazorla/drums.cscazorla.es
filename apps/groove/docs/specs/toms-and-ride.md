# Phase 2 — Toms and ride lane

## Why

The `Groove.voices` schema reserves `t1`, `t4`, `cy` slots, but they have no UI lane, no playback synth, and the renderer does not place them on the staff. The Aroma TDX 15S kit (Phase 3 target) has three toms plus a ride; without lanes for them, MIDI input has nowhere to land.

## Goal

Three tom lanes plus a ride lane, fully wired across editor UI, score render, and playback.

## Depends on

Phase 1 (named voice abstraction). Adding lanes should be a one-place registry edit, not a five-file change.

## Open design questions

1. **Tom slot naming.** Keep `t1` (high) and `t4` (floor) and add `t2` (mid)? Or relabel as `t1`/`t2`/`t3` to match the kit's three toms? Prefer the latter — `t4` was an unused leftover, no URLs in the wild use it. Codec migration: treat the legacy `hasT4` bit as `hasT3` for new payloads, decline to decode old payloads that actually used it (none known).

2. **Ride identity.** Today's `cy` slot is generic. Options:
   - Rename to `ride` outright; defer crash to a later phase.
   - Keep `cy` polymorphic with a state byte that encodes ride vs crash.
   - Prefer rename — clearer, and crash is not part of the MVP kit.

3. **Synth design.** Match the existing sn/kk/hh design philosophy (synthesized from primitives, no samples).
   - Toms: `MembraneSynth` with descending pitch sweep — high tom around C3, mid around A2, floor around F2. Decay shorter than kick.
   - Ride: filtered noise + tonal partial around 5kHz; longer release than hh closed.

4. **Score lane order, top to bottom.** Drum chart convention:
   - Hi-hat (top of staff)
   - Ride (above staff)
   - Toms (descending through the staff lines)
   - Snare (third line)
   - Kick (below staff)
   - Verify against existing assignments in `src/lib/vex-builder.ts`.

5. **Cell-cycle states for toms and ride.** Reuse the 4-state `NoteValue` (off, normal, accent, ghost) for symmetry with snare and kick.

## Constraints

- Existing 3-voice URLs must still decode. New voices appear with their `has*` bits cleared.
- Adding a new voice should be one registry entry. If it isn't, Phase 1 didn't finish — go back and fix it before building Phase 2 on a leaky abstraction.

## Out of scope

- Crash, china, splash. Add later if needed.
- Cymbal swell or choke. Mostly relevant once MIDI input is in.
- Toms with rim shots. No GM mapping for it; defer.

## Verification

- All voices reachable in the editor UI; click cycles through states.
- Playback triggers each voice with the right synth.
- Score renders each voice on the correct staff line with the right notehead.
- MIDI export includes the new voices with their GM mapping.
- Existing tests pass; codec round-trip tests cover at least one groove with all four new voices populated.
