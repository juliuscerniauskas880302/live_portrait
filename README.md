# Live Portrait

Harry Potter–style **moving oil portraits** for DIY wall canvases.  
Fullscreen PWA for old Android tablets in picture frames — blink, breathe, glance, day/night, ambient hall sound.

**Full documentation:** [docs/PROJECT.md](docs/PROJECT.md)

## Quick start

```bash
npm install
npm run dev
npm run build && npm run preview
```

On the tablet: open the site → **Add to Home Screen** → long-press for settings → pick **Low/Balanced** performance.

## Gestures

| Gesture | Action |
|--------|--------|
| **Tap** | Acknowledge you (blink → look → smile → nod) |
| **Double-tap** | Wink + mute/unmute sound |
| **Left / right edge** | Change portrait |
| **Hold ~1s** | Settings |

## Highlights

- 15 living portraits (classic / creepy / seductive)
- Multi-frame paint life (blink, smile, mouth) + head/breath motion
- Micro-moments & acknowledge choreography
- Day/Night + night outfits (selected salon cast)
- MP3 footsteps, fire, creaks (Mixkit) — no generated synth audio
- Night easter eggs, oil dissolve transitions, candle flame, frame life
- PWA offline shell, wake lock, performance tiers

## Project layout

```
src/engine/     motion, audio, atmosphere, easter eggs
src/components/ Stage, portraits, settings
public/portraits/  oil frames
public/sounds/     MP3 + ATTRIBUTION.md
docs/PROJECT.md    full product & technical docs
```

## License

Personal / DIY use. Original characters and art. Sounds: Mixkit free license.  
Not affiliated with Warner Bros. or J.K. Rowling.
