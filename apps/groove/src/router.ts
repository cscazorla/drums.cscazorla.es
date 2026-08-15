import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'editor',
    component: () => import('./views/EditorView.vue'),
  },
  {
    path: '/g/:payload',
    name: 'editor-with-payload',
    component: () => import('./views/EditorView.vue'),
  },
  {
    path: '/embed',
    name: 'embed',
    component: () => import('./views/EmbedView.vue'),
  },
  {
    path: '/embed/g/:payload',
    name: 'embed-with-payload',
    component: () => import('./views/EmbedView.vue'),
  },
  { path: '/:rest(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
