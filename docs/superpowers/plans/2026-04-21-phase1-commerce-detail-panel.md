# Phase 1 — 상권 상세 패널 + D3 추세 그래프 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상권 노드 클릭 시 GRI·폐업률·순유입·12개월 추세 그래프를 보여주는 상세 패널 구현

**Architecture:** App.tsx에서 `selectedNode` state를 관리하고, Map.tsx가 클릭 이벤트를 상위로 전달한다. `useGriHistory` 훅이 GRI 시계열을 fetching하고 (API 없으면 mock 자동 폴백), `TrendChart`가 D3로 SVG 렌더링, `CommerceDetailPanel`이 전체 패널을 조립한다.

**Tech Stack:** React 19, TypeScript 6, Vitest 4, D3 v7, Deck.gl 9

---

## File Map

| 작업 | 파일 | 역할 |
|------|------|------|
| 신규 | `frontend/public/data/mock_gri_history.json` | mock GRI 시계열 (nodeId별 12개월) |
| 신규 | `frontend/src/hooks/useGriHistory.ts` | GRI 히스토리 fetch 훅 |
| 신규 | `frontend/src/hooks/useGriHistory.test.ts` | 훅 순수 로직 테스트 |
| 신규 | `frontend/src/components/TrendChart.tsx` | D3 SVG 추세 그래프 |
| 신규 | `frontend/src/components/CommerceDetailPanel.tsx` | 상세 패널 전체 조립 |
| 수정 | `frontend/src/layers/CommerceNodeLayer.ts` | onClick 파라미터 추가 |
| 수정 | `frontend/src/components/Map.tsx` | onClick prop + selectedNode 콜백 |
| 수정 | `frontend/src/App.tsx` | selectedNode state + 패널 렌더링 |

---

## Task 1: mock GRI 시계열 데이터 생성

**Files:**
- Create: `frontend/public/data/mock_gri_history.json`

- [ ] **Step 1: mock JSON 파일 생성**

```json
{
  "강남구_역삼동_001": [
    { "ts": "2024-05", "gri": 61 },
    { "ts": "2024-06", "gri": 63 },
    { "ts": "2024-07", "gri": 67 },
    { "ts": "2024-08", "gri": 65 },
    { "ts": "2024-09", "gri": 70 },
    { "ts": "2024-10", "gri": 72 },
    { "ts": "2024-11", "gri": 74 },
    { "ts": "2024-12", "gri": 71 },
    { "ts": "2025-01", "gri": 69 },
    { "ts": "2025-02", "gri": 73 },
    { "ts": "2025-03", "gri": 78 },
    { "ts": "2025-04", "gri": 80 }
  ],
  "관악구_신림동_001": [
    { "ts": "2024-05", "gri": 45 },
    { "ts": "2024-06", "gri": 43 },
    { "ts": "2024-07", "gri": 41 },
    { "ts": "2024-08", "gri": 44 },
    { "ts": "2024-09", "gri": 40 },
    { "ts": "2024-10", "gri": 38 },
    { "ts": "2024-11", "gri": 36 },
    { "ts": "2024-12", "gri": 37 },
    { "ts": "2025-01", "gri": 35 },
    { "ts": "2025-02", "gri": 33 },
    { "ts": "2025-03", "gri": 34 },
    { "ts": "2025-04", "gri": 32 }
  ],
  "__default__": [
    { "ts": "2024-05", "gri": 50 },
    { "ts": "2024-06", "gri": 52 },
    { "ts": "2024-07", "gri": 51 },
    { "ts": "2024-08", "gri": 53 },
    { "ts": "2024-09", "gri": 55 },
    { "ts": "2024-10", "gri": 54 },
    { "ts": "2024-11", "gri": 56 },
    { "ts": "2024-12", "gri": 58 },
    { "ts": "2025-01", "gri": 57 },
    { "ts": "2025-02", "gri": 59 },
    { "ts": "2025-03", "gri": 61 },
    { "ts": "2025-04", "gri": 63 }
  ]
}
```

- [ ] **Step 2: 브라우저에서 접근 확인**

```bash
# dev server 실행 중이라면:
curl http://localhost:5173/data/mock_gri_history.json
# → JSON 응답 확인
```

---

## Task 2: useGriHistory 훅 타입 + 순수 로직 테스트

**Files:**
- Create: `frontend/src/hooks/useGriHistory.ts`
- Create: `frontend/src/hooks/useGriHistory.test.ts`

