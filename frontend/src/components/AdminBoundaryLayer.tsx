import { useEffect, useMemo, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { type MapTheme } from '../styles/tokens'
import { BoundaryLayerManager } from '../utils/BoundaryLayerManager'

interface AdminBoundaryLayerProps {
  map: maplibregl.Map
  theme?: MapTheme
  districtFilter?: string | null
  districtFilters?: string[]
  fillOpacity?: number
}

export default function AdminBoundaryLayer({
  map,
  theme = 'light',
  districtFilter,
  districtFilters,
  fillOpacity = 0.3,
}: AdminBoundaryLayerProps) {
  const managerRef = useRef<BoundaryLayerManager | null>(null)
  const activeDistrictFilters = useMemo(
    () => districtFilters ?? (districtFilter ? [districtFilter] : []),
    [districtFilter, districtFilters],
  )

  useEffect(() => {
    const manager = new BoundaryLayerManager(map, theme, activeDistrictFilters, fillOpacity)
    managerRef.current = manager

    return () => {
      managerRef.current = null
      manager.destroy()
    }
  }, [map]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    managerRef.current?.setTheme(theme)
  }, [theme])

  useEffect(() => {
    managerRef.current?.setDistrictFilter(activeDistrictFilters)
  }, [activeDistrictFilters])

  useEffect(() => {
    managerRef.current?.setFillOpacity(fillOpacity)
  }, [fillOpacity])

  return null
}
