import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  resolveClipName,
  type ClipMapOverride,
  type Model3dCue,
} from '../../engine/model3dClips'
import { OilPaintShader } from '../../engine/oilPaintShader'
import { useAppStore } from '../../store/useAppStore'

interface Props {
  modelUrl: string
  accent?: string
  /** Per-portrait clip name preferences */
  clipMap?: ClipMapOverride
  active: boolean
}

type BoneMap = {
  head?: THREE.Object3D
  neck?: THREE.Object3D
}

/**
 * Phase-1 3D pilot:
 * - glTF character + idle / moment / acknowledge clips
 * - Head bones follow motion director
 * - Oil-paint full-screen grade after render
 */
export function OilBustCanvas({
  modelUrl,
  accent = '#c9a227',
  clipMap,
  active,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const perf = useAppStore((s) => s.performanceMode)

  useEffect(() => {
    if (!active) return
    const mount = mountRef.current
    if (!mount) return

    let disposed = false
    let raf = 0
    const clock = new THREE.Clock()
    const override = clipMap as ClipMapOverride | undefined

    const setStatus = (msg: string) => {
      if (statusRef.current) statusRef.current.textContent = msg
    }

    // ── Scene ────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x2a2018)

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
    camera.position.set(0, 1.35, 2.4)
    camera.lookAt(0, 1.2, 0)

    const isLow = perf === 'low'
    const useOilPass = perf !== 'low'
    const renderer = new THREE.WebGLRenderer({
      antialias: !isLow,
      alpha: false,
      powerPreference: 'default',
    })
    renderer.setClearColor(0x2a2018, 1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.domElement.className = 'oil-bust-canvas'
    renderer.domElement.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;display:block;'
    mount.appendChild(renderer.domElement)

    // Oil post: scene → RT → fullscreen quad
    let rt: THREE.WebGLRenderTarget | null = null
    let oilScene: THREE.Scene | null = null
    let oilCam: THREE.OrthographicCamera | null = null
    let oilMat: THREE.ShaderMaterial | null = null
    if (useOilPass) {
      rt = new THREE.WebGLRenderTarget(4, 4, {
        type: THREE.HalfFloatType,
        depthBuffer: true,
      })
      rt.texture.colorSpace = THREE.SRGBColorSpace
      oilScene = new THREE.Scene()
      oilCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
      oilMat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(OilPaintShader.uniforms),
        vertexShader: OilPaintShader.vertexShader,
        fragmentShader: OilPaintShader.fragmentShader,
        depthTest: false,
        depthWrite: false,
      })
      oilMat.uniforms.tDiffuse.value = rt.texture
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), oilMat)
      oilScene.add(quad)
    }

    scene.add(new THREE.AmbientLight(0xfff0dd, 0.85))
    const key = new THREE.DirectionalLight(0xffe8c0, 1.8)
    key.position.set(2, 4, 3)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xaaccff, 0.65)
    fill.position.set(-3, 2, 2)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffaa66, 0.8)
    rim.position.set(0, 2, -3)
    scene.add(rim)
    const candle = new THREE.PointLight(0xff9944, 0.75, 10, 2)
    candle.position.set(1.3, 1.15, 1.5)
    scene.add(candle)

    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 6),
      new THREE.MeshStandardMaterial({ color: 0x3d2a22, roughness: 0.92 }),
    )
    wall.position.set(0, 1.4, -1.4)
    scene.add(wall)
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2, 32),
      new THREE.MeshStandardMaterial({ color: 0x1a120e, roughness: 0.95 }),
    )
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)

    const root = new THREE.Group()
    scene.add(root)

    const placeholder = buildFallbackBust(new THREE.Color(accent))
    root.add(placeholder.group)
    setStatus('Loading 3D model…')

    let mixer: THREE.AnimationMixer | null = null
    let idleAction: THREE.AnimationAction | null = null
    let momentAction: THREE.AnimationAction | null = null
    const clips: THREE.AnimationClip[] = []
    const bones: BoneMap = { head: placeholder.head }
    let baseHeadQuat = placeholder.head.quaternion.clone()
    let baseNeckQuat = new THREE.Quaternion()
    let lastMoment: string | null = null
    let wasAcknowledging = false
    let wasWink = false

    const findBone = (obj: THREE.Object3D, names: string[]) => {
      let found: THREE.Object3D | undefined
      obj.traverse((c) => {
        if (found) return
        const n = c.name.toLowerCase().replace(/\s+/g, '')
        if (names.some((x) => n === x || n.includes(x))) found = c
      })
      return found
    }

    const _tmp = new THREE.Vector3()

    const placeHumanoid = (model: THREE.Object3D) => {
      model.position.set(0, 0, 0)
      model.rotation.set(0, 0, 0)
      model.scale.set(1, 1, 1)
      model.updateMatrixWorld(true)

      let boneH = 0
      model.traverse((c) => {
        const sk = c as THREE.SkinnedMesh
        if (sk.isSkinnedMesh) {
          sk.frustumCulled = false
          sk.skeleton?.bones.forEach((b) => {
            b.getWorldPosition(_tmp)
            boneH = Math.max(boneH, _tmp.y)
          })
        }
      })

      let box = new THREE.Box3().setFromObject(model)
      let size = box.getSize(new THREE.Vector3())
      if (!Number.isFinite(size.y) || size.y < 0.01) {
        size.y = boneH > 0.1 ? boneH : 1.7
      }
      model.scale.setScalar(1.7 / size.y)
      model.updateMatrixWorld(true)
      box = new THREE.Box3().setFromObject(model)
      const center = box.getCenter(new THREE.Vector3())
      model.position.x -= center.x
      model.position.z -= center.z
      model.position.y -= box.min.y
      model.updateMatrixWorld(true)
    }

    const playCue = (cue: Model3dCue | string, opts?: { loop?: boolean }) => {
      if (!mixer || !clips.length) return false
      const name = resolveClipName(clips, cue, override)
      if (!name) return false
      const clip = clips.find((c) => c.name === name)
      if (!clip) return false

      if (momentAction && momentAction.getClip() !== clip) {
        momentAction.fadeOut(0.35)
      }
      // Don't restart same one-shot if already playing strongly
      if (
        momentAction &&
        momentAction.getClip() === clip &&
        momentAction.isRunning() &&
        momentAction.getEffectiveWeight() > 0.4
      ) {
        return true
      }

      const action = mixer.clipAction(clip)
      action.reset()
      if (opts?.loop) {
        action.setLoop(THREE.LoopRepeat, Infinity)
        action.clampWhenFinished = false
      } else {
        action.setLoop(THREE.LoopOnce, 1)
        action.clampWhenFinished = true
      }
      action.fadeIn(0.4)
      action.setEffectiveWeight(0.95)
      action.setEffectiveTimeScale(cue === 'idle' ? 0.7 : 0.85)
      action.play()
      momentAction = action

      // Soften idle under one-shots
      if (idleAction && cue !== 'idle') {
        idleAction.setEffectiveWeight(0.25)
        window.setTimeout(() => {
          if (!disposed && idleAction) idleAction.setEffectiveWeight(0.75)
        }, Math.min(4000, clip.duration * 1000 + 400))
      }
      return true
    }

    const url = modelUrl.startsWith('http')
      ? modelUrl
      : `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}${modelUrl.replace(/^\//, '')}`

    const loader = new GLTFLoader()
    loader.load(
      url,
      (gltf) => {
        if (disposed) return
        try {
          const model = gltf.scene
          let meshCount = 0
          model.traverse((c) => {
            const mesh = c as THREE.Mesh
            if (!mesh.isMesh) return
            meshCount++
            mesh.visible = true
            mesh.frustumCulled = false
            const mats = Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material]
            for (const mat of mats) {
              if (!mat) continue
              mat.side = THREE.DoubleSide
              mat.transparent = false
              mat.opacity = 1
              mat.needsUpdate = true
              const std = mat as THREE.MeshStandardMaterial
              if ('metalness' in std)
                std.metalness = Math.min(std.metalness ?? 0, 0.2)
              if ('roughness' in std)
                std.roughness = Math.max(std.roughness ?? 0.5, 0.5)
              if (std.map) std.map.colorSpace = THREE.SRGBColorSpace
              if ('color' in std && std.color && !std.map) {
                if (std.color.r + std.color.g + std.color.b < 0.05) {
                  std.color.set(0xc4a070)
                }
              }
            }
          })

          placeHumanoid(model)
          root.remove(placeholder.group)
          root.add(model)

          bones.head =
            findBone(model, ['mixamorighead', 'head', 'bip01head']) ??
            bones.head
          bones.neck = findBone(model, ['mixamorigneck', 'neck', 'bip01neck'])
          if (bones.head) baseHeadQuat.copy(bones.head.quaternion)
          if (bones.neck) baseNeckQuat.copy(bones.neck.quaternion)

          if (gltf.animations?.length) {
            mixer = new THREE.AnimationMixer(model)
            clips.push(...gltf.animations)
            mixer.addEventListener('finished', (e) => {
              const act = e.action as THREE.AnimationAction
              if (act === momentAction) {
                act.fadeOut(0.4)
                if (idleAction) idleAction.setEffectiveWeight(0.85)
              }
            })

            const idleName = resolveClipName(clips, 'idle', override)
            const idleClip =
              clips.find((c) => c.name === idleName) ?? clips[0]
            idleAction = mixer.clipAction(idleClip)
            idleAction.reset().play()
            idleAction.setLoop(THREE.LoopRepeat, Infinity)
            idleAction.setEffectiveWeight(0.85)
            idleAction.setEffectiveTimeScale(0.7)
            mixer.update(0.05)
          }

          model.updateMatrixWorld(true)
          const box = new THREE.Box3().setFromObject(model)
          if (!box.isEmpty()) {
            const size = box.getSize(new THREE.Vector3())
            const center = box.getCenter(new THREE.Vector3())
            const lookY = box.min.y + size.y * 0.7
            const dist = Math.max(1.6, size.y * 1.05)
            camera.position.set(center.x, lookY, center.z + dist)
            camera.lookAt(center.x, lookY, center.z)
            camera.updateProjectionMatrix()
          }

          setStatus('')
          console.info(
            '[OilBust] Phase-1 pilot ready',
            { url, meshCount, clips: clips.map((c) => c.name) },
          )
        } catch (e) {
          console.error('[OilBust] setup failed', e)
          setStatus('3D setup error — placeholder')
        }
      },
      (ev) => {
        if (ev.total > 0) {
          setStatus(`Loading 3D… ${Math.round((ev.loaded / ev.total) * 100)}%`)
        }
      },
      (err) => {
        console.error('[OilBust] load failed', url, err)
        setStatus('Could not load model — placeholder')
      },
    )

    let lastW = 0
    let lastH = 0
    const resize = () => {
      const rect = mount.getBoundingClientRect()
      const w = Math.max(2, Math.floor(rect.width))
      const h = Math.max(2, Math.floor(rect.height))
      if (w === lastW && h === lastH) return
      lastW = w
      lastH = h
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      const pr = Math.min(window.devicePixelRatio || 1, isLow ? 1 : 1.5)
      renderer.setPixelRatio(pr)
      renderer.setSize(w, h, false)
      if (rt) {
        rt.setSize(Math.floor(w * pr), Math.floor(h * pr))
        if (oilMat) {
          oilMat.uniforms.uRes.value.set(w * pr, h * pr)
        }
      }
    }
    const ro = new ResizeObserver(resize)
    ro.observe(mount)
    requestAnimationFrame(resize)
    setTimeout(resize, 50)
    setTimeout(resize, 250)

    const euler = new THREE.Euler()
    const quat = new THREE.Quaternion()

    const tick = () => {
      if (disposed) return
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, clock.getDelta())
      const t = clock.elapsedTime
      const store = useAppStore.getState()
      const m = store.motion
      const night = store.resolvedTheme === 'night'

      scene.background = new THREE.Color(night ? 0x121018 : 0x2a2018)
      key.intensity = night ? 1.15 : 1.8
      candle.intensity = 0.55 + Math.sin(t * 3.2) * 0.12

      if (mixer) mixer.update(dt)

      if (bones.head) {
        const yaw = THREE.MathUtils.degToRad(m.headRotate) + m.gaze.x * 0.3
        const pitch = THREE.MathUtils.degToRad(m.headTilt) + m.gaze.y * 0.2
        euler.set(pitch * 0.55, yaw * 0.7, 0, 'YXZ')
        quat.setFromEuler(euler)
        bones.head.quaternion.copy(baseHeadQuat).multiply(quat)
      }
      if (bones.neck) {
        const yaw =
          THREE.MathUtils.degToRad(m.headRotate) * 0.3 + m.gaze.x * 0.1
        const pitch = THREE.MathUtils.degToRad(m.headTilt) * 0.3
        euler.set(pitch, yaw, 0, 'YXZ')
        quat.setFromEuler(euler)
        bones.neck.quaternion.copy(baseNeckQuat).multiply(quat)
      }

      root.scale.set(1, 1 + m.breath * 0.02, 1)
      // Gentle sway — readable depth without spinning wildly
      root.rotation.y = Math.sin(t * 0.28) * 0.12 + m.gaze.x * 0.06

      // ── Director cues → clips ─────────────────────────────────
      if (m.acknowledging && !wasAcknowledging) {
        playCue('acknowledge')
      }
      wasAcknowledging = m.acknowledging

      if (m.wink && !wasWink) {
        playCue('wink')
      }
      wasWink = m.wink

      if (m.activeMoment && m.activeMoment !== lastMoment) {
        lastMoment = m.activeMoment
        playCue(m.activeMoment)
      } else if (!m.activeMoment) {
        lastMoment = null
      }

      if (lastW <= 0 || lastH <= 0) return

      if (rt && oilScene && oilCam && oilMat) {
        renderer.setRenderTarget(rt)
        renderer.render(scene, camera)
        renderer.setRenderTarget(null)
        oilMat.uniforms.uTime.value = t
        oilMat.uniforms.uNight.value = night ? 1 : 0
        oilMat.uniforms.uStrength.value = isLow ? 0.45 : 0.85
        renderer.render(oilScene, oilCam)
      } else {
        renderer.render(scene, camera)
      }
    }
    raf = requestAnimationFrame(tick)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      mixer?.stopAllAction()
      rt?.dispose()
      oilMat?.dispose()
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.geometry?.dispose?.()
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material]
        for (const mat of mats) {
          if (mat && typeof mat.dispose === 'function') mat.dispose()
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [active, modelUrl, accent, clipMap, perf])

  return (
    <div ref={mountRef} className="oil-bust-root">
      <p ref={statusRef} className="oil-bust-status" />
    </div>
  )
}

