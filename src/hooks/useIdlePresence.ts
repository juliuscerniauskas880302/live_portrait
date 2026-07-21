import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { motionDirector } from '../engine/motionDirector'
import { refreshThemeFromClock } from '../store/useAppStore'

const IDLE_MS = 3 * 60 * 1000

export function useIdlePresence() {
  const lastInteractionAt = useAppStore((s) => s.lastInteractionAt)
  const settingsOpen = useAppStore((s) => s.settingsOpen)
  const setIdle = useAppStore((s) => s.setIdle)
  const intensity = useAppStore((s) => s.intensity)
  const performanceMode = useAppStore((s) => s.performanceMode)
  const reducedMotion = useAppStore((s) => s.reducedMotion)
  const surpriseEnabled = useAppStore((s) => s.surpriseEnabled)
  const idle = useAppStore((s) => s.idle)

  useEffect(() => {
    const id = window.setInterval(() => {
      const state = useAppStore.getState()
      if (state.settingsOpen) {
        if (state.idle) setIdle(false)
        return
      }
      const shouldIdle = Date.now() - state.lastInteractionAt > IDLE_MS
      if (shouldIdle !== state.idle) setIdle(shouldIdle)
    }, 5000)
    return () => clearInterval(id)
  }, [lastInteractionAt, settingsOpen, setIdle])

  useEffect(() => {
    motionDirector.updateOpts({
      intensity,
      performanceMode,
      reducedMotion,
      idle,
      surpriseEnabled,
    })
  }, [intensity, performanceMode, reducedMotion, idle, surpriseEnabled])

  // Theme clock — check every minute
  useEffect(() => {
    refreshThemeFromClock()
    const id = window.setInterval(refreshThemeFromClock, 60_000)
    return () => clearInterval(id)
  }, [])
}
