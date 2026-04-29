# 지도 인터랙션 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/map_interaction_plan.md`의 10개 항목을 우선순위 순서대로 구현해 지도 가독성·인터랙션 품질을 높인다.

**Architecture:** 레이어 팩토리 함수에 `selectedNodeId` / GRI 파라미터를 추가하고, 순수 헬퍼 함수를 분리해 Vitest로 검증한 뒤 Map.tsx 호출부를 교체한다. MapLibre 표현식으로 줌 연동 스타일을 적용하고, 해설바·범례의 UX 피드백을 보강한다.

**Tech Stack:** React + Vite · Deck.gl (`ScatterplotLayer`, `PathLayer`) · MapLibre GL JS · Vitest · TypeScript

---

## 파일 변경 맵

| 파일 | 변경 유형 | 담당 Task |
|---|---|---|
| `frontend/src/layers/ODFlowLayer.ts` | 수정 | 1 |
| `frontend/src/layers/FlowParticleLayer.ts` | 수정 | 1 |
| `frontend/src/layers/CommerceNodeLayer.ts` | 수정 | 2 |
| `frontend/src/components/Map.tsx` | 수정 | 1, 3, 6 |
| `frontend/src/utils/boundaryLayerConfig.ts` | 수정 | 4 |
| `frontend/src/utils/BoundaryLayerManager.ts` | 수정 | 4 |
| `frontend/src/utils/flowBezier.ts` | 수정 | 5 |
| `frontend/src/utils/summaryFormatter.ts` | 수정 | 7 |
| `frontend/src/components/CommerceLegend.tsx` | 수정 | 8 |
| `frontend/src/components/CommerceDetailPanel.tsx` | 수정 | 보완 |
| `frontend/src/utils/flowBezier.test.ts` | 신규 | 5 |
| `frontend/src/utils/summaryFormatter.test.ts` | 신규 | 7 |
| `frontend/src/layers/flowAlpha.test.ts` | 신규 | 1 |
| `frontend/src/layers/griNodeStyle.test.ts` | 신규 | 2 |

---

## Task 1: 상권 클릭 시 관련 흐름 강조

**Files:**
- Modify: `frontend/src/layers/ODFlowLayer.ts`
- Modify: `frontend/src/layers/FlowParticleLayer.ts`
- Modify: `frontend/src/components/Map.tsx:131`
- Create: `frontend/src/layers/flowAlpha.test.ts`

### 배경

현재 `createODFlowLayer(flows)` · `createFlowParticleLayer(flows, progress)` 모두 `selectedNodeId`를 받지 않아, 상권 클릭 후에도 전체 흐름이 동일 강도로 표시된다.

- [ ] **Step 1: 헬퍼 함수 파일 생성 — `flowAlpha.test.ts` (RED)**

```ts
// frontend/src/layers/flowAlpha.test.ts
import { describe, it, expect } from 'vitest'
import type { ODFlow } from '../hooks/useFlowData'

// 아직 없는 함수를 참조 → 빨간 테스트
import { getFlowAlpha, getFlowWidth } from './ODFlowLayer'

const makeFlow = (originCommCd: string, destCommCd: string): ODFlow => ({
  id: `${originCommCd}-${destCommCd}`,
  originCommCd,
  destCommCd,
  sourceCoord: [126.9, 37.5],
  targetCoord: [126.95, 37.52],
  volume: 5000,
  purpose: '출근',
})

describe('getFlowAlpha', () => {
  it('selectedId가 null이면 기본 알파 140을 반환한다', () => {
    expect(getFlowAlpha(makeFlow('A', 'B'), null)).toBe(140)
  })

  it('관련 흐름(origin 일치)은 알파 200을 반환한다', () => {
    expect(getFlowAlpha(makeFlow('SELECTED', 'B'), 'SELECTED')).toBe(200)
  })

  it('관련 흐름(dest 일치)은 알파 200을 반환한다', () => {
    expect(getFlowAlpha(makeFlow('A', 'SELECTED'), 'SELECTED')).toBe(200)
  })

  it('무관 흐름은 알파 20을 반환한다', () => {
    expect(getFlowAlpha(makeFlow('A', 'B'), 'SELECTED')).toBe(20)
  })
})

describe('getFlowWidth', () => {
  it('selectedId가 null이면 volume 비례 폭을 반환한다', () => {
    const base = getFlowWidth(5000, null, makeFlow('A', 'B'))
    expect(base).toBeGreaterThan(1.5)
    expect(base).toBeLessThan(8)
  })

  it('관련 흐름 폭은 기본값의 1.5배이다', () => {
    const base = getFlowWidth(5000, null, makeFlow('A', 'B'))
    const highlighted = getFlowWidth(5000, 'A', makeFlow('A', 'B'))
    expect(highlighted).toBeCloseTo(base * 1.5, 1)
  })
})
```

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

```bash
cd frontend && npm run test -- --reporter=verbose flowAlpha
```

Expected: `getFlowAlpha is not a function` 에러

- [ ] **Step 3: ODFlowLayer.ts 수정 — 헬퍼 함수 추출 + selectedNodeId 파라미터 추가**

