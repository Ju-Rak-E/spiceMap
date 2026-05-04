"""검증 보고 (H1·H2·H3 + B1·B3) API 스키마.

ValidationView (`frontend/src/components/ValidationView.tsx`) 의 정적 fixture
스키마와 1:1 정렬. 단일 소스: `frontend/src/data/validation_results.json`.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ValidationCard(BaseModel):
    """가설/베이스라인 카드 1건."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(description="카드 식별자 (예: H1, H2, H3, B1, B3)")
    title: str
    headline: str
    metric_primary: str
    metric_secondary: str
    sample_size: str
    summary: str
    criterion: str
    source: str = Field(description="결과 산출 근거 코드/문서 경로")


class ValidationResults(BaseModel):
    """검증 보고 응답."""

    model_config = ConfigDict(frozen=True)

    generated_at: str
    quarter: str
    previous_quarter: str
    cards: list[ValidationCard]
