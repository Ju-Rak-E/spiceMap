"""Build and load commerce_analysis rows for a quarter.

This script combines existing prepared tables:
- od_flows_aggregated: quarterly OD flow input
- adm_comm_mapping: admin-dong to commerce-area allocation ratios
- store_info: district-level closure metrics
- commerce_boundary: commerce-area names

Then it computes Module A metrics, GRI, commerce type, and replaces the
target quarter rows in commerce_analysis for the selected commerce areas.
"""
from __future__ import annotations

import argparse
import re
import sys
from collections.abc import Iterable

import numpy as np
import pandas as pd
from sqlalchemy import bindparam, create_engine, text
from sqlalchemy.engine import Engine

from backend.analysis.commerce_type import (
    COMMERCE_TYPE_UNCLASSIFIED,
    classify_commerce_types,
)
from backend.analysis.module_a_graph import (
    build_commerce_flow_graph,
    compute_degree_metrics,
    load_quarterly_od_flows,
)
from backend.analysis.module_b_gri import compute_gri
from backend.config import settings

MVP_GU_PREFIXES = ("11680", "11620")
_YEAR_QUARTER_RE = re.compile(r"^(\d{4})Q([1-4])$")

DB_COLUMNS = [
    "year_quarter",
    "comm_cd",
    "comm_nm",
    "gri_score",
    "flow_volume",
    "dominant_origin",
    "analysis_note",
    "commerce_type",
    "priority_score",
    "net_flow",
    "degree_centrality",
    "closure_rate",
]


def format_exception(exc: Exception) -> str:
    if isinstance(exc, UnicodeDecodeError):
        try:
            return exc.object.decode("cp949", errors="replace")
        except Exception:
            return repr(exc)
    return repr(exc)


def quarter_to_source_code(year_quarter: str) -> str:
    """Convert API quarter format, e.g. 2025Q4, to Seoul source code 20254."""
    match = _YEAR_QUARTER_RE.fullmatch(year_quarter)
    if match is None:
        raise ValueError(f"Invalid quarter format: {year_quarter!r}; expected YYYYQ#")
    return f"{match.group(1)}{match.group(2)}"


def normalize_gu_prefixes(values: Iterable[str] | None) -> tuple[str, ...]:
    if values is None:
        return ()
    prefixes = tuple(dict.fromkeys(str(v).strip() for v in values if str(v).strip()))
    invalid = [v for v in prefixes if not re.fullmatch(r"\d{5}", v)]
    if invalid:
        raise ValueError(f"Invalid gu prefix values: {invalid}; expected 5 digits")
    return prefixes


def compute_inflow_summary(od_flows: pd.DataFrame, mapping: pd.DataFrame) -> pd.DataFrame:
    """Compute inbound flow volume and dominant origin admin-dong per commerce."""
    columns = ["commerce_code", "flow_volume", "dominant_origin"]
    if od_flows.empty or mapping.empty:
        return pd.DataFrame(columns=columns)

    mapping_origin = mapping.rename(
        columns={
            "adm_cd": "origin_adm_cd",
            "comm_cd": "origin_comm",
            "comm_area_ratio": "origin_ratio",
        }
    )
    mapping_dest = mapping.rename(
        columns={
            "adm_cd": "dest_adm_cd",
            "comm_cd": "dest_comm",
            "comm_area_ratio": "dest_ratio",
        }
    )

    merged = od_flows.merge(mapping_origin, on="origin_adm_cd", how="inner")
    merged = merged.merge(mapping_dest, on="dest_adm_cd", how="inner")
    if merged.empty:
        return pd.DataFrame(columns=columns)

    merged = merged[merged["origin_comm"] != merged["dest_comm"]].copy()
    if merged.empty:
        return pd.DataFrame(columns=columns)

    merged["weighted_flow"] = (
        merged["trip_count"].astype(float)
        * merged["origin_ratio"].astype(float)
        * merged["dest_ratio"].astype(float)
    )

    volume = (
        merged.groupby("dest_comm", as_index=False)["weighted_flow"]
        .sum()
        .rename(columns={"dest_comm": "commerce_code", "weighted_flow": "flow_volume"})
    )
    by_origin = (
        merged.groupby(["dest_comm", "origin_adm_cd"], as_index=False)["weighted_flow"]
        .sum()
        .sort_values(["dest_comm", "weighted_flow"], ascending=[True, False])
    )
    dominant = (
        by_origin.drop_duplicates("dest_comm")
        .rename(columns={"dest_comm": "commerce_code", "origin_adm_cd": "dominant_origin"})
        [["commerce_code", "dominant_origin"]]
    )

    result = volume.merge(dominant, on="commerce_code", how="left")
    result["flow_volume"] = result["flow_volume"].round().astype("int64")
    return result[columns]


