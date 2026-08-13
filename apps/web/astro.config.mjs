// @ts-check
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'

// Raíz del monorepo, donde viven `categories.json` y `exercises/`.
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig({
  site: 'https://drums.cscazorla.es',
  trailingSlash: 'always',
  vite: {
    resolve: {
      // Evita cadenas de `../../../..` que se cuentan mal según la profundidad
      // de la página.
      alias: { '@root': repoRoot },
    },
    server: {
      // `exercises/` y `categories.json` viven fuera de apps/web.
      fs: { allow: [repoRoot] },
    },
  },
})
