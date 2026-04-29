"""분석 INSERT 파이프라인 (run_analysis) 테스트.

`compose_analysis`는 순수 함수 — Module A/B/D/E를 조합하여 commerce_analysis
INSERT 행 + policy_cards INSERT 행을 반환한다.

`run_analysis`는 SQLAlchemy Engine을 받아 collect→compose→write 전체를 실행.
SQLite in-memory로 통합 테스트.
"""
from __future__ import annotations

import pandas as pd
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from backend.pipeline.run_analysis import (
    AnalysisInputs,
    AnalysisResult,
    compose_analysis,
    quarter_to_legacy,
    run_analysis,
)


@pytest.fixture
def od_flows_input() -> pd.DataFrame:
    """Module A 입력 (origin/dest/trip)."""
    return pd.DataFrame(
        [
            {"origin_adm_cd": "A1", "dest_adm_cd": "A2", "trip_count": 1000.0},
            {"origin_adm_cd": "A2", "dest_adm_cd": "A1", "trip_count": 200.0},
            {"origin_adm_cd": "A1", "dest_adm_cd": "A3", "trip_count": 500.0},
            {"origin_adm_cd": "A3", "dest_adm_cd": "A1", "trip_count": 100.0},
            {"origin_adm_cd": "A2", "dest_adm_cd": "A3", "trip_count": 300.0},
        ]
    )


@pytest.fixture
def mapping_input() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"adm_cd": "A1", "comm_cd": "C1", "comm_area_ratio": 1.0},
            {"adm_cd": "A2", "comm_cd": "C2", "comm_area_ratio": 1.0},
            {"adm_cd": "A3", "comm_cd": "C3", "comm_area_ratio": 1.0},
        ]
    )


@pytest.fixture
def closure_input() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"comm_cd": "C1", "closure_rate": 6.0},
            {"comm_cd": "C2", "closure_rate": 4.5},
            {"comm_cd": "C3", "closure_rate": 12.0},
        ]
    )


@pytest.fixture
def commerce_meta() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"comm_cd": "C1", "comm_nm": "C1상권"},
            {"comm_cd": "C2", "comm_nm": "C2상권"},
            {"comm_cd": "C3", "comm_nm": "C3상권"},
        ]
    )


@pytest.fixture
def sales_input() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"trdar_cd": "C1", "year_quarter": "2025Q4", "sales_amount": 5_000_000},
            {"trdar_cd": "C2", "year_quarter": "2025Q4", "sales_amount": 3_000_000},
            {"trdar_cd": "C3", "year_quarter": "2025Q4", "sales_amount": 1_000_000},
            {"trdar_cd": "C1", "year_quarter": "2025Q3", "sales_amount": 6_000_000},
            {"trdar_cd": "C2", "year_quarter": "2025Q3", "sales_amount": 3_300_000},
            {"trdar_cd": "C3", "year_quarter": "2025Q3", "sales_amount": 1_100_000},
        ]
    )


@pytest.fixture
def composable_inputs(
    od_flows_input,
    mapping_input,
    closure_input,
    commerce_meta,
    sales_input,
) -> AnalysisInputs:
    return AnalysisInputs(
        od_flows=od_flows_input,
        mapping=mapping_input,
        closures=closure_input,
        commerce_meta=commerce_meta,
        sales=sales_input,
    )


class TestQuarterToLegacy:
    @pytest.mark.parametrize(
        "input_q,expected",
        [("2025Q1", "20251"), ("2025Q4", "20254"), ("2026Q2", "20262")],
    )
    def test_yyyyq_dash_to_yyyyq(self, input_q, expected):
        assert quarter_to_legacy(input_q) == expected

    def test_invalid_format_raises(self):
        with pytest.raises(ValueError):
            quarter_to_legacy("2025-Q4")