def assign_commerce_gu(mapping: pd.DataFrame) -> pd.DataFrame:
    """Assign each commerce area to the admin-dong with largest overlap."""
    columns = ["commerce_code", "signgu_cd"]
    if mapping.empty:
        return pd.DataFrame(columns=columns)

    working = mapping.copy()
    working["comm_area_ratio"] = pd.to_numeric(working["comm_area_ratio"], errors="coerce").fillna(0.0)
    idx = working.groupby("comm_cd")["comm_area_ratio"].idxmax()
    assigned = working.loc[idx, ["comm_cd", "adm_cd"]].rename(columns={"comm_cd": "commerce_code"})
    assigned["signgu_cd"] = assigned["adm_cd"].astype(str).str[:5]
    return assigned[columns]


def compute_closure_by_signgu(store_info: pd.DataFrame) -> pd.DataFrame:
    """Return one weighted closure rate per district."""
    columns = ["signgu_cd", "closure_rate"]
    if store_info.empty:
        return pd.DataFrame(columns=columns)

    working = store_info.copy()
    for col in ("store_count", "close_count", "close_rate"):
        working[col] = pd.to_numeric(working[col], errors="coerce")

    grouped = (
        working.groupby("signgu_cd", as_index=False)
        .agg(
            store_count=("store_count", "sum"),
            close_count=("close_count", "sum"),
            avg_close_rate=("close_rate", "mean"),
        )
    )

    grouped["closure_rate"] = np.where(
        grouped["store_count"] > 0,
        grouped["close_count"] / grouped["store_count"] * 100.0,
        grouped["avg_close_rate"],
    )
    return grouped[columns]


def build_analysis_frame(
    *,
    quarter: str,
    commerce: pd.DataFrame,
    od_flows: pd.DataFrame,
    mapping: pd.DataFrame,
    store_info: pd.DataFrame,
    gu_prefixes: Iterable[str] | None = None,
) -> pd.DataFrame:
    """Build commerce_analysis rows without writing to DB."""
    prefixes = normalize_gu_prefixes(gu_prefixes)
    commerce_base = commerce.rename(
        columns={"comm_cd": "commerce_code", "comm_nm": "commerce_name"}
    )[["commerce_code", "commerce_name"]].drop_duplicates("commerce_code")

    gu = assign_commerce_gu(mapping)
    targets = commerce_base.merge(gu, on="commerce_code", how="left")
    if prefixes:
        targets = targets[targets["signgu_cd"].isin(prefixes)].copy()
    if targets.empty:
        return pd.DataFrame(columns=DB_COLUMNS)

    graph = build_commerce_flow_graph(od_flows, mapping)
    degree = compute_degree_metrics(graph)
    inflow = compute_inflow_summary(od_flows, mapping)
    closure = compute_closure_by_signgu(store_info)

    analysis = targets.merge(degree, on="commerce_code", how="left")
    analysis = analysis.merge(inflow, on="commerce_code", how="left")
    analysis = analysis.merge(closure, on="signgu_cd", how="left")

    analysis["has_flow_metrics"] = analysis["net_flow"].notna()
    for col in ("in_degree", "out_degree", "net_flow", "degree_centrality", "flow_volume"):
        analysis[col] = pd.to_numeric(analysis[col], errors="coerce").fillna(0.0)

    closure_median = analysis["closure_rate"].dropna().median()
    if pd.isna(closure_median):
        closure_median = 0.0
        closure_note = "closure_rate_fallback_zero"
    else:
        closure_note = "closure_rate_fallback_median"
    analysis["closure_rate"] = pd.to_numeric(analysis["closure_rate"], errors="coerce").fillna(float(closure_median))

    analysis["quarter"] = quarter
    analysis["gri_score"] = np.nan
    analysis["commerce_type"] = COMMERCE_TYPE_UNCLASSIFIED

    analyzable_mask = analysis["has_flow_metrics"]
    if analyzable_mask.any():
        gri_input = analysis.loc[
            analyzable_mask,
            ["commerce_code", "quarter", "closure_rate", "net_flow", "degree_centrality"],
        ]
        with_gri = compute_gri(gri_input)
        classified = classify_commerce_types(
            analysis.loc[
                analyzable_mask,
                ["commerce_code", "net_flow", "degree_centrality", "closure_rate"],
            ].merge(
                with_gri[["commerce_code", "gri_score"]],
                on="commerce_code",
                how="left",
            )
        )
        analysis.loc[analyzable_mask, "gri_score"] = with_gri["gri_score"].to_numpy()
        analysis.loc[analyzable_mask, "commerce_type"] = classified["commerce_type"].to_numpy()

    analysis["analysis_note"] = np.where(
        analysis["has_flow_metrics"],
        closure_note,
        "no_flow_metrics",
    )
    analysis["year_quarter"] = quarter
    analysis["comm_cd"] = analysis["commerce_code"]
    analysis["comm_nm"] = analysis["commerce_name"]
    analysis["priority_score"] = None
    analysis["flow_volume"] = analysis["flow_volume"].round().astype("int64")

    return analysis[DB_COLUMNS]


