"""Module B — GRI v1.0 산출.

폐업률, 순유출, 고립도를 z-score 정규화 후 가중 평균하고 percentile rank로 변환한다.

설계 근거: docs/gri_formula.md
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

GRI_WEIGHTS: dict[str, float] = {
    "closure": 0.40,    # 폐업률
    "outflow": 0.33,    # 순유출 (net_flow 부호 반전)
    "isolation": 0.27,  # 고립도 (degree_centrality 부호 반전)
}

REQUIRED_COLUMNS = {"commerce_code", "quarter", "closure_rate", "net_flow", "degree_centrality"}


_STD_EPSILON = 1e-9


def _safe_zscore(series: pd.Series) -> np.ndarray:
    """샘플이 1개이거나 분산이 0(부동소수 오차 포함)이면 0 벡터를 반환.

    NaN은 stats.zscore의 nan_policy="omit"에 위임한다.
    """
    arr = series.to_numpy(dtype=float)
    finite = arr[np.isfinite(arr)]
    if len(finite) <= 1:
        return np.zeros_like(arr)
    std = float(np.std(finite))
    if std < _STD_EPSILON:
        return np.zeros_like(arr)
    return stats.zscore(arr, nan_policy="omit")


def compute_gri(df: pd.DataFrame) -> pd.DataFrame:
    """GRI v1.0 산출 (4항목 재분배, 임대료 제외).

    Args:
        df: columns must include REQUIRED_COLUMNS.

    Returns:
        원본 + 4개 컬럼 (gri_score, risk_closure_z, risk_outflow_z, risk_isolate_z) 추가.
        원본 DataFrame은 변경되지 않는다.
    """
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"compute_gri: 필수 컬럼 누락 {sorted(missing)}")

    result = df.copy()

    # 방향성 통일 — 모두 "클수록 위험"
    risk_closure = result["closure_rate"]
    risk_outflow = -result["net_flow"]           # 순유출 클수록 위험
    risk_isolate = -result["degree_centrality"]  # 고립될수록 위험

    z_closure = _safe_zscore(risk_closure)
    z_outflow = _safe_zscore(risk_outflow)
    z_isolate = _safe_zscore(risk_isolate)

    gri_raw = (
        GRI_WEIGHTS["closure"]   * z_closure
        + GRI_WEIGHTS["outflow"] * z_outflow
        + GRI_WEIGHTS["isolation"] * z_isolate
    )

    # 0~100 percentile rank
    if len(gri_raw) == 1:
        gri_score = np.array([50.0])  # 단일 샘플은 중앙값
    else:
        gri_score = stats.rankdata(gri_raw, method="average") / len(gri_raw) * 100

    result["gri_score"] = gri_score
    result["risk_closure_z"] = z_closure
    result["risk_outflow_z"] = z_outflow
    result["risk_isolate_z"] = z_isolate
    return result
