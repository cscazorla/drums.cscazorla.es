# Origin and modifications

This directory is a copy of **[Groove](https://github.com/fguisso/groove)** by
Fernando Guisso, copyright (C) 2026, licensed under **GPL-3.0-or-later**. The
full licence text is in [`LICENSE`](./LICENSE) and is unchanged.

Copied from upstream commit
[`02ffcb9`](https://github.com/fguisso/groove/commit/02ffcb9027f639861f456d8e77869997debbbf09)
("feat: give each measure its own repeat count", 2026-07-30).

GPL-3 §5a asks that modified files carry a notice of the change and its date.
That is what this file is for. Everything not listed below is upstream's.

## Changes

### 2026-08-15 — `src/lib/vex-builder.ts`: measures no longer overflow

Notes ran past the barline and outside the SVG — 4 measures of 16ths spilled
119px beyond the canvas.

- `minMeasureW` reserved `stepsPerMeasure * 16` (256px for 16ths) where the
  notes need ~605px. It now asks the formatter, via
  `Formatter.preCalculateMinTotalWidth()`, instead of estimating.
- The formatter was handed a flat `measureWidth - 40` for every measure, which
  ignores the clef and time signature that only the first one carries, so its
  notes were laid out for more room than the stave actually gives them. The
  width now comes from `stave.getNoteStartX()`.

### 2026-08-15 — removed `.github/workflows/deploy.yml`

Upstream's GitHub Pages deployment. Inert here (Actions only reads workflows at
the repository root) and not how this site is served, which is Netlify.

## Keeping this file honest

Add an entry whenever you change a file under `apps/groove/`. It is the only
record of what diverges from upstream now that the code lives here directly
rather than as a submodule of a fork.
