"""Module C — 시계열 OD 흐름 단절(barriers) 탐지 테스트.

설계: docs/strategy_d13.md (Module C 풀 구현 대체안 = 시계열 갭 알고리즘).
입력: 2분기 OD (Q3 baseline, Q4 target) + adm_comm_mapping
출력: 동일 OD 페어의 volume 감소율(≥ threshold) Top-N → flow_barriers 행
"""
from __future__ import annotations

import pandas as pd
import pytest

from backend.analysis.module_c_barriers import (
    BARRIER_OUTPUT_COLUMNS,
    DEFAULT_DECLINE_THRESHOLD,
    compute_flow_gaps,
    map_admin_pairs_to_commerce,
)


@pytest.fixture
def mapping() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"adm_cd": "A1", "comm_cd": "C1", "comm_area_ratio": 1.0},
            {"adm_cd": "A2", "comm_cd": "C2", "comm_area_ratio": 1.0},
            {"adm_cd": "A3", "comm_cd": "C3", "comm_area_ratio": 1.0},
            {"adm_cd": "A4", "comm_cd": "C4", "comm_area_ratio": 1.0},
        ]
    )


@pytest.fixture
def od_q3() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"origin_adm_cd": "A1", "dest_adm_cd": "A2", "trip_count": 10000.0},
            {"origin_adm_cd": "A2", "dest_adm_cd": "A3", "trip_count": 5000.0},
            {"origin_adm_cd": "A3", "dest_adm_cd": "A4", "trip_count": 200.0},
            {"origin_adm_cd": "A1", "dest_adm_cd": "A4", "trip_count": 100.0},
        ]
    )


@pytest.fixture
def od_q4() -> pd.DataFrame:
    """Q3 대비:
    A1→A2: 10000 → 1000 (-90%)  강한 단절
    A2→A3: 5000 → 4500 (-10%)   미약
    A3→A4: 200  → 50   (-75%)   강한 단절 (작은 절대량)
    A1→A4: 100  → 100  (0%)     변화 없음
    """
    return pd.DataFrame(
        [
            {"origin_adm_cd": "A1", "dest_adm_cd": "A2", "trip_count": 1000.0},
            {"origin_adm_cd": "A2", "dest_adm_cd": "A3", "trip_count": 4500.0},
            {"origin_adm_cd": "A3", "dest_adm_cd": "A4", "trip_count": 50.0},
            {"origin_adm_cd": "A1", "dest_adm_cd": "A4", "trip_count": 100.0},
        ]
    )


class TestMapAdminPairsToCommerce:
    def test_translates_adm_pair_to_comm_pair(self, mapping):
        adm = pd.DataFrame(
            [{"origin_adm_cd": "A1", "dest_adm_cd": "A2", "trip_count": 100.0}]
        )
        out = map_admin_pairs_to_commerce(adm, mapping)
        assert list(out.columns) == ["from_comm_cd", "to_comm_cd", "trip_count"]
        assert out.iloc[0]["from_comm_cd"] == "C1"
        assert out.iloc[0]["to_comm_cd"] == "C2"

    def test_drops_self_loops(self, mapping):
        adm = pd.DataFrame(
            [{"origin_adm_cd": "A1", "dest_adm_cd": "A1", "trip_count": 999.0}]
        )
        out = map_admin_pairs_to_commerce(adm, mapping)
        assert out.empty

    def test_drops_unmapped(self, mapping):
        adm = pd.DataFrame(
            [{"origin_adm_cd": "A1", "dest_adm_cd": "AX", "trip_count": 100.0}]
        )
        out = map_admin_pairs_to_commerce(adm, mapping)
        assert out.empty

    def test_aggregates_when_split_mapping(self):
        split = pd.DataFrame(
            [
                {"adm_cd": "A1", "comm_cd": "C1", "comm_area_ratio": 0.6},
                {"adm_cd": "A1", "comm_cd": "C2", "comm_area_ratio": 0.4},
                {"adm_cd": "A2", "comm_cd": "C3", "comm_area_ratio": 1.0},
            ]
        )
        adm = pd.DataFrame(
            [{"origin_adm_cd": "A1", "dest_adm_cd": "A2", "trip_count": 1000.0}]
        )
        out = map_admin_pairs_to_commerce(adm, split)
        assert len(out) == 2
        # 비율로 분배: C1→C3: 600, C2→C3: 400
        c1 = out[out["from_comm_cd"] == "C1"].iloc[0]
        assert c1["trip_count"] == pytest.approx(600.0)


