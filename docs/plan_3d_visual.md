# 3D 그래프 시각 퀄리티 업그레이드

> 작성일: 2026-05-10 (Week 5 Day 2 / D-5)
> 담당: Dev-B (kbh)
> 상태: ✅ 사용자 승인 완료, 구현 대기
> 관련: `docs/plan_3d_ux.md` (UX 컨트롤 개선 — 별도 트랙)

---

## 목표

**"보자마자 예쁘다"** — 발표 자료/시연 영상에 바로 쓸 수 있는 비주얼.

핵심 4축: **라이팅 / 컬러 그라데이션 / 모서리 / 진짜 3D 컬럼**

## 현재 상태 진단

| 파일 | 문제 |
|---|---|
| `AdminPolygonExtrusionLayer.ts` | 모든 자치구 단색 라벤더 (#B7A5DB) — 값 차이 색에 안 반영 |
| `PolygonExtrusionLayer.ts` | 업종 색은 있지만 불투명 단색 — 평면 박스 |
| 둘 다 | `material` 미사용 → Deck.gl 라이팅·그림자 없음 → 입체감 부족 |
| `stroked: false` | 모서리 라인 없음 |
| `CommerceColumnLayer.ts` | 이름과 다르게 `TextLayer` (人, !, ×, ●) — 평면 글자 |
| `use3DView.ts` | 모든 막대 동시 상승 — 단조로움 |
| `MAX_ELEVATION = 3000` 고정 | 줌·데이터 분포에 따라 너무 평/너무 솟음 |

---

## 구현 단계

### Phase A: 라이팅 + 머티리얼 (입체감의 80%)

**파일: `frontend/src/components/Map.tsx`**

```ts
import { LightingEffect, AmbientLight, _SunLight as SunLight } from '@deck.gl/core'

const lightingEffect = new LightingEffect({
  ambientLight: new AmbientLight({ color: [255, 255, 255], intensity: 1.0 }),
  sunLight: new SunLight({
    timestamp: Date.UTC(2026, 4, 10, 14),
    color: [255, 240, 220],
    intensity: 1.5,
  }),
})

new MapboxOverlay({ effects: [lightingEffect], layers: [] })
```

**파일: `AdminPolygonExtrusionLayer.ts`, `PolygonExtrusionLayer.ts`**

```ts
material: {
  ambient: 0.35,
  diffuse: 0.6,
  shininess: 32,
  specularColor: [60, 60, 60],
}
```

**효과**: 면 단위 톤 차이 발생 → 박스가 진짜 입체로 보임. 작업 시간 대비 가장 큰 비주얼 점프.

### Phase B: 값 기반 컬러 그라데이션

**새 파일: `frontend/src/utils/colorRamp.ts`**

```ts
type RGB = [number, number, number]
type RampStop = [number, RGB]

const RAMP_RISK: RampStop[] = [
  [0.0, [70, 130, 180]],    // steelblue (안전)
  [0.5, [255, 167, 38]],    // amber (경고)
  [1.0, [239, 83, 80]],     // red (위험)
]

const RAMP_FLOW: RampStop[] = [
  [0.0, [69, 90, 120]],     // 어두운 청록 (유출)
  [0.5, [120, 160, 200]],   // 중립
  [1.0, [123, 208, 141]],   // 연두 (유입)
]

const RAMP_CLOSE: RampStop[] = [
  [0.0, [123, 208, 141]],   // 안정 (낮은 폐업률)
  [0.5, [255, 213, 79]],    // 경계
  [1.0, [255, 138, 101]],   // 위험
]

const RAMP_DEGREE: RampStop[] = [
  [0.0, [38, 70, 92]],      // 어두운 다크블루
  [1.0, [100, 220, 240]],   // 밝은 시안
]

export function rampColor(t: number, ramp: RampStop[]): RGB { ... }
export function getRampForMetric(metric: HeightMetric): RampStop[] { ... }
```

**파일: `AdminPolygonExtrusionLayer.ts`, `PolygonExtrusionLayer.ts`**
- `getFillColor` → 정규화된 값(0-1) 기반 `rampColor` 반환

**효과**: 한 컷에 색만 봐도 "어디가 위험/추천"인지 즉시 파악.

### Phase C: 모서리 + 위쪽 하이라이트

**파일: `AdminPolygonExtrusionLayer.ts`, `PolygonExtrusionLayer.ts`**

```ts
stroked: true,
getLineColor: [255, 255, 255, 60],
lineWidthMinPixels: 1,
```

**효과**: 막대 모서리가 살아남. CSS box-shadow처럼 깔끔.

### Phase D: 진짜 3D 컬럼 — 텍스트 픽토그램 교체

**현재 `CommerceColumnLayer.ts`는 `TextLayer`로 평면 글자 픽토그램 (`人 ! × ●`).**
**→ 완전 교체. 3D 컬럼만 남김.**

**파일: `frontend/src/layers/CommerceColumnLayer.ts` (재작성)**

```ts
import { ColumnLayer } from '@deck.gl/layers'
import { rampColor, getRampForMetric } from '../utils/colorRamp'

const RADIUS_METERS = 80
const ELEVATION_SCALE = 5

export function createCommerceColumnLayer(
  nodes: CommerceNode[],
  metric: HeightMetric,
  progress = 1,
): ColumnLayer<CommerceNode> {
  const values = nodes.map((n) => getMetricValue(n, metric))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const ramp = getRampForMetric(metric)

  return new ColumnLayer<CommerceNode>({
    id: 'commerce-3d-columns',
    data: nodes,
    diskResolution: 16,
    radius: RADIUS_METERS,
    extruded: true,
    elevationScale: ELEVATION_SCALE,
    getPosition: (n) => n.coordinates,
    getElevation: (n) => {
      const t = (getMetricValue(n, metric) - min) / Math.max(1e-9, max - min)
      return t * 600 * progress
    },
    getFillColor: (n) => {
      const t = (getMetricValue(n, metric) - min) / Math.max(1e-9, max - min)
      const [r, g, b] = rampColor(t, ramp)
      return [r, g, b, 220]
    },
    stroked: true,
    getLineColor: [255, 255, 255, 80],
    lineWidthMinPixels: 1,
    material: { ambient: 0.4, diffuse: 0.6, shininess: 64, specularColor: [80, 80, 80] },
    pickable: false,
    updateTriggers: {
      getElevation: [metric, nodes.length, progress],
      getFillColor: [metric, nodes.length],
    },
  })
}
```

**삭제 대상**:
- `buildCommercePictogramData`
- `getPictogramText`, `getPictogramColor`, `getPictogramOffset`
- 관련 테스트 케이스 (`CommerceColumnLayer.test.ts`)

**테스트 갱신**:
- `createCommerceColumnLayer` 반환 타입이 `TextLayer` → `ColumnLayer`
- 데이터 변환 로직 검증 (정규화·램프 적용)

**효과**: 상권 단위에 12-16각 둥근 기둥들이 솟음. 가장 "예쁜 3D" 결과.

### Phase E: 스태거드 애니메이션

**파일: `frontend/src/utils/threeDUtils.ts`**

```ts
export function getFeatureProgress(
  globalProgress: number,
  index: number,
  total: number,
): number {
  const stagger = 0.4
  const delay = (index / Math.max(1, total)) * stagger
  const featureT = (globalProgress - delay) / (1 - stagger)
  return easeOutCubic(Math.max(0, Math.min(1, featureT)))
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}
```

**파일: `AdminPolygonExtrusionLayer.ts`, `PolygonExtrusionLayer.ts`, `CommerceColumnLayer.ts`**
- `getElevation` 호출 시 인덱스 기반 progress 사용

**효과**: 막대가 차례로 솟아오르는 웨이브. 발표 영상에 강력.

### Phase F: 스케일 자동 보정 (선택)

**파일: `frontend/src/utils/threeDUtils.ts`**

```ts
export function getMaxElevation(zoom: number): number {
  const base = 2000
  const zoomFactor = Math.pow(1.5, 11.5 - zoom)
  return Math.min(8000, Math.max(800, base * zoomFactor))
}
```

`Map.tsx` → `use3DView`에 zoom 전달 → 레이어 빌더에 max 인자로 주입.

**효과**: 줌에 따라 막대 비율 자동 조정.

---

## Phase G: 검증

- 시각 비교: 변경 전/후 스크린샷 (Hero shot 4구간 모두)
  - Phase 1 / 2 / 3 / 4 각각 캡처 → `frontend/ux-3d-{before,after}-{hero1..4}.png`
- 단위 테스트:
  - `colorRamp.test.ts`: 보간 정확도 (0.0/0.5/1.0 stops)
  - `threeDUtils.test.ts` 갱신: `getFeatureProgress` 스태거 타이밍
  - `CommerceColumnLayer.test.ts` 재작성: ColumnLayer 반환·정규화·머티리얼
  - `AdminPolygonExtrusionLayer.test.ts`, `PolygonExtrusionLayer.test.ts`: 컬러램프 적용 검증
- 성능: 25개 자치구 + 라이팅 + 진짜 3D 컬럼 적용 시 60fps 유지 (Chrome DevTools)
- 빌드: vitest 전체 통과 + 빌드 오류 0
- preflight 31/31 ALL PASS 유지

---

## 의존성

- 이미 설치: `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/mapbox`
- 신규 의존성 없음 (컬러 보간 직접 구현)

## 리스크

| 등급 | 리스크 | 완화 |
|---|---|---|
| MEDIUM | Phase D 픽토그램 제거 → Hero shot 시연 영상이 픽토그램 사용 중일 가능성 | `docs/hero_shot_scenario.md` 사전 검토. 사용 중이면 영상 재촬영 (D-5 일정 영향) |
| MEDIUM | Phase B 컬러램프 변경 → 단절 위험선(빨강) 시각 충돌 | 메트릭별 램프 분리 — `griScore`만 빨강 사용 |
| MEDIUM | Phase A 라이팅 도입 시 일부 환경에서 GPU 부하 | Chrome/Firefox/Safari 검증, 모바일은 라이팅 강도 낮춤 |
| LOW | 진짜 3D 컬럼 도입 시 클릭 가능 영역 변경 (현재 픽토그램은 `pickable: false`) | 컬럼도 `pickable: false` 유지 — 노드 클릭은 별도 `CommerceNodeLayer` |

## 우선순위 (시간 vs 효과)

| Phase | 시간 | 비주얼 임팩트 | 결정 |
|---|---|---|---|
| **A. 라이팅** | 1.5h | ★★★★★ | 필수 |
| **B. 컬러램프** | 2h | ★★★★★ | 필수 |
| **C. 모서리** | 0.5h | ★★ | 필수 (빠르고 좋음) |
| **D. 진짜 3D 컬럼** | 2h | ★★★★ | 필수 (사용자 결정) |
| E. 스태거 애니 | 1.5h | ★★★ | 시간 여유 시 |
| F. 자동 스케일 | 1h | ★★ | 시간 여유 시 |

**필수 조합 A+B+C+D = 약 6시간** — 발표 영상에 바로 쓸 수 있는 수준.

## 복잡도: MEDIUM

---

## 다음 액션

1. Hero shot 시연 영상 픽토그램 사용 여부 사전 확인 (`docs/hero_shot_scenario.md`)
2. `/tdd` — TDD로 Phase A부터 구현
3. 또는 직접 "Phase A 시작" 명령
