import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PLAYLIST } from '../data/portraits'
import type {
  AppStore,
  AutoRotateSec,
  FrameLifeState,
  GazeTarget,
  IntensityLevel,
  LayoutMode,
  MotionState,
  PerformanceMode,
  PortraitEngine,
  PortraitId,
  ResolvedTheme,
  ThemeMode,
} from '../types/portrait'
import { motionDirector } from '../engine/motionDirector'

const defaultMotion: MotionState = {
  blink: 0,
  breath: 0,
  headRotate: 0,
  headTilt: 0,
  gaze: { x: 0, y: 0 },
  mouth: 0,
  expressionSmile: 0,
  acknowledging: false,
  wink: false,
  eyeBrighten: 0,
  longStare: 0,
  pose: 0,
  activeMoment: null,
}

const defaultFrameLife: FrameLifeState = {
  nameplateGlow: 0,
  knock: false,
  specularBoost: 0,
  lightning: 0,
}

function resolveThemeFromClock(
  mode: ThemeMode,
  dayStart: number,
  nightStart: number,
): ResolvedTheme {
  if (mode === 'day') return 'day'
  if (mode === 'night') return 'night'
  const hour = new Date().getHours()
  if (dayStart < nightStart) {
    return hour >= dayStart && hour < nightStart ? 'day' : 'night'
  }
  return hour >= dayStart || hour < nightStart ? 'day' : 'night'
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      themeMode: 'auto',
      performanceMode: 'balanced',
      intensity: 'lively',
      layout: 'framed',
      audioEnabled: false,
      volume: 0.3,
      reducedMotion: false,
      showFrame: true,
      showNameplate: true,
      dayStartHour: 7,
      nightStartHour: 20,
      surpriseEnabled: true,
      thunderstormEnabled: true,
      firstRunDone: false,
      autoRotateSec: 120 as AutoRotateSec,
      // Default auto: 3D when portrait has model3d and perf is not Low
      portraitEngine: 'auto' as PortraitEngine,
      model3dFpsFallback: false,

      resolvedTheme: resolveThemeFromClock('auto', 7, 20),
      phase: 'boot',
      currentPortraitId: 'alchemist',
      playlist: [...PLAYLIST],
      idle: false,
      settingsOpen: false,
      lastInteractionAt: Date.now(),
      toast: null,
      parallax: { x: 0, y: 0 },
      motion: { ...defaultMotion },
      frameLife: { ...defaultFrameLife },
      transitionFromId: null,
      rotateNonce: 0,

      setThemeMode: (themeMode) => {
        const { dayStartHour, nightStartHour } = get()
        set({
          themeMode,
          resolvedTheme: resolveThemeFromClock(
            themeMode,
            dayStartHour,
            nightStartHour,
          ),
        })
      },
      setPerformanceMode: (performanceMode: PerformanceMode) =>
        set({ performanceMode }),
      setIntensity: (intensity: IntensityLevel) => set({ intensity }),
      setLayout: (layout: LayoutMode) =>
        set({
          layout,
          showFrame: layout !== 'fullscreen',
        }),
      setAudioEnabled: (audioEnabled) => set({ audioEnabled }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setShowFrame: (showFrame) => set({ showFrame }),
      setShowNameplate: (showNameplate) => set({ showNameplate }),
      setSurpriseEnabled: (surpriseEnabled) => set({ surpriseEnabled }),
      setThunderstormEnabled: (thunderstormEnabled) =>
        set({ thunderstormEnabled }),
      setAutoRotateSec: (autoRotateSec: AutoRotateSec) =>
        set({ autoRotateSec, rotateNonce: get().rotateNonce + 1 }),
      setPortraitEngine: (portraitEngine: PortraitEngine) =>
        set({ portraitEngine, model3dFpsFallback: false }),
      triggerModel3dFpsFallback: () => {
        if (get().model3dFpsFallback) return
        set({ model3dFpsFallback: true })
        get().showToast('3D struggling — switched to painted view')
      },
      clearModel3dFpsFallback: () => set({ model3dFpsFallback: false }),
      setResolvedTheme: (resolvedTheme: ResolvedTheme) => set({ resolvedTheme }),
      setPhase: (phase) => set({ phase }),
      setPortrait: (currentPortraitId: PortraitId) => {
        const from = get().currentPortraitId
        if (from === currentPortraitId) return
        set({
          transitionFromId: from,
          currentPortraitId,
          rotateNonce: get().rotateNonce + 1,
          lastInteractionAt: Date.now(),
          motion: { ...get().motion, pose: 0 },
        })
        window.setTimeout(() => {
          if (useAppStore.getState().transitionFromId === from) {
            set({ transitionFromId: null })
          }
        }, 3500)
      },
      nextPortrait: () => {
        const { playlist, currentPortraitId } = get()
        const i = playlist.indexOf(currentPortraitId)
        const next = playlist[(i + 1) % playlist.length]
        get().setPortrait(next)
      },
      prevPortrait: () => {
        const { playlist, currentPortraitId } = get()
        const i = playlist.indexOf(currentPortraitId)
        const prev = playlist[(i - 1 + playlist.length) % playlist.length]
        get().setPortrait(prev)
      },
      setIdle: (idle) => set({ idle }),
      openSettings: () =>
        set({ settingsOpen: true, phase: 'settings', idle: false }),
      closeSettings: () =>
        set({
          settingsOpen: false,
          phase: 'ambient',
          lastInteractionAt: Date.now(),
          rotateNonce: get().rotateNonce + 1,
        }),
      touch: () =>
        set({
          lastInteractionAt: Date.now(),
          idle: false,
          phase: get().settingsOpen ? 'settings' : 'attentive',
        }),
      showToast: (toast) => set({ toast }),
      clearToast: () => set({ toast: null }),
      setParallax: (x, y) => {
        const prev = get().parallax
        if (Math.abs(prev.x - x) < 0.004 && Math.abs(prev.y - y) < 0.004) return
        set({ parallax: { x, y } })
      },
      setMotion: (partial) =>
        set({ motion: { ...get().motion, ...partial } }),
      setFrameLife: (partial) =>
        set({ frameLife: { ...get().frameLife, ...partial } }),
      beginTransition: (from) => set({ transitionFromId: from }),
      endTransition: () => set({ transitionFromId: null }),
      acknowledge: (gaze?: GazeTarget) => {
        const g = gaze ?? { x: 0, y: 0.05 }
        set({
          lastInteractionAt: Date.now(),
          idle: false,
          phase: 'attentive',
          motion: {
            ...get().motion,
            acknowledging: true,
            gaze: g,
          },
        })
        motionDirector.playAcknowledge(g.x, g.y)
      },
      completeFirstRun: () => set({ firstRunDone: true }),
    }),
    {
      name: 'live-portrait-settings',
      partialize: (s) => ({
        themeMode: s.themeMode,
        performanceMode: s.performanceMode,
        intensity: s.intensity,
        layout: s.layout,
        audioEnabled: s.audioEnabled,
        volume: s.volume,
        reducedMotion: s.reducedMotion,
        showFrame: s.showFrame,
        showNameplate: s.showNameplate,
        dayStartHour: s.dayStartHour,
        nightStartHour: s.nightStartHour,
        surpriseEnabled: s.surpriseEnabled,
        firstRunDone: s.firstRunDone,
        currentPortraitId: s.currentPortraitId,
        autoRotateSec: s.autoRotateSec,
        portraitEngine: s.portraitEngine,
      }),
    },
  ),
)

export function refreshThemeFromClock() {
  const { themeMode, dayStartHour, nightStartHour, setResolvedTheme } =
    useAppStore.getState()
  setResolvedTheme(
    resolveThemeFromClock(themeMode, dayStartHour, nightStartHour),
  )
}
