"""Module A — 상권 흐름 유향 그래프 테스트."""
from __future__ import annotations

import networkx as nx
import pandas as pd
import pytest

from backend.analysis.module_a_graph import (
    build_commerce_flow_graph,
    compute_degree_metrics,
)


class TestBuildGraph:
    def test_returns_directed_graph(self, dummy_od_flows, dummy_mapping):
        g = build_commerce_flow_graph(dummy_od_flows, dummy_mapping)
        assert isinstance(g, nx.DiGraph)

    def test_excludes_self_loops(self, dummy_od_flows, dummy_mapping):
        """같은 상권 내부 이동(자기 루프)은 엣지로 생성되지 않아야 한다."""
        g = build_commerce_flow_graph(dummy_od_flows, dummy_mapping)
        for u, v in g.edges():
            assert u != v, f"self-loop found: {u} -> {v}"

    def test_edge_weight_sums_area_weighted(self, dummy_od_flows, dummy_mapping_split):
        """행정동이 여러 상권에 분할 매핑되면 comm_area_ratio에 비례해 배분된다.

        1168010100 (0.6 C-GN-A + 0.4 C-GN-B) -> 1168010200 (1.0 C-GN-B)
        trip_count=1000 fixture의 엣지는 삭제되고, 남은 9999 자기루프도 배분 후 (같은 상권쌍 비대상).
        여기서는 dummy_od_flows에 의존하지 않는 별도 데이터로 검증.
        """
        od = pd.DataFrame(
            [{"origin_adm_cd": "1168010100", "dest_adm_cd": "1168010200", "trip_count": 1000.0}]
        )
        g = build_commerce_flow_graph(od, dummy_mapping_split)
        # 1168010100은 0.6이 C-GN-A, 0.4가 C-GN-B
        # 1168010200은 전부 C-GN-B
        # 결과 엣지:
        #   C-GN-A -> C-GN-B : 0.6 * 1.0 * 1000 = 600
        #   C-GN-B -> C-GN-B : 0.4 * 1.0 * 1000 = 400 → 자기 루프 제외
        assert g.has_edge("C-GN-A", "C-GN-B")
        assert g["C-GN-A"]["C-GN-B"]["weight"] == pytest.approx(600.0)
        assert not g.has_edge("C-GN-B", "C-GN-B")

    def test_empty_input_returns_empty_graph(self, dummy_mapping):
        empty = pd.DataFrame(columns=["origin_adm_cd", "dest_adm_cd", "trip_count"])
        g = build_commerce_flow_graph(empty, dummy_mapping)
        assert g.number_of_nodes() == 0
        assert g.number_of_edges() == 0

    def test_unmapped_admin_codes_are_dropped(self, dummy_mapping):
        """매핑에 없는 행정동 코드는 조용히 버려진다."""
        od = pd.DataFrame(
            [{"origin_adm_cd": "UNKNOWN", "dest_adm_cd": "1168010200", "trip_count": 100}]
        )
        g = build_commerce_flow_graph(od, dummy_mapping)
        assert g.number_of_edges() == 0


class TestComputeDegreeMetrics:
    def test_output_columns(self, dummy_od_flows, dummy_mapping):
        g = build_commerce_flow_graph(dummy_od_flows, dummy_mapping)
        df = compute_degree_metrics(g)
        expected = {"commerce_code", "in_degree", "out_degree", "net_flow", "degree_centrality"}
        assert expected.issubset(df.columns)

    def test_net_flow_equals_in_minus_out(self, dummy_od_flows, dummy_mapping):
        g = build_commerce_flow_graph(dummy_od_flows, dummy_mapping)
        df = compute_degree_metrics(g)
        for _, row in df.iterrows():
            assert row["net_flow"] == pytest.approx(row["in_degree"] - row["out_degree"])

    def test_degree_centrality_in_range(self, dummy_od_flows, dummy_mapping):
        g = build_commerce_flow_graph(dummy_od_flows, dummy_mapping)
        df = compute_degree_metrics(g)
        assert (df["degree_centrality"] >= 0.0).all()
        assert (df["degree_centrality"] <= 1.0).all()

    def test_empty_graph_returns_empty_df(self):
        g = nx.DiGraph()
        df = compute_degree_metrics(g)
        assert df.empty
        assert set(df.columns) == {
            "commerce_code", "in_degree", "out_degree", "net_flow", "degree_centrality",
        }

    def test_isolated_commerce_has_zero_metrics(self, dummy_mapping):
        """노드는 있지만 엣지가 없는 상권은 모든 degree 지표가 0."""
        g = nx.DiGraph()
        g.add_node("C-GN-A")
        df = compute_degree_metrics(g)
        row = df.iloc[0]
        assert row["in_degree"] == 0
        assert row["out_degree"] == 0
        assert row["net_flow"] == 0
