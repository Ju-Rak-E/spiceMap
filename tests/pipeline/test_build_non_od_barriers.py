from __future__ import annotations

from sqlalchemy import create_engine, text

from backend.pipeline import build_non_od_barriers as mod


def _create_schema(engine):
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE commerce_analysis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                year_quarter TEXT NOT NULL,
                comm_cd TEXT NOT NULL,
                gri_score REAL,
                closure_rate REAL
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
            CREATE TABLE flow_barriers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                year_quarter TEXT NOT NULL,
                from_comm_cd TEXT,
                to_comm_cd TEXT,
                barrier_score REAL,
                barrier_type TEXT
            )
        """))


def _seed(engine):
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO commerce_analysis (year_quarter, comm_cd, gri_score, closure_rate) VALUES
            ('2025Q4', 'C1', 20.0, 1.0),
            ('2025Q4', 'C2', 85.0, 9.0),
            ('2025Q4', 'C3', 55.0, 3.0)
        """))
        conn.execute(text("""
            INSERT INTO commerce_sales (year_quarter, trdar_cd, sales_amount) VALUES
            ('20253', 'C1', 1000.0),
            ('20254', 'C1', 1000.0),
            ('20253', 'C2', 1000.0),
            ('20254', 'C2', 400.0),
            ('20253', 'C3', 1000.0),
            ('20254', 'C3', 900.0)
        """))
        conn.execute(text("""
            INSERT INTO flow_barriers (year_quarter, from_comm_cd, to_comm_cd, barrier_score, barrier_type)
            VALUES ('2025Q4', 'OLD', 'OLD2', 0.9, 'old')
        """))


def test_build_and_replace_non_od_barriers_replaces_quarter(monkeypatch):
    engine = create_engine("sqlite:///:memory:")
    _create_schema(engine)
    _seed(engine)

    monkeypatch.setattr(
        mod,
        "load_candidate_pairs",
        lambda _engine, *, neighbor_k, max_distance_m: mod.pd.DataFrame(
            [
                {"comm_a_cd": "C1", "comm_b_cd": "C2", "distance_m": 300.0},
                {"comm_a_cd": "C2", "comm_b_cd": "C3", "distance_m": 600.0},
            ]
        ),
    )

    counts = mod.build_and_replace_non_od_barriers(
        engine,
        quarter="2025Q4",
        previous_quarter="2025Q3",
        top_n=2,
    )

    assert counts["loaded"] == 2
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT from_comm_cd, to_comm_cd, barrier_type FROM flow_barriers ORDER BY barrier_score DESC")
        ).fetchall()
    assert len(rows) == 2
    assert {row._mapping["barrier_type"] for row in rows} == {"비OD_공간단절"}
    assert "OLD" not in {row._mapping["from_comm_cd"] for row in rows}
