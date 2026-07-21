import { useAppStore } from '../../store/useAppStore'
import { CandleFlame } from './CandleFlame'
import { RainOverlay } from './RainOverlay'

export function LightOverlay() {
  const theme = useAppStore((s) => s.resolvedTheme)
  const perf = useAppStore((s) => s.performanceMode)
  const idle = useAppStore((s) => s.idle)
  const eyeBrighten = useAppStore((s) => s.motion.eyeBrighten)
  const lightning = useAppStore((s) => s.frameLife.lightning)

  return (
    <div
      className={`light-overlay theme-${theme} perf-${perf} ${idle ? 'is-idle' : ''}`}
      aria-hidden
    >
      <RainOverlay />
      <div className="light-window" />
      <div className="light-candle" />
      <div className="light-vignette" />
      <div className="light-grain" />
      {theme === 'night' && <CandleFlame />}

      {/* Distant Thunder Lightning Glaze Reflection */}
      {lightning > 0.02 && (
        <div
          className="light-lightning-flash"
          style={{ opacity: lightning * 0.45 }}
        />
      )}

      {/* Soft room notice when portrait acknowledges */}
      <div
        className="light-notice"
        style={{ opacity: Math.min(0.2, eyeBrighten * 0.18) }}
      />
    </div>
  )
}
