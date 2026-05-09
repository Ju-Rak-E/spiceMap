# AI 창업 입지 분석 (Startup Advisor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 업종 드롭다운 선택 → 백엔드가 공공데이터 기반 점수 계산 + Claude API 해설 생성 → 지도 노드 색상 오버레이 + 우측 결과 패널 표시

**Architecture:** 백엔드(FastAPI)가 `store_info` + `commerce_analysis` DB에서 상권 지표를 집계하고 어드바이저 점수로 추천/주의/비추천 티어를 분류한 뒤, `claude-haiku-4-5-20251001`에게 해설 생성을 요청한다. 프론트엔드는 `useStartupAdvisor` 훅으로 결과를 받아 `StartupAdvisorPanel`에 표시하고 `Map`에 `advisorTiers`를 오버레이한다. 기존 `startupAdvisor.ts` 유틸 및 FlowControlPanel 추천 목록은 그대로 유지한다.

**Tech Stack:** FastAPI, anthropic SDK, Pydantic v2, React, TypeScript, Vitest, pytest

---

## 파일 맵

| 작업 | 생성/수정 |
|------|---------|
| Task 1 | Modify `requirements.txt`, `requirements-api.txt`, `backend/config.py` |
| Task 2 | Create `backend/schemas/advisor.py`, `tests/api/test_schemas_advisor.py` |
| Task 3 | Create `backend/api/advisor.py` (industries 엔드포인트), `tests/api/test_advisor_industries.py` |
| Task 4 | Add scoring functions to `backend/api/advisor.py`, `tests/api/test_advisor_scoring.py` |
| Task 5 | Add startup endpoint (stats only) to `backend/api/advisor.py`, `tests/api/test_advisor_startup.py` |
| Task 6 | Add LLM integration to `backend/api/advisor.py`, Modify `backend/main.py` |
| Task 7 | Create `frontend/public/data/mock_advisor_industries.json`, `mock_advisor_startup.json` |
| Task 8 | Create `frontend/src/hooks/useStartupAdvisor.ts`, `useStartupAdvisor.test.ts` |
| Task 9 | Create `frontend/src/components/StartupAdvisorPanel.tsx`, `StartupAdvisorPanel.test.tsx` |
| Task 10 | Modify `frontend/src/components/Map.tsx` |
| Task 11 | Modify `frontend/src/App.tsx` |

---

## Task 1: 의존성 + Config

**Files:**
- Modify: `requirements.txt`
- Modify: `requirements-api.txt`
- Modify: `backend/config.py`

- [ ] **Step 1: anthropic 패키지를 requirements.txt에 추가**

`requirements.txt`의 `# API keys` 섹션 아래에 다음을 추가:
```
# AI
anthropic>=0.40.0
```

- [ ] **Step 2: requirements-api.txt에도 추가**

`requirements-api.txt` 마지막 줄 아래에 추가:
```
anthropic>=0.40.0
```

- [ ] **Step 3: backend/config.py에 anthropic_api_key 필드 추가**

`openrouteservice_api_key: str = ""` 바로 아래에 추가:
```python
anthropic_api_key: str = ""  # Claude API (Startup Advisor)
```

- [ ] **Step 4: 로컬 설치 확인**

```bash
pip install anthropic
python -c "import anthropic; print(anthropic.__version__)"
```
Expected: 버전 문자열 출력 (예: `0.40.0`)

- [ ] **Step 5: Commit**

```bash
git add requirements.txt requirements-api.txt backend/config.py
git commit -m "chore: add anthropic SDK dependency + ANTHROPIC_API_KEY config"
```

---

## Task 2: Pydantic 스키마 + 스키마 테스트

**Files:**
- Create: `backend/schemas/advisor.py`
- Create: `tests/api/test_schemas_advisor.py`

- [ ] **Step 1: 실패할 테스트 작성**

`tests/api/test_schemas_advisor.py`:
```python
"""backend/schemas/advisor.py Pydantic 스키마 테스트."""
import pytest
from pydantic import ValidationError
from backend.schemas.advisor import (
    IndustriesResponse,
    StartupAdvisorRequest,
    RankedCommerce,
    AdvisorResponse,
)


def test_industries_response():
    r = IndustriesResponse(quarter="2025Q4", industries=["커피음료", "한식음식점"])
    assert r.quarter == "2025Q4"
    assert len(r.industries) == 2


def test_startup_advisor_request_defaults():
    req = StartupAdvisorRequest(industry_nm="커피음료")
    assert req.quarter == "2025Q4"


def test_ranked_commerce_valid_tiers():
    for tier in ["추천", "주의", "비추천"]:
        r = RankedCommerce(
            comm_cd="A001", comm_nm="역삼", gu_nm="강남구",
            tier=tier, advisor_score=70.0,
            gri_score=38.0, flow_volume=12000,
            closure_rate=1.5, llm_reason=None,
        )
        assert r.tier == tier


def test_ranked_commerce_invalid_tier_raises():
    with pytest.raises(ValidationError):
        RankedCommerce(
            comm_cd="A001", comm_nm="역삼", gu_nm="강남구",
            tier="최고",  # 유효하지 않은 값
            advisor_score=70.0, gri_score=38.0,
            flow_volume=12000, closure_rate=1.5, llm_reason=None,
        )


def test_advisor_response_empty_commerces():
    resp = AdvisorResponse(
        industry_nm="커피음료", quarter="2025Q4",
        summary="요약 텍스트", caution="주의 텍스트",
        commerces=[], model_used="none",
    )
    assert resp.industry_nm == "커피음료"
    assert resp.commerces == []
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
pytest tests/api/test_schemas_advisor.py -v
```
Expected: `ImportError: cannot import name 'IndustriesResponse' from 'backend.schemas.advisor'`

- [ ] **Step 3: 스키마 구현**

