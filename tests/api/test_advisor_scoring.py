"""어드바이저 점수 계산 + 티어 분류 순수 함수 테스트."""
import pytest
from backend.api.advisor import _compute_advisor_scores, _assign_tiers


class FakeRow:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


def _make_row(comm_cd, comm_nm, gu_nm, gri_score, flow_volume, closure_rate, degree_centrality):
    return FakeRow(
        comm_cd=comm_cd, comm_nm=comm_nm, gu_nm=gu_nm,
        gri_score=gri_score, flow_volume=flow_volume,
        closure_rate=closure_rate, degree_centrality=degree_centrality,
    )


class TestComputeAdvisorScores:
    def test_high_gri_gives_low_score(self):
        rows = [
            _make_row("A", "안전", "강남구", 20.0, 10000, 0.5, 0.8),
            _make_row("B", "위험", "관악구", 90.0, 1000,  5.0, 0.1),
        ]
        scored = _compute_advisor_scores(rows)
        safe = next(s for s in scored if s["comm_cd"] == "A")
        risky = next(s for s in scored if s["comm_cd"] == "B")
        assert safe["advisor_score"] > risky["advisor_score"]

    def test_returns_sorted_descending(self):
        rows = [
            _make_row("A", "낮은점수", "강남구", 80.0, 1000, 4.0, 0.1),
            _make_row("B", "높은점수", "관악구", 20.0, 9000, 0.5, 0.9),
        ]
        scored = _compute_advisor_scores(rows)
        assert scored[0]["comm_cd"] == "B"
        assert scored[1]["comm_cd"] == "A"

    def test_none_values_handled(self):
        rows = [_make_row("A", "결측", "강남구", None, None, None, None)]
        scored = _compute_advisor_scores(rows)
        assert scored[0]["advisor_score"] == pytest.approx(50.0 * 0.35, abs=1.0)

    def test_score_in_range(self):
        rows = [
            _make_row("A", "테스트", "강남구", 50.0, 5000, 2.0, 0.5),
        ]
        scored = _compute_advisor_scores(rows)
        assert 0.0 <= scored[0]["advisor_score"] <= 100.0

    def test_industry_store_count_changes_ranking(self):
        rows = [
            _make_row("A", "low stores", "Gangnam", 50.0, 5000, 2.0, 0.5),
            _make_row("B", "high stores", "Gwanak", 50.0, 5000, 2.0, 0.5),
        ]
        rows[0].industry_store_count = 1
        rows[1].industry_store_count = 100
        scored = _compute_advisor_scores(rows)
        assert scored[0]["comm_cd"] == "B"

    def test_industry_close_rate_overrides_commerce_close_rate(self):
        rows = [_make_row("A", "industry rate", "Gangnam", 50.0, 5000, 9.9, 0.5)]
        rows[0].industry_close_rate = 1.2
        scored = _compute_advisor_scores(rows)
        assert scored[0]["closure_rate"] == 1.2


class TestAssignTiers:
    def test_top_30_percent_is_recommended(self):
        scored = [{"comm_cd": str(i), "advisor_score": float(10 - i)} for i in range(10)]
        result = _assign_tiers(scored)
        assert result[0]["tier"] == "추천"
        assert result[2]["tier"] == "추천"
        assert result[3]["tier"] == "주의"

    def test_bottom_30_percent_is_not_recommended(self):
        scored = [{"comm_cd": str(i), "advisor_score": float(10 - i)} for i in range(10)]
        result = _assign_tiers(scored)
        assert result[7]["tier"] == "비추천"
        assert result[9]["tier"] == "비추천"

    def test_middle_40_percent_is_caution(self):
        scored = [{"comm_cd": str(i), "advisor_score": float(10 - i)} for i in range(10)]
        result = _assign_tiers(scored)
        assert result[3]["tier"] == "주의"
        assert result[6]["tier"] == "주의"

    def test_single_item_gets_recommended(self):
        scored = [{"comm_cd": "A", "advisor_score": 50.0}]
        result = _assign_tiers(scored)
        assert result[0]["tier"] == "추천"


from backend.api.advisor import _build_llm_context


def test_llm_context_includes_comm_cd():
    scored = [{"comm_cd": "A001", "comm_nm": "역삼1동", "gu_nm": "강남구",
               "gri_score": 30.0, "flow_volume": 12000, "closure_rate": 1.0}]
    ctx = _build_llm_context("커피음료", scored)
    assert "A001" in ctx
    assert "커피음료" in ctx
