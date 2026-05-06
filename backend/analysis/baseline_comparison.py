"""B3 베이스라인 비교 — 직전 추세 연장 vs Module E priority_score.

베이스라인 B3 (FR_Role_Workflow.md §3.5, docs/strategy_d13.md §2 결정 C):
  "Q3 → Q4 매출 단순 하락율을 위험 신호로 사용하는 모델"

KPI:
  - Jaccard 유사도: 두 모델이 식별한 위험 상권 TOP N% 의 교집합 비율
  - Spearman rank correlation: 두 점수의 순위 상관
  - 추가 식별 건수: Module E에는 있고 B3에 없는 위험 상권 수

OA-15576 상권변화지표 데이터(원래 B1)는 Seoul API service ID 확인 어려워
B3로 대체. 미래 v2에서 OA-15576 정적 CSV 다운로드 후 B1 비교 추가 가능.
"""
from __future__ import annotations

from typing import TypedDict

import numpy as np
import pandas as pd
from scipy import stats

DEFAULT_TOP_PCT = 0.20
B3_DECLINE_THRESHOLD = 0.0  # 하락율 0 이상이면 위험 후보


class B3Result(TypedDict):
    n_total: int
    n_top_b3: int
    n_top_priority: int
    n_intersect: int
    jaccard: float
    spearman_r: float
    spearman_p: float
    new_in_priority: int
    missed_in_b3: int


def compute_b3_baseline(
    sales_q3: pd.DataFrame,
    sales_q4: pd.DataFrame,
) -> pd.DataFrame:
    """B3 점수: Q3→Q4 매출 단순 하락율 (높을수록 위험).

    Args:
        sales_q3: columns = [trdar_cd, sales_amount] (Q3 분기 매출 합)
        sales_q4: columns = [trdar_cd, sales_amount] (Q4 분기 매출 합)

    Returns:
        columns = [commerce_code, b3_score]. b3_score = (Q3-Q4)/Q3, 0~1 clip.
        Q3 sales 0이거나 매칭 안 된 상권은 결과에서 제외.
    """
    q3 = (
        sales_q3.groupby("trdar_cd", as_index=False)["sales_amount"].sum()
        .rename(columns={"trdar_cd": "commerce_code", "sales_amount": "q3_sales"})
    )
    q4 = (
        sales_q4.groupby("trdar_cd", as_index=False)["sales_amount"].sum()
        .rename(columns={"trdar_cd": "commerce_code", "sales_amount": "q4_sales"})
    )
    merged = q3.merge(q4, on="commerce_code", how="inner")
    merged = merged[merged["q3_sales"] > 0]
    if merged.empty:
        return pd.DataFrame(columns=["commerce_code", "b3_score"])

    decline = (merged["q3_sales"] - merged["q4_sales"]) / merged["q3_sales"]
    # 0~1 clip (음수 = 매출 증가 = 위험 0)
    b3_score = decline.clip(lower=0.0, upper=1.0)
    return pd.DataFrame({
        "commerce_code": merged["commerce_code"].astype(str).values,
        "b3_score": b3_score.astype(float).values,
    })


def compare_priority_to_b3(
    priority_df: pd.DataFrame,
    b3_df: pd.DataFrame,
    top_pct: float = DEFAULT_TOP_PCT,
) -> B3Result:
    """Module E priority_score 와 B3 점수의 비교 KPI.

    Args:
        priority_df: columns = [commerce_code, priority_score] (Module E 결과)
        b3_df: compute_b3_baseline 결과 (columns = [commerce_code, b3_score])
        top_pct: 상위 N% (기본 0.20)

    Returns:
        B3Result.
    """
    if not 0 < top_pct < 1:
        raise ValueError(f"top_pct must be in (0, 1), got {top_pct}")

    merged = priority_df.merge(b3_df, on="commerce_code", how="inner")
    if "priority_score" in merged.columns and "b3_score" in merged.columns:
        merged = merged.dropna(subset=["priority_score", "b3_score"])
    n = len(merged)
    if n < 5:
        raise ValueError(f"비교에 최소 5쌍 필요. 매칭: {n}")

    p_thr = merged["priority_score"].quantile(1.0 - top_pct)
    b_thr = merged["b3_score"].quantile(1.0 - top_pct)

    top_priority = set(merged[merged["priority_score"] >= p_thr]["commerce_code"])
    top_b3 = set(merged[merged["b3_score"] >= b_thr]["commerce_code"])

    intersect = top_priority & top_b3
    union = top_priority | top_b3
    jaccard = len(intersect) / len(union) if union else 0.0

    rho, p = stats.spearmanr(merged["priority_score"], merged["b3_score"])

    return B3Result(
        n_total=int(n),
        n_top_b3=int(len(top_b3)),
        n_top_priority=int(len(top_priority)),
        n_intersect=int(len(intersect)),
        jaccard=float(jaccard),
        spearman_r=float(rho) if np.isfinite(rho) else 0.0,
        spearman_p=float(p) if np.isfinite(p) else 1.0,
        new_in_priority=int(len(top_priority - top_b3)),
        missed_in_b3=int(len(top_priority - top_b3)),  # alias for clarity
    )
