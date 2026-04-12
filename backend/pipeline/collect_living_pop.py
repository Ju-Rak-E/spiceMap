"""
행정동별 서울 생활인구 수집 및 적재 (OA-14991, SPOP_LOCAL_RESD_DONG)

MVP 범위: 강남구(1168xxxx) · 관악구(1162xxxx) 행정동만 적재

실행 방법:
    python -m backend.pipeline.collect_living_pop --date 20260406
    python -m backend.pipeline.collect_living_pop --date 20260406 --all-districts
"""
import argparse
from datetime import date

import pandas as pd
from sqlalchemy import create_engine

from backend.config import settings
from backend.models import LivingPopulation
from backend.pipeline.seoul_client import iter_all, total_count

SERVICE = "SPOP_LOCAL_RESD_DONG"
MVP_PREFIXES = ("1168", "1162")  # 강남구, 관악구
BATCH = 500


def parse_date(yyyymmdd: str) -> date:
    return date(int(yyyymmdd[:4]), int(yyyymmdd[4:6]), int(yyyymmdd[6:8]))


def collect(target_date: str, all_districts: bool) -> int:
    total = total_count(SERVICE, target_date)
    scope = "전체" if all_districts else "강남·관악"
    print(f"[{SERVICE}] {target_date} 총 {total:,}건 ({scope} 필터)")

    engine = create_engine(settings.database_url)
    rows_buf: list[dict] = []
    loaded = 0

    for rec in iter_all(SERVICE, target_date):
        adm_cd = str(rec.get("ADSTRD_CODE_SE", ""))
        if not all_districts and not adm_cd.startswith(MVP_PREFIXES):
            continue

        rows_buf.append({
            "base_date": parse_date(rec["STDR_DE_ID"]),
            "hour_slot": str(rec.get("TMZON_PD_SE", "00")),
            "adm_cd": adm_cd,
            "total_pop": rec.get("TOT_LVPOP_CO"),
        })

        if len(rows_buf) >= BATCH:
            pd.DataFrame(rows_buf).to_sql(
                LivingPopulation.__tablename__, engine,
                if_exists="append", index=False, method="multi",
            )
            loaded += len(rows_buf)
            rows_buf = []
            print(f"  {loaded:,}건 적재...")

    if rows_buf:
        pd.DataFrame(rows_buf).to_sql(
            LivingPopulation.__tablename__, engine,
            if_exists="append", index=False, method="multi",
        )
        loaded += len(rows_buf)

    print(f"[{SERVICE}] 완료: {loaded:,}건 적재")
    return loaded


def collect_range(start: str, end: str, all_districts: bool) -> int:
    """날짜 범위(YYYYMMDD ~ YYYYMMDD)를 순차 수집한다."""
    from datetime import date, timedelta
    import time

    s = date(int(start[:4]), int(start[4:6]), int(start[6:8]))
    e = date(int(end[:4]), int(end[4:6]), int(end[6:8]))
    dates = []
    cur = s
    while cur <= e:
        dates.append(cur)
        cur += timedelta(days=1)

    print(f"[생활인구 범위 수집] {start} ~ {end} ({len(dates)}일)")
    grand_total = 0
    for d in dates:
        n = collect(d.strftime("%Y%m%d"), all_districts)
        grand_total += n
        time.sleep(0.5)

    print(f"\n완료: {len(dates)}일, 총 {grand_total:,}행 적재")
    return grand_total


def main() -> None:
    parser = argparse.ArgumentParser(description="생활인구 수집")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--date", help="단일 기준일 (예: 20251001)")
    group.add_argument("--quarter", choices=["2025Q4", "2025Q3", "2025Q2", "2025Q1"],
                       help="분기 전체 수집")
    parser.add_argument("--all-districts", action="store_true", help="서울 전체 적재")
    args = parser.parse_args()

    quarter_ranges = {
        "2025Q1": ("20250101", "20250331"),
        "2025Q2": ("20250401", "20250630"),
        "2025Q3": ("20250701", "20250930"),
        "2025Q4": ("20251001", "20251231"),
    }

    if args.date:
        collect(args.date, args.all_districts)
    else:
        start, end = quarter_ranges[args.quarter]
        collect_range(start, end, args.all_districts)


if __name__ == "__main__":
    main()
