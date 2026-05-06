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

BARRIER_OUTPUT_COLUMNS = [
    "from_comm_cd",
    "to_comm_cd",
    "q3_volume",
    "q4_volume",
    "decline_rate",
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
