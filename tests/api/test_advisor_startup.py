"""POST /api/advisor/startup 엔드포인트 테스트 (통계 전용)."""
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from backend.main import app
from backend.api.deps import get_session, get_cache


def _mock_cache():
    c = MagicMock()
    c.get.return_value = None
    return c


class FakeRow:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


def _make_commerce_rows():
    return [
        FakeRow(comm_cd="A001", comm_nm="역삼1동", gu_nm="강남구",
                gri_score=30.0, flow_volume=12000, closure_rate=1.0, degree_centrality=0.8),
        FakeRow(comm_cd="A002", comm_nm="봉천2동", gu_nm="관악구",
                gri_score=50.0, flow_volume=6000, closure_rate=2.0, degree_centrality=0.4),
        FakeRow(comm_cd="A003", comm_nm="신림1동", gu_nm="관악구",
                gri_score=80.0, flow_volume=2000, closure_rate=4.0, degree_centrality=0.2),
    ]


class TestAdvisorStartup:
    def _setup(self, rows):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = rows
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache

    def test_returns_200_with_commerces(self):
        self._setup(_make_commerce_rows())
        client = TestClient(app)
        with patch("backend.api.advisor._call_claude", return_value=("", "", {})):
            response = client.post(
                "/api/advisor/startup",
                json={"industry_nm": "커피음료", "quarter": "2025Q4"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["industry_nm"] == "커피음료"
        assert len(data["commerces"]) == 3
        app.dependency_overrides.clear()

    def test_first_commerce_is_recommended(self):
        self._setup(_make_commerce_rows())
        client = TestClient(app)
        with patch("backend.api.advisor._call_claude", return_value=("", "", {})):
            response = client.post(
                "/api/advisor/startup",
                json={"industry_nm": "커피음료", "quarter": "2025Q4"},
            )
        data = response.json()
        assert data["commerces"][0]["tier"] == "추천"
        assert data["commerces"][-1]["tier"] == "비추천"
        app.dependency_overrides.clear()

    def test_returns_422_when_no_commerces(self):
        self._setup([])
        client = TestClient(app)
        response = client.post(
            "/api/advisor/startup",
            json={"industry_nm": "커피음료", "quarter": "2024Q1"},
        )
        assert response.status_code == 422
        app.dependency_overrides.clear()

    def test_llm_failure_returns_empty_summary(self):
        """Claude API 실패 시 summary/caution이 빈 문자열이고 200 반환."""
        self._setup(_make_commerce_rows())
        client = TestClient(app)
        with patch("backend.api.advisor._call_claude", return_value=("", "", {})):
            response = client.post(
                "/api/advisor/startup",
                json={"industry_nm": "커피음료", "quarter": "2025Q4"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["summary"] == ""
        assert data["caution"] == ""
        assert data["model_used"] == "none"
        app.dependency_overrides.clear()

    def test_llm_success_fills_summary(self):
        """Claude API 성공 시 summary/caution/llm_reason이 채워짐."""
        self._setup(_make_commerce_rows())
        client = TestClient(app)
        fake_reasons = {"A001": "유동인구가 많아 유리합니다."}
        with patch(
            "backend.api.advisor._call_claude",
            return_value=("전체 요약 텍스트", "주의사항 텍스트", fake_reasons),
        ):
            response = client.post(
                "/api/advisor/startup",
                json={"industry_nm": "커피음료", "quarter": "2025Q4"},
            )
        data = response.json()
        assert data["summary"] == "전체 요약 텍스트"
        assert data["caution"] == "주의사항 텍스트"
        assert data["model_used"] == "claude-haiku-4-5"
        first = next(c for c in data["commerces"] if c["comm_cd"] == "A001")
        assert first["llm_reason"] == "유동인구가 많아 유리합니다."
        app.dependency_overrides.clear()
