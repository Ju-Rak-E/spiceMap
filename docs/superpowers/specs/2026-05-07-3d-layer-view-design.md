# 3D 레이어 뷰 설계 스펙

**날짜**: 2026-05-07  
**브랜치**: `feature/week5-3d-layer`  
**범위**: 강남·관악 상권 데이터를 높낮이·색상·픽토그램으로 시각화하는 상권 3D 레이어 기능

---

## 개요

기존 평면 상권 지도에 **높이(elevation)** 채널을 추가한다. 사용자는 지도 우하단 `ThreeDViewControl`에서 OFF / 상권 3D를 전환하고, 높이 기준 지표를 선택한다. 상권 3D 진입 시 `use3DView`가 MapLibre 카메라를 자동으로 45° pitch, -20° bearing으로 이동시키고, Deck.gl `PolygonExtrusionLayer`와 `CommerceColumnLayer`를 함께 렌더링한다.

---

## 기능 요구사항

### 3D 모드 2종
| 모드 | 표현 | Deck.gl 레이어 |
|------|------|----------------|
| OFF | 기존 평면 뷰 | 없음 |
| 상권 3D | 상권 경계 폴리곤 돌출 + 상권 노드 원기둥 동시 표현 | `PolygonExtrusionLayer`, `CommerceColumnLayer` |

### 높이 기준 지표 (사용자 선택)
- 상권 위험도 (GRI) — 기본값
- 순유입 인구 (net_flow)
- 폐업률 (close_rate)
- 연결 중심성 (degree_centrality)

### 카메라 동작
- 상권 3D 선택 시: `map.flyTo({ pitch: 45, bearing: -20, duration: 800 })` 자동 실행
- 이후 사용자가 드래그로 pitch·bearing 자유 조절
- OFF 전환 시: `map.flyTo({ pitch: 0, bearing: 0, duration: 600 })` 복귀

### 돌출 애니메이션
- ON: `EXTRUDE_IN_MS = 600`
- OFF: `EXTRUDE_OUT_MS = 300`
- 보간: `interpolateProgress` + `easeOutCubic`
- `PolygonExtrusionLayer`는 `extrudeProgress`를 elevation에 곱해 0 → 목표 높이로 부드럽게 상승

### 플로팅 컨트롤 UI
- 위치: 지도 우하단 (absolute, bottom: 24px, right: 24px, z-index: 15)
- OFF 상태: 패널 테두리 기본 (`#304251`)
- 활성 상태: 초록 glow 테두리 (`#43A047`)
- 지표 드롭다운: 상권 3D 모드일 때만 표시
- 지표 픽토그램 카드: `getMetricPictogramStats`로 지표 강도에 따라 1~3개, 10~22px 범위로 표시
- 반응형: `Map.tsx`에서 컨테이너 너비 520px 이상일 때 컨트롤 표시

---

## 아키텍처

### 구현 파일

```
frontend/src/
├── components/ThreeDViewControl.tsx   — 플로팅 패널 UI
├── hooks/use3DView.ts                 — 모드·지표 상태 + 카메라 제어
├── layers/PolygonExtrusionLayer.ts    — 상권 경계 3D 돌출
├── layers/CommerceColumnLayer.ts      — 상권 노드 기둥
├── utils/threeDUtils.ts               — 지표값 추출·높이 정규화·애니메이션 보간
├── utils/colorRamp.ts                 — 지표별 색상 램프
└── utils/metricPictogram.ts           — 지표 픽토그램 강도 계산
```

### 수정 파일
```
frontend/src/components/Map.tsx        — 컴포넌트·레이어·훅·3D hover 연결
```

---

## 컴포넌트 상세

### `use3DView.ts`
```ts
type ThreeDMode = 'off' | 'commerce'
type HeightMetric = 'griScore' | 'netFlow' | 'closeRate' | 'degreeCentrality'

function use3DView(mapRef: MutableRefObject<maplibregl.Map | null>): Use3DViewReturn
```
- 초기 상태: `mode = 'off'`, `metric = 'griScore'`, `extrudeProgress = 0`
- `/data/mock_commerce_boundary.geojson`을 fetch해 `BoundaryFeature[]`로 변환
- `setMode('commerce')`: progress 애니메이션 시작 + `flyTo({ pitch: 45, bearing: -20, duration: 800 })`
- `setMode('off')`: progress 하강 애니메이션 시작 + `flyTo({ pitch: 0, bearing: 0, duration: 600 })`
- unmount 시 `requestAnimationFrame` 정리

### `PolygonExtrusionLayer.ts`
- 입력: `nodes: CommerceNode[]`, `boundaries: BoundaryFeature[]`, `metric: HeightMetric`, `progress`
- `buildPolygonExtrusionData`에서 `node.id`와 `boundary.comm_id`를 조인
- `getElevation`: `normalizeElevation(value, min, max, 3000) * progress`
- `getFillColor`: `getRampForMetric(metric)` + `rampColor(t, ramp)` 결과를 RGBA로 적용
- `stroked: true`, `lineWidthUnits: 'pixels'`, `material` 적용으로 경계와 입체감 보강
- `onHover`가 전달된 경우에만 `pickable: true`

