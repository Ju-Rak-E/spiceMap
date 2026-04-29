"""
상권 관련 Pydantic 응답 스키마
"""
from typing import Any

from pydantic import BaseModel


class CommerceProperties(BaseModel):
    comm_cd: str
    comm_nm: str
    gu_nm: str | None = None
    comm_type: str | None  # 원본 상권 구분 (commerce_boundary, 예: "골목상권")
    gri_score: float | None
    flow_volume: int | None
    dominant_origin: str | None
    analysis_note: str | None
    centroid_lng: float | None = None
    centroid_lat: float | None = None
    # commerce_analysis 산출 5종 (Module A/D/E)
    commerce_type: str | None = None       # 분석 5유형 (흡수형_과열 등)
    priority_score: float | None = None    # Module E 우선순위 0~100
    net_flow: float | None = None          # Module A 순유입
    degree_centrality: float | None = None # Module A 중심성 0~1
    closure_rate: float | None = None      # 분기 폐업률 %


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
