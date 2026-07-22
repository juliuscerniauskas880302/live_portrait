import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  loadClipMapJson,
  resolveClipName,
  type ClipMapOverride,
  type Model3dCue,
} from '../../engine/model3dClips'
import { OilPaintShader } from '../../engine/oilPaintShader'
import {
  applyPaintedMaterials,
  attachPaintedFaceCard,
  collectMorphMeshes,
  detectRealisticModel,
  detachPaintedFaceCard,
  setMorphGroup,
  type MorphMesh,
  type PortraitPalette,
} from '../../engine/paintedMaterials'
import { useAppStore } from '../../store/useAppStore'

interface Props {
  modelUrl: string
  accent?: string
  paintTextureUrl?: string
  clipMap?: ClipMapOverride
  /** auto | realistic | stylized */
  modelStyle?: 'auto' | 'realistic' | 'stylized'
  /** Force face-card overlay (default: stylized only) */
  faceCard?: boolean
  /** Phase-5 per-portrait color identity */
  palette?: PortraitPalette
  active: boolean
}

type BoneMap = {
  head?: THREE.Object3D
  neck?: THREE.Object3D
}

const FPS_SAMPLE_MS = 2500
const FPS_MIN = 16
/** Don't judge FPS until the model has been on screen a bit */
const FPS_GRACE_MS = 5000

/**
 * Phase-4 multi-cast 3D viewport:
 * - Prefer realistic pre-textured humans (ARKit morphs)
 * - Face-card only for stylized bodies
 * - Oil grade light on realistic, stronger on stylized
 */
