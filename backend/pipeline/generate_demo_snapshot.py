"""시연용 정적 스냅샷 생성 스크립트 (재생 모드).

실행 전 API 서버가 localhost:8000에서 동작 중이어야 한다.

    uvicorn backend.main:app --reload &
    python -m backend.pipeline.generate_demo_snapshot

생성된 JSON 파일은 backend/static/demo/ 에 저장된다.
이후 .env에 DEMO_MODE=1 설정 시 서버가 DB 없이 정적 파일로 응답한다.
"""
from __future__ import annotations

import sys
from pathlib import Path

import httpx

BASE_URL = "http://localhost:8000"

# 스냅샷으로 저장할 엔드포인트 목록
# (path, params, cache_key)
_ENDPOINTS = [
    ("/api/data-sources", {}, "data-sources"),
    ("/api/commerce/type-map", {"quarter": "2025Q4"}, "type-map_all_2025Q4"),
    ("/api/commerce/type-map", {"quarter": "2025Q4", "gu": "강남구"}, "type-map_강남구_2025Q4"),
    ("/api/commerce/type-map", {"quarter": "2025Q4", "gu": "관악구"}, "type-map_관악구_2025Q4"),
    ("/api/od/flows", {"quarter": "2025Q4", "limit": 200}, "od-flows_2025Q4_all_200"),
    ("/api/od/flows", {"quarter": "2025Q4", "gu": "강남구", "limit": 200}, "od-flows_2025Q4_강남구_200"),
    ("/api/od/flows", {"quarter": "2025Q4", "gu": "관악구", "limit": 200}, "od-flows_2025Q4_관악구_200"),
    ("/api/barriers", {"quarter": "2025Q4"}, "barriers_2025Q4_all_0.0"),
    ("/api/insights/policy", {"quarter": "2025Q4"}, "insights-policy_2025Q4_all_all_0.0_all"),
    ("/api/insights/policy", {"quarter": "2025Q4", "gu": "강남구"}, "insights-policy_2025Q4_강남구_all_0.0_all"),
    ("/api/insights/policy", {"quarter": "2025Q4", "gu": "관악구"}, "insights-policy_2025Q4_관악구_all_0.0_all"),
]

DEMO_DIR = Path(__file__).parent.parent / "static" / "demo"


def run() -> None:
    DEMO_DIR.mkdir(parents=True, exist_ok=True)
    success = 0
    fail = 0

    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        for path, params, snapshot_name in _ENDPOINTS:
            try:
                resp = client.get(path, params=params)
                resp.raise_for_status()
                out = DEMO_DIR / f"{snapshot_name}.json"
                out.write_text(resp.text, encoding="utf-8")
                print(f"[OK] {path}  → {out.name}")
                success += 1
            except Exception as exc:
                print(f"[FAIL] {path}: {exc}", file=sys.stderr)
                fail += 1

    print(f"\n완료: {success}개 성공, {fail}개 실패")
    print(f"스냅샷 위치: {DEMO_DIR}")
    if fail:
        print("실패한 엔드포인트는 데이터 미적재 등의 이유일 수 있습니다.")
        print("DEMO_MODE=1 시 해당 엔드포인트는 503을 반환합니다.")


if __name__ == "__main__":
    run()
