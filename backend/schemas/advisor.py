"""AI 창업 입지 분석 API 스키마."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class IndustriesResponse(BaseModel):
    quarter: str
    industries: list[str]


class StartupAdvisorRequest(BaseModel):
    industry_nm: str
    quarter: str = "2025Q4"
    districts: list[str] | None = None


class RankedCommerce(BaseModel):
    comm_cd: str
    comm_nm: str
    gu_nm: str
    tier: Literal["추천", "주의", "비추천"]
    advisor_score: float
    gri_score: float | None
    flow_volume: int | None
    closure_rate: float | None
    llm_reason: str | None  # LLM 생성 이유 (어드바이저 점수 상위 5개에만 생성, 나머지 None)


class AdvisorResponse(BaseModel):
    industry_nm: str
    quarter: str
    summary: str        # LLM 전체 요약 (2~3문장). API 실패 시 빈 문자열.
    caution: str        # LLM 주의사항 (1문장). API 실패 시 빈 문자열.
    commerces: list[RankedCommerce]
    model_used: str     # "claude-haiku-4-5" 또는 "none"
