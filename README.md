# drums.cscazorla.es

Personal library of drum exercises. Exercises are created locally with the
[Groove](https://github.com/fguisso/groove) editor, saved as `.json` files
tracked in git, and published as a static site.

No database and no backend: every exercise is a file.

## Getting started

```sh
git clone --recurse-submodules git@github.com:cscazorla/drums.cscazorla.es.git
cd drums.cscazorla.es
npm install
```

If you already cloned without submodules: `git submodule update --init`.

## Creating an exercise

1. Start the site and open the editor at
   [localhost:4321/groove/](http://localhost:4321/groove/):

   ```sh
   npm run dev
   ```

   One server for both the editor and the site. It serves the *compiled* copy
   of Groove, so run `npm run build:groove` once beforehand (and again after
   updating the submodule).

   Alternatively `npm run dev:groove` runs Groove's own dev server on
   [localhost:5173](http://localhost:5173) straight from the submodule
   sources, with no build step. Either one produces the same URLs.

2. Build the groove. The URL updates by itself: the whole exercise is encoded
   in it.

3. Copy the URL from the address bar and save it:

   ```sh
   npm run exercise:add -- \
     --url 'http://localhost:4321/groove/#/g/BFoAAEQBJAcggggggggAQABAQABAAA' \
     --category coordination \
     --title 'Linear exercise #1' \
     --tags linear,independence \
     --notes 'Start at 60 bpm, go up in steps of 5.' \
     --difficulty 3
   ```

   Paste the URL as-is. `--url` only cares about the `#/g/<payload>` part, so
   any of these work: either dev server, the deployed site, an
   `#/embed/g/<payload>` link, or a bare payload with no URL around it.

   Writes `exercises/coordination/linear-exercise-1.json`.

   | Flag | |
   |---|---|
   | `--url` | required. Editor URL, or a bare payload |
   | `--category` | required. One of those in `categories.json` |
   | `--title` | required |
   | `--tags` | comma-separated |
   | `--notes` | free text, shown on the exercise page |
   | `--difficulty` | 1–5 |
   | `--slug` | file name, derived from the title by default |
   | `--force` | overwrite if it already exists |

   Note the `--` after the script name: without it npm swallows the flags and
   the script never sees them.

4. It shows up on the index at [localhost:4321](http://localhost:4321/)
   straight away — the dev server picks up the new file, no restart needed.

## Running the site

```sh
npm run dev          # Astro dev server
npm run build        # full production build
npm run check        # validate every exercise
```

`npm run build` compiles Groove, validates the exercises and generates the
site. A corrupt exercise breaks the build instead of reaching production.

### From another device on your network

```sh
npm run dev:host            # the site, reachable at http://<your-ip>:4321/
npm run dev:groove:host     # the editor, same idea
```

Both print a `Network:` line with the address to open on the other device.
Handy for practising from a tablet on the kit, or checking the layout on a
phone.

Extra flags reach Astro through the `--` separator, so this works too:

```sh
npm run dev -- --host --port 4444
```

## Exercise format

```jsonc
{
  "title": "Paradiddle #1",
  "category": "practice-pad",
  "tags": ["paradiddle"],
  "notes": "RLRR LRLL en semicorcheas.",
  "difficulty": 2,
  "createdAt": "2026-08-13",
  "payload": "BFAAAEQBZAJVVVVVZZplmg"
}
```

`payload` is the whole exercise — tempo, time signature, every note and
sticking — and it is the single source of truth. Everything else is just
labels for the index page.

`npm run check` verifies that every payload still decodes, and runs before
Astro in `npm run build`, so a broken one fails the build rather than
reaching production.

> **Caveat.** Groove's README warns that the payload format is not a stable
> contract. Since the payload is all that is stored, a breaking codec change
> upstream would leave the exercises unreadable, with nothing to regenerate
> them from. Check a few exercises after running `git -C apps/groove pull`,
> and hold off on the update if they break.

## Categories

Defined in `categories.json`, which controls the valid categories, their
labels and the order of the sections on the index page all at once. Adding a
category means adding an entry there and creating the folder under
`exercises/`.

## Tags

A closed vocabulary, declared in `tags.json`. File order is chip order.

```json
[
  { "id": "linear", "label": "Linear", "color": "blue" },
  { "id": "paradiddle", "label": "Paradiddle", "color": "aqua" }
]
```

**Declare a tag before using it.** An undeclared tag is rejected by
`exercise:add` and fails `npm run check` — that is what stops `paradiddle` and
`paradiddles` becoming two different tags.

Each tag gets a page at `/t/<id>/`, and the index shows a chip row that filters
in place. The chips are ordinary links, so they work with JavaScript disabled.

### Colours

Pick one of these eight. They come from a palette validated for colour-blind
separation and contrast against this site's own surfaces:

| name | light | dark |
|---|---|---|
| `blue` | `#2a78d6` | `#3987e5` |
| `orange` | `#eb6834` | `#d95926` |
| `aqua` | `#1baf7a` | `#199e70` |
| `yellow` | `#eda100` | `#c98500` |
| `magenta` | `#e87ba4` | `#d55181` |
| `green` | `#008300` | `#008300` |
| `violet` | `#4a3aa7` | `#9085e9` |
| `red` | `#e34948` | `#e66767` |

An invalid colour fails `npm run check`, and the error lists these eight, so
you do not have to come back here mid-flow.

Past eight tags colours have to repeat. That is fine: a chip always carries its
written label, so colour accompanies identity rather than encoding it. `check`
warns about shared colours so it stays a decision rather than an accident. It
also warns about a tag declared but used by nothing — that one generates no
page.

> The chip's **text is always normal ink, never the tag colour**. Three of the
> light steps (aqua, yellow, magenta) fall below 3:1 on the light background, so
> they are fine as a border and a 12% tint beside a readable label, but would be
> unreadable as text. Keep it that way if you restyle chips.

## Favicon

`apps/web/public/favicon.drawio.svg` is a normal SVG that also carries its
draw.io diagram in the root `content` attribute. Browsers ignore that
attribute; the [draw.io VS Code extension](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio)
opens the file directly. Edit, save, done — it is served as-is, no build step.

It is drawn in a **single mid-tone red** (`#e34948`) on purpose. A browser tab
strip is light or dark depending on the theme, and that red clears 3:1 on both
(3.02 light, 4.07 dark), so the icon needs no `prefers-color-scheme` rule —
which matters because draw.io would drop such a rule when saving.

If you recolour it, keep to one colour that works on both tab strips. Going
near-black or near-white makes the icon vanish on one of them (near-black
measures 1.08:1 on a dark tab strip).

## Layout

```
apps/
  groove/        submodule → fguisso/groove. Never edited.
  web/           Astro site
exercises/       the exercises, one folder per category
scripts/         authoring and validation CLI
categories.json  categories and their order
```

`scripts/groove-lib.ts` is the only point of contact with the submodule. It
imports `decode`/`encode` from its `codec.ts`, which depends on just three
other files with no external dependencies — that is why it works without
installing anything inside `apps/groove`.

## Updating Groove

```sh
git -C apps/groove pull origin main
npm run build:groove
npm run check                    # every payload still decodes?
git add apps/groove
```

If `npm run check` fails after an update, the codec changed. Roll the
submodule back (`git -C apps/groove checkout <previous-commit>`) rather than
commit the update — there is no way to regenerate the payloads.

## Deployment

Netlify, driven by `netlify.toml` at the root. The submodule is declared over
HTTPS in `.gitmodules` because that is the only way Netlify can clone it.

Groove is served at `/groove/`, so the full editor is available in production.
No rewrite rules are needed: Groove uses hash routing with a relative base,
and Astro generates a real `.html` per exercise.

## A note on language

This README is in English; the site UI and the CLI output are in Spanish.

## License

GPL-3.0-or-later.

This repository includes and distributes
[Groove](https://github.com/fguisso/groove) by Fernando Guisso, licensed under
GPL-3.0-or-later. `apps/groove` is a submodule pinned to a specific commit of
the original repository, which is its corresponding source.
