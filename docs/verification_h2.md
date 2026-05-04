# H2 검증 설계 — 흐름 단절 강도 → 폐업률 상관

> 작성: 2026-05-03 (D-9) · 코드: `backend/analysis/verification_h2.py` + `tests/analysis/test_verification_h2.py`
> 실행 스크립트: `scripts/run_validation_h2_b1.py --quarter 2025Q4`

## 1. 가설

**H2**: flow_barriers 의 barrier_score 가 큰 상권 (= Q3 → Q4 OD 흐름이 강하게 단절된 상권) 은 동일 분기의 closure_rate 가 더 높다.

방향성 명제: "흐름 단절 → 폐업". H1(net_flow ↔ sales) 과 달리 **흐름이 끊긴 시점부터 폐업까지의 지연**을 가정하는 모델.

## 2. 입력

### flow_barriers (Module C 산출)

```sql
SELECT from_comm_cd, to_comm_cd, barrier_score
FROM flow_barriers
WHERE year_quarter = '2025Q4'
```

생성 경로: `backend/analysis/module_c_barriers.compute_flow_gaps()` — Q3 vs Q4 OD 페어 volume 감소율 ≥ 0.5 인 Top 200건. `barrier_score = clip((Q3 - Q4) / Q3, 0, 1)`.

### closure_rate (commerce_analysis 산출)

```sql
SELECT comm_cd AS commerce_code, closure_rate
FROM commerce_analysis
WHERE year_quarter = '2025Q4'
  AND closure_rate IS NOT NULL
```

상권별 분기 폐업률 (`store_info.close_rate` 자치구 평균을 LATERAL ST_Contains 매핑).

## 3. 변환

### 3-1. barrier_intensity 정의

flow_barriers 는 (from_comm_cd, to_comm_cd) **페어** 단위. 상권 단위 점수로 변환 필요:

```python
# backend/analysis/verification_h2.py:aggregate_barrier_intensity
from_side = barriers[["from_comm_cd", "barrier_score"]].rename({"from_comm_cd": "commerce_code"})
to_side   = barriers[["to_comm_cd",   "barrier_score"]].rename({"to_comm_cd":   "commerce_code"})
stacked   = pd.concat([from_side, to_side])
intensity = stacked.groupby("commerce_code")["barrier_score"].max()
```

**왜 max?**: "단절이 한 페어라도 강하게 발생하면 위험" 이라는 정성 가정. 평균 (mean) 은 다수의 약한 단절에 희석되어 신호 약해짐. 합계 (sum) 는 페어 수에 의존해 페어 많은 hub 상권이 과대평가됨.

대안: `mean` / `sum` / `weighted_mean` 도 향후 sensitivity 분석 대상. 본 v1.0 에서는 `max` 단일 고정.

### 3-2. join 전략

`intensity.merge(closures, on="commerce_code", how="inner")` — 양쪽 모두 데이터 있는 상권만. NaN 제거 후 N ≥ 5 검사.

## 4. 통계

### 4-1. Pearson r (선형 상관)

`scipy.stats.pearsonr(intensity, closure_rate)`.

- 가정: 양변 정규성 + 선형 관계. 위반 시 비편향 추정 어려움.
- 임계: **r ≥ 0.3** + **p < 0.05** 양성 → `passes_threshold = True`.

### 4-2. Spearman ρ (순위 상관)

`scipy.stats.spearmanr(intensity, closure_rate)`.

- 가정: 단조 관계만 (선형성 불요). 이상치에 robust.
- 보고만 — passes_threshold 판정에는 미사용.

### 4-3. 분산 0 처리

barrier_intensity 또는 closure_rate 의 nunique < 2 면 상관계수 정의 불가 → 0 반환, `passes_threshold=False`.

## 5. 임계값 결정 근거

| 임계 | 값 | 근거 |
|------|----|------|
| r ≥ 0.3 | 약한 ~ 중간 양의 상관 | 사회과학·정책 분석 통상값. H1 의 r ≥ 0.5(강한 상관) 보다 완화 — H2 는 시점 지연이 큰 가설이라 효과 약화 예상. |
| p < 0.05 | 통계적 유의 | 표준 임계. n=200 페어 → 200 개 상권 매핑 가능 (페어 양변 합산). |
| n ≥ 5 | 최소 표본 | 분산·상관 산출 가능 최소. 실데이터 n ≈ 200 예상. |

