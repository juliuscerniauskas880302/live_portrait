import { useCallback, useEffect, useRef, useState } from 'react'
import { getPortrait } from '../../data/portraits'
import { useAppStore } from '../../store/useAppStore'
import { motionDirector } from '../../engine/motionDirector'
import { atmosphereDirector } from '../../engine/atmosphereDirector'
import { audioEngine } from '../../engine/audioEngine'
import { useNightEasterEggs } from '../../hooks/useNightEasterEggs'
import { LivingPortrait } from '../portraits/LivingPortrait'
import { DigitalFrame } from './DigitalFrame'
import { LightOverlay } from './LightOverlay'
import { ParticleOverlay } from './ParticleOverlay'
import { GalleryWall } from './GalleryWall'
import { SettingsSheet } from '../Settings/SettingsSheet'
import { Toast } from '../UI/Toast'
import { FirstRunHint } from '../UI/FirstRunHint'

export function Stage() {
  const portraitId = useAppStore((s) => s.currentPortraitId)
  const transitionFromId = useAppStore((s) => s.transitionFromId)
  const layout = useAppStore((s) => s.layout)
  const theme = useAppStore((s) => s.resolvedTheme)
  const idle = useAppStore((s) => s.idle)
  const phase = useAppStore((s) => s.phase)
  const touch = useAppStore((s) => s.touch)
  const acknowledge = useAppStore((s) => s.acknowledge)
  const openSettings = useAppStore((s) => s.openSettings)
  const nextPortrait = useAppStore((s) => s.nextPortrait)
  const prevPortrait = useAppStore((s) => s.prevPortrait)
  const setPhase = useAppStore((s) => s.setPhase)
  const showToast = useAppStore((s) => s.showToast)
  const clearToast = useAppStore((s) => s.clearToast)
  const audioEnabled = useAppStore((s) => s.audioEnabled)
  const setAudioEnabled = useAppStore((s) => s.setAudioEnabled)
  const volume = useAppStore((s) => s.volume)
  const toast = useAppStore((s) => s.toast)
  const autoRotateSec = useAppStore((s) => s.autoRotateSec)
  const settingsOpen = useAppStore((s) => s.settingsOpen)
  const rotateNonce = useAppStore((s) => s.rotateNonce)

  const portrait = getPortrait(portraitId)
  const outgoing =
    transitionFromId && transitionFromId !== portraitId
      ? getPortrait(transitionFromId)
      : null
  const nightEgg = useNightEasterEggs()

  const lastTap = useRef(0)
  const longPressTimer = useRef(0)
  const longPressFired = useRef(false)
  const prevPortraitId = useRef(portraitId)
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null)
  const [tapFlash, setTapFlash] = useState(false)

  useEffect(() => {
    motionDirector.start()
    atmosphereDirector.start()
    setPhase('ambient')
    return () => {
      motionDirector.stop()
      atmosphereDirector.stop()
    }
  }, [setPhase])

  useEffect(() => {
    audioEngine.setTheme(theme)
  }, [theme])

  useEffect(() => {
    if (prevPortraitId.current === portraitId) return
    prevPortraitId.current = portraitId
    if (useAppStore.getState().audioEnabled) {
      void audioEngine.playSfx(
        theme === 'night' ? 'footsteps' : 'footsteps-soft',
        { gain: 0.2, pan: (Math.random() - 0.5) * 0.6 },
      )
      if (Math.random() < 0.4) {
        window.setTimeout(() => {
          void audioEngine.playSfx('creak', { gain: 0.12 })
        }, 400)
      }
    }
  }, [portraitId, theme])

  useEffect(() => {
    audioEngine.setEnabled(audioEnabled)
    audioEngine.setVolume(volume)
  }, [audioEnabled, volume])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(clearToast, 1800)
    return () => clearTimeout(id)
  }, [toast, clearToast])

  useEffect(() => {
    if (autoRotateSec <= 0) return
    if (settingsOpen || layout === 'gallery') return
    if (document.visibilityState === 'hidden') return

    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      if (useAppStore.getState().settingsOpen) return
      if (useAppStore.getState().layout === 'gallery') return
      useAppStore.getState().nextPortrait()
    }, autoRotateSec * 1000)

    return () => clearInterval(id)
  }, [autoRotateSec, settingsOpen, layout, rotateNonce])

  const unlockAudio = useCallback(async () => {
    await audioEngine.unlock()
    audioEngine.setEnabled(useAppStore.getState().audioEnabled)
    audioEngine.setVolume(useAppStore.getState().volume)
    audioEngine.setTheme(useAppStore.getState().resolvedTheme)
  }, [])

  const flashTap = useCallback(() => {
    setTapFlash(true)
    window.setTimeout(() => setTapFlash(false), 280)
  }, [])

  const handleTap = useCallback(
    (clientX: number, clientY: number, target: HTMLElement) => {
      if (useAppStore.getState().settingsOpen) return
      if (longPressFired.current) return

      // Capture coords before any async work (React event reuse / delayed unlock)
      const rect = target.getBoundingClientRect()
      const nx = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
      const ny = ((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1

      // Unlock audio in background — never block the visual reaction
      void unlockAudio()
      touch()
      flashTap()

      const now = Date.now()
      const isDouble = now - lastTap.current < 320
      lastTap.current = now

      const currentLayout = useAppStore.getState().layout

      // Edge zones: prev / next portrait (only single-portrait layouts)
      if (nx < -0.72 && currentLayout !== 'gallery') {
        prevPortrait()
        showToast('Previous portrait')
        return
      }
      if (nx > 0.72 && currentLayout !== 'gallery') {
        nextPortrait()
        showToast('Next portrait')
        return
      }

      if (isDouble) {
        motionDirector.wink()
        void audioEngine.playSoftEvent('chime')
        const next = !useAppStore.getState().audioEnabled
        setAudioEnabled(next)
        if (next) {
          void unlockAudio().then(() => audioEngine.setEnabled(true))
        }
        showToast(next ? 'Sound on' : 'Sound muted')
        return
      }

      // Full acknowledge: blink → gaze → smile → nod
      acknowledge({ x: nx * 0.55, y: ny * 0.4 })
      void audioEngine.playSoftEvent(Math.random() < 0.55 ? 'cloth' : 'sigh')
    },
    [
      unlockAudio,
      touch,
      flashTap,
      prevPortrait,
      nextPortrait,
      showToast,
      setAudioEnabled,
      acknowledge,
    ],
  )

  // If the event started on the settings sheet, never steal it for canvas gestures
  const isFromSettings = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false
    return Boolean(target.closest('.settings-root'))
  }

  const releaseCapture = (
    el: HTMLDivElement,
    pointerId: number,
  ) => {
    try {
      if (el.hasPointerCapture(pointerId)) {
        el.releasePointerCapture(pointerId)
      }
    } catch {
      /* ignore */
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Settings is open (or click is inside it) — do not capture / long-press
    if (settingsOpen || isFromSettings(e.target)) {
      window.clearTimeout(longPressTimer.current)
      return
    }

    // Keep receiving pointerup even if finger slides slightly
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* older WebViews may not support capture */
    }
    pointerOrigin.current = { x: e.clientX, y: e.clientY }
    longPressFired.current = false
    window.clearTimeout(longPressTimer.current)
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true
      // Release capture so the settings sheet can receive the next taps
      releaseCapture(e.currentTarget, e.pointerId)
      openSettings()
    }, 1100)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    window.clearTimeout(longPressTimer.current)
    releaseCapture(e.currentTarget, e.pointerId)

    if (settingsOpen || isFromSettings(e.target)) {
      longPressFired.current = false
      pointerOrigin.current = null
      return
    }

    if (longPressFired.current) {
      longPressFired.current = false
      pointerOrigin.current = null
      return
    }

    // Ignore large drags (scroll / accidental slide)
    const origin = pointerOrigin.current
    if (origin) {
      const dx = e.clientX - origin.x
      const dy = e.clientY - origin.y
      if (dx * dx + dy * dy > 36 * 36) {
        pointerOrigin.current = null
        return
      }
    }
    pointerOrigin.current = null

    handleTap(e.clientX, e.clientY, e.currentTarget)
  }

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    window.clearTimeout(longPressTimer.current)
    pointerOrigin.current = null
    longPressFired.current = false
    releaseCapture(e.currentTarget, e.pointerId)
  }

  // Mouse/desktop fallback when pointer events are incomplete
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (settingsOpen || isFromSettings(e.target)) return
    // Avoid double-firing after a successful pointerup (within 80ms)
    if (Date.now() - lastTap.current < 80) return
    if (longPressFired.current) return
    handleTap(e.clientX, e.clientY, e.currentTarget)
  }

  // When settings open, drop any leftover capture from the long-press that opened it
  useEffect(() => {
    if (!settingsOpen) return
    window.clearTimeout(longPressTimer.current)
    longPressFired.current = false
    pointerOrigin.current = null
  }, [settingsOpen])

  return (
    <div
      className={`stage theme-${theme} phase-${phase} ${idle ? 'is-idle' : ''} ${
        tapFlash ? 'is-tap-flash' : ''
      } ${settingsOpen ? 'is-settings-open' : ''}`}
      data-layout={layout}
      role="application"
      aria-label="Living portrait canvas. Tap to interact, hold for settings."
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      {layout === 'gallery' ? (
        <GalleryWall />
      ) : (
        <DigitalFrame portrait={portrait}>
          <div className="portrait-transition-stack">
            {outgoing && (
              <div className="portrait-layer is-outgoing" key={`out-${outgoing.id}`}>
                <LivingPortrait portrait={outgoing} />
              </div>
            )}
            <div
              className={`portrait-layer is-incoming ${outgoing ? 'is-fading-in' : ''}`}
              key={`in-${portrait.id}`}
            >
              <LivingPortrait portrait={portrait} />
            </div>
          </div>
        </DigitalFrame>
      )}

      <LightOverlay />
      <ParticleOverlay />
      <div className="idle-dimmer" aria-hidden />
      <div className="tap-flash-ring" aria-hidden />

      <div
        className={`night-egg-flare ${nightEgg.candleFlare ? 'is-on' : ''}`}
        aria-hidden
      />
      <div
        className={`night-egg-blackout ${nightEgg.blackout ? 'is-on' : ''}`}
        aria-hidden
      />

      <FirstRunHint />
      <Toast />
      <SettingsSheet onUnlockAudio={unlockAudio} />
    </div>
  )
}
