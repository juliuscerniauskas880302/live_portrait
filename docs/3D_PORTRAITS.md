# 3D oil portraits — motion pipeline

**Phase 3** expands the free glTF cast and paints oil **face cards** on the head bone.

## 3D cast (current)

| Portrait | Model | Highlights |
|----------|--------|------------|
| **Lord Ashwick** | `Xbot.glb` | agree / headShake / idle |
| **Sir Aldric (Knight)** | `Soldier.glb` | Mixamo Idle / Walk / Run |
| **Father Hollow** | `RobotExpressive.glb` | Yes / Wave / No + morphs Angry/Surprised/Sad |

Settings → **Portrait engine**: Auto / Painted / **3D cast**.

---

## Architecture

```
motionDirector → motion store
                    │
                    ▼
              OilBustCanvas
                ├─ clip-map.json + portrait model3dClipMap
                ├─ idle + one-shot clips
                ├─ head/neck bones
                ├─ face morphs (when GLB has them)
                ├─ painted head-card (2D portrait still)
                ├─ oil full-screen grade (High)
                └─ FPS → session 2D fallback (Auto only)
```

---

## Phase 3: painted face card

When a portrait has both `model3d` and a 2D still, a soft circular **oil face card** is parented to the head bone (`attachPaintedFaceCard`).  
That keeps identity closer to the gallery painting without requiring custom UV paint jobs yet.

---

## Add a motion (no code rebuild for prefs)

### A. Runtime JSON

Edit `public/models/clip-map.json` — preference arrays, first GLB match wins.

### B. Per-portrait

```ts
model3d: '/models/MyChar.glb',
model3dClipMap: {
  idle: ['Idle'],
  acknowledge: ['Yes', 'Wave'],
  startle: ['Jump'],
},
```

### C. Register in manifest (optional)

`public/models/manifest.json` lists files + portrait ids for tooling.

---

## Face morphs

| Director | Morph fragments |
|----------|-----------------|
| blink | blink, eyeBlink… |
| smile | smile, happy… |
| mouth | mouthOpen, jawOpen… |
| startle / silk-reveal | surprised |
| bored / look-down | sad |
| pride / smolder | angry |

Hollow’s robot demonstrates Surprised / Sad / Angry.

---

## Export checklist (Blender → GLB)

- ~1.6–1.8 m tall, meters, applied scale  
- Armature + short one-shot clips + looping idle  
- Optional morphs: blink, smile, mouthOpen, surprised, sad, angry  
- Prefer &lt; 8 MB for tablets  
- Drop file in `public/models/`, set `model3d` on the portrait  

---

## Performance

| Mode | Behavior |
|------|----------|
| Low | Auto → 2D |
| Balanced / High | Auto → 3D if `model3d` set |
| 3D cast | Force 3D |
| Painted | Force 2D |
| Low FPS (Auto) | Session fallback to 2D |

Three.js is code-split (`OilBustCanvas` lazy chunk).

---

## Roadmap

| Phase | Status |
|-------|--------|
| 0 Spike | Done |
| 1 Clips + oil grade | Done |
| 2 JSON map, paint mats, morphs, FPS fallback | Done |
| 3 Multi-cast + face cards + free model pack | Done |
| 4 Custom oil-painted GLBs matching each portrait | Future |