```ts
// frontend/src/layers/ODFlowLayer.ts
import { PathLayer } from '@deck.gl/layers'
import type { ODFlow } from '../hooks/useFlowData'
import { getControlPoint, quadBezier, PURPOSE_COLORS } from '../utils/flowBezier'

const SEGMENTS = 32
const MIN_WIDTH = 1.5
const MAX_WIDTH = 8
const MAX_VOLUME = 10000

export function getFlowAlpha(flow: ODFlow, selectedId: string | null): number {
  if (selectedId === null) return 140
  if (flow.originCommCd === selectedId || flow.destCommCd === selectedId) return 200
  return 20
}

export function getFlowWidth(volume: number, selectedId: string | null, flow: ODFlow): number {
  const ratio = Math.min(volume / MAX_VOLUME, 1)
  const base = MIN_WIDTH + ratio * (MAX_WIDTH - MIN_WIDTH)
  if (selectedId !== null && (flow.originCommCd === selectedId || flow.destCommCd === selectedId)) {
    return Math.min(base * 1.5, MAX_WIDTH * 1.5)
  }
  return base
}

interface FlowPath {
  path: [number, number][]
  color: [number, number, number, number]
  width: number
}

function buildFlowPath(flow: ODFlow, selectedId: string | null): FlowPath {
  const ctrl = getControlPoint(flow.sourceCoord, flow.targetCoord)
  const path = Array.from({ length: SEGMENTS + 1 }, (_, i) =>
    quadBezier(flow.sourceCoord, ctrl, flow.targetCoord, i / SEGMENTS),
  )
  const [r, g, b] = PURPOSE_COLORS[flow.purpose]
  return {
    path,
    color: [r, g, b, getFlowAlpha(flow, selectedId)],
    width: getFlowWidth(flow.volume, selectedId, flow),
  }
}

export function createODFlowLayer(
  flows: ODFlow[],
  selectedNodeId: string | null = null,
) {
  const paths = flows.map(f => buildFlowPath(f, selectedNodeId))
  return new PathLayer<FlowPath>({
    id: 'od-flows',
    data: paths,
    pickable: false,
    getPath: (p) => p.path,
    getColor: (p) => p.color,
    getWidth: (p) => p.width,
    widthUnits: 'pixels',
    capRounded: true,
    jointRounded: true,
    updateTriggers: {
      getColor: [flows, selectedNodeId],
      getWidth: [flows, selectedNodeId],
    },
  })
}
```

- [ ] **Step 4: FlowParticleLayer.ts 수정 — selectedNodeId 파라미터 추가**

```ts
// frontend/src/layers/FlowParticleLayer.ts
import { ScatterplotLayer } from '@deck.gl/layers'
import type { ODFlow } from '../hooks/useFlowData'
import { getControlPoint, quadBezier, PURPOSE_COLORS } from '../utils/flowBezier'

const BASE_RADIUS = 200
const MAX_EXTRA_RADIUS = 500
const MAX_VOLUME = 10000

interface Particle {
  position: [number, number]
  color: [number, number, number, number]
  radius: number
}

function getParticleRadius(volume: number): number {
  const ratio = Math.min(volume / MAX_VOLUME, 1) ** 0.6
  return BASE_RADIUS + ratio * MAX_EXTRA_RADIUS
}

function getParticleCount(volume: number): number {
  const ratio = Math.min(volume / MAX_VOLUME, 1)
  return Math.max(1, Math.round(ratio * 3) + 1)
}

function generateParticles(
  flows: ODFlow[],
  progress: number,
  selectedNodeId: string | null,
): Particle[] {
  return flows.flatMap((flow) => {
    const isRelated =
      selectedNodeId === null ||
      flow.originCommCd === selectedNodeId ||
      flow.destCommCd === selectedNodeId
    if (!isRelated) return []

    const ctrl = getControlPoint(flow.sourceCoord, flow.targetCoord)
    const radius = getParticleRadius(flow.volume)
    const count = getParticleCount(flow.volume)
    const [r, g, b] = PURPOSE_COLORS[flow.purpose]
    return Array.from({ length: count }, (_, i) => {
      const t = (progress + i / count) % 1
      const alpha = Math.round(Math.sin(t * Math.PI) * 200 + 55)
      return {
        position: quadBezier(flow.sourceCoord, ctrl, flow.targetCoord, t),
        color: [r, g, b, alpha] as [number, number, number, number],
        radius,
      }
    })
  })
}

export function createFlowParticleLayer(
  flows: ODFlow[],
  progress: number,
  selectedNodeId: string | null = null,
) {
  const particles = generateParticles(flows, progress, selectedNodeId)
  return new ScatterplotLayer<Particle>({
    id: 'flow-particles',
    data: particles,
    pickable: false,
    getPosition: (p) => p.position,
    getRadius: (p) => p.radius,
    getFillColor: (p) => p.color,
    radiusUnits: 'meters',
    radiusMinPixels: 3,
    radiusMaxPixels: 14,
    updateTriggers: {
      getFillColor: [progress, selectedNodeId],
      getPosition: [progress, selectedNodeId],
      getRadius: [progress, selectedNodeId],
    },
  })
}
```

- [ ] **Step 5: Map.tsx handleFrame 호출부 수정 (line ~131)**

