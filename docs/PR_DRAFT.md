# PR 초안 — D-9 검증 커버리지 + 발표 인프라

> 본 문서는 `gh pr create --body-file docs/PR_DRAFT.md` 로 직접 사용 가능하다.
> 사용자가 push 후 GitHub UI 또는 gh CLI 로 PR 생성.

---

## 권장 머지 전략

본 ralph loop 산출물은 두 단계로 분리해서 머지하는 것을 권장한다.

### 옵션 A (권장) — 두 PR 분리

**PR-1: feature/hero-shot-precision → main**
- 커밋 3건: `69745fd` `0d8feda` `b763b20`
- 내용: hero shot 시연 동선 (펄싱·R4 강조·CSV toast·검증 보고·단축키) + InsightStrip light theme fix
- 사이즈: 14 파일 +700/-19 (이미 사용자가 검토 완료한 영역)

**PR-2: feature/d9-validation-coverage → main** (PR-1 머지 후)
- 커밋 7건: `c41f5bb`~`6f5e173` (본 ralph loop 산출물)
- 내용: H2/B1 코드 + ValidationView 5카드 + 발표 산출물 + 배포 인프라 + 통합 검증 스크립트
- 본 PR_DRAFT 의 본문은 이 PR 용으로 작성됨

### 옵션 B — 단일 PR (시간 부족 시)

**feature/d9-validation-coverage → main**
- 10 커밋 합쳐 한 번에 머지
- 사이즈: 47 파일 +4,668/-33

D-day 까지 시간 여유 있으면 옵션 A, 그렇지 않으면 B.

---

## PR-2 본문 (옵션 A 기준)

