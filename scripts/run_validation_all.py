"""H1·H2·H3 + B1 통합 실측 산출 스크립트 (D-9 발표용).

기존 `scripts/run_validation_h2_b1.py` 가 H2·B1 만 다뤘던 것을 확장하여
H1·H3 까지 4 가설을 한 번에 갱신한다. ValidationView/검증 보고 탭의 5 카드
중 H2·B1 의 산출 대기 메시지를 실측값으로 대체할 때 사용.

데이터 의존:
  - DB 연결 (`.env`) — `commerce_analysis` (Q3, Q4) · `commerce_sales`
    (Q4) · `flow_barriers` (Q4)
  - data/baselines/seoul_change_index_<quarter>.csv (B1 만)

실행:
  python -m scripts.run_validation_all --quarter 2025Q4 \\
      --previous 2025Q3 \\
      --b1-csv data/baselines/seoul_change_index_2025Q4.csv \\
      --out data/baselines/validation_2025Q4.json

산출:
  - 콘솔 JSON: { quarter, h1, h2, h3, b1 }
  - --out 지정 시 동일 JSON 파일 dump

이 스크립트는 발표 자료 갱신 시 `frontend/src/data/validation_results.json`
의 metric_primary, sample_size, criterion 필드 갱신 근거가 된다 (수동 반영).
"""
from __future__ import annotations

import argparse
import json
import re
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
from backend.analysis.verification_h1 import compute_h1_correlation
from backend.analysis.verification_h2 import compute_h2_alignment
from backend.analysis.verification_h3 import compute_h3_alignment
from backend.config import settings

_QUARTER_RE = re.compile(r"^(\d{4})Q([1-4])$")


def quarter_to_legacy(quarter: str) -> str:
    """`2025Q4` → `20254` (commerce_sales / store_info 포맷)."""
    m = _QUARTER_RE.fullmatch(quarter)
    if m is None:
        raise ValueError(f"잘못된 분기 포맷: {quarter!r}")
    return f"{m.group(1)}{m.group(2)}"


@dataclass(frozen=True)
class ValidationAllOutput:
    quarter: str
    previous_quarter: str
    h1: dict[str, Any] | None
    h2: dict[str, Any] | None
    h3: dict[str, Any] | None
    b1: dict[str, Any] | None


# ---------- DB 로더 ----------

def _load_net_flow(engine, quarter: str) -> pd.DataFrame:
    sql = text(
        """
        SELECT comm_cd AS commerce_code, net_flow
        FROM commerce_analysis
        WHERE year_quarter = :q AND net_flow IS NOT NULL
        """
    )
    return pd.read_sql(sql, engine, params={"q": quarter})


def _load_sales(engine, quarter: str) -> pd.DataFrame:
    legacy = quarter_to_legacy(quarter)
    sql = text(
        """
        SELECT trdar_cd, sales_amount
        FROM commerce_sales
        WHERE year_quarter = :q
        """
    )
    return pd.read_sql(sql, engine, params={"q": legacy})


def _load_gri(engine, quarter: str) -> pd.DataFrame:
    sql = text(
        """
        SELECT comm_cd AS commerce_code, gri_score
        FROM commerce_analysis
        WHERE year_quarter = :q AND gri_score IS NOT NULL
        """
    )
    return pd.read_sql(sql, engine, params={"q": quarter})


def _load_closures(engine, quarter: str) -> pd.DataFrame:
    sql = text(
        """
        SELECT comm_cd AS commerce_code, closure_rate
        FROM commerce_analysis
        WHERE year_quarter = :q AND closure_rate IS NOT NULL
        """
    )
    return pd.read_sql(sql, engine, params={"q": quarter})


def _load_barriers(engine, quarter: str) -> pd.DataFrame:
    sql = text(
        """
        SELECT from_comm_cd, to_comm_cd, barrier_score
        FROM flow_barriers
        WHERE year_quarter = :q
        """
    )
    return pd.read_sql(sql, engine, params={"q": quarter})


