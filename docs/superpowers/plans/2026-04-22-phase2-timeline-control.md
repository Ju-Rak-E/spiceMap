# Phase 2 — 타임라인 재생 + 시간대 실시간 갱신 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 타임라인 슬라이더에 재생/정지 기능을 추가하고, 시간대(hour) 변경이 OD 흐름 볼륨에 실시간 반영되도록 구현

**Architecture:** 순수 함수 `applyHourWeight(flows, hour)`로 시간대별 볼륨을 클라이언트 사이드에서 스케일링한다 (mock/API 모두 동일한 경로). `useTimelineControl` 훅이 재생 인터벌을 관리하며 `hour` state를 외부에서 전달받아 자동 진행시킨다. API가 `/api/od/flows?hour=N`을 지원하면 `useFlowData`의 쿼리 파라미터만 추가하면 된다.

**Tech Stack:** React 19, TypeScript 6, Vitest 4

---

## File Map

| 작업 | 파일 | 역할 |
|------|------|------|
| 수정 | `frontend/src/hooks/useFlowData.ts` | `hour` 필터 + `applyHourWeight` 순수 함수 추가 |
| 수정 | `frontend/src/hooks/useFlowData.test.ts` | `applyHourWeight` 테스트 추가 |
| 신규 | `frontend/src/hooks/useTimelineControl.ts` | play/pause/speed 인터벌 관리 훅 |
| 신규 | `frontend/src/hooks/useTimelineControl.test.ts` | 훅 순수 로직 테스트 |
| 수정 | `frontend/src/components/FlowControlPanel.tsx` | ▶/⏸ 버튼 + 속도 토글 UI 추가 |
| 수정 | `frontend/src/App.tsx` | useTimelineControl 연결 |

---

## Task 1: `applyHourWeight` — 시간대 볼륨 스케일링

**Files:**
- Modify: `frontend/src/hooks/useFlowData.ts`
- Modify: `frontend/src/hooks/useFlowData.test.ts`

### 설계 근거

mock_flows.json에 `hour` 필드가 없으므로, 순수 함수로 시간대별 가중치를 곱해 볼륨을 시뮬레이션한다. API가 `?hour=N`을 지원하면 이후 쿼리 파라미터를 추가하는 것으로 충분하다. 불변성 원칙: 원본 배열/객체를 직접 수정하지 않고 새 객체 반환.

- [ ] **Step 1: 테스트 먼저 작성 (RED)**

`useFlowData.test.ts`에 아래 `describe` 블록 추가:

```ts
import { describe, it, expect } from 'vitest'
import { filterFlows, computeStats, applyHourWeight, type ODFlow, type FlowPurpose } from './useFlowData'

// ... 기존 SAMPLE_FLOWS 픽스처 유지 ...

describe('applyHourWeight', () => {
  const BASE_FLOWS: ODFlow[] = [
    {
      id: 'h1',
      sourceId: 'A',
      targetId: 'B',
      sourceCoord: [126.9, 37.5],
      targetCoord: [127.0, 37.5],
      volume: 1000,
      purpose: '출근',
    },
  ]

  it('출근 피크(8시)에 원본 볼륨의 100%를 반환한다', () => {
    const result = applyHourWeight(BASE_FLOWS, 8)
    expect(result[0].volume).toBe(1000)
  })

  it('새벽(3시)에 볼륨이 줄어든다', () => {
    const result = applyHourWeight(BASE_FLOWS, 3)
    expect(result[0].volume).toBeLessThan(1000)
  })

  it('저녁 피크(18시)에 볼륨이 크다', () => {
    const peak8 = applyHourWeight(BASE_FLOWS, 8)[0].volume
    const peak18 = applyHourWeight(BASE_FLOWS, 18)[0].volume
    expect(peak18).toBeGreaterThan(500)
    expect(peak8).toBeGreaterThan(500)
  })

  it('원본 배열을 변경하지 않는다 (불변성)', () => {
    const original = BASE_FLOWS[0].volume
    applyHourWeight(BASE_FLOWS, 8)
    expect(BASE_FLOWS[0].volume).toBe(original)
  })

  it('볼륨은 항상 양의 정수를 반환한다', () => {
    for (let h = 0; h < 24; h++) {
      const result = applyHourWeight(BASE_FLOWS, h)
      expect(result[0].volume).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: 테스트 실패 확인 (RED)**

```bash
cd frontend && npx vitest run src/hooks/useFlowData.test.ts
```

Expected: `FAIL — applyHourWeight is not a function`

- [ ] **Step 3: `useFlowData.ts`에 구현 추가**

`FlowFilters` 인터페이스에 `hour` 필드 추가 및 `applyHourWeight` 함수 추가:

```ts
// FlowFilters에 추가
export interface FlowFilters {
  purpose?: FlowPurpose | null
  topN?: number
  hour?: number   // ← 추가
}