```ts
// Map.tsx — handleFrame 내부 setProps 교체
overlayRef.current.setProps({
  layers: [
    createODFlowLayer(flows, selectedNode?.id ?? null),
    createFlowParticleLayer(flows, progressRef.current, selectedNode?.id ?? null),
    createCommerceNodeLayer(
      nodes,
      (info: PickingInfo<CommerceNode>) => {
        if (info.object) setHoveredNode({ node: info.object, x: info.x, y: info.y })
        else setHoveredNode(null)
      },
      (info: PickingInfo<CommerceNode>) => { onSelectNode?.(info.object ?? null) },
      selectedNode?.id ?? null,
    ),
  ],
})
```

- [ ] **Step 6: 테스트 실행 → PASS 확인**

```bash
cd frontend && npm run test -- --reporter=verbose flowAlpha
```

Expected: 6 tests PASS

- [ ] **Step 7: 커밋**

```bash
git add frontend/src/layers/ODFlowLayer.ts frontend/src/layers/FlowParticleLayer.ts frontend/src/components/Map.tsx frontend/src/layers/flowAlpha.test.ts
git commit -m "feat: highlight flows on commerce node selection"
```

---

## Task 2: GRI 기반 테두리 색 분기

**Files:**
- Modify: `frontend/src/layers/CommerceNodeLayer.ts`
- Create: `frontend/src/layers/griNodeStyle.test.ts`

### 배경

현재 테두리는 `degreeCentrality >= threshold` 여부로만 결정된다. 계획서 기준: GRI 70+ → 빨강, 40~69 → 주황, 39 이하 → 흰색.

- [ ] **Step 1: 테스트 작성 — `griNodeStyle.test.ts` (RED)**

```ts
// frontend/src/layers/griNodeStyle.test.ts
import { describe, it, expect } from 'vitest'
import { getGriBorderColor, getGriBorderWidth } from './CommerceNodeLayer'

describe('getGriBorderColor', () => {
  it('GRI 70 이상: 빨간 테두리를 반환한다', () => {
    const [r] = getGriBorderColor(70, false)
    expect(r).toBe(239) // [239, 83, 80, 255]
  })

  it('GRI 40~69: 주황 테두리를 반환한다', () => {
    const [r, g] = getGriBorderColor(55, false)
    expect(r).toBe(255)
    expect(g).toBe(167) // [255, 167, 38, 255]
  })

  it('GRI 39 이하: 흰색 계열 테두리를 반환한다', () => {
    const [r, g, b] = getGriBorderColor(30, false)
    expect(r).toBeGreaterThan(200)
    expect(g).toBeGreaterThan(200)
    expect(b).toBeGreaterThan(200)
  })

  it('선택된 노드: GRI와 무관하게 흰색 테두리를 반환한다', () => {
    const [r, g, b, a] = getGriBorderColor(90, true)
    expect(r).toBeGreaterThan(200)
    expect(a).toBe(255)
  })
})

describe('getGriBorderWidth', () => {
  it('GRI 70 이상: 90m', () => { expect(getGriBorderWidth(70, false)).toBe(90) })
  it('GRI 40~69: 60m', () => { expect(getGriBorderWidth(55, false)).toBe(60) })
  it('GRI 39 이하: 20m', () => { expect(getGriBorderWidth(30, false)).toBe(20) })
  it('선택된 노드: GRI와 무관하게 90m', () => { expect(getGriBorderWidth(10, true)).toBe(90) })
})
```

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

```bash
cd frontend && npm run test -- --reporter=verbose griNodeStyle
```

- [ ] **Step 3: CommerceNodeLayer.ts 수정 — 헬퍼 함수 추가 + 기존 getLineColor·getLineWidth 교체**

```ts
// frontend/src/layers/CommerceNodeLayer.ts
import { ScatterplotLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import { COMMERCE_COLORS } from '../styles/tokens'
import type { CommerceNode } from '../types/commerce'

const MIN_RADIUS = 300
const MAX_RADIUS = 1500
const MAX_ABS_FLOW = 1200

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function getRadius(netFlow: number): number {
  const ratio = Math.min(Math.abs(netFlow) / MAX_ABS_FLOW, 1)
  return MIN_RADIUS + ratio * (MAX_RADIUS - MIN_RADIUS)
}

function getColor(node: CommerceNode, isHighlight: boolean): [number, number, number, number] {
  const colorToken = COMMERCE_COLORS[node.type]
  const [r, g, b] = hexToRgb(colorToken.fill)
  return isHighlight ? [r, g, b, 255] : [r, g, b, 200]
}

// GRI 기반 테두리 색상 (선택 상태 우선)
export function getGriBorderColor(
  griScore: number,
  isSelected: boolean,
): [number, number, number, number] {
  if (isSelected) return [236, 239, 241, 255]
  if (griScore >= 70) return [239, 83, 80, 255]
  if (griScore >= 40) return [255, 167, 38, 255]
  return [236, 239, 241, 80]
}

// GRI 기반 테두리 두께
export function getGriBorderWidth(griScore: number, isSelected: boolean): number {
  if (isSelected) return 90
  if (griScore >= 70) return 90
  if (griScore >= 40) return 60
  return 20
}

export function createCommerceNodeLayer(
  nodes: CommerceNode[],
  onHover: (info: PickingInfo<CommerceNode>) => void,
  onClick: (info: PickingInfo<CommerceNode>) => void,
  selectedId: string | null,
): ScatterplotLayer<CommerceNode> {
  return new ScatterplotLayer<CommerceNode>({
    id: 'commerce-nodes',
    data: nodes,
    pickable: true,
    stroked: true,
    getPosition: (node) => node.coordinates,
    getRadius: (node) => getRadius(node.netFlow),
    getFillColor: (node) => getColor(node, node.id === selectedId),
    getLineColor: (node) =>
      getGriBorderColor(node.griScore, node.id === selectedId),
    getLineWidth: (node) =>
      getGriBorderWidth(node.griScore, node.id === selectedId),
    radiusUnits: 'meters',
    lineWidthUnits: 'meters',
    onHover,
    onClick,
    updateTriggers: {
      getRadius: nodes,
      getFillColor: [nodes, selectedId],
      getLineColor: [nodes, selectedId],
      getLineWidth: [nodes, selectedId],
    },
  })
}
```

