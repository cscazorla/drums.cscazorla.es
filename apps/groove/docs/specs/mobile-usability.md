# Mobile / tablet usability

Scope: usability only. Out of scope for this spec: the embed protocol, photo-to-score, OMR.

## Why

The editor was built mouse-first. On a phone the central bottleneck is **cycle-on-tap**: every
grid cell cycles through up to six states (empty, normal, accent, ghost, open, pedal). That
compounds three problems at once:

1. Repeated taps on the same cell. Reaching "ghost" can cost three taps, and overshooting means
   going around the whole cycle again.
2. Mental cost per cell. The user has to remember the cycle order; in KLM terms the Mental
   operator (~1.35 s) dominates, not the tap itself.
3. Small target plus repeated tap equals compounded error. At 16/24/32 divisions a cell falls well
   under Apple HIG's 44 pt and Material's 48 dp. Missing a cell does not just do nothing, it does
   the wrong thing in the wrong lane.

Reference point: Soundslice does not cycle state on a small cell. It separates _choosing the
value_ (a large fixed target in a footer) from _applying the value_ (a tap on the music), and it
curates that footer rather than accumulating buttons in it.

## Severity triage (Nielsen 0-4)

| Problem                                                     | Where it hurts                 | Severity |
| ----------------------------------------------------------- | ------------------------------ | -------- |
| Targets under 48 dp in the dense grid                       | phone, 16/24/32 divisions      | 4        |
| Transport outside the thumb zone                            | phone portrait, iPad landscape | 3        |
| No visible undo                                             | any mistake costs a rebuild    | 3        |
| 24/32 columns with no scroll affordance, no follow-playhead | phone                          | 3        |
| Screen sleeps during practice                               | lesson, standing up            | 3        |
| Audio does not play (iPhone mute switch, stuck context)     | user's first session           | 3        |
| `100vh` vs Safari's address bar                             | phone                          | 2        |
| Settings drawer covers the grid                             | iPad landscape                 | 2        |

## Phase 1: quick wins (landed)

- **1.1 Targets and touch hygiene.** Minimum 44 px touch box on coarse pointers, with the gutter
  bringing the touch pitch to 48 px. `touch-action: manipulation` on everything interactive to
  kill accidental double-tap zoom.
- **1.2 Stable viewport.** `100svh` instead of `100vh` so the layout does not jump when Safari's
  address bar collapses, with a `vh` fallback. `env(safe-area-inset-bottom)` on the shell.
