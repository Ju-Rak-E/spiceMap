import { useState, useEffect } from 'react'
import { isDemoMode } from '../utils/demoMode'

export interface GriPoint {
  ts: string   // "YYYY-MM"
  gri: number
  flowVolume?: number | null
}

export interface BackendGriPoint {
  quarter: string
  gri_score: number | null
  flow_volume: number | null
}

export interface GriHistoryResponse {
  comm_cd: string
  comm_nm: string | null
  history: BackendGriPoint[]
}

export interface UseGriHistoryReturn {
  series: GriPoint[]
  isLoading: boolean
  error: string | null
}

export function buildGriSeries(raw: GriPoint[]): GriPoint[] {
  return [...raw].sort((a, b) => a.ts.localeCompare(b.ts))
}

export function normalizeGriHistoryResponse(response: GriHistoryResponse): GriPoint[] {
  return buildGriSeries(
    response.history
      .filter(point => point.gri_score !== null)
      .map(point => ({
        ts: point.quarter,
        gri: point.gri_score ?? 0,
        flowVolume: point.flow_volume,
      })),
  )
}

export function getPeriodRank(period: string): number {
  const quarterMatch = period.match(/^(\d{4})Q([1-4])$/)
  if (quarterMatch) {
    return Number(quarterMatch[1]) * 4 + Number(quarterMatch[2])
  }

  const monthMatch = period.match(/^(\d{4})-(\d{2})$/)
  if (monthMatch) {
    return Number(monthMatch[1]) * 4 + Math.ceil(Number(monthMatch[2]) / 3)
  }

  return Number.MAX_SAFE_INTEGER
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

async function fetchMockGriHistory(commCd: string): Promise<GriPoint[]> {
  const mockRes = await fetch('/data/mock_gri_history.json')
  if (!mockRes.ok) throw new Error('mock GRI 데이터를 불러오지 못했습니다')
  const all = (await mockRes.json()) as Record<string, GriPoint[]>
  return buildGriSeries(all[commCd] ?? all['__default__'] ?? [])
}

async function fetchGriHistory(commCd: string): Promise<GriPoint[]> {
  if (isDemoMode()) {
    return fetchMockGriHistory(commCd)
  }

  const res = await fetch(`${BASE_URL}/api/gri/history?comm_cd=${encodeURIComponent(commCd)}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as GriHistoryResponse
  return normalizeGriHistoryResponse(data)
}

export function useGriHistory(commCd: string | null, quarter = '2025Q4'): UseGriHistoryReturn {
  const [series, setSeries] = useState<GriPoint[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!commCd) {
      setSeries([])
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    fetchGriHistory(commCd)
      .then((raw) => {
        const selectedRank = getPeriodRank(quarter)
        setSeries(buildGriSeries(raw).filter(point => getPeriodRank(point.ts) <= selectedRank))
        setIsLoading(false)
      })
      .catch(() => {
        setError('GRI 데이터를 불러오지 못했습니다')
        setIsLoading(false)
      })
  }, [commCd, quarter])

  return { series, isLoading, error }
}
