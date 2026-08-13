// @ts-check
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'

// Raíz del monorepo, donde viven `categories.json` y `exercises/`.
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

/**
 * Groove se copia a `public/groove/` y se enlaza como `/groove/`. Los hosts
 * estáticos (Netlify, `serve`) resuelven ese directorio a su `index.html`,
 * pero el servidor de desarrollo de Astro no lo hace y devuelve un 404.
 *
 * Este middleware lo iguala, para que `npm run dev` se comporte como
 * producción y el iframe del embed cargue también en local.
 */
const serveGrooveIndex = {
  name: 'serve-groove-index',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      // El fragmento (#/embed/g/...) no llega al servidor: aquí sólo vemos
      // "/groove/".
      if ((req.url ?? '').split('?')[0] === '/groove/') {
        req.url = '/groove/index.html'
      }
      next()
    })
  },
}

export default defineConfig({
  site: 'https://drums.cscazorla.es',
  trailingSlash: 'always',
  vite: {
    plugins: [serveGrooveIndex],
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
