/**
 * Rare night-only magical surprises: footsteps in the hall, creaks,
 * whispers, candle flares, brief blackouts — never spammy.
 */
import { audioEngine } from './audioEngine'
import { motionDirector } from './motionDirector'
import { useAppStore } from '../store/useAppStore'

export type NightEggKind =
  | 'steps-pass'
  | 'creak'
  | 'whisper'
  | 'door'
  | 'candle-flare'
  | 'whoosh'
  | 'wind'
  | 'horror-soft'
  | 'wink'
  | 'blackout'

type EggEvent = {
  kind: NightEggKind
  weight: number
  /** Visual flash of candle / blackout handled by store callbacks */
}

const TABLE: EggEvent[] = [
  { kind: 'steps-pass', weight: 28 },
  { kind: 'creak', weight: 18 },
  { kind: 'whisper', weight: 12 },
  { kind: 'door', weight: 10 },
  { kind: 'candle-flare', weight: 12 },
  { kind: 'whoosh', weight: 6 },
  { kind: 'wind', weight: 8 },
  { kind: 'horror-soft', weight: 3 },
  { kind: 'wink', weight: 8 },
  { kind: 'blackout', weight: 4 },
]

function pick(): NightEggKind {
  const total = TABLE.reduce((s, e) => s + e.weight, 0)
  let r = Math.random() * total
  for (const e of TABLE) {
    r -= e.weight
    if (r <= 0) return e.kind
  }
  return 'steps-pass'
}

export type NightEggVisual = {
  candleFlare: boolean
  blackout: boolean
}

type Listener = (v: NightEggVisual) => void

class NightEasterEggDirector {
  private timer = 0
  private running = false
  private lastAt = 0
  private listeners = new Set<Listener>()
  private visual: NightEggVisual = { candleFlare: false, blackout: false }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    fn(this.visual)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emit() {
    for (const fn of this.listeners) fn(this.visual)
  }

  start() {
    if (this.running) return
    this.running = true
    this.schedule()
  }

  stop() {
    this.running = false
    window.clearTimeout(this.timer)
    this.visual = { candleFlare: false, blackout: false }
    this.emit()
  }

  private schedule() {
    window.clearTimeout(this.timer)
    if (!this.running) return
    // 90s–4.5min between eggs at night; longer if idle
    const idle = useAppStore.getState().idle
    const min = idle ? 140_000 : 90_000
    const max = idle ? 320_000 : 270_000
    const delay = min + Math.random() * (max - min)
    this.timer = window.setTimeout(() => {
      void this.fire()
      this.schedule()
    }, delay)
  }

  private async fire() {
    const state = useAppStore.getState()
    if (state.resolvedTheme !== 'night') return
    if (!state.surpriseEnabled || state.reducedMotion) return
    if (state.settingsOpen) return
    if (Date.now() - this.lastAt < 45_000) return
    // Suppress shortly after user interaction
    if (Date.now() - state.lastInteractionAt < 20_000) return

    const kind = pick()
    this.lastAt = Date.now()

    switch (kind) {
      case 'steps-pass':
        await audioEngine.playEasterEgg('steps-pass')
        break
      case 'creak':
        await audioEngine.playEasterEgg('creak')
        break
      case 'whisper':
        await audioEngine.playEasterEgg('whisper')
        motionDirector.forceBlink()
        break
      case 'door':
        await audioEngine.playEasterEgg('door')
        break
      case 'candle-flare':
        this.visual = { candleFlare: true, blackout: false }
        this.emit()
        await audioEngine.playEasterEgg('candle-flare')
        window.setTimeout(() => {
          this.visual = { candleFlare: false, blackout: false }
          this.emit()
        }, 1800)
        break
      case 'whoosh':
        await audioEngine.playEasterEgg('whoosh')
        break
      case 'wind':
        await audioEngine.playEasterEgg('wind')
        break
      case 'horror-soft':
        await audioEngine.playEasterEgg('horror-soft')
        break
      case 'wink':
        motionDirector.wink()
        await audioEngine.playSfx('chime', { gain: 0.2 })
        break
      case 'blackout':
        this.visual = { candleFlare: false, blackout: true }
        this.emit()
        await audioEngine.playEasterEgg('whoosh')
        window.setTimeout(() => {
          this.visual = { candleFlare: false, blackout: false }
          this.emit()
          void audioEngine.playEasterEgg('candle-flare')
        }, 2200)
        break
    }
  }
}

export const nightEasterEggs = new NightEasterEggDirector()
