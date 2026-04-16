"""
GET /api/export/csv — 위험 상권 CSV 다운로드 (Week 3 구현)
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/export/csv")
def export_csv():
    return {"status": "not_implemented", "week": 3}
