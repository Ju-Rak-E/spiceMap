# spiceMap 프론트엔드 지도 UX 계획

> 작성일: 2026-04-29  
> 대상: `frontend/src/` — MapLibre GL + Deck.gl 기반 시각화 레이어  
> MVP 범위: 강남구 · 관악구 2개 자치구  
> 기반 문서: `docs/map_ui_redesign.md`

---

## 현황 요약 (코드 기준)

이 문서는 범용 기획서를 spiceMap 코드 현실에 맞게 재작성한 것이다.  
이미 구현된 것과 아직 없는 것을 명확히 구분한다.

| 항목 | 구현 파일 | 상태 |
|------|-----------|------|
| 행정동 경계 폴리곤 | `BoundaryLayerManager.ts` | ✅ 구현됨 |
| OD 흐름 베지어 곡선 | `ODFlowLayer.ts` + `flowBezier.ts` | ✅ 구현됨 |
| 상권 노드 (ScatterplotLayer) | `CommerceNodeLayer.ts` | ✅ 구현됨 |
| 줌 비례 노드 크기 조절 | `radiusUnits: 'meters'` | ✅ 자동 적용 중 |
| 이동목적별 색상 구분 | `PURPOSE_COLORS` | ✅ 구현됨 |
| 상권 유형별 색상 | `COMMERCE_COLORS` | ✅ 구현됨 |
| 호버/클릭 인터랙션 | `CommerceNodeLayer` onHover/onClick | ✅ 구현됨 |
| 줌 구간별 레이어 전환 | — | ❌ 미구현 |
| 파티클 흐름 애니메이션 방향 화살표 | `FlowParticleLayer.ts` | 🔍 확인 필요 |
| 특정 POI 마커 (시장·백화점 등) | — | ❌ MVP 범위 외 |
| 상권 경계 폴리곤 | — | ❌ 데이터 미적재 (블로커) |

---

## 1. 영역 표시 및 줌 비례 크기 자동 조절

### 1.1 현재 구현 상태

**행정동 경계 (`BoundaryLayerManager.ts`)**

MapLibre GL의 fill/line 레이어를 사용한다. 줌 레벨에 따른 크기 조절은 MapLibre가 자동 처리한다. 현재 구조:

- `admin-boundary-fill`: 배경 채우기 (fillOpacity 기본값 0.3)
- `admin-boundary-line`: 경계선
- `admin-boundary-highlight`: 선택 자치구 강조선 (districtFilter 기반)

**상권 노드 (`CommerceNodeLayer.ts`)**

```ts
radiusUnits: 'meters'  // 줌과 무관하게 지리적 미터 단위로 유지
MIN_RADIUS = 300       // 최소 반경 300m
MAX_RADIUS = 1500      // 최대 반경 1500m (netFlow 기반 결정)
```

`radiusUnits: 'meters'`이므로 줌 아웃 시 노드가 작아지고, 줌 인 시 커지는 동작이 이미 자동 적용되어 있다.

### 1.2 개선 필요 항목

**문제 1: 줌 레벨별 경계선 두께 미조정**

현재 경계선 두께가 고정값이다. 줌 아웃 시 강남·관악 전체가 보이는 상황에서 선이 너무 굵거나 얇을 수 있다.

```js
// boundaryLayerConfig.ts에서 MapLibre 표현식으로 대응 가능
'line-width': ['interpolate', ['linear'], ['zoom'],
  10, 0.5,   // 줌 10 → 0.5px
  13, 1.5,   // 줌 13 → 1.5px
  16, 3.0    // 줌 16 → 3.0px
]
```

**문제 2: 줌 레벨별 레이어 가시성 전환 없음**

줌 아웃(10~11): 자치구 경계만 표시, 상권 노드 숨김  
줌 중간(11~13): 상권 노드 등장, 행정동 경계 희미하게  
줌 인(13+): 상권 경계 폴리곤 등장 (데이터 적재 후)

이 전환 로직이 현재 없다. `BoundaryLayerManager`에 `onZoom` 핸들러를 추가하거나, `Map.tsx`에서 줌 레벨 상태를 관리해야 한다.

