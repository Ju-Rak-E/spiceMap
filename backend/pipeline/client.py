"""
공공데이터포털 odcloud API 공통 클라이언트

API 키가 URL 인코딩 형태(%2F 등)로 발급되므로,
httpx params 딕셔너리에 넘기면 이중 인코딩이 발생한다.
serviceKey는 URL에 직접 삽입한다.
"""
from typing import Any

import httpx

from backend.config import settings

BASE_URL = "https://api.odcloud.kr/api"


def fetch_page(dataset_id: str, page: int, per_page: int = 1000) -> dict[str, Any]:
    """
    odcloud API에서 페이지 단위 데이터를 가져온다.

    Args:
        dataset_id: 데이터셋 ID (예: "OA-22300")
        page: 페이지 번호 (1-indexed)
        per_page: 페이지당 항목 수 (최대 1000)

    Returns:
        API 응답 JSON dict. 'data' 키에 레코드 리스트.
    """
    url = (
        f"{BASE_URL}/{dataset_id}/v1"
        f"?serviceKey={settings.public_data_api_key}"
        f"&page={page}"
        f"&perPage={per_page}"
        f"&returnType=JSON"
    )
    response = httpx.get(url, timeout=30)
    response.raise_for_status()
    return response.json()


def iter_all_pages(dataset_id: str, per_page: int = 1000):
    """
    API 전체를 페이지네이션하며 레코드를 하나씩 yield한다.

    Usage:
        for record in iter_all_pages("OA-22300"):
            print(record)
    """
    page = 1
    collected = 0

    while True:
        data = fetch_page(dataset_id, page, per_page)
        records = data.get("data", [])
        if not records:
            break

        yield from records
        collected += len(records)

        total = data.get("totalCount", 0)
        if collected >= total:
            break
        page += 1


def preview(dataset_id: str, n: int = 3) -> None:
    """API 응답 구조 확인용 — 첫 n개 레코드를 출력한다."""
    import json
    data = fetch_page(dataset_id, page=1, per_page=n)
    print(f"[{dataset_id}] totalCount={data.get('totalCount')}")
    print(json.dumps(data.get("data", [])[:n], ensure_ascii=False, indent=2))
