"""GET /api/insights/policy — 정책 추천 카드 + 우선순위 목록."""
import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.api.deps import get_session, get_cache
from backend.db import CACHE_TTL
from backend.schemas.insights import PolicyCard, PolicyCardsResponse

router = APIRouter()


@router.get("/insights/policy", response_model=PolicyCardsResponse)
def policy_insights(
    quarter: str = Query("2025Q4", description="분기 (예: 2025Q4)"),
    gu: str | None = Query(None, description="자치구 필터 (예: 강남구)"),
    comm_cd: str | None = Query(None, description="특정 상권 코드 (상세 패널용)"),
    min_priority: float = Query(0.0, ge=0.0, description="우선순위 하한"),
    severity: str | None = Query(None, description="Critical/High/Medium/Low 필터"),
    db: Session = Depends(get_session),
    cache=Depends(get_cache),
):
    cache_key = (
        f"insights-policy:{quarter}:{gu or 'all'}:"
        f"{comm_cd or 'all'}:{min_priority}:{severity or 'all'}"
    )
    cached = cache.get(cache_key)
    if cached:
        return json.loads(cached)

    sql = text("""
        SELECT
            pc.rule_id,
            pc.comm_cd          AS commerce_code,
            cb.comm_nm          AS commerce_name,
            pc.severity,
            pc.policy_text,
            pc.rationale,
            pc.triggering_metrics,
            pc.generation_mode,
            ca.priority_score
        FROM policy_cards pc
        JOIN commerce_boundary cb ON cb.comm_cd = pc.comm_cd
        LEFT JOIN commerce_analysis ca
            ON ca.comm_cd = pc.comm_cd
            AND ca.year_quarter = pc.year_quarter
        LEFT JOIN LATERAL (
            SELECT gu_nm
            FROM admin_boundary
            WHERE ST_Contains(geom, ST_PointOnSurface(cb.geom))
            LIMIT 1
        ) ab ON TRUE
        WHERE pc.year_quarter = :quarter
          AND (:gu IS NULL OR ab.gu_nm = :gu)
          AND (:comm_cd IS NULL OR pc.comm_cd = :comm_cd)
          AND (:severity IS NULL OR pc.severity = :severity)
          AND (:min_priority = 0.0 OR COALESCE(ca.priority_score, 0) >= :min_priority)
        ORDER BY
            CASE pc.severity
                WHEN 'Critical' THEN 0 WHEN 'High'   THEN 1
                WHEN 'Medium'   THEN 2 WHEN 'Low'    THEN 3
                ELSE 4
            END,
            COALESCE(ca.priority_score, 0) DESC
    """)
    rows = db.execute(
        sql,
        {
            "quarter": quarter,
            "gu": gu,
            "comm_cd": comm_cd,
            "severity": severity,
            "min_priority": min_priority,
        },
    ).fetchall()

    cards = [
        PolicyCard(
            rule_id=row.rule_id,
            commerce_code=row.commerce_code,
            commerce_name=row.commerce_name,
            severity=row.severity,
            policy_text=row.policy_text,
            rationale=row.rationale or "",
            triggering_metrics=json.loads(row.triggering_metrics) if row.triggering_metrics else {},
            generation_mode="rule_based",
        )
        for row in rows
    ]

    result = PolicyCardsResponse(
        quarter=quarter,
        total_cards=len(cards),
        generation_mode="rule_based",
        cards=cards,
    )
    cache.setex(cache_key, CACHE_TTL, result.model_dump_json())
    return result
