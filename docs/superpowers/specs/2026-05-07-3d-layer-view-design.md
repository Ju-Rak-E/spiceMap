# 3D 레이어 뷰 설계 스펙

**날짜**: 2026-05-07  
**브랜치**: `feature/week5-3d-layer`  
**범위**: 강남·관악 상권 데이터를 높낮이로 시각화하는 3D 레이어 토글 기능

---

## 개요

기존 색상 단일 채널 시각화에 **높이(elevation)** 채널을 추가한다. 사용자가 플로팅 컨트롤로 폴리곤 돌출 / 기둥 / OFF를 전환하고, 높이 기준 지표를 선택할 수 있다. 3D 모드 진입 시 카메라가 자동으로 45° 기울어진다.

---

## 기능 요구사항

### 3D 모드 3종
| 모드 | 표현 | Deck.gl 레이어 |
|------|------|----------------|
| OFF | 기존 평면 뷰 | 없음 |
| 폴리곤 | 상권 경계 폴리곤을 지표 기준으로 돌출 | `PolygonExtrusionLayer` |
| 기둥 | 상권 노드 위치에 원기둥 | `CommerceColumnLayer` |

### 높이 기준 지표 (사용자 선택)
- 상권 위험도 (GRI) — 기본값
- 정책 우선순위 (priority_score)
- 순유입 인구 (net_flow)
- 폐업률 (close_rate)

### 카메라 동작
- 폴리곤/기둥 선택 시: `map.flyTo({ pitch: 45, duration: 800 })` 자동 실행
- 이후 사용자가 드래그로 pitch·bearing 자유 조절
- OFF 전환 시: `map.flyTo({ pitch: 0, duration: 600 })` 복귀

### 플로팅 컨트롤 UI
- 위치: 지도 우하단 (absolute, bottom: 24px, right: 24px, z-index: 15)
- OFF 상태: 패널 테두리 기본 (`#304251`)
- 활성 상태: 초록 glow 테두리 (`#43A047`)
- 지표 드롭다운: 폴리곤/기둥 모드일 때만 표시

---

## 아키텍처

### 신규 파일

```
frontend/src/
├── components/ThreeDViewControl.tsx   — 플로팅 패널 UI
├── hooks/use3DView.ts                 — 모드·지표 상태 + 카메라 제어
├── layers/PolygonExtrusionLayer.ts    — 상권 경계 3D 돌출
└── layers/CommerceColumnLayer.ts      — 상권 노드 기둥
```

### 수정 파일
```
frontend/src/components/Map.tsx        — 컴포넌트·레이어·훅 연결
```

---

## 컴포넌트 상세

### `use3DView.ts`
```ts
type ThreeDMode = 'off' | 'polygon' | 'column'
type HeightMetric = 'griScore' | 'priorityScore' | 'netFlow' | 'closeRate'

function use3DView(mapRef: React.RefObject<maplibregl.Map>): Use3DViewReturn
```
- `mapRef`는 `Map.tsx`에서 생성한 ref를 prop으로 전달
- `setMode` 호출 시 내부에서 `mapRef.current?.flyTo` 실행
- off → polygon/column: pitch 45, duration 800ms
- polygon/column → off: pitch 0, duration 600ms
- polygon ↔ column 전환: 카메라 유지

### `PolygonExtrusionLayer.ts`
- 입력: `nodes: CommerceNode[]`, `boundaries: GeoJSON`, `metric: HeightMetric`
- `getElevation`: `(value - min) / (max - min) * 500` 선형 스케일 (0~500m), min/max는 전달받은 nodes 배열 기준
- `getPolygon`: `comm_id` 기준으로 boundary feature 매핑
- `getFillColor`: `COMMERCE_COLORS[node.type].fill` (rgba)
- `extruded: true`, `wireframe: false`

### `CommerceColumnLayer.ts`
- 입력: `nodes: CommerceNode[]`, `metric: HeightMetric`
- `getPosition`: `[node.lng, node.lat]`
- `getElevation`: `(value - min) / (max - min) * 400` 선형 스케일 (0~400m), min/max는 nodes 배열 기준
- `getFillColor`: `COMMERCE_COLORS[node.type].fill`
- `diskResolution: 6` (육각형), `radius: 80`

### `ThreeDViewControl.tsx`
- props: `{ mode, metric, onModeChange, onMetricChange }`
- 3-way 토글 버튼 (OFF / 폴리곤 / 기둥)
- 지표 `<select>` — mode가 off일 때 숨김

---

## 데이터 의존성

| 데이터 | 소스 | 현황 |
|--------|------|------|
| 상권 경계 GeoJSON | `public/data/mock_commerce_boundary.geojson` | 기존 존재 |
| 상권 노드 | `useCommerceData` 훅 | 기존 존재 |
| 지표값 | `CommerceNode` 타입 | 기존 존재 |

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

- [ ] OFF/폴리곤/기둥 전환 시 레이어 변경 확인
- [ ] 지표 변경 시 높이 즉시 반영
- [ ] 폴리곤/기둥 ON → pitch 45° 자동 전환
- [ ] OFF → pitch 0° 복귀
- [ ] 기존 vitest 회귀 없음 (323개)
- [ ] `npm run build` 성공
