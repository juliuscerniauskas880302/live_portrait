import * as THREE from 'three'

/**
 * Procedural multi-idle for humanoids that ship without animation clips
 * (Ready Player Me / AvatarSDK often arrive in T-pose).
 *
 * Captures rest quaternions, then blends through several relaxed idle poses
 * with smooth crossfades + continuous breath.
 */

export type IdleBoneMap = {
  hips?: THREE.Object3D
  spine?: THREE.Object3D
  spine1?: THREE.Object3D
  spine2?: THREE.Object3D
  neck?: THREE.Object3D
  head?: THREE.Object3D
  leftShoulder?: THREE.Object3D
  leftArm?: THREE.Object3D
  leftForeArm?: THREE.Object3D
  leftHand?: THREE.Object3D
  rightShoulder?: THREE.Object3D
  rightArm?: THREE.Object3D
  rightForeArm?: THREE.Object3D
  rightHand?: THREE.Object3D
}

/** Euler offsets in degrees applied on top of rest pose (local YXZ). */
type PoseOffsets = Partial<
  Record<keyof IdleBoneMap, { x?: number; y?: number; z?: number }>
>

const POSES: { name: string; hold: [number, number]; offsets: PoseOffsets }[] =
  [
    {
      name: 'rest',
      hold: [4.5, 7.5],
      offsets: {
        // Arms down from T-pose into a natural hanging rest
        leftArm: { z: 70, x: 8, y: 6 },
        rightArm: { z: -70, x: 8, y: -6 },
        leftForeArm: { x: -12 },
        rightForeArm: { x: -12 },
        leftShoulder: { z: 8 },
        rightShoulder: { z: -8 },
        spine: { x: 4 },
        spine1: { x: 2 },
        hips: { y: 0 },
      },
    },
    {
      name: 'weight-left',
      hold: [3.5, 6],
      offsets: {
        leftArm: { z: 62, x: 10, y: 10 },
        rightArm: { z: -75, x: 6, y: -4 },
        leftForeArm: { x: -18 },
        rightForeArm: { x: -8 },
        hips: { y: 6, z: 3 },
        spine: { x: 5, y: -4 },
        spine1: { y: -3, x: 2 },
        neck: { y: 4 },
      },
    },
    {
      name: 'weight-right',
      hold: [3.5, 6],
      offsets: {
        leftArm: { z: 75, x: 6, y: 4 },
        rightArm: { z: -62, x: 10, y: -10 },
        leftForeArm: { x: -8 },
        rightForeArm: { x: -18 },
        hips: { y: -6, z: -3 },
        spine: { x: 5, y: 4 },
        spine1: { y: 3, x: 2 },
        neck: { y: -4 },
      },
    },
    {
      name: 'think',
      hold: [3, 5],
      offsets: {
        leftArm: { z: 55, x: 25, y: 20 },
        rightArm: { z: -72, x: 5, y: -5 },
        leftForeArm: { x: -55, y: 15 },
        rightForeArm: { x: -10 },
        spine: { x: 6, y: 5 },
        spine1: { x: 4, y: 4 },
        neck: { x: 6, y: 8 },
        head: { x: 4, y: 6 },
      },
    },
    {
      name: 'open',
      hold: [3, 5.5],
      offsets: {
        leftArm: { z: 58, x: 12, y: 18 },
        rightArm: { z: -58, x: 12, y: -18 },
        leftForeArm: { x: -15 },
        rightForeArm: { x: -15 },
        spine: { x: 3 },
        spine1: { x: 2 },
        neck: { x: -2 },
        head: { x: -3 },
      },
    },
    {
      name: 'shy',
      hold: [3, 5],
      offsets: {
        leftArm: { z: 78, x: 5, y: 2 },
        rightArm: { z: -65, x: 15, y: -25 },
        rightForeArm: { x: -40, y: -10 },
        hips: { y: -4 },
        spine: { x: 8, y: -6 },
        spine1: { x: 4, y: -4 },
        neck: { x: 8, y: -10 },
        head: { x: 6, y: -8 },
      },
    },
  ]

function rand(a: number, b: number) {
  return a + Math.random() * (b - a)
}

function findBone(
  root: THREE.Object3D,
  names: string[],
): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined
  root.traverse((c) => {
    if (found) return
    const n = c.name.toLowerCase().replace(/[\s_.:-]+/g, '')
    if (names.some((x) => n === x || n.endsWith(x) || n.includes(x))) {
      // Prefer exact-ish bone nodes over mesh names
      if ((c as THREE.Bone).isBone || c.type === 'Bone' || c.children.length) {
        found = c
      } else if (!found) {
        found = c
      }
    }
  })
  return found
}

export function collectIdleBones(root: THREE.Object3D): IdleBoneMap {
  return {
    hips: findBone(root, ['hips', 'hip', 'pelvis']),
    spine: findBone(root, ['spine', 'spine0']),
    spine1: findBone(root, ['spine1', 'spine_01', 'chest']),
    spine2: findBone(root, ['spine2', 'spine_02', 'upperchest', 'spine3']),
    neck: findBone(root, ['neck']),
    head: findBone(root, ['head']),
    leftShoulder: findBone(root, ['leftshoulder', 'l_shoulder']),
    leftArm: findBone(root, ['leftarm', 'leftupperarm', 'l_upperarm', 'upperarm_l']),
    leftForeArm: findBone(root, [
      'leftforearm',
      'leftlowerarm',
      'l_lowerarm',
      'lowerarm_l',
    ]),
    leftHand: findBone(root, ['lefthand', 'l_hand', 'hand_l']),
    rightShoulder: findBone(root, ['rightshoulder', 'r_shoulder']),
    rightArm: findBone(root, [
      'rightarm',
      'rightupperarm',
      'r_upperarm',
      'upperarm_r',
    ]),
    rightForeArm: findBone(root, [
      'rightforearm',
      'rightlowerarm',
      'r_lowerarm',
      'lowerarm_r',
    ]),
    rightHand: findBone(root, ['righthand', 'r_hand', 'hand_r']),
  }
}

