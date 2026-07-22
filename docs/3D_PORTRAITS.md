# 3D oil portraits — motion pipeline

**Phase 4** uses **already-textured realistic human GLBs** (Ready Player Me / AvatarSDK samples) with ARKit face morphs. Sample robots/soldiers remain available as legacy stylized bodies.

## Why realistic textured models

| Approach | Pros | Cons |
|----------|------|------|
| Sample robots / Xbot | Free animations | Looks like a game, not a portrait |
| Face-card on robot | Cheap identity | Uncanny sticker on body |
| **Pre-textured humans** | Real skin/cloth maps + blink/smile morphs | Shared faces across cast until custom GLBs |

## Architecture

```
motionDirector → motion store
                    │
                    ▼
              OilBustCanvas
                ├─ realistic materials (keep baked maps)
                ├─ ARKit morphs: blink, smile, mouth, gaze, emotion
                ├─ bone head/neck + breath sway
                ├─ optional clips if present in GLB
                ├─ light oil grade (High only)
                └─ FPS → 2D fallback (Auto)
```

Face-card overlay is **off** for realistic models (they already have faces).

## Current assets (`public/models/realistic/`)

| Model | Style | Morphs |
|-------|--------|--------|
| `avatarsdk.glb` | Male realistic | eyeBlink, brow, mouth, eye look… |
| `brunette.glb` | Female realistic | mouthOpen, mouthSmile, full ARKit… |
| `brunette-t.glb` | Female lite | eye look + brows… |
| `vroid.glb` | Anime (optional) | Fcl_EYE_Close, Joy, Sorrow… |

Legacy: `Xbot.glb`, `Soldier.glb`, `RobotExpressive.glb`.

## Portrait fields

```ts
model3d: '/models/realistic/brunette.glb',
model3dStyle: 'realistic',  // keep textures; no face-card
model3dFaceCard: false,
model3dClipMap: { /* optional if GLB has clips */ },
```

`model3dStyle: 'auto'` detects Wolf3D / Avatar* materials.

## Face morph mapping

| Motion | Morph fragments |
|--------|-----------------|
| blink | eyeBlinkLeft/Right, Fcl_EYE_Close… |
| smile | mouthSmile, Joy… |
| mouth | mouthOpen, jawOpen, viseme_aa… |
| gaze | eyeLookLeft/Right/Up/Down… |
| startle | surprised / eyeWide |
| bored | sad / mouthFrown |

## Performance

Realistic GLBs are ~2–12 MB. Prefer **Balanced/High**. Auto falls back to painted 2D on Low or low FPS.

## Swap in your own models

1. Export a textured humanoid **GLB** (Mixamo body + face morphs ideal).  
2. Drop into `public/models/realistic/`.  
3. Point `model3d` at it; set `model3dStyle: 'realistic'`.  
4. Map any clips in `clip-map.json` or `model3dClipMap`.  

## Roadmap

| Phase | Status |
|-------|--------|
| 0–3 Sample bodies + face cards | Done (legacy) |
| **4 Realistic textured cast** | **Done** |
| 5 Per-portrait unique meshes (custom) | Future |
