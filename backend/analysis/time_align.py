"""
시계열 정렬 모듈 (Week 1 - Dev-C Task 3)

OD 유동(일별), 생활인구(시간별) 데이터를 분기 단위로 정렬하는
SQL VIEW를 생성하고, Python 래퍼 함수를 제공한다.

실행: python -m backend.analysis.time_align          # VIEW 생성
검증: python -m backend.analysis.time_align --test    # 합성 데이터 테스트
"""
import argparse
import sys
from datetime import date

import pandas as pd
from sqlalchemy import create_engine, text

from backend.config import settings


VW_QUARTERLY_OD = """
CREATE OR REPLACE VIEW vw_quarterly_od AS
SELECT
    year_quarter,
    adm_cd,
    ROUND(AVG(daily_inflow)::numeric, 1)  AS avg_daily_inflow,
    ROUND(AVG(daily_outflow)::numeric, 1) AS avg_daily_outflow,
    ROUND(AVG(daily_inflow - daily_outflow)::numeric, 1) AS avg_daily_net_flow
FROM (
    SELECT
        EXTRACT(YEAR FROM base_date)::int::text
        || EXTRACT(QUARTER FROM base_date)::int::text AS year_quarter,
        base_date,
        adm_cd,
        COALESCE(SUM(inflow), 0) AS daily_inflow,
        COALESCE(SUM(outflow), 0) AS daily_outflow
    FROM (
        SELECT base_date, dest_adm_cd AS adm_cd, trip_count AS inflow, 0::float AS outflow
        FROM od_flows
        UNION ALL
        SELECT base_date, origin_adm_cd, 0::float, trip_count
        FROM od_flows
    ) raw
    GROUP BY 1, 2, 3
) daily
GROUP BY year_quarter, adm_cd
"""

VW_QUARTERLY_POP = """
CREATE OR REPLACE VIEW vw_quarterly_pop AS
SELECT
    EXTRACT(YEAR FROM base_date)::int::text
    || EXTRACT(QUARTER FROM base_date)::int::text AS year_quarter,
    adm_cd,
    ROUND(AVG(total_pop)::numeric, 1) AS avg_pop,
    ROUND(MAX(total_pop)::numeric, 1) AS peak_pop,
    ROUND(AVG(CASE WHEN hour_slot BETWEEN 9 AND 18
                   THEN total_pop END)::numeric, 1) AS daytime_avg_pop,
    ROUND(AVG(CASE WHEN hour_slot >= 22 OR hour_slot <= 5
                   THEN total_pop END)::numeric, 1) AS nighttime_avg_pop
FROM living_population
GROUP BY 1, adm_cd
"""


# ── 유틸 ─────────────────────────────────────────────────
def quarter_from_date(d: date) -> str:
    """날짜 → 분기 코드 (예: 2025-10-15 → '20254')."""
    return f"{d.year}{(d.month - 1) // 3 + 1}"


# ── VIEW 관리 ────────────────────────────────────────────
def create_views(engine) -> None:
    """분기 집계 VIEW 2개를 생성한다."""
    with engine.begin() as conn:
        conn.execute(text(VW_QUARTERLY_OD))
        conn.execute(text(VW_QUARTERLY_POP))
    print("VIEW 생성 완료: vw_quarterly_od, vw_quarterly_pop")


# ── 데이터 조회 래퍼 ─────────────────────────────────────
def get_quarterly_od(engine, year_quarter: str) -> pd.DataFrame:
    """특정 분기의 행정동별 OD 유동 집계."""
    sql = text("""
        SELECT * FROM vw_quarterly_od
        WHERE year_quarter = :yq ORDER BY adm_cd
    """)
    with engine.connect() as conn:
        return pd.read_sql(sql, conn, params={"yq": year_quarter})


def get_quarterly_pop(engine, year_quarter: str) -> pd.DataFrame:
    """특정 분기의 행정동별 생활인구 집계."""
    sql = text("""
        SELECT * FROM vw_quarterly_pop
        WHERE year_quarter = :yq ORDER BY adm_cd
    """)
    with engine.connect() as conn:
        return pd.read_sql(sql, conn, params={"yq": year_quarter})


# ── 테스트 ───────────────────────────────────────────────
def run_test(engine) -> None:
    """합성 데이터로 분기 정렬 검증 (트랜잭션 내 실행 → ROLLBACK)."""
    print("=== 시계열 정렬 테스트 ===\n")

    with engine.connect() as conn:
        try:
            _insert_test_data(conn)
            _create_views_in_conn(conn)
            _verify_od(conn)
            _verify_pop(conn)
            _verify_quarter_boundary(conn)
            print("\n모든 테스트 PASS")
        finally:
            conn.rollback()
            print("(테스트 데이터 ROLLBACK 완료)")


def _insert_test_data(conn) -> None:
    """합성 OD + 생활인구 데이터 INSERT."""
    # OD: 2025Q4 (10월), 3일치
    # A→B 100명/일, B→A 60명/일
    conn.execute(text("""
        INSERT INTO od_flows (base_date, origin_adm_cd, dest_adm_cd, trip_count)
        VALUES
        ('2025-10-01', '11680100', '11680200', 100),
        ('2025-10-02', '11680100', '11680200', 100),
        ('2025-10-03', '11680100', '11680200', 100),
        ('2025-10-01', '11680200', '11680100', 60),
        ('2025-10-02', '11680200', '11680100', 60),
        ('2025-10-03', '11680200', '11680100', 60)
    """))

    # 생활인구: 2025Q4, 1일 × 24시간, 행정동 1개
    # 주간(09~18시) = 5000, 야간(22~05시) = 2000, 나머지 = 3000
    # hour_slot은 해당 시간의 시작 (예: 18 = 18:00~19:00 구간)
    pop_rows = []
    for h in range(24):
        if 9 <= h <= 18:
            pop = 5000
        elif h >= 22 or h <= 5:
            pop = 2000
        else:
            pop = 3000
        pop_rows.append({"bd": "2025-10-01", "hs": h, "ac": "11680100", "tp": pop})
    for r in pop_rows:
        conn.execute(text(
            "INSERT INTO living_population (base_date, hour_slot, adm_cd, total_pop) "
            "VALUES (:bd, :hs, :ac, :tp)"
        ), r)

    # 분기 경계 테스트: Q3 데이터 (2025-09-30)
    conn.execute(text("""
        INSERT INTO od_flows (base_date, origin_adm_cd, dest_adm_cd, trip_count)
        VALUES ('2025-09-30', '11680100', '11680200', 200)
    """))
    print("합성 데이터 INSERT 완료 (Q3+Q4)")


