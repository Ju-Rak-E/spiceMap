# Dev-A 보고 — D-8 시점 백엔드/파이프라인 진행 보고 (2026-05-04)

> 작성: 김광오 (Dev-C, @pangvelop)
> 수신: 남인경 (Dev-A, @Ninky0, 2020113392@dgu.ac.kr)
> 마감: 2026-05-12 (D-day)
> 근거: `docs/dev_a_escalation_draft.md` D-9 patch · `prompt_plan.md` Week 3·4 · 본 브랜치 13 커밋

---

## 슬랙/디스코드용 (짧은 DM)

```
인경님, 김광오입니다. D-8 시점 백엔드 영역 진행 정리 공유드립니다.

[완료]
- od_flows 원본 80M → 분기 집계본 Q3+Q4 366K 적재 (Dev-C 자체 진행)
- admin_boundary 425/425 + commerce_boundary 1,650 + adm_comm_mapping 1,650 적재
- store_info 5,599 / commerce_sales Q3+Q4 적재
- commerce_analysis Q3 1,650 + policy_cards Q3 419 적재
- flow_barriers Q4 200 (Module C 시계열 갭)
- 백엔드: verification_h2.py / baseline_b1.py / GET /api/insights/validation 신규
- backend pytest 203 → 248 (+45)

[Dev-A 협의 부탁]
1) 시연 서버 배포 — Dev-C 가 Vercel 정적 + demo mode 자체 진행 예정 (백엔드 무관, Dev-A 협의 불요).
   풀 백엔드 호스팅 의향 있으시면 docs/deployment_guide.md §3 협의 부탁.
2) 발표 후 서울 전역 확장 (v2 일정) — 5/13 이후 별도 메시지로.

이번 주 PR 머지 협조 감사드립니다. 발표 전 D-1 (5/11) 마지막 점검 메시지 드릴게요.
```

---

## 상세 메시지 (이메일/노션 게시용)

### 1. Supabase 적재 현황 (Dev-C 우회 완료)

기존 4/29 에스컬레이션 메시지의 옵션 A/B 회신을 받지 못한 채로, Dev-C 가 직접 적재 절차를 우회 진행했습니다. Q3+Q4 데이터 모두 Supabase `clyqvncpcfyfljbqgdig` 에 적재 완료.

| 테이블 | 행 수 | 적재 시점 |
|--------|------|---------|
| `od_flows_aggregated` Q3 | 183,506 | 2026-04-29 |
| `od_flows_aggregated` Q4 | 182,971 | 2026-04-29 (단위 불일치 검증 후 재적재) |
| `admin_boundary` | 425/425 | 2026-04-29 PR #24 (gu_nm 백필 + SEOUL_SIGUNGU_CD_TO_NM 자동화) |
| `commerce_boundary` | 1,650 | 서울 전역 |
| `adm_comm_mapping` | 1,650 | PR #23 (signgu_cd 기반, LATERAL ST_Contains) |
| `store_info` | 5,599 | 2019Q1~2025Q4 (28 분기) |
| `commerce_sales` Q3+Q4 | 적재 완료 | 2026-04-30 Q3 추가 |
| `flow_barriers` Q4 | 200 건 | PR #29 Module C 시계열 갭 (decline 0.587~1.000) |
| `commerce_analysis` Q3 | 1,650 | 2026-04-30 run_analysis Q3 실행 |
| `policy_cards` Q3 | 419 | 동상 (R4·R5·R6·R7 활성) |

OD 원본 (80M, 92일 ZIP) 은 5일 rolling 컴팩트 + 체크포인트로 메모리 35MB 제한하에 직접 처리 (`backend/pipeline/aggregate_od_flows.py` + 기존 `download_od_files.py`).

### 2. 신규 백엔드 코드 (D-9 ~ D-8, 13 커밋)

브랜치 `feature/d9-validation-coverage` (커밋 `c41f5bb` ~ `6d6545c`):

