import type { CSSProperties } from 'react'
import type { FlowPurpose, FlowStats } from '../hooks/useFlowData'
import type { CommerceNode } from '../types/commerce'
import { COMMERCE_COLORS, MAP_THEME, type CommerceType } from '../styles/tokens'

const PURPOSE_OPTIONS: Array<{ value: FlowPurpose; label: string; peak: string }> = [
  { value: '출근', label: '출근', peak: '오전 피크' },
  { value: '쇼핑', label: '쇼핑', peak: '오후 피크' },
  { value: '여가', label: '여가', peak: '저녁 피크' },
  { value: '귀가', label: '귀가', peak: '퇴근 이후' },
]

const DENSITY_LABELS: Record<number, string> = {
  1: '매우 낮음',
  2: '낮음',
  3: '보통',
  4: '높음',
  5: '매우 높음',
}

const DISTRICTS = ['강남구', '관악구'] as const
const QUARTER_SUGGESTIONS = ['2024Q1', '2024Q2', '2024Q3', '2024Q4', '2025Q1', '2025Q4'] as const
const COLORS = MAP_THEME.dark

interface FlowControlPanelProps {
  purpose: FlowPurpose | null
  onPurposeChange: (p: FlowPurpose | null) => void
  hour: number
  onHourChange: (h: number) => void
  flowStrength: number
  onStrengthChange: (s: number) => void
  selectedQuarter: string
  onQuarterChange: (q: string) => void
  topN: number
  scopeLabel: string
  usingMockData: boolean
  selectedTypes: Set<CommerceType>
  selectedNode: CommerceNode | null
  stats: FlowStats
  isPlaying: boolean
  speed: 1 | 2 | 4
  onPlay: () => void
  onPause: () => void
  onToggleSpeed: () => void
  selectedDistricts: Set<string>
  onToggleDistrict: (d: string) => void
  onToggleType: (t: CommerceType) => void
}

