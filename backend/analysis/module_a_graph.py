"""Module A — 상권 흐름 유향 그래프.

OD 행정동 이동량을 상권 단위로 집계하여 NetworkX DiGraph로 구성하고,
각 상권의 in/out/net_flow/degree_centrality 지표를 산출한다.

설계 근거: docs/module_a_design.md
"""
from __future__ import annotations

import re
from typing import Iterable

import networkx as nx
import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Engine

DEGREE_COLUMNS = ["commerce_code", "in_degree", "out_degree", "net_flow", "degree_centrality"]

MODULE_A_INPUT_COLUMNS = ["origin_adm_cd", "dest_adm_cd", "trip_count"]

_YEAR_QUARTER_RE = re.compile(r"^\d{4}Q[1-4]$")


def _validate_year_quarter(value: str) -> None:
    if not _YEAR_QUARTER_RE.fullmatch(value):
        raise ValueError(f"잘못된 year_quarter 포맷: {value!r} (예: '2026Q1')")


def load_quarterly_od_flows(
    engine: Engine,
    year_quarter: str,
    move_purposes: Iterable[int] | None = None,
) -> pd.DataFrame:
    """od_flows_aggregated에서 한 분기를 Module A 입력 스키마로 로드한다.

    Module A는 `[origin_adm_cd, dest_adm_cd, trip_count]` 3컬럼만 사용하므로
    move_purpose는 합산 후 trip_count로 리네임한다.

    Args:
        engine: SQLAlchemy Engine (PostgreSQL/SQLite 모두 가능).
        year_quarter: 대상 분기 (예: "2026Q1").
        move_purposes: 필터할 목적 코드 목록. None이면 전부.

    Returns:
        MODULE_A_INPUT_COLUMNS 스키마 DataFrame. 결과 없으면 빈 DF.

    Raises:
        ValueError: year_quarter 포맷이 YYYYQ# 패턴과 불일치할 때.
    """
    _validate_year_quarter(year_quarter)
    params: dict = {"yq": year_quarter}
    where = ["year_quarter = :yq"]

    if move_purposes is not None:
        purpose_list = list(move_purposes)
        if not purpose_list:
            return pd.DataFrame(columns=MODULE_A_INPUT_COLUMNS)
        placeholders = ", ".join(f":p{i}" for i in range(len(purpose_list)))
        where.append(f"move_purpose IN ({placeholders})")
        for i, p in enumerate(purpose_list):
            params[f"p{i}"] = p

    sql = text(
        f"""
        SELECT origin_adm_cd, dest_adm_cd, SUM(trip_count_sum) AS trip_count
        FROM od_flows_aggregated
        WHERE {' AND '.join(where)}
        GROUP BY origin_adm_cd, dest_adm_cd
        """
    )

    df = pd.read_sql(sql, engine, params=params)
    if df.empty:
        return pd.DataFrame(columns=MODULE_A_INPUT_COLUMNS)
    return df[MODULE_A_INPUT_COLUMNS]


def build_commerce_flow_graph(
    od_flows: pd.DataFrame,
    mapping: pd.DataFrame,
) -> nx.DiGraph:
    """행정동 OD 이동량을 상권 유향 그래프로 변환한다.

    Args:
        od_flows: columns = [origin_adm_cd, dest_adm_cd, trip_count]
        mapping: columns = [adm_cd, comm_cd, comm_area_ratio]

    Returns:
        상권 코드를 노드로 하는 DiGraph. 엣지 속성 "weight"는 배분된 이동량.
        매핑에 없는 행정동, 상권 내부 자기 루프는 제외된다.
    """
    if od_flows.empty:
        return nx.DiGraph()

    # 행정동→상권 매핑을 origin/dest 양쪽에 적용 (comm_area_ratio 비례 배분)
    mapping_origin = mapping.rename(
        columns={"adm_cd": "origin_adm_cd", "comm_cd": "origin_comm", "comm_area_ratio": "origin_ratio"}
    )
    mapping_dest = mapping.rename(
        columns={"adm_cd": "dest_adm_cd", "comm_cd": "dest_comm", "comm_area_ratio": "dest_ratio"}
    )

    merged = od_flows.merge(mapping_origin, on="origin_adm_cd", how="inner")
    merged = merged.merge(mapping_dest, on="dest_adm_cd", how="inner")

    if merged.empty:
        return nx.DiGraph()

    merged = merged.assign(
        weighted_flow=merged["trip_count"] * merged["origin_ratio"] * merged["dest_ratio"]
    )

    # 자기 루프 제외
    merged = merged[merged["origin_comm"] != merged["dest_comm"]]

    agg = (
        merged.groupby(["origin_comm", "dest_comm"], as_index=False)["weighted_flow"]
        .sum()
    )

    g = nx.DiGraph()
    for _, row in agg.iterrows():
        g.add_edge(row["origin_comm"], row["dest_comm"], weight=float(row["weighted_flow"]))
    return g


def compute_degree_metrics(g: nx.DiGraph) -> pd.DataFrame:
    """유향 그래프에서 상권별 degree 계열 지표를 산출한다.

    Args:
        g: build_commerce_flow_graph가 반환한 DiGraph.

    Returns:
        DEGREE_COLUMNS 스키마의 DataFrame.
    """
    if g.number_of_nodes() == 0:
        return pd.DataFrame(columns=DEGREE_COLUMNS)

    in_deg = dict(g.in_degree(weight="weight"))
    out_deg = dict(g.out_degree(weight="weight"))
    # DiGraph의 nx.degree_centrality는 in+out 합을 정규화해 최대 2까지 나올 수 있으므로
    # 무방향 변환본으로 [0, 1] 범위의 연결도 지표를 계산한다.
    centrality = nx.degree_centrality(g.to_undirected(as_view=True))

    nodes = list(g.nodes())
    return pd.DataFrame(
        {
            "commerce_code": nodes,
            "in_degree": [float(in_deg.get(n, 0.0)) for n in nodes],
            "out_degree": [float(out_deg.get(n, 0.0)) for n in nodes],
            "net_flow": [float(in_deg.get(n, 0.0) - out_deg.get(n, 0.0)) for n in nodes],
            "degree_centrality": [float(centrality.get(n, 0.0)) for n in nodes],
        }
    )
