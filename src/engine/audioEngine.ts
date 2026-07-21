/**
 * MP3-only audio engine (no procedural / generated synthesis).
 * All beds and one-shots load from public/sounds/*.mp3 (Mixkit free).
 * Unlock requires a user gesture (browser autoplay policy).
 */

import type { PortraitDef } from '../types/portrait'

export type AudioTheme = 'day' | 'night'

export type SfxKind =
  | 'footsteps'
  | 'footsteps-soft'
  | 'creak'
  | 'door'
  | 'whisper'
  | 'whoosh'
  | 'candle'
  | 'horror'
  | 'wind-gust'
  | 'sigh'
  | 'chime'
  | 'cloth'
  | 'ambience-day'
  | 'ambience-night'
  | 'birds'
  | 'fire-loop'

/** Only real .mp3 assets under public/sounds/ */
const SFX_URLS: Record<SfxKind, string[]> = {
  footsteps: ['/sounds/footsteps-wood.mp3', '/sounds/footsteps-stone.mp3'],
  'footsteps-soft': ['/sounds/footsteps-soft.mp3'],
  creak: ['/sounds/wood-creak.mp3', '/sounds/door-creak.mp3'],
  door: ['/sounds/door-close.mp3', '/sounds/door-creak.mp3'],
  whisper: ['/sounds/whisper-air.mp3'],
  whoosh: ['/sounds/eerie-whoosh.mp3'],
  candle: ['/sounds/fire-crackle.mp3'],
  horror: ['/sounds/horror-hit.mp3'],
  'wind-gust': ['/sounds/wind-howl.mp3'],
  sigh: ['/sounds/sigh.mp3', '/sounds/whisper-air.mp3'],
  chime: ['/sounds/chime.mp3', '/sounds/magic-soft.mp3'],
  cloth: ['/sounds/cloth.mp3', '/sounds/eerie-whoosh.mp3'],
  // Looping beds (smaller Mixkit previews only — no procedural beds)
  'ambience-day': ['/sounds/birds.mp3', '/sounds/wind-howl.mp3'],
  'ambience-night': [
    '/sounds/fire-loop.mp3',
    '/sounds/fire-crackle.mp3',
    '/sounds/fire-crackle-2.mp3',
  ],
  birds: ['/sounds/birds.mp3'],
  'fire-loop': [
    '/sounds/fire-loop.mp3',
    '/sounds/fire-crackle.mp3',
    '/sounds/fire-crackle-2.mp3',
  ],
}

