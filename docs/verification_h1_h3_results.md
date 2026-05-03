# H1·H3 검증 결과 (2026-04-30)

> Supabase 실데이터 기준 1차 실행 결과 + 한계 분석.
> 작성: Dev-C 김광오 · 사용 모듈: `verification_h1.py`, `verification_h3.py` (신규).

---

## H1 — 순유입 ↑ → 매출 ↑

**가설**: Module A `net_flow`(분기별)이 클수록 같은 분기 매출이 큰가.

| 메트릭 | 값 |
|--------|-----|
| Pearson r | **0.1056** |
| p-value | 2.83 × 10⁻⁵ |
| n (matched commerces) | 1,565 |
| 임계 (r ≥ 0.5, p < 0.05) | **FAIL** (r 미달) |

**해석**:
- 통계적으로 **유의(p < 0.05)** 한 양의 상관 — 가설 방향 지지.
- 단 r=0.11 로 효과 크기는 약함. 매출이 순유입만으로 설명되지 않으며, 상권 규모/업종 mix 등 교란 변수가 큼.
- 산점도 후속 분석 + log 스케일 변환 또는 자치구 컨트롤 회귀가 필요.

---

## H3 — Q3 GRI 고위험 → Q4 폐업률 상승

**가설**: Q3 GRI 상위 20% 상권의 Q4 평균 폐업률이 하위 80% 대비 +2%p 이상 높다.

| 메트릭 | 값 |
|--------|-----|
| n_total | 1,650 |
| n_top (상위 20%) | 330 |
| n_bottom (하위 80%) | 1,320 |
| Q4 평균 폐업률 — top | **0.800%** |
| Q4 평균 폐업률 — bottom | **0.055%** |
| gap (top − bottom) | **0.746%p** |
| t-stat | (Welch) |
| p-value | 5.26 × 10⁻³⁶ |
| 임계 (gap ≥ 2.0%p) | **FAIL** (gap 미달) |

**해석**:
- 통계적으로 매우 강한 유의(p ≈ 5×10⁻³⁶) — 가설 방향성은 명확히 지지.
- gap 0.75%p로 절대 폐업률 격차는 작음. 원인:
  - `closure_rate`가 **자치구 단위 평균값**으로 매핑됨 (각 상권 individual 폐업률이 아닌 자치구 집계).
  - 강남(11680) 평균 ≈ 1.798%, 관악(11620) 평균 ≈ 0.000%처럼 자치구 두 값에 상권이 집중 → 분산이 작아 gap도 작음.

---

## 한계 + 개선 후속

| 한계 | 개선 방안 |
|------|----------|
| H1 r=0.11 약함 | 자치구 컨트롤 회귀, log(sales) 변환, top/bottom decile 비교 |
| H3 gap 0.75%p < 2.0%p | 자치구 단위 closure_rate → 상권 단위 폐업률 데이터 확보 (OA-15577 raw 활용) |
| 두 KPI 모두 통계 유의이나 효과 미달 | 베이스라인(B1 OA-15576) 대비 **상대 우위** 측정으로 보강 |

다음 단계: B1 OA-15576 상권변화지표 정적 다운로드 → Module E priority_score 와 Jaccard / Spearman 비교 → "기존 지표가 놓친 위험 N건" KPI 산출 (`docs/strategy_d13.md §7 발표 0:30~1:30 hero shot` 보강).

---

## 산출물

- `backend/analysis/verification_h1.py` (기존, 재사용)
- `backend/analysis/verification_h3.py` (신규, 12 tests pass)
- `/tmp/run_verifications.py` (1회성 driver)
- `/tmp/verification_report.json` (결과 JSON)
