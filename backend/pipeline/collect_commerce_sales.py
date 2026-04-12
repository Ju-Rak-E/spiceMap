"""
상권별 추정 매출 수집 및 적재 (OA-15572, VwsmTrdarSelngQq)

실행 방법:
    python -m backend.pipeline.collect_commerce_sales --quarter 20251
    python -m backend.pipeline.collect_commerce_sales --quarter 20254
"""
import argparse
import sys

import pandas as pd
from sqlalchemy import create_engine

from backend.config import settings
from backend.models import CommerceSales
from backend.pipeline.seoul_client import iter_all, total_count

SERVICE = "VwsmTrdarSelngQq"
BATCH = 500


def collect(quarter: str | None) -> int:
    filters = (quarter,) if quarter else ()
    total = total_count(SERVICE, *filters)
    print(f"[{SERVICE}] 총 {total:,}건 수집 시작 (분기={quarter or '전체'})")

    engine = create_engine(settings.database_url)
    rows_buf: list[dict] = []
    loaded = 0

    for rec in iter_all(SERVICE, *filters):
        rows_buf.append({
            "year_quarter": rec["STDR_YYQU_CD"],
            "trdar_cd": rec["TRDAR_CD"],
            "trdar_nm": rec.get("TRDAR_CD_NM"),
            "trdar_se_cd": rec.get("TRDAR_SE_CD"),
            "industry_cd": rec.get("SVC_INDUTY_CD"),
            "industry_nm": rec.get("SVC_INDUTY_CD_NM"),
            "sales_amount": rec.get("THSMON_SELNG_AMT"),
            "sales_count": rec.get("THSMON_SELNG_CO"),
            "weekday_sales": rec.get("MDWK_SELNG_AMT"),
            "weekend_sales": rec.get("WKEND_SELNG_AMT"),
        })

        if len(rows_buf) >= BATCH:
            pd.DataFrame(rows_buf).to_sql(
                CommerceSales.__tablename__, engine,
                if_exists="append", index=False, method="multi",
            )
            loaded += len(rows_buf)
            rows_buf = []
            print(f"  {loaded:,}건 적재...")

    if rows_buf:
        pd.DataFrame(rows_buf).to_sql(
            CommerceSales.__tablename__, engine,
            if_exists="append", index=False, method="multi",
        )
        loaded += len(rows_buf)

    print(f"[{SERVICE}] 완료: {loaded:,}건 적재")
    return loaded


def main() -> None:
    parser = argparse.ArgumentParser(description="상권 매출 수집")
    parser.add_argument("--quarter", required=True, help="연도분기 코드 (예: 20251)")
    args = parser.parse_args()
    collect(args.quarter)


if __name__ == "__main__":
    main()
