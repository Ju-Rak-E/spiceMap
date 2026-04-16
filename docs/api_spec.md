# FastAPI 엔드포인트 명세 (spiceMap)

> 작성일: 2026-04-16  
> 담당: Dev-A  
> 서버: `http://localhost:8000`  
> Swagger UI: `http://localhost:8000/docs`

---

## 엔드포인트 목록

| 엔드포인트 | 주차 | Dev-C 의존 | 설명 |
|-----------|------|-----------|------|
| `GET /health` | Week 2 | ✗ | 헬스체크 |
| `GET /api/commerce/type-map` | Week 2 | ✓ | 상권 폴리곤 + 분석 결과 (지도 메인 뷰) |
| `GET /api/gri/history` | Week 2 | ✓ | 상권 GRI 분기별 시계열 |
| `GET /api/od/flows` | Week 3 | ✗ | OD 이동 흐름 데이터 |
| `GET /api/barriers` | Week 3 | ✓ | 흐름 단절 구간 목록 |
| `GET /api/insights/policy` | Week 3 | ✓ | 정책 추천 카드 + 우선순위 점수 |
| `GET /api/export/csv` | Week 3 | ✓ | 위험 상권 CSV 다운로드 |

> **Dev-C 의존**: `commerce_analysis`, `flow_barriers` 테이블이 채워져야 실제 데이터 반환. 그 전까지는 null 또는 빈 배열 반환이 정상 동작.

---

## `GET /health`

헬스체크.

**응답**
```json
{ "status": "ok" }
```

---

## `GET /api/commerce/type-map`

지도 메인 뷰용. 상권 경계 폴리곤 + 분석 결과를 GeoJSON으로 반환.

**Query Parameters**

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `gu` | string | ✗ | (전체) | 자치구 필터 (예: `강남구`) |
| `quarter` | string | ✗ | `2025Q4` | 분기 (예: `2025Q4`) |

**응답** `200 OK` — GeoJSON FeatureCollection

```json
{
  "type": "FeatureCollection",
  "quarter": "2025Q4",
  "total": 1650,
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

**캐시**: Redis `type-map:{gu|all}:{quarter}` / TTL 1시간

---

## `GET /api/gri/history`

상세 패널 GRI 추세 그래프용. 특정 상권의 분기별 GRI 시계열 반환.

**Query Parameters**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `comm_cd` | string | ✓ | 상권 코드 (예: `3110008`) |

**응답** `200 OK`

```json
{
  "comm_cd": "3110008",
  "comm_nm": "배화여자대학교",
  "history": [
    { "quarter": "2025Q4", "gri_score": null, "flow_volume": null }
  ]
}
```

**캐시**: Redis `gri-history:{comm_cd}` / TTL 1시간

---

## `GET /api/od/flows`

OD 이동 흐름 데이터. 지도에서 상위 N개 흐름 곡선 렌더링용.

**Query Parameters**

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `gu` | string | ✗ | (전체) | 자치구 필터 |
| `quarter` | string | ✗ | `2025Q4` | 분기 |
| `top_n` | integer | ✗ | `20` | 상위 N개 흐름만 반환 (성능 제한) |

**응답** `200 OK`

```json
{
  "quarter": "2025Q4",
  "total_flows": 120,
  "flows": [
    {
      "origin_adm_cd": "11620530",
      "origin_adm_nm": "신림동",
      "dest_adm_cd": "11680500",
      "dest_adm_nm": "역삼1동",
      "trip_count": 4200.0,
      "move_purpose": 1
    }
  ]
}
```

**캐시**: Redis `od-flows:{gu|all}:{quarter}:{top_n}` / TTL 1시간

---

## `GET /api/barriers`

흐름 단절 구간 레이어 토글용.

**Query Parameters**

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `gu` | string | ✗ | (전체) | 자치구 필터 |
| `quarter` | string | ✗ | `2025Q4` | 분기 |

**응답** `200 OK`

```json
{
  "quarter": "2025Q4",
  "barriers": [
    {
      "from_comm_cd": "3110008",
      "from_comm_nm": "배화여자대학교",
      "to_comm_cd": "3110009",
      "to_comm_nm": "자하문터널",
      "barrier_score": 0.87,
      "barrier_type": "도로"
    }
  ]
}
```

**캐시**: Redis `barriers:{gu|all}:{quarter}` / TTL 1시간

---

## `GET /api/insights/policy`

정책 우선순위 TOP 목록 + 추천 카드.

**Query Parameters**

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `gu` | string | ✗ | (전체) | 자치구 필터 |
| `quarter` | string | ✗ | `2025Q4` | 분기 |
| `min_score` | number | ✗ | `0` | 최소 우선순위 점수 |

**응답** `200 OK`

```json
{
  "quarter": "2025Q4",
  "items": [
    {
      "comm_cd": "3110008",
      "comm_nm": "배화여자대학교",
      "comm_type": "골목상권",
      "gri_score": 72.4,
      "priority_score": 85.0,
      "analysis_note": "주말 쇼핑 유입 부족으로 인한 단절 위험",
      "policy_cards": [
        "보행 유도 사인물 설치",
        "야간 경관 개선 권고"
      ]
    }
  ]
}
```

**캐시**: Redis `insights:{gu|all}:{quarter}:{min_score}` / TTL 1시간

---

## `GET /api/export/csv`

우선순위 점수 기준 이상 상권 목록을 CSV로 다운로드.

**Query Parameters**

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `gu` | string | ✗ | (전체) | 자치구 필터 |
| `quarter` | string | ✗ | `2025Q4` | 분기 |
| `min_score` | number | ✗ | `80` | 최소 우선순위 점수 |

**응답** `200 OK` — `Content-Type: text/csv`

```
상권코드,상권명,자치구,상권유형,GRI점수,우선순위점수,분석내용
3110008,배화여자대학교,종로구,골목상권,72.4,85.0,주말 쇼핑 유입 부족...
```

---

## 공통 에러 응답

| 상태 코드 | 설명 |
|---------|------|
| `422 Unprocessable Entity` | 쿼리 파라미터 형식 오류 |
| `503 Service Unavailable` | DB 연결 실패 (캐시 데이터로 표시 중 안내 포함) |

---

## 성능 목표 (NFR)

| 조건 | 목표 |
|------|------|
| 지도 초기 로딩 (캐시 미스) | ≤ 5초 |
| 지도 초기 로딩 (캐시 히트) | ≤ 3초 |
| 상권 클릭 → 상세 패널 (캐시 미스) | ≤ 1초 |
| 상권 클릭 → 상세 패널 (캐시 히트) | ≤ 500ms |
