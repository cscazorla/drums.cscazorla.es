/**
 * Valida todos los ejercicios. Corre dentro de `npm run build`, antes de Astro,
 * para que un fichero corrupto rompa el build en vez de llegar a producción.
 *
 * Comprueba, por fichero:
 *   - la carpeta coincide con el campo `category`
 *   - la categoría existe en categories.json
 *   - hay título
 *   - el `payload` decodifica a un groove válido
 */
import { basename, dirname } from 'node:path'
import { decode } from './groove-lib.ts'
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
    problems.push(`${where}: categoría "${exercise.category}" no existe en categories.json`)
  } else if (exercise.category !== folder) {
    problems.push(
      `${where}: category es "${exercise.category}" pero está en la carpeta "${folder}"`,
    )
  }

  if (!exercise.title?.trim()) problems.push(`${where}: falta "title"`)

  if (!exercise.payload) {
    problems.push(`${where}: falta "payload"`)
  } else if (!decode(exercise.payload)) {
    // El payload es la única fuente de verdad, así que si no decodifica el
    // ejercicio es irrecuperable: mejor enterarse aquí que en producción.
    problems.push(`${where}: el "payload" no decodifica a un groove válido`)
  }
}

if (problems.length > 0) {
  console.error(`\x1b[31m✗ ${problems.length} problema(s) en ${files.length} ejercicio(s):\x1b[0m\n`)
  for (const p of problems) console.error(`  • ${p}`)
  console.error('')
  process.exit(1)
}

console.log(`\x1b[32m✓\x1b[0m ${files.length} ejercicio(s) válidos`)
