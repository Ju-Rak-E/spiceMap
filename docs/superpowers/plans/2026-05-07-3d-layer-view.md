# 3D 레이어 뷰 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지도 우하단 플로팅 컨트롤로 상권 경계 폴리곤 / 노드 기둥 3D 돌출을 ON/OFF 전환하고, 높이 기준 지표를 선택할 수 있게 한다.

**Architecture:** `use3DView` 훅이 모드·지표 상태와 mapRef를 통한 카메라 전환을 담당한다. `ThreeDViewControl`은 순수 UI 컴포넌트로 상태를 props로 받는다. 두 Deck.gl 레이어(`PolygonExtrusionLayer`, `CommerceColumnLayer`)는 노드 배열과 지표를 받아 레이어를 생성한다. `Map.tsx`가 이들을 연결한다.

**Tech Stack:** React + TypeScript, Deck.gl (`@deck.gl/layers` PolygonLayer / ColumnLayer), MapLibre GL (`map.flyTo`), Vitest + @testing-library/react

---

## 파일 구조

| 파일 | 역할 | 담당 |
|------|------|------|
| `src/utils/threeDUtils.ts` (신규) | 정규화·지표값 공통 유틸 | Claude |
| `src/hooks/use3DView.ts` (신규) | 모드·지표 상태 + 카메라 flyTo + 경계 로드 | Claude |
| `src/components/ThreeDViewControl.tsx` (신규) | 플로팅 UI — OFF/폴리곤/기둥 + 지표 드롭다운 | Claude |
| `src/layers/PolygonExtrusionLayer.ts` (신규) | 상권 경계 Deck.gl PolygonLayer extruded | Codex |
| `src/layers/CommerceColumnLayer.ts` (신규) | 상권 노드 Deck.gl ColumnLayer | Codex |
| `src/components/Map.tsx` (수정) | 훅·컨트롤·레이어 연결 | Claude |

---

## Task 1: 공통 유틸 `threeDUtils.ts`

**Files:**
- Create: `frontend/src/utils/threeDUtils.ts`
- Test: `frontend/src/utils/threeDUtils.test.ts`

- [ ] **Step 1: 테스트 작성**

```ts
// frontend/src/utils/threeDUtils.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeElevation, getMetricValue } from './threeDUtils'
import type { CommerceNode } from '../types/commerce'

const baseNode: CommerceNode = {
  id: 'test',
  name: '테스트 상권',
  coordinates: [127.0, 37.5],
  type: '안정형',
  district: '강남구',
  netFlow: 100,
  degreeCentrality: 0.5,
  griScore: 60,
  closeRate: 5,
}

describe('normalizeElevation', () => {
  it('0~maxHeight 범위로 정규화한다', () => {
    expect(normalizeElevation(50, 0, 100, 500)).toBe(250)
  })
  it('min === max 이면 maxHeight * 0.5 반환', () => {
    expect(normalizeElevation(50, 50, 50, 500)).toBe(250)
  })
  it('음수 결과는 0으로 클램프', () => {
    expect(normalizeElevation(-10, 0, 100, 500)).toBe(0)
  })
})

describe('getMetricValue', () => {
  it('griScore 반환', () => {
    expect(getMetricValue(baseNode, 'griScore')).toBe(60)
  })
  it('netFlow 반환', () => {
    expect(getMetricValue(baseNode, 'netFlow')).toBe(100)
  })
  it('closeRate 반환 (undefined → 0)', () => {
    expect(getMetricValue({ ...baseNode, closeRate: undefined }, 'closeRate')).toBe(0)
  })
  it('degreeCentrality 반환', () => {
    expect(getMetricValue(baseNode, 'degreeCentrality')).toBe(0.5)
  })
})
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
cd frontend && npx vitest run src/utils/threeDUtils.test.ts
```
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

