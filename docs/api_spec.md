# FastAPI 엔드포인트 명세 (spiceMap)

> 기준일: 2026-05-03  
> 기준: 현재 `backend/` 코드와 Dev-B 프론트 연동 상태  
> 서버: `http://localhost:8000`  
> Swagger UI: `http://localhost:8000/docs`

기획 명세가 아니라 현재 코드 기준의 API 계약 문서입니다.

---

## 구현 상태 요약

| 엔드포인트 | 상태 | 설명 |
|-----------|------|------|
| `GET /health` | 구현 완료 | 헬스체크 |
| `GET /api/commerce/type-map` | 구현 완료 | 상권 GeoJSON, 유형, 행정동 키, 분석 지표 반환 |
| `GET /api/gri/history` | 구현 완료 | 상권 GRI 시계열 반환 |
| `GET /api/od/flows` | 구현 완료 | 행정동 OD 흐름과 좌표 반환 |
| `GET /api/barriers` | 구현 완료 | 흐름 단절 구간과 좌표 반환 |
| `GET /api/insights/policy` | 구현 완료 | 규칙 기반 정책 카드 반환 |
| `GET /api/export/csv` | 구현 완료 | 우선순위 상권 CSV 다운로드 |

---

## `GET /health`

헬스체크 엔드포인트입니다.

```json
{ "status": "ok" }
```

---

## `GET /api/commerce/type-map`

상권 경계와 분석 결과를 GeoJSON `FeatureCollection`으로 반환합니다.

### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `gu` | string | 아니오 | `null` | 자치구명. 예: `강남구` |
| `quarter` | string | 아니오 | `2025Q4` | 조회 분기 |

### 응답 주요 필드

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
        "gu_nm": "종로구",
        "adm_cd": "11110515",
        "adm_nm": "청운효자동",
        "commerce_type": "안정형",
        "source_comm_type": "골목상권",
        "comm_type": "안정형",
        "gri_score": 64.5,
        "flow_volume": 4200,
        "close_rate": 3.1,
        "dominant_origin": "강남구",
        "analysis_note": "유입과 성장세가 안정적입니다.",
        "centroid_lng": 126.97,
        "centroid_lat": 37.58,
        "priority_score": 72.4,
        "net_flow": 1200,
        "degree_centrality": 0.18,
        "closure_rate": 3.1
      }
    }
  ]
}
```

### 프론트 연동 메모

- 프론트 `CommerceNode.id`는 `comm_cd`를 사용합니다.
- OD 하이라이트는 `properties.adm_cd`를 `admKey`로 사용합니다.
- 상권 경계 선택 매칭은 API `comm_cd`, mock GeoJSON `comm_id`를 모두 허용합니다.

---

## `GET /api/od/flows`

행정동 간 OD 흐름을 반환합니다.

### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `quarter` | string | 아니오 | `2025Q4` | 조회 분기 |
| `gu` | string | 아니오 | `null` | 출발 또는 도착 행정동의 자치구 필터 |
| `limit` | int | 아니오 | `200` | 최대 반환 수. 서버 상한 500 |

### 응답 주요 필드

```json
{
  "quarter": "2025Q4",
  "total_flows": 1,
  "flows": [
    {
      "origin_adm_cd": "11680640",
      "origin_adm_nm": "역삼1동",
      "dest_adm_cd": "11620695",
      "dest_adm_nm": "신림동",
      "trip_count": 18320,
      "move_purpose": 1,
      "sourceCoord": [127.036, 37.500],
      "targetCoord": [126.929, 37.484]
    }
  ]
}
```

프론트는 `origin_adm_cd`/`dest_adm_cd`를 OD 강조 키로 사용합니다.

---

## `GET /api/barriers`

흐름 단절 구간을 반환합니다.

### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `quarter` | string | 아니오 | `2025Q4` | 조회 분기 |
| `gu` | string | 아니오 | `null` | 출발 상권 기준 자치구 필터 |
| `min_score` | float | 아니오 | `0.0` | 단절 강도 하한 |

### 응답 주요 필드

```json
{
  "quarter": "2025Q4",
  "total": 1,
  "barriers": [
    {
      "from_comm_cd": "3110001",
      "from_comm_nm": "상권A",
      "to_comm_cd": "3110002",
      "to_comm_nm": "상권B",
      "barrier_score": 0.82,
      "barrier_type": "flow_drop",
      "sourceCoord": [127.036, 37.500],
      "targetCoord": [126.929, 37.484],
      "affected_volume": 8200
    }
  ]
}
```

프론트는 `sourceCoord`와 `targetCoord`가 있는 row만 렌더링합니다. API 요청이 성공했지만 결과가 비어 있으면 mock barrier로 대체하지 않습니다.

---

## `GET /api/gri/history`

특정 상권의 분기별 GRI 시계열을 반환합니다.

### Query Parameters

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `comm_cd` | string | 예 | 상권 코드 |

```json
{
  "comm_cd": "3110008",
  "comm_nm": "배화여자대학교",
  "history": [
    {
      "quarter": "2025Q3",
      "gri_score": 61.2,
      "flow_volume": 3800
    }
  ]
}
```

---

## `GET /api/insights/policy`

규칙 기반 정책 추천 카드를 반환합니다.

### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `quarter` | string | 아니오 | `2025Q4` | 조회 분기 |
| `gu` | string | 아니오 | `null` | 자치구 필터 |
| `comm_cd` | string | 아니오 | `null` | 특정 상권 코드 |
| `min_priority` | float | 아니오 | `0.0` | 우선순위 하한 |
| `severity` | string | 아니오 | `null` | `Critical`, `High`, `Medium`, `Low` |

응답의 `generation_mode`는 `rule_based`입니다.

---

## `GET /api/export/csv`

우선순위 상권 목록을 CSV로 다운로드합니다.

### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `quarter` | string | 아니오 | `2025Q4` | 조회 분기 |
| `gu` | string | 아니오 | `null` | 자치구 필터 |
| `min_priority` | float | 아니오 | `80.0` | 우선순위 하한 |

응답은 `text/csv; charset=utf-8-sig`이며 Excel 한글 표시를 위해 UTF-8 BOM을 포함합니다.

CSV 헤더:

```text
상권코드,상권명,자치구,상권유형,GRI점수,우선순위점수,폐업률,순유입량,정책권고요약
```

---

## 캐시

Redis 사용 가능 시 주요 조회 API는 `CACHE_TTL` 기준으로 캐시합니다. Redis 오류가 발생해도 조회 자체는 DB에서 계속 시도합니다.
