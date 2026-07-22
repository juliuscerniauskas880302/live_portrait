/**
 * Maps motion-director moments / gestures → preferred glTF animation clip names.
 * First match among the model's available clips wins (case-insensitive substring).
 *
 * Add new motions by:
 * 1. Export a short clip on your character rig (Blender / Mixamo)
 * 2. Append a preferred name here (or per-portrait model3dClipMap)
 * 3. No image generation required
 */

export type Model3dCue =
  | 'idle'
  | 'acknowledge'
  | 'wink'
  // Micro-moment ids (keep in sync with microMoments.ts)
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

/** Ordered preferences: first name that matches a clip on the GLB is used. */
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

export type ClipMapOverride = Partial<Record<Model3dCue, string[]>>

/**
 * Resolve which AnimationClip to play for a director cue.
 * @param availableClips clips embedded in the loaded GLB
 * @param cue motion cue from director / acknowledge
 * @param override optional per-portrait preferences
 */
export function resolveClipName(
  availableClips: { name: string }[],
  cue: Model3dCue | string,
  override?: ClipMapOverride,
): string | null {
  if (!availableClips.length) return null
  const prefs =
    (override?.[cue as Model3dCue] as string[] | undefined) ??
    DEFAULT_CLIP_PREFERENCES[cue as Model3dCue] ??
    [cue]

  const names = availableClips.map((c) => c.name)
  const lower = names.map((n) => n.toLowerCase())

  for (const pref of prefs) {
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
