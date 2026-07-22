import type { PortraitTone } from '../types/portrait'

/** Named character beats — hold-heavy, tone-aware. */
export type MicroMomentId =
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
  // Seductive / salon life
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

export type MicroMoment = {
  id: MicroMomentId
  /** Hold duration ms */
  duration: [number, number]
  weight: number
  /** tones that use this beat more (multiplier) */
  toneBias?: Partial<Record<PortraitTone, number>>
  audio?: 'sigh' | 'cloth' | 'chime' | 'whoosh' | 'creak' | 'whisper'
}

export const MICRO_MOMENTS: MicroMoment[] = [
  {
    id: 'glance-left',
    duration: [1800, 3200],
    weight: 18,
  },
  {
    id: 'glance-right',
    duration: [1800, 3200],
    weight: 18,
  },
  {
    id: 'look-down',
    duration: [1400, 2400],
    weight: 9,
    toneBias: { seductive: 1.2 },
  },
  {
    id: 'long-stare',
    duration: [2800, 4500],
    weight: 10,
    toneBias: { creepy: 1.6, classic: 1.1, seductive: 0.7 },
  },
  {
    id: 'almost-speak',
    duration: [900, 1600],
    weight: 12,
    audio: 'sigh',
    toneBias: { seductive: 1.6, classic: 1.1 },
  },
  {
    id: 'soft-laugh',
    duration: [1400, 2400],
    weight: 10,
    audio: 'cloth',
    toneBias: { seductive: 1.8, classic: 0.9, creepy: 0.3 },
  },
  {
    id: 'startle',
    duration: [700, 1100],
    weight: 5,
    audio: 'whoosh',
    toneBias: { creepy: 1.8, seductive: 0.25 },
  },
  {
    id: 'pride',
    duration: [1600, 2600],
    weight: 7,
    audio: 'chime',
    toneBias: { classic: 1.4, seductive: 1.15 },
  },
  {
    id: 'bored',
    duration: [2200, 3800],
    weight: 8,
    toneBias: { classic: 1.2, creepy: 1.1, seductive: 0.35 },
  },
  {
    id: 'invitation',
    duration: [2000, 3400],
    weight: 8,
    audio: 'whisper',
    toneBias: { seductive: 2.4, creepy: 0.4, classic: 0.5 },
  },

  // ── Seductive emotional palette ─────────────────────────────────
  {
    id: 'coy-look',
    duration: [2200, 3800],
    weight: 11,
    audio: 'cloth',
    toneBias: { seductive: 2.6, classic: 0.35, creepy: 0.15 },
  },
  {
    id: 'slow-look-up',
    duration: [2400, 4000],
    weight: 10,
    audio: 'sigh',
    toneBias: { seductive: 2.5, classic: 0.3, creepy: 0.2 },
  },
  {
    id: 'sideways-glance',
    duration: [1800, 3000],
    weight: 12,
    toneBias: { seductive: 2.4, classic: 0.45, creepy: 0.2 },
  },
  {
    id: 'half-smile',
    duration: [2000, 3600],
    weight: 12,
    toneBias: { seductive: 2.5, classic: 0.55, creepy: 0.15 },
  },
  {
    id: 'sultry-stare',
    duration: [2600, 4200],
    weight: 11,
    audio: 'whisper',
    toneBias: { seductive: 2.7, classic: 0.25, creepy: 0.35 },
  },
  {
    id: 'wink-tease',
    duration: [900, 1400],
    weight: 7,
    audio: 'cloth',
    toneBias: { seductive: 2.2, classic: 0.4, creepy: 0.1 },
  },
  {
    id: 'lip-part',
    duration: [1200, 2200],
    weight: 11,
    audio: 'sigh',
    toneBias: { seductive: 2.5, classic: 0.4, creepy: 0.2 },
  },
  {
    id: 'languid-breath',
    duration: [2800, 4500],
    weight: 9,
    audio: 'cloth',
    toneBias: { seductive: 2.3, classic: 0.4, creepy: 0.15 },
  },
  {
    id: 'hair-toss',
    duration: [1600, 2600],
    weight: 8,
    audio: 'cloth',
    toneBias: { seductive: 2.1, classic: 0.5, creepy: 0.15 },
  },
  {
    id: 'come-hither',
    duration: [2200, 3600],
    weight: 10,
    audio: 'whisper',
    toneBias: { seductive: 2.6, classic: 0.2, creepy: 0.15 },
  },
  {
    id: 'shy-away',
    duration: [1600, 2800],
    weight: 9,
    toneBias: { seductive: 2.0, classic: 0.55, creepy: 0.25 },
  },
  {
    id: 'smolder',
    duration: [3000, 4800],
    weight: 10,
    toneBias: { seductive: 2.4, classic: 0.2, creepy: 0.3 },
  },
  {
    id: 'silk-reveal',
    // Long hold — progressive pose frames animate slowly
    duration: [9000, 14000],
    weight: 8,
    audio: 'cloth',
    toneBias: { seductive: 2.8, classic: 0.05, creepy: 0.05 },
  },
]

export function pickMicroMoment(tone: PortraitTone): MicroMoment {
  let total = 0
  const weights = MICRO_MOMENTS.map((m) => {
    const w = m.weight * (m.toneBias?.[tone] ?? 1)
    total += w
    return w
  })
  let r = Math.random() * total
  for (let i = 0; i < MICRO_MOMENTS.length; i++) {
    r -= weights[i]
    if (r <= 0) return MICRO_MOMENTS[i]
  }
  return MICRO_MOMENTS[0]
}
