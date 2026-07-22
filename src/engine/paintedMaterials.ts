import * as THREE from 'three'
import { MORPH_GROUPS } from './model3dClips'

/**
 * Phase-2/3 painted materials: gentle in-place oil grade + head face card.
 * Does NOT replace materials (replacing SkinnedMesh materials often
 * yields invisible / black characters on some GPUs).
 */

export type MorphMesh = {
  mesh: THREE.Mesh
  influences: number[]
  dictionary: Record<string, number>
}

export function collectMorphMeshes(root: THREE.Object3D): MorphMesh[] {
  const out: MorphMesh[] = []
  root.traverse((c) => {
    const mesh = c as THREE.Mesh
    if (
      mesh.isMesh &&
      mesh.morphTargetDictionary &&
      mesh.morphTargetInfluences
    ) {
      out.push({
        mesh,
        influences: mesh.morphTargetInfluences,
        dictionary: mesh.morphTargetDictionary,
      })
    }
  })
  return out
}

export function setMorphGroup(
  morphs: MorphMesh[],
  group: keyof typeof MORPH_GROUPS,
  value: number,
) {
  const keys = MORPH_GROUPS[group]
  const v = Math.max(0, Math.min(1, value))
  for (const { dictionary, influences } of morphs) {
    for (const [name, idx] of Object.entries(dictionary)) {
      const n = name.toLowerCase().replace(/[\s_-]+/g, '')
      if (keys.some((k) => n.includes(k.replace(/[\s_-]+/g, '')))) {
        influences[idx] = v
      }
    }
  }
}

/** Detect Ready Player Me / AvatarSDK / VRoid-style textured humans. */
export function detectRealisticModel(root: THREE.Object3D): boolean {
  let hits = 0
  root.traverse((c) => {
    const mesh = c as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      if (!m) continue
      const n = (m.name || mesh.name || '').toLowerCase()
      if (
        /wolf3d|avatarbody|avatarhead|outfit_|skin|rpm|vroid|fcl_|body_00/i.test(
          n,
        )
      ) {
        hits++
      }
      const std = m as THREE.MeshStandardMaterial
      if (std.map && std.map.image) hits++
    }
  })
  return hits >= 2
}

/**
 * In-place material tweak. Keeps original instances so skinning + textures work.
 * `mode: 'realistic'` preserves baked textures; only soft warmth.
 * `mode: 'stylized'` stronger oil grade (sample robots/soldiers).
 */
export function applyPaintedMaterials(
  root: THREE.Object3D,
  opts: {
    accent?: string
    paintMap?: THREE.Texture | null
    paintStrength?: number
    mode?: 'realistic' | 'stylized'
  } = {},
) {
  const accent = new THREE.Color(opts.accent ?? '#c9a227')
  const mode = opts.mode ?? 'stylized'
  const paintStrength =
    opts.paintStrength ?? (mode === 'realistic' ? 0 : 0.15)
  const paintMap = opts.paintMap ?? null
  const realistic = mode === 'realistic'

  root.traverse((c) => {
    const mesh = c as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.frustumCulled = false
    mesh.visible = true
    mesh.castShadow = false
    mesh.receiveShadow = false

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      if (!m) continue
      const mat = m as THREE.MeshStandardMaterial

      mat.visible = true
      mat.depthWrite = true
      // Realistic skins often need FrontSide; DoubleSide can flash
      mat.side = realistic ? THREE.FrontSide : THREE.DoubleSide
      if (mat.transparent && (mat.opacity ?? 1) > 0.98) {
        mat.transparent = false
        mat.opacity = 1
      }

      if ('metalness' in mat && typeof mat.metalness === 'number') {
        mat.metalness = Math.min(
          mat.metalness,
          realistic ? 0.35 : 0.2,
        )
      }
      if ('roughness' in mat && typeof mat.roughness === 'number') {
        mat.roughness = realistic
          ? THREE.MathUtils.clamp(mat.roughness, 0.35, 0.9)
          : Math.max(mat.roughness, 0.55)
      }
      if ('envMapIntensity' in mat && typeof mat.envMapIntensity === 'number') {
        mat.envMapIntensity = realistic ? 0.65 : 0.4
      }

      if ('color' in mat && mat.color && mat.color.isColor) {
        if (realistic) {
          // Keep albedo; tiny warm bias only
          mat.color.offsetHSL(0.008, -0.02, 0)
        } else {
          mat.color.offsetHSL(0.015, -0.06, -0.02)
          mat.color.lerp(accent, 0.08)
          if (mat.color.r + mat.color.g + mat.color.b < 0.04 && !mat.map) {
            mat.color.set(0xc4a070)
          }
        }
      }

      // Stylized-only emissive wash — never on realistic (destroys skin maps)
      if (
        !realistic &&
        paintMap &&
        paintStrength > 0 &&
        'emissive' in mat &&
        mat.emissive
      ) {
        try {
          mat.emissiveMap = paintMap
          mat.emissive.copy(accent).multiplyScalar(0.06 * paintStrength)
        } catch {
          /* ignore */
        }
      }

      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace
      if (mat.normalMap) mat.normalMap.colorSpace = THREE.NoColorSpace
      mat.needsUpdate = true
    }
  })
}

/**
 * Soft painted face disc parented to the head bone so the 3D pilot carries
 * the oil-portrait identity (Phase 3). Uses an alpha-masked circle.
 */
export function attachPaintedFaceCard(
  head: THREE.Object3D,
  paintMap: THREE.Texture,
  opts: { radius?: number; zOffset?: number; yOffset?: number; opacity?: number } = {},
): THREE.Mesh {
  const radius = opts.radius ?? 0.13
  const zOffset = opts.zOffset ?? 0.13
  const yOffset = opts.yOffset ?? 0.04
  const opacity = opts.opacity ?? 0.88

  // Soft circular alpha so the card blends like a cameo
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.28,
    size / 2,
    size / 2,
    size * 0.5,
  )
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.7, 'rgba(255,255,255,0.85)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const alphaMap = new THREE.CanvasTexture(canvas)

  const mat = new THREE.MeshBasicMaterial({
    map: paintMap,
    alphaMap,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const card = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), mat)
  card.name = 'PortraitFaceCard'
  card.position.set(0, yOffset, zOffset)
  // Face the camera relative to typical Mixamo head forward (+Z)
  card.renderOrder = 2
  head.add(card)
  return card
}

/** Remove previous face card if reloading / HMR */
export function detachPaintedFaceCard(head: THREE.Object3D) {
  const existing = head.getObjectByName('PortraitFaceCard')
  if (existing) {
    head.remove(existing)
    const mesh = existing as THREE.Mesh
    mesh.geometry?.dispose?.()
    const mat = mesh.material as THREE.MeshBasicMaterial
    mat.alphaMap?.dispose?.()
    mat.dispose?.()
  }
}
