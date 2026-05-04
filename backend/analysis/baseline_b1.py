"""B1 베이스라인 비교 — 서울시 공식 OA-15576 상권변화지표 vs Module E priority_score.

OA-15576 (상권변화지표):
  서울 열린데이터광장이 분기별로 발표하는 공식 상권 변화 지표.
  카테고리 (TRDAR_CHNG_IX_NM): 정체 / 주의 / 상권쇠퇴 / 다이나믹 / HH(Hot-Hot).
  본 베이스라인에서는 "상권쇠퇴" 카테고리를 위험 신호로 간주한다.

데이터 출처:
  서울 열린데이터광장 정적 CSV 다운로드.
  기본 경로: data/baselines/seoul_change_index_2025Q4.csv

설계 근거: docs/strategy_d13.md §2 결정 C
출력 KPI:
  - Jaccard 유사도: 두 모델의 위험 상권 TOP N% 교집합 비율
  - 추가 식별: Module E TOP N% 에는 있고 B1 위험 그룹에 없는 상권 수
"""
from __future__ import annotations

from pathlib import Path
from typing import TypedDict

import pandas as pd

DEFAULT_TOP_PCT = 0.20
B1_DECLINE_LABEL = "상권쇠퇴"
B1_LABEL_COLUMN_CANDIDATES = ("TRDAR_CHNG_IX_NM", "trdar_chng_ix_nm")
B1_CODE_COLUMN_CANDIDATES = ("TRDAR_CD", "trdar_cd")


class B1Result(TypedDict):
    n_total: int
    n_top_b1: int
    n_top_priority: int
    n_intersect: int
    jaccard: float
    new_in_priority: int
    new_in_b1: int


def _pick_column(df: pd.DataFrame, candidates: tuple[str, ...]) -> str:
    for c in candidates:
        if c in df.columns:
            return c
    raise ValueError(
        f"OA-15576 CSV 에 필수 컬럼 부재. 후보 {candidates} 중 하나가 필요."
    )


def load_change_index_csv(path: str | Path) -> pd.DataFrame:
    """OA-15576 정적 CSV 로딩.

    예상 컬럼:
        TRDAR_CD: 상권 코드 (str)
        TRDAR_CHNG_IX_NM: 변화지표 명 (정체/주의/상권쇠퇴/다이나믹/HH 등)

    인코딩은 utf-8 → cp949 순으로 시도한다 (서울 데이터 관행).

    Returns:
        columns = [commerce_code, change_label]
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"B1 정적 CSV 파일 없음: {p}")

    last_err: Exception | None = None
    df: pd.DataFrame | None = None
    for enc in ("utf-8", "utf-8-sig", "cp949"):
        try:
            df = pd.read_csv(p, dtype=str, encoding=enc)
            break
        except UnicodeDecodeError as exc:
            last_err = exc
            continue
    if df is None:
        raise UnicodeDecodeError(
            "utf-8", b"", 0, 1,
            f"OA-15576 CSV 인코딩 실패: {last_err}",
        )

    code_col = _pick_column(df, B1_CODE_COLUMN_CANDIDATES)
    label_col = _pick_column(df, B1_LABEL_COLUMN_CANDIDATES)

    out = (
        df[[code_col, label_col]]
        .rename(columns={code_col: "commerce_code", label_col: "change_label"})
        .dropna()
    )
    out["commerce_code"] = out["commerce_code"].astype(str).str.strip()
    out["change_label"] = out["change_label"].astype(str).str.strip()
    return out.reset_index(drop=True)


def compute_b1_baseline(change_index: pd.DataFrame) -> pd.DataFrame:
    """B1 점수: change_label == "상권쇠퇴" → 1.0, 그 외 → 0.0.

    위험 상권 TOP N% 비교용이라 binary 점수로 충분하다.

    Args:
        change_index: columns = [commerce_code, change_label]

    Returns:
        columns = [commerce_code, b1_score]
    """
    if change_index.empty:
        return pd.DataFrame(columns=["commerce_code", "b1_score"])

    score = (change_index["change_label"] == B1_DECLINE_LABEL).astype(float)
    return pd.DataFrame(
        {
            "commerce_code": change_index["commerce_code"].astype(str).values,
            "b1_score": score.values,
        }
    ).reset_index(drop=True)


def compare_priority_to_b1(
    priority_df: pd.DataFrame,
    b1_df: pd.DataFrame,
    top_pct: float = DEFAULT_TOP_PCT,
) -> B1Result:
    """Module E priority_score 와 B1 점수의 Jaccard 비교.

    B1 은 binary 점수이므로 b1_score == 1.0 인 모든 상권을 위험 그룹으로 본다.
    priority_score 는 상위 top_pct 분위수 이상을 위험 그룹으로 본다.

    Args:
        priority_df: columns = [commerce_code, priority_score]
        b1_df: compute_b1_baseline 결과 (columns = [commerce_code, b1_score])
        top_pct: priority_score 상위 비율 (기본 0.20)

    Returns:
        B1Result.

    Raises:
        ValueError: top_pct 부적합 또는 매칭 쌍 < 5.
    """
    if not 0 < top_pct < 1:
        raise ValueError(f"top_pct must be in (0, 1), got {top_pct}")

    merged = priority_df.merge(b1_df, on="commerce_code", how="inner")
    merged = merged.dropna(subset=["priority_score", "b1_score"])
    n = len(merged)
    if n < 5:
        raise ValueError(f"비교에 최소 5쌍 필요. 매칭: {n}")

    p_thr = merged["priority_score"].quantile(1.0 - top_pct)
    top_priority = set(merged[merged["priority_score"] >= p_thr]["commerce_code"])
    top_b1 = set(merged[merged["b1_score"] >= 1.0]["commerce_code"])

    intersect = top_priority & top_b1
    union = top_priority | top_b1
    jaccard = len(intersect) / len(union) if union else 0.0

    return B1Result(
        n_total=int(n),
        n_top_b1=int(len(top_b1)),
        n_top_priority=int(len(top_priority)),
        n_intersect=int(len(intersect)),
        jaccard=float(jaccard),
        new_in_priority=int(len(top_priority - top_b1)),
        new_in_b1=int(len(top_b1 - top_priority)),
    )
