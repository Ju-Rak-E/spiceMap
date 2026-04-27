"""GET /api/od/flows — OD 이동 흐름 데이터."""
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.api.deps import get_session, get_cache
from backend.db import CACHE_TTL
from backend.schemas.od import FlowItem, OdFlowsResponse

router = APIRouter()

_LIMIT_MAX = 500


@router.get("/od/flows", response_model=OdFlowsResponse)
def od_flows(
    quarter: str = Query("2025Q4", description="분기 (예: 2025Q4)"),
    gu: str | None = Query(None, description="자치구 필터 (예: 강남구)"),
    limit: int = Query(200, ge=1, description="반환할 최대 OD 흐름 수"),
    db: Session = Depends(get_session),
    cache=Depends(get_cache),
):
    effective_limit = min(limit, _LIMIT_MAX)
    cache_key = f"od-flows:{quarter}:{gu or 'all'}:{effective_limit}"
    try:
        cached = cache.get(cache_key)
        if cached:
            return json.loads(cached)
    except RedisError:
        pass

    sql = text("""
        SELECT
            oa.origin_adm_cd,
            ab_o.adm_nm  AS origin_adm_nm,
            ST_X(ST_Centroid(ab_o.geom)) AS source_lng,
            ST_Y(ST_Centroid(ab_o.geom)) AS source_lat,
            oa.dest_adm_cd,
            ab_d.adm_nm  AS dest_adm_nm,
            ST_X(ST_Centroid(ab_d.geom)) AS target_lng,
            ST_Y(ST_Centroid(ab_d.geom)) AS target_lat,
            oa.move_purpose,
            SUM(oa.trip_count_sum) AS trip_count
        FROM od_flows_aggregated oa
        LEFT JOIN admin_boundary ab_o ON ab_o.adm_cd = oa.origin_adm_cd
        LEFT JOIN admin_boundary ab_d ON ab_d.adm_cd = oa.dest_adm_cd
        WHERE oa.year_quarter = :quarter
          AND (:gu IS NULL
               OR ab_o.gu_nm = :gu
               OR ab_d.gu_nm = :gu)
        GROUP BY
            oa.origin_adm_cd, ab_o.adm_nm, ab_o.geom,
            oa.dest_adm_cd, ab_d.adm_nm, ab_d.geom,
            oa.move_purpose
        ORDER BY trip_count DESC
        LIMIT :limit
    """)
    try:
        rows = db.execute(sql, {"quarter": quarter, "gu": gu, "limit": effective_limit}).fetchall()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable for /api/od/flows") from exc

    flows = [
        FlowItem(
            origin_adm_cd=row.origin_adm_cd,
            origin_adm_nm=row.origin_adm_nm,
            dest_adm_cd=row.dest_adm_cd,
            dest_adm_nm=row.dest_adm_nm,
            trip_count=row.trip_count,
            move_purpose=getattr(row, "move_purpose", None),
            sourceCoord=(
                (getattr(row, "source_lng"), getattr(row, "source_lat"))
                if getattr(row, "source_lng", None) is not None
                and getattr(row, "source_lat", None) is not None
                else None
            ),
            targetCoord=(
                (getattr(row, "target_lng"), getattr(row, "target_lat"))
                if getattr(row, "target_lng", None) is not None
                and getattr(row, "target_lat", None) is not None
                else None
            ),
        )
        for row in rows
    ]

    result = OdFlowsResponse(quarter=quarter, total_flows=len(flows), flows=flows)
    try:
        cache.setex(cache_key, CACHE_TTL, result.model_dump_json())
    except RedisError:
        pass
    return result