- [ ] **Step 1: 테스트 파일 먼저 작성 (RED)**

`frontend/src/hooks/useGriHistory.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildGriSeries, type GriPoint } from './useGriHistory'

const MOCK_SERIES: GriPoint[] = [
  { ts: '2025-01', gri: 60 },
  { ts: '2025-02', gri: 65 },
  { ts: '2025-03', gri: 70 },
]

describe('buildGriSeries', () => {
  it('정렬된 시계열을 그대로 반환한다', () => {
    const result = buildGriSeries(MOCK_SERIES)
    expect(result).toHaveLength(3)
    expect(result[0].ts).toBe('2025-01')
    expect(result[2].gri).toBe(70)
  })

  it('ts 오름차순으로 정렬한다', () => {
    const unsorted: GriPoint[] = [
      { ts: '2025-03', gri: 70 },
      { ts: '2025-01', gri: 60 },
      { ts: '2025-02', gri: 65 },
    ]
    const result = buildGriSeries(unsorted)
    expect(result[0].ts).toBe('2025-01')
    expect(result[1].ts).toBe('2025-02')
    expect(result[2].ts).toBe('2025-03')
  })

  it('빈 배열이면 빈 배열을 반환한다', () => {
    expect(buildGriSeries([])).toHaveLength(0)
  })

  it('원본 배열을 변경하지 않는다 (불변성)', () => {
    const original = [
      { ts: '2025-03', gri: 70 },
      { ts: '2025-01', gri: 60 },
    ]
    const copy = [...original]
    buildGriSeries(original)
    expect(original).toEqual(copy)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인 (RED)**

```bash
cd frontend && npx vitest run src/hooks/useGriHistory.test.ts
```

Expected: `FAIL — Cannot find module './useGriHistory'`

- [ ] **Step 3: useGriHistory.ts 구현**

`frontend/src/hooks/useGriHistory.ts`:

```ts
import { useState, useEffect } from 'react'

export interface GriPoint {
  ts: string   // "YYYY-MM"
  gri: number
}

export interface UseGriHistoryReturn {
  series: GriPoint[]
  isLoading: boolean
  error: string | null
}

