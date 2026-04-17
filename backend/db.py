"""
DB 세션 팩토리 및 Redis 클라이언트
"""
from typing import Generator

import redis
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from backend.config import settings

# SQLAlchemy
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Redis
redis_client = redis.from_url(settings.redis_url, decode_responses=True)
CACHE_TTL = 3600  # 1시간
