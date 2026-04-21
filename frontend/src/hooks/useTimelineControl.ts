import { useState, useEffect, useRef, useCallback } from 'react'

export type TimelineSpeed = 1 | 2 | 4

export function getNextHour(hour: number): number {
  return (hour + 1) % 24
}

export function getIntervalMs(speed: TimelineSpeed): number {
  return Math.round(1000 / speed)
}

export interface UseTimelineControlReturn {
  isPlaying: boolean
  speed: TimelineSpeed
  play: () => void
  pause: () => void
  toggleSpeed: () => void
}

const SPEED_CYCLE: TimelineSpeed[] = [1, 2, 4]

export function useTimelineControl(
  hour: number,
  onHourChange: (h: number) => void,
): UseTimelineControlReturn {
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<TimelineSpeed>(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hourRef = useRef(hour)

  useEffect(() => {
    hourRef.current = hour
  }, [hour])

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const play = useCallback(() => setIsPlaying(true), [])
  const pause = useCallback(() => {
    setIsPlaying(false)
    clearTimer()
  }, [clearTimer])

  const toggleSpeed = useCallback(() => {
    setSpeed(prev => {
      const idx = SPEED_CYCLE.indexOf(prev)
      return SPEED_CYCLE[(idx + 1) % SPEED_CYCLE.length] ?? 1
    })
  }, [])

  useEffect(() => {
    if (!isPlaying) {
      clearTimer()
      return
    }

    clearTimer()
    intervalRef.current = setInterval(() => {
      onHourChange(getNextHour(hourRef.current))
    }, getIntervalMs(speed))

    return clearTimer
  }, [isPlaying, speed, clearTimer, onHourChange])

  return { isPlaying, speed, play, pause, toggleSpeed }
}
