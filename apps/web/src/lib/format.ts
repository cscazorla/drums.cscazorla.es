const DIVISION_LABELS: Record<number, string> = {
  4: 'negras',
  6: 'corcheas T',
  8: 'corcheas',
  12: 'semicorcheas T',
  16: 'semicorcheas',
  24: 'fusas T',
  32: 'fusas',
}

export interface GrooveMeta {
  timeSig: [number, number]
  division: number
  measures: number
  tempo: number
}

export function divisionLabel(division: number): string {
  return DIVISION_LABELS[division] ?? `1/${division}`
}

/** "4/4 · semicorcheas · 2 compases · 90 bpm" */
export function grooveMeta(g: GrooveMeta): string {
  return [
    `${g.timeSig[0]}/${g.timeSig[1]}`,
    divisionLabel(g.division),
    g.measures === 1 ? '1 compás' : `${g.measures} compases`,
    `${g.tempo} bpm`,
  ].join(' · ')
}
