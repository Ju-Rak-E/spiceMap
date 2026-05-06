# FastAPI 엔드포인트 명세 (spiceMap)

> 기준일: 2026-04-29
> 기준: 실제 코드 구현 상태 (Week 4 완료 기준)
> 서버: `http://localhost:8000`
> Swagger UI: `http://localhost:8000/docs`

기획 명세가 아니라 현재 `backend/` 코드 기준으로 정리한 API 문서입니다.

---

## 구현 상태 요약

| 엔드포인트 | 상태 | 설명 |
|-----------|------|------|
| `GET /health` | ✅ 완료 | 헬스체크 |
| `GET /api/commerce/type-map` | ✅ 완료 | GeoJSON FeatureCollection 반환 |
| `GET /api/gri/history` | ✅ 완료 | 상권 GRI 시계열 반환 |
| `GET /api/od/flows` | ✅ 완료 | OD 이동 흐름 목록 반환 |
| `GET /api/barriers` | ✅ 완료 | 흐름 단절 구간 목록 반환 |
| `GET /api/insights/policy` | ✅ 완료 | 정책 추천 카드 + 우선순위 목록 반환 |
| `GET /api/export/csv` | ✅ 완료 | 우선순위 상권 CSV 다운로드 |
| `GET /api/data-sources` | ✅ 완료 | 공공데이터 출처 매핑 (FR-06) |

### 공통 오류 처리 (Week 4 추가)

모든 엔드포인트는 DB 장애 시 아래 순서로 fallback합니다:

```
1. 정상 DB 조회 → 일반 캐시(1h) + fallback 캐시(24h) 저장 후 반환
2. DB 장애 + 일반 캐시 유효 → 캐시 반환
3. DB 장애 + fallback 캐시(24h) 유효 → from_cache=true, cache_warning="캐시 데이터로 표시 중"
4. 모두 없으면 → 503
```

`DEMO_MODE=1` 환경변수 설정 시 `backend/static/demo/*.json` 스냅샷으로 서빙.

---

## `GET /health`

헬스체크 엔드포인트.

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
| `gu` | string | 아니오 | `null` | 자치구명 (예: 강남구). 설정 시 PostGIS 공간 결합으로 필터링 |
| `quarter` | string | 아니오 | `2025Q4` | 조회 분기 |

### 응답 예시

```json
{
  "type": "FeatureCollection",
  "quarter": "2025Q4",
  "total": 1,
  "from_cache": false,
  "cache_warning": null,
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "MultiPolygon", "coordinates": [] },
      "properties": {
        "comm_cd": "3110008",
        "comm_nm": "배화여자대학교",
        "gu_nm": "종로구",
        "commerce_type": "방출형_침체",
        "source_comm_type": "골목상권",
        "comm_type": "방출형_침체",
        "gri_score": 72.4,
        "flow_volume": 3800,
        "close_rate": 8.2,
        "closure_rate": 8.2,
        "dominant_origin": "1111061500",
        "analysis_note": null,
        "centroid_lng": 126.974,
        "centroid_lat": 37.582,
        "priority_score": 85.1,
        "net_flow": -320.0,
        "degree_centrality": 0.42
      }
    }
  ]
}
```

### 캐시

