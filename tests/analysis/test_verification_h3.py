"""verification_h3 단위 테스트."""
from __future__ import annotations

import pandas as pd
import pytest

from backend.analysis.verification_h3 import (
    H3_GAP_MIN_PP,
    H3_TOP_PCT,
    compute_h3_alignment,
)


@pytest.fixture
def passing_data():
    """top 20% 상권의 Q4 폐업률이 +2%p 이상 높은 케이스."""
    q3 = pd.DataFrame(
        [
            {"commerce_code": f"C{i}", "gri_score": 100 - i * 2}
            for i in range(20)  # GRI 100, 98, ..., 62
        ]
    )
    # Top 20% (4 상권: C0~C3)는 Q4 폐업률 8~10
    # Bottom 80% (16 상권: C4~C19)는 Q4 폐업률 1~3
    q4 = pd.DataFrame(
        [
            {"commerce_code": f"C{i}", "closure_rate": 9.0 + (i % 2)}
            if i < 4
            else {"commerce_code": f"C{i}", "closure_rate": 1.5 + (i % 3) * 0.5}
            for i in range(20)
        ]
    )
    return q3, q4


@pytest.fixture
def failing_data():
    """gap이 임계 미만인 케이스 (passes_threshold=False)."""
    q3 = pd.DataFrame(
        [{"commerce_code": f"C{i}", "gri_score": 100 - i * 2} for i in range(20)]
    )
    q4 = pd.DataFrame(
        [{"commerce_code": f"C{i}", "closure_rate": 5.0} for i in range(20)]
    )
    return q3, q4


class TestComputeH3Alignment:
    def test_returns_h3result_shape(self, passing_data):
        q3, q4 = passing_data
        result = compute_h3_alignment(q3, q4)
        assert {"n_total", "n_top", "n_bottom", "top_avg_closure",
                "bottom_avg_closure", "gap_pp", "t_stat", "p_value",
                "passes_threshold"}.issubset(result.keys())

    def test_top_pct_default_20(self, passing_data):
        q3, q4 = passing_data
        result = compute_h3_alignment(q3, q4)
        # 20 상권, 상위 20% = 4
        assert result["n_top"] == 4
        assert result["n_bottom"] == 16

    def test_passes_threshold_when_gap_large(self, passing_data):
        q3, q4 = passing_data
        result = compute_h3_alignment(q3, q4)
        assert result["gap_pp"] >= H3_GAP_MIN_PP
        assert result["passes_threshold"] is True

    def test_fails_threshold_when_gap_zero(self, failing_data):
        q3, q4 = failing_data
        result = compute_h3_alignment(q3, q4)
        assert result["gap_pp"] == pytest.approx(0.0, abs=1e-9)
        assert result["passes_threshold"] is False

    def test_top_average_higher_than_bottom_in_passing(self, passing_data):
        q3, q4 = passing_data
        result = compute_h3_alignment(q3, q4)
        assert result["top_avg_closure"] > result["bottom_avg_closure"]

    def test_p_value_below_threshold_when_clearly_separated(self, passing_data):
        q3, q4 = passing_data
        result = compute_h3_alignment(q3, q4)
        assert result["p_value"] < 0.05

    def test_drops_unmatched_codes(self):
        q3 = pd.DataFrame(
            [{"commerce_code": f"C{i}", "gri_score": 100 - i} for i in range(20)]
        )
        q4 = pd.DataFrame(
            [{"commerce_code": f"C{i}", "closure_rate": 1.0} for i in range(10, 30)]
        )
        result = compute_h3_alignment(q3, q4)
        assert result["n_total"] == 10  # 매칭은 C10~C19

    def test_drops_nan_values(self):
        q3 = pd.DataFrame(
            [{"commerce_code": f"C{i}", "gri_score": (i if i % 2 else None)} for i in range(20)]
        )
        q4 = pd.DataFrame(
            [{"commerce_code": f"C{i}", "closure_rate": 1.0} for i in range(20)]
        )
        result = compute_h3_alignment(q3, q4)
        assert result["n_total"] == 10  # 짝수 i는 gri NaN → 제외

    def test_min_samples_raises(self):
        q3 = pd.DataFrame([{"commerce_code": "C1", "gri_score": 50}])
        q4 = pd.DataFrame([{"commerce_code": "C1", "closure_rate": 1}])
        with pytest.raises(ValueError):
            compute_h3_alignment(q3, q4)

    def test_bad_top_pct_raises(self, passing_data):
        q3, q4 = passing_data
        with pytest.raises(ValueError):
            compute_h3_alignment(q3, q4, top_pct=0.0)
        with pytest.raises(ValueError):
            compute_h3_alignment(q3, q4, top_pct=1.0)

    def test_top_pct_constant(self):
        assert H3_TOP_PCT == 0.20

    def test_gap_threshold_constant(self):
        assert H3_GAP_MIN_PP == 2.0
