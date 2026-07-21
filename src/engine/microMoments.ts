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
    weight: 22,
  },
  {
    id: 'glance-right',
    duration: [1800, 3200],
    weight: 22,
  },
  {
    id: 'look-down',
    duration: [1400, 2400],
    weight: 10,
  },
  {
    id: 'long-stare',
    duration: [2800, 4500],
    weight: 12,
    toneBias: { creepy: 1.6, classic: 1.1 },
  },
  {
    id: 'almost-speak',
    duration: [900, 1600],
    weight: 14,
    audio: 'sigh',
    toneBias: { seductive: 1.3, classic: 1.1 },
  },
  {
    id: 'soft-laugh',
    duration: [1400, 2400],
    weight: 10,
    audio: 'cloth',
    toneBias: { seductive: 1.5, classic: 0.9, creepy: 0.3 },
  },
  {
    id: 'startle',
    duration: [700, 1100],
    weight: 6,
    audio: 'whoosh',
    toneBias: { creepy: 1.8 },
  },
  {
    id: 'pride',
    duration: [1600, 2600],
    weight: 8,
    audio: 'chime',
    toneBias: { classic: 1.4, seductive: 1.1 },
  },
  {
    id: 'bored',
    duration: [2200, 3800],
    weight: 9,
    toneBias: { classic: 1.2, creepy: 1.1 },
  },
  {
    id: 'invitation',
    duration: [2000, 3400],
    weight: 7,
    audio: 'whisper',
    toneBias: { seductive: 2.0, creepy: 0.4 },
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
