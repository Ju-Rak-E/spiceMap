import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { type MapTheme } from '../styles/tokens'
import { BoundaryLayerManager } from '../utils/BoundaryLayerManager'

interface AdminBoundaryLayerProps {
  map: maplibregl.Map
  theme?: MapTheme
  districtFilter?: string | null
}

export default function AdminBoundaryLayer({
  map,
  theme = 'light',
  districtFilter,
}: AdminBoundaryLayerProps) {
  const managerRef = useRef<BoundaryLayerManager | null>(null)

  useEffect(() => {
    const manager = new BoundaryLayerManager(map, theme, districtFilter ?? null)
    managerRef.current = manager

    return () => {
      managerRef.current = null
      manager.destroy()
    }
  }, [map])

  useEffect(() => {
    managerRef.current?.setTheme(theme)
  }, [theme])

  useEffect(() => {
    managerRef.current?.setDistrictFilter(districtFilter ?? null)
  }, [districtFilter])

  return null
}
