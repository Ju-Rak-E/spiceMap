from __future__ import annotations

import pandas as pd
import pytest

from backend.analysis.commerce_type import COMMERCE_TYPE_UNCLASSIFIED
from backend.pipeline.build_commerce_analysis import (
    build_analysis_frame,
    compute_closure_by_signgu,
    compute_inflow_summary,
    quarter_to_source_code,
)


def test_quarter_to_source_code():
    assert quarter_to_source_code("2025Q4") == "20254"
    assert quarter_to_source_code("2026Q1") == "20261"


def test_quarter_to_source_code_rejects_invalid_format():
    with pytest.raises(ValueError):
        quarter_to_source_code("20254")


def test_compute_closure_by_signgu_uses_weighted_rate():
    store_info = pd.DataFrame(
        [
            {"signgu_cd": "11680", "store_count": 100, "close_count": 5, "close_rate": 99},
            {"signgu_cd": "11680", "store_count": 300, "close_count": 15, "close_rate": 1},
        ]
    )

    out = compute_closure_by_signgu(store_info)

    assert out.iloc[0]["signgu_cd"] == "11680"
    assert out.iloc[0]["closure_rate"] == pytest.approx(5.0)


def test_compute_inflow_summary_returns_volume_and_dominant_origin():
    od_flows = pd.DataFrame(
        [
            {"origin_adm_cd": "A1", "dest_adm_cd": "B1", "trip_count": 100.0},
            {"origin_adm_cd": "A2", "dest_adm_cd": "B1", "trip_count": 300.0},
        ]
    )
    mapping = pd.DataFrame(
        [
            {"adm_cd": "A1", "comm_cd": "C1", "comm_area_ratio": 1.0},
            {"adm_cd": "A2", "comm_cd": "C2", "comm_area_ratio": 1.0},
            {"adm_cd": "B1", "comm_cd": "C3", "comm_area_ratio": 1.0},
        ]
    )

    out = compute_inflow_summary(od_flows, mapping)

    row = out[out["commerce_code"] == "C3"].iloc[0]
    assert row["flow_volume"] == 400
    assert row["dominant_origin"] == "A2"


def test_build_analysis_frame_marks_rows_without_flow_as_unclassified():
    commerce = pd.DataFrame(
        [
            {"comm_cd": "C1", "comm_nm": "one"},
            {"comm_cd": "C2", "comm_nm": "two"},
            {"comm_cd": "C3", "comm_nm": "three"},
        ]
    )
    mapping = pd.DataFrame(
        [
            {"adm_cd": "1168010100", "comm_cd": "C1", "comm_area_ratio": 1.0},
            {"adm_cd": "1168010200", "comm_cd": "C2", "comm_area_ratio": 1.0},
            {"adm_cd": "1168010300", "comm_cd": "C3", "comm_area_ratio": 1.0},
        ]
    )
    od_flows = pd.DataFrame(
        [
            {"origin_adm_cd": "1168010100", "dest_adm_cd": "1168010200", "trip_count": 1000.0},
            {"origin_adm_cd": "1168010200", "dest_adm_cd": "1168010100", "trip_count": 100.0},
        ]
    )
    store_info = pd.DataFrame(
        [
            {"signgu_cd": "11680", "store_count": 100, "close_count": 5, "close_rate": 5.0},
        ]
    )

    out = build_analysis_frame(
        quarter="2025Q4",
        commerce=commerce,
        od_flows=od_flows,
        mapping=mapping,
        store_info=store_info,
        gu_prefixes=["11680"],
    )

    assert set(out["comm_cd"]) == {"C1", "C2", "C3"}
    assert out[out["comm_cd"] == "C3"].iloc[0]["commerce_type"] == COMMERCE_TYPE_UNCLASSIFIED
    assert out[out["comm_cd"] == "C3"].iloc[0]["analysis_note"] == "no_flow_metrics"
    assert out[out["comm_cd"] == "C1"].iloc[0]["gri_score"] is not None
