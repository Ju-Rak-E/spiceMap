import { useMemo, useState, type CSSProperties } from 'react'
import type { FlowPurpose, FlowStats, PurposeVolumeMap } from '../hooks/useFlowData'
import type { CommerceNode } from '../types/commerce'
import { MAP_THEME } from '../styles/tokens'
import { formatQuarter } from '../utils/quarter'
import type { QuarterKpiDelta } from '../utils/quarterDelta'
import type { AdvisorResult } from '../hooks/useStartupAdvisor'
import type { FounderFilterState, FounderStep } from '../utils/founderUx'
import {
  AdvancedOptionsSection,
  DistrictFilterSection,
  FounderIndustrySection,
  RecommendationResultsSection,
  SelectedCommerceSummary,
} from './FounderPanelSections'

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
  compareQuarter: string | null
  kpiDelta: QuarterKpiDelta | null
  compact?: boolean
  stacked?: boolean
  advisorIndustries: string[]
  advisorLoading: boolean
  advisorResult: AdvisorResult | null
  advisorError: string | null
  onAdvisorAnalyze: (industry: string, districts?: string[]) => void
  onAdvisorReset: () => void
  onSelectAdvisorCommerce: (commCd: string) => void
}

const STEP_LABELS: Array<{ step: FounderStep; label: string }> = [
  { step: 'industry', label: '업종' },
  { step: 'region', label: '지역' },
  { step: 'results', label: '결과' },
  { step: 'detail', label: '상세' },
]

const S = {
  panel: (compact: boolean, stacked: boolean): CSSProperties => ({
    width: stacked ? '100%' : compact ? 292 : 340,
    minWidth: stacked ? 0 : compact ? 292 : 340,
    height: stacked ? '46vh' : '100%',
    background: COLORS.panelBg,
    borderLeft: stacked ? 'none' : `1px solid ${COLORS.panelBorder}`,
    borderTop: stacked ? `1px solid ${COLORS.panelBorder}` : 'none',
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
    fontSize: 16,
    fontWeight: 800,
    color: COLORS.panelText,
    marginBottom: 5,
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
  stepTabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 6,
  } satisfies CSSProperties,
  stepTab: (active: boolean): CSSProperties => ({
    border: active ? '1.5px solid #7BD08D' : `1px solid ${COLORS.panelBorder}`,
    background: active ? 'rgba(123,208,141,0.15)' : COLORS.panelSurface,
    color: active ? '#D7F5DC' : COLORS.secondaryText,
    borderRadius: 8,
    padding: '7px 4px',
    fontSize: 11,
    fontWeight: active ? 800 : 650,
    cursor: 'pointer',
  }),
}

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
  compareQuarter,
  kpiDelta,
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
  const [activeStep, setActiveStep] = useState<FounderStep>('industry')
  const [districtFilterOpen, setDistrictFilterOpen] = useState(false)
  const currentIndustry = selectedAdvisorIndustry || advisorIndustries[0] || ''
  const filterState: FounderFilterState = useMemo(() => ({
    industry: currentIndustry,
    districts: selectedDistricts,
    quarter: selectedQuarter,
    purpose,
    hour,
  }), [currentIndustry, selectedDistricts, selectedQuarter, purpose, hour])

  const showSection = (step: FounderStep) => !stacked || activeStep === step

  return (
    <aside style={S.panel(compact, stacked)}>
      <div style={S.header}>
        <div style={S.title}>서울 창업 상권 찾기</div>
        <div style={S.subtitle}>
          업종과 관심 지역을 먼저 정하고, 추천 상권의 기회·위험 근거를 순서대로 확인합니다.
        </div>
        <div style={S.statusRow}>
          <span style={S.statusTag}>{scopeLabel}</span>
          <span style={S.statusTag}>{formatQuarter(filterState.quarter)}</span>
          <span style={S.statusTag}>{usingMockData ? '캐시 데이터' : 'API 연결'}</span>
          {filterState.industry && <span style={S.statusTag}>업종: {filterState.industry}</span>}
          {selectedNode && <span style={S.statusTag}>선택: {selectedNode.name}</span>}
        </div>
      </div>

      {stacked && (
        <nav style={S.stepTabs} aria-label="창업 탐색 단계">
          {STEP_LABELS.map((item) => (
            <button
              key={item.step}
              type="button"
              style={S.stepTab(activeStep === item.step)}
              onClick={() => setActiveStep(item.step)}
              aria-pressed={activeStep === item.step}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}

      {showSection('industry') && (
        <FounderIndustrySection
          advisorIndustries={advisorIndustries}
          selectedIndustry={filterState.industry}
          advisorLoading={advisorLoading}
          advisorResult={advisorResult}
          advisorError={advisorError}
          onIndustryChange={(industry) => {
            setSelectedAdvisorIndustry(industry)
            onAdvisorReset()
          }}
          onAdvisorAnalyze={(industry) => {
            setDistrictFilterOpen(false)
            onAdvisorAnalyze(industry, Array.from(selectedDistricts))
            if (stacked) setActiveStep('results')
          }}
          onAdvisorReset={onAdvisorReset}
        />
      )}

      {showSection('region') && (
        <DistrictFilterSection
          selectedDistricts={selectedDistricts}
          open={districtFilterOpen}
          onOpenChange={setDistrictFilterOpen}
          onToggleDistrict={onToggleDistrict}
          onSelectAllDistricts={onSelectAllDistricts}
          onClearDistricts={onClearDistricts}
          onSetDistricts={onSetDistricts}
        />
      )}

      {showSection('results') && (
        <RecommendationResultsSection
          advisorResult={advisorResult}
          selectedIndustry={filterState.industry}
          selectedDistricts={selectedDistricts}
          onSelectAdvisorCommerce={(commCd) => {
            onSelectAdvisorCommerce(commCd)
            if (stacked) setActiveStep('detail')
          }}
        />
      )}

      {showSection('detail') && <SelectedCommerceSummary selectedNode={selectedNode} />}

      <AdvancedOptionsSection
        purpose={purpose}
        onPurposeChange={onPurposeChange}
        hour={hour}
        onHourChange={onHourChange}
        flowStrength={flowStrength}
        onStrengthChange={onStrengthChange}
        selectedQuarter={selectedQuarter}
        quarters={quarters}
        onQuarterChange={onQuarterChange}
        topN={topN}
        purposeTotals={purposeTotals}
        stats={stats}
        isPlaying={isPlaying}
        speed={speed}
        showFlows={showFlows}
        showBarriers={showBarriers}
        flowControlsEnabled={flowControlsEnabled}
        compareQuarter={compareQuarter}
        kpiDelta={kpiDelta}
        onPlay={onPlay}
        onPause={onPause}
        onToggleSpeed={onToggleSpeed}
        onToggleFlows={onToggleFlows}
        onToggleBarriers={onToggleBarriers}
      />
    </aside>
  )
}
