import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

/**
 * Mixamo-style animation pack: load clips from free Mixamo-rigged GLBs
 * (Xbot / Soldier) and retarget onto RPM / AvatarSDK skeletons that share
 * the same bone *names* without the `mixamorig:` prefix.
 *
 * Pipeline for your own Mixamo downloads:
 * 1. mixamo.com → character T-pose + animations (FBX)
 * 2. Blender import → export GLB (skin + actions)
 * 3. Drop into public/models/mixamo/ and list in PACK_SOURCES
 */

/** Built-in free sources already in the repo (Mixamo-compatible rigs). */
export const PACK_SOURCES = [
  '/models/Xbot.glb',
  '/models/Soldier.glb',
] as const

/** Prefer these as looping portrait idles (order = cycle order). */
export const IDLE_CLIP_PREFS = [
  'idle',
  'Idle',
  'standing',
  'Standing',
  'happy idle',
  'breathing',
] as const

/** One-shot / ambient gesture clips for moments. */
export const GESTURE_CLIP_PREFS = [
  'agree',
  'headShake',
  'headshake',
  'Yes',
  'Wave',
  'ThumbsUp',
  'No',
  'sad_pose',
  'sneak_pose',
] as const

let packCache: THREE.AnimationClip[] | null = null
let packPromise: Promise<THREE.AnimationClip[]> | null = null

function normalizeBoneKey(name: string): string {
  return name
    .replace(/^mixamorig:/i, '')
    .replace(/^mixamorig/i, '')
    .replace(/[\s_.:-]+/g, '')
    .toLowerCase()
}

/** Map normalized bone key → actual Object3D name on target. */
function buildBoneNameMap(root: THREE.Object3D): Map<string, string> {
  const map = new Map<string, string>()
  root.traverse((c) => {
    if (!c.name) return
    const key = normalizeBoneKey(c.name)
    // Prefer Bone nodes when duplicates exist
    if (!map.has(key) || (c as THREE.Bone).isBone) {
      map.set(key, c.name)
    }
  })
  return map
}

/**
 * Retarget a Mixamo clip onto a target humanoid by rewriting track names.
 * Quaternion tracks always; position only for Hips (scaled).
 */
export function retargetClip(
  clip: THREE.AnimationClip,
  boneMap: Map<string, string>,
  positionScale = 1,
): THREE.AnimationClip | null {
  const tracks: THREE.KeyframeTrack[] = []

  for (const track of clip.tracks) {
    // e.g. "mixamorig:Hips.quaternion" or "mixamorig:LeftArm.position"
    const dot = track.name.lastIndexOf('.')
    if (dot < 0) continue
    const rawBone = track.name.slice(0, dot)
    const prop = track.name.slice(dot + 1)
    const key = normalizeBoneKey(rawBone)
    const targetBone = boneMap.get(key)
    if (!targetBone) continue

    if (prop === 'position') {
      // Only hips translation — avoids stretching limbs across different proportions
      if (!/hips|pelvis/i.test(key)) continue
      const t = track.clone()
      t.name = `${targetBone}.position`
      if (positionScale !== 1 && t.values) {
        for (let i = 0; i < t.values.length; i++) {
          t.values[i] *= positionScale
        }
      }
      tracks.push(t)
      continue
    }

    if (prop === 'quaternion' || prop === 'rotation') {
      const t = track.clone()
      t.name = `${targetBone}.${prop === 'rotation' ? 'quaternion' : prop}`
      // If source used .rotation euler tracks, skip (rare in glTF)
      if (prop === 'rotation') continue
      tracks.push(t)
      continue
    }

    // scale tracks usually skip
  }

  if (!tracks.length) return null
  return new THREE.AnimationClip(clip.name, clip.duration, tracks)
}

export function retargetClipsToModel(
  clips: THREE.AnimationClip[],
  model: THREE.Object3D,
  positionScale = 1,
): THREE.AnimationClip[] {
  const boneMap = buildBoneNameMap(model)
  const out: THREE.AnimationClip[] = []
  for (const clip of clips) {
    const r = retargetClip(clip, boneMap, positionScale)
    if (r) out.push(r)
  }
  return out
}

function loadGltf(url: string): Promise<THREE.AnimationClip[]> {
  const loader = new GLTFLoader()
  return new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => resolve(gltf.animations?.slice() ?? []),
      undefined,
      (err) => {
        console.warn('[mixamoAnimPack] failed', url, err)
        resolve([])
      },
    )
  })
}

/**
 * Load and cache animation clips from PACK_SOURCES (deduped by name).
 */
