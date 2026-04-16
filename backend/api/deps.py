"""
FastAPI 공통 의존성
"""
from typing import Generator

import redis as redis_module
from sqlalchemy.orm import Session

from backend.db import get_db, redis_client


def get_session() -> Generator[Session, None, None]:
    yield from get_db()


def get_cache() -> redis_module.Redis:
    return redis_client
