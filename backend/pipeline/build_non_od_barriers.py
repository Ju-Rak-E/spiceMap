"""Build non-OD spatial barriers and replace flow_barriers for a quarter.

This batch intentionally writes to the existing flow_barriers table so the
current /api/barriers, /api/barrier-routes, and frontend layers keep working.
"""
from __future__ import annotations

import argparse
import re
import sys

import pandas as pd
from sqlalchemy import bindparam, create_engine, text
from sqlalchemy.engine import Engine

from backend.analysis.module_c_barriers import (
    DEFAULT_NON_OD_MAX_DISTANCE_M,
    DEFAULT_NON_OD_NEIGHBOR_K,
    DEFAULT_TOP_N,
    compute_non_od_barriers,
)
from backend.config import settings

_YEAR_QUARTER_RE = re.compile(r"^(\d{4})Q([1-4])$")


def _legacy_to_quarter(value: str) -> str:
    if _YEAR_QUARTER_RE.fullmatch(value):
        return value
    if len(value) == 5 and value[:4].isdigit() and value[4] in "1234":
        return f"{value[:4]}Q{value[4]}"
    return value


def _normalize_sales_quarter(sales: pd.DataFrame) -> pd.DataFrame:
    if sales.empty:
        return sales
    out = sales.copy()
    out["year_quarter"] = out["year_quarter"].astype(str).map(_legacy_to_quarter)
    return out


