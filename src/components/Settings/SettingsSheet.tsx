import { PLAYLIST, TONE_LABELS, getPortrait } from '../../data/portraits'
import { useAppStore } from '../../store/useAppStore'
import {
  toggleFullscreen,
  isFullscreenActive,
} from '../UI/FullscreenToggle'
import type {
  AutoRotateSec,
  IntensityLevel,
  LayoutMode,
  PerformanceMode,
  PortraitEngine,
  PortraitId,
  PortraitTone,
  ThemeMode,
} from '../../types/portrait'

interface Props {
  onUnlockAudio: () => Promise<void>
}

export function SettingsSheet({ onUnlockAudio }: Props) {
  const open = useAppStore((s) => s.settingsOpen)
  const closeSettings = useAppStore((s) => s.closeSettings)

  const themeMode = useAppStore((s) => s.themeMode)
  const setThemeMode = useAppStore((s) => s.setThemeMode)
  const performanceMode = useAppStore((s) => s.performanceMode)
  const setPerformanceMode = useAppStore((s) => s.setPerformanceMode)
  const portraitEngine = useAppStore((s) => s.portraitEngine)
  const setPortraitEngine = useAppStore((s) => s.setPortraitEngine)
  const intensity = useAppStore((s) => s.intensity)
  const setIntensity = useAppStore((s) => s.setIntensity)
  const layout = useAppStore((s) => s.layout)
  const setLayout = useAppStore((s) => s.setLayout)
  const audioEnabled = useAppStore((s) => s.audioEnabled)
  const setAudioEnabled = useAppStore((s) => s.setAudioEnabled)
  const volume = useAppStore((s) => s.volume)
  const setVolume = useAppStore((s) => s.setVolume)
  const reducedMotion = useAppStore((s) => s.reducedMotion)
  const setReducedMotion = useAppStore((s) => s.setReducedMotion)
  const showNameplate = useAppStore((s) => s.showNameplate)
  const setShowNameplate = useAppStore((s) => s.setShowNameplate)
  const surpriseEnabled = useAppStore((s) => s.surpriseEnabled)
  const setSurpriseEnabled = useAppStore((s) => s.setSurpriseEnabled)
  const thunderstormEnabled = useAppStore((s) => s.thunderstormEnabled)
  const setThunderstormEnabled = useAppStore((s) => s.setThunderstormEnabled)
  const autoRotateSec = useAppStore((s) => s.autoRotateSec)
  const setAutoRotateSec = useAppStore((s) => s.setAutoRotateSec)
  const showToast = useAppStore((s) => s.showToast)
  const currentPortraitId = useAppStore((s) => s.currentPortraitId)
  const setPortrait = useAppStore((s) => s.setPortrait)
  const resolvedTheme = useAppStore((s) => s.resolvedTheme)

  if (!open) return null

  const onAudioToggle = async () => {
    const next = !audioEnabled
    if (next) await onUnlockAudio()
    setAudioEnabled(next)
  }

  // Stop stage canvas gestures from stealing taps while the sheet is open
  const stopCanvasGestures = (e: React.SyntheticEvent) => {
    e.stopPropagation()
  }

  return (
    <div
      className="settings-root"
      role="dialog"
      aria-modal="true"
      aria-label="Portrait settings"
      onPointerDown={stopCanvasGestures}
      onPointerUp={stopCanvasGestures}
      onClick={stopCanvasGestures}
      onTouchStart={stopCanvasGestures}
    >
      <button
        type="button"
        className="settings-veil"
        aria-label="Close settings"
        onClick={(e) => {
          e.stopPropagation()
          closeSettings()
        }}
        onPointerUp={(e) => e.stopPropagation()}
      />
      <div
        className={`settings-sheet theme-${resolvedTheme}`}
        onPointerDown={stopCanvasGestures}
        onClick={stopCanvasGestures}
      >
        <header className="settings-header">
          <h2>Chamber Controls</h2>
          <button
            type="button"
            className="settings-close"
            onClick={(e) => {
              e.stopPropagation()
              closeSettings()
            }}
          >
            Done
          </button>
        </header>

        <div className="settings-body">
          <Section title="Atmosphere">
            <Segmented
              label="Theme"
              value={themeMode}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'day', label: 'Day' },
                { value: 'night', label: 'Night' },
              ]}
              onChange={(v) => setThemeMode(v as ThemeMode)}
            />
            <Segmented
              label="Layout"
              value={layout}
              options={[
                { value: 'framed', label: 'Framed' },
                { value: 'fullscreen', label: 'Canvas' },
                { value: 'gallery', label: 'Gallery' },
              ]}
              onChange={(v) => setLayout(v as LayoutMode)}
            />
            <Segmented
              label="Life"
              value={intensity}
              options={[
                { value: 'still', label: 'Still' },
                { value: 'subtle', label: 'Subtle' },
                { value: 'lively', label: 'Lively' },
                { value: 'enchanted', label: 'Enchanted' },
              ]}
              onChange={(v) => setIntensity(v as IntensityLevel)}
            />
            <Segmented
              label="Change portrait every"
              value={String(autoRotateSec)}
              options={[
                { value: '0', label: 'Off' },
                { value: '30', label: '30s' },
                { value: '60', label: '1m' },
                { value: '120', label: '2m' },
                { value: '300', label: '5m' },
                { value: '600', label: '10m' },
              ]}
              onChange={(v) =>
                setAutoRotateSec(Number(v) as AutoRotateSec)
              }
            />
            <p className="settings-help">
              How fast the frame advances to the next portrait. Off keeps one
              face until you change it. Paused in gallery layout and while
              settings are open.
            </p>
          </Section>

          <Section title="Portrait gallery">
            {(['classic', 'creepy', 'seductive'] as PortraitTone[]).map((tone) => {
              const ids = PLAYLIST.filter((id) => getPortrait(id).tone === tone)
              return (
                <div key={tone} className="tone-group">
                  <h4 className={`tone-heading tone-${tone}`}>{TONE_LABELS[tone]}</h4>
                  <div className="portrait-picker">
                    {ids.map((id) => {
                      const p = getPortrait(id)
                      return (
                        <button
                          key={id}
                          type="button"
                          className={`portrait-chip ${id === currentPortraitId ? 'is-active' : ''}`}
                          style={{ borderColor: p.accent }}
                          onClick={() => setPortrait(id as PortraitId)}
                        >
                          <span
                            className="chip-swatch chip-thumb"
                            style={{ backgroundImage: `url(${p.image})` }}
                          />
                          <span className="chip-meta">
                            <span className="chip-name">{p.name}</span>
                            <span className="chip-title">{p.title}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </Section>

          <Section title="Presence">
            <label className="toggle-row">
              <span>Ambient sound</span>
              <input
                type="checkbox"
                checked={audioEnabled}
                onChange={() => void onAudioToggle()}
              />
            </label>
            <label className="slider-row">
              <span>Volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                disabled={!audioEnabled}
                onChange={(e) => setVolume(Number(e.target.value))}
              />
            </label>
            <label className="toggle-row">
              <span>Reduce motion</span>
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={(e) => setReducedMotion(e.target.checked)}
              />
            </label>
            <label className="toggle-row">
              <span>Nameplate</span>
              <input
                type="checkbox"
                checked={showNameplate}
                onChange={(e) => setShowNameplate(e.target.checked)}
              />
            </label>
            <label className="toggle-row">
              <span>Quiet surprises</span>
              <input
                type="checkbox"
                checked={surpriseEnabled}
                onChange={(e) => setSurpriseEnabled(e.target.checked)}
              />
            </label>
            <label className="toggle-row">
              <span>Rain & Thunderstorm</span>
              <input
                type="checkbox"
                checked={thunderstormEnabled}
                onChange={(e) => setThunderstormEnabled(e.target.checked)}
              />
            </label>
            <p className="settings-help">
              Night mode: some portraits change into salon night attire.
              Rain & thunderstorm adds window rain streaks, wind howling, and lightning flashes.
            </p>
          </Section>

          <Section title="Tablet performance">
            <Segmented
              label="Mode"
              value={performanceMode}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'high', label: 'High' },
              ]}
              onChange={(v) => setPerformanceMode(v as PerformanceMode)}
            />
            <Segmented
              label="Portrait engine"
              value={portraitEngine}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: '2d', label: 'Painted' },
                { value: '3d', label: '3D pilot' },
              ]}
              onChange={(v) => setPortraitEngine(v as PortraitEngine)}
            />
            <p className="settings-help">
              <strong>3D pilot</strong> (Lord Ashwick): glTF + motion clips + oil
              paint grade. Auto enables 3D when performance is not Low. If FPS
              drops, the app switches to painted 2D for this session. Clip names
              live in <code>public/models/clip-map.json</code>.
            </p>
            <button
              type="button"
              className="settings-fs-btn"
              onClick={async (e) => {
                stopCanvasGestures(e)
                const next = await toggleFullscreen()
                showToast(next ? 'Fullscreen mode' : 'Exited fullscreen')
              }}
              style={{
                display: 'block',
                width: '100%',
                marginTop: '12px',
                padding: '10px 14px',
                background: 'linear-gradient(135deg, rgba(201, 162, 39, 0.25), rgba(120, 90, 20, 0.4))',
                border: '1px solid rgba(201, 162, 39, 0.6)',
                borderRadius: '8px',
                color: '#f5e0a0',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              {isFullscreenActive() ? '🗗 Exit Fullscreen Mode' : '⛶ Enter Fullscreen Mode (Wall Canvas)'}
            </button>
            <p className="settings-help">
              Old tablets: choose <strong>Low</strong>. Plug in power, add to Home
              Screen, and enable fullscreen for a true wall canvas.
            </p>
          </Section>

          <Section title="Gestures">
            <ul className="gesture-list">
              <li>
                <strong>Tap</strong> — portrait glances toward you
              </li>
              <li>
                <strong>Double-tap</strong> — wink + toggle sound
              </li>
              <li>
                <strong>Left / right edge</strong> — change portrait
              </li>
              <li>
                <strong>Hold ~1s</strong> — open these controls
              </li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="settings-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="segmented">
      <span className="segmented-label">{label}</span>
      <div className="segmented-options" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={o.value === value ? 'is-active' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
