# CHANGELOG

> 형식: [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)
> 버전 정책: 발표(2026-05-12) 전까지는 [Unreleased]. 발표 후 v1.0.

---

## [Unreleased] — D-8 (2026-05-04)

### feature/d9-validation-coverage 작업 (10 커밋)

#### Added — 메타·v2 (커밋 8~10)

- `CHANGELOG.md` (Keep a Changelog 형식, [Unreleased] D-8)
- `docs/PR_DRAFT.md` — 머지 전략 옵션 A (PR-1 hero-shot-precision + PR-2 validation-coverage 분리) / 옵션 B (단일 PR)
- `docs/v2_backlog.md` — 발표 후 P0~P5 작업 30 항목 + 우선순위 매트릭스 + v1.1 patch 후보 3건
- `frontend/src/components/ValidationView.test.tsx` — 5 카드 렌더·헤더·onClose·출처 검증 [8 tests]
- `frontend/src/components/PolicyCard.test.tsx` — highlight 토글·R4 fadeIn·priority 아이콘·rule_based 라벨·outline 색상 [10 tests]
- `scripts/preflight_check.py` 점검 항목 +5 (csv_schema / PR_DRAFT / v2_backlog / CHANGELOG / run_validation_all)
- 글로벌 메모리: `project_d9_validation_coverage.md` + `reference_validation_run_commands.md` + `MEMORY.md` (`~/.claude/projects/-Users-pang-Desktop-personal-spiceMap/memory/`)

### feature/d9-validation-coverage 작업 (1~7 커밋)

#### Added — 검증 커버리지

- `backend/analysis/verification_h2.py` — H2 가설 검증 (흐름 단절 → 폐업 상관). `aggregate_barrier_intensity` (페어 → 상권 max), `compute_h2_alignment` (Pearson/Spearman, r ≥ 0.3 + p < 0.05). [10 tests]
- `backend/analysis/baseline_b1.py` — B1 베이스라인 (OA-15576 상권변화지표 vs Module E priority_score). `load_change_index_csv` (utf-8/utf-8-sig/cp949 자동), `compute_b1_baseline` (binary 상권쇠퇴 → 1.0), `compare_priority_to_b1` (Jaccard). [15 tests]
- `backend/api/validation.py` + `backend/schemas/validation.py` — `GET /api/insights/validation` 엔드포인트. 단일 소스 정책 (frontend/src/data/validation_results.json 직접 응답). `VALIDATION_FIXTURE_PATH` env override 지원. [5 tests]

#### Added — 산출 스크립트

- `scripts/run_validation_h2_b1.py` — H2 + B1 좁은 범위 산출.
- `scripts/run_validation_all.py` — H1 + H2 + H3 + B1 통합 산출 (권장). [5 tests]
- `scripts/preflight_check.py` — 시연 안전 점검 (3 모드: files / files+server / remote). 26 점검 항목. [10 tests]
- `scripts/export_openapi.py` — FastAPI app.openapi() → `docs/api_openapi.json` (8 경로).

#### Added — 발표 산출물

- `docs/data_integration_diagram.md` — Mermaid 통합 도식 (API 6 → 11 테이블 → 분석 5 → API 6 → 프론트).
- `docs/kpi_summary.md` — KPI / 검증 결과 표 1장.
- `docs/qa_briefing.md` — 13개 예상 질문 + 4 답변 원칙.
- `docs/policy_report_gangnam_apgujeong.md` — 강남 압구정 R4 젠트리피케이션 정책 리포트.
- `docs/policy_report_gwanak_sillim.md` — 관악 신림 R4 흐름 단절 회복 정책 리포트 (Hero shot 기준).
- `docs/csv_schema.md` — `/api/export/csv` 9 컬럼 스키마 + 활용.
- `docs/verification_h2.md` — H2 분석 설계 (가설/입력/변환/통계/한계/실행 절차).
- `docs/deployment_guide.md` — Vercel 정적 + demo mode 권장 시나리오, 풀 백엔드 옵션, 시연 안전 점검표.
- `docs/api_openapi.json` — FastAPI 8 경로 정적 export (1,246 라인).

#### Added — 배포 인프라

- `frontend/vercel.json` — Vite framework + SPA rewrites + 정적 자산 캐시.
- `frontend/netlify.toml` — 동등 SPA fallback + NODE_VERSION 20.
- `frontend/.env.production.example` — 환경 변수 템플릿 (V-World 키 / API base / demo policy fallback).
- `data/baselines/README.md` — OA-15576 다운로드 절차 + Jaccard 산출 명령.

#### Changed — 검증 보고 5 카드 확장

- `frontend/src/components/ValidationView.tsx` — 헤더 부제 "H1·H2·H3 + B1·B3", 백엔드 엔드포인트 동일 응답 코멘트 갱신.
- `frontend/src/data/validation_results.json` — H2 카드 추가 (산출 함수 구현 완료, 실데이터 실행 시 자동 갱신). B1 source 를 backend 코드 경로로 갱신.
- `docs/hero_shot_scenario.md` v1.1 — 4카드 → 5카드 (H2 추가), 단축키 `Cmd+1~4` → `1~4 modifier 없이` 정정 (App.tsx:81 검증).
- `backend/main.py` — validation 라우터 `/api` prefix 등록.

#### Changed — 문서/메타

- `docs/dev_a_escalation_draft.md` — D-9 patch 섹션 (적재 완료 10 + 잔여 4 + 협의 3 + 종결).
- `docs/README.md` — 발표 산출물 섹션 + 갱신일 D-9.
- `prompt_plan.md` — Week 4 Dev-B Hero shot 정밀화 / Dev-C H2·B1 구현 / Week 5 제출 산출물 4종 완료 표시 / 웹 데모 배포 진행 중.
- `CLAUDE.md`, `frontend/CLAUDE.md` — Hero shot 시연 모드 + ValidationView 컴포넌트 목록.

#### Fixed

- `frontend/src/components/InsightStrip.tsx` — `CardProps.colors` 타입을 `MAP_THEME['dark'] | MAP_THEME['light']` union 으로 확장 (light theme 빌드 차단 사전 버그).

### 회귀 검증 (D-8 최종)

- backend pytest: **248 통과** (W3 머지 시점 203 → +45 신규)
- frontend vitest: **196 통과** (시작 178 → +18: ValidationView 8 + PolicyCard 10)
- frontend build: 2.0 MB / gzip 562 KB
- preflight: **30/30 ALL PASS**

### 사용자 잔여 (자동화 불가)

| 작업 | 절차 |
|------|------|
| Supabase MCP 인증 + DB 실측 SQL | `commerce_analysis Q4` row 수 확인 |
| OA-15576 정적 CSV 다운로드 | `data/baselines/seoul_change_index_2025Q4.csv` |
| H2/B1 실데이터 산출 | `python -m scripts.run_validation_all --quarter 2025Q4 --previous 2025Q3` |
| Hero shot PNG 5종 캡처 | 브라우저 + 단축키 1~4 |
| 시연 영상 녹화 | OBS/QuickTime, D-2~D-1 (5/10~5/11) |
| Vercel preview 배포 | `cd frontend && vercel`, V-World 도메인 등록 |

---

## [0.1.0] — Week 3 마감 (2026-04-29)

`a4461d0` Merge PR #36 — B3 베이스라인 비교 모듈 + Module E 차별화 KPI

(이전 변경 이력은 git log 참조)
