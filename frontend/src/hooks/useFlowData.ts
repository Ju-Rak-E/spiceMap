import { useState, useEffect } from 'react'
import { isDemoMode } from '../utils/demoMode'

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

const PEAK_HOUR: Record<FlowPurpose, number> = {
  출근: 8,
  쇼핑: 14,
  여가: 20,
  귀가: 19,
}

const SIGMA = 1.5

export function getHourScale(purpose: FlowPurpose, hour: number): number {
  const peak = PEAK_HOUR[purpose]
  const exponent = -((hour - peak) ** 2) / (2 * SIGMA ** 2)
  return Math.max(0.1, Math.exp(exponent))
}

const HOUR_WEIGHTS: Record<number, number> = {
  0: 0.10, 1: 0.08, 2: 0.05, 3: 0.05, 4: 0.10, 5: 0.20,
  6: 0.50, 7: 0.85, 8: 1.00, 9: 0.80, 10: 0.60, 11: 0.60,
  12: 0.70, 13: 0.60, 14: 0.55, 15: 0.55, 16: 0.70, 17: 0.90,
  18: 1.00, 19: 0.80, 20: 0.65, 21: 0.50, 22: 0.30, 23: 0.20,
}

export function applyHourWeight(flows: ODFlow[], hour: number): ODFlow[] {
  const weight = HOUR_WEIGHTS[hour] ?? 0.5
  return flows.map(f => ({
    ...f,
    volume: Math.max(1, Math.round(f.volume * weight)),
  }))
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

const VALID_PURPOSES = new Set<string>(['출근', '쇼핑', '여가', '귀가'])

export function filterFlows(flows: ODFlow[], filters: FlowFilters): ODFlow[] {
  let result = flows.filter(f => VALID_PURPOSES.has(f.purpose))

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
  if (!isDemoMode()) {
    const res = await fetch(`${BASE_URL}/api/od/flows`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json() as Promise<ODFlow[]>
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
