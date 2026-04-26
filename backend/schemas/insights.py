"""정책 추천 (Module D) API 스키마.

설계 근거: docs/module_d_design.md
FR-07 준수: generation_mode 필드로 "rule_based" 고정 라벨링.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Severity = Literal["Critical", "High", "Medium", "Low"]

SEVERITY_ORDER: dict[str, int] = {
    "Critical": 0,
    "High": 1,
    "Medium": 2,
    "Low": 3,
}


class PolicyCard(BaseModel):
    """정책 추천 카드 — 규칙 1건 발동당 1개 생성."""

    model_config = ConfigDict(frozen=True)

    rule_id: str = Field(description="규칙 식별자 (예: R4)")
    commerce_code: str
    commerce_name: str
    severity: Severity
    policy_text: str = Field(description="정책 템플릿 한글 출력 (UI 카드 제목)")
    rationale: str = Field(description="근거 1문장 (UI 카드 상세 표시)")
    triggering_metrics: dict[str, float] = Field(
        default_factory=dict, description="규칙 발동에 기여한 지표 값"
    )
    generation_mode: Literal["rule_based"] = "rule_based"


class PolicyCardsResponse(BaseModel):
    quarter: str
    total_cards: int
    generation_mode: str = "rule_based"
    cards: list[PolicyCard]
