import { BADGE_COLORS } from '../styles/tokens'
import type { PolicyInsight } from '../hooks/usePolicyInsights'

interface PolicyCardProps {
  insight: PolicyInsight
}

const PRIORITY_ICON: Record<string, string> = {
  즉시개입: '🚨',
  연내지원: '📋',
  모니터링: '👁',
}

export default function PolicyCard({ insight }: PolicyCardProps) {
  const color = BADGE_COLORS[insight.priority]
  const icon = PRIORITY_ICON[insight.priority] ?? '📌'

  return (
    <div
      style={{
        background: '#263238',
        borderRadius: 8,
        padding: '12px',
        borderLeft: `3px solid ${color}`,
      }}
    >
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
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
          {insight.priority}
        </span>
        <span
          style={{
            fontSize: 10,
            color: '#546E7A',
            marginLeft: 'auto',
          }}
        >
          규칙 기반 | AI 미사용
        </span>
      </div>

      {/* 제목 */}
      <div style={{ fontSize: 13, fontWeight: 700, color: '#ECEFF1', marginBottom: 5 }}>
        {insight.title}
      </div>

      {/* 근거 */}
      <div style={{ fontSize: 11, color: '#90A4AE', lineHeight: 1.5, marginBottom: 6 }}>
        {insight.rationale}
      </div>

      {/* 출처 */}
      <div style={{ fontSize: 10, color: '#37474F' }}>
        출처: {insight.source}
      </div>
    </div>
  )
}
