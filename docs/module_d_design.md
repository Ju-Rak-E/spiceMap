# Module D — 규칙 기반 정책 추천 카드 생성 설계

> 작성: 2026-04-22 / Dev-C
> 상태: Week 3 선행 설계 (구현 Week 3 중반)
> 근거: `docs/FR_Role_Workflow.md` F-09, FR-07

---

## 1. 책임

상권별 분석 결과(유형, GRI, 흐름 지표)를 입력받아, 사전 정의된 규칙에 따라 **정책 추천 카드를 결정적(deterministic)으로** 생성한다.

- 입력: Module B(GRI) + Module C(단절) + 상권 유형 분류
- 출력: 정책 추천 카드 리스트 (JSON, FastAPI `/api/insights/policy` 응답 스키마)
- 제약: **규칙 기반 (생성형 AI 미사용)** — FR-07 준수 (발표 시 "규칙 기반 | 생성형 AI 미사용" 라벨 명시)

## 2. 설계 원칙

1. **결정성(determinism)**: 동일 입력 → 동일 출력. 테스트 가능성 최우선.
2. **설명 가능성(explainability)**: 각 카드는 "왜 이 정책인가"를 1문장 근거로 표기.
3. **우선순위 정렬**: 동일 상권에 여러 카드 발동 시 심각도 순서(Critical > High > Medium > Low)로 표시.
4. **한글 정책 용어**: 서울시·자치구 경제과 실무 표현 사용.

## 3. 상권 유형 정의 (Module D 진입 전제)

| 유형 | 조건 | 색상 (UI) |
|------|------|----------|
| 흡수형_과열 | 순유입↑ + 임대료↑ + 프랜차이즈↑ | 빨강 |
| 흡수형_성장 | 순유입↑ + 매출↑ + 임대료 안정 | 주황 |
| 방출형_침체 | 순유출 지속 + 폐업률↑ | 회색 |
| 고립형_단절 | 유입·유출 모두 낮음 + 연결도↓ | 진회색 |
| 안정형 | 변동성 낮음 + 지표 균형 | 초록 |

> v1.0 임대료·프랜차이즈 데이터 미확보 → 흡수형_과열/성장 분류는 근사 규칙 사용.
> 근사 규칙: `net_flow > P75 AND gri_score ≥ 60` → 흡수형_과열, `net_flow > P75 AND gri_score < 40` → 흡수형_성장.

## 4. 규칙 테이블 (v1.0 — 8개 규칙)

각 규칙은 `(유형, GRI 구간, 추가 조건) → (정책 템플릿, 심각도, 근거 문구)` 튜플이다.

| ID | 유형 | GRI | 추가 조건 | 정책 템플릿 | 심각도 | 근거 |
|----|------|-----|---------|------------|-------|------|
| R1 | 방출형_침체 | ≥80 | 폐업률 > 5% | 긴급 상권 회복 지원: 임대료 안정화 + 업종 다각화 컨설팅 | Critical | "폐업률 고위험 + 순유출 지속 → 상권 붕괴 임박" |
| R2 | 방출형_침체 | 60~80 | — | 선제 개입: 보행 유도 사인물 + 야간 경관 개선 | High | "순유출 구조가 고착화되기 전 조기 처방 필요" |
| R3 | 고립형_단절 | ≥60 | degree_centrality < P25 | 연결망 복원: 셔틀 노선 + 브랜딩 협업 | High | "네트워크 단절로 자연 유입 부족" |
| R4 | 흡수형_과열 | ≥70 | — | 젠트리피케이션 예방: 임대료 상한 가이드라인 + 상생 협약 | Critical | "유입 과열 + 폐업 상승 → 임대료 스파이크 시그널" |
| R5 | 흡수형_과열 | 50~70 | — | 업종 균형: 프랜차이즈 비율 모니터링 | Medium | "과열 진입 초기 — 업종 편중 방지" |
| R6 | 흡수형_성장 | <40 | — | 성장 지원: 업종 박람회·소셜 마케팅 연계 | Low | "건전한 성장 단계 — 가속 정책 적용 가능" |
| R7 | 안정형 | <30 | — | 유지 관리: 정기 모니터링 | Low | "위험 징후 없음 — 베이스라인 관찰" |
| R8 | 전체 | ≥90 | 단절 엣지 존재 | 흐름 단절 구간 현장 진단 파견 | Critical | "GRI 극값 + 물리적 단절 — 즉시 현장 조사" |

## 5. 출력 스키마

