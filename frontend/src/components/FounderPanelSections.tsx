import { useMemo, useState, type CSSProperties } from 'react'
import type { FlowPurpose, FlowStats, PurposeVolumeMap } from '../hooks/useFlowData'
import type { AdvisorResult } from '../hooks/useStartupAdvisor'
import type { CommerceNode } from '../types/commerce'
import { COMMERCE_COLORS, MAP_THEME } from '../styles/tokens'
import { SEOUL_DISTRICT_GROUPS, SEOUL_DISTRICT_NAMES } from '../utils/seoulDistricts'
import { formatQuarter } from '../utils/quarter'
import { deltaTone, formatDelta, type QuarterKpiDelta } from '../utils/quarterDelta'
import { deriveStartupSummary } from '../utils/startupAdvisor'
import { formatFixed2, formatSignedFixed2 } from '../utils/numberFormat'
import { buildFounderRecommendations } from '../utils/founderUx'

const COLORS = MAP_THEME.dark
const DISTRICTS = SEOUL_DISTRICT_NAMES

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

function formatVolume(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}만`
  return value.toLocaleString()
}

function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        style={{
          width: 13, height: 13, borderRadius: '50%',
          background: 'rgba(166,180,194,0.15)', border: '1px solid rgba(166,180,194,0.35)',
          color: '#A6B4C2', fontSize: 8, fontWeight: 800, lineHeight: 1,
          cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, padding: 0,
        }}
        aria-label={text}
      >
        i
      </button>
      {visible && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 6, background: '#1A2840', border: '1px solid #2E4057',
          borderRadius: 6, padding: '7px 10px', fontSize: 11, color: '#C8D6E5',
          whiteSpace: 'normal', width: 200, zIndex: 999, lineHeight: 1.5,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {text}
        </div>
      )}
    </div>
  )
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
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 9,
  } satisfies CSSProperties,
  highlightedSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 9,
    background: '#141c28',
    borderRadius: 10,
    padding: 12,
    border: '1px solid #f9731633',
  } satisfies CSSProperties,
  title: {
    fontSize: 11,
    letterSpacing: '0.05em',
    fontWeight: 800,
    color: COLORS.mutedText,
    textTransform: 'uppercase',
  } satisfies CSSProperties,
  orangeTitle: {
    fontSize: 11,
    letterSpacing: '0.05em',
    fontWeight: 800,
    color: '#f97316',
    textTransform: 'uppercase',
  } satisfies CSSProperties,
  label: { fontSize: 12, color: COLORS.secondaryText, fontWeight: 650 } satisfies CSSProperties,
  subLabel: { fontSize: 11, color: COLORS.mutedText, lineHeight: 1.45 } satisfies CSSProperties,
  select: {
    width: '100%',
    background: '#0d1117',
    border: `1px solid ${COLORS.panelBorder}`,
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 12,
    color: COLORS.panelText,
  } satisfies CSSProperties,
  primaryButton: (disabled = false): CSSProperties => ({
    width: '100%',
    background: disabled ? '#7c3c1a' : '#f97316',
    border: 'none',
    borderRadius: 8,
    padding: '9px 10px',
    color: 'white',
    fontSize: 12,
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }),
  ghostButton: {
    background: 'none',
    border: 'none',
    color: COLORS.mutedText,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 700,
  } satisfies CSSProperties,
  card: {
    background: COLORS.panelSurface,
    borderRadius: 10,
    border: `1px solid ${COLORS.panelBorder}`,
    padding: '11px 12px',
  } satisfies CSSProperties,
  compactGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  } satisfies CSSProperties,
  filterHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
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
  searchInput: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    border: `1px solid ${COLORS.panelBorder}`,
    background: COLORS.panelSurface,
    color: COLORS.panelText,
    fontSize: 12,
    outline: 'none',
  } satisfies CSSProperties,
  districtButton: (active: boolean): CSSProperties => ({
    padding: '7px 10px',
    borderRadius: 8,
    border: active ? '1.5px solid #42A5F5' : `1px solid ${COLORS.panelBorder}`,
    background: active ? 'rgba(66,165,245,0.18)' : COLORS.panelSurface,
    color: active ? '#BBDEFB' : COLORS.secondaryText,
    fontSize: 12,
    fontWeight: active ? 750 : 600,
    cursor: 'pointer',
    textAlign: 'left',
  }),
  empty: {
    border: `1px dashed ${COLORS.panelBorder}`,
    borderRadius: 10,
    padding: 12,
    fontSize: 12,
    color: COLORS.secondaryText,
    lineHeight: 1.55,
    background: 'rgba(21,29,38,0.58)',
  } satisfies CSSProperties,
  statGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
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
    fontWeight: 800,
    color: COLORS.panelText,
  } satisfies CSSProperties,
  switchRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '8px 0 2px',
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
}

interface FounderIndustrySectionProps {
  advisorIndustries: string[]
  selectedIndustry: string
  advisorLoading: boolean
  advisorResult: AdvisorResult | null
  advisorError: string | null
  onIndustryChange: (industry: string) => void
  onAdvisorAnalyze: (industry: string) => void
  onAdvisorReset: () => void
}

export function FounderIndustrySection({
  advisorIndustries,
  selectedIndustry,
  advisorLoading,
  advisorResult,
  advisorError,
  onIndustryChange,
  onAdvisorAnalyze,
  onAdvisorReset,
}: FounderIndustrySectionProps) {
  const currentIndustry = selectedIndustry || advisorIndustries[0] || ''

  return (
    <section style={S.highlightedSection} aria-label="업종 선택과 분석">
      <div style={S.filterHeader}>
        <div>
          <div style={S.orangeTitle}>1. 업종 선택</div>
          <div style={S.subLabel}>열고 싶은 업종을 고르면 추천/주의 상권을 먼저 보여줍니다.</div>
        </div>
        {advisorResult && (
          <button type="button" onClick={onAdvisorReset} style={S.ghostButton}>
            초기화
          </button>
        )}
      </div>

      {advisorIndustries.length === 0 ? (
        <div style={S.empty}>업종 목록을 불러오는 중입니다. 연결이 실패하면 잠시 후 다시 시도하세요.</div>
      ) : (
        <>
          <select
            value={currentIndustry}
            onChange={(event) => onIndustryChange(event.target.value)}
            disabled={advisorLoading}
            style={S.select}
            aria-label="창업 업종 선택"
          >
            {advisorIndustries.map((industry) => (
              <option key={industry} value={industry}>{industry}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onAdvisorAnalyze(currentIndustry)}
            disabled={advisorLoading || !currentIndustry}
            style={S.primaryButton(advisorLoading || !currentIndustry)}
          >
            {advisorLoading ? '분석 중...' : '추천 상권 보기'}
          </button>
        </>
      )}

      {advisorError && <div style={{ ...S.empty, borderColor: '#EF9A9A', color: '#EF9A9A' }}>{advisorError}</div>}
      {advisorResult?.summary && (
        <div style={{ ...S.card, fontSize: 11, color: '#cbd5e1', lineHeight: 1.55 }}>
          {advisorResult.summary}
        </div>
      )}
      {advisorResult?.caution && (
        <div style={{ ...S.card, borderColor: '#9a3412', color: '#fdba74', fontSize: 11, lineHeight: 1.5 }}>
          주의: {advisorResult.caution}
        </div>
      )}
    </section>
  )
}

interface DistrictFilterSectionProps {
  selectedDistricts: Set<string>
  open: boolean
  onOpenChange: (open: boolean) => void
  onToggleDistrict: (district: string) => void
  onSelectAllDistricts: () => void
  onClearDistricts: () => void
  onSetDistricts: (districts: Set<string>) => void
}

export function DistrictFilterSection({
  selectedDistricts,
  open,
  onOpenChange,
  onToggleDistrict,
  onSelectAllDistricts,
  onClearDistricts,
  onSetDistricts,
}: DistrictFilterSectionProps) {
  const [districtSearch, setDistrictSearch] = useState('')
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

  return (
    <section style={S.section} aria-label="관심 지역 선택">
      <div style={S.filterHeader}>
        <div>
          <div style={S.title}>2. 관심 지역 선택</div>
          <div style={S.subLabel}>{districtSummary} · 지역을 좁히면 추천 결과와 지도도 함께 바뀝니다.</div>
        </div>
        <button
          type="button"
          style={{ ...S.expandButton, border: '1.5px solid #42A5F5', background: 'transparent', color: '#42A5F5' }}
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-label="관심 지역 상세 조건 수정"
        >
          {open ? '접기' : '조건 수정'}
        </button>
      </div>

      <div style={S.compactGrid}>
        <button type="button" style={S.compactButton(allDistrictsSelected)} onClick={onSelectAllDistricts}>
          서울 전체
        </button>
        <button type="button" style={S.compactButton(selectedDistrictCount === 0)} onClick={onClearDistricts}>
          전체 해제
        </button>
      </div>

      {open && (
        <>
          <div style={S.compactGrid}>
            {SEOUL_DISTRICT_GROUPS.map((group) => {
              const active = group.districts.every((district) => selectedDistricts.has(district))
              return (
                <button
                  key={group.name}
                  type="button"
                  style={S.compactButton(active)}
                  onClick={() => onSetDistricts(new Set(group.districts))}
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
          <div style={S.compactGrid}>
            {filteredDistricts.map((district) => {
              const active = selectedDistricts.has(district)
              return (
                <button
                  key={district}
                  type="button"
                  style={S.districtButton(active)}
                  onClick={() => onToggleDistrict(district)}
                  aria-pressed={active}
                  aria-label={`${district} 자치구 ${active ? '해제' : '선택'}`}
                >
                  {district}
                </button>
              )
            })}
          </div>
          {filteredDistricts.length === 0 && <div style={S.empty}>검색된 자치구가 없습니다.</div>}
        </>
      )}
    </section>
  )
}

interface RecommendationResultsSectionProps {
  advisorResult: AdvisorResult | null
  selectedIndustry: string
  selectedDistricts: Set<string>
  onSelectAdvisorCommerce: (commCd: string) => void
}

export function RecommendationResultsSection({
  advisorResult,
  selectedIndustry,
  selectedDistricts,
  onSelectAdvisorCommerce,
}: RecommendationResultsSectionProps) {
  const recommendations = buildFounderRecommendations(advisorResult, selectedDistricts)
  const emptyMessage = advisorResult
    ? '? íƒ???€ì—­???žëŠ” ì¶”ì²œ ?ê¶Œ???†ìŠµ?ˆë‹¤. ?œìš¸ ?„ì²´ë¡œ ë„“ížˆê±°ë‚˜ ?¤ë¥¸ ?…ì¢…?¼ë¡œ ?¤ì‹œ ë¶„ì„?˜ì„¸??'
    : '?…ì¢…ê³?ì§€??„ ? íƒ?˜ë©´ ì¶”ì²œ ?ê¶Œ??ë³????ˆìŠµ?ˆë‹¤. ë¨¼ì? ?…ì¢…??ê³ ë¥´ê³?ì¶”ì²œ ?ê¶Œ ë³´ê¸°ë¥??ŒëŸ¬ì£¼ì„¸??'

  return (
    <section style={S.section} aria-label="추천 상권 결과">
      <div>
        <div style={S.title}>3. 추천/주의 상권 확인</div>
        <div style={S.subLabel}>카드를 누르면 지도와 상세 패널에서 근거를 이어서 확인할 수 있습니다.</div>
      </div>

      {recommendations.length === 0 ? (
        <div style={S.empty} aria-label={emptyMessage}>
          업종과 지역을 선택하면 추천 상권을 볼 수 있습니다. 먼저 업종을 고르고 추천 상권 보기를 눌러주세요.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recommendations.map((item, index) => {
            const tierColor = item.tier === '추천' ? '#4ade80' : item.tier === '주의' ? '#fbbf24' : '#f87171'
            const tierBg = item.tier === '추천' ? '#14532d22' : item.tier === '주의' ? '#78350f22' : '#7f1d1d22'
            const tierBorder = item.tier === '추천' ? '#166534' : item.tier === '주의' ? '#92400e' : '#991b1b'
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectAdvisorCommerce(item.id)}
                style={{
                  ...S.card,
                  background: tierBg,
                  borderColor: tierBorder,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                aria-label={`${item.name} 상세 근거 확인`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 12, color: tierColor, fontWeight: 800 }}>
                      {index + 1}. {item.name}
                    </div>
                    <div style={{ marginTop: 2, fontSize: 10, color: COLORS.mutedText }}>
                      {item.district || '자치구 미분류'} · {selectedIndustry || item.suitableIndustries[0]} · 점수 {item.score.toFixed(1)}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, background: tierColor, color: '#0E141B', padding: '2px 6px', borderRadius: 999, fontWeight: 800 }}>
                    {item.tier}
                  </span>
                </div>
                <div style={{ marginTop: 8, display: 'grid', gap: 5 }}>
                  <div style={S.subLabel}>기회: {item.opportunityReasons[0] ?? '업종 적합성과 고객 흐름을 확인할 수 있습니다.'}</div>
                  <div style={S.subLabel}>주의: {item.riskReasons[0]}</div>
                  <div style={{ ...S.subLabel, color: '#D7F5DC' }}>다음 행동: {item.nextActions[0]}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

interface AdvancedOptionsSectionProps {
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
  purposeTotals: PurposeVolumeMap
  stats: FlowStats
  isPlaying: boolean
  speed: 1 | 2 | 4
  showFlows: boolean
  showBarriers: boolean
  flowControlsEnabled: boolean
  compareQuarter: string | null
  kpiDelta: QuarterKpiDelta | null
  onPlay: () => void
  onPause: () => void
  onToggleSpeed: () => void
  onToggleFlows: () => void
  onToggleBarriers: () => void
}

export function AdvancedOptionsSection({
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
  purposeTotals,
  stats,
  isPlaying,
  speed,
  showFlows,
  showBarriers,
  flowControlsEnabled,
  kpiDelta,
  onPlay,
  onPause,
  onToggleSpeed,
  onToggleFlows,
  onToggleBarriers,
}: AdvancedOptionsSectionProps) {
  const [open, setOpen] = useState(false)
  const densityLabel = DENSITY_LABELS[flowStrength] ?? '보통'
  const totalPurposeVolume = Object.values(purposeTotals).reduce((sum, value) => sum + value, 0)
  const selectedPurposeVolume = purpose ? purposeTotals[purpose] ?? 0 : totalPurposeVolume

  return (
    <section style={S.section} aria-label="고급 데이터 조건">
      <div style={S.filterHeader}>
        <div>
          <div style={S.title}>고급 옵션</div>
          <div style={S.subLabel}>분기, 시간대, 흐름 표시, 단절 위험은 필요할 때만 조정합니다.</div>
        </div>
        <button type="button" style={S.expandButton} onClick={() => setOpen((prev) => !prev)} aria-expanded={open}>
          {open ? '접기' : '더보기'}
        </button>
      </div>

      {!open && (
        <div style={S.statGrid}>
          <div style={S.card}>
            <div style={S.statLabel}>총 유동량</div>
            <div style={S.statValue}>{formatVolume(stats.totalVolume)}</div>
          </div>
          <div style={S.card}>
            <div style={S.statLabel}>활성 동선</div>
            <div style={S.statValue}>{stats.activeCount}</div>
          </div>
        </div>
      )}

      {open && (
        <>
          <div>
            <div style={S.label}>분기</div>
            <div style={S.compactGrid}>
              {quarters.map((quarter) => {
                const active = quarter === selectedQuarter
                return (
                  <button
                    key={quarter}
                    type="button"
                    style={S.compactButton(active)}
                    onClick={() => onQuarterChange(quarter)}
                    aria-pressed={active}
                  >
                    {formatQuarter(quarter)}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={S.label}>이동 목적</div>
              {flowControlsEnabled && (
                <button type="button" role="switch" aria-checked={showFlows} onClick={onToggleFlows} style={S.switchTrack(showFlows)}>
                  <span style={S.switchThumb(showFlows)} />
                </button>
              )}
            </div>
            <div style={S.compactGrid}>
              <button
                type="button"
                style={S.compactButton(purpose === null)}
                onClick={() => onPurposeChange(null)}
                aria-pressed={purpose === null}
              >
                전체 {formatVolume(totalPurposeVolume)}
              </button>
              {PURPOSE_OPTIONS.map((option) => {
                const active = purpose === option.value
                const volume = purposeTotals[option.value] ?? 0
                const disabled = volume <= 0
                return (
                  <button
                    key={option.value}
                    type="button"
                    style={S.compactButton(active)}
                    disabled={disabled}
                    onClick={() => {
                      if (!disabled) onPurposeChange(active ? null : option.value)
                    }}
                    aria-pressed={active}
                  >
                    {option.label} · {option.peak}
                  </button>
                )
              })}
            </div>
            {selectedPurposeVolume <= 0 && <div style={S.empty}>선택한 이동 목적의 데이터가 없습니다. 전체로 다시 확인하세요.</div>}
          </div>

          <div>
            <div style={S.label}>시간대</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="range"
                min={0}
                max={23}
                value={hour}
                onChange={(event) => onHourChange(Number(event.target.value))}
                style={{ flex: 1, accentColor: '#7BD08D' }}
                aria-label="시간대 선택"
              />
              <span style={{ minWidth: 72, textAlign: 'right', fontSize: 13, fontWeight: 800 }}>{formatHourLabel(hour)}</span>
            </div>
          </div>

          <div>
            <div style={S.label}>가시화 밀도</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="range"
                min={1}
                max={5}
                value={flowStrength}
                onChange={(event) => onStrengthChange(Number(event.target.value))}
                style={{ flex: 1, accentColor: '#7BD08D' }}
                aria-label="가시화 밀도 선택"
              />
              <span style={{ minWidth: 72, textAlign: 'right', fontSize: 13, fontWeight: 800 }}>{densityLabel}</span>
            </div>
            <div style={S.subLabel}>상위 {topN}개 흐름 중심으로 보여줍니다.</div>
          </div>

          <div style={S.statGrid}>
            <div style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={S.statLabel}>고객 유입 우세</div>
                <InfoTooltip text="유입 흐름이 가장 많이 도착하는 행정동입니다. 집객력이 높을수록 창업 입지로 유리합니다." />
              </div>
              <div style={{ ...S.statValue, fontSize: 14, color: '#A5D6A7' }}>{formatLocation(stats.topInflow)}</div>
            </div>
            <div style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={S.statLabel}>고객 유출 우세</div>
                <InfoTooltip text="유출 흐름이 가장 많이 출발하는 행정동입니다. 유출이 많을수록 주변 상권으로 이탈하는 고객이 많습니다." />
              </div>
              <div style={{ ...S.statValue, fontSize: 14, color: '#FFAB91' }}>{formatLocation(stats.topOutflow)}</div>
            </div>
          </div>

          {kpiDelta && (
            <div style={S.statGrid}>
              <div style={S.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={S.statLabel}>총 유동량 변화</div>
                  <InfoTooltip text="이전 분기 대비 선택 지역의 총 이동 인원 변화입니다. 양수(+)이면 유동인구 증가, 음수(-)이면 감소를 나타냅니다." />
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: getDeltaColor(kpiDelta.delta.totalVolume) }}>
                  {formatDelta(kpiDelta.delta.totalVolume, 0)}
                </div>
              </div>
              <div style={S.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={S.statLabel}>평균 GRI 변화</div>
                  <InfoTooltip text="이전 분기 대비 평균 상권위협도(GRI) 변화입니다. GRI가 낮을수록 상권이 안정적이며, 감소(-)가 긍정적 신호입니다." />
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: getDeltaColor(kpiDelta.delta.avgGri, 'lower') }}>
                  {formatDelta(kpiDelta.delta.avgGri, 1)}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              style={{ ...S.primaryButton(false), flex: 1, background: isPlaying ? '#37474F' : '#1B5E20' }}
              onClick={isPlaying ? onPause : onPlay}
              aria-label={isPlaying ? '일시정지' : '재생'}
            >
              {isPlaying ? '일시정지' : '재생'}
            </button>
            <button type="button" style={{ ...S.compactButton(false), minWidth: 54 }} onClick={onToggleSpeed}>
              {speed}x
            </button>
          </div>


          <div style={S.switchRow}>
            <span style={S.label}>단절 위험 표시</span>
            <button type="button" role="switch" aria-checked={showBarriers} onClick={onToggleBarriers} style={S.switchTrack(showBarriers)}>
              <span style={S.switchThumb(showBarriers)} />
            </button>
          </div>
        </>
      )}
    </section>
  )
}

interface SelectedCommerceSummaryProps {
  selectedNode: CommerceNode | null
}

export function SelectedCommerceSummary({ selectedNode }: SelectedCommerceSummaryProps) {
  if (!selectedNode) return null
  const startup = deriveStartupSummary(selectedNode)
  const color = COMMERCE_COLORS[selectedNode.type].textColor

  return (
    <section style={S.section} aria-label="선택 상권 요약">
      <div style={S.title}>4. 상세 근거 확인</div>
      <div style={S.card}>
        <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.panelText }}>{selectedNode.name}</div>
        <div style={{ marginTop: 4, fontSize: 11, color }}>
          {startup.fitLabel} · {startup.characterLabel}
        </div>
        <div style={{ marginTop: 8, ...S.statGrid }}>
          <div>
            <div style={S.statLabel}>자치구</div>
            <div style={{ fontSize: 12, fontWeight: 750 }}>{selectedNode.district || '-'}</div>
          </div>
          <div>
            <div style={S.statLabel}>위험도</div>
            <div style={{ fontSize: 12, fontWeight: 750 }}>{formatFixed2(selectedNode.griScore)}</div>
          </div>
          <div>
            <div style={S.statLabel}>순유입</div>
            <div style={{ fontSize: 12, fontWeight: 750 }}>{formatSignedFixed2(selectedNode.netFlow)}</div>
          </div>
          <div>
            <div style={S.statLabel}>폐업률</div>
            <div style={{ fontSize: 12, fontWeight: 750 }}>
              {selectedNode.closeRate != null ? `${selectedNode.closeRate.toFixed(1)}%` : '-'}
            </div>
          </div>
        </div>
        <div style={{ ...S.subLabel, marginTop: 8 }}>
          왼쪽 상세 패널에서 지표별 기준과 다음 확인 사항을 볼 수 있습니다.
        </div>
      </div>
    </section>
  )
}
