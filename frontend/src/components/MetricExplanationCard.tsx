import type { CSSProperties } from 'react'
import type { MetricExplanation, MetricTone } from '../utils/founderUx'

const TONE_COLOR: Record<MetricTone, string> = {
  good: '#7BD08D',
  caution: '#FFCC80',
  danger: '#EF9A9A',
  neutral: '#90A4AE',
}

const S = {
  card: (tone: MetricTone): CSSProperties => ({
    background: '#263238',
    borderRadius: 8,
    border: `1px solid ${TONE_COLOR[tone]}55`,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  }),
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  } satisfies CSSProperties,
  label: { fontSize: 11, color: '#90A4AE', fontWeight: 700 } satisfies CSSProperties,
  value: (tone: MetricTone): CSSProperties => ({
    fontSize: 19,
    fontWeight: 800,
    color: TONE_COLOR[tone],
  }),
  badge: (tone: MetricTone): CSSProperties => ({
    fontSize: 10,
    color: TONE_COLOR[tone],
    background: `${TONE_COLOR[tone]}22`,
    border: `1px solid ${TONE_COLOR[tone]}55`,
    borderRadius: 999,
    padding: '2px 7px',
    whiteSpace: 'nowrap',
  }),
  copy: { fontSize: 10, color: '#B0BEC5', lineHeight: 1.45 } satisfies CSSProperties,
  basis: { fontSize: 10, color: '#78909C', lineHeight: 1.45 } satisfies CSSProperties,
  action: { fontSize: 10, color: '#D7F5DC', lineHeight: 1.45, fontWeight: 650 } satisfies CSSProperties,
}

interface MetricExplanationCardProps {
  metric: MetricExplanation
}

export default function MetricExplanationCard({ metric }: MetricExplanationCardProps) {
  return (
    <div style={S.card(metric.tone)}>
      <div style={S.labelRow}>
        <div style={S.label}>{metric.label}</div>
        <span style={S.badge(metric.tone)}>{metric.shortMeaning}</span>
      </div>
      <div style={S.value(metric.tone)}>{metric.value}</div>
      <div style={S.basis}>{metric.basis}</div>
      <div style={S.action}>{metric.nextAction}</div>
    </div>
  )
}
