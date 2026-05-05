from __future__ import annotations

import json
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from backend.api.deps import get_cache, get_session
from backend.main import app


class FakeRow:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


def _mock_cache():
    cache = MagicMock()
    cache.get.return_value = None
    return cache


def test_barrier_routes_returns_ors_geometry(monkeypatch):
    mock_db = MagicMock()
    mock_db.execute.return_value.fetchall.return_value = [
        FakeRow(
            from_comm_cd="C1",
            to_comm_cd="C2",
            source_lng=126.9,
            source_lat=37.4,
            target_lng=127.1,
            target_lat=37.6,
        )
    ]
    response = MagicMock()
    response.json.return_value = {
        "features": [{
            "geometry": {
                "coordinates": [[126.9, 37.4], [127.0, 37.5], [127.1, 37.6]],
            },
            "properties": {
                "summary": {"distance": 1234.5, "duration": 321.0},
            },
        }]
    }
    response.raise_for_status.return_value = None
    post = MagicMock(return_value=response)

    monkeypatch.setattr("backend.api.barrier_routes.settings.openrouteservice_api_key", "test-key")
    monkeypatch.setattr("backend.api.barrier_routes.httpx.post", post)
    app.dependency_overrides[get_session] = lambda: mock_db
    app.dependency_overrides[get_cache] = _mock_cache

    client = TestClient(app)
    result = client.get("/api/barrier-routes?quarter=2025Q4")

    assert result.status_code == 200
    data = result.json()
    assert data["total"] == 1
    assert data["routes"][0]["barrierId"] == "C1-C2"
    assert data["routes"][0]["path"] == [[126.9, 37.4], [127.0, 37.5], [127.1, 37.6]]
    assert data["routes"][0]["distanceM"] == 1234.5
    post.assert_called_once()
    app.dependency_overrides.clear()


def test_barrier_routes_uses_static_fallback_without_key(monkeypatch):
    snap = {
        "quarter": "2025Q4",
        "total": 1,
        "routes": [{
            "barrierId": "b1",
            "sourceId": "A",
            "targetId": "B",
            "path": [[126.9, 37.4], [127.1, 37.6]],
            "source": "mock",
        }],
        "from_cache": False,
        "cache_warning": None,
    }
    monkeypatch.setattr("backend.api.barrier_routes.settings.openrouteservice_api_key", "")
    monkeypatch.setattr("backend.api.barrier_routes.load_demo", lambda cache_key: snap)
    app.dependency_overrides[get_cache] = _mock_cache

    client = TestClient(app)
    result = client.get("/api/barrier-routes?quarter=2025Q4")

    assert result.status_code == 200
    assert result.json()["routes"][0]["source"] == "mock"
    assert result.json()["from_cache"] is True
    app.dependency_overrides.clear()


def test_barrier_routes_cache_hit_skips_db_and_ors(monkeypatch):
    payload = {
        "quarter": "2025Q4",
        "total": 1,
        "routes": [{
            "barrierId": "cached",
            "sourceId": "A",
            "targetId": "B",
            "path": [[126.9, 37.4], [127.1, 37.6]],
            "source": "ors",
        }],
        "from_cache": False,
        "cache_warning": None,
    }
    cache = MagicMock()
    cache.get.return_value = json.dumps(payload)
    mock_db = MagicMock()
    post = MagicMock()

    monkeypatch.setattr("backend.api.barrier_routes.settings.openrouteservice_api_key", "test-key")
    monkeypatch.setattr("backend.api.barrier_routes.httpx.post", post)
    app.dependency_overrides[get_session] = lambda: mock_db
    app.dependency_overrides[get_cache] = lambda: cache

    client = TestClient(app)
    result = client.get("/api/barrier-routes?quarter=2025Q4")

    assert result.status_code == 200
    assert result.json()["routes"][0]["barrierId"] == "cached"
    mock_db.execute.assert_not_called()
    post.assert_not_called()
    app.dependency_overrides.clear()


def test_barrier_routes_applies_score_and_limit_filters(monkeypatch):
    mock_db = MagicMock()
    mock_db.execute.return_value.fetchall.return_value = []

    monkeypatch.setattr("backend.api.barrier_routes.settings.openrouteservice_api_key", "test-key")
    app.dependency_overrides[get_session] = lambda: mock_db
    app.dependency_overrides[get_cache] = _mock_cache

    client = TestClient(app)
    result = client.get("/api/barrier-routes?quarter=2025Q4&min_score=0.9&limit=3")

    assert result.status_code == 200
    params = mock_db.execute.call_args.args[1]
    assert params["min_score"] == 0.9
    assert params["limit"] == 3
    assert params["comm_cd"] is None
    app.dependency_overrides.clear()


def test_barrier_routes_applies_commerce_endpoint_filter(monkeypatch):
    mock_db = MagicMock()
    mock_db.execute.return_value.fetchall.return_value = []

    monkeypatch.setattr("backend.api.barrier_routes.settings.openrouteservice_api_key", "test-key")
    app.dependency_overrides[get_session] = lambda: mock_db
    app.dependency_overrides[get_cache] = _mock_cache

    client = TestClient(app)
    result = client.get("/api/barrier-routes?quarter=2025Q4&comm_cd=C1")

    assert result.status_code == 200
    params = mock_db.execute.call_args.args[1]
    assert params["comm_cd"] == "C1"
    app.dependency_overrides.clear()
