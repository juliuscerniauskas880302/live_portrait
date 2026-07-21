import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'

export function FirstRunHint() {
  const firstRunDone = useAppStore((s) => s.firstRunDone)
  const completeFirstRun = useAppStore((s) => s.completeFirstRun)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (firstRunDone) return
    const show = window.setTimeout(() => setVisible(true), 10_000)
    const hide = window.setTimeout(() => {
      setVisible(false)
      completeFirstRun()
    }, 18_000)
    return () => {
      clearTimeout(show)
      clearTimeout(hide)
    }
  }, [firstRunDone, completeFirstRun])

  if (firstRunDone || !visible) return null

  return (
    <div className="first-run-hint" aria-live="polite">
      <p>Hold to open settings</p>
      <p className="hint-sub">Tap to wake · edges change portrait · double-tap sound</p>
    </div>
  )
}
