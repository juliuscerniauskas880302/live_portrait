import { useEffect, useState } from 'react'
import {
  nightEasterEggs,
  type NightEggVisual,
} from '../engine/nightEasterEggs'
import { useAppStore } from '../store/useAppStore'

export function useNightEasterEggs() {
  const theme = useAppStore((s) => s.resolvedTheme)
  const surprise = useAppStore((s) => s.surpriseEnabled)
  const reduced = useAppStore((s) => s.reducedMotion)
  const [visual, setVisual] = useState<NightEggVisual>({
    candleFlare: false,
    blackout: false,
  })

  useEffect(() => {
    const unsub = nightEasterEggs.subscribe(setVisual)
    return () => {
      unsub()
    }
  }, [])

  useEffect(() => {
    if (theme === 'night' && surprise && !reduced) {
      nightEasterEggs.start()
    } else {
      nightEasterEggs.stop()
    }
    return () => nightEasterEggs.stop()
  }, [theme, surprise, reduced])

  return visual
}
