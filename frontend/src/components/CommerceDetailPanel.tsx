import { COMMERCE_COLORS } from '../styles/tokens'
import type { CommerceNode } from '../types/commerce'
import { useGriHistory, type GriPoint } from '../hooks/useGriHistory'
import { formatQuarter } from '../utils/quarter'
import { deriveStartupSummary } from '../utils/startupAdvisor'
import { formatFixed2, formatSignedFixed2 } from '../utils/numberFormat'
import TrendChart from './TrendChart'

interface CommerceDetailPanelProps {
  node: CommerceNode | null
  quarter: string
  usingMockData?: boolean
  onClose: () => void
}

const TYPE_ICON: Record<string, string> = {
  흡수형_과열: '!',
  흡수형_성장: '+',
  방출형_침체: '-',
  고립형_단절: 'x',
  안정형: 'ok',
}

const S = {
  overlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: 360,
    height: '100%',
    background: '#1A2332',
    borderRight: '1px solid #263238',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    zIndex: 20,
    overflowY: 'auto' as const,
    padding: '16px 16px',
    boxSizing: 'border-box' as const,
    color: '#ECEFF1',
    fontFamily: 'system-ui, sans-serif',
    gap: 14,
    boxShadow: '4px 0 16px rgba(0,0,0,0.5)',
  },
  closeBtn: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    background: 'transparent',
    border: 'none',
    color: '#78909C',
    fontSize: 20,
    cursor: 'pointer',
    lineHeight: 1,
    padding: 4,
  },
  typeBadge: (fill: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: fill + '33',
    border: `1px solid ${fill}`,
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 12,
    color: fill,
    fontWeight: 700,
  }),
  sectionTitle: {
    fontSize: 11,
    color: '#78909C',
    fontWeight: 700,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  summaryCard: {
    background: '#263238',
    borderRadius: 8,
    border: '1px solid #37474F',
    padding: '12px 12px',
  },
  summaryHeadline: {
    fontSize: 14,
    fontWeight: 700,
    color: '#ECEFF1',
    lineHeight: 1.45,
    marginBottom: 8,
  },
  list: {
    margin: 0,
    paddingLeft: 17,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 5,
  },
  listItem: {
    fontSize: 12,
    color: '#B0BEC5',
    lineHeight: 1.45,
  },
  kpiGrid: {
    display: 'grid' as const,
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  kpiCard: {
    background: '#263238',
    borderRadius: 8,
    padding: '10px 12px',
  },
  kpiLabel: { fontSize: 11, color: '#78909C', marginBottom: 3 },
  kpiValue: (color?: string): React.CSSProperties => ({
    fontSize: 20,
    fontWeight: 700,
    color: color ?? '#ECEFF1',
  }),
  sourceLabel: {
    fontSize: 10,
    color: '#78909C',
    marginTop: 2,
  },
  chartBox: {
    background: '#263238',
    borderRadius: 8,
    padding: '10px 12px',
  },
  hintGrid: {
    display: 'grid' as const,
    gridTemplateColumns: '1fr',
    gap: 8,
  },
  hintBox: {
    background: '#263238',
    borderRadius: 8,
    padding: '10px 12px',
  },
  errorText: { fontSize: 12, color: '#EF5350' },
  loadingText: { fontSize: 12, color: '#78909C' },
  emptyText: { fontSize: 12, color: '#B0BEC5', lineHeight: 1.5 },
}

function netFlowColor(v: number): string {
  return v >= 0 ? '#43A047' : '#EF5350'
}

function getLatestRiskDelta(series: GriPoint[]): number | null {
  if (series.length < 2) return null
  const latest = series[series.length - 1]
  const previous = series[series.length - 2]
  return latest.gri - previous.gri
}

function deltaColor(delta: number | null): string | undefined {
  if (delta == null) return undefined
  if (delta > 0) return '#EF5350'
  if (delta < 0) return '#43A047'
  return '#ECEFF1'
}

export default function CommerceDetailPanel({
  node,
  quarter,
  usingMockData = false,
  onClose,
}: CommerceDetailPanelProps) {
  const nodeId = node?.id ?? null
  const { series, isLoading, error } = useGriHistory(nodeId, quarter)
  if (!node) {
    return (
      <div
        style={{
          ...S.overlay,
          alignItems: 'center',
          justifyContent: 'center',
          color: '#546E7A',
          textAlign: 'center',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 28, lineHeight: 1 }}>🗺</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#78909C' }}>
          상권을 클릭하면
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          GRI · 폐업률 · 흐름 추세<br />상세 분석을 확인할 수 있습니다
        </div>
      </div>
    )
  }

  const colorToken = COMMERCE_COLORS[node.type]
  const startup = deriveStartupSummary(node)
  const icon = TYPE_ICON[node.type] ?? 'type'
  const riskDelta = getLatestRiskDelta(series)

  return (
    <div style={S.overlay}>
      <button style={S.closeBtn} onClick={onClose} aria-label="패널 닫기">x</button>

      <div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, paddingRight: 28 }}>
          {node.name}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={S.typeBadge(startup.fitColor)}>{startup.fitLabel}</span>
          <span style={S.typeBadge(colorToken.fill)}>
            <span aria-hidden="true">{icon}</span>
            {startup.characterLabel}
          </span>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: '#90A4AE' }}>
          {formatQuarter(quarter)} · {usingMockData ? '캐시 데이터' : 'API 연결'} · 판단 신뢰도 {startup.dataConfidenceLabel}
        </div>
      </div>

      <div>
        <div style={S.sectionTitle}>창업 판단</div>
        <div style={S.summaryCard}>
          <div style={S.summaryHeadline}>{startup.headline}</div>
          <ul style={S.list}>
            {startup.reasons.map((reason) => (
              <li key={reason} style={S.listItem}>{reason}</li>
            ))}
          </ul>
          <div style={{ marginTop: 8, fontSize: 11, color: '#78909C' }}>
            성격 근거: {startup.characterBasis}
          </div>
        </div>
      </div>

      <div>
        <div style={S.sectionTitle}>핵심 지표</div>
        <div style={S.kpiGrid}>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>창업 적합도</div>
            <div style={S.kpiValue(startup.fitColor)}>{startup.fitScore}</div>
            <div style={S.sourceLabel}>높을수록 검토 우선</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>고객 흐름</div>
            <div style={S.kpiValue(netFlowColor(node.netFlow))}>{startup.flowLabel}</div>
            <div style={S.sourceLabel}>{`순유입 ${formatSignedFixed2(node.netFlow)}`}</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>폐업률</div>
            <div style={S.kpiValue(node.closeRate != null && node.closeRate >= 10 ? '#EF5350' : undefined)}>
              {node.closeRate != null ? `${node.closeRate.toFixed(1)}%` : '-'}
            </div>
            <div style={S.sourceLabel}>점포 데이터 기준</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>상권 위험도</div>
            <div style={S.kpiValue(colorToken.fill)}>{formatFixed2(node.griScore)}</div>
            <div style={S.sourceLabel}>GRI 기반 보조 지표</div>
          </div>
        </div>
      </div>

      <div>
        <div style={S.sectionTitle}>전 분기 대비</div>
        <div style={S.kpiGrid}>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>상권 위험도 변화</div>
            <div style={S.kpiValue(deltaColor(riskDelta))}>
              {riskDelta == null ? '-' : formatSignedFixed2(riskDelta)}
            </div>
            <div style={S.sourceLabel}>GRI 최근 2개 분기 기준</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>순유입 변화</div>
            <div style={S.kpiValue()}>준비중</div>
            <div style={S.sourceLabel}>분기별 OD 합산 API 연결 예정</div>
          </div>
        </div>
      </div>

      <div style={S.chartBox}>
        <div style={S.sectionTitle}>상권 위험도 추세</div>
        {isLoading && <div style={S.loadingText}>불러오는 중...</div>}
        {error && <div style={S.errorText}>{error}</div>}
        {!isLoading && !error && <TrendChart series={series} width={296} height={110} />}
      </div>

      <div>
        <div style={S.sectionTitle}>주의 신호</div>
        <div style={S.summaryCard}>
          <ul style={S.list}>
            {startup.risks.map((risk) => (
              <li key={risk} style={S.listItem}>{risk}</li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <div style={S.sectionTitle}>업종 힌트</div>
        <div style={S.hintGrid}>
          <div style={S.hintBox}>
            <div style={S.kpiLabel}>검토 업종</div>
            <div style={S.emptyText}>{startup.suitableIndustries.join(', ')}</div>
          </div>
          <div style={S.hintBox}>
            <div style={S.kpiLabel}>주의 업종</div>
            <div style={S.emptyText}>{startup.cautionIndustries.join(', ')}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
