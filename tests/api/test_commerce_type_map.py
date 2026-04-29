"""GET /api/commerce/type-map 필드 분리 테스트.

변경 내용:
  - commerce_type  : ca.commerce_type (Dev-C 5유형)
  - source_comm_type: cb.comm_type (원천 골목/발달)
  - comm_type      : commerce_type 의 1-week 미러 (Week 4 클린업 예정)
"""
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


def _fake_row_base(**overrides):
    defaults = dict(
        comm_cd="3110053",
        comm_nm="신림 골목상권",
        gu_nm="관악구",
        source_comm_type="골목상권",
        geometry={"type": "Polygon", "coordinates": [[[126.9, 37.4], [126.91, 37.4], [126.91, 37.41], [126.9, 37.4]]]},
        centroid_lng=126.905,
        centroid_lat=37.405,
        gri_score=None,
        flow_volume=None,
        net_flow=None,
        degree_centrality=None,
        closure_rate=None,
        dominant_origin=None,
        analysis_note=None,
        commerce_type=None,
    )
    defaults.update(overrides)
    return FakeRow(**defaults)


class TestTypeMapFieldSeparation:
    def test_commerce_type_is_null_when_analysis_empty(self):
        """commerce_analysis 행이 없으면 commerce_type=null."""
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
        """commerce_analysis에 값이 있으면 commerce_type이 내려온다."""
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = [
            _fake_row_base(commerce_type="전통시장형")
        ]
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)
        response = client.get("/api/commerce/type-map?quarter=2025Q4")
        assert response.status_code == 200
        props = response.json()["features"][0]["properties"]
        assert props["commerce_type"] == "전통시장형"
        app.dependency_overrides.clear()

    def test_source_comm_type_contains_original_cb_value(self):
        """source_comm_type에는 cb.comm_type(골목/발달)이 그대로 담긴다."""
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = [
            _fake_row_base(source_comm_type="발달상권", commerce_type="역세권형")
        ]
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)
        response = client.get("/api/commerce/type-map?quarter=2025Q4")
        assert response.status_code == 200
        props = response.json()["features"][0]["properties"]
        assert props["source_comm_type"] == "발달상권"
        assert props["commerce_type"] == "역세권형"
        app.dependency_overrides.clear()

    def test_comm_type_mirrors_commerce_type_for_backward_compat(self):
        """기존 comm_type 키는 commerce_type과 동일값으로 1주 유지."""
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = [
            _fake_row_base(commerce_type="골목형")
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
        """commerce_type != source_comm_type 일 때 각각 올바른 값이 온다."""
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = [
            _fake_row_base(source_comm_type="골목상권", commerce_type="역세권형")
        ]
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)
        response = client.get("/api/commerce/type-map?quarter=2025Q4")
        assert response.status_code == 200
        props = response.json()["features"][0]["properties"]
        assert props["source_comm_type"] == "골목상권"
        assert props["commerce_type"] == "역세권형"
        assert props["comm_type"] == "역세권형"
        app.dependency_overrides.clear()
