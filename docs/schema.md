# DB 스키마 정의 (spiceMap)

> PostgreSQL + PostGIS
> ORM: SQLAlchemy (`backend/models.py`)
> 최종 수정: 2026-04-29
> MVP 범위: 강남구(`11680`) · 관악구(`11620`)

---

## 데이터셋 출처 한눈에 보기

| 테이블 | 데이터셋 ID | 데이터셋 명 | 출처 |
|--------|-----------|-----------|------|
| `admin_boundary` | **OA-22160** | 서울시 상권분석서비스 (영역-행정동) | 서울 열린데이터광장 |
| `commerce_boundary` | **OA-15560** | 서울시 상권분석서비스 (영역-상권) | 서울 열린데이터광장 |
| `od_flows` | **OA-22300** | 수도권 광역 OD (생활이동) 원본 | 공공데이터포털 |
| `od_flows_aggregated` | - | OD 분기 집계본 | 내부 집계 산출 |
| `living_population` | **OA-14991** | 서울 생활인구 (SPOP_LOCAL_RESD_DONG) | 공공데이터포털 |
| `store_info` | **OA-15577** | 상권분석 점포정보 (VwsmSignguStorW) | 공공데이터포털 |
| `commerce_sales` | **OA-15572** | 상권분석 추정매출 (VwsmTrdarSelngQq) | 공공데이터포털 |
| `commerce_analysis` | - | GRI, 유형, 우선순위, 중심성, 폐업률 캐시 | 내부 분석 산출 |
| `adm_comm_mapping` | - | 행정동-상권 공간 교차 매핑 | `spatial_join.py` 산출 |
| `flow_barriers` | - | 흐름 단절 구간 | 내부 분석 산출 |
| `policy_cards` | - | 정책 추천 카드 | 내부 분석 산출 |

---

## 테이블 관계 개요

```text
admin_boundary (행정동 폴리곤)
    ↕ 공간 결합 (PostGIS)
commerce_boundary (상권 폴리곤)
    │
    ├── adm_comm_mapping      (행정동-상권 면적 교차 비율)
    ├── od_flows              (행정동 간 이동량 원본)
    ├── od_flows_aggregated   (분기 OD 집계본)
    ├── living_population     (행정동별 시간대 생활인구)
    ├── store_info            (자치구별 업종 점포 수·폐업률)
    ├── commerce_sales        (상권별 추정 매출)
    │
    └── commerce_analysis     (FastAPI 서빙용 분석 결과)
         ├── flow_barriers    (흐름 단절 구간)
         └── policy_cards     (정책 추천 카드, 1:N)
```

---

## 1. `admin_boundary` — 행정동 경계

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `adm_cd` | VARCHAR(10) PK | 행정동 코드 |
| `adm_nm` | VARCHAR(100) | 행정동 명 |
| `gu_nm` | VARCHAR(50) | 자치구 명 |
| `geom` | MULTIPOLYGON (SRID 4326) | 행정동 경계 폴리곤 |

**용도**: OD 흐름 시각화 기준 폴리곤, 생활인구 히트맵, 행정동-상권 공간 결합 기준.

---

## 2. `commerce_boundary` — 상권 경계

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `comm_cd` | VARCHAR(20) PK | 상권 코드 |
| `comm_nm` | VARCHAR(100) | 상권 명 |
| `comm_type` | VARCHAR(50) | 원천 상권 유형 |
| `geom` | MULTIPOLYGON (SRID 4326) | 상권 경계 폴리곤 |

**용도**: 상권 노드 폴리곤, 분석 단위 기준, 행정동-상권 공간 결합 대상.

---

## 3. `od_flows` — 행정동 간 OD 이동량 원본

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | BIGINT PK | 자동 증가 |
| `base_date` | DATE | 기준일 |
| `origin_adm_cd` | VARCHAR(10) | 출발 행정동 코드 |
| `dest_adm_cd` | VARCHAR(10) | 도착 행정동 코드 |
| `move_purpose` | INTEGER | 이동 목적 코드 |
| `in_forn_div` | VARCHAR(10) | 내외국인 구분 |
| `trip_count` | FLOAT | 이동 건수 추정값 |

