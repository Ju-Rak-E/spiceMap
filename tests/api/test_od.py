"""GET /api/od/flows 엔드포인트 테스트."""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.api.deps import get_session, get_cache


def _mock_cache():
    cache = MagicMock()
    cache.get.return_value = None  # 캐시 미스
    return cache


class FakeRow:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


class TestOdFlows:
    def test_returns_200_with_flows(self):
        """정상 응답: OD 흐름 목록 반환."""
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = [
            FakeRow(
                origin_adm_cd="1168010100",
                origin_adm_nm="역삼1동",
                dest_adm_cd="1162010200",
                dest_adm_nm="신림동",
                trip_count=4200.0,
            )
        ]

        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache

        client = TestClient(app)
        response = client.get("/api/od/flows?quarter=2025Q4")

        assert response.status_code == 200
        data = response.json()
        assert data["quarter"] == "2025Q4"
        assert data["total_flows"] == 1
        assert data["flows"][0]["origin_adm_cd"] == "1168010100"
        assert data["flows"][0]["trip_count"] == 4200.0
        assert data["flows"][0]["move_purpose"] is None

        app.dependency_overrides.clear()

    def test_empty_result_returns_200(self):
        """데이터 없을 때 빈 배열 반환 (400 아님)."""
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = []

        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache

        client = TestClient(app)
        response = client.get("/api/od/flows?quarter=2025Q4")

        assert response.status_code == 200
        assert response.json()["total_flows"] == 0
        assert response.json()["flows"] == []

        app.dependency_overrides.clear()

    def test_limit_param_capped_at_500(self):
        """limit > 500이면 500으로 클램프."""
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = []

        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache

        client = TestClient(app)
        response = client.get("/api/od/flows?quarter=2025Q4&limit=9999")

        assert response.status_code == 200
        # SQL에 넘어간 limit 값이 500인지는 mock_db.execute 호출 인자로 확인
        call_args = mock_db.execute.call_args
        bound_params = call_args[0][1]  # positional 두 번째 인자 = params dict
        assert bound_params["limit"] == 500

        app.dependency_overrides.clear()
