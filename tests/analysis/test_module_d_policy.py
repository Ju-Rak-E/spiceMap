"""Module D — 정책 추천 카드 생성 테스트 (R4~R7 활성)."""
from __future__ import annotations

import pandas as pd
import pytest

from backend.analysis.module_d_policy import (
    ACTIVE_RULE_IDS,
    generate_policy_cards,
)
from backend.schemas.insights import PolicyCard


@pytest.fixture
def classified_df() -> pd.DataFrame:
    """사전 분류된 데이터 (classify_commerce_types를 거쳤다고 가정)."""
    return pd.DataFrame(
        [
            # R4: 흡수형_과열 + GRI≥70 → Critical
            {"commerce_code": "R4A", "commerce_name": "압구정",   "commerce_type": "흡수형_과열",
             "gri_score": 82.0, "net_flow": 2500.0, "degree_centrality": 0.85, "closure_rate": 3.0},
            # R5: 흡수형_과열 + GRI 50~70 → Medium
            {"commerce_code": "R5A", "commerce_name": "청담",     "commerce_type": "흡수형_과열",
             "gri_score": 60.0, "net_flow": 1800.0, "degree_centrality": 0.7, "closure_rate": 2.5},
            # R6: 흡수형_성장 + GRI<40 → Low
            {"commerce_code": "R6A", "commerce_name": "봉천",     "commerce_type": "흡수형_성장",
             "gri_score": 25.0, "net_flow": 1500.0, "degree_centrality": 0.6, "closure_rate": 1.2},
            # R7: 안정형 + GRI<30 → Low
            {"commerce_code": "R7A", "commerce_name": "잠실본동", "commerce_type": "안정형",
             "gri_score": 18.0, "net_flow": 200.0, "degree_centrality": 0.5, "closure_rate": 0.8},
            # 안정형이지만 GRI 45 → R7 미발동
            {"commerce_code": "STA2", "commerce_name": "신림",    "commerce_type": "안정형",
             "gri_score": 45.0, "net_flow": 180.0, "degree_centrality": 0.5, "closure_rate": 1.0},
            # unclassified — R4~R7 모두 미발동
            {"commerce_code": "UNK", "commerce_name": "학동",    "commerce_type": "unclassified",
             "gri_score": 50.0, "net_flow": 800.0, "degree_centrality": 0.4, "closure_rate": 3.5},
            # 흡수형_과열 경계 GRI=70 → R4 발동 (GRI ≥ 70), R5는 아님
            {"commerce_code": "B70", "commerce_name": "가로수길", "commerce_type": "흡수형_과열",
             "gri_score": 70.0, "net_flow": 2000.0, "degree_centrality": 0.75, "closure_rate": 2.8},
        ]
    )


class TestGeneratePolicyCards:
    def test_r4_triggers_for_hot_absorbing_high_gri(self, classified_df):
        cards = generate_policy_cards(classified_df)
        matched = [c for c in cards if c.commerce_code == "R4A"]
        assert len(matched) == 1
        assert matched[0].rule_id == "R4"
        assert matched[0].severity == "Critical"

    def test_r4_at_boundary_70_triggers_not_r5(self, classified_df):
        cards = generate_policy_cards(classified_df)
        b70 = [c for c in cards if c.commerce_code == "B70"]
        assert len(b70) == 1
        assert b70[0].rule_id == "R4"

    def test_r5_triggers_middle_gri(self, classified_df):
        cards = generate_policy_cards(classified_df)
        matched = [c for c in cards if c.commerce_code == "R5A"]
        assert len(matched) == 1
        assert matched[0].rule_id == "R5"
        assert matched[0].severity == "Medium"

    def test_r6_triggers_growth_absorbing_low_gri(self, classified_df):
        cards = generate_policy_cards(classified_df)
        matched = [c for c in cards if c.commerce_code == "R6A"]
        assert len(matched) == 1
        assert matched[0].rule_id == "R6"
        assert matched[0].severity == "Low"

    def test_r7_triggers_stable_very_low_gri(self, classified_df):
        cards = generate_policy_cards(classified_df)
        matched = [c for c in cards if c.commerce_code == "R7A"]
        assert len(matched) == 1
        assert matched[0].rule_id == "R7"

    def test_r7_not_triggered_for_stable_mid_gri(self, classified_df):
        cards = generate_policy_cards(classified_df)
        assert not any(c.commerce_code == "STA2" for c in cards)

    def test_unclassified_produces_no_cards(self, classified_df):
        cards = generate_policy_cards(classified_df)
        assert not any(c.commerce_code == "UNK" for c in cards)

    def test_empty_input_returns_empty_list(self):
        empty = pd.DataFrame(
            columns=["commerce_code", "commerce_name", "commerce_type", "gri_score", "net_flow", "degree_centrality", "closure_rate"]
        )
        assert generate_policy_cards(empty) == []

    def test_all_cards_are_rule_based(self, classified_df):
        cards = generate_policy_cards(classified_df)
        assert cards, "fixture에서 최소 1건은 발동해야 함"
        for c in cards:
            assert c.generation_mode == "rule_based"

    def test_all_cards_have_non_empty_rationale(self, classified_df):
        cards = generate_policy_cards(classified_df)
        for c in cards:
            assert c.rationale.strip() != ""

    def test_active_rules_are_r4_r7_only(self):
        assert ACTIVE_RULE_IDS == frozenset({"R4", "R5", "R6", "R7"})

    def test_cards_returned_sorted_by_severity_desc(self, classified_df):
        """같은 상권에 여러 규칙이 발동되지 않는 fixture지만, 전체 출력은 Critical→High→Medium→Low 순."""
        cards = generate_policy_cards(classified_df)
        order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
        severities = [order[c.severity] for c in cards]
        assert severities == sorted(severities)

    def test_triggering_metrics_contains_gri_score(self, classified_df):
        cards = generate_policy_cards(classified_df)
        for c in cards:
            assert "gri_score" in c.triggering_metrics

    def test_policy_card_is_pydantic_instance(self, classified_df):
        cards = generate_policy_cards(classified_df)
        for c in cards:
            assert isinstance(c, PolicyCard)

    def test_r7_not_triggered_at_boundary_gri_30(self):
        """R7은 GRI < 30 (strict), GRI=30은 미발동."""
        df = pd.DataFrame(
            [
                {"commerce_code": "B30", "commerce_name": "경계상권", "commerce_type": "안정형",
                 "gri_score": 30.0, "net_flow": 100.0, "degree_centrality": 0.5, "closure_rate": 1.0},
            ]
        )
        cards = generate_policy_cards(df)
        assert cards == []

    def test_triggering_metrics_includes_all_four_indicators(self, classified_df):
        """FR-07 설명 가능성: UI가 표시할 4 지표가 항상 채워져야 한다."""
        cards = generate_policy_cards(classified_df)
        assert cards
        for c in cards:
            for key in ("gri_score", "net_flow", "degree_centrality", "closure_rate"):
                assert key in c.triggering_metrics, f"{c.rule_id} 카드에 {key} 누락"


