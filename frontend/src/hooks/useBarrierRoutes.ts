import { useEffect, useState } from 'react'

export interface BarrierRoute {
  barrierId: string
  sourceId: string
  targetId: string
  path: [number, number][]
  distanceM?: number | null
  durationS?: number | null
  source: string
}

interface BarrierRoutesResponse {
  quarter: string
  total: number
  routes: BarrierRoute[]
  from_cache?: boolean
  cache_warning?: string | null
}

export interface UseBarrierRoutesReturn {
  routes: BarrierRoute[]
  isLoading: boolean
  error: string | null
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
const MOCK_ROUTE_URL = '/data/mock_barrier_routes.json'

function normalizeRoutes(response: BarrierRoutesResponse): BarrierRoute[] {
  return response.routes
    .filter((route) => Array.isArray(route.path) && route.path.length >= 2)
    .map((route) => ({
      ...route,
      path: route.path.map(([lng, lat]) => [lng, lat] as [number, number]),
    }))
}

async function fetchMockRoutes(): Promise<BarrierRoute[]> {
  const res = await fetch(MOCK_ROUTE_URL)
  if (!res.ok) return []
  return normalizeRoutes((await res.json()) as BarrierRoutesResponse)
}

async function fetchBarrierRoutes(quarter: string): Promise<BarrierRoute[]> {
  const params = new URLSearchParams({ quarter })
  try {
    const res = await fetch(`${BASE_URL}/api/barrier-routes?${params.toString()}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return normalizeRoutes((await res.json()) as BarrierRoutesResponse)
  } catch {
    return fetchMockRoutes()
  }
}

export function useBarrierRoutes(quarter = '2025Q4', enabled = false): UseBarrierRoutesReturn {
  const [routes, setRoutes] = useState<BarrierRoute[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!enabled) {
      setRoutes([])
      setIsLoading(false)
      setError(null)
      return () => {
        cancelled = true
      }
    }

    queueMicrotask(() => {
      if (cancelled) return
      setIsLoading(true)
      setError(null)
    })

    fetchBarrierRoutes(quarter)
      .then((data) => {
        if (cancelled) return
        setRoutes(data)
        setIsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setRoutes([])
        setError('Barrier route data is unavailable')
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled, quarter])

  return { routes, isLoading, error }
}