`backend/schemas/advisor.py` 생성:
```python
"""AI 창업 입지 분석 API 스키마."""
from __future__ import annotations
from typing import Literal
from pydantic import BaseModel


class IndustriesResponse(BaseModel):
    quarter: str
    industries: list[str]


class StartupAdvisorRequest(BaseModel):
    industry_nm: str
    quarter: str = "2025Q4"


class RankedCommerce(BaseModel):
    comm_cd: str
    comm_nm: str
    gu_nm: str
    tier: Literal["추천", "주의", "비추천"]
    advisor_score: float
    gri_score: float | None
    flow_volume: int | None
    closure_rate: float | None
    llm_reason: str | None  # LLM 생성 이유 (어드바이저 점수 상위 5개에만 생성, 나머지 None)


class AdvisorResponse(BaseModel):
    industry_nm: str
    quarter: str
    summary: str        # LLM 전체 요약 (2~3문장). API 실패 시 빈 문자열.
    caution: str        # LLM 주의사항 (1문장). API 실패 시 빈 문자열.
    commerces: list[RankedCommerce]
    model_used: str     # "claude-haiku-4-5" 또는 "none"
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
pytest tests/api/test_schemas_advisor.py -v
```
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add backend/schemas/advisor.py tests/api/test_schemas_advisor.py
git commit -m "feat: add advisor Pydantic schemas + schema tests"
```

---

## Task 3: GET /api/advisor/industries 엔드포인트

**Files:**
- Create: `backend/api/advisor.py`
- Create: `tests/api/test_advisor_industries.py`

- [ ] **Step 1: 실패할 테스트 작성**

`tests/api/test_advisor_industries.py`:
```python
"""GET /api/advisor/industries 엔드포인트 테스트."""
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from backend.main import app
from backend.api.deps import get_session, get_cache


def _mock_cache():
    cache = MagicMock()
    cache.get.return_value = None
    return cache


class FakeRow:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


