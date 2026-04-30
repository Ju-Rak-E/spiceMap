"""GET /api/barriers 엔드포인트 테스트."""
from __future__ import annotations
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


class TestBarriers:
    def test_returns_200_with_barriers(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = [
            FakeRow(
                from_comm_cd="3110053", from_comm_nm="신림 골목상권",
                from_centroid_lng=126.929, from_centroid_lat=37.484,
                to_comm_cd="3110021", to_comm_nm="서울대입구역 상권",
                to_centroid_lng=126.952, to_centroid_lat=37.481,
                barrier_score=0.82, barrier_type="주말 쇼핑 유입 부족",
            )
        ]
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)
        response = client.get("/api/barriers?quarter=2025Q4")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["barriers"][0]["from_comm_cd"] == "3110053"
        assert data["barriers"][0]["barrier_score"] == 0.82
        assert data["barriers"][0]["from_centroid_lng"] == 126.929
        assert data["barriers"][0]["from_centroid_lat"] == 37.484
        assert data["barriers"][0]["to_centroid_lng"] == 126.952
        assert data["barriers"][0]["to_centroid_lat"] == 37.481
        app.dependency_overrides.clear()

    def test_empty_when_no_data(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = []
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)
        response = client.get("/api/barriers?quarter=2025Q4")
        assert response.status_code == 200
        assert response.json()["total"] == 0
        app.dependency_overrides.clear()

    def test_min_score_filter(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = []
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)
        client.get("/api/barriers?quarter=2025Q4&min_score=0.5")
        call_params = mock_db.execute.call_args[0][1]
        assert call_params["min_score"] == 0.5
        app.dependency_overrides.clear()
