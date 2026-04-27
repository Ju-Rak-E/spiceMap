import type { FlowPurpose } from '../hooks/useFlowData'
import type { CommerceType } from '../styles/tokens'
import { COMMERCE_COLORS } from '../styles/tokens'

const TOP_N_TO_DENSITY: Record<number, string> = {
  5: '낮음', 10: '보통', 15: '높음', 20: '매우 높음', 30: '최대',
}

function formatHour(hour: number): string {
  if (hour === 0) return '자정 0시'
  if (hour < 12) return `오전 ${hour}시`
  if (hour === 12) return '오후 12시'
  return `오후 ${hour - 12}시`
}

function getTypesSummary(selectedTypes: Set<CommerceType>): string {
  const allTypes = Object.keys(COMMERCE_COLORS) as CommerceType[]
  if (selectedTypes.size === allTypes.length) return '모든 상권 유형'
  if (selectedTypes.size === 0) return '상권 유형 미선택'

  const selected = [...selectedTypes]
  const 침체계열: CommerceType[] = ['방출형_침체', '고립형_단절']
  if (selected.length === 1 && selected[0] === '미분류') return '미분석 상권만'
  if (selected.every(t => 침체계열.includes(t))) return '침체/단절 계열 상권만'

  const labels = selected.map(t => COMMERCE_COLORS[t].label)
  return `선택된 유형(${labels.join(', ')})`
}

export function buildSummaryText(
  purpose: FlowPurpose | null,
  hour: number,
  topN: number,
  selectedTypes: Set<CommerceType>,
): string {
  const purposeText = purpose ?? '전체 목적'
  const density = TOP_N_TO_DENSITY[topN] ?? '보통'
  const hourText = formatHour(hour)
  const typesSummary = getTypesSummary(selectedTypes)

  return `현재 화면은 ${hourText} ${purposeText} 흐름 중 상위 ${topN}개(${density})를 중심으로, ${typesSummary}을 강조해 보여줍니다.`
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
