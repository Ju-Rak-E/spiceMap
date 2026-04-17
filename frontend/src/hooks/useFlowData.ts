import { useState, useEffect } from 'react'

export type FlowPurpose = '출근' | '쇼핑' | '여가' | '귀가'

export interface ODFlow {
  id: string
  sourceId: string
  targetId: string
  sourceCoord: [number, number]
  targetCoord: [number, number]
  volume: number
  purpose: FlowPurpose
}

// 목적별 피크 시간대 중심 (24시간제)
const PEAK_HOUR: Record<FlowPurpose, number> = {
  출근: 8,   // 07~09시
  쇼핑: 14,  // 12~17시
  여가: 20,  // 18~22시
  귀가: 19,  // 18~20시
}

const SIGMA = 1.5

export function getHourScale(purpose: FlowPurpose, hour: number): number {
  const peak = PEAK_HOUR[purpose]
  const exponent = -((hour - peak) ** 2) / (2 * SIGMA ** 2)
  return Math.max(0.1, Math.exp(exponent))
}

export interface FlowFilters {
  purpose?: FlowPurpose | null
  topN?: number
  hour?: number
}

export interface FlowStats {
  totalVolume: number
  activeCount: number
  topInflow: string | null
  topOutflow: string | null
}

export interface UseFlowDataReturn extends FlowStats {
  flows: ODFlow[]
  isLoading: boolean
  error: string | null
}

export function filterFlows(flows: ODFlow[], filters: FlowFilters): ODFlow[] {
  let result = flows

  if (filters.purpose) {
    result = result.filter(f => f.purpose === filters.purpose)
  }

  if (filters.hour !== undefined) {
    result = result.map(f => ({
      ...f,
      volume: Math.round(f.volume * getHourScale(f.purpose, filters.hour!)),
    }))
  }

  if (filters.topN !== undefined && filters.topN > 0) {
    result = [...result].sort((a, b) => b.volume - a.volume).slice(0, filters.topN)
  }

  return result
}

export function computeStats(flows: ODFlow[]): FlowStats {
  if (flows.length === 0) {
    return { totalVolume: 0, activeCount: 0, topInflow: null, topOutflow: null }
  }

  const totalVolume = flows.reduce((sum, f) => sum + f.volume, 0)
  const activeCount = flows.length

  const inflowByTarget = new Map<string, number>()
  const outflowBySource = new Map<string, number>()

  for (const flow of flows) {
    inflowByTarget.set(flow.targetId, (inflowByTarget.get(flow.targetId) ?? 0) + flow.volume)
    outflowBySource.set(flow.sourceId, (outflowBySource.get(flow.sourceId) ?? 0) + flow.volume)
  }

  const topInflow = [...inflowByTarget.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const topOutflow = [...outflowBySource.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return { totalVolume, activeCount, topInflow, topOutflow }
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

async function fetchFlows(): Promise<ODFlow[]> {
  if (BASE_URL) {
    try {
      const res = await fetch(`${BASE_URL}/api/od/flows`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<ODFlow[]>
    } catch {
      // API 실패 시 mock 폴백
    }
  }

  const mockRes = await fetch('/data/mock_flows.json')
  if (!mockRes.ok) throw new Error(`HTTP ${mockRes.status}`)
  return mockRes.json() as Promise<ODFlow[]>
}

export function useFlowData(filters: FlowFilters = {}): UseFlowDataReturn {
  const [allFlows, setAllFlows] = useState<ODFlow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    fetchFlows()
      .then(data => {
        setAllFlows(data)
        setIsLoading(false)
      })
      .catch(() => {
        setError('흐름 데이터를 불러오지 못했습니다')
        setIsLoading(false)
      })
  }, [])

  const flows = filterFlows(allFlows, filters)
  const stats = computeStats(flows)

  return { flows, isLoading, error, ...stats }
}
