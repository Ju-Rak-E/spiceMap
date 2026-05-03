"""preflight_check.py 단위 테스트."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.preflight_check import (
    CheckResult,
    PreflightReport,
    check_file_exists,
    check_validation_fixture,
)


class TestPreflightReport:
    def test_all_pass_when_empty(self):
        report = PreflightReport()
        assert report.all_pass is True

    def test_all_pass_when_all_ok(self):
        report = PreflightReport()
        report.add(CheckResult("a", True, "ok"))
        report.add(CheckResult("b", True, "ok"))
        assert report.all_pass is True

    def test_not_all_pass_with_one_fail(self):
        report = PreflightReport()
        report.add(CheckResult("a", True, "ok"))
        report.add(CheckResult("b", False, "missing"))
        assert report.all_pass is False

    def test_render_includes_pass_count(self):
        report = PreflightReport()
        report.add(CheckResult("a", True, "ok"))
        report.add(CheckResult("b", False, "missing"))
        out = report.render()
        assert "1/2" in out
        assert "FAIL" in out


class TestCheckFileExists:
    def test_existing_file(self, tmp_path: Path):
        p = tmp_path / "f.txt"
        p.write_text("x")
        result = check_file_exists(p, "test")
        assert result.ok is True

    def test_missing_file(self, tmp_path: Path):
        result = check_file_exists(tmp_path / "missing.txt", "test")
        assert result.ok is False


class TestCheckValidationFixture:
    @pytest.fixture
    def valid_fixture(self, tmp_path: Path) -> Path:
        p = tmp_path / "v.json"
        p.write_text(
            json.dumps(
                {
                    "generated_at": "2026-04-30",
                    "quarter": "2025Q4",
                    "previous_quarter": "2025Q3",
                    "cards": [
                        {"id": cid, "title": "x", "headline": "x"}
                        for cid in ["H1", "H2", "H3", "B1", "B3"]
                    ],
                }
            ),
            encoding="utf-8",
        )
        return p

    def test_valid_fixture_passes(self, valid_fixture: Path):
        result = check_validation_fixture(valid_fixture)
        assert result.ok is True
        assert "H1·H2·H3·B1·B3" in result.detail

    def test_missing_fixture(self, tmp_path: Path):
        result = check_validation_fixture(tmp_path / "missing.json")
        assert result.ok is False

    def test_missing_card(self, tmp_path: Path):
        p = tmp_path / "v.json"
        # H2 누락
        p.write_text(
            json.dumps(
                {
                    "generated_at": "x",
                    "quarter": "2025Q4",
                    "previous_quarter": "2025Q3",
                    "cards": [
                        {"id": cid} for cid in ["H1", "H3", "B1", "B3"]
                    ],
                }
            ),
            encoding="utf-8",
        )
        result = check_validation_fixture(p)
        assert result.ok is False
        assert "H2" in result.detail

    def test_invalid_json(self, tmp_path: Path):
        p = tmp_path / "bad.json"
        p.write_text("{not json", encoding="utf-8")
        result = check_validation_fixture(p)
        assert result.ok is False
        assert "JSON" in result.name or "JSON" in result.detail
