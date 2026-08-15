# Architecture

Snapshot of the current state. Update this when modules move, the data flow shifts, or the voice schema changes.

## Module map

### `src/lib/` — pure logic, no Vue or Tone

- `voices.ts` — voice registry. Single source of truth for what drums exist, their cell width, MIDI mapping per state, VexFlow render hints, synth dispatch keys, an optional `group: 'tom' | 'cymbal'` for the editor's bulk-collapse toggles, and an optional `brush` naming which state-bar brush paints that state (`stateForBrush` / `voicesForBrush` invert it; a snare has no "open", so the brush is a no-op there rather than an error). Includes `voiceForMidiNote()` for MIDI input mapping (registry states + `INPUT_ONLY_MIDI` for kit-side notes like snare rim).
- `model.ts` — `Groove` shape; `Voices` type guarantees `hh`/`sn`/`kk` are present; toms and ride are optional. Also owns `repeats`, one count per measure (1..`MAX_REPEAT`), normalized by `resizeArrays` the same way the cell arrays are. Uses `voices.ts` for cycle helpers.
- `codec.ts` — bit-packed binary, base64url-encoded for the URL fragment. v4 is registry-driven (presence bitmap over `VOICES` order, then cells in order). Flag bit 7 is `hasRepeats`; when set, 4 bits per measure follow the sticking block, so a groove that does not repeat encodes to the exact bytes it did before repeats existed. The bitmap is one byte and the registry now holds 8 voices, so it is full: a ninth voice needs a format bump, and `VOICES` order is append-only because the bitmap is positional. v3 stays read-only for legacy URLs (maps `t4`→`t3`, `cy`→`ride`).
- `vex-builder.ts` — turns a `Groove` into a VexFlow staff by iterating the registry. A measure with `repeats > 1` gets `|: … :|` barlines plus a hand-drawn `×N` pinned to the closing sign. Beam grouping is hardcoded for simple meters (1/4 beat group); 6/8 falls back to straight 8ths. `renderScore(..., { singleRow })` lays every measure on one horizontal row (used during playback so the chart can scroll behind a centered playhead); paused, it wraps measures onto rows for readability.
- `playback-order.ts` — expands `repeats` into the track that actually sounds. `expandTimeline(g)` returns one slot per sounding position, each carrying the grid `step` it reads from plus its `measure` and 1-based `pass`. With every repeat at 1 it is the identity over the step range, which is why playback, the MIDI export and the score need no special case for "no repeats".
- `presets.ts` — groove presets. Patterns are declared in beat offsets, not cells, so one definition applies at any division; `applyPreset` renders them into cell arrays for a single measure and reports how many notes the division was too coarse to hold.
- `export-midi.ts` — `exportMidi(g)` writes a GM drum track (channel 10) via `@tonejs/midi`, looking up notes/velocities from the registry.
- `export-png.ts` — score → PNG download.
- `utils.ts` — `cn` class-merge helper.

### `src/composables/`

- `usePlayback.ts` — owns Tone.js synth construction (kk, sn, hh closed/open/pedal, t1/t2/t3, ride, click), the `Tone.Part` scheduler, swing, count-in, and the playback `currentStep` ref. Schedules one event per slot of `expandTimeline(g)`, so measure repeats sound without ever duplicating cells: `currentStep` stays a **grid** step (the score marker, the grid highlight and MIDI grading are untouched) and `currentPass` says which time through the sounding measure it is. Loop detection watches the expanded index wrapping to 0, not the grid step, because a repeated bar brings step 0 round again mid-pass. Exposes `resumeAudio()` and registers a `visibilitychange` listener that resumes the (single, Tone-global) AudioContext when the page returns to the foreground, because iOS suspends it in the background and never resumes it on its own. `loopCount` counts completed passes through the track (detected when the drawn step wraps back to 0), which is what speed training runs on. Voice dispatch reads `voices.ts`. When `loop` is off it schedules an explicit `end` event one step past the last note that tears down playback and fires the `setOnEnded` callback, so the UI never stays stuck in "playing". Manual `stop()` does not fire `onEnded`. Captures the playing timeline geometry and exposes `nearestStepNow()`, which projects the live `transport.seconds` onto the step grid (signed `deltaSec`) so a MIDI hit can be graded for timing off the audio clock.
- `useUrlSync.ts` — keeps the `Groove` store in sync with the hash payload. Editor writes back; embed does not.
- `useWakeLock.ts` — Screen Wake Lock wrapper. Keeps the phone awake while a groove plays; re-acquires on `visibilitychange` (the browser auto-releases when the page is hidden). Both views drive it via `watch(isPlaying)`. No-ops where the API is unsupported.

### `src/stores/`

