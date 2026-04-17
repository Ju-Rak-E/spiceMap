import { useState, useEffect } from 'react'
import { type GriResult } from '../utils/gri'

export interface GriHistoryPoint {
  quarter: string
  score: number
  level: GriResult['level']
}

export interface UseGriHistoryReturn {
  history: GriHistoryPoint[]
  isLoading: boolean
  error: string | null
  isMock: boolean
}

const MOCK_HISTORY: GriHistoryPoint[] = [
  { quarter: '2024Q3', score: 55, level: 'safe' },
  { quarter: '2024Q4', score: 62, level: 'safe' },
  { quarter: '2025Q1', score: 71, level: 'warning' },
  { quarter: '2025Q2', score: 78, level: 'warning' },
]

async function fetchGriHistory(
  nodeId: string,
): Promise<{ history: GriHistoryPoint[]; isMock: boolean }> {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
  if (baseUrl) {
    try {
      const res = await fetch(`${baseUrl}/api/gri/history?node_id=${nodeId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { nodeId: string; history: GriHistoryPoint[] }
      return { history: data.history, isMock: false }
    } catch {
      // API 실패 → mock 폴백
    }
  }

  try {
    const res = await fetch(`/data/mock_gri_history.json`)
    if (res.ok) {
      const data = (await res.json()) as GriHistoryPoint[]
      return { history: data, isMock: true }
    }
  } catch {
    // mock 파일 없음 → 인라인 폴백
  }

  return { history: MOCK_HISTORY, isMock: true }
}

export function useGriHistory(nodeId: string | null): UseGriHistoryReturn {
  const [history, setHistory] = useState<GriHistoryPoint[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMock, setIsMock] = useState(false)

  useEffect(() => {
    if (!nodeId) {
      setHistory([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    fetchGriHistory(nodeId)
      .then(({ history: fetched, isMock: mock }) => {
        setHistory(fetched)
        setIsMock(mock)
        setIsLoading(false)
      })
      .catch(() => {
        setError('GRI 이력을 불러오지 못했습니다')
        setIsLoading(false)
      })
  }, [nodeId])

  return { history, isLoading, error, isMock }
}
