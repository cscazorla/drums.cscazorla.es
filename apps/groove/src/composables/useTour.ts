import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'

// Bumped when the tour gains a step worth re-surfacing to returning users.
// Stored alongside the flag so a content refresh can re-trigger the auto-start.
// v2: chart auto-scroll, the Transport "Options" accordion + Pause between
// loops, and early/perfect/late MIDI timing feedback.
// v3: the state bar replaced cycle-on-tap, so the "build the beat" step would
// otherwise teach an interaction that no longer exists.
// v4: Play and the tempo moved into the bottom bar on a phone, and speed
// training joined the practice tools.
// v5: speed training got its own step (it was buried in a list and went
// unnoticed), and the Scroll brush arrived.
const TOUR_VERSION = 5
const TOUR_SEEN_KEY = 'groove:tourSeen'

function seenVersion(): number {
  try {
    return Number(localStorage.getItem(TOUR_SEEN_KEY)) || 0
  } catch {
    return 0
  }
}

function markSeen() {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, String(TOUR_VERSION))
  } catch {
    // Private mode / storage disabled, so the tour just won't remember itself.
  }
}

function steps(): DriveStep[] {
  return [
    {
      popover: {
        title: 'Welcome to Groove 🥁',
        description:
          'A drum groove editor that lives entirely in your browser. Build a beat, hear it, read it on a staff, and share the whole thing as a single link. Here is a quick tour. Hit Next.',
        // No Back button on the first step; there is nowhere to go back to.
        showButtons: ['next', 'close'],
      },
    },
    {
      element: '[data-tour="naming"]',
      popover: {
        title: 'Name your groove',
        description:
          'Give the pattern a title and an author. These travel inside the share link, so whoever opens it sees the same labels.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="division"]',
      popover: {
        title: 'Pick a subdivision',
        description:
          'Set how finely each beat is split: 8ths, 16ths, 32nds. This decides how many cells you get per measure.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="grid"]',
      popover: {
        title: 'Build the beat',
        description:
          'Tap a cell to drop the selected note; tap it again to clear it. Drag along a lane to fill a whole run in one go. Because dragging paints, pick the Scroll brush below when you want to drag the grid sideways instead. Lanes cover hi-hat, crash, ride, three toms, snare and kick.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="state-bar"]',
      popover: {
        title: 'Pick before you paint',
        description:
          'This bar holds the brush. Choose normal, accent, ghost, open or foot, then paint it onto the grid. The eraser clears, Scroll turns painting off so you can drag the grid sideways, R/L/B write sticking, and undo takes back a whole drag in one step (Cmd or Ctrl+Z works too). On a phone it also carries Play and the tempo, so both stay under your thumb.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="measures"]',
      popover: {
        title: 'Multiple measures',
        description:
          'Add up to 8 bars with the + tab and switch which one you are editing. You can also click a measure on the staff above to jump straight to it.',
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="score"]',
      popover: {
        title: 'Read it as a chart',
        description:
          'Everything you enter renders live as a real percussion staff, beamed per beat, just like a drum chart. While it plays, a marker rides the notes and the chart scrolls to keep the current note centered.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      // Anchored to the whole transport, not to the Play button: Play is
      // `hidden` on a phone (it lives in the bottom bar instead), and driver.js
      // would spotlight an invisible element.
      element: '[data-tour="transport"]',
      popover: {
        title: 'Hear it and practise it',
        description:
          'Play the groove through a synthesized kit, no samples to download; the Spacebar toggles it too. Loop the bar, add swing, click in a metronome and a count-in, set a timer that auto-stops the session, or add a silent Pause between loops to review. On a narrow screen these sit behind the Options button.',
        side: 'top',
        align: 'center',
      },
    },
    {
      // Same anchor as the step above on purpose: the control itself lives
      // inside the Options group, which is `display: none` on a phone.
      element: '[data-tour="transport"]',
      popover: {
        title: 'Speed training',
        description:
          'The one worth knowing about. Turn on Speed and the tempo climbs on its own: a few BPM every few loops, until it hits the target you set. Set it slow, start the loop, and play until the number stops moving. The tempo you reach is kept when you stop.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="settings"]',
      popover: {
        title: 'Settings & MIDI',
        description:
          'Connect a MIDI drum kit for live feedback: each hit lands on the staff graded early, perfect or late. Export the groove as a .mid or .png file, and hide tom or cymbal lanes you are not using.',
        side: 'bottom',
        align: 'end',
      },
    },
    {
      element: '[data-tour="share"]',
      popover: {
        title: 'Share anything',
        description:
          'The entire groove is packed into the URL, with no server involved. Share copies a link, and you can also embed it as an iframe on any page.',
        side: 'bottom',
        align: 'end',
      },
    },
    {
      element: '[data-tour="help"]',
      popover: {
        title: 'That is the tour',
        description: 'Replay it anytime from this button. Now go build a beat. 🎶',
        side: 'bottom',
        align: 'end',
      },
    },
  ]
}

export function useTour() {
  function startTour() {
    const d = driver({
      showProgress: true,
      popoverClass: 'groove-tour',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      steps: steps(),
      onDestroyed: markSeen,
    })
    d.drive()
  }

  // Auto-run once for first-time visitors. localStorage is fine here: it is
  // transient UX state, never a substitute for the URL (see docs/conventions).
  //
  // The flag is written at start, not on close: driver.js does not reliably
  // fire `onDestroyed` when the popover is dismissed with the × (verified in
  // 1.4), which left the tour auto-starting on every single visit. "Seen" is
  // the right meaning anyway — we showed it, whether or not it was read to the
  // end. `onDestroyed` stays wired as a belt-and-braces for manual replays.
  function maybeAutoStart() {
    if (seenVersion() >= TOUR_VERSION) return
    markSeen()
    startTour()
  }

  return { startTour, maybeAutoStart }
}
