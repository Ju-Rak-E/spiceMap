import { useState, useEffect } from 'react'

export type FlowPurpose = '출근' | '쇼핑' | '관광' | '귀가' | '등교'

export interface ODFlow {
  id: string
  sourceId: string
  targetId: string
  sourceCoord: [number, number]
  targetCoord: [number, number]
  volume: number
  purpose: FlowPurpose
}

export interface FlowFilters {
  purpose?: FlowPurpose | null
  topN?: number
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

export function useFlowData(filters: FlowFilters = {}): UseFlowDataReturn {
  const [allFlows, setAllFlows] = useState<ODFlow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    fetch('/data/mock_flows.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<ODFlow[]>
      })
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
