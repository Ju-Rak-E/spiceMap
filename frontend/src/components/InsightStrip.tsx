/**
 * InsightStrip — 지도 우상단 3칸 핵심 KPI 디스플레이.
 *
 * 전략(strategy_d13.md §5 §7): 첫 화면에서 검증 결과·정책 카드 N·위험 상권 N을
 * 즉시 노출하여 "차별화 + 데이터 활용도"를 30초 안에 전달한다.
 */
import { MAP_THEME, type MapTheme } from '../styles/tokens'

type ThemeColors = (typeof MAP_THEME)[MapTheme]

export interface InsightStripProps {
  theme?: MapTheme
  /** H1 검증 Pearson r (없으면 — 표시) */
  h1R?: number | null
  /** H1 검증 p-value (선택, 표시용) */
  h1P?: number | null
  /** 적재된 정책 카드 N (전체 분기 합 또는 현재 분기) */
  policyCardCount: number
  /** GRI ≥ 80 (즉시개입) 상권 수 (지도에 표시된 nodes 기준) */
  criticalCommerceCount: number
  /** 분기 라벨 (예: '2025Q4') */
  quarter?: string
}

export default function InsightStrip(props: InsightStripProps) {
  const {
    theme = 'dark',
    h1R = null,
    h1P = null,
    policyCardCount,
    criticalCommerceCount,
    quarter,
  } = props
  const colors = MAP_THEME[theme]

  return (
    <div
      data-testid="insight-strip"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: 8,
        maxWidth: '100%',
        pointerEvents: 'auto',
      }}
    >
      <Card
        label="유동인구-매출 상관"
        primary={h1R == null ? '—' : h1R.toFixed(3)}
        secondary={h1P == null ? '순유입×매출' : `p=${formatP(h1P)}`}
        tertiary="통계적으로 확실 (효과 약함)"
        accent="#90CAF9"
        colors={colors}
        title="H1: 순유입↑→매출↑. 임계 r ≥ 0.5"
      />
      <Card
        label="정책 카드"
        primary={policyCardCount.toLocaleString()}
        secondary="규칙 기반 자동 생성"
        tertiary="R4~R7 상권별 자동 매칭"
        accent="#FFCC80"
        colors={colors}
        title="Module D R4~R7 결과 (Critical/Medium/Low)"
      />
      <Card
        label="즉시 개입 상권"
        primary={criticalCommerceCount.toLocaleString()}
        secondary={quarter ? `${quarter} GRI ≥ 80` : 'GRI ≥ 80'}
        tertiary="매출 안정인데 흐름 끊김"
        accent="#EF9A9A"
        colors={colors}
        title="Module B GRI 상위 — 우선순위 80+ 정책 개입 대상"
      />
    </div>
  )
}

interface CardProps {
  label: string
  primary: string
  secondary: string
  /** 해석 1줄 — 통계 수치를 비전문가 친화적으로 풀어쓴 카피 (선택). */
  tertiary?: string
  accent: string
  colors: ThemeColors
  title: string
}

function Card({ label, primary, secondary, tertiary, accent, colors, title }: CardProps) {
  return (
    <div
      title={title}
      style={{
        background: 'rgba(16,22,29,0.92)',
        border: `1px solid ${colors.panelBorder}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 8,
        padding: '8px 12px',
        minWidth: 96,
        maxWidth: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <div style={{ fontSize: 9, color: colors.mutedText, fontWeight: 600, letterSpacing: 0.3 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent, lineHeight: 1.1 }}>
        {primary}
      </div>
      <div style={{ fontSize: 9, color: colors.secondaryText, marginTop: 2 }}>
        {secondary}
      </div>
      {tertiary && (
        <div
          style={{
            fontSize: 10,
            color: colors.panelText,
            marginTop: 3,
            lineHeight: 1.3,
            fontWeight: 500,
          }}
        >
          {tertiary}
        </div>
      )}
    </div>
  )
}

function formatP(p: number): string {
  if (p < 1e-4) return p.toExponential(1)
  return p.toPrecision(2)
}

