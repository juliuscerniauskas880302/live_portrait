import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { PortraitDef, ResolvedTheme } from '../../types/portrait'
import { useAppStore } from '../../store/useAppStore'
import { OilLifeCanvas } from './OilLifeCanvas'

interface Props {
  portrait: PortraitDef
  compact?: boolean
  /** When compact, only the featured tile runs motion CSS updates (saves battery). */
  compactActive?: boolean
}

function resolveFrames(p: PortraitDef, theme: ResolvedTheme) {
  const useNight = theme === 'night' && !!p.imageNight
  return {
    open: useNight ? p.imageNight! : p.image,
    closed:
      useNight && p.imageNightClosed ? p.imageNightClosed : p.imageClosed,
    smile: useNight && p.imageNightSmile ? p.imageNightSmile : p.imageSmile,
    mouth: useNight && p.imageNightMouth ? p.imageNightMouth : p.imageMouth,
    // Pose sequence matches day identity; night uses a separate intimate still
    pose: useNight ? [] : (p.imagePose ?? []),
    isNightOutfit: useNight,
  }
}

export function LivingPortrait({
  portrait: p,
  compact,
  compactActive = false,
}: Props) {
  const theme = useAppStore((s) => s.resolvedTheme)
  const perf = useAppStore((s) => s.performanceMode)
  // Full canvas mode must NOT subscribe to motion/parallax — those update every
  // frame and force React re-renders of expensive DOM (blur plate, blend layers).
  // Compact gallery still needs blink/breath CSS vars; drive them via rAF + ref.
  const acknowledging = useAppStore((s) =>
    compact ? false : s.motion.acknowledging,
  )
  const [active, setActive] = useState(true)
  const compactRootRef = useRef<HTMLDivElement>(null)

  const frames = useMemo(() => resolveFrames(p, theme), [p, theme])

  useEffect(() => {
    const onVis = () => setActive(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    if (compact) return
    const urls = [frames.open, frames.closed]
    if (perf !== 'low' && frames.mouth) urls.push(frames.mouth)
    if (perf === 'high' && frames.smile) urls.push(frames.smile)
    for (const src of urls) {
      const img = new Image()
      img.src = src
    }
  }, [frames, compact, perf])

  // Compact gallery: only the featured tile animates (avoids N rAF loops)
  useEffect(() => {
    if (!compact || !compactActive) return
    let raf = 0
    let running = true
    let lastBlink = -1
    let lastBreath = -1
    let lastRot = -999
    let lastTilt = -999
    let lastPx = -999
    let lastPy = -999

    const tick = () => {
      if (!running) return
      const el = compactRootRef.current
      if (el) {
        const { motion, parallax } = useAppStore.getState()
        const breath = 1 + motion.breath * 0.006
        const depthX = parallax.x * 2
        const depthY = parallax.y * 1.5
        // Deadband CSS writes — avoid style thrash on every micro change
        if (Math.abs(motion.blink - lastBlink) > 0.02) {
          lastBlink = motion.blink
          el.style.setProperty('--blink', String(motion.blink))
        }
        if (Math.abs(breath - lastBreath) > 0.001) {
          lastBreath = breath
          el.style.setProperty('--breath', String(breath))
        }
        if (Math.abs(motion.headRotate - lastRot) > 0.05) {
          lastRot = motion.headRotate
          el.style.setProperty('--head-rot', `${motion.headRotate * 0.5}deg`)
        }
        if (Math.abs(motion.headTilt - lastTilt) > 0.05) {
          lastTilt = motion.headTilt
          el.style.setProperty('--head-nod', `${motion.headTilt * 0.4}px`)
        }
        if (Math.abs(depthX - lastPx) > 0.15 || Math.abs(depthY - lastPy) > 0.15) {
          lastPx = depthX
          lastPy = depthY
          el.style.setProperty('--depth-x', `${depthX}px`)
          el.style.setProperty('--depth-y', `${depthY}px`)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(raf)
    }
  }, [compact, compactActive])

  if (compact) {
    return (
      <div
        ref={compactRootRef}
        className={`living-portrait is-compact theme-${theme} ${
          frames.isNightOutfit ? 'is-night-outfit' : ''
        }`}
        role="img"
        aria-label={`${p.name}, ${p.title}`}
        style={
          {
            '--breath': 1,
            '--depth-x': '0px',
            '--depth-y': '0px',
            '--blink': 0,
            '--head-rot': '0deg',
            '--head-nod': '0px',
          } as CSSProperties
        }
      >
        <div className="portrait-stack">
          <img
            className="frame-open"
            src={frames.open}
            alt=""
            draggable={false}
            decoding="async"
          />
          <img
            className="frame-closed"
            src={frames.closed}
            alt=""
            draggable={false}
            decoding="async"
          />
        </div>
        <div className="portrait-grade" aria-hidden />
      </div>
    )
  }

  const smileSrc = perf === 'high' ? frames.smile : undefined
  const mouthSrc = perf !== 'low' ? frames.mouth : undefined

  return (
    <div
      className={`living-portrait theme-${theme} ${
        acknowledging ? 'is-acknowledging' : ''
      } ${frames.isNightOutfit ? 'is-night-outfit' : ''}`}
      role="img"
      aria-label={`${p.name}, ${p.title}`}
    >
      <div
        className="portrait-bg-plate"
        style={{ backgroundImage: `url(${frames.open})` }}
        aria-hidden
      />

      <OilLifeCanvas
        key={p.id}
        imageSrc={frames.open}
        closedSrc={frames.closed}
        smileSrc={smileSrc}
        mouthSrc={mouthSrc}
        poseSrcs={frames.pose}
        active={active}
      />

      <div className="portrait-grade" aria-hidden />
      <div className="portrait-canvas-finish" aria-hidden />
    </div>
  )
}
