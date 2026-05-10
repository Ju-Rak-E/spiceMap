import type { FlowPurpose } from '../hooks/useFlowData'
import type { AdvisorCommerce, AdvisorResult } from '../hooks/useStartupAdvisor'
import type { CommerceNode } from '../types/commerce'
import { deriveStartupSummary } from './startupAdvisor'
import { formatSignedInteger } from './numberFormat'

export type FounderStep = 'industry' | 'region' | 'results' | 'detail'

export interface FounderFilterState {
  industry: string
  districts: Set<string>
  quarter: string
  purpose: FlowPurpose | null
  hour: number
}

export type MetricTone = 'good' | 'caution' | 'danger' | 'neutral'

export interface MetricExplanation {
  key: string
  label: string
  value: string
  numericValue?: number
  tone: MetricTone
  shortMeaning: string
  basis: string
  nextAction: string
}

export interface FounderCommerceRecommendation {
  id: string
  name: string
  tier: AdvisorCommerce['tier']
  score: number
  district: string
  opportunityReasons: string[]
  riskReasons: string[]
  suitableIndustries: string[]
  nextActions: string[]
}

function toneForGri(griScore: number): MetricTone {
  if (griScore >= 70) return 'danger'
  if (griScore >= 40) return 'caution'
  if (griScore > 0) return 'good'
  return 'neutral'
}

function toneForCloseRate(closeRate: number | null | undefined): MetricTone {
  if (closeRate == null) return 'neutral'
  if (closeRate >= 10) return 'danger'
  if (closeRate >= 7) return 'caution'
  return 'good'
}

function toneForNetFlow(netFlow: number): MetricTone {
  if (netFlow > 0) return 'good'
  if (netFlow < 0) return 'caution'
  return 'neutral'
}

function toneForFitScore(score: number): MetricTone {
  if (score >= 70) return 'good'
  if (score >= 45) return 'caution'
  return 'danger'
}

export function buildMetricExplanations(node: CommerceNode): MetricExplanation[] {
  const startup = deriveStartupSummary(node)
  const closeRateValue = node.closeRate != null ? `${node.closeRate.toFixed(1)}%` : '-'

  return [
    {
      key: 'fitScore',
      label: '창업 적합도',
      value: startup.fitScore.toString(),
      tone: toneForFitScore(startup.fitScore),
      shortMeaning: startup.fitLabel,
      basis: 'GRI, 고객 흐름, 연결성, 폐업률을 조합한 내부 보조 점수입니다.',
      nextAction: startup.fitScore >= 70
        ? '후보지로 저장하고 임대료와 경쟁 점포를 확인하세요.'
        : '동일 업종으로 진입하기 전 대체 상권과 비교하세요.',
    },
    {
      key: 'netFlow',
      label: '순유입',
      value: `${formatSignedInteger(node.netFlow)}명`,
      tone: toneForNetFlow(node.netFlow),
      shortMeaning: node.netFlow > 0
        ? '유입 우세'
        : node.netFlow < 0
          ? '유출 우세'
          : '데이터 부족',
      basis: '선택 분기 OD 유동량에서 유입과 유출의 차이를 본 값입니다.',
      nextAction: node.netFlow > 0
        ? '유입 시간대와 주 고객 동선을 더 확인하세요.'
        : '외부 고객을 끌어올 수 있는 입지인지 현장 동선을 확인하세요.',
    },
    {
      key: 'closeRate',
      label: '폐업률',
      value: closeRateValue,
      tone: toneForCloseRate(node.closeRate),
      shortMeaning: node.closeRate == null
        ? '데이터 없음'
        : node.closeRate >= 10
          ? '높음'
          : node.closeRate >= 7
            ? '주의'
            : '안정',
      basis: '서울시 점포 데이터의 상권 단위 폐업률입니다.',
      nextAction: node.closeRate != null && node.closeRate >= 7
        ? '동종 업종 폐업 사례와 임대 조건을 먼저 확인하세요.'
        : '폐업률 외에 객단가와 고정비를 함께 검토하세요.',
    },
    {
      key: 'griScore',
      label: '상권 위험도',
      value: `${Math.round(node.griScore)}점`,
      numericValue: node.griScore,
      tone: toneForGri(node.griScore),
      shortMeaning: node.griScore >= 70
        ? '고위험'
        : node.griScore >= 40
          ? '주의'
          : node.griScore > 0
            ? '낮음'
            : '대기',
      basis: '폐업률, 고객 흐름, 연결성 기반의 GRI 보조 지표입니다.',
      nextAction: node.griScore >= 70
        ? '임대료 상승, 고객 이탈, 경쟁 과열 여부를 반드시 확인하세요.'
        : '다른 후보지와 위험도를 나란히 비교하세요.',
    },
  ]
}

function splitReasonText(text: string | null): string[] {
  if (!text) return []
  return text
    .split(/[.;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
}

function buildOpportunityReasons(commerce: AdvisorCommerce): string[] {
  const reasons = splitReasonText(commerce.llm_reason)
  if (commerce.flow_volume != null && commerce.flow_volume > 0) {
    reasons.push(`유동량 ${commerce.flow_volume.toLocaleString()} 기준 고객 접점이 있습니다.`)
  }
  if (commerce.gri_score != null && commerce.gri_score < 50) {
    reasons.push('상권 위험도가 낮아 초기 후보지로 검토할 수 있습니다.')
  }
  return reasons.slice(0, 3)
}

function buildRiskReasons(commerce: AdvisorCommerce): string[] {
  const reasons: string[] = []
  if (commerce.gri_score != null && commerce.gri_score >= 70) {
    reasons.push(`GRI ${commerce.gri_score.toFixed(1)}로 위험 신호가 큽니다.`)
  }
  if (commerce.closure_rate != null && commerce.closure_rate >= 7) {
    reasons.push(`폐업률 ${commerce.closure_rate.toFixed(1)}%로 동종 진입 전 확인이 필요합니다.`)
  }
  if (reasons.length === 0) reasons.push('임대료와 실제 경쟁 점포는 별도 현장 확인이 필요합니다.')
  return reasons
}

export function buildFounderRecommendations(
  result: AdvisorResult | null,
  selectedDistricts?: Set<string>,
): FounderCommerceRecommendation[] {
  if (!result) return []
  if (selectedDistricts && selectedDistricts.size === 0) return []

  const filteredCommerces = selectedDistricts
    ? result.commerces.filter((commerce) => selectedDistricts.has(commerce.gu_nm))
    : result.commerces

  return filteredCommerces.slice(0, 6).map((commerce) => ({
    id: commerce.comm_cd,
    name: commerce.comm_nm,
    tier: commerce.tier,
    score: commerce.advisor_score,
    district: commerce.gu_nm,
    opportunityReasons: buildOpportunityReasons(commerce),
    riskReasons: buildRiskReasons(commerce),
    suitableIndustries: [result.industry_nm],
    nextActions: commerce.tier === '추천'
      ? ['상세 패널에서 폐업률과 GRI 추세를 확인하세요.', '현장 방문 후보로 분류하세요.']
      : commerce.tier === '주의'
        ? ['같은 업종의 인접 상권과 비교하세요.', '시간대별 고객 흐름을 확인하세요.']
        : ['대체 상권을 먼저 검토하세요.', '진입 전 고정비 부담을 재계산하세요.'],
  }))
}
