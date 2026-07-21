import { useEffect, useRef } from 'react'

/** Keep screen on while the wall canvas is ambient (when supported). */
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    let cancelled = false

    async function request() {
      if (!active || !('wakeLock' in navigator)) return
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          await lock.release()
          return
        }
        lockRef.current = lock
        lock.addEventListener('release', () => {
          lockRef.current = null
        })
      } catch {
        // Unsupported or denied — fine for DIY installs
      }
    }

    void request()

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && active) {
        void request()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void lockRef.current?.release()
      lockRef.current = null
    }
  }, [active])
}
