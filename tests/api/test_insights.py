"""GET /api/insights/policy 엔드포인트 테스트."""
from __future__ import annotations
import json
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from backend.main import app
from backend.api.deps import get_session, get_cache


def _mock_cache():
    cache = MagicMock()
    cache.get.return_value = None
    return cache


class FakeRow:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


_METRICS = {"gri_score": 74.2, "net_flow": 3200.0, "degree_centrality": 0.65, "closure_rate": 8.1}


class TestPolicyInsights:
    def test_returns_200_with_cards(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = [
            FakeRow(
                rule_id="R4",
                commerce_code="3110053",
                commerce_name="신림 골목상권",
                severity="Critical",
                policy_text="젠트리피케이션 예방: 임대료 상한 가이드라인 + 상생 협약",
                rationale="유입 과열 + 폐업 상승 (GRI=74.2)",
                triggering_metrics=json.dumps(_METRICS),
                generation_mode="rule_based",
                priority_score=87.3,
            )
        ]
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)
        response = client.get("/api/insights/policy?quarter=2025Q4")
        assert response.status_code == 200
        data = response.json()
        assert data["generation_mode"] == "rule_based"
        assert data["total_cards"] == 1
        card = data["cards"][0]
        assert card["rule_id"] == "R4"
        assert card["severity"] == "Critical"
        assert card["triggering_metrics"]["gri_score"] == 74.2
        app.dependency_overrides.clear()

    def test_empty_policy_cards_returns_200(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = []
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)
        response = client.get("/api/insights/policy?quarter=2025Q4")
        assert response.status_code == 200
        assert response.json()["total_cards"] == 0
        app.dependency_overrides.clear()

    def test_comm_cd_filter(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = []
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)
        client.get("/api/insights/policy?quarter=2025Q4&comm_cd=3110053")
        call_params = mock_db.execute.call_args[0][1]
        assert call_params["comm_cd"] == "3110053"
        app.dependency_overrides.clear()
