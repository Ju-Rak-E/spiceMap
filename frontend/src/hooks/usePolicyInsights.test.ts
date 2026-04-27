import { describe, it, expect } from 'vitest'
import {
  derivePriority,
  normalizePolicyCardsResponse,
  severityToPriority,
  shouldFetchPolicyInsights,
  type PolicyPriority,
} from './usePolicyInsights'

describe('derivePriority', () => {
  it('GRI 80 이상이면 즉시개입', () => {
    expect(derivePriority(80)).toBe<PolicyPriority>('즉시개입')
    expect(derivePriority(88)).toBe<PolicyPriority>('즉시개입')
    expect(derivePriority(100)).toBe<PolicyPriority>('즉시개입')
  })

  it('GRI 60~79이면 연내지원', () => {
    expect(derivePriority(60)).toBe<PolicyPriority>('연내지원')
    expect(derivePriority(74)).toBe<PolicyPriority>('연내지원')
    expect(derivePriority(79)).toBe<PolicyPriority>('연내지원')
  })

  it('GRI 59 이하이면 모니터링', () => {
    expect(derivePriority(59)).toBe<PolicyPriority>('모니터링')
    expect(derivePriority(41)).toBe<PolicyPriority>('모니터링')
    expect(derivePriority(0)).toBe<PolicyPriority>('모니터링')
  })
})

describe('severityToPriority', () => {
  it('백엔드 severity를 UI 우선순위로 매핑한다', () => {
    expect(severityToPriority('Critical')).toBe('즉시개입')
    expect(severityToPriority('High')).toBe('즉시개입')
    expect(severityToPriority('Medium')).toBe('연내지원')
    expect(severityToPriority('Low')).toBe('모니터링')
  })
})

describe('normalizePolicyCardsResponse', () => {
  it('다중 정책 카드 응답을 UI 카드 배열로 변환한다', () => {
    const result = normalizePolicyCardsResponse({
      quarter: '2025Q4',
      total_cards: 2,
      generation_mode: 'rule_based',
      cards: [
        {
          rule_id: 'R4',
          commerce_code: '3110001',
          commerce_name: '테스트 상권',
          severity: 'Critical',
          policy_text: '임대료 안정화',
          rationale: 'GRI 80 이상',
          triggering_metrics: { gri_score: 82 },
          generation_mode: 'rule_based',
        },
        {
          rule_id: 'R7',
          commerce_code: '3110001',
          commerce_name: '테스트 상권',
          severity: 'Low',
          policy_text: '정기 모니터링',
          rationale: '안정형',
          triggering_metrics: {},
          generation_mode: 'rule_based',
        },
      ],
    })

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      nodeId: '3110001',
      priority: '즉시개입',
      title: '임대료 안정화',
      source: 'Module D R4',
      ruleId: 'R4',
      severity: 'Critical',
      generationMode: 'rule_based',
    })
    expect(result[1].priority).toBe('모니터링')
  })

  it('빈 cards 응답은 빈 배열을 반환한다', () => {
    expect(normalizePolicyCardsResponse({
      quarter: '2025Q4',
      total_cards: 0,
      generation_mode: 'rule_based',
      cards: [],
    })).toEqual([])
  })
})

describe('shouldFetchPolicyInsights', () => {
  it('미분류 상권은 정책 추천 조회 대상에서 제외한다', () => {
    expect(shouldFetchPolicyInsights('미분류')).toBe(false)
  })

  it('분류된 상권은 정책 추천 조회 대상이다', () => {
    expect(shouldFetchPolicyInsights('흡수형_과열')).toBe(true)
    expect(shouldFetchPolicyInsights(null)).toBe(true)
  })
})