export function buildGriSeries(raw: GriPoint[]): GriPoint[] {
  return [...raw].sort((a, b) => a.ts.localeCompare(b.ts))
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

async function fetchGriHistory(nodeId: string): Promise<GriPoint[]> {
  if (BASE_URL) {
    try {
      const res = await fetch(`${BASE_URL}/api/gri/history?nodeId=${encodeURIComponent(nodeId)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<GriPoint[]>
    } catch {
      // API 실패 → mock 폴백
    }
  }

  const mockRes = await fetch('/data/mock_gri_history.json')
  if (!mockRes.ok) throw new Error('mock GRI 데이터를 불러오지 못했습니다')
  const all = await mockRes.json() as Record<string, GriPoint[]>
  return all[nodeId] ?? all['__default__'] ?? []
}

export function useGriHistory(nodeId: string | null): UseGriHistoryReturn {
  const [series, setSeries] = useState<GriPoint[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!nodeId) {
      setSeries([])
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    fetchGriHistory(nodeId)
      .then((raw) => {
        setSeries(buildGriSeries(raw))
        setIsLoading(false)
      })
      .catch(() => {
        setError('GRI 데이터를 불러오지 못했습니다')
        setIsLoading(false)
      })
  }, [nodeId])

  return { series, isLoading, error }
}
```

- [ ] **Step 4: 테스트 통과 확인 (GREEN)**

```bash
cd frontend && npx vitest run src/hooks/useGriHistory.test.ts
```

Expected: `PASS — 4 tests passed`

- [ ] **Step 5: 커밋**

```bash
git add frontend/public/data/mock_gri_history.json \
        frontend/src/hooks/useGriHistory.ts \
        frontend/src/hooks/useGriHistory.test.ts
git commit -m "feat: GRI 시계열 훅 + mock 데이터 추가"
```

---

## Task 3: TrendChart 컴포넌트 (D3 SVG)

**Files:**
- Create: `frontend/src/components/TrendChart.tsx`

> D3는 DOM을 직접 조작하므로 `useRef` + `useEffect` 패턴을 사용한다. React state를 D3와 혼용하지 않는다.

- [ ] **Step 1: TrendChart.tsx 구현**

`frontend/src/components/TrendChart.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { GriPoint } from '../hooks/useGriHistory'

interface TrendChartProps {
  series: GriPoint[]
  width?: number
  height?: number
}

const MARGIN = { top: 8, right: 8, bottom: 24, left: 28 }

export default function TrendChart({ series, width = 240, height = 110 }: TrendChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || series.length === 0) return

    const innerW = width - MARGIN.left - MARGIN.right
    const innerH = height - MARGIN.top - MARGIN.bottom

    d3.select(svg).selectAll('*').remove()

    const g = d3.select(svg)
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    const xScale = d3.scalePoint<string>()
      .domain(series.map(d => d.ts))
      .range([0, innerW])
      .padding(0.1)

    const yExtent = d3.extent(series, d => d.gri) as [number, number]
    const yPad = 5
    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - yPad, yExtent[1] + yPad])
      .range([innerH, 0])

    // 그리드 라인
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3.axisLeft(yScale)
          .ticks(3)
          .tickSize(-innerW)
          .tickFormat(() => '')
      )
      .call(sel => sel.select('.domain').remove())
      .call(sel => sel.selectAll('line').attr('stroke', '#37474F').attr('stroke-dasharray', '3,3'))

    // X축 (마지막 3개 ts만 표시)
    const xTicks = series.length > 3 ? series.slice(-3).map(d => d.ts) : series.map(d => d.ts)
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3.axisBottom(xScale)
          .tickValues(xTicks)
          .tickSize(3)
      )
      .call(sel => sel.select('.domain').attr('stroke', '#546E7A'))
      .call(sel => sel.selectAll('text')
        .attr('fill', '#546E7A')
        .style('font-size', '9px')
      )
      .call(sel => sel.selectAll('line').attr('stroke', '#546E7A'))

    // Y축
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(3).tickSize(3))
      .call(sel => sel.select('.domain').attr('stroke', '#546E7A'))
      .call(sel => sel.selectAll('text').attr('fill', '#546E7A').style('font-size', '9px'))
      .call(sel => sel.selectAll('line').attr('stroke', '#546E7A'))

    // 라인
    const line = d3.line<GriPoint>()
      .x(d => xScale(d.ts) ?? 0)
      .y(d => yScale(d.gri))
      .curve(d3.curveCatmullRom)

    g.append('path')
      .datum(series)
      .attr('fill', 'none')
      .attr('stroke', '#43A047')
      .attr('stroke-width', 2)
      .attr('d', line)

    // 마지막 포인트 강조
    const last = series[series.length - 1]
    if (last) {
      g.append('circle')
        .attr('cx', xScale(last.ts) ?? 0)
        .attr('cy', yScale(last.gri))
        .attr('r', 4)
        .attr('fill', '#43A047')
        .attr('stroke', '#1A2332')
        .attr('stroke-width', 2)
    }
  }, [series, width, height])

  if (series.length === 0) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, color: '#546E7A' }}>데이터 없음</span>
      </div>
    )
  }

  return <svg ref={svgRef} width={width} height={height} />
}
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/components/TrendChart.tsx
git commit -m "feat: D3 GRI 추세 그래프 컴포넌트 추가"
```

---

## Task 4: CommerceDetailPanel 컴포넌트

**Files:**
- Create: `frontend/src/components/CommerceDetailPanel.tsx`

- [ ] **Step 1: CommerceDetailPanel.tsx 구현**

`frontend/src/components/CommerceDetailPanel.tsx`:

```tsx
import { COMMERCE_COLORS } from '../styles/tokens'
import type { CommerceNode } from '../types/commerce'
import { useGriHistory } from '../hooks/useGriHistory'
import TrendChart from './TrendChart'

interface CommerceDetailPanelProps {
  node: CommerceNode
  onClose: () => void
}

const TYPE_ICON: Record<string, string> = {
  흡수형_과열: '⚠',
  흡수형_성장: '↑',
  방출형_침체: '↓',
  고립형_단절: '✕',
  안정형:      '✓',
}

const S = {
  overlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: 360,
    height: '100%',
    background: '#1A2332',
    borderRight: '1px solid #263238',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    zIndex: 20,
    overflowY: 'auto' as const,
    padding: '16px 16px',
    boxSizing: 'border-box' as const,
    color: '#ECEFF1',
    fontFamily: 'system-ui, sans-serif',
    gap: 14,
    boxShadow: '4px 0 16px rgba(0,0,0,0.5)',
  },
  closeBtn: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    background: 'transparent',
    border: 'none',
    color: '#546E7A',
    fontSize: 20,
    cursor: 'pointer',
    lineHeight: 1,
    padding: 4,
  },
  typeBadge: (fill: string) => ({
    display: 'inline-flex' as const,
    alignItems: 'center',
    gap: 4,
    background: fill + '33',
    border: `1px solid ${fill}`,
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 12,
    color: fill,
    fontWeight: 600,
  }),
  sectionTitle: {
    fontSize: 11,
    color: '#546E7A',
    fontWeight: 600,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  kpiGrid: {
    display: 'grid' as const,
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  kpiCard: {
    background: '#263238',
    borderRadius: 8,
    padding: '10px 12px',
  },
  kpiLabel: { fontSize: 11, color: '#546E7A', marginBottom: 3 },
  kpiValue: (color?: string): React.CSSProperties => ({
    fontSize: 20,
    fontWeight: 700,
    color: color ?? '#ECEFF1',
  }),
  sourceLabel: {
    fontSize: 10,
    color: '#37474F',
    marginTop: 2,
  },
  chartBox: {
    background: '#263238',
    borderRadius: 8,
    padding: '10px 12px',
  },
  errorText: { fontSize: 12, color: '#EF5350' },
  loadingText: { fontSize: 12, color: '#546E7A' },
}

function netFlowColor(v: number): string {
  return v >= 0 ? '#43A047' : '#EF5350'
}

export default function CommerceDetailPanel({ node, onClose }: CommerceDetailPanelProps) {
  const { series, isLoading, error } = useGriHistory(node.id)
  const colorToken = COMMERCE_COLORS[node.type]
  const icon = TYPE_ICON[node.type] ?? '●'

  return (
    <div style={S.overlay}>
      <button style={S.closeBtn} onClick={onClose} aria-label="패널 닫기">✕</button>

      {/* 헤더 */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, paddingRight: 28 }}>
          {node.name}
        </div>
        <span style={S.typeBadge(colorToken.fill)}>
          <span aria-hidden="true">{icon}</span>
          {node.type}
        </span>
      </div>

      {/* KPI 카드 */}
      <div>
        <div style={S.sectionTitle}>주요 지표</div>
        <div style={S.kpiGrid}>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>GRI 점수</div>
            <div style={S.kpiValue()}>{node.griScore}</div>
            <div style={S.sourceLabel}>출처: 서울시 공공데이터포털</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>순유입</div>
            <div style={S.kpiValue(netFlowColor(node.netFlow))}>
              {node.netFlow >= 0 ? '+' : ''}{node.netFlow}
            </div>
            <div style={S.sourceLabel}>출처: 생활이동 데이터</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>중심성</div>
            <div style={S.kpiValue()}>{(node.degreeCentrality * 100).toFixed(0)}%</div>
            <div style={S.sourceLabel}>출처: OD 흐름 분석</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>상권 등급</div>
            <div style={{ ...S.kpiValue(colorToken.fill), fontSize: 15 }}>{node.type.split('_')[0]}</div>
            <div style={S.sourceLabel}>규칙 기반 | AI 미사용</div>
          </div>
        </div>
      </div>

      {/* GRI 추세 그래프 */}
      <div style={S.chartBox}>
        <div style={S.sectionTitle}>GRI 12개월 추세</div>
        {isLoading && <div style={S.loadingText}>불러오는 중...</div>}
        {error && <div style={S.errorText}>{error}</div>}
        {!isLoading && !error && <TrendChart series={series} width={296} height={110} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/components/CommerceDetailPanel.tsx
git commit -m "feat: 상권 상세 패널 컴포넌트 추가"
```

---

## Task 5: CommerceNodeLayer — onClick 파라미터 추가

**Files:**
- Modify: `frontend/src/layers/CommerceNodeLayer.ts`

현재 signature: `createCommerceNodeLayer(nodes, onHover)` → `createCommerceNodeLayer(nodes, onHover, onClick)` 로 변경

- [ ] **Step 1: CommerceNodeLayer.ts 수정**

`createCommerceNodeLayer` 함수 signature 및 `ScatterplotLayer` 생성 부분 변경:

```ts
// 변경 전
export function createCommerceNodeLayer(
  nodes: CommerceNode[],
  onHover: (info: PickingInfo<CommerceNode>) => void,
): ScatterplotLayer<CommerceNode>

// 변경 후
export function createCommerceNodeLayer(
  nodes: CommerceNode[],
  onHover: (info: PickingInfo<CommerceNode>) => void,
  onClick?: (info: PickingInfo<CommerceNode>) => void,
): ScatterplotLayer<CommerceNode>
```

`ScatterplotLayer` 설정 객체에 `onClick` 추가:

```ts
return new ScatterplotLayer<CommerceNode>({
  // ...기존 props...
  onHover,
  onClick,           // ← 추가
  updateTriggers: { ... },
})
```

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/layers/CommerceNodeLayer.ts
git commit -m "feat: CommerceNodeLayer onClick 파라미터 추가"
```

---

## Task 6: Map.tsx — onNodeClick prop 연결

**Files:**
- Modify: `frontend/src/components/Map.tsx`

- [ ] **Step 1: MapProps에 onNodeClick 추가 및 레이어에 연결**

`MapProps` 인터페이스에 추가:
```ts
onNodeClick?: (node: CommerceNode) => void
```

`Map` 컴포넌트 함수 파라미터에 추가:
```ts
export default function Map({
  // ...기존...
  onNodeClick,
}: MapProps)
```

`handleFrame` 콜백 내 `createCommerceNodeLayer` 호출 부분에 세 번째 인수 추가:
```ts
createCommerceNodeLayer(nodes, (info: PickingInfo<CommerceNode>) => {
  if (info.object) {
    setHoveredNode({ node: info.object, x: info.x, y: info.y })
  } else {
    setHoveredNode(null)
  }
}, (info: PickingInfo<CommerceNode>) => {   // ← onClick 추가
  if (info.object) {
    onNodeClick?.(info.object)
  }
}),
```

`useCallback` deps 배열에 `onNodeClick` 추가:
```ts
}, [flows, nodes, onNodeClick])
```

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/Map.tsx
git commit -m "feat: Map 노드 클릭 이벤트 콜백 연결"
```

---

## Task 7: App.tsx — selectedNode state + 패널 렌더링

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: App.tsx 수정**

```tsx
import { useState } from 'react'
import Map from './components/Map'
import FlowControlPanel from './components/FlowControlPanel'
import CommerceDetailPanel from './components/CommerceDetailPanel'
import { useCommerceData } from './hooks/useCommerceData'
import { useFlowData, type FlowPurpose } from './hooks/useFlowData'
import type { CommerceNode } from './types/commerce'
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

  const topN = STRENGTH_TO_TOP_N[flowStrength] ?? 15
  const { nodes, usingMockData } = useCommerceData()
  const flowData = useFlowData({ purpose: purpose ?? undefined, topN })

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 상세 패널 (클릭 시 지도 위 오버레이) */}
      {selectedNode && (
        <CommerceDetailPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}

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
      />
    </div>
  )
}
```

- [ ] **Step 2: TypeScript 컴파일 + 전체 테스트 확인**

```bash
cd frontend && npx tsc --noEmit && npx vitest run
```

Expected:
```
Type check: 0 errors
Tests: X passed
```

- [ ] **Step 3: 최종 커밋**

```bash
git add frontend/src/App.tsx
git commit -m "feat: 상권 노드 클릭 → 상세 패널 연동 완료"
```

---

## 완료 기준 체크리스트

- [ ] `npx vitest run` → 기존 테스트 포함 모두 PASS
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] dev server에서 상권 노드 클릭 시 상세 패널 열림
- [ ] GRI 추세 그래프 (D3 SVG) 렌더링 확인
- [ ] 패널 닫기(✕) 버튼 동작 확인
- [ ] 색각 이상 대응: 유형 뱃지에 아이콘 + 색상 모두 표시 확인

## Self-Review: Spec Coverage

| 요구사항 | 담당 Task |
|----------|-----------|
| 상권 클릭 이벤트 | Task 5, 6, 7 |
| GRI 시계열 fetch + mock 폴백 | Task 2 |
| D3 추세 그래프 | Task 3 |
| 폐업률·순유입·중심성 KPI | Task 4 |
| 색각 대응 (FR-11) 아이콘 병행 | Task 4 |
| 데이터 출처 아이콘 (FR-06) | Task 4 |
| "규칙 기반 \| AI 미사용" 라벨 (FR-07) | Task 4 |
| 패널 닫기 | Task 4, 7 |
| 불변성 (coding-style) | Task 2 (buildGriSeries) |
