import type { CommerceNode } from '../types/commerce'
import { clamp } from './math'

type StartupCommerceNode = CommerceNode & {
  sourceCommType?: string | null
  closeRate?: number
}

export type StartupFitLevel = 'recommended' | 'caution' | 'not_recommended' | 'unknown'
export type StartupDataConfidence = 'high' | 'medium' | 'low'

export interface StartupSummary {
  fitLevel: StartupFitLevel
  fitLabel: string
  fitScore: number
  fitColor: string
  characterLabel: string
  characterBasis: string
  headline: string
  reasons: string[]
  risks: string[]
  suitableIndustries: string[]
  cautionIndustries: string[]
  flowLabel: string
  dataConfidence: StartupDataConfidence
  dataConfidenceLabel: string
}

function includesAny(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword))
}

function deriveCharacter(node: StartupCommerceNode): Pick<StartupSummary, 'characterLabel' | 'characterBasis'> {
  const name = node.name
  const source = node.sourceCommType ?? ''

  if (source.includes('전통시장')) {
    return { characterLabel: '전통시장형', characterBasis: '서울시 원본 상권 구분 기준' }
  }
  if (source.includes('관광특구')) {
    return { characterLabel: '관광형', characterBasis: '서울시 원본 상권 구분 기준' }
  }
  if (includesAny(name, ['대학교', '대학', '캠퍼스'])) {
    return { characterLabel: '대학가 추정', characterBasis: '상권명 키워드 기준' }
  }
  if (includesAny(name, ['역 ', '역상권', '역세권', '강남역', '신림역', '역삼'])) {
    return { characterLabel: '역세권 추정', characterBasis: '상권명 키워드 기준' }
  }
  if (includesAny(name, ['테헤란', '오피스', '업무', 'CBD'])) {
    return { characterLabel: '오피스형 추정', characterBasis: '상권명 키워드 기준' }
  }
  if (source.includes('골목')) {
    return { characterLabel: '생활밀착형', characterBasis: '서울시 원본 상권 구분 기준' }
  }
  if (source.includes('발달')) {
    return { characterLabel: '광역상권형', characterBasis: '서울시 원본 상권 구분 기준' }
  }
  return { characterLabel: '일반상권', characterBasis: '세부 성격 데이터 부족' }
}

function deriveFitLevel(score: number, node: StartupCommerceNode): StartupFitLevel {
  if (node.griScore === 0 && node.netFlow === 0 && node.closeRate == null) return 'unknown'
  if (score >= 70) return 'recommended'
  if (score >= 45) return 'caution'
  return 'not_recommended'
}

function fitMeta(level: StartupFitLevel): Pick<StartupSummary, 'fitLabel' | 'fitColor'> {
  switch (level) {
    case 'recommended':
      return { fitLabel: '검토 추천', fitColor: '#43A047' }
    case 'caution':
      return { fitLabel: '주의 검토', fitColor: '#FB8C00' }
    case 'not_recommended':
      return { fitLabel: '비추천', fitColor: '#E53935' }
    case 'unknown':
      return { fitLabel: '데이터 부족', fitColor: '#78909C' }
  }
}

function flowLabel(netFlow: number): string {
  if (netFlow > 0) return '유입 우세'
  if (netFlow < 0) return '유출 우세'
  return '유입 판단 보류'
}

function confidence(node: StartupCommerceNode): Pick<StartupSummary, 'dataConfidence' | 'dataConfidenceLabel'> {
  const available = [
    node.griScore > 0,
    node.netFlow !== 0,
    node.closeRate != null,
    Boolean(node.sourceCommType),
  ].filter(Boolean).length

  if (available >= 3) return { dataConfidence: 'high', dataConfidenceLabel: '높음' }
  if (available >= 2) return { dataConfidence: 'medium', dataConfidenceLabel: '보통' }
  return { dataConfidence: 'low', dataConfidenceLabel: '낮음' }
}

function industryHints(characterLabel: string): Pick<StartupSummary, 'suitableIndustries' | 'cautionIndustries'> {
  if (characterLabel.includes('대학가')) {
    return {
      suitableIndustries: ['저가 식사', '카페', '스터디/생활 서비스'],
      cautionIndustries: ['고가 객단가 업종', '주말 의존 업종'],
    }
  }
  if (characterLabel.includes('역세권') || characterLabel.includes('오피스')) {
    return {
      suitableIndustries: ['테이크아웃', '점심 식사', '퇴근길 생활 서비스'],
      cautionIndustries: ['장시간 체류형 업종', '주말 단독 수요 업종'],
    }
  }
  if (characterLabel.includes('전통시장')) {
    return {
      suitableIndustries: ['식료품', '간편식', '지역 생활 서비스'],
      cautionIndustries: ['임대료 부담이 큰 대형 매장'],
    }
  }
  if (characterLabel.includes('관광')) {
    return {
      suitableIndustries: ['외식', '기념품', '체험형 서비스'],
      cautionIndustries: ['평일 고정 수요 의존 업종'],
    }
  }
  return {
    suitableIndustries: ['생활밀착 서비스', '소형 외식', '반복 방문 업종'],
    cautionIndustries: ['대형 투자 업종'],
  }
}

export function deriveStartupSummary(node: StartupCommerceNode): StartupSummary {
  const character = deriveCharacter(node)
  const closePenalty = node.closeRate == null ? 0 : node.closeRate >= 10 ? 15 : node.closeRate >= 7 ? 8 : 0
  const flowAdjustment = node.netFlow > 0 ? 10 : node.netFlow < 0 ? -10 : 0
  const centralityAdjustment = clamp(node.degreeCentrality * 8, 0, 8)
  const fitScore = Math.round(clamp(100 - node.griScore + flowAdjustment + centralityAdjustment - closePenalty, 0, 100))
  const fitLevel = deriveFitLevel(fitScore, node)
  const meta = fitMeta(fitLevel)
  const reasons: string[] = []
  const risks: string[] = []

  if (node.netFlow > 0) reasons.push('외부 유입이 빠져나가는 흐름보다 강합니다.')
  if (node.degreeCentrality >= 0.5) reasons.push('주변 상권과의 연결성이 비교적 높습니다.')
  if (node.griScore < 50 && node.griScore > 0) reasons.push('현재 위험도 지표가 낮은 편입니다.')
  if (node.griScore >= 70) risks.push('상권 위험도가 높아 임대료, 경쟁, 폐업 흐름 확인이 필요합니다.')
  if (node.netFlow < 0) risks.push('순유출이 나타나 고객 유입 동선 확인이 필요합니다.')
  if (node.closeRate != null && node.closeRate >= 10) risks.push('폐업률이 높아 동종 업종 진입은 신중해야 합니다.')
  if (risks.length === 0) risks.push('현재 데이터 기준 뚜렷한 고위험 신호는 제한적입니다.')
  if (reasons.length === 0) reasons.push('판단에 필요한 보조 데이터가 아직 부족합니다.')

  const headline = fitLevel === 'recommended'
    ? '창업 후보지로 검토할 만한 상권입니다.'
    : fitLevel === 'caution'
      ? '창업 전 업종과 시간대 수요를 더 확인해야 하는 상권입니다.'
      : fitLevel === 'not_recommended'
        ? '현재 지표만 보면 신규 창업은 신중해야 하는 상권입니다.'
        : '창업 판단을 위해 추가 데이터가 필요합니다.'

  return {
    fitLevel,
    ...meta,
    fitScore,
    ...character,
    headline,
    reasons,
    risks,
    ...industryHints(character.characterLabel),
    flowLabel: flowLabel(node.netFlow),
    ...confidence(node),
  }
}
