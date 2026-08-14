/**
 * Crea un ejercicio a partir de una URL del editor de Groove.
 *
 *   npm run exercise:add -- \
 *     --url 'http://localhost:5173/#/g/BFoAAEQBJAcggggggggAQABAQABAAA' \
 *     --category coordination \
 *     --title 'Linear exercise #1' \
 *     --tags linear,independence \
 *     --notes 'Empezar a 60 bpm'
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { decode, encode } from './groove-lib.ts'
import {
  EXERCISES_DIR,
  describeGroove,
  extractPayload,
  readCategories,
  readTags,
  rel,
  serializeExercise,
  slugify,
  type Exercise,
} from './lib.ts'

function fail(message: string): never {
  console.error(`\x1b[31m✗\x1b[0m ${message}`)
  process.exit(1)
}

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    category: { type: 'string' },
    title: { type: 'string' },
    tags: { type: 'string' },
    notes: { type: 'string' },
    difficulty: { type: 'string' },
    slug: { type: 'string' },
    force: { type: 'boolean', default: false },
  },
})

if (!values.url) fail('Falta --url (la URL del editor, o el payload pelado)')
if (!values.category) fail('Falta --category')
if (!values.title) fail('Falta --title')

const categories = readCategories()
if (!categories.some((c) => c.id === values.category)) {
  fail(
    `Categoría desconocida: "${values.category}".\n  Válidas: ${categories.map((c) => c.id).join(', ')}\n  (se definen en categories.json)`,
  )
}

// Vocabulario cerrado: un tag hay que declararlo en tags.json antes de usarlo.
// Es lo que evita acabar con "paradiddle" y "paradiddles" como tags distintos.
const declaredTags = readTags()
const tags = [
  ...new Set(
    (values.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  ),
]
const unknownTags = tags.filter((t) => !declaredTags.some((d) => d.id === t))
if (unknownTags.length > 0) {
  fail(
    `Tag${unknownTags.length > 1 ? 's' : ''} sin declarar: ${unknownTags.map((t) => `"${t}"`).join(', ')}.\n` +
      `  Válidos: ${declaredTags.map((t) => t.id).join(', ')}\n` +
      `  Para usar uno nuevo, decláralo antes en tags.json.`,
  )
}

const payload = extractPayload(values.url)
if (!payload) {
  fail(
    `No he sabido extraer el payload de:\n  ${values.url}\n  Esperaba algo tipo http://localhost:5173/#/g/<payload>`,
  )
}

// Decodificamos sólo para validar y para poder resumir el ejercicio por
// pantalla; el groove no se guarda, el payload es la única fuente de verdad.
const groove = decode(payload)
if (!groove) {
  fail(`El payload no decodifica a un groove válido:\n  ${payload}`)
}

// Re-encodear para normalizar: el payload que guardamos siempre es el
// canónico que produce este codec, no el que venía en la URL.
const canonical = encode(groove)

const difficulty = values.difficulty !== undefined ? Number(values.difficulty) : undefined
if (difficulty !== undefined && (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5)) {
  fail(`--difficulty debe ser un entero entre 1 y 5 (recibido: "${values.difficulty}")`)
}

const slug = values.slug ? slugify(values.slug) : slugify(values.title)
if (!slug) fail(`El título "${values.title}" no produce un slug válido; usa --slug`)

const exercise: Exercise = {
  title: values.title,
  category: values.category,
  tags,
  notes: values.notes || undefined,
  difficulty,
  createdAt: new Date().toISOString().slice(0, 10),
  payload: canonical,
}

const outFile = join(EXERCISES_DIR, values.category, `${slug}.json`)
if (existsSync(outFile) && !values.force) {
  fail(`Ya existe ${rel(outFile)}\n  Usa --force para sobrescribirlo, o --slug para otro nombre.`)
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, serializeExercise(exercise))

console.log(`\x1b[32m✓\x1b[0m ${describeGroove(groove)}`)
if (canonical !== payload) {
  console.log(`\x1b[2m  payload normalizado (${payload.length} → ${canonical.length} chars)\x1b[0m`)
}
console.log(`\x1b[32m✓\x1b[0m escrito ${rel(outFile)}`)
