/**
 * Valida todos los ejercicios. Corre dentro de `npm run build`, antes de Astro,
 * para que un fichero corrupto rompa el build en vez de llegar a producción.
 *
 * Comprueba, por fichero:
 *   - la carpeta coincide con el campo `category`
 *   - la categoría existe en categories.json
 *   - el `payload` decodifica
 *   - `payload` y `groove` describen el MISMO groove (encode(groove) === payload)
 */
import { basename, dirname } from 'node:path'
import { decode, encode } from './groove-lib.ts'
import { listExerciseFiles, readCategories, readExercise, rel } from './lib.ts'

const categories = new Set(readCategories().map((c) => c.id))
const files = listExerciseFiles()
const problems: string[] = []

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
    problems.push(
      `${where}: categoría "${exercise.category}" no existe en categories.json`,
    )
  } else if (exercise.category !== folder) {
    problems.push(
      `${where}: category es "${exercise.category}" pero está en la carpeta "${folder}"`,
    )
  }

  if (!exercise.title?.trim()) problems.push(`${where}: falta "title"`)

  if (!exercise.payload) {
    problems.push(`${where}: falta "payload"`)
    continue
  }
  if (!exercise.groove) {
    problems.push(`${where}: falta "groove"`)
    continue
  }

  if (!decode(exercise.payload)) {
    problems.push(`${where}: el "payload" no decodifica`)
    continue
  }

  // El invariante que de verdad importa: los dos campos no se han desincronizado.
  const expected = encode(exercise.groove)
  if (expected !== exercise.payload) {
    problems.push(
      `${where}: "payload" y "groove" no coinciden.\n` +
        `      payload:        ${exercise.payload}\n` +
        `      encode(groove): ${expected}\n` +
        `      Arréglalo con: npm run exercise:reencode`,
    )
  }
}

if (problems.length > 0) {
  console.error(`\x1b[31m✗ ${problems.length} problema(s) en ${files.length} ejercicio(s):\x1b[0m\n`)
  for (const p of problems) console.error(`  • ${p}`)
  console.error('')
  process.exit(1)
}

console.log(`\x1b[32m✓\x1b[0m ${files.length} ejercicio(s) válidos`)
