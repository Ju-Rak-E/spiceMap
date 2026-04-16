"""
GET /api/od/flows — OD 이동 흐름 데이터 (Week 3 구현)
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/od/flows")
def od_flows():
    return {"status": "not_implemented", "week": 3}
