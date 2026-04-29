# spiceMap DB 스키마

> 소스: `backend/models.py` + `backend/pipeline/init_db.py` 역추적  
> 최초 작성: 2026-04-29  
> DB: PostgreSQL 17 + PostGIS (docker-compose 로컬 / Supabase 공유)  
> MVP 범위: 강남구(1168xxxx) · 관악구(1162xxxx)

---

## 테이블 목록

| # | 테이블명 | 설명 | 데이터 원천 |
|---|----------|------|-------------|
| 1 | `admin_boundary` | 행정동 경계 폴리곤 | SHP/GeoJSON 직접 적재 |
| 2 | `commerce_boundary` | 상권 경계 폴리곤 | SHP 직접 적재 |
| 3 | `od_flows` | OD 이동량 원본 (Dev-A 로컬 전용) | OA-22300 CSV |
| 4 | `od_flows_aggregated` | OD 분기 집계본 (팀 공유 원장) | `aggregate_od_flows.py` 집계 |
| 5 | `living_population` | 행정동별 생활인구 | OA-14991 API |
| 6 | `store_info` | 자치구별 점포 정보 | OA-15577 API |
| 7 | `commerce_sales` | 상권별 추정 매출 | OA-15572 API |
| 8 | `commerce_analysis` | 분석 결과 Pre-computed | Module A~E 산출 |
| 9 | `adm_comm_mapping` | 행정동-상권 공간 교차 매핑 | `spatial_join.py` 산출 |
| 10 | `flow_barriers` | 유동 장벽 분석 결과 | Module A 산출 |
| 11 | `policy_cards` | 정책 추천 카드 | Module D 산출 |

---

## 1. `admin_boundary` — 행정동 경계

행정동 폴리곤. PostGIS `MULTIPOLYGON` 타입. `load_spatial.py`로 적재.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `adm_cd` | VARCHAR(10) | PK | 행정동 코드 |
| `adm_nm` | VARCHAR(100) | NOT NULL | 행정동 명 |
| `gu_nm` | VARCHAR(50) | nullable | 자치구 명 |
| `geom` | GEOMETRY(MULTIPOLYGON, 4326) | NOT NULL | 경계 폴리곤 (WGS84) |

> **적재 상태**: Week 2 기준 미적재 (블로커 — Dev-A 대응 중)

---

## 2. `commerce_boundary` — 상권 경계

서울시 상권분석서비스 상권 폴리곤. `load_spatial.py`로 적재.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `comm_cd` | VARCHAR(20) | PK | 상권 코드 |
| `comm_nm` | VARCHAR(100) | NOT NULL | 상권 명 |
| `comm_type` | VARCHAR(50) | nullable | 상권 유형 (골목상권 등) |
| `geom` | GEOMETRY(MULTIPOLYGON, 4326) | NOT NULL | 경계 폴리곤 (WGS84) |

> **적재 상태**: Week 2 기준 미적재 (블로커 — Dev-A 대응 중)

---

## 3. `od_flows` — OD 이동량 원본

원본 CSV 80M 행 규모. **Dev-A 로컬 전용 보존 테이블**. 팀 간 공유 불가.  
→ 집계본 `od_flows_aggregated`가 실제 분석 입력.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | BIGINT | PK, autoincrement | — |
| `base_date` | DATE | NOT NULL | 기준일 (etl_ymd) |
| `origin_adm_cd` | VARCHAR(10) | NOT NULL | 출발 행정동 코드 (o_admdong_cd) |
| `dest_adm_cd` | VARCHAR(10) | NOT NULL | 도착 행정동 코드 (d_admdong_cd) |
| `move_purpose` | INTEGER | nullable | 이동 목적 코드 (1=출근, 2=하원, 3=귀가, 6/7=미확정) |
| `in_forn_div` | VARCHAR(10) | nullable | 내외국인 구분 (내국인/단기외국인/장기외국인) |
| `trip_count` | FLOAT | NOT NULL | 이동 건수 추정값 (cnt) |

> **적재 상태**: Week 2 기준 미적재 (블로커 — Dev-A 대응 중)

---

## 4. `od_flows_aggregated` — OD 분기 집계본

`od_flows` 원본을 일자·내외국인 차원 합산한 **팀 공유 원장 테이블**.  
Module A/B/C/D/E의 canonical 입력. Supabase 공유 DB 적재 대상.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | BIGINT | PK, autoincrement | — |
| `year_quarter` | VARCHAR(6) | NOT NULL | 분기 (예: 2026Q1) |
| `origin_adm_cd` | VARCHAR(10) | NOT NULL | 출발 행정동 코드 |
| `dest_adm_cd` | VARCHAR(10) | NOT NULL | 도착 행정동 코드 |
| `move_purpose` | INTEGER | nullable | 이동 목적 코드 |
| `trip_count_sum` | FLOAT | NOT NULL | 일자·내외국인 합산 이동량 |