class TestIntegrationClassifyAndGenerate:
    """classify_commerce_types → generate_policy_cards 파이프라인 통합 테스트."""

    def test_full_pipeline_produces_expected_cards(self):
        """9행으로 구성하여 P75 임계가 top-3 상권과 정렬되게 한다.

        net_flow sorted: [50, 100, 200, 300, 400, 700, 2300, 2400, 2500]
        numpy P75 (index=6): 2300 → A1/A2/A3 모두 흡수형 진입.
        """
        from backend.analysis.commerce_type import classify_commerce_types

        raw = pd.DataFrame(
            [
                # A1: 흡수형_과열 + GRI=82 → R4
                {"commerce_code": "A1", "commerce_name": "압구정",   "net_flow": 2500.0, "gri_score": 82.0, "degree_centrality": 0.85, "closure_rate": 3.0},
                # A2: 흡수형_과열 + GRI=60 → R5
                {"commerce_code": "A2", "commerce_name": "청담",     "net_flow": 2400.0, "gri_score": 60.0, "degree_centrality": 0.80, "closure_rate": 2.5},
                # A3: 흡수형_성장 + GRI=25 → R6
                {"commerce_code": "A3", "commerce_name": "봉천",     "net_flow": 2300.0, "gri_score": 25.0, "degree_centrality": 0.70, "closure_rate": 1.2},
                # A4: 안정형 + GRI=18 → R7 (mid flow)
                {"commerce_code": "A4", "commerce_name": "잠실본동", "net_flow":  700.0, "gri_score": 18.0, "degree_centrality": 0.55, "closure_rate": 0.8},
                # 보조 데이터 (percentile 확보용, 규칙 미발동)
                {"commerce_code": "S1", "commerce_name": "보조1",    "net_flow":  400.0, "gri_score": 50.0, "degree_centrality": 0.45, "closure_rate": 2.0},
                {"commerce_code": "S2", "commerce_name": "보조2",    "net_flow":  300.0, "gri_score": 50.0, "degree_centrality": 0.40, "closure_rate": 2.5},
                {"commerce_code": "S3", "commerce_name": "보조3",    "net_flow":  200.0, "gri_score": 50.0, "degree_centrality": 0.38, "closure_rate": 2.5},
                {"commerce_code": "S4", "commerce_name": "보조4",    "net_flow":  100.0, "gri_score": 45.0, "degree_centrality": 0.35, "closure_rate": 2.5},
                {"commerce_code": "S5", "commerce_name": "보조5",    "net_flow":   50.0, "gri_score": 45.0, "degree_centrality": 0.32, "closure_rate": 2.5},
            ]
        )

        classified = classify_commerce_types(raw)
        cards = generate_policy_cards(classified)

        by_code = {c.commerce_code: c for c in cards}
        assert by_code["A1"].rule_id == "R4"
        assert by_code["A2"].rule_id == "R5"
        assert by_code["A3"].rule_id == "R6"
        assert by_code["A4"].rule_id == "R7"
