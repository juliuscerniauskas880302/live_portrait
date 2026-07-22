# Live Portrait — Project Documentation

Harry Potter–style **moving oil portraits** for DIY wall canvases.  
Run as a fullscreen PWA on old Android tablets mounted in picture frames.

---

## 1. Vision

**Furniture, not an app.** Almost no chrome. Irregular micro-motion so paintings never feel like a short GIF. Day and night atmospheres, optional ambient sound, rare magical surprises. Built to run for hours on weak WebViews while plugged into power.

---

## 2. Quick start

```bash
npm install
npm run dev      # local development
npm run build    # production → dist/
npm run preview  # serve dist/
```

### Tablet install

1. Serve `dist/` on your LAN (or any static host).
2. Open in Chrome on the tablet → **Add to Home Screen**.
3. Settings (long-press) → Performance **Low** or **Balanced**.
4. Plug into power; optional: Android *Stay awake while charging*.
5. Mount in a physical frame; use **Fullscreen** layout if the frame is ornate.

---

## 3. Gestures (wall-mounted)

| Gesture | Action |
|--------|--------|
| **Tap** (center) | Portrait **acknowledges**: blink → look toward you → smile → soft nod |
| **Double-tap** | Wink + toggle ambient sound |
| **Left / right edge** (~14% of screen) | Previous / next portrait |
| **Hold ~1.1 s** | Open chamber settings |

**Tap feedback:** a brief warm flash confirms the tap registered.  
**Long-press** opens settings and does *not* also fire a tap.

Audio unlocks on first gesture (browser autoplay rules).

---

## 4. Feature overview

### 4.1 Portraits

- Cast in three tones: **Classic**, **Creepy**, **Seductive** (includes Lady Lysandra’s after-bath study)
- Painted multi-frame life (not SVG fake eyelids):
  - Open eyes (base)
  - Closed eyes (blink / wink)
  - Smile (optional)
  - Mouth murmur (optional)
- **Night outfits** (6 seductive portraits): Isolde, Célestine, Briarwyn, Nymeris, Vespera, Rouge switch to more revealing deep-neckline / off-shoulder night attire when theme is Night

### 4.2 Motion director

Irregular, hold-heavy motion:

- Blink / double-blink / wink  
- Breath scale, head turn / nod, gaze drift  
- Mouth murmur + smile envelopes  
- **Micro-moments** (tone-aware): glance, long stare, almost-speak, soft laugh, startle, pride, bored, invitation  
- **Acknowledge choreography** on tap  

### 4.2b 3D cast (optional)

- Settings: **Portrait engine** = Auto / Painted / **3D cast**  
- Free glTF pilots: **Ashwick** (Xbot), **Knight** (Soldier), **Hollow** (RobotExpressive)  
- Motion director → idle/moment clips, head bones, morphs, painted **face card**  
- Runtime clip map: `public/models/clip-map.json`; registry: `manifest.json`  
- Low-FPS session auto-fallback to painted 2D (Auto mode)  
- See `docs/3D_PORTRAITS.md`  




### 4.3 Atmosphere

- Day / Night grade (Auto by clock: day 07:00, night 20:00, overridable)  
- Candle flame sprite (night)  
- Beam-biased dust motes  
- Oil shimmer + eye catchlights (High performance)  
- Frame gold specular crawl, nameplate glow, rare frame knock  
- Oil-dissolve **portrait transitions** (~1.9 s)  

### 4.4 Audio (MP3 only)

All sounds are real Mixkit free MP3 files under `public/sounds/` — no procedural synthesis.

| Role | Examples |
|------|----------|
| Day bed | birds |
| Night bed | fire-loop |
| Steps | footsteps-wood / soft / stone |
| Soft events | sigh, chime, cloth |
| Eggs | creak, door, whisper, whoosh, wind, horror |

See `public/sounds/ATTRIBUTION.md`.

### 4.5 Night easter eggs

With **Quiet surprises** on and theme **Night** (rare, ~1.5–4.5 min):

- Footsteps pass the frame  
- Floor / door creaks  
- Soft whisper  
- Candle flare / blackout  
- Unprompted wink  

### 4.6 Layouts

| Layout | Description |
|--------|-------------|
| **Framed** | Ornate digital frame + nameplate (default) |
| **Fullscreen** | Edge-to-edge painting (use with physical frame) |
| **Gallery** | All portraits on a wall; tap one to focus + acknowledge |

### 4.7 Performance & accessibility

| Mode | Behavior |
|------|----------|
| **Low** | Blink + head; no particles, no flame, no smile load |
| **Balanced** | + mouth frames, particles, catchlights |
| **High** | + smile frames, oil shimmer, richer grain |

- **Intensity:** Still → Subtle → Lively → Enchanted  
- **Reduce motion:** caps life, disables surprises  
- **Idle (~3 min):** slight dim + slower motion  
- **Wake Lock** when supported  
- **PWA** offline shell + asset precache  

### 4.8 Portrait cycle

