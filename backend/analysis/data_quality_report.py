"""
데이터 품질 검토 스크립트 (Week 1 - Dev-C Task 1)

실행: python -m backend.analysis.data_quality_report
출력: docs/data_quality_report.md
"""
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text

from backend.config import settings

REPORT_PATH = Path(__file__).resolve().parents[2] / "docs" / "data_quality_report.md"

ALLOWED_TABLES = {"living_population", "store_info", "commerce_sales",
                  "commerce_boundary", "od_flows", "admin_boundary"}


def _get_engine():
    try:
        engine = create_engine(settings.database_url)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return engine
    except Exception as e:
        print(f"ERROR: DB 연결 실패 — {e}", file=sys.stderr)
        print("Docker가 실행 중인지 확인하세요: docker compose up -d", file=sys.stderr)
        sys.exit(1)


# ── helpers ──────────────────────────────────────────────
def q(sql: str, engine) -> pd.DataFrame:
    with engine.connect() as conn:
        return pd.read_sql(text(sql), conn)


def q_param(sql: str, params: dict, engine) -> pd.DataFrame:
    with engine.connect() as conn:
        return pd.read_sql(text(sql), conn, params=params)


def null_pct(table: str, columns: list[str], engine) -> pd.DataFrame:
    if table not in ALLOWED_TABLES:
        raise ValueError(f"허용되지 않은 테이블: {table}")
    exprs = ", ".join(
        f"ROUND(100.0 * (COUNT(*) - COUNT({c})) / NULLIF(COUNT(*), 0), 2) AS {c}"
        for c in columns
    )
    return q(f"SELECT {exprs} FROM {table}", engine)


def section(title: str, body: str) -> str:
    return f"\n## {title}\n\n{body}\n"


# ── 1. living_population ─────────────────────────────────
def check_living_population(engine) -> str:
    lines = []

    stats = q("""
        SELECT COUNT(*) AS total,
               COUNT(DISTINCT base_date) AS date_cnt,
               MIN(base_date) AS min_date, MAX(base_date) AS max_date,
               MIN(hour_slot) AS min_hour, MAX(hour_slot) AS max_hour,
               COUNT(DISTINCT adm_cd) AS adm_cnt
        FROM living_population
    """, engine).iloc[0]

    if stats['total'] == 0:
        return section("1. living_population", "데이터 없음 (0건)")

    lines.append("| 지표 | 값 |")
    lines.append("|------|-----|")
    lines.append(f"| 전체 건수 | {stats['total']:,} |")
    lines.append(f"| 날짜 수 | {stats['date_cnt']} ({stats['min_date']} ~ {stats['max_date']}) |")
    lines.append(f"| 시간대 범위 | {stats['min_hour']} ~ {stats['max_hour']} |")
    lines.append(f"| 행정동 수 | {stats['adm_cnt']} |")

    nulls = null_pct("living_population", ["base_date", "hour_slot", "adm_cd", "total_pop"], engine)
    r = nulls.iloc[0]
    lines.append("\n### NULL 비율 (%)\n")
    lines.append("| base_date | hour_slot | adm_cd | total_pop |")
    lines.append("|-----------|-----------|--------|-----------|")
    lines.append(f"| {r['base_date']} | {r['hour_slot']} | {r['adm_cd']} | {r['total_pop']} |")

    non_mvp = q("""
        SELECT COUNT(*) AS cnt FROM living_population
        WHERE adm_cd NOT LIKE '1168%' AND adm_cd NOT LIKE '1162%'
    """, engine).iloc[0]['cnt']
    status = "PASS" if non_mvp == 0 else f"FAIL ({non_mvp}건 이탈)"
    lines.append(f"\n### MVP 필터 검증: **{status}**")

    dist = q("""
        SELECT CASE WHEN adm_cd LIKE '1168%' THEN '강남구'
                    WHEN adm_cd LIKE '1162%' THEN '관악구'
                    ELSE '기타' END AS gu,
               COUNT(*) AS cnt,
               ROUND(AVG(total_pop)::numeric, 1) AS avg_pop
        FROM living_population GROUP BY 1 ORDER BY 1
    """, engine)
    lines.append("\n### 자치구별 분포\n")
    lines.append(dist.to_markdown(index=False))

    outliers = q("""
        SELECT COUNT(*) FILTER (WHERE total_pop < 0) AS negative,
               COUNT(*) FILTER (WHERE total_pop = 0) AS zero,
               PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY total_pop) AS q1,
               PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_pop) AS q3
        FROM living_population
    """, engine).iloc[0]
    iqr = outliers['q3'] - outliers['q1']
    upper = outliers['q3'] + 1.5 * iqr
    extreme = q_param(
        "SELECT COUNT(*) AS cnt FROM living_population WHERE total_pop > :upper",
        {"upper": float(upper)}, engine
    ).iloc[0]['cnt']
    lines.append("\n### 이상치 분석\n")
    lines.append("| 유형 | 건수 | 판정 |")
    lines.append("|------|------|------|")
    lines.append(f"| 음수값 | {outliers['negative']} | {'PASS' if outliers['negative'] == 0 else 'FAIL'} |")
    lines.append(f"| 0값 | {outliers['zero']} | {'PASS' if outliers['zero'] == 0 else 'WARN'} |")
    lines.append(f"| IQR 1.5배 초과 | {extreme} | INFO (Q1={outliers['q1']:.0f}, Q3={outliers['q3']:.0f}, 상한={upper:.0f}) |")

    dupes = q("""
        SELECT COUNT(*) AS cnt FROM (
            SELECT base_date, hour_slot, adm_cd FROM living_population
            GROUP BY base_date, hour_slot, adm_cd HAVING COUNT(*) > 1
        ) t
    """, engine).iloc[0]['cnt']
    lines.append(f"\n### 중복 행: **{'PASS' if dupes == 0 else f'FAIL ({dupes}건)'}**")

    hourly = q("""
        SELECT hour_slot, COUNT(*) AS cnt, ROUND(AVG(total_pop)::numeric, 0) AS avg_pop
        FROM living_population GROUP BY hour_slot ORDER BY hour_slot
    """, engine)
    lines.append("\n### 시간대별 분포\n")
    lines.append(hourly.to_markdown(index=False))

    return section("1. living_population", "\n".join(lines))


