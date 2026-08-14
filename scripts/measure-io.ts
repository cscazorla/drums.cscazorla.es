/**
 * Lo que comparten los comandos que manipulan compases sobre un payload:
 * leer la entrada y devolver una URL lista para pegar.
 */
import { decode, encode, type Groove } from './groove-lib.ts'
import { describeGroove, fail, resolvePayload } from './lib.ts'

export const DEFAULT_BASE = 'http://localhost:4321/groove/'

/** Opciones de entrada comunes a todos los comandos de compases. */
export const INPUT_OPTIONS = {
  payload: { type: 'string' },
  url: { type: 'string' },
  base: { type: 'string', default: DEFAULT_BASE },
} as const

/** Decodifica el groove de `--payload` o `--url`, o aborta. */
export function grooveFromInput(values: { payload?: string; url?: string }): Groove {
  const payload = resolvePayload(values)
  const groove = decode(payload)
  if (!groove) fail(`El payload no decodifica a un groove válido:\n  ${payload}`)
  return groove
}

/** Imprime el resultado y la URL para pegar de vuelta en el editor. */
export function reportResult(groove: Groove, base: string, note: string): void {
  console.log(`\x1b[32m✓\x1b[0m ${describeGroove(groove)}`)
  console.log(`\x1b[32m✓\x1b[0m ${note}`)
  console.log(`\nPega esto en el editor:\n  ${base.replace(/\/+$/, '')}/#/g/${encode(groove)}\n`)
}