export async function loadMixamoAnimPack(
  baseUrl = import.meta.env.BASE_URL || '/',
  sources: readonly string[] = PACK_SOURCES,
): Promise<THREE.AnimationClip[]> {
  if (packCache) return packCache
  if (packPromise) return packPromise

  const root = baseUrl.replace(/\/?$/, '/')
  packPromise = (async () => {
    const all: THREE.AnimationClip[] = []
    const seen = new Set<string>()
    for (const src of sources) {
      const url = src.startsWith('http')
        ? src
        : `${root}${src.replace(/^\//, '')}`
      const clips = await loadGltf(url)
      for (const c of clips) {
        const key = c.name.toLowerCase()
        if (seen.has(key)) continue
        // Skip pure T-pose bind clips
        if (/tpose|t-pose|bind/i.test(c.name)) continue
        seen.add(key)
        all.push(c)
      }
    }
    packCache = all
    console.info(
      '[mixamoAnimPack] loaded',
      all.map((c) => c.name),
    )
    return all
  })()

  return packPromise
}

export function pickIdleClips(
  available: THREE.AnimationClip[],
): THREE.AnimationClip[] {
  const lower = available.map((c) => ({ c, n: c.name.toLowerCase() }))
  const idles: THREE.AnimationClip[] = []
  for (const pref of IDLE_CLIP_PREFS) {
    const p = pref.toLowerCase()
    const hit = lower.find(
      ({ n, c }) =>
        (n === p || n.includes(p)) && !idles.includes(c),
    )
    if (hit) idles.push(hit.c)
  }
  // Also include gentle gesture loops as ambient idles
  for (const pref of ['agree', 'headshake', 'sad_pose']) {
    const hit = lower.find(
      ({ n, c }) => n.includes(pref) && !idles.includes(c),
    )
    if (hit && idles.length < 5) idles.push(hit.c)
  }
  if (!idles.length && available.length) idles.push(available[0])
  return idles
}

/**
 * Crossfade through multiple idle actions smoothly.
 */
export class IdleClipCycle {
  private mixer: THREE.AnimationMixer
  private actions: THREE.AnimationAction[] = []
  private index = 0
  private nextAt = 0
  private current: THREE.AnimationAction | null = null

  constructor(
    mixer: THREE.AnimationMixer,
    idleClips: THREE.AnimationClip[],
    opts: { timeScale?: number } = {},
  ) {
    this.mixer = mixer
    const ts = opts.timeScale ?? 0.75
    for (const clip of idleClips) {
      const a = mixer.clipAction(clip)
      a.setLoop(THREE.LoopRepeat, Infinity)
      a.clampWhenFinished = false
      a.setEffectiveTimeScale(ts)
      a.setEffectiveWeight(0)
      a.play()
      this.actions.push(a)
    }
    if (this.actions.length) {
      this.current = this.actions[0]
      this.current.setEffectiveWeight(1)
      this.nextAt = performance.now() + this.holdMs()
    }
  }

  private holdMs() {
    return 4500 + Math.random() * 4000
  }

  get active() {
    return this.actions.length > 0
  }

  /** Fade to a gesture, then return to idle cycle. */
  playGesture(clip: THREE.AnimationClip, fade = 0.45): THREE.AnimationAction {
    const action = this.mixer.clipAction(clip)
    action.reset()
    action.setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true
    action.setEffectiveTimeScale(0.85)
    if (this.current) this.current.fadeOut(fade)
    for (const a of this.actions) {
      if (a !== this.current) a.setEffectiveWeight(0)
    }
    action.fadeIn(fade)
    action.play()
    const onDone = () => {
      this.mixer.removeEventListener('finished', onDone as any)
      action.fadeOut(fade)
      if (this.current) {
        this.current.reset()
        this.current.fadeIn(fade)
        this.current.play()
      }
      this.nextAt = performance.now() + this.holdMs()
    }
    // finished event passes { action, direction }
    const handler = (e: { action: THREE.AnimationAction }) => {
      if (e.action === action) {
        this.mixer.removeEventListener('finished', handler as any)
        onDone()
      }
    }
    this.mixer.addEventListener('finished', handler as any)
    // Safety timeout if event missing
    window.setTimeout(() => {
      if (action.isRunning() && action.time >= clip.duration - 0.05) {
        handler({ action })
      }
    }, (clip.duration + 1) * 1000)
    return action
  }

  update(now: number) {
    if (this.actions.length < 2) return
    if (now < this.nextAt) return
    const next = (this.index + 1) % this.actions.length
    const fade = 0.9 + Math.random() * 0.5
    const prev = this.actions[this.index]
    const nxt = this.actions[next]
    prev.fadeOut(fade)
    nxt.reset()
    nxt.fadeIn(fade)
    nxt.play()
    this.current = nxt
    this.index = next
    this.nextAt = now + this.holdMs() + fade * 1000
  }

  stop() {
    for (const a of this.actions) a.stop()
  }
}
