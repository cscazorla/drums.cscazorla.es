# drums.cscazorla.es

Biblioteca personal de ejercicios de batería. Los ejercicios se crean con el
editor [Groove](https://github.com/fguisso/groove) en local, se guardan como
ficheros `.json` versionados en git, y se publican como sitio estático.

Sin base de datos y sin backend: cada ejercicio es un fichero.

## Puesta en marcha

```sh
git clone --recurse-submodules git@github.com:cscazorla/drums.cscazorla.es.git
cd drums.cscazorla.es
npm install
```

Si ya lo habías clonado sin submodules: `git submodule update --init`.

## Crear un ejercicio

1. Levanta el editor:

   ```sh
   npm run dev:groove          # http://localhost:5173
   ```

2. Construye el groove. La URL se actualiza sola: todo el ejercicio va
   codificado en ella.

3. Copia la URL y guárdala:

   ```sh
   npm run exercise:add -- \
     --url 'http://localhost:5173/#/g/BFoAAEQBJAcggggggggAQABAQABAAA' \
     --category coordination \
     --title 'Linear exercise #1' \
     --tags linear,independence \
     --notes 'Empezar a 60 bpm, subir de 5 en 5.' \
     --difficulty 3
   ```

   Escribe `exercises/coordination/linear-exercise-1.json`.

   | Flag | |
   |---|---|
   | `--url` | obligatorio. URL del editor o payload pelado |
   | `--category` | obligatorio. Una de las de `categories.json` |
   | `--title` | obligatorio |
   | `--tags` | separadas por comas |
   | `--notes` | texto libre, se muestra en la ficha |
   | `--difficulty` | 1–5 |
   | `--slug` | nombre de fichero, por defecto se deriva del título |
   | `--force` | sobrescribir si ya existe |

4. Míralo en el sitio:

   ```sh
   npm run build:groove        # una vez, o tras actualizar el submodule
   npm run dev                 # http://localhost:4321
   ```

## Ver el sitio

```sh
npm run dev          # servidor de desarrollo de Astro
npm run build        # build de producción completo
npm run check        # valida todos los ejercicios
```

`npm run build` compila Groove, valida los ejercicios y genera el sitio. Un
ejercicio corrupto rompe el build en vez de llegar a producción.

## Formato de un ejercicio

```jsonc
{
  "title": "Basic rock #1",
  "category": "grooves",
  "tags": ["rock", "beginner"],
  "notes": "Hi-hat en corcheas, caja en 2 y 4.",
  "difficulty": 1,
  "createdAt": "2026-08-13",

  "payload": "BFoAAEQBJAcggggggggAQABAQABAAA",   // derivado

  "groove": {                                     // fuente de verdad
    "timeSig": [4, 4], "division": 16, "measures": 1, "tempo": 90,
    "voices": {
      "hh": [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      "sn": [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      "kk": [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]
    }
  }
}
```

Se guardan **los dos**: `groove` es la fuente de verdad (legible, y en un
`git diff` se ve qué nota se movió) y `payload` es lo que consume el editor.

El README de Groove avisa de que el formato del payload no es un contrato
estable. Por eso, tras actualizar el submodule:

```sh
npm run exercise:reencode --dry-run   # ver qué cambiaría
npm run exercise:reencode             # regenerar todos los payloads
```

Como `groove` no depende del codec, los ejercicios sobreviven a un cambio de
formato de upstream.

## Categorías

Se definen en `categories.json`, que controla a la vez las categorías válidas,
sus etiquetas y el orden de las secciones del índice. Añadir una categoría es
añadir una entrada ahí y crear la carpeta en `exercises/`.

## Estructura

```
apps/
  groove/        submodule → fguisso/groove. NO se edita.
  web/           sitio Astro
exercises/       los ejercicios, una carpeta por categoría
scripts/         CLI de autoría y validación
categories.json  categorías y su orden
```

`scripts/groove-lib.ts` es el único punto de contacto con el submodule. Importa
`decode`/`encode` de su `codec.ts`, que sólo depende de otros tres ficheros sin
dependencias externas — por eso funciona sin instalar nada dentro de
`apps/groove`.

## Actualizar Groove

```sh
git -C apps/groove pull origin main
npm run build:groove
npm run exercise:reencode
npm run check
git add apps/groove exercises
```

## Despliegue

Netlify, con `netlify.toml` en la raíz. El submodule se declara por HTTPS en
`.gitmodules` porque es la única forma de que Netlify pueda clonarlo.

Groove se sirve en `/groove/`, así que el editor completo está disponible en
producción. No hacen falta reglas de rewrite: Groove usa hash routing con base
relativa, y Astro genera un `.html` real por ejercicio.

## Licencia

GPL-3.0-or-later.

Este repositorio incluye y distribuye [Groove](https://github.com/fguisso/groove)
de Fernando Guisso, licenciado bajo GPL-3.0-or-later. `apps/groove` es un
submodule fijado a un commit concreto del repositorio original, que es su
código fuente correspondiente.
