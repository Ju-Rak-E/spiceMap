# FastAPI 엔드포인트 명세 (spiceMap)

> 기준일: 2026-04-22  
> 기준: 실제 코드 구현 상태  
> 서버: `http://localhost:8000`  
> Swagger UI: `http://localhost:8000/docs`

기획 명세가 아니라 현재 `backend/` 코드 기준으로 정리한 API 문서입니다.

---

## 구현 상태 요약

| 엔드포인트 | 상태 | 설명 |
|-----------|------|------|
| `GET /health` | 구현 완료 | 헬스체크 |
| `GET /api/commerce/type-map` | 구현 완료 | GeoJSON FeatureCollection 반환 |
| `GET /api/gri/history` | 구현 완료 | 상권 GRI 시계열 반환 |
| `GET /api/od/flows` | placeholder | `not_implemented` 반환 |
| `GET /api/barriers` | placeholder | `not_implemented` 반환 |
| `GET /api/insights/policy` | placeholder | `not_implemented` 반환 |
| `GET /api/export/csv` | placeholder | `not_implemented` 반환 |

---

## `GET /health`

헬스체크 엔드포인트입니다.

**응답**

```json
{ "status": "ok" }
```

---

## `GET /api/commerce/type-map`

상권 경계와 분석 결과를 GeoJSON `FeatureCollection` 형태로 반환합니다.

### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `gu` | string | 아니오 | `null` | 자치구명. 현재는 받아도 실제 필터링에는 반영되지 않음 |
| `quarter` | string | 아니오 | `2025Q4` | 조회 분기 |

### 응답 예시

```json
{
  "type": "FeatureCollection",
  "quarter": "2025Q4",
  "total": 1,
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": []
      },
      "properties": {
        "comm_cd": "3110008",
        "comm_nm": "배화여자대학교",
        "comm_type": "골목상권",
        "gri_score": null,
        "flow_volume": null,
        "dominant_origin": null,
        "analysis_note": null
      }
    }
  ]
}
```

### 캐시

- Redis key: `type-map:{gu|all}:{quarter}`
- TTL: 1시간

### 비고

- 현재 `commerce_boundary`와 `commerce_analysis`를 조인해서 반환합니다.
- `gu` 필터는 향후 상권-자치구 매핑 정리 후 반영 예정입니다.

---

## `GET /api/gri/history`

특정 상권의 분기별 GRI 시계열을 반환합니다.

### Query Parameters

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `comm_cd` | string | 예 | 상권 코드 |

### 응답 예시

```json
{
  "comm_cd": "3110008",
  "comm_nm": "배화여자대학교",
  "history": [
    {
      "quarter": "2025Q3",
      "gri_score": 61.2,
      "flow_volume": 3800
    },
    {
      "quarter": "2025Q4",
      "gri_score": 64.5,
      "flow_volume": 4200
    }
  ]
}
```

### 캐시

- Redis key: `gri-history:{comm_cd}`
- TTL: 1시간

---

## Placeholder 엔드포인트

아래 엔드포인트는 라우터는 연결되어 있으나 실제 데이터 조회는 아직 구현되지 않았습니다.

- `GET /api/od/flows`
- `GET /api/barriers`
- `GET /api/insights/policy`
- `GET /api/export/csv`

현재 응답 형식은 공통적으로 아래와 같습니다.

```json
{
  "status": "not_implemented",
  "week": 3
}
```

---

## 프론트 연동 메모

2026-04-22 기준 프론트와 백엔드의 계약이 아직 완전히 일치하지 않습니다.

- 프론트 `useCommerceData`는 `{ nodes, updatedAt }` 구조를 기대하지만 현재 백엔드는 GeoJSON 반환
- 프론트 `useGriHistory`는 `nodeId` 쿼리를 사용하지만 현재 백엔드는 `comm_cd`를 기대
- 프론트 `useFlowData`와 `usePolicyInsights`는 mock/demo mode 기준 구조에 맞춰져 있음

즉, 현재 API 문서는 "백엔드 실제 상태"를 기록한 문서이고, 프론트에서 바로 안정적으로 소비 가능한 계약 문서는 아직 아닙니다.