export function OilBustCanvas({
  modelUrl,
  accent = '#c9a227',
  paintTextureUrl,
  clipMap,
  modelStyle = 'auto',
  faceCard: faceCardPref,
  palette,
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
    const override = clipMap
    const effectStartedAt = performance.now()
    let modelOnScreenAt = 0

    const setStatus = (msg: string) => {
      if (statusRef.current) statusRef.current.textContent = msg
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x2a2018)

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
    camera.position.set(0, 1.35, 2.4)
    camera.lookAt(0, 1.2, 0)

    const isLow = perf === 'low'
    let isRealistic = modelStyle === 'realistic'
    const renderer = new THREE.WebGLRenderer({
      antialias: !isLow,
      alpha: false,
      powerPreference: 'default',
      failIfMajorPerformanceCaveat: false,
    })
    renderer.setClearColor(0x2a2018, 1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    renderer.domElement.className = 'oil-bust-canvas'
    renderer.domElement.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:1;'
    mount.appendChild(renderer.domElement)

    // Oil pass: subtle on realistic (keep textures), stronger on stylized; High only
    let useOilPass = perf === 'high'
    let rt: THREE.WebGLRenderTarget | null = null
    let oilScene: THREE.Scene | null = null
    let oilCam: THREE.OrthographicCamera | null = null
    let oilMat: THREE.ShaderMaterial | null = null

    const setupOilPass = () => {
      try {
        rt = new THREE.WebGLRenderTarget(4, 4, {
          type: THREE.UnsignedByteType,
          depthBuffer: true,
          stencilBuffer: false,
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
        oilScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), oilMat))
        return true
      } catch (e) {
        console.warn('[OilBust] oil pass unavailable', e)
        rt?.dispose()
        rt = null
        oilMat = null
        oilScene = null
        oilCam = null
        return false
      }
    }
    if (useOilPass) {
      useOilPass = setupOilPass()
    }

    scene.add(new THREE.AmbientLight(0xfff0dd, 0.9))
    const key = new THREE.DirectionalLight(0xffe8c0, 1.85)
    key.position.set(2, 4, 3)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xaaccff, 0.65)
    fill.position.set(-3, 2, 2)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffaa66, 0.8)
    rim.position.set(0, 2, -3)
    scene.add(rim)
    // Phase-5: accent-tinted rim for portrait identity
    try {
      rim.color.set(accent)
      rim.color.lerp(new THREE.Color(0xffaa66), 0.45)
    } catch {
      /* keep default */
    }
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

    // Always-visible placeholder until model succeeds
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
    let morphMeshes: MorphMesh[] = []
    let lastMoment: string | null = null
    let wasAcknowledging = false
    let wasWink = false
    let paintTex: THREE.Texture | null = null
    let faceCard: THREE.Mesh | null = null
    let characterReady = false
    /** Moment-driven extra morph decay */
    let exprSurprised = 0
    let exprSad = 0
    let exprAngry = 0

    let fpsFrames = 0
    let fpsWindowStart = performance.now()
    let lowFpsStreak = 0

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

    const playCue = (cue: Model3dCue | string) => {
      if (!mixer || !clips.length) return false
      const name = resolveClipName(clips, cue, override)
      if (!name) return false
      const clip = clips.find((c) => c.name === name)
      if (!clip) return false
      if (
        momentAction &&
        momentAction.getClip() === clip &&
        momentAction.isRunning() &&
        momentAction.getEffectiveWeight() > 0.4
      ) {
        return true
      }
      if (momentAction && momentAction.getClip() !== clip) {
        momentAction.fadeOut(0.35)
      }
      const action = mixer.clipAction(clip)
      action.reset()
      action.setLoop(THREE.LoopOnce, 1)
      action.clampWhenFinished = true
      action.fadeIn(0.4)
      action.setEffectiveWeight(0.95)
      action.setEffectiveTimeScale(0.85)
      action.play()
      momentAction = action
      if (idleAction) {
        idleAction.setEffectiveWeight(0.25)
        window.setTimeout(() => {
          if (!disposed && idleAction) idleAction.setEffectiveWeight(0.8)
        }, Math.min(4500, clip.duration * 1000 + 500))
      }
      return true
    }

    const url = modelUrl.startsWith('http')
      ? modelUrl
      : `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}${modelUrl.replace(/^\//, '')}`

    const paintUrl = paintTextureUrl
      ? paintTextureUrl.startsWith('http')
        ? paintTextureUrl
        : `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}${paintTextureUrl.replace(/^\//, '')}`
      : null

    const startLoad = async () => {
      try {
        await loadClipMapJson(import.meta.env.BASE_URL || '/')
      } catch {
        /* defaults ok */
      }
      if (disposed) return

      // Paint texture is optional — never block model load on it
      if (paintUrl) {
        try {
          paintTex = await new Promise<THREE.Texture | null>((resolve) => {
            const t = setTimeout(() => resolve(null), 2500)
            new THREE.TextureLoader().load(
              paintUrl,
              (tex) => {
                clearTimeout(t)
                tex.colorSpace = THREE.SRGBColorSpace
                resolve(tex)
              },
              undefined,
              () => {
                clearTimeout(t)
                resolve(null)
              },
            )
          })
        } catch {
          paintTex = null
        }
      }
      if (disposed) return

      const loader = new GLTFLoader()
      loader.load(
        url,
        (gltf) => {
          if (disposed) return
          try {
            const model = gltf.scene
            placeHumanoid(model)

            if (modelStyle === 'auto') {
              isRealistic = detectRealisticModel(model)
            } else {
              isRealistic = modelStyle === 'realistic'
            }

            applyPaintedMaterials(model, {
              accent,
              paintMap: paintTex,
              paintStrength: isRealistic ? 0 : 0.12,
              mode: isRealistic ? 'realistic' : 'stylized',
              palette: palette ?? { accent },
            })
            morphMeshes = collectMorphMeshes(model)

            // Subtle per-portrait scale / stance so shared meshes differ
            if (palette?.robe || palette?.hair) {
              const h =
                (palette.hair || '').length + (palette.robe || '').length
              const seed = (h % 7) / 7
              model.scale.multiplyScalar(0.97 + seed * 0.06)
              model.rotation.y += (seed - 0.5) * 0.08
            }

            // Only remove placeholder after model is in the graph
            root.add(model)
            root.remove(placeholder.group)

            bones.head =
              findBone(model, [
                'mixamorighead',
                'mixamorig:head',
                'head',
                'bip01head',
                'avatarhead',
              ]) ?? bones.head
            bones.neck = findBone(model, [
              'mixamorigneck',
              'mixamorig:neck',
              'neck',
              'bip01neck',
            ])
            if (bones.head) baseHeadQuat.copy(bones.head.quaternion)
            if (bones.neck) baseNeckQuat.copy(bones.neck.quaternion)

            // Face card only for stylized bodies (realistic already has textured faces)
            const wantFaceCard =
              faceCardPref === true ||
              (faceCardPref !== false && !isRealistic && !!paintTex)
            if (bones.head && paintTex && wantFaceCard) {
              detachPaintedFaceCard(bones.head)
              faceCard = attachPaintedFaceCard(bones.head, paintTex, {
                radius: 0.14,
                zOffset: 0.12,
                yOffset: 0.03,
                opacity: 0.9,
              })
            }

            // Realistic: lighter oil grade so textures stay sharp
            if (isRealistic && oilMat) {
              oilMat.uniforms.uStrength.value = 0.35
            }

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

            characterReady = true
            modelOnScreenAt = performance.now()
            setStatus('')
            console.info('[OilBust] ready', {
              url,
              style: isRealistic ? 'realistic' : 'stylized',
              clips: clips.map((c) => c.name),
              morphs: morphMeshes.length,
              faceCard: Boolean(faceCard),
            })
          } catch (e) {
            console.error('[OilBust] setup failed', e)
            setStatus('3D setup error — placeholder')
            // Keep placeholder visible
            if (!root.children.includes(placeholder.group)) {
              root.add(placeholder.group)
            }
          }
        },
        (ev) => {
          if (ev.total > 0) {
            setStatus(
              `Loading 3D… ${Math.round((ev.loaded / ev.total) * 100)}%`,
            )
          }
        },
        (err) => {
          console.error('[OilBust] load failed', url, err)
          setStatus('Could not load model — placeholder')
        },
      )
    }
    void startLoad()

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
        if (oilMat) oilMat.uniforms.uRes.value.set(w * pr, h * pr)
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

      // Force size if still zero (layout lag)
      if (lastW < 2 || lastH < 2) resize()

      // FPS only after character is up and grace period
      if (
        characterReady &&
        modelOnScreenAt > 0 &&
        performance.now() - modelOnScreenAt > FPS_GRACE_MS &&
        lastW > 2
      ) {
        fpsFrames++
        const now = performance.now()
        if (now - fpsWindowStart >= FPS_SAMPLE_MS) {
          const fps = (fpsFrames * 1000) / (now - fpsWindowStart)
          fpsFrames = 0
          fpsWindowStart = now
          if (fps > 0 && fps < FPS_MIN) {
            lowFpsStreak++
            if (lowFpsStreak >= 3) {
              store.triggerModel3dFpsFallback()
            }
          } else {
            lowFpsStreak = 0
          }
        }
      }

      scene.background = new THREE.Color(night ? 0x121018 : 0x2a2018)
      key.intensity = night ? 1.15 : 1.85
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
      root.rotation.y = Math.sin(t * 0.28) * 0.12 + m.gaze.x * 0.06

      // Moment → expressive morph boosts (RobotExpressive etc.)
      if (m.activeMoment && m.activeMoment !== lastMoment) {
        const mid = m.activeMoment
        if (
          mid === 'startle' ||
          mid === 'surprise' ||
          mid === 'silk-reveal'
        ) {
          exprSurprised = 1
        }
        if (mid === 'bored' || mid === 'look-down' || mid === 'shy-away') {
          exprSad = 1
        }
        if (mid === 'pride' || mid === 'smolder') {
          exprAngry = 0.55
        }
      }
      exprSurprised *= 0.96
      exprSad *= 0.97
      exprAngry *= 0.97

      if (morphMeshes.length) {
        setMorphGroup(morphMeshes, 'blink', m.blink)
        setMorphGroup(
          morphMeshes,
          'smile',
          Math.max(m.expressionSmile, m.acknowledging ? 0.35 : 0),
        )
        setMorphGroup(morphMeshes, 'mouth', m.mouth)
        setMorphGroup(morphMeshes, 'surprised', exprSurprised)
        setMorphGroup(morphMeshes, 'sad', exprSad)
        setMorphGroup(morphMeshes, 'angry', exprAngry)
        // ARKit eye look from gaze
        const gx = Math.max(0, Math.min(1, Math.abs(m.gaze.x)))
        const gy = Math.max(0, Math.min(1, Math.abs(m.gaze.y)))
        if (m.gaze.x < -0.05) setMorphGroup(morphMeshes, 'lookLeft', gx)
        else setMorphGroup(morphMeshes, 'lookLeft', 0)
        if (m.gaze.x > 0.05) setMorphGroup(morphMeshes, 'lookRight', gx)
        else setMorphGroup(morphMeshes, 'lookRight', 0)
        if (m.gaze.y < -0.05) setMorphGroup(morphMeshes, 'lookUp', gy)
        else setMorphGroup(morphMeshes, 'lookUp', 0)
        if (m.gaze.y > 0.05) setMorphGroup(morphMeshes, 'lookDown', gy)
        else setMorphGroup(morphMeshes, 'lookDown', 0)
      }

      // Soft face-card opacity follows presence
      if (faceCard) {
        const mat = faceCard.material as THREE.MeshBasicMaterial
        mat.opacity = 0.82 + m.eyeBrighten * 0.12
      }

      if (m.acknowledging && !wasAcknowledging) playCue('acknowledge')
      wasAcknowledging = m.acknowledging
      if (m.wink && !wasWink) playCue('wink')
      wasWink = m.wink
      if (m.activeMoment && m.activeMoment !== lastMoment) {
        lastMoment = m.activeMoment
        playCue(m.activeMoment)
      } else if (!m.activeMoment) {
        lastMoment = null
      }

      if (lastW < 2 || lastH < 2) return

      try {
        if (useOilPass && rt && oilScene && oilCam && oilMat) {
          renderer.setRenderTarget(rt)
          renderer.render(scene, camera)
          renderer.setRenderTarget(null)
          oilMat.uniforms.uTime.value = t
          oilMat.uniforms.uNight.value = night ? 1 : 0
          // Don't stomp realistic low strength every frame if already set
          if (!isRealistic) {
            oilMat.uniforms.uStrength.value = 0.75
          } else if (oilMat.uniforms.uStrength.value > 0.5) {
            oilMat.uniforms.uStrength.value = 0.32
          }
          renderer.render(oilScene, oilCam)
        } else {
          renderer.render(scene, camera)
        }
      } catch (e) {
        console.warn('[OilBust] render error, disabling oil pass', e)
        useOilPass = false
        try {
          renderer.setRenderTarget(null)
          renderer.render(scene, camera)
        } catch {
          /* give up this frame */
        }
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
      paintTex?.dispose()
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (!mesh.isMesh) return
        // Don't dispose glTF shared geometry/materials aggressively — only our own
      })
      // Dispose only scene helpers we created
      wall.geometry.dispose()
      ;(wall.material as THREE.Material).dispose()
      floor.geometry.dispose()
      ;(floor.material as THREE.Material).dispose()
      renderer.dispose()
      renderer.domElement.remove()
      void effectStartedAt
    }
  }, [
    active,
    modelUrl,
    accent,
    paintTextureUrl,
    clipMap,
    modelStyle,
    faceCardPref,
    palette,
    perf,
  ])

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
