"""od_flows 원본 → od_flows_aggregated 집계 스크립트.

원본의 일자·내외국인 차원을 합산하여 (year_quarter, origin, dest, purpose)
4차원으로 축소한다. Module A/B/C/D/E의 canonical 입력 테이블 생성.

실행:
    python -m backend.pipeline.aggregate_od_flows --quarter 2026Q1
    python -m backend.pipeline.aggregate_od_flows --all
    python -m backend.pipeline.aggregate_od_flows --dry-run

PostgreSQL UPSERT (ON CONFLICT) 사용 — idempotent.
SQLite 환경에서는 pandas 기반 집계 + 단순 INSERT (테스트 용도).
"""
from __future__ import annotations

import argparse
import math
import re
import sys
from datetime import date

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from backend.config import settings

BATCH_SIZE = 10_000

AGGREGATED_COLUMNS = [
    "year_quarter",
    "origin_adm_cd",
    "dest_adm_cd",
    "move_purpose",
    "trip_count_sum",
]

_YEAR_QUARTER_RE = re.compile(r"^(\d{4})Q([1-4])$")


def _parse_year_quarter(value: str) -> tuple[int, int]:
    """'2026Q1' → (2026, 1). 포맷 불일치 시 ValueError."""
    m = _YEAR_QUARTER_RE.fullmatch(value)
    if m is None:
        raise ValueError(f"잘못된 year_quarter 포맷: {value!r} (예: '2026Q1')")
    return int(m.group(1)), int(m.group(2))


def derive_year_quarter(d: date) -> str:
    """날짜를 YYYYQ# 포맷으로 변환. 예: 2026-02-15 → '2026Q1'."""
    quarter = math.ceil(d.month / 3)
    return f"{d.year}Q{quarter}"


def aggregate_dataframe(
    raw: pd.DataFrame,
    quarter: str | None = None,
) -> pd.DataFrame:
    """원본 DataFrame을 분기 집계본으로 변환.

    Args:
        raw: 원본 od_flows 스키마 DataFrame.
        quarter: 특정 분기만 필터 (YYYYQ#). None이면 전체.

    Returns:
        AGGREGATED_COLUMNS 스키마 DataFrame.
    """
    empty_schema = pd.DataFrame(columns=AGGREGATED_COLUMNS)
    if raw.empty:
        return empty_schema

    working = raw.copy()
    working["year_quarter"] = working["base_date"].apply(derive_year_quarter)

    if quarter is not None:
        working = working[working["year_quarter"] == quarter]
        if working.empty:
            return empty_schema

    grouped = (
        working.groupby(
            ["year_quarter", "origin_adm_cd", "dest_adm_cd", "move_purpose"],
            as_index=False,
            dropna=False,
        )["trip_count"]
        .sum()
        .rename(columns={"trip_count": "trip_count_sum"})
    )

    return grouped[AGGREGATED_COLUMNS]


def _upsert_batch_postgres(engine: Engine, batch: pd.DataFrame) -> None:
    """PostgreSQL ON CONFLICT로 배치 업서트."""
    if batch.empty:
        return
    records = batch.to_dict(orient="records")
    stmt = text(
        """
        INSERT INTO od_flows_aggregated
          (year_quarter, origin_adm_cd, dest_adm_cd, move_purpose, trip_count_sum)
        VALUES (:year_quarter, :origin_adm_cd, :dest_adm_cd, :move_purpose, :trip_count_sum)
        ON CONFLICT (year_quarter, origin_adm_cd, dest_adm_cd, move_purpose)
        DO UPDATE SET trip_count_sum = EXCLUDED.trip_count_sum
        """
    )
    with engine.begin() as conn:
        conn.execute(stmt, records)


def _fetch_raw_chunks(engine: Engine, quarter: str | None):
    """od_flows 원본을 청크로 스트리밍 (메모리 안전)."""
    if quarter is None:
        sql = "SELECT base_date, origin_adm_cd, dest_adm_cd, move_purpose, in_forn_div, trip_count FROM od_flows"
        params = {}
    else:
        # base_date 범위로 필터 (인덱스 활용 가능)
        year, q = _parse_year_quarter(quarter)
        start = date(year, (q - 1) * 3 + 1, 1)
        end_month = q * 3
        if end_month == 12:
            end = date(year + 1, 1, 1)
        else:
            end = date(year, end_month + 1, 1)
        sql = (
            "SELECT base_date, origin_adm_cd, dest_adm_cd, move_purpose, in_forn_div, trip_count "
            "FROM od_flows WHERE base_date >= :start AND base_date < :end"
        )
        params = {"start": start, "end": end}

    return pd.read_sql(text(sql), engine, params=params, chunksize=BATCH_SIZE * 10)


def aggregate_to_db(
    engine: Engine,
    quarter: str | None = None,
    dry_run: bool = False,
) -> int:
    """원본 → 집계본 적재. 적재된 행 수 반환.

    PostgreSQL에서만 UPSERT 동작. SQLite(테스트)는 본 함수 호출 불필요.
    """
    total = 0
    for chunk_idx, chunk in enumerate(_fetch_raw_chunks(engine, quarter), start=1):
        # SQL WHERE가 이미 분기 범위를 필터했으므로 파이썬 재필터 불필요 (quarter=None).
        # 단, 청크에 여러 분기가 섞일 수 있는 전체 집계(quarter=None) 케이스는 그룹화만 수행.
        agg = aggregate_dataframe(chunk, quarter=None)
        if agg.empty:
            continue

        if dry_run:
            print(f"  chunk#{chunk_idx}: {len(agg):,} 집계 행 (dry-run)")
        else:
            _upsert_batch_postgres(engine, agg)
            print(f"  chunk#{chunk_idx}: {len(agg):,} 집계 행 upsert 완료")
        total += len(agg)

    return total


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="od_flows → od_flows_aggregated 집계")
    grp = p.add_mutually_exclusive_group(required=True)
    grp.add_argument("--quarter", help="특정 분기만 집계 (예: 2026Q1)")
    grp.add_argument("--all", action="store_true", help="전체 분기 집계")
    p.add_argument("--dry-run", action="store_true", help="DB 변경 없이 행 수만 보고")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    quarter = args.quarter if not args.all else None

    engine = create_engine(settings.database_url)
    target = quarter or "전체"
    print(f"[aggregate_od_flows] 대상: {target} (dry_run={args.dry_run})")

    total = aggregate_to_db(engine, quarter=quarter, dry_run=args.dry_run)
    print(f"[aggregate_od_flows] 완료: {total:,} 집계 행")
    return 0


if __name__ == "__main__":
    sys.exit(main())