**문제 3: 노드 반경이 MAX_ABS_FLOW 기준으로만 결정됨**

```ts
const MAX_ABS_FLOW = 1200  // 이 값이 실제 데이터와 맞는지 검증 필요
```

데이터 적재 후 실제 `netFlow` 분포를 확인하여 상수를 조정해야 한다. 현재는 하드코딩.

### 1.3 상권 경계 폴리곤 (블로커)

`commerce_boundary` 테이블이 미적재 상태다. 적재 완료 후 아래 레이어가 추가되어야 한다.

- 줌 13 이상에서만 표시 (작은 화면에선 노이즈)
- 선택된 상권은 fill + 테두리 강조
- `CommerceBoundary.__tablename__`의 `geom`을 GeoJSON으로 API 서빙 필요

---

## 2. OD 이동 구간 곡선 표시

### 2.1 현재 구현 상태

`flowBezier.ts` + `ODFlowLayer.ts`에 2차 베지어 곡선이 이미 구현되어 있다.

```ts
CURVE_FACTOR = 0.45   // 곡률 강도 (0 = 직선, 1 = 매우 휨)
SEGMENTS = 32          // 곡선 분할 수 (부드러움)
MIN_WIDTH = 1.5        // 최소 선 두께 (px)
MAX_WIDTH = 8          // 최대 선 두께 (px, volume 비례)
```

이동목적별 색상 (`PURPOSE_COLORS`):

| 목적 | 색상 | 색상코드 |
|------|------|---------|
| 출근 | 하늘색 | `[41, 182, 246]` |
| 쇼핑 | 앰버 | `[255, 167, 38]` |
| 여가 | 보라 | `[171, 71, 188]` |
| 귀가 | 초록 | `[102, 187, 106]` |

알파값은 `140` (고정) — 겹침 시 합산으로 자연스러운 밀도 표현이 된다.

### 2.2 개선 필요 항목

**문제 1: 흐름 방향 표현 없음**

현재 `PathLayer`는 곡선만 그린다. 출발지→도착지 방향을 알 수 없다.

개선 옵션:
- `PathLayer`에 화살표 캡 추가 (`capRounded: true`는 방향 표현이 아님)
- `FlowParticleLayer`가 이 역할을 담당해야 함 → 현재 구현 상태 확인 필요
- 대안: 곡선 시작점에 작은 원, 끝점에 삼각형 마커 추가 (IconLayer 병용)

**문제 2: 선택된 상권에 연결된 흐름만 강조하는 필터 없음**

상권 클릭 시 해당 상권으로 들어오거나 나가는 흐름만 남기고 나머지를 희미하게 처리해야 직관적이다.

```ts
// 개선 방향 (ODFlowLayer.ts)
getColor: (p) => {
  if (selectedCommId === null) return p.color
  const isRelated = p.originCommCd === selectedCommId || p.destCommCd === selectedCommId
  return isRelated ? p.color : [...p.color.slice(0,3), 20]  // 비관련 흐름은 거의 투명
}
```

**문제 3: CURVE_FACTOR 0.45가 단거리 흐름에서 지나치게 휨**

강남·관악 내부처럼 거리가 짧은 이동 구간은 곡률이 과도하게 보일 수 있다.  
거리에 비례해 `factor`를 줄이는 방식이 더 자연스럽다.

```ts
// flowBezier.ts 개선안
export function getControlPoint(src, tgt, baseFactor = CURVE_FACTOR) {
  const dist = Math.sqrt(...)
  const factor = Math.min(baseFactor, 0.3 + dist * 0.001)  // 거리 짧을수록 곡률 감소
  ...
}
```

**문제 4: `MAX_VOLUME = 10000` 하드코딩**

실제 `od_flows_aggregated`의 `trip_count_sum` 분포를 확인 후 조정 필요.

---

## 3. 상권 노드 표시 및 특정 지점 마커

### 3.1 현재 구현: 상권 노드

`CommerceNodeLayer.ts`의 `ScatterplotLayer`가 핵심이다.

**크기 결정 로직**: `netFlow` 절대값 기반 (순유입이 클수록 큰 원)  
**색상 결정 로직**: `CommerceNode.type` 기반 (Module D 5유형)  
**강조 조건**: `degreeCentrality` 상위 10% 또는 `selectedId` 일치

