"""Module C — 시계열 OD 흐름 단절 탐지 (Module C 풀 구현 대체안).

원래 Module C는 정적 흐름 단절(공간/네트워크 기반)을 목표로 했으나, 데이터·시간
제약으로 **시계열 갭(temporal gap)** 알고리즘으로 대체한다.

원리:
  Q3 OD 페어 volume 대비 Q4 OD 페어 volume 감소율이 임계 이상이면
  "흐름 단절" 시그널로 간주하고 `flow_barriers` 테이블에 기록한다.

  decline_rate = (Q3 - Q4) / Q3
  barrier_score = clip(decline_rate, 0, 1)

설계 근거: docs/strategy_d13.md §2 핵심 의사결정 A
출력 스키마: backend/models.py:FlowBarrier (year_quarter, from_comm_cd, to_comm_cd,
            barrier_score, barrier_type)
"""
from __future__ import annotations

import pandas as pd

DEFAULT_DECLINE_THRESHOLD = 0.5
DEFAULT_TOP_N = 200
BARRIER_TYPE_TEMPORAL_GAP = "시계열_갭"
BARRIER_TYPE_NON_OD_SPATIAL = "비OD_공간단절"
DEFAULT_NON_OD_NEIGHBOR_K = 4
DEFAULT_NON_OD_MAX_DISTANCE_M = 1500.0

BARRIER_OUTPUT_COLUMNS = [
    "from_comm_cd",
    "to_comm_cd",
    "q3_volume",
    "q4_volume",
    "decline_rate",
    "barrier_score",
    "barrier_type",
]

NON_OD_BARRIER_OUTPUT_COLUMNS = [
    "from_comm_cd",
    "to_comm_cd",
    "distance_m",
    "source_risk_score",
    "target_risk_score",
    "avg_sales_decline",
    "barrier_score",
    "barrier_type",
]


def map_admin_pairs_to_commerce(
    od: pd.DataFrame,
    mapping: pd.DataFrame,
) -> pd.DataFrame:
    """행정동 OD 페어를 상권 OD 페어로 변환 (면적 비율 분배 + 자기 루프 제외).

    Args:
        od: columns = [origin_adm_cd, dest_adm_cd, trip_count]
        mapping: columns = [adm_cd, comm_cd, comm_area_ratio]

    Returns:
        columns = [from_comm_cd, to_comm_cd, trip_count]. 비어있을 수 있다.
    """
    if od.empty:
        return pd.DataFrame(columns=["from_comm_cd", "to_comm_cd", "trip_count"])

    origin_map = mapping.rename(
        columns={"adm_cd": "origin_adm_cd", "comm_cd": "from_comm_cd", "comm_area_ratio": "origin_ratio"}
    )
    dest_map = mapping.rename(
        columns={"adm_cd": "dest_adm_cd", "comm_cd": "to_comm_cd", "comm_area_ratio": "dest_ratio"}
    )

    merged = od.merge(origin_map, on="origin_adm_cd", how="inner")
    merged = merged.merge(dest_map, on="dest_adm_cd", how="inner")
    if merged.empty:
        return pd.DataFrame(columns=["from_comm_cd", "to_comm_cd", "trip_count"])

    merged = merged.assign(
        weighted=merged["trip_count"] * merged["origin_ratio"] * merged["dest_ratio"]
    )
    # 자기 루프 제외
    merged = merged[merged["from_comm_cd"] != merged["to_comm_cd"]]
    if merged.empty:
        return pd.DataFrame(columns=["from_comm_cd", "to_comm_cd", "trip_count"])

    out = (
        merged.groupby(["from_comm_cd", "to_comm_cd"], as_index=False)["weighted"]
        .sum()
        .rename(columns={"weighted": "trip_count"})
    )
    return out


