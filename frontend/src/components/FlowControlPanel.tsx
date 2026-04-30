import { useState, useCallback, useEffect, useRef, type CSSProperties } from 'react'
import type { FlowPurpose, FlowStats, PurposeVolumeMap } from '../hooks/useFlowData'
import type { CommerceNode } from '../types/commerce'
import { COMMERCE_COLORS, MAP_THEME } from '../styles/tokens'
import { formatQuarter } from '../utils/quarter'
import { deriveStartupSummary } from '../utils/startupAdvisor'
import { formatFixed2, formatSignedFixed2 } from '../utils/numberFormat'

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
const COLORS = MAP_THEME.dark
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

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
  onPlay: () => void
  onPause: () => void
  onToggleSpeed: () => void
  onToggleFlows: () => void
  selectedDistricts: Set<string>
  onToggleDistrict: (d: string) => void
  onSelectNode: (node: CommerceNode) => void
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

function getPriorityNodes(nodes: CommerceNode[]): CommerceNode[] {
  return nodes
    .filter((n) => deriveStartupSummary(n).fitLevel === 'recommended')
    .sort((a, b) => deriveStartupSummary(b).fitScore - deriveStartupSummary(a).fitScore)
    .slice(0, 5)
}

function downloadCsvDemo(nodes: CommerceNode[], quarter: string): void {
  const header = '상권명,자치구,창업적합도,상권성격,고객흐름,상권위험도,분기'
  const rows = nodes
    .filter((n) => deriveStartupSummary(n).fitLevel === 'recommended')
    .sort((a, b) => deriveStartupSummary(b).fitScore - deriveStartupSummary(a).fitScore)
    .map((n) => {
      const summary = deriveStartupSummary(n)
      return `${n.name},${n.district},${summary.fitScore},${summary.characterLabel},${summary.flowLabel},${formatFixed2(n.griScore)},${quarter}`
    })
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `startup_candidate_commerce_${quarter}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function downloadCsvApi(quarter: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/export/csv?quarter=${quarter}`)
  if (!res.ok) throw new Error(`CSV 다운로드 실패: ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `startup_candidate_commerce_${quarter}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
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
  priorityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  } satisfies CSSProperties,
  priorityItem: (active: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 8,
    border: active ? '1.5px solid #43A047' : `1px solid ${COLORS.panelBorder}`,
    background: active ? 'rgba(67,160,71,0.12)' : COLORS.panelSurface,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
  }),
  priorityBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#43A047',
    color: '#fff',
    borderRadius: 4,
    padding: '1px 5px',
    fontSize: 10,
    fontWeight: 700,
    flexShrink: 0,
  } satisfies CSSProperties,
  priorityName: {
    flex: 1,
    fontSize: 12,
    fontWeight: 600,
    color: COLORS.panelText,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } satisfies CSSProperties,
  priorityScore: {
    fontSize: 12,
    fontWeight: 700,
    color: '#A5D6A7',
    flexShrink: 0,
  } satisfies CSSProperties,
  emptyNote: {
    fontSize: 11,
    color: COLORS.mutedText,
    lineHeight: 1.5,
  } satisfies CSSProperties,
  csvButton: {
    width: '100%',
    padding: '8px 0',
    borderRadius: 8,
    border: `1px solid ${COLORS.panelBorder}`,
    background: COLORS.panelSurface,
    color: '#7BD08D',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
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
  nodes,
  selectedNode,
  stats,
  purposeTotals,
  isPlaying,
  speed,
  showFlows,
  onPlay,
  onPause,
  onToggleSpeed,
  onToggleFlows,
  selectedDistricts,
  onToggleDistrict,
  onSelectNode,
}: FlowControlPanelProps) {
  const densityLabel = DENSITY_LABELS[flowStrength] ?? '보통'
  const priorityNodes = getPriorityNodes(nodes)
  const totalPurposeVolume = Object.values(purposeTotals).reduce((sum, value) => sum + value, 0)
  const selectedPurposeVolume = purpose ? purposeTotals[purpose] ?? 0 : totalPurposeVolume

  // docs/hero_shot_scenario.md §1-3: CSV 다운로드 시 toast로 결과 피드백.
  const [csvToast, setCsvToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const showToast = useCallback((message: string, tone: 'success' | 'error') => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current)
    }
    setCsvToast({ message, tone })
    toastTimerRef.current = window.setTimeout(() => setCsvToast(null), 3000)
  }, [])

  useEffect(() => () => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  const handleCsvDownload = useCallback(() => {
    const recommendedCount = priorityNodes.length
    const successMsg = `추천 상권 ${recommendedCount}건 + 정책 R4~R7 한 줄 요약 다운로드`
    if (usingMockData) {
      try {
        downloadCsvDemo(nodes, selectedQuarter)
        showToast(successMsg, 'success')
      } catch {
        showToast('CSV 다운로드 실패 (캐시 모드)', 'error')
      }
      return
    }
    downloadCsvApi(selectedQuarter)
      .then(() => showToast(successMsg, 'success'))
      .catch((err: unknown) => {
        const detail = err instanceof Error ? err.message : '알 수 없는 오류'
        showToast(`CSV 다운로드 실패: ${detail}`, 'error')
      })
  }, [nodes, priorityNodes.length, selectedQuarter, showToast, usingMockData])

  return (
    <aside style={S.panel}>
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

      <section style={S.section}>
        <div style={S.sectionTitle}>창업 검토 추천 상권</div>
        {priorityNodes.length === 0 ? (
          <div style={S.emptyNote}>현재 조건에서 추천 상권이 없습니다.</div>
        ) : (
          <div style={S.priorityList}>
            {priorityNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                style={S.priorityItem(selectedNode?.id === node.id)}
                onClick={() => onSelectNode(node)}
              >
                <span style={S.priorityBadge}>추천</span>
                <span style={S.priorityName}>{node.name}</span>
                <span style={S.priorityScore}>{deriveStartupSummary(node).fitScore}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          style={S.csvButton}
          onClick={handleCsvDownload}
          data-testid="hero-csv-export"
        >
          추천 상권 CSV 다운로드
        </button>
        {csvToast && (
          <div
            role="status"
            aria-live="polite"
            data-testid="csv-toast"
            style={{
              marginTop: 6,
              padding: '8px 10px',
              borderRadius: 6,
              fontSize: 11,
              lineHeight: 1.45,
              border: `1px solid ${csvToast.tone === 'success' ? '#7BD08D55' : '#EF535055'}`,
              background: csvToast.tone === 'success' ? '#7BD08D11' : '#EF535011',
              color: csvToast.tone === 'success' ? '#7BD08D' : '#EF5350',
            }}
          >
            {csvToast.message}
          </div>
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
                >
                  {formatQuarter(quarter)}
                </button>
              )
            })}
          </div>
          <div style={S.subLabel}>분기를 바꾸면 지도, 추천 상권, 고객 흐름 정보가 함께 갱신됩니다.</div>
        </div>

        <div>
          <div style={S.label}>이동 목적</div>
          <div style={S.purposeGrid}>
            <button
              type="button"
              style={S.purposeBtn(purpose === null)}
              onClick={() => onPurposeChange(null)}
              aria-pressed={purpose === null}
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
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>고객 흐름 요약</div>
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
        <div style={S.switchRow}>
          <span style={S.switchLabel}>OD flow 표시</span>
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
        <div style={S.subLabel}>
          {isPlaying
            ? `${speed}배속으로 시간 축이 자동 재생 중입니다.`
            : '슬라이더로 시간대를 수동 조정할 수 있습니다.'}
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