# ── 2. store_info ────────────────────────────────────────
def check_store_info(engine) -> str:
    lines = []

    stats = q("""
        SELECT COUNT(*) AS total,
               COUNT(DISTINCT year_quarter) AS quarter_cnt,
               COUNT(DISTINCT signgu_cd) AS gu_cnt,
               COUNT(DISTINCT industry_cd) AS industry_cnt
        FROM store_info
    """, engine).iloc[0]

    if stats['total'] == 0:
        return section("2. store_info", "데이터 없음 (0건)")

    lines.append("| 지표 | 값 |")
    lines.append("|------|-----|")
    lines.append(f"| 전체 건수 | {stats['total']:,} |")
    lines.append(f"| 분기 수 | {stats['quarter_cnt']} |")
    lines.append(f"| 자치구 수 | {stats['gu_cnt']} |")
    lines.append(f"| 업종 수 | {stats['industry_cnt']} |")

    quarters = q("SELECT DISTINCT year_quarter FROM store_info ORDER BY 1", engine)
    lines.append(f"\n### 포함 분기: {', '.join(quarters['year_quarter'].tolist())}")

    cols = ["signgu_nm", "industry_cd", "industry_nm", "store_count",
            "open_rate", "open_count", "close_rate", "close_count", "franchise_count"]
    nulls = null_pct("store_info", cols, engine)
    lines.append("\n### NULL 비율 (%)\n")
    lines.append(nulls.T.rename(columns={0: 'null_pct'}).to_markdown())

    gu_dist = q("""
        SELECT signgu_cd, signgu_nm, COUNT(*) AS cnt,
               ROUND(AVG(store_count)::numeric, 1) AS avg_store,
               ROUND(AVG(close_rate)::numeric, 2) AS avg_close_rate
        FROM store_info GROUP BY signgu_cd, signgu_nm ORDER BY signgu_cd
    """, engine)
    lines.append("\n### 자치구별 분포\n")
    lines.append(gu_dist.to_markdown(index=False))

    rate_check = q("""
        SELECT COUNT(*) FILTER (WHERE close_rate < 0) AS neg_close,
               COUNT(*) FILTER (WHERE close_rate > 100) AS over100_close,
               COUNT(*) FILTER (WHERE open_rate < 0) AS neg_open,
               COUNT(*) FILTER (WHERE open_rate > 100) AS over100_open,
               COUNT(*) FILTER (WHERE store_count < 0) AS neg_store
        FROM store_info
    """, engine).iloc[0]
    lines.append("\n### 이상치 분석\n")
    lines.append("| 검사 | 건수 | 판정 |")
    lines.append("|------|------|------|")
    lines.append(f"| close_rate < 0 | {rate_check['neg_close']} | {'PASS' if rate_check['neg_close'] == 0 else 'FAIL'} |")
    lines.append(f"| close_rate > 100 | {rate_check['over100_close']} | {'PASS' if rate_check['over100_close'] == 0 else 'FAIL'} |")
    lines.append(f"| open_rate < 0 | {rate_check['neg_open']} | {'PASS' if rate_check['neg_open'] == 0 else 'FAIL'} |")
    lines.append(f"| open_rate > 100 | {rate_check['over100_open']} | {'PASS' if rate_check['over100_open'] == 0 else 'FAIL'} |")
    lines.append(f"| store_count < 0 | {rate_check['neg_store']} | {'PASS' if rate_check['neg_store'] == 0 else 'FAIL'} |")

    top_ind = q("""
        SELECT industry_nm, COUNT(*) AS cnt, ROUND(AVG(store_count)::numeric, 0) AS avg_store
        FROM store_info GROUP BY industry_nm ORDER BY cnt DESC LIMIT 10
    """, engine)
    lines.append("\n### 업종 분포 (Top 10)\n")
    lines.append(top_ind.to_markdown(index=False))

    return section("2. store_info", "\n".join(lines))


