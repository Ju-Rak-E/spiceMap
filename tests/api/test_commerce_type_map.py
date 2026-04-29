"""GET /api/commerce/type-map field mapping tests."""
from __future__ import annotations

from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from backend.api.deps import get_cache, get_session
from backend.main import app


def _mock_cache():
    cache = MagicMock()
    cache.get.return_value = None
    return cache


class FakeRow:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


def _fake_row_base(**overrides):
    defaults = dict(
        comm_cd="3110053",
        comm_nm="sample commerce",
        gu_nm="Gwanak-gu",
        source_comm_type="alley",
        geometry={
            "type": "Polygon",
            "coordinates": [[[126.9, 37.4], [126.91, 37.4], [126.91, 37.41], [126.9, 37.4]]],
        },
        centroid_lng=126.905,
        centroid_lat=37.405,
        gri_score=None,
        flow_volume=None,
        dominant_origin=None,
        analysis_note=None,
        commerce_type=None,
        priority_score=None,
        net_flow=None,
        degree_centrality=None,
        closure_rate=None,
    )
    defaults.update(overrides)
    return FakeRow(**defaults)


class TestTypeMapFieldSeparation:
    def test_commerce_type_is_null_when_analysis_empty(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = [
            _fake_row_base(commerce_type=None)
        ]
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)

        response = client.get("/api/commerce/type-map?quarter=2025Q4")

        assert response.status_code == 200
        props = response.json()["features"][0]["properties"]
        assert props["commerce_type"] is None
        app.dependency_overrides.clear()

    def test_commerce_type_populated_when_analysis_present(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = [
            _fake_row_base(commerce_type="growth")
        ]
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)

        response = client.get("/api/commerce/type-map?quarter=2025Q4")

        assert response.status_code == 200
        props = response.json()["features"][0]["properties"]
        assert props["commerce_type"] == "growth"
        app.dependency_overrides.clear()

    def test_source_comm_type_contains_original_cb_value(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = [
            _fake_row_base(source_comm_type="district", commerce_type="growth")
        ]
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)

        response = client.get("/api/commerce/type-map?quarter=2025Q4")

        assert response.status_code == 200
        props = response.json()["features"][0]["properties"]
        assert props["source_comm_type"] == "district"
        assert props["commerce_type"] == "growth"
        app.dependency_overrides.clear()

    def test_comm_type_mirrors_commerce_type_for_backward_compat(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = [
            _fake_row_base(commerce_type="alley-growth")
        ]
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)

        response = client.get("/api/commerce/type-map?quarter=2025Q4")

        assert response.status_code == 200
        props = response.json()["features"][0]["properties"]
        assert props["comm_type"] == props["commerce_type"]
        app.dependency_overrides.clear()

    def test_commerce_type_and_source_comm_type_are_independent(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = [
            _fake_row_base(source_comm_type="alley", commerce_type="stable")
        ]
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)

        response = client.get("/api/commerce/type-map?quarter=2025Q4")

        assert response.status_code == 200
        props = response.json()["features"][0]["properties"]
        assert props["source_comm_type"] == "alley"
        assert props["commerce_type"] == "stable"
        assert props["comm_type"] == "stable"
        app.dependency_overrides.clear()

    def test_module_a_and_e_fields_are_exposed(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = [
            _fake_row_base(
                priority_score=87.3,
                net_flow=3200.0,
                degree_centrality=0.65,
                closure_rate=8.1,
            )
        ]
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)

        response = client.get("/api/commerce/type-map?quarter=2025Q4")

        assert response.status_code == 200
        props = response.json()["features"][0]["properties"]
        assert props["priority_score"] == 87.3
        assert props["net_flow"] == 3200.0
        assert props["degree_centrality"] == 0.65
        assert props["closure_rate"] == 8.1
        app.dependency_overrides.clear()
