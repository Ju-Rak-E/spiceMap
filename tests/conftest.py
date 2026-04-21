"""공용 테스트 fixtures.

od_flows/admin_boundary/commerce_boundary 테이블이 0건인 현 상태에서
Module A/B를 TDD 선행 구현하기 위한 더미 데이터 제공.
"""
from __future__ import annotations

import pandas as pd
import pytest


@pytest.fixture
def dummy_od_flows() -> pd.DataFrame:
    """강남·관악 대표 행정동 5개 사이의 OD 이동.

    Columns: origin_adm_cd, dest_adm_cd, trip_count
    """
    return pd.DataFrame(
        [
            {"origin_adm_cd": "1168010100", "dest_adm_cd": "1168010200", "trip_count": 1000.0},
            {"origin_adm_cd": "1168010200", "dest_adm_cd": "1168010100", "trip_count": 400.0},
            {"origin_adm_cd": "1168010100", "dest_adm_cd": "1121010100", "trip_count": 250.0},
            {"origin_adm_cd": "1121010100", "dest_adm_cd": "1168010100", "trip_count": 700.0},
            {"origin_adm_cd": "1121010200", "dest_adm_cd": "1121010100", "trip_count": 100.0},
            {"origin_adm_cd": "1168010100", "dest_adm_cd": "1168010100", "trip_count": 9999.0},
        ]
    )


@pytest.fixture
def dummy_mapping() -> pd.DataFrame:
    """행정동→상권 매핑 (면적 비율 1.0으로 단순화).

    1168: 강남 행정동, 1121: 관악 행정동
    C-GN-A: 강남 A상권 / C-GN-B: 강남 B상권 / C-GW-A: 관악 A상권
    """
    return pd.DataFrame(
        [
            {"adm_cd": "1168010100", "comm_cd": "C-GN-A", "comm_area_ratio": 1.0},
            {"adm_cd": "1168010200", "comm_cd": "C-GN-B", "comm_area_ratio": 1.0},
            {"adm_cd": "1121010100", "comm_cd": "C-GW-A", "comm_area_ratio": 1.0},
            {"adm_cd": "1121010200", "comm_cd": "C-GW-A", "comm_area_ratio": 1.0},
        ]
    )


@pytest.fixture
def dummy_mapping_split() -> pd.DataFrame:
    """하나의 행정동이 두 상권에 분할 매핑된 경우.

    1168010100은 C-GN-A에 0.6, C-GN-B에 0.4로 배분된다.
    """
    return pd.DataFrame(
        [
            {"adm_cd": "1168010100", "comm_cd": "C-GN-A", "comm_area_ratio": 0.6},
            {"adm_cd": "1168010100", "comm_cd": "C-GN-B", "comm_area_ratio": 0.4},
            {"adm_cd": "1168010200", "comm_cd": "C-GN-B", "comm_area_ratio": 1.0},
        ]
    )


@pytest.fixture
def gri_input_df() -> pd.DataFrame:
    """GRI 산출용 입력 — 상권 5곳의 지표.

    기대: C5는 폐업률↑, 순유출↑, 고립↑ → 최고 위험.
    """
    return pd.DataFrame(
        [
            {"commerce_code": "C1", "quarter": "2025Q4", "closure_rate": 5.0,  "net_flow":  1000.0, "degree_centrality": 0.8},
            {"commerce_code": "C2", "quarter": "2025Q4", "closure_rate": 8.0,  "net_flow":   500.0, "degree_centrality": 0.6},
            {"commerce_code": "C3", "quarter": "2025Q4", "closure_rate": 11.0, "net_flow":     0.0, "degree_centrality": 0.4},
            {"commerce_code": "C4", "quarter": "2025Q4", "closure_rate": 14.0, "net_flow":  -500.0, "degree_centrality": 0.2},
            {"commerce_code": "C5", "quarter": "2025Q4", "closure_rate": 20.0, "net_flow": -1000.0, "degree_centrality": 0.05},
        ]
    )


@pytest.fixture
def h1_analysis_df() -> pd.DataFrame:
    """H1 상관 검증용 — 순유입 (양의 상관 설계)."""
    return pd.DataFrame(
        [
            {"commerce_code": "C1", "net_flow": -800},
            {"commerce_code": "C2", "net_flow": -300},
            {"commerce_code": "C3", "net_flow":    0},
            {"commerce_code": "C4", "net_flow":  400},
            {"commerce_code": "C5", "net_flow": 1200},
        ]
    )


@pytest.fixture
def h1_sales_df() -> pd.DataFrame:
    """H1 상관 검증용 — 매출 (C1~C5가 analysis와 매칭).

    net_flow와 양의 상관이 나오도록 단조 증가 값 설계.
    """
    return pd.DataFrame(
        [
            {"trdar_cd": "C1", "sales_amount": 1_000_000},
            {"trdar_cd": "C2", "sales_amount": 2_500_000},
            {"trdar_cd": "C3", "sales_amount": 4_000_000},
            {"trdar_cd": "C4", "sales_amount": 5_200_000},
            {"trdar_cd": "C5", "sales_amount": 8_000_000},
            {"trdar_cd": "UNMATCHED", "sales_amount": 999_999},
        ]
    )
