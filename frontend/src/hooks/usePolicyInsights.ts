import { useState, useEffect } from 'react'
import type { BADGE_COLORS } from '../styles/tokens'
import type { CommerceType } from '../styles/tokens'
import { isDemoMode } from '../utils/demoMode'

export type PolicyPriority = keyof typeof BADGE_COLORS
export type PolicySeverity = 'Critical' | 'High' | 'Medium' | 'Low'

export interface BackendPolicyCard {
  rule_id: string
  commerce_code: string
  commerce_name: string
  severity: PolicySeverity
  policy_text: string
  rationale: string
  triggering_metrics: Record<string, number>
  generation_mode: 'rule_based'
}

export interface PolicyCardsResponse {
  quarter: string
  total_cards: number
  generation_mode: string
  cards: BackendPolicyCard[]
}

export interface PolicyInsight {
  nodeId: string
  priority: PolicyPriority
  title: string
  rationale: string
  source: string
  ruleId?: string
  severity?: PolicySeverity
  triggeringMetrics?: Record<string, number>
  generationMode?: string
}

export interface UsePolicyInsightsReturn {
  insights: PolicyInsight[]
  insight: PolicyInsight | null
  isLoading: boolean
  error: string | null
}

export function derivePriority(griScore: number): PolicyPriority {
  if (griScore >= 80) return '즉시개입'
  if (griScore >= 60) return '연내지원'
  return '모니터링'
}

export function severityToPriority(severity: PolicySeverity): PolicyPriority {
  if (severity === 'Critical' || severity === 'High') return '즉시개입'
  if (severity === 'Medium') return '연내지원'
  return '모니터링'
}

export function normalizePolicyCardsResponse(response: PolicyCardsResponse): PolicyInsight[] {
  return response.cards.map(card => ({
    nodeId: card.commerce_code,
    priority: severityToPriority(card.severity),
    title: card.policy_text,
    rationale: card.rationale,
    source: `Module D ${card.rule_id}`,
    ruleId: card.rule_id,
    severity: card.severity,
    triggeringMetrics: card.triggering_metrics,
    generationMode: card.generation_mode,
  }))
}

export function shouldFetchPolicyInsights(type?: CommerceType | null): boolean {
  return type !== '미분류'
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

async function fetchMockPolicyInsights(commCd: string): Promise<PolicyInsight[]> {
  const mockRes = await fetch('/data/mock_policy_insights.json')
  if (!mockRes.ok) throw new Error('mock 정책 데이터를 불러오지 못했습니다')
  const all = (await mockRes.json()) as Record<string, PolicyInsight>
  const insight = all[commCd] ?? all['__default__']
  return insight ? [{ ...insight, nodeId: commCd }] : []
}

async function fetchPolicyInsights(commCd: string, quarter: string): Promise<PolicyInsight[]> {
  if (isDemoMode()) {
    return fetchMockPolicyInsights(commCd)
  }

  const params = new URLSearchParams({ comm_cd: commCd, quarter })
  const res = await fetch(`${BASE_URL}/api/insights/policy?${params.toString()}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as PolicyCardsResponse
  return normalizePolicyCardsResponse(data)
}

export function usePolicyInsights(
  commCd: string | null,
  quarter = '2025Q4',
  type?: CommerceType | null,
): UsePolicyInsightsReturn {
  const [insights, setInsights] = useState<PolicyInsight[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!commCd || !shouldFetchPolicyInsights(type)) {
      queueMicrotask(() => {
        setInsights([])
        setError(null)
        setIsLoading(false)
      })
      return
    }

    queueMicrotask(() => {
      setIsLoading(true)
      setError(null)
    })

    fetchPolicyInsights(commCd, quarter)
      .then(data => {
        setInsights(data)
        setIsLoading(false)
      })
      .catch(() => {
        setInsights([])
        setError('정책 정보를 불러오지 못했습니다')
        setIsLoading(false)
      })
  }, [commCd, quarter, type])

  return { insights, insight: insights[0] ?? null, isLoading, error }
}