class TestComputeFlowGaps:
    def test_output_schema(self, od_q3, od_q4, mapping):
        result = compute_flow_gaps(od_q3, od_q4, mapping)
        assert set(BARRIER_OUTPUT_COLUMNS).issubset(result.columns)

    def test_strong_decline_caught(self, od_q3, od_q4, mapping):
        result = compute_flow_gaps(od_q3, od_q4, mapping)
        c1c2 = result[(result["from_comm_cd"] == "C1") & (result["to_comm_cd"] == "C2")]
        assert len(c1c2) == 1
        assert c1c2.iloc[0]["decline_rate"] == pytest.approx(0.9, rel=1e-3)

    def test_weak_decline_filtered_out(self, od_q3, od_q4, mapping):
        result = compute_flow_gaps(od_q3, od_q4, mapping)
        # A2→A3 (-10%)는 threshold 0.5 미만 → 제외
        excluded = result[(result["from_comm_cd"] == "C2") & (result["to_comm_cd"] == "C3")]
        assert excluded.empty

    def test_no_change_filtered_out(self, od_q3, od_q4, mapping):
        result = compute_flow_gaps(od_q3, od_q4, mapping)
        # A1→A4 (0%) 제외
        excluded = result[(result["from_comm_cd"] == "C1") & (result["to_comm_cd"] == "C4")]
        assert excluded.empty

    def test_threshold_parameter_lowers_filter(self, od_q3, od_q4, mapping):
        result = compute_flow_gaps(od_q3, od_q4, mapping, threshold=0.05)
        # 더 낮은 threshold → A2→A3 (-10%)도 포함
        included = result[(result["from_comm_cd"] == "C2") & (result["to_comm_cd"] == "C3")]
        assert len(included) == 1

    def test_top_n_caps_results(self, od_q3, od_q4, mapping):
        # 강한 단절 2건 (A1→A2, A3→A4) — top_n=1로 1건만
        result = compute_flow_gaps(od_q3, od_q4, mapping, threshold=0.5, top_n=1)
        assert len(result) == 1
        # 상위 = volume 절대 감소가 가장 큰 것 (A1→A2: 10000→1000, 9000 감소)
        assert result.iloc[0]["from_comm_cd"] == "C1"

    def test_barrier_score_in_0_1_range(self, od_q3, od_q4, mapping):
        result = compute_flow_gaps(od_q3, od_q4, mapping)
        assert (result["barrier_score"] >= 0).all()
        assert (result["barrier_score"] <= 1).all()

    def test_barrier_type_constant(self, od_q3, od_q4, mapping):
        result = compute_flow_gaps(od_q3, od_q4, mapping)
        for v in result["barrier_type"]:
            assert v == "시계열_갭"

    def test_q4_only_pair_not_included(self, mapping):
        """Q3에 없고 Q4에만 있는 페어는 단절이 아닌 신규 흐름 — 제외."""
        q3 = pd.DataFrame(columns=["origin_adm_cd", "dest_adm_cd", "trip_count"])
        q4 = pd.DataFrame(
            [{"origin_adm_cd": "A1", "dest_adm_cd": "A2", "trip_count": 5000.0}]
        )
        result = compute_flow_gaps(q3, q4, mapping)
        assert result.empty

    def test_q3_only_pair_full_decline(self, mapping):
        """Q3엔 있고 Q4엔 없는 페어 = 100% 단절."""
        q3 = pd.DataFrame(
            [{"origin_adm_cd": "A1", "dest_adm_cd": "A2", "trip_count": 5000.0}]
        )
        q4 = pd.DataFrame(columns=["origin_adm_cd", "dest_adm_cd", "trip_count"])
        result = compute_flow_gaps(q3, q4, mapping)
        assert len(result) == 1
        assert result.iloc[0]["decline_rate"] == pytest.approx(1.0)

    def test_zero_q3_volume_excluded(self, mapping):
        """Q3 volume=0이면 단절 비율 정의 불가 — 제외."""
        q3 = pd.DataFrame(
            [{"origin_adm_cd": "A1", "dest_adm_cd": "A2", "trip_count": 0.0}]
        )
        q4 = pd.DataFrame(
            [{"origin_adm_cd": "A1", "dest_adm_cd": "A2", "trip_count": 0.0}]
        )
        result = compute_flow_gaps(q3, q4, mapping)
        assert result.empty

    def test_empty_inputs(self, mapping):
        empty = pd.DataFrame(columns=["origin_adm_cd", "dest_adm_cd", "trip_count"])
        result = compute_flow_gaps(empty, empty, mapping)
        assert result.empty
        assert set(BARRIER_OUTPUT_COLUMNS).issubset(result.columns)

    def test_inputs_not_mutated(self, od_q3, od_q4, mapping):
        q3_before = od_q3.copy()
        q4_before = od_q4.copy()
        m_before = mapping.copy()
        _ = compute_flow_gaps(od_q3, od_q4, mapping)
        pd.testing.assert_frame_equal(od_q3, q3_before)
        pd.testing.assert_frame_equal(od_q4, q4_before)
        pd.testing.assert_frame_equal(mapping, m_before)

    def test_default_threshold_constant(self):
        assert 0 < DEFAULT_DECLINE_THRESHOLD < 1
