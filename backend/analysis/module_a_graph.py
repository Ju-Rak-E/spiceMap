"""Module A — 상권 흐름 유향 그래프.

OD 행정동 이동량을 상권 단위로 집계하여 NetworkX DiGraph로 구성하고,
각 상권의 in/out/net_flow/degree_centrality 지표를 산출한다.

설계 근거: docs/module_a_design.md
"""
from __future__ import annotations

import networkx as nx
import pandas as pd

DEGREE_COLUMNS = ["commerce_code", "in_degree", "out_degree", "net_flow", "degree_centrality"]


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
