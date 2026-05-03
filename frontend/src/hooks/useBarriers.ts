import { useEffect, useState } from 'react'
import { isDemoMode } from '../utils/demoMode'

export type BarrierSeverity = 'high' | 'medium' | 'low'

export interface Barrier {
  id: string
  sourceId: string
  targetId: string
  sourceName: string
  targetName: string
  sourceCoord: [number, number]
  targetCoord: [number, number]
  affectedVolume: number
  score: number
  severity: BarrierSeverity
  type?: string | null
}

interface BackendBarrierItem {
  from_comm_cd: string
  from_comm_nm: string | null
  to_comm_cd: string
  to_comm_nm: string | null
  barrier_score: number
  barrier_type: string | null
  sourceCoord?: [number, number] | null
  targetCoord?: [number, number] | null
  affected_volume?: number | null
}

interface BackendBarriersResponse {
  quarter: string
  total: number
  barriers: BackendBarrierItem[]
}

export interface UseBarriersReturn {
  barriers: Barrier[]
  isLoading: boolean
  error: string | null
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

function severityFromScore(score: number): BarrierSeverity {
  if (score >= 0.75) return 'high'
  if (score >= 0.45) return 'medium'
  return 'low'
}

export function normalizeBackendBarriers(response: BackendBarriersResponse): Barrier[] {
  const barriers: Barrier[] = []

  for (const item of response.barriers) {
    if (!item.sourceCoord || !item.targetCoord) continue
    barriers.push({
      id: `${item.from_comm_cd}-${item.to_comm_cd}`,
      sourceId: item.from_comm_cd,
      targetId: item.to_comm_cd,
      sourceName: item.from_comm_nm ?? item.from_comm_cd,
      targetName: item.to_comm_nm ?? item.to_comm_cd,
      sourceCoord: item.sourceCoord,
      targetCoord: item.targetCoord,
      affectedVolume: item.affected_volume ?? Math.round(item.barrier_score * 10000),
      score: item.barrier_score,
      severity: severityFromScore(item.barrier_score),
      type: item.barrier_type,
    })
  }

  return barriers
}

async function fetchMockBarriers(): Promise<Barrier[]> {
  const res = await fetch('/data/mock_barriers.json')
  if (!res.ok) return []
  return res.json() as Promise<Barrier[]>
}

async function fetchBarriers(quarter: string): Promise<Barrier[]> {
  if (isDemoMode()) return fetchMockBarriers()

  const params = new URLSearchParams({ quarter })
  const res = await fetch(`${BASE_URL}/api/barriers?${params.toString()}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as BackendBarriersResponse
  return normalizeBackendBarriers(data)
}

export function useBarriers(quarter = '2025Q4'): UseBarriersReturn {
  const [barriers, setBarriers] = useState<Barrier[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setIsLoading(true)
      setError(null)
    })

    fetchBarriers(quarter)
      .then((data) => {
        if (cancelled) return
        setBarriers(data)
        setIsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setBarriers([])
        setError('흐름 단절 데이터를 불러오지 못했습니다')
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [quarter])

  return { barriers, isLoading, error }
}
