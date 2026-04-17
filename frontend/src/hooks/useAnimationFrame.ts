import { useEffect, useRef } from 'react'

/** RAF 루프를 관리하는 훅. callback은 최신 레퍼런스를 유지하므로 useCallback 불필요. */
export function useAnimationFrame(callback: (deltaMs: number) => void): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    let rafId: number
    let lastTime = 0

    const loop = (time: number) => {
      const delta = lastTime === 0 ? 16 : time - lastTime
      lastTime = time
      callbackRef.current(delta)
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [])
}
