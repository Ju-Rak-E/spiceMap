"""GET /api/advisor/industries 엔드포인트 테스트."""
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


class TestAdvisorIndustries:
    def test_returns_sorted_industries(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = [
            FakeRow(industry_nm="한식음식점"),
            FakeRow(industry_nm="커피음료"),
        ]
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)

        response = client.get("/api/advisor/industries?quarter=2025Q4")

        assert response.status_code == 200
        data = response.json()
        assert data["quarter"] == "2025Q4"
        assert "커피음료" in data["industries"]
        assert "한식음식점" in data["industries"]
        app.dependency_overrides.clear()

    def test_empty_when_no_data(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = []
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)

        response = client.get("/api/advisor/industries?quarter=2024Q1")

        assert response.status_code == 200
        assert response.json()["industries"] == []
        app.dependency_overrides.clear()