def load_input_frames(engine: Engine, quarter: str) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    od_flows = load_quarterly_od_flows(engine, quarter)
    mapping = pd.read_sql(
        text("SELECT adm_cd, comm_cd, comm_area_ratio FROM adm_comm_mapping"),
        engine,
    )
    commerce = pd.read_sql(
        text("SELECT comm_cd, comm_nm FROM commerce_boundary"),
        engine,
    )
    store_info = pd.read_sql(
        text(
            """
            SELECT signgu_cd, store_count, close_count, close_rate
            FROM store_info
            WHERE year_quarter = :source_quarter
            """
        ),
        engine,
        params={"source_quarter": quarter_to_source_code(quarter)},
    )
    return commerce, od_flows, mapping, store_info


def replace_commerce_analysis(engine: Engine, rows: pd.DataFrame) -> int:
    if rows.empty:
        return 0

    comm_codes = rows["comm_cd"].dropna().astype(str).unique().tolist()
    quarter = str(rows["year_quarter"].iloc[0])
    records = rows.where(pd.notna(rows), None).to_dict(orient="records")

    delete_stmt = text(
        """
        DELETE FROM commerce_analysis
        WHERE year_quarter = :year_quarter
          AND comm_cd IN :comm_codes
        """
    ).bindparams(bindparam("comm_codes", expanding=True))
    insert_stmt = text(
        """
        INSERT INTO commerce_analysis
          (year_quarter, comm_cd, comm_nm, gri_score, flow_volume, dominant_origin,
           analysis_note, commerce_type, priority_score, net_flow, degree_centrality, closure_rate)
        VALUES
          (:year_quarter, :comm_cd, :comm_nm, :gri_score, :flow_volume, :dominant_origin,
           :analysis_note, :commerce_type, :priority_score, :net_flow, :degree_centrality, :closure_rate)
        """
    )

    with engine.begin() as conn:
        conn.execute(delete_stmt, {"year_quarter": quarter, "comm_codes": comm_codes})
        conn.execute(insert_stmt, records)
    return len(records)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build commerce_analysis for a quarter")
    parser.add_argument("--quarter", required=True, help="Target quarter, e.g. 2025Q4")
    parser.add_argument(
        "--gu-prefix",
        action="append",
        default=[],
        help="5-digit district prefix, e.g. 11680. Repeatable. Omit for all.",
    )
    parser.add_argument(
        "--mvp",
        action="store_true",
        help="Shortcut for Gangnam/Gwanak prefixes: 11680 and 11620.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Compute and print summary only")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    gu_prefixes = list(args.gu_prefix)
    if args.mvp:
        gu_prefixes.extend(MVP_GU_PREFIXES)
    gu_prefixes = list(normalize_gu_prefixes(gu_prefixes))

    engine = create_engine(settings.database_url)
    try:
        commerce, od_flows, mapping, store_info = load_input_frames(engine, args.quarter)
    except Exception as exc:
        print(
            "[build_commerce_analysis] failed to read input tables. "
            "Check DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD and whether PostgreSQL is running.",
            file=sys.stderr,
        )
        print(f"[build_commerce_analysis] error={format_exception(exc)}", file=sys.stderr)
        return 2
    rows = build_analysis_frame(
        quarter=args.quarter,
        commerce=commerce,
        od_flows=od_flows,
        mapping=mapping,
        store_info=store_info,
        gu_prefixes=gu_prefixes,
    )

    print(f"[build_commerce_analysis] quarter={args.quarter}, targets={len(rows):,}, dry_run={args.dry_run}")
    if gu_prefixes:
        print(f"[build_commerce_analysis] gu_prefixes={','.join(gu_prefixes)}")
    if rows.empty:
        print("[build_commerce_analysis] no target commerce rows")
        return 1

    print(rows["commerce_type"].value_counts(dropna=False).to_string())
    if args.dry_run:
        return 0

    try:
        loaded = replace_commerce_analysis(engine, rows)
    except Exception as exc:
        print(
            "[build_commerce_analysis] failed to write commerce_analysis.",
            file=sys.stderr,
        )
        print(f"[build_commerce_analysis] error={format_exception(exc)}", file=sys.stderr)
        return 3
    print(f"[build_commerce_analysis] loaded={loaded:,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