```ts
// frontend/src/utils/threeDUtils.ts
import type { CommerceNode } from '../types/commerce'

export type HeightMetric = 'griScore' | 'netFlow' | 'closeRate' | 'degreeCentrality'

export function normalizeElevation(
  value: number,
  min: number,
  max: number,
  maxHeight: number,
): number {
  if (max === min) return maxHeight * 0.5
  return Math.max(0, ((value - min) / (max - min)) * maxHeight)
}

export function getMetricValue(node: CommerceNode, metric: HeightMetric): number {
  switch (metric) {
    case 'griScore': return node.griScore
    case 'netFlow': return node.netFlow
    case 'closeRate': return node.closeRate ?? 0
    case 'degreeCentrality': return node.degreeCentrality
  }
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
cd frontend && npx vitest run src/utils/threeDUtils.test.ts
```
Expected: 7 tests passed

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/utils/threeDUtils.ts frontend/src/utils/threeDUtils.test.ts
git commit -m "feat: add threeDUtils (normalizeElevation, getMetricValue)"
```

---

## Task 2: `use3DView.ts` 훅

**Files:**
- Create: `frontend/src/hooks/use3DView.ts`
- Test: `frontend/src/hooks/use3DView.test.ts`

- [ ] **Step 1: 테스트 작성**

```ts
// frontend/src/hooks/use3DView.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { use3DView } from './use3DView'
import type { MutableRefObject } from 'react'
import type maplibregl from 'maplibre-gl'

const mockFlyTo = vi.fn()
const mockMap = { flyTo: mockFlyTo } as unknown as maplibregl.Map
const mapRef: MutableRefObject<maplibregl.Map | null> = { current: mockMap }

beforeEach(() => {
  mockFlyTo.mockClear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ features: [] }),
  }))
})

describe('use3DView', () => {
  it('초기 상태: mode=off, metric=griScore', () => {
    const { result } = renderHook(() => use3DView(mapRef))
    expect(result.current.mode).toBe('off')
    expect(result.current.metric).toBe('griScore')
  })

  it('polygon으로 setMode → flyTo pitch 45 호출', () => {
    const { result } = renderHook(() => use3DView(mapRef))
    act(() => { result.current.setMode('polygon') })
    expect(result.current.mode).toBe('polygon')
    expect(mockFlyTo).toHaveBeenCalledWith({ pitch: 45, duration: 800 })
  })

  it('off로 setMode → flyTo pitch 0 호출', () => {
    const { result } = renderHook(() => use3DView(mapRef))
    act(() => { result.current.setMode('polygon') })
    act(() => { result.current.setMode('off') })
    expect(mockFlyTo).toHaveBeenLastCalledWith({ pitch: 0, bearing: 0, duration: 600 })
  })

  it('polygon → column 전환 시 flyTo pitch 45 재호출', () => {
    const { result } = renderHook(() => use3DView(mapRef))
    act(() => { result.current.setMode('polygon') })
    act(() => { result.current.setMode('column') })
    expect(mockFlyTo).toHaveBeenLastCalledWith({ pitch: 45, duration: 800 })
  })

  it('setMetric → metric 상태 변경', () => {
    const { result } = renderHook(() => use3DView(mapRef))
    act(() => { result.current.setMetric('netFlow') })
    expect(result.current.metric).toBe('netFlow')
  })
})
```

- [ ] **Step 2: 테스트 FAIL 확인**

```bash
cd frontend && npx vitest run src/hooks/use3DView.test.ts
```
Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// frontend/src/hooks/use3DView.ts
import { useState, useEffect, useCallback, type MutableRefObject } from 'react'
import type maplibregl from 'maplibre-gl'
import type { HeightMetric } from '../utils/threeDUtils'

export type { HeightMetric }
export type ThreeDMode = 'off' | 'polygon' | 'column'

export interface BoundaryFeature {
  comm_id: string
  polygon: number[][]
}

export interface Use3DViewReturn {
  mode: ThreeDMode
  metric: HeightMetric
  setMode: (m: ThreeDMode) => void
  setMetric: (m: HeightMetric) => void
  boundaries: BoundaryFeature[] | null
}

export function use3DView(
  mapRef: MutableRefObject<maplibregl.Map | null>,
): Use3DViewReturn {
  const [mode, setModeState] = useState<ThreeDMode>('off')
  const [metric, setMetric] = useState<HeightMetric>('griScore')
  const [boundaries, setBoundaries] = useState<BoundaryFeature[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/data/mock_commerce_boundary.geojson')
      .then((r) => r.json())
      .then((geojson: { features: Array<{ properties: { comm_id: string }; geometry: { type: string; coordinates: number[][][][] } }> }) => {
        if (cancelled) return
        const parsed: BoundaryFeature[] = geojson.features.map((f) => ({
          comm_id: f.properties.comm_id,
          polygon:
            f.geometry.type === 'Polygon'
              ? (f.geometry.coordinates as number[][][])[0]
              : (f.geometry.coordinates as number[][][][])[0][0],
        }))
        setBoundaries(parsed)
      })
      .catch(() => { if (!cancelled) setBoundaries([]) })
    return () => { cancelled = true }
  }, [])

  const setMode = useCallback(
    (newMode: ThreeDMode) => {
      setModeState(newMode)
      const map = mapRef.current
      if (!map) return
      if (newMode !== 'off') {
        map.flyTo({ pitch: 45, duration: 800 })
      } else {
        map.flyTo({ pitch: 0, bearing: 0, duration: 600 })
      }
    },
    [mapRef],
  )

  return { mode, metric, setMode, setMetric, boundaries }
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
cd frontend && npx vitest run src/hooks/use3DView.test.ts
```
Expected: 5 tests passed

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/hooks/use3DView.ts frontend/src/hooks/use3DView.test.ts
git commit -m "feat: add use3DView hook (mode state + camera flyTo + boundary loading)"
```

---

## Task 3: `ThreeDViewControl.tsx` 컴포넌트

**Files:**
- Create: `frontend/src/components/ThreeDViewControl.tsx`
- Test: `frontend/src/components/ThreeDViewControl.test.tsx`

- [ ] **Step 1: 테스트 작성**

```tsx
// frontend/src/components/ThreeDViewControl.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ThreeDViewControl from './ThreeDViewControl'