# ── 3. commerce_sales ────────────────────────────────────
def check_commerce_sales(engine) -> str:
    lines = []

    stats = q("""
        SELECT COUNT(*) AS total,
               COUNT(DISTINCT year_quarter) AS quarter_cnt,
               COUNT(DISTINCT trdar_cd) AS zone_cnt,
               COUNT(DISTINCT industry_cd) AS industry_cnt
        FROM commerce_sales
    """, engine).iloc[0]

    if stats['total'] == 0:
        return section("3. commerce_sales", "데이터 없음 (0건)")

    lines.append("| 지표 | 값 |")
    lines.append("|------|-----|")
    lines.append(f"| 전체 건수 | {stats['total']:,} |")
    lines.append(f"| 분기 수 | {stats['quarter_cnt']} |")
    lines.append(f"| 상권 수 | {stats['zone_cnt']} |")
    lines.append(f"| 업종 수 | {stats['industry_cnt']} |")

    quarters = q("SELECT DISTINCT year_quarter FROM commerce_sales ORDER BY 1", engine)
    lines.append(f"\n### 포함 분기: {', '.join(quarters['year_quarter'].tolist())}")

    cols = ["trdar_nm", "trdar_se_cd", "industry_cd", "industry_nm",
            "sales_amount", "sales_count", "weekday_sales", "weekend_sales"]
    nulls = null_pct("commerce_sales", cols, engine)
    lines.append("\n### NULL 비율 (%)\n")
    lines.append(nulls.T.rename(columns={0: 'null_pct'}).to_markdown())

    neg_sales = q("""
        SELECT COUNT(*) FILTER (WHERE sales_amount < 0) AS neg_amount,
               COUNT(*) FILTER (WHERE sales_count < 0) AS neg_count,
               COUNT(*) FILTER (WHERE sales_amount = 0) AS zero_amount
        FROM commerce_sales
    """, engine).iloc[0]
    lines.append("\n### 이상치 분석\n")
    lines.append("| 검사 | 건수 | 판정 |")
    lines.append("|------|------|------|")
    lines.append(f"| 음수 매출액 | {neg_sales['neg_amount']} | {'PASS' if neg_sales['neg_amount'] == 0 else 'FAIL — 삭제 필요 (QA 기준)'} |")
    lines.append(f"| 음수 매출건수 | {neg_sales['neg_count']} | {'PASS' if neg_sales['neg_count'] == 0 else 'FAIL'} |")
    lines.append(f"| 매출액=0 | {neg_sales['zero_amount']} | INFO |")

    consistency = q("""
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (
                   WHERE weekday_sales IS NOT NULL AND weekend_sales IS NOT NULL
                     AND sales_amount IS NOT NULL
                     AND ABS(weekday_sales + weekend_sales - sales_amount) > sales_amount * 0.01
               ) AS mismatch
        FROM commerce_sales
    """, engine).iloc[0]
    pct = round(100 * consistency['mismatch'] / consistency['total'], 2) if consistency['total'] > 0 else 0
    lines.append(f"| 주중+주말 ≠ 총매출 (1%초과) | {consistency['mismatch']} ({pct}%) | {'PASS' if pct < 5 else 'WARN'} |")

    type_dist = q("""
        SELECT trdar_se_cd,
               CASE trdar_se_cd WHEN 'A' THEN '골목상권'
                                WHEN 'D' THEN '발달상권'
                                WHEN 'R' THEN '전통시장'
                                WHEN 'G' THEN '관광특구'
                                ELSE trdar_se_cd END AS type_nm,
               COUNT(*) AS cnt,
               ROUND(AVG(sales_amount)::numeric, 0) AS avg_sales
        FROM commerce_sales GROUP BY trdar_se_cd ORDER BY cnt DESC
    """, engine)
    lines.append("\n### 상권 유형별 분포\n")
    lines.append(type_dist.to_markdown(index=False))

    quarterly = q("""
        SELECT year_quarter, COUNT(*) AS cnt,
               ROUND(AVG(sales_amount)::numeric, 0) AS avg_sales,
               ROUND(SUM(sales_amount)::numeric, 0) AS total_sales
        FROM commerce_sales GROUP BY year_quarter ORDER BY year_quarter
    """, engine)
    lines.append("\n### 분기별 매출 추이\n")
    lines.append(quarterly.to_markdown(index=False))

    return section("3. commerce_sales", "\n".join(lines))