// 시간대별 가중치 (0~1)
const HOUR_WEIGHTS: Record<number, number> = {
  0: 0.10, 1: 0.08, 2: 0.05, 3: 0.05, 4: 0.10, 5: 0.20,
  6: 0.50, 7: 0.85, 8: 1.00, 9: 0.80, 10: 0.60, 11: 0.60,
  12: 0.70, 13: 0.60, 14: 0.55, 15: 0.55, 16: 0.70, 17: 0.90,
  18: 1.00, 19: 0.80, 20: 0.65, 21: 0.50, 22: 0.30, 23: 0.20,
}

export function applyHourWeight(flows: ODFlow[], hour: number): ODFlow[] {
  const weight = HOUR_WEIGHTS[hour] ?? 0.5
  return flows.map(f => ({
    ...f,
    volume: Math.max(1, Math.round(f.volume * weight)),
  }))
}
```

`filterFlows` 함수 내에 hour 적용 추가:

```ts
export function filterFlows(flows: ODFlow[], filters: FlowFilters): ODFlow[] {
  let result = flows

  if (filters.purpose) {
    result = result.filter(f => f.purpose === filters.purpose)
  }

  if (filters.hour !== undefined) {
    result = applyHourWeight(result, filters.hour)
  }

  if (filters.topN !== undefined && filters.topN > 0) {
    result = [...result].sort((a, b) => b.volume - a.volume).slice(0, filters.topN)
  }

  return result
}
```

`useFlowData` 훅의 `fetchFlows` 함수에 hour 쿼리 파라미터 추가 (API 연동 준비):

```ts
async function fetchFlows(hour?: number): Promise<ODFlow[]> {
  if (BASE_URL) {
    try {
      const params = hour !== undefined ? `?hour=${hour}` : ''
      const res = await fetch(`${BASE_URL}/api/od/flows${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<ODFlow[]>
    } catch {
      // API 실패 → mock 폴백
    }
  }

  const mockRes = await fetch('/data/mock_flows.json')
  if (!mockRes.ok) throw new Error(`HTTP ${mockRes.status}`)
  return mockRes.json() as Promise<ODFlow[]>
}
```

`useFlowData` 훅 시그니처 수정 — hour를 `filters`에서 받아 `filterFlows`에 전달:

```ts
export function useFlowData(filters: FlowFilters = {}): UseFlowDataReturn {
  const [allFlows, setAllFlows] = useState<ODFlow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    fetchFlows(filters.hour)
      .then(data => {
        setAllFlows(data)
        setIsLoading(false)
      })
      .catch(() => {
        setError('흐름 데이터를 불러오지 못했습니다')
        setIsLoading(false)
      })
  }, [])   // 초기 1회만 fetch (mock은 전체 데이터 로드 후 클라이언트 필터링)

  const flows = filterFlows(allFlows, filters)
  const stats = computeStats(flows)

  return { flows, isLoading, error, ...stats }
}
```

- [ ] **Step 4: 테스트 통과 확인 (GREEN)**

```bash
cd frontend && npx vitest run src/hooks/useFlowData.test.ts
```

Expected: `PASS — 모든 테스트 통과`

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/hooks/useFlowData.ts frontend/src/hooks/useFlowData.test.ts
git commit -m "feat: OD 흐름 시간대 볼륨 가중치 함수 추가"
```

---

## Task 2: `useTimelineControl` 훅

**Files:**
- Create: `frontend/src/hooks/useTimelineControl.ts`
- Create: `frontend/src/hooks/useTimelineControl.test.ts`

### 설계

- `speed`: `1 | 2 | 4` (시간/초 단위 — 1x = 1시간/초)
- 재생 시 `setInterval(1000 / speed ms)` 마다 hour +1 (0→23 순환)
- 언마운트 시 interval cleanup

- [ ] **Step 1: 테스트 파일 작성 (RED)**

`frontend/src/hooks/useTimelineControl.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getNextHour, getIntervalMs, type TimelineSpeed } from './useTimelineControl'

describe('getNextHour', () => {
  it('23 다음은 0으로 순환한다', () => {
    expect(getNextHour(23)).toBe(0)
  })

  it('일반 시간은 +1 진행한다', () => {
    expect(getNextHour(0)).toBe(1)
    expect(getNextHour(14)).toBe(15)
    expect(getNextHour(22)).toBe(23)
  })
})

describe('getIntervalMs', () => {
  it('1x 속도는 1000ms 간격이다', () => {
    expect(getIntervalMs(1)).toBe(1000)
  })

  it('2x 속도는 500ms 간격이다', () => {
    expect(getIntervalMs(2)).toBe(500)
  })

  it('4x 속도는 250ms 간격이다', () => {
    expect(getIntervalMs(4)).toBe(250)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인 (RED)**

```bash
cd frontend && npx vitest run src/hooks/useTimelineControl.test.ts
```

Expected: `FAIL — Cannot find module './useTimelineControl'`

- [ ] **Step 3: `useTimelineControl.ts` 구현**

`frontend/src/hooks/useTimelineControl.ts`:

```ts
import { useState, useEffect, useRef, useCallback } from 'react'

export type TimelineSpeed = 1 | 2 | 4

export function getNextHour(hour: number): number {
  return (hour + 1) % 24
}

export function getIntervalMs(speed: TimelineSpeed): number {
  return Math.round(1000 / speed)
}

export interface UseTimelineControlReturn {
  isPlaying: boolean
  speed: TimelineSpeed
  play: () => void
  pause: () => void
  toggleSpeed: () => void
}

const SPEED_CYCLE: TimelineSpeed[] = [1, 2, 4]

export function useTimelineControl(
  hour: number,
  onHourChange: (h: number) => void,
): UseTimelineControlReturn {
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<TimelineSpeed>(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hourRef = useRef(hour)

  useEffect(() => {
    hourRef.current = hour
  }, [hour])

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const play = useCallback(() => {
    setIsPlaying(true)
  }, [])

  const pause = useCallback(() => {
    setIsPlaying(false)
    clearTimer()
  }, [clearTimer])

  const toggleSpeed = useCallback(() => {
    setSpeed(prev => {
      const idx = SPEED_CYCLE.indexOf(prev)
      return SPEED_CYCLE[(idx + 1) % SPEED_CYCLE.length] ?? 1
    })
  }, [])

  useEffect(() => {
    if (!isPlaying) {
      clearTimer()
      return
    }

    clearTimer()
    intervalRef.current = setInterval(() => {
      onHourChange(getNextHour(hourRef.current))
    }, getIntervalMs(speed))

    return clearTimer
  }, [isPlaying, speed, clearTimer, onHourChange])

  return { isPlaying, speed, play, pause, toggleSpeed }
}
```

- [ ] **Step 4: 테스트 통과 확인 (GREEN)**

```bash
cd frontend && npx vitest run src/hooks/useTimelineControl.test.ts
```

Expected: `PASS — 5 tests passed`

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/hooks/useTimelineControl.ts frontend/src/hooks/useTimelineControl.test.ts
git commit -m "feat: 타임라인 재생/정지 제어 훅 추가"
```

---

## Task 3: FlowControlPanel — 재생 UI 추가

**Files:**
- Modify: `frontend/src/components/FlowControlPanel.tsx`

- [ ] **Step 1: Props 인터페이스에 타임라인 제어 추가**

`FlowControlPanelProps`에 추가:

```ts
interface FlowControlPanelProps {
  // ...기존 props...
  isPlaying: boolean
  speed: 1 | 2 | 4
  onPlay: () => void
  onPause: () => void
  onToggleSpeed: () => void
}
```

- [ ] **Step 2: 재생 컨트롤 UI 섹션 추가**

기존 "시간대" 슬라이더 섹션 바로 아래에 추가:

```tsx
{/* 재생 컨트롤 */}
<div style={S.section}>
  <div style={S.label}>타임라인 재생</div>
  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    <button
      style={{
        flex: 1,
        padding: '8px 0',
        borderRadius: 8,
        border: 'none',
        background: isPlaying ? '#37474F' : '#1B5E20',
        color: isPlaying ? '#90A4AE' : '#A5D6A7',
        fontSize: 20,
        cursor: 'pointer',
      }}
      onClick={isPlaying ? onPause : onPlay}
      aria-label={isPlaying ? '정지' : '재생'}
    >
      {isPlaying ? '⏸' : '▶'}
    </button>
    <button
      style={{
        padding: '8px 14px',
        borderRadius: 8,
        border: '1px solid #37474F',
        background: '#263238',
        color: '#90A4AE',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        minWidth: 52,
      }}
      onClick={onToggleSpeed}
      aria-label={`재생 속도 ${speed}배속`}
    >
      {speed}×
    </button>
  </div>
  <div style={{ fontSize: 11, color: '#546E7A' }}>
    {isPlaying ? `${speed}시간/초 재생 중` : '슬라이더로 시간대 선택'}
  </div>
</div>
```

- [ ] **Step 3: TypeScript 컴파일 확인**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/FlowControlPanel.tsx
git commit -m "feat: FlowControlPanel 재생/정지/속도 UI 추가"
```

---

## Task 4: App.tsx — hour 필터 + 타임라인 연결

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
import { useTimelineControl } from './hooks/useTimelineControl'
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

  const { isPlaying, speed, play, pause, toggleSpeed } = useTimelineControl(hour, setHour)

  const topN = STRENGTH_TO_TOP_N[flowStrength] ?? 15
  const { nodes, usingMockData } = useCommerceData()
  const flowData = useFlowData({ purpose: purpose ?? undefined, topN, hour })

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 지도 영역 */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        {selectedNode && (
          <CommerceDetailPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        )}

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
      />
    </div>
  )
}
```

- [ ] **Step 2: 전체 검증**

```bash
cd frontend && npx tsc --noEmit && npx vitest run
```

Expected:
```
TypeScript: 0 errors
Tests: X passed (모두 GREEN)
```

- [ ] **Step 3: 최종 커밋**

```bash
git add frontend/src/App.tsx
git commit -m "feat: Phase 2 — 타임라인 재생·시간대 실시간 갱신 완료"
```

---

## 완료 기준 체크리스트

- [ ] `npx vitest run` → 기존 포함 모든 테스트 PASS
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] ▶ 버튼 클릭 시 시간대 슬라이더 자동 진행
- [ ] ⏸ 버튼으로 정지 후 슬라이더 수동 조작 가능
- [ ] 1×/2×/4× 속도 전환 동작
- [ ] 지도 하단 "평일 N시" 텍스트 실시간 갱신
- [ ] 통계 카드(총 이동량·활성 흐름) 시간대별 변화 반영
