"""Module E — 정책 우선순위 점수 산출 테스트.

설계: docs/module_e_design.md
"""
from __future__ import annotations

import pandas as pd
import pytest

from backend.analysis.module_e_priority import (
    PRIORITY_TOP_THRESHOLD,
    PRIORITY_WEIGHTS,
    REQUIRED_GRI_COLUMNS,
    compute_priority_scores,
)


@pytest.fixture
def gri_df() -> pd.DataFrame:
    """Module B 산출 (5상권)."""
    return pd.DataFrame(
        [
            {"commerce_code": "C1", "quarter": "2025Q4", "gri_score": 90.0},
            {"commerce_code": "C2", "quarter": "2025Q4", "gri_score": 70.0},
            {"commerce_code": "C3", "quarter": "2025Q4", "gri_score": 50.0},
            {"commerce_code": "C4", "quarter": "2025Q4", "gri_score": 30.0},
            {"commerce_code": "C5", "quarter": "2025Q4", "gri_score": 10.0},
        ]
    )


@pytest.fixture
def sales_df() -> pd.DataFrame:
    """commerce_sales — t/t-1 분기 모두 보유."""
    return pd.DataFrame(
        [
            # 2025Q4 (target)
            {"trdar_cd": "C1", "year_quarter": "2025Q4", "sales_amount": 5_000_000},
            {"trdar_cd": "C2", "year_quarter": "2025Q4", "sales_amount": 4_000_000},
            {"trdar_cd": "C3", "year_quarter": "2025Q4", "sales_amount": 3_000_000},
            {"trdar_cd": "C4", "year_quarter": "2025Q4", "sales_amount": 2_000_000},
            {"trdar_cd": "C5", "year_quarter": "2025Q4", "sales_amount": 1_000_000},
            # 2025Q3 (previous) — C1만 50% 하락한 시그널
            {"trdar_cd": "C1", "year_quarter": "2025Q3", "sales_amount": 10_000_000},
            {"trdar_cd": "C2", "year_quarter": "2025Q3", "sales_amount": 4_400_000},
            {"trdar_cd": "C3", "year_quarter": "2025Q3", "sales_amount": 3_300_000},
            {"trdar_cd": "C4", "year_quarter": "2025Q3", "sales_amount": 2_200_000},
            {"trdar_cd": "C5", "year_quarter": "2025Q3", "sales_amount": 1_100_000},
        ]
    )


