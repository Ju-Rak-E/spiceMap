"""
GET /api/barriers — 흐름 단절 구간 (Week 3 구현)
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/barriers")
def barriers():
    return {"status": "not_implemented", "week": 3}