- Redis key: `type-map:{gu|all}:{quarter}`
- TTL: 1시간 (fallback: 24시간)

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
  "from_cache": false,
  "cache_warning": null,
  "history": [
    { "quarter": "2025Q3", "gri_score": 61.2, "flow_volume": 3800 },
    { "quarter": "2025Q4", "gri_score": 64.5, "flow_volume": 4200 }
  ]
}
```

### 캐시

- Redis key: `gri-history:{comm_cd}`
- TTL: 1시간 (fallback: 24시간)

---

## `GET /api/od/flows`

행정동 간 OD 이동 흐름을 반환합니다. `od_flows_aggregated` 테이블 기반.

### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `quarter` | string | 아니오 | `2025Q4` | 조회 분기 |
| `gu` | string | 아니오 | `null` | 자치구 필터 (출발 또는 도착 자치구) |
| `limit` | int | 아니오 | `200` | 반환 흐름 수 (최대 500) |

### 응답 예시

```json
{
  "quarter": "2025Q4",
  "total_flows": 1,
  "from_cache": false,
  "cache_warning": null,
  "flows": [
    {
      "origin_adm_cd": "1168010100",
      "origin_adm_nm": "역삼1동",
      "dest_adm_cd": "1162010200",
      "dest_adm_nm": "신림동",
      "trip_count": 4200.0,
      "move_purpose": 1,
      "sourceCoord": [127.036, 37.5],
      "targetCoord": [126.929, 37.484]
    }
  ]
}
```

### 캐시

- Redis key: `od-flows:{quarter}:{gu|all}:{limit}`
- TTL: 1시간 (fallback: 24시간)

---

## `GET /api/barriers`

흐름 단절 구간 목록을 반환합니다. `flow_barriers` 테이블 기반.

### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `quarter` | string | 아니오 | `2025Q4` | 조회 분기 |
| `gu` | string | 아니오 | `null` | 자치구 필터 |
| `min_score` | float | 아니오 | `0.0` | 단절 강도 하한 |

### 응답 예시

```json
{
  "quarter": "2025Q4",
  "total": 1,
  "from_cache": false,
  "cache_warning": null,
  "barriers": [
    {
      "from_comm_cd": "3110053",
      "from_comm_nm": "신림 골목상권",
      "from_centroid_lng": 126.929,
      "from_centroid_lat": 37.484,
      "to_comm_cd": "3110021",
      "to_comm_nm": "서울대입구역 상권",
      "to_centroid_lng": 126.952,
      "to_centroid_lat": 37.481,
      "barrier_score": 0.82,
      "barrier_type": "주말 쇼핑 유입 부족"
    }
  ]
}
```

### 캐시

- Redis key: `barriers:{quarter}:{gu|all}:{min_score}`
- TTL: 1시간 (fallback: 24시간)

### 비고

- `flow_barriers` 테이블은 Dev-C Module C 결과 적재 후 데이터가 채워짐. 현재 0행.

---

## `GET /api/insights/policy`

정책 추천 카드와 우선순위 상권 목록을 반환합니다. `policy_cards` + `commerce_analysis` 조인.

### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `quarter` | string | 아니오 | `2025Q4` | 조회 분기 |
| `gu` | string | 아니오 | `null` | 자치구 필터 |
| `comm_cd` | string | 아니오 | `null` | 특정 상권 코드 (상세 패널용) |
| `min_priority` | float | 아니오 | `0.0` | 우선순위 하한 |
| `severity` | string | 아니오 | `null` | `Critical` / `High` / `Medium` / `Low` |

### 응답 예시

```json
{
  "quarter": "2025Q4",
  "total_cards": 1,
  "generation_mode": "rule_based",
  "from_cache": false,
  "cache_warning": null,
  "cards": [
    {
      "rule_id": "R4",
      "commerce_code": "3110053",
      "commerce_name": "신림 골목상권",
      "severity": "Critical",
      "policy_text": "순유출 지속 상권 — 유입 유도 보행 환경 개선 권고",
      "rationale": "3개 분기 연속 순유출, 폐업률 12.3%",
      "triggering_metrics": { "net_flow": -320.0, "closure_rate": 12.3 },
      "generation_mode": "rule_based"
    }
  ]
}
```

### 캐시

- Redis key: `insights-policy:{quarter}:{gu|all}:{comm_cd|all}:{min_priority}:{severity|all}`
- TTL: 1시간 (fallback: 24시간)

### 비고

- `generation_mode: "rule_based"` 고정 (FR-07: 생성형 AI 미사용 라벨 명시)

---

## `GET /api/export/csv`

우선순위 상권 목록을 CSV로 다운로드합니다. (Redis 캐시 미적용 — 매 요청 DB 직접 조회)

### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `quarter` | string | 아니오 | `2025Q4` | 조회 분기 |
| `gu` | string | 아니오 | `null` | 자치구 필터 |
| `min_priority` | float | 아니오 | `80.0` | 우선순위 하한 |

### 응답

- `Content-Type: text/csv; charset=utf-8-sig`
- `Content-Disposition: attachment; filename="spicemap_{quarter}_{gu|all}.csv"`
- BOM 포함 (Excel 한글 깨짐 방지)

### CSV 컬럼

`상권코드, 상권명, 자치구, 상권유형, GRI점수, 우선순위점수, 폐업률, 순유입량, 정책권고요약`

---

## `GET /api/data-sources`

각 API 응답 필드가 어느 공공데이터셋에서 왔는지 반환합니다. (FR-06)
DB·Redis 의존 없이 항상 즉시 반환.

### 응답 예시

```json
{
  "total": 6,
  "sources": {
    "od_flows": {
      "dataset_id": "OA-22300",
      "name": "수도권 생활이동 OD (기종점통행량)",
      "portal_url": "https://www.data.go.kr/data/15063632/fileData.do",
      "fields": ["trip_count", "move_purpose", "sourceCoord", "targetCoord"],
      "granularity": "월별",
      "note": "행정동 간 이동량 원천 데이터. 분기 롤업 집계 후 사용."
    },
    "living_population": { "dataset_id": "OA-14991", "..." : "..." },
    "store_info":        { "dataset_id": "OA-15577", "..." : "..." },
    "commerce_sales":    { "dataset_id": "OA-15572", "..." : "..." },
    "commerce_boundary": { "dataset_id": "자체구축", "..." : "..." },
    "admin_boundary":    { "dataset_id": "자체구축", "..." : "..." }
  }
}
```

---

## 프론트 연동 메모

2026-04-29 기준 백엔드 구현 완료. 프론트와의 계약 정합 필요 항목:

| 항목 | 백엔드 현재 | 프론트 기대 | 조율 필요 |
|------|-----------|-----------|---------|
| `comm_type` 필드 | `commerce_type` (5유형) + `source_comm_type` (원본) 분리 | 단일 `comm_type` | ✅ 호환용 `comm_type` 미러 필드 추가됨 |
| `from_cache` / `cache_warning` | 모든 응답에 포함 (DB 장애 시 `true`) | 미처리 | 프론트에서 `from_cache=true` 감지 시 배너 표시 필요 |
| `data-sources` 출처 아이콘 | `GET /api/data-sources` | 상세 패널 아이콘 | 프론트 연동 필요 (FR-06) |
