/**
 * Regenera el `payload` de cada ejercicio a partir de su objeto `groove`.
 *
 * Se ejecuta después de actualizar el submodule `apps/groove`. El README de
 * upstream avisa de que el formato del payload no es un contrato estable; como
 * la fuente de verdad es `groove`, aquí simplemente lo volvemos a codificar con
 * el codec nuevo y los ejercicios siguen funcionando.
 *
 * Con --dry-run sólo informa, sin escribir.
 */
import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { encode } from './groove-lib.ts'
import { listExerciseFiles, readExercise, rel, serializeExercise } from './lib.ts'

const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } })
const dryRun = values['dry-run']

const files = listExerciseFiles()
let changed = 0

for (const file of files) {
  const exercise = readExercise(file)
  const next = encode(exercise.groove)
  if (next === exercise.payload) continue

  changed++
  console.log(`  ${rel(file)}`)
  console.log(`\x1b[2m    ${exercise.payload} → ${next}\x1b[0m`)
  if (!dryRun) writeFileSync(file, serializeExercise({ ...exercise, payload: next }))
}

if (changed === 0) {
  console.log(`\x1b[32m✓\x1b[0m ${files.length} ejercicio(s), ningún payload ha cambiado`)
} else if (dryRun) {
  console.log(`\n${changed} de ${files.length} cambiarían (dry run, no se ha escrito nada)`)
} else {
  console.log(`\n\x1b[32m✓\x1b[0m ${changed} de ${files.length} payload(s) regenerados`)
}
