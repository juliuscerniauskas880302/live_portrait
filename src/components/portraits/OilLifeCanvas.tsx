import { useEffect, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'

interface Props {
  imageSrc: string
  closedSrc: string
  smileSrc?: string
  mouthSrc?: string
  active: boolean
}

/**
 * Canvas life engine: multi-frame oil portrait stack.
 * neutral → smile → mouth → closed (blink), shared head transform.
 *
 * High-frequency state (motion / parallax / theme / idle) is read from the
 * store inside rAF — not via React subscriptions — so React does not re-render
 * this component 60×/s (a common mobile flicker source).
 */
export function OilLifeCanvas({
  imageSrc,
  closedSrc,
  smileSrc,
  mouthSrc,
  active,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const perf = useAppStore((s) => s.performanceMode)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    // alpha:false avoids expensive alpha compositing with the plate underneath
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
    if (!ctx) return

    const openImg = new Image()
    const closedImg = new Image()
    const smileImg = smileSrc ? new Image() : null
    const mouthImg = mouthSrc ? new Image() : null
    openImg.decoding = 'async'
    closedImg.decoding = 'async'
    openImg.src = imageSrc
    closedImg.src = closedSrc
    if (smileImg && smileSrc) {
      smileImg.decoding = 'async'
      smileImg.src = smileSrc
    }
    if (mouthImg && mouthSrc) {
      mouthImg.decoding = 'async'
      mouthImg.src = mouthSrc
    }

    let openReady = false
    let closedReady = false
    let smileReady = false
    let mouthReady = false

    openImg.onload = () => {
      openReady = true
    }
    closedImg.onload = () => {
      closedReady = true
    }
    if (smileImg) smileImg.onload = () => {
      smileReady = true
    }
    if (mouthImg) mouthImg.onload = () => {
      mouthReady = true
    }
    if (openImg.complete && openImg.naturalWidth > 0) openReady = true
    if (closedImg.complete && closedImg.naturalWidth > 0) closedReady = true
    if (smileImg?.complete && smileImg.naturalWidth > 0) smileReady = true
    if (mouthImg?.complete && mouthImg.naturalWidth > 0) mouthReady = true

    let raf = 0
    let running = true
    let w = 0
    let h = 0
    let dpr = 1
    let lastCssW = 0
    let lastCssH = 0
    let resizeRaf = 0
    const start = performance.now()

    // Coarse pointers / touch UAs get a calmer light model (high-freq sin flicker
    // reads as strobing when the GPU drops frames).
    const isCoarse =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches ||
        window.matchMedia('(hover: none)').matches)

    const applyResize = () => {
      const rect = canvas.getBoundingClientRect()
      // Round once; ignore sub-pixel thrash from mobile browser chrome
      const newW = Math.max(1, Math.round(rect.width))
      const newH = Math.max(1, Math.round(rect.height))

      // Deadband: ignore 1px layout jitter from URL bar / soft UI
      if (Math.abs(newW - lastCssW) < 2 && Math.abs(newH - lastCssH) < 2 && w > 0) {
        return
      }
      lastCssW = newW
      lastCssH = newH

      dpr =
        perf === 'high'
          ? Math.min(window.devicePixelRatio || 1, isCoarse ? 1.25 : 1.5)
          : perf === 'balanced'
            ? Math.min(window.devicePixelRatio || 1, isCoarse ? 1 : 1.25)
            : 1
      const targetW = Math.floor(newW * dpr)
      const targetH = Math.floor(newH * dpr)

      if (canvas.width !== targetW || canvas.height !== targetH) {
        w = newW
        h = newH
        // Buffer reallocation clears the canvas — only when size truly changed
        canvas.width = targetW
        canvas.height = targetH
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      } else {
        w = newW
        h = newH
      }
    }

    const resize = () => {
      // Coalesce ResizeObserver storms (mobile visual viewport)
      if (resizeRaf) return
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0
        applyResize()
      })
    }

    const coverDraw = (
      img: HTMLImageElement,
      ox: number,
      oy: number,
      scale: number,
      rot: number,
      tilt: number,
    ) => {
      if (!img.naturalWidth) return
      const iw = img.naturalWidth
      const ih = img.naturalHeight
      const cover = Math.max(w / iw, h / ih) * scale
      const dw = iw * cover
      const dh = ih * cover
      const dx = (w - dw) / 2 + ox
      const dy = (h - dh) / 2 + oy - dh * 0.02 + tilt * 0.35

      ctx.save()
      ctx.translate(w / 2, h * 0.52)
      ctx.rotate(rot)
      ctx.rotate(tilt * 0.35)
      ctx.translate(-w / 2, -h * 0.52)
      ctx.drawImage(img, dx, dy, dw, dh)
      ctx.restore()
    }

    const drawLight = (t: number, blink: number, isNight: boolean, px: number, py: number) => {
      // Soft organic candle — keep frequencies low on coarse/touch devices so
      // dropped frames don't strobe.
      const flicker = isCoarse || perf !== 'high'
        ? 0.9 + Math.sin(t * 2.4) * 0.06 + Math.cos(t * 3.7) * 0.04
        : 0.82 +
          Math.sin(t * 9.1) * 0.12 +
          Math.cos(t * 15.3) * 0.08 +
          Math.sin(t * 27.7) * 0.05

      const candleX = w * (0.82 + Math.sin(t * (isCoarse ? 1.6 : 3.8)) * 0.04 + px * 0.05)
      const candleY = h * (0.75 + Math.cos(t * (isCoarse ? 2.1 : 4.9)) * 0.03 + py * 0.04)

      ctx.globalCompositeOperation = 'screen'
      const cg = ctx.createRadialGradient(candleX, candleY, w * 0.03, candleX, candleY, w * 0.7)
      cg.addColorStop(0, `rgba(255, 185, 80, ${0.32 * flicker * (1 - blink * 0.15)})`)
      cg.addColorStop(0.35, `rgba(255, 120, 30, ${0.16 * flicker})`)
      cg.addColorStop(0.7, `rgba(180, 70, 15, ${0.06 * flicker})`)
      cg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = cg
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'

      const lx = isNight
        ? w * (0.72 + Math.sin(t * 0.7) * 0.02 + px * 0.03)
        : w * (0.28 + Math.sin(t * 0.35) * 0.015 + px * 0.02)
      const ly = isNight
        ? h * (0.78 + Math.cos(t * 0.9) * 0.015 + py * 0.02)
        : h * (0.18 + Math.cos(t * 0.4) * 0.01 + py * 0.02)
      const radius = isNight ? w * 0.55 : w * 0.7
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, radius)
      if (isNight) {
        g.addColorStop(
          0,
          `rgba(255, 150, 50, ${0.18 * flicker * (1 - blink * 0.15)})`,
        )
        g.addColorStop(0.45, `rgba(255, 100, 30, ${0.08 * flicker})`)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.globalCompositeOperation = 'screen'
      } else {
        // soft-light is poorly accelerated on many Android GPUs; use screen
        // with lower alpha on coarse devices
        g.addColorStop(
          0,
          isCoarse ? 'rgba(255, 245, 210, 0.1)' : 'rgba(255, 245, 210, 0.16)',
        )
        g.addColorStop(
          0.5,
          isCoarse ? 'rgba(255, 230, 180, 0.04)' : 'rgba(255, 230, 180, 0.06)',
        )
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.globalCompositeOperation = isCoarse ? 'screen' : 'soft-light'
      }
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'

      const vg = ctx.createRadialGradient(
        w * 0.5,
        h * 0.42,
        w * 0.2,
        w * 0.5,
        h * 0.5,
        w * 0.78,
      )
      vg.addColorStop(0, 'rgba(0,0,0,0)')
      vg.addColorStop(1, isNight ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.32)')
      ctx.fillStyle = vg
      ctx.fillRect(0, 0, w, h)
    }

    const tick = (now: number) => {
      if (!running) return
      const store = useAppStore.getState()
      const m = store.motion
      const p = store.parallax
      const isNight = store.resolvedTheme === 'night'
      const idleMul = store.idle ? 0.5 : 1
      const t = (now - start) / 1000

      if (w < 1 || h < 1) {
        applyResize()
        raf = requestAnimationFrame(tick)
        return
      }

      const breath = m.breath * 0.014 * idleMul
      const scale = 1.06 + breath

      const swayX =
        Math.sin(t * ((Math.PI * 2) / 11.3)) * 1.8 * idleMul +
        p.x * (w * (perf === 'low' ? 0.02 : 0.045))
      const swayY =
        Math.cos(t * ((Math.PI * 2) / 13.7)) * 1.2 * idleMul +
        p.y * (h * (perf === 'low' ? 0.015 : 0.03))
      const shimmerX = Math.sin(t * 1.7) * 0.35 * idleMul
      const shimmerY = Math.cos(t * 1.3) * 0.25 * idleMul
      const rot = (m.headRotate * Math.PI) / 180 + p.x * 0.035
      const tilt = (m.headTilt * Math.PI) / 180 + p.y * 0.025

      ctx.fillStyle = '#120e0a'
      ctx.fillRect(0, 0, w, h)

      const ox = swayX + shimmerX
      const oy = swayY + shimmerY

      if (openReady) {
        coverDraw(openImg, ox, oy, scale, rot, tilt)
      }

      const blinkW = m.blink
      const mouthW = m.mouth * (1 - blinkW)
      const smileW =
        m.expressionSmile * (1 - blinkW) * (1 - Math.min(1, m.mouth) * 0.85)

      if (smileReady && smileImg && smileW > 0.01) {
        ctx.globalAlpha = Math.min(1, smileW)
        coverDraw(smileImg, ox, oy, scale, rot, tilt)
        ctx.globalAlpha = 1
      }

      if (mouthReady && mouthImg && mouthW > 0.01) {
        ctx.globalAlpha = Math.min(1, mouthW)
        coverDraw(mouthImg, ox, oy, scale, rot, tilt)
        ctx.globalAlpha = 1
      }

      if (m.wink && closedReady) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, w * 0.52, h)
        ctx.clip()
        ctx.globalAlpha = 1
        coverDraw(closedImg, ox, oy, scale, rot, tilt)
        ctx.restore()
      } else if (blinkW > 0.01 && closedReady) {
        ctx.globalAlpha = Math.min(1, blinkW)
        coverDraw(closedImg, ox, oy, scale, rot, tilt)
        ctx.globalAlpha = 1
      }

      const bright = Math.max(
        m.eyeBrighten ?? 0,
        m.acknowledging ? 0.55 : 0,
        (m.longStare ?? 0) * 0.35,
      )
      if (bright > 0.02) {
        ctx.globalCompositeOperation = isCoarse ? 'screen' : 'soft-light'
        const eg = ctx.createRadialGradient(
          w * (0.5 + m.gaze.x * 0.04),
          h * (0.36 + m.gaze.y * 0.03),
          w * 0.04,
          w * 0.5,
          h * 0.38,
          w * 0.28,
        )
        eg.addColorStop(0, `rgba(255, 248, 230, ${0.35 * bright})`)
        eg.addColorStop(0.55, `rgba(255, 230, 190, ${0.12 * bright})`)
        eg.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = eg
        ctx.fillRect(0, 0, w, h)
        ctx.globalCompositeOperation = 'source-over'
      }

      if (perf !== 'low' && blinkW < 0.4) {
        const eyeY = h * (0.355 + m.gaze.y * 0.035 + p.y * 0.025)
        const leftX = w * (0.42 + m.gaze.x * 0.035 + p.x * 0.03)
        const rightX = w * (0.58 + m.gaze.x * 0.035 + p.x * 0.03)
        const spark = 0.55 + Math.sin(t * 2.1) * 0.08 + bright * 0.25
        for (const ex of [leftX, rightX]) {
          const sg = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, w * 0.022)
          sg.addColorStop(0, `rgba(255, 255, 245, ${spark})`)
          sg.addColorStop(0.35, `rgba(255, 235, 190, ${spark * 0.5})`)
          sg.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = sg
          ctx.beginPath()
          ctx.arc(ex, eyeY, w * 0.022, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (perf !== 'low' && !isCoarse) {
        const specX = w * (0.5 + p.x * 0.42)
        const specY = h * (0.38 + p.y * 0.38)
        const sg = ctx.createRadialGradient(specX, specY, w * 0.04, specX, specY, w * 0.5)
        sg.addColorStop(0, 'rgba(255, 248, 230, 0.22)')
        sg.addColorStop(0.45, 'rgba(255, 235, 200, 0.07)')
        sg.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.globalCompositeOperation = 'soft-light'
        ctx.fillStyle = sg
        ctx.fillRect(0, 0, w, h)
        ctx.globalCompositeOperation = 'source-over'
      }

      if (perf === 'high' && !isCoarse) {
        const bandX = (Math.sin(t * 0.11) * 0.5 + 0.5) * w * 1.2 - w * 0.1
        ctx.globalCompositeOperation = 'soft-light'
        const ridge = ctx.createLinearGradient(bandX - w * 0.08, 0, bandX + w * 0.08, h)
        ridge.addColorStop(0, 'rgba(255,255,255,0)')
        ridge.addColorStop(0.45, 'rgba(255, 245, 220, 0.07)')
        ridge.addColorStop(0.5, 'rgba(255, 250, 235, 0.11)')
        ridge.addColorStop(0.55, 'rgba(255, 245, 220, 0.07)')
        ridge.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = ridge
        ctx.fillRect(0, 0, w, h)
        ctx.globalCompositeOperation = 'source-over'
      }

      if (perf !== 'low') {
        drawLight(t, m.blink, isNight, p.x, p.y)
      } else {
        const vg = ctx.createRadialGradient(
          w * 0.5,
          h * 0.4,
          w * 0.25,
          w * 0.5,
          h * 0.5,
          w * 0.8,
        )
        vg.addColorStop(0, 'rgba(0,0,0,0)')
        vg.addColorStop(1, 'rgba(0,0,0,0.35)')
        ctx.fillStyle = vg
        ctx.fillRect(0, 0, w, h)
      }

      // Film grain only on desktop high — Math.random every pixel is pure noise flicker on tablets
      if (perf === 'high' && !isCoarse) {
        ctx.globalAlpha = 0.028
        for (let i = 0; i < 28; i++) {
          const gx = Math.random() * w
          const gy = Math.random() * h
          ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000'
          ctx.fillRect(gx, gy, 1.2, 1.2)
        }
        ctx.globalAlpha = 1
      }

      raf = requestAnimationFrame(tick)
    }

    const tryStart = () => {
      if (!raf && openReady) {
        applyResize()
        raf = requestAnimationFrame(tick)
      }
    }

    openImg.onload = () => {
      openReady = true
      tryStart()
    }
    closedImg.onload = () => {
      closedReady = true
      tryStart()
    }
    if (smileImg) {
      smileImg.onload = () => {
        smileReady = true
      }
    }
    if (mouthImg) {
      mouthImg.onload = () => {
        mouthReady = true
      }
    }
    if (openImg.complete && openImg.naturalWidth) openReady = true
    if (closedImg.complete && closedImg.naturalWidth) closedReady = true
    if (smileImg?.complete && smileImg.naturalWidth) smileReady = true
    if (mouthImg?.complete && mouthImg.naturalWidth) mouthReady = true
    tryStart()

    const ro = new ResizeObserver(() => resize())
    ro.observe(canvas)
    applyResize()

    return () => {
      running = false
      cancelAnimationFrame(raf)
      if (resizeRaf) cancelAnimationFrame(resizeRaf)
      ro.disconnect()
    }
  }, [imageSrc, closedSrc, smileSrc, mouthSrc, active, perf])

  return <canvas ref={canvasRef} className="oil-life-canvas" aria-hidden />
}
