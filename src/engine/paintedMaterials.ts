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

/**
 * In-place oil-style tweak. Keeps original material instances so skinning works.
 */
export function applyPaintedMaterials(
  root: THREE.Object3D,
  opts: {
    accent?: string
    paintMap?: THREE.Texture | null
    paintStrength?: number
  } = {},
) {
  const accent = new THREE.Color(opts.accent ?? '#c9a227')
  const paintStrength = opts.paintStrength ?? 0.15
  const paintMap = opts.paintMap ?? null

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

      mat.side = THREE.DoubleSide
      mat.transparent = false
      mat.opacity = 1
      mat.depthWrite = true
      mat.visible = true

      if ('metalness' in mat && typeof mat.metalness === 'number') {
        mat.metalness = Math.min(mat.metalness, 0.2)
      }
      if ('roughness' in mat && typeof mat.roughness === 'number') {
        mat.roughness = Math.max(mat.roughness, 0.55)
      }
      if ('envMapIntensity' in mat && typeof mat.envMapIntensity === 'number') {
        mat.envMapIntensity = 0.4
      }

      if ('color' in mat && mat.color && mat.color.isColor) {
        mat.color.offsetHSL(0.015, -0.06, -0.02)
        mat.color.lerp(accent, 0.08)
        // Rescue pure-black unlit-looking albedos
        if (mat.color.r + mat.color.g + mat.color.b < 0.04 && !mat.map) {
          mat.color.set(0xc4a070)
        }
      }

      // Soft emissive wash only — never replace the main map (breaks skinned UVs look)
      if (
        paintMap &&
        paintStrength > 0 &&
        'emissive' in mat &&
        mat.emissive
      ) {
        try {
          mat.emissiveMap = paintMap
          mat.emissive.copy(accent).multiplyScalar(0.06 * paintStrength)
        } catch {
          /* ignore materials that reject emissiveMap */
        }
      }

      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace
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
