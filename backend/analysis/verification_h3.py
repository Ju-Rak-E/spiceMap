"""H3 가설 검증 — Q3 GRI 고위험 → Q4 폐업률 상승 일치도.

가설 H3 (FR_Role_Workflow.md §3.5):
  순유입↑ + (예상) 임대료↑ + 프랜차이즈↑ → 젠트리피케이션. 본 v1.0에서는
  실제 임대료/프랜차이즈 데이터 부재로 **GRI(Module B)**를 종합 위험 신호로
  대체하고, "Q3 GRI 상위 N% 상권의 Q4 폐업률이 하위 (1-N)% 대비 더 높다"는
  **방향성 일치도**를 검증한다.

KPI (docs/strategy_d13.md §8):
  Q3 GRI 상위 20%의 Q4 평균 closure_rate 가 하위 80% 대비 +2%p 이상이면
  passes_threshold=True.
"""
from __future__ import annotations

from typing import TypedDict

import numpy as np
import pandas as pd
from scipy import stats

H3_TOP_PCT = 0.20
H3_GAP_MIN_PP = 2.0
H3_MIN_SAMPLES = 5


class H3Result(TypedDict):
    n_total: int
    n_top: int
    n_bottom: int
    top_avg_closure: float
    bottom_avg_closure: float
    gap_pp: float
    t_stat: float
    p_value: float
    passes_threshold: bool


def compute_h3_alignment(
    q3_analysis: pd.DataFrame,
    q4_closure: pd.DataFrame,
    top_pct: float = H3_TOP_PCT,
) -> H3Result:
    """Q3 GRI 상위 그룹과 하위 그룹의 Q4 폐업률 격차를 계산한다.

    Args:
        q3_analysis: columns = [commerce_code, gri_score] (Q3 분석 결과).
        q4_closure: columns = [commerce_code, closure_rate] (Q4 폐업률).
        top_pct: 상위 N% (기본 0.20).

    Returns:
        H3Result. gap_pp(상위−하위 평균 차이, 단위 %p), Welch t-test 결과,
        FR-08 기준(≥ 2.0%p) 충족 여부.

    Raises:
        ValueError: 매칭 쌍이 H3_MIN_SAMPLES 미만이거나 top_pct 부적합.
    """
    if not 0 < top_pct < 1:
        raise ValueError(f"top_pct must be in (0, 1), got {top_pct}")

    merged = q3_analysis.merge(q4_closure, on="commerce_code", how="inner")
    merged = merged.dropna(subset=["gri_score", "closure_rate"])
    if len(merged) < H3_MIN_SAMPLES:
        raise ValueError(
            f"H3 검증에 최소 {H3_MIN_SAMPLES}쌍 필요. 매칭 쌍: {len(merged)}"
        )

    threshold = merged["gri_score"].quantile(1.0 - top_pct)
    top = merged[merged["gri_score"] >= threshold]
    bottom = merged[merged["gri_score"] < threshold]

    if len(top) < 2 or len(bottom) < 2:
        raise ValueError(
            f"H3 검증: 상위/하위 그룹 각각 ≥ 2 필요 — top={len(top)} bottom={len(bottom)}"
        )

    top_avg = float(top["closure_rate"].mean())
    bottom_avg = float(bottom["closure_rate"].mean())
    gap_pp = top_avg - bottom_avg

    # Welch's t-test (등분산 가정 X)
    t_stat, p_value = stats.ttest_ind(
        top["closure_rate"], bottom["closure_rate"], equal_var=False
    )

    return H3Result(
        n_total=int(len(merged)),
        n_top=int(len(top)),
        n_bottom=int(len(bottom)),
        top_avg_closure=top_avg,
        bottom_avg_closure=bottom_avg,
        gap_pp=float(gap_pp),
        t_stat=float(t_stat) if np.isfinite(t_stat) else 0.0,
        p_value=float(p_value) if np.isfinite(p_value) else 1.0,
        passes_threshold=bool(gap_pp >= H3_GAP_MIN_PP),
    )
