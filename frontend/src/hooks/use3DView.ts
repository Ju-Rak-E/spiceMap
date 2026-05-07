import { useState, useEffect, useCallback, type MutableRefObject } from 'react'
import type maplibregl from 'maplibre-gl'
import type { HeightMetric } from '../utils/threeDUtils'

export type { HeightMetric }
export type ThreeDMode = 'off' | 'polygon' | 'column'

export interface BoundaryFeature {
  comm_id: string
  polygon: number[][]
}

export interface Use3DViewReturn {
  mode: ThreeDMode
  metric: HeightMetric
  setMode: (m: ThreeDMode) => void
  setMetric: (m: HeightMetric) => void
  boundaries: BoundaryFeature[] | null
}

export function use3DView(
  mapRef: MutableRefObject<maplibregl.Map | null>,
): Use3DViewReturn {
  const [mode, setModeState] = useState<ThreeDMode>('off')
  const [metric, setMetric] = useState<HeightMetric>('griScore')
  const [boundaries, setBoundaries] = useState<BoundaryFeature[] | null>(null)

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

  const setMode = useCallback(
    (newMode: ThreeDMode) => {
      setModeState(newMode)
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

  return { mode, metric, setMode, setMetric, boundaries }
}
