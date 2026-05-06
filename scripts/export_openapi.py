"""FastAPI app.openapi() → docs/api_openapi.json 정적 export.

용도:
  - dev 환경 없이도 API 스펙 정적 검토 (심사관·외부 협업).
  - PR 시 spec diff 가시화 (git 추적).

실행:
  python -m scripts.export_openapi
  python -m scripts.export_openapi --out docs/api_openapi.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from backend.main import app

DEFAULT_OUT = Path(__file__).resolve().parents[1] / "docs" / "api_openapi.json"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="출력 경로")
    args = parser.parse_args(argv)

    schema = app.openapi()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(schema, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    paths = list(schema.get("paths", {}).keys())
    print(f"OpenAPI spec → {args.out}")
    print(f"  총 {len(paths)}개 경로: {paths}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