```markdown
# D-9 검증 커버리지 + 발표 인프라 + 배포 준비

## 요약 (TL;DR)

`plans/db-enchanted-hinton.md` 종합 검토 결과 식별된 코드 갭 (B1 코드 부재, H2 검증 미구현)
을 봉합하고, Week 5 제출 산출물 4종 + 배포 인프라 + 통합 산출 스크립트를 추가한다. D-9 ~ D-1
사용자 운용 흐름이 명확해진다.

## 변경 요약

### 검증 코드 (Phase 1 — 갭 봉합)

- **H2 검증 함수** (`backend/analysis/verification_h2.py`)
  - `aggregate_barrier_intensity` (페어 → 상권 max)
  - `compute_h2_alignment` (Pearson/Spearman, 임계 r ≥ 0.3 + p < 0.05)
  - 10 tests pass
- **B1 베이스라인** (`backend/analysis/baseline_b1.py`)
  - `load_change_index_csv` (utf-8 / utf-8-sig / cp949 자동 fallback)
  - `compute_b1_baseline` (binary "상권쇠퇴" → 1.0)
  - `compare_priority_to_b1` (Jaccard + new_in_priority/new_in_b1)
  - 15 tests pass
- **Validation API** (`backend/api/validation.py` + `backend/schemas/validation.py`)
  - `GET /api/insights/validation` 엔드포인트 추가
  - 단일 소스 정책: `frontend/src/data/validation_results.json` 직접 응답
  - `VALIDATION_FIXTURE_PATH` env override 지원 (테스트/배포 분리 대응)
  - 5 tests pass

### 산출 스크립트

- `scripts/run_validation_h2_b1.py` — H2 + B1 좁은 범위 산출
- `scripts/run_validation_all.py` — H1 + H2 + H3 + B1 통합 산출 (권장)
- `scripts/preflight_check.py` — 시연 안전 점검 3 모드 (files / files+server / remote), 26 항목, 10 tests
- `scripts/export_openapi.py` — FastAPI app.openapi() 정적 export

### 발표 산출물 (Phase 2)

- `docs/data_integration_diagram.md` — 데이터 결합 구조도 (Mermaid)
- `docs/kpi_summary.md` — 가설/베이스라인/시스템 KPI/한계 정직 보고
- `docs/qa_briefing.md` — 13개 예상 질문 + 4 답변 원칙
- `docs/policy_report_gangnam_apgujeong.md` — 강남 압구정 R4 정책 리포트
- `docs/policy_report_gwanak_sillim.md` — 관악 신림 R4 흐름 단절 회복 (Hero shot 기준)
- `docs/csv_schema.md` — `/api/export/csv` 9 컬럼 스키마
- `docs/verification_h2.md` — H2 분석 설계
- `docs/deployment_guide.md` — Vercel 정적 + demo mode 권장 시나리오
- `docs/api_openapi.json` — FastAPI 8 경로 정적 spec

### 배포 인프라 (Phase 3)

- `frontend/vercel.json` + `frontend/netlify.toml` + `frontend/.env.production.example`
- `data/baselines/README.md` — OA-15576 다운로드 절차

### Frontend (5 카드 확장)

- `ValidationView.tsx` 헤더 부제 갱신 (H1·H2·H3 + B1·B3)
- `validation_results.json` H2 카드 추가, B1 source 를 backend 코드 경로로 갱신
- `docs/preview/hero_shot_scenario.md` v1.1 (5 카드 + 단축키 표기 정정)

### 메타

- `CHANGELOG.md` 신규
- `docs/dev_a_escalation_draft.md` D-9 patch (적재 완료 10 + 잔여 4 + 종결)
- `docs/README.md` 발표 산출물 섹션
- `prompt_plan.md` Week 4 Dev-C 진척 + Week 5 제출 산출물 4종 완료

## 회귀 검증

- backend pytest: **248 통과** (이전 203 → +45 신규)
- frontend vitest: **178 통과** 유지
- frontend build: 2.0 MB / gzip 562 KB ✅
- preflight: **26/26 ALL PASS**

## 사용자 잔여 (자동화 불가)

본 PR 머지 후 D-1 까지 다음을 수동 진행:

- [ ] Supabase MCP 인증 + `commerce_analysis Q4` 적재 검증
- [ ] OA-15576 정적 CSV 다운로드 (`data/baselines/seoul_change_index_2025Q4.csv`)
- [ ] `python -m scripts.run_validation_all --quarter 2025Q4 --previous 2025Q3 --b1-csv ...` 실행
- [ ] 산출 결과를 `frontend/src/data/validation_results.json` 의 H1/H2/B1 카드에 반영
- [ ] Hero shot PNG 5 종 캡처 (D-7, 5/5)
- [ ] Vercel preview 배포 (D-3, 5/9)
- [ ] 시연 영상 녹화 (D-2~D-1, 5/10~5/11)
- [ ] Production promote (D-1)

## 머지 후 다음 단계

1. PR 머지 시점에 git tag `v0.2.0-d9` 생성 권장
2. main 에서 hero shot preview 한 번 더 작동 확인 (단축키 1~4 + V-World 도메인)
3. `docs/qa_briefing.md` 한번 더 통독 (13 질문 답변 자기 점검)
4. D-day (5/12) 발표 후 `v1.0` 태깅 + Won't 결정 (서울 전역 확장 등) v2 backlog 로 이동

## 관련 문서

- `plans/db-enchanted-hinton.md` — 종합 검토 + 액션 플랜
- `docs/strategy_d13.md` — D-13 수상 전략
- `docs/preview/hero_shot_scenario.md` v1.1 — 3분 발표 단일 진실 문서
```

---

## 사용 절차

```bash
# 1. push
git push -u origin feature/d9-validation-coverage

# 2. PR 생성 (옵션 A 기준 — feature/hero-shot-precision 머지 후 실행)
gh pr create \
    --base main \
    --head feature/d9-validation-coverage \
    --title "feat: D-9 검증 커버리지 + 발표 인프라 + 배포 준비" \
    --body-file docs/PR_DRAFT.md

# 또는 옵션 B (단일 PR)
gh pr create \
    --base main \
    --head feature/d9-validation-coverage \
    --title "feat: D-9 hero shot precision + 검증 커버리지 + 발표 인프라" \
    --body-file docs/PR_DRAFT.md
```

PR 생성 후 자동으로 CI(있다면)가 트리거된다. main 보호 정책에 따라 추가 리뷰 필요.
