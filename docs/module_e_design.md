# Module E — 정책 우선순위 점수 설계

> 작성: 2026-04-22 / Dev-C
> 상태: Week 3 선행 설계 (구현 Week 3 후반)
> 근거: `docs/FR_Role_Workflow.md` F-06, FR-08
> 구현 파일 예정: `backend/analysis/module_e_priority.py`

---

## 1. 책임

상권별 분석 결과를 입력받아 **정책 개입 우선순위 점수(0~100)**를 산출한다.
순위 기반으로 UI에서 "우선순위 80+ 상권 TOP 리스트"를 표시하고, CSV 내보내기 대상도 된다.

- 입력: `gri_score` (Module B), 상권 매출·규모 (commerce_sales), 추세 지표
- 출력: `priority_score` (0~100, percentile rank) + 구성 요소 z-score/절대값
- 소비자: FastAPI `/api/insights/policy` (우선순위 리스트), Dev-B 상세 패널 "정책 우선순위 점수" 필드, CSV 내보내기 (F-10)

## 2. 설계 원칙

1. **위험(GRI) 중심, 규모·추세 가산**: 정책 개입이 필요한 상권은 위험이 높고, 효과의 가시성이 있어야 한다.
2. **percentile rank로 최종 스케일링**: 절대값이 아닌 상대 순위로 0~100 매핑 (상권 간 비교 가능성).
3. **결측치 허용**: 추세(trend) 계산이 불가한 상권은 trend_penalty=0으로 대체.
4. **설명 가능성**: 최종 점수와 함께 구성 요소 3종 값을 반환 → UI에서 근거 표시.

## 3. 공식 v1.0

### 3.1 원시 점수

```
priority_raw = 0.60 × gri_score
             + 0.25 × sales_size_score
             + 0.15 × trend_penalty
```

| 가중치 | 값 | 근거 |
|--------|-----|------|
| GRI | 0.60 | 위험 지표가 주 지표 |
| 매출 규모 | 0.25 | 정책 효과의 가시성 (대형 상권 개입이 파급력 큼) |
| 추세 가산 | 0.15 | 급락 중인 상권에 가산점 |

**총합 1.00** 유지.

### 3.2 구성 요소

#### `sales_size_score` (0~100)

최신 분기의 상권별 매출 합(`SUM(sales_amount) GROUP BY trdar_cd, quarter`)을 percentile rank로 변환.

```python
sales_size_score = rankdata(sales_amount_latest, method="average") / n × 100
```

- 매출 데이터 없는 상권: `sales_size_score = 0`

#### `trend_penalty` (0~100)

최근 2 분기(t-1, t) 매출 변화율 기반. 하락 심할수록 가산.

```
decline_rate = (sales_t_minus_1 - sales_t) / sales_t_minus_1   # 양수면 하락
trend_penalty = clip(decline_rate × 200, 0, 100)               # 50% 하락 시 100
```

- 2 분기 데이터 부족 시: `trend_penalty = 0` (정보 없음 → 감점 없음)
- **`sales_t_minus_1 == 0` 또는 NaN**: 신규 개장 상권 등 — `trend_penalty = 0` (zero division 방지)
- 분기 인접성 주의: `quarter_coverage_report.md`에 따라 2025Q2/Q3 결측 → 2025Q1 → 2025Q4는 "3 분기 지연"으로 계산에서 제외하거나 플래그 처리

### 3.3 최종 스케일링

```python
priority_score = rankdata(priority_raw, method="average") / n × 100
```

## 4. 인터페이스

```python
# backend/analysis/module_e_priority.py
import pandas as pd

def compute_priority_scores(
    gri_df: pd.DataFrame,              # Module B 출력: commerce_code, quarter, gri_score
    sales_df: pd.DataFrame,            # commerce_sales: trdar_cd, year_quarter, sales_amount
    target_quarter: str,                # 예: "20254"
    previous_quarter: str | None,       # 추세 계산용, None 시 trend_penalty=0
) -> pd.DataFrame
```

