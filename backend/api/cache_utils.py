"""캐시 fallback + 데모 스냅샷 헬퍼.

정책:
- 정상 DB 응답 → 일반 캐시(1h) + fallback 캐시(24h) 동시 저장
- DB 장애 → fallback 캐시 조회 후 from_cache=True 반환
- DEMO_MODE=1 → static/demo/ 스냅샷 파일에서 즉시 반환
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from redis.exceptions import RedisError

from backend.config import settings
from backend.db import CACHE_TTL, FALLBACK_CACHE_TTL

DEMO_DIR = Path(__file__).parent.parent / "static" / "demo"
_CACHE_WARNING = "캐시 데이터로 표시 중"
_DEMO_WARNING = "데모 데이터로 표시 중"
_KEY_CLEAN = re.compile(r"[^a-zA-Z0-9\-_]")


def _snapshot_path(cache_key: str) -> Path:
    safe = _KEY_CLEAN.sub("_", cache_key)
    return DEMO_DIR / f"{safe}.json"


def load_demo(cache_key: str) -> dict | None:
    """DEMO_MODE에서 스냅샷 파일 읽기."""
    p = _snapshot_path(cache_key)
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return None


def save_demo(cache_key: str, data: dict) -> None:
    """스냅샷 파일 저장."""
    DEMO_DIR.mkdir(parents=True, exist_ok=True)
    _snapshot_path(cache_key).write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def cache_get(cache, key: str) -> dict | None:
    try:
        v = cache.get(key)
        if v:
            return json.loads(v)
    except (RedisError, Exception):
        pass
    return None


def cache_set(cache, key: str, payload: str, ttl: int = CACHE_TTL) -> None:
    try:
        cache.setex(key, ttl, payload)
    except (RedisError, Exception):
        pass


def cache_set_with_fallback(cache, key: str, payload: str) -> None:
    """일반 캐시(1h) + fallback(24h) 동시 저장."""
    cache_set(cache, key, payload, CACHE_TTL)
    cache_set(cache, f"fallback:{key}", payload, FALLBACK_CACHE_TTL)


def get_fallback(cache, key: str) -> dict | None:
    """DB 장애 시 fallback 캐시 조회."""
    return cache_get(cache, f"fallback:{key}")


def demo_response(data: dict, is_demo: bool = False) -> dict:
    """from_cache / cache_warning 필드를 응답 dict에 삽입."""
    data["from_cache"] = True
    data["cache_warning"] = _DEMO_WARNING if is_demo else _CACHE_WARNING
    return data
