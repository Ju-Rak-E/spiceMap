"""
상권 관련 Pydantic 응답 스키마
"""
from typing import Any

from pydantic import BaseModel


class CommerceProperties(BaseModel):
    comm_cd: str
    comm_nm: str
    gu_nm: str | None = None
    comm_type: str | None
    gri_score: float | None
    flow_volume: int | None
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
