"""
상권 관련 Pydantic 응답 스키마
"""
from typing import Any

from pydantic import BaseModel


class CommerceProperties(BaseModel):
    comm_cd: str
    comm_nm: str
    gu_nm: str | None = None
    commerce_type: str | None = None       # Dev-C 5유형 (ca.commerce_type)
    source_comm_type: str | None = None    # 원천 골목/발달 (cb.comm_type, 디버그용)
    comm_type: str | None = None           # Week 4 클린업 예정 — commerce_type 미러
    gri_score: float | None
    flow_volume: int | None
    net_flow: float | None = None
    degree_centrality: float | None = None
    close_rate: float | None = None
    dominant_origin: str | None
    analysis_note: str | None
    centroid_lng: float | None = None
    centroid_lat: float | None = None


class Feature(BaseModel):
    type: str = "Feature"
    geometry: dict[str, Any]
    properties: CommerceProperties


class TypeMapResponse(BaseModel):
    type: str = "FeatureCollection"
    quarter: str
    total: int
    features: list[Feature]


class GriPoint(BaseModel):
    quarter: str
    gri_score: float | None
    flow_volume: int | None


class GriHistoryResponse(BaseModel):
    comm_cd: str
    comm_nm: str | None
    history: list[GriPoint]
