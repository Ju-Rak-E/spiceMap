"""H1 가설 검증 — 순유입 vs 매출 Pearson 상관.

가설 H1 (FR_Role_Workflow.md §3.5):
  순유입↑ → 매출↑
KPI:
  pearson_r ≥ 0.5 AND p_value < 0.05 → passes_threshold=True
"""
from __future__ import annotations

from typing import TypedDict

import pandas as pd
from scipy import stats

H1_MIN_R = 0.5
H1_MAX_P = 0.05
H1_MIN_SAMPLES = 3


class H1Result(TypedDict):
    pearson_r: float
    p_value: float
    n: int
    passes_threshold: bool


def compute_h1_correlation(
    analysis_df: pd.DataFrame,
    sales_df: pd.DataFrame,
) -> H1Result:
    """Module A `net_flow`와 상권 매출의 Pearson 상관을 계산한다.

    Args:
        analysis_df: columns = [commerce_code, net_flow]
        sales_df: columns = [trdar_cd, sales_amount]
          (같은 상권이 여러 업종 행으로 쪼개진 경우 상권 합산 후 매칭)

    Returns:
        H1Result: pearson_r, p_value, n(매칭 쌍 수), passes_threshold.

    Raises:
        ValueError: 매칭 쌍이 H1_MIN_SAMPLES 미만일 때.
    """
    # 상권 코드 기준 매출 합산 (업종 레벨 → 상권 레벨)
    sales_agg = (
        sales_df.groupby("trdar_cd", as_index=False)["sales_amount"]
        .sum()
        .rename(columns={"trdar_cd": "commerce_code"})
    )

    merged = analysis_df.merge(sales_agg, on="commerce_code", how="inner")

    if len(merged) < H1_MIN_SAMPLES:
        raise ValueError(
            f"Pearson 상관 산출에 최소 3쌍이 필요합니다. 매칭 쌍: {len(merged)}"
        )

    r, p = stats.pearsonr(merged["net_flow"], merged["sales_amount"])

    return H1Result(
        pearson_r=float(r),
        p_value=float(p),
        n=int(len(merged)),
        passes_threshold=bool(r >= H1_MIN_R and p < H1_MAX_P),
    )
