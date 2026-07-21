import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'

export function isFullscreenActive(): boolean {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const doc = document as any
  return Boolean(
    doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement,
  )
}

export async function toggleFullscreen(): Promise<boolean> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const doc = document.documentElement as any
  const docExit = document as any

  try {
    if (!isFullscreenActive()) {
      if (doc.requestFullscreen) {
        await doc.requestFullscreen()
      } else if (doc.webkitRequestFullscreen) {
        await doc.webkitRequestFullscreen()
      } else if (doc.mozRequestFullScreen) {
        await doc.mozRequestFullScreen()
      } else if (doc.msRequestFullscreen) {
        await doc.msRequestFullscreen()
      }
      return true
    } else {
      if (docExit.exitFullscreen) {
        await docExit.exitFullscreen()
      } else if (docExit.webkitExitFullscreen) {
        await docExit.webkitExitFullscreen()
      } else if (docExit.mozCancelFullScreen) {
        await docExit.mozCancelFullScreen()
      } else if (docExit.msExitFullscreen) {
        await docExit.msExitFullscreen()
      }
      return false
    }
  } catch {
    return isFullscreenActive()
  }
}

export function FullscreenToggle() {
  const idle = useAppStore((s) => s.idle)
  const settingsOpen = useAppStore((s) => s.settingsOpen)
  const showToast = useAppStore((s) => s.showToast)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const onFSChange = () => {
      setActive(isFullscreenActive())
    }
    document.addEventListener('fullscreenchange', onFSChange)
    document.addEventListener('webkitfullscreenchange', onFSChange)
    document.addEventListener('mozfullscreenchange', onFSChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFSChange)
      document.removeEventListener('webkitfullscreenchange', onFSChange)
      document.removeEventListener('mozfullscreenchange', onFSChange)
    }
  }, [])

  if (settingsOpen) return null

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const next = await toggleFullscreen()
    setActive(next)
    showToast(next ? 'Fullscreen mode' : 'Exited fullscreen')
  }

  return (
    <button
      type="button"
      className={`fullscreen-toggle-btn ${idle ? 'is-idle' : ''} ${active ? 'is-active' : ''}`}
      onClick={handleToggle}
      title={active ? 'Exit Fullscreen' : 'Enter Fullscreen (Wall Canvas)'}
      aria-label={active ? 'Exit Fullscreen' : 'Enter Fullscreen'}
    >
      <span className="fs-icon">{active ? '🗗' : '⛶'}</span>
    </button>
  )
}