def load_non_od_inputs(
    engine: Engine,
    quarter: str,
    previous_quarter: str | None,
    *,
    neighbor_k: int = DEFAULT_NON_OD_NEIGHBOR_K,
    max_distance_m: float = DEFAULT_NON_OD_MAX_DISTANCE_M,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Load analysis, sales, and nearby commerce pairs for non-OD barriers."""
    analysis = pd.read_sql(
        text(
            """
            SELECT comm_cd, gri_score, closure_rate
            FROM commerce_analysis
            WHERE year_quarter = :quarter
            """
        ),
        engine,
        params={"quarter": quarter},
    )

    quarters = [quarter]
    if previous_quarter:
        quarters.append(previous_quarter)
    legacy_quarters = [q.replace("Q", "") for q in quarters]
    sales_stmt = text(
        """
        SELECT trdar_cd, year_quarter, COALESCE(sales_amount, 0) AS sales_amount
        FROM commerce_sales
        WHERE year_quarter IN :quarters
           OR year_quarter IN :legacy_quarters
        """
    ).bindparams(bindparam("quarters", expanding=True), bindparam("legacy_quarters", expanding=True))
    sales = pd.read_sql(
        sales_stmt,
        engine,
        params={"quarters": quarters, "legacy_quarters": legacy_quarters},
    )
    sales = _normalize_sales_quarter(sales)

    pairs = load_candidate_pairs(
        engine,
        neighbor_k=neighbor_k,
        max_distance_m=max_distance_m,
    )
    return analysis, sales, pairs


def load_candidate_pairs(
    engine: Engine,
    *,
    neighbor_k: int = DEFAULT_NON_OD_NEIGHBOR_K,
    max_distance_m: float = DEFAULT_NON_OD_MAX_DISTANCE_M,
) -> pd.DataFrame:
    """Load nearest commerce pairs from PostGIS."""
    if neighbor_k <= 0:
        raise ValueError(f"neighbor_k must be positive, got {neighbor_k}")
    if max_distance_m <= 0:
        raise ValueError(f"max_distance_m must be positive, got {max_distance_m}")

    sql = text(
        """
        WITH comm AS (
            SELECT comm_cd, ST_PointOnSurface(ST_Transform(geom, 4326)) AS geom
            FROM commerce_boundary
            WHERE geom IS NOT NULL
        )
        SELECT
            c1.comm_cd AS comm_a_cd,
            c2.comm_cd AS comm_b_cd,
            ST_Distance(c1.geom::geography, c2.geom::geography) AS distance_m
        FROM comm c1
        JOIN LATERAL (
            SELECT comm_cd, geom
            FROM comm c2
            WHERE c2.comm_cd <> c1.comm_cd
              AND ST_DWithin(c1.geom::geography, c2.geom::geography, :max_distance_m)
            ORDER BY c1.geom <-> c2.geom
            LIMIT :neighbor_k
        ) c2 ON TRUE
        """
    )
    pairs = pd.read_sql(
        sql,
        engine,
        params={"neighbor_k": neighbor_k, "max_distance_m": max_distance_m},
    )
    if pairs.empty:
        return pd.DataFrame(columns=["comm_a_cd", "comm_b_cd", "distance_m"])

    pairs["pair_key"] = pairs.apply(
        lambda row: tuple(sorted((str(row["comm_a_cd"]), str(row["comm_b_cd"])))),
        axis=1,
    )
    pairs = (
        pairs.sort_values("distance_m")
        .drop_duplicates("pair_key")
        .drop(columns=["pair_key"])
        .reset_index(drop=True)
    )
    return pairs[["comm_a_cd", "comm_b_cd", "distance_m"]]


def replace_flow_barriers(engine: Engine, quarter: str, rows: pd.DataFrame) -> int:
    """Replace one quarter of flow_barriers with non-OD barrier rows."""
    insert_rows = [
        {
            "year_quarter": quarter,
            "from_comm_cd": row["from_comm_cd"],
            "to_comm_cd": row["to_comm_cd"],
            "barrier_score": float(row["barrier_score"]),
            "barrier_type": row["barrier_type"],
        }
        for _, row in rows.iterrows()
    ]
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM flow_barriers WHERE year_quarter = :quarter"), {"quarter": quarter})
        if insert_rows:
            conn.execute(
                text(
                    """
                    INSERT INTO flow_barriers
                        (year_quarter, from_comm_cd, to_comm_cd, barrier_score, barrier_type)
                    VALUES
                        (:year_quarter, :from_comm_cd, :to_comm_cd, :barrier_score, :barrier_type)
                    """
                ),
                insert_rows,
            )
    return len(insert_rows)


def build_and_replace_non_od_barriers(
    engine: Engine,
    *,
    quarter: str,
    previous_quarter: str | None,
    top_n: int = DEFAULT_TOP_N,
    neighbor_k: int = DEFAULT_NON_OD_NEIGHBOR_K,
    max_distance_m: float = DEFAULT_NON_OD_MAX_DISTANCE_M,
) -> dict[str, int]:
    analysis, sales, pairs = load_non_od_inputs(
        engine,
        quarter,
        previous_quarter,
        neighbor_k=neighbor_k,
        max_distance_m=max_distance_m,
    )
    barriers = compute_non_od_barriers(
        analysis,
        sales,
        pairs,
        target_quarter=quarter,
        previous_quarter=previous_quarter,
        max_distance_m=max_distance_m,
        top_n=top_n,
    )
    loaded = replace_flow_barriers(engine, quarter, barriers)
    return {
        "analysis_rows": len(analysis),
        "candidate_pairs": len(pairs),
        "barriers": len(barriers),
        "loaded": loaded,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build non-OD spatial barriers")
    parser.add_argument("--quarter", required=True, help="Target quarter, e.g. 2025Q4")
    parser.add_argument("--previous", default=None, help="Previous quarter for sales trend, e.g. 2025Q3")
    parser.add_argument("--top-n", type=int, default=DEFAULT_TOP_N)
    parser.add_argument("--neighbor-k", type=int, default=DEFAULT_NON_OD_NEIGHBOR_K)
    parser.add_argument("--max-distance-m", type=float, default=DEFAULT_NON_OD_MAX_DISTANCE_M)
    parser.add_argument("--dry-run", action="store_true", help="Compute only; do not replace flow_barriers")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    engine = create_engine(settings.database_url)
    try:
        analysis, sales, pairs = load_non_od_inputs(
            engine,
            args.quarter,
            args.previous,
            neighbor_k=args.neighbor_k,
            max_distance_m=args.max_distance_m,
        )
        barriers = compute_non_od_barriers(
            analysis,
            sales,
            pairs,
            target_quarter=args.quarter,
            previous_quarter=args.previous,
            max_distance_m=args.max_distance_m,
            top_n=args.top_n,
        )
    except Exception as exc:
        print(f"[build_non_od_barriers] failed: {exc!r}", file=sys.stderr)
        return 2

    print(
        f"[build_non_od_barriers] quarter={args.quarter} previous={args.previous} "
        f"analysis_rows={len(analysis):,} candidate_pairs={len(pairs):,} "
        f"barriers={len(barriers):,} dry_run={args.dry_run}"
    )
    if args.dry_run:
        return 0

    loaded = replace_flow_barriers(engine, args.quarter, barriers)
    print(f"[build_non_od_barriers] loaded={loaded:,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
