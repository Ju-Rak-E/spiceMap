"""GET /api/data-sources 엔드포인트 테스트."""
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


class TestDataSources:
    def test_returns_200(self):
        response = client.get("/api/data-sources")
        assert response.status_code == 200

    def test_has_required_datasets(self):
        data = client.get("/api/data-sources").json()
        sources = data["sources"]
        assert "od_flows" in sources
        assert "living_population" in sources
        assert "store_info" in sources
        assert "commerce_sales" in sources

    def test_dataset_has_portal_id(self):
        sources = client.get("/api/data-sources").json()["sources"]
        assert sources["od_flows"]["dataset_id"] == "OA-22300"
        assert sources["living_population"]["dataset_id"] == "OA-14991"
        assert sources["store_info"]["dataset_id"] == "OA-15577"
        assert sources["commerce_sales"]["dataset_id"] == "OA-15572"

    def test_each_source_has_fields(self):
        sources = client.get("/api/data-sources").json()["sources"]
        for name, src in sources.items():
            assert "fields" in src, f"{name} missing fields"
            assert isinstance(src["fields"], list)
            assert len(src["fields"]) > 0

    def test_total_matches_sources_count(self):
        data = client.get("/api/data-sources").json()
        assert data["total"] == len(data["sources"])
