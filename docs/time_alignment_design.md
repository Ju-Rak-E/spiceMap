# 시계열 정렬 설계

> 작성자: Dev-C | 작성일: 2026-04-12

## 1. 문제

원천 데이터의 시간 단위가 제각각이다:

| 데이터 | 원본 단위 | 분기 변환 |
|--------|----------|----------|
| OD 유동 | 일별 | 일별 합산 → 분기 일평균 |
| 생활인구 | 시간별 | 시간→일→분기 집계 |
| 점포정보 | 분기별 | 변환 불필요 |
| 추정매출 | 분기별 | 변환 불필요 |

Week 2 분석(GRI, 우선순위)은 **분기 단위**로 통합해야 한다.

## 2. 분기 코드 규칙

```
base_date → year_quarter
2025-10-15 → '20254'  (2025년 4분기)
2026-01-07 → '20261'  (2026년 1분기)
```

SQL: `EXTRACT(YEAR FROM base_date)::int::text || EXTRACT(QUARTER FROM base_date)::int::text`
Python: `f"{d.year}{(d.month - 1) // 3 + 1}"`

## 3. SQL VIEW 정의

### `vw_quarterly_od` — OD 유동 분기 집계

행정동 단위, 분기별 **일평균** 유입/유출/순유입.

| 컬럼 | 설명 | 단위 |
|------|------|------|
| year_quarter | 분기 코드 | 예: '20254' |
| adm_cd | 행정동 코드 | 8자리 |
| avg_daily_inflow | 일평균 유입 | 명/일 |
| avg_daily_outflow | 일평균 유출 | 명/일 |
| avg_daily_net_flow | 일평균 순유입 (유입-유출) | 명/일 |

**집계 로직**: 개별 OD 레코드를 일별·행정동별로 유입/유출 합산 후, 분기 내 일수로 평균.

### `vw_quarterly_pop` — 생활인구 분기 집계

행정동 단위, 분기별 피크/평균 인구.

| 컬럼 | 설명 | 용도 |
|------|------|------|
| year_quarter | 분기 코드 | |
| adm_cd | 행정동 코드 | |
| avg_pop | 전 시간대 평균 | 일반 배분 |
| peak_pop | 최대 시간대 값 | 상권 활성도 피크 |
| daytime_avg_pop | 주간 평균 (09~18시) | 상업 활동 지표 |
| nighttime_avg_pop | 야간 평균 (22~05시) | 거주/야간경제 지표 |

## 4. 피크 지표 정의 근거

| 지표 | 시간대 | 분석 용도 |
|------|--------|----------|
| 주간 인구 (09~18) | 10시간 | GRI의 순유입 증가 산출, 상권 활성도 |
| 야간 인구 (22~05) | 8시간 | 야간 경제 활성도, 흐름 단절 탐지 (QA H2) |
| 피크 인구 | 최대값 | 인프라 수용 한계 판단 |
| 전체 평균 | 24시간 | 공간 결합 시 면적 배분 기준 |

## 5. 사용법

### Python

```python
from backend.analysis.time_align import get_quarterly_od, get_quarterly_pop

od = get_quarterly_od(engine, "20254")    # 2025 Q4 OD 집계
pop = get_quarterly_pop(engine, "20254")  # 2025 Q4 생활인구 집계
```

### SQL (직접 사용)

```sql
-- 순유출 위험 상위 행정동
SELECT adm_cd, avg_daily_net_flow
FROM vw_quarterly_od
WHERE year_quarter = '20254'
ORDER BY avg_daily_net_flow ASC
LIMIT 10;

-- 주간/야간 인구 비율 (야간 경제 활성도)
SELECT adm_cd,
       daytime_avg_pop,
       nighttime_avg_pop,
       ROUND((nighttime_avg_pop / NULLIF(daytime_avg_pop, 0))::numeric, 2) AS night_day_ratio
FROM vw_quarterly_pop
WHERE year_quarter = '20262';
```

### 상권 단위로 결합 (adm_comm_mapping 사용)

```sql
-- 상권별 분기 일평균 유입 (면적 가중)
SELECT m.comm_cd,
       SUM(od.avg_daily_inflow * m.comm_area_ratio) AS weighted_inflow
FROM vw_quarterly_od od
JOIN adm_comm_mapping m ON od.adm_cd = m.adm_cd
WHERE od.year_quarter = '20254'
GROUP BY m.comm_cd;
```

## 6. 실행

```bash
# VIEW 생성
python -m backend.analysis.time_align

# 테스트 (합성 데이터, ROLLBACK)
python -m backend.analysis.time_align --test
```
