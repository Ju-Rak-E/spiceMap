import { useMemo, useState, useCallback, useEffect } from 'react'
import Map from './components/Map'
import FlowControlPanel from './components/FlowControlPanel'
import ToastViewport from './components/Toast'
import { ToastProvider } from './components/ToastContext'
import { useCommerceData } from './hooks/useCommerceData'
import { useFlowData, type FlowPurpose } from './hooks/useFlowData'
import { useTimelineControl } from './hooks/useTimelineControl'
import { useViewportMode } from './hooks/useViewportMode'
import { filterNodesByDistrict } from './utils/filters'
import { computeKpi, computeKpiDelta, getPreviousQuarter } from './utils/quarterDelta'
import type { CommerceNode } from './types/commerce'
import './App.css'

const STRENGTH_TO_TOP_N: Record<number, number> = {
  1: 5, 2: 10, 3: 15, 4: 20, 5: 30,
}

const BOUNDARY_OPACITY = 0.08
const SCOPE_LABEL = '강남구·관악구 창업 시범'
const DEFAULT_QUARTER = '2025Q4'
const QUARTERS = [
  '2024Q1', '2024Q2', '2024Q3', '2024Q4',
  '2025Q1', '2025Q4',
]

export default function App() {
  const [purpose, setPurpose] = useState<FlowPurpose | null>(null)
  const [hour, setHour] = useState(14)
  const [flowStrength, setFlowStrength] = useState(3)
  const [showFlows, setShowFlows] = useState(true)
  const [showBarriers, setShowBarriers] = useState(false)
  const [selectedNode, setSelectedNode] = useState<CommerceNode | null>(null)
  const [selectedDistricts, setSelectedDistricts] = useState<Set<string>>(
    () => new Set(['강남구', '관악구']),
  )
  const [selectedQuarter, setSelectedQuarter] = useState(DEFAULT_QUARTER)
  const [compareMode, setCompareMode] = useState(false)
  const viewportMode = useViewportMode()

  const { isPlaying, speed, play, pause, toggleSpeed } = useTimelineControl(hour, setHour)

  const topN = STRENGTH_TO_TOP_N[flowStrength] ?? 15
  const previousQuarter = useMemo(
    () => getPreviousQuarter(selectedQuarter, QUARTERS),
    [selectedQuarter],
  )

  const { nodes: rawNodes, usingMockData } = useCommerceData(selectedQuarter, selectedDistricts)
  const flowData = useFlowData({ purpose: purpose ?? undefined, topN, hour, quarter: selectedQuarter })

  const compareEnabled = compareMode && previousQuarter !== null
  const compareQuarter = compareEnabled ? previousQuarter : selectedQuarter
  const { nodes: rawCompareNodes } = useCommerceData(compareQuarter, selectedDistricts)
  const compareFlowData = useFlowData({
    purpose: purpose ?? undefined,
    topN,
    hour,
    quarter: compareQuarter,
  })

  const nodes = filterNodesByDistrict(rawNodes, selectedDistricts)
  const compareNodes = filterNodesByDistrict(rawCompareNodes, selectedDistricts)

  const kpiDelta = useMemo(() => {
    if (!compareEnabled) return null
    const current = computeKpi(nodes, flowData.totalVolume)
    const previous = computeKpi(compareNodes, compareFlowData.totalVolume)
    return computeKpiDelta(current, previous)
  }, [compareEnabled, nodes, compareNodes, flowData.totalVolume, compareFlowData.totalVolume])

  useEffect(() => {
    if (!selectedNode) return
    if (!nodes.some(node => node.id === selectedNode.id)) {
      queueMicrotask(() => setSelectedNode(null))
    }
  }, [nodes, selectedNode])

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

  return (
    <ToastProvider>
      <div
        style={{
          display: 'flex',
          flexDirection: viewportMode.isNarrow ? 'column' : 'row',
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        <div style={{ flex: 1, position: 'relative', minWidth: 0, minHeight: viewportMode.isNarrow ? 420 : 0 }}>
          <Map
            theme="dark"
            flows={flowData.flows}
            nodes={nodes}
            usingMockData={usingMockData}
            hour={hour}
            purpose={purpose}
            topN={topN}
            scopeLabel={SCOPE_LABEL}
            dataStatusLabel={usingMockData ? '캐시 데이터' : 'API 연결'}
            selectedQuarter={selectedQuarter}
            boundaryOpacity={BOUNDARY_OPACITY}
            showFlows={showFlows}
            showBarriers={showBarriers}
            selectedDistricts={selectedDistricts}
            selectedNode={selectedNode}
            onSelectNode={setSelectedNode}
          />
        </div>

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
            totalVolume: flowData.totalVolume,
            activeCount: flowData.activeCount,
            topInflow: flowData.topInflow,
            topOutflow: flowData.topOutflow,
          }}
          purposeTotals={flowData.purposeTotals}
          isPlaying={isPlaying}
          speed={speed}
          showFlows={showFlows}
          showBarriers={showBarriers}
          onPlay={play}
          onPause={pause}
          onToggleSpeed={toggleSpeed}
          onToggleFlows={() => setShowFlows(prev => !prev)}
          onToggleBarriers={() => setShowBarriers(prev => !prev)}
          selectedDistricts={selectedDistricts}
          onToggleDistrict={handleToggleDistrict}
          onSelectNode={setSelectedNode}
          compareMode={compareMode}
          compareQuarter={previousQuarter}
          kpiDelta={kpiDelta}
          onToggleCompare={() => setCompareMode((prev) => !prev)}
          compact={viewportMode.isTablet}
          stacked={viewportMode.isNarrow}
        />
      </div>
      <ToastViewport />
    </ToastProvider>
  )
}