- [ ] **Step 4: 테스트 실행 → PASS 확인**

```bash
cd frontend && npm run test -- --reporter=verbose griNodeStyle
```

Expected: 8 tests PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/layers/CommerceNodeLayer.ts frontend/src/layers/griNodeStyle.test.ts
git commit -m "feat: gri-based node border color (red/orange/white bands)"
```

---

## Task 3: hover 카드 뷰포트 경계 보정

**Files:**
- Modify: `frontend/src/components/Map.tsx` (hover 카드 렌더링 구간 ~line 231–327)

### 배경

현재 `left: x + 14`로 고정돼 오른쪽 끝 상권 hover 시 카드가 뷰포트 밖으로 나간다. 카드 폭 약 220px를 기준으로 우측 경계를 넘으면 왼쪽으로 뒤집는다.

- [ ] **Step 1: Map.tsx hover 카드 위치 로직 수정**

Map.tsx의 hover 카드 `<div style={{ position: 'absolute', left: x + 14, top: y - 12, ... }}>` 부분을 찾아 아래로 교체한다.

```tsx
// Map.tsx — 호버 카드 스타일 계산 (hoveredNode 렌더링 직전)
const HOVER_CARD_WIDTH = 220
const isNearRightEdge =
  hoveredNode !== null &&
  hoveredNode.x + 14 + HOVER_CARD_WIDTH > window.innerWidth

// 렌더링
{hoveredNode && (() => {
  const { node, x, y } = hoveredNode
  const cardLeft = isNearRightEdge ? x - 14 - HOVER_CARD_WIDTH : x + 14
  const token = COMMERCE_COLORS[node.type]
  const badge = getInterventionBadge(node.griScore)
  const netFlowColor = node.netFlow >= 0 ? '#A5D6A7' : '#EF9A9A'
  const interpretation = getNodeInterpretation(node.type, node.griScore)
  return (
    <div
      style={{
        position: 'absolute',
        left: cardLeft,   // ← 여기만 변경
        top: y - 12,
        // ... 나머지 스타일 동일
      }}
    >
      {/* 내부 JSX 동일 */}
    </div>
  )
})()}
```

- [ ] **Step 2: 개발 서버 실행 후 수동 검증**

```bash
cd frontend && npm run dev
```

1. 지도 오른쪽 끝에 있는 상권 노드 hover → 카드가 왼쪽에 표시되는지 확인
2. 지도 중앙 상권 hover → 카드가 오른쪽에 표시되는지 확인

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/Map.tsx
git commit -m "fix: flip hover card to left when near viewport right edge"
```

---

## Task 4: 경계선 두께 줌 보간

**Files:**
- Modify: `frontend/src/utils/boundaryLayerConfig.ts`
- Modify: `frontend/src/utils/BoundaryLayerManager.ts`

### 배경

`getBoundaryPaintConfig`가 `'line-width': 0.8` (고정값)을 반환한다. MapLibre `interpolate` 표현식으로 교체하고, fill-opacity도 줌 연동한다.

- [ ] **Step 1: boundaryLayerConfig.ts 수정**

```ts
// frontend/src/utils/boundaryLayerConfig.ts
import { MAP_THEME, type MapTheme } from '../styles/tokens'

// MapLibre expression 타입 (ExpressionSpecification은 readonly unknown[] 상위)
type MaplibreExpression = unknown[]

export interface BoundaryPaintConfig {
  line: {
    'line-color': string
    'line-width': number | MaplibreExpression
    'line-opacity': number
  }
  highlight: {
    'line-color': string
    'line-width': number | MaplibreExpression
    'line-opacity': number
  }
}

// 줌 10 → 0.4px, 줌 13 → 1.2px, 줌 16 → 2.5px
const LINE_WIDTH_ZOOM_EXPR: MaplibreExpression = [
  'interpolate', ['linear'], ['zoom'],
  10, 0.4,
  13, 1.2,
  16, 2.5,
]

export function getBoundaryPaintConfig(theme: MapTheme): BoundaryPaintConfig {
  const colors = MAP_THEME[theme]
  return {
    line: {
      'line-color': colors.boundaryLine,
      'line-width': LINE_WIDTH_ZOOM_EXPR,
      'line-opacity': 0.7,
    },
    highlight: {
      'line-color': colors.highlightLine,
      'line-width': 2,
      'line-opacity': 0.9,
    },
  }
}

// fill-opacity: 줌 10 → 0.15, 줌 14 이상 → 0.25
export const FILL_OPACITY_ZOOM_EXPR: MaplibreExpression = [
  'interpolate', ['linear'], ['zoom'],
  10, 0.15,
  14, 0.25,
]
```