def compute_flow_gaps(
    od_q3: pd.DataFrame,
    od_q4: pd.DataFrame,
    mapping: pd.DataFrame,
    threshold: float = DEFAULT_DECLINE_THRESHOLD,
    top_n: int = DEFAULT_TOP_N,
) -> pd.DataFrame:
    """Q3 → Q4 시계열 OD 페어 감소율 Top-N을 단절 후보로 산출한다.

    Args:
        od_q3: Module A 입력 스키마 (origin_adm_cd, dest_adm_cd, trip_count)
        od_q4: 동일 스키마. 비교 대상 분기.
        mapping: adm_cd → comm_cd 면적 비율 매핑.
        threshold: decline_rate 하한 (기본 0.5 = 50% 감소).
        top_n: 절대 감소량 기준 상위 N건.

    Returns:
        BARRIER_OUTPUT_COLUMNS 스키마 DataFrame. 입력 비파괴.
    """
    if not 0 < threshold <= 1:
        raise ValueError(f"threshold must be in (0, 1], got {threshold}")
    if top_n <= 0:
        raise ValueError(f"top_n must be positive, got {top_n}")

    empty = pd.DataFrame(columns=BARRIER_OUTPUT_COLUMNS)

    q3 = map_admin_pairs_to_commerce(od_q3, mapping).rename(columns={"trip_count": "q3_volume"})
    q4 = map_admin_pairs_to_commerce(od_q4, mapping).rename(columns={"trip_count": "q4_volume"})

    if q3.empty:
        # Q4 only pair는 단절이 아니라 신규 흐름이므로 제외
        return empty

    merged = q3.merge(q4, on=["from_comm_cd", "to_comm_cd"], how="left")
    merged["q4_volume"] = merged["q4_volume"].fillna(0.0)
    # Q3 volume 0인 페어 (분모 0) 제거
    merged = merged[merged["q3_volume"] > 0]
    if merged.empty:
        return empty

    merged = merged.assign(
        decline_rate=(merged["q3_volume"] - merged["q4_volume"]) / merged["q3_volume"],
        absolute_drop=merged["q3_volume"] - merged["q4_volume"],
    )
    merged = merged[merged["decline_rate"] >= threshold]
    if merged.empty:
        return empty

    merged = merged.sort_values("absolute_drop", ascending=False).head(top_n)

    result = pd.DataFrame({
        "from_comm_cd": merged["from_comm_cd"].astype(str).values,
        "to_comm_cd": merged["to_comm_cd"].astype(str).values,
        "q3_volume": merged["q3_volume"].astype(float).values,
        "q4_volume": merged["q4_volume"].astype(float).values,
        "decline_rate": merged["decline_rate"].astype(float).clip(0, 1).values,
        "barrier_score": merged["decline_rate"].astype(float).clip(0, 1).values,
        "barrier_type": BARRIER_TYPE_TEMPORAL_GAP,
    })
    return result.reset_index(drop=True)


def _empty_non_od_barriers() -> pd.DataFrame:
    return pd.DataFrame(columns=NON_OD_BARRIER_OUTPUT_COLUMNS)


def _clip_0_1(value: float) -> float:
    return float(min(max(value, 0.0), 1.0))


def _normalize_0_1(series: pd.Series) -> pd.Series:
    values = pd.to_numeric(series, errors="coerce")
    finite = values.dropna()
    if finite.empty:
        return pd.Series(0.0, index=series.index)
    min_value = float(finite.min())
    max_value = float(finite.max())
    if max_value <= min_value:
        return pd.Series(0.0, index=series.index)
    return ((values.fillna(min_value) - min_value) / (max_value - min_value)).clip(0.0, 1.0)


def compute_sales_decline_rates(
    sales: pd.DataFrame,
    target_quarter: str,
    previous_quarter: str | None,
) -> pd.DataFrame:
    """Compute per-commerce sales decline rates for non-OD barrier scoring.

    Missing previous-quarter or non-positive previous sales means the decline is
    undefined, so it is treated as 0. Missing current-quarter sales is treated
    as 0 only when previous sales exists.
    """
    columns = ["commerce_code", "sales_decline_rate"]
    if previous_quarter is None or sales.empty:
        return pd.DataFrame(columns=columns)

    working = sales.copy()
    required = {"trdar_cd", "year_quarter", "sales_amount"}
    missing = required - set(working.columns)
    if missing:
        raise ValueError(f"compute_sales_decline_rates: missing columns {sorted(missing)}")

    working["sales_amount"] = pd.to_numeric(working["sales_amount"], errors="coerce").fillna(0.0)
    grouped = (
        working.groupby(["trdar_cd", "year_quarter"], as_index=False)["sales_amount"]
        .sum()
    )
    current = (
        grouped[grouped["year_quarter"] == target_quarter]
        .rename(columns={"trdar_cd": "commerce_code", "sales_amount": "current_sales"})
        [["commerce_code", "current_sales"]]
    )
    previous = (
        grouped[grouped["year_quarter"] == previous_quarter]
        .rename(columns={"trdar_cd": "commerce_code", "sales_amount": "previous_sales"})
        [["commerce_code", "previous_sales"]]
    )
    if previous.empty:
        return pd.DataFrame(columns=columns)

    merged = previous.merge(current, on="commerce_code", how="left")
    merged["current_sales"] = merged["current_sales"].fillna(0.0)
    merged["sales_decline_rate"] = 0.0
    mask = merged["previous_sales"] > 0
    merged.loc[mask, "sales_decline_rate"] = (
        (merged.loc[mask, "previous_sales"] - merged.loc[mask, "current_sales"])
        / merged.loc[mask, "previous_sales"]
    ).clip(0.0, 1.0)
    return merged[columns]


