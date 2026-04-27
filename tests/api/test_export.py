"""GET /api/export/csv 엔드포인트 테스트."""
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


class TestExportCsv:
    def test_returns_csv_content_type(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = []
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)
        response = client.get("/api/export/csv?quarter=2025Q4")
        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]
        app.dependency_overrides.clear()

    def test_csv_contains_header_row(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = []
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)
        response = client.get("/api/export/csv?quarter=2025Q4")
        content = response.content.decode("utf-8-sig")
        first_line = content.strip().splitlines()[0]
        assert "상권코드" in first_line
        assert "우선순위점수" in first_line
        app.dependency_overrides.clear()

    def test_csv_contains_data_rows(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = [
            FakeRow(
                comm_cd="3110053",
                comm_nm="신림 골목상권",
                gu_nm="관악구",
                commerce_type="방출형_침체",
                gri_score=74.2,
                priority_score=87.3,
                closure_rate=8.1,
                net_flow=-320.0,
                policy_summary="젠트리피케이션 예방",
            )
        ]
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)
        response = client.get("/api/export/csv?quarter=2025Q4")
        content = response.content.decode("utf-8-sig")
        lines = content.strip().splitlines()
        assert len(lines) == 2  # 헤더 + 데이터 1행
        assert "3110053" in lines[1]
        assert "신림 골목상권" in lines[1]
        app.dependency_overrides.clear()

    def test_filename_contains_quarter(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = []
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)
        response = client.get("/api/export/csv?quarter=2025Q4")
        disposition = response.headers.get("content-disposition", "")
        assert "2025Q4" in disposition
        app.dependency_overrides.clear()