**MVP 필터**: 출발 또는 도착이 강남구(`1168xxxx`) · 관악구(`1162xxxx`).

---

## 4. `od_flows_aggregated` — OD 분기 집계본

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | BIGINT PK | 자동 증가 |
| `year_quarter` | VARCHAR(6) | 분기 |
| `origin_adm_cd` | VARCHAR(10) | 출발 행정동 코드 |
| `dest_adm_cd` | VARCHAR(10) | 도착 행정동 코드 |
| `move_purpose` | INTEGER | 이동 목적 코드 |
| `trip_count_sum` | FLOAT | 일자·내외국인 합산 이동량 |

**유니크 제약**: `(year_quarter, origin_adm_cd, dest_adm_cd, move_purpose)`
**용도**: Module A/B/C/D/E의 canonical OD 입력.

---

## 5. `living_population` — 서울 생활인구

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | BIGINT PK | 자동 증가 |
| `base_date` | DATE | 기준일 |
| `hour_slot` | INTEGER | 시간대 (0~23) |
| `adm_cd` | VARCHAR(10) | 행정동 코드 |
| `total_pop` | FLOAT | 총 생활인구 수 |

**분석 활용**: 출근피크, 점심, 저녁 평균을 시간대 수요 지표로 사용.

---

## 6. `store_info` — 자치구별 점포 정보

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | BIGINT PK | 자동 증가 |
| `year_quarter` | VARCHAR(6) | 연도분기 코드 |
| `signgu_cd` | VARCHAR(10) | 자치구 코드 |
| `signgu_nm` | VARCHAR(50) | 자치구 명 |
| `industry_cd` | VARCHAR(20) | 업종 코드 |
| `industry_nm` | VARCHAR(100) | 업종 명 |
| `store_count` | FLOAT | 점포 수 |
| `open_rate` | FLOAT | 개업률 |
| `open_count` | FLOAT | 개업 점포 수 |
| `close_rate` | FLOAT | 폐업률 |
| `close_count` | FLOAT | 폐업 점포 수 |
| `franchise_count` | FLOAT | 프랜차이즈 점포 수 |

**단위 주의**: 자치구 단위 데이터이므로 상권과 결합 시 `signgu_cd` 기준.

---

## 7. `commerce_sales` — 상권별 추정 매출

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | BIGINT PK | 자동 증가 |
| `year_quarter` | VARCHAR(6) | 연도분기 코드 |
| `trdar_cd` | VARCHAR(20) | 상권 코드 |
| `trdar_nm` | VARCHAR(100) | 상권 명 |
| `trdar_se_cd` | VARCHAR(5) | 상권 구분 코드 |
| `industry_cd` | VARCHAR(20) | 업종 코드 |
| `industry_nm` | VARCHAR(100) | 업종 명 |
| `sales_amount` | FLOAT | 월 매출액 |
| `sales_count` | FLOAT | 월 매출 건수 |
| `weekday_sales` | FLOAT | 주중 매출액 |
| `weekend_sales` | FLOAT | 주말 매출액 |

**결합 키**: `trdar_cd` ↔ `commerce_boundary.comm_cd`.

---

## 8. `commerce_analysis` — 분석 결과

`grain = (year_quarter, comm_cd)` — 1행 = 1상권 분기 스냅샷.

| 컬럼 | 타입 | 설명 | 산출 모듈 |
|------|------|------|---------|
| `id` | BIGINT PK | 자동 증가 | - |
| `year_quarter` | VARCHAR(7) | 분기 | - |
| `comm_cd` | VARCHAR(20) | 상권 코드 | - |
| `comm_nm` | VARCHAR(100) | 상권 명 | - |
| `gri_score` | FLOAT | 상권 위험 지수 | Module B |
| `flow_volume` | BIGINT | 유입 이동량 합산 | Module A |
| `dominant_origin` | VARCHAR(10) | 주 유입 출발 행정동 코드 | Module A |
| `net_flow` | FLOAT | 순유입 | Module A |
| `degree_centrality` | FLOAT | 연결 중심성 | Module A |
| `commerce_type` | VARCHAR(20) | 5유형 및 `unclassified` | Module D |
| `priority_score` | FLOAT | 정책 우선순위 | Module E |
| `closure_rate` | FLOAT | 자치구 분기 폐업률 | store_info 집계 |
| `analysis_note` | TEXT | 정책 제언 요약 | - |
| `computed_at` | TIMESTAMP | 분석 실행 시각 | - |

