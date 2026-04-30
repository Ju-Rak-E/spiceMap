"""GET /api/barriers — 흐름 단절 구간 목록."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.api.cache_utils import (
    cache_get, cache_set_with_fallback, demo_response,
    get_fallback, load_demo,
)
from backend.api.deps import get_session, get_cache
from backend.config import settings
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

    if settings.demo_mode:
        snap = load_demo(cache_key)
        if snap:
            return demo_response(snap, is_demo=True)
        raise HTTPException(status_code=503, detail="데모 스냅샷 없음. generate_demo_snapshot 실행 필요.")

    cached = cache_get(cache, cache_key)
    if cached:
        return cached

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
    try:
        rows = db.execute(sql, {"quarter": quarter, "gu": gu, "min_score": min_score}).fetchall()
    except SQLAlchemyError:
        fallback = get_fallback(cache, cache_key)
        if fallback:
            return demo_response(fallback)
        raise HTTPException(status_code=503, detail="Database unavailable for /api/barriers")

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
    cache_set_with_fallback(cache, cache_key, result.model_dump_json())
    return result