def compute_non_od_barriers(
    commerce_analysis: pd.DataFrame,
    commerce_sales: pd.DataFrame,
    candidate_pairs: pd.DataFrame,
    *,
    target_quarter: str,
    previous_quarter: str | None,
    max_distance_m: float = DEFAULT_NON_OD_MAX_DISTANCE_M,
    top_n: int = DEFAULT_TOP_N,
) -> pd.DataFrame:
    """Build non-OD barrier candidates from risk, sales decline, and proximity.

    Candidate pairs must contain `comm_a_cd`, `comm_b_cd`, and `distance_m`.
    The output direction is stable -> risky.
    """
    if max_distance_m <= 0:
        raise ValueError(f"max_distance_m must be positive, got {max_distance_m}")
    if top_n <= 0:
        raise ValueError(f"top_n must be positive, got {top_n}")

    if commerce_analysis.empty or candidate_pairs.empty:
        return _empty_non_od_barriers()

    required_analysis = {"comm_cd", "gri_score", "closure_rate"}
    missing_analysis = required_analysis - set(commerce_analysis.columns)
    if missing_analysis:
        raise ValueError(f"compute_non_od_barriers: missing analysis columns {sorted(missing_analysis)}")
    required_pairs = {"comm_a_cd", "comm_b_cd", "distance_m"}
    missing_pairs = required_pairs - set(candidate_pairs.columns)
    if missing_pairs:
        raise ValueError(f"compute_non_od_barriers: missing pair columns {sorted(missing_pairs)}")

    analysis = commerce_analysis.copy()
    analysis["commerce_code"] = analysis["comm_cd"].astype(str)
    analysis["gri_norm"] = (pd.to_numeric(analysis["gri_score"], errors="coerce").fillna(0.0) / 100.0).clip(0.0, 1.0)
    analysis["closure_norm"] = _normalize_0_1(analysis["closure_rate"])

    declines = compute_sales_decline_rates(commerce_sales, target_quarter, previous_quarter)
    analysis = analysis.merge(declines, on="commerce_code", how="left")
    analysis["sales_decline_rate"] = pd.to_numeric(
        analysis["sales_decline_rate"], errors="coerce"
    ).fillna(0.0).clip(0.0, 1.0)
    analysis["risk_score"] = (
        0.70 * analysis["gri_norm"]
        + 0.20 * analysis["sales_decline_rate"]
        + 0.10 * analysis["closure_norm"]
    ).clip(0.0, 1.0)

    metrics = analysis.set_index("commerce_code")[
        ["gri_norm", "sales_decline_rate", "risk_score"]
    ].to_dict(orient="index")

    rows: list[dict] = []
    pairs = candidate_pairs.copy()
    pairs["distance_m"] = pd.to_numeric(pairs["distance_m"], errors="coerce")
    pairs = pairs.dropna(subset=["distance_m"])
    pairs = pairs[pairs["distance_m"] <= max_distance_m]

    for _, pair in pairs.iterrows():
        comm_a = str(pair["comm_a_cd"])
        comm_b = str(pair["comm_b_cd"])
        if comm_a == comm_b or comm_a not in metrics or comm_b not in metrics:
            continue

        a = metrics[comm_a]
        b = metrics[comm_b]
        if a["risk_score"] <= b["risk_score"]:
            source_cd, target_cd = comm_a, comm_b
            source_risk, target_risk = a["risk_score"], b["risk_score"]
        else:
            source_cd, target_cd = comm_b, comm_a
            source_risk, target_risk = b["risk_score"], a["risk_score"]

        distance_m = float(pair["distance_m"])
        proximity_score = _clip_0_1(1.0 - distance_m / max_distance_m)
        avg_sales_decline = _clip_0_1((a["sales_decline_rate"] + b["sales_decline_rate"]) / 2.0)
        max_gri = _clip_0_1(max(a["gri_norm"], b["gri_norm"]))
        barrier_score = _clip_0_1(
            0.55 * max_gri
            + 0.25 * avg_sales_decline
            + 0.20 * proximity_score
        )

        rows.append(
            {
                "from_comm_cd": source_cd,
                "to_comm_cd": target_cd,
                "distance_m": distance_m,
                "source_risk_score": float(source_risk),
                "target_risk_score": float(target_risk),
                "avg_sales_decline": avg_sales_decline,
                "barrier_score": barrier_score,
                "barrier_type": BARRIER_TYPE_NON_OD_SPATIAL,
            }
        )

    if not rows:
        return _empty_non_od_barriers()

    out = pd.DataFrame(rows)
    out = out.sort_values(["barrier_score", "distance_m"], ascending=[False, True]).head(top_n)
    return out[NON_OD_BARRIER_OUTPUT_COLUMNS].reset_index(drop=True)