export class IdlePoseSystem {
  private bones: IdleBoneMap
  private rest = new Map<string, THREE.Quaternion>()
  private fromPose = 0
  private toPose = 0
  private blend = 1
  private blendDuration = 1.8
  private blendElapsed = 1.8
  private holdUntil = 0
  private enabled: boolean
  private keys: (keyof IdleBoneMap)[]

  constructor(root: THREE.Object3D) {
    this.bones = collectIdleBones(root)
    this.keys = (
      Object.keys(this.bones) as (keyof IdleBoneMap)[]
    ).filter((k) => !!this.bones[k])

    for (const k of this.keys) {
      const b = this.bones[k]!
      this.rest.set(k, b.quaternion.clone())
    }

    // Need at least arms to fix T-pose
    this.enabled = !!(this.bones.leftArm && this.bones.rightArm)
    this.fromPose = 0
    this.toPose = 0
    this.blend = 1
    this.holdUntil = performance.now() + rand(2000, 4000)
  }

  get active() {
    return this.enabled
  }

  private samplePose(index: number): Map<string, THREE.Euler> {
    const pose = POSES[index % POSES.length]
    const map = new Map<string, THREE.Euler>()
    for (const k of this.keys) {
      const o = pose.offsets[k] ?? {}
      map.set(
        k,
        new THREE.Euler(
          THREE.MathUtils.degToRad(o.x ?? 0),
          THREE.MathUtils.degToRad(o.y ?? 0),
          THREE.MathUtils.degToRad(o.z ?? 0),
          'YXZ',
        ),
      )
    }
    return map
  }

  private pickNextPose(exclude: number) {
    if (POSES.length < 2) return 0
    let i = exclude
    let guard = 0
    while (i === exclude && guard++ < 8) {
      i = Math.floor(Math.random() * POSES.length)
    }
    return i
  }

  /**
   * Apply blended idle. Call BEFORE director head overrides if head is shared —
   * or call after and let head director win (we skip head if director drives it).
   */
  update(
    nowMs: number,
    dt: number,
    opts: {
      breath?: number
      sway?: number
      /** When true, don't write head (motion director owns it) */
      skipHead?: boolean
    } = {},
  ) {
    if (!this.enabled) return

    const breath = opts.breath ?? 0
    const sway = opts.sway ?? 1

    // Hold → crossfade → hold
    if (this.blend >= 1 && nowMs >= this.holdUntil) {
      this.fromPose = this.toPose
      this.toPose = this.pickNextPose(this.fromPose)
      this.blend = 0
      this.blendElapsed = 0
      this.blendDuration = rand(1.6, 2.8)
      const hold = POSES[this.toPose].hold
      this.holdUntil = nowMs + this.blendDuration * 1000 + rand(hold[0], hold[1]) * 1000
    }

    if (this.blend < 1) {
      this.blendElapsed += dt
      // Smoothstep crossfade
      const t = Math.min(1, this.blendElapsed / this.blendDuration)
      this.blend = t * t * (3 - 2 * t)
    }

    const A = this.samplePose(this.fromPose)
    const B = this.samplePose(this.toPose)
    const qA = new THREE.Quaternion()
    const qB = new THREE.Quaternion()
    const qOff = new THREE.Quaternion()
    const e = new THREE.Euler()

    for (const k of this.keys) {
      if (opts.skipHead && k === 'head') continue
      const bone = this.bones[k]
      const restQ = this.rest.get(k)
      if (!bone || !restQ) continue

      const eA = A.get(k)!
      const eB = B.get(k)!
      e.set(
        eA.x + (eB.x - eA.x) * this.blend,
        eA.y + (eB.y - eA.y) * this.blend,
        eA.z + (eB.z - eA.z) * this.blend,
        'YXZ',
      )

      // Continuous breath on spine chain
      if (k === 'spine' || k === 'spine1' || k === 'spine2') {
        e.x += breath * 0.04 * (k === 'spine' ? 1 : 0.6)
      }
      // Soft ambient sway on hips
      if (k === 'hips') {
        e.y += Math.sin(nowMs * 0.0011) * 0.03 * sway
        e.z += Math.sin(nowMs * 0.0007) * 0.02 * sway
      }

      qOff.setFromEuler(e)
      bone.quaternion.copy(restQ).multiply(qOff)
    }

    void qA
    void qB
  }

  /** One-shot lean toward a moment (glance, etc.) without killing idle. */
  nudgeFromMoment(momentId: string | null) {
    if (!momentId || !this.enabled) return
    // Force a matching pose family soon
    const map: Record<string, number> = {
      'coy-look': 5,
      'shy-away': 5,
      pride: 4,
      invitation: 4,
      bored: 1,
      'look-down': 5,
      'half-smile': 0,
      acknowledge: 4,
    }
    const idx = map[momentId]
    if (idx == null) return
    this.fromPose = this.toPose
    this.toPose = idx
    this.blend = 0
    this.blendElapsed = 0
    this.blendDuration = 1.2
    this.holdUntil = performance.now() + 2800
  }
}
