# od_flows_aggregated Q3 적재 + Q4 단위 불일치 수정 (2026-04-29)

> Supabase `clyqvncpcfyfljbqgdig` · 작성: Dev-C 김광오
> 트리거: 2025Q3 OD 적재 직후 Q4와 비교 시 `trip_count_sum` 단위 불일치 발견

## 1. 배경

이전에 적재된 `od_flows_aggregated` 2025Q4(`182,971`행)의 `trip_count_sum`이
**분기 합계가 아닌 일별/단일 단위 값**으로 들어와 있었다. 단일 일자(2025-10-01)
raw 합계(5.1M)보다도 분기 적재본 합계(1.3M)가 작았다.

## 2. 검증 절차

| 비교 | rows | min | median | avg | max | total |
|------|------|-----|--------|-----|-----|-------|
| Q3 적재본 (Dev-C 신규 파이프라인) | 183,506 | 1 | 256.4 | 2,263 | 3,059,390 | **415M** |
| Q4 적재본 (이전, 의심) | 182,971 | 1 | **3.5** | **7.1** | **5,825** | **1.3M** |
| 2025-10-01 단일일 raw (참조) | 146,006 | — | 8.3 | 35 | 33,237 | 5.1M |

결정적 단서: Q4 max(5,825)가 **단 1일 raw max(33,237)의 1/6** 수준. 분기 합산 결과로
나올 수 없는 스케일.

## 3. 적재 파이프라인 (Q3 + Q4 공통)

`/tmp/q{3,4}_od_pipeline.py`:

```
서울 OA-22300 일별 ZIP (POST datafile.seoul.go.kr/.../nio_download.do)
  ↓ 92일 반복 + 0.4s sleep
인코딩 fallback (cp949 → utf-8 자동)
  ↓
filter_mvp() — origin/dest prefix 1168(강남) or 1162(관악)
  ↓
aggregate_dataframe() — (year_quarter, origin, dest, purpose) 합산
  ↓
5일마다 rolling DataFrame 컴팩트 + 체크포인트(/tmp/od_qN_partial.json)
  ↓
JSON 출력 (/tmp/od_qN_aggregated.json)
```

업로드: `/tmp/q{3,4}_upload.py`

```
psycopg2 + execute_values (multi-row INSERT, batch 500)
  ↓
SET statement_timeout = 0 (Supabase Pooler 60s 제약 우회)
  ↓
INSERT ... VALUES %s ON CONFLICT DO UPDATE SET trip_count_sum = EXCLUDED.trip_count_sum
```

## 4. 적재 결과

### Q3 (신규)

- 다운로드 + 집계: ~22분 (92일, 0 skipped)
- 업로드: 17.6초 (10,406 rows/sec)
- 검증: 183,506 rows

### Q4 (재적재)

- 다운로드 + 집계: ~25분
- 업로드: 25.3초 (7,243 rows/sec)
- 멱등 — 기존 182,971행 `ON CONFLICT DO UPDATE`로 덮어쓰기
- 검증: 182,971 rows

### Q3 vs Q4 동등 척도 검증

상위 8개 OD 페어의 Q4/Q3 비율: **0.942 ~ 1.049** (계절 변동 ±5% 수준).
median/avg/max/total 모두 동일 자릿수.

## 5. 활성화된 후속 작업

- Module E `trend_penalty`: Q3→Q4 매출 변화 가산 (단, `commerce_sales` Q3 추가 적재 별도 필요)
- H2 검증: 시계열 OD 갭 → 폐업률 상관
- H3 검증: Q3 GRI 고위험 → Q4 폐업률 일치도
- Hero shot: 신림 골목상권 Q3→Q4 유입 변화 (정상 수치)
- Module C 시계열 갭 알고리즘 (Q3 vs Q4 OD volume 감소율 Top-N)

## 6. 재현 가능성

스크립트는 `/tmp/`에 임시 저장됨. 향후 재실행 또는 다른 분기 적재가 필요하면
`backend/pipeline/aggregate_od_flows.py`(원본 파일) 또는 본 1회성 스크립트를
참조. 프로덕션 통합은 별도 PR로 정형화 예정.

## 7. 참고 파일

| 파일 | 용도 |
|------|------|
| `/tmp/q3_od_pipeline.py`, `/tmp/q4_od_pipeline.py` | 다운로드+집계 |
| `/tmp/q3_upload.py`, `/tmp/q4_upload.py` | psycopg2 업로드 |
| `/tmp/od_q3_aggregated.json`, `/tmp/od_q4_aggregated.json` | 집계 산출물 |
| `backend/pipeline/aggregate_od_flows.py` | 원본 집계 코드 (재사용) |
| `backend/pipeline/load_od_flows.py:filter_mvp` | MVP 필터 |