class TestAdvisorIndustries:
    def test_returns_sorted_industries(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = [
            FakeRow(industry_nm="한식음식점"),
            FakeRow(industry_nm="커피음료"),
        ]
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)

        response = client.get("/api/advisor/industries?quarter=2025Q4")

        assert response.status_code == 200
        data = response.json()
        assert data["quarter"] == "2025Q4"
        assert "커피음료" in data["industries"]
        assert "한식음식점" in data["industries"]
        app.dependency_overrides.clear()

    def test_empty_when_no_data(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = []
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache
        client = TestClient(app)

        response = client.get("/api/advisor/industries?quarter=2024Q1")

        assert response.status_code == 200
        assert response.json()["industries"] == []
        app.dependency_overrides.clear()
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
pytest tests/api/test_advisor_industries.py -v
```
Expected: `ImportError` 또는 404 오류 (라우터 미등록)

- [ ] **Step 3: advisor.py 생성 + industries 엔드포인트 구현**

`backend/api/advisor.py` 생성:
```python
"""GET /api/advisor/industries, POST /api/advisor/startup — AI 창업 입지 분석."""
from __future__ import annotations

import json
import logging

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.api.deps import get_session
from backend.schemas.advisor import (
    AdvisorResponse,
    IndustriesResponse,
    RankedCommerce,
    StartupAdvisorRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/advisor/industries", response_model=IndustriesResponse)
def list_industries(
    quarter: str = "2025Q4",
    db: Session = Depends(get_session),
):
    rows = db.execute(
        text(
            "SELECT DISTINCT industry_nm FROM store_info "
            "WHERE year_quarter = :q ORDER BY industry_nm"
        ),
        {"q": quarter},
    ).fetchall()
    return IndustriesResponse(quarter=quarter, industries=[r.industry_nm for r in rows])
```

- [ ] **Step 4: main.py에 라우터 등록**

`backend/main.py`에서:
```python
from backend.api import barrier_routes, barriers, commerce, data_sources, export, insights, od, validation
```
→
```python
from backend.api import advisor, barrier_routes, barriers, commerce, data_sources, export, insights, od, validation
```

그리고 `app.include_router(export.router ...)` 아래에 추가:
```python
app.include_router(advisor.router, prefix="/api", tags=["advisor"])
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

```bash
pytest tests/api/test_advisor_industries.py -v
```
Expected: 2 passed

- [ ] **Step 6: Commit**

```bash
git add backend/api/advisor.py backend/main.py tests/api/test_advisor_industries.py
git commit -m "feat: add GET /api/advisor/industries endpoint"
```

---

## Task 4: 점수 계산 + 티어 분류 (순수 함수)

**Files:**
- Modify: `backend/api/advisor.py` (함수 추가)
- Create: `tests/api/test_advisor_scoring.py`

- [ ] **Step 1: 실패할 테스트 작성**

`tests/api/test_advisor_scoring.py`:
```python
"""어드바이저 점수 계산 + 티어 분류 순수 함수 테스트."""
import pytest
from backend.api.advisor import _compute_advisor_scores, _assign_tiers


class FakeRow:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


def _make_row(comm_cd, comm_nm, gu_nm, gri_score, flow_volume, closure_rate, degree_centrality):
    return FakeRow(
        comm_cd=comm_cd, comm_nm=comm_nm, gu_nm=gu_nm,
        gri_score=gri_score, flow_volume=flow_volume,
        closure_rate=closure_rate, degree_centrality=degree_centrality,
    )


class TestComputeAdvisorScores:
    def test_high_gri_gives_low_score(self):
        rows = [
            _make_row("A", "안전", "강남구", 20.0, 10000, 0.5, 0.8),
            _make_row("B", "위험", "관악구", 90.0, 1000,  5.0, 0.1),
        ]
        scored = _compute_advisor_scores(rows)
        safe = next(s for s in scored if s["comm_cd"] == "A")
        risky = next(s for s in scored if s["comm_cd"] == "B")
        assert safe["advisor_score"] > risky["advisor_score"]

    def test_returns_sorted_descending(self):
        rows = [
            _make_row("A", "낮은점수", "강남구", 80.0, 1000, 4.0, 0.1),
            _make_row("B", "높은점수", "관악구", 20.0, 9000, 0.5, 0.9),
        ]
        scored = _compute_advisor_scores(rows)
        assert scored[0]["comm_cd"] == "B"
        assert scored[1]["comm_cd"] == "A"

    def test_none_values_handled(self):
        rows = [_make_row("A", "결측", "강남구", None, None, None, None)]
        scored = _compute_advisor_scores(rows)
        assert scored[0]["advisor_score"] == pytest.approx(50.0 * 0.40, abs=1.0)

    def test_score_in_range(self):
        rows = [
            _make_row("A", "테스트", "강남구", 50.0, 5000, 2.0, 0.5),
        ]
        scored = _compute_advisor_scores(rows)
        assert 0.0 <= scored[0]["advisor_score"] <= 100.0


class TestAssignTiers:
    def test_top_30_percent_is_recommended(self):
        # 10개 상권: 상위 3개(0~29%)는 추천
        scored = [{"comm_cd": str(i), "advisor_score": float(10 - i)} for i in range(10)]
        result = _assign_tiers(scored)
        assert result[0]["tier"] == "추천"
        assert result[2]["tier"] == "추천"
        assert result[3]["tier"] == "주의"

    def test_bottom_30_percent_is_not_recommended(self):
        scored = [{"comm_cd": str(i), "advisor_score": float(10 - i)} for i in range(10)]
        result = _assign_tiers(scored)
        assert result[7]["tier"] == "비추천"
        assert result[9]["tier"] == "비추천"

    def test_middle_40_percent_is_caution(self):
        scored = [{"comm_cd": str(i), "advisor_score": float(10 - i)} for i in range(10)]
        result = _assign_tiers(scored)
        assert result[3]["tier"] == "주의"
        assert result[6]["tier"] == "주의"

    def test_single_item_gets_recommended(self):
        scored = [{"comm_cd": "A", "advisor_score": 50.0}]
        result = _assign_tiers(scored)
        assert result[0]["tier"] == "추천"
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
pytest tests/api/test_advisor_scoring.py -v
```
Expected: `ImportError: cannot import name '_compute_advisor_scores'`

- [ ] **Step 3: 점수 계산 + 티어 함수 구현**

`backend/api/advisor.py`의 `router = APIRouter()` 바로 아래에 추가:
```python
def _compute_advisor_scores(rows: list) -> list[dict]:
    """각 상권의 어드바이저 점수를 계산해 내림차순 정렬된 dict 리스트로 반환."""
    flows = np.array([float(r.flow_volume or 0) for r in rows])
    flow_min, flow_max = flows.min(), flows.max()
    flow_range = flow_max - flow_min if flow_max > flow_min else 1.0
    norm_flows = (flows - flow_min) / flow_range * 100.0

    results = []
    for i, r in enumerate(rows):
        gri = float(r.gri_score or 50.0)
        closure = float(r.closure_rate or 0.0)
        centrality = float(r.degree_centrality or 0.0)
        score = (
            (100.0 - gri) * 0.40
            + norm_flows[i] * 0.30
            + max(0.0, 100.0 - closure * 10.0) * 0.20
            + centrality * 100.0 * 0.10
        )
        results.append({
            "comm_cd": r.comm_cd,
            "comm_nm": r.comm_nm,
            "gu_nm": r.gu_nm or "",
            "advisor_score": round(score, 2),
            "gri_score": r.gri_score,
            "flow_volume": r.flow_volume,
            "closure_rate": r.closure_rate,
        })

    results.sort(key=lambda x: x["advisor_score"], reverse=True)
    return results


def _assign_tiers(scored: list[dict]) -> list[dict]:
    """점수 내림차순 리스트에 추천/주의/비추천 tier를 부여해 반환."""
    n = len(scored)
    for i, item in enumerate(scored):
        pct = i / n if n > 0 else 0.0
        if pct < 0.30:
            item["tier"] = "추천"
        elif pct < 0.70:
            item["tier"] = "주의"
        else:
            item["tier"] = "비추천"
    return scored
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
pytest tests/api/test_advisor_scoring.py -v
```
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add backend/api/advisor.py tests/api/test_advisor_scoring.py
git commit -m "feat: add advisor score computation and tier assignment functions"
```

---

## Task 5: POST /api/advisor/startup (통계 결과, LLM 없음)

**Files:**
- Modify: `backend/api/advisor.py`
- Create: `tests/api/test_advisor_startup.py`

- [ ] **Step 1: 실패할 테스트 작성**

`tests/api/test_advisor_startup.py`:
```python
"""POST /api/advisor/startup 엔드포인트 테스트 (통계 전용)."""
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from backend.main import app
from backend.api.deps import get_session, get_cache


def _mock_cache():
    c = MagicMock()
    c.get.return_value = None
    return c


class FakeRow:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


def _make_commerce_rows():
    return [
        FakeRow(comm_cd="A001", comm_nm="역삼1동", gu_nm="강남구",
                gri_score=30.0, flow_volume=12000, closure_rate=1.0, degree_centrality=0.8),
        FakeRow(comm_cd="A002", comm_nm="봉천2동", gu_nm="관악구",
                gri_score=50.0, flow_volume=6000, closure_rate=2.0, degree_centrality=0.4),
        FakeRow(comm_cd="A003", comm_nm="신림1동", gu_nm="관악구",
                gri_score=80.0, flow_volume=2000, closure_rate=4.0, degree_centrality=0.2),
    ]


class TestAdvisorStartup:
    def _setup(self, rows):
        mock_db = MagicMock()
        mock_db.execute.return_value.fetchall.return_value = rows
        app.dependency_overrides[get_session] = lambda: mock_db
        app.dependency_overrides[get_cache] = _mock_cache

    def test_returns_200_with_commerces(self):
        self._setup(_make_commerce_rows())
        client = TestClient(app)
        with patch("backend.api.advisor._call_claude", return_value=("", "", {})):
            response = client.post(
                "/api/advisor/startup",
                json={"industry_nm": "커피음료", "quarter": "2025Q4"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["industry_nm"] == "커피음료"
        assert len(data["commerces"]) == 3
        app.dependency_overrides.clear()

    def test_first_commerce_is_recommended(self):
        self._setup(_make_commerce_rows())
        client = TestClient(app)
        with patch("backend.api.advisor._call_claude", return_value=("", "", {})):
            response = client.post(
                "/api/advisor/startup",
                json={"industry_nm": "커피음료", "quarter": "2025Q4"},
            )
        data = response.json()
        # 첫 번째(최고점)는 추천
        assert data["commerces"][0]["tier"] == "추천"
        # 마지막(최저점)는 비추천
        assert data["commerces"][-1]["tier"] == "비추천"
        app.dependency_overrides.clear()

    def test_returns_422_when_no_commerces(self):
        self._setup([])
        client = TestClient(app)
        response = client.post(
            "/api/advisor/startup",
            json={"industry_nm": "커피음료", "quarter": "2024Q1"},
        )
        assert response.status_code == 422
        app.dependency_overrides.clear()
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
pytest tests/api/test_advisor_startup.py -v
```
Expected: 404 또는 `ImportError`

- [ ] **Step 3: startup 엔드포인트 구현 (LLM stub 포함)**

`backend/api/advisor.py`에 다음 두 함수와 엔드포인트를 추가:

```python
def _build_llm_context(industry_nm: str, scored: list[dict]) -> str:
    top5 = scored[:5]
    bottom3 = scored[-3:]
    lines = [f"{industry_nm} 창업을 위한 서울 상권 분석 데이터입니다.\n"]
    lines.append("[추천 후보 상권 (상위 5개)]")
    for item in top5:
        lines.append(
            f"- {item['comm_nm']} ({item['gu_nm']}): "
            f"GRI {item['gri_score'] or 'N/A'}, "
            f"유동인구 {item['flow_volume'] or 'N/A'}, "
            f"폐업률 {item['closure_rate'] or 'N/A'}%"
        )
    lines.append("\n[비추천 상권 (하위 3개)]")
    for item in bottom3:
        lines.append(
            f"- {item['comm_nm']} ({item['gu_nm']}): "
            f"GRI {item['gri_score'] or 'N/A'}, "
            f"유동인구 {item['flow_volume'] or 'N/A'}, "
            f"폐업률 {item['closure_rate'] or 'N/A'}%"
        )
    lines.append("""
다음 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요:
{
  "summary": "전체 상황 2~3문장 요약",
  "reasons": [{"comm_cd": "상권코드", "reason": "추천 이유 1~2문장"}],
  "caution": "가장 중요한 주의사항 1문장"
}""")
    return "\n".join(lines)


def _call_claude(industry_nm: str, scored: list[dict]) -> tuple[str, str, dict[str, str]]:
    """Claude API를 호출해 (summary, caution, reasons_by_comm_cd)를 반환.
    API 키 없거나 호출 실패 시 ('', '', {}) 반환.
    """
    from backend.config import settings
    if not settings.anthropic_api_key:
        return "", "", {}
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system="당신은 서울시 상권 데이터를 분석하는 창업 컨설턴트입니다. 요청받은 JSON 형식으로만 응답합니다.",
            messages=[{"role": "user", "content": _build_llm_context(industry_nm, scored)}],
        )
        raw = message.content[0].text.strip()
        data = json.loads(raw)
        reasons = {r["comm_cd"]: r["reason"] for r in data.get("reasons", [])}
        return data.get("summary", ""), data.get("caution", ""), reasons
    except Exception:
        logger.exception("Claude API 호출 실패, 통계 결과만 반환")
        return "", "", {}


@router.post("/advisor/startup", response_model=AdvisorResponse)
def startup_advisor(
    body: StartupAdvisorRequest,
    db: Session = Depends(get_session),
):
    rows = db.execute(
        text("""
            SELECT ca.comm_cd, cb.comm_nm, ab.gu_nm,
                   ca.gri_score, ca.flow_volume, ca.closure_rate, ca.degree_centrality
            FROM commerce_analysis ca
            JOIN commerce_boundary cb ON cb.comm_cd = ca.comm_cd
            LEFT JOIN LATERAL (
                SELECT gu_nm FROM admin_boundary
                WHERE ST_Contains(geom, ST_PointOnSurface(cb.geom)) LIMIT 1
            ) ab ON TRUE
            WHERE ca.year_quarter = :quarter
        """),
        {"quarter": body.quarter},
    ).fetchall()

    if not rows:
        raise HTTPException(status_code=422, detail="해당 분기에 상권 데이터가 없습니다")

    scored = _assign_tiers(_compute_advisor_scores(rows))
    summary, caution, reasons = _call_claude(body.industry_nm, scored)

    commerces = [
        RankedCommerce(
            comm_cd=item["comm_cd"],
            comm_nm=item["comm_nm"],
            gu_nm=item["gu_nm"],
            tier=item["tier"],
            advisor_score=item["advisor_score"],
            gri_score=item["gri_score"],
            flow_volume=item["flow_volume"],
            closure_rate=item["closure_rate"],
            llm_reason=reasons.get(item["comm_cd"]),
        )
        for item in scored
    ]

    model_used = "claude-haiku-4-5" if summary else "none"
    return AdvisorResponse(
        industry_nm=body.industry_nm,
        quarter=body.quarter,
        summary=summary,
        caution=caution,
        commerces=commerces,
        model_used=model_used,
    )
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
pytest tests/api/test_advisor_startup.py -v
```
Expected: 3 passed

- [ ] **Step 5: 전체 API 테스트 확인**

```bash
pytest tests/api/ -v --tb=short
```
Expected: 기존 테스트 포함 모두 pass

- [ ] **Step 6: Commit**

```bash
git add backend/api/advisor.py tests/api/test_advisor_startup.py
git commit -m "feat: add POST /api/advisor/startup with scoring + LLM integration"
```

---

## Task 6: LLM fallback 검증 + 통합 테스트

**Files:**
- Modify: `tests/api/test_advisor_startup.py`

- [ ] **Step 1: LLM fallback 테스트 추가**

`tests/api/test_advisor_startup.py`의 `TestAdvisorStartup` 클래스에 추가:
```python
    def test_llm_failure_returns_empty_summary(self):
        """Claude API 실패 시 summary/caution이 빈 문자열이고 200 반환."""
        self._setup(_make_commerce_rows())
        client = TestClient(app)
        with patch("backend.api.advisor._call_claude", return_value=("", "", {})):
            response = client.post(
                "/api/advisor/startup",
                json={"industry_nm": "커피음료", "quarter": "2025Q4"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["summary"] == ""
        assert data["caution"] == ""
        assert data["model_used"] == "none"
        app.dependency_overrides.clear()

    def test_llm_success_fills_summary(self):
        """Claude API 성공 시 summary/caution/llm_reason이 채워짐."""
        self._setup(_make_commerce_rows())
        client = TestClient(app)
        fake_reasons = {"A001": "유동인구가 많아 유리합니다."}
        with patch(
            "backend.api.advisor._call_claude",
            return_value=("전체 요약 텍스트", "주의사항 텍스트", fake_reasons),
        ):
            response = client.post(
                "/api/advisor/startup",
                json={"industry_nm": "커피음료", "quarter": "2025Q4"},
            )
        data = response.json()
        assert data["summary"] == "전체 요약 텍스트"
        assert data["caution"] == "주의사항 텍스트"
        assert data["model_used"] == "claude-haiku-4-5"
        # A001은 highest score이므로 llm_reason 있어야 함
        first = next(c for c in data["commerces"] if c["comm_cd"] == "A001")
        assert first["llm_reason"] == "유동인구가 많아 유리합니다."
        app.dependency_overrides.clear()
```

- [ ] **Step 2: 테스트 실행 → 통과 확인**

```bash
pytest tests/api/test_advisor_startup.py tests/api/test_advisor_industries.py tests/api/test_advisor_scoring.py tests/api/test_schemas_advisor.py -v
```
Expected: 13 passed

- [ ] **Step 3: Commit**

```bash
git add tests/api/test_advisor_startup.py
git commit -m "test: add LLM fallback and success path tests for advisor endpoint"
```

---

## Task 7: 프론트엔드 Mock 데이터

**Files:**
- Create: `frontend/public/data/mock_advisor_industries.json`
- Create: `frontend/public/data/mock_advisor_startup.json`

- [ ] **Step 1: mock_advisor_industries.json 생성**

`frontend/public/data/mock_advisor_industries.json`:
```json
{
  "quarter": "2025Q4",
  "industries": [
    "커피음료",
    "한식음식점",
    "분식",
    "중식음식점",
    "편의점",
    "미용실",
    "약국",
    "의류소매",
    "학원",
    "제과제빵"
  ]
}
```

- [ ] **Step 2: mock_advisor_startup.json 생성**

`frontend/public/data/mock_advisor_startup.json`:
```json
{
  "industry_nm": "커피음료",
  "quarter": "2025Q4",
  "summary": "강남구 역삼1동 일대는 점심 유동인구가 최상위권이며 GRI 30으로 안정적입니다. 관악구 봉천2동은 대학생 유동인구가 꾸준하고 낮은 폐업률로 커피음료 창업에 유리한 환경을 갖추고 있습니다.",
  "caution": "신림1동 일대는 동종 업종 경쟁 밀도가 높고 GRI 상승 추세이므로 신규 진입 시 주의가 필요합니다.",
  "model_used": "claude-haiku-4-5",
  "commerces": [
    {
      "comm_cd": "3110001",
      "comm_nm": "역삼1동 상권",
      "gu_nm": "강남구",
      "tier": "추천",
      "advisor_score": 82.4,
      "gri_score": 30.0,
      "flow_volume": 12400,
      "closure_rate": 1.0,
      "llm_reason": "점심 유동인구 최상위권이며 낮은 GRI가 안정적 창업 환경을 뒷받침합니다."
    },
    {
      "comm_cd": "3110002",
      "comm_nm": "봉천2동 상권",
      "gu_nm": "관악구",
      "tier": "추천",
      "advisor_score": 74.1,
      "gri_score": 42.0,
      "flow_volume": 9800,
      "closure_rate": 0.8,
      "llm_reason": "대학가 특성으로 꾸준한 방문 수요가 있으며 폐업률이 매우 낮습니다."
    },
    {
      "comm_cd": "3110003",
      "comm_nm": "신림1동 상권",
      "gu_nm": "관악구",
      "tier": "주의",
      "advisor_score": 55.3,
      "gri_score": 61.0,
      "flow_volume": 7200,
      "closure_rate": 2.1,
      "llm_reason": null
    },
    {
      "comm_cd": "3110004",
      "comm_nm": "서초2동 상권",
      "gu_nm": "강남구",
      "tier": "주의",
      "advisor_score": 48.7,
      "gri_score": 55.0,
      "flow_volume": 6100,
      "closure_rate": 1.8,
      "llm_reason": null
    },
    {
      "comm_cd": "3110005",
      "comm_nm": "난곡 상권",
      "gu_nm": "관악구",
      "tier": "비추천",
      "advisor_score": 31.2,
      "gri_score": 78.0,
      "flow_volume": 4100,
      "closure_rate": 3.5,
      "llm_reason": null
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/public/data/mock_advisor_industries.json frontend/public/data/mock_advisor_startup.json
git commit -m "feat: add mock data files for advisor demo mode"
```

---

## Task 8: useStartupAdvisor 훅

**Files:**
- Create: `frontend/src/hooks/useStartupAdvisor.ts`
- Create: `frontend/src/hooks/useStartupAdvisor.test.ts`

- [ ] **Step 1: 실패할 테스트 작성**

`frontend/src/hooks/useStartupAdvisor.test.ts`:
```typescript
/* @vitest-environment jsdom */
import { renderHook, waitFor, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStartupAdvisor } from './useStartupAdvisor'

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body }
}

const MOCK_INDUSTRIES = { quarter: '2025Q4', industries: ['커피음료', '한식음식점'] }
const MOCK_RESULT = {
  industry_nm: '커피음료', quarter: '2025Q4',
  summary: '요약', caution: '주의',
  model_used: 'claude-haiku-4-5',
  commerces: [
    { comm_cd: 'A001', comm_nm: '역삼1동', gu_nm: '강남구', tier: '추천',
      advisor_score: 82.4, gri_score: 30.0, flow_volume: 12400,
      closure_rate: 1.0, llm_reason: '유리합니다.' },
  ],
}

describe('useStartupAdvisor', () => {
  it('loads industries on mount', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(MOCK_INDUSTRIES))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useStartupAdvisor('2025Q4'))

    await waitFor(() => expect(result.current.industries).toHaveLength(2))
    expect(result.current.industries).toContain('커피음료')
  })

  it('analyze sets isLoading true then resolves result', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(MOCK_INDUSTRIES))
      .mockResolvedValueOnce(jsonResponse(MOCK_RESULT))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useStartupAdvisor('2025Q4'))
    await waitFor(() => expect(result.current.industries).toHaveLength(2))

    act(() => { result.current.analyze('커피음료') })
    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.result).not.toBeNull())
    expect(result.current.isLoading).toBe(false)
    expect(result.current.result?.summary).toBe('요약')
  })

  it('sets error on fetch failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(MOCK_INDUSTRIES))
      .mockResolvedValueOnce({ ok: false, status: 500 })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useStartupAdvisor('2025Q4'))
    await waitFor(() => expect(result.current.industries).toHaveLength(2))

    await act(async () => { await result.current.analyze('커피음료') })
    expect(result.current.error).toBeTruthy()
    expect(result.current.result).toBeNull()
  })

  it('reset clears result and error', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(MOCK_INDUSTRIES))
      .mockResolvedValueOnce(jsonResponse(MOCK_RESULT))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useStartupAdvisor('2025Q4'))
    await waitFor(() => expect(result.current.industries).toHaveLength(2))
    await act(async () => { await result.current.analyze('커피음료') })
    await waitFor(() => expect(result.current.result).not.toBeNull())

    act(() => { result.current.reset() })
    expect(result.current.result).toBeNull()
    expect(result.current.error).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd frontend && npx vitest run src/hooks/useStartupAdvisor.test.ts
