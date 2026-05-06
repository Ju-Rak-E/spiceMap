"""H2 검증 + B1 베이스라인 산출 실행 스크립트 (D-9 발표용).

목적:
  - H2: flow_barriers (Q4) vs commerce_analysis.closure_rate (Q4) Pearson/Spearman.
  - B1: priority_score (Q4) vs OA-15576 상권변화지표 (정적 CSV) Jaccard.

데이터 의존:
  - DB 연결 (`.env`) — od_flows_aggregated · commerce_analysis · flow_barriers · commerce_sales
  - data/baselines/seoul_change_index_<quarter>.csv (B1 만)

실행:
  python -m scripts.run_validation_h2_b1 --quarter 2025Q4 \\
      --b1-csv data/baselines/seoul_change_index_2025Q4.csv

출력:
  - 콘솔: H2Result · B1Result JSON
  - data/baselines/validation_<quarter>.json: 결과 dump (선택, --out 지정 시)

이 스크립트는 발표 자료 갱신 시 `frontend/src/data/validation_results.json` 의
H2/B1 카드 metric_primary/sample_size/criterion 필드 갱신 근거가 된다.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import create_engine, text

from backend.analysis.baseline_b1 import (
    compare_priority_to_b1,
    compute_b1_baseline,
    load_change_index_csv,
)
from backend.analysis.verification_h2 import compute_h2_alignment
from backend.config import settings


@dataclass(frozen=True)
class ValidationOutput:
    quarter: str
    h2: dict[str, Any] | None
    b1: dict[str, Any] | None


def _load_barriers(engine, quarter: str) -> pd.DataFrame:
    sql = text(
        """
        SELECT from_comm_cd, to_comm_cd, barrier_score
        FROM flow_barriers
        WHERE year_quarter = :q
        """
    )
    return pd.read_sql(sql, engine, params={"q": quarter})


def _load_closures(engine, quarter: str) -> pd.DataFrame:
    sql = text(
        """
        SELECT comm_cd AS commerce_code, closure_rate
        FROM commerce_analysis
        WHERE year_quarter = :q
          AND closure_rate IS NOT NULL
        """
    )
    return pd.read_sql(sql, engine, params={"q": quarter})


def _load_priorities(engine, quarter: str) -> pd.DataFrame:
    sql = text(
        """
        SELECT comm_cd AS commerce_code, priority_score
        FROM commerce_analysis
        WHERE year_quarter = :q
          AND priority_score IS NOT NULL
        """
    )
    return pd.read_sql(sql, engine, params={"q": quarter})


def run_h2(engine, quarter: str) -> dict[str, Any] | None:
    barriers = _load_barriers(engine, quarter)
    closures = _load_closures(engine, quarter)
    if barriers.empty or closures.empty:
        return {
            "skipped": True,
            "reason": f"barriers={len(barriers)} closures={len(closures)} — 데이터 부족",
        }
    try:
        result = compute_h2_alignment(barriers, closures)
        return dict(result)
    except ValueError as exc:
        return {"skipped": True, "reason": str(exc)}


def run_b1(engine, quarter: str, b1_csv: Path) -> dict[str, Any] | None:
    if not b1_csv.exists():
        return {"skipped": True, "reason": f"B1 CSV 없음: {b1_csv}"}
    change_index = load_change_index_csv(b1_csv)
    b1_scores = compute_b1_baseline(change_index)
    priorities = _load_priorities(engine, quarter)
    if priorities.empty:
        return {"skipped": True, "reason": "priority_score 데이터 없음"}
    try:
        result = compare_priority_to_b1(priorities, b1_scores)
        return dict(result)
    except ValueError as exc:
        return {"skipped": True, "reason": str(exc)}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quarter", default="2025Q4", help="대상 분기 (예: 2025Q4)")
    parser.add_argument(
        "--b1-csv",
        default="data/baselines/seoul_change_index_2025Q4.csv",
        type=Path,
        help="OA-15576 정적 CSV 경로",
    )
    parser.add_argument("--out", type=Path, default=None, help="결과 JSON dump 경로 (선택)")
    parser.add_argument("--skip-h2", action="store_true")
    parser.add_argument("--skip-b1", action="store_true")
    args = parser.parse_args(argv)

    engine = create_engine(settings.database_url, future=True)

    h2 = None if args.skip_h2 else run_h2(engine, args.quarter)
    b1 = None if args.skip_b1 else run_b1(engine, args.quarter, args.b1_csv)

    output = ValidationOutput(quarter=args.quarter, h2=h2, b1=b1)
    print(json.dumps(asdict(output), ensure_ascii=False, indent=2))

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(asdict(output), ensure_ascii=False, indent=2), encoding="utf-8")

    return 0


if __name__ == "__main__":
    sys.exit(main())
