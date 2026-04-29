"""baseline_comparison 단위 테스트."""
from __future__ import annotations

import pandas as pd
import pytest

from backend.analysis.baseline_comparison import (
    DEFAULT_TOP_PCT,
    compare_priority_to_b3,
    compute_b3_baseline,
)


@pytest.fixture
def q3_sales() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"trdar_cd": "C1", "sales_amount": 1000.0},
            {"trdar_cd": "C2", "sales_amount": 2000.0},
            {"trdar_cd": "C3", "sales_amount": 500.0},
            {"trdar_cd": "C4", "sales_amount": 800.0},
            {"trdar_cd": "C5", "sales_amount": 1500.0},
        ]
    )


@pytest.fixture
def q4_sales() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"trdar_cd": "C1", "sales_amount": 100.0},   # -90% (강한 하락)
            {"trdar_cd": "C2", "sales_amount": 1900.0},  # -5%
            {"trdar_cd": "C3", "sales_amount": 250.0},   # -50%
            {"trdar_cd": "C4", "sales_amount": 800.0},   # 0%
            {"trdar_cd": "C5", "sales_amount": 1800.0},  # +20% (증가)
        ]
    )


class TestComputeB3Baseline:
    def test_decline_rate_calculation(self, q3_sales, q4_sales):
        result = compute_b3_baseline(q3_sales, q4_sales)
        c1 = result[result["commerce_code"] == "C1"].iloc[0]
        assert c1["b3_score"] == pytest.approx(0.9)

    def test_clipped_at_zero_for_growth(self, q3_sales, q4_sales):
        result = compute_b3_baseline(q3_sales, q4_sales)
        c5 = result[result["commerce_code"] == "C5"].iloc[0]
        assert c5["b3_score"] == 0.0  # 매출 증가 → 위험 0

    def test_q3_zero_excluded(self):
        q3 = pd.DataFrame([{"trdar_cd": "X", "sales_amount": 0.0}])
        q4 = pd.DataFrame([{"trdar_cd": "X", "sales_amount": 100.0}])
        result = compute_b3_baseline(q3, q4)
        assert result.empty

    def test_aggregates_multiple_industries(self):
        q3 = pd.DataFrame(
            [
                {"trdar_cd": "C1", "sales_amount": 600.0},
                {"trdar_cd": "C1", "sales_amount": 400.0},
            ]
        )
        q4 = pd.DataFrame([{"trdar_cd": "C1", "sales_amount": 500.0}])
        result = compute_b3_baseline(q3, q4)
        # 합산 1000 → 500 = -50%
        assert result.iloc[0]["b3_score"] == pytest.approx(0.5)


class TestComparePriorityToB3:
    @pytest.fixture
    def priority_20(self) -> pd.DataFrame:
        return pd.DataFrame(
            [{"commerce_code": f"C{i}", "priority_score": 100 - i * 5} for i in range(20)]
        )

    @pytest.fixture
    def b3_20(self) -> pd.DataFrame:
        # C0~C3는 priority 상위 4와 일치
        return pd.DataFrame(
            [{"commerce_code": f"C{i}", "b3_score": 0.95 - i * 0.04} for i in range(20)]
        )

    def test_jaccard_full_overlap(self, priority_20, b3_20):
        result = compare_priority_to_b3(priority_20, b3_20)
        assert result["jaccard"] == pytest.approx(1.0)
        assert result["new_in_priority"] == 0

    def test_jaccard_partial(self, priority_20):
        # priority TOP 4 = C0~C3, b3 TOP 4 = C16~C19 (정반대) → jaccard 0
        b3 = pd.DataFrame(
            [{"commerce_code": f"C{i}", "b3_score": i * 0.05} for i in range(20)]
        )
        result = compare_priority_to_b3(priority_20, b3)
        assert result["jaccard"] == 0.0
        assert result["new_in_priority"] == 4

    def test_spearman_perfect_positive(self, priority_20, b3_20):
        result = compare_priority_to_b3(priority_20, b3_20)
        assert result["spearman_r"] == pytest.approx(1.0)

    def test_min_samples_raises(self):
        small = pd.DataFrame([{"commerce_code": "C1", "priority_score": 50}])
        with pytest.raises(ValueError):
            compare_priority_to_b3(small, small)

    def test_top_pct_constant(self):
        assert DEFAULT_TOP_PCT == 0.20

    def test_drops_unmatched(self):
        p = pd.DataFrame([{"commerce_code": f"C{i}", "priority_score": i} for i in range(10)])
        b = pd.DataFrame([{"commerce_code": f"C{i}", "b3_score": 0.5} for i in range(5, 15)])
        result = compare_priority_to_b3(p, b)
        assert result["n_total"] == 5
