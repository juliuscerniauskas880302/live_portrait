# 3D models

## Phase 4 — realistic pre-textured humans (primary cast)

Sourced from [met4citizen/TalkingHead](https://github.com/met4citizen/TalkingHead) example avatars (see their README for license notes).

| File | Origin | License notes | Role |
|------|--------|---------------|------|
| `realistic/brunette.glb` | Ready Player Me sample | **CC BY-NC 4.0** — free for non-commercial use | Female cast |
| `realistic/brunette-t.glb` | Ready Player Me sample | **CC BY-NC 4.0** | Female lite / variety |
| `realistic/avatarsdk.glb` | AvatarSDK sample | Non-commercial sample | Male cast |
| `realistic/vroid.glb` | VRoid Studio sample | Non-commercial sample | Optional stylized |

**Commercial deployment:** replace these with your own Mixamo / custom / licensed avatars. Do not assume NC samples are OK for a paid product.

## Legacy Phase 0–3 sample bodies (still in repo)

| File | Source | License |
|------|--------|---------|
| `Xbot.glb` | three.js examples | MIT |
| `Soldier.glb` | three.js examples | MIT |
| `RobotExpressive.glb` | three.js examples | MIT |

## Config

| File | Role |
|------|------|
| `clip-map.json` | Motion cue → animation clip name preferences |
| `manifest.json` | Model registry |
| `portrait-looks.json` | Per-portrait identity / sway / model override |
| `mixamo/README.md` | How to add Mixamo FBX→GLB animation packs |

## Mixamo clips (retargeted)

Animation data is taken from free Mixamo-compatible sample GLBs already in this repo:

| Source GLB | Clips used |
|------------|------------|
| `Xbot.glb` | idle, agree, headShake, sad_pose, … |
| `Soldier.glb` | Idle, Walk, Run |

Retargeted onto realistic cast meshes at runtime (quaternion tracks; hips position scaled).
