# DB 스키마 정의 (spiceMap)

> PostgreSQL + PostGIS  
> ORM: SQLAlchemy (`backend/models.py`)  
> 최종 수정: 2026-04-17

---

## 데이터셋 출처 한눈에 보기

| 테이블 | 데이터셋 ID | 데이터셋 명 | 출처 |
|--------|-----------|-----------|------|
| `admin_boundary` | **OA-22160** | 서울시 상권분석서비스 (영역-행정동) | 서울 열린데이터광장 |
| `commerce_boundary` | **OA-15560** | 서울시 상권분석서비스 (영역-상권) | 서울 열린데이터광장 |
| `od_flows` | **OA-22300** | 수도권 광역 OD (생활이동) | 공공데이터포털 |
| `living_population` | **OA-14991** | 서울 생활인구 (SPOP_LOCAL_RESD_DONG) | 공공데이터포털 |
| `store_info` | **OA-15577** | 상권분석 점포정보 (VwsmSignguStorW) | 공공데이터포털 |
| `commerce_sales` | **OA-15572** | 상권분석 추정매출 (VwsmTrdarSelngQq) | 공공데이터포털 |
| `commerce_analysis` | — | Dev-C 분석 산출물 (GRI, 유형, 우선순위) | — |
| `flow_barriers` | — | Dev-C 분석 산출물 (흐름 단절 구간) | — |

---

## 테이블 관계 개요

```
admin_boundary (행정동 폴리곤)
    ↕ 공간 결합 (PostGIS)
commerce_boundary (상권 폴리곤)
    │
    ├── od_flows          (행정동 간 이동량 → 상권 유입량 집계 재료)
    ├── living_population (행정동별 시간대 생활인구)
    ├── store_info        (자치구별 업종 점포 수·폐업률)
    ├── commerce_sales    (상권별 추정 매출)
    │
    └── commerce_analysis (분석 결과 ← Dev-C 산출물, FastAPI가 서빙)
         └── flow_barriers (흐름 단절 구간 ← Dev-C 산출물)
```

---

## 1. `admin_boundary` — 행정동 경계 `[서울시 상권분석서비스 영역-행정동]`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `adm_cd` | VARCHAR(10) PK | 행정동 코드 (8자리, 예: `11680500`) |
| `adm_nm` | VARCHAR(100) | 행정동 명 (예: `역삼1동`) |
| `gu_nm` | VARCHAR(50) | 자치구 명 (예: `강남구`) |
| `geom` | MULTIPOLYGON (SRID 4326) | 행정동 경계 폴리곤 |

**원본**: 서울시 상권분석서비스(영역-행정동) SHP  
**용도**: OD 흐름 시각화 기준 폴리곤, 생활인구 히트맵, 행정동↔상권 공간 결합 기준

---

## 2. `commerce_boundary` — 상권 경계 `[서울시 상권분석서비스 영역-상권]`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `comm_cd` | VARCHAR(20) PK | 상권 코드 (예: `3110008`) |
| `comm_nm` | VARCHAR(100) | 상권 명 (예: `배화여자대학교`) |
| `comm_type` | VARCHAR(50) | 상권 유형 (예: `골목상권`, `발달상권`) |
| `geom` | MULTIPOLYGON (SRID 4326) | 상권 경계 폴리곤 |

**원본**: 서울시 상권분석서비스(영역-상권) SHP (1,650개 상권)  
**용도**: 상권 노드 폴리곤, 분석 단위 기준, 행정동↔상권 공간 결합 대상

---

## 3. `od_flows` — 행정동 간 OD 이동량 `[OA-22300]`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | BIGINT PK | 자동 증가 |
| `base_date` | DATE | 기준일 |
| `origin_adm_cd` | VARCHAR(10) | 출발 행정동 코드 |
| `dest_adm_cd` | VARCHAR(10) | 도착 행정동 코드 |
| `move_purpose` | INTEGER | 이동 목적 코드 (1=출근, 2=하원, 3=귀가, …) |
| `in_forn_div` | VARCHAR(10) | 내외국인 구분 (`내국인` / `단기외국인` / `장기외국인`) |
| `trip_count` | FLOAT | 이동 건수 추정값 |

**원본**: OA-22300 (서울 광역 OD), 일별 ZIP 다운로드  
**현황**: 2025-10-01 ~ 진행 중 (2025Q4 수집 중)  
**MVP 필터**: 출발 또는 도착이 강남구(`1168xxxx`) · 관악구(`1162xxxx`)  
**분석 활용**: 3개월 롤링 평균 → 분기 단위 집계, 행정동별 순유입·순유출 계산

---

## 4. `living_population` — 서울 생활인구 `[OA-14991]`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | BIGINT PK | 자동 증가 |
| `base_date` | DATE | 기준일 |
| `hour_slot` | INTEGER | 시간대 (0~23) |
| `adm_cd` | VARCHAR(10) | 행정동 코드 |
| `total_pop` | FLOAT | 총 생활인구 수 |

**원본**: OA-14991 (서울 생활인구 월별 CSV 파일)  
**현황**: 2025-10 ~ 2025-12 적재 완료 (94,944행)  
**MVP 필터**: 강남구(`1168xxxx`) · 관악구(`1162xxxx`)  
**분석 활용**: 출근피크(6~9시), 점심(11~14시), 저녁(17~20시) 평균 → 시간대 수요 지표

---

