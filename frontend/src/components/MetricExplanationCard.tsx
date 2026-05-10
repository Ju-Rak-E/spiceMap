import type { CSSProperties } from 'react'
import type { MetricExplanation, MetricTone } from '../utils/founderUx'

const TONE_COLOR: Record<MetricTone, string> = {
  good: '#7BD08D',
  caution: '#FFCC80',
  danger: '#EF9A9A',
  neutral: '#90A4AE',
}

const RISK_SCALE = [
  { label: '낮음', color: '#7BD08D', flex: 40 },
  { label: '주의', color: '#FFCC80', flex: 30 },
  { label: '위협', color: '#EF9A9A', flex: 30 },
]

const S = {
  card: (tone: MetricTone): CSSProperties => ({
    background: '#22303A',
    borderRadius: 8,
    border: `1px solid ${TONE_COLOR[tone]}66`,
    borderLeft: `3px solid ${TONE_COLOR[tone]}`,
    padding: '12px 12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 9,
    minHeight: 104,
    boxSizing: 'border-box',
  }),
  label: {
    fontSize: 12,
    color: '#B0BEC5',
    fontWeight: 750,
    lineHeight: 1.25,
  } satisfies CSSProperties,
  value: (tone: MetricTone): CSSProperties => ({
    fontSize: 24,
    fontWeight: 850,
    lineHeight: 1.05,
    color: TONE_COLOR[tone],
    wordBreak: 'keep-all',
  }),
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
  } satisfies CSSProperties,
  badge: (tone: MetricTone): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 22,
    fontSize: 11,
    fontWeight: 750,
    color: TONE_COLOR[tone],
    background: `${TONE_COLOR[tone]}22`,
    border: `1px solid ${TONE_COLOR[tone]}55`,
    borderRadius: 6,
    padding: '2px 8px',
    whiteSpace: 'nowrap',
  }),
  riskScale: {
    display: 'flex',
    position: 'relative',
    height: 12,
    overflow: 'visible',
    borderRadius: 999,
    marginTop: 1,
  } satisfies CSSProperties,
  riskSegment: (color: string, flex: number): CSSProperties => ({
    flex,
    background: color,
    opacity: 0.85,
  }),
  riskMarker: (score: number, tone: MetricTone): CSSProperties => ({
    position: 'absolute',
    left: `${Math.max(0, Math.min(100, score))}%`,
    top: -4,
    width: 6,
    height: 20,
    borderRadius: 999,
    background: TONE_COLOR[tone],
    border: '2px solid #ECEFF1',
    boxShadow: '0 0 0 2px #1A2332',
    transform: 'translateX(-50%)',
  }),
  riskLabels: {
    display: 'grid',
    gridTemplateColumns: '40fr 30fr 30fr',
    gap: 4,
    marginTop: 6,
    fontSize: 10,
    color: '#B0BEC5',
    fontWeight: 700,
    lineHeight: 1.2,
  } satisfies CSSProperties,
  riskLabel: (align: CSSProperties['textAlign']): CSSProperties => ({
    textAlign: align,
  }),
}

interface MetricExplanationCardProps {
  metric: MetricExplanation
}

function RiskScale({ score, tone }: { score: number, tone: MetricTone }) {
  return (
    <div>
      <div style={S.riskScale} aria-label={`상권 위험도 ${Math.round(score)}점`}>
        {RISK_SCALE.map((segment, index) => (
          <div
            key={segment.label}
            style={{
              ...S.riskSegment(segment.color, segment.flex),
              borderTopLeftRadius: index === 0 ? 999 : 0,
              borderBottomLeftRadius: index === 0 ? 999 : 0,
              borderTopRightRadius: index === RISK_SCALE.length - 1 ? 999 : 0,
              borderBottomRightRadius: index === RISK_SCALE.length - 1 ? 999 : 0,
            }}
          />
        ))}
        <div style={S.riskMarker(score, tone)} />
      </div>
      <div style={S.riskLabels}>
        <span style={S.riskLabel('left')}>낮음</span>
        <span style={S.riskLabel('center')}>주의</span>
        <span style={S.riskLabel('right')}>위협</span>
      </div>
    </div>
  )
}

export default function MetricExplanationCard({ metric }: MetricExplanationCardProps) {
  const riskScore = metric.key === 'griScore' ? metric.numericValue : undefined

  return (
    <div style={S.card(metric.tone)}>
      <div style={S.label}>{metric.label}</div>
      <div style={S.value(metric.tone)}>{metric.value}</div>
      {riskScore != null && <RiskScale score={riskScore} tone={metric.tone} />}
      <div style={S.footer}>
        <span style={S.badge(metric.tone)}>{metric.shortMeaning}</span>
      </div>
    </div>
  )
}
