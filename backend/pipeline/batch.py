"""
배치 수집 스크립트 — 월간(OD·생활인구) + 분기(점포·매출) 자동 수집

cron 등록:
    # 월간 배치 — 매월 1일 새벽 2시
    0 2 1 * *       cd /path/to/spiceMap && python -m backend.pipeline.batch --type monthly

    # 분기 배치 — 1·4·7·10월 25일 새벽 2시 (분기 종료 후 ~1개월 뒤, 데이터 게시 대기)
    0 2 25 1,4,7,10 * cd /path/to/spiceMap && python -m backend.pipeline.batch --type quarterly

수동 실행:
    python -m backend.pipeline.batch --type monthly              # 전월 자동 계산
    python -m backend.pipeline.batch --type monthly --month 202603
    python -m backend.pipeline.batch --type quarterly            # 직전 분기 자동 계산
    python -m backend.pipeline.batch --type quarterly --quarter 20254
    python -m backend.pipeline.batch --type monthly --dry-run
"""
import argparse
import time
from calendar import monthrange
from datetime import date, timedelta


# ── 날짜 유틸 ────────────────────────────────────────────────────────────────

def prev_month(today: date = None) -> tuple[int, int]:
    """전월 (year, month) 반환"""
    d = today or date.today()
    first = d.replace(day=1)
    last_month = first - timedelta(days=1)
    return last_month.year, last_month.month


def prev_quarter(today: date = None) -> str:
    """직전 분기 코드 반환 (예: '20254')

    수집 시점(1·4·7·10월 25일) 기준으로 직전 분기를 계산.
    1월 → 전년 Q4, 4월 → Q1, 7월 → Q2, 10월 → Q3
    """
    d = today or date.today()
    month_to_prev_quarter = {1: 4, 2: 4, 3: 4,   # 1~3월 → 전년 Q4
                              4: 1, 5: 1, 6: 1,   # 4~6월 → Q1
                              7: 2, 8: 2, 9: 2,   # 7~9월 → Q2
                              10: 3, 11: 3, 12: 3} # 10~12월 → Q3
    q = month_to_prev_quarter[d.month]
    year = d.year - 1 if d.month <= 3 else d.year
    return f"{year}{q}"


def month_date_range(year: int, month: int) -> tuple[str, str]:
    """월의 첫날~마지막날 YYYYMMDD 문자열 반환"""
    last_day = monthrange(year, month)[1]
    start = f"{year}{month:02d}01"
    end = f"{year}{month:02d}{last_day:02d}"
    return start, end


# ── 월간 수집 ─────────────────────────────────────────────────────────────────

def run_od(start: str, end: str, dry_run: bool) -> None:
    """OD 이동 데이터 일별 수집"""
    print(f"[OD] {start} ~ {end} 수집")
    if dry_run:
        return

    from datetime import date as _date, timedelta as _td
    from sqlalchemy import create_engine
    from backend.config import settings
    from backend.pipeline.download_od_files import process_date, SLEEP_SEC

    engine = create_engine(settings.database_url)
    s = _date(int(start[:4]), int(start[4:6]), int(start[6:8]))
    e = _date(int(end[:4]), int(end[4:6]), int(end[6:8]))
    cur, total = s, 0
    while cur <= e:
        total += process_date(cur, engine, save_dir=None)
        cur += _td(days=1)
        time.sleep(SLEEP_SEC)
    print(f"[OD] 완료: {total:,}행")


def run_living_pop(year: int, month: int, dry_run: bool) -> None:
    """생활인구 API 일별 수집 (OA-14991)

    배치는 전월 수집이므로 항상 API 제공 범위(최근 2개월) 안에 있음.
    """
    start, end = month_date_range(year, month)
    print(f"[생활인구] {start} ~ {end} API 수집")
    if dry_run:
        return

    from datetime import date as _date, timedelta as _td
    from backend.pipeline.collect_living_pop import collect

    s = _date(int(start[:4]), int(start[4:6]), int(start[6:8]))
    e = _date(int(end[:4]), int(end[4:6]), int(end[6:8]))
    cur, total = s, 0
    while cur <= e:
        total += collect(cur.strftime("%Y%m%d"), all_districts=False)
        cur += _td(days=1)
        time.sleep(0.3)
    print(f"[생활인구] 완료: {total:,}행")


# ── 분기 수집 ─────────────────────────────────────────────────────────────────

def run_store_info(quarter: str, dry_run: bool) -> None:
    """자치구별 점포정보 분기 수집 (OA-15577)"""
    print(f"[점포정보] {quarter} 수집")
    if dry_run:
        return

    from backend.pipeline.collect_store_info import collect
    collect(quarter=quarter, mvp_only=False)


def run_commerce_sales(quarter: str, dry_run: bool) -> None:
    """상권별 추정 매출 분기 수집 (OA-15572)"""
    print(f"[상권매출] {quarter} 수집")
    if dry_run:
        return

    from backend.pipeline.collect_commerce_sales import collect
    collect(quarter=quarter)


# ── 진입점 ────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="spiceMap 배치 수집")
    parser.add_argument(
        "--type", choices=["monthly", "quarterly"], required=True,
        help="배치 유형 (monthly: OD·생활인구 / quarterly: 점포정보·상권매출)",
    )
    parser.add_argument("--month",   help="월간 대상 월 YYYYMM (기본: 전월 자동)")
    parser.add_argument("--quarter", help="분기 대상 코드 YYYYQ (기본: 직전 분기 자동, 예: 20254)")
    parser.add_argument("--dry-run", action="store_true", help="실행 없이 대상 확인만")
    args = parser.parse_args()

    if args.type == "monthly":
        if args.month:
            year, month = int(args.month[:4]), int(args.month[4:6])
        else:
            year, month = prev_month()
        start, end = month_date_range(year, month)
        label = f"{year}{month:02d}"

        print(f"=== 월간 배치: {label} {'(dry-run)' if args.dry_run else ''} ===")
        run_od(start, end, args.dry_run)
        run_living_pop(year, month, args.dry_run)

    else:  # quarterly
        quarter = args.quarter or prev_quarter()

        print(f"=== 분기 배치: {quarter} {'(dry-run)' if args.dry_run else ''} ===")
        run_store_info(quarter, args.dry_run)
        run_commerce_sales(quarter, args.dry_run)

    print("=== 완료 ===")


if __name__ == "__main__":
    main()
