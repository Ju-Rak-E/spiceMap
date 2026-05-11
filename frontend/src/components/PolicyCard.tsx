import { BADGE_COLORS } from '../styles/tokens'
import type { PolicyInsight } from '../hooks/usePolicyInsights'

interface PolicyCardProps {
  insight: PolicyInsight
  highlight?: boolean
}

const PRIORITY_ICON: Record<string, string> = {
  즉시개입: '!',
  연내지원: '+',
  모니터링: 'i',
}

const HIGHLIGHT_BORDER = '#FFC107'

function responseSignal(insight: PolicyInsight): string {
  const text = `${insight.title} ${insight.rationale}`
  if (text.includes('젠트리피케이션') || text.includes('임대료') || insight.ruleId === 'R4') return '젠트리피케이션 예방'
  if (text.includes('성장') || text.includes('창업') || insight.ruleId === 'R6') return '성장 지원'
  if (text.includes('공실')) return '공실 관리'
  if (text.includes('폐업')) return '폐업 위험 완화'
  if (text.includes('균형') || text.includes('편중') || text.includes('다양화')) return '업종 다양화 유도'
  if (text.includes('과열') || insight.priority === '즉시개입') return '과열 관리'
  return '지속 모니터링'
}

function regionalProposalText(text: string): string {
  return text
    .replace(/창업 인프라/g, '업종 지원 인프라')
    .replace(/창업 공간/g, '상업 공간')
    .replace(/정책/g, '대응')
    .replace(/권고/g, '검토')
    .replace(/확충/g, '검토')
}

export default function PolicyCard({ insight, highlight = false }: PolicyCardProps) {
  const color = BADGE_COLORS[insight.priority] ?? '#90A4AE'
  const icon = PRIORITY_ICON[insight.priority] ?? 'i'
  const signal = responseSignal(insight)
  const title = regionalProposalText(insight.title)
  const rationale = regionalProposalText(insight.rationale)

  return (
    <div
      data-testid={highlight ? 'policy-card-highlight' : 'policy-card'}
      style={{
        background: '#202A33',
        borderRadius: 8,
        padding: '12px',
        border: '1px solid #34424D',
        borderLeft: `3px solid ${color}99`,
        outline: highlight ? `2px solid ${HIGHLIGHT_BORDER}` : 'none',
        outlineOffset: highlight ? 2 : 0,
        boxShadow: highlight ? `0 0 0 4px ${HIGHLIGHT_BORDER}22` : 'none',
        animation: highlight ? 'heroPolicyFadeIn 300ms ease-out' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: color + '22',
            border: `1px solid ${color}`,
            borderRadius: 4,
            padding: '1px 7px',
            fontSize: 11,
            color,
            fontWeight: 700,
          }}
        >
          <span aria-hidden="true">{icon}</span>
          {signal}
        </span>
        <span
          style={{
            fontSize: 10,
            color: '#78909C',
            marginLeft: 'auto',
            lineHeight: 1.3,
          }}
        >
          규칙 기반 제안 · 실제 시행 정책 아님
        </span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#DDE6ED', marginBottom: 5 }}>
        {title}
      </div>

      <div style={{ fontSize: 11, color: '#90A4AE', lineHeight: 1.5, marginBottom: 6 }}>
        {rationale}
      </div>

      <div style={{ fontSize: 10, color: '#78909C' }}>
        상권 지표 기반 대응 제안 · 규칙: {insight.source}
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: '#B0BEC5', lineHeight: 1.45 }}>
        지자체 대응 참고 정보이며 창업 추천 결과와는 별개의 참고 정보입니다.
      </div>
    </div>
  )
}