class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bedGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private unlocked = false
  private enabled = false
  private volume = 0.3
  private theme: AudioTheme = 'day'
  private footstepTimer = 0
  private bedBirdTimer = 0
  private bedFireTimer = 0
  private started = false
  private buffers = new Map<string, AudioBuffer>()
  private loading = new Map<string, Promise<AudioBuffer | null>>()
  private bedSource: AudioBufferSourceNode | null = null

  get isUnlocked() {
    return this.unlocked
  }

  async unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0
      this.master.connect(this.ctx.destination)

      this.bedGain = this.ctx.createGain()
      this.sfxGain = this.ctx.createGain()
      this.bedGain.gain.value = 0.35
      this.sfxGain.gain.value = 0.85
      this.bedGain.connect(this.master)
      this.sfxGain.connect(this.master)
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
    this.unlocked = true
    void this.prefetch([
      'footsteps',
      'footsteps-soft',
      'creak',
      'candle',
      'whisper',
      'whoosh',
      'sigh',
      'chime',
      'cloth',
      'ambience-day',
      'ambience-night',
      'fire-loop',
      'birds',
    ])
    if (this.enabled && !this.started) {
      this.started = true
      await this.startBeds()
      this.scheduleCorridorSteps()
      this.scheduleThemeExtras()
    }
    this.applyMaster(true)
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (!this.unlocked) return
    if (on && !this.started) {
      this.started = true
      void this.startBeds()
      this.scheduleCorridorSteps()
      this.scheduleThemeExtras()
    }
    if (!on) {
      this.stopBeds()
      window.clearTimeout(this.footstepTimer)
      window.clearTimeout(this.bedBirdTimer)
      window.clearTimeout(this.bedFireTimer)
    } else if (this.started) {
      void this.startBeds()
      this.scheduleCorridorSteps()
      this.scheduleThemeExtras()
    }
    this.applyMaster(true)
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v))
    this.applyMaster(false)
  }

  setTheme(theme: AudioTheme) {
    const prev = this.theme
    this.theme = theme
    if (this.enabled && this.unlocked && prev !== theme) {
      void this.startBeds()
      window.clearTimeout(this.footstepTimer)
      this.scheduleCorridorSteps()
      this.scheduleThemeExtras()
    }
  }

  /** Soft one-shots — MP3 only (mapped to Mixkit files). */
  playSoftEvent(kind: 'sigh' | 'chime' | 'cloth' = 'sigh') {
    void this.playSfx(kind, {
      gain: kind === 'chime' ? 0.22 : kind === 'cloth' ? 0.2 : 0.18,
    })
  }

  /**
   * Play an MP3 sample.
   * pan: -1 left … 1 right
   */
  async playSfx(
    kind: SfxKind,
    opts: { gain?: number; pan?: number; rate?: number; loop?: boolean } = {},
  ): Promise<AudioBufferSourceNode | null> {
    if (!this.enabled || !this.unlocked || !this.ctx || !this.sfxGain) return null

    const urls = SFX_URLS[kind]
    if (!urls?.length) return null

    // Prefer first available file that loads
    let buffer: AudioBuffer | null = null
    let usedUrl = urls[0]
    for (const url of urls) {
      buffer = await this.loadBuffer(url)
      if (buffer) {
        usedUrl = url
        break
      }
    }
    if (!buffer || !this.ctx || !this.sfxGain) return null
    void usedUrl

    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.loop = !!opts.loop
    src.playbackRate.value = opts.rate ?? (0.94 + Math.random() * 0.12)

    const g = this.ctx.createGain()
    const base = (opts.gain ?? 0.35) * this.volume
    g.gain.value = base

    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner()
      panner.pan.value = Math.max(-1, Math.min(1, opts.pan ?? 0))
      src.connect(g)
      g.connect(panner)
      panner.connect(this.sfxGain)
    } else {
      src.connect(g)
      g.connect(this.sfxGain)
    }

    src.start()
    return src
  }

  /** Distant corridor footsteps that walk past. */
  async playWalkingPast() {
    if (!this.enabled || !this.unlocked) return
    const steps = 5 + Math.floor(Math.random() * 4)
    for (let i = 0; i < steps; i++) {
      const t = steps <= 1 ? 0.5 : i / (steps - 1)
      const pan = -0.85 + t * 1.7
      const gain = 0.12 + Math.sin(t * Math.PI) * 0.28
      window.setTimeout(() => {
        void this.playSfx(this.theme === 'night' ? 'footsteps' : 'footsteps-soft', {
          pan,
          gain,
          rate: 0.9 + Math.random() * 0.15,
        })
      }, i * (380 + Math.random() * 120))
    }
  }

  async playEasterEgg(
    kind:
      | 'steps-pass'
      | 'creak'
      | 'whisper'
      | 'door'
      | 'candle-flare'
      | 'whoosh'
      | 'wind'
      | 'horror-soft',
  ) {
    switch (kind) {
      case 'steps-pass':
        await this.playWalkingPast()
        break
      case 'creak':
        await this.playSfx('creak', {
          gain: 0.28,
          pan: (Math.random() - 0.5) * 1.2,
        })
        break
      case 'whisper':
        await this.playSfx('whisper', {
          gain: 0.18,
          pan: (Math.random() - 0.5) * 0.8,
        })
        break
      case 'door':
        await this.playSfx('door', {
          gain: 0.3,
          pan: Math.random() > 0.5 ? 0.6 : -0.6,
        })
        break
      case 'candle-flare':
        await this.playSfx('candle', { gain: 0.4 })
        break
      case 'whoosh':
        await this.playSfx('whoosh', { gain: 0.22 })
        break
      case 'wind':
        await this.playSfx('wind-gust', { gain: 0.25 })
        break
      case 'horror-soft':
        await this.playSfx('horror', { gain: 0.12 })
        break
    }
  }

  private async startBeds() {
    this.stopBeds()
    if (!this.enabled || !this.unlocked || !this.ctx || !this.bedGain) return

    const kind: SfxKind =
      this.theme === 'night' ? 'ambience-night' : 'ambience-day'
    const urls = SFX_URLS[kind]
    let buffer: AudioBuffer | null = null
    for (const url of urls) {
      buffer = await this.loadBuffer(url)
      if (buffer) break
    }
    // Fallback: fire-loop at night, birds bed material by day if ambience missing
    if (!buffer) {
      buffer = await this.loadBuffer(
        this.theme === 'night'
          ? SFX_URLS['fire-loop'][0]
          : SFX_URLS.birds[0] ?? SFX_URLS['footsteps-soft'][0],
      )
    }
    if (!buffer || !this.ctx || !this.bedGain) return

    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const g = this.ctx.createGain()
    g.gain.value = this.theme === 'night' ? 0.22 : 0.28
    src.connect(g)
    g.connect(this.bedGain)
    src.start()
    this.bedSource = src
  }

  private stopBeds() {
    try {
      this.bedSource?.stop()
    } catch {
      /* already stopped */
    }
    this.bedSource = null
  }

  /** Occasional birds (day) / fire crackle (night) from MP3 only */
  private scheduleThemeExtras = () => {
    window.clearTimeout(this.bedBirdTimer)
    window.clearTimeout(this.bedFireTimer)
    if (!this.enabled || !this.unlocked) return

    if (this.theme === 'day') {
      const delay = 40_000 + Math.random() * 80_000
      this.bedBirdTimer = window.setTimeout(() => {
        if (this.enabled && this.theme === 'day') {
          void this.playSfx('birds', { gain: 0.12, pan: (Math.random() - 0.5) * 1.4 })
        }
        this.scheduleThemeExtras()
      }, delay)
    } else {
      const delay = 18_000 + Math.random() * 40_000
      this.bedFireTimer = window.setTimeout(() => {
        if (this.enabled && this.theme === 'night') {
          void this.playSfx('fire-loop', {
            gain: 0.14 + Math.random() * 0.1,
            pan: (Math.random() - 0.5) * 0.5,
          })
        }
        this.scheduleThemeExtras()
      }, delay)
    }
  }

  async playCharacterWhisper(portrait: PortraitDef) {
    if (!this.enabled || !this.unlocked) await this.unlock()

    const id = portrait.id
    const tone = portrait.tone

    switch (id) {
      case 'astronomer':
        void this.playSfx('chime', { gain: 0.35, rate: 0.75 })
        void this.playSfx('whisper', { gain: 0.2, rate: 0.85 })
        break
      case 'alchemist':
        void this.playSfx('candle', { gain: 0.3, rate: 1.15 })
        void this.playSfx('chime', { gain: 0.25, rate: 0.95 })
        break
      case 'scholar':
        void this.playSfx('cloth', { gain: 0.3, rate: 0.85 })
        void this.playSfx('sigh', { gain: 0.25, rate: 0.78 })
        break
      case 'enchantress':
        void this.playSfx('chime', { gain: 0.38, rate: 1.35 })
        void this.playSfx('whisper', { gain: 0.18, rate: 1.15 })
        break
      case 'knight':
        void this.playSfx('footsteps-soft', { gain: 0.35, rate: 0.85 })
        void this.playSfx('chime', { gain: 0.2, rate: 0.7 })
        break
      case 'ravenkeeper':
        void this.playSfx('wind-gust', { gain: 0.28, rate: 0.88 })
        void this.playSfx('whisper', { gain: 0.22, rate: 0.92 })
        break
      case 'baron':
        void this.playSfx('horror', { gain: 0.32, rate: 0.62 })
        void this.playSfx('whisper', { gain: 0.25, rate: 0.7 })
        break
      case 'nightshade':
        void this.playSfx('whoosh', { gain: 0.3, rate: 0.75 })
        void this.playSfx('sigh', { gain: 0.25, rate: 0.72 })
        break
      case 'hollow':
        void this.playSfx('creak', { gain: 0.35, rate: 0.65 })
        void this.playSfx('whisper', { gain: 0.25, rate: 0.65 })
        break
      case 'whisperer':
        void this.playSfx('whisper', { gain: 0.28, rate: 0.78, pan: -0.4 })
        void this.playSfx('whisper', { gain: 0.25, rate: 1.25, pan: 0.4 })
        break
      case 'seraphina':
        void this.playSfx('cloth', { gain: 0.3, rate: 1.05 })
        void this.playSfx('chime', { gain: 0.25, rate: 1.18 })
        break
      case 'camille':
        void this.playSfx('sigh', { gain: 0.28, rate: 1.08 })
        void this.playSfx('candle', { gain: 0.2, rate: 0.9 })
        break
      case 'thalia':
        void this.playSfx('cloth', { gain: 0.32, rate: 1.15 })
        void this.playSfx('chime', { gain: 0.22, rate: 1.25 })
        break
      case 'vespera':
        void this.playSfx('chime', { gain: 0.3, rate: 0.92 })
        void this.playSfx('cloth', { gain: 0.25, rate: 0.95 })
        break
      case 'rouge':
        void this.playSfx('cloth', { gain: 0.3, rate: 1.22 })
        void this.playSfx('sigh', { gain: 0.25, rate: 1.12 })
        break
      case 'isolde':
        void this.playSfx('candle', { gain: 0.28, rate: 1.0 })
        void this.playSfx('whisper', { gain: 0.22, rate: 0.95 })
        break
      case 'celestine':
        void this.playSfx('chime', { gain: 0.38, rate: 1.45 })
        break
      case 'briarwyn':
        void this.playSfx('cloth', { gain: 0.3, rate: 0.88 })
        void this.playSfx('chime', { gain: 0.25, rate: 0.85 })
        break
      case 'nymeris':
        void this.playSfx('wind-gust', { gain: 0.25, rate: 1.15 })
        void this.playSfx('chime', { gain: 0.25, rate: 1.25 })
        break
      case 'ashwick':
        void this.playSfx('sigh', { gain: 0.28, rate: 0.95 })
        void this.playSfx('whoosh', { gain: 0.2, rate: 1.1 })
        break
      default:
        if (tone === 'creepy') {
          void this.playSfx('horror', { gain: 0.3, rate: 0.7 })
        } else if (tone === 'seductive') {
          void this.playSfx('cloth', { gain: 0.3, rate: 1.1 })
        } else {
          void this.playSfx('chime', { gain: 0.3, rate: 1.0 })
        }
    }
  }

  private scheduleCorridorSteps = () => {
    window.clearTimeout(this.footstepTimer)
    if (!this.enabled || !this.unlocked) return
    const min = this.theme === 'night' ? 28_000 : 55_000
    const max = this.theme === 'night' ? 90_000 : 140_000
    const delay = min + Math.random() * (max - min)
    this.footstepTimer = window.setTimeout(() => {
      if (this.enabled && Math.random() < (this.theme === 'night' ? 0.7 : 0.35)) {
        void this.playWalkingPast()
      }
      this.scheduleCorridorSteps()
    }, delay)
  }

  private applyMaster(smooth: boolean) {
    if (!this.master || !this.ctx) return
    const t = this.ctx.currentTime
    const target = this.enabled ? this.volume : 0
    this.master.gain.cancelScheduledValues(t)
    if (smooth) {
      this.master.gain.setValueAtTime(this.master.gain.value, t)
      this.master.gain.linearRampToValueAtTime(target, t + 1.2)
    } else {
      this.master.gain.setValueAtTime(target, t)
    }
  }

  private async prefetch(kinds: SfxKind[]) {
    for (const k of kinds) {
      for (const u of SFX_URLS[k]) void this.loadBuffer(u)
    }
  }

  private loadBuffer(url: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(url)) return Promise.resolve(this.buffers.get(url)!)
    if (this.loading.has(url)) return this.loading.get(url)!
    if (!this.ctx) return Promise.resolve(null)

    const p = (async () => {
      try {
        const res = await fetch(url)
        if (!res.ok) return null
        const arr = await res.arrayBuffer()
        const buf = await this.ctx!.decodeAudioData(arr.slice(0))
        this.buffers.set(url, buf)
        return buf
      } catch {
        return null
      } finally {
        this.loading.delete(url)
      }
    })()
    this.loading.set(url, p)
    return p
  }

  dispose() {
    window.clearTimeout(this.footstepTimer)
    window.clearTimeout(this.bedBirdTimer)
    window.clearTimeout(this.bedFireTimer)
    this.stopBeds()
    void this.ctx?.close()
    this.ctx = null
    this.started = false
    this.unlocked = false
  }
}

export const audioEngine = new AudioEngine()
