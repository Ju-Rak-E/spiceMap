"""시연 안전 점검 (D-9 ~ D-day, 자동 실행 가능 부분만).

`docs/deployment_guide.md §4` 의 점검표를 자동 실행한다. 사용자 수동 점검
(브라우저로 펄싱·단축키·V-World 타일 가시 확인) 은 제외.

실행 모드:
  files          오프라인 파일/구성 검증 (네트워크 없음, 기본)
  files+server   files + 로컬 서버 점검 (uvicorn :8000 가동 가정)
  remote         files + --base-url HTTP 점검

사용:
  python -m scripts.preflight_check --mode files
  python -m scripts.preflight_check --mode files+server
  python -m scripts.preflight_check --mode remote --base-url https://spicemap-xxx.vercel.app

종료 코드: 모든 점검 통과 시 0, 실패 1건 이상이면 1.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str
    category: str = "files"


@dataclass
class PreflightReport:
    results: list[CheckResult] = field(default_factory=list)

    def add(self, result: CheckResult) -> None:
        self.results.append(result)

    @property
    def all_pass(self) -> bool:
        return all(r.ok for r in self.results)

    def render(self) -> str:
        lines = ["", "=" * 60, " spiceMap 시연 안전 점검", "=" * 60]
        by_cat: dict[str, list[CheckResult]] = {}
        for r in self.results:
            by_cat.setdefault(r.category, []).append(r)
        for cat, group in by_cat.items():
            lines.append("")
            lines.append(f"  [{cat}]")
            for r in group:
                icon = "✓" if r.ok else "✗"
                lines.append(f"    {icon} {r.name} — {r.detail}")
        lines.append("")
        passed = sum(1 for r in self.results if r.ok)
        total = len(self.results)
        verdict = "ALL PASS" if self.all_pass else f"{total - passed} FAIL"
        lines.append(f"  결과: {passed}/{total} ({verdict})")
        lines.append("=" * 60)
        return "\n".join(lines)


# ---------- 파일 점검 함수 ----------

def _format_path(path: Path) -> str:
    """REPO_ROOT 내부면 상대경로, 외부면 절대경로."""
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def check_file_exists(path: Path, name: str) -> CheckResult:
    return CheckResult(name=name, ok=path.exists(), detail=_format_path(path))


def check_validation_fixture(path: Path) -> CheckResult:
    if not path.exists():
        return CheckResult("validation fixture 존재", False, str(path))
    try:
        with path.open(encoding="utf-8") as f:
            data: Any = json.load(f)
        cards = data.get("cards", [])
        ids = {c.get("id") for c in cards if isinstance(c, dict)}
        required = {"H1", "H2", "H3", "B1", "B3"}
        if not required.issubset(ids):
            missing = required - ids
            return CheckResult(
                "validation 5 카드 정합", False, f"누락: {sorted(missing)}"
            )
        return CheckResult(
            "validation 5 카드 정합",
            True,
            f"H1·H2·H3·B1·B3 ({data.get('quarter','?')})",
        )
    except json.JSONDecodeError as exc:
        return CheckResult("validation JSON 파싱", False, str(exc))


def check_mock_jsons(public_data: Path) -> list[CheckResult]:
    expected = ["mock_commerce.json", "mock_flows.json", "mock_gri_history.json", "mock_policy_insights.json"]
    out: list[CheckResult] = []
    for name in expected:
        p = public_data / name
        out.append(CheckResult(f"mock fixture {name}", p.exists(), str(p)))
    return out


def check_deploy_configs(frontend: Path) -> list[CheckResult]:
    return [
        CheckResult("vercel.json", (frontend / "vercel.json").exists(), "frontend/vercel.json"),
        CheckResult("netlify.toml", (frontend / "netlify.toml").exists(), "frontend/netlify.toml"),
        CheckResult(
            ".env.production.example",
            (frontend / ".env.production.example").exists(),
            "frontend/.env.production.example",
        ),
    ]


def check_critical_docs() -> list[CheckResult]:
    docs = REPO_ROOT / "docs"
    return [
        check_file_exists(docs / "hero_shot_scenario.md", "Hero shot 시나리오 v1.1"),
        check_file_exists(docs / "kpi_summary.md", "KPI 요약 표"),
        check_file_exists(docs / "qa_briefing.md", "Q&A 브리핑"),
        check_file_exists(docs / "deployment_guide.md", "배포 가이드"),
        check_file_exists(docs / "data_integration_diagram.md", "데이터 결합 구조도"),
        check_file_exists(docs / "verification_h2.md", "H2 분석 설계"),
        check_file_exists(docs / "policy_report_gangnam_apgujeong.md", "정책 리포트 강남"),
        check_file_exists(docs / "policy_report_gwanak_sillim.md", "정책 리포트 관악"),
        check_file_exists(docs / "csv_schema.md", "CSV export 스키마"),
        check_file_exists(docs / "PR_DRAFT.md", "PR 초안"),
        check_file_exists(REPO_ROOT / "CHANGELOG.md", "CHANGELOG"),
    ]


def check_baseline_dir() -> list[CheckResult]:
    return [
        check_file_exists(REPO_ROOT / "data" / "baselines" / "README.md", "B1 baseline README"),
        check_file_exists(REPO_ROOT / "scripts" / "run_validation_h2_b1.py", "H2/B1 산출 스크립트"),
        check_file_exists(REPO_ROOT / "scripts" / "run_validation_all.py", "H1/H2/H3/B1 통합 산출 스크립트"),
    ]


def check_backend_modules() -> list[CheckResult]:
    a = REPO_ROOT / "backend" / "analysis"
    return [
        check_file_exists(a / "verification_h1.py", "H1 검증"),
        check_file_exists(a / "verification_h2.py", "H2 검증"),
        check_file_exists(a / "verification_h3.py", "H3 검증"),
        check_file_exists(a / "baseline_b1.py", "B1 베이스라인"),
        check_file_exists(a / "baseline_comparison.py", "B3 베이스라인"),
        check_file_exists(a / "module_c_barriers.py", "Module C 시계열 갭"),
        check_file_exists(REPO_ROOT / "backend" / "api" / "validation.py", "validation 엔드포인트"),
    ]


# ---------- 네트워크 점검 ----------

def check_http(base_url: str) -> list[CheckResult]:
    """HTTP 응답 점검. 실패 시 즉시 반환."""
    try:
        import urllib.error
        import urllib.request
    except ImportError as exc:
        return [CheckResult("urllib import", False, str(exc), category="http")]

    out: list[CheckResult] = []
    base = base_url.rstrip("/")
    targets = [
        ("/health", "/health"),
        ("/api/insights/validation", "/api/insights/validation"),
    ]
    for label, path in targets:
        url = f"{base}{path}"
        try:
            with urllib.request.urlopen(url, timeout=5) as resp:  # noqa: S310
                code = resp.status
                ok = 200 <= code < 300
                detail = f"{url} → HTTP {code}"
                if path.endswith("/validation") and ok:
                    body = json.loads(resp.read().decode("utf-8"))
                    ids = {c["id"] for c in body.get("cards", [])}
                    if not {"H1", "H2", "H3", "B1", "B3"}.issubset(ids):
                        ok = False
                        detail += f" (cards 누락: {sorted({'H1','H2','H3','B1','B3'} - ids)})"
                out.append(CheckResult(label, ok, detail, category="http"))
        except urllib.error.URLError as exc:
            out.append(CheckResult(label, False, f"{url} 연결 실패: {exc}", category="http"))
        except Exception as exc:  # noqa: BLE001
            out.append(CheckResult(label, False, f"{url} 예외: {exc}", category="http"))
    return out


# ---------- main ----------

def run_files_checks(report: PreflightReport) -> None:
    frontend = REPO_ROOT / "frontend"
    fixture = frontend / "src" / "data" / "validation_results.json"

    report.add(check_validation_fixture(fixture))
    for r in check_mock_jsons(frontend / "public" / "data"):
        report.add(r)
    for r in check_deploy_configs(frontend):
        report.add(r)
    for r in check_critical_docs():
        r.category = "docs"
        report.add(r)
    for r in check_baseline_dir():
        r.category = "data"
        report.add(r)
    for r in check_backend_modules():
        r.category = "backend"
        report.add(r)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mode",
        choices=["files", "files+server", "remote"],
        default="files",
        help="files=오프라인, files+server=localhost, remote=--base-url",
    )
    parser.add_argument("--base-url", default=None, help="remote 모드 대상 URL")
    args = parser.parse_args(argv)

    report = PreflightReport()
    run_files_checks(report)

    if args.mode == "files+server":
        for r in check_http("http://localhost:8000"):
            report.add(r)
    elif args.mode == "remote":
        if not args.base_url:
            print("ERROR: remote 모드는 --base-url 필요", file=sys.stderr)
            return 2
        for r in check_http(args.base_url):
            report.add(r)

    print(report.render())
    return 0 if report.all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
