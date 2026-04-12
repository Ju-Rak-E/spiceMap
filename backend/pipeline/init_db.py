"""
DB 초기화 스크립트
- PostGIS extension 활성화
- 7개 핵심 테이블 생성

실행 방법:
    python -m backend.pipeline.init_db
"""
import sys

from sqlalchemy import create_engine, text

from backend.config import settings
from backend.models import Base


def init_db() -> None:
    engine = create_engine(settings.database_url, echo=True)

    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
        conn.commit()
        print("PostGIS extension 활성화 완료")

    Base.metadata.create_all(bind=engine)
    print("테이블 생성 완료:")
    for table in Base.metadata.sorted_tables:
        print(f"  - {table.name}")


if __name__ == "__main__":
    try:
        init_db()
    except Exception as e:
        print(f"DB 초기화 실패: {e}", file=sys.stderr)
        sys.exit(1)
