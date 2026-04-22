"""Module A 입력 어댑터 `load_quarterly_od_flows` 테스트.

DB 연동은 SQLite in-memory로 단순 검증. PostgreSQL 통합 테스트는 수동.
"""
from __future__ import annotations

import pandas as pd
import pytest
from sqlalchemy import create_engine

from backend.analysis.module_a_graph import (
    build_commerce_flow_graph,
    load_quarterly_od_flows,
)
from backend.models import Base, OdFlowAggregated


@pytest.fixture
def in_memory_engine():
    engine = create_engine("sqlite:///:memory:")
    # GeoAlchemy2는 SQLite에서 동작하지 않으므로 od_flows_aggregated만 생성
    OdFlowAggregated.__table__.create(bind=engine)
    return engine


@pytest.fixture
def seeded_engine(in_memory_engine):
    """Q1·Q2 데이터를 넣어둔 엔진."""
    rows = [
        {"id": 1, "year_quarter": "2026Q1", "origin_adm_cd": "1168010100", "dest_adm_cd": "1162010100",
         "move_purpose": 1, "trip_count_sum": 100.0},
        {"id": 2, "year_quarter": "2026Q1", "origin_adm_cd": "1168010100", "dest_adm_cd": "1162010100",
         "move_purpose": 2, "trip_count_sum": 50.0},
        {"id": 3, "year_quarter": "2026Q1", "origin_adm_cd": "1168010200", "dest_adm_cd": "1162010200",
         "move_purpose": 1, "trip_count_sum": 80.0},
        {"id": 4, "year_quarter": "2026Q2", "origin_adm_cd": "1168010100", "dest_adm_cd": "1162010100",
         "move_purpose": 1, "trip_count_sum": 999.0},
    ]
    pd.DataFrame(rows).to_sql("od_flows_aggregated", in_memory_engine, if_exists="append", index=False)
    return in_memory_engine


class TestLoadQuarterlyOdFlows:
    def test_returns_three_columns_for_module_a(self, seeded_engine):
        df = load_quarterly_od_flows(seeded_engine, "2026Q1")
        assert list(df.columns) == ["origin_adm_cd", "dest_adm_cd", "trip_count"]

    def test_filters_by_quarter(self, seeded_engine):
        df = load_quarterly_od_flows(seeded_engine, "2026Q1")
        # Q2의 999는 포함되면 안 됨
        assert 999.0 not in df["trip_count"].tolist()

    def test_sums_purposes_when_not_filtered(self, seeded_engine):
        """move_purpose 필터 없으면 목적 합산."""
        df = load_quarterly_od_flows(seeded_engine, "2026Q1")
        target = df[(df["origin_adm_cd"] == "1168010100") & (df["dest_adm_cd"] == "1162010100")]
        assert len(target) == 1
        assert target.iloc[0]["trip_count"] == pytest.approx(150.0)  # 100 + 50

    def test_filter_by_single_purpose(self, seeded_engine):
        df = load_quarterly_od_flows(seeded_engine, "2026Q1", move_purposes=[1])
        target = df[(df["origin_adm_cd"] == "1168010100") & (df["dest_adm_cd"] == "1162010100")]
        assert target.iloc[0]["trip_count"] == pytest.approx(100.0)  # 목적 1만

    def test_filter_by_multiple_purposes(self, seeded_engine):
        df = load_quarterly_od_flows(seeded_engine, "2026Q1", move_purposes=[1, 2])
        target = df[(df["origin_adm_cd"] == "1168010100") & (df["dest_adm_cd"] == "1162010100")]
        assert target.iloc[0]["trip_count"] == pytest.approx(150.0)

    def test_empty_quarter_returns_empty_df_with_schema(self, seeded_engine):
        df = load_quarterly_od_flows(seeded_engine, "2099Q1")
        assert df.empty
        assert list(df.columns) == ["origin_adm_cd", "dest_adm_cd", "trip_count"]

    def test_rejects_malformed_year_quarter(self, seeded_engine):
        with pytest.raises(ValueError):
            load_quarterly_od_flows(seeded_engine, "2026-Q1")
        with pytest.raises(ValueError):
            load_quarterly_od_flows(seeded_engine, "2026Q5")

    def test_result_feeds_module_a_without_error(self, seeded_engine):
        """로드 결과를 Module A에 바로 주입해도 동작."""
        od_df = load_quarterly_od_flows(seeded_engine, "2026Q1")
        mapping = pd.DataFrame(
            [
                {"adm_cd": "1168010100", "comm_cd": "C-GN-A", "comm_area_ratio": 1.0},
                {"adm_cd": "1162010100", "comm_cd": "C-GW-A", "comm_area_ratio": 1.0},
                {"adm_cd": "1168010200", "comm_cd": "C-GN-B", "comm_area_ratio": 1.0},
                {"adm_cd": "1162010200", "comm_cd": "C-GW-B", "comm_area_ratio": 1.0},
            ]
        )
        g = build_commerce_flow_graph(od_df, mapping)
        assert g.number_of_edges() >= 1
