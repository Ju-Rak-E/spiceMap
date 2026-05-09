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


def _compute_advisor_scores(rows: list) -> list[dict]:
    """각 상권의 어드바이저 점수를 계산해 내림차순 정렬된 dict 리스트로 반환."""
    flows = np.array([float(r.flow_volume or 0) for r in rows])
    flow_min, flow_max = flows.min(), flows.max()
    flow_range = flow_max - flow_min if flow_max > flow_min else 1.0
    norm_flows = (flows - flow_min) / flow_range * 100.0

    results = []
    for i, r in enumerate(rows):
        gri = float(r.gri_score or 50.0)
        centrality = float(r.degree_centrality or 0.0)
        closure_term = (
            max(0.0, 100.0 - float(r.closure_rate) * 10.0) * 0.20
            if r.closure_rate is not None
            else 0.0
        )
        score = (
            (100.0 - gri) * 0.40
            + norm_flows[i] * 0.30
            + closure_term
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
    denom = n - 1 if n > 1 else 1
    for i, item in enumerate(scored):
        pct = i / denom
        if pct < 0.30:
            item["tier"] = "추천"
        elif pct < 0.70:
            item["tier"] = "주의"
        else:
            item["tier"] = "비추천"
    return scored


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
