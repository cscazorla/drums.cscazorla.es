import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Groove } from './groove-lib.ts'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const EXERCISES_DIR = join(ROOT, 'exercises')

export interface Category {
  id: string
  label: string
  blurb?: string
}

export interface Exercise {
  title: string
  category: string
  tags: string[]
  notes?: string
  difficulty?: number
  createdAt?: string
  payload: string
  groove: Groove
}

export function readCategories(): Category[] {
  return JSON.parse(readFileSync(join(ROOT, 'categories.json'), 'utf8')) as Category[]
}

/** Todos los .json de exercises/, como rutas absolutas, en orden estable. */
export function listExerciseFiles(): string[] {
  let dirs: string[]
  try {
    dirs = readdirSync(EXERCISES_DIR).filter((d) => statSync(join(EXERCISES_DIR, d)).isDirectory())
  } catch {
    return [] // aún no hay ejercicios
  }
  return dirs.sort().flatMap((dir) =>
    readdirSync(join(EXERCISES_DIR, dir))
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => join(EXERCISES_DIR, dir, f)),
  )
}

/** Ruta relativa a la raíz del repo, para mensajes legibles. */
export function rel(absolute: string): string {
  return absolute.slice(ROOT.length + 1)
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const DIVISION_NAMES: Record<number, string> = {
  4: 'negras',
  6: 'corcheas de tresillo',
  8: 'corcheas',
  12: 'semicorcheas de tresillo',
  16: 'semicorcheas',
  24: 'fusas de tresillo',
  32: 'fusas',
}

/** Resumen de una línea para la salida del CLI. */
export function describeGroove(g: Groove): string {
  const div = DIVISION_NAMES[g.division] ?? `división ${g.division}`
  const bars = g.measures === 1 ? '1 compás' : `${g.measures} compases`
  const voices = Object.keys(g.voices).join(', ')
  return `${g.timeSig[0]}/${g.timeSig[1]}, ${div}, ${bars}, ${g.tempo} bpm, voces: ${voices}`
}

/**
 * Extrae el payload de una URL del editor o del embed.
 * Acepta también un payload pelado, por comodidad.
 */
export function extractPayload(input: string): string | null {
  const fromUrl = input.match(/#\/(?:embed\/)?g\/([^?#/\s]+)/)
  if (fromUrl) return fromUrl[1]
  // payload pelado: base64url, sin barras ni protocolo
  if (/^[A-Za-z0-9_-]+$/.test(input.trim())) return input.trim()
  return null
}

export function readExercise(file: string): Exercise {
  return JSON.parse(readFileSync(file, 'utf8')) as Exercise
}

const isPrimitive = (v: unknown): boolean =>
  v === null || ['number', 'string', 'boolean'].includes(typeof v)

const MAX_WIDTH = 96

/**
 * Como JSON.stringify(v, null, 2), pero manteniendo los arrays de primitivos
 * en línea (envolviendo a ~96 columnas).
 *
 * Es lo que hace que un ejercicio sea legible en un diff: una voz se ve como
 * `"sn": [0, 0, 0, 0, 1, 0, ...]` en vez de como 16 líneas sueltas, así que en
 * un `git diff` se ve exactamente qué nota se ha movido.
 */
function stringify(value: unknown, indent = ''): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    if (value.every(isPrimitive)) {
      const items = value.map((v) => JSON.stringify(v))
      const oneLine = `[${items.join(', ')}]`
      if (indent.length + oneLine.length <= MAX_WIDTH) return oneLine

      // La coma va pegada a cada elemento salvo el último, de modo que al
      // repartir en líneas el resultado sigue siendo JSON válido.
      const withCommas = items.map((item, i) => (i < items.length - 1 ? `${item},` : item))
      const inner = indent + '  '
      const lines: string[] = []
      let current = ''
      for (const item of withCommas) {
        const candidate = current ? `${current} ${item}` : item
        if (inner.length + candidate.length > MAX_WIDTH && current) {
          lines.push(current)
          current = item
        } else {
          current = candidate
        }
      }
      if (current) lines.push(current)
      return `[\n${lines.map((l) => inner + l).join('\n')}\n${indent}]`
    }
    const inner = indent + '  '
    const parts = value.map((v) => inner + stringify(v, inner))
    return `[\n${parts.join(',\n')}\n${indent}]`
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined)
    if (entries.length === 0) return '{}'
    const inner = indent + '  '
    const parts = entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${stringify(v, inner)}`)
    return `{\n${parts.join(',\n')}\n${indent}}`
  }

  return JSON.stringify(value) ?? 'null'
}

/** Orden de claves fijo para que los diffs de git sean legibles. */
export function serializeExercise(e: Exercise): string {
  const ordered = {
    title: e.title,
    category: e.category,
    tags: e.tags,
    notes: e.notes,
    difficulty: e.difficulty,
    createdAt: e.createdAt,
    payload: e.payload,
    groove: e.groove,
  }
  const out = stringify(ordered)

  // Red de seguridad: `stringify` es a medida, así que confirmamos que lo que
  // vamos a escribir es JSON válido y equivalente antes de tocar el disco.
  const reparsed = JSON.parse(out)
  if (JSON.stringify(reparsed) !== JSON.stringify(JSON.parse(JSON.stringify(ordered)))) {
    throw new Error('serializeExercise ha producido un JSON que no coincide con la entrada')
  }

  return out + '\n'
}
