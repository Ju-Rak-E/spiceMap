import { useState, useCallback, useEffect, useMemo } from 'react'
import Map from './components/Map'
import FlowControlPanel from './components/FlowControlPanel'
import InsightStrip, { countCriticalCommerces } from './components/InsightStrip'
import ValidationView from './components/ValidationView'
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
// docs/hero_shot_scenario.md §0: ?hero=1 진입 시 신림(gw_001)을 펄싱 강조.
// 시연 외 일반 동작에는 영향 없음(쿼리 미설정 시 null).
const HERO_NODE_ID = 'gw_001'

function isHeroModeEnabled(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('hero') === '1'
}
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
  const [heroMode] = useState<boolean>(() => isHeroModeEnabled())
  const heroNodeId = heroMode ? HERO_NODE_ID : null
  const [view, setView] = useState<'map' | 'validation'>('map')

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

  // docs/hero_shot_scenario.md §5: 라이브 클릭 실패 시 단축키로 시간축 강제 점프.
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
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="hero-csv-export"]')
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

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <button
        type="button"
        onClick={() => setView((v) => (v === 'map' ? 'validation' : 'map'))}
        data-testid="validation-tab-toggle"
        style={{
          position: 'absolute',
          top: 12,
          right: 332,
          zIndex: 60,
          padding: '6px 12px',
          borderRadius: 999,
          border: '1px solid #304251',
          background: view === 'validation' ? '#7BD08D22' : 'rgba(16,22,29,0.92)',
          color: view === 'validation' ? '#7BD08D' : '#ECEFF1',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}
      >
        {view === 'validation' ? '지도' : '검증 보고'}
      </button>

      {view === 'validation' && <ValidationView onClose={() => setView('map')} />}

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
          heroNodeId={heroNodeId}
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
