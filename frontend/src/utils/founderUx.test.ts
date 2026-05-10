import { describe, expect, it } from 'vitest'
import type { AdvisorResult } from '../hooks/useStartupAdvisor'
import type { CommerceNode } from '../types/commerce'
import { buildFounderRecommendations, buildMetricExplanations } from './founderUx'

function node(overrides: Partial<CommerceNode> = {}): CommerceNode {
  return {
    id: 'gc_001',
    name: '강남역 일대',
    coordinates: [127.02, 37.5],
    type: '흡수형_과열',
    district: '강남구',
    netFlow: 1200,
    degreeCentrality: 0.8,
    griScore: 82,
    closeRate: 11,
    ...overrides,
  }
}

function advisorResult(): AdvisorResult {
  return {
    industry_nm: '카페',
    quarter: '2025Q4',
    summary: '카페 후보 상권입니다.',
    caution: '',
    model_used: 'test',
    commerces: [
      {
        comm_cd: 'gc_001',
        comm_nm: '강남역 일대',
        gu_nm: '강남구',
        tier: '추천',
        advisor_score: 83.2,
        gri_score: 35,
        flow_volume: 12000,
        closure_rate: 4.2,
        llm_reason: '유동량이 높습니다. 소비 접점이 많습니다.',
      },
    ],
  }
}

describe('buildMetricExplanations', () => {
  it('marks high GRI and high close rate as danger with next actions', () => {
    const metrics = buildMetricExplanations(node())
    expect(metrics.find((metric) => metric.key === 'griScore')?.tone).toBe('danger')
    expect(metrics.find((metric) => metric.key === 'closeRate')?.tone).toBe('danger')
    expect(metrics.find((metric) => metric.key === 'griScore')?.nextAction).toContain('임대료')
  })

  it('marks positive net flow as good', () => {
    const metrics = buildMetricExplanations(node({ netFlow: 300 }))
    expect(metrics.find((metric) => metric.key === 'netFlow')?.tone).toBe('good')
  })
})

describe('buildFounderRecommendations', () => {
  it('converts advisor result to founder-facing recommendation cards', () => {
    const recommendations = buildFounderRecommendations(advisorResult())
    expect(recommendations).toHaveLength(1)
    expect(recommendations[0].name).toBe('강남역 일대')
    expect(recommendations[0].suitableIndustries).toEqual(['카페'])
    expect(recommendations[0].opportunityReasons[0]).toContain('유동량')
    expect(recommendations[0].nextActions[0]).toContain('상세 패널')
  })

  it('returns an empty list before analysis', () => {
    expect(buildFounderRecommendations(null)).toEqual([])
  })

  it('filters recommendation cards by selected districts', () => {
    const result = advisorResult()
    result.commerces.push({
      ...result.commerces[0],
      comm_cd: 'gc_002',
      comm_nm: 'other area',
      gu_nm: 'other district',
    })
    const recommendations = buildFounderRecommendations(result, new Set([result.commerces[0].gu_nm]))
    expect(recommendations).toHaveLength(1)
    expect(recommendations[0].id).toBe('gc_001')
  })
})