describe('ThreeDViewControl', () => {
  const defaultProps = {
    mode: 'off' as const,
    metric: 'griScore' as const,
    onModeChange: vi.fn(),
    onMetricChange: vi.fn(),
  }

  it('OFF/폴리곤/기둥 버튼 렌더링', () => {
    render(<ThreeDViewControl {...defaultProps} />)
    expect(screen.getByText('OFF')).toBeTruthy()
    expect(screen.getByText('폴리곤')).toBeTruthy()
    expect(screen.getByText('기둥')).toBeTruthy()
  })

  it('mode=off 시 지표 드롭다운 미표시', () => {
    render(<ThreeDViewControl {...defaultProps} />)
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('폴리곤 버튼 클릭 → onModeChange("polygon") 호출', () => {
    const onModeChange = vi.fn()
    render(<ThreeDViewControl {...defaultProps} onModeChange={onModeChange} />)
    fireEvent.click(screen.getByText('폴리곤'))
    expect(onModeChange).toHaveBeenCalledWith('polygon')
  })

  it('mode=polygon 시 지표 드롭다운 표시', () => {
    render(<ThreeDViewControl {...defaultProps} mode="polygon" />)
    expect(screen.getByRole('combobox')).toBeTruthy()
  })

  it('지표 변경 → onMetricChange 호출', () => {
    const onMetricChange = vi.fn()
    render(<ThreeDViewControl {...defaultProps} mode="polygon" onMetricChange={onMetricChange} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'netFlow' } })
    expect(onMetricChange).toHaveBeenCalledWith('netFlow')
  })
})
```

- [ ] **Step 2: 테스트 FAIL 확인**

```bash
cd frontend && npx vitest run src/components/ThreeDViewControl.test.tsx
```
Expected: FAIL

- [ ] **Step 3: 구현**

```tsx
// frontend/src/components/ThreeDViewControl.tsx
import type { ThreeDMode, HeightMetric } from '../hooks/use3DView'

