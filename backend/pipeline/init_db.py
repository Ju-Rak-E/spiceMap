"""
DB 초기화 + 마이그레이션 스크립트
- PostGIS extension 활성화
- 테이블 생성 (create_all)
- 기존 테이블 컬럼 추가 (migrate_db)

실행 방법:
    python -m backend.pipeline.init_db
"""
import sys

from sqlalchemy import create_engine, text

from backend.config import settings
from backend.models import Base


def init_db() -> None:
    """PostGIS 활성화 + 전체 테이블 CREATE (idempotent)."""
    engine = create_engine(settings.database_url, echo=True)

    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
        conn.commit()
        print("PostGIS extension 활성화 완료")

    Base.metadata.create_all(bind=engine)
    print("테이블 생성 완료:")
    for table in Base.metadata.sorted_tables:
        print(f"  - {table.name}")


def migrate_db() -> None:
    """기존 테이블 스키마 변경 (컬럼 추가 등). 멱등성 보장."""
    engine = create_engine(settings.database_url, echo=False)

    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE commerce_analysis
              ADD COLUMN IF NOT EXISTS commerce_type      VARCHAR(20),
              ADD COLUMN IF NOT EXISTS priority_score     FLOAT8,
              ADD COLUMN IF NOT EXISTS net_flow           FLOAT8,
              ADD COLUMN IF NOT EXISTS degree_centrality  FLOAT8,
              ADD COLUMN IF NOT EXISTS closure_rate       FLOAT8
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_commerce_analysis_quarter_cd
              ON commerce_analysis (year_quarter, comm_cd)
        """))
        conn.commit()
    print("commerce_analysis 컬럼 추가 완료 (migrate_db)")
    print("ix_commerce_analysis_quarter_cd 인덱스 생성 완료 (migrate_db)")


if __name__ == "__main__":
    try:
        init_db()
        migrate_db()
    except Exception as e:
        print(f"DB 초기화/마이그레이션 실패: {e}", file=sys.stderr)
        sys.exit(1)
