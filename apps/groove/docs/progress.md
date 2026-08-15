# Progress

Running journal. Newest entry on top. Append a dated entry whenever a meaningful task lands or a non-obvious decision is made.

---

## 2026-07-30: Per-measure repeats

**Status:** A measure can now say how many times it sounds. `repeats[m]` is part of the groove,
so it travels in the URL, draws as a real repeat sign, and expands in playback and in the MIDI
export. Came from the user practicing a 6-bar piece where bar 1 wants four passes and bar 2 two,
which today could only be spelled by duplicating bars out of an 8-measure budget.

**Done:**

- `model.ts` — `repeats: number[]`, always `measures` long, entries 1..`MAX_REPEAT` (16).
  `normalizeRepeats` is called from `emptyGroove` and `resizeArrays`, so a groove from an old
  URL, an undo snapshot or a hand-built literal always carries a valid array.
- `playback-order.ts` (new) — `expandTimeline(g)` returns one slot per sounding position
  (`step`, `measure`, 1-based `pass`). With every repeat at 1 it is the identity over the step
  range, which is why nothing downstream needed a "no repeats" branch.
- `codec.ts` — no version bump. v4's flags byte had a spare bit 7, now `hasRepeats`; when set,
  4 bits per measure (holding `repeat - 1`) sit between the sticking block and the title
  trailer. A groove that does not repeat encodes to exactly the bytes it did before.
- `usePlayback.ts` — one event per expanded slot instead of one per step. `currentPass` is new.
- `vex-builder.ts` — `|: … :|` on a repeated measure, plus a hand-drawn `×N`.
- `export-midi.ts` — writes the expanded track. A MIDI file has no repeat sign, so the export
  has to sound like the app.
- UI: a Repeat stepper next to the measure tabs (acting on the selected bar), a `×N` badge on
  the tabs themselves, and `· 2/4` in the play-stack header of the bar that is sounding.

**Decisions:**

- **`currentStep` stays a grid step.** Everything downstream (score marker, grid highlight,
  MIDI grading, the measure snapshot on stop) reads it as an index into the cell arrays; the
  same index simply comes round more than once. Only loop detection had to move to the expanded
  index, because with repeats step 0 recurs inside one pass through the track.
- **A spare flag bit, not v5.** The alternative was a format bump for four bits per measure.
  Bit 7 was free and using it keeps every existing URL byte-identical, which matters when the
  URL is the only storage the app has.
- **One repeat block per measure, no multi-bar brackets.** Two adjacent repeated bars render as
  two blocks. That is what the model says; a bracket would need a range in the model, which is
  a bigger feature than the one that was asked for. Voltas are out for the same reason.
- **`currentPass` exists because the fourth pass is otherwise invisible.** Bar 1 on pass 4 looks
  exactly like pass 1 on the grid, which is the one thing a repeat makes hard to follow.

**Sensors:** typecheck, eslint, prettier check, vitest (49 tests, 10 new), `npm run build`.

**Verified in Chrome** against the user's own "Tocata - lousa" URL: setting bar 1 to ×4 and bar 2
to ×2 draws both repeat blocks with the counts over their closing signs, writes the hash, and a
full reload brings both counts back with the rest of the groove intact.

**Caveat, the same one every playback change carries here:** the transport could not be driven in
this environment (the window reports `visibilityState: hidden`, so `Tone.getDraw()` never fires
and audio will not start without a real gesture). The expansion itself is unit-tested and the
scheduler change is a substitution of the event list, but the audible order, the pass readout and
the loop-count wrap need a real listen.

---

## 2026-07-30: Crash lane

**Status:** `crash` is a first-class voice. Eighth and last slot of the v4 presence bitmap.

**Why a lane and not a state of the ride.** The question that started this was how GrooveScribe
does it, since the editor borrowed its shape. GrooveScribe has no crash lane: it has one
polymorphic cymbal row (labelled "hi-hat") whose every cell picks an instrument, encoded as one
character in the `H=` string (`x` normal, `X` accent, `o` open, `+` close, `c` crash, `r` ride,
`b` ride bell, `m` cow bell, `s` stacker), each rendering at its own ABC pitch (`^c'` crash,
`^A'` ride, `^B'` ride bell). One row, one state per cell, so a crash on beat 1 **replaces** the
hi-hat on beat 1. That is the option `docs/specs/toms-and-ride.md` already weighed and rejected in
Phase 2, and the reason stands: crash plus hi-hat on the same eighth is ordinary, and a model that
cannot spell it is wrong for the common case. Kept our lane-per-voice model; borrowed only their
two good conventions, crash above the hi-hat on the staff and the GM notes.

**Done:**

- `src/lib/voices.ts` — `crash` appended to `VOICES`: GM 49, `group: 'cymbal'`, vexKey `a/5/x2`.
  Three states, off / normal / accent. No ghost: a ghosted crash is not a thing, and leaving the
  fourth 2-bit slot empty costs nothing.
- Input mapping reshuffled now that a crash voice exists: 49 comes from the registry, 57 (crash 2),
  52 (china) and 55 (splash) fold into `crash` in `INPUT_ONLY_MIDI` instead of landing on the ride.
- `usePlayback.ts` — `crash` synth: bright attack burst (noise → highpass 8k, 120ms) over a long
  wash (noise → highpass 3.2k, 1.6s decay). No bell partial, which is what separates it from the
  ride by ear.
- `vex-builder.ts` — `VOICE_LINE.crash = -1`. Verified in the browser against the rendered SVG:
  staff lines at y 219..259, crash notehead at 209 with its ledger line drawn, hi-hat at 214.
  VexFlow displaces the crash horizontally when it shares a step with the hi-hat, since they are a
  second apart. That is correct engraving, not a bug.
- `GrooveGrid.vue` — lane order `hh, crash, ride, t1, t2, t3, sn, kk`. Hi-hat stays the anchor top
  lane and the cymbals sit together, same reasoning as grouping the toms in Phase 2. Both hide
  under the existing "Show cymbals" toggle for free, via `group: 'cymbal'`.
- Tests: `tests/voices.spec.ts` (MIDI input mapping per cymbal, the no-ghost-on-crash rule, and a
  guard that `VOICES.length <= 8`), plus two codec cases, an all-voices-present round trip and a
  check that a payload with the crash bit clear still decodes without a crash lane.

**Decisions:**

- **`VOICES` order is append-only**, now commented in the file. The v4 presence bitmap is
  positional, so inserting a voice anywhere but the end silently reinterprets every URL in the
  wild.
- **The bitmap is now full at 8 voices.** `encode` already throws past that. The next voice
  (cow bell? splash as its own lane?) is a format bump, not a registry edit.
- **Choke deliberately skipped.** It would need a new `BrushState`, a sixth brush in the sticky
  bar, and a second synth. Worth it only if somebody asks.

**Next:** Nothing queued from this. If a crash lane starts to feel cramped alongside ride on a
phone, the fix is the Settings drawer, not fewer voices.

---

## 2026-07-30: iPad round two, and v0.2

**Status:** Shipped as v0.2. The user drove the iPad again and reported two things: the audio fix
did not work, and Options was still a mess on a phone. Both addressed.

**The audio fix did not work, and I know why the first attempt failed.** It did its repair work
after `await Tone.start()`. iOS only honours audio unlocking in the **same task** as the user's
gesture, and an `await` hands the task back, so by the time the old code tried to rebuild the
context the activation was already spent. A context stuck in WebKit's `interrupted` state stayed
stuck. What is there now:

- `unlockAudioSync()` runs as the very first statement of `play()`, before any await: it resumes
  the raw context without awaiting and plays a one-sample silent buffer, which is the poke iOS
  actually accepts as "the user asked for audio".
- `swapContext()` closes the dead context (Safari caps how many a page may hold, so a few
  background cycles would otherwise exhaust the budget) and installs a fresh one, dropping the
  synths that belonged to the corpse.
- If it still will not start, `audioBlocked` flips and the hint banner says so in plain words,
  with the context's own state string and a Reload button, rather than leaving the user watching a
  silent playhead.

**Options rebuilt for phones.** It was five multi-input toggles sharing one wrapping flex row,
which read as a pile of loose numbers. Below `md` each option is now its own row: icon and name
left, controls right, hairline between. Speed gets two rows because its controls are a sentence.
Three separate bugs surfaced while fixing it:

- Opening Options could reveal it underneath the 180px sticky brush bar. Now the panel scrolls
  itself clear via `scroll-margin-bottom`. The first attempt computed the offset by hand and
  silently did nothing: the panel had just gone from `display: none` to `flex`, and the browser
  was still holding a zero-sized box, so a `void el.offsetHeight` reflow is needed before the
  `scrollIntoView` call.
- The number spinners were eating about 15px per field and clipping "140" to "14". Removed: a
  spinner is unhittable with a thumb anyway.
- The Speed row overflowed its own panel by six pixels, which pushed "s" and "min" flush against
  the edge. Tightened the letter-spacing and the control gap.

**Deliberately deferred, at the user's call:** mirroring controls into the bottom corners on iPad
landscape (2.1), and the Settings drawer covering the grid in landscape (severity 2 in the
triage). Neither is started.

**Sensors:** typecheck, eslint, prettier check, vitest (32 tests), `npm run build`.

**Caveat, unchanged and important:** the audio rebuild still cannot be verified anywhere but on the
device. It only triggers on a WebKit `interrupted` context, which desktop Chrome never produces.
If it fails again, the banner now reports the context state, which is the diagnostic the next
attempt will need.

---

## 2026-07-30: First real-device feedback, plus Phase 3 (presets, paging, PWA, lesson mode)

**Status:** The user drove the editor on an iPad and came back with one hard bug and four UX
complaints. All fixed, then Phase 3 landed except 3.5, which is deliberately left alone.

**Bug: Safari killed audio permanently after backgrounding.** Reported as "saí para segundo plano,
voltei, não tocou, e apertando play de novo não tocava mais". The old `resumeAudio` assumed the
context could only be `suspended`, but WebKit has a third state, `interrupted`, that a plain
`resume()` outside a user gesture will not lift. Once stuck there the context stays dead for the
rest of the page's life: the transport keeps counting, the UI keeps saying "playing", nothing
sounds. Now: `resumeAudio` returns whether it succeeded and tries the Tone wrapper and the raw
context in turn; if it still fails, `play()` (which runs inside a gesture, the only moment a fresh
context may start) throws the context away and rebuilds it, dropping the synths with it. And
`visibilitychange` tears playback down when the resume fails, so the user is never left staring at
a Stop button that fixes nothing.

**Fixed from the same session:**

- **A Scroll brush, the user's own idea and better than mine.** Painting owns the horizontal axis,
  which left no way to drag the grid sideways. Rather than guess at gesture direction, there is now
  an explicit non-brush in the bar: pick Scroll and the cells hand `touch-action` back to the
  browser. They stay lit and normal-looking, because dimming the whole grid just to scroll it would
  be absurd.
- **Brush labels always show.** They were hidden below 480px, leaving a row of bare glyphs with no
  way to learn what they meant: a tooltip needs a hover and a finger has none. Below 520px the
  button stacks instead, glyph over word. Seven 44px buttons plus 6px gaps overflowed a 390px
  screen by a hair and wrapped Scroll onto its own row, so the gap drops to 4px there and the whole
  palette fits one line. Bar height went 233px to 181px.
