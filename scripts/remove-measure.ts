/**
 * Borra un compás de un groove.
 *
 * El editor de Groove no tiene forma de quitar un compás: el único control es
 * el `+`. `Cmd/Ctrl+Z` deshace el añadido, pero sólo mientras no recargues la
 * página — el historial vive en memoria. Cuando ya lo has perdido, este comando
 * es la salida.
 *
 *   npm run measure:rm -- --payload BFAA… --measure 2
 */
import { parseArgs } from 'node:util'
import { describeGroove, fail } from './lib.ts'
import { INPUT_OPTIONS, grooveFromInput, reportResult } from './measure-io.ts'

const { values } = parseArgs({
  options: {
    ...INPUT_OPTIONS,
    measure: { type: 'string' },
  },
})

if (!values.measure) fail('Falta --measure (número de compás a borrar, empezando en 1)')

const groove = grooveFromInput(values)

if (groove.measures <= 1) {
  fail('El groove sólo tiene un compás; no se puede quedar sin ninguno.')
}

const measure = Number(values.measure)
if (!Number.isInteger(measure) || measure < 1 || measure > groove.measures) {
  fail(`--measure debe estar entre 1 y ${groove.measures} (recibido: "${values.measure}")`)
}

const before = describeGroove(groove)
const stepsPerMeasure = groove.division // stepCount = division * measures
const start = (measure - 1) * stepsPerMeasure

// Hay que recortar a mano: `resizeArrays` sólo trunca por el final, así que no
// sirve para sacar un compás del medio.
for (const steps of Object.values(groove.voices)) {
  if (steps) steps.splice(start, stepsPerMeasure)
}
groove.sticking.splice(start, stepsPerMeasure)
groove.repeats.splice(measure - 1, 1)
groove.measures -= 1

console.log(`\x1b[2m  antes: ${before}\x1b[0m`)
reportResult(groove, values.base!, `compás ${measure} borrado, los siguientes se corren`)
