"""
월별 생활인구 CSV 파일 → DB 적재 (LOCAL_PEOPLE_DONG_YYYYMM.csv)

data.seoul.go.kr 파일 다운로드 형식 (OA-14991)
파일 인코딩: UTF-8 BOM (utf-8-sig)

실행 방법:
    python -m backend.pipeline.load_living_pop_csv data/LOCAL_PEOPLE_DONG_202512.csv
    python -m backend.pipeline.load_living_pop_csv data/LOCAL_PEOPLE_DONG_202510.csv data/LOCAL_PEOPLE_DONG_202511.csv data/LOCAL_PEOPLE_DONG_202512.csv
"""
import argparse
import sys
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text

from backend.config import settings
from backend.models import Base, LivingPopulation

MVP_PREFIXES = ("1168", "1162")  # 강남구, 관악구
BATCH = 10_000

COL_MAP = {
    "기준일ID":    "base_date_raw",
    "시간대구분":  "hour_slot",
    "행정동코드":  "adm_cd",
    "총생활인구수": "total_pop",
}


def recreate_table(engine) -> None:
    """living_population 테이블을 최신 스키마로 재생성."""
    LivingPopulation.__table__.drop(engine, checkfirst=True)
    LivingPopulation.__table__.create(engine)
    print("[living_population] 테이블 재생성 완료")


def load_file(csv_path: Path, engine) -> int:
    print(f"[{csv_path.name}] 읽는 중...")
    chunks = pd.read_csv(
        csv_path,
        encoding="utf-8-sig",
        index_col=False,
        usecols=list(COL_MAP.keys()),
        dtype={"기준일ID": str, "행정동코드": str},
        chunksize=BATCH,
    )

    loaded = 0
    for chunk in chunks:
        chunk = chunk.rename(columns=COL_MAP)

        # MVP 필터 (강남구·관악구)
        chunk = chunk[chunk["adm_cd"].str.startswith(MVP_PREFIXES)]
        if chunk.empty:
            continue

        # base_date: YYYYMMDD → date
        chunk["base_date"] = pd.to_datetime(chunk["base_date_raw"], format="%Y%m%d").dt.date
        chunk = chunk.drop(columns=["base_date_raw"])

        chunk["hour_slot"] = chunk["hour_slot"].astype(int)
        chunk["total_pop"] = pd.to_numeric(chunk["total_pop"], errors="coerce")

        chunk[["base_date", "hour_slot", "adm_cd", "total_pop"]].to_sql(
            LivingPopulation.__tablename__,
            engine,
            if_exists="append",
            index=False,
            method="multi",
        )
        loaded += len(chunk)
        print(f"  {loaded:,}행 적재...")

    print(f"[{csv_path.name}] 완료: {loaded:,}행")
    return loaded


def main() -> None:
    parser = argparse.ArgumentParser(description="생활인구 CSV 파일 DB 적재")
    parser.add_argument("files", nargs="+", help="CSV 파일 경로 (여러 개 가능)")
    parser.add_argument(
        "--recreate",
        action="store_true",
        help="적재 전 living_population 테이블 DROP & CREATE (스키마 변경 시 사용)",
    )
    args = parser.parse_args()

    engine = create_engine(settings.database_url)

    if args.recreate:
        recreate_table(engine)

    grand_total = 0
    for f in args.files:
        path = Path(f)
        if not path.exists():
            print(f"[경고] 파일 없음: {path}", file=sys.stderr)
            continue
        grand_total += load_file(path, engine)

    print(f"\n전체 완료: {grand_total:,}행 적재")


if __name__ == "__main__":
    main()
