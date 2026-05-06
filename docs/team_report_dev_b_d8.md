# Dev-B Frontend Report - Flow Barrier UX Update (2026-05-05)

> 작성: Codex
> 대상: Dev-B frontend handoff
> 기준 브랜치: `kbh`
> 범위: 강남구 barrier 미표시, 단절 토글 지연, 단절 영역 해석 UX, 선택 상권 fallback

---

## 요약

이번 업데이트는 발표 시연에서 `흐름 단절` 토글을 켰을 때 사용자가 바로 의미를 이해하도록 프론트 흐름을 정리한 작업이다.

- 강남구 단절이 관악구 상위 점수에 밀려 안 보이는 문제를 자치구별 fetch + 균형 선택으로 완화했다.
- 단절 route는 토글 시점이 아니라 페이지 로드 후 바로 prefetch하도록 바꿨다.
- 지도 위 단절선만으로는 의미가 부족해서 `흐름 단절 감지` 요약 카드를 추가했다.
- 선택 상권에 직접 연결된 단절이 없을 때 레이어가 사라지던 문제를 전체 overview 유지 방식으로 고쳤다.
- 현재 데이터에는 강남구-관악구 직접 단절 pair가 없으므로 UI 문구에 해석 범위를 명시했다.

## 변경 파일

| 파일 | 변경 내용 |
| --- | --- |
| `frontend/src/hooks/useBarriers.ts` | `districts` 인자 추가, 자치구별 `/api/barriers?gu=...` 병렬 fetch, id 기준 dedupe |
| `frontend/src/hooks/useBarriers.test.ts` | gu 없는 fetch, 1/2개 자치구 fetch, dedupe, mock fallback 테스트 |
| `frontend/src/utils/barrierSelection.ts` | severity balanced 선택 로직 분리, 선택 자치구별 quota 보장 |
| `frontend/src/utils/barrierSelection.test.ts` | severity ranking, 자치구 quota, 한쪽 부족 시 fallback 테스트 |
| `frontend/src/components/Map.tsx` | selectedDistricts 전달, route prefetch, 단절 카드, 선택 상권 fallback, 카드 위치 조정 |
| `frontend/src/layers/FlowBarrierLayer.ts` | 단절선 굵기/투명도 상향으로 시각적 존재감 강화 |
| `frontend/src/layers/FlowBarrierLayer.test.ts` | 변경된 단절선 width expectation 반영 |

## 주요 동작

### 1. 자치구별 barrier fetch

기존에는 `/api/barriers` 전체 응답을 가져온 뒤 프론트에서 8개로 잘랐다. 이 방식은 점수 상위가 특정 자치구에 몰리면 강남구 단절이 누락될 수 있었다.

현재는 선택된 자치구가 있으면 자치구별로 병렬 요청한다.

```text
/api/barriers?quarter=2025Q4&gu=강남구
/api/barriers?quarter=2025Q4&gu=관악구
```

결과는 flat merge 후 `barrier.id` 기준으로 dedupe한다.

### 2. 균형 선택

`selectBalancedBarriers`를 `Map.tsx`에서 분리해 테스트 가능한 유틸로 만들었다. 선택 자치구가 있으면 각 자치구 quota를 먼저 채우고, 한쪽에 후보가 부족하면 나머지 자리를 전체 ranked barrier로 채운다.

### 3. route prefetch

기존:

```ts
useBarrierRoutes(selectedQuarter, showBarriers, selectedBarrierNodeId)
```

현재:

```ts
useBarrierRoutes(selectedQuarter, true, barrierRouteNodeId)
```

단절 토글을 켜기 전에 route 요청이 시작되므로, 시연 중 토글 ON 후 5~15초 대기하는 현상을 줄인다.

### 4. 단절 카드 UX

토글 ON 시 지도 위에 `흐름 단절 감지` 카드가 표시된다.

카드 내용:

- 표시 중인 단절 수
- 심각/주의/관찰 건수
- 평균 단절 강도
- 영향 흐름량
- 상위 3개 단절 구간
- 해석 문구

사용자 오해 방지 문구:

```text
현재 표시는 각 자치구 내부 또는 인접 상권의 이동량 급감 구간입니다.
```

로컬 API 기준 `강남구 <-> 관악구` 직접 단절 pair는 0건이다. 따라서 발표에서는 "두 구 사이 단절"이 아니라 "각 자치구 내부 또는 인접 상권의 이동량 급감 구간"으로 설명해야 한다.

### 5. 카드 위치

단절 카드는 우측 `검증 보고` 영역과 겹치지 않도록 좌측 기준으로 배치한다.

- 기본: 좌측 상단
- 상권 상세 패널 열림: 상세 패널 오른쪽
- 클러스터 목록 패널 열림: 클러스터 패널 오른쪽

### 6. 선택 상권 fallback

이전에는 상권을 선택하면 "선택 상권과 직접 연결된 단절"만 표시했고, 관련 단절이 없으면 단절 레이어가 사라졌다.

현재 동작:

- 선택 상권에 직접 연결된 단절이 있으면 해당 단절만 표시
- 없으면 전체 단절 overview 유지
- 카드에 다음 문구 표시

```text
선택한 상권에 직접 연결된 단절이 없어 전체 단절 구간을 유지합니다.
```

## 수동 확인 결과

로컬 API 기준:

| 항목 | 값 |
| --- | ---: |
| 강남 상권 노드 | 104 |
| 관악 상권 노드 | 74 |
| 전체 barrier | 280 |
| 강남 endpoint 포함 barrier | 200 |
| 관악 endpoint 포함 barrier | 80 |
| 강남-관악 직접 barrier | 0 |

## 검증 명령

통과:

```bash
cd frontend
npm test -- --run useBarriers useBarrierRoutes barrierSelection FlowBarrierLayer DisruptedBarrierParticleLayer
npm run build
```

추가로 backend route 병렬화 테스트는 Dev-A report에 정리했다.

## Dev-B 남은 확인

1. `http://127.0.0.1:5173/?hero=1` 진입
2. 단절 토글 ON
3. 강남/관악 모두 선택 상태에서 단절 카드와 단절선 표시 확인
4. 상권 버튼 클릭 후 단절 레이어가 사라지지 않는지 확인
5. 검증 보고 패널과 단절 카드가 겹치지 않는지 확인
6. 발표 멘트에서 "강남-관악 직접 단절"이라고 표현하지 않기

## 발표 멘트 권장

```text
이 레이어는 전 분기 대비 이동량이 급감한 상권 연결을 보여줍니다.
현재 표시는 각 자치구 내부 또는 인접 상권의 이동량 급감 구간이며,
붉은 점선일수록 단절 강도가 높은 이동축입니다.
```
