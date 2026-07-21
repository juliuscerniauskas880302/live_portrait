/**
 * Frame / room atmosphere life: nameplate glow, frame knock, specular boost.
 * Complements face motion director — rare, hold-heavy.
 */
import { audioEngine } from './audioEngine'
import { useAppStore } from '../store/useAppStore'

class AtmosphereDirector {
  private timer = 0
  private running = false

  start() {
    if (this.running) return
    this.running = true
    this.schedule()
  }

  stop() {
    this.running = false
    window.clearTimeout(this.timer)
    useAppStore.getState().setFrameLife({
      nameplateGlow: 0,
      knock: false,
      specularBoost: 0,
    })
  }

  private schedule() {
    window.clearTimeout(this.timer)
    if (!this.running) return
    const state = useAppStore.getState()
    const idleMul = state.idle ? 1.5 : 1
    // 50s–2.5min between frame events
    const delay = (50_000 + Math.random() * 100_000) * idleMul
    this.timer = window.setTimeout(() => {
      void this.fire()
      this.schedule()
    }, delay)
  }

  private async fire() {
    const state = useAppStore.getState()
    if (state.reducedMotion || state.settingsOpen) return
    if (!state.surpriseEnabled && Math.random() > 0.35) return
    if (Date.now() - state.lastInteractionAt < 15_000) return

    const roll = Math.random()
    if (roll < 0.4) {
      // Nameplate whisper-glow
      useAppStore.getState().setFrameLife({ nameplateGlow: 1 })
      window.setTimeout(() => {
        useAppStore.getState().setFrameLife({ nameplateGlow: 0 })
      }, 2200)
    } else if (roll < 0.7) {
      // Gold specular crawl boost
      useAppStore.getState().setFrameLife({ specularBoost: 1 })
      window.setTimeout(() => {
        useAppStore.getState().setFrameLife({ specularBoost: 0 })
      }, 2800)
    } else {
      // Frame knock
      useAppStore.getState().setFrameLife({ knock: true, specularBoost: 0.5 })
      if (state.audioEnabled) {
        await audioEngine.playSfx('creak', { gain: 0.24 })
      }
      window.setTimeout(() => {
        useAppStore.getState().setFrameLife({ knock: false, specularBoost: 0 })
      }, 600)
    }
  }
}

export const atmosphereDirector = new AtmosphereDirector()
