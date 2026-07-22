# 3D oil portraits — motion pipeline

Phase 1 pilot: **Lord Ashwick** uses `public/models/Xbot.glb` when  
**Settings → Portrait engine** is `Auto` (and performance ≠ Low) or `3D pilot`.

## Architecture

```
motionDirector  →  motion store (blink, gaze, head, activeMoment, acknowledging)
                         │
                         ▼
                 OilBustCanvas
                   ├─ idle AnimationClip (loop)
                   ├─ moment / acknowledge clips (one-shot)
                   ├─ head / neck bones from headRotate / gaze
                   └─ oil-paint full-screen shader grade
```

2D multi-frame portraits (`OilLifeCanvas`) stay the default for the rest of the cast.

## Adding a new motion (no image generation)

1. Author or download a short clip on the **same rig** as the character GLB  
   (Mixamo → Blender retarget → export GLB, or keyframe in Blender).
2. Name the clip clearly (`agree`, `headShake`, `silk_reveal`, …).
3. Map it in either:
   - **Global defaults:** `src/engine/model3dClips.ts` → `DEFAULT_CLIP_PREFERENCES`
   - **Per portrait:** `PortraitDef.model3dClipMap` in `src/data/portraits.ts`
4. Trigger it by existing director cues (`activeMoment` id, tap acknowledge, wink).

Matching is **case-insensitive substring** against clip names on the GLB.

### Example (per-portrait)

```ts
model3d: '/models/my-character.glb',
model3dClipMap: {
  idle: ['idle'],
  acknowledge: ['agree', 'nod'],
  'silk-reveal': ['silk_reveal', 'sneak_pose'],
  'coy-look': ['headShake'],
},
```

## Xbot pilot clips (current)

| Clip | Duration | Used for |
|------|----------|----------|
| `idle` | 2.5s | ambient loop |
| `agree` | 1.8s | acknowledge / invitation / soft laugh |
| `headShake` | 2.6s | glances / coy look |
| `sneak_pose` | hold | startle / silk-reveal |
| `sad_pose` | hold | bored / look-down |
| `walk` / `run` | short | rarely matched |

No face morphs on Xbot — blink/smile still come from the motion store but only affect bones when morph targets exist.

## Export checklist (Blender)

- Units: meters; character ~1.6–1.8 m tall  
- Apply scale; rest pose standing  
- Export **glTF Binary (.glb)** with:
  - Skinning / armature
  - Animations (NLA or actions)
  - Materials (optional maps)
- Prefer short one-shots (1–3 s) for moments; looping idle for breath/weight shift  
- Keep file under ~8 MB for tablets  

## Performance

| Mode | 3D behavior |
|------|-------------|
| Low | Auto uses **2D** even if `model3d` is set |
| Balanced / High | Auto enables 3D when `model3d` present |
| 3D pilot | Force 3D if model exists |
| Painted | Force 2D always |

Three.js is **code-split** (`OilBustCanvas` lazy chunk) so 2D tablets never download it.

## Next (Phase 2+)

- Painted albedo textures (oil look on the mesh, not only post)
- Face morph targets (`blink`, `smile`, `mouthOpen`)
- Mixamo library pack retargeted to one canonical rig
- Automatic 2D fallback if FPS drops  