- **1.3 Reliable audio on iOS.** `Tone.start()` inside the first gesture handler (already the
  case, via Play / Space); resume the context on `visibilitychange` because iOS suspends it in the
  background; one shared `AudioContext` (Tone's global, never constructed per view); a one-shot
  discreet notice that the iPhone side switch mutes Web Audio.
- **1.4 Wake Lock during playback.** Landed earlier (see `docs/progress.md` 2026-06-20).
- **1.5 Decent horizontal scroll.** Momentum scrolling on the grid wrapper, gradient edges showing
  there is more content, and follow-playhead so the sounding column stays centered.

## Phase 2: the core rework (landed)

- **2.1 Fixed state bar at the bottom (landed).** `sticky bottom-0`: one button per state (normal,
  accent, ghost, open, pedal), sticking R/L/B, visible undo/redo, eraser. Strong active-state
  highlight. iPad-landscape corner mirroring is not done.
- **2.2 Brush mode plus drag-to-paint (landed).** One tap applies the brush, a second tap on the
  same cell erases, a drag paints the run. The axis split is `touch-action: pan-y` on the cells:
  the browser keeps vertical panning, the app owns the horizontal axis. Cost of that choice: the
  grid no longer flick-scrolls sideways over the cells, only over the lane labels and the measure
  header. If that reads badly in real use, pagination (3.3) is the escalation.
- **2.3 Transport in the thumb zone (landed).** On a phone the bottom bar carries Play/Stop, the
  tempo with -5/+5 nudges, and undo/redo; the transport panel drops its own Play and BPM readout so
  there is no duplicate control. Secondary toggles stay behind the Options accordion. The iPad
  landscape variant (mirroring into the bottom corners) is not done.
- **2.4 Explicit Loop button (landed).** Text label plus icon, always visible, out of the Options
  accordion. The word is most of the target.
- **2.5 Speed training (landed).** Add N BPM every M loops until a target, in absolute BPM.
  `usePlayback` exposes a `loopCount`; the views watch it and call `setTempo`.

## Phase 3: structural (3.5 outstanding)

- **3.1 Lesson mode (landed).** A toggle in the top bar hides the staff, the transport panel and
  the division row, leaving the grid, the brush bar and Play. Holds the wake lock even while
  stopped, because you are standing at the kit transcribing between takes.
- **3.2 Groove presets (landed).** `src/lib/presets.ts` defines patterns in beats rather than
  cells, so one definition covers every division; anything the current division cannot represent is
  dropped and counted, and the UI says how many. Fills the selected measure only, in one history
  entry. Basic rock, 8ths hats, 16ths hats, four-on-the-floor.
- **3.3 Paged navigation (landed).** Previous/next arrows flank the numbered tabs rather than
  replacing them, and the whole strip is already hidden during playback.
- **3.4 Installable PWA (landed).** Manifest with `display: standalone`, icons rendered from the
  logo (192, 512, maskable 512, plus an `apple-touch-icon` because iOS ignores the manifest), and
  the iOS standalone meta tags. No service worker, so it is installable but not offline.
- **3.5 Dynamics sub-mode.** Not built. Vertical drag currently belongs to page scrolling, and
  taking it would undo the axis split that makes painting work at all. Worth doing only as an
  explicit sub-mode, and only once the brush has been used in anger.

## Do not copy

- A chromatic 88-key keyboard. Groove is a drum step grid; continuous pitch is irrelevant. The
  right abstraction is a palette of cell states.
- A full notation editor (hundreds of commands, command search, custom shortcuts, version
  history). Huge scope, no gain for a step grid.
- Server-side per-user settings. No accounts, no server. Local preferences stay in `localStorage`,
  the groove stays in the URL.
- Dark mode as a discovered opt-in. Groove is dark by default and the embed already follows the
  OS. Already solved, leave it.

## How to measure

Benchmark task: **one bar of basic rock** (hats on 8 eighths, snare on 2 and 4, kick on 1 and 3).

Measured, not estimated: `tests/interaction-cost.spec.ts` derives these from the real interaction
model and asserts them, so the numbers move when the editor does. The 8ths figures include the one
tap it takes to change the division.

|                                  | Interactions | Note                                |
| -------------------------------- | ------------ | ----------------------------------- |
| Cycle-on-tap, default 16ths grid | 12           | the plan's ~14-16 estimate was high |
| Cycle-on-tap at 8ths             | 13           |                                     |
| Cycle-on-tap, ghosted snare      | 16           | where cycling really compounds      |
| Brush plus drag at 8ths          | **6**        | verified end to end in the browser  |
| Preset, any division             | **2**        | open the menu, pick the groove      |
| Brush plus drag, ghosted snare   | 14           |                                     |
| With a preset (Phase 3)          | 1 plus edits | not built                           |

The finding that matters: **drag only collapses runs of adjacent cells.** Eighth notes on a
sixteenths grid are alternating cells, never adjacent, so there is nothing to drag across and the
brush ties cycling at 12. The "eight taps become one gesture" claim needs the division to match the
pattern. The brush's other win, non-default states, is unconditional: a ghosted snare drops from 16
to 14 because you pick "ghost" once instead of tapping through it in every cell.

Second, truer task: **transcribe a bar dictated in a lesson**, from opening the app to a correct
grid. That is the central use case and the number worth tracking.

Secondary metrics: time to first note; error rate (taps undone per session); number of horizontal
scrolls at 24/32 divisions.

Method: 3 to 5 people before and after each phase. No lab needed, record the screen and count taps.

## Triggers that change the plan

- If drag-to-paint fights scrolling below 360 px, pull pagination (3.3) ahead of the brush.
- If audio or wake lock fail in the field they become Phase 1 blockers, and nothing structural
  starts before they are fixed.

## Execution order

1. ~~All of Phase 1.~~ Landed 2026-07-30.
2. ~~Measure the benchmark.~~ 12 taps at 16ths, 13 at 8ths.
3. ~~2.1 and 2.2 together.~~ Landed 2026-07-30.
4. ~~Measure again.~~ 6 interactions, under the target of 8.
5. ~~2.3 through 2.5.~~ Landed 2026-07-30.
6. ~~Phase 3.~~ 3.1 to 3.4 landed 2026-07-30; 3.5 deliberately left alone.
7. Try it all on a real phone and iPad. Nothing in any phase has been, which is now the only thing
   standing between this plan and knowing whether it worked.

Still owed from the method section: the numbers above are counted, not observed. The 3-to-5-person
screen-recorded pass, and the "transcribe a bar dictated in a lesson" task, have not been run.
