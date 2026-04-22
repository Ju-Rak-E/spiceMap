# od_flows 분기 집계본 설계

> 작성: 2026-04-22 / Dev-C
> 플랜: `.claude/plans/eventual-humming-reef.md` (2026-04-22 승인)
> 상태: PR 1 완료 — 스키마·집계 스크립트·Module A 어댑터
> 후속: PR 2 — Supabase 이전 + 에스컬레이션 메시지 수정

---

## 배경

- 원본 `od_flows` 8천만 행 (강남·관악 MVP 필터 + 3개월), ~10GB 규모
- Dev-A 로컬에만 존재, 팀 공유 불가능
- Module A/B/C/D/E는 **집계된 입력**만 필요 → 원본 전체 공유 과도

## 해결책

**2단 테이블 구조**

```
od_flows              (Dev-A 로컬, 80M 행, 공유 X)
  │
  ▼ aggregate_od_flows.py (UPSERT, idempotent)
  │
od_flows_aggregated   (팀 공유 원장, ~300K 행 이내, Supabase)
  │
  ▼ load_quarterly_od_flows(engine, "2026Q1")
  │
[origin_adm_cd, dest_adm_cd, trip_count] DataFrame
  │
  ▼
Module A / B / C / D / E
```

## 스키마 (`od_flows_aggregated`)

| 컬럼 | 타입 | 의미 |
|------|------|------|
| `id` | BIGINT PK | 자동 증가 |
| `year_quarter` | VARCHAR(6) | `2026Q1` 포맷 |
| `origin_adm_cd` | VARCHAR(10) | 출발 행정동 코드 |
| `dest_adm_cd` | VARCHAR(10) | 도착 행정동 코드 |
| `move_purpose` | INTEGER | 이동 목적 (NULL 허용) |
| `trip_count_sum` | FLOAT | 일자·내외국인 합산 이동량 |

**유니크 키**: `(year_quarter, origin_adm_cd, dest_adm_cd, move_purpose)` — UPSERT 재집계 시 idempotent.
**인덱스**: origin, dest, year_quarter 각각 B-tree.

## 집계 차원 결정 근거

| 원본 차원 | 집계 후 | 근거 |
|-----------|--------|------|
| 일자 (`base_date`) | → 분기 (`year_quarter`) 합산 | FR_Role_Workflow §3.3 "월 → 분기 롤링", commerce_sales와 조인 용이 |
| 출발 행정동 | 유지 | 지리 정보, Module A 입력 필수 |
| 도착 행정동 | 유지 | 동일 |
| 목적 (`move_purpose`) | 유지 | F-11 "시간대·목적 필터 출근/쇼핑" 스펙 요구 |
| 내외국인 (`in_forn_div`) | → 합산 제거 | 대회 주제(상권·젠트리피케이션)에 필요 없음, 3배 축소 |

## 축소 효과

| 단계 | 행 수 | 축소 배율 |
|------|-------|---------|
| 원본 (일×출×도×목적×내외국인, MVP 3개월) | **80M** | 1× |
| 일 → 분기 (90배 축소) | ~890K | 90× |
| + 내외국인 합산 (3배) | **~300K** | 270× |
| DB 크기 (인덱스 포함) | **~40 MB** | — |

→ Supabase 무료 티어(500MB) 대비 8%만 사용. 확장 여유 큼.

## 파일 구조

### 모델 — `backend/models.py`

- `OdFlow` — 원본 (Dev-A 로컬 전용 주석 추가)
- `OdFlowAggregated` — 신규 집계 테이블

### 집계 스크립트 — `backend/pipeline/aggregate_od_flows.py`

공개 함수:
- `derive_year_quarter(date) -> str` — 날짜 → YYYYQ# 변환
- `aggregate_dataframe(raw, quarter=None) -> DataFrame` — pandas 집계 (테스트·통합 공용)
- `aggregate_to_db(engine, quarter, dry_run) -> int` — PG UPSERT 실행

CLI:
```bash
python -m backend.pipeline.aggregate_od_flows --quarter 2026Q1
python -m backend.pipeline.aggregate_od_flows --all
python -m backend.pipeline.aggregate_od_flows --quarter 2026Q1 --dry-run
```

### Module A 어댑터 — `backend/analysis/module_a_graph.py`

```python
load_quarterly_od_flows(engine, year_quarter, move_purposes=None) -> DataFrame
```
- `od_flows_aggregated`에서 특정 분기 조회
- `move_purpose` 합산 후 Module A 입력 스키마로 리네임
- 포맷 검증 (`YYYYQ#`) 후 parameterized query

기존 함수(`build_commerce_flow_graph`, `compute_degree_metrics`) **무변경**.

## Dev-A 워크플로우 (블로커 해제 후)

1. 원본 CSV → `load_od_flows.py`로 `od_flows` 적재 (기존 방식)
2. `python -m backend.pipeline.aggregate_od_flows --all` 실행
3. `pg_dump -Fc -t od_flows_aggregated spicemap > od_agg.dump` (수십 MB)
4. GWS 공유 폴더에 업로드 또는 Supabase 직접 적재

## 검증 방법

### 자동 테스트 (`pytest tests/pipeline/`, `tests/analysis/test_module_a_load.py`)

| 케이스 | 검증 |
|--------|------|
| `test_month_to_quarter_mapping` | 월→분기 경계 (12/1월) |
| `test_sums_across_dates_and_forn_div` | 일·내외국인 합산 정확성 |
| `test_separates_different_purposes` | 목적 차원 유지 |
| `test_null_move_purpose_preserved_as_group` | NULL 처리 |
| `test_aggregate_dataframe_is_idempotent` | 2회 집계 동일 |
| `test_rejects_malformed_year_quarter` | 포맷 검증 |
| `test_result_feeds_module_a_without_error` | 파이프라인 통합 |

### 수동 검증 (Dev-A 원본 적재 후)

```sql
-- 집계 합 = 원본 합 검증
SELECT SUM(trip_count_sum) FROM od_flows_aggregated WHERE year_quarter = '2026Q1';
SELECT SUM(trip_count) FROM od_flows WHERE base_date BETWEEN '2026-01-01' AND '2026-03-31';
-- 두 값이 일치해야 함
```

## 제외된 선택지

| 대안 | 제외 근거 |
|------|----------|
| 월별 집계 | FR §3.3 분기 단위, 스펙과 불일치, 3배 크기 증가 |
| 상권 레벨 집계 (`commerce_code`) | `adm_comm_mapping` 변경 시 재집계 필요, 유연성 하락 |
| 원본 `od_flows` 제거 | 파생 지표 변경 필요 시 재집계 불가 |
| 내외국인 유지 | 대회 주제 밖, 3배 크기 증가 |
