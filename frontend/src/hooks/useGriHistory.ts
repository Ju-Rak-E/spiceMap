import { useState, useEffect } from 'react'

export interface GriPoint {
  ts: string   // "YYYY-MM"
  gri: number
}

export interface UseGriHistoryReturn {
  series: GriPoint[]
  isLoading: boolean
  error: string | null
}

export function buildGriSeries(raw: GriPoint[]): GriPoint[] {
  return [...raw].sort((a, b) => a.ts.localeCompare(b.ts))
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

async function fetchGriHistory(nodeId: string): Promise<GriPoint[]> {
  if (BASE_URL) {
    try {
      const res = await fetch(`${BASE_URL}/api/gri/history?nodeId=${encodeURIComponent(nodeId)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<GriPoint[]>
    } catch {
      // API 실패 → mock 폴백
    }
  }

  const mockRes = await fetch('/data/mock_gri_history.json')
  if (!mockRes.ok) throw new Error('mock GRI 데이터를 불러오지 못했습니다')
  const all = (await mockRes.json()) as Record<string, GriPoint[]>
  return all[nodeId] ?? all['__default__'] ?? []
}

export function useGriHistory(nodeId: string | null): UseGriHistoryReturn {
  const [series, setSeries] = useState<GriPoint[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!nodeId) {
      setSeries([])
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    fetchGriHistory(nodeId)
      .then((raw) => {
        setSeries(buildGriSeries(raw))
        setIsLoading(false)
      })
      .catch(() => {
        setError('GRI 데이터를 불러오지 못했습니다')
        setIsLoading(false)
      })
  }, [nodeId])

  return { series, isLoading, error }
}
