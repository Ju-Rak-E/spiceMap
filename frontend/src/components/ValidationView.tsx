import { useEffect, useState } from 'react'
import staticResults from '../data/validation_results.json'

// docs/hero_shot_scenario.md §1-4: 검증 보고 탭 — H1/H3/B1/B3 4카드.
// 백엔드 /api/insights/validation 미연결 시 정적 JSON fallback.

export interface ValidationCard {
  id: string
  title: string
  headline: string
  metric_primary: string
  metric_secondary: string
  sample_size: string
  summary: string
  criterion: string
  source: string
}

interface ValidationResults {
  generated_at: string
  quarter: string
  previous_quarter: string
  cards: ValidationCard[]
}

const STATIC_RESULTS = staticResults as ValidationResults

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

async function fetchValidationResults(): Promise<ValidationResults> {
  if (!API_BASE) return STATIC_RESULTS
  try {
    const res = await fetch(`${API_BASE}/api/insights/validation`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as ValidationResults
  } catch {
    return STATIC_RESULTS
  }
}

interface ValidationViewProps {
  onClose: () => void
}

const S = {
  container: {
    position: 'absolute' as const,
    inset: 0,
    background: '#0E141B',
    color: '#ECEFF1',
    overflow: 'auto',
    padding: '32px 40px 48px',
    zIndex: 50,
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 24,
    flexWrap: 'wrap' as const,
  },
  title: { fontSize: 22, fontWeight: 800 },
  subtitle: { fontSize: 12, color: '#90A4AE', marginTop: 4 },
  closeBtn: {
    background: '#1A2530',
    border: '1px solid #304251',
    borderRadius: 8,
    padding: '8px 14px',
    color: '#ECEFF1',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16,
  },
  card: {
    background: '#17202A',
    border: '1px solid #263238',
    borderRadius: 12,
    padding: '18px 18px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: 700 },
  cardHeadline: { fontSize: 12, color: '#7BD08D', fontWeight: 700 },
  metricRow: { display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' as const },
  metricPrimary: { fontSize: 22, fontWeight: 800, color: '#FFC107' },
  metricSecondary: { fontSize: 12, color: '#90A4AE' },
  summary: { fontSize: 12, color: '#B0BEC5', lineHeight: 1.55 },
  criterion: {
    fontSize: 11,
    color: '#FB8C00',
    fontWeight: 600,
    background: '#FB8C0011',
    border: '1px solid #FB8C0033',
    padding: '4px 8px',
    borderRadius: 6,
    alignSelf: 'flex-start' as const,
  },
  source: { fontSize: 10, color: '#546E7A', marginTop: 'auto', paddingTop: 8 },
}

export default function ValidationView({ onClose }: ValidationViewProps) {
  const [results, setResults] = useState<ValidationResults>(STATIC_RESULTS)

  useEffect(() => {
    let cancelled = false
    fetchValidationResults().then((data) => {
      if (!cancelled) setResults(data)
    })
    return () => { cancelled = true }
  }, [])

  return (
    <div style={S.container} role="region" aria-label="검증 보고">
      <div style={S.header}>
        <div>
          <div style={S.title}>검증 보고</div>
          <div style={S.subtitle}>
            가설 H1·H3 + 베이스라인 B1·B3 — {results.quarter} 기준 ({results.generated_at})
          </div>
        </div>
        <button type="button" style={S.closeBtn} onClick={onClose}>
          ← 지도로 돌아가기
        </button>
      </div>

      <div style={S.grid}>
        {results.cards.map((card) => (
          <article key={card.id} style={S.card} data-testid={`validation-card-${card.id}`}>
            <div>
              <div style={S.cardTitle}>{card.title}</div>
              <div style={S.cardHeadline}>{card.headline}</div>
            </div>
            <div style={S.metricRow}>
              <span style={S.metricPrimary}>{card.metric_primary}</span>
              <span style={S.metricSecondary}>{card.metric_secondary}</span>
            </div>
            <div style={S.metricSecondary}>{card.sample_size}</div>
            <div style={S.summary}>{card.summary}</div>
            <div style={S.criterion}>{card.criterion}</div>
            <div style={S.source}>출처: {card.source}</div>
          </article>
        ))}
      </div>
    </div>
  )
}
