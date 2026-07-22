import * as THREE from 'three'
import { MORPH_GROUPS } from './model3dClips'

/**
 * Phase-2 painted materials: warm oil-style grade on glTF meshes,
 * optional portrait albedo soft-blend, morph mesh bookkeeping.
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
    let matched = false
    for (const [name, idx] of Object.entries(dictionary)) {
      const n = name.toLowerCase().replace(/[\s_-]+/g, '')
      if (keys.some((k) => n.includes(k.replace(/[\s_-]+/g, '')))) {
        influences[idx] = v
        matched = true
      }
    }
    // If smile has no morph, leave alone (don't zero unrelated)
    void matched
  }
}

/**
 * Restyle materials toward oil portrait: warmer, rougher, less plastic.
 * Optionally multiplies in a paint texture (portrait still) at low strength
 * so identity hints appear without fully rebinding UVs.
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
  const paintStrength = opts.paintStrength ?? 0.22
  const paintMap = opts.paintMap ?? null

  root.traverse((c) => {
    const mesh = c as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.frustumCulled = false
    mesh.visible = true

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    mesh.material = mats.map((m) => {
      if (!m) return m
      const src = m as THREE.MeshStandardMaterial

      const next = new THREE.MeshStandardMaterial({
        color: src.color?.clone?.() ?? new THREE.Color(0xc4a574),
        map: src.map ?? paintMap,
        normalMap: src.normalMap ?? null,
        roughnessMap: src.roughnessMap ?? null,
        metalnessMap: src.metalnessMap ?? null,
        emissiveMap: src.emissiveMap ?? null,
        roughness: 0.78,
        metalness: 0.06,
        envMapIntensity: 0.35,
        flatShading: false,
        side: THREE.DoubleSide,
        transparent: false,
        opacity: 1,
      })

      // Oil warmth
      next.color.offsetHSL(0.02, -0.08, -0.03)
      next.color.lerp(accent, 0.1)

      // Soft identity wash when no albedo map on mesh
      if (!src.map && paintMap && paintStrength > 0) {
        next.map = paintMap
        next.color.lerp(new THREE.Color(0xffffff), 0.15)
      } else if (src.map && paintMap && paintStrength > 0) {
        // Keep original map; slight emissive from paint for glow
        next.emissiveMap = paintMap
        next.emissive = accent.clone().multiplyScalar(0.08 * paintStrength)
      }

      if (next.map) next.map.colorSpace = THREE.SRGBColorSpace
      if (next.emissiveMap) next.emissiveMap.colorSpace = THREE.SRGBColorSpace

      // Dispose old only if we cloned away from shared refs carefully —
      // don't dispose shared glTF materials aggressively here.
      return next
    })
  })
}
