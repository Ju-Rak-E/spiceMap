"""baseline_b1 단위 테스트."""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from backend.analysis.baseline_b1 import (
    B1_DECLINE_LABEL,
    DEFAULT_TOP_PCT,
    compare_priority_to_b1,
    compute_b1_baseline,
    load_change_index_csv,
)


class TestComputeB1Baseline:
    def test_decline_label_scores_one(self):
        idx = pd.DataFrame(
            [
                {"commerce_code": "A", "change_label": B1_DECLINE_LABEL},
                {"commerce_code": "B", "change_label": "정체"},
                {"commerce_code": "C", "change_label": "다이나믹"},
            ]
        )
        result = compute_b1_baseline(idx)
        assert result.set_index("commerce_code").loc["A", "b1_score"] == 1.0
        assert result.set_index("commerce_code").loc["B", "b1_score"] == 0.0
        assert result.set_index("commerce_code").loc["C", "b1_score"] == 0.0

    def test_empty_input(self):
        result = compute_b1_baseline(pd.DataFrame(columns=["commerce_code", "change_label"]))
        assert result.empty

    def test_label_constant(self):
        assert B1_DECLINE_LABEL == "상권쇠퇴"


class TestLoadChangeIndexCsv:
    def test_loads_uppercase_columns(self, tmp_path: Path):
        csv = tmp_path / "b1.csv"
        csv.write_text(
            "TRDAR_CD,TRDAR_CHNG_IX_NM\n"
            "1001,상권쇠퇴\n"
            "1002,정체\n"
            "1003,다이나믹\n",
            encoding="utf-8",
        )
        out = load_change_index_csv(csv)
        assert list(out.columns) == ["commerce_code", "change_label"]
        assert len(out) == 3
        assert out.iloc[0]["change_label"] == "상권쇠퇴"

    def test_loads_lowercase_columns(self, tmp_path: Path):
        csv = tmp_path / "b1.csv"
        csv.write_text(
            "trdar_cd,trdar_chng_ix_nm\n"
            "1001,상권쇠퇴\n"
            "1002,주의\n",
            encoding="utf-8",
        )
        out = load_change_index_csv(csv)
        assert len(out) == 2

    def test_loads_cp949(self, tmp_path: Path):
        csv = tmp_path / "b1_cp949.csv"
        csv.write_text(
            "TRDAR_CD,TRDAR_CHNG_IX_NM\n1001,상권쇠퇴\n",
            encoding="cp949",
        )
        out = load_change_index_csv(csv)
        assert out.iloc[0]["change_label"] == "상권쇠퇴"

    def test_missing_file_raises(self, tmp_path: Path):
        with pytest.raises(FileNotFoundError):
            load_change_index_csv(tmp_path / "missing.csv")

    def test_strips_whitespace(self, tmp_path: Path):
        csv = tmp_path / "b1.csv"
        csv.write_text(
            "TRDAR_CD,TRDAR_CHNG_IX_NM\n  1001  ,  상권쇠퇴  \n",
            encoding="utf-8",
        )
        out = load_change_index_csv(csv)
        assert out.iloc[0]["commerce_code"] == "1001"
        assert out.iloc[0]["change_label"] == "상권쇠퇴"


class TestComparePriorityToB1:
    @pytest.fixture
    def priority_20(self) -> pd.DataFrame:
        return pd.DataFrame(
            [{"commerce_code": f"C{i}", "priority_score": 100 - i * 5} for i in range(20)]
        )

    def test_full_overlap(self, priority_20):
        # priority TOP 4 = C0~C3. b1 위험 그룹도 C0~C3.
        b1 = pd.DataFrame(
            [
                {"commerce_code": f"C{i}", "b1_score": (1.0 if i < 4 else 0.0)}
                for i in range(20)
            ]
        )
        result = compare_priority_to_b1(priority_20, b1)
        assert result["jaccard"] == pytest.approx(1.0)
        assert result["new_in_priority"] == 0
        assert result["new_in_b1"] == 0

    def test_zero_overlap(self, priority_20):
        # priority TOP 4 = C0~C3. b1 위험 그룹은 C16~C19 (정반대).
        b1 = pd.DataFrame(
            [
                {"commerce_code": f"C{i}", "b1_score": (1.0 if i >= 16 else 0.0)}
                for i in range(20)
            ]
        )
        result = compare_priority_to_b1(priority_20, b1)
        assert result["jaccard"] == 0.0
        assert result["new_in_priority"] == 4
        assert result["new_in_b1"] == 4

    def test_partial_overlap(self, priority_20):
        # priority TOP 4 = C0~C3. b1 위험 그룹 = C0, C1, C16, C17 → 교집합 2.
        b1 = pd.DataFrame(
            [
                {"commerce_code": f"C{i}", "b1_score": (1.0 if i in (0, 1, 16, 17) else 0.0)}
                for i in range(20)
            ]
        )
        result = compare_priority_to_b1(priority_20, b1)
        # 교집합 {C0, C1} = 2, 합집합 {C0, C1, C2, C3, C16, C17} = 6 → 2/6
        assert result["jaccard"] == pytest.approx(2.0 / 6.0)

    def test_min_samples_raises(self):
        small = pd.DataFrame([{"commerce_code": "C1", "priority_score": 50}])
        b1_small = pd.DataFrame([{"commerce_code": "C1", "b1_score": 1.0}])
        with pytest.raises(ValueError):
            compare_priority_to_b1(small, b1_small)

    def test_bad_top_pct_raises(self, priority_20):
        b1 = pd.DataFrame(
            [{"commerce_code": f"C{i}", "b1_score": 0.0} for i in range(20)]
        )
        with pytest.raises(ValueError):
            compare_priority_to_b1(priority_20, b1, top_pct=0.0)
        with pytest.raises(ValueError):
            compare_priority_to_b1(priority_20, b1, top_pct=1.0)

    def test_drops_unmatched(self, priority_20):
        b1 = pd.DataFrame(
            [{"commerce_code": f"C{i}", "b1_score": 0.0} for i in range(5, 25)]
        )
        result = compare_priority_to_b1(priority_20, b1)
        # 매칭은 C5~C19 → 15
        assert result["n_total"] == 15

    def test_top_pct_constant(self):
        assert DEFAULT_TOP_PCT == 0.20
