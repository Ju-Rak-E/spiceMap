"""
GET /api/commerce/type-map  — 상권 폴리곤 + 분석 결과 (GeoJSON)
GET /api/gri/history        — 상권 GRI 분기별 시계열
"""
import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.api.deps import get_session, get_cache
from backend.db import CACHE_TTL
from backend.schemas.commerce import TypeMapResponse, GriHistoryResponse, GriPoint

router = APIRouter()


# ──────────────────────────────────────────────
# GET /api/commerce/type-map
# ──────────────────────────────────────────────
@router.get("/commerce/type-map", response_model=TypeMapResponse)
def type_map(
    gu: str | None = Query(None, description="자치구 필터 (예: 강남구)"),
    quarter: str = Query("2025Q4", description="분기 (예: 2025Q4)"),
    db: Session = Depends(get_session),
    cache=Depends(get_cache),
):
    cache_key = f"type-map:{gu or 'all'}:{quarter}"
    cached = cache.get(cache_key)
    if cached:
        return json.loads(cached)

    # gu 필터: admin_boundary.gu_nm 대신 comm_type 기반 자치구 필터는
    # commerce_boundary에 직접 자치구 정보가 없어 od_flows 경유 어려움.
    # 현재는 전체 반환 후 프론트에서 필터하는 방식을 쓰거나,
    # 추후 comm_cd 앞자리로 자치구 매핑 테이블 추가 필요.
    # MVP에서는 gu 파라미터는 받되 현재 무시하고 전체 반환.
    sql = text("""
        SELECT
            cb.comm_cd,
            cb.comm_nm,
            ab.gu_nm,
            cb.comm_type,
            ST_AsGeoJSON(cb.geom)::json AS geometry,
            ST_X(ST_Centroid(cb.geom)) AS centroid_lng,
            ST_Y(ST_Centroid(cb.geom)) AS centroid_lat,
            ca.gri_score,
            ca.flow_volume,
            ca.dominant_origin,
            ca.analysis_note
        FROM commerce_boundary cb
        LEFT JOIN LATERAL (
            SELECT gu_nm
            FROM admin_boundary
            WHERE ST_Contains(geom, ST_PointOnSurface(cb.geom))
            LIMIT 1
        ) ab ON TRUE
        LEFT JOIN commerce_analysis ca
            ON cb.comm_cd = ca.comm_cd
            AND ca.year_quarter = :quarter
        WHERE (:gu IS NULL OR ab.gu_nm = :gu)
        ORDER BY cb.comm_cd
    """)
    rows = db.execute(sql, {"quarter": quarter, "gu": gu}).fetchall()

    features = [
        {
            "type": "Feature",
            "geometry": row.geometry,
            "properties": {
                "comm_cd": row.comm_cd,
                "comm_nm": row.comm_nm,
                "gu_nm": row.gu_nm,
                "comm_type": row.comm_type,
                "gri_score": row.gri_score,
                "flow_volume": row.flow_volume,
                "dominant_origin": row.dominant_origin,
                "analysis_note": row.analysis_note,
                "centroid_lng": row.centroid_lng,
                "centroid_lat": row.centroid_lat,
            },
        }
        for row in rows
    ]

    result = {
        "type": "FeatureCollection",
        "quarter": quarter,
        "total": len(features),
        "features": features,
    }
    cache.setex(cache_key, CACHE_TTL, json.dumps(result, ensure_ascii=False))
    return result


# ──────────────────────────────────────────────
# GET /api/gri/history
# ──────────────────────────────────────────────
@router.get("/gri/history", response_model=GriHistoryResponse)
def gri_history(
    comm_cd: str = Query(..., description="상권 코드"),
    db: Session = Depends(get_session),
    cache=Depends(get_cache),
):
    cache_key = f"gri-history:{comm_cd}"
    cached = cache.get(cache_key)
    if cached:
        return json.loads(cached)

    # 상권 기본 정보
    name_row = db.execute(
        text("SELECT comm_nm FROM commerce_boundary WHERE comm_cd = :cd"),
        {"cd": comm_cd},
    ).fetchone()

    # GRI 시계열
    rows = db.execute(
        text("""
            SELECT year_quarter, gri_score, flow_volume
            FROM commerce_analysis
            WHERE comm_cd = :cd
            ORDER BY year_quarter
        """),
        {"cd": comm_cd},
    ).fetchall()

    result = {
        "comm_cd": comm_cd,
        "comm_nm": name_row.comm_nm if name_row else None,
        "history": [
            {
                "quarter": row.year_quarter,
                "gri_score": row.gri_score,
                "flow_volume": row.flow_volume,
            }
            for row in rows
        ],
    }
    cache.setex(cache_key, CACHE_TTL, json.dumps(result, ensure_ascii=False))
    return result