function formatVolume(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}만`
  return value.toLocaleString()
}

function formatLocation(value: string | null): string {
  if (!value) return '-'
  const parts = value.split('_')
  return parts[parts.length - 1] ?? value
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return '오전 12시'
  if (hour < 12) return `오전 ${hour}시`
  if (hour === 12) return '오후 12시'
  return `오후 ${hour - 12}시`
}

function shiftQuarter(quarter: string, delta: number): string {
  const match = quarter.match(/^(\d{4})Q([1-4])$/)
  if (!match) return quarter
  const year = Number(match[1])
  const q = Number(match[2])
  const zeroBased = year * 4 + (q - 1) + delta
  const nextYear = Math.floor(zeroBased / 4)
  const nextQuarter = (zeroBased % 4) + 1
  return `${nextYear}Q${nextQuarter}`
}

function getSelectedTypeEntries(selectedTypes: Set<CommerceType>) {
  return (Object.keys(COMMERCE_COLORS) as CommerceType[])
    .filter((type) => selectedTypes.has(type))
    .map((type) => ({ type, token: COMMERCE_COLORS[type] }))
}

const S = {
  panel: {
    width: 320,
    minWidth: 320,
    height: '100%',
    background: COLORS.panelBg,
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
    background: active ? 'rgba(46,125,50,0.22)' : COLORS.panelSurface,
    color: active ? '#D7F5DC' : COLORS.secondaryText,
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
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
    minWidth: 72,
    textAlign: 'right',
  } satisfies CSSProperties,
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  } satisfies CSSProperties,
  statCard: {
    background: COLORS.panelSurface,
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
    background: COLORS.panelSurface,
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
  detailCard: {
    background: COLORS.panelSurface,
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
    background: COLORS.panelBg,
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
  pillButton: (active: boolean, color: string): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 10px',
    borderRadius: 8,
    border: active ? `1.5px solid ${color}` : `1px solid ${COLORS.panelBorder}`,
    background: active ? `${color}22` : COLORS.panelSurface,
    color: active ? color : COLORS.secondaryText,
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    textAlign: 'left',
  }),
  districtGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  } satisfies CSSProperties,
  quarterRow: {
    display: 'grid',
    gridTemplateColumns: '36px 1fr 36px',
    gap: 8,
  } satisfies CSSProperties,
  quarterInput: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 8,
    border: `1px solid ${COLORS.panelBorder}`,
    background: COLORS.panelSurface,
    color: COLORS.panelText,
    padding: '8px 10px',
    fontSize: 13,
    fontWeight: 700,
    textAlign: 'center',
    textTransform: 'uppercase',
  } satisfies CSSProperties,
  quarterNavButton: {
    borderRadius: 8,
    border: `1px solid ${COLORS.panelBorder}`,
    background: COLORS.panelSurface,
    color: '#7BD08D',
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    lineHeight: 1,
  } satisfies CSSProperties,
  actionsRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  } satisfies CSSProperties,
  playButton: (active: boolean): CSSProperties => ({
    flex: 1,
    padding: '8px 0',
    borderRadius: 8,
    border: 'none',
    background: active ? '#37474F' : '#1B5E20',
    color: active ? '#90A4AE' : '#A5D6A7',
    fontSize: 16,
    cursor: 'pointer',
    fontWeight: 700,
  }),
  speedButton: {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid #37474F',
    background: '#263238',
    color: '#90A4AE',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    minWidth: 52,
  } satisfies CSSProperties,
} as const

export default function FlowControlPanel({
  purpose,
  onPurposeChange,
  hour,
  onHourChange,
  flowStrength,
  onStrengthChange,
  selectedQuarter,
  onQuarterChange,
  topN,
  scopeLabel,
  usingMockData,
  selectedTypes,
  selectedNode,
  stats,
  isPlaying,
  speed,
  onPlay,
  onPause,
  onToggleSpeed,
  selectedDistricts,
  onToggleDistrict,
  onToggleType,
}: FlowControlPanelProps) {
  const densityLabel = DENSITY_LABELS[flowStrength] ?? '보통'
  const selectedTypeEntries = getSelectedTypeEntries(selectedTypes)

  return (
    <aside style={S.panel}>
      <div style={S.header}>
        <div style={S.title}>흐름 분석 패널</div>
        <div style={S.subtitle}>
          현재 시간대와 목적, 필터 상태를 기준으로 상권 흐름을 요약합니다.
        </div>
        <div style={S.statusRow}>
          <span style={S.statusTag}>{scopeLabel}</span>
          <span style={S.statusTag}>{usingMockData ? '캐시 데이터' : 'API 연결'}</span>
          {selectedNode && <span style={S.statusTag}>선택: {selectedNode.name}</span>}
        </div>
      </div>

      <section style={S.section}>
        <div style={S.sectionTitle}>현재 보기 설정</div>

        <div>
          <div style={S.label}>이동 목적</div>
          <div style={S.purposeGrid}>
            {PURPOSE_OPTIONS.map((option) => {
              const active = purpose === option.value
              return (
                <button
                  key={option.value}
                  style={S.purposeBtn(active)}
                  onClick={() => onPurposeChange(active ? null : option.value)}
                >
                  <span>{option.label}</span>
                  <span style={S.purposePeak(active)}>{option.peak}</span>
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
          <div style={S.subLabel}>선택한 시간대에 맞춰 흐름 강도를 재계산합니다.</div>
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
          <div style={S.subLabel}>현재 상위 {topN}개 흐름을 중심으로 보여줍니다.</div>
        </div>

        <div>
          <div style={S.label}>분기</div>
          <div style={S.quarterRow}>
            <button
              type="button"
              style={S.quarterNavButton}
              onClick={() => onQuarterChange(shiftQuarter(selectedQuarter, -1))}
              aria-label="이전 분기"
            >
              <span>‹</span>
            </button>
            <input
              list="quarter-suggestions"
              value={selectedQuarter}
              onChange={(e) => onQuarterChange(e.target.value.toUpperCase())}
              style={S.quarterInput}
              aria-label="분기"
            />
            <datalist id="quarter-suggestions">
              {QUARTER_SUGGESTIONS.map(quarter => (
                <option key={quarter} value={quarter} />
              ))}
            </datalist>
            <button
              type="button"
              style={S.quarterNavButton}
              onClick={() => onQuarterChange(shiftQuarter(selectedQuarter, 1))}
              aria-label="다음 분기"
            >
              <span>›</span>
            </button>
          </div>
          <div style={S.subLabel}>선택 분기를 기준으로 상권·정책·흐름 데이터를 다시 불러옵니다.</div>
        </div>
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>핵심 지표</div>
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
        <div style={S.sectionTitle}>재생 제어</div>
        <div style={S.actionsRow}>
          <button
            style={S.playButton(isPlaying)}
            onClick={isPlaying ? onPause : onPlay}
            aria-label={isPlaying ? '일시정지' : '재생'}
          >
            {isPlaying ? '일시정지' : '재생'}
          </button>
          <button
            style={S.speedButton}
            onClick={onToggleSpeed}
            aria-label={`재생 속도 ${speed}배`}
          >
            {speed}x
          </button>
        </div>
        <div style={S.subLabel}>
          {isPlaying ? `${speed}배속으로 시간 축이 자동 재생 중입니다.` : '슬라이더로 시간대를 수동 조정할 수 있습니다.'}
        </div>
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>자치구 필터</div>
        <div style={S.districtGrid}>
          {DISTRICTS.map((district) => {
            const active = selectedDistricts.has(district)
            return (
              <button
                key={district}
                style={S.pillButton(active, '#42A5F5')}
                onClick={() => onToggleDistrict(district)}
              >
                <span>{district}</span>
              </button>
            )
          })}
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
        <div style={S.sectionTitle}>상권 유형 필터</div>
        <div style={S.typeList}>
          {(Object.entries(COMMERCE_COLORS) as [CommerceType, (typeof COMMERCE_COLORS)[CommerceType]][]).map(([type, token]) => {
            const active = selectedTypes.has(type)
            return (
              <button
                key={type}
                style={S.pillButton(active, token.fill)}
                onClick={() => onToggleType(type)}
              >
                <span aria-hidden="true">{token.symbol}</span>
                <span style={{ flex: 1 }}>{token.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      {selectedNode && (
        <section style={S.section}>
          <div style={S.sectionTitle}>선택 상권</div>
          <div style={S.detailCard}>
            <div style={S.detailName}>{selectedNode.name}</div>
            <div style={{ ...S.detailType, color: COMMERCE_COLORS[selectedNode.type].textColor }}>
              {selectedNode.type}
            </div>
            <div style={S.detailGrid}>
              <div style={S.detailMetric}>
                <div style={S.detailMetricLabel}>자치구</div>
                <div style={S.detailMetricValue}>{selectedNode.district || '-'}</div>
              </div>
              <div style={S.detailMetric}>
                <div style={S.detailMetricLabel}>GRI</div>
                <div style={S.detailMetricValue}>{selectedNode.griScore}</div>
              </div>
              <div style={S.detailMetric}>
                <div style={S.detailMetricLabel}>순유입</div>
                <div style={S.detailMetricValue}>
                  {selectedNode.netFlow >= 0 ? '+' : ''}
                  {selectedNode.netFlow}
                </div>
              </div>
              <div style={S.detailMetric}>
                <div style={S.detailMetricLabel}>중심성</div>
                <div style={S.detailMetricValue}>{(selectedNode.degreeCentrality * 100).toFixed(0)}%</div>
              </div>
            </div>
          </div>
        </section>
      )}
    </aside>
  )
}
