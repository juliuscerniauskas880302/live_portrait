import { useEffect, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'

export function RainOverlay() {
  const thunderstormEnabled = useAppStore((s) => s.thunderstormEnabled)
  const perf = useAppStore((s) => s.performanceMode)
  const reducedMotion = useAppStore((s) => s.reducedMotion)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!thunderstormEnabled || reducedMotion || perf === 'low') return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let w = (canvas.width = canvas.offsetWidth || window.innerWidth)
    let h = (canvas.height = canvas.offsetHeight || window.innerHeight)

    const onResize = () => {
      if (!canvas) return
      w = canvas.width = canvas.offsetWidth || window.innerWidth
      h = canvas.height = canvas.offsetHeight || window.innerHeight
    }
    window.addEventListener('resize', onResize)

    // Rain drop particle system
    const count = perf === 'high' ? 65 : 35
    const drops = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vy: 12 + Math.random() * 18,
      len: 14 + Math.random() * 26,
      opacity: 0.15 + Math.random() * 0.3,
    }))

    const tick = () => {
      ctx.clearRect(0, 0, w, h)

      ctx.strokeStyle = 'rgba(210, 230, 255, 0.45)'
      ctx.lineWidth = 1.2
      ctx.lineCap = 'round'

      for (const d of drops) {
        ctx.beginPath()
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(d.x - 3, d.y + d.len)
        ctx.globalAlpha = d.opacity
        ctx.stroke()

        d.y += d.vy
        d.x -= 0.6
        if (d.y > h) {
          d.y = -d.len
          d.x = Math.random() * (w + 100)
        }
      }
      ctx.globalAlpha = 1.0

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf)
    }
  }, [thunderstormEnabled, perf, reducedMotion])

  if (!thunderstormEnabled || reducedMotion || perf === 'low') return null

  return (
    <div className="rain-overlay-root" aria-hidden>
      <canvas ref={canvasRef} className="rain-canvas" />
      <div className="rain-glass-streaks" />
    </div>
  )
}
