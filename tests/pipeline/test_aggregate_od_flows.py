"""od_flows → od_flows_aggregated 집계 스크립트 단위 테스트.

in-memory SQLite + PostgreSQL 공통 SQL 사용 부분만 검증.
실제 PostgreSQL UPSERT 구문은 통합 테스트(수동)로 확인.
"""
from __future__ import annotations

from datetime import date

import pandas as pd
import pytest

from backend.pipeline.aggregate_od_flows import (
    _parse_year_quarter,
    aggregate_dataframe,
    derive_year_quarter,
)


class TestParseYearQuarter:
    @pytest.mark.parametrize("good", ["2026Q1", "2026Q2", "2026Q3", "2026Q4", "2019Q1"])
    def test_valid_formats(self, good):
        year, q = _parse_year_quarter(good)
        assert (year, q) == (int(good[:4]), int(good[-1]))

    @pytest.mark.parametrize("bad", ["2026Q0", "2026Q5", "2026Q10", "2026-Q1", "Q1", "", "abc"])
    def test_rejects_malformed(self, bad):
        with pytest.raises(ValueError):
            _parse_year_quarter(bad)


class TestDeriveYearQuarter:
    @pytest.mark.parametrize(
        "input_date,expected",
        [
            (date(2026, 1, 1), "2026Q1"),
            (date(2026, 2, 15), "2026Q1"),
            (date(2026, 3, 31), "2026Q1"),
            (date(2026, 4, 1), "2026Q2"),
            (date(2026, 6, 30), "2026Q2"),
            (date(2026, 7, 1), "2026Q3"),
            (date(2026, 9, 30), "2026Q3"),
            (date(2026, 10, 1), "2026Q4"),
            (date(2026, 12, 31), "2026Q4"),
            (date(2025, 1, 15), "2025Q1"),
        ],
    )
    def test_month_to_quarter_mapping(self, input_date, expected):
        assert derive_year_quarter(input_date) == expected


