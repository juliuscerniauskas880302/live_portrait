import { useAppStore } from '../../store/useAppStore'

/** Realistic Gothic Candle image asset for night theme. */
export function CandleFlame() {
  const theme = useAppStore((s) => s.resolvedTheme)
  const perf = useAppStore((s) => s.performanceMode)
  const reduced = useAppStore((s) => s.reducedMotion)

  if (theme !== 'night' || reduced || perf === 'low') return null

  return (
    <div className="candle-flame-root" aria-hidden>
      {/* Warm Ambient Halo Glow */}
      <div className="candle-halo-glow" />

      {/* Photorealistic Candle Image Asset */}
      <img
        src="/candle.png"
        alt=""
        className="candle-image-asset"
        draggable={false}
      />
    </div>
  )
}