class TestComposeAnalysis:
    def test_returns_analysis_result_with_rows_and_cards(self, composable_inputs):
        result = compose_analysis(composable_inputs, "2025Q4", "2025Q3")
        assert isinstance(result, AnalysisResult)
        assert isinstance(result.analysis_rows, list)
        assert isinstance(result.policy_cards, list)

    def test_analysis_rows_one_per_commerce(self, composable_inputs):
        result = compose_analysis(composable_inputs, "2025Q4", "2025Q3")
        codes = {row["comm_cd"] for row in result.analysis_rows}
        assert codes == {"C1", "C2", "C3"}

    def test_each_row_has_full_schema(self, composable_inputs):
        result = compose_analysis(composable_inputs, "2025Q4", "2025Q3")
        required = {
            "year_quarter",
            "comm_cd",
            "comm_nm",
            "gri_score",
            "flow_volume",
            "dominant_origin",
            "commerce_type",
            "priority_score",
            "net_flow",
            "degree_centrality",
            "closure_rate",
        }
        for row in result.analysis_rows:
            assert required.issubset(row.keys())

    def test_year_quarter_uses_target(self, composable_inputs):
        result = compose_analysis(composable_inputs, "2025Q4", "2025Q3")
        for row in result.analysis_rows:
            assert row["year_quarter"] == "2025Q4"

    def test_closure_rate_propagated(self, composable_inputs):
        result = compose_analysis(composable_inputs, "2025Q4", "2025Q3")
        c3 = next(r for r in result.analysis_rows if r["comm_cd"] == "C3")
        assert c3["closure_rate"] == pytest.approx(12.0)

    def test_priority_score_in_0_100_range(self, composable_inputs):
        result = compose_analysis(composable_inputs, "2025Q4", "2025Q3")
        for row in result.analysis_rows:
            assert row["priority_score"] is None or 0 <= row["priority_score"] <= 100

    def test_no_od_flows_yields_zero_centrality(
        self,
        mapping_input,
        closure_input,
        commerce_meta,
        sales_input,
    ):
        empty_od = pd.DataFrame(columns=["origin_adm_cd", "dest_adm_cd", "trip_count"])
        inputs = AnalysisInputs(
            od_flows=empty_od,
            mapping=mapping_input,
            closures=closure_input,
            commerce_meta=commerce_meta,
            sales=sales_input,
        )
        result = compose_analysis(inputs, "2025Q4", None)
        for row in result.analysis_rows:
            assert row["net_flow"] in (0, 0.0)
            assert row["degree_centrality"] in (0, 0.0)

    def test_policy_cards_have_active_rule_ids(self, composable_inputs):
        result = compose_analysis(composable_inputs, "2025Q4", "2025Q3")
        for card in result.policy_cards:
            assert card.rule_id in {"R4", "R5", "R6", "R7"}

    def test_idempotent_same_inputs_same_outputs(self, composable_inputs):
        first = compose_analysis(composable_inputs, "2025Q4", "2025Q3")
        second = compose_analysis(composable_inputs, "2025Q4", "2025Q3")
        assert [r["comm_cd"] for r in first.analysis_rows] == [
            r["comm_cd"] for r in second.analysis_rows
        ]
        assert [c.rule_id for c in first.policy_cards] == [
            c.rule_id for c in second.policy_cards
        ]


def _create_schema(engine: Engine) -> None:
    """SQLite에 통합 테스트용 최소 스키마 생성."""
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE od_flows_aggregated (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                year_quarter TEXT NOT NULL,
                origin_adm_cd TEXT NOT NULL,
                dest_adm_cd TEXT NOT NULL,
                move_purpose INTEGER,
                trip_count_sum REAL NOT NULL
            )
        """))
        conn.execute(text("""
            CREATE TABLE adm_comm_mapping (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                adm_cd TEXT NOT NULL,
                comm_cd TEXT NOT NULL,
                comm_area_ratio REAL
            )
        """))
        conn.execute(text("""
            CREATE TABLE commerce_boundary (
                comm_cd TEXT PRIMARY KEY,
                comm_nm TEXT NOT NULL
            )
        """))
        conn.execute(text("""
            CREATE TABLE store_info (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                year_quarter TEXT NOT NULL,
                signgu_cd TEXT NOT NULL,
                signgu_nm TEXT,
                close_rate REAL,
                close_count REAL,
                store_count REAL
            )
        """))
        conn.execute(text("""
            CREATE TABLE commerce_sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                year_quarter TEXT NOT NULL,
                trdar_cd TEXT NOT NULL,
                sales_amount REAL
            )
        """))
        conn.execute(text("""
            CREATE TABLE commerce_analysis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                year_quarter TEXT NOT NULL,
                comm_cd TEXT NOT NULL,
                comm_nm TEXT,
                gri_score REAL,
                flow_volume INTEGER,
                dominant_origin TEXT,
                analysis_note TEXT,
                commerce_type TEXT,
                priority_score REAL,
                net_flow REAL,
                degree_centrality REAL,
                closure_rate REAL
            )
        """))
        conn.execute(text("""
            CREATE TABLE policy_cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                year_quarter TEXT NOT NULL,
                comm_cd TEXT NOT NULL,
                rule_id TEXT NOT NULL,
                severity TEXT NOT NULL,
                policy_text TEXT NOT NULL,
                rationale TEXT,
                triggering_metrics TEXT,
                generation_mode TEXT NOT NULL DEFAULT 'rule_based'
            )
        """))


def _seed_data(engine: Engine) -> None:
    """C1, C2, C3 3상권 미니 데이터셋."""
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO od_flows_aggregated (year_quarter, origin_adm_cd, dest_adm_cd, move_purpose, trip_count_sum) VALUES
            ('2025Q4', 'A1', 'A2', NULL, 1000.0),
            ('2025Q4', 'A2', 'A1', NULL, 200.0),
            ('2025Q4', 'A1', 'A3', NULL, 500.0),
            ('2025Q4', 'A3', 'A1', NULL, 100.0),
            ('2025Q4', 'A2', 'A3', NULL, 300.0)
        """))
        conn.execute(text("""
            INSERT INTO adm_comm_mapping (adm_cd, comm_cd, comm_area_ratio) VALUES
            ('A1', 'C1', 1.0), ('A2', 'C2', 1.0), ('A3', 'C3', 1.0)
        """))
        conn.execute(text("""
            INSERT INTO commerce_boundary (comm_cd, comm_nm) VALUES
            ('C1', 'C1상권'), ('C2', 'C2상권'), ('C3', 'C3상권')
        """))
        conn.execute(text("""
            INSERT INTO store_info (year_quarter, signgu_cd, signgu_nm, close_rate, close_count, store_count) VALUES
            ('20254', 'GU1', 'C1상권', 6.0, 10, 100),
            ('20254', 'GU2', 'C2상권', 4.5, 8, 200),
            ('20254', 'GU3', 'C3상권', 12.0, 25, 200)
        """))
        conn.execute(text("""
            INSERT INTO commerce_sales (year_quarter, trdar_cd, sales_amount) VALUES
            ('20254', 'C1', 5000000), ('20254', 'C2', 3000000), ('20254', 'C3', 1000000),
            ('20253', 'C1', 6000000), ('20253', 'C2', 3300000), ('20253', 'C3', 1100000)
        """))


