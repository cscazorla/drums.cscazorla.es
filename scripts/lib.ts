import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  /** El groove entero, codificado. Única fuente de verdad del ejercicio. */
  payload: string
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
  }
  // `tags` es el único array y es corto, así que JSON.stringify basta para
  // que el fichero se lea bien en un diff.
  return JSON.stringify(ordered, null, 2) + '\n'
}
