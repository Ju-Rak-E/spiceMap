"""GET /api/barrier-routes - road-following routes for flow barriers."""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.api.cache_utils import (
    cache_get,
    cache_set_with_fallback,
    demo_response,
    get_fallback,
    load_demo,
)
from backend.api.deps import get_cache, get_session
from backend.config import settings
from backend.schemas.barrier_routes import BarrierRouteItem, BarrierRoutesResponse

router = APIRouter()

ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/geojson"
ORS_TIMEOUT_SECONDS = 12.0


class BarrierRouteInput:
    def __init__(
        self,
        barrier_id: str,
        source_id: str,
        target_id: str,
        source_coord: tuple[float, float],
        target_coord: tuple[float, float],
    ):
        self.barrier_id = barrier_id
        self.source_id = source_id
        self.target_id = target_id
        self.source_coord = source_coord
        self.target_coord = target_coord


def _load_route_fallback(cache_key: str, cache) -> dict | None:
    cached = get_fallback(cache, cache_key)
    if cached:
        return cached
    return load_demo(cache_key)


def _normalize_ors_route(data: dict, route: BarrierRouteInput) -> BarrierRouteItem | None:
    features = data.get("features")
    if not isinstance(features, list) or not features:
        return None

    feature = features[0]
    geometry = feature.get("geometry") if isinstance(feature, dict) else None
    coordinates = geometry.get("coordinates") if isinstance(geometry, dict) else None
    if not isinstance(coordinates, list) or len(coordinates) < 2:
        return None

    path: list[tuple[float, float]] = []
    for point in coordinates:
        if not isinstance(point, (list, tuple)) or len(point) < 2:
            continue
        path.append((float(point[0]), float(point[1])))
    if len(path) < 2:
        return None

    properties = feature.get("properties") if isinstance(feature, dict) else {}
    summary = properties.get("summary") if isinstance(properties, dict) else {}
    distance = summary.get("distance") if isinstance(summary, dict) else None
    duration = summary.get("duration") if isinstance(summary, dict) else None

    return BarrierRouteItem(
        barrierId=route.barrier_id,
        sourceId=route.source_id,
        targetId=route.target_id,
        path=path,
        distanceM=float(distance) if distance is not None else None,
        durationS=float(duration) if duration is not None else None,
        source="ors",
    )


def _fetch_ors_route(route: BarrierRouteInput, api_key: str) -> BarrierRouteItem | None:
    response = httpx.post(
        ORS_DIRECTIONS_URL,
        headers={
            "Authorization": api_key,
            "Content-Type": "application/json",
        },
        json={
            "coordinates": [list(route.source_coord), list(route.target_coord)],
            "instructions": False,
        },
        timeout=ORS_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return _normalize_ors_route(response.json(), route)


def _fetch_barrier_route_inputs(
    db: Session,
    quarter: str,
    gu: str | None,
) -> list[BarrierRouteInput]:
    sql = text("""
        SELECT
            fb.from_comm_cd,
            fb.to_comm_cd,
            ST_X(ST_PointOnSurface(cb_f.geom)) AS source_lng,
            ST_Y(ST_PointOnSurface(cb_f.geom)) AS source_lat,
            ST_X(ST_PointOnSurface(cb_t.geom)) AS target_lng,
            ST_Y(ST_PointOnSurface(cb_t.geom)) AS target_lat
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
          AND (:gu IS NULL OR ab.gu_nm = :gu)
        ORDER BY fb.barrier_score DESC
    """)
    rows = db.execute(sql, {"quarter": quarter, "gu": gu}).fetchall()
    routes: list[BarrierRouteInput] = []
    for row in rows:
        if (
            row.source_lng is None
            or row.source_lat is None
            or row.target_lng is None
            or row.target_lat is None
        ):
            continue
        routes.append(
            BarrierRouteInput(
                barrier_id=f"{row.from_comm_cd}-{row.to_comm_cd}",
                source_id=row.from_comm_cd,
                target_id=row.to_comm_cd,
                source_coord=(float(row.source_lng), float(row.source_lat)),
                target_coord=(float(row.target_lng), float(row.target_lat)),
            )
        )
    return routes


@router.get("/barrier-routes", response_model=BarrierRoutesResponse)
def barrier_routes(
    quarter: str = Query("2025Q4", description="Analysis quarter"),
    gu: str | None = Query(None, description="Optional district filter"),
    db: Session = Depends(get_session),
    cache=Depends(get_cache),
):
    cache_key = f"barrier-routes:{quarter}:{gu or 'all'}"

    if settings.demo_mode:
        snap = load_demo(cache_key)
        if snap:
            return demo_response(snap, is_demo=True)
        raise HTTPException(status_code=503, detail="Demo barrier route snapshot is missing")

    cached = cache_get(cache, cache_key)
    if cached:
        return cached

    api_key = settings.openrouteservice_api_key
    if not api_key:
        fallback = _load_route_fallback(cache_key, cache)
        if fallback:
            return demo_response(fallback)
        raise HTTPException(status_code=503, detail="OPENROUTESERVICE_API_KEY is not configured")

    try:
        route_inputs = _fetch_barrier_route_inputs(db, quarter, gu)
    except SQLAlchemyError:
        fallback = _load_route_fallback(cache_key, cache)
        if fallback:
            return demo_response(fallback)
        raise HTTPException(status_code=503, detail="Database unavailable for /api/barrier-routes")

    routes: list[BarrierRouteItem] = []
    try:
        for route in route_inputs:
            item = _fetch_ors_route(route, api_key)
            if item:
                routes.append(item)
    except (httpx.HTTPError, ValueError, TypeError):
        fallback = _load_route_fallback(cache_key, cache)
        if fallback:
            return demo_response(fallback)
        raise HTTPException(status_code=503, detail="Routing provider unavailable")

    result = BarrierRoutesResponse(quarter=quarter, total=len(routes), routes=routes)
    cache_set_with_fallback(cache, cache_key, result.model_dump_json())
    return result
