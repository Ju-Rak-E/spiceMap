import { useState } from 'react'
import Map from './components/Map'
import FlowControlPanel from './components/FlowControlPanel'
import { useCommerceData } from './hooks/useCommerceData'
import { useFlowData, type FlowPurpose } from './hooks/useFlowData'
import { useTimelineControl } from './hooks/useTimelineControl'
import { filterNodesByDistrict, filterNodesByType } from './utils/filters'
import type { CommerceNode } from './types/commerce'
import type { CommerceType } from './styles/tokens'
import './App.css'

const STRENGTH_TO_TOP_N: Record<number, number> = {
  1: 5, 2: 10, 3: 15, 4: 20, 5: 30,
}

export default function App() {
  const [purpose, setPurpose] = useState<FlowPurpose | null>(null)
  const [hour, setHour] = useState(14)
  const [flowStrength, setFlowStrength] = useState(3)
  const [boundaryOpacity, setBoundaryOpacity] = useState(0.3)
  const [selectedNode, setSelectedNode] = useState<CommerceNode | null>(null)
  const [selectedDistricts, setSelectedDistricts] = useState<Set<string>>(new Set())
  const [selectedTypes, setSelectedTypes] = useState<Set<CommerceType>>(new Set())

  const { isPlaying, speed, play, pause, toggleSpeed } = useTimelineControl(hour, setHour)

  const topN = STRENGTH_TO_TOP_N[flowStrength] ?? 15
  const { nodes: rawNodes, usingMockData } = useCommerceData()
  const flowData = useFlowData({ purpose: purpose ?? undefined, topN, hour })

  const nodes = filterNodesByType(
    filterNodesByDistrict(rawNodes, selectedDistricts),
    selectedTypes,
  )

  function handleToggleDistrict(district: string) {
    setSelectedDistricts(prev => {
      const next = new Set(prev)
      next.has(district) ? next.delete(district) : next.add(district)
      return next
    })
  }

  function handleToggleType(type: CommerceType) {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 지도 영역 */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <Map
          theme="dark"
          flows={flowData.flows}
          nodes={nodes}
          usingMockData={usingMockData}
          hour={hour}
          purpose={purpose}
          boundaryOpacity={boundaryOpacity}
          onNodeClick={setSelectedNode}
        />
      </div>

      {/* 우측 제어판 */}
      <FlowControlPanel
        purpose={purpose}
        onPurposeChange={setPurpose}
        hour={hour}
        onHourChange={setHour}
        flowStrength={flowStrength}
        onStrengthChange={setFlowStrength}
        boundaryOpacity={boundaryOpacity}
        onBoundaryOpacityChange={setBoundaryOpacity}
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
        selectedTypes={selectedTypes}
        onToggleType={handleToggleType}
      />
    </div>
  )
}
