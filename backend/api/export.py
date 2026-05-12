"""GET /api/export/csv — 우선순위 상권 CSV 다운로드."""
import csv
import io
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.api.deps import get_session

router = APIRouter()

_CSV_HEADERS = [
    "상권코드", "상권명", "자치구", "상권유형",
    "GRI점수", "우선순위점수", "폐업률", "순유입량", "정책권고요약",
]


def _to_store_info_quarter(quarter: str) -> str:
    """'2025Q4' → '20254' 형식으로 변환 (store_info 테이블 STDR_YYQU_CD 형식)."""
    if "Q" in quarter:
        year, q = quarter.split("Q", 1)
        return year + q
    return quarter


@router.get("/export/csv")
def export_csv(
    quarter: str = Query("2025Q4", description="분기 (예: 2025Q4)"),
    gu: list[str] | None = Query(None, description="자치구 필터 (여러 개 가능, 예: 강남구&gu=관악구)"),
    industry_nm: str | None = Query(None, description="업종 필터 (예: 카페)"),
    min_priority: float = Query(0.0, ge=0.0, description="우선순위 하한"),
    db: Session = Depends(get_session),
):
    gu_filter = [g for g in gu if g] if gu else None

    where_clauses = [
        "ca.year_quarter = :quarter",
        "COALESCE(ca.priority_score, 0) >= :min_priority",
    ]
    params: dict = {"quarter": quarter, "min_priority": min_priority}

    if gu_filter:
        where_clauses.append("ab.gu_nm = ANY(:gu_list)")
        params["gu_list"] = gu_filter

    if industry_nm:
        where_clauses.append("""ca.comm_cd IN (
            SELECT DISTINCT m.comm_cd
            FROM store_info si
            JOIN adm_comm_mapping m ON LEFT(m.adm_cd, 5) = si.signgu_cd
            WHERE si.industry_nm = :industry_nm
              AND si.year_quarter = :store_quarter
              AND si.store_count > 0
        )""")
        params["industry_nm"] = industry_nm
        params["store_quarter"] = _to_store_info_quarter(quarter)

    where_sql = " AND ".join(where_clauses)

    sql = text(f"""
        SELECT
            ca.comm_cd,
            ca.comm_nm,
            ab.gu_nm,
            ca.commerce_type,
            ca.gri_score,
            ca.priority_score,
            ca.closure_rate,
            ca.net_flow,
            pc_agg.policy_summary
        FROM commerce_analysis ca
        JOIN commerce_boundary cb ON cb.comm_cd = ca.comm_cd
        LEFT JOIN LATERAL (
            SELECT gu_nm
            FROM admin_boundary
            WHERE ST_Contains(geom, ST_PointOnSurface(cb.geom))
            LIMIT 1
        ) ab ON TRUE
        LEFT JOIN LATERAL (
            SELECT STRING_AGG(policy_text, ' | ' ORDER BY
                CASE severity
                    WHEN 'Critical' THEN 0 WHEN 'High'   THEN 1
                    WHEN 'Medium'   THEN 2 WHEN 'Low'    THEN 3
                    ELSE 4
                END
            ) AS policy_summary
            FROM policy_cards
            WHERE comm_cd = ca.comm_cd AND year_quarter = ca.year_quarter
        ) pc_agg ON TRUE
        WHERE {where_sql}
        ORDER BY ca.priority_score DESC NULLS LAST
    """)
    rows = db.execute(sql, params).fetchall()

    output = io.StringIO()
    output.write("﻿")  # BOM: Excel 한글 깨짐 방지
    writer = csv.writer(output)
    writer.writerow(_CSV_HEADERS)
    for row in rows:
        writer.writerow([
            row.comm_cd,
            row.comm_nm,
            row.gu_nm or "",
            row.commerce_type or "",
            f"{row.gri_score:.1f}" if row.gri_score is not None else "",
            f"{row.priority_score:.1f}" if row.priority_score is not None else "",
            f"{row.closure_rate:.1f}" if row.closure_rate is not None else "",
            f"{row.net_flow:.0f}" if row.net_flow is not None else "",
            row.policy_summary or "",
        ])

    gu_label = "-".join(gu_filter) if gu_filter else "all"
    industry_label = f"_{industry_nm}" if industry_nm else ""
    filename = f"spicemap_{quarter}_{gu_label}{industry_label}.csv"
    encoded_filename = quote(filename, safe="")
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"},
    )
