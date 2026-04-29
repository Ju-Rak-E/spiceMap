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

export interface BackendFlowItem {
  origin_adm_cd: string
  origin_adm_nm: string | null
  dest_adm_cd: string
  dest_adm_nm: string | null
  trip_count: number
  move_purpose: number | string | null
  sourceCoord?: [number, number]
  targetCoord?: [number, number]
  source_coord?: [number, number] | null
  target_coord?: [number, number] | null
}

export interface BackendOdFlowsResponse {
  quarter: string
  total_flows: number
  flows: BackendFlowItem[]
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
  quarter?: string
}

export interface FlowStats {
  totalVolume: number
  activeCount: number
  topInflow: string | null
  topOutflow: string | null
}

export type PurposeVolumeMap = Record<FlowPurpose, number>

export interface UseFlowDataReturn extends FlowStats {
  flows: ODFlow[]
  purposeTotals: PurposeVolumeMap
  isLoading: boolean
  error: string | null
}

const VALID_PURPOSES = new Set<string>(['출근', '쇼핑', '여가', '귀가'])
const PURPOSE_BY_CODE: Record<number, FlowPurpose> = {
  1: '출근',
  2: '귀가',
  3: '쇼핑',
  4: '여가',
}

function normalizePurpose(value: BackendFlowItem['move_purpose']): FlowPurpose {
  if (typeof value === 'string' && VALID_PURPOSES.has(value)) return value as FlowPurpose
  if (typeof value === 'number') return PURPOSE_BY_CODE[value] ?? '출근'
  return '출근'
}

export function normalizeBackendFlows(response: BackendOdFlowsResponse): ODFlow[] | null {
  const flows: ODFlow[] = []

  for (const flow of response.flows) {
    const sourceCoord = flow.sourceCoord ?? flow.source_coord
    const targetCoord = flow.targetCoord ?? flow.target_coord
    if (!sourceCoord || !targetCoord) continue
    flows.push({
      id: `${flow.origin_adm_cd}-${flow.dest_adm_cd}`,
      sourceId: flow.origin_adm_nm ?? flow.origin_adm_cd,
      targetId: flow.dest_adm_nm ?? flow.dest_adm_cd,
      sourceCoord,
      targetCoord,
      volume: Math.round(flow.trip_count),
      purpose: normalizePurpose(flow.move_purpose),
    })
  }

  return flows.length > 0 ? flows : null
}

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

export function computePurposeTotals(flows: ODFlow[], hour?: number): PurposeVolumeMap {
  const totals = {} as PurposeVolumeMap
  for (const purpose of VALID_PURPOSES) {
    totals[purpose as FlowPurpose] = 0
  }

  for (const flow of flows) {
    if (!VALID_PURPOSES.has(flow.purpose)) continue
    const scale = hour === undefined ? 1 : getHourScale(flow.purpose, hour)
    totals[flow.purpose] += Math.round(flow.volume * scale)
  }

  return totals
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

async function fetchMockFlows(): Promise<ODFlow[]> {
  const mockRes = await fetch('/data/mock_flows.json')
  if (!mockRes.ok) throw new Error(`HTTP ${mockRes.status}`)
  return mockRes.json() as Promise<ODFlow[]>
}

async function fetchFlows(quarter: string): Promise<ODFlow[]> {
  if (isDemoMode()) {
    return fetchMockFlows()
  }

  const params = new URLSearchParams({ quarter })
  const res = await fetch(`${BASE_URL}/api/od/flows?${params.toString()}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (Array.isArray(data)) return data as ODFlow[]

  const normalized = normalizeBackendFlows(data as BackendOdFlowsResponse)
  if (!normalized) throw new Error('OD 흐름 응답에 좌표가 없습니다')
  return normalized
}

export function useFlowData(filters: FlowFilters = {}): UseFlowDataReturn {
  const [allFlows, setAllFlows] = useState<ODFlow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const quarter = filters.quarter ?? '2025Q4'

  useEffect(() => {
    queueMicrotask(() => {
      setIsLoading(true)
      setError(null)
    })
    fetchFlows(quarter)
      .then(data => {
        setAllFlows(data)
        setIsLoading(false)
      })
      .catch(() => {
        setAllFlows([])
        setError('흐름 데이터를 불러오지 못했습니다')
        setIsLoading(false)
      })
  }, [quarter])

  const flows = filterFlows(allFlows, filters)
  const stats = computeStats(flows)
  const purposeTotals = computePurposeTotals(allFlows, filters.hour)

  return { flows, purposeTotals, isLoading, error, ...stats }
}