- [ ] **Step 2: BoundaryLayerManager.ts — fill-opacity에 줌 표현식 적용**

`addLayers()` 메서드에서 `'fill-opacity': this.fillOpacity` → `'fill-opacity': FILL_OPACITY_ZOOM_EXPR`로 교체.
`setFillOpacity()` 메서드는 그대로 유지 (테마 재적용 시 호출될 수 있으므로 무해).

```ts
// BoundaryLayerManager.ts 상단에 import 추가
import { getBoundaryPaintConfig, FILL_OPACITY_ZOOM_EXPR } from './boundaryLayerConfig'

// addLayers() 내부 fill layer 변경:
this.map.addLayer({
  id: FILL_LAYER_ID,
  type: 'fill',
  source: SOURCE_ID,
  paint: {
    'fill-color': fillColor,
    'fill-opacity': FILL_OPACITY_ZOOM_EXPR as maplibregl.ExpressionSpecification,
  },
})
```

- [ ] **Step 3: 기존 boundaryLayerConfig 테스트가 여전히 통과하는지 확인**

```bash
cd frontend && npm run test -- --reporter=verbose boundaryLayerConfig
```

Expected: PASS (반환값이 `number` → expression으로 바뀌었지만 기존 테스트가 line-width 값을 숫자로 단정하지 않는다면 통과)

> 만약 기존 테스트에서 `'line-width': 0.8`을 검사하는 케이스가 있다면 expression 반환으로 수정.

- [ ] **Step 4: 개발 서버에서 줌 in/out으로 경계선 두께 변화 수동 확인**

```bash
cd frontend && npm run dev
```

줌 10 → 경계선 얇음, 줌 16 → 경계선 굵어짐 확인

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/utils/boundaryLayerConfig.ts frontend/src/utils/BoundaryLayerManager.ts
git commit -m "feat: zoom-interpolated boundary line width and fill opacity"
```

---

## Task 5: 단거리 곡률 과잉 수정

**Files:**
- Modify: `frontend/src/utils/flowBezier.ts`
- Create: `frontend/src/utils/flowBezier.test.ts`

### 배경

`CURVE_FACTOR = 0.45`가 거리와 무관하게 적용돼 강남·관악 내부 단거리 흐름이 과도하게 휜다. 거리에 비례해 곡률을 줄인다: `effectiveFactor = Math.min(CURVE_FACTOR, 0.15 + dist * 0.6)`.

서울 내 행정동 간 경위도 거리 기준:
- 가까운 동 (< 0.05°): effective ≈ 0.15~0.18 → 완만
- 강남↔관악 (≈ 0.18°): effective ≈ 0.26 → 중간
- 먼 거리 (> 0.5°): effective = 0.45 (상한 유지)

- [ ] **Step 1: 테스트 작성 — `flowBezier.test.ts` (RED)**

```ts
// frontend/src/utils/flowBezier.test.ts
import { describe, it, expect } from 'vitest'
import { getControlPoint, CURVE_FACTOR } from './flowBezier'

const midpoint = (src: [number, number], tgt: [number, number]): [number, number] => [
  (src[0] + tgt[0]) / 2,
  (src[1] + tgt[1]) / 2,
]

function measureCurvature(
  src: [number, number],
  tgt: [number, number],
): number {
  const ctrl = getControlPoint(src, tgt)
  const mid = midpoint(src, tgt)
  // 제어점과 중점 사이 거리 = 곡률의 대리 지표
  return Math.sqrt((ctrl[0] - mid[0]) ** 2 + (ctrl[1] - mid[1]) ** 2)
}

describe('getControlPoint — 거리 비례 곡률', () => {
  const NEAR_SRC: [number, number] = [126.90, 37.50]
  const NEAR_TGT: [number, number] = [126.92, 37.51]  // dist ≈ 0.022°

  const FAR_SRC: [number, number] = [126.90, 37.50]
  const FAR_TGT: [number, number] = [127.10, 37.65]   // dist ≈ 0.25°

  it('단거리 흐름의 곡률은 CURVE_FACTOR 기반 최대 곡률보다 작아야 한다', () => {
    const nearCurve = measureCurvature(NEAR_SRC, NEAR_TGT)

    // CURVE_FACTOR=0.45 고정이었을 때의 곡률 계산
    const dx = NEAR_TGT[0] - NEAR_SRC[0]
    const dy = NEAR_TGT[1] - NEAR_SRC[1]
    const dist = Math.sqrt(dx * dx + dy * dy)
    const maxCurve = dist * CURVE_FACTOR

    expect(nearCurve).toBeLessThan(maxCurve)
  })

  it('원거리 흐름의 곡률은 CURVE_FACTOR를 그대로 사용한다', () => {
    const farCurve = measureCurvature(FAR_SRC, FAR_TGT)
    const dx = FAR_TGT[0] - FAR_SRC[0]
    const dy = FAR_TGT[1] - FAR_SRC[1]
    const dist = Math.sqrt(dx * dx + dy * dy)
    const maxCurve = dist * CURVE_FACTOR

    // 원거리에서는 effective factor = CURVE_FACTOR (상한 도달)
    expect(farCurve).toBeCloseTo(maxCurve, 4)
  })

  it('출발지와 도착지가 같으면 출발지를 반환한다', () => {
    const src: [number, number] = [126.9, 37.5]
    expect(getControlPoint(src, src)).toEqual(src)
  })
})
```

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

```bash
cd frontend && npm run test -- --reporter=verbose flowBezier
```

Expected: 단거리 곡률 테스트 FAIL (현재 고정값 적용)

- [ ] **Step 3: flowBezier.ts 수정**

```ts
// frontend/src/utils/flowBezier.ts
import type { FlowPurpose } from '../hooks/useFlowData'