class TestRunAnalysisIntegration:
    def test_pipeline_writes_analysis_rows(self):
        engine = create_engine("sqlite:///:memory:")
        _create_schema(engine)
        _seed_data(engine)

        counts = run_analysis(engine, target_quarter="2025Q4", previous_quarter="2025Q3")
        assert counts["analysis_rows"] == 3

        with engine.connect() as conn:
            rows = conn.execute(
                text("SELECT comm_cd, gri_score, net_flow, closure_rate FROM commerce_analysis")
            ).fetchall()
        assert len(rows) == 3
        codes = {r._mapping["comm_cd"] for r in rows}
        assert codes == {"C1", "C2", "C3"}

    def test_pipeline_is_idempotent_on_reruns(self):
        engine = create_engine("sqlite:///:memory:")
        _create_schema(engine)
        _seed_data(engine)

        run_analysis(engine, "2025Q4", "2025Q3")
        run_analysis(engine, "2025Q4", "2025Q3")

        with engine.connect() as conn:
            rows = conn.execute(text("SELECT COUNT(*) FROM commerce_analysis")).scalar()
        assert rows == 3

    def test_pipeline_clears_existing_quarter_before_insert(self):
        engine = create_engine("sqlite:///:memory:")
        _create_schema(engine)
        _seed_data(engine)

        # 더미 행 사전 삽입
        with engine.begin() as conn:
            conn.execute(text(
                "INSERT INTO commerce_analysis (year_quarter, comm_cd, comm_nm) "
                "VALUES ('2025Q4', 'C99', '삭제 대상')"
            ))

        run_analysis(engine, "2025Q4", "2025Q3")

        with engine.connect() as conn:
            stale = conn.execute(
                text("SELECT COUNT(*) FROM commerce_analysis WHERE comm_cd = 'C99'")
            ).scalar()
        assert stale == 0

    def test_pipeline_writes_policy_cards(self):
        engine = create_engine("sqlite:///:memory:")
        _create_schema(engine)
        _seed_data(engine)
        run_analysis(engine, "2025Q4", "2025Q3")

        with engine.connect() as conn:
            cards = conn.execute(
                text("SELECT rule_id, severity, generation_mode FROM policy_cards")
            ).fetchall()
        for c in cards:
            assert c._mapping["rule_id"] in {"R4", "R5", "R6", "R7"}
            assert c._mapping["generation_mode"] == "rule_based"

    def test_pipeline_returns_counts_dict(self):
        engine = create_engine("sqlite:///:memory:")
        _create_schema(engine)
        _seed_data(engine)
        counts = run_analysis(engine, "2025Q4", "2025Q3")
        assert "analysis_rows" in counts
        assert "policy_cards" in counts
