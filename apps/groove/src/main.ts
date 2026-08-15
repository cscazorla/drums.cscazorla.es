/*
 * Groove, a drum-groove editor.
 * Copyright (C) 2026 Fernando Guisso
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version. See the LICENSE file, or
 * <https://www.gnu.org/licenses/>, for the full text.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import './styles/tailwind.css'

// Apply theme and embed classes synchronously before Vue mounts. Safari
// resolves hsl(var(--token)) values at first paint and does not always
// re-cascade when classes are added later in onMounted, which produced an
// unstyled second iframe on pages with two embeds.
//
// Embed vs editor differ in defaults:
// - Editor defaults to dark (no `?theme` param needed for the canonical look).
// - Embed defaults to `auto`: no class is added, and the CSS media query
//   `@media (prefers-color-scheme: dark)` flips the dark vars when the host's
//   OS is dark. Hosts that need to force a specific look pass `?theme=light`
//   or `?theme=dark`. Doing this in CSS rather than JS means no listener is
//   needed when the OS theme changes — the iframe just reflows.
function applyInitialClasses() {
  const hash = window.location.hash
  const qIndex = hash.indexOf('?')
  const params = new URLSearchParams(qIndex >= 0 ? hash.slice(qIndex + 1) : '')
  const path = qIndex >= 0 ? hash.slice(0, qIndex) : hash
  const isEmbed = path.startsWith('#/embed/')
  const themeParam = params.get('theme')

  if (isEmbed) {
    if (themeParam === 'dark') document.documentElement.classList.add('dark')
    else if (themeParam === 'light') document.documentElement.classList.add('theme-light')
    document.documentElement.classList.add('is-embed')
    document.body.classList.add('is-embed')
    return
  }

  const theme = themeParam ?? 'dark'
  const dark =
    theme === 'dark' ||
    (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}
applyInitialClasses()

createApp(App).use(createPinia()).use(router).mount('#app')
