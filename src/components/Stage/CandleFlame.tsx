import { useAppStore } from '../../store/useAppStore'

/** CSS candle flame for night — cheap, no extra assets. */
export function CandleFlame() {
  const theme = useAppStore((s) => s.resolvedTheme)
  const perf = useAppStore((s) => s.performanceMode)
  const reduced = useAppStore((s) => s.reducedMotion)

  if (theme !== 'night' || reduced || perf === 'low') return null

  return (
    <div className="candle-flame-root" aria-hidden>
      <div className="candle-glow" />
      <div className="candle-wick" />
      <div className="candle-flame candle-flame-a" />
      <div className="candle-flame candle-flame-b" />
      <div className="candle-flame candle-flame-c" />
    </div>
  )
}
