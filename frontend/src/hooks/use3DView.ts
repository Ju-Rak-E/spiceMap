import { useState, useEffect, useCallback, useRef, type MutableRefObject } from 'react'
import type maplibregl from 'maplibre-gl'
import { interpolateProgress, type HeightMetric } from '../utils/threeDUtils'

export type { HeightMetric }
export type ThreeDMode = 'off' | 'commerce'

export interface BoundaryFeature {
  comm_id: string
  polygon: number[][]
}

export interface Use3DViewReturn {
  mode: ThreeDMode
  metric: HeightMetric
  extrudeProgress: number
  setMode: (m: ThreeDMode) => void
  setMetric: (m: HeightMetric) => void
  boundaries: BoundaryFeature[] | null
}

const EXTRUDE_IN_MS = 600
const EXTRUDE_OUT_MS = 300

export function use3DView(
  mapRef: MutableRefObject<maplibregl.Map | null>,
): Use3DViewReturn {
  const [mode, setModeState] = useState<ThreeDMode>('off')
  const [metric, setMetric] = useState<HeightMetric>('griScore')
  const [boundaries, setBoundaries] = useState<BoundaryFeature[] | null>(null)
  const [extrudeProgress, setExtrudeProgress] = useState(0)
  const progressRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/data/mock_commerce_boundary.geojson')
      .then((r) => r.json())
      .then((geojson: { features: Array<{ properties: { comm_id: string }; geometry: { type: string; coordinates: unknown } }> }) => {
        if (cancelled) return
        const parsed: BoundaryFeature[] = geojson.features.map((f) => ({
          comm_id: f.properties.comm_id,
          polygon:
            f.geometry.type === 'Polygon'
              ? (f.geometry.coordinates as number[][][])[0]
              : (f.geometry.coordinates as number[][][][])[0][0],
        }))
        setBoundaries(parsed)
      })
      .catch(() => { if (!cancelled) setBoundaries([]) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const setMode = useCallback(
    (newMode: ThreeDMode) => {
      setModeState(newMode)

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      const target = newMode !== 'off' ? 1 : 0
      const duration = newMode !== 'off' ? EXTRUDE_IN_MS : EXTRUDE_OUT_MS
      const startProgress = progressRef.current
      const startTime = performance.now()

      const tick = () => {
        const elapsed = performance.now() - startTime
        const value = interpolateProgress(startProgress, target, elapsed, duration)
        progressRef.current = value
        setExtrudeProgress(value)
        if (elapsed < duration) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          rafRef.current = null
        }
      }
      rafRef.current = requestAnimationFrame(tick)

      const map = mapRef.current
      if (!map) return
      if (newMode !== 'off') {
        map.flyTo({ pitch: 45, bearing: -20, duration: 800 })
      } else {
        map.flyTo({ pitch: 0, bearing: 0, duration: 600 })
      }
    },
    [mapRef],
  )

  return { mode, metric, extrudeProgress, setMode, setMetric, boundaries }
}
