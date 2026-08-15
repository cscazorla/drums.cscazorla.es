import { onBeforeUnmount, ref } from 'vue'

// Minimal Wake Lock typings — TS' lib.dom coverage varies by version, so we
// keep our own narrow shape and cast `navigator` where needed.
interface WakeLockSentinelLike {
  released: boolean
  release(): Promise<void>
  addEventListener(type: 'release', listener: () => void): void
}
interface WakeLockNavigator {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> }
}

/**
 * Screen Wake Lock — keeps the phone from dimming/locking while a groove plays.
 *
 * The browser auto-releases the lock whenever the page is hidden (tab switch,
 * app backgrounded), so we track whether the caller still wants it and
 * re-acquire on `visibilitychange` when the page comes back to the foreground.
 */
export function useWakeLock() {
  const supported =
    typeof navigator !== 'undefined' && 'wakeLock' in (navigator as WakeLockNavigator)
  const active = ref(false)

  let sentinel: WakeLockSentinelLike | null = null
  let wanted = false

  async function acquire() {
    if (!supported) return
    try {
      const nav = navigator as unknown as WakeLockNavigator
      sentinel = (await nav.wakeLock!.request('screen')) ?? null
      active.value = true
      sentinel?.addEventListener('release', () => {
        active.value = false
        sentinel = null
      })
    } catch {
      // Permission denied or not allowed (e.g. low battery) — fail silently.
      active.value = false
      sentinel = null
    }
  }

  async function request() {
    wanted = true
    if (!sentinel) await acquire()
  }

  async function release() {
    wanted = false
    const s = sentinel
    sentinel = null
    active.value = false
    if (s && !s.released) {
      try {
        await s.release()
      } catch {
        // Already gone — nothing to do.
      }
    }
  }

  function onVisibility() {
    if (wanted && !sentinel && document.visibilityState === 'visible') acquire()
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
  }

  onBeforeUnmount(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility)
    }
    void release()
  })

  return { supported, active, request, release }
}