**유니크 제약**: `(year_quarter, origin_adm_cd, dest_adm_cd, move_purpose)` → `uq_od_agg`  
**인덱스**: `ix_od_agg_origin(origin_adm_cd)`, `ix_od_agg_dest(dest_adm_cd)`, `ix_od_agg_quarter(year_quarter)`

> **적재 상태**: Week 2 기준 미적재 (블로커 — Dev-A 대응 중)

---

## 5. `living_population` — 행정동별 생활인구

공공데이터 API OA-14991(`SPOP_LOCAL_RESD_DONG`). `collect_living_pop.py`로 수집.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | BIGINT | PK, autoincrement | — |
| `base_date` | DATE | NOT NULL | 기준일 (STDR_DE_ID) |
| `hour_slot` | INTEGER | NOT NULL | 시간대 구분 (0~23시) |
| `adm_cd` | VARCHAR(10) | NOT NULL | 행정동 코드 (ADSTRD_CODE_SE) |
| `total_pop` | FLOAT | nullable | 총 생활인구 (TOT_LVPOP_CO) |

> **MVP 필터**: 강남구(1168xxxx) · 관악구(1162xxxx) 행정동만 적재

---

## 6. `store_info` — 자치구별 점포 정보

공공데이터 API OA-15577(`VwsmSignguStorW`). `collect_store_info.py`로 수집.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | BIGINT | PK, autoincrement | — |
| `year_quarter` | VARCHAR(6) | NOT NULL | 연도분기 코드 (예: 20251) |
| `signgu_cd` | VARCHAR(10) | NOT NULL | 자치구 코드 (SIGNGU_CD) |
| `signgu_nm` | VARCHAR(50) | nullable | 자치구 명 |
| `industry_cd` | VARCHAR(20) | nullable | 업종 코드 (SVC_INDUTY_CD) |
| `industry_nm` | VARCHAR(100) | nullable | 업종 명 |
| `store_count` | FLOAT | nullable | 점포 수 (STOR_CO) |
| `open_rate` | FLOAT | nullable | 개업률 (OPBIZ_RT) |
| `open_count` | FLOAT | nullable | 개업 점포 수 (OPBIZ_STOR_CO) |
| `close_rate` | FLOAT | nullable | 폐업률 (CLSBIZ_RT) |
| `close_count` | FLOAT | nullable | 폐업 점포 수 (CLSBIZ_STOR_CO) |
| `franchise_count` | FLOAT | nullable | 프랜차이즈 점포 수 (FRC_STOR_CO) |

> **MVP 필터**: 강남구(11680) · 관악구(11620) signgu_cd만 적재

---

## 7. `commerce_sales` — 상권별 추정 매출

공공데이터 API OA-15572(`VwsmTrdarSelngQq`). `collect_commerce_sales.py`로 수집.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | BIGINT | PK, autoincrement | — |
| `year_quarter` | VARCHAR(6) | NOT NULL | 연도분기 코드 (예: 20251) |
| `trdar_cd` | VARCHAR(20) | NOT NULL | 상권 코드 (TRDAR_CD) |
| `trdar_nm` | VARCHAR(100) | nullable | 상권 명 |
| `trdar_se_cd` | VARCHAR(5) | nullable | 상권 구분 코드 (A=골목, D=발달 등) |
| `industry_cd` | VARCHAR(20) | nullable | 업종 코드 (SVC_INDUTY_CD) |
| `industry_nm` | VARCHAR(100) | nullable | 업종 명 |
| `sales_amount` | FLOAT | nullable | 월 매출액 (THSMON_SELNG_AMT) |
| `sales_count` | FLOAT | nullable | 월 매출 건수 (THSMON_SELNG_CO) |
| `weekday_sales` | FLOAT | nullable | 주중 매출액 (MDWK_SELNG_AMT) |
| `weekend_sales` | FLOAT | nullable | 주말 매출액 (WKEND_SELNG_AMT) |

---

## 8. `commerce_analysis` — 분석 결과 Pre-computed

FastAPI가 직접 서빙하는 최종 분석 결과 테이블. Module A~E 산출값 통합.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | BIGINT | PK, autoincrement | — |
| `year_quarter` | VARCHAR(7) | NOT NULL | 분기 |
| `comm_cd` | VARCHAR(20) | NOT NULL | 상권 코드 |
| `comm_nm` | VARCHAR(100) | nullable | 상권 명 |
| `gri_score` | FLOAT | nullable | 상권 위험 지수 GRI (0~100) |
| `flow_volume` | BIGINT | nullable | 유입 이동량 합산 |
| `dominant_origin` | VARCHAR(10) | nullable | 주 유입 출발 행정동 코드 |
| `analysis_note` | TEXT | nullable | 정책 제언 텍스트 |
| `commerce_type` | VARCHAR(20) | nullable | 상권 유형 (Module D 5유형) |
| `priority_score` | FLOAT | nullable | 정책 우선순위 점수 0~100 (Module E) |
| `net_flow` | FLOAT | nullable | 순유입(+)/순유출(-) 이동량 (Module A) |
| `degree_centrality` | FLOAT | nullable | 네트워크 연결 중심성 (Module A) |
| `closure_rate` | FLOAT | nullable | 분기 폐업률 % (store_info 집계) |

