"""run_validation_all 단위 테스트 (DB 의존 X 부분만)."""
from __future__ import annotations

import pytest

from scripts.run_validation_all import quarter_to_legacy


class TestQuarterToLegacy:
    def test_q1(self):
        assert quarter_to_legacy("2025Q1") == "20251"

    def test_q4(self):
        assert quarter_to_legacy("2025Q4") == "20254"

    def test_q3_previous(self):
        assert quarter_to_legacy("2025Q3") == "20253"

    def test_2026q1(self):
        assert quarter_to_legacy("2026Q1") == "20261"

    def test_invalid_format_raises(self):
        with pytest.raises(ValueError):
            quarter_to_legacy("2025-Q4")
        with pytest.raises(ValueError):
            quarter_to_legacy("25Q4")
        with pytest.raises(ValueError):
            quarter_to_legacy("2025Q5")
        with pytest.raises(ValueError):
            quarter_to_legacy("")
