# Week 3 Day 1 구현 계획

> 작성: 2026-04-22 / Dev-C
> 범위: Module E 설계 선행 + Module D 부분 구현 (R4~R7)
> 블로커: od_flows 미적재 → R1~R3·R8은 이번 PR에서 제외

---

## 산출물

| # | 파일 | 종류 | 내용 |
|---|------|------|------|
| 1 | `docs/module_e_design.md` | 설계 | Module E 우선순위 점수 공식 설계 |
| 2 | `backend/schemas/insights.py` | 스키마 | PolicyCard Pydantic 모델 |
| 3 | `backend/analysis/commerce_type.py` | 구현 | 상권 유형 근사 분류기 (v1.0) |
| 4 | `backend/analysis/module_d_policy.py` | 구현 | Module D R4~R7 규칙 평가기 |
| 5 | `tests/analysis/test_commerce_type.py` | 테스트 | 분류기 단위 테스트 |
| 6 | `tests/analysis/test_module_d_policy.py` | 테스트 | R4~R7 규칙 평가 테스트 |

## 범위 의도적 제외

- Module E **구현** (설계만) — 실데이터 분기 추세 분석이 필요한데 2025Q2/Q3 결측으로 Week 3 후반 재검토
- Module D **R1~R3·R8** — `od_flows` 의존 (Module A 실데이터 필요)
- Module C — `od_flows` 의존

## Module E 설계 (문서만)

### 공식 v1.0
```
priority_raw = 0.60 * gri_score
             + 0.25 * sales_size_percentile
             + 0.15 * trend_penalty

priority_score = percentile_rank(priority_raw) × 100   # 0~100
```

### 구성 요소
- `gri_score`: Module B 출력 (0~100)
- `sales_size_percentile`: 최신 분기 `commerce_sales.sales_amount` 합의 percentile rank
- `trend_penalty`: 최근 2 분기 매출 변화율 기반 0~100 (하락 시 가산, 상승 시 0)

### 검증
- 우선순위 80+ 상권이 기존 상권변화지표(OA-15576) 위험 상권과 얼마나 겹치는지 (베이스라인 B1)
- Module D R1, R4 발동 상권 대비 커버리지 확인

## Module D R4~R7 구현 (TDD)

### 상권 유형 근사 분류 (v1.0, `commerce_type.py`)

`net_flow`와 `gri_score`로 5종 유형을 분류. 임대료·프랜차이즈 없이 근사 규칙 사용.

| 유형 | 조건 (v1.0) |
|------|------------|
| 흡수형_과열 | `net_flow ≥ P75` AND `gri_score ≥ 60` |
| 흡수형_성장 | `net_flow ≥ P75` AND `gri_score < 40` |
| 방출형_침체 | `net_flow ≤ P25` AND `closure_rate ≥ 5%` |
| 고립형_단절 | `abs(net_flow) ≤ P25` AND `degree_centrality ≤ P25` |
| 안정형 | `P25 < abs(net_flow) < P75` AND `gri_score < 40` |
| (기타) | unclassified |

> 방출형_침체 / 고립형_단절은 `od_flows` 적재 후 정확도 향상. v1.0에서도 조건만 맞으면 분류.

### 규칙 평가 (v1.0, `module_d_policy.py`)

이번 PR에서 **R4, R5, R6, R7만 활성화**. R1~R3·R8은 골격만 두고 No-op로 선언해 Week 3 후반에 채운다.

| ID | 유형 | GRI | 심각도 | 정책 |
|----|------|-----|-------|------|
| R4 | 흡수형_과열 | ≥70 | Critical | 젠트리피케이션 예방: 임대료 상한 가이드라인 + 상생 협약 |
| R5 | 흡수형_과열 | 50~70 | Medium | 업종 균형: 프랜차이즈 비율 모니터링 |
| R6 | 흡수형_성장 | <40 | Low | 성장 지원: 업종 박람회·소셜 마케팅 연계 |
| R7 | 안정형 | <30 | Low | 유지 관리: 정기 모니터링 |

### PolicyCard 스키마

```python
# backend/schemas/insights.py
from pydantic import BaseModel
from typing import Literal

Severity = Literal["Critical", "High", "Medium", "Low"]

class PolicyCard(BaseModel):
    rule_id: str                  # "R4" 등
    commerce_code: str
    commerce_name: str
    severity: Severity
    policy_text: str
    rationale: str
    triggering_metrics: dict[str, float]
    generation_mode: Literal["rule_based"] = "rule_based"  # FR-07 고정
```

## TDD 계획

### test_commerce_type.py
- `test_흡수형_과열_when_high_inflow_high_gri`
- `test_흡수형_성장_when_high_inflow_low_gri`
- `test_방출형_침체_when_low_inflow_high_closure`
- `test_고립형_단절_when_low_centrality_low_flow`
- `test_안정형_when_mid_flow_low_gri`
- `test_unclassified_for_boundary_cases`
- `test_percentiles_computed_from_input_df` — 입력 df 기준 threshold
- `test_empty_input_returns_empty_df`

### test_module_d_policy.py
- `test_r4_triggers_when_hot_absorbing_and_gri_70_plus`
- `test_r4_not_triggered_when_gri_below_70`
- `test_r5_triggers_middle_gri_hot_absorbing`
- `test_r5_boundary_not_trigger_at_70` (R4가 점유)
- `test_r6_triggers_growth_absorbing_low_gri`
- `test_r7_triggers_stable_very_low_gri`
- `test_r7_not_triggered_for_stable_mid_gri`
- `test_empty_input_returns_empty_list`
- `test_multiple_rules_sorted_by_severity`
- `test_all_cards_tagged_rule_based` (FR-07)
- `test_rationale_is_non_empty`
- `test_unclassified_rows_produce_no_cards`

## Acceptance Criteria

- pytest 전체 통과 (기존 24 + 신규 ~18)
- Module D 함수가 `generate_policy_cards(df, barriers=None)` 시그니처 유지
- `PolicyCard.generation_mode == "rule_based"` 하드코딩 (FR-07)
- 순서: TDD RED → GREEN → 회귀 검증

## 의존성

- 기존: Module A (`module_a_graph.py`), Module B (`module_b_gri.py`)
- 신규 라이브러리 없음 (pandas, pydantic 기존 deps 활용)
