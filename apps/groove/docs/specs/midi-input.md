# Phase 3 — MIDI input MVP

## Why

The long-term roadmap goal is a self-hostable open-source drum tutor. The first concrete step: listen to the Aroma TDX 15S over Web MIDI, score what is played, and grade it against the expected groove.

## Scope (MVP)

- 4/4 only.
- Target kit: HH (closed/open/pedal), kick, snare with rim, three toms, ride.
- Single connected MIDI device. No multi-device, no MIDI through, no merging.
- Listen for hits while playback is running, map each hit to a voice via the inverse of the GM table in `src/lib/export-midi.ts:5-14`.
- Compare each hit against the expected step time using a configurable timing tolerance window (default ~30 ms after latency calibration).
- Visual overlay on cells: correct, missed, extra, mistimed.

## Depends on

Phases 1 and 2. The named-voice registry owns the GM mapping; the toms and ride lanes give MIDI hits a place to land.

## Open design questions

1. **Where the listener lives.**
   - `useMidiInput()` composable, owned by the playback transport so hits are aligned to the same clock.
   - Question: subscribe per-play, or keep a long-lived subscription and tag hits as in-session vs free-play?

2. **Latency calibration.**
   - Run a short tap-along (4 to 8 quarter notes) before practice. Estimate the constant offset between MIDI timestamp and audio clock.
   - Persist where? URL is read-only public, not for per-user state. Probably `localStorage` keyed per device. UI needs a "recalibrate" affordance.

3. **Grading model.**
   - Per-step ternary: correct (right voice + within tolerance), wrong-voice (within tolerance but different drum), missed (no hit within window).
   - Plus an "extra" bucket for unscheduled hits.
   - Score per measure or per loop? Probably per loop; reset on stop.

4. **Display.**
   - Inline overlay on the score (note color = grade) and per-cell badge in the editor grid? Both feel right.
   - Avoid overwhelming the existing UI; consider a toggle for grading view vs normal play.

## Constraints

- Web MIDI requires HTTPS and a user gesture to grant access. The hosted GitHub Pages build is HTTPS, fine.
- Browser support: Chrome, Edge, Opera. Firefox added native support recently. Safari does not. Surface a clear unsupported message instead of silently failing.
- No persistent grade history in MVP. Grading state is in-memory only.
- Don't break embed mode. The embed is read-only by intent; MIDI input is editor-only.

## Out of scope (deferred)

- Streak counter, lesson flow, tempo ramp ("start at 60, bump 2 bpm per successful loop"). Long-term roadmap.
- Multi-device, MIDI through.
- MIDI export of what was played (only the chart is exported today).
- Cloud sync of grades or settings.

## Verification

- Plug in a Web MIDI device. Hits appear in a debug log with voice + delta-from-expected.
- With a known groove, play the chart correctly in time; all cells show "correct".
- Drop notes; missed cells flag.
- Play extra notes; an extra-hit indicator shows.
- Unsupported browser (Safari) shows a clear message and degrades to playback-only.
- Latency calibration produces a sane offset (positive or negative tens of ms typical) and persists across reload.

## Before starting

Resolve the open design questions above by appending decisions to this spec. Don't start coding the listener until the grading model and display are settled — they shape the data the listener should expose.
