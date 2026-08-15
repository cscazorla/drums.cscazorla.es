# Conventions

## Pre-commit checklist

Always run before committing:

```sh
npm run typecheck
npm run lint
npm test
```

Before opening a PR, also run `npm run format:check`. CI runs all four.

## Comments

Default to no comments. Add a comment only when the WHY is non-obvious — a hidden constraint, a workaround for a specific bug, an invariant that would surprise a reader. Comments that paraphrase the code are noise.

Don't reference the current task or PR ("added for the X flow", "fixes #123"). That metadata belongs in the commit message.

## Tests

- Unit tests live under `tests/` and target `src/lib/*` (pure logic).
- Component or playback-timing tests are not yet present. Add them in the phase whose behavior depends on them — Phase 3 (MIDI grading) will need timing-comparison coverage.
- A new feature ships with tests for its non-trivial logic. "Non-trivial" excludes wiring, includes anything with branches or arithmetic.

## Commits

Match the style in `git log`:

- Subject: `type: short imperative subject`
- Types in use: `feat`, `fix`, `refactor`, `docs`, `ci`, `chore`, `test`
- Body explains the WHY, not the WHAT.

Example:

```
fix: apply theme/embed classes before Vue mounts to fix Safari iframe

Safari resolves hsl(var(--token)) at first paint and does not reliably
re-cascade when classes are toggled later in onMounted. ...
```

## Naming

- Voice ids today are 2-letter strings (`hh`, `sn`, `kk`, `t1`, `t4`, `cy`). The named-voice abstraction in `docs/specs/named-voice.md` will define the new shape.
- Components: `src/components/<group>/<PascalName>.vue`.
- Composables: `src/composables/use<Name>.ts`.
- Pure logic: `src/lib/<kebab-name>.ts`.

## Code style

Prettier owns formatting. Highlights:

- No semicolons.
- Single quotes.
- Trailing commas everywhere multi-line.
- 100-column print width.

ESLint catches the rest. If a rule is fighting real intent, disable it locally with a comment that explains why, or relax it in `eslint.config.js` with a note.

## When to update `docs/progress.md`

- After completing a meaningful task or merging a phase.
- After making a decision worth remembering (architecture choice, scope freeze, dependency add).

Newest entry on top, dated.

## When to write or update a spec

- Before starting a new feature large enough to span multiple files. The spec lives at `docs/specs/<feature>.md` and answers: why, scope, open design questions, constraints, what is out of scope.
- Update the spec as decisions are made. The spec is not a contract; it is a working notebook.

## Out of scope for code in this repo

- Backend calls, server-side rendering, analytics, telemetry.
- Persistent storage outside the URL hash (localStorage may be used for transient UX state like calibration; never as a substitute for the URL).
- Sample-based audio. All sounds are synthesized.