const METRIC_OPTIONS: Array<{ value: HeightMetric; label: string }> = [
  { value: 'griScore', label: '상권 위험도 (GRI)' },
  { value: 'netFlow', label: '순유입 인구' },
  { value: 'closeRate', label: '폐업률' },
  { value: 'degreeCentrality', label: '연결 중심성' },
]

const MODE_LABELS: Record<ThreeDMode, string> = {
  off: 'OFF',
  polygon: '폴리곤',
  column: '기둥',
}

interface ThreeDViewControlProps {
  mode: ThreeDMode
  metric: HeightMetric
  onModeChange: (m: ThreeDMode) => void
  onMetricChange: (m: HeightMetric) => void
}

export default function ThreeDViewControl({
  mode,
  metric,
  onModeChange,
  onMetricChange,
}: ThreeDViewControlProps) {
  const isActive = mode !== 'off'

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        zIndex: 15,
        background: 'rgba(16,22,29,0.95)',
        border: `1px solid ${isActive ? '#43A047' : '#304251'}`,
        borderRadius: 10,
        padding: '10px 12px',
        minWidth: 158,
        boxShadow: isActive ? '0 0 12px rgba(67,160,71,0.2)' : 'none',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: isActive ? '#7BD08D' : '#78909C',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        3D 뷰{isActive ? ' — 활성' : ''}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: isActive ? 8 : 0 }}>
        {(['off', 'polygon', 'column'] as ThreeDMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            aria-pressed={mode === m}
            style={{
              flex: 1,
              padding: '5px 0',
              borderRadius: 6,
              border: mode === m
                ? `1.5px solid ${m === 'off' ? '#546E7A' : '#43A047'}`
                : '1px solid #304251',
              background: mode === m
                ? m === 'off' ? '#263238' : 'rgba(67,160,71,0.2)'
                : '#1A2530',
              color: mode === m
                ? m === 'off' ? '#90A4AE' : '#7BD08D'
                : '#546E7A',
              fontSize: 11,
              fontWeight: mode === m ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
      {isActive && (
        <select
          value={metric}
          onChange={(e) => onMetricChange(e.target.value as HeightMetric)}
          aria-label="높이 기준 지표 선택"
          style={{
            width: '100%',
            background: '#1A2530',
            border: '1px solid #304251',
            borderRadius: 6,
            padding: '5px 8px',
            fontSize: 11,
            color: '#ECEFF1',
            cursor: 'pointer',
            boxSizing: 'border-box',
          }}
        >
          {METRIC_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
cd frontend && npx vitest run src/components/ThreeDViewControl.test.tsx
```
Expected: 5 tests passed

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/ThreeDViewControl.tsx frontend/src/components/ThreeDViewControl.test.tsx
git commit -m "feat: add ThreeDViewControl floating panel (OFF/polygon/column + metric select)"
```

---

## Task 4: `PolygonExtrusionLayer.ts` — **Codex 담당**

**Files:**
- Create: `frontend/src/layers/PolygonExtrusionLayer.ts`
- Test: `frontend/src/layers/PolygonExtrusionLayer.test.ts`

- [ ] **Step 1: 테스트 작성**

```ts
// frontend/src/layers/PolygonExtrusionLayer.test.ts
import { describe, it, expect } from 'vitest'
import { buildPolygonExtrusionData } from './PolygonExtrusionLayer'
import type { CommerceNode } from '../types/commerce'
import type { BoundaryFeature } from '../hooks/use3DView'

const nodes: CommerceNode[] = [
  { id: 'gc_001', name: '강남역', coordinates: [127.02, 37.49], type: '흡수형_과열', district: '강남구', netFlow: 200, degreeCentrality: 0.8, griScore: 80, closeRate: 10 },
  { id: 'gc_002', name: '역삼동', coordinates: [127.03, 37.50], type: '안정형', district: '강남구', netFlow: 50, degreeCentrality: 0.3, griScore: 30, closeRate: 2 },
]

const boundaries: BoundaryFeature[] = [
  { comm_id: 'gc_001', polygon: [[127.02, 37.49], [127.03, 37.49], [127.03, 37.50], [127.02, 37.50]] },
  { comm_id: 'gc_002', polygon: [[127.03, 37.50], [127.04, 37.50], [127.04, 37.51], [127.03, 37.51]] },
  { comm_id: 'gc_999', polygon: [[127.05, 37.51], [127.06, 37.51], [127.06, 37.52], [127.05, 37.52]] }, // 매핑 없는 경계
]

describe('buildPolygonExtrusionData', () => {
  it('nodes와 boundaries를 comm_id로 조인한다', () => {
    const data = buildPolygonExtrusionData(nodes, boundaries, 'griScore')
    expect(data).toHaveLength(2) // gc_999 제외
  })

  it('griScore 기준: 높은 GRI → 높은 elevation', () => {
    const data = buildPolygonExtrusionData(nodes, boundaries, 'griScore')
    const high = data.find(d => d.id === 'gc_001')!
    const low = data.find(d => d.id === 'gc_002')!
    expect(high.elevation).toBeGreaterThan(low.elevation)
  })

  it('elevation은 0~500 범위', () => {
    const data = buildPolygonExtrusionData(nodes, boundaries, 'griScore')
    for (const d of data) {
      expect(d.elevation).toBeGreaterThanOrEqual(0)
      expect(d.elevation).toBeLessThanOrEqual(500)
    }
  })

  it('노드 없는 boundary는 결과에서 제외', () => {
    const data = buildPolygonExtrusionData(nodes, boundaries, 'griScore')
    expect(data.map(d => d.id)).not.toContain('gc_999')
  })
})
```

- [ ] **Step 2: 테스트 FAIL 확인**

```bash
cd frontend && npx vitest run src/layers/PolygonExtrusionLayer.test.ts
```

- [ ] **Step 3: 구현**

```ts
// frontend/src/layers/PolygonExtrusionLayer.ts
import { PolygonLayer } from '@deck.gl/layers'
import type { CommerceNode } from '../types/commerce'
import type { BoundaryFeature, HeightMetric } from '../hooks/use3DView'
import { hexToRgba } from '../utils/colorUtils'
import { COMMERCE_COLORS } from '../styles/tokens'
import { getMetricValue, normalizeElevation } from '../utils/threeDUtils'

const MAX_ELEVATION = 500

interface PolygonDatum {
  id: string
  polygon: number[][]
  elevation: number
  color: [number, number, number, number]
}

export function buildPolygonExtrusionData(
  nodes: CommerceNode[],
  boundaries: BoundaryFeature[],
  metric: HeightMetric,
): PolygonDatum[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const values = nodes.map((n) => getMetricValue(n, metric))
  const min = Math.min(...values)
  const max = Math.max(...values)

  const data: PolygonDatum[] = []
  for (const boundary of boundaries) {
    const node = nodeMap.get(boundary.comm_id)
    if (!node) continue
    const value = getMetricValue(node, metric)
    data.push({
      id: node.id,
      polygon: boundary.polygon,
      elevation: normalizeElevation(value, min, max, MAX_ELEVATION),
      color: hexToRgba(COMMERCE_COLORS[node.type].fill, 200),
    })
  }
  return data
}

export function createPolygonExtrusionLayer(
  nodes: CommerceNode[],
  boundaries: BoundaryFeature[],
  metric: HeightMetric,
): PolygonLayer<PolygonDatum> {
  const data = buildPolygonExtrusionData(nodes, boundaries, metric)
  return new PolygonLayer<PolygonDatum>({
    id: 'commerce-polygon-extrusion',
    data,
    extruded: true,
    getPolygon: (d) => d.polygon,
    getElevation: (d) => d.elevation,
    getFillColor: (d) => d.color,
    getLineColor: [255, 255, 255, 30],
    lineWidthMinPixels: 1,
    pickable: false,
    updateTriggers: {
      getElevation: [metric, nodes.length],
      getFillColor: [nodes.length],
    },
  })
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
cd frontend && npx vitest run src/layers/PolygonExtrusionLayer.test.ts
```
Expected: 4 tests passed

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/layers/PolygonExtrusionLayer.ts frontend/src/layers/PolygonExtrusionLayer.test.ts
git commit -m "feat: add PolygonExtrusionLayer (Deck.gl extruded polygon, GRI/metric height)"
```

---

## Task 5: `CommerceColumnLayer.ts` — **Codex 담당**

**Files:**
- Create: `frontend/src/layers/CommerceColumnLayer.ts`
- Test: `frontend/src/layers/CommerceColumnLayer.test.ts`

- [ ] **Step 1: 테스트 작성**

```ts
// frontend/src/layers/CommerceColumnLayer.test.ts
import { describe, it, expect } from 'vitest'
import { createCommerceColumnLayer } from './CommerceColumnLayer'
import type { CommerceNode } from '../types/commerce'

const nodes: CommerceNode[] = [
  { id: 'gc_001', name: '강남역', coordinates: [127.02, 37.49], type: '흡수형_과열', district: '강남구', netFlow: 200, degreeCentrality: 0.8, griScore: 80 },
  { id: 'gc_002', name: '역삼동', coordinates: [127.03, 37.50], type: '안정형', district: '강남구', netFlow: 50, degreeCentrality: 0.3, griScore: 30 },
]

describe('createCommerceColumnLayer', () => {
  it('레이어 id가 "commerce-column"', () => {
    const layer = createCommerceColumnLayer(nodes, 'griScore')
    expect(layer.id).toBe('commerce-column')
  })

  it('빈 nodes 배열에서도 에러 없이 생성', () => {
    expect(() => createCommerceColumnLayer([], 'griScore')).not.toThrow()
  })

  it('metric 변경 시 다른 레이어 생성 (updateTriggers 다름)', () => {
    const l1 = createCommerceColumnLayer(nodes, 'griScore')
    const l2 = createCommerceColumnLayer(nodes, 'netFlow')
    expect(l1.props.updateTriggers).not.toEqual(l2.props.updateTriggers)
  })
})
```

- [ ] **Step 2: 테스트 FAIL 확인**

```bash
cd frontend && npx vitest run src/layers/CommerceColumnLayer.test.ts
```

- [ ] **Step 3: 구현**

```ts
// frontend/src/layers/CommerceColumnLayer.ts
import { ColumnLayer } from '@deck.gl/layers'
import type { CommerceNode } from '../types/commerce'
import type { HeightMetric } from '../hooks/use3DView'
import { hexToRgba } from '../utils/colorUtils'
import { COMMERCE_COLORS } from '../styles/tokens'
import { getMetricValue, normalizeElevation } from '../utils/threeDUtils'

const MAX_ELEVATION = 400
const COLUMN_RADIUS = 80
const DISK_RESOLUTION = 6

export function createCommerceColumnLayer(
  nodes: CommerceNode[],
  metric: HeightMetric,
): ColumnLayer<CommerceNode> {
  const values = nodes.map((n) => getMetricValue(n, metric))
  const min = nodes.length > 0 ? Math.min(...values) : 0
  const max = nodes.length > 0 ? Math.max(...values) : 0

  return new ColumnLayer<CommerceNode>({
    id: 'commerce-column',
    data: nodes,
    diskResolution: DISK_RESOLUTION,
    radius: COLUMN_RADIUS,
    extruded: true,
    getPosition: (n) => [n.coordinates[0], n.coordinates[1], 0],
    getElevation: (n) => normalizeElevation(getMetricValue(n, metric), min, max, MAX_ELEVATION),
    getFillColor: (n) => hexToRgba(COMMERCE_COLORS[n.type].fill, 220),
    getLineColor: [0, 0, 0, 0],
    pickable: false,
    updateTriggers: {
      getElevation: [metric, nodes.length],
      getFillColor: [nodes.length],
    },
  })
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
cd frontend && npx vitest run src/layers/CommerceColumnLayer.test.ts
```
Expected: 3 tests passed

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/layers/CommerceColumnLayer.ts frontend/src/layers/CommerceColumnLayer.test.ts
git commit -m "feat: add CommerceColumnLayer (Deck.gl ColumnLayer, metric height)"
```

---

## Task 6: `Map.tsx` 통합

**Files:**
- Modify: `frontend/src/components/Map.tsx`

Map.tsx는 300줄 이상의 파일이므로 수술적으로 3개 지점만 수정한다.

- [ ] **Step 1: import 추가** — Map.tsx 상단 import 블록에 추가

```ts
import { use3DView } from '../hooks/use3DView'
import ThreeDViewControl from './ThreeDViewControl'
import { createPolygonExtrusionLayer } from '../layers/PolygonExtrusionLayer'
import { createCommerceColumnLayer } from '../layers/CommerceColumnLayer'
```

- [ ] **Step 2: 훅 호출 추가** — `Map` 함수 내부, `const containerRef = useRef` 선언 바로 아래에 추가

```ts
const threeDView = use3DView(mapRef)
```

- [ ] **Step 3: 3D 레이어 useMemo 추가** — `commerceLayers` useMemo 바로 아래에 추가

```ts
const threeDLayers = useMemo(() => {
  if (threeDView.mode === 'off' || nodes.length === 0) return []
  if (threeDView.mode === 'polygon' && threeDView.boundaries && threeDView.boundaries.length > 0) {
    return [createPolygonExtrusionLayer(nodes, threeDView.boundaries, threeDView.metric)]
  }
  if (threeDView.mode === 'column') {
    return [createCommerceColumnLayer(nodes, threeDView.metric)]
  }
  return []
}, [threeDView.mode, threeDView.metric, threeDView.boundaries, nodes])
```

- [ ] **Step 4: `baseDeckLayers`에 `threeDLayers` 추가**

기존:
```ts
const baseDeckLayers = useMemo(
  () => [
    ...(staticFlowLayer ? [staticFlowLayer] : []),
    ...barrierLayers,
    ...commerceLayers,
  ],
  [barrierLayers, commerceLayers, staticFlowLayer],
)
```

변경:
```ts
const baseDeckLayers = useMemo(
  () => [
    ...(staticFlowLayer ? [staticFlowLayer] : []),
    ...barrierLayers,
    ...commerceLayers,
    ...threeDLayers,
  ],
  [barrierLayers, commerceLayers, staticFlowLayer, threeDLayers],
)
```

- [ ] **Step 5: JSX에 `ThreeDViewControl` 렌더링** — `return` 블록 최상단 `<div>` 안, `{detailPanelOpen && ...}` 바로 아래에 추가

```tsx
<ThreeDViewControl
  mode={threeDView.mode}
  metric={threeDView.metric}
  onModeChange={threeDView.setMode}
  onMetricChange={threeDView.setMetric}
/>
```

- [ ] **Step 6: 빌드 확인**

```bash
cd frontend && npm run build 2>&1 | tail -5
```
Expected: `✓ built in XX.XXs` (exit 0, 0 errors)

- [ ] **Step 7: 전체 테스트 회귀 확인**

```bash
cd frontend && npx vitest run 2>&1 | tail -5
```
Expected: 기존 323개 + 신규 19개 = 342개 이상 passed, 0 failed

- [ ] **Step 8: 커밋**

```bash
git add frontend/src/components/Map.tsx
git commit -m "feat: integrate 3D layer view into Map (ThreeDViewControl + polygon/column layers)"
```

---

## 완료 기준 체크리스트

- [ ] `npm run build` — exit 0, 0 errors
- [ ] vitest — 0 failed (신규 19개 포함)
- [ ] OFF → 폴리곤/기둥: 지도 pitch 45° 자동 전환
- [ ] OFF 복귀: pitch 0° 복귀
- [ ] 지표 변경 시 높이 즉시 반영
- [ ] 플로팅 컨트롤 우하단 위치, 기존 UI와 겹침 없음