```python
# backend/schemas/insights.py (예정)
from pydantic import BaseModel
from typing import Literal

Severity = Literal["Critical", "High", "Medium", "Low"]

class PolicyCard(BaseModel):
    rule_id: str                  # "R1" ~ "R8"
    commerce_code: str
    commerce_name: str
    severity: Severity
    policy_text: str              # 정책 템플릿 출력
    rationale: str                # 근거 1문장
    triggering_metrics: dict      # {"gri_score": 82.1, "closure_rate": 7.2, ...}
    generation_mode: Literal["rule_based"]  # 항상 "rule_based" (FR-07)
```

## 6. 인터페이스

```python
# backend/analysis/module_d_policy.py
import pandas as pd

def generate_policy_cards(
    analysis_df: pd.DataFrame,  # commerce_code, commerce_name, commerce_type, gri_score, net_flow, degree_centrality, closure_rate
    barriers_df: pd.DataFrame,  # R8 트리거용: from_comm_cd, to_comm_cd, barrier_score
) -> list[PolicyCard]:
    """각 상권에 대해 적용 가능한 규칙을 모두 평가하여 카드 리스트 반환.

    동일 상권에 여러 규칙 발동 시 심각도 순서로 정렬.
    """
    ...
```

## 7. 결정 로직 (pseudo-code)

```python
def evaluate_rules(row, barriers) -> list[PolicyCard]:
    cards = []
    # R1: 방출형_침체 + GRI≥80 + 폐업률>5
    if row.commerce_type == "방출형_침체" and row.gri_score >= 80 and row.closure_rate > 5:
        cards.append(card_r1(row))
    # R2: 방출형_침체 + GRI 60~80
    if row.commerce_type == "방출형_침체" and 60 <= row.gri_score < 80:
        cards.append(card_r2(row))
    # ... R3~R7
    # R8: 전체 + GRI≥90 + 단절 엣지 존재
    if row.gri_score >= 90 and has_barrier(row.commerce_code, barriers):
        cards.append(card_r8(row))
    return sorted(cards, key=lambda c: SEVERITY_ORDER[c.severity])
```

## 8. TDD 계획 (Week 3 구현 시)

테스트 파일: `tests/analysis/test_module_d_policy.py`

- `test_r1_triggers_when_closure_rate_high` — R1 발동 조건 검증
- `test_multiple_rules_sorted_by_severity` — 동일 상권 다중 발동 시 정렬
- `test_no_rules_triggered_returns_empty_list` — 안정형·저위험 상권은 빈 리스트 (또는 R7만)
- `test_r8_requires_both_gri_and_barrier` — 두 조건 AND 게이트
- `test_all_cards_tagged_as_rule_based` — FR-07 준수
- `test_rationale_not_empty_for_each_card` — 설명 가능성 확보

## 9. Dev-B 인터페이스 (UI)

| UI 요소 | 데이터 소스 | 표시 |
|--------|-----------|------|
| 상세 패널 — 정책 추천 카드 | `PolicyCard.policy_text` | 심각도 배지 + 제목 |
| 카드 펼침 (상세) | `rationale` + `triggering_metrics` | 근거 문구 + 근거 지표 표 |
| "규칙 기반" 라벨 | `generation_mode="rule_based"` | 카드 하단 고정 (FR-07) |

## 10. 확장 계획

| 버전 | 확장 내용 | 시점 |
|------|---------|------|
| v1.0 | 8 규칙, MVP 범위 (강남·관악) | Week 3 |
| v1.1 | 임대료/프랜차이즈 데이터 연동 → 흡수형 정확도 향상 | Week 4 |
| v1.2 | 규칙 가중치 튜닝 (H3 검증 결과 반영) | Week 4~5 |
| v2.0 | 생성형 AI 설명 스트리밍 (규칙은 유지) | 대회 후 |

## 11. 의존성 현황

| 의존 | 상태 | Module D 진입 영향 |
|------|------|-------------------|
| Module A `net_flow`, `degree_centrality` | ✅ 구현 완료 | 더미 TDD → 실데이터 필요 |
| Module B `gri_score` | ✅ 구현 완료 | 실데이터 산출 가능 (폐업률 확보) |
| Module C `barrier_score` + 상권 유형 분류 | ❌ 미구현 | R8 미작동, 유형 분류 근사 규칙 사용 |
| `od_flows` 적재 | ❌ Dev-A 대기 | Module A·C 실데이터 차단 |

**Week 3 1단계 (od_flows 없는 상태)**: R4~R7만 구현 가능 (유형 근사 규칙).
**Week 3 2단계 (od_flows 적재 후)**: R1~R3, R8 모두 활성화.
