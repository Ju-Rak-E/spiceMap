"""Module B — GRI v1.0 산출 테스트."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from backend.analysis.module_b_gri import GRI_WEIGHTS, compute_gri


class TestGriWeights:
    def test_weights_sum_to_one(self):
        total = GRI_WEIGHTS["closure"] + GRI_WEIGHTS["outflow"] + GRI_WEIGHTS["isolation"]
        assert total == pytest.approx(1.0)

    def test_closure_weight_is_largest(self):
        assert GRI_WEIGHTS["closure"] >= GRI_WEIGHTS["outflow"] >= GRI_WEIGHTS["isolation"]


class TestComputeGri:
    def test_output_contains_required_columns(self, gri_input_df):
        out = compute_gri(gri_input_df)
        required = {"gri_score", "risk_closure_z", "risk_outflow_z", "risk_isolate_z"}
        assert required.issubset(out.columns)

    def test_gri_score_in_percentile_range(self, gri_input_df):
        out = compute_gri(gri_input_df)
        assert (out["gri_score"] >= 0).all()
        assert (out["gri_score"] <= 100).all()

    def test_highest_risk_row_has_highest_gri(self, gri_input_df):
        """C5(폐업↑, 순유출↑, 고립↑)가 최고 GRI를 받아야 한다."""
        out = compute_gri(gri_input_df)
        worst = out.loc[out["gri_score"].idxmax()]
        assert worst["commerce_code"] == "C5"

    def test_lowest_risk_row_has_lowest_gri(self, gri_input_df):
        """C1(폐업↓, 순유입↑, 고립↓)이 최저 GRI를 받아야 한다."""
        out = compute_gri(gri_input_df)
        best = out.loc[out["gri_score"].idxmin()]
        assert best["commerce_code"] == "C1"

    def test_z_scores_are_standardized(self, gri_input_df):
        """z-score 컬럼의 평균은 0 근처, 표준편차는 1 근처여야 한다."""
        out = compute_gri(gri_input_df)
        for col in ("risk_closure_z", "risk_outflow_z", "risk_isolate_z"):
            assert out[col].mean() == pytest.approx(0.0, abs=1e-6)
            # 모집단 표준편차 기준 1.0
            assert float(np.std(out[col])) == pytest.approx(1.0, abs=1e-6)

    def test_input_dataframe_not_mutated(self, gri_input_df):
        before = gri_input_df.copy()
        _ = compute_gri(gri_input_df)
        pd.testing.assert_frame_equal(gri_input_df, before)
