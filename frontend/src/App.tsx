import { useState, useCallback, useEffect, useMemo, type PointerEvent as ReactPointerEvent } from 'react'
import Map from './components/Map'
import FlowControlPanel from './components/FlowControlPanel'
import ValidationView from './components/ValidationView'
import ToastViewport from './components/Toast'
import { ToastProvider } from './components/ToastContext'
import { useCommerceData } from './hooks/useCommerceData'
import { useFlowData, computeStats, type FlowPurpose } from './hooks/useFlowData'
import { useTimelineControl } from './hooks/useTimelineControl'
import { useViewportMode } from './hooks/useViewportMode'
import { useStartupAdvisor } from './hooks/useStartupAdvisor'
import { filterNodesByDistrict } from './utils/filters'
import { computeKpi, computeKpiDelta, getPreviousQuarter } from './utils/quarterDelta'
import { SEOUL_DISTRICT_NAMES, SEOUL_DISTRICT_NAME_TO_ADM_PREFIX } from './utils/seoulDistricts'

import type { CommerceNode } from './types/commerce'

const STRENGTH_TO_TOP_N: Record<number, number> = {
  1: 5, 2: 10, 3: 15, 4: 20, 5: 30,
}

const BOUNDARY_OPACITY = 0.08
const SCOPE_LABEL = '서울 전역 창업 분석'
const DEFAULT_QUARTER = '2025Q4'
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
const OD_FLOW_ENABLED = true
const CONTROL_PANEL_DEFAULT_WIDTH = 340
const CONTROL_PANEL_MIN_WIDTH = 292
const CONTROL_PANEL_MAX_WIDTH = 560
// docs/preview/hero_shot_scenario.md §0: ?hero=1 진입 시 신림(gw_001)을 펄싱 강조.
// 시연 외 일반 동작에는 영향 없음(쿼리 미설정 시 null).
const HERO_NODE_ID = 'gw_001'

