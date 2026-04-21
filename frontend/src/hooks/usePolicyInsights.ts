import { useState, useEffect } from 'react'
import type { BADGE_COLORS } from '../styles/tokens'

export type PolicyPriority = keyof typeof BADGE_COLORS

export interface PolicyInsight {
  nodeId: string
  priority: PolicyPriority
  title: string
  rationale: string
  source: string
}

export interface UsePolicyInsightsReturn {
  insight: PolicyInsight | null
  isLoading: boolean
  error: string | null
}

export function derivePriority(griScore: number): PolicyPriority {
  if (griScore >= 80) return '즉시개입'
  if (griScore >= 60) return '연내지원'
  return '모니터링'
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

async function fetchPolicyInsight(nodeId: string): Promise<PolicyInsight> {
  if (BASE_URL) {
    try {
      const res = await fetch(`${BASE_URL}/api/insights/policy?nodeId=${encodeURIComponent(nodeId)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<PolicyInsight>
    } catch {
      // API 실패 → mock 폴백
    }
  }

  const mockRes = await fetch('/data/mock_policy_insights.json')
  if (!mockRes.ok) throw new Error('mock 정책 데이터를 불러오지 못했습니다')
  const all = (await mockRes.json()) as Record<string, PolicyInsight>
  return all[nodeId] ?? all['__default__'] ?? { nodeId, priority: '모니터링', title: '데이터 없음', rationale: '', source: '' }
}

export function usePolicyInsights(nodeId: string | null): UsePolicyInsightsReturn {
  const [insight, setInsight] = useState<PolicyInsight | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!nodeId) {
      setInsight(null)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    fetchPolicyInsight(nodeId)
      .then(data => {
        setInsight(data)
        setIsLoading(false)
      })
      .catch(() => {
        setError('정책 정보를 불러오지 못했습니다')
        setIsLoading(false)
      })
  }, [nodeId])

  return { insight, isLoading, error }
}