### 출력 스키마

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `commerce_code` | VARCHAR | 상권 코드 |
| `quarter` | VARCHAR(6) | 산출 대상 분기 |
| `priority_score` | NUMERIC(5,2) | 0~100 percentile rank |
| `gri_score` | NUMERIC(5,2) | 재참조 (구성 요소 1) |
| `sales_size_score` | NUMERIC(5,2) | 구성 요소 2 |
| `trend_penalty` | NUMERIC(5,2) | 구성 요소 3 |
| `is_top_priority` | BOOLEAN | `priority_score ≥ 80` (F-06 임계값) |
| `computed_at` | TIMESTAMP | 산출 시각 |

## 5. 임계값 결정

| 구간 | 해석 | UI 동작 |
|------|------|--------|
| ≥ 80 | 긴급 (정책 개입 우선 대상) | TOP 리스트 포함, CSV 기본 필터 |
| 60~80 | 주의 (추세 관찰) | 경고 배지 |
| 40~60 | 관찰 | 일반 표시 |
| < 40 | 안정 | 패널 기본 숨김 가능 |

FR-08 "우선순위 80+ 상권 목록 CSV 내보내기"와 일치.

## 6. 검증 방법

### 6.1 분포 검증
- `priority_score` 히스토그램이 0~100 고르게 분포하는지 (percentile rank 특성)
- 상위 10%(90+) 상권이 실제 문제 상권인지 스팟 체크

### 6.2 베이스라인 비교 (Week 4)
- **B1 (상권변화지표 OA-15576)**: 기존 지표의 위험 상권 집합과 겹치는 비율 (Jaccard similarity)
- **B3 (직전 추세 연장)**: 매출 단순 하락 순위와의 Spearman rank correlation
- 목표: B1 대비 Jaccard ≥ 0.5, B3 대비 Spearman > 0.3 (상권변화지표는 포착 못 하는 위험을 Module E가 추가 포착)

### 6.3 H2 연계
- Module E 상위 20% 상권이 다음 분기 폐업률 상승과 얼마나 일치하는지 → 예측 적합도

## 7. TDD 계획 (구현 시)

```python
# tests/analysis/test_module_e_priority.py

class TestComputePriorityScores:
    def test_output_has_priority_score_column(self):
    def test_priority_in_0_100_range(self):
    def test_top_priority_flag_matches_80_threshold(self):
    def test_higher_gri_correlates_with_higher_priority(self):
    def test_trend_penalty_zero_when_previous_quarter_missing(self):
    def test_sales_size_score_uses_percentile_rank(self):
    def test_input_dataframes_not_mutated(self):
    def test_missing_sales_data_gives_zero_size_score(self):
    def test_decline_50pct_gives_full_trend_penalty(self):
```

## 8. 의존성 현황

| 의존 | 상태 | 영향 |
|------|------|------|
| Module B `gri_score` | ✅ 구현 완료 | 입력 1 확보 |
| `commerce_sales` (2 분기 이상) | ✅ 6 분기 적재 | 추세 계산 가능 |
| `store_info.closure_rate` | ✅ 적재 | Module B 선행 필요 |
| Module A 실데이터 | ❌ Dev-A 대기 | Module B 실데이터 실행 차단 |

**Week 3 구현 가능 시점**: Dev-A 블로커 해제 후 Module B 실데이터 실행 → Module E 가능.
**임시 방편**: Module A 더미 → Module B 결과 → Module E 산출까지 Week 3 중반 실행 가능.

## 9. 확장 계획

| 버전 | 확장 내용 | 시점 |
|------|---------|------|
| v1.0 | GRI + size + trend 3요소 | Week 3 |
| v1.1 | 시간대 피크 가중치(생활인구) 추가 | Week 4 |
| v1.2 | 정책 집행 과거 이력 패널티(이미 개입한 상권 감점) | 대회 후 |
| v2.0 | 자치구 예산 제약 조건 포함 최적화 | 대회 후 |

## 10. Module D·E 상호작용

- **Module D 카드 수**와 **Module E 점수**는 독립 지표.
- UI 상세 패널: "우선순위: 87점 (TOP 20%) + 추천 정책 3건".
- CSV 내보내기 (F-10): `priority_score ≥ 80` 필터로 상권 목록 추출.
