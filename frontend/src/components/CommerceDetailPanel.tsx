import { COMMERCE_COLORS } from '../styles/tokens'
import type { CommerceNode } from '../types/commerce'
import { useGriHistory } from '../hooks/useGriHistory'
import { usePolicyInsights } from '../hooks/usePolicyInsights'
import TrendChart from './TrendChart'
import PolicyCard from './PolicyCard'

interface CommerceDetailPanelProps {
  node: CommerceNode
  onClose: () => void
}

const TYPE_ICON: Record<string, string> = {
  흡수형_과열: '⚠',
  흡수형_성장: '↑',
  방출형_침체: '↓',
  고립형_단절: '✕',
  안정형:      '✓',
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
    color: '#546E7A',
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
    fontWeight: 600,
  }),
  sectionTitle: {
    fontSize: 11,
    color: '#546E7A',
    fontWeight: 600,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
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
  kpiLabel: { fontSize: 11, color: '#546E7A', marginBottom: 3 },
  kpiValue: (color?: string): React.CSSProperties => ({
    fontSize: 20,
    fontWeight: 700,
    color: color ?? '#ECEFF1',
  }),
  sourceLabel: {
    fontSize: 10,
    color: '#37474F',
    marginTop: 2,
  },
  chartBox: {
    background: '#263238',
    borderRadius: 8,
    padding: '10px 12px',
  },
  errorText: { fontSize: 12, color: '#EF5350' },
  loadingText: { fontSize: 12, color: '#546E7A' },
}

function netFlowColor(v: number): string {
  return v >= 0 ? '#43A047' : '#EF5350'
}

export default function CommerceDetailPanel({ node, onClose }: CommerceDetailPanelProps) {
  const { series, isLoading, error } = useGriHistory(node.id)
  const { insight, isLoading: policyLoading } = usePolicyInsights(node.id)
  const colorToken = COMMERCE_COLORS[node.type]
  const icon = TYPE_ICON[node.type] ?? '●'

  return (
    <div style={S.overlay}>
      <button style={S.closeBtn} onClick={onClose} aria-label="패널 닫기">✕</button>

      <div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, paddingRight: 28 }}>
          {node.name}
        </div>
        <span style={S.typeBadge(colorToken.fill)}>
          <span aria-hidden="true">{icon}</span>
          {node.type}
        </span>
      </div>

      <div>
        <div style={S.sectionTitle}>주요 지표</div>
        <div style={S.kpiGrid}>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>GRI 점수</div>
            <div style={S.kpiValue()}>{node.griScore}</div>
            <div style={S.sourceLabel}>출처: 서울시 공공데이터포털</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>순유입</div>
            <div style={S.kpiValue(netFlowColor(node.netFlow))}>
              {node.netFlow >= 0 ? '+' : ''}{node.netFlow}
            </div>
            <div style={S.sourceLabel}>출처: 생활이동 데이터</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>중심성</div>
            <div style={S.kpiValue()}>{(node.degreeCentrality * 100).toFixed(0)}%</div>
            <div style={S.sourceLabel}>출처: OD 흐름 분석</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>상권 등급</div>
            <div style={{ ...S.kpiValue(colorToken.fill), fontSize: 15 }}>{node.type.split('_')[0]}</div>
            <div style={S.sourceLabel}>규칙 기반 | AI 미사용</div>
          </div>
        </div>
      </div>

      <div style={S.chartBox}>
        <div style={S.sectionTitle}>GRI 12개월 추세</div>
        {isLoading && <div style={S.loadingText}>불러오는 중...</div>}
        {error && <div style={S.errorText}>{error}</div>}
        {!isLoading && !error && <TrendChart series={series} width={296} height={110} />}
      </div>

      <div>
        <div style={S.sectionTitle}>정책 추천</div>
        {policyLoading && <div style={S.loadingText}>불러오는 중...</div>}
        {!policyLoading && insight && <PolicyCard insight={insight} />}
      </div>
    </div>
  )
}
