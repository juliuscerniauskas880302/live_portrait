import { PLAYLIST, getPortrait } from '../../data/portraits'
import { LivingPortrait } from '../portraits/LivingPortrait'
import { useAppStore } from '../../store/useAppStore'
import type { PortraitId } from '../../types/portrait'

export function GalleryWall() {
  const current = useAppStore((s) => s.currentPortraitId)
  const setPortrait = useAppStore((s) => s.setPortrait)
  const theme = useAppStore((s) => s.resolvedTheme)
  const acknowledge = useAppStore((s) => s.acknowledge)
  const touch = useAppStore((s) => s.touch)

  const onPick = (id: PortraitId, e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    touch()
    setPortrait(id)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1
    // Full acknowledge so gallery taps also blink / nod
    acknowledge({ x: x * 0.45, y: y * 0.35 })
  }

  return (
    <div className={`gallery-wall theme-${theme}`}>
      <div className="wall-texture" aria-hidden />
      <div className="gallery-grid">
        {PLAYLIST.map((id) => {
          const p = getPortrait(id)
          const featured = id === current
          return (
            <button
              key={id}
              type="button"
              className={`gallery-frame tone-${p.tone} ${featured ? 'is-featured' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                onPick(id, e)
              }}
              aria-label={`Focus ${p.name}`}
            >
              <div className="gallery-inner">
                <LivingPortrait portrait={p} compact />
              </div>
              <span className="gallery-label">
                <span className="gallery-name">{p.name}</span>
                <span className={`gallery-tone tone-${p.tone}`}>{p.tone}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