export const CURVE_FACTOR = 0.45

export function getControlPoint(
  src: [number, number],
  tgt: [number, number],
  factor = CURVE_FACTOR,
): [number, number] {
  const dx = tgt[0] - src[0]
  const dy = tgt[1] - src[1]
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist === 0) return src
  // 거리 비례 곡률: 단거리일수록 직선에 가깝게
  const effectiveFactor = Math.min(factor, 0.15 + dist * 0.6)
  const perpX = dy / dist
  const perpY = -dx / dist
  return [
    (src[0] + tgt[0]) / 2 + perpX * dist * effectiveFactor,
    (src[1] + tgt[1]) / 2 + perpY * dist * effectiveFactor,
  ]
}

export function quadBezier(
  src: [number, number],
  ctrl: [number, number],
  tgt: [number, number],
  t: number,
): [number, number] {
  const u = 1 - t
  return [
    u * u * src[0] + 2 * u * t * ctrl[0] + t * t * tgt[0],
    u * u * src[1] + 2 * u * t * ctrl[1] + t * t * tgt[1],
  ]
}

export const PURPOSE_COLORS: Record<FlowPurpose, [number, number, number]> = {
  출근: [41, 182, 246],
  쇼핑: [255, 167, 38],
  여가: [171, 71, 188],
  귀가: [102, 187, 106],
}
```

- [ ] **Step 4: 테스트 실행 → PASS 확인**

```bash
cd frontend && npm run test -- --reporter=verbose flowBezier
```

Expected: 3 tests PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/utils/flowBezier.ts frontend/src/utils/flowBezier.test.ts
git commit -m "fix: distance-proportional bezier curvature (short flows less curved)"
```

---

## Task 6: 줌 레벨별 레이어 가시성 전환

**Files:**
- Modify: `frontend/src/components/Map.tsx`

### 배경

줌 11 미만에서는 Deck.gl 노드·흐름 레이어를 숨겨 자치구 개요만 보이게 한다. setState 대신 `zoomRef`를 사용해 RAF 루프에서 re-render 없이 읽는다.

- [ ] **Step 1: Map.tsx 수정 — zoomRef 추가 + zoom 리스너 등록**

```tsx
// Map.tsx — useRef 블록에 추가
const zoomRef = useRef(11)

// useEffect([]) 내부 map.once('load') 후:
map.on('zoom', () => {
  zoomRef.current = map.getZoom()
})
```

- [ ] **Step 2: handleFrame 내부에 줌 가드 추가**

```tsx
const handleFrame = useCallback((delta: number) => {
  const totalVolume = flows.reduce((sum, f) => sum + f.volume, 0)
  const speedScale = Math.max(0.3, Math.min(2.0, Math.sqrt(totalVolume / BASE_VOLUME)))
  progressRef.current = (progressRef.current + delta * ANIMATION_SPEED * speedScale) % 1

  if (!overlayRef.current) return

  const showLayers = zoomRef.current >= 11

  overlayRef.current.setProps({
    layers: showLayers
      ? [
          createODFlowLayer(flows, selectedNode?.id ?? null),
          createFlowParticleLayer(flows, progressRef.current, selectedNode?.id ?? null),
          createCommerceNodeLayer(
            nodes,
            (info: PickingInfo<CommerceNode>) => {
              if (info.object) setHoveredNode({ node: info.object, x: info.x, y: info.y })
              else setHoveredNode(null)
            },
            (info: PickingInfo<CommerceNode>) => { onSelectNode?.(info.object ?? null) },
            selectedNode?.id ?? null,
          ),
        ]
      : [],
  })
}, [flows, nodes, onSelectNode, selectedNode?.id])
```

- [ ] **Step 3: 개발 서버에서 줌 아웃 수동 검증**

```bash
cd frontend && npm run dev
```

