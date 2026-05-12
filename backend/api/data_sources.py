"""GET /api/data-sources — 각 지표별 공공데이터 출처 매핑 (FR-06).

프론트엔드가 상세 패널의 출처 아이콘을 클릭하면 원천 포털의 해당 데이터셋으로
이동할 수 있도록 ID와 URL을 제공한다.
"""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

_PORTAL_BASE = "https://www.data.go.kr/data"
_SEOUL_BASE = "https://data.seoul.go.kr/dataList"

_SOURCES: dict[str, dict] = {
    "od_flows": {
        "dataset_id": "OA-22300",
        "name": "서울특별시_수도권 생활이동 (출발_도착지 기준)",
        "portal_url": f"{_PORTAL_BASE}/15145618/fileData.do",
        "fields": ["trip_count", "move_purpose", "sourceCoord", "targetCoord"],
        "granularity": "월별",
        "note": "행정동 간 이동량 원천 데이터. 분기 롤업 집계 후 사용.",
    },
    "living_population": {
        "dataset_id": "OA-14991",
        "name": "행정동 단위 서울 생활인구(내국인)",
        "portal_url": f"{_SEOUL_BASE}/OA-14991/S/1/datasetView.do",
        "fields": ["flow_volume"],
        "granularity": "1시간 단위 → 분기 피크 평균",
        "note": "상권 노드 크기 기준 지표.",
    },
    "store_info": {
        "dataset_id": "OA-22173",
        "name": "서울시 상권분석서비스(점포-자치구)",
        "portal_url": f"{_SEOUL_BASE}/OA-22173/S/1/datasetView.do",
        "fields": ["closure_rate"],
        "granularity": "분기별",
        "note": "점포 수, 폐업률 산출 기반.",
    },
    "commerce_sales": {
        "dataset_id": "OA-15572",
        "name": "서울시 상권분석서비스(추정매출-상권)",
        "portal_url": f"{_SEOUL_BASE}/OA-15572/S/1/datasetView.do",
        "fields": ["gri_score"],
        "granularity": "분기별",
        "note": "H1 가설 검증 및 GRI 구성 요소.",
    },
    "commerce_boundary": {
        "dataset_id": "OA-15560",
        "name": "서울시 상권분석서비스(영역-상권)",
        "portal_url": f"{_SEOUL_BASE}/OA-15560/S/1/datasetView.do",
        "fields": ["comm_cd", "comm_nm", "source_comm_type", "geometry"],
        "granularity": "정적",
        "note": "서울 열린데이터광장 제공 상권 경계 기반 PostGIS 적재.",
    },
    "admin_boundary": {
        "dataset_id": "OA-22160",
        "name": "서울시 상권분석서비스(영역-행정동)",
        "portal_url": f"{_SEOUL_BASE}/OA-22160/S/1/datasetView.do",
        "fields": ["adm_cd", "adm_nm", "gu_nm"],
        "granularity": "정적",
        "note": "OD 집계 단위 경계. PostGIS 공간 결합에 사용.",
    },
}


class DataSourceItem(BaseModel):
    dataset_id: str
    name: str
    portal_url: str
    fields: list[str]
    granularity: str
    note: str


class DataSourcesResponse(BaseModel):
    total: int
    sources: dict[str, DataSourceItem]


@router.get("/data-sources", response_model=DataSourcesResponse, tags=["meta"])
def data_sources():
    """각 API 응답 필드가 어느 공공데이터셋에서 왔는지 반환한다.

    프론트엔드 출처 아이콘 (FR-06) 구현용.
    DB·Redis 의존 없음 — 항상 즉시 반환.
    """
    items = {k: DataSourceItem(**v) for k, v in _SOURCES.items()}
    return DataSourcesResponse(total=len(items), sources=items)