| 영역 | 산출물 |
|------|--------|
| 검증 코드 | `backend/analysis/verification_h2.py` (10 tests) — barrier_intensity max 집계 + Pearson/Spearman |
| 베이스라인 | `backend/analysis/baseline_b1.py` (15 tests) — OA-15576 utf-8/cp949 자동 + Jaccard |
| API | `backend/api/validation.py` + `backend/schemas/validation.py` (5 tests) — `GET /api/insights/validation` 단일 소스 + env override |
| 산출 스크립트 | `scripts/run_validation_all.py` — H1·H2·H3·B1 4 가설 통합 산출 (5 tests) |
| 시연 점검 | `scripts/preflight_check.py` — 31 항목 3 모드 (10 tests) |
| OpenAPI | `scripts/export_openapi.py` → `docs/api_openapi.json` 8 경로 |

### 3. 회귀 상태

```
backend pytest: 203 → 248 (+45 신규)
preflight: 31/31 ALL PASS
build (frontend): 2.0 MB / gzip 562 KB ✅
```

### 4. Dev-A 잔여 (Week 4·5, 자치)

| 항목 | 마감 | 비고 |
|------|------|------|
| 데이터 출처 아이콘 API 연동 | Week 4 | 각 지표별 OA-ID 매핑 |
| 캐시 데이터 폴백 + "캐시 데이터로 표시 중" 안내 | Week 4 | (Dev-B 와 협의) |
| 재생 모드 (정적 캐시 데이터 시연용) | Week 4 | hero shot 백업 시나리오 |
| Redis 캐시 레이어 / 월간 배치 자동화 | Week 5 | 운영 수준 |
| 서울 전역 데이터 확장 가능성 검토 | Week 5 | v2 backlog 로 이전 권장 |
| 배포 환경 구성 (시연 서버 또는 Docker) | Week 5 | (Dev-C 가 Vercel 정적 + demo mode 자체 진행 — 협의 불요시 보류) |

### 5. Dev-A 협의 사항 3 건

1. **발표용 시연 서버** (D-3, 5/9 권장)
   - Dev-C 가 Vercel 정적 + demo mode 자체 진행. 백엔드 별도 호스팅 불요.
   - 풀 백엔드 호스팅 (Render/Railway/Fly.io) 의향 있으시면 `docs/deployment_guide.md §3` 협의.
   - **회신 부탁: D-3 까지 의향 알려주세요.**

2. **서울 전역 확장** (v2 일정)
   - 발표 후 5/13 이후 별도 메시지로 협의.
   - 현재 코드는 `--gu` 인자만 변경하면 전역 확장 가능 (코드 변경 없음).

3. **D-1 (5/11) 마지막 점검**
   - 발표 전 한번 더 적재 상태 + 캐시 폴백 동작 점검.
   - Dev-C 가 `python -m scripts.preflight_check --mode files+server` 로 자동 점검 후 결과 공유 예정.

### 6. 잔여 (Dev-C 수동 영역, Dev-A 무관)

Dev-C 측에서 D-1 까지 완료할 작업 (Dev-A 협의 불요):
- OA-15576 정적 CSV 다운로드 → `data/baselines/seoul_change_index_2025Q4.csv`
- `python -m scripts.run_validation_all --quarter 2025Q4 --previous 2025Q3` 1회 실행
- 산출 결과를 `frontend/src/data/validation_results.json` 에 반영
- Hero shot PNG 5종 캡처

### 7. 감사

PR #19 (FastAPI 엔드포인트 5종 + CSV export + 성능 테스트 107 tests), PR #23 (closure_rate spatial join), PR #24 (admin_boundary gu_nm 백필) 머지 협조 감사드립니다. 본 v1.0 발표가 가능한 것은 인경님의 백엔드 인프라 위에 분석/시각화를 쌓을 수 있었기 때문입니다.

발표 후 v2 협의 메시지로 다시 인사드리겠습니다.

감사합니다.
김광오
