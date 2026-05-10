import { useMemo, useState, type CSSProperties } from 'react'
import type { FlowPurpose, FlowStats, PurposeVolumeMap } from '../hooks/useFlowData'
import type { CommerceNode } from '../types/commerce'
import { COMMERCE_COLORS, MAP_THEME } from '../styles/tokens'
import { formatQuarter } from '../utils/quarter'
import { deriveStartupSummary } from '../utils/startupAdvisor'
import { formatFixed2, formatSignedFixed2 } from '../utils/numberFormat'
import { deltaTone, formatDelta, type QuarterKpiDelta } from '../utils/quarterDelta'
import { SEOUL_DISTRICT_GROUPS, SEOUL_DISTRICT_NAMES } from '../utils/seoulDistricts'
import type { AdvisorResult } from '../hooks/useStartupAdvisor'

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

const DISTRICTS = SEOUL_DISTRICT_NAMES
const COLORS = MAP_THEME.dark

interface FlowControlPanelProps {
  purpose: FlowPurpose | null
  onPurposeChange: (p: FlowPurpose | null) => void
  hour: number
  onHourChange: (h: number) => void
  flowStrength: number
  onStrengthChange: (s: number) => void
  selectedQuarter: string
  quarters: string[]
  onQuarterChange: (q: string) => void
  topN: number
  scopeLabel: string
  usingMockData: boolean
  nodes: CommerceNode[]
  selectedNode: CommerceNode | null
  stats: FlowStats
  purposeTotals: PurposeVolumeMap
  isPlaying: boolean
  speed: 1 | 2 | 4
  showFlows: boolean
  showBarriers: boolean
  flowControlsEnabled?: boolean
  onPlay: () => void
  onPause: () => void
  onToggleSpeed: () => void
  onToggleFlows: () => void
  onToggleBarriers: () => void
  selectedDistricts: Set<string>
  onToggleDistrict: (d: string) => void
  onSelectAllDistricts: () => void
  onClearDistricts: () => void
  onSetDistricts: (districts: Set<string>) => void
  onSelectNode: (node: CommerceNode) => void
  compareMode: boolean
  compareQuarter: string | null
  kpiDelta: QuarterKpiDelta | null
  onToggleCompare: () => void
  compact?: boolean
  stacked?: boolean
  advisorIndustries: string[]
  advisorLoading: boolean
  advisorResult: AdvisorResult | null
  advisorError: string | null
  onAdvisorAnalyze: (industry: string) => void
  onAdvisorReset: () => void
  onSelectAdvisorCommerce: (commCd: string) => void
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

function getDeltaColor(value: number, betterWhen: 'higher' | 'lower' = 'higher'): string {
  const tone = deltaTone(value, betterWhen)
  if (tone === 'up') return '#A5D6A7'
  if (tone === 'down') return '#EF9A9A'
  return COLORS.mutedText
}

const S = {
  panel: (compact: boolean, stacked: boolean): CSSProperties => ({
    width: stacked ? '100%' : compact ? 292 : 320,
    minWidth: stacked ? 0 : compact ? 292 : 320,
    height: stacked ? '44vh' : '100%',
    background: COLORS.panelBg,
    borderLeft: `1px solid ${COLORS.panelBorder}`,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    padding: compact ? '14px 12px' : '18px 16px',
    gap: compact ? 14 : 18,
    boxSizing: 'border-box',
    color: COLORS.panelText,
    fontFamily: 'system-ui, sans-serif',
  }),
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
  purposeBtn: (active: boolean, disabled = false): CSSProperties => ({
    padding: '10px 8px',
    borderRadius: 10,
    border: active ? '1px solid rgba(123,208,141,0.45)' : `1px solid ${COLORS.panelBorder}`,
    background: active ? 'rgba(46,125,50,0.22)' : COLORS.panelSurface,
    color: active ? '#D7F5DC' : COLORS.secondaryText,
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled && !active ? 0.45 : 1,
    textAlign: 'left',
  }),
  purposeMain: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
  } satisfies CSSProperties,
  purposePeak: (active: boolean): CSSProperties => ({
    fontSize: 10,
    color: active ? '#A5D6A7' : COLORS.mutedText,
    marginTop: 4,
    display: 'block',
  }),
  purposeVolume: (active: boolean): CSSProperties => ({
    fontSize: 11,
    color: active ? '#D7F5DC' : COLORS.mutedText,
    fontWeight: 700,
    whiteSpace: 'nowrap',
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
  compareHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 9,
  } satisfies CSSProperties,
  deltaGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    marginTop: 10,
  } satisfies CSSProperties,
  deltaCard: {
    background: COLORS.panelSurface,
    borderRadius: 8,
    border: `1px solid ${COLORS.panelBorder}`,
    padding: '9px 10px',
  } satisfies CSSProperties,
  deltaValue: {
    fontSize: 13,
    fontWeight: 800,
    marginTop: 3,
  } satisfies CSSProperties,
  deltaMeta: {
    fontSize: 10,
    color: COLORS.mutedText,
    marginTop: 2,
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
  filterHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  } satisfies CSSProperties,
  filterSummary: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  } satisfies CSSProperties,
  filterActions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  } satisfies CSSProperties,
  compactButton: (active = false): CSSProperties => ({
    padding: '7px 9px',
    borderRadius: 8,
    border: active ? '1.5px solid #42A5F5' : `1px solid ${COLORS.panelBorder}`,
    background: active ? 'rgba(66,165,245,0.18)' : COLORS.panelSurface,
    color: active ? '#BBDEFB' : COLORS.secondaryText,
    fontSize: 12,
    fontWeight: active ? 750 : 600,
    cursor: 'pointer',
    textAlign: 'center',
  }),
  expandButton: {
    padding: '6px 9px',
    borderRadius: 999,
    border: `1px solid ${COLORS.panelBorder}`,
    background: COLORS.panelSurface,
    color: COLORS.secondaryText,
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
  } satisfies CSSProperties,
  presetGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  } satisfies CSSProperties,
  searchInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    borderRadius: 8,
    border: `1px solid ${COLORS.panelBorder}`,
    background: COLORS.panelSurface,
    color: COLORS.panelText,
    fontSize: 12,
    outline: 'none',
  } satisfies CSSProperties,
  districtGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  } satisfies CSSProperties,
  quarterGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  } satisfies CSSProperties,
  quarterButton: (active: boolean): CSSProperties => ({
    padding: '8px 9px',
    borderRadius: 8,
    border: active ? '1.5px solid #7BD08D' : `1px solid ${COLORS.panelBorder}`,
    background: active ? 'rgba(123,208,141,0.14)' : COLORS.panelSurface,
    color: active ? '#D7F5DC' : COLORS.secondaryText,
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    textAlign: 'center',
  }),
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
  switchRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '8px 0 2px',
  } satisfies CSSProperties,
  switchLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: COLORS.secondaryText,
  } satisfies CSSProperties,
  switchTrack: (active: boolean): CSSProperties => ({
    position: 'relative',
    width: 36,
    height: 20,
    border: 'none',
    borderRadius: 999,
    background: active ? '#43A047' : '#B8BEC5',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.16s ease',
    flexShrink: 0,
  }),
  switchThumb: (active: boolean): CSSProperties => ({
    position: 'absolute',
    top: 2,
    left: active ? 18 : 2,
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: '#FFFFFF',
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
    transition: 'left 0.16s ease',
  }),
  emptyNote: {
    fontSize: 11,
    color: COLORS.mutedText,
    lineHeight: 1.5,
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
  quarters,
  onQuarterChange,
  topN,
  scopeLabel,
  usingMockData,
  selectedNode,
  stats,
  purposeTotals,
  isPlaying,
  speed,
  showFlows,
  showBarriers,
  flowControlsEnabled = true,
  onPlay,
  onPause,
  onToggleSpeed,
  onToggleFlows,
  onToggleBarriers,
  selectedDistricts,
  onToggleDistrict,
  onSelectAllDistricts,
  onClearDistricts,
  onSetDistricts,
  compareMode,
  compareQuarter,
  kpiDelta,
  onToggleCompare,
  compact = false,
  stacked = false,
  advisorIndustries,
  advisorLoading,
  advisorResult,
  advisorError,
  onAdvisorAnalyze,
  onAdvisorReset,
  onSelectAdvisorCommerce,
}: FlowControlPanelProps) {
  const [selectedAdvisorIndustry, setSelectedAdvisorIndustry] = useState<string>('')
  const [districtFilterOpen, setDistrictFilterOpen] = useState(false)
  const [districtSearch, setDistrictSearch] = useState('')
  const densityLabel = DENSITY_LABELS[flowStrength] ?? '보통'
  const totalPurposeVolume = Object.values(purposeTotals).reduce((sum, value) => sum + value, 0)
  const selectedPurposeVolume = purpose ? purposeTotals[purpose] ?? 0 : totalPurposeVolume
  const selectedDistrictCount = selectedDistricts.size
  const allDistrictsSelected = selectedDistrictCount >= DISTRICTS.length
  const districtSummary = allDistrictsSelected
    ? '서울 전체'
    : selectedDistrictCount === 0
      ? '선택 없음'
      : `${selectedDistrictCount}개 자치구`
  const filteredDistricts = useMemo(() => {
    const query = districtSearch.trim()
    if (!query) return DISTRICTS
    return DISTRICTS.filter((district) => district.includes(query))
  }, [districtSearch])

  function selectDistrictGroup(districts: readonly string[]) {
    onSetDistricts(new Set(districts))
  }

  return (
    <aside style={S.panel(compact, stacked)}>
      <div style={S.header}>
        <div style={S.title}>창업 상권 탐색</div>
        <div style={S.subtitle}>
          예비창업자가 먼저 볼 만한 상권과 고객 유입 흐름, 창업 리스크를 함께 확인합니다.
        </div>
        <div style={S.statusRow}>
          <span style={S.statusTag}>{scopeLabel}</span>
          <span style={S.statusTag}>{formatQuarter(selectedQuarter)}</span>
          <span style={S.statusTag}>{usingMockData ? '캐시 데이터' : 'API 연결'}</span>
          {selectedNode && <span style={S.statusTag}>선택: {selectedNode.name}</span>}
        </div>
      </div>

      {/* AI 창업 입지 분석 섹션 */}
      <section style={{ ...S.section, background: '#141c28', borderRadius: 10, padding: '12px', border: '1px solid #f9731633' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ ...S.sectionTitle, color: '#f97316' }}>🤖 AI 창업 입지 분석</div>
          {advisorResult && (
            <button
              onClick={onAdvisorReset}
              style={{ background: 'none', border: 'none', color: COLORS.mutedText, cursor: 'pointer', fontSize: 11 }}
            >
              초기화
            </button>
          )}
        </div>

        {advisorIndustries.length === 0 ? (
          <div style={{ ...S.subLabel, color: COLORS.mutedText }}>업종 목록 로드 중... (백엔드 연결 확인)</div>
        ) : (
          <>
            <select
              value={selectedAdvisorIndustry || advisorIndustries[0]}
              onChange={(e) => setSelectedAdvisorIndustry(e.target.value)}
              disabled={advisorLoading}
              style={{
                width: '100%', background: '#0d1117', border: `1px solid ${COLORS.panelBorder}`,
                borderRadius: 6, padding: '7px 10px', fontSize: 12, color: COLORS.panelText,
                cursor: advisorLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {advisorIndustries.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
            </select>
            <button
              onClick={() => onAdvisorAnalyze(selectedAdvisorIndustry || advisorIndustries[0] || '')}
              disabled={advisorLoading}
              style={{
                width: '100%', background: advisorLoading ? '#7c3c1a' : '#f97316',
                border: 'none', borderRadius: 6, padding: '8px',
                color: 'white', fontSize: 12, fontWeight: 700,
                cursor: advisorLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {advisorLoading ? '분석 중...' : '분석하기'}
            </button>
          </>
        )}

        {advisorError && (
          <div style={{ fontSize: 11, color: '#f87171' }}>{advisorError}</div>
        )}

        {advisorResult && (
          <>
            {advisorResult.summary ? (
              <div style={{ background: '#0d1117', borderRadius: 6, padding: 8, fontSize: 10, color: '#cbd5e1', lineHeight: 1.6 }}>
                {advisorResult.summary}
              </div>
            ) : (
              <div style={{ fontSize: 10, color: COLORS.mutedText }}>AI 해설 없음 — 통계 기반 결과만 표시됩니다.</div>
            )}
            {advisorResult.caution && (
              <div style={{ background: '#431407', border: '1px solid #9a3412', borderRadius: 6, padding: '6px 8px', fontSize: 10, color: '#fdba74' }}>
                ⚠️ {advisorResult.caution}
              </div>
            )}
            <div style={{ ...S.sectionTitle, marginTop: 4 }}>상권 랭킹</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {advisorResult.commerces.slice(0, 6).map((c, i) => {
                const tierColor = c.tier === '추천' ? '#4ade80' : c.tier === '주의' ? '#fbbf24' : '#f87171'
                const tierBg = c.tier === '추천' ? '#14532d22' : c.tier === '주의' ? '#78350f22' : '#7f1d1d22'
                const tierBorder = c.tier === '추천' ? '#166534' : c.tier === '주의' ? '#92400e' : '#991b1b'
                const badgeBg = c.tier === '추천' ? '#16a34a' : c.tier === '주의' ? '#d97706' : '#dc2626'
                return (
                  <div
                    key={c.comm_cd}
                    onClick={() => onSelectAdvisorCommerce(c.comm_cd)}
                    style={{
                      background: tierBg, border: `1px solid ${tierBorder}`, borderRadius: 4,
                      padding: '5px 8px', display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: tierColor, fontWeight: 700 }}>
                        {i + 1}. {c.comm_nm}
                      </div>
                      <div style={{ fontSize: 9, color: COLORS.mutedText }}>
                        GRI {c.gri_score ?? 'N/A'} · 유동 {c.flow_volume?.toLocaleString() ?? 'N/A'}
                      </div>
                    </div>
                    <span style={{ fontSize: 9, background: badgeBg, color: 'white', padding: '2px 5px', borderRadius: 3 }}>
                      {c.tier}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>현재 보기 설정</div>

        <div>
          <div style={S.label}>분기</div>
          <div style={S.quarterGrid}>
            {quarters.map((quarter) => {
              const active = quarter === selectedQuarter
              return (
                <button
                  key={quarter}
                  type="button"
                  style={S.quarterButton(active)}
                  onClick={() => onQuarterChange(quarter)}
                  aria-pressed={active}
                  aria-label={`${formatQuarter(quarter)} 데이터 보기`}
                >
                  {formatQuarter(quarter)}
                </button>
              )
            })}
          </div>
          <div style={S.subLabel}>분기를 바꾸면 지도, 추천 상권, 단절 위험 정보가 함께 갱신됩니다.</div>
        </div>

        <div>
          <div style={S.label}>이동 목적</div>
          <div style={S.purposeGrid}>
            <button
              type="button"
              style={S.purposeBtn(purpose === null)}
              onClick={() => onPurposeChange(null)}
              aria-pressed={purpose === null}
              aria-label={`전체 이동 목적 선택, 총 ${formatVolume(totalPurposeVolume)}`}
            >
              <span style={S.purposeMain}>
                <span>전체</span>
                <span style={S.purposeVolume(purpose === null)}>{formatVolume(totalPurposeVolume)}</span>
              </span>
              <span style={S.purposePeak(purpose === null)}>분기 합산</span>
            </button>
            {PURPOSE_OPTIONS.map((option) => {
              const active = purpose === option.value
              const volume = purposeTotals[option.value] ?? 0
              const disabled = volume <= 0
              return (
                <button
                  key={option.value}
                  type="button"
                  style={S.purposeBtn(active, disabled)}
                  disabled={disabled}
                  onClick={() => {
                    if (!disabled) onPurposeChange(active ? null : option.value)
                  }}
                  aria-pressed={active}
                  aria-label={`${option.label} 이동 목적 선택, ${formatVolume(volume)}`}
                >
                  <span style={S.purposeMain}>
                    <span>{option.label}</span>
                    <span style={S.purposeVolume(active)}>{formatVolume(volume)}</span>
                  </span>
                  <span style={S.purposePeak(active)}>{option.peak}</span>
                </button>
              )
            })}
          </div>
          {selectedPurposeVolume <= 0 && (
            <div style={S.emptyNote}>
              선택한 이동 목적의 분기 합산 데이터가 없습니다. 다른 목적을 선택하거나 전체로 확인하세요.
            </div>
          )}
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
              aria-label="시간대 선택"
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
              aria-label="가시화 밀도 선택"
            />
            <span style={S.sliderValue}>{densityLabel}</span>
          </div>
          <div style={S.subLabel}>현재 상위 {topN}개 흐름을 중심으로 보여줍니다.</div>
        </div>
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>상권 위험 요약</div>
        <div style={S.compareHeader}>
          <div>
            <div style={S.label}>분기 비교</div>
            <div style={S.subLabel}>
              {compareQuarter
                ? `${formatQuarter(compareQuarter)} 대비 KPI 변화`
                : '이전 분기가 없어 비교할 수 없습니다.'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={compareMode}
            aria-label="이전 분기 KPI 비교 표시 전환"
            onClick={onToggleCompare}
            disabled={!compareQuarter}
            style={{
              ...S.switchTrack(compareMode),
              opacity: compareQuarter ? 1 : 0.45,
              cursor: compareQuarter ? 'pointer' : 'not-allowed',
            }}
          >
            <span style={S.switchThumb(compareMode)} />
          </button>
        </div>
        <div style={S.statsGrid}>
          <div style={S.statCard}>
            <div style={S.statLabel}>총 유동량</div>
            <div style={S.statValue}>{formatVolume(stats.totalVolume)}</div>
          </div>
          <div style={S.statCard}>
            <div style={S.statLabel}>활성 동선</div>
            <div style={S.statValue}>{stats.activeCount}</div>
          </div>
          <div style={S.statCard}>
            <div style={S.statLabel}>고객 유입 우세</div>
            <div style={{ ...S.statValue, fontSize: 14, color: '#A5D6A7' }}>
              {formatLocation(stats.topInflow)}
            </div>
          </div>
          <div style={S.statCard}>
            <div style={S.statLabel}>고객 유출 우세</div>
            <div style={{ ...S.statValue, fontSize: 14, color: '#FFAB91' }}>
              {formatLocation(stats.topOutflow)}
            </div>
          </div>
        </div>
        {compareMode && kpiDelta && (
          <div style={S.deltaGrid}>
            <div style={S.deltaCard}>
              <div style={S.statLabel}>총 유동량</div>
              <div style={{ ...S.deltaValue, color: getDeltaColor(kpiDelta.delta.totalVolume) }}>
                {formatDelta(kpiDelta.delta.totalVolume, 0)}
              </div>
              <div style={S.deltaMeta}>현재 {formatVolume(kpiDelta.current.totalVolume)}</div>
            </div>
            <div style={S.deltaCard}>
              <div style={S.statLabel}>평균 GRI</div>
              <div style={{ ...S.deltaValue, color: getDeltaColor(kpiDelta.delta.avgGri, 'lower') }}>
                {formatDelta(kpiDelta.delta.avgGri, 1)}
              </div>
              <div style={S.deltaMeta}>현재 {kpiDelta.current.avgGri.toFixed(1)}</div>
            </div>
            <div style={S.deltaCard}>
              <div style={S.statLabel}>상권 수</div>
              <div style={{ ...S.deltaValue, color: getDeltaColor(kpiDelta.delta.commerceCount) }}>
                {formatDelta(kpiDelta.delta.commerceCount, 0)}
              </div>
              <div style={S.deltaMeta}>현재 {kpiDelta.current.commerceCount.toLocaleString()}개</div>
            </div>
            <div style={S.deltaCard}>
              <div style={S.statLabel}>추천 상권</div>
              <div style={{ ...S.deltaValue, color: getDeltaColor(kpiDelta.delta.recommendedCount) }}>
                {formatDelta(kpiDelta.delta.recommendedCount, 0)}
              </div>
              <div style={S.deltaMeta}>현재 {kpiDelta.current.recommendedCount.toLocaleString()}개</div>
            </div>
          </div>
        )}
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
        {flowControlsEnabled && (
          <div style={S.switchRow}>
            <span style={S.switchLabel}>흐름 궤적 표시</span>
            <button
              type="button"
              role="switch"
              aria-checked={showFlows}
              onClick={onToggleFlows}
              aria-label="OD flow display toggle"
              style={S.switchTrack(showFlows)}
            >
              <span style={S.switchThumb(showFlows)} />
            </button>
          </div>
        )}
        <div style={S.switchRow}>
          <span style={S.switchLabel}>단절 위험 표시</span>
          <button
            type="button"
            role="switch"
            aria-checked={showBarriers}
            onClick={onToggleBarriers}
            aria-label="단절 위험 레이어 표시 전환"
            style={S.switchTrack(showBarriers)}
          >
            <span style={S.switchThumb(showBarriers)} />
          </button>
        </div>
        <div style={S.subLabel}>
          {isPlaying
            ? `${speed}배속으로 시간 축이 자동 재생 중입니다.`
            : '슬라이더로 시간대를 수동 조정할 수 있습니다.'}
        </div>
      </section>

      <section style={S.section}>
        <div style={S.filterHeader}>
          <div style={S.filterSummary}>
            <div style={S.sectionTitle}>자치구 필터</div>
            <div style={S.subLabel}>{districtSummary}</div>
          </div>
          <button
            type="button"
            style={S.expandButton}
            onClick={() => setDistrictFilterOpen((prev) => !prev)}
            aria-expanded={districtFilterOpen}
            aria-label="자치구 상세 필터 열기"
          >
            {districtFilterOpen ? '접기' : '상세'}
          </button>
        </div>

        <div style={S.filterActions}>
          <button
            type="button"
            style={S.compactButton(allDistrictsSelected)}
            onClick={onSelectAllDistricts}
            aria-pressed={allDistrictsSelected}
          >
            서울 전체
          </button>
          <button
            type="button"
            style={S.compactButton(selectedDistrictCount === 0)}
            onClick={onClearDistricts}
            aria-pressed={selectedDistrictCount === 0}
          >
            전체 해제
          </button>
        </div>

        {districtFilterOpen && (
          <>
            <div style={S.presetGrid}>
              {SEOUL_DISTRICT_GROUPS.map((group) => {
                const active = group.districts.every((district) => selectedDistricts.has(district))
                return (
                  <button
                    key={group.name}
                    type="button"
                    style={S.compactButton(active)}
                    onClick={() => selectDistrictGroup(group.districts)}
                    aria-pressed={active}
                  >
                    {group.name}
                  </button>
                )
              })}
            </div>
            <input
              type="search"
              value={districtSearch}
              onChange={(event) => setDistrictSearch(event.target.value)}
              placeholder="자치구 검색"
              style={S.searchInput}
              aria-label="자치구 검색"
            />
            <div style={S.districtGrid}>
              {filteredDistricts.map((district) => {
                const active = selectedDistricts.has(district)
                return (
                  <button
                    key={district}
                    type="button"
                    style={S.pillButton(active, '#42A5F5')}
                    onClick={() => onToggleDistrict(district)}
                    aria-pressed={active}
                    aria-label={`${district} 자치구 필터 ${active ? '해제' : '선택'}`}
                  >
                    <span>{district}</span>
                  </button>
                )
              })}
            </div>
            {filteredDistricts.length === 0 && (
              <div style={S.emptyNote}>검색된 자치구가 없습니다.</div>
            )}
          </>
        )}
      </section>

      {selectedNode && (
        <section style={S.section}>
          <div style={S.sectionTitle}>선택 상권</div>
          <div style={S.detailCard}>
            <div style={S.detailName}>{selectedNode.name}</div>
            <div style={{ ...S.detailType, color: COMMERCE_COLORS[selectedNode.type].textColor }}>
              {deriveStartupSummary(selectedNode).fitLabel} · {deriveStartupSummary(selectedNode).characterLabel}
            </div>
            <div style={S.detailGrid}>
              <div style={S.detailMetric}>
                <div style={S.detailMetricLabel}>자치구</div>
                <div style={S.detailMetricValue}>{selectedNode.district || '-'}</div>
              </div>
              <div style={S.detailMetric}>
                <div style={S.detailMetricLabel}>상권 위험도</div>
                <div style={S.detailMetricValue}>{formatFixed2(selectedNode.griScore)}</div>
              </div>
              <div style={S.detailMetric}>
                <div style={S.detailMetricLabel}>순유입</div>
                <div style={S.detailMetricValue}>
                  {formatSignedFixed2(selectedNode.netFlow)}
                </div>
              </div>
              <div style={S.detailMetric}>
                <div style={S.detailMetricLabel}>폐업률</div>
                <div style={S.detailMetricValue}>
                  {selectedNode.closeRate != null ? `${selectedNode.closeRate.toFixed(1)}%` : '-'}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </aside>
  )
}
