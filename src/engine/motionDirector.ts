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

  // Progressive pose (silk / hand sequence) — slow rise → hold → fall
  private poseTarget = 0
  private posePhase: 'idle' | 'rise' | 'hold' | 'fall' = 'idle'
  private posePhaseUntil = 0
  private nextPoseAt = 0

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
    this.schedulePose(now)
    this.tick()
  }

  private hasPoseFrames(): boolean {
    try {
      const id = useAppStore.getState().currentPortraitId
      const frames = getPortrait(id).imagePose
      return !!frames && frames.length > 0
    } catch {
      return false
    }
  }

  private schedulePose(now: number) {
    if (
      !this.hasPoseFrames() ||
      this.lastOpts.reducedMotion ||
      this.lastOpts.intensity === 'still'
    ) {
      this.nextPoseAt = now + 180_000
      return
    }
    const idleMul = this.lastOpts.idle ? 1.5 : 1
    // Rare, deliberate silk gesture (~45–90s)
    this.nextPoseAt = now + rand(45_000, 90_000) * idleMul
  }

  private beginPoseReveal(now: number) {
    if (!this.hasPoseFrames() || this.posePhase !== 'idle') return
    this.posePhase = 'rise'
    this.posePhaseUntil = now + rand(3200, 4800)
    this.poseTarget = 1
    this.eyeBrighten = Math.max(this.eyeBrighten, 0.55)
    this.breathBoost = Math.max(this.breathBoost, 0.6)
    if (useAppStore.getState().audioEnabled) {
      void audioEngine.playSfx('cloth', { gain: 0.14 })
    }
  }

  private tickPose(now: number) {
    if (!this.hasPoseFrames()) {
      this.poseTarget = 0
      this.posePhase = 'idle'
      return
    }

    // Ambient scheduled reveals (in addition to silk-reveal micro-moment)
    if (
      this.posePhase === 'idle' &&
      now >= this.nextPoseAt &&
      this.ackPhase === 'idle' &&
      now > this.momentUntil
    ) {
      this.beginPoseReveal(now)
      this.schedulePose(now)
    }

    if (this.posePhase === 'rise' && now >= this.posePhaseUntil) {
      this.posePhase = 'hold'
      this.posePhaseUntil = now + rand(2800, 4500)
      this.poseTarget = 1
    } else if (this.posePhase === 'hold' && now >= this.posePhaseUntil) {
      this.posePhase = 'fall'
      this.posePhaseUntil = now + rand(3500, 5200)
      this.poseTarget = 0
    } else if (this.posePhase === 'fall' && now >= this.posePhaseUntil) {
      this.posePhase = 'idle'
      this.poseTarget = 0
    }
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
    // Seductive cast: occasional teasing wink after the nod
    if (this.isSeductiveTone() && Math.random() < 0.35) {
      window.setTimeout(() => this.wink(), 2200)
    }
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

  private isSeductiveTone(): boolean {
    return this.currentTone() === 'seductive'
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
    // Mildly more present for seductive — still natural, not twitchy
    const sedMul = this.isSeductiveTone() ? 0.88 : 1
    this.nextBlinkAt =
      now + (rand(3800, 9000) * idleMul * sedMul) / Math.max(0.4, scale)
    this.doubleBlink = Math.random() < (this.isSeductiveTone() ? 0.16 : 0.14)
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
    // Seductive slightly denser (~24–58s). Others ~40–100s. Hold-heavy life.
    const [lo, hi] = this.isSeductiveTone()
      ? ([24_000, 58_000] as const)
      : ([40_000, 100_000] as const)
    this.nextMomentAt =
      now + (rand(lo, hi) * idleMul) / Math.max(0.7, scale)
  }

  private scheduleMouth(now: number) {
    if (this.lastOpts.intensity === 'still' || this.lastOpts.reducedMotion) {
      this.nextMouthAt = now + 90_000
      return
    }
    const isSeductive = this.isSeductiveTone()
    const scale = intensityScale(this.lastOpts.intensity, false)
    const idleMul = this.lastOpts.idle ? 1.5 : 1
    // Rare soft murmurs — leave room between expression swaps
    const [lo, hi] = isSeductive
      ? ([14_000, 28_000] as const)
      : ([16_000, 34_000] as const)
    this.nextMouthAt =
      now + (rand(lo, hi) * idleMul) / Math.max(0.5, scale)
  }

  private scheduleSmile(now: number) {
    if (this.lastOpts.intensity === 'still' || this.lastOpts.reducedMotion) {
      this.nextSmileAt = now + 120_000
      return
    }
    const isSeductive = this.isSeductiveTone()
    const scale = intensityScale(this.lastOpts.intensity, false)
    const idleMul = this.lastOpts.idle ? 1.6 : 1
    const [lo, hi] = isSeductive
      ? ([16_000, 36_000] as const)
      : ([20_000, 42_000] as const)
    this.nextSmileAt =
      now + (rand(lo, hi) * idleMul) / Math.max(0.5, scale)
  }

  private applyMoment(m: MicroMoment, now: number) {
    this.activeMoment = m
    const [d0, d1] = m.duration
    this.momentUntil = now + rand(d0, d1)
    const side = Math.random() > 0.5 ? 1 : -1

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

      // ── Seductive emotional beats ──────────────────────────────
      case 'coy-look':
        // Glance aside, soft smile, almost shy
        this.momentGaze = {
          x: side * rand(0.4, 0.72),
          y: rand(0.04, 0.16),
        }
        this.smileStart = now + 200
        this.smileUntil = this.momentUntil
        this.eyeBrighten = 0.55
        this.forceBlink()
        this.headTarget = {
          rotate: this.momentGaze.x * 5.2,
          tilt: 1.2,
        }
        break
      case 'slow-look-up':
        // Languid rise from lowered lids
        this.momentGaze = { x: rand(-0.12, 0.12), y: rand(0.18, 0.32) }
        this.forceBlink()
        window.setTimeout(() => {
          if (this.activeMoment?.id !== 'slow-look-up') return
          this.momentGaze = { x: rand(-0.08, 0.08), y: rand(-0.14, -0.02) }
          this.eyeBrighten = 0.9
          this.smileStart = performance.now()
          this.smileUntil = this.momentUntil
        }, rand(700, 1200))
        break
      case 'sideways-glance':
        this.momentGaze = {
          x: side * rand(0.45, 0.78),
          y: rand(-0.06, 0.08),
        }
        this.smileStart = now + 120
        this.smileUntil = now + rand(900, 1600)
        this.headTarget = {
          rotate: this.momentGaze.x * 5.5,
          tilt: rand(-0.4, 0.8),
        }
        break
      case 'half-smile':
        this.momentGaze = { x: rand(-0.1, 0.1), y: rand(-0.04, 0.08) }
        this.smileStart = now
        this.smileUntil = this.momentUntil
        this.eyeBrighten = 0.45
        break
      case 'sultry-stare':
        this.momentGaze = { x: rand(-0.06, 0.06), y: rand(-0.02, 0.1) }
        this.eyeBrighten = 1
        this.longStare = 0.55
        this.smileStart = now + 400
        this.smileUntil = this.momentUntil
        this.headTarget = { rotate: 0, tilt: rand(0.4, 1.4) }
        break
      case 'wink-tease':
        this.momentGaze = {
          x: side * rand(0.15, 0.35),
          y: rand(-0.04, 0.06),
        }
        this.smileStart = now
        this.smileUntil = this.momentUntil + 400
        this.eyeBrighten = 0.7
        this.wink()
        break
      case 'lip-part':
        this.momentGaze = { x: rand(-0.08, 0.08), y: rand(0.02, 0.12) }
        this.mouthStart = now
        this.mouthUntil = now + rand(1000, 1900)
        this.smileStart = now + 300
        this.smileUntil = now + rand(900, 1500)
        this.eyeBrighten = 0.5
        break
      case 'languid-breath':
        this.momentGaze = { x: rand(-0.1, 0.1), y: rand(0.02, 0.1) }
        this.breathBoost = 1.35
        this.headTarget = {
          rotate: rand(-1.2, 1.2),
          tilt: rand(0.6, 1.8),
        }
        if (Math.random() < 0.45) {
          this.mouthStart = now + 400
          this.mouthUntil = now + rand(900, 1400)
        }
        break
      case 'hair-toss':
        this.momentGaze = {
          x: side * rand(0.25, 0.55),
          y: rand(-0.1, 0.05),
        }
        this.headTarget = {
          rotate: side * rand(4.5, 7.5),
          tilt: rand(-1.5, -0.3),
        }
        this.breathBoost = 0.7
        this.forceBlink()
        window.setTimeout(() => {
          if (this.activeMoment?.id !== 'hair-toss') return
          this.headTarget = {
            rotate: side * rand(1.5, 3.2),
            tilt: rand(-0.4, 0.6),
          }
        }, rand(500, 900))
        break
      case 'come-hither':
        this.momentGaze = { x: 0, y: rand(0.04, 0.14) }
        this.smileStart = now
        this.smileUntil = this.momentUntil
        this.eyeBrighten = 1
        this.mouthStart = now + 350
        this.mouthUntil = now + rand(700, 1200)
        this.headTarget = { rotate: 0, tilt: rand(0.8, 1.8) }
        break
      case 'shy-away':
        this.momentGaze = {
          x: side * rand(0.35, 0.65),
          y: rand(0.1, 0.22),
        }
        this.forceBlink()
        this.headTarget = {
          rotate: this.momentGaze.x * 4,
          tilt: 1.6,
        }
        window.setTimeout(() => {
          if (this.activeMoment?.id !== 'shy-away') return
          this.momentGaze = { x: rand(-0.1, 0.1), y: rand(-0.04, 0.06) }
          this.smileStart = performance.now()
          this.smileUntil = this.momentUntil
          this.eyeBrighten = 0.65
        }, rand(900, 1500))
        break
      case 'smolder':
        this.momentGaze = { x: rand(-0.05, 0.05), y: rand(-0.02, 0.08) }
        this.eyeBrighten = 0.85
        this.longStare = 0.4
        this.headTarget = {
          rotate: side * rand(0.8, 2.2),
          tilt: rand(0.3, 1.2),
        }
        // Slow half-smile builds late
        this.smileStart = now + rand(600, 1100)
        this.smileUntil = this.momentUntil
        if (Math.random() < 0.35) {
          this.mouthStart = now + rand(900, 1600)
          this.mouthUntil = this.mouthStart + rand(500, 900)
        }
        break
      case 'silk-reveal':
        this.momentGaze = { x: rand(-0.08, 0.08), y: rand(0.04, 0.14) }
        this.eyeBrighten = 0.7
        this.smileStart = now + 800
        this.smileUntil = this.momentUntil
        this.headTarget = { rotate: side * rand(0.5, 1.5), tilt: rand(0.6, 1.4) }
        // Progressive pose frames if this portrait has them; else soft invitation
        if (this.hasPoseFrames()) {
          this.beginPoseReveal(now)
        } else {
          this.mouthStart = now + 400
          this.mouthUntil = now + rand(900, 1500)
        }
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

    const seductive = this.isSeductiveTone()
    if (now >= this.ackPhaseUntil) {
      if (this.ackPhase === 'blink') {
        this.ackPhase = 'gaze'
        this.ackPhaseUntil = now + (seductive ? 850 : 700)
      } else if (this.ackPhase === 'gaze') {
        this.ackPhase = 'smile'
        this.ackPhaseUntil = now + (seductive ? 1200 : 900)
        this.smileStart = now
        this.smileUntil = now + (seductive ? 1600 : 1100)
      } else if (this.ackPhase === 'smile') {
        this.ackPhase = 'nod'
        this.ackPhaseUntil = now + (seductive ? 700 : 550)
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

    const seductive = this.isSeductiveTone()
    // Slightly fuller breath + livelier ambient drift for seductive cast
    const sedBody = seductive ? 1.18 : 1
    const sedGaze = seductive ? 1.35 : 1

    const breathBase =
      scale <= 0
        ? 0
        : (Math.sin(t * ((Math.PI * 2) / (seductive ? 3.7 : 4.2))) * 0.5 +
            0.5) *
          scale *
          idleMul *
          sedBody
    this.breathBoost *= 0.985
    const breath = Math.min(1, breathBase + this.breathBoost * (seductive ? 0.45 : 0.35))

    // Breath-synchronized soft cloth rustle at peak inspiration
    if (
      breath > 0.94 &&
      this.lastOpts.performanceMode === 'high' &&
      useAppStore.getState().audioEnabled &&
      Math.random() < (seductive ? 0.014 : 0.008)
    ) {
      void audioEngine.playSoftEvent('cloth')
    }

    const headDrift =
      scale <= 0
        ? 0
        : Math.sin(t * ((Math.PI * 2) / 11.3)) * 2.2 * headAmp * sedBody
    const headTiltDrift =
      scale <= 0
        ? 0
        : Math.sin(t * ((Math.PI * 2) / 13.7) + 1.2) * 1.4 * headAmp * sedBody +
          Math.sin(t * ((Math.PI * 2) / 23.1)) * 0.6 * headAmp * sedBody
    const gazeDriftX =
      scale <= 0
        ? 0
        : Math.sin(t * ((Math.PI * 2) / (seductive ? 14.2 : 17.1))) *
          0.14 *
          scale *
          idleMul *
          sedGaze
    const gazeDriftY =
      scale <= 0
        ? 0
        : Math.sin(t * ((Math.PI * 2) / (seductive ? 16.0 : 19.4)) + 0.7) *
          0.08 *
          scale *
          idleMul *
          sedGaze

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
    // Don't start a new murmur while smiling/moments are still settling
    const expressionCooldown = 900
    let mouth = 0
    if (
      now >= this.nextMouthAt &&
      now > this.mouthUntil + expressionGap &&
      now > this.smileUntil + expressionGap &&
      now > this.momentUntil &&
      scale > 0 &&
      this.ackPhase === 'idle'
    ) {
      this.mouthStart = now
      // Single soft open/close — avoid rapid multi-pulse chatter
      this.mouthUntil = now + (seductive ? rand(1400, 2600) : rand(1100, 2200))
      this.scheduleMouth(now)
    }
    if (now < this.mouthUntil && this.mouthStart > 0) {
      const dur = Math.max(1, this.mouthUntil - this.mouthStart)
      const local = (now - this.mouthStart) / dur
      // One gentle envelope (optional tiny mid breath, not lip chatter)
      const env = Math.sin(local * Math.PI)
      const flutter =
        seductive && local > 0.25 && local < 0.75
          ? 0.12 * Math.sin(local * Math.PI * 2)
          : 0
      mouth = Math.max(0, Math.min(0.85, (env + flutter) * 0.78 * scale))
    }

    // ── Smile ──
    let expressionSmile = 0
    if (
      now >= this.nextSmileAt &&
      now > this.smileUntil + expressionGap &&
      now > this.mouthUntil + expressionGap &&
      now > this.momentUntil &&
      scale > 0 &&
      this.ackPhase === 'idle'
    ) {
      this.smileStart = now
      // Long holds so crossfades read as oil paint, not a flipbook
      this.smileUntil =
        now + (seductive ? rand(2800, 5200) : rand(2200, 4000))
      this.scheduleSmile(now)
    }
    if (now < this.smileUntil && this.smileStart > 0 && now >= this.smileStart) {
      const total = Math.max(1, this.smileUntil - this.smileStart)
      const p = Math.max(0, Math.min(1, (now - this.smileStart) / total))
      let env = 0
      // Slow ease in/out — longer than old 15% attack
      const atk = 0.28
      const hold = 0.72
      if (p < atk) env = p / atk
      else if (p < hold) env = 1
      else env = 1 - (p - hold) / (1 - hold)
      // Ease curves so alpha doesn't jump
      env = env * env * (3 - 2 * env)
      const smileCap =
        this.lastOpts.intensity === 'enchanted' ? 0.95 : seductive ? 0.88 : 0.82
      expressionSmile = env * scale * smileCap
    }
    if (mouth > 0.08) expressionSmile *= 1 - mouth * 0.85

    // ── Micro-moments ──
    if (
      now >= this.nextMomentAt &&
      now > this.momentUntil &&
      now > this.smileUntil + 400 &&
      now > this.mouthUntil + 400 &&
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

    this.tickPose(now)

    const inAck = this.tickAck(now, scale)
    const inMoment = now < this.momentUntil
    const store = useAppStore.getState()

    // Moments that set a deliberate head pose in applyMoment — don't overwrite
    const customHeadMoment =
      this.activeMoment?.id === 'startle' ||
      this.activeMoment?.id === 'pride' ||
      this.activeMoment?.id === 'coy-look' ||
      this.activeMoment?.id === 'sideways-glance' ||
      this.activeMoment?.id === 'sultry-stare' ||
      this.activeMoment?.id === 'languid-breath' ||
      this.activeMoment?.id === 'hair-toss' ||
      this.activeMoment?.id === 'come-hither' ||
      this.activeMoment?.id === 'shy-away' ||
      this.activeMoment?.id === 'smolder' ||
      this.activeMoment?.id === 'silk-reveal'

    if (!inAck) {
      if (inMoment) {
        this.gazeTarget = this.momentGaze
        if (!customHeadMoment) {
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
        const px = store.parallax.x * 0.45
        const py = store.parallax.y * 0.35
        this.gazeTarget = {
          x: this.baseGaze.x + gazeDriftX + px,
          y: this.baseGaze.y + gazeDriftY + py,
        }
        this.headTarget = {
          rotate: headDrift + px * 3.5,
          tilt: headTiltDrift + py * 2.0,
        }
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
    // Expression frames crossfade slower than head tracking — avoids
    // snappy smile/mouth "swaps" when envelopes change.
    const kExpr =
      this.lastOpts.performanceMode === 'low'
        ? 0.07
        : this.lastOpts.performanceMode === 'high'
          ? 0.032
          : 0.045
    // Pose / silk sequence even slower — deliberate fabric motion
    const kPose = 0.018

    const next: Partial<MotionState> = {
      // Blinks stay hard — soft eyelids look broken
      blink,
      breath,
      headRotate: lerp(prev.headRotate, this.headTarget.rotate, k),
      headTilt: lerp(prev.headTilt, this.headTarget.tilt, k),
      gaze: {
        x: lerp(prev.gaze.x, this.gazeTarget.x, k),
        y: lerp(prev.gaze.y, this.gazeTarget.y, k),
      },
      mouth: lerp(prev.mouth, mouth, kExpr),
      expressionSmile: lerp(prev.expressionSmile, expressionSmile, kExpr),
      pose: lerp(prev.pose ?? 0, this.poseTarget, kPose),
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