### `CommerceColumnLayer.ts`
- 입력: `nodes: CommerceNode[]`, `metric: HeightMetric`
- `getPosition`: `node.coordinates`
- `getElevation`: 정규화 비율 `t * 600 * progress`
- `getFillColor`: 지표별 색상 램프 RGBA
- `diskResolution: 16`, `radius: 80`, `extruded: true`
- `stroked: true`, `material` 적용으로 원기둥 가장자리와 조명 표현
- `onHover`가 전달된 경우에만 `pickable: true`

### `ThreeDViewControl.tsx`
- props: `{ mode, metric, nodes, onModeChange, onMetricChange }`
- 2-way 토글 버튼 (OFF / 상권 3D)
- 지표 `<select>` + 4개 지표 픽토그램 카드
- 지표별 시각 언어
  - 상권 위험도: `!`, 빨강 계열
  - 순유입 인구: `사람`, 파랑 계열
  - 폐업률: `닫힘`, 주황 계열
  - 연결 중심성: `연결`, 초록 계열

### `Map.tsx` 통합
- `const threeDView = use3DView(mapRef)`
- `is3DActive = threeDView.mode !== 'off'`
- 상권 3D 활성 시 기존 상권 노드, 클러스터, 상세 패널 hover를 숨기고 3D hover card만 표시
- `threeDLayers`에서 경계 데이터가 준비되면 다음 두 레이어를 동시에 추가
  - `createPolygonExtrusionLayer(nodes, boundaries, metric, extrudeProgress, handleCommerceHover)`
  - `createCommerceColumnLayer(nodes, metric, 1, handleCommerceHover)`
- hover 시 `getMetricLabel`, `formatMetricValue`를 사용해 상권명과 현재 지표값 표시

---

## 데이터 의존성

| 데이터 | 소스 | 현황 |
|--------|------|------|
| 상권 경계 GeoJSON | `public/data/mock_commerce_boundary.geojson` | 기존 존재 |
| 상권 노드 | `useCommerceData` 훅 | 기존 존재 |
| 지표값 | `CommerceNode` 타입 | 기존 존재 |

---

## 페르소나 반영 기준

이 기능은 특정 행정 실무자만을 위한 화면이 아니라, 기존 페르소나 문서의 네 사용 맥락을 동시에 지원하는 보조 시각화다.

| 페르소나 | 관련 문서 | 3D 뷰가 답해야 하는 질문 |
|---|---|---|
| 서울시 정책 담당자 | `docs/brainstorm_user.md` | 어느 상권이 전체적으로 위험한가? |
| 자치구 경제과 담당자 | `docs/brainstorm_user.md`, `docs/FR_Role_Workflow.md` | 우리 구 안에서 현장 확인이 필요한 상권은 어디인가? |
| 예비 창업자·소상공인 | `docs/preview/persona_kim_misuk.md`, `docs/superpowers/specs/2026-05-10-llm-startup-advisor-design.md` | 들어가도 되는 상권인가, 피해야 할 신호가 있는가? |
| 경진대회 심사위원 | `docs/brainstorm_user.md` | 이 시각화가 신뢰 가능한 데이터와 실제 기능으로 연결되어 있는가? |

---

## 활용(계획)방안

### 1. 예비 창업자·소상공인: 입지 위험 신호를 쉽게 비교
- 김미숙 페르소나처럼 통계 용어에 익숙하지 않은 사용자는 `상권 위험도`, `순유입 인구`, `폐업률`을 전환하며 후보 상권의 위험 신호를 눈으로 비교할 수 있다.
- `ThreeDViewControl`의 픽토그램 카드는 지표 강도를 1~3개 크기 변화로 요약하므로, 숫자보다 먼저 “위험이 큰 곳”, “사람이 들어오는 곳”, “폐업률이 높은 곳”을 구분하게 한다.
- `CommerceColumnLayer`는 상권 중심점에 기둥을 세우기 때문에, 사용자가 지도에서 후보지를 찍어 보며 “이 동네는 좋아 보이지만 위험도가 높다” 같은 회피 판단을 할 수 있다.

### 2. 창업 상담·지원기관: 설명 가능한 상담 보조 화면
- 상담 담당자는 `AI Startup Advisor` 결과와 3D 뷰를 함께 사용해 추천/주의/비추천 상권의 이유를 시각적으로 설명할 수 있다.
- `handleCommerceHover`가 상권명과 현재 지표값을 보여주므로, 상담 중 상권을 가리키며 GRI 점수, 순유입 인구, 폐업률을 즉시 확인할 수 있다.
- 생성형 AI 해설만으로 결론을 내리지 않고, 실제 구현된 `CommerceNode` 지표와 Deck.gl 레이어를 근거 화면으로 제시할 수 있다.

