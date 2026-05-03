import { useEffect, useState } from 'react'

export interface ViewportMode {
  isTablet: boolean
  isNarrow: boolean
}

function readViewportMode(): ViewportMode {
  if (typeof window === 'undefined') return { isTablet: false, isNarrow: false }
  return {
    isTablet: window.innerWidth <= 1100,
    isNarrow: window.innerWidth <= 820,
  }
}

export function useViewportMode(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>(() => readViewportMode())

  useEffect(() => {
    const update = () => setMode(readViewportMode())
    window.addEventListener('resize', update)
    update()
    return () => window.removeEventListener('resize', update)
  }, [])

  return mode
}
