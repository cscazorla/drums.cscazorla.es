import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'
import categories from '@root/categories.json'
import tags from '@root/tags.json'

const categoryIds = categories.map((c) => c.id) as [string, ...string[]]

// z.enum exige una tupla no vacía. Si tags.json estuviera vacío, el enum
// reventaría con un error que no explica nada, así que caemos a string suelto:
// `npm run check` sigue siendo quien valida el vocabulario.
const tagIds = tags.map((t) => t.id)
const tagSchema = tagIds.length > 0 ? z.enum(tagIds as [string, ...string[]]) : z.string()

/**
 * Los ejercicios viven en `exercises/` en la raíz del monorepo, fuera de
 * apps/web. El id de cada entrada queda como "<categoria>/<slug>", que es
 * también su ruta en el sitio.
 *
 * El `payload` es opaco aquí a propósito: la web sólo lo pasa al iframe. Que
 * decodifique a un groove válido lo comprueba `npm run check`, que corre antes
 * que Astro en `npm run build`.
 */
const exercises = defineCollection({
  loader: glob({ pattern: '**/*.json', base: '../../exercises' }),
  schema: z.object({
    title: z.string().min(1),
    category: z.enum(categoryIds),
    tags: z.array(tagSchema).default([]),
    notes: z.string().optional(),
    difficulty: z.number().int().min(1).max(5).optional(),
    createdAt: z.string().optional(),
    payload: z.string().min(1),
  }),
})

export const collections = { exercises }
