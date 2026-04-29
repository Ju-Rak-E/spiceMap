"""Module E — 정책 우선순위 점수 산출 (v1.0).

GRI(0.60) + 매출 규모(0.25) + 추세 가산(0.15) 가중 합 → percentile rank 0~100.
설계 근거: docs/module_e_design.md
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

PRIORITY_WEIGHTS: dict[str, float] = {
    "gri": 0.60,
    "sales_size": 0.25,
    "trend": 0.15,
}

PRIORITY_TOP_THRESHOLD = 80.0
TREND_PENALTY_SCALE = 200.0  # 50% 하락 → 100점 (clip 100)
TREND_PENALTY_MAX = 100.0

REQUIRED_GRI_COLUMNS: frozenset[str] = frozenset({"commerce_code", "quarter", "gri_score"})

OUTPUT_COLUMNS = [
    "commerce_code",
    "quarter",
    "priority_score",
    "gri_score",
    "sales_size_score",
    "trend_penalty",
    "is_top_priority",
]


def _percentile_rank(values: np.ndarray) -> np.ndarray:
    """0~100 percentile rank. 단일/빈 배열은 동일 길이 0 또는 50을 반환."""
    n = len(values)
    if n == 0:
        return values
    if n == 1:
        return np.array([50.0])
    return stats.rankdata(values, method="average") / n * 100.0


def _quarter_sales_lookup(sales_df: pd.DataFrame, quarter: str) -> dict[str, float]:
    """특정 분기 매출 합 (commerce_code → 합계)."""
    if sales_df.empty:
        return {}
    target = sales_df[sales_df["year_quarter"] == quarter]
    if target.empty:
        return {}
    grouped = target.groupby("trdar_cd", as_index=False)["sales_amount"].sum()
    return {row["trdar_cd"]: float(row["sales_amount"]) for _, row in grouped.iterrows()}


def _compute_sales_size_score(
    commerce_codes: list[str],
    target_lookup: dict[str, float],
) -> np.ndarray:
    """매출 절대값 → percentile rank. 매출 없는 상권은 0."""
    if not target_lookup:
        return np.zeros(len(commerce_codes))

    matched_codes = [c for c in commerce_codes if c in target_lookup]
    if not matched_codes:
        return np.zeros(len(commerce_codes))

    matched_amounts = np.array([target_lookup[c] for c in matched_codes])
    matched_ranks = _percentile_rank(matched_amounts)

    rank_map = dict(zip(matched_codes, matched_ranks))
    return np.array([rank_map.get(c, 0.0) for c in commerce_codes])


def _compute_trend_penalty(
    commerce_codes: list[str],
    target_lookup: dict[str, float],
    previous_lookup: dict[str, float],
) -> np.ndarray:
    """직전 대비 매출 하락률 × 200, [0, 100] clip."""
    if not previous_lookup:
        return np.zeros(len(commerce_codes))

    penalties = np.zeros(len(commerce_codes))
    for i, code in enumerate(commerce_codes):
        prev = previous_lookup.get(code)
        curr = target_lookup.get(code)
        if prev is None or curr is None:
            continue
        if not np.isfinite(prev) or prev <= 0:
            continue
        decline_rate = (prev - curr) / prev
        if decline_rate <= 0:
            continue
        penalties[i] = float(min(decline_rate * TREND_PENALTY_SCALE, TREND_PENALTY_MAX))
    return penalties


def compute_priority_scores(
    gri_df: pd.DataFrame,
    sales_df: pd.DataFrame,
    target_quarter: str,
    previous_quarter: str | None,
) -> pd.DataFrame:
    """상권별 정책 우선순위 점수(0~100)를 산출한다.

    Args:
        gri_df: Module B 출력 — 컬럼 [commerce_code, quarter, gri_score].
        sales_df: commerce_sales — 컬럼 [trdar_cd, year_quarter, sales_amount].
        target_quarter: 산출 대상 분기 (예: "2025Q4").
        previous_quarter: 추세 비교 분기. None 시 trend_penalty=0.

    Returns:
        OUTPUT_COLUMNS 스키마 DataFrame. 입력 비파괴.

    Raises:
        ValueError: gri_df 필수 컬럼 누락.
    """
    missing = REQUIRED_GRI_COLUMNS - set(gri_df.columns)
    if missing:
        raise ValueError(f"compute_priority_scores: 필수 컬럼 누락 {sorted(missing)}")

    if gri_df.empty:
        return pd.DataFrame({col: pd.Series(dtype=_dtype_for(col)) for col in OUTPUT_COLUMNS})

    base = gri_df.copy()
    commerce_codes = base["commerce_code"].astype(str).tolist()

    target_lookup = _quarter_sales_lookup(sales_df, target_quarter) if not sales_df.empty else {}
    previous_lookup = (
        _quarter_sales_lookup(sales_df, previous_quarter)
        if previous_quarter and not sales_df.empty
        else {}
    )

    sales_size_score = _compute_sales_size_score(commerce_codes, target_lookup)
    trend_penalty = _compute_trend_penalty(commerce_codes, target_lookup, previous_lookup)

    gri_arr = base["gri_score"].to_numpy(dtype=float)
    priority_raw = (
        PRIORITY_WEIGHTS["gri"] * gri_arr
        + PRIORITY_WEIGHTS["sales_size"] * sales_size_score
        + PRIORITY_WEIGHTS["trend"] * trend_penalty
    )
    priority_score = _percentile_rank(priority_raw)

    return pd.DataFrame(
        {
            "commerce_code": commerce_codes,
            "quarter": target_quarter,
            "priority_score": priority_score,
            "gri_score": gri_arr,
            "sales_size_score": sales_size_score,
            "trend_penalty": trend_penalty,
            "is_top_priority": priority_score >= PRIORITY_TOP_THRESHOLD,
        }
    )


def _dtype_for(column: str) -> str:
    if column in ("commerce_code", "quarter"):
        return "object"
    if column == "is_top_priority":
        return "bool"
    return "float64"