## 5. `store_info` — 자치구별 점포 정보 `[OA-15577]`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | BIGINT PK | 자동 증가 |
| `year_quarter` | VARCHAR(6) | 연도분기 코드 (예: `20254`) |
| `signgu_cd` | VARCHAR(10) | 자치구 코드 (예: `11680`) |
| `signgu_nm` | VARCHAR(50) | 자치구 명 |
| `industry_cd` | VARCHAR(20) | 업종 코드 |
| `industry_nm` | VARCHAR(100) | 업종 명 |
| `store_count` | FLOAT | 점포 수 |
| `open_rate` | FLOAT | 개업률 (%) |
| `open_count` | FLOAT | 개업 점포 수 |
| `close_rate` | FLOAT | 폐업률 (%) |
| `close_count` | FLOAT | 폐업 점포 수 |
| `franchise_count` | FLOAT | 프랜차이즈 점포 수 |

**원본**: OA-15577 (VwsmSignguStorW), 분기별  
**현황**: 5,599행 적재  
**단위 주의**: 자치구 단위 (상권 코드 없음) — 상권과 결합 시 자치구 코드(`signgu_cd`) 기준

---

## 6. `commerce_sales` — 상권별 추정 매출 `[OA-15572]`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | BIGINT PK | 자동 증가 |
| `year_quarter` | VARCHAR(6) | 연도분기 코드 (예: `20254`) |
| `trdar_cd` | VARCHAR(20) | 상권 코드 (`commerce_boundary.comm_cd`와 결합) |
| `trdar_nm` | VARCHAR(100) | 상권 명 |
| `trdar_se_cd` | VARCHAR(5) | 상권 구분 코드 (`A`=골목, `D`=발달 등) |
| `industry_cd` | VARCHAR(20) | 업종 코드 |
| `industry_nm` | VARCHAR(100) | 업종 명 |
| `sales_amount` | FLOAT | 월 매출액 (원) |
| `sales_count` | FLOAT | 월 매출 건수 |
| `weekday_sales` | FLOAT | 주중 매출액 |
| `weekend_sales` | FLOAT | 주말 매출액 |

**원본**: OA-15572 (VwsmTrdarSelngQq), 분기별  
**현황**: 21,333행 적재  
**결합 키**: `trdar_cd` ↔ `commerce_boundary.comm_cd`

---

## 7. `commerce_analysis` — 분석 결과 (Dev-C 산출)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | BIGINT PK | 자동 증가 |
| `year_quarter` | VARCHAR(7) | 분기 (예: `2025Q4`) |
| `comm_cd` | VARCHAR(20) | 상권 코드 |
| `comm_nm` | VARCHAR(100) | 상권 명 |
| `gri_score` | FLOAT | 상권 위험 지수 (0~100) |
| `flow_volume` | BIGINT | 유입 이동량 합산 |
| `dominant_origin` | VARCHAR(10) | 주 유입 출발 행정동 코드 |
| `analysis_note` | TEXT | 정책 제언 텍스트 |

**산출**: Dev-C Module B (GRI 산출)  
**서빙**: FastAPI가 직접 쿼리 → 프론트엔드  
**현황**: 미산출 (Week 2 대상)

---

## 8. `flow_barriers` — 흐름 단절 구간 (Dev-C 산출)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | BIGINT PK | 자동 증가 |
| `year_quarter` | VARCHAR(7) | 분기 |
| `from_comm_cd` | VARCHAR(20) | 출발 상권 코드 |
| `to_comm_cd` | VARCHAR(20) | 도착 상권 코드 |
| `barrier_score` | FLOAT | 단절 강도 (높을수록 단절) |
| `barrier_type` | VARCHAR(50) | 단절 유형 (예: `도로`, `경계`) |

**산출**: Dev-C Module C (흐름 단절 탐지)  
**현황**: 미산출 (Week 2 대상)

---

## 데이터 적재 현황 요약

| 테이블 | 행 수 | 데이터 범위 | 상태 |
|--------|-------|-----------|------|
| `admin_boundary` | 425 | 서울시 행정동 전체 | ✅ 완료 |
| `commerce_boundary` | 1,650 | 서울시 상권 전체 | ✅ 완료 |
| `od_flows` | 80,573,657 | 2025-10-01 ~ 2026-02-28 (강남·관악 MVP 필터) | ✅ 완료 |
| `living_population` | 94,944 | 2025-10-01 ~ 2025-12-31 (강남·관악 MVP 필터) | ✅ 완료 |
| `store_info` | 5,599 | 2019Q1 ~ 2025Q4 | ✅ 완료 |
| `commerce_sales` | 21,333 | 2025Q4 | ✅ 완료 |
| `commerce_analysis` | 0 | — | Week 2 (Dev-C 산출 대기) |
| `flow_barriers` | 0 | — | Week 2 (Dev-C 산출 대기) |

> 최종 갱신: 2026-04-16

---

## DB 접속 방법 (로컬)

```bash
# docker-compose 실행 (처음 한 번)
docker compose up -d

# psql 접속
psql -h localhost -p 5433 -U postgres -d spicemap

# 테이블 목록 확인
\dt

# 스키마 확인 (예: od_flows)
\d od_flows

# 행 수 확인
SELECT COUNT(*) FROM od_flows;
```

`.env` 파일 필요 (팀장에게 요청):
```
DB_HOST=localhost
DB_PORT=5433
DB_NAME=spicemap
DB_USER=postgres
DB_PASSWORD=****
```