**인덱스**: `ix_commerce_analysis_quarter_cd(year_quarter, comm_cd)`

> `commerce_type`, `priority_score`, `net_flow`, `degree_centrality`, `closure_rate`는 `migrate_db()`로 추가된 컬럼 (ALTER TABLE ADD COLUMN IF NOT EXISTS)

---

## 9. `adm_comm_mapping` — 행정동-상권 공간 교차 매핑

행정동 데이터를 상권 단위로 배분하기 위한 면적 교차 비율 테이블. `spatial_join.py` 산출.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | BIGINT | PK, autoincrement | — |
| `adm_cd` | VARCHAR(10) | NOT NULL | 행정동 코드 |
| `comm_cd` | VARCHAR(20) | NOT NULL | 상권 코드 |
| `overlap_area` | FLOAT | nullable | 교차 면적 (m²) |
| `comm_area_ratio` | FLOAT | nullable | 상권 기준 비율 0~1 (행정동→상권 배분용) |
| `adm_area_ratio` | FLOAT | nullable | 행정동 기준 비율 0~1 (상권→행정동 역배분용) |

**유니크 제약**: `(adm_cd, comm_cd)` → `uq_adm_comm`  
**인덱스**: `ix_adm_comm_adm_cd(adm_cd)`, `ix_adm_comm_comm_cd(comm_cd)`

---

## 10. `flow_barriers` — 유동 장벽 분석 결과

상권 간 이동 단절 지점 분석. Module A 산출.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | BIGINT | PK, autoincrement | — |
| `year_quarter` | VARCHAR(7) | NOT NULL | 분기 |
| `from_comm_cd` | VARCHAR(20) | nullable | 출발 상권 코드 |
| `to_comm_cd` | VARCHAR(20) | nullable | 도착 상권 코드 |
| `barrier_score` | FLOAT | nullable | 단절 강도 (높을수록 단절) |
| `barrier_type` | VARCHAR(50) | nullable | 단절 유형 (도로/경계 등) |

---

## 11. `policy_cards` — 정책 추천 카드

Module D 산출. 1개 상권당 0~N건.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | BIGINT | PK, autoincrement | — |
| `year_quarter` | VARCHAR(7) | NOT NULL | 분기 (예: 2025Q4) |
| `comm_cd` | VARCHAR(20) | NOT NULL | 상권 코드 |
| `rule_id` | VARCHAR(5) | NOT NULL | 규칙 ID (R4~R7) |
| `severity` | VARCHAR(10) | NOT NULL | 심각도 (Critical/High/Medium/Low) |
| `policy_text` | TEXT | NOT NULL | 정책 추천 텍스트 |
| `rationale` | TEXT | nullable | 근거 1문장 |
| `triggering_metrics` | TEXT | nullable | 발동 지표 JSON 문자열 |
| `generation_mode` | VARCHAR(20) | NOT NULL | 생성 방식 (default: rule_based) |

**인덱스**: `ix_policy_cards_quarter(year_quarter)`, `ix_policy_cards_comm_cd(comm_cd)`

---

## 테이블 간 관계 요약

```
admin_boundary (adm_cd) ──┐
                           ├── adm_comm_mapping ──┐
commerce_boundary (comm_cd)┘                      │
                                                  ▼
od_flows_aggregated ───────────────────► commerce_analysis ◄── policy_cards
living_population ──────────────────────────────────────────
store_info ─────────────────────────────────────────────────
commerce_sales ─────────────────────────────────────────────
                                                  │
                                            flow_barriers
```

---

## MVP 적재 현황 (Week 2 기준)

| 테이블 | 적재 여부 | 비고 |
|--------|-----------|------|
| `admin_boundary` | ❌ 미적재 | Dev-A 블로커 |
| `commerce_boundary` | ❌ 미적재 | Dev-A 블로커 |
| `od_flows` | ❌ 미적재 | Dev-A 블로커 |
| `od_flows_aggregated` | ❌ 미적재 | od_flows 선행 필요 |
| `living_population` | ✅ 수집 스크립트 완료 | 실행 여부 미확인 |
| `store_info` | ✅ 수집 스크립트 완료 | 실행 여부 미확인 |
| `commerce_sales` | ✅ 수집 스크립트 완료 | 실행 여부 미확인 |
| `commerce_analysis` | ⏳ 분석 의존 | Module A~E 완료 후 |
| `adm_comm_mapping` | ❌ 미적재 | admin/commerce_boundary 선행 필요 |
| `flow_barriers` | ⏳ 분석 의존 | Module A 완료 후 |
| `policy_cards` | ⏳ 분석 의존 | Module D 완료 후 |
