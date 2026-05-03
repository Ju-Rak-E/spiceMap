"""DB 장애 시 fallback 캐시 동작 테스트.

시나리오:
1. DB가 SQLAlchemyError를 던질 때 fallback 캐시가 있으면 200 반환 (from_cache=True)
2. DB 에러 + fallback 캐시 없으면 503 반환
3. 데모 모드에서 스냅샷이 있으면 200 반환 (from_cache=True, cache_warning 포함)
"""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from backend.main import app
from backend.api.deps import get_session, get_cache


def _db_raises():
    mock = MagicMock()
    mock.execute.side_effect = OperationalError("conn", {}, Exception("timeout"))
    return mock


def _cache_with_fallback(payload: dict):
    cache = MagicMock()
    cache.get.side_effect = lambda key: (
        json.dumps(payload) if key.startswith("fallback:") else None
    )
    return cache


def _empty_cache():
    cache = MagicMock()
    cache.get.return_value = None
    return cache


class TestOdFlowsFallback:
    def test_db_error_with_fallback_returns_200(self):
        fallback_data = {
            "quarter": "2025Q4",
            "total_flows": 1,
            "flows": [],
            "from_cache": False,
            "cache_warning": None,
        }
        app.dependency_overrides[get_session] = _db_raises
        app.dependency_overrides[get_cache] = lambda: _cache_with_fallback(fallback_data)

        client = TestClient(app)
        response = client.get("/api/od/flows?quarter=2025Q4")

        assert response.status_code == 200
        data = response.json()
        assert data["from_cache"] is True
        assert data["cache_warning"] == "캐시 데이터로 표시 중"
        app.dependency_overrides.clear()

    def test_db_error_no_fallback_returns_503(self):
        app.dependency_overrides[get_session] = _db_raises
        app.dependency_overrides[get_cache] = lambda: _empty_cache()

        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/od/flows?quarter=2025Q4")

        assert response.status_code == 503
        app.dependency_overrides.clear()


class TestBarriersFallback:
    def test_db_error_with_fallback_returns_200(self):
        fallback_data = {
            "quarter": "2025Q4",
            "total": 0,
            "barriers": [],
            "from_cache": False,
            "cache_warning": None,
        }
        app.dependency_overrides[get_session] = _db_raises
        app.dependency_overrides[get_cache] = lambda: _cache_with_fallback(fallback_data)

        client = TestClient(app)
        response = client.get("/api/barriers?quarter=2025Q4")

        assert response.status_code == 200
        assert response.json()["from_cache"] is True
        app.dependency_overrides.clear()

    def test_db_error_no_fallback_returns_503(self):
        app.dependency_overrides[get_session] = _db_raises
        app.dependency_overrides[get_cache] = lambda: _empty_cache()

        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/barriers?quarter=2025Q4")

        assert response.status_code == 503
        app.dependency_overrides.clear()


class TestInsightsFallback:
    def test_db_error_with_fallback_returns_200(self):
        fallback_data = {
            "quarter": "2025Q4",
            "total_cards": 0,
            "generation_mode": "rule_based",
            "cards": [],
            "from_cache": False,
            "cache_warning": None,
        }
        app.dependency_overrides[get_session] = _db_raises
        app.dependency_overrides[get_cache] = lambda: _cache_with_fallback(fallback_data)

        client = TestClient(app)
        response = client.get("/api/insights/policy?quarter=2025Q4")

        assert response.status_code == 200
        assert response.json()["from_cache"] is True
        app.dependency_overrides.clear()


class TestDemoMode:
    def test_demo_mode_uses_snapshot(self, tmp_path):
        snap = {
            "quarter": "2025Q4",
            "total_flows": 5,
            "flows": [],
            "from_cache": False,
            "cache_warning": None,
        }
        snap_file = tmp_path / "od-flows_2025Q4_all_200.json"
        snap_file.write_text(json.dumps(snap), encoding="utf-8")

        with (
            patch("backend.config.settings.demo_mode", True),
            patch("backend.api.cache_utils.DEMO_DIR", tmp_path),
        ):
            client = TestClient(app)
            response = client.get("/api/od/flows?quarter=2025Q4")

        assert response.status_code == 200
        data = response.json()
        assert data["from_cache"] is True
        assert data["cache_warning"] == "데모 데이터로 표시 중"
        assert data["total_flows"] == 5
