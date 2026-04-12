"""
OD 이동 데이터 CSV → od_flows 테이블 적재 스크립트

원본 파일: seoul_purpose_admdong3_final_YYYYMMDD.csv
- 약 600만 행 / 일 (수도권 전체)
- 청크 단위로 읽어 메모리를 아낌
- MVP: 강남구(1168xxxx) · 관악구(1162xxxx) 관련 행만 필터링

실행 방법:
    python -m backend.pipeline.load_od_flows data/seoul_purpose_admdong3_final_20260228.csv
    python -m backend.pipeline.load_od_flows data/  # 폴더 내 모든 CSV 일괄 적재
"""
import argparse
import sys
from datetime import date
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import insert

from backend.config import settings

# MVP 대상 자치구 행정동 코드 앞 4자리
MVP_DISTRICT_PREFIXES = {
    "1168",  # 강남구
    "1162",  # 관악구
}

CHUNK_SIZE = 50_000


def parse_date(etl_ymd: int) -> date:
    s = str(etl_ymd)
    return date(int(s[:4]), int(s[4:6]), int(s[6:8]))


def filter_mvp(df: pd.DataFrame) -> pd.DataFrame:
    """강남구·관악구 관련 행만 남긴다 (출발 또는 도착)."""
    o_prefix = df["o_admdong_cd"].astype(str).str[:4]
    d_prefix = df["d_admdong_cd"].astype(str).str[:4]
    mask = o_prefix.isin(MVP_DISTRICT_PREFIXES) | d_prefix.isin(MVP_DISTRICT_PREFIXES)
    return df[mask]


def load_csv(csv_path: Path, engine) -> int:
    """CSV 한 파일을 청크 단위로 읽어 DB에 적재한다. 적재된 행 수 반환."""
    total = 0
    for chunk in pd.read_csv(csv_path, chunksize=CHUNK_SIZE):
        chunk = filter_mvp(chunk)
        if chunk.empty:
            continue

        base_date = parse_date(int(chunk["etl_ymd"].iloc[0]))

        records = [
            {
                "base_date": base_date,
                "origin_adm_cd": str(row["o_admdong_cd"]),
                "dest_adm_cd": str(row["d_admdong_cd"]),
                "move_purpose": int(row["move_purpose"]) if pd.notna(row["move_purpose"]) else None,
                "in_forn_div": row["in_forn_div_nm"],
                "trip_count": float(row["cnt"]),
            }
            for _, row in chunk.iterrows()
        ]

        with engine.begin() as conn:
            conn.execute(
                insert(__import__("backend.models", fromlist=["OdFlow"]).OdFlow.__table__),
                records,
            )
        total += len(records)
        print(f"  {csv_path.name} — {total}행 적재 중...")

    return total


def load_csv_fast(csv_path: Path, engine) -> int:
    """pandas to_sql을 이용한 빠른 bulk 적재."""
    from backend.models import OdFlow

    total = 0
    for chunk in pd.read_csv(csv_path, chunksize=CHUNK_SIZE):
        chunk = filter_mvp(chunk)
        if chunk.empty:
            continue

        base_date = parse_date(int(chunk["etl_ymd"].iloc[0]))

        df_insert = pd.DataFrame({
            "base_date": base_date,
            "origin_adm_cd": chunk["o_admdong_cd"].astype(str),
            "dest_adm_cd": chunk["d_admdong_cd"].astype(str),
            "move_purpose": chunk["move_purpose"].where(chunk["move_purpose"].notna(), None).astype("Int64"),
            "in_forn_div": chunk["in_forn_div_nm"],
            "trip_count": chunk["cnt"],
        })

        df_insert.to_sql(
            OdFlow.__tablename__,
            engine,
            if_exists="append",
            index=False,
            method="multi",
        )
        total += len(df_insert)
        print(f"  {csv_path.name} — {total}행 적재 중...")

    return total


def main() -> None:
    parser = argparse.ArgumentParser(description="OD CSV → DB 적재")
    parser.add_argument("path", help="CSV 파일 경로 또는 CSV가 들어있는 폴더")
    parser.add_argument(
        "--all-districts",
        action="store_true",
        help="MVP 필터 없이 수도권 전체 적재 (매우 느림)",
    )
    args = parser.parse_args()

    if args.all_districts:
        MVP_DISTRICT_PREFIXES.clear()

    target = Path(args.path)
    files = sorted(target.glob("seoul_purpose_*.csv")) if target.is_dir() else [target]

    if not files:
        print("CSV 파일을 찾을 수 없습니다.", file=sys.stderr)
        sys.exit(1)

    engine = create_engine(settings.database_url)
    grand_total = 0
    for f in files:
        print(f"[{f.name}] 적재 시작")
        n = load_csv_fast(f, engine)
        print(f"[{f.name}] 완료: {n:,}행")
        grand_total += n

    print(f"\n전체 {len(files)}개 파일, {grand_total:,}행 적재 완료")


if __name__ == "__main__":
    main()
