"""GET /api/commerce/type-map 엔드포인트 테스트.

Week 3: commerce_analysis 5 신규 컬럼(commerce_type/priority_score/net_flow/
degree_centrality/closure_rate)이 GeoJSON properties에 노출되는지 검증.
"""
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
        for k, v in kwargs.items():
            setattr(self, k, v)


def _row(**overrides):
    base = dict(
        comm_cd="3110053",
        comm_nm="신림 골목상권",
        gu_nm="관악구",
        source_comm_type="골목상권",  # PR #20: cb.comm_type 원천 보존
        geometry={"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]},
        centroid_lng=126.93,
        centroid_lat=37.48,
        gri_score=72.5,
        flow_volume=1234,
        dominant_origin="1168010100",
        analysis_note=None,
        commerce_type="흡수형_과열",  # ca.commerce_type Dev-C 5유형
        priority_score=87.3,
        net_flow=3200.0,
        degree_centrality=0.65,
        closure_rate=8.1,
    )
    base.update(overrides)
    return FakeRow(**base)


class TestTypeMapNewColumns:
    def test_response_exposes_five_new_columns(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = [_row()]
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)

        response = client.get("/api/commerce/type-map?quarter=2025Q4")
        assert response.status_code == 200
        feature = response.json()["features"][0]
        props = feature["properties"]
        assert props["commerce_type"] == "흡수형_과열"
        assert props["priority_score"] == 87.3
        assert props["net_flow"] == 3200.0
        assert props["degree_centrality"] == 0.65
        assert props["closure_rate"] == 8.1

        app.dependency_overrides.clear()

    def test_null_analysis_columns_serialize_as_none(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = [
            _row(
                commerce_type=None,
                priority_score=None,
                net_flow=None,
                degree_centrality=None,
                closure_rate=None,
            )
        ]
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)

        response = client.get("/api/commerce/type-map?quarter=2025Q4")
        assert response.status_code == 200
        props = response.json()["features"][0]["properties"]
        for key in ("commerce_type", "priority_score", "net_flow", "degree_centrality", "closure_rate"):
            assert props[key] is None

        app.dependency_overrides.clear()

    def test_empty_features_returns_200(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = []
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)

        response = client.get("/api/commerce/type-map?quarter=2025Q4")
        assert response.status_code == 200
        assert response.json()["total"] == 0

        app.dependency_overrides.clear()

    def test_cache_key_includes_quarter_and_gu(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = []
        cache = MagicMock()
        cache.get.return_value = None
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = lambda: cache
        client = TestClient(app)

        client.get("/api/commerce/type-map?quarter=2025Q4&gu=관악구")
        cache_key_arg = cache.get.call_args[0][0]
        assert "2025Q4" in cache_key_arg
        assert "관악구" in cache_key_arg

        app.dependency_overrides.clear()
