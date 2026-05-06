"""verification_h2 단위 테스트."""
from __future__ import annotations

import pandas as pd
import pytest

from backend.analysis.verification_h2 import (
    H2_MIN_SAMPLES,
    H2_R_MIN,
    aggregate_barrier_intensity,
    compute_h2_alignment,
)


@pytest.fixture
def passing_data():
    """barrier_intensity 와 closure_rate 가 강한 양의 상관."""
    barriers = pd.DataFrame(
        [
            {"from_comm_cd": f"C{i}", "to_comm_cd": f"D{i}", "barrier_score": 0.1 * i}
            for i in range(10)
        ]
    )
    # closure_rate 도 동일하게 0.1 * i 로 강한 양의 상관
    closures = pd.DataFrame(
        [{"commerce_code": f"C{i}", "closure_rate": 0.1 * i} for i in range(10)]
    )
    return barriers, closures


@pytest.fixture
def negative_data():
    """음의 상관 (단절↑ → 폐업↓, 이론과 반대)."""
    barriers = pd.DataFrame(
        [
            {"from_comm_cd": f"C{i}", "to_comm_cd": f"D{i}", "barrier_score": 0.1 * i}
            for i in range(10)
        ]
    )
    closures = pd.DataFrame(
        [{"commerce_code": f"C{i}", "closure_rate": 1.0 - 0.1 * i} for i in range(10)]
    )
    return barriers, closures


class TestAggregateBarrierIntensity:
    def test_empty_input(self):
        out = aggregate_barrier_intensity(pd.DataFrame(columns=["from_comm_cd", "to_comm_cd", "barrier_score"]))
        assert out.empty
        assert list(out.columns) == ["commerce_code", "barrier_intensity"]

    def test_max_aggregation_from_side(self):
        barriers = pd.DataFrame(
            [
                {"from_comm_cd": "A", "to_comm_cd": "B", "barrier_score": 0.4},
                {"from_comm_cd": "A", "to_comm_cd": "C", "barrier_score": 0.9},
            ]
        )
        out = aggregate_barrier_intensity(barriers)
        a = out[out["commerce_code"] == "A"].iloc[0]
        assert a["barrier_intensity"] == pytest.approx(0.9)

    def test_max_aggregation_to_side(self):
        barriers = pd.DataFrame(
            [
                {"from_comm_cd": "X", "to_comm_cd": "Z", "barrier_score": 0.3},
                {"from_comm_cd": "Y", "to_comm_cd": "Z", "barrier_score": 0.7},
            ]
        )
        out = aggregate_barrier_intensity(barriers)
        z = out[out["commerce_code"] == "Z"].iloc[0]
        assert z["barrier_intensity"] == pytest.approx(0.7)


class TestComputeH2Alignment:
    def test_returns_h2result_shape(self, passing_data):
        b, c = passing_data
        result = compute_h2_alignment(b, c)
        assert {
            "n_total", "pearson_r", "pearson_p", "spearman_r", "spearman_p", "passes_threshold",
        }.issubset(result.keys())

    def test_passes_threshold_when_strong_positive(self, passing_data):
        b, c = passing_data
        result = compute_h2_alignment(b, c)
        assert result["pearson_r"] >= H2_R_MIN
        assert result["pearson_p"] < 0.05
        assert result["passes_threshold"] is True

    def test_fails_threshold_when_negative(self, negative_data):
        b, c = negative_data
        result = compute_h2_alignment(b, c)
        assert result["pearson_r"] < 0
        assert result["passes_threshold"] is False

    def test_min_samples_raises(self):
        b = pd.DataFrame([{"from_comm_cd": "A", "to_comm_cd": "B", "barrier_score": 0.5}])
        c = pd.DataFrame([{"commerce_code": "A", "closure_rate": 0.1}])
        with pytest.raises(ValueError):
            compute_h2_alignment(b, c)

    def test_drops_nan(self):
        b = pd.DataFrame(
            [
                {"from_comm_cd": f"C{i}", "to_comm_cd": f"D{i}", "barrier_score": 0.1 * i}
                for i in range(8)
            ]
        )
        c = pd.DataFrame(
            [
                {"commerce_code": f"C{i}", "closure_rate": (None if i == 3 else 0.1 * i)}
                for i in range(8)
            ]
        )
        result = compute_h2_alignment(b, c)
        assert result["n_total"] == 7

    def test_zero_variance_returns_zero_correlation(self):
        b = pd.DataFrame(
            [
                {"from_comm_cd": f"C{i}", "to_comm_cd": f"D{i}", "barrier_score": 0.5}
                for i in range(10)
            ]
        )
        c = pd.DataFrame(
            [{"commerce_code": f"C{i}", "closure_rate": 0.1 * i} for i in range(10)]
        )
        result = compute_h2_alignment(b, c)
        assert result["pearson_r"] == 0.0
        assert result["passes_threshold"] is False

    def test_threshold_constants(self):
        assert H2_R_MIN == 0.3
        assert H2_MIN_SAMPLES == 5