```ts
// 현재 5가지 상권 유형 색상 (COMMERCE_COLORS)
// Module D에서 분류: 흡수형 성장 / 침체형 / 관광 집중 / 야간 특화 / 복합형 (예시)
```

### 3.2 호버/클릭 인터랙션 현황

`onHover`, `onClick` 콜백이 이미 연결되어 있다.  
`map_ui_redesign.md` 결정사항:
- hover → 미니 해설 팝업
- click → 우측 상세 카드 고정 + 관련 흐름 강조

현재 `CommerceDetailPanel.tsx`가 상세 카드 역할을 담당한다.

### 3.3 개선 필요 항목

**문제 1: 노드 타입 기호 표현 없음**

현재는 색상으로만 유형을 구분한다. `map_ui_redesign.md`에서 `색 + 기호 + 이름 + 1줄 설명` 구조를 명시했으나, 지도 위 노드 자체에 기호 표현이 없다.

개선 방향:
- Deck.gl `TextLayer`를 `ScatterplotLayer`와 병용, 줌 14 이상에서만 상권명 표시
- 또는 `IconLayer`로 유형별 SVG 아이콘 (줌 15+)
- **단, MVP에서는 색상 구분만으로 충분. 기호는 Week 4 고도화 항목으로 이월.**

**문제 2: GRI 위험도 시각 표현이 색상과 분리됨**

현재 색상은 상권 유형을 나타낸다. GRI 위험도(높음=빨강)는 색상에 반영되지 않는다.  
심사위원이 한눈에 "어디가 위험한가"를 파악하려면 위험도와 색상이 연결되어야 한다.

선택지:
- A) 노드 테두리 색상을 GRI 위험도로 표현 (중심 색상=유형, 테두리=위험도)
- B) 노드 크기는 유동량, 색상은 GRI 위험도로 완전 전환

`map_ui_redesign.md`의 색상 의미 규칙과 정합성을 맞춰야 한다.

### 3.4 특정 POI 표시 (시장·백화점 등)

MVP 범위 외다. 이유:
- `schema.md` 기준 POI 테이블이 없음
- 강남·관악에 한정한 상권 분석이 목적이며, 개별 POI는 단순 지도 기능
- 상권 코드(`trdar_cd`) 단위의 분석이 본 프로젝트의 단위이므로 POI 세분화는 불필요

**Week 4 이후 고도화 항목**으로 이월. 필요 시 별도 테이블 설계 필요.

---

## 4. 인터랙션 우선순위 및 구현 순서

MVP 제출 전까지 반드시 구현해야 하는 것과 이후로 이월할 것을 구분한다.

### Must (Week 3~4)

1. **상권 클릭 시 관련 OD 흐름 강조** — `ODFlowLayer`에 selectedId 필터 추가
2. **줌 레벨별 경계선 두께 보간** — `boundaryLayerConfig.ts` MapLibre 표현식
3. **노드 반경 상수 실측 조정** — 데이터 적재 후 `MAX_ABS_FLOW` 값 검증
4. **호버 미니 해설 팝업 완성** — `CommerceDetailPanel` hover 모드

### Should (Week 4)

5. **거리 비례 곡률 조정** — `flowBezier.ts` factor 동적화
6. **줌 레벨별 레이어 가시성 전환** — `Map.tsx` zoom 상태 관리
7. **상권 경계 폴리곤 레이어** — `commerce_boundary` 데이터 적재 선행 필요

### 고도화 이월

- 상권 노드 SVG 아이콘 (TextLayer/IconLayer)
- 특정 POI 마커 (시장·백화점)
- 실시간 흐름 애니메이션 강화 (FlowParticleLayer 방향 표현)
- 지도 내 검색 기능

---

## 5. 검증 기준

`map_ui_redesign.md`의 검증 기준을 그대로 따른다.

- 5초 이내에 "무엇을 보고 있는가 / 어떤 상권이 위험한가"를 말할 수 있어야 함
- 선택 상권과 일반 상권의 구분이 명확해야 함
- `npm test` + `npm run build` 통과