Settings → **Change portrait every**: Off · 30s · 1m · 2m · 5m · 10m  
Paused in gallery, settings, or hidden tab.

---

## 5. Architecture

```
src/
  App.tsx                 # boot fade, wake lock, reduced-motion
  store/useAppStore.ts    # Zustand + localStorage prefs
  types/portrait.ts       # PortraitDef, motion, settings types
  data/portraits.ts       # cast, paths, playlist
  engine/
    motionDirector.ts     # blinks, moments, acknowledge
    microMoments.ts       # named beat table
    audioEngine.ts        # MP3 beds + one-shots
    atmosphereDirector.ts # frame glow / knock
    nightEasterEggs.ts    # night-only surprises
  components/
    Stage/                # Stage, frame, light, particles, gallery
    portraits/            # LivingPortrait, OilLifeCanvas
    Settings/             # long-press sheet
    UI/                   # toast, first-run hint
  hooks/                  # idle, parallax, wake lock, night eggs
public/
  portraits/              # JPG open/closed/smile/mouth/night frames
  sounds/                 # Mixkit MP3s + ATTRIBUTION.md
docs/
  PROJECT.md              # this file
```

### Data flow (tap)

1. `Stage` captures pointer → `handleTap`  
2. `acknowledge(gaze)` in store  
3. `motionDirector.playAcknowledge()` runs blink → gaze → smile → nod  
4. `OilLifeCanvas` reads motion state each frame and blends painted frames  

### Theme resolution

`themeMode`: `auto` | `day` | `night`  
`resolvedTheme`: derived from clock when auto.

Night frames: if `imageNight` exists and `resolvedTheme === 'night'`, open/closed swap to night assets.

---

## 6. Settings (Chamber Controls)

Long-press anywhere.

| Section | Options |
|---------|---------|
| Theme | Auto / Day / Night |
| Layout | Framed / Canvas / Gallery |
| Life | Still / Subtle / Lively / Enchanted |
| Change portrait every | Off … 10m |
| Portrait gallery | Grouped by Classic / Creepy / Seductive |
| Ambient sound + volume | Master mute / level |
| Reduce motion | On/off |
| Nameplate | On/off |
| Quiet surprises | On/off |
| Performance | Low / Balanced / High |

Preferences persist in `localStorage` key `live-portrait-settings`.

---

## 7. Asset conventions

Per portrait id `{id}` under `public/portraits/`:

| File | Required |
|------|----------|
| `{id}.jpg` | Yes — open eyes |
| `{id}-closed.jpg` | Yes — blink |
| `{id}-smile.jpg` | Optional |
| `{id}-mouth.jpg` | Optional |
| `{id}-night.jpg` | Optional night outfit |
| `{id}-night-closed.jpg` | Optional |

Register paths in `src/data/portraits.ts` and add id to `PortraitId` + `PLAYLIST`.

**Paint rule:** same crop, lighting, and pose; change only eyes/mouth/outfit as needed so crossfades do not ghost.

---

## 8. Tech stack

| Layer | Choice |
|-------|--------|
| Build | Vite + React 19 + TypeScript |
| State | Zustand (persist) |
| Motion | Custom rAF directors + canvas paint stack |
| Audio | Web Audio API decoding **MP3 only** |
| PWA | vite-plugin-pwa / Workbox |

No WebGL, no Three.js — CSS + one canvas for portrait life + one for particles.

---

## 9. DIY hardware tips

- Always-on power  
- Dark room helps night mode  
- Physical ornate frame + app **Fullscreen** is very convincing  
- Prefer mid-2010s+ Android with updated Chrome  
- First run: pick performance mode for your tablet  

---

## 10. Known limits & future ideas

**Current limits**

- Not every classic/creepy portrait has smile/mouth paint yet (director is ready)  
- Night outfits only for five salon women  
- No multi-tablet “portraits notice each other” yet  

**Strong next steps**

- Complete expression packs for all IDs  
- Gallery cross-portrait glances  
- Depth-map parallax / short video breath loops on High  

---

## 11. License / credits

- App code: personal / DIY use  
- Portrait art: original Imagine-generated oil portraits (fictional characters)  
- Sounds: Mixkit free license — see `public/sounds/ATTRIBUTION.md`  
- Not affiliated with Warner Bros. or J.K. Rowling  

---

## 12. Troubleshooting

| Issue | Fix |
|-------|-----|
| Tap seems to do nothing | Look for blink + warm flash; ensure Life ≠ Still; try center of screen (not edges) |
| No sound | Double-tap to enable; first tap unlocks audio; check system volume |
| Portrait doesn’t change outfit at night | Only 5 salon portraits have night assets; set Theme → Night |
| Stutter on old tablet | Performance → Low; Intensity → Subtle |
| Screen sleeps | Wake Lock needs support; use Android stay-awake while charging |
| Settings won’t open | Hold ~1 second without sliding finger |

---

*Live Portrait — wall canvas for living paintings.*