function isHeroModeEnabled(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('hero') === '1'
}
const QUARTERS = ['2025Q4', '2025Q3', '2025Q2', '2025Q1']
const QUARTER_SEQUENCE = [...QUARTERS].reverse()

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export default function App() {
  const [purpose, setPurpose] = useState<FlowPurpose | null>(null)
  const [hour, setHour] = useState(14)
  const [flowStrength, setFlowStrength] = useState(3)
  const [showFlows, setShowFlows] = useState(true)
  const [showBarriers, setShowBarriers] = useState(false)
  const [selectedNode, setSelectedNode] = useState<CommerceNode | null>(null)
  const [selectedDistricts, setSelectedDistricts] = useState<Set<string>>(
    () => new Set(SEOUL_DISTRICT_NAMES),
  )
  const [selectedQuarter, setSelectedQuarter] = useState(DEFAULT_QUARTER)
  const [heroMode] = useState<boolean>(() => isHeroModeEnabled())
  const heroNodeId = heroMode ? HERO_NODE_ID : null
  const [view, setView] = useState<'map' | 'validation'>('map')
  const [controlPanelWidth, setControlPanelWidth] = useState(CONTROL_PANEL_DEFAULT_WIDTH)
  const viewportMode = useViewportMode()

  const { isPlaying, speed, play, pause, toggleSpeed } = useTimelineControl(hour, setHour)

  const advisor = useStartupAdvisor(selectedQuarter)

  const topN = STRENGTH_TO_TOP_N[flowStrength] ?? 15
  const previousQuarter = useMemo(
    () => getPreviousQuarter(selectedQuarter, QUARTER_SEQUENCE),
    [selectedQuarter],
  )

  const { nodes: rawNodes, usingMockData } = useCommerceData(selectedQuarter, selectedDistricts)
  const flowData = useFlowData({
    purpose: purpose ?? undefined,
    hour,
    quarter: selectedQuarter,
    enabled: OD_FLOW_ENABLED,
  })

  const compareEnabled = previousQuarter !== null
  const compareQuarter = compareEnabled ? previousQuarter : selectedQuarter
  const { nodes: rawCompareNodes } = useCommerceData(compareQuarter, selectedDistricts)
  const compareFlowData = useFlowData({
    purpose: purpose ?? undefined,
    topN,
    hour,
    quarter: compareQuarter,
    enabled: OD_FLOW_ENABLED,
  })

  const nodes = filterNodesByDistrict(rawNodes, selectedDistricts)
  const compareNodes = filterNodesByDistrict(rawCompareNodes, selectedDistricts)

  const filteredFlows = useMemo(() => {
    let result = flowData.flows
    if (selectedDistricts.size < SEOUL_DISTRICT_NAMES.length) {
      result = result.filter((flow) =>
        [...selectedDistricts].some((district) => {
          // mock 포맷: "강남구_역삼동"
          if (flow.sourceId.startsWith(`${district}_`) || flow.targetId.startsWith(`${district}_`)) {
            return true
          }
          // API 포맷: adm_cd 8자리 (e.g. "11680650")
          const prefix = SEOUL_DISTRICT_NAME_TO_ADM_PREFIX[district]
          return prefix
            ? flow.sourceId.startsWith(prefix) || flow.targetId.startsWith(prefix)
            : false
        }),
      )
    }

    if (topN > 0) {
      result = [...result].sort((a, b) => b.volume - a.volume).slice(0, topN)
    }

    return result
  }, [flowData.flows, selectedDistricts, topN])

  const filteredStats = useMemo(() => computeStats(filteredFlows), [filteredFlows])

  const kpiDelta = useMemo(() => {
    if (!compareEnabled) return null
    const current = computeKpi(nodes, flowData.totalVolume)
    const previous = computeKpi(compareNodes, compareFlowData.totalVolume)
    return computeKpiDelta(current, previous)
  }, [compareEnabled, nodes, compareNodes, flowData.totalVolume, compareFlowData.totalVolume])
  const handleSelectAdvisorCommerce = useCallback((commCd: string) => {
    const node = nodes.find((n) => n.id === commCd)
    if (node) setSelectedNode(node)
  }, [nodes])

  useEffect(() => {
    if (!selectedNode) return
    if (!nodes.some(node => node.id === selectedNode.id)) {
      queueMicrotask(() => setSelectedNode(null))
    }
  }, [nodes, selectedNode])

  // docs/preview/hero_shot_scenario.md §5: 라이브 클릭 실패 시 단축키로 시간축 강제 점프.
  // ?hero=1 모드에서만 활성. 입력 영역 포커스 시 무시.
  useEffect(() => {
    if (!heroMode) return

    function isInputFocused(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      return target.isContentEditable
    }

    function handleHeroShortcut(event: KeyboardEvent) {
      if (isInputFocused(event.target)) return
      if (event.altKey || event.metaKey || event.ctrlKey) return

      switch (event.key) {
        case '1':
          setSelectedNode(null)
          setView('map')
          break
        case '2': {
          const heroNode = nodes.find((node) => node.id === HERO_NODE_ID)
          if (heroNode) {
            setSelectedNode(heroNode)
            setView('map')
          }
          break
        }
        case '3': {
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="download-csv"]')
          btn?.click()
          break
        }
        case '4':
          setView('validation')
          break
        default:
          return
      }
      event.preventDefault()
    }

    window.addEventListener('keydown', handleHeroShortcut)
    return () => window.removeEventListener('keydown', handleHeroShortcut)
  }, [heroMode, nodes])

  const handleToggleDistrict = useCallback((district: string) => {
    setSelectedDistricts(prev => {
      const next = new Set(prev)
      if (next.has(district)) {
        next.delete(district)
      } else {
        next.add(district)
      }
      return next
    })
  }, [])

  const handleDownloadCsv = useCallback(async () => {
    const params = new URLSearchParams({
      quarter: selectedQuarter,
      min_priority: '0',
    })
    const response = await fetch(`${API_BASE}/api/export/csv?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`CSV download failed: HTTP ${response.status}`)
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const disposition = response.headers.get('Content-Disposition')
    const filename = disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? `spicemap_${selectedQuarter}.csv`
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }, [selectedQuarter])
  const handleSelectAllDistricts = useCallback(() => {
    setSelectedDistricts(new Set(SEOUL_DISTRICT_NAMES))
  }, [])
  const handleClearDistricts = useCallback(() => {
    setSelectedDistricts(new Set())
  }, [])
  const handleSetDistricts = useCallback((districts: Set<string>) => {
    setSelectedDistricts(new Set(districts))
  }, [])

  const advisorTiers = advisor.tierMap

  const handleControlPanelResizeStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (viewportMode.isNarrow) return
    event.preventDefault()

    const startX = event.clientX
    const startWidth = controlPanelWidth
    const maxWidth = clamp(
      window.innerWidth - 420,
      CONTROL_PANEL_MIN_WIDTH,
      CONTROL_PANEL_MAX_WIDTH,
    )
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + startX - moveEvent.clientX
      setControlPanelWidth(clamp(nextWidth, CONTROL_PANEL_MIN_WIDTH, maxWidth))
    }

    const handleUp = () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
  }, [controlPanelWidth, viewportMode.isNarrow])

  return (
    <ToastProvider>
      <div
        style={{
          display: 'flex',
          flexDirection: viewportMode.isNarrow ? 'column' : 'row',
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div style={{ flex: 1, position: 'relative', minWidth: 0, minHeight: viewportMode.isNarrow ? 420 : 0 }}>
          <Map
            theme="dark"
            flows={filteredFlows}
            nodes={nodes}
            usingMockData={usingMockData}
            hour={hour}
            purpose={purpose}
            topN={topN}
            flowStrength={flowStrength}
            scopeLabel={SCOPE_LABEL}
            dataStatusLabel={usingMockData ? '캐시 데이터' : 'API 연결'}
            selectedQuarter={selectedQuarter}
            boundaryOpacity={BOUNDARY_OPACITY}
            showFlows={OD_FLOW_ENABLED && showFlows}
            showBarriers={showBarriers}
            selectedDistricts={selectedDistricts}
            selectedNode={selectedNode}
            onSelectNode={setSelectedNode}
            heroNodeId={heroNodeId}
            advisorTiers={advisorTiers}
          />
          {view === 'validation' && <ValidationView onClose={() => setView('map')} />}
        </div>

        {!viewportMode.isNarrow && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="control panel resize"
            onPointerDown={handleControlPanelResizeStart}
            style={{
              width: 8,
              flexShrink: 0,
              cursor: 'col-resize',
              background: '#10161D',
              borderLeft: '1px solid #24323F',
              borderRight: '1px solid #24323F',
              touchAction: 'none',
            }}
          />
        )}

        <FlowControlPanel
          purpose={purpose}
          onPurposeChange={setPurpose}
          hour={hour}
          onHourChange={setHour}
          flowStrength={flowStrength}
          onStrengthChange={setFlowStrength}
          selectedQuarter={selectedQuarter}
          quarters={QUARTERS}
          onQuarterChange={setSelectedQuarter}
          topN={topN}
          scopeLabel={SCOPE_LABEL}
          usingMockData={usingMockData}
          nodes={nodes}
          selectedNode={selectedNode}
          stats={{
            totalVolume: filteredStats.totalVolume,
            activeCount: filteredStats.activeCount,
            topInflow: filteredStats.topInflow,
            topOutflow: filteredStats.topOutflow,
          }}
          purposeTotals={flowData.purposeTotals}
          isPlaying={isPlaying}
          speed={speed}
          showFlows={showFlows}
          showBarriers={showBarriers}
          flowControlsEnabled={OD_FLOW_ENABLED}
          onPlay={play}
          onPause={pause}
          onToggleSpeed={toggleSpeed}
          onToggleFlows={() => setShowFlows(prev => !prev)}
          onToggleBarriers={() => setShowBarriers(prev => !prev)}
          selectedDistricts={selectedDistricts}
          onToggleDistrict={handleToggleDistrict}
          onSelectAllDistricts={handleSelectAllDistricts}
          onClearDistricts={handleClearDistricts}
          onSetDistricts={handleSetDistricts}
          onSelectNode={setSelectedNode}
          compareQuarter={previousQuarter}
          kpiDelta={kpiDelta}
          compact={viewportMode.isTablet}
          stacked={viewportMode.isNarrow}
          advisorIndustries={advisor.industries}
          advisorLoading={advisor.isLoading}
          advisorResult={advisor.result}
          advisorError={advisor.error}
          onAdvisorAnalyze={advisor.analyze}
          onAdvisorReset={advisor.reset}
          onSelectAdvisorCommerce={handleSelectAdvisorCommerce}
          onOpenValidationReport={() => setView('validation')}
          onDownloadCsv={handleDownloadCsv}
          panelWidth={controlPanelWidth}
        />
      </div>
      <ToastViewport />
    </ToastProvider>
  )
}
