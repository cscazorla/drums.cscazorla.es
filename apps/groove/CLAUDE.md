# Groove — agent orientation

Frontend-only drum-groove editor. Click cells to build a beat, hear it through Tone.js synths, read it on a percussion staff via VexFlow, share it as a hash-encoded URL.

## Read first, every session

1. `docs/progress.md` — running journal. Tells you what was last done and what's next.
2. The spec for whatever phase you are picking up from `docs/specs/`.
3. `docs/architecture.md` — current module map and data flow.
4. `docs/conventions.md` — workflow rules and code style.

## Hard invariants

- **Frontend only.** No server, no backend calls, no analytics. The whole groove lives in the URL hash.
- **URL is the source of truth.** Editor reads on load and writes back on edit; embed reads only.
- **Embed view stays iframe-friendly.** It posts `groove:resize` to the parent and must not assume a host page theme.

## Sensors

| Command                | What it does                      |
| ---------------------- | --------------------------------- |
| `npm run typecheck`    | `vue-tsc --noEmit`                |
| `npm run lint`         | ESLint over `src/` and `tests/`   |
| `npm run format:check` | Prettier check                    |
| `npm test`             | Vitest run                        |
| `npm run build`        | typecheck + Vite production build |

Run the first three before every commit.

## Project shape

- `src/lib/` — pure logic (model, codec, render builders, exporters)
- `src/composables/` — Vue composables wrapping side effects (playback, URL sync)
- `src/stores/` — Pinia store
- `src/views/` — top-level routes (editor, embed)
- `src/components/groove/` — domain components
- `src/components/{ui,shell,icons}/` — generic chrome
- `tests/` — Vitest specs against `src/lib/`

## When you finish a meaningful task

Append a dated entry to `docs/progress.md` with what you did, what you decided, and what is next. The next session is somebody else (probably you) starting cold.
