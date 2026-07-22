/**
 * Phase-6: per-portrait 3D look overrides (runtime JSON).
 * Edit public/models/portrait-looks.json without rebuilding TypeScript.
 */

export type PortraitLook = {
  /** Soft oil face cameo on head (identity) */
  identityFace?: boolean
  identityFaceOpacity?: number
  /** 0–1 strength of skin/hair/robe palette tint */
  paletteStrength?: number
  /** Hide glasses meshes when present */
  hideGlasses?: boolean
  /** Multiplier on idle sway amount */
  sway?: number
  /** Optional model path override */
  model3d?: string
}

type LooksFile = {
  defaults?: PortraitLook
  portraits?: Record<string, PortraitLook>
}

const FALLBACK: Required<
  Pick<
    PortraitLook,
    | 'identityFace'
    | 'identityFaceOpacity'
    | 'paletteStrength'
    | 'hideGlasses'
    | 'sway'
  >
> = {
  identityFace: true,
  identityFaceOpacity: 0.42,
  paletteStrength: 0.72,
  hideGlasses: true,
  sway: 1,
}

let cached: LooksFile | null = null
let loadPromise: Promise<LooksFile> | null = null

export async function loadPortraitLooks(
  baseUrl = import.meta.env.BASE_URL || '/',
): Promise<LooksFile> {
  if (cached) return cached
  if (loadPromise) return loadPromise
  const url = `${baseUrl.replace(/\/?$/, '/')}models/portrait-looks.json`
  loadPromise = fetch(url)
    .then(async (res) => {
      if (!res.ok) throw new Error(String(res.status))
      cached = (await res.json()) as LooksFile
      return cached
    })
    .catch((err) => {
      console.warn('[portraitLooks] using built-in defaults', err)
      cached = { defaults: { ...FALLBACK }, portraits: {} }
      return cached
    })
  return loadPromise
}

export function resolvePortraitLook(
  portraitId: string,
  file?: LooksFile | null,
): Required<
  Pick<
    PortraitLook,
    | 'identityFace'
    | 'identityFaceOpacity'
    | 'paletteStrength'
    | 'hideGlasses'
    | 'sway'
  >
> &
  PortraitLook {
  const d = { ...FALLBACK, ...(file?.defaults ?? {}) }
  const p = file?.portraits?.[portraitId] ?? {}
  return {
    identityFace: p.identityFace ?? d.identityFace ?? true,
    identityFaceOpacity:
      p.identityFaceOpacity ?? d.identityFaceOpacity ?? 0.42,
    paletteStrength: p.paletteStrength ?? d.paletteStrength ?? 0.72,
    hideGlasses: p.hideGlasses ?? d.hideGlasses ?? true,
    sway: p.sway ?? d.sway ?? 1,
    model3d: p.model3d,
  }
}

/** Hide accessory meshes (glasses, etc.) for cleaner portrait framing. */
export function hideNamedMeshes(
  root: import('three').Object3D,
  patterns: RegExp[],
) {
  root.traverse((c) => {
    const n = c.name.toLowerCase()
    if (patterns.some((re) => re.test(n))) {
      c.visible = false
    }
  })
}
