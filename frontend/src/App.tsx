import { useState, useCallback, useEffect } from 'react'
import Map from './components/Map'
import FlowControlPanel from './components/FlowControlPanel'
import { useCommerceData } from './hooks/useCommerceData'
import { useFlowData, type FlowPurpose } from './hooks/useFlowData'
import type { CommerceType } from './styles/tokens'
import { COMMERCE_COLORS } from './styles/tokens'
import type { CommerceNode } from './types/commerce'
import './App.css'

const ALL_TYPES = new Set(Object.keys(COMMERCE_COLORS) as CommerceType[])

const STRENGTH_TO_TOP_N: Record<number, number> = {
  1: 5, 2: 10, 3: 15, 4: 20, 5: 30,
}

const BOUNDARY_OPACITY = 0.2
const SCOPE_LABEL = '강남구·관악구 시범'

export default function App() {
  const [purpose, setPurpose] = useState<FlowPurpose | null>(null)
  const [hour, setHour] = useState(14)
  const [flowStrength, setFlowStrength] = useState(3)
  const [selectedTypes, setSelectedTypes] = useState<Set<CommerceType>>(new Set(ALL_TYPES))
  const [selectedNode, setSelectedNode] = useState<CommerceNode | null>(null)

  const handleToggleType = useCallback((type: CommerceType) => {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  const topN = STRENGTH_TO_TOP_N[flowStrength] ?? 15
  const { nodes: allNodes, usingMockData } = useCommerceData()
  const nodes = allNodes.filter(n => selectedTypes.has(n.type))
  const flowData = useFlowData({ purpose: purpose ?? undefined, topN, hour })

  useEffect(() => {
    if (!selectedNode) return
    if (!nodes.some(node => node.id === selectedNode.id)) {
      setSelectedNode(null)
    }
  }, [nodes, selectedNode])

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
      />
    </div>
  )
}
