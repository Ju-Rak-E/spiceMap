import type { FlowPurpose } from '../hooks/useFlowData'
import type { CommerceType } from '../styles/tokens'
import type { CommerceNode } from '../types/commerce'

function formatHour(hour: number): string {
  if (hour === 0) return '자정 0시'
  if (hour < 12) return `오전 ${hour}시`
  if (hour === 12) return '오후 12시'
  return `오후 ${hour - 12}시`
}

export function buildSummaryText(
  purpose: FlowPurpose | null,
  hour: number,
  topN: number,
  selectedTypes: Set<CommerceType>,
  nodes: CommerceNode[],
): string {
  if (nodes.length === 0) return ''
  const totalCount = nodes.length
  const dangerCount = nodes.filter(n => n.griScore >= 70).length
  const purposeText = purpose ?? '전체 목적'
  const hourText = formatHour(hour)
  return `강남·관악 상권 ${totalCount}개 · GRI 70 이상 위험 상권 ${dangerCount}개 · ${hourText} ${purposeText} 상위 ${topN}개 흐름 표시 중`
}

export function getNodeInterpretation(type: CommerceType, griScore: number): string {
  switch (type) {
    case '흡수형_과열':
      return griScore >= 80 ? '유입은 강하지만 과열 위험이 큽니다' : '유입이 강한 상권입니다'
    case '흡수형_성장':
      return '유입과 성장세가 함께 나타나는 상권입니다'
    case '방출형_침체':
      return '유출이 지속돼 방어가 필요한 상권입니다'
    case '고립형_단절':
      return '연결이 약해 흐름이 고립된 상권입니다'
    case '안정형':
      return '유입·유출 변동이 비교적 안정적입니다'
    case '미분류':
      return 'Dev-C 분석 결과가 아직 산출되지 않았습니다'
  }
}
