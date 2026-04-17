import type { CSSProperties } from 'react'
import type { FlowPurpose, FlowStats } from '../hooks/useFlowData'
import type { CommerceNode } from '../types/commerce'
import { COMMERCE_COLORS, MAP_THEME, type CommerceType } from '../styles/tokens'

interface FlowControlPanelProps {
  purpose: FlowPurpose | null
  onPurposeChange: (p: FlowPurpose | null) => void
  hour: number
  onHourChange: (h: number) => void
  flowStrength: number
  onStrengthChange: (s: number) => void
  topN: number
  scopeLabel: string
  usingMockData: boolean
  selectedTypes: Set<CommerceType>
  selectedNode: CommerceNode | null
  stats: FlowStats
}

const PURPOSES: FlowPurpose[] = ['출근', '쇼핑', '여가', '귀가']

const PURPOSE_PEAK: Record<FlowPurpose, string> = {
  출근: '출근 피크',
  쇼핑: '점심~오후 소비 피크',
  여가: '저녁/주말 활동 피크',
  귀가: '저녁 귀가 피크',
}

const DENSITY_LABELS: Record<number, string> = {
  1: '낮음',
  2: '보통',
  3: '높음',
  4: '매우 높음',
  5: '최대',
}

function formatVolume(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(0)}만`
  return v.toLocaleString()
}

function formatLocation(id: string | null): string {
  if (!id) return '-'
  const parts = id.split('_')
  return parts[parts.length - 1] ?? id
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return '자정 0시'
  if (hour < 12) return `오전 ${hour}시`
  if (hour === 12) return '오후 12시'
  return `오후 ${hour - 12}시`
}

function getSelectedTypeEntries(selectedTypes: Set<CommerceType>) {
  return (Object.keys(COMMERCE_COLORS) as CommerceType[])
    .filter(type => selectedTypes.has(type))
    .map(type => ({ type, token: COMMERCE_COLORS[type] }))
}

const COLORS = MAP_THEME.dark

const S = {
  panel: {
    width: 320,
    minWidth: 320,
    height: '100%',
    background: '#10161D',
    borderLeft: `1px solid ${COLORS.panelBorder}`,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    padding: '18px 16px',
    gap: 18,
    boxSizing: 'border-box',
    color: COLORS.panelText,
    fontFamily: 'system-ui, sans-serif',
  } satisfies CSSProperties,
  header: {
    paddingBottom: 12,
    borderBottom: `1px solid ${COLORS.panelBorder}`,
  } satisfies CSSProperties,
  title: {
    fontSize: 15,
    fontWeight: 700,
    color: COLORS.panelText,
    marginBottom: 4,
  } satisfies CSSProperties,
  subtitle: {
    fontSize: 11,
    color: COLORS.mutedText,
    lineHeight: 1.45,
  } satisfies CSSProperties,
  statusRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 10,
  } satisfies CSSProperties,
  statusTag: {
    background: '#17212B',
    border: `1px solid ${COLORS.panelBorder}`,
    borderRadius: 999,
    padding: '3px 8px',
    fontSize: 10,
    color: COLORS.secondaryText,
  } satisfies CSSProperties,
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  } satisfies CSSProperties,
  sectionTitle: {
    fontSize: 11,
    letterSpacing: '0.05em',
    fontWeight: 700,
    color: COLORS.mutedText,
    textTransform: 'uppercase',
  } satisfies CSSProperties,
  label: {
    fontSize: 12,
    color: COLORS.secondaryText,
    fontWeight: 600,
  } satisfies CSSProperties,
  subLabel: {
    fontSize: 11,
    color: COLORS.mutedText,
    marginTop: 2,
    lineHeight: 1.4,
  } satisfies CSSProperties,
  purposeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
  } satisfies CSSProperties,
  purposeBtn: (active: boolean): CSSProperties => ({
    padding: '10px 8px',
    borderRadius: 10,
    border: active ? '1px solid rgba(123,208,141,0.45)' : `1px solid ${COLORS.panelBorder}`,
    background: active ? 'rgba(46,125,50,0.22)' : '#151D26',
    color: active ? '#D7F5DC' : COLORS.secondaryText,
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'left',
  }),
  purposePeak: (active: boolean): CSSProperties => ({
    fontSize: 10,
    color: active ? '#A5D6A7' : COLORS.mutedText,
    marginTop: 4,
    display: 'block',
  }),
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } satisfies CSSProperties,
  slider: {
    flex: 1,
    accentColor: '#7BD08D',
    cursor: 'pointer',
  } satisfies CSSProperties,
  sliderValue: {
    fontSize: 13,
    color: COLORS.panelText,
    fontWeight: 700,
    minWidth: 64,
    textAlign: 'right',
  } satisfies CSSProperties,
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  } satisfies CSSProperties,
  statCard: {
    background: '#151D26',
    borderRadius: 10,
    padding: '12px 12px 11px',
    border: `1px solid ${COLORS.panelBorder}`,
  } satisfies CSSProperties,
  statLabel: {
    fontSize: 10,
    color: COLORS.mutedText,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  } satisfies CSSProperties,
  statValue: {
    fontSize: 18,
    fontWeight: 700,
    color: COLORS.panelText,
  } satisfies CSSProperties,
  typeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  } satisfies CSSProperties,
  typeCard: {
    background: '#151D26',
    borderRadius: 10,
    border: `1px solid ${COLORS.panelBorder}`,
    padding: '10px 12px',
  } satisfies CSSProperties,
  typeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  } satisfies CSSProperties,
  typeBadge: (fill: string): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: fill,
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    flexShrink: 0,
  }),
  typeName: {
    fontSize: 12,
    fontWeight: 600,
    color: COLORS.panelText,
  } satisfies CSSProperties,
  typeDesc: {
    fontSize: 11,
    color: COLORS.secondaryText,
    lineHeight: 1.45,
  } satisfies CSSProperties,
  placeholderCard: {
    background: '#151D26',
    borderRadius: 10,
    border: `1px dashed ${COLORS.panelBorder}`,
    padding: '14px 12px',
  } satisfies CSSProperties,
  placeholderTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: COLORS.panelText,
    marginBottom: 4,
  } satisfies CSSProperties,
  placeholderText: {
    fontSize: 11,
    color: COLORS.secondaryText,
    lineHeight: 1.45,
  } satisfies CSSProperties,
  detailCard: {
    background: '#151D26',
    borderRadius: 10,
    border: `1px solid ${COLORS.panelBorder}`,
    padding: '12px 12px 10px',
  } satisfies CSSProperties,
  detailName: {
    fontSize: 14,
    fontWeight: 700,
    color: COLORS.panelText,
    marginBottom: 4,
  } satisfies CSSProperties,
  detailType: {
    fontSize: 11,
    fontWeight: 600,
    marginBottom: 8,
  } satisfies CSSProperties,
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  } satisfies CSSProperties,
  detailMetric: {
    background: '#10161D',
    borderRadius: 8,
    padding: '8px 9px',
  } satisfies CSSProperties,
  detailMetricLabel: {
    fontSize: 10,
    color: COLORS.mutedText,
    marginBottom: 4,
  } satisfies CSSProperties,
  detailMetricValue: {
    fontSize: 13,
    fontWeight: 700,
    color: COLORS.panelText,
  } satisfies CSSProperties,
} as const

export default function FlowControlPanel({
  purpose,
  onPurposeChange,
  hour,
  onHourChange,
  flowStrength,
  onStrengthChange,
  topN,
  scopeLabel,
  usingMockData,
  selectedTypes,
  selectedNode,
  stats,
}: FlowControlPanelProps) {
  const densityLabel = DENSITY_LABELS[flowStrength] ?? '보통'
  const selectedTypeEntries = getSelectedTypeEntries(selectedTypes)

  return (
    <aside style={S.panel}>
      <div style={S.header}>
        <div style={S.title}>흐름 분석 패널</div>
        <div style={S.subtitle}>
          현재 보기 설정과 대표 수치를 요약하고, 선택한 상권의 상세 분석을 이어서 확인합니다.
        </div>
        <div style={S.statusRow}>
          <span style={S.statusTag}>{scopeLabel}</span>
          <span style={S.statusTag}>{usingMockData ? '캐시 데이터' : 'API 연결'}</span>
        </div>
      </div>

      <section style={S.section}>
        <div style={S.sectionTitle}>현재 보기 설정</div>

        <div>
          <div style={S.label}>이동 목적</div>
          <div style={S.purposeGrid}>
            {PURPOSES.map((p) => {
              const active = purpose === p
              return (
                <button
                  key={p}
                  style={S.purposeBtn(active)}
                  onClick={() => onPurposeChange(active ? null : p)}
                >
                  <span>{p}</span>
                  <span style={S.purposePeak(active)}>{PURPOSE_PEAK[p]}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div style={S.label}>시간대</div>
          <div style={S.sliderRow}>
            <input
              type="range"
              min={0}
              max={23}
              value={hour}
              onChange={(e) => onHourChange(Number(e.target.value))}
              style={S.slider}
            />
            <span style={S.sliderValue}>{formatHourLabel(hour)}</span>
          </div>
          <div style={S.subLabel}>시간대별 생활인구 피크를 기준으로 흐름량을 스케일링합니다.</div>
        </div>

        <div>
          <div style={S.label}>가시화 밀도</div>
          <div style={S.sliderRow}>
            <input
              type="range"
              min={1}
              max={5}
              value={flowStrength}
              onChange={(e) => onStrengthChange(Number(e.target.value))}
              style={S.slider}
            />
            <span style={S.sliderValue}>{densityLabel}</span>
          </div>
          <div style={S.subLabel}>상위 {topN}개 흐름을 중심으로 지도 가독성을 유지합니다.</div>
        </div>
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>대표 수치</div>
        <div style={S.statsGrid}>
          <div style={S.statCard}>
            <div style={S.statLabel}>총 이동량</div>
            <div style={S.statValue}>{formatVolume(stats.totalVolume)}</div>
          </div>
          <div style={S.statCard}>
            <div style={S.statLabel}>활성 흐름</div>
            <div style={S.statValue}>{stats.activeCount}</div>
          </div>
          <div style={S.statCard}>
            <div style={S.statLabel}>최대 유입</div>
            <div style={{ ...S.statValue, fontSize: 14, color: '#A5D6A7' }}>
              {formatLocation(stats.topInflow)}
            </div>
          </div>
          <div style={S.statCard}>
            <div style={S.statLabel}>최대 유출</div>
            <div style={{ ...S.statValue, fontSize: 14, color: '#FFAB91' }}>
              {formatLocation(stats.topOutflow)}
            </div>
          </div>
        </div>
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>상권 유형 해석</div>
        <div style={S.typeList}>
          {selectedTypeEntries.map(({ type, token }) => (
            <div key={type} style={S.typeCard}>
              <div style={S.typeRow}>
                <span style={S.typeBadge(token.fill)}>{token.symbol}</span>
                <span style={S.typeName}>{token.label}</span>
              </div>
              <div style={S.typeDesc}>{token.description}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>선택 상권</div>
        {selectedNode ? (
          <div style={S.detailCard}>
            <div style={S.detailName}>{selectedNode.name}</div>
            <div style={{ ...S.detailType, color: COMMERCE_COLORS[selectedNode.type].textColor }}>
              {COMMERCE_COLORS[selectedNode.type].symbol} {COMMERCE_COLORS[selectedNode.type].label}
            </div>
            <div style={S.detailGrid}>
              <div style={S.detailMetric}>
                <div style={S.detailMetricLabel}>GRI</div>
                <div style={S.detailMetricValue}>{selectedNode.griScore}</div>
              </div>
              <div style={S.detailMetric}>
                <div style={S.detailMetricLabel}>순유입</div>
                <div style={S.detailMetricValue}>
                  {selectedNode.netFlow >= 0 ? '+' : ''}{selectedNode.netFlow.toLocaleString()}
                </div>
              </div>
              <div style={S.detailMetric}>
                <div style={S.detailMetricLabel}>중심성</div>
                <div style={S.detailMetricValue}>{(selectedNode.degreeCentrality * 100).toFixed(0)}%</div>
              </div>
              <div style={S.detailMetric}>
                <div style={S.detailMetricLabel}>상세 분석</div>
                <div style={S.detailMetricValue}>지도 카드 확인</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={S.placeholderCard}>
            <div style={S.placeholderTitle}>상권을 선택하면 상세 분석이 표시됩니다</div>
            <div style={S.placeholderText}>
              지도에서 상권 노드를 클릭하면 GRI 추세, 개입 등급, 연결 중심성을 바로 확인할 수 있습니다.
            </div>
          </div>
        )}
      </section>
    </aside>
  )
}
