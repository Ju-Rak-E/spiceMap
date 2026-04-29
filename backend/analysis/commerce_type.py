"""상권 유형 근사 분류기 (v1.0).

임대료·프랜차이즈 데이터 미확보 상태에서 `net_flow`, `gri_score`,
`degree_centrality`, `closure_rate` 4개 지표로 5종 유형을 분류한다.

설계 근거: docs/module_d_design.md §상권 유형 근사 분류
"""
from __future__ import annotations

import numpy as np
import pandas as pd

COMMERCE_TYPE_UNCLASSIFIED = "unclassified"

REQUIRED_COLUMNS = {
    "commerce_code",
    "net_flow",
    "gri_score",
    "degree_centrality",
    "closure_rate",
}

# 경계값 상수 (숫자 매직 방지)
# v1.1 (2026-04-30): 강남·관악 1,650 commerces 분포 분석 결과 임계 재조정.
#   - 평균 GRI 50.03, std 28.88 (분포 mid-spread 폭 큼)
#   - 자치구 단위 closure_rate 평균: 강남 1.798%, 관악 0.000% (5%는 비현실적)
#   v1.0 임계로는 unclassified 54.7% (902/1650) 발생. v1.1로 조정.
HOT_GRI_MIN = 50.0          # 흡수형_과열: GRI ≥ 50 (60 → 50, R5 정상 발동)
GROWTH_GRI_MAX = 40.0       # 흡수형_성장: GRI < 40 (유지)
DECAY_CLOSURE_MIN = 1.5     # 방출형_침체: 폐업률 ≥ 1.5% (5 → 1.5, 자치구 평균 reflect)
STABLE_GRI_MAX = 50.0       # 안정형: GRI < 50 (40 → 50, 분포 median reflect)


def _percentile(series: pd.Series, q: float) -> float:
    """NaN 제거 후 percentile. 빈 시리즈는 0."""
    arr = series.dropna().to_numpy(dtype=float)
    if len(arr) == 0:
        return 0.0
    return float(np.quantile(arr, q))


def classify_commerce_types(df: pd.DataFrame) -> pd.DataFrame:
    """각 상권에 `commerce_type` 컬럼을 부여한다.

    Returns:
        입력 DataFrame을 복사한 뒤 `commerce_type` 컬럼이 추가된 것.
    """
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"classify_commerce_types: 필수 컬럼 누락 {sorted(missing)}")

    result = df.copy()

    if len(result) == 0:
        result["commerce_type"] = pd.Series(dtype="object")
        return result

    if len(result) == 1:
        # percentile 계산 불가 → unclassified
        result["commerce_type"] = COMMERCE_TYPE_UNCLASSIFIED
        return result

    p25_flow = _percentile(result["net_flow"], 0.25)
    p75_flow = _percentile(result["net_flow"], 0.75)
    p25_centrality = _percentile(result["degree_centrality"], 0.25)

    abs_flow = result["net_flow"].abs()
    p25_abs = _percentile(abs_flow, 0.25)
    p75_abs = _percentile(abs_flow, 0.75)

    def classify_row(row: pd.Series) -> str:
        net_flow = row["net_flow"]
        gri = row["gri_score"]
        centrality = row["degree_centrality"]
        closure = row["closure_rate"]

        # 흡수형 (순유입 상위)
        # 순유입이 P75 이상이지만 GRI가 40~60 구간이면 v1.0에서는 흡수형 어느 쪽에도
        # 속하지 않는다. 임대료·프랜차이즈 데이터 확보 후 v1.1에서 "흡수형_초기" 도입 검토.
        if net_flow >= p75_flow:
            if gri >= HOT_GRI_MIN:
                return "흡수형_과열"
            if gri < GROWTH_GRI_MAX:
                return "흡수형_성장"

        # 방출형_침체 (순유출 하위 + 폐업률 높음)
        if net_flow <= p25_flow and closure >= DECAY_CLOSURE_MIN:
            return "방출형_침체"

        # 고립형_단절 (연결도 낮음 + 순유동 작음)
        if centrality <= p25_centrality and abs(net_flow) <= p25_abs:
            return "고립형_단절"

        # 안정형 (중간 flow + 저GRI)
        if p25_abs < abs(net_flow) < p75_abs and gri < STABLE_GRI_MAX:
            return "안정형"

        return COMMERCE_TYPE_UNCLASSIFIED

    result["commerce_type"] = result.apply(classify_row, axis=1)
    return result