function buildFallbackBust(accent: THREE.Color) {
  const group = new THREE.Group()
  const skin = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xe0b080).lerp(accent, 0.12),
    roughness: 0.55,
    metalness: 0.05,
  })
  const cloth = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x4a2035).lerp(accent, 0.15),
    roughness: 0.75,
  })
  const hair = new THREE.MeshStandardMaterial({
    color: 0x1c1210,
    roughness: 0.9,
  })

  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.32, 0.55, 16),
    cloth,
  )
  torso.position.set(0, 0.95, 0)
  group.add(torso)

  const shoulders = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 12),
    cloth,
  )
  shoulders.position.set(0, 1.18, 0)
  shoulders.scale.set(1.5, 0.55, 0.7)
  group.add(shoulders)

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 0.12, 10),
    skin,
  )
  neck.position.set(0, 1.38, 0)
  group.add(neck)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 18), skin)
  head.position.set(0, 1.58, 0)
  head.scale.set(1, 1.15, 0.95)
  group.add(head)

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), hair)
  hairCap.position.set(0, 1.66, -0.02)
  hairCap.scale.set(1.05, 0.75, 1.05)
  group.add(hairCap)

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x221810 })
  const eyeL = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12), eyeMat)
  eyeL.position.set(-0.06, 1.6, 0.16)
  const eyeR = eyeL.clone()
  eyeR.position.x = 0.06
  group.add(eyeL, eyeR)

  return { group, head }
}
