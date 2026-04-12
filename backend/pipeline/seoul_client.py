"""
서울 열린데이터광장 OpenAPI 공통 클라이언트

URL 형식: http://openapi.seoul.go.kr:8088/{key}/json/{service}/{start}/{end}/{filter...}
- start/end는 1-indexed 절대 범위 (page×per_page 방식 아님)
- 최대 1000건/요청 권장
"""
from typing import Any, Generator

import httpx

from backend.config import settings

BASE_URL = "http://openapi.seoul.go.kr:8088"
PER_PAGE = 1000


def fetch_page(service: str, start: int, end: int, *filters: str) -> dict[str, Any]:
    """서울 API 단일 페이지 조회."""
    filter_path = "/".join(str(f) for f in filters if f is not None)
    url = f"{BASE_URL}/{settings.seoul_api_key}/json/{service}/{start}/{end}/"
    if filter_path:
        url += filter_path + "/"

    response = httpx.get(url, timeout=30)
    response.raise_for_status()
    return response.json()


def iter_all(service: str, *filters: str) -> Generator[dict, None, None]:
    """서울 API 전체를 페이지네이션하며 레코드 dict를 yield한다."""
    start = 1
    while True:
        end = start + PER_PAGE - 1
        data = fetch_page(service, start, end, *filters)

        body = data.get(service, {})
        result_code = body.get("RESULT", {}).get("CODE", "")
        if result_code not in ("INFO-000", "INFO-200"):
            raise RuntimeError(f"API 오류 [{service}]: {body.get('RESULT')}")

        rows = body.get("row", [])
        if not rows:
            break

        yield from rows

        total = body.get("list_total_count", 0)
        start += PER_PAGE
        if start > total:
            break


def total_count(service: str, *filters: str) -> int:
    """총 데이터 건수만 조회한다."""
    data = fetch_page(service, 1, 1, *filters)
    return data.get(service, {}).get("list_total_count", 0)