### 3. 자치구 경제과: 현장 확인 대상 압축
- 자치구 담당자는 담당 구 안에서 `griScore` 또는 `closeRate` 기준으로 높게 솟는 상권을 먼저 확인하고, 현장 방문·상담·사업 후보를 좁힐 수 있다.
- `PolygonExtrusionLayer`는 상권 경계 전체를 돌출시키고, `CommerceColumnLayer`는 노드 위치를 세우므로 “권역 전체가 위험한 곳”과 “특정 중심 상권이 두드러지는 곳”을 구분하는 데 쓴다.
- 3D 활성 시 기존 노드·클러스터·상세 패널을 숨기므로, 현장 회의나 내부 공유 화면에서 복잡한 정보를 줄이고 상권 간 상대 차이에 집중할 수 있다.

### 4. 심사위원·발표 시연: 기능 임팩트와 신뢰성 전달
- `use3DView`가 3D 진입 시 pitch 45°, bearing -20°로 자동 전환하므로 발표자는 별도 카메라 조작 없이 동일한 구도에서 시연을 시작할 수 있다.
- `extrudeProgress` 애니메이션은 평면 지도에서 상권이 솟아오르는 장면을 만들어, “지표가 높이로 변환된다”는 핵심을 짧은 발표 시간 안에 전달한다.
- `material`, `stroked`, 지표별 `colorRamp`가 적용되어 발표 화면에서도 높이·경계·색상 의미가 분리되어 보인다.

---

## 기대 효과

### 1. 비전문가의 상권 해석 부담 감소
- 예비 창업자와 소상공인은 `net_flow`, `degree_centrality` 같은 내부 지표명을 직접 해석하지 않아도 높이, 색상, 픽토그램으로 위험·유입·연결성을 먼저 파악할 수 있다.
- hover card에는 `formatMetricValue`가 적용되어 점수, 명, %, 중심성 단위가 지표별로 맞춰 표시된다.

### 2. 창업 의사결정의 회피 판단 강화
- 창업 페르소나의 핵심 질문은 “어디가 좋은가”뿐 아니라 “지금 들어가면 안 되는 이유가 있는가”다.
- `griScore`와 `closeRate`를 높이로 비교하면, 유동인구가 있어 보여도 위험도나 폐업률이 높은 상권을 상담·검토 단계에서 걸러낼 수 있다.

### 3. 현장 담당자의 후보 압축 시간 단축
- 모든 높이는 현재 `nodes` 배열의 min/max 기준으로 정규화되므로, 같은 화면 안에서 상권 간 상대 비교 기준이 일관된다.
- 폴리곤과 기둥이 동일 metric을 공유해 경계 단위와 노드 단위 해석이 분리되지 않는다.

### 4. 발표·심사 대응력 향상
- 단순 색상 지도보다 높이 차이가 추가되어 3분 발표에서 “무엇이 다른가”를 빠르게 보여줄 수 있다.
- `use3DView.test.ts`, `ThreeDViewControl.test.tsx`, `PolygonExtrusionLayer.test.ts`, `CommerceColumnLayer.test.ts`에서 모드 전환, metric 변경, hover pickable, progress elevation, 빈 배열 처리 등을 검증해 시연 안정성을 높인다.

### 5. 향후 사용자별 화면 확장 기반 확보
- `HeightMetric`, `getMetricValue`, `getRampForMetric`이 분리되어 있어 창업자용 지표와 행정용 지표를 나눠 추가할 수 있다.
- `BoundaryFeature`와 `CommerceNode` 조인 구조를 유지하면 강남·관악 mock 경계에서 서울 전역 상권 경계로 데이터 범위를 넓힐 수 있다.

---

## 업무 분장

| 파일 | 담당 | 사유 |
|------|------|------|
| `ThreeDViewControl.tsx` | Claude | UI 상태 설계·UX 판단 |
| `use3DView.ts` | Claude | 카메라 flyTo 타이밍·상태 설계 |
| `Map.tsx` 연결 | Claude | 멀티 파일 통합 |
| `PolygonExtrusionLayer.ts` | Codex | Deck.gl 레이어 단일 파일, 명세 기반 |
| `CommerceColumnLayer.ts` | Codex | 동일 |

---

## 완료 기준

- [x] OFF/상권 3D 전환 시 레이어 변경 확인
- [x] 지표 변경 시 높이·색상 즉시 반영
- [x] 상권 3D ON → pitch 45°, bearing -20° 자동 전환
- [x] OFF → pitch 0°, bearing 0° 복귀
- [x] 3D hover card용 name/value 데이터 포함
- [x] 레이어 단위 vitest 작성
- [ ] 전체 `npm run build` 성공 확인
