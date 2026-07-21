import type { ReactNode } from 'react'
import type { PortraitDef } from '../../types/portrait'
import { useAppStore } from '../../store/useAppStore'

interface Props {
  portrait: PortraitDef
  children: ReactNode
  onOpenLore?: () => void
}

export function DigitalFrame({ portrait, children, onOpenLore }: Props) {
  const showFrame = useAppStore((s) => s.showFrame)
  const showNameplate = useAppStore((s) => s.showNameplate)
  const layout = useAppStore((s) => s.layout)
  const theme = useAppStore((s) => s.resolvedTheme)
  const parallax = useAppStore((s) => s.parallax)
  const idle = useAppStore((s) => s.idle)
  const frameLife = useAppStore((s) => s.frameLife)
  const acknowledging = useAppStore((s) => s.motion.acknowledging)

  if (!showFrame || layout === 'fullscreen') {
    return <div className="frame-fullscreen">{children}</div>
  }

  const shadowX = 8 + parallax.x * 6
  const shadowY = 10 + parallax.y * 4
  const knock = frameLife.knock ? 1 : 0
  const spec = 0.35 + frameLife.specularBoost * 0.45

  return (
    <div className={`frame-stage theme-${theme}`}>
      <div className="wall-texture" aria-hidden />
      <div
        className={`ornate-frame ${frameLife.knock ? 'is-knock' : ''} ${
          acknowledging ? 'is-noticed' : ''
        }`}
        style={{
          boxShadow: `
            ${shadowX + knock * 2}px ${shadowY + knock * 3}px ${28 + knock * 8}px rgba(0,0,0,0.55),
            inset 0 0 0 2px rgba(201, 162, 39, ${spec}),
            inset 0 0 0 8px rgba(40, 28, 12, 0.9)
          `,
          transform: frameLife.knock
            ? 'translate(1px, 2px) scale(1.004)'
            : undefined,
        }}
      >
        <div className="frame-specular" aria-hidden />
        <div className="frame-mat">
          <div className="frame-canvas">{children}</div>
        </div>
        {showNameplate && (
          <div
            className={`nameplate ${idle ? 'is-faded' : ''} ${
              frameLife.nameplateGlow > 0.3 || acknowledging ? 'is-glowing' : ''
            }`}
            onClick={(e) => {
              e.stopPropagation()
              onOpenLore?.()
            }}
            title="Click to reveal lore & secrets"
            style={{
              opacity: idle
                ? 0.22 + frameLife.nameplateGlow * 0.6
                : 0.85 + frameLife.nameplateGlow * 0.15,
              boxShadow:
                frameLife.nameplateGlow > 0.2
                  ? `0 0 ${12 + frameLife.nameplateGlow * 20}px rgba(201, 162, 39, ${
                      0.25 + frameLife.nameplateGlow * 0.45
                    })`
                  : undefined,
              cursor: 'pointer',
            }}
          >
            <span className="nameplate-name">{portrait.name}</span>
            <span className="nameplate-title">{portrait.title}</span>
            <span className="nameplate-era">{portrait.era} 📜</span>
          </div>
        )}
      </div>
    </div>
  )
}
