"""
OD 흐름 관련 Pydantic 응답 스키마
"""
from pydantic import BaseModel


class FlowItem(BaseModel):
    origin_adm_cd: str
    origin_adm_nm: str | None
    dest_adm_cd: str
    dest_adm_nm: str | None
    trip_count: float
    move_purpose: int | None
    sourceCoord: tuple[float, float] | None = None
    targetCoord: tuple[float, float] | None = None


class OdFlowsResponse(BaseModel):
    quarter: str
    total_flows: int
    flows: list[FlowItem]
