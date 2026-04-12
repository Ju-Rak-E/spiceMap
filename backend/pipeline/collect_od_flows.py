"""
OD 이동 데이터 수집 스크립트 (OA-22300)
서울 광역 OD — 공공데이터포털 API

실행 방법:
    python -m backend.pipeline.collect_od_flows --year 2024 --quarter 1
"""
import argparse
import sys

import httpx

from backend.config import settings

BASE_URL = "https://api.odcloud.kr/api"
DATASET_ID = "OA-22300"


def fetch_od_page(year: int, quarter: int, page: int, per_page: int = 1000) -> dict:
    url = f"{BASE_URL}/{DATASET_ID}/v1"
    params = {
        "page": page,
        "perPage": per_page,
        "serviceKey": settings.public_data_api_key,
        "returnType": "JSON",
        # 연도·분기 필터는 실제 API 파라미터명 확인 후 수정 필요
        "cond[year::EQ]": year,
        "cond[quarter::EQ]": quarter,
    }
    response = httpx.get(url, params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def collect(year: int, quarter: int) -> None:
    if not settings.public_data_api_key:
        print("PUBLIC_DATA_API_KEY가 .env에 설정되지 않았습니다.", file=sys.stderr)
        sys.exit(1)

    page = 1
    total_collected = 0

    while True:
        data = fetch_od_page(year, quarter, page)
        items = data.get("data", [])
        if not items:
            break

        # TODO: DB 적재 (insert_od_rows 함수 구현 예정)
        total_collected += len(items)
        print(f"page {page}: {len(items)}건 수집 (누계 {total_collected}건)")

        total_count = data.get("totalCount", 0)
        if total_collected >= total_count:
            break
        page += 1

    print(f"OD 수집 완료: {year}Q{quarter} 총 {total_collected}건")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OD 이동 데이터 수집")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--quarter", type=int, required=True, choices=[1, 2, 3, 4])
    args = parser.parse_args()
    collect(args.year, args.quarter)
