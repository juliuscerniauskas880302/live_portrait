import type { PortraitId } from '../types/portrait'

export type Model3dEntry = {
  file: string
  label: string
  rig?: string
  portraitIds?: PortraitId[]
  notes?: string
}

export type Model3dManifest = {
  version: number
  models: Record<string, Model3dEntry>
}

let cached: Model3dManifest | null = null

/**
 * Load public/models/manifest.json (cached).
 * Used for settings UI and tooling; portrait defs still own model3d paths.
 */
export async function loadModel3dManifest(
  baseUrl = import.meta.env.BASE_URL || '/',
): Promise<Model3dManifest | null> {
  if (cached) return cached
  const url = `${baseUrl.replace(/\/?$/, '/')}models/manifest.json`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    cached = (await res.json()) as Model3dManifest
    return cached
  } catch {
    return null
  }
}

/** Portrait ids that ship with a 3D model (from data, not only manifest). */
export function portraitIdsWithModel3d(
  portraits: Record<string, { model3d?: string; id: string }>,
): string[] {
  return Object.values(portraits)
    .filter((p) => !!p.model3d)
    .map((p) => p.id)
}
