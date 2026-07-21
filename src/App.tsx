import { useEffect, useState } from 'react'
import { Stage } from './components/Stage/Stage'
import { useIdlePresence } from './hooks/useIdlePresence'
import { useParallax } from './hooks/useParallax'
import { useWakeLock } from './hooks/useWakeLock'
import { useAppStore } from './store/useAppStore'
import './index.css'

export default function App() {
  const [booting, setBooting] = useState(true)
  const settingsOpen = useAppStore((s) => s.settingsOpen)

  useIdlePresence()
  useParallax()
  useWakeLock(!settingsOpen)

  useEffect(() => {
    const id = window.setTimeout(() => setBooting(false), 1600)
    return () => clearTimeout(id)
  }, [])

  // Prefer reduced motion from OS
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => {
      if (mq.matches) useAppStore.getState().setReducedMotion(true)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return (
    <>
      <Stage />
      <div className={`app-boot ${booting ? '' : 'is-done'}`} aria-hidden={!booting}>
        <span>Live Portrait</span>
      </div>
    </>
  )
}
