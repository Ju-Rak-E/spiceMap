"""GET /api/insights/validation — 검증 보고 (H1·H2·H3 + B1·B3) 응답.

단일 소스 정책: `frontend/src/data/validation_results.json` 을 backend 가 직접
읽어 응답한다 (모노레포 가정). 이 경로는 ValidationView 가 import 하는 정적
fixture 와 동일하므로 두 채널 모두 동일 데이터를 보여준다.

배포 분리 시 (backend 단독 컨테이너):
  - 빌드 시 fixture 를 backend 이미지에 같이 포함하거나
  - VALIDATION_FIXTURE_PATH 환경 변수로 경로 override
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException

from backend.schemas.validation import ValidationResults

router = APIRouter()

# 모노레포 기본 경로 (backend/api/validation.py 기준 parents[2] = repo root)
DEFAULT_FIXTURE_PATH = (
    Path(__file__).resolve().parents[2] / "frontend" / "src" / "data" / "validation_results.json"
)


def _resolve_fixture_path() -> Path:
    """환경 변수 우선, 미설정 시 기본 경로."""
    override = os.environ.get("VALIDATION_FIXTURE_PATH")
    if override:
        return Path(override).expanduser().resolve()
    return DEFAULT_FIXTURE_PATH


@router.get("/insights/validation", response_model=ValidationResults)
def get_validation_results():
    """H1·H2·H3 + B1·B3 검증 카드 5종 반환.

    실데이터 기반 갱신은 `scripts/run_validation_h2_b1.py` 산출 결과를 fixture 에
    수동 반영하는 절차를 따른다 (docs/verification_h2.md §7-3).
    """
    path = _resolve_fixture_path()
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail=f"validation fixture not found at {path}",
        )
    try:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=503,
            detail=f"failed to read validation fixture: {exc}",
        ) from exc

    return ValidationResults(**data)
