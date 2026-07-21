import type { PortraitDef } from '../../types/portrait'
import { audioEngine } from '../../engine/audioEngine'

interface Props {
  portrait: PortraitDef
  open: boolean
  onClose: () => void
}

export function LoreModal({ portrait, open, onClose }: Props) {
  if (!open) return null

  const handlePlayWhisper = () => {
    void audioEngine.playCharacterWhisper(portrait)
  }

  return (
    <div
      className="lore-modal-backdrop"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-label={`${portrait.name} lore and secrets`}
    >
      <div
        className="lore-scroll-card"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="lore-close-btn"
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          aria-label="Close lore scroll"
        >
          ✕
        </button>

        <header className="lore-header">
          <span className="lore-era-badge">{portrait.era}</span>
          <h2 className="lore-name">{portrait.name}</h2>
          <p className="lore-title">{portrait.title}</p>
          <div className="lore-mood-tag">
            <span>Tone: {portrait.tone}</span> • <span>Mood: {portrait.mood}</span>
          </div>
        </header>

        <div className="lore-body">
          {portrait.lore && (
            <div className="lore-story-section">
              <h3>📜 History & Tale</h3>
              <p>{portrait.lore}</p>
            </div>
          )}

          {portrait.quote && (
            <div
              className="lore-quote-section"
              onClick={(e) => {
                e.stopPropagation()
                handlePlayWhisper()
              }}
            >
              <div className="lore-quote-header">
                <span>💬 Whispered Secret</span>
                <span className="lore-whisper-hint">(Tap to hear whisper)</span>
              </div>
              <blockquote className="lore-quote">{portrait.quote}</blockquote>
            </div>
          )}
        </div>

        <footer className="lore-footer">
          <button
            className="lore-action-btn"
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handlePlayWhisper()
            }}
          >
            👂 Listen to Whisper
          </button>
        </footer>
      </div>
    </div>
  )
}
