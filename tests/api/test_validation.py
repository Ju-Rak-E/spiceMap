"""GET /api/insights/validation 엔드포인트 테스트."""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def temp_fixture(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """env override 로 임시 fixture 사용."""
    target = tmp_path / "validation_results.json"
    target.write_text(
        json.dumps(
            {
                "generated_at": "2026-04-30",
                "quarter": "2025Q4",
                "previous_quarter": "2025Q3",
                "cards": [
                    {
                        "id": "H1",
                        "title": "H1 — net_flow vs sales",
                        "headline": "ok",
                        "metric_primary": "r=0.106",
                        "metric_secondary": "p=2.83e-05",
                        "sample_size": "n=1565",
                        "summary": "방향성 지지",
                        "criterion": "임계 r ≥ 0.5 — FAIL",
                        "source": "verification_h1.py",
                    }
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("VALIDATION_FIXTURE_PATH", str(target))
    return target


class TestValidationEndpoint:
    def test_returns_200_with_default_fixture(self, client: TestClient):
        # 모노레포 기본 경로 — frontend/src/data/validation_results.json 존재 가정.
        response = client.get("/api/insights/validation")
        assert response.status_code == 200
        body = response.json()
        assert body["quarter"]
        assert isinstance(body["cards"], list)
        # H2 카드가 D-9 작업으로 추가됐으므로 5 카드 이상 기대
        assert len(body["cards"]) >= 4
        ids = {c["id"] for c in body["cards"]}
        assert {"H1", "H3", "B1", "B3"}.issubset(ids)

    def test_card_schema(self, client: TestClient):
        response = client.get("/api/insights/validation")
        assert response.status_code == 200
        for card in response.json()["cards"]:
            assert {
                "id", "title", "headline", "metric_primary", "metric_secondary",
                "sample_size", "summary", "criterion", "source",
            }.issubset(card.keys())

    def test_env_override_path(self, client: TestClient, temp_fixture: Path):
        response = client.get("/api/insights/validation")
        assert response.status_code == 200
        body = response.json()
        assert body["quarter"] == "2025Q4"
        assert len(body["cards"]) == 1
        assert body["cards"][0]["id"] == "H1"

    def test_missing_fixture_returns_503(
        self, client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setenv(
            "VALIDATION_FIXTURE_PATH", str(tmp_path / "nonexistent.json")
        )
        response = client.get("/api/insights/validation")
        assert response.status_code == 503
        assert "validation fixture not found" in response.json()["detail"]

    def test_invalid_json_returns_503(
        self, client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ):
        bad = tmp_path / "bad.json"
        bad.write_text("not a valid JSON{", encoding="utf-8")
        monkeypatch.setenv("VALIDATION_FIXTURE_PATH", str(bad))
        response = client.get("/api/insights/validation")
        assert response.status_code == 503
        assert "failed to read validation fixture" in response.json()["detail"]
