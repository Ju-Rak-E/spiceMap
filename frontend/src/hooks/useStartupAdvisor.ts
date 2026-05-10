import { useState, useEffect, useCallback, useRef } from 'react'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

export interface AdvisorCommerce {
  comm_cd: string
  comm_nm: string
  gu_nm: string
  tier: '추천' | '주의' | '비추천'
  advisor_score: number
  gri_score: number | null
  flow_volume: number | null
  closure_rate: number | null
  llm_reason: string | null
}

export interface AdvisorResult {
  industry_nm: string
  quarter: string
  summary: string
  caution: string
  commerces: AdvisorCommerce[]
  model_used: string
}

export function useStartupAdvisor(quarter: string) {
  const [industries, setIndustries] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<AdvisorResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestSeq = useRef(0)

  useEffect(() => {
    fetch(`${BASE_URL}/api/advisor/industries?quarter=${quarter}`)
      .then((r) => r.json())
      .then((data) => setIndustries(data.industries ?? []))
      .catch(() => setIndustries([]))
  }, [quarter])

  const analyze = useCallback(async (industry: string, districts?: string[]) => {
    if (!industry) return
    const requestId = requestSeq.current + 1
    requestSeq.current = requestId
    setIsLoading(true)
    setError(null)
    setResult(null)
    try {
      const r = await fetch(`${BASE_URL}/api/advisor/startup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry_nm: industry, quarter, districts: districts?.filter(Boolean) ?? [] }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data: AdvisorResult = await r.json()
      if (requestSeq.current === requestId) setResult(data)
    } catch {
      if (requestSeq.current === requestId) {
      setError('분석 중 오류가 발생했습니다.')
      }
    } finally {
      if (requestSeq.current === requestId) setIsLoading(false)
    }
  }, [quarter])

  const reset = useCallback(() => {
    requestSeq.current += 1
    setResult(null)
    setError(null)
    setIsLoading(false)
  }, [])

  const visibleResult = result?.quarter === quarter ? result : null
  const tierMap: Map<string, '추천' | '주의' | '비추천'> | null = visibleResult
    ? new Map(visibleResult.commerces.map((c) => [c.comm_cd, c.tier]))
    : null

  return { industries, isLoading, result: visibleResult, error, analyze, reset, tierMap }
}
