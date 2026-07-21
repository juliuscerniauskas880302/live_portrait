import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

/**
 * Cheap 3D feel: device orientation when available, else slow drift.
 * Disabled on low performance / reduced motion.
 *
 * Deadbands store writes so sensor noise / ambient drift does not
 * re-render frame chrome every animation frame (major mobile flicker source).
 */
export function useParallax() {
  const performanceMode = useAppStore((s) => s.performanceMode)
  const reducedMotion = useAppStore((s) => s.reducedMotion)
  const setParallax = useAppStore((s) => s.setParallax)

  useEffect(() => {
    if (reducedMotion || performanceMode === 'low') {
      setParallax(0, 0)
      return
    }

    let raf = 0
    let useSensor = false
    let targetX = 0
    let targetY = 0
    let curX = 0
    let curY = 0
    let publishedX = 0
    let publishedY = 0
    const start = performance.now()

    /** Only push to the store when the value meaningfully changed. */
    const publish = (x: number, y: number) => {
      const dx = x - publishedX
      const dy = y - publishedY
      // ~0.012 in normalized space ≈ 1–2 CSS px of shadow shift — ignore below that
      if (dx * dx + dy * dy < 0.00014) return
      publishedX = x
      publishedY = y
      setParallax(x, y)
    }

    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      useSensor = true
      // Clamp gently — wall mount rarely tilts far
      targetX = Math.max(-1, Math.min(1, e.gamma / 25))
      targetY = Math.max(-1, Math.min(1, (e.beta - 45) / 30))
    }

    window.addEventListener('deviceorientation', onOrient)

    const tick = (now: number) => {
      const store = useAppStore.getState()
      const timeSinceInteraction = Date.now() - store.lastInteractionAt

      if (useSensor) {
        // Heavier low-pass on sensor to kill high-frequency hand / table noise
        const k = 0.028
        curX += (targetX - curX) * k
        curY += (targetY - curY) * k
        publish(curX, curY)
      } else if (timeSinceInteraction > 4000 && !store.idle) {
        // Only apply ambient drift when user has been inactive for >4s
        const t = (now - start) / 1000
        targetX = Math.sin(t / 18) * 0.35
        targetY = Math.cos(t / 23) * 0.22
        const k = 0.02
        curX += (targetX - curX) * k
        curY += (targetY - curY) * k
        publish(curX, curY)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('deviceorientation', onOrient)
      cancelAnimationFrame(raf)
    }
  }, [performanceMode, reducedMotion, setParallax])
}
