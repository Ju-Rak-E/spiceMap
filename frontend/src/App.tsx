import { useState, useCallback, useEffect, useMemo } from 'react'
import Map from './components/Map'
import FlowControlPanel from './components/FlowControlPanel'
import InsightStrip, { countCriticalCommerces } from './components/InsightStrip'
import { useCommerceData } from './hooks/useCommerceData'
import { useFlowData, type FlowPurpose } from './hooks/useFlowData'
import { useTimelineControl } from './hooks/useTimelineControl'
import { filterNodesByDistrict } from './utils/filters'
import type { CommerceNode } from './types/commerce'
import './App.css'

const STRENGTH_TO_TOP_N: Record<number, number> = {
  1: 5, 2: 10, 3: 15, 4: 20, 5: 30,
}

const BOUNDARY_OPACITY = 0.08
const SCOPE_LABEL = '강남구·관악구 창업 시범'
const DEFAULT_QUARTER = '2025Q4'
// docs/verification_h1_h3_results.md 의 1차 실데이터 결과 (Supabase 2026-04-30 기준).
// 후속: 백엔드 /api/verification 엔드포인트 추가 후 동적으로 갱신.
const VERIFICATION_H1_R = 0.106
const VERIFICATION_H1_P = 2.83e-5
const POLICY_CARD_COUNT_Q4 = 414
const QUARTERS = [
  '2024Q1', '2024Q2', '2024Q3', '2024Q4',
  '2025Q1', '2025Q4',
]

export default function App() {
  const [purpose, setPurpose] = useState<FlowPurpose | null>(null)
  const [hour, setHour] = useState(14)
  const [flowStrength, setFlowStrength] = useState(3)
  const [showFlows, setShowFlows] = useState(true)
  const [selectedNode, setSelectedNode] = useState<CommerceNode | null>(null)
  const [selectedDistricts, setSelectedDistricts] = useState<Set<string>>(new Set())
  const [selectedQuarter, setSelectedQuarter] = useState(DEFAULT_QUARTER)

  const { isPlaying, speed, play, pause, toggleSpeed } = useTimelineControl(hour, setHour)

  const topN = STRENGTH_TO_TOP_N[flowStrength] ?? 15
  const { nodes: rawNodes, usingMockData } = useCommerceData(selectedQuarter, selectedDistricts)
  const flowData = useFlowData({ purpose: purpose ?? undefined, topN, hour, quarter: selectedQuarter })

  const nodes = filterNodesByDistrict(rawNodes, selectedDistricts)
  const criticalCount = useMemo(() => countCriticalCommerces(nodes), [nodes])

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
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
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
          selectedDistricts={selectedDistricts}
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
        />
        <InsightStrip
          theme="dark"
          h1R={usingMockData ? null : VERIFICATION_H1_R}
          h1P={usingMockData ? null : VERIFICATION_H1_P}
          policyCardCount={POLICY_CARD_COUNT_Q4}
          criticalCommerceCount={criticalCount}
          quarter={selectedQuarter}
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
        onPlay={play}
        onPause={pause}
        onToggleSpeed={toggleSpeed}
        onToggleFlows={() => setShowFlows(prev => !prev)}
        selectedDistricts={selectedDistricts}
        onToggleDistrict={handleToggleDistrict}
        onSelectNode={setSelectedNode}
      />
    </div>
  )
}
