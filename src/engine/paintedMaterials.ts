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

/** Palette from PortraitDef — used to differentiate shared meshes (Phase 5). */
export type PortraitPalette = {
  skin?: string
  hair?: string
  robe?: string
  robeDark?: string
  accent?: string
  eyeColor?: string
}

type MatRole = 'skin' | 'hair' | 'outfitTop' | 'outfitBottom' | 'shoes' | 'eyes' | 'other'

function classifyMaterial(name: string): MatRole {
  const n = name.toLowerCase()
  if (/eye(?!lash)|eyeball|cornea|iris/.test(n)) return 'eyes'
  if (/lash|brow|tooth|teeth|oral|mouth_inner/.test(n)) return 'other'
  if (/hair|scalp|beard|mustache/.test(n)) return 'hair'
  if (
    /skin|body|head|face|avatarbody|avatarhead|wolf3d_skin|wolf3d_body/.test(n)
  ) {
    return 'skin'
  }
  if (/footwear|shoe|boot|outfit_shoes/.test(n)) return 'shoes'
  if (/bottom|pants|skirt|legs|outfit_bottom|bottoms/.test(n)) return 'outfitBottom'
  if (
    /top|outfit_top|tops|shirt|dress|robe|cloth|jacket|coat|onepiece|armor|suit/.test(
      n,
    )
  ) {
    return 'outfitTop'
  }
  // AvatarSDK generic outfit
  if (/outfit/.test(n)) return 'outfitTop'
  return 'other'
}

function tintColor(
  base: THREE.Color,
  targetHex: string | undefined,
  amount: number,
) {
  if (!targetHex || amount <= 0) return
  const t = new THREE.Color(targetHex)
  base.lerp(t, amount)
}

/**
 * Phase 5: recolor shared realistic meshes so each portrait reads as unique.
 * Multiplies / lerps material.color while keeping albedo maps.
 */
export function applyPortraitPalette(
  root: THREE.Object3D,
  palette: PortraitPalette,
  strength = 0.72,
) {
  const s = THREE.MathUtils.clamp(strength, 0, 1)
  root.traverse((c) => {
    const mesh = c as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      if (!m || !('color' in m)) continue
      const mat = m as THREE.MeshStandardMaterial
      if (!mat.color?.isColor) continue

      const role = classifyMaterial(`${mat.name || ''} ${mesh.name || ''}`)
      // Start from white so map * color ≈ tinted texture
      if (mat.map) {
        mat.color.setRGB(1, 1, 1)
      }

      switch (role) {
        case 'skin':
          // Stronger skin shift so cast members separate
          tintColor(mat.color, palette.skin, s * 0.72)
          break
        case 'hair':
          tintColor(mat.color, palette.hair, Math.min(1, s * 0.95))
          break
        case 'outfitTop':
          tintColor(mat.color, palette.robe, Math.min(1, s * 0.92))
          if (palette.accent) tintColor(mat.color, palette.accent, s * 0.18)
          break
        case 'outfitBottom':
          tintColor(mat.color, palette.robeDark ?? palette.robe, Math.min(1, s * 0.88))
          break
        case 'shoes':
          tintColor(mat.color, palette.robeDark ?? palette.hair, s * 0.75)
          break
        case 'eyes':
          if (palette.eyeColor) tintColor(mat.color, palette.eyeColor, s * 0.4)
          break
        default:
          if (palette.accent) tintColor(mat.color, palette.accent, s * 0.12)
          break
      }
      mat.needsUpdate = true
    }
  })
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
    palette?: PortraitPalette
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
          // Keep albedo; tiny warm bias only (palette applied after)
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
  opts: {
    radius?: number
    zOffset?: number
    yOffset?: number
    opacity?: number
    /** realistic = soft identity blend; stylized = stronger cameo */
    mode?: 'realistic' | 'stylized'
  } = {},
): THREE.Mesh {
  const realistic = opts.mode === 'realistic'
  const radius = opts.radius ?? (realistic ? 0.11 : 0.13)
  const zOffset = opts.zOffset ?? (realistic ? 0.105 : 0.13)
  const yOffset = opts.yOffset ?? (realistic ? 0.02 : 0.04)
  const opacity = opts.opacity ?? (realistic ? 0.42 : 0.88)

  // Soft oval alpha — portrait identity without hard sticker edges
  const size = 160
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, size, size)
  const g = ctx.createRadialGradient(
    size / 2,
    size * 0.48,
    size * (realistic ? 0.22 : 0.28),
    size / 2,
    size * 0.5,
    size * (realistic ? 0.48 : 0.5),
  )
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.55, realistic ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.9)')
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
    depthTest: true,
    side: THREE.DoubleSide,
    // Soft-light-ish: use normal blending; opacity does the rest
  })
  // Slight vertical oval for face proportions
  const card = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), mat)
  card.name = 'PortraitFaceCard'
  card.position.set(0, yOffset, zOffset)
  card.scale.set(0.92, 1.12, 1)
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