- **The Options button was landing in the middle of the transport panel.** It had `ml-auto` inside
  a wrapping flex row, so it settled wherever the sliders happened to break. The sliders are now
  `basis-full` below `md`, which puts Loop and Options together on the first row.
- **Speed training was invisible in the tour.** It was one clause in a list of six practice tools.
  It now has its own step, anchored to the transport (its actual control lives inside the Options
  group, which is `display: none` on a phone). Tour at v5.
- **The audio hint said "iPhone" on an iPad.** iPads have not had a side switch for years; theirs
  is the bell in Control Centre. The copy now branches on the device.

**Phase 3:**

- **3.2 Presets.** `src/lib/presets.ts` declares patterns in beat offsets rather than cells, so one
  definition covers every division. `applyPreset` fills the selected measure only and returns how
  many notes the current division was too coarse to hold, which the picker surfaces instead of
  silently dropping them. Basic rock, 8ths hats, 16ths hats, four-on-the-floor. One history entry,
  so a wrong preset costs one undo. **The benchmark task is now 2 interactions**: open the menu,
  pick the groove.
- **3.3 Paging arrows** flanking the numbered measure tabs, not replacing them. The strip was
  already hidden during playback.
- **3.4 PWA.** Manifest with `display: standalone`, icons rendered from the logo via headless
  Chrome (192, 512, maskable 512, plus an `apple-touch-icon`, because iOS ignores the manifest's
  icons), iOS standalone meta tags. No service worker: installable, not offline.
- **3.1 Lesson mode.** A cap toggle in the top bar hides the staff, the transport panel and the
  division row, leaving the grid, the brush bar and Play. The bottom bar's transport row, normally
  phone-only, shows at every width there because it is the only transport left. Holds the wake lock
  even while stopped, since the scenario is standing at the kit transcribing between takes.
- **3.5 Dynamics sub-mode: not built, on purpose.** Vertical drag currently belongs to page
  scrolling, and taking it would undo the axis split that makes painting work at all. Worth doing
  only as an explicit sub-mode, and only once the brush has been used in anger.

**Decisions:**

- **Scroll is a brush, not a mode toggle elsewhere.** It sits in the same row as the paint brushes
  because it answers the same question, "what does my finger do right now", and one control
  answering that question is easier than two.
- **Presets replace the measure rather than merging into it.** Merging makes the result depend on
  what was already there, which is the opposite of what a preset is for.
- **Presets are beat-based.** A cell-based table would need one entry per division and would drift.
  Declaring "hi-hat on 0, 0.5, 1, ..." is division-agnostic and makes the lossy case explicit.

**Sensors:** typecheck, eslint, prettier check, vitest (32 tests, 6 new for presets),
`npm run build`.

**Verified in Chrome:** the preset menu fills basic rock correctly and one undo takes the whole
thing back; the Scroll brush sets `touch-action: auto`, leaves cells enabled, and a tap paints
nothing; paging arrows move the selection and disable at the ends; lesson mode hides the staff,
transport panel and division row while keeping the grid, the bar and a visible Play; the manifest
and both icon sizes serve 200; the mobile bar is three rows at 390px with every label readable.

**Caveat:** the audio rebuild is the one fix that cannot be verified here at all. It only triggers
on a WebKit `interrupted` context, which Chrome on a desktop never produces. It needs the exact
sequence the user hit: play, background Safari, come back.

**Next:** the real-device pass. Everything from Phase 1 through 3 has been checked in a simulated
viewport and almost nothing on hardware.

---

## 2026-07-30: Mobile usability, Phase 2.3 + 2.4 + 2.5 (thumb-zone transport, Loop button, speed training)

**Status:** Phase 2 is complete. Nothing in Phase 1 or 2 has been exercised on a real phone or
tablet yet, which is the next thing that should happen.

**Done:**

- **2.3 Transport in the thumb zone.** On a phone the bottom bar grew a first row: Play/Stop, the
  tempo with -5/+5 nudge buttons, and undo/redo. The transport panel drops its own Play button and
  BPM readout below `md`, so there is no duplicate control, and it keeps Loop, the tempo/swing
  sliders and the Options accordion. The bar renders during playback too (transport row only, the
  brush row hides), so Stop is always where Play was.
- **2.4 Loop as a labelled button.** Out of the Options accordion, always visible, icon plus the
  word "Loop", filled primary when on. The label is most of the target.
- **2.5 Speed training.** New `speedTrainer` store: add N BPM every M loops until a target, in
  absolute BPM. `usePlayback` now exposes `loopCount`, incremented when the drawn step wraps back
  to 0 having played past it. Both views watch it and call `setTempo`. Settings live in the
  Transport's Options row next to the other practice tools, persisted to `localStorage`.
- **Tour bumped to v4.** The "Hear it" step was anchored to the Play button, which is now
  `hidden` on a phone, so driver.js would have spotlighted an invisible element (the same trap the
  v2 note records for `playback-options`). It is merged into the transport step, which is always
  visible, and that step now mentions speed training. Ten steps instead of eleven.

**Decisions:**

- **The tempo reached by speed training is kept when playback stops.** "I got it to 140" is the
  point of the exercise, and the slider is right there to wind it back. The alternative, snapping
  back to the starting tempo, would throw away the result the drummer just earned.
- **Absolute BPM, not a percentage.** It matches the transport readout and the unit a drummer
  thinks in, which is what the plan asked for.
- **`loopCount` is derived from the drawn step wrapping, not from a scheduled loop event.** A
  `Tone.Part` event sitting exactly on `loopEnd` is not reliably fired, and the wrap is already
  observable inside the draw callback that updates `currentStep`.
- **The embed gets speed training too,** and with it the `updateRuntime` watcher it was missing, so
  a tempo change now takes effect mid-playback there as well as in the editor.

**Sensors:** typecheck, eslint, prettier check, vitest (26 tests, 5 new for the speed trainer),
`npm run build`.

**Caveat:** speed training could not be exercised end to end here, because `loopCount` increments
inside `Tone.getDraw()`, which never fires while this browser window reports `visibilityState:
hidden`. The arithmetic is unit-tested and the wiring is a one-line watcher, but the actual tempo
climb needs a real device. Same for the mobile bar layout: the 390 px check narrows `#app` and
rewrites the media queries by hand, which is a good proxy and not the real thing.

**Next:** a real session on a phone and an iPad. After that, Phase 3 in whatever order the session
suggests, and the observed-user pass the spec still owes.

---

## 2026-07-30: Mobile usability, Phase 2.1 + 2.2 (state bar, brush mode, drag-to-paint, undo)

**Status:** Cycle-on-tap is gone. A sticky state bar holds the brush, the grid applies it, a drag
paints a run, and undo/redo takes back a whole stroke. Benchmark measured before and after: the
"one bar of basic rock" task went from **13 interactions to 6**, under the plan's target of 8.