class TestAggregateDataFrame:
    @pytest.fixture
    def raw_od(self) -> pd.DataFrame:
        """3일치 원본 — 같은 (출, 도, 목적) 조합이 여러 일자·내외국인으로 분산."""
        return pd.DataFrame(
            [
                # 2026Q1 — 1월
                {"base_date": date(2026, 1, 15), "origin_adm_cd": "1168010100", "dest_adm_cd": "1162010100",
                 "move_purpose": 1, "in_forn_div": "내국인", "trip_count": 100.0},
                {"base_date": date(2026, 1, 15), "origin_adm_cd": "1168010100", "dest_adm_cd": "1162010100",
                 "move_purpose": 1, "in_forn_div": "단기외국인", "trip_count": 5.0},
                {"base_date": date(2026, 1, 15), "origin_adm_cd": "1168010100", "dest_adm_cd": "1162010100",
                 "move_purpose": 1, "in_forn_div": "장기외국인", "trip_count": 15.0},
                {"base_date": date(2026, 2, 10), "origin_adm_cd": "1168010100", "dest_adm_cd": "1162010100",
                 "move_purpose": 1, "in_forn_div": "내국인", "trip_count": 80.0},
                # 2026Q1 — 3월 다른 목적
                {"base_date": date(2026, 3, 5), "origin_adm_cd": "1168010100", "dest_adm_cd": "1162010100",
                 "move_purpose": 2, "in_forn_div": "내국인", "trip_count": 50.0},
                # 2026Q2 — 다른 분기
                {"base_date": date(2026, 4, 1), "origin_adm_cd": "1168010100", "dest_adm_cd": "1162010100",
                 "move_purpose": 1, "in_forn_div": "내국인", "trip_count": 200.0},
                # 다른 출도 쌍
                {"base_date": date(2026, 1, 20), "origin_adm_cd": "1168010200", "dest_adm_cd": "1162010200",
                 "move_purpose": 3, "in_forn_div": "내국인", "trip_count": 30.0},
            ]
        )

    def test_sums_across_dates_and_forn_div(self, raw_od):
        """같은 분기·출·도·목적 → 일자·내외국인 합산."""
        result = aggregate_dataframe(raw_od)
        target = result[
            (result["year_quarter"] == "2026Q1")
            & (result["origin_adm_cd"] == "1168010100")
            & (result["dest_adm_cd"] == "1162010100")
            & (result["move_purpose"] == 1)
        ]
        assert len(target) == 1
        # 100 + 5 + 15 (1/15) + 80 (2/10) = 200
        assert target.iloc[0]["trip_count_sum"] == pytest.approx(200.0)

    def test_separates_different_purposes(self, raw_od):
        """목적 차원은 유지 — 같은 분기·출·도여도 목적이 다르면 별도 행."""
        result = aggregate_dataframe(raw_od)
        q1_pair = result[
            (result["year_quarter"] == "2026Q1")
            & (result["origin_adm_cd"] == "1168010100")
            & (result["dest_adm_cd"] == "1162010100")
        ]
        purposes = set(q1_pair["move_purpose"])
        assert purposes == {1, 2}

    def test_separates_different_quarters(self, raw_od):
        """분기가 다르면 합쳐지지 않음."""
        result = aggregate_dataframe(raw_od)
        quarters = set(result["year_quarter"])
        assert "2026Q1" in quarters
        assert "2026Q2" in quarters
        # 2026Q2에는 1월 쌍과 다른 1 건만
        q2 = result[result["year_quarter"] == "2026Q2"]
        assert len(q2) == 1
        assert q2.iloc[0]["trip_count_sum"] == pytest.approx(200.0)

    def test_output_has_required_columns(self, raw_od):
        result = aggregate_dataframe(raw_od)
        required = {"year_quarter", "origin_adm_cd", "dest_adm_cd", "move_purpose", "trip_count_sum"}
        assert required.issubset(result.columns)

    def test_drops_in_forn_div_dimension(self, raw_od):
        result = aggregate_dataframe(raw_od)
        assert "in_forn_div" not in result.columns

    def test_drops_base_date_dimension(self, raw_od):
        result = aggregate_dataframe(raw_od)
        assert "base_date" not in result.columns

    def test_empty_input_returns_empty_dataframe_with_schema(self):
        empty = pd.DataFrame(
            columns=["base_date", "origin_adm_cd", "dest_adm_cd", "move_purpose", "in_forn_div", "trip_count"]
        )
        result = aggregate_dataframe(empty)
        assert result.empty
        assert {"year_quarter", "origin_adm_cd", "dest_adm_cd", "move_purpose", "trip_count_sum"}.issubset(
            result.columns
        )

    def test_filter_by_quarter(self, raw_od):
        """quarter 파라미터 지정 시 해당 분기만 반환."""
        result = aggregate_dataframe(raw_od, quarter="2026Q1")
        assert set(result["year_quarter"]) == {"2026Q1"}

    def test_null_move_purpose_preserved_as_group(self, raw_od):
        """move_purpose가 NULL인 행도 그룹으로 유지."""
        with_null = pd.concat(
            [
                raw_od,
                pd.DataFrame(
                    [
                        {"base_date": date(2026, 1, 5), "origin_adm_cd": "1168010100", "dest_adm_cd": "1162010100",
                         "move_purpose": None, "in_forn_div": "내국인", "trip_count": 10.0},
                    ]
                ),
            ],
            ignore_index=True,
        )
        result = aggregate_dataframe(with_null)
        null_group = result[result["move_purpose"].isna()]
        assert len(null_group) == 1
        assert null_group.iloc[0]["trip_count_sum"] == pytest.approx(10.0)

    def test_input_not_mutated(self, raw_od):
        before = raw_od.copy()
        _ = aggregate_dataframe(raw_od)
        pd.testing.assert_frame_equal(raw_od, before)

    def test_aggregate_dataframe_is_idempotent(self, raw_od):
        """같은 raw를 2번 집계해도 동일 결과 (순서 무관 비교)."""
        first = aggregate_dataframe(raw_od).sort_values(
            ["year_quarter", "origin_adm_cd", "dest_adm_cd", "move_purpose"],
            na_position="last",
        ).reset_index(drop=True)
        second = aggregate_dataframe(raw_od).sort_values(
            ["year_quarter", "origin_adm_cd", "dest_adm_cd", "move_purpose"],
            na_position="last",
        ).reset_index(drop=True)
        pd.testing.assert_frame_equal(first, second)

    def test_trip_count_is_sum_not_mean(self, raw_od):
        """집계 연산이 SUM인지 확인 (평균 아님)."""
        # 단순 케이스: 3건 합
        three_rows = pd.DataFrame(
            [
                {"base_date": date(2026, 1, 1), "origin_adm_cd": "A", "dest_adm_cd": "B",
                 "move_purpose": 1, "in_forn_div": "내국인", "trip_count": 10.0},
                {"base_date": date(2026, 1, 2), "origin_adm_cd": "A", "dest_adm_cd": "B",
                 "move_purpose": 1, "in_forn_div": "내국인", "trip_count": 20.0},
                {"base_date": date(2026, 1, 3), "origin_adm_cd": "A", "dest_adm_cd": "B",
                 "move_purpose": 1, "in_forn_div": "내국인", "trip_count": 30.0},
            ]
        )
        result = aggregate_dataframe(three_rows)
        assert result.iloc[0]["trip_count_sum"] == pytest.approx(60.0)  # SUM=60, MEAN=20
