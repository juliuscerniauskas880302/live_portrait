# 3D oil portraits — motion pipeline

**Phase 2** pilot: **Lord Ashwick** uses `public/models/Xbot.glb` when  
**Settings → Portrait engine** is `Auto` (performance ≠ Low) or `3D pilot`.

## Architecture

```
motionDirector  →  motion store (blink, gaze, head, activeMoment, acknowledging)
                         │
                         ▼
                 OilBustCanvas
                   ├─ load clip-map.json (runtime)
                   ├─ idle AnimationClip (loop)
                   ├─ moment / acknowledge clips (one-shot)
                   ├─ head / neck bones from headRotate / gaze
                   ├─ face morphs when GLB provides them
                   ├─ painted materials + optional portrait wash
                   ├─ oil-paint full-screen shader grade
                   └─ FPS monitor → session 2D fallback
```

2D multi-frame portraits (`OilLifeCanvas`) remain default for the rest of the cast.

---

## Phase 2: add a motion without code

### A. Runtime JSON (preferred)

Edit **`public/models/clip-map.json`**:

```json
{
  "acknowledge": ["agree", "nod"],
  "silk-reveal": ["sneak_pose", "my_new_clip"]
}
```

Arrays are **preference order** (first matching clip name on the GLB wins).  
Reload the app — no TypeScript rebuild required for preference changes.

### B. Per-portrait override

In `src/data/portraits.ts`:

```ts
model3d: '/models/my-character.glb',
model3dClipMap: {
  idle: ['idle'],
  acknowledge: ['agree'],
  'silk-reveal': ['silk_reveal'],
},
```

### C. Built-in defaults

`src/engine/model3dClips.ts` → `DEFAULT_CLIP_PREFERENCES`  
(used when JSON / portrait map omit a cue)

**Match rule:** case-insensitive exact or substring against clip names on the GLB.

---

## Face morph targets (when your GLB has them)

Director weights drive morphs if present:

| Motion | Morph name fragments (any match) |
|--------|-----------------------------------|
| blink | `blink`, `eyeBlinkLeft`, `eyesClosed`, … |
| smile | `smile`, `mouthSmile`, `happy`, … |
| mouth | `mouthOpen`, `jawOpen`, `viseme_aa`, … |

Xbot has **no morphs** — face life is head-bone only until you swap in a morph-ready character.

---

## Painted materials

`applyPaintedMaterials` (Phase 2):

- Warmer, rougher, less plastic shading  
- Soft blend of the 2D portrait still as map/emissive wash  
- Works with oil post-process shader for canvas grade  

---

## FPS auto-fallback

If average FPS stays **&lt; 18** for ~4s while 3D is active:

- Session flag `model3dFpsFallback` → renderer switches to **painted 2D**  
- Toast: “3D struggling — switched to painted view”  
- Clears when you change **Portrait engine**  
- Not persisted across full page reloads  

---

## Xbot pilot clips

| Clip | Used for |
|------|----------|
| `idle` | ambient loop |
| `agree` | acknowledge / invitation / soft laugh |
| `headShake` | glances / coy look |
| `sneak_pose` | startle / silk-reveal |
| `sad_pose` | bored / look-down |
| `walk` / `run` | rarely matched |

---

## Export checklist (Blender → GLB)

- Units: meters; character ~1.6–1.8 m  
- Apply transforms; standing rest pose  
- Export **glTF Binary (.glb)** with armature + animations + materials  
- Short one-shots (1–3 s) for moments; looping idle for weight shift  
- Optional morphs named for blink / smile / mouthOpen  
- Prefer **&lt; 8 MB** for tablets  

---

## Performance

| Mode | Behavior |
|------|----------|
| Low | Auto uses **2D** |
| Balanced / High | Auto uses 3D when `model3d` set |
| 3D pilot | Force 3D |
| Painted | Force 2D |
| Low FPS | Session fallback to 2D |

Three.js is **code-split** (`OilBustCanvas` lazy chunk).

---

## Roadmap

| Phase | Status |
|-------|--------|
| 0 Spike (load + frame) | Done |
| 1 Clips + oil grade + settings | Done |
| 2 JSON clip map, paint mats, morphs, FPS fallback | Done |
| 3 Custom painted cast GLBs / Mixamo pack | Next |
