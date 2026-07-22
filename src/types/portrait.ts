export type ThemeMode = 'auto' | 'day' | 'night'
export type ResolvedTheme = 'day' | 'night'
export type PerformanceMode = 'low' | 'balanced' | 'high'
export type IntensityLevel = 'still' | 'subtle' | 'lively' | 'enchanted'
export type LayoutMode = 'fullscreen' | 'framed' | 'gallery'
export type AppPhase = 'boot' | 'ambient' | 'attentive' | 'settings' | 'sleep'

export type PortraitId =
  | 'alchemist'
  | 'enchantress'
  | 'knight'
  | 'scholar'
  | 'ravenkeeper'
  | 'astronomer'
  | 'nightshade'
  | 'hollow'
  | 'whisperer'
  | 'baron'
  | 'vespera'
  | 'ashwick'
  | 'rouge'
  | 'isolde'
  | 'celestine'
  | 'briarwyn'
  | 'nymeris'
  | 'seraphina'
  | 'camille'
  | 'thalia'
  | 'lysandra'
  | 'ophelia'
  | 'lucien'
  | 'morgaine'

export type PortraitTone = 'classic' | 'creepy' | 'seductive'

/** Auto-cycle interval in seconds; 0 = off */
export type AutoRotateSec = 0 | 30 | 60 | 120 | 300 | 600

export interface PortraitDef {
  id: PortraitId
  name: string
  title: string
  era: string
  accent: string
  skin: string
  hair: string
  robe: string
  robeDark: string
  eyeColor: string
  background: string
  backgroundNight: string
  mood: string
  tone: PortraitTone
  /** Open-eye oil portrait (public/) */
  image: string
  /** Matching closed-eye frame for true blink crossfade */
  imageClosed: string
  /** Soft smile expression (optional) */
  imageSmile?: string
  /** Slightly parted lips for murmur (optional) */
  imageMouth?: string
  /** Night outfit (more intimate salon attire) — optional */
  imageNight?: string
  imageNightClosed?: string
  imageNightSmile?: string
  imageNightMouth?: string
  /**
   * Progressive pose frames (e.g. silk drape / hand gesture sequence).
   * Crossfaded by motion.pose 0→1 during rare reveal moments.
   */
  imagePose?: string[]
  /**
   * Optional glTF/GLB for 3D oil-bust renderer (public/ path).
   * When set and 3D engine is enabled, used instead of 2D frame stack.
   */
  model3d?: string
  /**
   * Optional per-portrait animation clip preferences.
   * Keys are motion cues (idle, acknowledge, micro-moment ids);
   * values are ordered GLB clip name fragments to match.
   */
  model3dClipMap?: Partial<Record<string, string[]>>
  /** Narrative backstory / lore for storytelling */
  lore?: string
  /** Whispered secret quote */
  quote?: string
}

/** How the living portrait is drawn */
export type PortraitEngine = 'auto' | '2d' | '3d'

export interface GazeTarget {
  x: number // -1 left … 1 right
  y: number // -1 up … 1 down
}

export interface MotionState {
  blink: number // 0 open … 1 closed
  breath: number // 0–1 phase output
  headRotate: number // degrees
  headTilt: number
  gaze: GazeTarget
  mouth: number // 0 rest … 1 open slightly (mouth frame weight)
  expressionSmile: number // 0 rest … 1 smile frame weight
  acknowledging: boolean
  wink: boolean
  /** Soft upper-face brighten 0–1 (acknowledge / invitation) */
  eyeBrighten: number
  /** Long empty stare intensity 0–1 */
  longStare: number
  /**
   * Progressive pose blend 0–1 across imagePose frames
   * (0 = base open, 1 = final pose).
   */
  pose: number
  /** Active micro-moment id if any */
  activeMoment: string | null
}

/** Ambient frame / plaque life (atmosphere director) */
export interface FrameLifeState {
  nameplateGlow: number
  knock: boolean
  specularBoost: number
  lightning: number
}

export interface AppSettings {
  themeMode: ThemeMode
  performanceMode: PerformanceMode
  intensity: IntensityLevel
  layout: LayoutMode
  audioEnabled: boolean
  volume: number
  reducedMotion: boolean
  showFrame: boolean
  showNameplate: boolean
  dayStartHour: number
  nightStartHour: number
  surpriseEnabled: boolean
  thunderstormEnabled: boolean
  firstRunDone: boolean
  /** Portrait auto-advance interval in seconds (0 = off) */
  autoRotateSec: AutoRotateSec
  /**
   * auto = 3D when portrait has model3d and performance is not low;
   * 2d / 3d force the renderer.
   */
  portraitEngine: PortraitEngine
  /**
   * When true, 3D was auto-disabled this session due to low FPS.
   * Not persisted — resets on full reload.
   */
  model3dFpsFallback?: boolean
}

export interface AppStore extends AppSettings {
  resolvedTheme: ResolvedTheme
  phase: AppPhase
  currentPortraitId: PortraitId
  playlist: PortraitId[]
  idle: boolean
  settingsOpen: boolean
  lastInteractionAt: number
  toast: string | null
  parallax: { x: number; y: number }
  motion: MotionState
  frameLife: FrameLifeState
  /** Outgoing portrait during oil-dissolve transition */
  transitionFromId: PortraitId | null
  /** Bumps when user manually changes portrait — resets auto-rotate timer */
  rotateNonce: number

  setThemeMode: (mode: ThemeMode) => void
  setPerformanceMode: (mode: PerformanceMode) => void
  setIntensity: (level: IntensityLevel) => void
  setLayout: (layout: LayoutMode) => void
  setAudioEnabled: (on: boolean) => void
  setVolume: (v: number) => void
  setReducedMotion: (on: boolean) => void
  setShowFrame: (on: boolean) => void
  setShowNameplate: (on: boolean) => void
  setSurpriseEnabled: (on: boolean) => void
  setThunderstormEnabled: (on: boolean) => void
  setAutoRotateSec: (sec: AutoRotateSec) => void
  setPortraitEngine: (engine: PortraitEngine) => void
  /** Session-only: drop to 2D after sustained low FPS in 3D */
  triggerModel3dFpsFallback: () => void
  clearModel3dFpsFallback: () => void
  setResolvedTheme: (t: ResolvedTheme) => void
  setPhase: (p: AppPhase) => void
  setPortrait: (id: PortraitId) => void
  nextPortrait: () => void
  prevPortrait: () => void
  setIdle: (idle: boolean) => void
  openSettings: () => void
  closeSettings: () => void
  touch: () => void
  showToast: (msg: string) => void
  clearToast: () => void
  setParallax: (x: number, y: number) => void
  setMotion: (partial: Partial<MotionState>) => void
  setFrameLife: (partial: Partial<FrameLifeState>) => void
  acknowledge: (gaze?: GazeTarget) => void
  beginTransition: (from: PortraitId) => void
  endTransition: () => void
  completeFirstRun: () => void
}