지도 줌 아웃 → 줌 11 미만에서 노드·흐름 레이어 사라지고 행정동 경계만 남는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/Map.tsx
git commit -m "feat: hide deck.gl layers below zoom 11 (district overview mode)"
```

---

## Task 7: 상단 해설바 문장 강화

**Files:**
- Modify: `frontend/src/utils/summaryFormatter.ts`
- Modify: `frontend/src/components/Map.tsx` (`buildSummaryText` 호출부)
- Create: `frontend/src/utils/summaryFormatter.test.ts`

### 배경

현재 해설바에 위험 상권 수가 없다. 목표: `"강남·관악 상권 N개 · GRI 70 이상 위험 상권 M개 · {hour} {purpose} 상위 {topN}개 흐름 표시 중"`.

- [ ] **Step 1: 테스트 작성 — `summaryFormatter.test.ts` (RED)**

```ts
// frontend/src/utils/summaryFormatter.test.ts
import { describe, it, expect } from 'vitest'
import { buildSummaryText } from './summaryFormatter'
import type { CommerceNode } from '../types/commerce'

const makeNode = (id: string, griScore: number): CommerceNode => ({
  id,
  name: `상권${id}`,
  coordinates: [126.9, 37.5],
  type: '안정형',
  district: '강남구',
  netFlow: 0,
  degreeCentrality: 0.5,
  griScore,
})

const ALL_TYPES = new Set(['흡수형_과열', '흡수형_성장', '방출형_침체', '고립형_단절', '안정형', '미분류'] as const)

describe('buildSummaryText', () => {
  it('전체 상권 수와 위험 상권 수를 포함한다', () => {
    const nodes = [makeNode('a', 80), makeNode('b', 50), makeNode('c', 30)]
    const text = buildSummaryText('출근', 8, 30, ALL_TYPES, nodes)
    expect(text).toContain('3개')       // 총 노드 수
    expect(text).toContain('위험 상권 1개') // GRI 70+ 1개
  })

  it('위험 상권이 없으면 0개를 표시한다', () => {
    const nodes = [makeNode('a', 30), makeNode('b', 40)]
    const text = buildSummaryText(null, 12, 10, ALL_TYPES, nodes)
    expect(text).toContain('위험 상권 0개')
  })

  it('nodes가 비어있으면 빈 문자열을 반환한다', () => {
    expect(buildSummaryText('출근', 8, 10, ALL_TYPES, [])).toBe('')
  })
})
```

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

```bash
cd frontend && npm run test -- --reporter=verbose summaryFormatter
```

- [ ] **Step 3: summaryFormatter.ts 수정**

```ts
// frontend/src/utils/summaryFormatter.ts
import type { FlowPurpose } from '../hooks/useFlowData'
import type { CommerceType } from '../styles/tokens'
import { COMMERCE_COLORS } from '../styles/tokens'
import type { CommerceNode } from '../types/commerce'

function formatHour(hour: number): string {
  if (hour === 0) return '자정 0시'
  if (hour < 12) return `오전 ${hour}시`
  if (hour === 12) return '오후 12시'
  return `오후 ${hour - 12}시`
}

export function buildSummaryText(
  purpose: FlowPurpose | null,
  hour: number,
  topN: number,
  selectedTypes: Set<CommerceType>,
  nodes: CommerceNode[],
): string {
  if (nodes.length === 0) return ''

  const totalCount = nodes.length
  const dangerCount = nodes.filter(n => n.griScore >= 70).length
  const purposeText = purpose ?? '전체 목적'
  const hourText = formatHour(hour)

  return `강남·관악 상권 ${totalCount}개 · GRI 70 이상 위험 상권 ${dangerCount}개 · ${hourText} ${purposeText} 상위 ${topN}개 흐름 표시 중`
}

export function getNodeInterpretation(type: CommerceType, griScore: number): string {
  switch (type) {
    case '흡수형_과열':
      return griScore >= 80 ? '유입은 강하지만 과열 위험이 큽니다' : '유입이 강한 상권입니다'
    case '흡수형_성장':
      return '유입과 성장세가 함께 나타나는 상권입니다'
    case '방출형_침체':
      return '유출이 지속돼 방어가 필요한 상권입니다'
    case '고립형_단절':
      return '연결이 약해 흐름이 고립된 상권입니다'
    case '안정형':
      return '유입·유출 변동이 비교적 안정적입니다'
    case '미분류':
      return 'Dev-C 분석 결과가 아직 산출되지 않았습니다'
  }
}
```

- [ ] **Step 4: Map.tsx — buildSummaryText 호출부에 nodes 추가**

```tsx
// Map.tsx line ~154
const summaryText = selectedTypes
  ? buildSummaryText(purpose, hour, topN, selectedTypes, nodes)
  : null
```

- [ ] **Step 5: 테스트 실행 → PASS 확인**

```bash
cd frontend && npm run test -- --reporter=verbose summaryFormatter
```

Expected: 3 tests PASS

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/utils/summaryFormatter.ts frontend/src/utils/summaryFormatter.test.ts frontend/src/components/Map.tsx
git commit -m "feat: summary bar shows total and danger commerce count"
```

---

## Task 8: 범례 첫 접속 자동 오픈

**Files:**
- Modify: `frontend/src/components/CommerceLegend.tsx`

### 배경

현재 `open` 초기값이 `false`라 처음 접속한 사람은 색상 의미를 모른다. 첫 세션에만 3초간 자동 오픈하고 닫힌다.

- [ ] **Step 1: CommerceLegend.tsx 수정 — sessionStorage 기반 첫 접속 감지**

