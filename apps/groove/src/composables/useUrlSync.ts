import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGrooveStore } from '@/stores/groove'
import { decode, encode } from '@/lib/codec'

export function useUrlSync(opts: { writeBack?: boolean } = { writeBack: true }) {
  const route = useRoute()
  const router = useRouter()
  const store = useGrooveStore()

  // The payload we last wrote back, so the route watcher can tell our own URL
  // updates apart from a real navigation (e.g. the user pasting a new link).
  let lastWritten: string | undefined

  function load(payload: string | undefined) {
    if (!payload || payload === lastWritten) return
    const g = decode(payload)
    if (g) store.replace(g)
  }

  load(route.params.payload as string | undefined)

  // Re-decode when the payload changes without a remount. Vue Router reuses the
  // editor/embed component across a param change, so without this a pasted share
  // link would update the address bar but leave the old groove on screen.
  watch(
    () => route.params.payload as string | undefined,
    (payload) => load(payload),
  )

  if (opts.writeBack) {
    let timer: ReturnType<typeof setTimeout> | null = null
    watch(
      () => store.groove,
      (g) => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          const next = encode(g)
          lastWritten = next
          const name = route.name?.toString().startsWith('embed')
            ? 'embed-with-payload'
            : 'editor-with-payload'
          router.replace({ name, params: { payload: next } })
        }, 300)
      },
      { deep: true },
    )
  }
}
