import { useEffect, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'

interface Mote {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  a: number
  /** 0–1 how tightly bound to the light beam */
  beam: number
}

export function ParticleOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const theme = useAppStore((s) => s.resolvedTheme)
  const perf = useAppStore((s) => s.performanceMode)
  const reduced = useAppStore((s) => s.reducedMotion)
  const idle = useAppStore((s) => s.idle)

  useEffect(() => {
    if (perf === 'low' || reduced) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let w = 0
    let h = 0
    const count = perf === 'high' ? 32 : idle ? 10 : 16
    let motes: Mote[] = []

    let lastW = 0
    let lastH = 0
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, perf === 'high' ? 1.5 : 1)
      const nextW = Math.max(1, Math.round(canvas.clientWidth))
      const nextH = Math.max(1, Math.round(canvas.clientHeight))
      // Deadband: avoid buffer thrash from mobile browser chrome
      if (Math.abs(nextW - lastW) < 2 && Math.abs(nextH - lastH) < 2 && lastW > 0) {
        return
      }
      lastW = nextW
      lastH = nextH
      w = nextW
      h = nextH
      const targetW = Math.floor(w * dpr)
      const targetH = Math.floor(h * dpr)
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW
        canvas.height = targetH
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      motes = Array.from({ length: count }, () => spawn(true))
    }

    // Day: beam from upper-left window. Night: fewer, candle from lower-right.
    const beamCenter = () => {
      const isNight = theme === 'night'
      return {
        cx: isNight ? w * 0.72 : w * 0.28,
        cy: isNight ? h * 0.78 : h * 0.2,
        rx: isNight ? w * 0.22 : w * 0.2,
        ry: isNight ? h * 0.28 : h * 0.45,
      }
    }

    const spawn = (randomY: boolean): Mote => {
      const { cx, cy, rx, ry } = beamCenter()
      const inBeam = Math.random() < (theme === 'night' ? 0.55 : 0.75)
      if (inBeam) {
        const ang = Math.random() * Math.PI * 2
        const rr = Math.random()
        return {
          x: cx + Math.cos(ang) * rx * rr,
          y: cy + Math.sin(ang) * ry * rr,
          r: 0.5 + Math.random() * 1.5,
          vx: (Math.random() - 0.5) * 0.12,
          vy: theme === 'night' ? -0.04 - Math.random() * 0.12 : -0.06 - Math.random() * 0.18,
          a: 0.2 + Math.random() * 0.5,
          beam: 0.7 + Math.random() * 0.3,
        }
      }
      return {
        x: Math.random() * w,
        y: randomY ? Math.random() * h : h + 4,
        r: 0.5 + Math.random() * 1.2,
        vx: (Math.random() - 0.5) * 0.1,
        vy: -0.05 - Math.random() * 0.12,
        a: 0.1 + Math.random() * 0.25,
        beam: 0.15,
      }
    }

    const tick = () => {
      ctx.clearRect(0, 0, w, h)
      const isNight = theme === 'night'
      const { cx, cy, rx, ry } = beamCenter()

      // Soft beam volume (very faint)
      if (perf === 'high') {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry) * 1.4)
        g.addColorStop(
          0,
          isNight ? 'rgba(255, 150, 50, 0.06)' : 'rgba(255, 240, 200, 0.07)',
        )
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }

      for (const m of motes) {
        // Pull gently toward beam axis
        if (m.beam > 0.4) {
          m.vx += ((cx - m.x) / w) * 0.012 * m.beam
          m.vy += ((cy - m.y) / h) * 0.008 * m.beam
        }
        m.x += m.vx + Math.sin(m.y * 0.02) * 0.05
        m.y += m.vy
        // Soft clamp in beam ellipse
        if (m.beam > 0.5) {
          const dx = (m.x - cx) / (rx * 1.3)
          const dy = (m.y - cy) / (ry * 1.3)
          if (dx * dx + dy * dy > 1) {
            Object.assign(m, spawn(false))
          }
        } else if (m.y < -10 || m.x < -10 || m.x > w + 10) {
          Object.assign(m, spawn(false), { y: h + 4 })
        }
        ctx.beginPath()
        ctx.fillStyle = isNight
          ? `rgba(255, 200, 140, ${m.a * 0.55 * m.beam + m.a * 0.15})`
          : `rgba(255, 245, 210, ${m.a * 0.75})`
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(tick)
    }

    resize()
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [theme, perf, reduced, idle])

  if (perf === 'low' || reduced) return null

  return <canvas ref={canvasRef} className="particle-overlay" aria-hidden />
}