```tsx
// CommerceLegend.tsx
// 기존: const [open, setOpen] = useState(false)
// 교체:

const isFirstVisit = !sessionStorage.getItem('legend-seen')
const [open, setOpen] = useState(isFirstVisit)

// 기존 useEffect([open]) 위에 첫 방문 자동 닫기 effect 추가:
useEffect(() => {
  if (!isFirstVisit) return
  sessionStorage.setItem('legend-seen', '1')
  const timer = setTimeout(() => setOpen(false), 3000)
  return () => clearTimeout(timer)
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: 수동 검증**

```bash
cd frontend && npm run dev
```

1. 새 탭(또는 Incognito) 접속 → 범례가 3초간 열려있다가 닫히는지 확인
2. 페이지 새로고침 → 범례가 닫힌 상태로 시작하는지 확인

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/CommerceLegend.tsx
git commit -m "feat: legend auto-opens 3s on first visit (sessionStorage guard)"
```

---

## [보완] Task 9: 빈 선택 상태 안내

**Files:**
- Modify: `frontend/src/components/CommerceDetailPanel.tsx`

### 배경

현재 `!node → return null`로 패널이 완전히 사라진다. 처음 접속 시 우측 패널이 비어 "클릭이 가능한지"도 모른다. 간단한 안내 화면을 표시한다.

- [ ] **Step 1: CommerceDetailPanel.tsx 수정 — null 상태 안내 화면 추가**

기존 `if (!node) return null` 줄을 아래로 교체한다.

```tsx
// CommerceDetailPanel.tsx — null 분기 교체
if (!node) {
  return (
    <div
      style={{
        ...S.overlay,
        alignItems: 'center',
        justifyContent: 'center',
        color: '#546E7A',
        textAlign: 'center',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 28, lineHeight: 1 }}>🗺</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#78909C' }}>
        상권을 클릭하면
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
        GRI · 폐업률 · 흐름 추세<br />상세 분석을 확인할 수 있습니다
      </div>
    </div>
  )
}
```

> 단, 이 패널은 항상 렌더링되므로 Map.tsx에서 `node === null` 시 패널을 숨기는 로직이 있다면 그 조건도 같이 제거한다. 현재 Map.tsx는 `<CommerceDetailPanel node={selectedNode ?? null} ...>`로 항상 마운트하므로 추가 변경 없음.

- [ ] **Step 2: 개발 서버 수동 확인**

처음 접속 시 좌측 패널에 안내 문구 표시 → 상권 클릭 시 상세 패널로 전환.

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/CommerceDetailPanel.tsx
git commit -m "feat: empty state guidance in commerce detail panel"
```

---

## [참고] Task 10: MAX_ABS_FLOW / MAX_VOLUME 실측 재설정

**데이터 선행 조건:** `od_flows_aggregated` 테이블 적재 완료 후 실행

현재 상수:
- `CommerceNodeLayer.ts`: `MAX_ABS_FLOW = 1200` (mock 기준)
- `ODFlowLayer.ts` · `FlowParticleLayer.ts`: `MAX_VOLUME = 10000` (mock 기준)

실데이터 적재 후:
```bash
# DB에서 실제 90퍼센타일 값 확인
psql -c "SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY ABS(net_flow)) FROM commerce_analysis;"
psql -c "SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY trip_count_sum) FROM od_flows_aggregated;"
```

결과값으로 두 파일의 상수를 교체하고, 전체 테스트 통과 확인 후 커밋.

---

## 전체 실행 순서 요약

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9
(데이터 적재 후) → Task 10
```

각 Task 완료 후 `cd frontend && npm run test`로 전체 테스트 통과 확인.

---

## Self-Review

### Spec coverage 체크

| 항목 | 구현 Task |
|---|---|
| 상권 클릭 시 관련 흐름 강조 (알파, 두께) | Task 1 ✅ |
| 파티클 레이어 동기화 | Task 1 ✅ |
| GRI 기반 테두리 색 분기 | Task 2 ✅ |
| hover 카드 뷰포트 경계 보정 | Task 3 ✅ |
| 경계선 두께 줌 보간 | Task 4 ✅ |
| fill-opacity 줌 연동 | Task 4 ✅ |
| 단거리 곡률 과잉 수정 | Task 5 ✅ |
| 줌 레벨별 레이어 가시성 전환 | Task 6 ✅ |
| 상단 해설바 문장 강화 (위험 상권 수) | Task 7 ✅ |
| 범례 첫 접속 자동 오픈 | Task 8 ✅ |
| 빈 선택 상태 안내 | Task 9 (보완) ✅ |
| MAX_ABS_FLOW / MAX_VOLUME 재설정 | Task 10 (데이터 후) ✅ |
| 상권 경계 폴리곤 레이어 | 미포함 — `commerce_boundary` 적재 선행 필요 |

### Type consistency 체크

- `getFlowAlpha(flow: ODFlow, selectedId: string | null)` → Task 1 테스트·구현 일치 ✅
- `getGriBorderColor(griScore: number, isSelected: boolean)` → Task 2 테스트·구현 일치 ✅
- `buildSummaryText(..., nodes: CommerceNode[])` → Task 7 호출부와 시그니처 일치 ✅
- `LINE_WIDTH_ZOOM_EXPR` export → BoundaryLayerManager import 일치 ✅

### Placeholder 스캔

placeholder 없음 — 모든 스텝에 실제 코드 포함.
