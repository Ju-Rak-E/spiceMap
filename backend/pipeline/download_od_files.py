"""
OD 이동 데이터 자동 다운로드 + DB 적재 스크립트

POST https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do
Body: infId=OA-22300&seqNo=&seq=YYMMDD&infSeq=1

실행 방법:
    # 2025Q4 전체 (10/1 ~ 12/31) 다운로드 + 적재
    python -m backend.pipeline.download_od_files --quarter 2025Q4

    # 특정 날짜만
    python -m backend.pipeline.download_od_files --date 20251001

    # 다운로드만 (적재 생략)
    python -m backend.pipeline.download_od_files --quarter 2025Q4 --no-load
"""
import argparse
import io
import sys
import time
import zipfile
from datetime import date, timedelta
from pathlib import Path

import httpx
import pandas as pd
from sqlalchemy import create_engine

from backend.config import settings
from backend.models import LivingPopulation, OdFlow
from backend.pipeline.load_od_flows import filter_mvp, load_csv_fast

DOWNLOAD_URL = "https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do"
DATA_DIR = Path("data/od")
SLEEP_SEC = 1.5  # 서버 부하 방지

QUARTERS = {
    "2025Q1": (date(2025, 1, 1),  date(2025, 3, 31)),
    "2025Q2": (date(2025, 4, 1),  date(2025, 6, 30)),
    "2025Q3": (date(2025, 7, 1),  date(2025, 9, 30)),
    "2025Q4": (date(2025, 10, 1), date(2025, 12, 31)),
}


def date_range(start: date, end: date):
    cur = start
    while cur <= end:
        yield cur
        cur += timedelta(days=1)


def seq_from_date(d: date) -> str:
    """date → YYMMDD 문자열 (예: 20251001 → 251001)"""
    return d.strftime("%y%m%d")


def download_zip(d: date) -> bytes | None:
    """하루치 ZIP 파일을 다운로드해 bytes로 반환. 파일 없으면 None."""
    seq = seq_from_date(d)
    resp = httpx.post(
        DOWNLOAD_URL,
        params={"useCache": "false"},
        data={"infId": "OA-22300", "seqNo": "", "seq": seq, "infSeq": "1"},
        timeout=60,
        follow_redirects=True,
    )
    if resp.status_code != 200 or b"PK" not in resp.content[:4]:
        return None  # ZIP 매직 바이트 없으면 데이터 없는 날
    return resp.content


def process_date(d: date, engine, save_dir: Path | None) -> int:
    """하루치 데이터를 다운로드 → (선택) 저장 → DB 적재. 적재 행수 반환."""
    print(f"  [{d}] 다운로드 중...", end=" ", flush=True)
    zip_bytes = download_zip(d)
    if zip_bytes is None:
        print("데이터 없음 (스킵)")
        return 0

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        csv_name = zf.namelist()[0]
        csv_bytes = zf.read(csv_name)

    if save_dir:
        save_dir.mkdir(parents=True, exist_ok=True)
        (save_dir / csv_name).write_bytes(csv_bytes)

    # CSV → 필터 → DB 적재
    chunks = pd.read_csv(io.BytesIO(csv_bytes), chunksize=50_000)
    loaded = 0
    for chunk in chunks:
        chunk = filter_mvp(chunk)
        if chunk.empty:
            continue

        base_date = d
        df_insert = pd.DataFrame({
            "base_date": base_date,
            "origin_adm_cd": chunk["o_admdong_cd"].astype(str),
            "dest_adm_cd": chunk["d_admdong_cd"].astype(str),
            "move_purpose": chunk["move_purpose"].where(
                chunk["move_purpose"].notna(), None
            ).astype("Int64"),
            "in_forn_div": chunk["in_forn_div_nm"],
            "trip_count": chunk["cnt"],
        })
        df_insert.to_sql(
            OdFlow.__tablename__, engine,
            if_exists="append", index=False, method="multi",
        )
        loaded += len(df_insert)

    print(f"{loaded:,}행 적재")
    return loaded


def main() -> None:
    parser = argparse.ArgumentParser(description="OD 파일 자동 다운로드 + DB 적재")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--quarter", choices=list(QUARTERS), help="분기 (예: 2025Q4)")
    group.add_argument("--date", help="단일 날짜 YYYYMMDD (예: 20251001)")
    parser.add_argument("--from-date", help="분기 수집 시 시작일 재지정 YYYYMMDD (중단 후 재개용)")
    parser.add_argument("--no-load", action="store_true", help="다운로드만, DB 적재 생략")
    parser.add_argument("--save", action="store_true", help="CSV 파일을 data/od/ 에 저장")
    args = parser.parse_args()

    if args.quarter:
        start, end = QUARTERS[args.quarter]
        if args.from_date:
            start = date(int(args.from_date[:4]), int(args.from_date[4:6]), int(args.from_date[6:8]))
            print(f"[재개] {args.from_date} 부터 시작")
        dates = list(date_range(start, end))
        print(f"[{args.quarter}] {start} ~ {end} ({len(dates)}일)")
    else:
        d = date(int(args.date[:4]), int(args.date[4:6]), int(args.date[6:8]))
        dates = [d]

    engine = create_engine(settings.database_url) if not args.no_load else None
    save_dir = Path("data/od") if args.save else None

    grand_total = 0
    for d in dates:
        n = process_date(d, engine, save_dir)
        grand_total += n
        if len(dates) > 1:
            time.sleep(SLEEP_SEC)

    print(f"\n완료: {len(dates)}일, 총 {grand_total:,}행 적재")


if __name__ == "__main__":
    main()
