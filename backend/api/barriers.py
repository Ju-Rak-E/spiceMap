"""GET /api/barriers — 흐름 단절 구간 목록."""
import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.api.deps import get_session, get_cache
from backend.db import CACHE_TTL
from backend.schemas.barriers import BarrierItem, BarriersResponse

router = APIRouter()


@router.get("/barriers", response_model=BarriersResponse)
def barriers(
    quarter: str = Query("2025Q4", description="분기 (예: 2025Q4)"),
    gu: str | None = Query(None, description="자치구 필터 (예: 강남구)"),
    min_score: float = Query(0.0, ge=0.0, description="단절 강도 하한"),
    db: Session = Depends(get_session),
    cache=Depends(get_cache),
):
    cache_key = f"barriers:{quarter}:{gu or 'all'}:{min_score}"
    cached = cache.get(cache_key)
    if cached:
        return json.loads(cached)

    sql = text("""
        SELECT
            fb.from_comm_cd,
            cb_f.comm_nm AS from_comm_nm,
            fb.to_comm_cd,
            cb_t.comm_nm AS to_comm_nm,
            fb.barrier_score,
            fb.barrier_type
        FROM flow_barriers fb
        LEFT JOIN commerce_boundary cb_f ON cb_f.comm_cd = fb.from_comm_cd
        LEFT JOIN commerce_boundary cb_t ON cb_t.comm_cd = fb.to_comm_cd
        LEFT JOIN LATERAL (
            SELECT gu_nm
            FROM admin_boundary
            WHERE ST_Contains(geom, ST_PointOnSurface(cb_f.geom))
            LIMIT 1
        ) ab ON TRUE
        WHERE fb.year_quarter = :quarter
          AND fb.barrier_score >= :min_score
          AND (:gu IS NULL OR ab.gu_nm = :gu)
        ORDER BY fb.barrier_score DESC
    """)
    rows = db.execute(sql, {"quarter": quarter, "gu": gu, "min_score": min_score}).fetchall()

    items = [
        BarrierItem(
            from_comm_cd=row.from_comm_cd,
            from_comm_nm=row.from_comm_nm,
            to_comm_cd=row.to_comm_cd,
            to_comm_nm=row.to_comm_nm,
            barrier_score=row.barrier_score,
            barrier_type=row.barrier_type,
        )
        for row in rows
    ]

    result = BarriersResponse(quarter=quarter, total=len(items), barriers=items)
    cache.setex(cache_key, CACHE_TTL, result.model_dump_json())
    return result
