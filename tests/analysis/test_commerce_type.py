"""상권 유형 근사 분류기 테스트 (v1.0)."""
from __future__ import annotations

import pandas as pd
import pytest

from backend.analysis.commerce_type import (
    COMMERCE_TYPE_UNCLASSIFIED,
    classify_commerce_types,
)


@pytest.fixture
def mixed_types_df() -> pd.DataFrame:
    """6개 상권: 각 유형 + unclassified 경계값 커버."""
    return pd.DataFrame(
        [
            # 순유입 상위(P75+), GRI 70 → 흡수형_과열
            {"commerce_code": "HOT",    "net_flow":  2000.0, "gri_score": 75.0, "degree_centrality": 0.8, "closure_rate": 2.0},
            # 순유입 상위, GRI 30 → 흡수형_성장
            {"commerce_code": "GROW",   "net_flow":  1800.0, "gri_score": 30.0, "degree_centrality": 0.7, "closure_rate": 1.5},
            # 순유출 하위(P25-), 폐업률 7% → 방출형_침체
            {"commerce_code": "DECAY",  "net_flow": -1500.0, "gri_score": 85.0, "degree_centrality": 0.3, "closure_rate": 7.0},
            # net_flow 중간, centrality 하위 → 고립형_단절
            {"commerce_code": "ISOL",   "net_flow":    50.0, "gri_score": 60.0, "degree_centrality": 0.05, "closure_rate": 3.0},
            # 중간 flow (P25 < abs < P75), 저GRI → 안정형
            {"commerce_code": "STABLE", "net_flow":   700.0, "gri_score": 25.0, "degree_centrality": 0.5, "closure_rate": 1.0},
            # 경계값 (중간 GRI → 안정형 미해당, 중앙 centrality → 고립형 미해당) → unclassified
            {"commerce_code": "MID",    "net_flow":   500.0, "gri_score": 55.0, "degree_centrality": 0.4, "closure_rate": 4.0},
        ]
    )


class TestClassifyCommerceTypes:
    def test_hot_absorbing_high_gri(self, mixed_types_df):
        out = classify_commerce_types(mixed_types_df)
        hot = out[out["commerce_code"] == "HOT"].iloc[0]
        assert hot["commerce_type"] == "흡수형_과열"

    def test_growth_absorbing_low_gri(self, mixed_types_df):
        out = classify_commerce_types(mixed_types_df)
        grow = out[out["commerce_code"] == "GROW"].iloc[0]
        assert grow["commerce_type"] == "흡수형_성장"

    def test_decay_emission_high_closure(self, mixed_types_df):
        out = classify_commerce_types(mixed_types_df)
        decay = out[out["commerce_code"] == "DECAY"].iloc[0]
        assert decay["commerce_type"] == "방출형_침체"

    def test_isolated_low_centrality(self, mixed_types_df):
        out = classify_commerce_types(mixed_types_df)
        isol = out[out["commerce_code"] == "ISOL"].iloc[0]
        assert isol["commerce_type"] == "고립형_단절"

    def test_stable_mid_flow_low_gri(self, mixed_types_df):
        out = classify_commerce_types(mixed_types_df)
        st = out[out["commerce_code"] == "STABLE"].iloc[0]
        assert st["commerce_type"] == "안정형"

    def test_unclassified_boundary(self, mixed_types_df):
        out = classify_commerce_types(mixed_types_df)
        mid = out[out["commerce_code"] == "MID"].iloc[0]
        assert mid["commerce_type"] == COMMERCE_TYPE_UNCLASSIFIED

    def test_output_has_commerce_type_column(self, mixed_types_df):
        out = classify_commerce_types(mixed_types_df)
        assert "commerce_type" in out.columns

    def test_empty_input_returns_empty_df_with_column(self):
        empty = pd.DataFrame(
            columns=["commerce_code", "net_flow", "gri_score", "degree_centrality", "closure_rate"]
        )
        out = classify_commerce_types(empty)
        assert out.empty
        assert "commerce_type" in out.columns

    def test_input_not_mutated(self, mixed_types_df):
        before = mixed_types_df.copy()
        _ = classify_commerce_types(mixed_types_df)
        pd.testing.assert_frame_equal(mixed_types_df, before)

    def test_single_row_returns_unclassified(self):
        """단일 행은 percentile 계산이 무의미하므로 unclassified."""
        single = pd.DataFrame(
            [{"commerce_code": "X", "net_flow": 1000.0, "gri_score": 50.0, "degree_centrality": 0.5, "closure_rate": 2.0}]
        )
        out = classify_commerce_types(single)
        assert out.iloc[0]["commerce_type"] == COMMERCE_TYPE_UNCLASSIFIED
