"""분석 INSERT 파이프라인 — 분기 입력으로 Module A·B·D·E를 실행하고
`commerce_analysis` + `policy_cards`를 분기 단위로 idempotent INSERT.

설계: prompt_plan.md Week 3 Dev-C
- 입력: target_quarter (YYYYQ#), previous_quarter (옵션)
- 산출 흐름:
    od_flows_aggregated → Module A (degree metrics)
                       ↘
    store_info closure_rate (자치구 → comm_cd 매핑)
                       ↘ 합쳐 → Module B (gri_score)
                                 → classify_commerce_types
                                 → Module D (policy_cards)
                                 → Module E (priority_score)
- 출력: commerce_analysis 분기 UPSERT, policy_cards 분기 INSERT.

실행:
    python -m backend.pipeline.run_analysis --quarter 2025Q4 --previous 2025Q3
    python -m backend.pipeline.run_analysis --quarter 2025Q4 --dry-run
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from backend.analysis.commerce_type import classify_commerce_types
from backend.analysis.module_a_graph import (
    DEGREE_COLUMNS,
    build_commerce_flow_graph,
    compute_degree_metrics,
    load_quarterly_od_flows,
)
from backend.analysis.module_b_gri import compute_gri
from backend.analysis.module_d_policy import generate_policy_cards
from backend.analysis.module_e_priority import compute_priority_scores
from backend.config import settings
from backend.schemas.insights import PolicyCard

_YEAR_QUARTER_RE = re.compile(r"^(\d{4})Q([1-4])$")


def quarter_to_legacy(quarter: str) -> str:
    """`2025Q4` → `20254` (store_info / commerce_sales 포맷)."""
    m = _YEAR_QUARTER_RE.fullmatch(quarter)
    if m is None:
        raise ValueError(f"잘못된 year_quarter 포맷: {quarter!r} (예: '2025Q4')")
    return f"{m.group(1)}{m.group(2)}"


@dataclass(frozen=True)
class AnalysisInputs:
    od_flows: pd.DataFrame
    mapping: pd.DataFrame
    closures: pd.DataFrame  # comm_cd, closure_rate
    commerce_meta: pd.DataFrame  # comm_cd, comm_nm
    sales: pd.DataFrame  # trdar_cd, year_quarter (YYYYQ#), sales_amount


@dataclass
class AnalysisResult:
    analysis_rows: list[dict] = field(default_factory=list)
    policy_cards: list[PolicyCard] = field(default_factory=list)


def _zero_degree_metrics(commerce_codes: list[str]) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "commerce_code": commerce_codes,
            "in_degree": 0.0,
            "out_degree": 0.0,
            "net_flow": 0.0,
            "degree_centrality": 0.0,
        }
    )


def compose_analysis(
    inputs: AnalysisInputs,
    target_quarter: str,
    previous_quarter: str | None,
) -> AnalysisResult:
    """순수 함수 — DB 접근 없음. 모듈 조합으로 분기 분석 행을 생성한다."""
    commerce_meta = inputs.commerce_meta.copy()
    if commerce_meta.empty:
        return AnalysisResult()

    # 1) Module A — degree metrics
    if inputs.od_flows.empty or inputs.mapping.empty:
        degree = _zero_degree_metrics(commerce_meta["comm_cd"].astype(str).tolist())
    else:
        graph = build_commerce_flow_graph(inputs.od_flows, inputs.mapping)
        degree = compute_degree_metrics(graph)
        if degree.empty:
            degree = _zero_degree_metrics(commerce_meta["comm_cd"].astype(str).tolist())

    # 누락된 상권 보충 (그래프에 없는 상권은 0으로 채움)
    missing_codes = set(commerce_meta["comm_cd"]) - set(degree["commerce_code"])
    if missing_codes:
        zero_extra = _zero_degree_metrics(sorted(missing_codes))
        degree = pd.concat([degree, zero_extra], ignore_index=True)

    # 2) Module B 입력 합성 — closure_rate 결합
    base = degree.merge(
        inputs.closures.rename(columns={"comm_cd": "commerce_code"}),
        on="commerce_code",
        how="left",
    )
    base["closure_rate"] = base["closure_rate"].fillna(0.0)
    base["quarter"] = target_quarter
    gri_df = compute_gri(base[DEGREE_COLUMNS + ["closure_rate", "quarter"]])

    # 3) 분류기 (Module D 입력) — commerce_meta로 이름 결합
    classify_input = gri_df.merge(
        commerce_meta.rename(columns={"comm_cd": "commerce_code", "comm_nm": "commerce_name"}),
        on="commerce_code",
        how="left",
    )
    classified = classify_commerce_types(classify_input)

    # 4) Module D — 정책 카드
    policy_cards = generate_policy_cards(classified)

    # 5) Module E — priority score
    priority = compute_priority_scores(
        classified[["commerce_code", "quarter", "gri_score"]],
        inputs.sales,
        target_quarter,
        previous_quarter,
    )
    priority_lookup = {row["commerce_code"]: row for _, row in priority.iterrows()}

    # 6) 분석 행 조립
    analysis_rows: list[dict] = []
    for _, row in classified.iterrows():
        code = str(row["commerce_code"])
        priority_row = priority_lookup.get(code)
        priority_score = (
            float(priority_row["priority_score"]) if priority_row is not None else None
        )
        analysis_rows.append(
            {
                "year_quarter": target_quarter,
                "comm_cd": code,
                "comm_nm": str(row.get("commerce_name", "")) or None,
                "gri_score": _to_float_or_none(row.get("gri_score")),
                "flow_volume": _to_int_or_none(row.get("in_degree")),
                "dominant_origin": None,
                "commerce_type": str(row["commerce_type"]) if pd.notna(row["commerce_type"]) else None,
                "priority_score": priority_score,
                "net_flow": _to_float_or_none(row.get("net_flow")),
                "degree_centrality": _to_float_or_none(row.get("degree_centrality")),
                "closure_rate": _to_float_or_none(row.get("closure_rate")),
                "analysis_note": None,
            }
        )

    return AnalysisResult(analysis_rows=analysis_rows, policy_cards=policy_cards)


def _to_float_or_none(value) -> float | None:
    if value is None or pd.isna(value):
        return None
    return float(value)


def _to_int_or_none(value) -> int | None:
    if value is None or pd.isna(value):
        return None
    return int(value)


# ────────────────────────────────────────────────────────────
# DB IO
# ────────────────────────────────────────────────────────────


def collect_inputs(engine: Engine, target_quarter: str) -> AnalysisInputs:
    """SQL을 통해 분석 입력을 모은다."""
    legacy_q = quarter_to_legacy(target_quarter)

    od_flows = _safe_load_od_flows(engine, target_quarter)
    mapping = pd.read_sql(
        text("SELECT adm_cd, comm_cd, comm_area_ratio FROM adm_comm_mapping"),
        engine,
    )
    commerce_meta = pd.read_sql(
        text("SELECT comm_cd, comm_nm FROM commerce_boundary ORDER BY comm_cd"),
        engine,
    )

    closures = _load_closures_by_comm(engine, legacy_q, commerce_meta)

    sales_raw = pd.read_sql(
        text(
            "SELECT trdar_cd, year_quarter, COALESCE(sales_amount, 0) AS sales_amount "
            "FROM commerce_sales"
        ),
        engine,
    )
    sales = _normalize_sales_quarter(sales_raw)

    return AnalysisInputs(
        od_flows=od_flows,
        mapping=mapping,
        closures=closures,
        commerce_meta=commerce_meta,
        sales=sales,
    )


def _safe_load_od_flows(engine: Engine, target_quarter: str) -> pd.DataFrame:
    try:
        return load_quarterly_od_flows(engine, target_quarter)
    except Exception:
        return pd.DataFrame(columns=["origin_adm_cd", "dest_adm_cd", "trip_count"])


def _load_closures_by_comm(
    engine: Engine,
    legacy_quarter: str,
    commerce_meta: pd.DataFrame,
) -> pd.DataFrame:
    """store_info의 자치구 단위 폐업률을 상권 단위로 매핑.

    1순위 (production, PostGIS): commerce_boundary + admin_boundary spatial
        join으로 각 상권의 dominant 자치구를 식별 (admin_boundary.adm_cd 앞
        5자리 = signgu_cd) → store_info의 signgu_cd로 폐업률 결합.
    2순위 (fallback, SQLite/테스트): commerce_meta의 comm_nm == signgu_nm
        직접 매칭 휴리스틱.

    Returns: columns = [comm_cd, closure_rate].
    """
    if commerce_meta.empty:
        return pd.DataFrame(columns=["comm_cd", "closure_rate"])

    # 1) Spatial 우선
    spatial = _closure_via_spatial_join(engine, legacy_quarter)
    if spatial is not None and not spatial.empty:
        return spatial.drop_duplicates(subset="comm_cd")[["comm_cd", "closure_rate"]]

    # 2) Heuristic fallback
    return _closure_via_heuristic(engine, legacy_quarter, commerce_meta)


def _closure_via_spatial_join(
    engine: Engine,
    legacy_quarter: str,
) -> pd.DataFrame | None:
    """PostGIS spatial join + signgu_cd 결합.

    상권 중심점이 포함되는 행정동의 adm_cd 앞 5자리 = 자치구 코드.
    store_info.signgu_cd 와 동일 키로 폐업률 평균을 매칭한다.

    Returns: columns = [comm_cd, closure_rate], 또는 PostGIS 미지원 시 None.
    """
    sql = text(
        """
        WITH gu_closure AS (
            SELECT signgu_cd, AVG(close_rate) AS avg_close
            FROM store_info
            WHERE year_quarter = :q
              AND signgu_cd IS NOT NULL
              AND close_rate IS NOT NULL
            GROUP BY signgu_cd
        ),
        comm_to_signgu AS (
            SELECT cb.comm_cd, LEFT(ab.adm_cd, 5) AS signgu_cd
            FROM commerce_boundary cb
            LEFT JOIN LATERAL (
                SELECT adm_cd FROM admin_boundary
                WHERE ST_Contains(geom, ST_PointOnSurface(cb.geom))
                LIMIT 1
            ) ab ON TRUE
            WHERE ab.adm_cd IS NOT NULL
        )
        SELECT cs.comm_cd, gc.avg_close AS closure_rate
        FROM comm_to_signgu cs
        JOIN gu_closure gc ON cs.signgu_cd = gc.signgu_cd
        """
    )
    try:
        return pd.read_sql(sql, engine, params={"q": legacy_quarter})
    except Exception:
        # PostGIS 미지원 또는 admin_boundary/geom 누락 → fallback
        return None


def _closure_via_heuristic(
    engine: Engine,
    legacy_quarter: str,
    commerce_meta: pd.DataFrame,
) -> pd.DataFrame:
    """fallback: comm_nm == signgu_nm 직접 매칭 (테스트 픽스처 호환)."""
    raw = pd.read_sql(
        text(
            """
            SELECT signgu_nm, AVG(close_rate) AS avg_close
            FROM store_info
            WHERE year_quarter = :q AND signgu_nm IS NOT NULL
            GROUP BY signgu_nm
            """
        ),
        engine,
        params={"q": legacy_quarter},
    )
    if raw.empty:
        return pd.DataFrame(columns=["comm_cd", "closure_rate"])

    rows: list[dict] = []
    for _, comm in commerce_meta.iterrows():
        comm_nm = str(comm["comm_nm"])
        match = raw[raw["signgu_nm"].astype(str) == comm_nm]
        if not match.empty:
            rows.append(
                {
                    "comm_cd": comm["comm_cd"],
                    "closure_rate": float(match.iloc[0]["avg_close"]),
                }
            )
    return pd.DataFrame(rows, columns=["comm_cd", "closure_rate"])


def _normalize_sales_quarter(sales: pd.DataFrame) -> pd.DataFrame:
    """legacy 'YYYYQ' → 'YYYYQ#' 정규화 (이미 YYYYQ#면 통과)."""
    if sales.empty:
        return sales
    out = sales.copy()
    out["year_quarter"] = out["year_quarter"].astype(str).map(_legacy_to_quarter)
    return out


def _legacy_to_quarter(value: str) -> str:
    if _YEAR_QUARTER_RE.fullmatch(value):
        return value
    if len(value) == 5 and value[:4].isdigit() and value[4] in "1234":
        return f"{value[:4]}Q{value[4]}"
    return value  # 알 수 없는 포맷은 그대로 (필터에서 제외됨)


def write_results(
    engine: Engine,
    target_quarter: str,
    result: AnalysisResult,
) -> dict[str, int]:
    """target_quarter의 기존 분석 행/카드를 삭제 후 신규 INSERT — idempotent."""
    with engine.begin() as conn:
        conn.execute(
            text("DELETE FROM commerce_analysis WHERE year_quarter = :q"),
            {"q": target_quarter},
        )
        if result.analysis_rows:
            conn.execute(
                text(
                    """
                    INSERT INTO commerce_analysis (
                        year_quarter, comm_cd, comm_nm, gri_score, flow_volume,
                        dominant_origin, analysis_note, commerce_type, priority_score,
                        net_flow, degree_centrality, closure_rate
                    ) VALUES (
                        :year_quarter, :comm_cd, :comm_nm, :gri_score, :flow_volume,
                        :dominant_origin, :analysis_note, :commerce_type, :priority_score,
                        :net_flow, :degree_centrality, :closure_rate
                    )
                    """
                ),
                result.analysis_rows,
            )

        conn.execute(
            text("DELETE FROM policy_cards WHERE year_quarter = :q"),
            {"q": target_quarter},
        )
        if result.policy_cards:
            conn.execute(
                text(
                    """
                    INSERT INTO policy_cards (
                        year_quarter, comm_cd, rule_id, severity, policy_text,
                        rationale, triggering_metrics, generation_mode
                    ) VALUES (
                        :year_quarter, :comm_cd, :rule_id, :severity, :policy_text,
                        :rationale, :triggering_metrics, :generation_mode
                    )
                    """
                ),
                [
                    {
                        "year_quarter": target_quarter,
                        "comm_cd": card.commerce_code,
                        "rule_id": card.rule_id,
                        "severity": card.severity,
                        "policy_text": card.policy_text,
                        "rationale": card.rationale,
                        "triggering_metrics": json.dumps(card.triggering_metrics, ensure_ascii=False),
                        "generation_mode": card.generation_mode,
                    }
                    for card in result.policy_cards
                ],
            )

    return {
        "analysis_rows": len(result.analysis_rows),
        "policy_cards": len(result.policy_cards),
    }


def run_analysis(
    engine: Engine,
    target_quarter: str,
    previous_quarter: str | None = None,
) -> dict[str, int]:
    """전체 파이프라인 실행."""
    inputs = collect_inputs(engine, target_quarter)
    result = compose_analysis(inputs, target_quarter, previous_quarter)
    return write_results(engine, target_quarter, result)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="분기 입력 → 분석 INSERT 파이프라인")
    p.add_argument("--quarter", required=True, help="대상 분기 (예: 2025Q4)")
    p.add_argument("--previous", default=None, help="추세 비교 분기 (예: 2025Q3)")
    p.add_argument("--dry-run", action="store_true", help="DB 변경 없이 행 수만 보고")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    engine = create_engine(settings.database_url)
    if args.dry_run:
        inputs = collect_inputs(engine, args.quarter)
        result = compose_analysis(inputs, args.quarter, args.previous)
        print(
            f"[run_analysis] dry-run quarter={args.quarter}: "
            f"analysis_rows={len(result.analysis_rows)} policy_cards={len(result.policy_cards)}"
        )
        return 0

    counts = run_analysis(engine, args.quarter, args.previous)
    print(
        f"[run_analysis] quarter={args.quarter} previous={args.previous}: "
        f"analysis_rows={counts['analysis_rows']} policy_cards={counts['policy_cards']}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
