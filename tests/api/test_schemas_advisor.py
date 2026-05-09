"""backend/schemas/advisor.py Pydantic 스키마 테스트."""
import pytest
from pydantic import ValidationError
from backend.schemas.advisor import (
    IndustriesResponse,
    StartupAdvisorRequest,
    RankedCommerce,
    AdvisorResponse,
)


def test_industries_response():
    r = IndustriesResponse(quarter="2025Q4", industries=["커피음료", "한식음식점"])
    assert r.quarter == "2025Q4"
    assert len(r.industries) == 2


def test_startup_advisor_request_defaults():
    req = StartupAdvisorRequest(industry_nm="커피음료")
    assert req.quarter == "2025Q4"


def test_ranked_commerce_valid_tiers():
    for tier in ["추천", "주의", "비추천"]:
        r = RankedCommerce(
            comm_cd="A001", comm_nm="역삼", gu_nm="강남구",
            tier=tier, advisor_score=70.0,
            gri_score=38.0, flow_volume=12000,
            closure_rate=1.5, llm_reason=None,
        )
        assert r.tier == tier


def test_ranked_commerce_invalid_tier_raises():
    with pytest.raises(ValidationError):
        RankedCommerce(
            comm_cd="A001", comm_nm="역삼", gu_nm="강남구",
            tier="최고",  # 유효하지 않은 값
            advisor_score=70.0, gri_score=38.0,
            flow_volume=12000, closure_rate=1.5, llm_reason=None,
        )


def test_advisor_response_empty_commerces():
    resp = AdvisorResponse(
        industry_nm="커피음료", quarter="2025Q4",
        summary="요약 텍스트", caution="주의 텍스트",
        commerces=[], model_used="none",
    )
    assert resp.industry_nm == "커피음료"
    assert resp.commerces == []
