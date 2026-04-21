"""Module D — 규칙 기반 정책 추천 카드 생성 (v1.0, R4~R7 활성).

규칙 테이블은 `docs/module_d_design.md`에 정의된 R1~R8 중 이번 버전에서는
`od_flows`가 필요 없는 R4~R7만 활성화한다. R1~R3·R8은 Dev-A 데이터 적재
이후 활성화 예정이며 본 모듈의 ACTIVE_RULE_IDS로 명시적으로 선언한다.

FR-07 준수: 모든 카드에 generation_mode="rule_based" 태깅.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import pandas as pd

from backend.schemas.insights import SEVERITY_ORDER, PolicyCard, Severity

ACTIVE_RULE_IDS: frozenset[str] = frozenset({"R4", "R5", "R6", "R7"})

REQUIRED_COLUMNS = {
    "commerce_code",
    "commerce_name",
    "commerce_type",
    "gri_score",
    # triggering_metrics 완결성을 위해 아래 3개도 필수화
    # (분류기 출력이 항상 이들을 포함하므로 실운영에서 문제 없음)
    "net_flow",
    "degree_centrality",
    "closure_rate",
}

# 경계값 상수
R4_GRI_MIN = 70.0       # 흡수형_과열 + GRI ≥ 70 → R4
R5_GRI_MIN = 50.0       # 흡수형_과열 + 50 ≤ GRI < 70 → R5
R6_GRI_MAX = 40.0       # 흡수형_성장 + GRI < 40 → R6
R7_GRI_MAX = 30.0       # 안정형 + GRI < 30 → R7


@dataclass(frozen=True)
class _RuleSpec:
    """규칙 메타데이터."""
    rule_id: str
    severity: Severity
    policy_text: str
    rationale_template: str  # {gri}, {net_flow} 같은 포맷 필드 사용


def _triggering_metrics(row: pd.Series) -> dict[str, float]:
    """UI 상세 패널에 표시할 기여 지표."""
    keys = ("gri_score", "net_flow", "degree_centrality", "closure_rate")
    return {k: float(row[k]) for k in keys if k in row and pd.notna(row[k])}


def _build_card(row: pd.Series, spec: _RuleSpec, rationale: str) -> PolicyCard:
    return PolicyCard(
        rule_id=spec.rule_id,
        commerce_code=str(row["commerce_code"]),
        commerce_name=str(row["commerce_name"]),
        severity=spec.severity,
        policy_text=spec.policy_text,
        rationale=rationale,
        triggering_metrics=_triggering_metrics(row),
    )


# 규칙별 평가 함수. 발동 시 PolicyCard, 아니면 None.

_R4 = _RuleSpec(
    rule_id="R4",
    severity="Critical",
    policy_text="젠트리피케이션 예방: 임대료 상한 가이드라인 + 상생 협약",
    rationale_template="유입 과열 + 폐업 상승 — 임대료 스파이크 시그널 (GRI={gri:.1f})",
)
_R5 = _RuleSpec(
    rule_id="R5",
    severity="Medium",
    policy_text="업종 균형: 프랜차이즈 비율 모니터링",
    rationale_template="과열 진입 초기 — 업종 편중 방지 필요 (GRI={gri:.1f})",
)
_R6 = _RuleSpec(
    rule_id="R6",
    severity="Low",
    policy_text="성장 지원: 업종 박람회·소셜 마케팅 연계",
    rationale_template="건전한 성장 단계 — 가속 정책 적용 가능 (GRI={gri:.1f})",
)
_R7 = _RuleSpec(
    rule_id="R7",
    severity="Low",
    policy_text="유지 관리: 정기 모니터링",
    rationale_template="위험 징후 없음 — 베이스라인 관찰 (GRI={gri:.1f})",
)


def _eval_r4(row: pd.Series) -> PolicyCard | None:
    if row["commerce_type"] == "흡수형_과열" and row["gri_score"] >= R4_GRI_MIN:
        return _build_card(row, _R4, _R4.rationale_template.format(gri=row["gri_score"]))
    return None


def _eval_r5(row: pd.Series) -> PolicyCard | None:
    if (
        row["commerce_type"] == "흡수형_과열"
        and R5_GRI_MIN <= row["gri_score"] < R4_GRI_MIN
    ):
        return _build_card(row, _R5, _R5.rationale_template.format(gri=row["gri_score"]))
    return None


def _eval_r6(row: pd.Series) -> PolicyCard | None:
    if row["commerce_type"] == "흡수형_성장" and row["gri_score"] < R6_GRI_MAX:
        return _build_card(row, _R6, _R6.rationale_template.format(gri=row["gri_score"]))
    return None


def _eval_r7(row: pd.Series) -> PolicyCard | None:
    if row["commerce_type"] == "안정형" and row["gri_score"] < R7_GRI_MAX:
        return _build_card(row, _R7, _R7.rationale_template.format(gri=row["gri_score"]))
    return None


_EVALUATORS: tuple[Callable[[pd.Series], PolicyCard | None], ...] = (
    _eval_r4,
    _eval_r5,
    _eval_r6,
    _eval_r7,
)


def generate_policy_cards(
    classified_df: pd.DataFrame,
    barriers_df: pd.DataFrame | None = None,  # R8 전용, v1.0에서는 미사용
) -> list[PolicyCard]:
    """사전 분류된 상권 DataFrame에서 정책 추천 카드를 생성한다.

    Args:
        classified_df: classify_commerce_types 출력 (commerce_type 포함).
        barriers_df: Module C 결과 — 본 버전에서는 무시.

    Returns:
        PolicyCard 리스트 (심각도 Critical → Low 순 정렬).
    """
    missing = REQUIRED_COLUMNS - set(classified_df.columns)
    if missing:
        raise ValueError(f"generate_policy_cards: 필수 컬럼 누락 {sorted(missing)}")

    cards: list[PolicyCard] = []
    for _, row in classified_df.iterrows():
        for evaluator in _EVALUATORS:
            card = evaluator(row)
            if card is not None:
                cards.append(card)

    cards.sort(key=lambda c: (SEVERITY_ORDER[c.severity], c.rule_id, c.commerce_code))
    return cards