**제약**: `UNIQUE(year_quarter, comm_cd)`
**서빙**: `/api/commerce/type-map` 응답에 분석 필드를 GeoJSON properties로 노출.

---

## 9. `adm_comm_mapping` — 행정동-상권 공간 교차 매핑

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | BIGINT PK | 자동 증가 |
| `adm_cd` | VARCHAR(10) | 행정동 코드 |
| `comm_cd` | VARCHAR(20) | 상권 코드 |
| `overlap_area` | FLOAT | 교차 면적 |
| `comm_area_ratio` | FLOAT | 상권 기준 면적 비율 |
| `adm_area_ratio` | FLOAT | 행정동 기준 면적 비율 |

**유니크 제약**: `(adm_cd, comm_cd)`
**용도**: 행정동 데이터를 상권 단위로 배분하거나 상권 데이터를 행정동으로 역배분.

---

## 10. `flow_barriers` — 흐름 단절 구간

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | BIGINT PK | 자동 증가 |
| `year_quarter` | VARCHAR(7) | 분기 |
| `from_comm_cd` | VARCHAR(20) | 출발 상권 코드 |
| `to_comm_cd` | VARCHAR(20) | 도착 상권 코드 |
| `barrier_score` | FLOAT | 단절 강도 |
| `barrier_type` | VARCHAR(50) | 단절 유형 |

---

## 11. `policy_cards` — 정책 추천 카드

`grain = (year_quarter, comm_cd, rule_id)` — 1상권당 0~N건.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | BIGINT PK | 자동 증가 |
| `year_quarter` | VARCHAR(7) | 분기 |
| `comm_cd` | VARCHAR(20) | 상권 코드 |
| `comm_nm` | VARCHAR(100) | 상권 명 |
| `rule_id` | VARCHAR(8) | 발동 룰 ID |
| `severity` | VARCHAR(10) | `Critical` / `High` / `Medium` / `Low` |
| `policy_text` | TEXT | 정책 추천 본문 |
| `rationale` | TEXT | 발동 근거 |
| `triggering_metrics` | JSONB | 발동 시 지표 스냅샷 |
| `generation_mode` | VARCHAR(20) | `rule_based` / `llm` |
| `generated_at` | TIMESTAMP | 카드 생성 시각 |

**서빙**: `/api/insights/policy?comm_cd=...&quarter=...`.

---

## 데이터 적재 현황 요약

| 테이블 | 행 수 | 데이터 범위 | 상태 |
|--------|-------|-----------|------|
| `admin_boundary` | 425 | 서울시 행정동 전체 | 완료 |
| `commerce_boundary` | 1,650 | 서울시 상권 전체 | 완료 |
| `od_flows` | 80,573,657 | 2025-10-01 ~ 2026-02-28, 강남·관악 MVP 필터 | 완료 |
| `living_population` | 94,944 | 2025-10-01 ~ 2025-12-31, 강남·관악 MVP 필터 | 완료 |
| `store_info` | 5,599 | 2019Q1 ~ 2025Q4 | 완료 |
| `commerce_sales` | 21,333 | 2025Q4 | 완료 |
| `commerce_analysis` | 0 | - | INSERT 파이프라인 대기 |
| `adm_comm_mapping` | - | - | 공간 조인 산출 대상 |
| `flow_barriers` | 0 | - | 분석 산출 대기 |
| `policy_cards` | 0 | - | 분석 산출 대기 |

---

## DB 접속 방법 (로컬)

```bash
docker compose up -d
psql -h localhost -p 5433 -U postgres -d spicemap
\dt
\d od_flows
SELECT COUNT(*) FROM od_flows;
```

`.env` 파일 필요:

```dotenv
DB_HOST=localhost
DB_PORT=5433
DB_NAME=spicemap
DB_USER=postgres
DB_PASSWORD=****
```
