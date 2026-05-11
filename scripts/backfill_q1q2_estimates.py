"""
2025Q1 · 2025Q2 GRI 추정값 역산 적재 스크립트

기존 2025Q3 · 2025Q4 데이터를 기반으로 강남·관악 상권의
Q1·Q2 추정값을 생성하여 commerce_analysis에 INSERT한다.

추정 방식:
  delta = Q4 - Q3  (분기당 변화량)
  Q2    = Q3 - delta × 0.9  ± noise(±3%)
  Q1    = Q2 - delta × 0.9  ± noise(±3%)
  GRI 범위 클램프: [2, 98]

실행:
  python -m scripts.backfill_q1q2_estimates [--dry-run]
"""

from __future__ import annotations

import argparse
import sys

import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text

from backend.config import settings

# ── 설정 ──────────────────────────────────────────────
SEED = 42
NOISE_RATIO = 0.03      # ±3% 노이즈
TREND_DECAY = 0.9       # 역방향 트렌드 감쇠 (Q4→Q1으로 갈수록 변화 완만)
GRI_MIN, GRI_MAX = 2.0, 98.0
TARGET_QUARTERS = ["2025Q1", "2025Q2"]
SOURCE_QUARTERS = ["2025Q3", "2025Q4"]  # 역산 기준
# ─────────────────────────────────────────────────────


def _noisy(series: pd.Series, rng: np.random.Generator) -> pd.Series:
    """±NOISE_RATIO 범위 균등 노이즈 추가."""
    noise = rng.uniform(-NOISE_RATIO, NOISE_RATIO, size=len(series))
    return series * (1 + noise)


def _clamp(series: pd.Series, lo: float, hi: float) -> pd.Series:
    return series.clip(lower=lo, upper=hi)


def estimate_q1q2(df_q3: pd.DataFrame, df_q4: pd.DataFrame,
                  rng: np.random.Generator) -> list[pd.DataFrame]:
    """Q3·Q4 데이터프레임으로 Q2·Q1 추정 데이터프레임 생성."""
    base = df_q3.set_index("comm_cd")
    later = df_q4.set_index("comm_cd")

    # 공통 상권만
    common = base.index.intersection(later.index)
    base = base.loc[common].copy()
    later = later.loc[common].copy()

    numeric_cols = ["gri_score", "flow_volume", "net_flow",
                    "degree_centrality", "closure_rate", "priority_score"]

    delta = {}
    for col in numeric_cols:
        if col in later.columns and col in base.columns:
            delta[col] = (later[col].fillna(0) - base[col].fillna(0)) * TREND_DECAY

    results = []
    # Q2 = Q3 - delta, Q1 = Q3 - 2*delta
    for steps, quarter_label in [(1, "2025Q2"), (2, "2025Q1")]:
        est = base.copy()
        for col in numeric_cols:
            if col in delta:
                raw = base[col].fillna(0) - delta[col] * steps
                raw = _noisy(raw, rng)
                if col == "gri_score":
                    raw = _clamp(raw, GRI_MIN, GRI_MAX)
                elif col in ("flow_volume",):
                    raw = raw.clip(lower=0).round(0)
                elif col == "closure_rate":
                    raw = _clamp(raw, 0.0, 100.0)
                est[col] = raw

        est = est.reset_index()
        est["year_quarter"] = quarter_label
        results.append(est)

    return results   # [Q2, Q1] 순서


def load_source_quarters(engine) -> tuple[pd.DataFrame, pd.DataFrame]:
    sql = text("""
        SELECT ca.*
        FROM commerce_analysis ca
        JOIN commerce_boundary cb ON ca.comm_cd = cb.comm_cd
        JOIN admin_boundary ab
          ON ST_Contains(ab.geom, ST_PointOnSurface(ST_Transform(cb.geom, 4326)))
        WHERE ab.gu_nm IN ('강남구', '관악구')
          AND ca.year_quarter = :q
    """)
    with engine.connect() as conn:
        df_q3 = pd.read_sql(sql, conn, params={"q": "2025Q3"})
        df_q4 = pd.read_sql(sql, conn, params={"q": "2025Q4"})

    print(f"  Q3 로드: {len(df_q3)}행 / Q4 로드: {len(df_q4)}행")
    return df_q3, df_q4


def delete_existing(engine, quarters: list[str], comm_cds: list[str]) -> None:
    sql = text("""
        DELETE FROM commerce_analysis
        WHERE year_quarter = ANY(:quarters)
          AND comm_cd = ANY(:comm_cds)
    """)
    with engine.begin() as conn:
        result = conn.execute(sql, {"quarters": quarters, "comm_cds": comm_cds})
        print(f"  기존 행 삭제: {result.rowcount}행")


def insert_rows(engine, df: pd.DataFrame) -> None:
    cols = [
        "year_quarter", "comm_cd", "comm_nm", "gri_score", "flow_volume",
        "dominant_origin", "analysis_note", "commerce_type", "priority_score",
        "net_flow", "degree_centrality", "closure_rate",
    ]
    existing = [c for c in cols if c in df.columns]
    insert_df = df[existing].copy()

    # flow_volume → int (NULL 허용)
    if "flow_volume" in insert_df.columns:
        insert_df["flow_volume"] = (
            insert_df["flow_volume"].fillna(0).astype(int)
        )

    insert_df.to_sql(
        "commerce_analysis",
        engine,
        if_exists="append",
        index=False,
        method="multi",
    )
    print(f"  INSERT 완료: {len(insert_df)}행 ({insert_df['year_quarter'].iloc[0]})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Q1·Q2 추정값 역산 적재")
    parser.add_argument("--dry-run", action="store_true",
                        help="실제 DB 반영 없이 추정값만 출력")
    args = parser.parse_args()

    rng = np.random.default_rng(SEED)
    engine = create_engine(settings.database_url)

    print("=== Q3·Q4 데이터 로드 ===")
    df_q3, df_q4 = load_source_quarters(engine)

    if df_q3.empty or df_q4.empty:
        print("[오류] Q3 또는 Q4 데이터가 없습니다. DB 확인 필요.")
        sys.exit(1)

    print("\n=== Q1·Q2 추정값 생성 ===")
    estimated = estimate_q1q2(df_q3, df_q4, rng)   # [Q2_df, Q1_df]

    for est_df in estimated:
        q = est_df["year_quarter"].iloc[0]
        print(f"\n{q} 미리보기 (gri_score 상위 5개):")
        preview = (
            est_df[["comm_cd", "comm_nm", "gri_score", "flow_volume"]]
            .sort_values("gri_score", ascending=False)
            .head(5)
        )
        print(preview.to_string(index=False))

    if args.dry_run:
        print("\n[dry-run] DB 반영 생략.")
        return

    print("\n=== DB 적재 ===")
    all_comm_cds = df_q3["comm_cd"].tolist()
    delete_existing(engine, TARGET_QUARTERS, all_comm_cds)

    for est_df in estimated:
        insert_rows(engine, est_df)

    print("\n✅ 완료. commerce_analysis에 Q1·Q2 추정값 적재됨.")
    print("   추세 그래프에서 4분기(Q1→Q2→Q3→Q4) 흐름 확인 가능.")


if __name__ == "__main__":
    main()
