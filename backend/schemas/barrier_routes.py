from pydantic import BaseModel


class BarrierRouteItem(BaseModel):
    barrierId: str
    sourceId: str
    targetId: str
    path: list[tuple[float, float]]
    distanceM: float | None = None
    durationS: float | None = None
    source: str = "ors"


class BarrierRoutesResponse(BaseModel):
    quarter: str
    total: int
    routes: list[BarrierRouteItem]
    from_cache: bool = False
    cache_warning: str | None = None
