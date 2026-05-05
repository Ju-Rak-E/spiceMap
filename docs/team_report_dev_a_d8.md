# Dev-A Backend Report - Barrier Route Update (2026-05-05)

> 작성: Codex
> 대상: Dev-A backend handoff
> 기준 브랜치: `kbh`
> 범위: `/api/barrier-routes` ORS 병렬화 및 프론트 시연 지연 개선 지원

---

## 요약

단절 토글 ON 후 5~15초 지연되는 핵심 병목은 backend의 ORS route 호출이 직렬 실행되는 구조였다.

기존:

```python
for route in route_inputs:
    item = _fetch_ors_route(route, api_key)
```

변경 후:

```python
async with httpx.AsyncClient(timeout=ORS_TIMEOUT_SECONDS) as client:
    results = await asyncio.gather(
        *(_fetch_ors_route(client, route, api_key) for route in route_inputs),
        return_exceptions=True,
    )
```

평균 응답 시간은 ORS 요청 8개 기준 "개별 응답 시간 합"에서 "가장 느린 개별 응답 시간"에 가까운 구조로 바뀐다.

## 변경 파일

| 파일 | 변경 내용 |
| --- | --- |
| `backend/api/barrier_routes.py` | route endpoint를 `async def`로 변경, `httpx.AsyncClient` + `asyncio.gather` 병렬화 |
| `tests/api/test_barrier_routes.py` | async `_fetch_ors_route` monkeypatch 방식으로 테스트 갱신 |

## 상세 변경

### 1. `_fetch_ors_route`

기존 sync `httpx.post` 호출을 async client 호출로 변경했다.

```python
async def _fetch_ors_route(
    client: httpx.AsyncClient,
    route: BarrierRouteInput,
    api_key: str,
) -> BarrierRouteItem | None:
    response = await client.post(...)
```

### 2. `/api/barrier-routes`

FastAPI endpoint를 `async def`로 변경했다. DB query는 기존 SQLAlchemy session 흐름을 유지하고, ORS 호출 구간만 병렬화했다.

예외 처리:

- 일부 route만 실패하면 성공한 route만 반환
- 모든 route가 실패하고 fallback이 있으면 fallback 반환
- fallback도 없으면 `503 Routing provider unavailable`

### 3. cache 흐름 유지

기존 cache key와 fallback 흐름은 유지했다.

```text
barrier-routes:{quarter}:{gu or all}:{comm_cd or all}:{min_score}:{limit}
```

따라서 Redis/cache hit 시에는 DB와 ORS 호출을 모두 건너뛴다.

## Dev-B 연동 사항

프론트에서는 단절 route를 토글 시점이 아니라 미리 요청하도록 변경했다.

```ts
useBarrierRoutes(selectedQuarter, true, barrierRouteNodeId)
```

선택 상권에 직접 연결된 단절이 없는 경우에는 선택 상권용 route 요청 대신 overview route 요청을 유지한다.

## 검증 명령

통과:

```bash
python -m pytest tests\api\test_barrier_routes.py
```

결과:

```text
5 passed
```

## 수동 성능 확인 권장

backend 서버 실행 후 다음 명령으로 측정한다.

```bash
curl -w "%{time_total}\n" -o /dev/null \
  "http://localhost:8000/api/barrier-routes?quarter=2025Q4&limit=8"
```

기대:

- 이전: ORS 8개 직렬 호출로 5~15초 체감 가능
- 이후: ORS 병렬 호출로 1~3초대 기대
- cache hit 이후: 네트워크 왕복 수준

## 주의

현재 로컬 데이터 기준 `flow_barriers`에는 강남구-관악구 직접 barrier pair가 없다.

로컬 확인 결과:

| 항목 | 값 |
| --- | ---: |
| 전체 barrier | 280 |
| 강남 endpoint 포함 barrier | 200 |
| 관악 endpoint 포함 barrier | 80 |
| 강남-관악 직접 barrier | 0 |

이는 ORS route 문제가 아니라 Module C 산출 데이터의 결과다. Module C는 지리적 경계 단절이 아니라 Q3 -> Q4 OD pair 이동량 감소를 `flow_barriers`로 기록한다.

발표/시연에서는 다음 표현을 사용한다.

```text
현재 표시는 각 자치구 내부 또는 인접 상권의 이동량 급감 구간입니다.
```
