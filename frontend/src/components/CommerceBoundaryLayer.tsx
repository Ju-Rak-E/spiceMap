import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { type MapTheme } from '../styles/tokens'
import { CommerceBoundaryLayerManager } from '../utils/CommerceBoundaryLayerManager'
import type { CommerceTypeMapResponse } from '../types/commerce'

interface CommerceBoundaryLayerProps {
  map: maplibregl.Map
  theme?: MapTheme
  selectedId?: string | null
  quarter?: string
  districts?: readonly string[]
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
const FALLBACK_BOUNDARY_URL = '/data/mock_commerce_boundary.geojson'

async function fetchCommerceBoundary(quarter: string, districts: readonly string[]) {
  if (districts.length === 0) throw new Error('No districts selected')

  const responses = await Promise.all(districts.map(async (district) => {
    const params = new URLSearchParams({ quarter, gu: district })
    const res = await fetch(`${API_BASE}/api/commerce/type-map?${params.toString()}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as CommerceTypeMapResponse
  }))

  const features = responses.flatMap((response) => response.features)
  if (features.length === 0) throw new Error('No commerce boundary features')

  return {
    type: 'FeatureCollection' as const,
    features,
  } as unknown as NonNullable<maplibregl.GeoJSONSourceSpecification['data']>
}

export default function CommerceBoundaryLayer({
  map,
  theme = 'dark',
  selectedId = null,
  quarter = '2025Q4',
  districts = [],
}: CommerceBoundaryLayerProps) {
  const managerRef = useRef<CommerceBoundaryLayerManager | null>(null)
  const districtKey = districts.join('|')

  useEffect(() => {
    const manager = new CommerceBoundaryLayerManager(map, theme, selectedId)
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
    managerRef.current?.setSelectedId(selectedId)
  }, [selectedId])

  useEffect(() => {
    let cancelled = false

    const activeDistricts = districtKey ? districtKey.split('|') : []

    fetchCommerceBoundary(quarter, activeDistricts)
      .then((data) => {
        if (!cancelled) managerRef.current?.setData(data)
      })
      .catch(() => {
        if (!cancelled) managerRef.current?.setData(FALLBACK_BOUNDARY_URL)
      })

    return () => {
      cancelled = true
    }
  }, [districtKey, quarter])

  return null
}