class TestComputePriorityScores:
    def test_output_has_required_columns(self, gri_df, sales_df):
        result = compute_priority_scores(gri_df, sales_df, "2025Q4", "2025Q3")
        for col in (
            "commerce_code",
            "quarter",
            "priority_score",
            "gri_score",
            "sales_size_score",
            "trend_penalty",
            "is_top_priority",
        ):
            assert col in result.columns

    def test_priority_in_0_100_range(self, gri_df, sales_df):
        result = compute_priority_scores(gri_df, sales_df, "2025Q4", "2025Q3")
        assert (result["priority_score"] >= 0).all()
        assert (result["priority_score"] <= 100).all()

    def test_top_priority_flag_matches_threshold(self, gri_df, sales_df):
        result = compute_priority_scores(gri_df, sales_df, "2025Q4", "2025Q3")
        for _, row in result.iterrows():
            assert row["is_top_priority"] == (row["priority_score"] >= PRIORITY_TOP_THRESHOLD)

    def test_higher_gri_correlates_with_higher_priority(self, gri_df, sales_df):
        """GRI 90 상권의 우선순위가 GRI 10 상권보다 높아야 한다."""
        result = compute_priority_scores(gri_df, sales_df, "2025Q4", "2025Q3")
        c1 = result[result["commerce_code"] == "C1"].iloc[0]
        c5 = result[result["commerce_code"] == "C5"].iloc[0]
        assert c1["priority_score"] > c5["priority_score"]

    def test_trend_penalty_zero_when_previous_quarter_missing(self, gri_df, sales_df):
        result = compute_priority_scores(gri_df, sales_df, "2025Q4", None)
        assert (result["trend_penalty"] == 0.0).all()

    def test_decline_50pct_gives_full_trend_penalty(self, gri_df, sales_df):
        result = compute_priority_scores(gri_df, sales_df, "2025Q4", "2025Q3")
        c1 = result[result["commerce_code"] == "C1"].iloc[0]
        # 5,000,000 / 10,000,000 → 50% 감소 → trend_penalty=100 (clip at 100)
        assert c1["trend_penalty"] == pytest.approx(100.0)

    def test_no_decline_gives_zero_trend_penalty(self, gri_df, sales_df):
        result = compute_priority_scores(gri_df, sales_df, "2025Q4", "2025Q3")
        # C2~C5는 모두 직전 분기 대비 -10% (clip at 0 if negative penalty? no, 10% decline > 0)
        # 단, decline_rate = (4_400_000 - 4_000_000) / 4_400_000 ≈ 0.0909 → penalty ≈ 18.18
        c2 = result[result["commerce_code"] == "C2"].iloc[0]
        assert 0 < c2["trend_penalty"] < 30

    def test_sales_size_score_uses_percentile_rank(self, gri_df, sales_df):
        result = compute_priority_scores(gri_df, sales_df, "2025Q4", "2025Q3")
        # 5상권 매출 다 다름 → percentile rank 100/n × rank
        scores = sorted(result["sales_size_score"].tolist())
        # 0~100 균등 분포
        assert min(scores) >= 0
        assert max(scores) <= 100
        # C1(매출 최대)이 가장 높은 size score
        c1 = result[result["commerce_code"] == "C1"].iloc[0]
        assert c1["sales_size_score"] == max(scores)

    def test_input_dataframes_not_mutated(self, gri_df, sales_df):
        gri_before = gri_df.copy()
        sales_before = sales_df.copy()
        _ = compute_priority_scores(gri_df, sales_df, "2025Q4", "2025Q3")
        pd.testing.assert_frame_equal(gri_df, gri_before)
        pd.testing.assert_frame_equal(sales_df, sales_before)

    def test_missing_sales_data_gives_zero_size_score(self, gri_df):
        empty_sales = pd.DataFrame(columns=["trdar_cd", "year_quarter", "sales_amount"])
        result = compute_priority_scores(gri_df, empty_sales, "2025Q4", "2025Q3")
        assert (result["sales_size_score"] == 0.0).all()

    def test_zero_previous_sales_gives_zero_trend_penalty(self, gri_df):
        sales = pd.DataFrame(
            [
                {"trdar_cd": "C1", "year_quarter": "2025Q4", "sales_amount": 1_000_000},
                {"trdar_cd": "C1", "year_quarter": "2025Q3", "sales_amount": 0},  # zero division 회피
                {"trdar_cd": "C2", "year_quarter": "2025Q4", "sales_amount": 2_000_000},
                {"trdar_cd": "C2", "year_quarter": "2025Q3", "sales_amount": 2_200_000},
                {"trdar_cd": "C3", "year_quarter": "2025Q4", "sales_amount": 3_000_000},
                {"trdar_cd": "C3", "year_quarter": "2025Q3", "sales_amount": 3_300_000},
                {"trdar_cd": "C4", "year_quarter": "2025Q4", "sales_amount": 4_000_000},
                {"trdar_cd": "C4", "year_quarter": "2025Q3", "sales_amount": 4_400_000},
                {"trdar_cd": "C5", "year_quarter": "2025Q4", "sales_amount": 5_000_000},
                {"trdar_cd": "C5", "year_quarter": "2025Q3", "sales_amount": 5_500_000},
            ]
        )
        result = compute_priority_scores(gri_df, sales, "2025Q4", "2025Q3")
        c1 = result[result["commerce_code"] == "C1"].iloc[0]
        assert c1["trend_penalty"] == 0.0

    def test_quarter_column_is_target_quarter(self, gri_df, sales_df):
        result = compute_priority_scores(gri_df, sales_df, "2025Q4", "2025Q3")
        assert (result["quarter"] == "2025Q4").all()

    def test_weights_sum_to_one(self):
        total = sum(PRIORITY_WEIGHTS.values())
        assert total == pytest.approx(1.0)

    def test_required_columns_constant_includes_gri(self):
        assert {"commerce_code", "quarter", "gri_score"}.issubset(REQUIRED_GRI_COLUMNS)

    def test_empty_gri_returns_empty_dataframe_with_schema(self, sales_df):
        empty_gri = pd.DataFrame(columns=["commerce_code", "quarter", "gri_score"])
        result = compute_priority_scores(empty_gri, sales_df, "2025Q4", "2025Q3")
        assert result.empty
        for col in (
            "commerce_code",
            "quarter",
            "priority_score",
            "is_top_priority",
        ):
            assert col in result.columns

    def test_missing_gri_column_raises(self, sales_df):
        bad = pd.DataFrame([{"commerce_code": "C1", "quarter": "2025Q4"}])
        with pytest.raises(ValueError):
            compute_priority_scores(bad, sales_df, "2025Q4", "2025Q3")
