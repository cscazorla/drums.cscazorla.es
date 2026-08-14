/**
 * Valida los ejercicios y el vocabulario de tags. Corre dentro de `npm run
 * build`, antes de Astro, para que un fichero corrupto rompa el build en vez de
 * llegar a producción.
 *
 * Errores (rompen el build):
 *   - la carpeta no coincide con el campo `category`, o la categoría no existe
 *   - falta el título
 *   - el `payload` no decodifica
 *   - un tag no está declarado en tags.json, o está repetido en el ejercicio
 *   - un tag declara un `color` que no es de la paleta
 *
 * Avisos (no rompen nada):
 *   - un tag declarado que no usa ningún ejercicio
 *   - dos tags que comparten color
 */
import { basename, dirname } from 'node:path'
import { decode } from './groove-lib.ts'
import {
  TAG_COLORS,
  listExerciseFiles,
  readCategories,
  readExercise,
  readTags,
  rel,
  type TagColor,
} from './lib.ts'

const categories = new Set(readCategories().map((c) => c.id))
const declaredTags = readTags()
const tagIds = new Set(declaredTags.map((t) => t.id))
const files = listExerciseFiles()

const problems: string[] = []
const warnings: string[] = []
const tagUsage = new Map<string, number>()

// ── El vocabulario en sí ─────────────────────────────────────────

for (const tag of declaredTags) {
  if (!TAG_COLORS.includes(tag.color as TagColor)) {
    problems.push(
      `tags.json: el tag "${tag.id}" usa un color desconocido: "${tag.color}"\n` +
        `      Válidos: ${TAG_COLORS.join(', ')}`,
    )
  }
}

const byColor = new Map<string, string[]>()
for (const tag of declaredTags) {
  byColor.set(tag.color, [...(byColor.get(tag.color) ?? []), tag.id])
}
for (const [color, ids] of byColor) {
  if (ids.length > 1) {
    warnings.push(`tags.json: ${ids.map((i) => `"${i}"`).join(' y ')} comparten el color "${color}"`)
  }
}

// ── Los ejercicios ───────────────────────────────────────────────

for (const file of files) {
  const where = rel(file)
  let exercise
  try {
    exercise = readExercise(file)
  } catch (err) {
    problems.push(`${where}: no es JSON válido — ${(err as Error).message}`)
    continue
  }

  const folder = basename(dirname(file))
  if (!categories.has(exercise.category)) {
    problems.push(`${where}: categoría "${exercise.category}" no existe en categories.json`)
  } else if (exercise.category !== folder) {
    problems.push(
      `${where}: category es "${exercise.category}" pero está en la carpeta "${folder}"`,
    )
  }

  if (!exercise.title?.trim()) problems.push(`${where}: falta "title"`)

  const seen = new Set<string>()
  for (const tag of exercise.tags ?? []) {
    if (seen.has(tag)) {
      problems.push(`${where}: el tag "${tag}" está repetido`)
      continue
    }
    seen.add(tag)
    tagUsage.set(tag, (tagUsage.get(tag) ?? 0) + 1)

    if (!tagIds.has(tag)) {
      problems.push(
        `${where}: tag "${tag}" sin declarar en tags.json\n` +
          `      Válidos: ${[...tagIds].join(', ')}`,
      )
    }
  }

  if (!exercise.payload) {
    problems.push(`${where}: falta "payload"`)
  } else if (!decode(exercise.payload)) {
    // El payload es la única fuente de verdad, así que si no decodifica el
    // ejercicio es irrecuperable: mejor enterarse aquí que en producción.
    problems.push(`${where}: el "payload" no decodifica a un groove válido`)
  }
}

for (const tag of declaredTags) {
  if (!tagUsage.has(tag.id)) {
    warnings.push(`tags.json: "${tag.id}" no lo usa ningún ejercicio (no se generará su página)`)
  }
}

// ── Salida ───────────────────────────────────────────────────────

for (const w of warnings) console.warn(`\x1b[33m!\x1b[0m ${w}`)

if (problems.length > 0) {
  console.error(`\x1b[31m✗ ${problems.length} problema(s) en ${files.length} ejercicio(s):\x1b[0m\n`)
  for (const p of problems) console.error(`  • ${p}`)
  console.error('')
  process.exit(1)
}

console.log(
  `\x1b[32m✓\x1b[0m ${files.length} ejercicio(s) y ${declaredTags.length} tag(s) válidos`,
)
