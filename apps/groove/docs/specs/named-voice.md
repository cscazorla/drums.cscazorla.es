# Phase 1 — Named voice abstraction

## Why

Today every voice is a 2-letter key (`hh`, `sn`, `kk`, `t1`, `t4`, `cy`) hardcoded across five files:

- `src/lib/model.ts` — fields on `Groove.voices`, default empty arrays
- `src/lib/codec.ts` — bit slots, presence flags, decode order in v3 header
- `src/composables/usePlayback.ts` — `VoiceKey` union and Tone.js synth dispatch
- `src/lib/vex-builder.ts` — staff lane assignment per voice
- `src/lib/export-midi.ts` — GM note mapping per voice

Adding a new drum requires a coordinated edit across all five. Phase 2 (toms + ride) and Phase 3 (MIDI input with snare rim) both add new voices, so this debt blocks them.

## Goal

A single source of truth — a registry — that declares every voice once. Producers and consumers iterate the registry; they don't enumerate keys.

## Open design questions

Resolve these in the spec before writing code; update this section as decisions land.

1. **ID type.**
   - Option A: keep string literal union (`type VoiceId = 'hh' | 'sn' | 'kk' | ...`). Cheap, structural.
   - Option B: opaque branded string with a runtime registry. More flexible at the cost of type-level erasure.
   - Probably A for the producer side, with the registry as the runtime adapter.

2. **Codec stability.** The v3 wire format lays out voices in a fixed order with explicit `hasT1/hasT4/hasCy` presence flags. Two viable paths:
   - Keep v3 stable and only refactor the producers/consumers that read/write it.
   - Bump to v4 with a generic `[voiceCode, bitsPerCell, cells...]` repeating section. More flexible, slightly larger payloads.
   - **Existing URLs must keep decoding either way.** Add a regression test with a known-good v3 payload.

3. **Bits per cell per voice.** `hh` is 3 bits (5 states), others are 2 bits (4 states). The new abstraction must declare bits-per-cell per voice. Phase 3 may want a 5th state on snare (rim) — that would push snare to 3 bits and is a codec change.

4. **MIDI mapping.** Each voice should declare its GM note(s) for export and (later) the inverse map for input. Belongs in the same registry.

5. **Render hints.** Staff line, notehead style, stem direction. Two options:
   - Put in registry alongside MIDI mapping.
   - Keep render-side adapter separate from runtime registry, since render is VexFlow-specific.

## Constraints

- Existing URLs must still decode. Add a fixed v3 payload to test fixtures and assert round-trip equality.
- Public exports of `Groove` should stay structurally compatible at runtime. Consumers should iterate present voices, not destructure `groove.voices.hh`.
- No behavior change in this phase. Editor, playback, render, exports must all behave identically before and after.

## Out of scope

- Adding new voices in the UI (Phase 2).
- Any MIDI input plumbing (Phase 3).
- New codec features beyond what is needed to support the registry.

## Verification

- All existing tests pass unchanged.
- New tests cover: registry declares all six current voices; v3 round-trip on at least one realistic groove and one empty groove; encode-then-decode is identity for every voice present.
- Manual: load an old URL from `git log` or memory; confirm the editor reproduces it.