## 6. 한계

1. **자치구 매핑 closure_rate** — H3 와 동일 한계. 자치구 평균을 상권에 매핑하므로 분산 부족. 이는 H1·H2·H3 모두에 공통.
2. **페어 → 상권 max 집계** — 단절이 endpoint 한 곳만 발생해도 양쪽 상권이 동일 barrier_intensity 부여. 비대칭 단절(예: A→B 흐름만 끊김)을 양 상권에 동일하게 반영하는 한계. v2 에서 from/to 분리 후 다중 회귀.
3. **시점 동시성** — barrier_score(Q3→Q4 변화) 와 closure_rate(Q4 시점) 는 거의 동시점. 인과 추론에는 시간 lag 필요 (Q3 단절 → Q5 폐업).
4. **표본 크기** — flow_barriers Top 200 페어 → 매핑 상권 약 200 (중복 제외). 강남·관악 1,650 의 12% 표본.

## 7. 실데이터 실행 절차

### 7-1. 사전 조건

- Supabase 인증 (`.env` 의 DB_PASSWORD 입력)
- `commerce_analysis` Q4 데이터 존재 (없으면 `python -m backend.pipeline.run_analysis --quarter 2025Q4 --previous 2025Q3`)
- `flow_barriers` Q4 데이터 존재 (없으면 Module C 갭 산출 + 적재)

### 7-2. 실행

```bash
# 가상환경 활성
source .venv/bin/activate

# 권장: H1·H2·H3·B1 통합 산출 (4 가설 동시 갱신)
python -m scripts.run_validation_all \
    --quarter 2025Q4 \
    --previous 2025Q3 \
    --b1-csv data/baselines/seoul_change_index_2025Q4.csv \
    --out data/baselines/validation_2025Q4.json

# 또는 H2 + B1 만 (기존 좁은 범위 스크립트 유지)
python -m scripts.run_validation_h2_b1 \
    --quarter 2025Q4 \
    --b1-csv data/baselines/seoul_change_index_2025Q4.csv \
    --out data/baselines/validation_2025Q4.json
```

### 7-3. 결과 반영

산출된 `validation_2025Q4.json` 의 H2 결과를 `frontend/src/data/validation_results.json` 의 H2 카드 metric_primary, sample_size, criterion 필드에 수동 반영. ValidationView 가 자동 렌더링하고, 동일 fixture 를 backend `GET /api/insights/validation` (`backend/api/validation.py`) 도 그대로 응답한다 — 단일 소스 정책.

예시 (실측 후 갱신):

```json
{
  "id": "H2",
  "metric_primary": "Pearson r = 0.42",
  "metric_secondary": "p = 1.3e-09 / Spearman ρ = 0.38",
  "sample_size": "n = 187 / Q4 flow_barriers 200",
  "criterion": "임계 r ≥ 0.3 + p < 0.05 — PASS",
  ...
}
```

## 8. 시연 안전성

발표 시점 (D-1, 2026-05-11) 까지 실측 산출 완료 못 하더라도:
- 함수 + 테스트 (10 tests) 는 코드베이스에 존재 → 심사관 코드 검증 가능
- ValidationView H2 카드는 "함수 구현 완료, 산출 대기" 메시지로 정직 표시 — 거짓 수치 제시 안 함
- D-9 plans/db-enchanted-hinton.md §6 G3 "H2 검증 미구현" 갭은 **함수 단계 봉합** 까지 완료 (실측은 사용자 수동)

## 9. 참고

- `backend/analysis/verification_h2.py` — 함수 구현
- `tests/analysis/test_verification_h2.py` — 10 tests (양/음 상관, NaN, 분산 0, 임계 상수)
- `backend/analysis/verification_h3.py` — 유사 가설 검증 패턴 (참조)
- `docs/strategy_d13.md` §2 결정 A — Module C 시계열 갭 대체 결정
- `docs/kpi_summary.md` §1 — H1·H2·H3 결과 통합 표
