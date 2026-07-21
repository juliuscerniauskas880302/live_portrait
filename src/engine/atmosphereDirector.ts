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
      lightning: 0,
    })
  }

  private schedule() {
    window.clearTimeout(this.timer)
    if (!this.running) return
    const state = useAppStore.getState()
    const idleMul = state.idle ? 1.5 : 1
    // 35s–100s between atmospheric hall events
    const delay = (35_000 + Math.random() * 65_000) * idleMul
    this.timer = window.setTimeout(() => {
      void this.fire()
      this.schedule()
    }, delay)
  }

  private async fire() {
    const state = useAppStore.getState()
    if (state.reducedMotion || state.settingsOpen) return
    if (!state.surpriseEnabled && Math.random() > 0.35) return

    const roll = Math.random()
    if (roll < 0.35) {
      // Nameplate whisper-glow
      useAppStore.getState().setFrameLife({ nameplateGlow: 1 })
      window.setTimeout(() => {
        useAppStore.getState().setFrameLife({ nameplateGlow: 0 })
      }, 2200)
    } else if (roll < 0.65) {
      // Gold specular crawl boost
      useAppStore.getState().setFrameLife({ specularBoost: 1 })
      window.setTimeout(() => {
        useAppStore.getState().setFrameLife({ specularBoost: 0 })
      }, 2800)
    } else if (roll < 0.85 && state.thunderstormEnabled) {
      // Distant Thunder & Lightning Flash
      useAppStore.getState().setFrameLife({ lightning: 1 })
      if (state.audioEnabled) {
        void audioEngine.playSfx('wind-gust', { gain: 0.22, rate: 0.85 })
      }
      // Strobe flash
      window.setTimeout(() => {
        useAppStore.getState().setFrameLife({ lightning: 0.3 })
      }, 120)
      window.setTimeout(() => {
        useAppStore.getState().setFrameLife({ lightning: 0.85 })
      }, 240)
      window.setTimeout(() => {
        useAppStore.getState().setFrameLife({ lightning: 0 })
      }, 650)
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
