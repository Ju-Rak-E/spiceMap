"""H1 검증 — 순유입 vs 매출 Pearson 상관 테스트.

가설: 순유입이 큰 상권일수록 매출이 크다. (FR_Role_Workflow.md §3.5 H1)
KPI: r ≥ 0.5, p < 0.05
"""
from __future__ import annotations

import pandas as pd
import pytest

from backend.analysis.verification_h1 import compute_h1_correlation


class TestComputeH1Correlation:
    def test_returns_required_keys(self, h1_analysis_df, h1_sales_df):
        result = compute_h1_correlation(h1_analysis_df, h1_sales_df)
        assert {"pearson_r", "p_value", "n", "passes_threshold"} <= set(result)

    def test_positive_correlation_detected(self, h1_analysis_df, h1_sales_df):
        """fixture는 단조 증가 설계 → r > 0.9 기대."""
        result = compute_h1_correlation(h1_analysis_df, h1_sales_df)
        assert result["pearson_r"] > 0.9

    def test_only_matching_commerce_codes_used(self, h1_analysis_df, h1_sales_df):
        """analysis_df에 없는 매출 데이터는 계산에서 제외된다."""
        result = compute_h1_correlation(h1_analysis_df, h1_sales_df)
        # h1_analysis_df는 5건, sales는 UNMATCHED 포함 6건 → 매칭 5건
        assert result["n"] == 5

    def test_threshold_evaluation(self, h1_analysis_df, h1_sales_df):
        """r ≥ 0.5 & p < 0.05 만족 시 passes_threshold=True."""
        result = compute_h1_correlation(h1_analysis_df, h1_sales_df)
        assert result["passes_threshold"] is True

    def test_negative_correlation_fails_threshold(self):
        analysis = pd.DataFrame(
            [
                {"commerce_code": "A", "net_flow": 100},
                {"commerce_code": "B", "net_flow": 200},
                {"commerce_code": "C", "net_flow": 300},
                {"commerce_code": "D", "net_flow": 400},
                {"commerce_code": "E", "net_flow": 500},
            ]
        )
        sales = pd.DataFrame(
            [
                {"trdar_cd": "A", "sales_amount": 500},
                {"trdar_cd": "B", "sales_amount": 400},
                {"trdar_cd": "C", "sales_amount": 300},
                {"trdar_cd": "D", "sales_amount": 200},
                {"trdar_cd": "E", "sales_amount": 100},
            ]
        )
        result = compute_h1_correlation(analysis, sales)
        assert result["pearson_r"] < 0
        assert result["passes_threshold"] is False

    def test_raises_when_insufficient_samples(self):
        analysis = pd.DataFrame([{"commerce_code": "A", "net_flow": 100}])
        sales = pd.DataFrame([{"trdar_cd": "A", "sales_amount": 500}])
        with pytest.raises(ValueError, match="최소 3쌍"):
            compute_h1_correlation(analysis, sales)