def _create_views_in_conn(conn) -> None:
    """트랜잭션 내에서 VIEW 생성."""
    conn.execute(text("DROP VIEW IF EXISTS vw_quarterly_od"))
    conn.execute(text("DROP VIEW IF EXISTS vw_quarterly_pop"))
    conn.execute(text(VW_QUARTERLY_OD))
    conn.execute(text(VW_QUARTERLY_POP))


def _verify_od(conn) -> None:
    """OD VIEW 검증."""
    df = pd.read_sql(text("SELECT * FROM vw_quarterly_od WHERE year_quarter = '20254'"), conn)
    assert not df.empty, "vw_quarterly_od에서 20254 데이터 없음"
    print(f"\nvw_quarterly_od (20254):\n{df.to_string(index=False)}")

    # 행정동 11680200: 유입 = A→B 100명/일, 유출 = B→A 60명/일
    row_b = df[df["adm_cd"] == "11680200"]
    assert len(row_b) == 1, f"11680200 행 기대 1, 실제 {len(row_b)}"
    row_b = row_b.iloc[0]
    assert abs(row_b["avg_daily_inflow"] - 100) < 0.1, f"B 유입 기대 100, 실제 {row_b['avg_daily_inflow']}"
    assert abs(row_b["avg_daily_outflow"] - 60) < 0.1, f"B 유출 기대 60, 실제 {row_b['avg_daily_outflow']}"
    assert abs(row_b["avg_daily_net_flow"] - 40) < 0.1, f"B 순유입 기대 40, 실제 {row_b['avg_daily_net_flow']}"
    print("  OD 검증 PASS")


def _verify_pop(conn) -> None:
    """생활인구 VIEW 검증."""
    df = pd.read_sql(text("SELECT * FROM vw_quarterly_pop WHERE year_quarter = '20254'"), conn)
    assert not df.empty, "vw_quarterly_pop에서 20254 데이터 없음"
    print(f"\nvw_quarterly_pop (20254):\n{df.to_string(index=False)}")

    row = df[df["adm_cd"] == "11680100"]
    assert len(row) == 1, f"11680100 행 기대 1, 실제 {len(row)}"
    row = row.iloc[0]

    # 전체 평균: (10*5000 + 8*2000 + 6*3000) / 24 = 3500
    assert abs(row["avg_pop"] - 3500) < 1, f"평균 기대 3500, 실제 {row['avg_pop']}"
    assert abs(row["peak_pop"] - 5000) < 1, f"피크 기대 5000, 실제 {row['peak_pop']}"
    assert abs(row["daytime_avg_pop"] - 5000) < 1, f"주간 기대 5000, 실제 {row['daytime_avg_pop']}"
    assert abs(row["nighttime_avg_pop"] - 2000) < 1, f"야간 기대 2000, 실제 {row['nighttime_avg_pop']}"
    print("  생활인구 검증 PASS")


def _verify_quarter_boundary(conn) -> None:
    """분기 경계 테스트: Q3(9/30) vs Q4(10/1) 분리 확인."""
    df = pd.read_sql(text("SELECT DISTINCT year_quarter FROM vw_quarterly_od ORDER BY 1"), conn)
    quarters = df["year_quarter"].tolist()
    assert "20253" in quarters, f"Q3 데이터 누락: {quarters}"
    assert "20254" in quarters, f"Q4 데이터 누락: {quarters}"

    q3 = pd.read_sql(text("SELECT * FROM vw_quarterly_od WHERE year_quarter = '20253'"), conn)
    assert not q3.empty, "Q3 데이터 없음"
    # Q3에는 9/30 1일치 200명만
    row = q3[q3["adm_cd"] == "11680200"].iloc[0]
    assert abs(row["avg_daily_inflow"] - 200) < 0.1, f"Q3 B 유입 기대 200, 실제 {row['avg_daily_inflow']}"
    print("  분기 경계 검증 PASS")


# ── main ─────────────────────────────────────────────────
def main():
    try:
        engine = create_engine(settings.database_url)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        print(f"ERROR: DB 연결 실패 — {e}", file=sys.stderr)
        sys.exit(1)

    parser = argparse.ArgumentParser(description="시계열 정렬 (분기 VIEW 생성)")
    parser.add_argument("--test", action="store_true", help="합성 데이터 테스트")
    args = parser.parse_args()

    if args.test:
        run_test(engine)
        return

    create_views(engine)

    # 기존 데이터로 VIEW 확인
    VIEWS = ("vw_quarterly_od", "vw_quarterly_pop")
    with engine.connect() as conn:
        for vw in VIEWS:
            cnt = pd.read_sql(text(f"SELECT COUNT(*) AS cnt FROM {vw}"), conn).iloc[0]["cnt"]
            print(f"  {vw}: {cnt}건")


if __name__ == "__main__":
    main()
