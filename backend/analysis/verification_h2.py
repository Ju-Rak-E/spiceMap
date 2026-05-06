"""H2 가설 검증 — 흐름 단절 강도 → 폐업률 상관.

가설 H2 (FR_Role_Workflow.md §3.5):
  flow_barriers 의 barrier_score 가 높은 상권(= Q3→Q4 OD 흐름이 강하게 단절된
  상권)은 동일 분기의 closure_rate 가 더 높다. 즉 "흐름 단절 → 폐업" 의 방향성
  일치도를 검증한다.

배경:
  Module C (`module_c_barriers.compute_flow_gaps`) 가 산출한 Q4 flow_barriers
  와 Module B 입력인 closure_rate (`store_info` 자치구 단위 → 상권 매핑) 사이
  인과 가설.

집계 정의:
  flow_barriers 는 (from_comm_cd, to_comm_cd) 페어 단위이므로 상권 단위 점수로
  변환해야 한다. 본 모듈에서는 상권을 endpoint(from 또는 to)로 갖는 모든 페어
  의 max(barrier_score) 를 상권의 barrier_intensity 로 정의한다 — 단절이 한
  페어라도 강하게 발생하면 해당 상권을 위험으로 본다.

KPI:
  - Pearson r: barrier_intensity vs closure_rate (선형 상관)
  - Spearman ρ: 순위 상관 (단조성)
  - 임계: r ≥ 0.3 + p < 0.05 양성이면 passes_threshold=True
"""
from __future__ import annotations

from typing import TypedDict

import numpy as np
import pandas as pd
from scipy import stats

H2_R_MIN = 0.3
H2_MIN_SAMPLES = 5


class H2Result(TypedDict):
    n_total: int
    pearson_r: float
    pearson_p: float
    spearman_r: float
    spearman_p: float
    passes_threshold: bool


def aggregate_barrier_intensity(barriers: pd.DataFrame) -> pd.DataFrame:
    """flow_barriers 를 상권 단위로 집계.

    각 상권을 endpoint (from 또는 to) 로 갖는 페어의 max(barrier_score) 를
    상권의 barrier_intensity 로 정의한다.

    Args:
        barriers: columns = [from_comm_cd, to_comm_cd, barrier_score]

    Returns:
        columns = [commerce_code, barrier_intensity]. 비어있을 수 있다.
    """
    if barriers.empty:
        return pd.DataFrame(columns=["commerce_code", "barrier_intensity"])

    from_side = barriers[["from_comm_cd", "barrier_score"]].rename(
        columns={"from_comm_cd": "commerce_code"}
    )
    to_side = barriers[["to_comm_cd", "barrier_score"]].rename(
        columns={"to_comm_cd": "commerce_code"}
    )
    stacked = pd.concat([from_side, to_side], ignore_index=True)
    stacked["commerce_code"] = stacked["commerce_code"].astype(str)
    out = (
        stacked.groupby("commerce_code", as_index=False)["barrier_score"]
        .max()
        .rename(columns={"barrier_score": "barrier_intensity"})
    )
    return out


def compute_h2_alignment(
    barriers: pd.DataFrame,
    closures: pd.DataFrame,
) -> H2Result:
    """barrier_intensity vs closure_rate 상관 분석.

    Args:
        barriers: columns = [from_comm_cd, to_comm_cd, barrier_score]
        closures: columns = [commerce_code, closure_rate]

    Returns:
        H2Result. 표본 부족 시 ValueError.

    Raises:
        ValueError: 매칭 쌍이 H2_MIN_SAMPLES 미만.
    """
    intensity = aggregate_barrier_intensity(barriers)
    closures_norm = closures.copy()
    closures_norm["commerce_code"] = closures_norm["commerce_code"].astype(str)

    merged = intensity.merge(closures_norm, on="commerce_code", how="inner")
    merged = merged.dropna(subset=["barrier_intensity", "closure_rate"])

    if len(merged) < H2_MIN_SAMPLES:
        raise ValueError(
            f"H2 검증에 최소 {H2_MIN_SAMPLES}쌍 필요. 매칭: {len(merged)}"
        )

    if merged["barrier_intensity"].nunique() < 2 or merged["closure_rate"].nunique() < 2:
        # 분산이 0이면 상관계수 정의 불가 → 0 반환
        return H2Result(
            n_total=int(len(merged)),
            pearson_r=0.0,
            pearson_p=1.0,
            spearman_r=0.0,
            spearman_p=1.0,
            passes_threshold=False,
        )

    pearson_r, pearson_p = stats.pearsonr(
        merged["barrier_intensity"], merged["closure_rate"]
    )
    spearman_r, spearman_p = stats.spearmanr(
        merged["barrier_intensity"], merged["closure_rate"]
    )

    passes = bool(
        np.isfinite(pearson_r)
        and pearson_r >= H2_R_MIN
        and np.isfinite(pearson_p)
        and pearson_p < 0.05
    )

    return H2Result(
        n_total=int(len(merged)),
        pearson_r=float(pearson_r) if np.isfinite(pearson_r) else 0.0,
        pearson_p=float(pearson_p) if np.isfinite(pearson_p) else 1.0,
        spearman_r=float(spearman_r) if np.isfinite(spearman_r) else 0.0,
        spearman_p=float(spearman_p) if np.isfinite(spearman_p) else 1.0,
        passes_threshold=passes,
    )