- `groove.ts` — Pinia store wrapping the current `Groove` plus a few editor-only flags. `selectedMeasure` (UI-only, not encoded in URL) drives the GrooveGrid single-measure mode and the Score click-to-select overlay. Also owns the editing model: `brush` (what a tap paints), `brushValueFor` / `brushStickingFor` (what the brush resolves to in a given cell, or null when it does not apply there), and an undo/redo history of JSON snapshots. `beginStroke` / `endStroke` suspend history so a drag across twenty cells is one undo step; every note-mutating action pushes history itself.
- `speedTrainer.ts` — practice-only store: raise the tempo by N BPM every M loops up to a target. `tempoAfterLoops(loopsDone, currentTempo)` returns the new tempo or null; the views call it from a `watch` on `usePlayback`'s `loopCount`. Persisted to `localStorage`, never to the URL.
- `midi.ts` — Pinia store wrapping Web MIDI access, last-hit (incl. an audio-clock `timing` captured synchronously via a `setHitTimingProvider` callback the editor registers), latency/tolerance settings (persisted to `localStorage`), the live-marker list (grade ∈ `perfect`/`early`/`late`/`wrong-voice`/`off-time`), the practice-mode toggle + review timer (surfaced as the Transport's "Pause between loops"), the editor lane-visibility toggles (`showToms` / `showCymbals`, persisted), the `lessonMode` flag (persisted; hides the staff, the transport panel and the division row, and holds the wake lock while stopped), and the Settings drawer open flag. Shared by `MidiPanel`, `GrooveGrid`, `Score`, `TopBar`, `Transport`, and `EditorView`.

### `src/views/`

- `EditorView.vue` — main editor screen.
- `EmbedView.vue` — iframe-friendly screen. Adds `is-embed` class and posts `groove:resize` to `window.parent`.

### `src/components/`

- `groove/` — domain components: `Score.vue`, `Transport.vue`, `GrooveGrid.vue` (single + stack modes via `isPlaying`; also owns the pointer painting: pointerdown opens a stroke, pointermove resolves the cell under the finger with `elementFromPoint` and interpolates over any steps the sampling skipped), `StateBar.vue` (sticky bottom bar: the brush palette, plus Play / tempo / undo on a phone and in lesson mode, where the transport panel hides its own copies), `PresetPicker.vue` (fills the selected measure from `presets.ts`), `MeasureTabs.vue` (measure switcher with `+` button), the cell grid, etc.
- `shell/`, `ui/`, `icons/` — chrome and primitives.

### `src/styles/`

- `tailwind.css` — design tokens via CSS variables (light at `:root`, dark at `.dark`), Tailwind base/components/utilities, embed override, score-host gradient, LED cell, transport play styles. Touch adaptations hang off `@media (pointer: coarse)` rather than a width breakpoint (the distinction is finger-versus-mouse, not screen size): `.touch-target` grows to 44 px, `.note-grid` widens `--cell-min` / `--lane-label-w`, `.led-cell` gets a 44 px floor, and switches gain an invisible `::before` hitbox. `.app-shell` carries the `100svh` viewport and the bottom safe-area inset.

### `src/router.ts`

Hash router. Routes:

- `/` and `/g/:payload` → `EditorView`
- `/embed` and `/embed/g/:payload` → `EmbedView`
- catch-all redirects to `/`

### PWA

`public/manifest.webmanifest` plus the icon set and iOS meta tags in `index.html` make the editor installable (`display: standalone`). There is no service worker, so it is installable but not offline: a fresh load still needs the network.

### `src/main.ts`

Applies the `dark` and `is-embed` classes synchronously before mounting Vue (Safari requires this; see `docs/progress.md` 2026-04-25).

## Data flow

```
URL hash payload
  ↓ (codec.decode on load)
Pinia store (Groove)
  ↓ (reactive bindings)
  ├─→ Score.vue → vex-builder → VexFlow SVG
  └─→ Transport.vue + usePlayback → Tone.js Part → audio + currentStep

Editor edits
  ↓ (mutate store)
useUrlSync watch
  ↓ (codec.encode)
URL hash (replaceState)
```

Embed view reads URL but never writes back.

## Voice schema today

Source of truth: `src/lib/voices.ts`. Keep this table in sync if voices change.

| Key      | States                               | Bits | Wired in UI? | Notes                    |
| -------- | ------------------------------------ | ---- | ------------ | ------------------------ |
| `hh`     | 5 (off, closed, open, accent, pedal) | 3    | yes          | hi-hat                   |
| `sn`     | 4 (off, normal, accent, ghost)       | 2    | yes          | snare                    |
| `kk`     | 4 (off, normal, accent, ghost)       | 2    | yes          | kick                     |
| `t1`     | 4 (off, normal, accent, ghost)       | 2    | yes          | high tom                 |
| `t2`     | 4 (off, normal, accent, ghost)       | 2    | yes          | mid tom                  |
| `t3`     | 4 (off, normal, accent, ghost)       | 2    | yes          | floor tom                |
| `ride`   | 4 (off, normal, accent, ghost)       | 2    | yes          | ride cymbal              |
| `crash`  | 3 (off, normal, accent)              | 2    | yes          | crash cymbal             |
| sticking | 4 (-, R, L, B)                       | 2    | yes          | per step, not a voice    |
| repeats  | 1..16                                | 4    | yes          | per measure, not a voice |

## Known limitations

- **Beam grouping assumes simple meters.** Compound meters render as straight eighths (`vex-builder.ts` TODO).
- **No missed-note markers yet.** The live marker layer is purely hit-driven — expected notes the user fails to hit don't get a red dot. See the future-feature note in `docs/progress.md`.
- **Marker timing.** Hit _grading_ now reads the audio clock (`nearestStepNow` projects `transport.seconds` onto the step grid → early/perfect/late), but marker _position_ still snaps to the step's notehead. The first attempt at timestamp-_positioning_ desynced; see the desync trap entry in `docs/progress.md` before moving the dots by microtiming. End-to-end MIDI timing still needs an e-kit to verify.
- **No playback-timing tests.** Codec round-trip is covered; the `Tone.Part` dispatch path and the live marker watcher are not. Add when behavior justifies it.
