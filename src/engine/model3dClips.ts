/**
 * Maps motion-director moments / gestures → preferred glTF animation clip names.
 * First match among the model's available clips wins (case-insensitive substring).
 *
 * Add new motions by:
 * 1. Export a short clip on your character rig (Blender / Mixamo)
 * 2. Edit public/models/clip-map.json (no TypeScript rebuild needed for prefs)
 *    and/or PortraitDef.model3dClipMap
 */

export type Model3dCue =
  | 'idle'
  | 'acknowledge'
  | 'wink'
  | 'glance-left'
  | 'glance-right'
  | 'look-down'
  | 'long-stare'
  | 'almost-speak'
  | 'soft-laugh'
  | 'startle'
  | 'pride'
  | 'bored'
  | 'invitation'
  | 'coy-look'
  | 'slow-look-up'
  | 'sideways-glance'
  | 'half-smile'
  | 'sultry-stare'
  | 'wink-tease'
  | 'lip-part'
  | 'languid-breath'
  | 'hair-toss'
  | 'come-hither'
  | 'shy-away'
  | 'smolder'
  | 'silk-reveal'

/** Built-in defaults (overridden by clip-map.json + per-portrait map). */
export const DEFAULT_CLIP_PREFERENCES: Record<Model3dCue, string[]> = {
  idle: ['idle', 'stand', 'breath', 'tpose', 't-pose'],
  acknowledge: ['agree', 'nod', 'bow', 'wave', 'hello'],
  wink: ['wink', 'agree', 'headshake'],

  'glance-left': ['headshake', 'look', 'turn', 'idle'],
  'glance-right': ['headshake', 'look', 'turn', 'idle'],
  'look-down': ['sad_pose', 'sad', 'headshake', 'idle'],
  'long-stare': ['idle', 'stand'],
  'almost-speak': ['agree', 'talk', 'speak', 'idle'],
  'soft-laugh': ['agree', 'happy', 'idle'],
  startle: ['sneak_pose', 'run', 'headshake'],
  pride: ['agree', 'idle'],
  bored: ['sad_pose', 'idle', 'headshake'],
  invitation: ['agree', 'wave', 'idle'],

  'coy-look': ['headshake', 'sneak_pose', 'idle'],
  'slow-look-up': ['agree', 'idle'],
  'sideways-glance': ['headshake', 'look', 'idle'],
  'half-smile': ['agree', 'idle'],
  'sultry-stare': ['idle', 'stand'],
  'wink-tease': ['agree', 'wink', 'headshake'],
  'lip-part': ['agree', 'talk', 'idle'],
  'languid-breath': ['idle', 'breath'],
  'hair-toss': ['headshake', 'agree'],
  'come-hither': ['agree', 'wave', 'idle'],
  'shy-away': ['sad_pose', 'headshake', 'sneak_pose'],
  smolder: ['idle', 'sneak_pose'],
  'silk-reveal': ['sneak_pose', 'sad_pose', 'agree', 'idle'],
}

export type ClipMapOverride = Partial<Record<string, string[]>>

/** Runtime JSON overlay (loaded once from /models/clip-map.json). */
let jsonClipMap: ClipMapOverride | null = null
let jsonLoadPromise: Promise<ClipMapOverride> | null = null

function isCueKey(k: string): boolean {
  return k in DEFAULT_CLIP_PREFERENCES || !k.startsWith('$')
}

/**
 * Load public/models/clip-map.json (cached). Safe to call every portrait mount.
 */
export async function loadClipMapJson(
  baseUrl = import.meta.env.BASE_URL || '/',
): Promise<ClipMapOverride> {
  if (jsonClipMap) return jsonClipMap
  if (jsonLoadPromise) return jsonLoadPromise

  const url = `${baseUrl.replace(/\/?$/, '/') }models/clip-map.json`
  jsonLoadPromise = fetch(url)
    .then(async (res) => {
      if (!res.ok) throw new Error(`clip-map ${res.status}`)
      const raw = (await res.json()) as Record<string, unknown>
      const map: ClipMapOverride = {}
      for (const [k, v] of Object.entries(raw)) {
        if (!isCueKey(k)) continue
        if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
          map[k] = v as string[]
        }
      }
      jsonClipMap = map
      return map
    })
    .catch((err) => {
      console.warn('[model3dClips] clip-map.json not loaded, using defaults', err)
      jsonClipMap = {}
      return jsonClipMap
    })

  return jsonLoadPromise
}

/** Merge defaults ← JSON file ← per-portrait override. */
export function mergeClipPreferences(
  portraitOverride?: ClipMapOverride,
): ClipMapOverride {
  const merged: ClipMapOverride = { ...DEFAULT_CLIP_PREFERENCES }
  if (jsonClipMap) {
    for (const [k, v] of Object.entries(jsonClipMap)) {
      if (v?.length) merged[k] = v
    }
  }
  if (portraitOverride) {
    for (const [k, v] of Object.entries(portraitOverride)) {
      if (v?.length) merged[k] = v
    }
  }
  return merged
}

/**
 * Resolve which AnimationClip name to play for a director cue.
 */
export function resolveClipName(
  availableClips: { name: string }[],
  cue: Model3dCue | string,
  override?: ClipMapOverride,
): string | null {
  if (!availableClips.length) return null
  const prefs = mergeClipPreferences(override)
  const list = prefs[cue] ?? prefs[cue as Model3dCue] ?? [cue]

  const names = availableClips.map((c) => c.name)
  const lower = names.map((n) => n.toLowerCase())

  for (const pref of list) {
    const p = pref.toLowerCase()
    const exact = lower.indexOf(p)
    if (exact >= 0) return names[exact]
    const partial = lower.findIndex((n) => n.includes(p) || p.includes(n))
    if (partial >= 0) return names[partial]
  }
  return null
}

export function listClipNames(clips: { name: string }[]): string[] {
  return clips.map((c) => c.name)
}

/** Standard morph target name fragments for face life. */
export const MORPH_GROUPS = {
  blink: [
    'blink',
    'eyesclosed',
    'eyeblinkleft',
    'eyeblinkright',
    'eye_blink',
    'eyes_closed',
  ],
  smile: ['smile', 'mouthsmile', 'happy', 'mouth_smile', 'joy'],
  mouth: [
    'mouthopen',
    'jawopen',
    'viseme_aa',
    'mouth_open',
    'jaw_open',
    'a',
    'ah',
  ],
} as const
