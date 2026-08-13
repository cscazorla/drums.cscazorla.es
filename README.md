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
  "title": "Basic rock #1",
  "category": "grooves",
  "tags": ["rock", "beginner"],
  "notes": "Hi-hat on eighths, snare on 2 and 4.",
  "difficulty": 1,
  "createdAt": "2026-08-13",

  "payload": "BFoAAEQBJAcggggggggAQABAQABAAA",   // derived

  "groove": {                                     // source of truth
    "timeSig": [4, 4], "division": 16, "measures": 1, "tempo": 90,
    "voices": {
      "hh": [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      "sn": [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      "kk": [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]
    }
  }
}
```

**Both** are stored: `groove` is the source of truth (readable, and a
`git diff` shows which note moved) and `payload` is what the editor consumes.

Groove's README warns that the payload format is not a stable contract. So,
after updating the submodule:

```sh
npm run exercise:reencode -- --dry-run   # preview what would change
npm run exercise:reencode                # regenerate every payload
```

Because `groove` does not depend on the codec, exercises survive a format
change upstream.

## Categories

Defined in `categories.json`, which controls the valid categories, their
labels and the order of the sections on the index page all at once. Adding a
category means adding an entry there and creating the folder under
`exercises/`.

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
npm run exercise:reencode
npm run check
git add apps/groove exercises
```

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
