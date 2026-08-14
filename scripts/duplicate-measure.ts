/**
 * Copia el contenido de un compás a otro.
 *
 * El editor de Groove no tiene duplicar ni copiar/pegar: al añadir un compás
 * siempre nace vacío. Como aquí ya tenemos su codec, la operación se hace sobre
 * el payload y se devuelve una URL lista para pegar de vuelta en el editor.
 *
 *   # duplicar el compás 1 en uno nuevo al final
 *   npm run measure:dup -- --payload BFAA…  --from 1
 *
 *   # copiar el compás 2 sobre el 3, sin añadir ninguno
 *   npm run measure:dup -- --payload BFAA…  --from 2 --to 3
 */
import { parseArgs } from 'node:util'
import { resizeArrays } from './groove-lib.ts'
import { MAX_MEASURES, describeGroove, fail } from './lib.ts'
import { INPUT_OPTIONS, grooveFromInput, reportResult } from './measure-io.ts'

const { values } = parseArgs({
  options: {
    ...INPUT_OPTIONS,
    from: { type: 'string' },
    to: { type: 'string' },
  },
})

if (!values.from) fail('Falta --from (número de compás a copiar, empezando en 1)')

const groove = grooveFromInput(values)

const from = Number(values.from)
if (!Number.isInteger(from) || from < 1 || from > groove.measures) {
  fail(`--from debe estar entre 1 y ${groove.measures} (recibido: "${values.from}")`)
}

const appending = values.to === undefined
let to: number

if (appending) {
  if (groove.measures >= MAX_MEASURES) {
    fail(
      `El groove ya tiene ${MAX_MEASURES} compases, el máximo del editor.\n  Usa --to para sobrescribir uno existente.`,
    )
  }
  to = groove.measures + 1
} else {
  to = Number(values.to)
  if (!Number.isInteger(to) || to < 1 || to > groove.measures) {
    fail(`--to debe estar entre 1 y ${groove.measures} (recibido: "${values.to}")`)
  }
  if (to === from) fail('--from y --to son el mismo compás; no hay nada que copiar')
}

const before = describeGroove(groove)
const stepsPerMeasure = groove.division // stepCount = division * measures

// Crecer primero: resizeArrays rellena de ceros los pasos del compás nuevo.
if (appending) {
  groove.measures += 1
  Object.assign(groove, resizeArrays(groove))
}

const src = (from - 1) * stepsPerMeasure
const dst = (to - 1) * stepsPerMeasure

for (const steps of Object.values(groove.voices)) {
  if (!steps) continue
  for (let i = 0; i < stepsPerMeasure; i++) steps[dst + i] = steps[src + i]
}
for (let i = 0; i < stepsPerMeasure; i++) {
  groove.sticking[dst + i] = groove.sticking[src + i]
}
// El número de repeticiones también forma parte del compás.
groove.repeats[to - 1] = groove.repeats[from - 1] ?? 1

console.log(`\x1b[2m  antes: ${before}\x1b[0m`)
reportResult(
  groove,
  values.base!,
  `compás ${from} copiado al ${to}${appending ? ' (nuevo)' : ' (sobrescrito)'} — notas, sticking y repeticiones`,
)
