import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { PortraitDef, ResolvedTheme } from '../../types/portrait'
import { useAppStore } from '../../store/useAppStore'
import { OilLifeCanvas } from './OilLifeCanvas'

interface Props {
  portrait: PortraitDef
  compact?: boolean
}

function resolveFrames(p: PortraitDef, theme: ResolvedTheme) {
  const useNight = theme === 'night' && !!p.imageNight
  return {
    open: useNight ? p.imageNight! : p.image,
    closed:
      useNight && p.imageNightClosed ? p.imageNightClosed : p.imageClosed,
    smile: useNight && p.imageNightSmile ? p.imageNightSmile : p.imageSmile,
    mouth: useNight && p.imageNightMouth ? p.imageNightMouth : p.imageMouth,
    isNightOutfit: useNight,
  }
}

export function LivingPortrait({ portrait: p, compact }: Props) {
  const theme = useAppStore((s) => s.resolvedTheme)
  const motion = useAppStore((s) => s.motion)
  const parallax = useAppStore((s) => s.parallax)
  const perf = useAppStore((s) => s.performanceMode)
  const [active, setActive] = useState(true)

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

  if (compact) {
    const breath = 1 + motion.breath * 0.006
    const depthX = parallax.x * 2
    const depthY = parallax.y * 1.5
    return (
      <div
        className={`living-portrait is-compact theme-${theme} ${
          frames.isNightOutfit ? 'is-night-outfit' : ''
        }`}
        role="img"
        aria-label={`${p.name}, ${p.title}`}
        style={
          {
            '--breath': breath,
            '--depth-x': `${depthX}px`,
            '--depth-y': `${depthY}px`,
            '--blink': motion.blink,
            '--head-rot': `${motion.headRotate * 0.5}deg`,
            '--head-nod': `${motion.headTilt * 0.4}px`,
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
        motion.acknowledging ? 'is-acknowledging' : ''
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
        active={active}
      />

      <div className="portrait-grade" aria-hidden />
      <div className="portrait-canvas-finish" aria-hidden />
    </div>
  )
}
