import { useState, useCallback, useEffect } from 'react'
import Map from './components/Map'
import FlowControlPanel from './components/FlowControlPanel'
import { useCommerceData } from './hooks/useCommerceData'
import { useFlowData, type FlowPurpose } from './hooks/useFlowData'
import { useTimelineControl } from './hooks/useTimelineControl'
import { filterNodesByDistrict, filterNodesByType } from './utils/filters'
import type { CommerceNode } from './types/commerce'
import type { CommerceType } from './styles/tokens'
import { COMMERCE_COLORS } from './styles/tokens'
import './App.css'

const ALL_TYPES = new Set(Object.keys(COMMERCE_COLORS) as CommerceType[])

const STRENGTH_TO_TOP_N: Record<number, number> = {
  1: 5, 2: 10, 3: 15, 4: 20, 5: 30,
}

const BOUNDARY_OPACITY = 0.2
const SCOPE_LABEL = '강남구·관악구 시범'
const DEFAULT_QUARTER = '2025Q4'

export default function App() {
  const [purpose, setPurpose] = useState<FlowPurpose | null>(null)
  const [hour, setHour] = useState(14)
  const [flowStrength, setFlowStrength] = useState(3)
  const [selectedNode, setSelectedNode] = useState<CommerceNode | null>(null)
  const [selectedDistricts, setSelectedDistricts] = useState<Set<string>>(new Set())
  const [selectedTypes, setSelectedTypes] = useState<Set<CommerceType>>(new Set(ALL_TYPES))
  const [selectedQuarter, setSelectedQuarter] = useState(DEFAULT_QUARTER)

  const { isPlaying, speed, play, pause, toggleSpeed } = useTimelineControl(hour, setHour)

  const topN = STRENGTH_TO_TOP_N[flowStrength] ?? 15
  const { nodes: rawNodes, usingMockData } = useCommerceData(selectedQuarter)
  const flowData = useFlowData({ purpose: purpose ?? undefined, topN, hour, quarter: selectedQuarter })

  const nodes = filterNodesByType(
    filterNodesByDistrict(rawNodes, selectedDistricts),
    selectedTypes,
  )

  useEffect(() => {
    if (!selectedNode) return
    if (!nodes.some(node => node.id === selectedNode.id)) {
      setSelectedNode(null)
    }
  }, [nodes, selectedNode])

  const handleToggleDistrict = useCallback((district: string) => {
    setSelectedDistricts(prev => {
      const next = new Set(prev)
      next.has(district) ? next.delete(district) : next.add(district)
      return next
    })
  }, [])

  const handleToggleType = useCallback((type: CommerceType) => {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
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
          selectedTypes={selectedTypes}
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
          onToggleType={handleToggleType}
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
        onQuarterChange={setSelectedQuarter}
        topN={topN}
        scopeLabel={SCOPE_LABEL}
        usingMockData={usingMockData}
        selectedTypes={selectedTypes}
        selectedNode={selectedNode}
        stats={{
          totalVolume: flowData.totalVolume,
          activeCount: flowData.activeCount,
          topInflow: flowData.topInflow,
          topOutflow: flowData.topOutflow,
        }}
        isPlaying={isPlaying}
        speed={speed}
        onPlay={play}
        onPause={pause}
        onToggleSpeed={toggleSpeed}
        selectedDistricts={selectedDistricts}
        onToggleDistrict={handleToggleDistrict}
        onToggleType={handleToggleType}
      />
    </div>
  )
}
