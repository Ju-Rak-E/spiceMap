"""
GET /api/insights/policy — 정책 추천 카드 + 우선순위 (Week 3 구현)
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/insights/policy")
def policy_insights():
    return {"status": "not_implemented", "week": 3}
