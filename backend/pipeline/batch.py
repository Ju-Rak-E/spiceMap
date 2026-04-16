"""
월간 배치 수집 스크립트 — 전월 OD + 생활인구 자동 수집

매월 1일 cron으로 실행:
    0 2 1 * * cd /path/to/spiceMap && python -m backend.pipeline.batch

수동 실행:
    python -m backend.pipeline.batch              # 자동 전월 계산
    python -m backend.pipeline.batch --month 202503  # 특정 월 지정 (YYYYMM)
    python -m backend.pipeline.batch --dry-run    # 실행 없이 대상 확인만
"""
import argparse
import time
from calendar import monthrange
from datetime import date, timedelta


def prev_month(today: date = None) -> tuple[int, int]:
    """전월 (year, month) 반환"""
    d = today or date.today()
    first = d.replace(day=1)
    last_month = first - timedelta(days=1)
    return last_month.year, last_month.month


def month_date_range(year: int, month: int) -> tuple[str, str]:
    """월의 첫날~마지막날 YYYYMMDD 문자열 반환"""
    last_day = monthrange(year, month)[1]
    start = f"{year}{month:02d}01"
    end = f"{year}{month:02d}{last_day:02d}"
    return start, end


def run_od(start: str, end: str, dry_run: bool) -> None:
    """OD 이동 데이터 수집 (download_od_files 재사용)"""
    print(f"[OD] {start} ~ {end} 수집")
    if dry_run:
        return

    from backend.pipeline.download_od_files import process_date, SLEEP_SEC
    from datetime import date as _date, timedelta as _td
    from sqlalchemy import create_engine
    from backend.config import settings

    engine = create_engine(settings.database_url)

    s = _date(int(start[:4]), int(start[4:6]), int(start[6:8]))
    e = _date(int(end[:4]), int(end[4:6]), int(end[6:8]))
    cur = s
    total = 0
    while cur <= e:
        n = process_date(cur, engine, save_dir=None)
        total += n
        cur += _td(days=1)
        time.sleep(SLEEP_SEC)

    print(f"[OD] 완료: {total:,}행")


def run_living_pop(year: int, month: int, dry_run: bool) -> None:
    """생활인구 API 수집 (OA-14991, SPOP_LOCAL_RESD_DONG)

    배치는 전월 데이터를 수집하므로 항상 API 제공 범위(최근 2개월) 안에 있음.
    """
    start, end = month_date_range(year, month)
    print(f"[생활인구] {start} ~ {end} API 수집")
    if dry_run:
        return

    from backend.pipeline.collect_living_pop import collect
    from datetime import date as _date, timedelta as _td

    s = _date(int(start[:4]), int(start[4:6]), int(start[6:8]))
    e = _date(int(end[:4]), int(end[4:6]), int(end[6:8]))
    cur = s
    total = 0
    while cur <= e:
        n = collect(cur.strftime("%Y%m%d"), all_districts=False)
        total += n
        cur += _td(days=1)
        time.sleep(0.3)

    print(f"[생활인구] 완료: {total:,}행")


def main() -> None:
    parser = argparse.ArgumentParser(description="월간 배치 수집")
    parser.add_argument("--month", help="수집 대상 월 YYYYMM (기본: 전월 자동 계산)")
    parser.add_argument("--dry-run", action="store_true", help="실행 없이 대상 확인만")
    args = parser.parse_args()

    if args.month:
        year = int(args.month[:4])
        month = int(args.month[4:6])
    else:
        year, month = prev_month()

    start, end = month_date_range(year, month)
    yyyymm = f"{year}{month:02d}"

    print(f"=== 월간 배치 시작: {yyyymm} {'(dry-run)' if args.dry_run else ''} ===")
    run_od(start, end, args.dry_run)
    run_living_pop(year, month, args.dry_run)
    print(f"=== 완료 ===")


if __name__ == "__main__":
    main()
