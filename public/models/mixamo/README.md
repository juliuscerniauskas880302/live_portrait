# Mixamo animation pack (recommended)

The app loads free Mixamo-rigged clips from `Xbot.glb` / `Soldier.glb` and
**retargets** them onto realistic characters (Ready Player Me / AvatarSDK)
that share the same bone names without the `mixamorig:` prefix.

## Add your own Mixamo animations

1. Open [mixamo.com](https://www.mixamo.com) (free Adobe account).
2. Pick a character **or** use “No Character” / any Mixamo humanoid for anim-only.
3. Download animations as **FBX Binary, 30 fps, without skin** (anim only) **or with skin**.
4. Good portrait clips:
   - Idle / Happy Idle / Standing Idle / Breathing Idle
   - Looking / Looking Around
   - Talking / Agreeing / Head Nod Yes
   - Rejected / Sad Idle
5. In **Blender**:
   - Import FBX
   - Optional: join onto your textured character (same Mixamo bone names)
   - File → Export → glTF 2.0 (`.glb`), include animations
6. Drop the GLB into this folder, e.g. `public/models/mixamo/looking.glb`
7. Register the path in `src/engine/mixamoAnimPack.ts` → `PACK_SOURCES`

```ts
export const PACK_SOURCES = [
  '/models/Xbot.glb',
  '/models/Soldier.glb',
  '/models/mixamo/looking.glb', // your file
] as const
```

8. Map names in `public/models/clip-map.json` if needed.

## Bone naming

| Mixamo track | RPM / many targets |
|--------------|--------------------|
| `mixamorig:Hips` | `Hips` |
| `mixamorig:LeftArm` | `LeftArm` |
| `mixamorig:Head` | `Head` |

Retarget strips the `mixamorig:` prefix automatically.

## Tips

- Prefer **in-place** standing animations (not Walk/Run) for wall portraits.
- Keep each clip under ~3 seconds for gestures; idles can loop.
- One shared anim pack serves the whole cast if they use the Mixamo skeleton.