def _load_priorities(engine, quarter: str) -> pd.DataFrame:
    sql = text(
        """
        SELECT comm_cd AS commerce_code, priority_score
        FROM commerce_analysis
        WHERE year_quarter = :q AND priority_score IS NOT NULL
        """
    )
    return pd.read_sql(sql, engine, params={"q": quarter})


# ---------- 가설 실행 ----------

def run_h1(engine, quarter: str) -> dict[str, Any]:
    nf = _load_net_flow(engine, quarter)
    sales = _load_sales(engine, quarter)
    if nf.empty or sales.empty:
        return {"skipped": True, "reason": f"net_flow={len(nf)} sales={len(sales)} 부족"}
    try:
        return dict(compute_h1_correlation(nf, sales))
    except ValueError as exc:
        return {"skipped": True, "reason": str(exc)}


def run_h2(engine, quarter: str) -> dict[str, Any]:
    barriers = _load_barriers(engine, quarter)
    closures = _load_closures(engine, quarter)
    if barriers.empty or closures.empty:
        return {"skipped": True, "reason": f"barriers={len(barriers)} closures={len(closures)} 부족"}
    try:
        return dict(compute_h2_alignment(barriers, closures))
    except ValueError as exc:
        return {"skipped": True, "reason": str(exc)}


def run_h3(engine, quarter: str, previous: str) -> dict[str, Any]:
    q3_gri = _load_gri(engine, previous)
    q4_closure = _load_closures(engine, quarter)
    if q3_gri.empty or q4_closure.empty:
        return {"skipped": True, "reason": f"q3_gri={len(q3_gri)} q4_closure={len(q4_closure)} 부족"}
    try:
        return dict(compute_h3_alignment(q3_gri, q4_closure))
    except ValueError as exc:
        return {"skipped": True, "reason": str(exc)}


def run_b1(engine, quarter: str, b1_csv: Path) -> dict[str, Any]:
    if not b1_csv.exists():
        return {"skipped": True, "reason": f"B1 CSV 없음: {b1_csv}"}
    change_index = load_change_index_csv(b1_csv)
    b1_scores = compute_b1_baseline(change_index)
    priorities = _load_priorities(engine, quarter)
    if priorities.empty:
        return {"skipped": True, "reason": "priority_score 데이터 없음"}
    try:
        return dict(compare_priority_to_b1(priorities, b1_scores))
    except ValueError as exc:
        return {"skipped": True, "reason": str(exc)}


# ---------- main ----------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quarter", default="2025Q4", help="대상 분기")
    parser.add_argument("--previous", default="2025Q3", help="이전 분기 (H3 GRI 입력)")
    parser.add_argument(
        "--b1-csv",
        default="data/baselines/seoul_change_index_2025Q4.csv",
        type=Path,
        help="OA-15576 정적 CSV 경로",
    )
    parser.add_argument("--out", type=Path, default=None, help="결과 JSON dump 경로 (선택)")
    parser.add_argument("--skip-h1", action="store_true")
    parser.add_argument("--skip-h2", action="store_true")
    parser.add_argument("--skip-h3", action="store_true")
    parser.add_argument("--skip-b1", action="store_true")
    args = parser.parse_args(argv)

    engine = create_engine(settings.database_url, future=True)

    h1 = None if args.skip_h1 else run_h1(engine, args.quarter)
    h2 = None if args.skip_h2 else run_h2(engine, args.quarter)
    h3 = None if args.skip_h3 else run_h3(engine, args.quarter, args.previous)
    b1 = None if args.skip_b1 else run_b1(engine, args.quarter, args.b1_csv)

    output = ValidationAllOutput(
        quarter=args.quarter,
        previous_quarter=args.previous,
        h1=h1,
        h2=h2,
        h3=h3,
        b1=b1,
    )
    payload = json.dumps(asdict(output), ensure_ascii=False, indent=2)
    print(payload)

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(payload, encoding="utf-8")

    return 0


if __name__ == "__main__":
    sys.exit(main())
