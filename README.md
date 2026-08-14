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

3. Take the payload — the part of the URL after `#/g/` — and save it:

   ```sh
   npm run exercise:add -- \
     --payload BFoAAEQBJAcggggggggAQABAQABAAA \
     --category coordination \
     --title 'Linear exercise #1' \
     --tags linear,independence \
     --notes 'Start at 60 bpm, go up in steps of 5.' \
     --difficulty 3
   ```

   Writes `exercises/coordination/linear-exercise-1.json`.

   If you would rather not trim the address, paste the whole thing: `--payload`
   and `--url` both accept either form, and only the `#/g/<payload>` part is
   read — so a dev-server URL, the deployed site or an `#/embed/g/<payload>`
   link all work.

   ```sh
   npm run exercise:add -- --url 'http://localhost:4321/groove/#/g/BFoA…' …
   ```

   | Flag | |
   |---|---|
   | `--payload` / `--url` | required (either one). Bare payload or full editor URL |
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

## Editing measures

Groove's editor can only *add* an empty measure: there is no duplicate, no
copy/paste and no delete. Since the codec is available here, those operations
run on the payload instead — pass the payload in, paste the result back.

```sh
# duplicate measure 1 into a new measure at the end
npm run measure:dup -- --payload BFAA… --from 1

# copy measure 2 over measure 3, adding nothing
npm run measure:dup -- --payload BFAA… --from 2 --to 3

# delete measure 2; later measures shift down
npm run measure:rm  -- --payload BFAA… --measure 2

# --url takes the whole address, straight from the browser
npm run measure:rm  -- --url 'http://localhost:4321/groove/#/g/BFAA…' --measure 2
```

Notes, sticking and the repeat count travel with the measure in both commands.
Measure numbers start at 1, the editor's 8-measure ceiling is enforced, and the
last remaining measure cannot be deleted.

> **Try `Cmd/Ctrl+Z` first.** It undoes an accidental `+` and is not listed in
> the editor's own shortcut panel, which only documents `Space`. It only works
> until you reload, though — the history is in memory, which is when
> `measure:rm` becomes the way out.
>
> And if you only want a measure to *play* several times, you need none of
> this: the tab bar has a per-measure repeat counter. It plays N times and is
> drawn once.

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
  groove/        submodule → cscazorla/groove, a GPL-3.0 fork of fguisso/groove
  web/           Astro site
exercises/       the exercises, one folder per category
scripts/         authoring and validation CLI
categories.json  categories and their order
```

`scripts/groove-lib.ts` is the only point of contact with the submodule. It
imports `decode`/`encode` from its `codec.ts`, which depends on just three
other files with no external dependencies — that is why it works without
installing anything inside `apps/groove`.

## Working on Groove

`apps/groove` points at **[cscazorla/groove](https://github.com/cscazorla/groove)**,
a fork of [fguisso/groove](https://github.com/fguisso/groove), so the editor
can be changed here. It has two remotes:

| remote | |
|---|---|
| `origin` | the fork — where your work lives |
| `upstream` | `fguisso/groove` — where fixes and features come from |

### Changing the editor

```sh
cd apps/groove
git checkout -b my-change
# …edit, then:
npm run typecheck && npm run lint && npm test    # Groove's own gates
git commit -am '…' && git checkout main && git merge my-change
git push origin main

cd ../..
npm run build:groove          # rebuild the copy the site serves
git add apps/groove           # pin the new commit
```

> **Push the fork first, and commit `.gitmodules` alongside the new pin.**
> A submodule records a commit id, not the code. If the pinned commit only
> exists on your laptop, or `.gitmodules` still names the old repo, Netlify's
> clone fails.

### Pulling upstream changes

```sh
git -C apps/groove fetch upstream
git -C apps/groove merge upstream/main
npm run build:groove
npm run check                 # every payload still decodes?
```

If `npm run check` fails after a merge, the codec changed. Back the merge out
rather than pin it — there is no way to regenerate the payloads.

### License obligations

The fork is GPL-3.0-or-later, like the original. Two things follow, and the
fork satisfies both by existing: it is the **corresponding source** for the
bundle this site serves, and its git history records **what changed and when**
(GPL-3 §5a). Keep it public, and keep the original copyright notices intact.

Fernando's README puts it plainly: copyleft reaches those who *modify,
redistribute, or bundle* the source — which is now us. Sending a fix back
upstream is courtesy, not obligation.

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
[Groove](https://github.com/fguisso/groove) by Fernando Guisso, copyright (C)
2026, licensed under GPL-3.0-or-later.

`apps/groove` is a submodule pinned to a commit of
[cscazorla/groove](https://github.com/cscazorla/groove), a public fork of that
project carrying local modifications. The fork is the corresponding source for
the editor bundle served at `/groove/`, and its history records which files
were changed and when.