# ── Summary ──────────────────────────────────────────────
def build_summary(engine) -> str:
    counts = q("""
        SELECT 'living_population' AS tbl, COUNT(*) AS cnt FROM living_population
        UNION ALL SELECT 'store_info', COUNT(*) FROM store_info
        UNION ALL SELECT 'commerce_sales', COUNT(*) FROM commerce_sales
        UNION ALL SELECT 'commerce_boundary', COUNT(*) FROM commerce_boundary
        UNION ALL SELECT 'od_flows', COUNT(*) FROM od_flows
        UNION ALL SELECT 'admin_boundary', COUNT(*) FROM admin_boundary
    """, engine)
    lines = ["| 테이블 | 건수 | 상태 |", "|--------|------|------|"]
    for _, row in counts.iterrows():
        status = "데이터 있음" if row['cnt'] > 0 else "비어있음"
        lines.append(f"| {row['tbl']} | {row['cnt']:,} | {status} |")
    return "\n".join(lines)


# ── main ─────────────────────────────────────────────────
REPORT_FOOTER = """
## 4. 미검토 테이블

| 테이블 | 사유 | 필요 조치 |
|--------|------|----------|
| commerce_boundary | SHP 파일 필요 | Dev-A에게 SHP 파일 요청 |
| admin_boundary | SHP 파일 필요 | Dev-A에게 SHP 파일 요청 |
| od_flows | 대용량 일별 CSV 필요 | Dev-A의 nohup 수집 완료 후 검토 |

## 5. 결론 및 권고사항

### Week 2 분석 투입 가능 여부

| 테이블 | 판정 | 비고 |
|--------|------|------|
| store_info | **투입 가능** | 5,599건, 이상치 없음 |
| commerce_sales | **투입 가능** | 86K건, 음수/정합성 검사 통과 시 |
| living_population | **데이터 부족** | 1일치(1,032건)만 수집됨. CSV 일괄 다운로드 필요 |
| commerce_boundary | **미적재** | SHP 필요 |
| admin_boundary | **미적재** | SHP 필요 |
| od_flows | **미적재** | 대용량 CSV 필요 |

### 즉시 조치 필요 항목

1. **[CRITICAL] 공간 데이터 확보**: commerce_boundary, admin_boundary SHP → Dev-A 요청
2. **[CRITICAL] 생활인구 과거 데이터**: 서울 열린데이터광장에서 CSV 일괄 다운로드 (API로는 최근만 제공)
3. **[CRITICAL] OD 유동 데이터**: Dev-A의 수집 진행 상황 확인
4. **[HIGH] commerce_sales 음수 매출**: 발견 시 삭제 처리 (QA 기준)
5. **[MEDIUM] 주중+주말 ≠ 총매출 불일치 행 조사**: 1% 초과 불일치 원인 파악
"""


def main():
    engine = _get_engine()
    print("데이터 품질 검토 시작...")

    report = f"""# 데이터 품질 검토 리포트

> 생성일: {datetime.now().strftime('%Y-%m-%d %H:%M')}
> 생성자: Dev-C (데이터 분석)

## 요약

{build_summary(engine)}

**참고**: commerce_boundary, od_flows, admin_boundary는 SHP/대용량 CSV가 필요하여 API 수집 대상이 아님.
생활인구는 서울 열린데이터광장에서 최근 1일치만 제공 중 (과거 데이터는 CSV 다운로드 필요).
"""

    report += check_living_population(engine)
    print("  living_population 완료")

    report += check_store_info(engine)
    print("  store_info 완료")

    report += check_commerce_sales(engine)
    print("  commerce_sales 완료")

    report += REPORT_FOOTER

    REPORT_PATH.write_text(report, encoding="utf-8")
    print(f"\n리포트 생성 완료: {REPORT_PATH}")


if __name__ == "__main__":
    main()
