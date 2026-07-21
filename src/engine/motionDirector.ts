import type {
  IntensityLevel,
  MotionState,
  PerformanceMode,
  PortraitTone,
} from '../types/portrait'
import { useAppStore } from '../store/useAppStore'
import { getPortrait } from '../data/portraits'
import { pickMicroMoment, type MicroMoment } from './microMoments'
import { audioEngine } from './audioEngine'

type DirectorOpts = {
  intensity: IntensityLevel
  performanceMode: PerformanceMode
  reducedMotion: boolean
  idle: boolean
  surpriseEnabled: boolean
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function intensityScale(level: IntensityLevel, reduced: boolean): number {
  if (reduced) return 0.25
  switch (level) {
    case 'still':
      return 0
    case 'subtle':
      return 0.45
    case 'lively':
      return 1
    case 'enchanted':
      return 1.35
  }
}

type AckPhase = 'idle' | 'blink' | 'gaze' | 'smile' | 'nod' | 'done'

/**
 * Motion director: blinks, lips, smiles, head, scripted micro-moments,
 * and multi-step acknowledge choreography.
 */
export class MotionDirector {
  private raf = 0
  private running = false
  private startedAt = performance.now()
  private nextBlinkAt = 0
  private blinkStart = 0
  private blinkUntil = 0
  private doubleBlink = false
  private nextMomentAt = 0
  private momentUntil = 0
  private momentGaze = { x: 0, y: 0 }
  private activeMoment: MicroMoment | null = null
  private nextMouthAt = 0
  private mouthStart = 0
  private mouthUntil = 0
  private nextSmileAt = 0
  private smileStart = 0
  private smileUntil = 0
  private baseGaze = { x: 0, y: 0 }
  private gazeTarget = { x: 0, y: 0 }
  private headTarget = { rotate: 0, tilt: 0 }
  private longStare = 0
  private eyeBrighten = 0
  private breathBoost = 0

  // Acknowledge choreography
  private ackPhase: AckPhase = 'idle'
  private ackPhaseUntil = 0
  private ackGaze = { x: 0, y: 0 }

  private lastOpts: DirectorOpts = {
    intensity: 'lively',
    performanceMode: 'balanced',
    reducedMotion: false,
    idle: false,
    surpriseEnabled: true,
  }

  start() {
    if (this.running) return
    this.running = true
    this.startedAt = performance.now()
    const now = performance.now()
    this.scheduleBlink(now)
    this.scheduleMoment(now)
    this.scheduleMouth(now)
    this.scheduleSmile(now)
    this.tick()
  }

  stop() {
    this.running = false
    if (this.raf) cancelAnimationFrame(this.raf)
  }

  updateOpts(opts: Partial<DirectorOpts>) {
    this.lastOpts = { ...this.lastOpts, ...opts }
  }

  forceBlink() {
    const now = performance.now()
    this.blinkStart = now
    this.blinkUntil = now + rand(260, 340)
    this.nextBlinkAt = now + rand(2000, 4000)
  }

  /**
   * Full acknowledge: blink → gaze → smile → soft nod.
   * Prefer this over raw glanceTo for taps.
   */
  playAcknowledge(x: number, y: number) {
    const scale = intensityScale(
      this.lastOpts.intensity,
      this.lastOpts.reducedMotion,
    )
    if (scale <= 0) {
      this.glanceTo(x, y)
      return
    }
    const now = performance.now()
    this.ackGaze = {
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
    }
    this.ackPhase = 'blink'
    this.ackPhaseUntil = now + 280
    this.forceBlink()
    this.eyeBrighten = 1
    useAppStore.getState().setMotion({ acknowledging: true })
  }

  glanceTo(x: number, y: number) {
    const scale = intensityScale(
      this.lastOpts.intensity,
      this.lastOpts.reducedMotion,
    )
    this.gazeTarget = {
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
    }
    this.headTarget = {
      rotate: this.gazeTarget.x * 4.5 * Math.max(0.4, scale),
      tilt: this.gazeTarget.y * 2.5 * Math.max(0.4, scale),
    }
    this.momentUntil = performance.now() + 2000
    this.activeMoment = null
    this.forceBlink()
    if (scale > 0 && Math.random() < 0.45) {
      const now = performance.now()
      this.smileStart = now + 350
      this.smileUntil = now + rand(900, 1500)
    }
  }

  wink() {
    const now = performance.now()
    useAppStore.getState().setMotion({ wink: true })
    window.setTimeout(() => {
      useAppStore.getState().setMotion({ wink: false })
    }, 280)
    this.nextBlinkAt = now + rand(3000, 5000)
  }

  private currentTone(): PortraitTone {
    try {
      const id = useAppStore.getState().currentPortraitId
      return getPortrait(id).tone
    } catch {
      return 'classic'
    }
  }

  private scheduleBlink(now: number) {
    const scale = intensityScale(
      this.lastOpts.intensity,
      this.lastOpts.reducedMotion,
    )
    if (scale <= 0) {
      this.nextBlinkAt = now + 60_000
      return
    }
    const idleMul = this.lastOpts.idle ? 1.6 : 1
    this.nextBlinkAt =
      now + (rand(3200, 8500) * idleMul) / Math.max(0.4, scale)
    this.doubleBlink = Math.random() < 0.14
  }

  private scheduleMoment(now: number) {
    if (
      !this.lastOpts.surpriseEnabled ||
      this.lastOpts.reducedMotion ||
      this.lastOpts.intensity === 'still'
    ) {
      this.nextMomentAt = now + 120_000
      return
    }
    const idleMul = this.lastOpts.idle ? 1.8 : 1
    const scale = intensityScale(this.lastOpts.intensity, false)
    // Micro-moments every ~35–95s (rarer when idle)
    this.nextMomentAt =
      now + (rand(35_000, 95_000) * idleMul) / Math.max(0.7, scale)
  }

  private scheduleMouth(now: number) {
    if (this.lastOpts.intensity === 'still' || this.lastOpts.reducedMotion) {
      this.nextMouthAt = now + 90_000
      return
    }
    const scale = intensityScale(this.lastOpts.intensity, false)
    const idleMul = this.lastOpts.idle ? 1.5 : 1
    this.nextMouthAt =
      now + (rand(12_000, 28_000) * idleMul) / Math.max(0.5, scale)
  }

  private scheduleSmile(now: number) {
    if (this.lastOpts.intensity === 'still' || this.lastOpts.reducedMotion) {
      this.nextSmileAt = now + 120_000
      return
    }
    const scale = intensityScale(this.lastOpts.intensity, false)
    const idleMul = this.lastOpts.idle ? 1.6 : 1
    this.nextSmileAt =
      now + (rand(25_000, 70_000) * idleMul) / Math.max(0.5, scale)
  }

  private applyMoment(m: MicroMoment, now: number) {
    this.activeMoment = m
    const [d0, d1] = m.duration
    this.momentUntil = now + rand(d0, d1)

    switch (m.id) {
      case 'glance-left':
        this.momentGaze = { x: rand(-0.7, -0.35), y: rand(-0.08, 0.1) }
        break
      case 'glance-right':
        this.momentGaze = { x: rand(0.35, 0.7), y: rand(-0.08, 0.1) }
        break
      case 'look-down':
        this.momentGaze = { x: rand(-0.15, 0.15), y: rand(0.12, 0.28) }
        this.forceBlink()
        break
      case 'long-stare':
        this.momentGaze = { x: rand(-0.08, 0.08), y: rand(-0.05, 0.08) }
        this.longStare = 1
        break
      case 'almost-speak':
        this.momentGaze = { x: 0, y: 0.05 }
        this.mouthStart = now
        this.mouthUntil = now + rand(800, 1500)
        break
      case 'soft-laugh':
        this.momentGaze = { x: rand(-0.15, 0.15), y: rand(-0.05, 0.1) }
        this.smileStart = now
        this.smileUntil = this.momentUntil
        this.breathBoost = 1
        break
      case 'startle':
        this.momentGaze = { x: rand(-0.4, 0.4), y: rand(-0.2, -0.05) }
        this.forceBlink()
        this.headTarget = {
          rotate: this.momentGaze.x * 6,
          tilt: -2.5,
        }
        break
      case 'pride':
        this.momentGaze = { x: 0, y: rand(-0.12, -0.02) }
        this.smileStart = now + 150
        this.smileUntil = this.momentUntil
        this.headTarget = { rotate: 0, tilt: -1.8 }
        break
      case 'bored':
        this.momentGaze = {
          x: Math.random() > 0.5 ? rand(-0.55, -0.3) : rand(0.3, 0.55),
          y: rand(0.05, 0.15),
        }
        break
      case 'invitation':
        this.momentGaze = { x: 0, y: 0.06 }
        this.smileStart = now
        this.smileUntil = this.momentUntil
        this.eyeBrighten = 1
        break
    }

    if (m.audio && useAppStore.getState().audioEnabled) {
      void audioEngine.playSfx(
        m.audio === 'whoosh'
          ? 'whoosh'
          : m.audio === 'creak'
            ? 'creak'
            : m.audio === 'whisper'
              ? 'whisper'
              : m.audio === 'chime'
                ? 'chime'
                : m.audio === 'cloth'
                  ? 'cloth'
                  : 'sigh',
        { gain: 0.16 },
      )
    }
  }

  private tickAck(now: number, scale: number) {
    if (this.ackPhase === 'idle') return false

    if (now >= this.ackPhaseUntil) {
      if (this.ackPhase === 'blink') {
        this.ackPhase = 'gaze'
        this.ackPhaseUntil = now + 700
      } else if (this.ackPhase === 'gaze') {
        this.ackPhase = 'smile'
        this.ackPhaseUntil = now + 900
        this.smileStart = now
        this.smileUntil = now + 1100
      } else if (this.ackPhase === 'smile') {
        this.ackPhase = 'nod'
        this.ackPhaseUntil = now + 550
      } else {
        this.ackPhase = 'idle'
        useAppStore.getState().setMotion({ acknowledging: false })
      }
    }

    if (this.ackPhase === 'idle') return false

    this.gazeTarget = this.ackGaze
    const amp = Math.max(0.4, scale)
    if (this.ackPhase === 'nod') {
      // Soft bow
      const nodT = 1 - (this.ackPhaseUntil - now) / 550
      this.headTarget = {
        rotate: this.ackGaze.x * 3.5 * amp,
        tilt: this.ackGaze.y * 1.5 * amp + Math.sin(nodT * Math.PI) * 2.2,
      }
    } else {
      this.headTarget = {
        rotate: this.ackGaze.x * 4.5 * amp,
        tilt: this.ackGaze.y * 2.2 * amp,
      }
    }
    this.eyeBrighten = Math.max(this.eyeBrighten, 0.85)
    return true
  }

  private tick = () => {
    if (!this.running) return
    const now = performance.now()
    const t = (now - this.startedAt) / 1000
    const scale = intensityScale(
      this.lastOpts.intensity,
      this.lastOpts.reducedMotion,
    )
    const idleMul = this.lastOpts.idle ? 0.55 : 1
    const headAmp = scale * idleMul

    const breathBase =
      scale <= 0
        ? 0
        : (Math.sin(t * ((Math.PI * 2) / 4.2)) * 0.5 + 0.5) * scale * idleMul
    this.breathBoost *= 0.985
    const breath = Math.min(1, breathBase + this.breathBoost * 0.35)

    const headDrift =
      scale <= 0 ? 0 : Math.sin(t * ((Math.PI * 2) / 11.3)) * 2.2 * headAmp
    const headTiltDrift =
      scale <= 0
        ? 0
        : Math.sin(t * ((Math.PI * 2) / 13.7) + 1.2) * 1.4 * headAmp +
          Math.sin(t * ((Math.PI * 2) / 23.1)) * 0.6 * headAmp
    const gazeDriftX =
      scale <= 0
        ? 0
        : Math.sin(t * ((Math.PI * 2) / 17.1)) * 0.14 * scale * idleMul
    const gazeDriftY =
      scale <= 0
        ? 0
        : Math.sin(t * ((Math.PI * 2) / 19.4) + 0.7) * 0.08 * scale * idleMul

    // ── Blinks ──
    let blink = 0
    if (now >= this.nextBlinkAt && now > this.blinkUntil) {
      this.blinkStart = now
      this.blinkUntil = now + rand(260, 360)
      if (this.doubleBlink) {
        this.nextBlinkAt = now + rand(280, 420)
        this.doubleBlink = false
      } else {
        this.scheduleBlink(now)
      }
    }
    if (now < this.blinkUntil && this.blinkStart > 0) {
      const total = Math.max(1, this.blinkUntil - this.blinkStart)
      const p = Math.max(0, Math.min(1, (now - this.blinkStart) / total))
      if (p < 0.22) blink = p / 0.22
      else if (p < 0.55) blink = 1
      else blink = 1 - (p - 0.55) / 0.45
      blink = Math.max(0, Math.min(1, blink))
    }

    // ── Mouth ──
    let mouth = 0
    if (
      now >= this.nextMouthAt &&
      now > this.mouthUntil &&
      scale > 0 &&
      now > this.smileUntil &&
      this.ackPhase === 'idle'
    ) {
      this.mouthStart = now
      this.mouthUntil = now + rand(600, 1800)
      this.scheduleMouth(now)
    }
    if (now < this.mouthUntil && this.mouthStart > 0) {
      const dur = Math.max(1, this.mouthUntil - this.mouthStart)
      const local = (now - this.mouthStart) / dur
      mouth =
        Math.max(0, Math.sin(local * Math.PI * 5) * Math.sin(local * Math.PI)) *
        0.85 *
        scale
      mouth = Math.max(0, Math.min(0.9, mouth))
    }

    // ── Smile ──
    let expressionSmile = 0
    if (
      now >= this.nextSmileAt &&
      now > this.smileUntil &&
      scale > 0 &&
      now > this.mouthUntil &&
      this.ackPhase === 'idle'
    ) {
      this.smileStart = now
      this.smileUntil = now + rand(1200, 2800)
      this.scheduleSmile(now)
    }
    if (now < this.smileUntil && this.smileStart > 0 && now >= this.smileStart) {
      const total = Math.max(1, this.smileUntil - this.smileStart)
      const p = Math.max(0, Math.min(1, (now - this.smileStart) / total))
      let env = 0
      if (p < 0.15) env = p / 0.15
      else if (p < 0.7) env = 1
      else env = 1 - (p - 0.7) / 0.3
      expressionSmile =
        env * scale * (this.lastOpts.intensity === 'enchanted' ? 1 : 0.9)
    }
    if (mouth > 0.08) expressionSmile *= 1 - mouth * 0.85

    // ── Micro-moments ──
    if (
      now >= this.nextMomentAt &&
      now > this.momentUntil &&
      this.ackPhase === 'idle'
    ) {
      const m = pickMicroMoment(this.currentTone())
      this.applyMoment(m, now)
      this.scheduleMoment(now)
    }
    if (now >= this.momentUntil) {
      this.activeMoment = null
      this.longStare *= 0.9
    }

    this.eyeBrighten *= 0.992
    this.longStare *= 0.995

    const inAck = this.tickAck(now, scale)
    const inMoment = now < this.momentUntil
    const store = useAppStore.getState()

    if (!inAck) {
      if (inMoment) {
        this.gazeTarget = this.momentGaze
        if (this.activeMoment?.id !== 'startle' && this.activeMoment?.id !== 'pride') {
          this.headTarget = {
            rotate: this.momentGaze.x * 4.2 * Math.max(0.4, headAmp),
            tilt: this.momentGaze.y * 2.2 * Math.max(0.4, headAmp),
          }
        }
      } else if (store.motion.acknowledging && this.ackPhase === 'idle') {
        // legacy flag without choreography
        this.gazeTarget = store.motion.gaze
        this.headTarget = {
          rotate: store.motion.gaze.x * 4.5 * Math.max(0.4, headAmp),
          tilt: store.motion.gaze.y * 2.5 * Math.max(0.4, headAmp),
        }
      } else {
        this.gazeTarget = {
          x: this.baseGaze.x + gazeDriftX,
          y: this.baseGaze.y + gazeDriftY,
        }
        this.headTarget = { rotate: headDrift, tilt: headTiltDrift }
      }
    }

    const prev = store.motion
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k
    const k =
      this.lastOpts.performanceMode === 'low'
        ? 0.09
        : this.lastOpts.performanceMode === 'high'
          ? 0.04
          : 0.055

    const next: Partial<MotionState> = {
      blink,
      breath,
      headRotate: lerp(prev.headRotate, this.headTarget.rotate, k),
      headTilt: lerp(prev.headTilt, this.headTarget.tilt, k),
      gaze: {
        x: lerp(prev.gaze.x, this.gazeTarget.x, k),
        y: lerp(prev.gaze.y, this.gazeTarget.y, k),
      },
      mouth,
      expressionSmile,
      eyeBrighten: this.eyeBrighten,
      longStare: this.longStare,
      activeMoment: this.activeMoment?.id ?? null,
    }

    store.setMotion(next)

    if (
      store.phase === 'attentive' &&
      now - store.lastInteractionAt > 12_000 &&
      this.ackPhase === 'idle'
    ) {
      store.setPhase('ambient')
    }

    this.raf = requestAnimationFrame(this.tick)
  }
}

export const motionDirector = new MotionDirector()