**Measured first, as the plan asked.** `tests/interaction-cost.spec.ts` derives the cost from the
real interaction model rather than estimating it: 12 taps on the default 16ths grid, 13 at 8ths
including the division change (the plan's ~14-16 guess was high), 16 once the snare is ghosted.
The finding worth keeping: **drag only collapses adjacent cells.** Eighths on a sixteenths grid are
alternating cells, so there is no run to drag and the brush ties cycling at 12. "Eight taps become
one gesture" needs the division to match the pattern. The brush's unconditional win is non-default
states: a ghosted snare drops 16 to 14 because you pick "ghost" once instead of tapping through it.

**Done:**

- **Brush semantics live in the voice registry.** Each `VoiceState` may declare `brush: 'normal' |
'accent' | 'ghost' | 'open' | 'pedal'`; `stateForBrush(voice, brush)` inverts it. A snare has no
  "open" and a hi-hat no "ghost", so the lookup returns null and the lane goes inert rather than
  painting something wrong. Adding a voice still means editing one file.
- **`StateBar.vue`,** `sticky bottom-0` with a blurred card background and the bottom safe-area
  inset. Five state brushes, an eraser, sticking R/L/B, and undo/redo. The active brush is
  deliberately loud (filled primary, glow) because the user has to know what is in their hand
  without stopping to think. Labels hide below 480 px, leaving glyph-only 44 px buttons.
- **Painting in `GrooveGrid`.** pointerdown opens a stroke and paints the origin cell; pointermove
  resolves the cell under the pointer with `elementFromPoint` and repeats the stroke's value;
  pointerup closes it. Restricted to the origin lane. Cells carry `data-cell` / `data-voice` /
  `data-step` so the resolution is a `closest()` lookup, not element refs threaded through the grid.
- **Undo/redo in the store.** A capped stack of 60 JSON snapshots. Every note-mutating action
  pushes its own; `beginStroke` / `endStroke` suspend pushing so a twenty-cell drag is one undo
  step. Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z are wired in `EditorView` alongside Space.
- **Tour bumped to v3** with a new "Pick before you paint" step, and the "Build the beat" step
  rewritten (it was teaching an interaction that no longer exists). The grid legend was rewritten
  for the same reason.

**Bugs found and fixed while verifying:**

- **A fast drag skipped cells.** pointermove is sampled, not continuous: a flick across sixteen
  cells reported only four of them, painting a dotted line. The stroke now interpolates from the
  last painted step to the current one, so a fast drag paints the same run as a slow one. Found by
  driving a real drag in Chrome, not by reading the code.
- **Undo left the first cell of a stroke behind.** The origin cell was painted before the stroke
  opened, so it landed in its own history entry and one undo removed everything except it.
  `beginStroke` now runs first.
- **Pre-existing: the guided tour re-showed on every visit.** `driver.js` 1.4 does not fire
  `onDestroyed` when the popover is dismissed with the ×, so `groove:tourSeen` was never written.
  Verified by closing on both an element-less and an element-anchored step. `maybeAutoStart` now
  marks seen at start, which is the right meaning anyway: we showed it. `onDestroyed` stays wired
  for manual replays.

**Decisions:**

- **The brush replaces cycling outright, not as a mode.** A mode toggle would protect the old
  workflow at the cost of making the new one undiscoverable, and the plan is explicit that the
  point is to stop cycling. With "normal" selected a tap is a plain on/off toggle, which is what
  most editing is; the eraser and a visible undo make mistakes cheap.
- **One brush, and the half of the grid it cannot reach goes inert.** A sticking brush over a note
  lane, or "open" over a snare, dims the lane to 30% and disables the button. A tap that silently
  does nothing is worse than a tap that visibly cannot happen. Picking a sticking brush also
  reveals the sticking row, which would otherwise be hidden.
- **Axis split via `touch-action: pan-y` on the cells.** The browser keeps vertical panning, the
  app owns the horizontal axis, which is exactly the rule the plan describes and it needs no
  gesture-direction heuristic. The cost is real and worth watching: the grid no longer flick-scrolls
  sideways over the cells, only over the lane labels and the measure header. If that reads badly on
  a phone, pagination (spec 3.3) is the escalation the plan already names.
- **Keyboard cells still work.** The paint runs on pointerdown, so `@click` would double-fire; the
  click handler only acts when `event.detail === 0`, which is how a keyboard-generated click
  identifies itself.

**Sensors:** typecheck, eslint, prettier check, vitest (21 tests, 12 of them new), `npm run build`.

**Verified in Chrome** by dispatching real pointer event sequences (the extension's synthetic drag
does not reach this window reliably): a sparse 4-sample drag paints all 16 cells; one undo clears
the whole stroke and redo restores it; dragging back over a filled run erases it; the ghost brush
writes `○` on the snare and makes the hi-hat inert; the open brush leaves only the hi-hat live;
picking R reveals the sticking row and dims every note lane. The full benchmark ran end to end in
the UI at 6 interactions with the correct groove on the staff. Touch layout checked by forcing the
`(pointer: coarse)` blocks on: every brush button is 44 px tall, the bar wraps to three rows at
390 px.

**Caveat:** the 390 px check narrows `#app`, not the viewport, so viewport-width media queries do
not fire. On a real phone the brush labels hide below 480 px and the bar should be about two rows,
not three. Worth confirming on device. Playback still cannot be driven here (`visibilityState` is
permanently `hidden`, so `Tone.getDraw()` never fires).

**Next:** 2.3 (transport in the thumb zone), 2.4 (labelled Loop button), 2.5 (speed training). And
the observed-user pass the spec still owes: these numbers are counted, not watched.

---

## 2026-07-30: Mobile usability, Phase 1 (touch targets, stable viewport, iOS audio, scroll affordances)

**Status:** Wrote `docs/specs/mobile-usability.md` (the whole three-phase plan, its severity triage
and its benchmark) and landed all of Phase 1. Phase 2 (the sticky state bar plus brush mode, which
is the real fix for cycle-on-tap) is specced but not started.

**Done:**

- **1.1 Touch targets and touch hygiene.** Everything a finger hits now clears 44 px on coarse
  pointers. `touch-action: manipulation` on `button / a / input / select / textarea / [role=switch]`
  kills the double-tap-zoom wait, which is what made cell taps feel laggy. New `.touch-target`
  class (a no-op under a mouse, `min-height/min-width: 44px` under a finger) applied to `Button.vue`,
  the TopBar icon buttons, the Transport's Options button and its number inputs. `.led-cell` gets
  `min-height: 44px` (min-height beats the `h-9` utility, so the desktop cell is untouched). Measure
  tabs go 28 to 44 px; the slider thumb goes 14 to 24 px.
- **Grid columns moved from an inline `gridTemplateColumns` string to a `.note-grid` class** driven
  by `--steps` / `--cell-min` / `--lane-label-w`. That is what lets the coarse-pointer floor be a
  media query instead of JS: 48 px per column and a 72 px label column on touch, 26 px / 96 px
  under a mouse. The `ml-5` / `ml-8` beat-marker margins became `.cell-gap` / `.cell-gap-lg` and
  shrink to 4 / 8 px on touch, because that margin eats into the cell's own width.
- **1.2 Stable viewport.** `min-h-screen` on the editor shell became `.app-shell`, which sets
  `min-height: 100vh` then `100svh` (small viewport: constant while Safari's address bar collapses,
  so the layout stops jumping mid-scroll) plus `padding-bottom: env(safe-area-inset-bottom)`. The
  play stack's `max-height` got the same `vh` then `svh` treatment. The embed root deliberately does
  not get `.app-shell`, because an embed must never claim a viewport height.
- **1.3 Reliable audio on iOS.** `usePlayback` gained `resumeAudio()` and a `visibilitychange`
  listener that calls it whenever the page comes back to the foreground (iOS suspends the
  AudioContext in the background and does not resume it, so a groove came back silent with the
  transport still "running"). `play()` awaits it right after `Tone.start()`. New `AudioHint.vue`:
  a dismissible one-liner, shown once per browser on the first Play on an iOS device, saying the
  iPhone side switch mutes web audio. There is no API to detect that switch, so saying it once is
  the only honest fix. Editor only: a `position: fixed` banner inside an embed iframe would fight
  whatever height the host page gave the frame.
- **1.5 Horizontal scroll affordances.** The grid scroller got `-webkit-overflow-scrolling: touch`
  and `overscroll-behavior-x: contain` (a horizontal flick stays in the grid instead of triggering
  the browser back-swipe). Gradient edges fade in on whichever side has more content, driven by a
  scroll listener plus a `ResizeObserver` on both the scroller and its content. And the grid now
  follows the playhead horizontally: `activeStep` centers its column via
  `getBoundingClientRect` deltas, instantly, mirroring what `Score.vue` already does for the staff.

**Decisions:**

- **`(pointer: coarse)`, not a width breakpoint.** The problem is finger-versus-mouse, not screen
  size. A width query would shrink an iPad's targets in landscape and grow a narrow desktop
  window's for no reason.
- **44 px, not the 48 the plan asked for.** Columns are 48 px wide so a beat-start cell still
  clears 44 after its 4 px marker gap, and every cell is 44 px tall. Going to a full 48x48 would
  push a 16-step bar to roughly 970 px on a 390 px screen. At 48 px columns it is already 916 px,
  about 2.6 screens per bar, which is the number to watch: if that reads as too much scrolling in
  real use, pagination (spec item 3.3) moves ahead of the brush.
- **Switches get an invisible hitbox, not a redesign.** `button[role=switch]::before` with
  `inset: -14px -6px` buys the tap area without changing layout or overlapping the number input
  6 px to its right. Phase 2.3 rebuilds those rows anyway.
- **Removed `scroll-behavior: smooth` from `.play-stack`.** The vertical measure follow passes
  `behavior: 'smooth'` explicitly, so it is unaffected; the new horizontal follow sets `scrollLeft`
  directly and has to land instantly or it lags the beat.
- **Cells carry `data-step`.** The horizontal follow needs the active column's element and the
  seven lanes all share a step index, so `querySelector('[data-step=N]')` returning the first match
  is exactly right. Cheaper than threading element refs through the grid.

**Sensors:** typecheck, eslint, prettier check, vitest (9 tests), and `npm run build` all pass.

**Verified in Chrome:** the desktop layout is pixel-identical to before (96 px label column, 4 px
gap, 36 px cells). The touch layout was checked by rewriting every `(pointer: coarse)` block's
`conditionText` to `all` via CSSOM, since desktop Chrome will never match the query: cells come out
48x44, measure tabs 44x44, every `.touch-target` at least 44 px tall, label column 72 px. With the
app constrained to 390 px the bar overflows (916 px content in a 356 px scroller), the right edge
gradient shows on load and the left one appears after scrolling. The `data-step` centering math was
replayed against the live DOM and lands the target column at offset 0.

**Caveat:** the browser window in this environment reports `visibilityState: hidden`, so
`Tone.getDraw()` never fires and playback could not be driven end to end. The horizontal
follow-playhead was verified as geometry plus wiring, not against a running transport. The iOS
pieces (silent-switch hint, context resume on foreground) need a real iPhone. Worth checking on
device: hit Play, background the app, come back, confirm sound resumes.

**Next:** measure the benchmark from the spec ("one bar of basic rock", expected ~14-16
interactions today) before building anything else, then 2.1 and 2.2 together.

---

## 2026-06-21: Mobile playback pass, part 2 (Transport accordion, pause promoted, early/perfect/late feedback)

**Status:** Landed the P1 items from the same feedback list. The mobile Transport now collapses its secondary toggles behind an "Options" disclosure; "pause between loops" moved out of the MIDI-practice settings into the Transport as a general player option; and MIDI hits on a correct pad are now graded early / perfect / late off the audio clock, with an on-screen verdict and a calibration readout. Verified the layout in Chrome (mobile + desktop); the MIDI-timing path needs an e-kit to exercise end-to-end (as with every prior MIDI feature).

**Done:**

- **Transport "Options" accordion (mobile).** `Transport.vue` keeps Play + BPM + tempo + swing always visible; the toggles (loop, pause, timer, metronome, count-in) collapse behind an `Options` button on mobile and show inline on `md+`. Implemented purely with responsive classes (`hidden md:flex` + a `md:hidden` toggle button); the toggles also reveal text labels (`md:hidden` spans) when expanded on mobile. Verified at 412px (collapsed → expands to two labeled rows) and 1280px (inline, no button).
- **"Pause between loops" promoted to a general player option.** The silent review-window toggle (backed by `midi.practiceMode` + `practiceTimerSec`) moved from the Settings drawer's "MIDI practice" section into the Transport Options, with its own seconds input. It is no longer gated on the loop toggle being visible/on (it simply takes effect when a loop runs). The duplicate Settings section was removed. The between-loop countdown overlay already existed and is unchanged.
- **Early / perfect / late timing feedback.** Replaced the live-marker grade `on-time` with `perfect` / `early` / `late` for hits on the correct pad. `usePlayback` captures the playing timeline and exposes `nearestStepNow()`, which reads `transport.seconds` (the audio clock) and returns the nearest step + a signed `deltaSec`. The midi store calls this via a `setHitTimingProvider` callback **synchronously inside the MIDI message handler** (before Vue's async flush advances the clock — the key fix vs. the old desync trap) and stamps `timing` onto the hit. `EditorView` grades `deltaMs = deltaSec*1000 - latencyMs` against a perfect window of `max(8, tolerance*0.4)`, drops a color-coded marker on the grid + staff (green/blue/orange), and flashes a short `PERFECT / EARLY / LATE ±N ms` badge.
- **MIDI offset review + calibration aid.** The Settings drawer's MIDI tuning section gained a live "Last hit" readout (latency-compensated ms, color-coded) and a one-line instruction: play the chart and dial the latency offset until on-beat hits read near 0 ms. With grading now anchored to the audio clock, the latency slider finally means just the kit→browser delay (not the Tone lookahead it had to absorb before).

**Decisions:**

- **Accordion, not a drawer move (user choice).** The user picked the in-Transport accordion over relocating toggles into Settings, so the controls stay where the eye already is during play.
- **Timing captured in the MIDI handler, graded in the view.** Geometry lives in `usePlayback` (single source); the store calls `nearestStepNow()` synchronously so the audio-clock read happens at hit time, then the view applies the user's latency/tolerance. This is the audio-clock approach the desync-trap note prescribed — and it grades timing without trying to _move_ the marker by microtiming (which is what desynced before).
- **Right pad ⇒ always a timing grade.** A correct-voice hit reads early/perfect/late regardless of magnitude; only a wrong or unexpected pad reads wrong-voice/off-time. Clearer pedagogy than collapsing big misses into "off-time".

**Sensors:** typecheck, eslint, prettier check, vitest (9 tests), and `npm run build` all pass.

**Caveat:** The early/perfect/late grade, the verdict badge, and the calibration readout only light up with a connected MIDI kit, which this environment doesn't have. The math is typecheck-clean and follows the audio-clock guidance, but the user should verify on the Aroma TDX 15S: steady on-beat hits should converge to "perfect" once the latency offset is dialed so "Last hit" reads ~0 ms; pushing/dragging should read early/late with sensible ms.

**Follow-up (same day): guided tour refreshed for the new features.** `useTour.ts` bumped to `TOUR_VERSION = 2` (re-surfaces for returning users). The "Practice tools" step was re-anchored from `[data-tour="playback-options"]` to `[data-tour="transport"]` because the options group is now `display:none` on mobile (collapsed behind the Options accordion), which would have left driver.js highlighting a hidden element. Copy updated: the step now mentions Pause between loops and the Options button; the chart step mentions the centered auto-scroll; the Settings/MIDI step mentions early/perfect/late feedback. Verified at mobile width that `transport` is visible and `playback-options` is hidden, and that the tour auto-re-opens on the version bump.

**Next (open from the list):** none of the original feedback items remain. Possible follow-ups: missed-note markers (expected notes the player didn't hit), and per-loop history so bars can be compared over time.

---

## 2026-06-20: Mobile playback pass, part 1 (track-end reset, wake lock, centered auto-scroll)

**Status:** Landed the three P0 items from the mobile-study feedback: a non-looping track now stops and resets instead of hanging in "playing", the screen stays awake while a groove plays, and the chart follows the playhead automatically (centered) instead of needing a manual scroll. Verified in Chrome at a 412px-wide (mobile) viewport, editor and embed.

**Done:**

- **Track end without loop now stops and resets (player-state bug).** With `loop` off, the `Tone.Part` had no event past the last step, so the transport ran on silently and the UI stayed stuck showing Stop. `usePlayback.play` now schedules an explicit `{ kind: 'end' }` event at `trackEnd` when `!g.loop`; its handler (via `Tone.getDraw`) calls `stop()` and a new `setOnEnded` callback. `EditorView` registers `setOnEnded` to clear markers (kept in practice mode, matching manual stop), stop the practice timer, and snap `selectedMeasure` back to 0 ("volta para o começo"). Verified: a 4-bar groove at 100 BPM auto-stopped at ~10 s, the Play button returned, and the Measure 1 tab re-selected.
- **Screen Wake Lock during playback.** New `src/composables/useWakeLock.ts` wraps the Screen Wake Lock API. Both views drive it with `watch(isPlaying, v => v ? request() : release())`, so manual stop, natural end, and timer expiry all release it (they all flip `isPlaying`). The lock auto-releases when the page is hidden, so the composable re-acquires on `visibilitychange` if still wanted. No-ops (silently) where unsupported. Verified `navigator.wakeLock.request('screen')` resolves with no error in Chrome.
- **Chart auto-scrolls with a centered playhead.** `renderScore` gained a `singleRow` option; `Score.vue` passes `singleRow: isPlaying`, so playback renders every measure on one horizontal row (paused keeps the readable multi-row wrap). A `watch(activeStep)` sets `hostRoot.scrollLeft` so the active step's marker stays at the horizontal center, clamped to `[0, scrollWidth - clientWidth]`. Instant (not smooth) scroll so it can't lag the beat. Manual scroll is left to the user when paused. Verified: playhead pinned at center while the chart slid behind it (the score-host scrollbar advanced between frames), editor and embed.
- **Grid stack contains dense rows on mobile.** `.play-stack` got `overflow-x: auto` so 24th/32nd rows scroll inside the panel during playback instead of blowing out the panel width on a narrow screen.

**Decisions:**

- **`onEnded` is separate from `stop()`.** Manual stop snapshots the paused measure for resume; natural end resets to bar 0. Keeping them distinct avoids a flag and matches the two different user intents.
- **Wake lock tied to `isPlaying`, not to play()/stop() call sites.** One watcher per view covers every stop path (manual, end, timer) without duplicating release calls.
- **Single-row only while playing.** Wrapping is better for reading a static chart; a centered scroll is better for following a moving one. Switching on `isPlaying` gives each mode its best layout, at the cost of a re-render on play/pause (cheap).
- **Instant scroll, not smooth.** At 16ths/120+ BPM a smooth-scroll animation never catches the next step; instant keeps the playhead genuinely centered. Steps that share a sustained note resolve to the same marker x, so the chart only jumps per note, not per empty step.

**Sensors:** typecheck, eslint, prettier check, vitest (9 tests), and `npm run build` all pass.

**Next (still open from the feedback list):** reorganize the Transport/Settings for mobile (it is congested); move "stop/pause between loops" out of the MIDI-practice section into a general chart/player config and stop gating it solely on loop; per-note early/late/perfect feedback; review the MIDI latency offset. The Transport reorg is a design decision (tabs vs accordion vs drawer) worth confirming before building.

---

## 2026-06-19: Cleared the remaining bugs.md backlog (dense-division clip, active-measure follow)

**Status:** Closed the last three `bugs.md` items: the 24ths-in-embed clip, the 16ths note past the barline, and following measures during playback.

**Done:**

- **Dense divisions get a minimum measure width (fixes 24ths and 16ths clipping).** `renderScore` used a fixed `MIN_MEASURE_W = 240`, so at narrow widths or many measures the formatter was handed less width than it needed and notes spilled past the barline. The minimum is now `max(240, stepsPerMeasure * 16)`, and `measureWidth = max(minMeasureW, avail / perRow)`. When even one measure cannot fit the container it keeps the legible width and the `score-host` (already `overflow-x-auto`) scrolls, rather than cramming notes. Both the 24ths-embed clip and the 16ths-sticking note-past-the-barline shared this root cause (formatter starved of width); the earlier multi-measure wrap had already mitigated the worst case. Verified by constraining the host to 280-300px and confirming the SVG renders at the min measure width and the container scrolls, with notes inside the barline.
- **Active measure is highlighted during playback (follow the loop).** Playback already stacks every measure and auto-scrolls to the active one, but the only cue was the measure label colour. The active measure block now also gets a teal background tint and a 3px inset left border (`.play-stack__measure.is-active`), driven by the existing `activeMeasure` computed. Verified in-browser: the highlight moves bar to bar with the loop.

**Decisions:**

- **Minimum width scales with step count, not a flat value.** 16ths and below keep the old 240 floor; 24ths and 32nds need more room per step, so the floor tracks `stepsPerMeasure`. The floor only bites in narrow containers (embeds), where horizontal scroll is an acceptable trade for legible, un-clipped notes.
- **Treated #2 as a width bug, not a structural one.** The bugs.md note guessed at a beam/tuplet cause, but the note only escaped the barline when measures were starved of width (pre-wrap, ~145px bars). Wrap plus the density minimum keep bars wide enough, so the same fix covers both #1 and #2.
- **Follow via a block highlight, not auto-switching a single-measure view.** The stack already exists for playback; making the active block obvious is less disruptive than collapsing back to one measure and auto-advancing tabs.

**Sensors:** typecheck, eslint, prettier check, vitest (9 tests), and `npm run build` all pass.

**Backlog:** `bugs.md` is now empty of known issues.

---

## 2026-06-19: Two follow-up fixes (URL re-decode, tour Back)

**Status:** Cleared the two minor items the earlier Chrome pass left open.

**Done:**

- **`useUrlSync` now re-decodes on payload change.** It only decoded once at setup, so a `:payload` swap without a remount (pasting a different share link in the address bar) updated the URL but kept the old groove. Added a `watch(() => route.params.payload, ...)` that re-decodes, guarded by a `lastWritten` string so our own write-back does not trigger a redundant reload. Works for the editor and the read-only embed. Verified in-browser: switching payloads in the address bar now swaps the groove.
- **Tour hides Back on step 1.** The welcome step had a clickable, no-op Back button. Set its popover `showButtons: ['next', 'close']`. Verified step 1 shows only Next/close and Back returns from step 2 on.

**Sensors:** typecheck, eslint, prettier check all pass.

---

## 2026-06-19: Manual Chrome bug-hunt and four fixes

**Status:** Drove the app in Chrome looking for new bugs, then fixed four: a severe division-change regression, the Clear guard missing tom/ride lanes, the sticking-over-staff overlap (from `bugs.md`), and multi-measure line wrapping (from `bugs.md`). Plus a "32ths" label typo.

**Done:**

- **Division change was broken (severe, new find).** The `Select` UI component emitted the native `<select>` string value (`"8"`) and the `as unknown as T` cast did nothing at runtime, so `groove.division` became a string. Two failures cascaded: `encode()` threw `codec: unsupported division 8` (because `DIV_CODES.indexOf("8")` is `-1`), which left `useUrlSync`'s write-back dead so the URL silently stopped tracking edits; and `GrooveGrid`'s `v-for="i in stepsPerMeasure"` iterated a 1-char string, collapsing every lane to a single cell. Fixed at the root in `src/components/ui/Select.vue`: the change handler now maps the raw string back to the matching option and emits its typed `value`. Verified in-browser: switching to 8ths now renders 8 cells per lane, the hash updates, and no exception fires.
- **Clear ignored tom and ride lanes (new find).** `TopBar.vue` `onClear` only checked `hh` / `sn` / `kk` / sticking when deciding whether there was anything to clear, so a tom-only or ride-only groove could not be cleared (silent no-op, the confirm never even showed). Now it scans every present voice via `Object.values(groove.voices)`, matching what `clearAll` already does.
- **Stickings no longer collide with the staff (`bugs.md`).** Sticking `R` / `L` glyphs live on invisible ghost notes, so VexFlow's `top` justification parked them on the top staff line, right over the hi-hat x-heads and under the beam. `setYShift` is a no-op under top/bottom justification, so the fix uses `setTextLine(3)` in `vex-builder.ts` to lift them a few text lines clear of the beat-group beam. Verified at 8ths and beamed 16ths.
- **Score wraps measures onto rows (`bugs.md`).** `renderScore` laid every measure in one ever-narrowing row. It now computes `perRow` from the available width against a 240px minimum measure width and stacks rows (`ROW_HEIGHT = 120`). `StepMarker` and `MeasureBounds` gained `y` / `height`; `voiceY` stays a row-0 baseline and `Score.vue` adds the step's row offset (`y + sm.y`) for live MIDI markers. The playhead bar and the click-to-select overlays now position per row. Verified: 8 measures wrap to two rows in the editor (4+4) and the wider embed (5+3), measure selection works on row 2, and the playhead tracks the right row during playback. Single-measure rendering unchanged.
- **`32ths` to `32nds`** in the division dropdown label (`EditorView.vue`).

**Decisions:**

- **Fix the division bug in `Select.vue`, not at the call site.** `Select` is generic over `string | number` and is used only once today, but emitting a typed `value` is the component honoring its own contract, so any future numeric select is safe too. A `Number($event)` patch in `EditorView` would have masked the same latent bug elsewhere.
- **Stickings via `setTextLine`, not a pixel shift.** `setYShift` silently does nothing for top-justified annotations; text lines are the API VexFlow actually respects, and they keep stickings at a consistent height above the staff regardless of whether a given beat is beamed.
- **Wrap keeps a single VexFlow voice per measure, just repositioned.** Rather than reflow notes across a system break, each measure still renders independently; only its stave x/y moves. That kept the change contained and left the per-measure marker/selection math intact (just add a row offset).
- **Uniform measure width across rows.** The last row's measures keep the same width instead of stretching to fill, which reads more like a real chart and avoids a jarring width jump on the final line.

**Sensors:** typecheck, eslint, prettier check, vitest (9 tests), and `npm run build` all pass.

**Newly found, left open (logged in `bugs.md`):** pasting a different share link in the address bar does not reload the groove (`useUrlSync` decodes once at mount and does not watch the route); the tour's "Back" button is clickable on step 1. Both are low severity.

**Next:** The two remaining staff items in `bugs.md` (24ths clipped in a single-measure embed, 16ths note past the barline) were not part of this pass. The single-measure 24ths clip is a per-measure note-density issue that wrapping does not address.

---

## 2026-06-19 — Guided tour (driver.js)

**Status:** A first-run guided tour walks new visitors through the editor — naming, division, the grid, multi-measure tabs, the staff, playback, practice tools, settings/MIDI, and sharing. Auto-starts once per browser; replayable anytime from a new `?` (help) button in the top bar. Editor-only — embeds never load it.

**Done:**

- Added `driver.js@1.4.0` as a dependency.
- `src/composables/useTour.ts` (new) — owns the tour. Exports `useTour()` returning `startTour()` (manual replay) and `maybeAutoStart()` (first-visit only). 11 steps, each anchored to a `[data-tour="…"]` selector (welcome step is element-less / centered). `onDestroyed` writes a `groove:tourSeen` version flag to `localStorage`; `maybeAutoStart` no-ops once `seenVersion() >= TOUR_VERSION`. A `TOUR_VERSION` const lets a future content refresh re-trigger the auto-start for returning users. All `localStorage` access is `try/catch`-wrapped (private mode just forgets the tour).
- `data-tour` anchors added across existing components — no behavior changes: `TopBar.vue` (`naming`, `settings`, `share`, plus the new `help` button), `EditorView.vue` (`division`, `score`), `Transport.vue` (`transport`, `play`, `playback-options`), `GrooveGrid.vue` (`grid`), with `measures` on the MeasureTabs wrapper.
- `TopBar.vue` — new icon-only `?` button (lucide `HelpCircle`) between the GitHub link and Clear; calls `startTour()`.
- `EditorView.vue` — `onMounted` calls `maybeAutoStart()` inside `nextTick` so the grid/score have painted before the tour anchors to them.
- `src/styles/tailwind.css` — themed the popover via `.driver-popover.groove-tour` (two-class selectors outrank `driver.css` defaults, so no `!important`). Mono title, muted description, teal primary Next button, token-driven borders/shadow. Buttons reset with `all: unset` then restyled.

**Decisions:**

- **Tour lives in a composable, not a component.** Both `TopBar` (manual) and `EditorView` (auto) need to trigger it; a composable avoids prop/event plumbing and keeps the step copy in one place.
- **`data-tour` attributes over CSS-class/id coupling.** The tour shouldn't pin itself to styling classes that may change; dedicated data attributes are an explicit, greppable contract.
- **Editor-only by construction.** `useTour` is imported only by `TopBar` and `EditorView`; `EmbedView` pulls neither, so `driver.js` + its CSS stay out of the embed chunk (verified in the build output — `EmbedView` chunk unchanged, driver lands in the `EditorView` chunk).
- **Auto-start gated by a versioned flag, not a boolean.** Bumping `TOUR_VERSION` re-surfaces the tour to people who already dismissed it when a future step is worth re-showing. `localStorage` is allowed here per `docs/conventions.md` (transient UX state, never a URL substitute).
- **Copy in English.** Matches the rest of the app UI and the docs-in-English convention, even though prior chat was in Portuguese.

**Sensors:** typecheck, eslint, prettier check, vitest (9 tests), vite build all pass.

**Verified in browser:** auto-start on first load, popover theming, element spotlight + auto-scroll to the grid step, the `?` button replaying the tour, and the `groove:tourSeen` flag being written on close (so it doesn't auto-start twice).

**Follow-up polish (same day):**

- Removed em-dashes from all step copy and from code comments (user prefers no travessão in text). Standard hyphenated terms like "hi-hat" and "count-in" stay.
- Fixed the close (×) button: the earlier `all: unset` had stripped driver.css's `position: absolute; top; right`, throwing the × out of alignment. The close button is now only re-tinted, never reset, so it keeps its corner placement; added `padding-right` on the title so longer titles never slide under it.
- Fixed Back/Next/Done spacing: they were glued together by driver's default 4px margin. Reset that margin and put a `0.5rem` gap on `.driver-popover-navigation-btns` instead.

**Next:** If the step copy drifts from the UI as features land, bump `TOUR_VERSION` to re-show it. Could add a tour step for the embed-specific affordances if an embed-side walkthrough is ever wanted (separate step list, since embed chrome differs).

---

## 2026-05-01 — Practice timer (bounded loop session with on-screen clock)

**Status:** New control next to the Loop toggle lets the user pick a duration in minutes; an mm:ss clock sits between the staff and the transport. Hitting play with the timer enabled starts the countdown; at zero, playback auto-stops. Works in editor and embed (including `?ro=1`).

**Done:**

- `src/stores/practiceTimer.ts` (new) — Pinia store. Persists `minutes` (1–60, default 4) under `groove:practiceTimerMinutes`, mirroring the `readNumber`/`writeNumber` pattern used in `midi.ts`. Ephemeral `enabled` and `remainingMs` refs. `start()` / `stop()` manage a `setInterval(250ms)` against a wall-clock `expiresAt`. `setOnExpire(fn)` lets views register a callback that fires once when the countdown hits zero.
- `src/components/groove/PracticeClock.vue` (new) — small mm:ss readout with a `lucide` Timer glyph. Only renders when `enabled` is true. Shows the configured duration when idle and the live remaining time while running; running state gets a primary-color glow. **Positioned as an `absolute inset-x-0 bottom-2` overlay**, not in flow — so enabling the timer never adds vertical height. This matters in iframes with a fixed `height` attribute: an inline clock would have pushed the Transport row past the iframe edge. The clock is anchored to a small `relative` wrap that surrounds **only** the `<Score />` in each view, so the badge sits inside-and-on-top of the staff panel near its bottom edge (not floating at the very bottom of the page next to GrooveGrid). The badge uses `bg-background/90 backdrop-blur-sm` so it reads cleanly against the staff gradient.
- `src/components/groove/Transport.vue` — added a timer label group: Switch + `<input type="number">` (1–60) + "min". Lives in the same right-side row as Loop / Metronome / Count-in. Loop / Metronome / Count-in keep their `v-if="!props.readOnly"` gating; the timer label deliberately drops it. When `groove.loop === false`, the timer label is rendered with `opacity-40 cursor-not-allowed` and a tooltip that explains it requires loop. A watcher auto-disables the timer when the user toggles loop off, so the UI never shows "timer on" while loop is off.
- `src/views/EditorView.vue` — wraps `<Score />` in a `<div class="relative">` and mounts `<PracticeClock />` as the wrap's second child, so the absolute clock anchors to the score panel rather than to `<main>`. `onPlay` calls `practiceTimer.start()` if `enabled && groove.loop`; `onStop` calls `practiceTimer.stop()`. Registers `setOnExpire(() => onStop())` in `onMounted` so an expiring timer follows the same teardown path as a manual stop (preserves the existing measure-snapshot behavior).
- `src/views/EmbedView.vue` — same wiring. Score gets the same `relative` wrap with PracticeClock alongside it. Wraps `play(groove)` / `stop()` via local `onPlay` / `onStop` so the timer can hook into both.

**Decisions:**

- **Wall-clock, not Tone.Part.** A 4-minute practice session does not need sub-second accuracy, and embedding the timer in `Tone.Part` would force a re-anchor on every tempo / measure / metronome / count-in toggle. A `Date.now()`-anchored interval is decoupled from the audio scheduler and can't drift relative to "what the user expected when they pressed play."
- **Restart-on-play, no pause/resume.** Each press of Play resets `remainingMs` to the full configured duration. Pause/resume is more state to manage and the user did not ask for it.
- **Timer requires loop, but is its own toggle.** Forcing loop on automatically (the alternative we considered) would override a deliberate user choice. Disabled state with a tooltip is more honest. The `loop → false` watcher makes the disabled state self-healing rather than a click-to-clear footgun.
- **Always visible in `?ro=1` embeds.** This was the user's explicit ask: a shared chart should be usable as a practice loop without the embed owner having to drop the read-only flag. Loop / Metronome / Count-in still stay gated by `readOnly` — read-only means "you can't change the chart," not "you can't bound your practice session."
- **Per-origin localStorage for the minutes value.** Same key (`groove:practiceTimerMinutes`) for editor and embed since they share an origin. If embed and editor ever diverge by host, the embed will fall back to the default 4 — acceptable.
- **Inline minutes input, no presets popover.** User chose the inline form.
- **Clock as overlay, not in flow.** Initial pass placed it as a regular block between Score and Transport. The user flagged this would break iframes with a fixed `height` attribute (the embed becomes taller than its host frame, content gets clipped). Switching to absolute positioning at `bottom-2` of the relative-positioned container keeps the layout height identical with or without the timer enabled. The trade-off is the badge can overlap the bottom of the grid / score, but it's small (~28 px tall) and translucent enough to coexist.

**Sensors:** typecheck, eslint, prettier check, vitest (9 tests), vite build all pass.

**Caveats:**

- End-to-end was not exercised in a browser this session — only build sanity. The user should verify:
  1. Editor: 1-minute timer + loop on, hit play, confirm clock counts down and playback stops at 00:00.
  2. Loop interlock: turn loop off — timer label should gray out and the clock should disappear (the watcher disables the timer).
  3. Embed: open an embed URL, confirm the clock + toggle render. Verify with `?ro=1` that the timer toggle is still visible while Loop / Metronome / Count-in stay hidden.
  4. Persistence: change minutes, reload, value sticks.
- A separate `PracticeClock` chunk shows up in the build output (~54 kB raw, ~18 kB gzipped). That's the cost of being a shared component between two views; it's not a regression in the page-load critical path because the chunk is shared.

**Next:** If practicing against the click for a fixed duration becomes a routine, consider a "session complete" sound at expiry. Out of scope today.

---

## 2026-05-01 — GitHub link in the top bar

**Status:** Small navigation affordance. Icon-only anchor next to Clear in `TopBar.vue` opens `https://github.com/fguisso/groove` in a new tab. Uses lucide's `Github` glyph and the same muted-foreground hover treatment as the other toolbar chrome.

**Decision:** Anchor over button + `window.open` so middle-click and cmd-click work for opening the repo in a background tab without code.

---

## 2026-05-01 — Show/hide tom and cymbal lanes (Settings → Editor)

**Status:** Two new toggles in the Settings drawer collapse tom rows and cymbal rows from the grid. Purely visual — staff and audio still play every note.

**Done:**

- `src/lib/voices.ts` — `Voice.group?: 'tom' | 'cymbal'` field (optional). `t1`, `t2`, `t3` tagged `'tom'`; `ride` tagged `'cymbal'`. Future cymbal voices (crash, etc.) inherit the toggle by tagging themselves at registry time — no UI plumbing needed.
- `src/stores/midi.ts` — two new persisted booleans `showToms`, `showCymbals` (default `true`), keys `groove:showToms` / `groove:showCymbals`. Setters via the existing `writeBool` helper.
- `src/components/groove/GrooveGrid.vue` — `lanes` is now a `computed` filtering `VISIBLE_LANES` by `voice.group` against the store flags. Both single and stack render modes already iterated `lanes`, so no template changes — fewer rows just appear.
- `src/components/groove/MidiPanel.vue` — new "Editor" section between Export and MIDI device with two checkboxes plus a one-liner explaining the toggle is editor-only.

**Decisions:**

- **Visual only.** The codec, the `Groove` type, the store, and the URL hash were not touched. Two users opening the same share link must always see the same notes regardless of each one's local toggle state. Hidden lanes still play through the synth and still render on the staff.
- **Cymbal toggle is plural and forward-looking.** The user explicitly mentioned that `attacks` (crashes etc.) will land in their own lane later. Naming the toggle "Show cymbals" today avoids a rename when those land — they'll just tag `group: 'cymbal'` in the registry.
- **`group` on the voice registry, not a hardcoded list in `GrooveGrid`.** Putting the metadata next to the voice itself means any voice author handles their own grouping. The grid's filter stays oblivious to which voices are toms.
- **Persisted in `localStorage` like the other Settings flags** (`practiceMode`, `latencyMs`, `toleranceMs`). Personal editor preference, never per-groove.

**Next:** Watch for the user adding more cymbals (crash etc.) — should slot in cleanly. Tom soloing during playback is a tangential request that would need a different mechanism; not on the list yet.

---

## 2026-05-01 — Embed: follow OS theme via CSS, Edit-in-editor link

**Status:** Embed iframes now inherit the host's OS theme automatically (no JS listener, no postMessage protocol) and expose a small "Edit" link that opens the same groove in the full editor.

**Done:**

- `src/main.ts` — split the theme bootstrap into editor vs embed branches. Editor keeps the existing default `dark`. Embed default is `auto`: when the URL has no `?theme=`, no class is added at all and CSS handles the rest. `?theme=dark` adds `.dark`; `?theme=light` adds a marker `.theme-light` so the media query is bypassed.
- `src/styles/tailwind.css` — added a `@media (prefers-color-scheme: dark)` block scoped to `html.is-embed:not(.theme-light):not(.dark)` that mirrors the dark CSS-var palette. The dark `.panel` shadow override gets the same media-wrapped duplicate. Both palette and shadow are now duplicated — kept in sync via a comment at the top of the dark block.
- `src/views/EmbedView.vue` — `editorUrl` computed maps the current `route.params.payload` back into a `#/g/:payload` URL on the same `${origin}${pathname}`. New header row holds the title (truncated) plus an `<a target="_blank" rel="noopener">` styled with the lucide `ExternalLink` icon. Falls back to `#/` when no payload.

**Decisions:**

- **Pure CSS over `matchMedia('change')` listener.** A listener works, but the user explicitly asked for the no-events route. CSS recalculates on `prefers-color-scheme` change for free, and Safari's first-paint quirk doesn't apply here because the dark-vars rule only matters on a re-cascade triggered by the OS toggle, which Safari handles correctly.
- **Editor stays on `dark` default.** The user only flagged the embed as needing OS-following behavior. The editor is a focused workspace and the dark default is intentional.
- **`.theme-light` marker, not `.light`.** Two reasons: it's only used to break out of the media query (semantic = "explicit light override"), and using a name distinct from any Tailwind utility avoids collision risk if Tailwind ever adds a `.light` class strategy.
- **Edit link, not a button.** Native anchor with `target="_blank"` cooperates with browser middle-click / cmd-click to open background tabs. A button + `window.open` would lose that ergonomics.

**Caveat:** Light/dark dark-vars are duplicated in two CSS blocks. If a future palette tweak forgets one, hot-reloaded embed previews will silently disagree with the editor. A PostCSS step that emits both from a single source would be the proper DRY fix; left as-is for now since the palette is stable.

**Next:** Consider adding a "Copy link" button in the embed footer too, since "Edit" implies the user already wants to share / save the groove they're looking at.

---

## 2026-05-01 — Score uses full container width (cap removed)

**Status:** Bug fix on top of the multi-measure editor work. The staff was rendering at 720 px (the fallback) inside a much wider card, leaving the right portion of multi-measure grooves visually clipped at the staff's right edge.

**Root cause:** `Score.vue` was reading `container.clientWidth` from the inner host `<div ref="host">`, which sits inside an `inline-block` wrap. Inline-block elements without an explicit width are shrink-to-fit on their content; before the SVG is drawn, the inner div has `clientWidth === 0` and the renderer fell back to 720 px.

**Done:**

- `src/components/groove/Score.vue` — added a separate `hostRoot` ref on the outer `.score-host` (block-level, fills the panel). `availableWidth()` reads `hostRoot.clientWidth` and subtracts horizontal padding via `getComputedStyle`, then passes the result to `renderScore({ width })`. Also added a `ResizeObserver` on the outer host so the staff redraws on container resize, not only on `window.resize`.
- `src/lib/vex-builder.ts` — removed the `Math.min(1100, ...)` cap on width. The `max-w-[1200px]` constraint already lives on the page main, and the per-measure formatter can use the extra pixels for breathing room.
- `src/components/groove/Score.vue` — `text-center` on the host so when the SVG is narrower than its container (e.g. via an explicit `opts.width` in `export-png`), the staff centers instead of pinning left.

**Decisions:**

- **Read the outer host, not the inner.** The inner div is wrapped by `inline-block`; clientWidth there is content-derived and unreliable until after the first SVG paint. Outer host is `display: block` (the `.score-host` class) and reflects actual layout from first paint.
- **`ResizeObserver` over `window.resize` only.** Sidebars opening/closing, drawer overlays, and parent layout changes don't always fire `window.resize`. Observing the host catches everything.

**Caveat:** `availableWidth` calls `getComputedStyle` on each redraw. Cheap enough but worth noting if redraws ever land in a hot loop.

---

## 2026-05-01 — Multi-measure editor: GrooveGrid one-at-a-time, Score-driven nav

**Status:** Editor switches between a single-measure grid (paused) and a vertical stack of every measure (playing). Score becomes the navigator: clicking a measure on the staff selects it. Measures dropdown replaced by `[ 1 ] [ 2 ] ... [ N ] [ + ]` tabs.

**Done:**

- `src/stores/groove.ts` — `selectedMeasure: number` UI flag in state. `setSelectedMeasure(m)` clamps to `[0, measures-1]`; `setMeasures` and `replace` re-clamp; `reset` zeroes it. Lives in the store (not the URL hash) so it stays out of share links.
- `src/lib/vex-builder.ts` — `RenderResult` now exposes `measureBounds: { x, width }[]`, captured per stave inside the existing measure loop. Lets the Score component overlay click targets without reimplementing stave geometry.
- `src/components/groove/Score.vue` — transparent `<button class="score-measure-hit">` overlays per measure. Selected measure gets a faint primary tint + bottom border. Disabled while `isPlaying`. New `selectable` prop (default true) lets `EmbedView` opt out via `v-show`.
- `src/components/groove/MeasureTabs.vue` (new) — small tab strip reading `selectedMeasure` and `groove.measures` from the store. `+` button calls `setMeasures(measures + 1)` then jumps `selectedMeasure` to the new tail; disabled at 8.
- `src/components/groove/GrooveGrid.vue` (refactor) — two render modes driven by `props.isPlaying`:
  - **Single (paused):** renders only `selectedMeasure`. `globalIdx(measure, localIdx)` translates back into the underlying voice arrays so cycle/click handlers are unchanged.
  - **Stack (playing):** v-fors over every measure, each block self-contained (label header + sticking row + lanes). Wrapper has `max-height: min(70vh, 720px); overflow-y: auto`. `activeMeasure` watcher (recomputes from `currentStep`) calls `host.scrollTo({ top, behavior: 'smooth' })` only when the measure index changes — scrolling per step would fight the smooth animation.
- `src/views/EditorView.vue` — Measures `<Select>` removed (replaced by MeasureTabs inside the grid). `<Score>` gets `:is-playing`. `onStop` now snapshots the playing measure via `Math.floor(currentStep.value / division) % measures` _before_ calling `stop()`, so the single-mode grid resumes on the bar the user paused on.
- `src/views/EmbedView.vue` — Score gets `:is-playing` and `:selectable="false"` so the embed doesn't show clickable measure overlays.

**Decisions:**

- **`selectedMeasure` is store state, not local to EditorView.** Three components (Score, MeasureTabs, GrooveGrid) read it; the store's existing pattern of "Groove + a few editor-only flags" already accommodates UI-only state, and using a store ref means clamping logic lives next to `setMeasures`.
- **Stack-mode auto-scroll fires on measure change, not step change.** A per-step `scrollTo` either no-ops (when destination doesn't change) or restarts the smooth animation, both wasteful. Watching the derived `activeMeasure` keeps the scroll calls coarse and the animation continuous.
- **Pause = jump to currently-playing measure.** User chose this over "preserve pre-play selection" — matches the "pause to fix what just played" use case better than "pause as preview".
- **Score click is no-op while playing.** Scrubbing during play would mean re-anchoring the Tone transport mid-loop; not worth the regression risk for a feature whose primary need is editing-time navigation.
- **Max measures stays at 8 (current store cap).** Codec already supports far more (`measures` is a u8 with `n ≤ 2048` total steps), but 8 covers practice grooves and avoids stress-testing the vertical stack height.
- **Single-mode `+ Sticking` toggle stays on the first visible block only.** Toggle is global UI state; rendering it on every measure block during play would clutter and serves no purpose since toggling is disabled mid-play anyway.
- **Embed gets `selectable=false` rather than reusing `isPlaying=true`.** Different semantics — playing means "active runtime," not selectable means "no editor". Conflating them broke when an embed is paused.

**Sensors:** typecheck, eslint, vitest (9 tests), prettier check, vite build all pass.

**Caveats:** End-to-end browser exercise (clicking through tabs, watching the stack scroll mid-play, MIDI live markers in stack mode) was not possible from this session — only build sanity. The user should:

1. Verify scroll-to-center in stack mode visually with `measures=4..8`. If the host height calculation feels off, the math is `el.offsetTop - host.clientHeight/2 + el.clientHeight/2`.
2. Verify on `division=32 × measures=8` the perf is acceptable (each block has ~256 cells × 7 lanes; rendering all eight is the worst-case path that didn't exist before).
3. Verify MIDI live markers fire on the right cells in stack mode (the `globalIdx` math is shared between modes, so it should, but practice mode markers were specced against the single-row layout).

**Next:** Consider a "remove this measure" affordance per tab once the basic flow gets used. The store already supports lower `measures` via `setMeasures(n - 1)`, but there's no UI handle yet (out of scope for this pass).

---

## 2026-04-26 — Score markers aligned to actual notes

**Status:** Live MIDI markers on the staff now sit on top of the real noteheads (per voice), are bigger, borderless, and semi-transparent so the underlying note glyph reads through.

**Done:**

- `vex-builder.ts` now returns `voiceY: Record<VoiceId, number>` from `renderScore`. Each voice's Y is captured from `stave.getYForLine(...)` on the first measure's stave, using a `VOICE_LINE` table keyed off each voice's `vexKey` (e.g. `hh: -0.5` above the top line, `kk: 3.5` near the bottom).
- `Score.vue` consumes `voiceY` instead of the `VOICE_Y_PCT` percentage hack that was floating dots above the staff. Removed the table from the component entirely.
- Live marker style: 18×18 (was 12×12), no white border, fill drops to ~55 % alpha. Glow box-shadow keeps grade legible.

**Decisions:**

- **Capture once on measure 0.** Lines are identical across measures; iterating wastes work and risks the wrong stave winning if VexFlow reflows.
- **Semi-transparent on purpose.** The user wants to see if the marker is sitting on the actual notehead — opaque dots hide that, defeating the alignment check.
- **Voice line table colocated with vex-builder.** It has to stay in sync with each voice's `vexKey`; living next to the renderer makes that obvious.

**Next:** End-to-end pass on a real e-kit. If timing-on-the-staff (early/late) becomes desired, see the cautionary note below before reaching for `performance.now()` again.

**Future feature — missed-note markers:** Currently the live marker layer is purely hit-driven (every MIDI hit becomes a marker, graded vs. the programmed step). It does not surface _expected notes that the user failed to hit_. Add a note-driven pass: as each step plays (or once the tolerance window past it closes), check whether any in-window hit matched the expected voice; if not, drop a red marker on the unhit notehead. Implementation hinges on a stable per-step "expected vs. landed" map — likely best built once we have the audio-clock-anchored timeline (see the desync trap entry below) so the matching window is precise.

---

## 2026-04-26 — Reverted: timestamp-based marker positions (desync trap)

**Status:** Reverted. The plan was sound on paper, the result was visibly out of sync. Leaving this note so the next attempt doesn't repeat the same mistake.

**What was tried:**

- Captured `playbackStartedAtMs = performance.now()` right before `Tone.getTransport().start()`, exposed it from `usePlayback`.
- In the `lastHit` watcher, computed `elapsed = h.atMs - startMs - latencyMs`, modulo loop length, derived a `floatStep`, rounded to a logical step, applied a tolerance grace window, and stored `floatStep` on the marker so `Score.vue` could offset the circle horizontally for microtiming.

**Why it broke synchronization:**

- **`performance.now()` and the audio clock are not aligned.** Tone schedules with a lookahead (~100 ms by default) and the AudioContext's `currentTime` runs on a separate clock. Snapping a wall-clock anchor right before `transport.start()` means every elapsed calculation is off by the lookahead, plus jitter from the main thread.
- **`latencyMs` couldn't paper over it.** The user's latency slider was meant to compensate for kit→browser MIDI delay only. With timestamp-based positioning it also had to absorb the Tone lookahead and any scheduler drift, which made the slider's "right value" untethered from the physical hookup.
- **Modulo + negative elapsed = wrong loop.** When `latencyMs > 0` the first few hits in each loop produced negative `elapsed`, which the modulo flipped to the _previous_ loop's window — markers landed at the wrong end of the bar.
- **Mid-play config changes broke the math.** Tempo / measure / practice-mode toggles changed `totalLoopMs` without re-anchoring `playbackStartedAtMs`, so subsequent markers drifted progressively.

**What to do next time:**

- Use the audio clock (`Tone.now()` / `Tone.getTransport().seconds`) as the anchor, not `performance.now()`. The MIDI hit timestamp can be projected onto the transport timeline via `Tone.getContext().now()` at receive time.
- Or stay with `currentStep` snapping (lossy but stable) and add microtiming as a _separate_ visual that comes from the next hit's offset relative to the _next_ `Tone.getDraw().schedule` boundary, not from independent wall-clock math.
- Re-anchor on every `play()` AND every config change that affects loop length (`updateRuntime` should also reset the anchor and recompute).
- Treat this as an audio-engineering problem first, not a math problem. Write a small calibration test (loop a known pattern, click a UI button on the metronome, measure the offset) before wiring anything to the visualization layer.

**Files left untouched after revert:** `midi.ts`, `usePlayback.ts`, `Score.vue`, `EditorView.vue` are back to the previous, working state. Nothing to clean up.

---

## 2026-04-26 — Practice pause + Space shortcut + sticky markers on pause

**Status:** Optional review window between loop iterations and a fix to the play/pause shortcut.

**Done:**

- **Space replaces Esc** as the global play/pause shortcut. Switched detection to `e.code === 'Space'`. Settings drawer's Shortcuts section relabeled to `Space`.
- **MIDI practice mode (off by default).** New section in the Settings drawer with a checkbox + a 1–30 s slider (default 10 s). Both persisted to `localStorage` (`groove:midiPracticeMode`, `groove:midiPracticeSec`).
- **Silent pause between loops.** `usePlayback.play(g, { practicePauseSec })` schedules a per-second `timer` event series in the same `Tone.Part` after the track's last step. No metronome — just a `practiceTimerVal` ref counting down from N to 1. Loop-end extends to `trackEnd + pauseSec`. Pause is ignored when `g.loop` is false.
- **Review countdown overlay.** EditorView shows a teal/primary `practice-timer-number` (slightly smaller than the count-in glyph) with a "review" caption above it. Reuses the count-pulse keyframe.
- **Sticky markers on Pause.** Added `onPlay` / `onStop` wrappers in EditorView. Play always clears markers (fresh start). Stop only clears when `practiceMode` is off — practice mode keeps the verdicts on screen so the user can study after pausing. `lastTrackStep` was introduced so the no-count-in step-wrap detector ignores the `-1` transitions during the practice pause.

**Decisions:**

- **Pause coupled to loop only.** A practice pause without `g.loop = true` leaves the player staring at a dead screen; we just no-op it instead.
- **Single `Tone.Part` for everything.** Count-in beats + steps + timer ticks all share one part, so looping replays the whole sequence atomically. Avoids juggling multiple scheduled timelines.
- **Distinct color for the review countdown.** Teal vs. count-in's red so the user instantly reads "you're in review, not about to be on".
- **Markers cleared on Play, not on Stop.** This way the user's review can outlive a pause; only an intentional restart wipes the slate.

**Next:** Real e-kit pass; consider adding a brief audio cue at "1" of the review countdown so the player knows the next bar is imminent.

---

## 2026-04-26 — Drawer becomes Settings, persistent markers, looping count-in, ESC shortcut

**Status:** Practice/grading flow gone; the right drawer is now a general Settings panel; MIDI feedback markers stay on the grid and tablature for an entire bar; count-in plays before every loop; ESC is the one keyboard shortcut.

**Done:**

- **Practice flow removed.** Midi store dropped `practicing`, `startedAtMs`, `finalReport`, `startPractice`, `finishPractice`, `computeReport`, and `hits` (only `lastHit` matters now). `GrooveGrid` no longer computes a `gradeMap`, and `NoteCell` no longer carries a `grade` prop. `tailwind.css` lost the `.grade-correct/.grade-wrong/.grade-missed` outlines.
- **Drawer = Settings.** `MidiPanel.vue` re-titled "Settings". Sections: Export (PNG / MIDI), MIDI device, MIDI tuning, Last pad, Shortcuts. The export buttons in `TopBar` were removed (top bar now: Clear · Settings · Share). MidiPanel emits `exportMidi` / `exportPng` to EditorView, which still owns the score ref for PNG.
- **Looping count-in.** `usePlayback.ts` now folds count-in beats into the same `Tone.Part` as the track steps. Looping the part replays count-in before every iteration, matching a real practice flow. `loopEnd = countInLen + n × stepSec`.
- **Persistent markers.** Removed the 800 ms TTL in `pushMarker`. Markers stay visible until the editor explicitly calls `clearMarkers()`. `EditorView` clears them on `countInBeat === 3` (count-in path) or when `currentStep` wraps from `>0` back to `0` (no-count-in loop). Animations on the grid dot and the score circle changed from fade-out to one-shot pulse-in (220 ms) that resolves to a stable visible state.
- **ESC = play/pause.** Single global keydown listener in `EditorView`; ignored if focus is in an input/textarea/contenteditable. The previous "ESC closes drawer" handler in `MidiPanel` is gone.

**Decisions:**

- **Count-in inside the part, not as a separate `scheduleOnce` block.** Lets us loop the whole count+track without coordinating two timelines. Cost: count-in events fire as part of the part's draw schedule, so the user-visible `countInBeat` resets to 0 only when the first `step` event fires.
- **Markers cleared at count-in 3, not 1.** Gives the player two count beats to look at the verdict before the next bar starts. With count-in off, we fall back to wrapping `currentStep`.
- **Single shortcut on purpose.** Adding more (Space, R, etc.) was tempting; the user explicitly asked for one. Easy to extend later.
- **MIDI tuning sliders kept** even though no grading consumer uses them now. They're cheap UI and we'll wire them back when a grading view returns.

**Next:** End-to-end with the e-kit. Open follow-ups: marker persistence has no per-loop history (last loop's markers replace previous, can't compare bars over time); the `midi-grader` lib is now unused outside tests — keep or remove next pass.

---

## 2026-04-25 — Live MIDI markers on grid and tablature

**Status:** Every MIDI hit during playback now leaves a short-lived dot on the matching grid cell AND a colored circle on the staff, so the user can see in real time whether they nailed the timing/pad.

**Done:**

- Midi store: new `LiveMarker { id, voiceId, step, atMs, grade }` type with `grade ∈ { 'on-time', 'wrong-voice', 'off-time' }`, plus `markers` ref, `pushMarker`, `clearMarkers`. Markers auto-decay after 800 ms via `setTimeout`.
- `EditorView`: watches `midi.lastHit` and, while `isPlaying`, snaps the hit to `currentStep`, classifies it (`on-time` if the programmed groove has that voice firing here; `wrong-voice` if any other voice is expected; `off-time` if nothing is expected), and pushes a marker. `clearMarkers()` runs on stop so stale dots don't linger.
- `GrooveGrid` reads `markers` and forwards a per-cell `liveMarker` grade to `NoteCell`.
- `NoteCell` + `tailwind.css`: a small filled dot in the bottom-right corner of the cell, color-coded by grade, with an 800 ms scale/fade keyframe (`live-marker-fade`). Distinct from `live-hit` (column-0 verification glow) and from `grade-correct/wrong/missed` (practice-mode outlines).
- `Score.vue`: an absolutely-positioned circle is drawn at `stepMarkers[step].x + width/2`, with Y derived from a per-voice `VOICE_Y_PCT` mapping (rough staff-position approximation). Circles fade out via `score-marker-fade` over 800 ms.

**Decisions:**

- **Snap to `currentStep`, not to a tolerance window.** The cell granularity already encodes "near miss" via wrong-voice/off-time. Refining timing into "early/late by N ms" is a future step (and would conflict with the existing tolerance setting in practice grading).
- **Live markers are independent of practice mode.** They fire whenever playback runs and a device is connected — no Start/Finish required. Keeps the feature usable as casual visual feedback while jamming.
- **Three grade colors reused everywhere.** Green = on-time, amber = wrong-voice, red = off-time. Matches the practice-mode outline colors so users learn one palette.
- **Voice on staff via Y-percentage table.** Pulling exact note-head Y out of VexFlow is brittle; a coarse percentage map is good enough for a "the kick dot lands near the bottom" read.

**Next:** End-to-end with a real e-kit. Open follow-ups: snapping doesn't surface early/late timing; markers don't survive across loop boundaries (cleared on stop only).

---

## 2026-04-25 — MIDI drawer overlay + supported-flag fix

**Status:** MIDI panel now hidden by default and opens as a right-side drawer over the editor. Bug fix: panel was always reporting "Web MIDI not supported" even on Chrome.

**Done:**

- Bug fix in `src/stores/midi.ts`: `supported` was a plain `const` returned from the setup store, which `storeToRefs` silently drops (only refs/computed survive destructuring). The destructured `supported` in `MidiPanel` was therefore `undefined`, making `v-if="!supported"` always true. Wrapped in `ref(...)`. Also exposed `panelOpen` + `openPanel/closePanel/togglePanel`.
- `MidiPanel.vue` rewritten as a fixed `position: fixed` drawer with a backdrop, slide-in animation from the right, ESC to close, click-outside to dismiss. The editor layout itself is untouched.
- `EditorView.vue` reverted to its original single-column layout — the drawer is mounted as a sibling to `<main>` so it overlays without affecting the existing flow.
- `TopBar.vue` gained a `MIDI` button (with a small green dot when a device is connected) that calls `midi.togglePanel()`.

**Decisions:**

- **Drawer over sidebar.** First pass put MIDI in a sticky right column, but the user wanted the editor's CSS untouched and the panel hidden until explicitly opened. Drawer is the natural fit.
- **Open state lives in the store.** `panelOpen` next to the rest of the MIDI state means TopBar can toggle without prop-drilling and any other component (e.g. a future "Connect & start" CTA) can open the drawer too.
- **Live cell feedback stays independent of the panel.** `GrooveGrid` reads `lastHit`/grade map straight from the store, so the column-0 monitor and per-cell grading still work whether the drawer is open or closed.
- **Trigger lives in TopBar, not as a floating button.** Keeps with existing chrome and avoids a stray FAB.

**Next:** Live e-kit verification of the supported-flag fix and the drawer flow.

---

## 2026-04-25 — MIDI sidebar + in-grid feedback

**Status:** MIDI controls live in a wide right sidebar. The grid now doubles as the live pad monitor and the grading display.

**Done:**

- New `src/stores/midi.ts` — Pinia store owning Web MIDI access, hits, last-hit, latency/tolerance settings (persisted in `localStorage`), practice state, and final report. Replaces `src/composables/useMidiInput.ts` (deleted).
- `MidiPanel.vue` rewritten as a tall, sticky right-column sidebar with sections: Device · Settings (range sliders for latency/tolerance) · Last pad (voice label + GM note + velocity bar) · Practice · Score summary.
- `EditorView.vue` switched to a two-column layout (`flex-col lg:flex-row`); main column holds editor controls/score/transport/grid, right column hosts `MidiPanel` (`lg:w-[360px]` sticky to top).
- `GrooveGrid.vue` now reads the MIDI store. When playback is stopped and a device is connected, each incoming pad pulses the matching voice's step-0 cell for ~250 ms — verifies pad→voice mapping without leaving the grid. During practice it computes a live grade map (recomputed per hit); after Finish the frozen `finalReport` drives the same map.
- `NoteCell.vue` accepts `liveHit` and `grade` props; `tailwind.css` adds a `live-hit` pulse animation and `grade-correct/wrong/missed` outlines (green/amber/red dashed).

**Decisions:**

- **Grid column 0 reused as the live monitor.** No separate strip. When the user is connected but not practicing/playing, hitting a pad blinks the corresponding voice's first cell — works on empty cells too via a tinted background.
- **Grade map is live during practice.** `gradeHits` is greedy and stable over a sorted hit array, so recomputing on every store mutation gives correct partial state without breaking the final report.
- **State moved to a Pinia store.** Multiple components (`MidiPanel`, `GrooveGrid`) need the same hits/lastHit/settings; a shared store is cleaner than provide/inject or prop drilling.
- **Sliders, not number inputs.** Range inputs read better in a dense sidebar and avoid the spinner-driven typo problem when dialing latency.
- **Sidebar collapses on small screens.** `lg:` breakpoint puts the sidebar below the editor on narrow viewports; sticky-top behavior is `lg:` only.

**Next:** End-to-end verification with a real e-kit. Open follow-ups: extras have no in-grid representation (still a numeric-only count); multi-loop grading still uses loop-0 schedule.

---

## 2026-04-25 — Phase 3 complete (MVP — needs e-kit verification)

**Status:** Web MIDI listener, grader, and practice panel landed. Logic is unit-tested. End-to-end verification requires a connected e-drum kit and a supported browser; the user owns this.

**Done:**

- `src/lib/midi-grader.ts` — pure logic. `buildSchedule(g, startMs)` derives expected hits from a groove iterating the registry. `gradeHits(expected, actual, tol)` does greedy matching: prefers same-voice within tolerance, falls back to wrong-voice, otherwise marks missed. Unconsumed actuals become extras. `summarize(report)` rolls up to a percentage.
- `src/composables/useMidiInput.ts` — Web MIDI wrapper. Requests access on click, connects to first input, listens for note-on, maps GM note → voice via `voiceForMidiNote()` in `voices.ts`. Stores hits with `performance.now()` timestamps.
- `src/lib/voices.ts` — added `voiceForMidiNote()` plus an `INPUT_ONLY_MIDI` table for kit-side notes that don't appear in our state mappings (snare rim 37, alternate tom GMs, crash → ride fallback).
- `src/components/groove/MidiPanel.vue` — connect/disconnect, latency offset and tolerance inputs (both persisted to `localStorage`), Start/Finish practice buttons, score summary panel.
- Wired `MidiPanel` into `EditorView`. `EmbedView` stays read-only and has no MIDI affordance.
- `tests/midi-grader.spec.ts` — 8 cases covering schedule build, exact hits, tolerance window, wrong-voice grading, extras counting, same-voice preference, and summary rollup.

**Decisions:**

- **Practice mode is manual.** User clicks Start, plays through the chart however many loops, clicks Finish. No automatic tie to playback transport — keeps the panel independent and avoids state coupling.
- **Velocity and dynamic state ignored.** Grading checks voice + timing only. Whether the player executed a hit as accent or ghost is not measured. Adding this needs MIDI velocity → state inference, which is noisy and out of MVP scope.
- **Latency offset is manual.** No calibration screen yet — user dials in the offset that produces the best scores. Persisted per browser.
- **Default tolerance is 40 ms.** A typical drummer's tightness on consecutive 16ths at 120 BPM has spread in this range. Increase for forgiving practice, decrease to push tightness.
- **Aroma TDX 15S kit support.** GM 37 (rim) maps to snare for grading. GM 49 (crash) maps to ride since we don't have a crash voice yet.

**Known gaps for follow-up:**

- No per-cell visual feedback in the grid — the panel shows a numeric report only. Adding cell badges (green/red/yellow) is a UX win but requires plumbing grade state into `GrooveGrid`.
- Browsers without Web MIDI (Safari) get a clear unsupported message; no fallback.
- Multi-loop practice: hits past the first loop are still graded against the first loop's schedule. Pull `loop` true into the schedule builder to fix.
- No streak counter, no tempo ramp, no lesson flow — all explicitly deferred per the spec.

**Next:** End-to-end verification with the Aroma TDX 15S, then iterate from there. Cell-level visual feedback is the highest-value next slice.

---

## 2026-04-25 — Phase 2 complete

**Status:** Toms (t1, t2, t3) and ride lane wired in UI, render, and playback.

**Done:**

- Added `t2` (mid tom, GM 47) to the registry alongside the existing `t1` and `t3`. Synth in `usePlayback.ts` is a `MembraneSynth` tuned between `t1` (high) and `t3` (floor).
- Editor grid now shows seven lanes top-down: HI-HAT → RIDE → TOM 1 → TOM 2 → TOM 3 → SNARE → KICK.
- Lazy-allocated voice arrays in the store: clicking a tom or ride cell creates the array on first use, so empty lanes don't bloat URLs.
- `NoteCell` now reads its symbol/accent from the registry when given a `voiceId`. Ride cells render `x`/`X` to match the score notation; toms keep `●`/`◆`/`○`.
- Codec test extended to round-trip t2 alongside t1, t3, ride.

**Decisions:**

- Editor lane order keeps toms grouped together rather than splitting around the snare like a drum chart. Easier to scan when editing.
- All four extra lanes (ride + 3 toms) are always visible. No "+ Add tom" affordance for now; toggle UI adds noise we don't yet need.
- t2 GM note is 47 (low-mid tom). Standard GM has 48 too (hi-mid); we picked the lower one because the kit's mid tom typically sits closer to floor in pitch.

**Next:** Phase 3 — MIDI input MVP. Read `docs/specs/midi-input.md`. The registry already has GM mappings per voice — Phase 3 inverts that map for input. Open design questions on the spec (latency calibration, grading model, display) need decisions before coding.

---

## 2026-04-25 — Phase 1 complete

**Status:** Named voice abstraction landed. Ready for Phase 2.

**Done:**

- Added `src/lib/voices.ts` — single source of truth for voice metadata: id, label, kind, bitsPerCell, MIDI mapping per state, VexFlow render hints, synth dispatch keys.
- Bumped wire format to v4 (registry-driven voice presence bitmap). v3 stays read-only for legacy URLs; `t4` decodes to `t3` and `cy` decodes to `ride` so the wiki embed (`A1AAAEQBBEQggggggggAgACAQQAEAA`) still works.
- Refactored `model.ts`, `codec.ts`, `usePlayback.ts`, `vex-builder.ts`, `export-midi.ts`, and `stores/groove.ts` to read from the registry. Adding a voice now means: append to `VOICES`, add a synth in `usePlayback.ts` (only if its sound is genuinely new), and add a UI lane.
- Added codec tests: a v3 backward-compat case with the wiki payload, and a v4 round-trip exercising t1, t3, ride.

**Decisions:**

- Wire format kept presence as a 1-byte bitmap (max 8 voices). When we cross 8, bump format and use 2 bytes.
- Voice ids renamed: `t4` → `t3` (we have at most 3 toms in the target kit), `cy` → `ride` (specific instrument, not "any cymbal").
- `Voices` type guarantees `hh`, `sn`, `kk` are always present; toms and ride are optional. Keeps existing accessor sites simple.
- Synths for `t1`, `t3`, `ride` are pre-built in `usePlayback.ts` even though they have no UI yet — the lane addition in Phase 2 is then UI-only.

**Next:** Phase 2 — toms (t1, t2, t3) + ride lane in UI/render/playback. Read `docs/specs/toms-and-ride.md`. Note that the registry currently has `t1`, `t3`, `ride`; Phase 2 must add `t2` and decide whether to include t1/t2/t3 in the visible grid.

---

## 2026-04-25 — Phase 0 complete

**Status:** Engineering harness in place. Ready to start Phase 1.

**Done this session:**

- Fixed Safari iframe regression where the second of two embeds painted with `:root` (light) variables instead of `.dark`. Theme and `is-embed` classes are now applied synchronously in `src/main.ts` before Vue mounts. Commit `584bf54`.
- Bumped GitHub Actions to current majors (checkout v6, setup-node v6, configure-pages v6, upload-pages-artifact v5, deploy-pages v5) and Node runtime to 22 LTS. Commit `1bb8898`.
- Set up the engineering harness:
  - `CLAUDE.md` at repo root — orientation that points the agent at this file first.
  - `docs/architecture.md` — current module map, data flow, voice schema, known limitations.
  - `docs/conventions.md` — workflow rules, commit style, comment policy.
  - `docs/specs/{named-voice,toms-and-ride,midi-input}.md` — design notes for Phases 1 through 3.
  - ESLint flat config + Prettier with project-style defaults (no semis, single quotes, 100 cols).
  - `npm run lint`, `format`, `format:check`, `typecheck` scripts; `build` now does typecheck + Vite.
  - CI workflow runs typecheck, lint, format:check, and tests as separate steps.

**Next session:** Phase 1 — named voice abstraction. Read `docs/specs/named-voice.md` first; the spec calls out the open design questions to resolve before writing code. Phase 2 (toms + ride) and Phase 3 (MIDI input) depend on this landing first.

**Decisions made this session:**

- **MIDI feature stays in 4/4 rock only** for the MVP. Multi-meter and tuplets remain deferred (already in the README roadmap).
- **Target kit for Phase 3 is the Aroma TDX 15S**: HH (closed/open/pedal), kick, snare with rim/border, three toms, ride.
- **Docs in English**, consistent with existing README and code comments.
- **No husky / lint-staged** for now. CI is the gatekeeper. Revisit if pre-commit drift becomes a problem.
- **No custom review agent** for now. Built-in `simplify`, `review`, `security-review` skills are enough until Phase 3.
