"""
자치구별 점포 정보 수집 및 적재 (OA-15577, VwsmSignguStorW)

실행 방법:
    python -m backend.pipeline.collect_store_info             # 전체 (최신)
    python -m backend.pipeline.collect_store_info --quarter 20251  # 특정 분기
    python -m backend.pipeline.collect_store_info --mvp       # 강남·관악만
"""
import argparse
import sys

import pandas as pd
from sqlalchemy import create_engine

from backend.config import settings
from backend.models import StoreInfo
from backend.pipeline.seoul_client import iter_all, total_count

SERVICE = "VwsmSignguStorW"

# MVP 대상 자치구 코드
MVP_SIGNGU = {"11680", "11620"}  # 강남구, 관악구

BATCH = 500


def collect(quarter: str | None, mvp_only: bool) -> int:
    filters = (quarter,) if quarter else ()
    total = total_count(SERVICE, *filters)
    print(f"[{SERVICE}] 총 {total:,}건 수집 시작 (분기={quarter or '전체'})")

    engine = create_engine(settings.database_url)
    rows_buf: list[dict] = []
    loaded = 0

    for rec in iter_all(SERVICE, *filters):
        if mvp_only and rec.get("SIGNGU_CD") not in MVP_SIGNGU:
            continue

        rows_buf.append({
            "year_quarter": rec["STDR_YYQU_CD"],
            "signgu_cd": rec["SIGNGU_CD"],
            "signgu_nm": rec.get("SIGNGU_CD_NM"),
            "industry_cd": rec.get("SVC_INDUTY_CD"),
            "industry_nm": rec.get("SVC_INDUTY_CD_NM"),
            "store_count": rec.get("STOR_CO"),
            "open_rate": rec.get("OPBIZ_RT"),
            "open_count": rec.get("OPBIZ_STOR_CO"),
            "close_rate": rec.get("CLSBIZ_RT"),
            "close_count": rec.get("CLSBIZ_STOR_CO"),
            "franchise_count": rec.get("FRC_STOR_CO"),
        })

        if len(rows_buf) >= BATCH:
            pd.DataFrame(rows_buf).to_sql(
                StoreInfo.__tablename__, engine,
                if_exists="append", index=False, method="multi",
            )
            loaded += len(rows_buf)
            rows_buf = []
            print(f"  {loaded:,}건 적재...")

    if rows_buf:
        pd.DataFrame(rows_buf).to_sql(
            StoreInfo.__tablename__, engine,
            if_exists="append", index=False, method="multi",
        )
        loaded += len(rows_buf)

    print(f"[{SERVICE}] 완료: {loaded:,}건 적재")
    return loaded


def main() -> None:
    parser = argparse.ArgumentParser(description="점포정보 수집")
    parser.add_argument("--quarter", help="연도분기 코드 (예: 20251)")
    parser.add_argument("--mvp", action="store_true", help="강남·관악 자치구만")
    args = parser.parse_args()
    collect(args.quarter, args.mvp)


if __name__ == "__main__":
    main()