```
Expected: `Cannot find module './useStartupAdvisor'`

- [ ] **Step 3: 훅 구현**

`frontend/src/hooks/useStartupAdvisor.ts`:
```typescript
import { useState, useEffect, useCallback } from 'react'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

export interface AdvisorCommerce {
  comm_cd: string
  comm_nm: string
  gu_nm: string
  tier: '추천' | '주의' | '비추천'
  advisor_score: number
  gri_score: number | null
  flow_volume: number | null
  closure_rate: number | null
  llm_reason: string | null
}

export interface AdvisorResult {
  industry_nm: string
  quarter: string
  summary: string
  caution: string
  commerces: AdvisorCommerce[]
  model_used: string
}

export function useStartupAdvisor(quarter: string) {
  const [industries, setIndustries] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<AdvisorResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const isDemo = !BASE_URL
    const url = isDemo
      ? '/data/mock_advisor_industries.json'
      : `${BASE_URL}/api/advisor/industries?quarter=${quarter}`
    fetch(url)
      .then((r) => r.json())
      .then((data) => setIndustries(data.industries ?? []))
      .catch(() => setIndustries([]))
  }, [quarter])

  const analyze = useCallback(async (industry: string) => {
    setIsLoading(true)
    setError(null)
    const isDemo = !BASE_URL
    try {
      let data: AdvisorResult
      if (isDemo) {
        const r = await fetch('/data/mock_advisor_startup.json')
        data = await r.json()
      } else {
        const r = await fetch(`${BASE_URL}/api/advisor/startup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ industry_nm: industry, quarter }),
        })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        data = await r.json()
      }
      setResult(data)
    } catch {
      setError('분석 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [quarter])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { industries, isLoading, result, error, analyze, reset }
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
cd frontend && npx vitest run src/hooks/useStartupAdvisor.test.ts
```
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useStartupAdvisor.ts frontend/src/hooks/useStartupAdvisor.test.ts
git commit -m "feat: add useStartupAdvisor hook with demo mode support"
```

---

## Task 9: StartupAdvisorPanel 컴포넌트

**Files:**
- Create: `frontend/src/components/StartupAdvisorPanel.tsx`
- Create: `frontend/src/components/StartupAdvisorPanel.test.tsx`

- [ ] **Step 1: 실패할 테스트 작성**

`frontend/src/components/StartupAdvisorPanel.test.tsx`:
```typescript
/* @vitest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StartupAdvisorPanel } from './StartupAdvisorPanel'
import type { AdvisorResult } from '../hooks/useStartupAdvisor'

const MOCK_RESULT: AdvisorResult = {
  industry_nm: '커피음료', quarter: '2025Q4',
  summary: '역삼1동은 유리합니다.',
  caution: '신림1동은 주의하세요.',
  model_used: 'claude-haiku-4-5',
  commerces: [
    { comm_cd: 'A001', comm_nm: '역삼1동 상권', gu_nm: '강남구', tier: '추천',
      advisor_score: 82.4, gri_score: 30.0, flow_volume: 12400, closure_rate: 1.0,
      llm_reason: '유리합니다.' },
    { comm_cd: 'A002', comm_nm: '신림1동 상권', gu_nm: '관악구', tier: '비추천',
      advisor_score: 31.2, gri_score: 78.0, flow_volume: 4100, closure_rate: 3.5,
      llm_reason: null },
  ],
}

describe('StartupAdvisorPanel', () => {
  it('shows industry dropdown and analyze button when no result', () => {
    render(
      <StartupAdvisorPanel
        industries={['커피음료', '한식음식점']}
        isLoading={false}
        result={null}
        error={null}
        onAnalyze={vi.fn()}
        onReset={vi.fn()}
        onSelectCommerce={vi.fn()}
      />,
    )
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('분석하기')).toBeInTheDocument()
  })

  it('disables dropdown and button while loading', () => {
    render(
      <StartupAdvisorPanel
        industries={['커피음료']}
        isLoading={true}
        result={null}
        error={null}
        onAnalyze={vi.fn()}
        onReset={vi.fn()}
        onSelectCommerce={vi.fn()}
      />,
    )
    expect(screen.getByRole('combobox')).toBeDisabled()
    expect(screen.getByRole('button', { name: /분석 중/ })).toBeDisabled()
  })

  it('shows summary and commerce list when result is present', () => {
    render(
      <StartupAdvisorPanel
        industries={['커피음료']}
        isLoading={false}
        result={MOCK_RESULT}
        error={null}
        onAnalyze={vi.fn()}
        onReset={vi.fn()}
        onSelectCommerce={vi.fn()}
      />,
    )
    expect(screen.getByText('역삼1동은 유리합니다.')).toBeInTheDocument()
    expect(screen.getByText('신림1동은 주의하세요.')).toBeInTheDocument()
    expect(screen.getByText(/역삼1동 상권/)).toBeInTheDocument()
  })

  it('calls onSelectCommerce when commerce item clicked', () => {
    const onSelect = vi.fn()
    render(
      <StartupAdvisorPanel
        industries={['커피음료']}
        isLoading={false}
        result={MOCK_RESULT}
        error={null}
        onAnalyze={vi.fn()}
        onReset={vi.fn()}
        onSelectCommerce={onSelect}
      />,
    )
    fireEvent.click(screen.getByText(/역삼1동 상권/))
    expect(onSelect).toHaveBeenCalledWith('A001')
  })

  it('calls onReset when 초기화 button clicked', () => {
    const onReset = vi.fn()
    render(
      <StartupAdvisorPanel
        industries={['커피음료']}
        isLoading={false}
        result={MOCK_RESULT}
        error={null}
        onAnalyze={vi.fn()}
        onReset={onReset}
        onSelectCommerce={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('초기화'))
    expect(onReset).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd frontend && npx vitest run src/components/StartupAdvisorPanel.test.tsx
```
Expected: `Cannot find module './StartupAdvisorPanel'`

- [ ] **Step 3: 컴포넌트 구현**

`frontend/src/components/StartupAdvisorPanel.tsx`:
```tsx
import { useState } from 'react'
import type { AdvisorResult } from '../hooks/useStartupAdvisor'

const TIER_STYLE = {
  '추천':    { bg: '#14532d22', border: '#166534', text: '#4ade80', badge: '#16a34a' },
  '주의':    { bg: '#78350f22', border: '#92400e', text: '#fbbf24', badge: '#d97706' },
  '비추천':  { bg: '#7f1d1d22', border: '#991b1b', text: '#f87171', badge: '#dc2626' },
} as const

interface Props {
  industries: string[]
  isLoading: boolean
  result: AdvisorResult | null
  error: string | null
  onAnalyze: (industry: string) => void
  onReset: () => void
  onSelectCommerce: (commCd: string) => void
}

export function StartupAdvisorPanel({
  industries, isLoading, result, error, onAnalyze, onReset, onSelectCommerce,
}: Props) {
  const [selected, setSelected] = useState(industries[0] ?? '')

  return (
    <div style={{ background: '#1a1f2e', borderBottom: '2px solid #f97316', padding: '12px', flexShrink: 0 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 'bold' }}>
          🤖 AI 창업 입지 분석
        </span>
        {result && (
          <button
            onClick={onReset}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12 }}
          >
            초기화
          </button>
        )}
      </div>

      {/* 드롭다운 + 버튼 */}
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={isLoading}
        style={{
          width: '100%', background: '#0f172a', border: '1px solid #475569',
          borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#e2e8f0',
          marginBottom: 8, cursor: isLoading ? 'not-allowed' : 'pointer',
        }}
      >
        {industries.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
      </select>
      <button
        onClick={() => onAnalyze(selected)}
        disabled={isLoading || industries.length === 0}
        style={{
          width: '100%', background: isLoading ? '#7c3c1a' : '#f97316',
          border: 'none', borderRadius: 6, padding: 8,
          color: 'white', fontSize: 12, fontWeight: 'bold',
          cursor: isLoading ? 'not-allowed' : 'pointer', marginBottom: result ? 10 : 0,
        }}
      >
        {isLoading ? '분석 중...' : '분석하기'}
      </button>

      {/* 에러 */}
      {error && (
        <div style={{ fontSize: 10, color: '#f87171', marginTop: 6 }}>{error}</div>
      )}

      {/* 결과 */}
      {result && (
        <>
          {result.summary ? (
            <div style={{
              background: '#0f172a', borderRadius: 6, padding: 8,
              fontSize: 10, color: '#cbd5e1', lineHeight: 1.6, marginBottom: 6,
            }}>
              {result.summary}
            </div>
          ) : (
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>
              AI 해설을 불러올 수 없습니다. 통계 기반 결과만 표시됩니다.
            </div>
          )}
          {result.caution && (
            <div style={{
              background: '#431407', border: '1px solid #9a3412', borderRadius: 6,
              padding: '6px 8px', fontSize: 10, color: '#fdba74', marginBottom: 8,
            }}>
              ⚠️ {result.caution}
            </div>
          )}
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            상권 랭킹
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {result.commerces.slice(0, 8).map((c, i) => {
              const s = TIER_STYLE[c.tier]
              return (
                <div
                  key={c.comm_cd}
                  onClick={() => onSelectCommerce(c.comm_cd)}
                  style={{
                    background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4,
                    padding: '6px 8px', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: s.text, fontWeight: 'bold' }}>
                      {i + 1}. {c.comm_nm}
                    </div>
                    <div style={{ fontSize: 9, color: '#64748b' }}>
                      GRI {c.gri_score ?? 'N/A'} · 유동 {c.flow_volume?.toLocaleString() ?? 'N/A'}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 9, background: s.badge, color: 'white',
                    padding: '2px 6px', borderRadius: 3,
                  }}>
                    {c.tier}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
cd frontend && npx vitest run src/components/StartupAdvisorPanel.test.tsx
```
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/StartupAdvisorPanel.tsx frontend/src/components/StartupAdvisorPanel.test.tsx
git commit -m "feat: add StartupAdvisorPanel component"
```

---

## Task 10: advisorTiers 오버레이

노드 색상 로직은 `Map.tsx`가 아닌 `frontend/src/layers/CommerceNodeLayer.ts`에 있다.
`createCommerceNodeLayers`에 `advisorTiers` 파라미터를 추가하고, Map.tsx에서 전달한다.

**Files:**
- Modify: `frontend/src/layers/CommerceNodeLayer.ts`
- Modify: `frontend/src/components/Map.tsx`

- [ ] **Step 1: CommerceNodeLayer.ts — 색상 헬퍼 + 타입 추가**

`frontend/src/layers/CommerceNodeLayer.ts`에서 `getGriBorderWidth` 함수 바로 아래에 추가:
```typescript
export type AdvisorTierMap = Map<string, '추천' | '주의' | '비추천'>

export function getAdvisorFillColor(tier: '추천' | '주의' | '비추천'): [number, number, number, number] {
  if (tier === '추천') return [22, 163, 74, 210]
  if (tier === '주의') return [217, 119, 6, 210]
  return [220, 38, 38, 210]
}
```

- [ ] **Step 2: createCommerceNodeLayers 시그니처에 advisorTiers 추가**

`CommerceNodeLayer.ts`의 `createCommerceNodeLayers` 함수 파라미터에 추가:
```typescript
export function createCommerceNodeLayers(
  nodes: CommerceNode[],
  onHover: (info: PickingInfo<CommerceNode>) => void,
  onClick: (info: PickingInfo<CommerceNode>) => void,
  selectedId: string | null,
  advisorTiers?: AdvisorTierMap | null,   // ← 추가
): ScatterplotLayer<CommerceNode>[]
```

- [ ] **Step 3: contextLayer getFillColor 수정**

`contextLayer`의 `getFillColor`를 다음으로 교체:
```typescript
getFillColor: (node) => {
  if (advisorTiers) {
    const tier = advisorTiers.get(node.id)
    if (tier) return getAdvisorFillColor(tier)
    return [100, 100, 100, 40]
  }
  return getContextFillColor(node)
},
```

`contextLayer`의 `updateTriggers.getFillColor`를 다음으로 교체:
```typescript
getFillColor: [contextNodes, advisorTiers],
```

- [ ] **Step 4: candidateLayer getFillColor 수정**

`candidateLayer`의 `getFillColor`를 다음으로 교체:
```typescript
getFillColor: (node) => {
  if (advisorTiers) {
    const tier = advisorTiers.get(node.id)
    if (tier) return getAdvisorFillColor(tier)
    return [100, 100, 100, 60]
  }
  return getCandidateFillColor(node, node.id === selectedId)
},
```

`candidateLayer`의 `updateTriggers.getFillColor`를 다음으로 교체:
```typescript
getFillColor: [candidateNodes, selectedId, advisorTiers],
```

- [ ] **Step 5: Map.tsx — MapProps에 advisorTiers 추가**

`Map.tsx`의 `interface MapProps` (line 73 근처)에 추가:
```typescript
advisorTiers?: Map<string, '추천' | '주의' | '비추천'> | null
```

함수 파라미터 비구조화에도 추가:
```typescript
advisorTiers,
```

- [ ] **Step 6: Map.tsx — createCommerceNodeLayers 호출 수정**

Map.tsx line 412 근처의 호출을 변경:
```typescript
// 변경 전
? createCommerceNodeLayers(
    nodes,
    handleNodeHover,
    handleNodeClick,
    selectedNode?.id ?? null,
  )

// 변경 후
? createCommerceNodeLayers(
    nodes,
    handleNodeHover,
    handleNodeClick,
    selectedNode?.id ?? null,
    advisorTiers,
  )
```

`useMemo` 의존성 배열에 `advisorTiers` 추가:
```typescript
[handleNodeClick, handleNodeHover, nodes, selectedNode?.id, zoomStage, advisorTiers],
```

- [ ] **Step 7: 타입스크립트 오류 없음 확인**

```bash
cd frontend && npx tsc --noEmit
```
Expected: 오류 없음

- [ ] **Step 8: Commit**

```bash
git add frontend/src/layers/CommerceNodeLayer.ts frontend/src/components/Map.tsx
git commit -m "feat: add advisorTiers color overlay to commerce node layers"
```

---

## Task 11: App.tsx 연결

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: import 추가**

`App.tsx` 상단 import 블록에 추가:
```typescript
import { useStartupAdvisor } from './hooks/useStartupAdvisor'
import { StartupAdvisorPanel } from './components/StartupAdvisorPanel'
```

- [ ] **Step 2: useStartupAdvisor 훅 호출 추가**

`App.tsx`에서 기존 훅 호출들 아래에 추가:
```typescript
const advisor = useStartupAdvisor(selectedQuarter)

const advisorTiers = useMemo<Map<string, '추천' | '주의' | '비추천'> | null>(() => {
  if (!advisor.result) return null
  return new Map(advisor.result.commerces.map((c) => [c.comm_cd, c.tier]))
}, [advisor.result])

const handleSelectAdvisorCommerce = useCallback((commCd: string) => {
  const node = nodes.find((n) => n.properties.comm_cd === commCd)
  if (node) setSelectedNode(node)
}, [nodes])
```

- [ ] **Step 3: Map에 advisorTiers prop 전달**

`<Map ... />` 컴포넌트에 prop 추가:
```tsx
advisorTiers={advisorTiers}
```

- [ ] **Step 4: FlowControlPanel 앞에 StartupAdvisorPanel 삽입**

`App.tsx`에서 `<FlowControlPanel .../>` 바로 앞에 추가:
```tsx
<StartupAdvisorPanel
  industries={advisor.industries}
  isLoading={advisor.isLoading}
  result={advisor.result}
  error={advisor.error}
  onAnalyze={advisor.analyze}
  onReset={advisor.reset}
  onSelectCommerce={handleSelectAdvisorCommerce}
/>
```

- [ ] **Step 5: 타입스크립트 오류 없음 확인**

```bash
cd frontend && npx tsc --noEmit
```
Expected: 오류 없음

- [ ] **Step 6: 전체 테스트 실행**

```bash
# 백엔드
pytest tests/ -v --tb=short

# 프론트엔드
cd frontend && npx vitest run
```
Expected: 백엔드 기존 테스트 포함 모두 pass, 프론트엔드 기존 테스트 포함 모두 pass

- [ ] **Step 7: 개발 서버에서 동작 확인**

```bash
# 터미널 1
uvicorn backend.main:app --reload --port 8000

# 터미널 2
cd frontend && npm run dev
```

브라우저에서 확인:
1. 우측 패널 상단에 "🤖 AI 창업 입지 분석" 섹션이 보임
2. 업종 드롭다운에 업종 목록이 로드됨 (데모 모드: mock JSON)
3. [분석하기] 클릭 → 로딩 중 드롭다운·버튼 비활성화
4. 결과 표시: LLM 요약 + 상권 랭킹 목록
5. 지도 노드가 추천(초록)/주의(노랑)/비추천(빨강)으로 변색
6. 상권 클릭 → 지도가 해당 위치로 이동
7. [초기화] → 결과 사라지고 지도 원래 색상 복원

- [ ] **Step 8: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire StartupAdvisorPanel + advisorTiers into App"
```

---

## 최종 점검

- [ ] **백엔드 전체 테스트**

```bash
pytest tests/ -v
```
Expected: 기존 포함 모두 pass (advisor 관련 13개 신규 추가)

- [ ] **프론트엔드 전체 테스트**

```bash
cd frontend && npx vitest run
```
Expected: 기존 포함 모두 pass (advisor 관련 9개 신규 추가)

- [ ] **Railway 배포 환경변수 등록 확인**

Railway 대시보드에서 `ANTHROPIC_API_KEY` 환경변수 등록 필요. 미등록 시 LLM 해설 없이 통계 결과만 표시됨 (정상 동작).
