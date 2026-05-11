# spiceMap 5주 개발 진행 체크리스트

> 대회: 2026 서울시 빅데이터 활용 경진대회 (제출 마감 2026-05-12)
> 상세 스펙: `docs/FR_Role_Workflow.md`
> 최종 갱신: 2026-05-12 (Week 5 Day 7 / D-Day)

---

## Week 1 (4/8 ~ 4/14) — 기반 구축 ✅

### Dev-A
- [x] 공공데이터포털 API 키 발급
- [x] `living_population` 수집 스크립트 (`collect_living_pop.py`) — 1,032건
- [x] `store_info` 수집 스크립트 (`collect_store_info.py`) — 5,599건
- [x] `commerce_sales` 수집 스크립트 (`collect_commerce_sales.py`) — 108,606건
- [x] PostgreSQL + PostGIS 구축 (`docker-compose.yml`)
- [x] `상권-분기` 정규화 스키마 설계 (`docs/schema.md`)
- [ ] `od_flows` 적재 ⚠ 이월 블로커 (OA-22300 대용량 CSV 필요)
- [ ] `admin_boundary` 적재 ⚠ 이월 블로커 (SHP 필요)
- [ ] `commerce_boundary` 적재 ⚠ 이월 블로커 (SHP 필요)

### Dev-B
- [x] React + Vite + MapLibre 스캐폴딩
- [x] 서울 행정동 경계 레이어 렌더링 (`AdminBoundaryLayer.tsx`)
- [x] 디자인 시스템 색상 토큰 (5개 유형 팔레트, `styles/tokens.ts`)
- [x] dark/light 모드 추가

### Dev-C
- [x] 데이터 품질 검토 리포트 (`docs/data_quality_report.md`)
- [x] 행정동-상권 공간 결합 설계 (`docs/spatial_join_design.md` — 폴리곤 교차 면적 기준)
- [x] 월별→분기 시계열 정렬 설계 (`docs/time_alignment_design.md`)

---

## Week 2 (4/15 ~ 4/21) — 핵심 분석 모듈 🟡 (오늘 마감)

### Dev-A
- [x] FastAPI 초기 구축 (`backend/main.py`, `backend/db.py`)
- [x] `/api/commerce/type-map` 엔드포인트 (`backend/api/commerce.py`)
- [x] `/api/gri/history` 엔드포인트 (응답 스키마 `schemas/commerce.py`)
- [x] `/api/od/flows`, `/api/barriers`, `/api/export/csv`, `/api/insights/policy` 스텁
- [x] 데이터 적재 스크립트 수정 (`load_spatial.py`)
- [ ] Redis 캐시 레이어 설정
- [ ] 데이터 파이프라인 자동화 (월간 배치)

### Dev-B
- [x] 상권 노드 레이어 (마커 크기=순유입, 색상=유형) — `CommerceNodeLayer.ts`
- [x] OD 흐름 곡선 레이어 — `ODFlowLayer.ts`
- [x] 흐름 파티클 애니메이션 — `FlowParticleLayer.ts`, `useAnimationFrame.ts`
- [x] 상권 유형 색상 인코딩 + 범례 — `CommerceLegend.tsx`
- [x] 흐름 제어 패널 (시간/목적/밀도/유형) — `FlowControlPanel.tsx`
- [x] 상세 패널 UI 스캐폴딩 — `CommerceDetailPanel.tsx` (Week 3 API 연동 대기)
- [x] GRI 훅 — `useGriHistory.ts`
- [x] 상권 데이터 훅 — `useCommerceData.ts`
- [x] 상단 해설바 + summaryFormatter

### Dev-C
- [x] Week 2 의사결정 기록 (`docs/week2_decisions.md`)
- [x] GRI 공식 설계 (`docs/gri_formula.md`)
- [x] Module A 설계 (`docs/module_a_design.md`)
- [x] Module A NetworkX 스켈레톤 + 더미 데이터 TDD (`backend/analysis/module_a_graph.py`)
- [x] Module B (GRI 산출) 구현 (`backend/analysis/module_b_gri.py`)
- [ ] Module C (흐름 단절 탐지) 구현 (`backend/analysis/module_c_barriers.py`)
- [x] 분기 커버리지 실측 (`commerce_sales`, `store_info` 적재 범위) — `docs/quarter_coverage_report.md`
- [x] Module D 선행 설계 (`docs/module_d_design.md`, Week 3 구현 대비)
- [x] Dev-A 에스컬레이션 초안 작성 (`docs/dev_a_escalation_draft.md`, 미발송)

**주차 완료 기준**: 강남·관악 상권 유형 분류 결과, GRI 초기값, 단절 구간 후보 추출.
**블로커 대응**: od_flows 0건 → 더미 데이터로 Module A 선행 구현, 실제 적재 후 재검증.

---

## Week 3 (4/22 ~ 4/28) — API 연동 + UI 핵심 기능

### Dev-A
- [x] 전체 엔드포인트 완성 (`/api/od/flows`, `/api/barriers`, `/api/insights/policy`) — **PR #19** (2026-04-27)
- [x] `/api/export/csv` CSV 다운로드 기능 — **PR #19**
- [x] 성능 테스트: 지도 로딩 ≤ 5초 (캐시 ≤ 3초), 상권 클릭 ≤ 1초 — **107 tests pass** (PR #19)

### Dev-B
- [x] 상권 클릭 → 상세 패널 API 연동 (GRI·폐업률·추세 그래프)
- [x] 분기 타임라인 슬라이더
- [x] 자치구 필터 + 상권 유형 필터 UI

### Dev-C
- [~] Module D: 규칙 기반 정책 추천 생성 — **R4~R7 구현 완료** (`module_d_policy.py`), R1~R3·R8은 od_flows 적재 후 활성화
- [x] Module E: 정책 우선순위 점수 산출 — **2026-04-29 구현 완료** (`backend/analysis/module_e_priority.py`, GRI 0.60 + 매출규모 0.25 + 추세 0.15, 16 tests pass)
- [x] H1 검증: 순유입-매출 Pearson 상관 (목표 p < 0.05) — 함수 구현 완료 (`verification_h1.py`), 실데이터 실행은 `od_flows` 적재 후
- [x] 상권 유형 근사 분류기 구현 — **신규** (`commerce_type.py`, v1.0 — 임대료/프랜차이즈 미사용)
- [x] PolicyCard Pydantic 스키마 — **신규** (`backend/schemas/insights.py`, FR-07 준수)
- [x] od_flows 집계본 스키마 + 집계 스크립트 — **신규** (`OdFlowAggregated` 모델, `aggregate_od_flows.py`, `load_quarterly_od_flows` 어댑터) — 80M 원본을 ~300K로 축소, Supabase 수용 가능
- [x] commerce_analysis 스키마 확장 + policy_cards 신규 테이블 — **2026-04-26** (`backend/models.py` 6컬럼 추가 + `PolicyCardRecord`). 결정: A+B 하이브리드 — 1:1 지표 컬럼은 commerce_analysis에 추가, 1:N PolicyCard는 별도 테이블, C 실시간 계산 거부 ("상권 클릭 ≤ 1초" 위반 위험)
- [x] 분석 INSERT 파이프라인 (`backend/pipeline/run_analysis.py`) — **2026-04-29** 분기 입력으로 Module A·B·D·E 실행 → `commerce_analysis` 분기 DELETE+INSERT + `policy_cards` 분기 DELETE+INSERT (idempotent, 18 tests pass)
- [x] `/api/insights/policy` 어댑터 — **PR #19** `policy_cards` SELECT → `PolicyCard` Pydantic 응답 (3 tests pass)
- [x] `/api/commerce/type-map` 응답에 신규 5컬럼 노출 — **2026-04-29** (`commerce_type, priority_score, net_flow, degree_centrality, closure_rate`, 4 tests pass)
- [x] PR 2: Supabase 이전 — **2026-04-29** `.env.example` 이미 Supabase Session Pooler 기본값, 에스컬레이션 메시지 집계본 공유 방향으로 교체 (`docs/dev_a_escalation_draft.md`)
- [x] closure_rate spatial join 정밀화 — **2026-04-29 PR #23** signgu_cd 기반(adm_cd 앞 5자리), PostGIS LATERAL ST_Contains, fallback 휴리스틱 유지. Supabase 검증: 1,650 commerces 매핑 + 178 closure 결합
- [x] admin_boundary.gu_nm 백필 + 자동 도출 — **2026-04-29 PR #24** Supabase 425/425 자치구 채워짐, `load_spatial.py`에 `SEOUL_SIGUNGU_CD_TO_NM` 추가로 향후 재적재 자동화. type-map gu 필터 정상 작동(강남 104·관악 74)
- [x] 수상 전략 + 실용성 강화 플랜(D-13) — **2026-04-29 PR #22** `docs/strategy_d13.md`. 핵심 의사결정 5건 + 13일 일정 + 평가축 매핑
- [x] 2025Q3 od_flows_aggregated 적재 — **2026-04-29** 서울 OA-22300 일별 ZIP 92일(7/1~9/30) 자동 다운로드 + MVP 필터 + 분기 집계 + psycopg2 `execute_values` 업로드. 인코딩 fallback(cp949→utf-8), 5일마다 rolling 컴팩트+체크포인트로 메모리 35MB 제한. 결과 183,506행 (median 256.4, max 3,059,390, total 415M)
- [x] 2025Q4 od_flows_aggregated 재적재 — **2026-04-29** Q3 적재 후 검증에서 Q4 `trip_count_sum` 단위 불일치 발견(median 3.5 vs Q3 256). 동일 파이프라인으로 92일(10/1~12/31) 재처리 + `ON CONFLICT DO UPDATE` 덮어쓰기. 결과 182,971행 (median 256.8, max 2,898,398, total 405M). Q3·Q4 비율 0.94~1.05로 동등 척도 확보 → trend_penalty/H2/H3/Hero shot 모두 활성

**주차 완료 기준**: 필터 작동, 상세 패널 데이터 연동, 우선순위 80+ 목록 표시, CSV 다운로드 동작.

---

## Week 4 (4/29 ~ 5/5) — 완성도 + 검증

### Dev-A
- [x] 데이터 출처 아이콘 API 연동 — **PR #38 nik** `backend/api/data_sources.py` 신규 (`/api/data_sources`), 각 지표별 OA-ID 매핑
- [x] 캐시 데이터 폴백 + "캐시 데이터로 표시 중" 안내 — **PR #38 nik** `backend/api/cache_utils.py`
- [x] 재생 모드 (정적 캐시 데이터 시연용) — **PR #38 nik**

### Dev-B
- [x] 흐름 단절 레이어 토글 (점선 강조 + 툴팁) — **PR #39 kbh 3-1** `BarrierLayer` + 토글 + hover 카드 (Claude-E + 직접 통합)
- [x] 분기 비교 뷰 (두 핸들 슬라이더 → 나란히 비교) — **PR #39 kbh 3-2** `kpiDelta` 표시 + `compareMode` (Claude-F)
- [x] 접근성 검토 (색각 이상 시뮬레이션) + 수정 — **PR #39 kbh** Codex aria-label 보강 + 색각 구분 수동 확인
- [x] P0 발표 임팩트 5종 — **PR #39 kbh** 해설바·초기 자치구·정책카드·GRI 테두리·OD 강조
- [x] P1 신뢰 보강 — **PR #39 kbh** Toast 알림(`ToastProvider`/`ToastContext`) + placeholder 문구 정리
- [x] P3 폴리시 4종 — **PR #39 kbh** 상권경계·시각화상수·성능측정·태블릿반응형 (`useViewportMode`)
- [x] API 데이터 계약 align + commerce boundary visibility — **PR #39 kbh** `0436665` `ed249e3`
- [x] Hero shot 시연 동선 정밀화 — **2026-05-03 b763b20** PR1 펄싱+R4 강조 (`createHeroPulseLayer` 1.5s halo, `?hero=1` 시 전 zoom 가시 / `CommerceDetailPanel` 정책카드 R4 우선 정렬 / `PolicyCard.highlight` 노란 outline + fadeIn 300ms) + PR2 CSV toast 피드백(`FlowControlPanel`) + 검증 탭(`ValidationView` H1/H3/B1/B3 4카드, `/api/insights/validation` + 정적 fallback `frontend/src/data/validation_results.json`) + `?hero=1` 토글 + `HERO_NODE_ID='gw_001'`(신림) + 단축키 1~4. `docs/hero_shot_scenario.md` 시간축 1:1 정렬, `docs/hero_shot_assets/README.md` 자산 인벤토리. InsightStrip light theme fix(0d8feda). 178 vitest 통과, npm run build 성공.
- [x] 컴포넌트 회귀 강화 — **2026-05-04** ValidationView 8 tests(`f0e7c81`) + PolicyCard 10 tests(`bf04622`) + `computeHeroPulseFrame` helper 분리 + 7 tests(`1a33bd8`). frontend vitest 178 → 203 (+25).
- [x] PR #40 main 통합 머지 — **2026-05-04 b3f4c48** PR #38 nik (Dev-A 영역) + PR #39 kbh (Dev-B P0~P3) 충돌 7파일 해결. backend pytest 248 → 260 / frontend vitest 203 → 246 / build 2.0MB / gzip 582KB ✅
- [x] 흐름단절 파티클 애니메이션 — **2026-05-04 kbh** `DisruptedBarrierParticleLayer` + `barrierRouteAnimation` 신규. showBarriers ON 시 severity 색상 파티클이 경로를 따라 흐르고 t=0.5 단절 지점에서 scatter+fadeout. 44 tests 신규. frontend vitest 246 → 304. FlowBarrierLayer 원래 점선 베지어 복원.
- [x] 흐름단절 실 도로 경로 — **2026-05-05 PR #41 kbh** `backend/api/barrier_routes.py` 신규 + `/api/barrier-routes` 엔드포인트 + ORS(Openrouteservice) 호출 + fallback (직선 대체). `useBarrierRoutes` hook + FlowBarrierLayer 도로 매칭/fitting + DisruptedBarrierParticleLayer 도로 polyline 파티클. `OPENROUTESERVICE_API_KEY` 미등록 시 mock 고정. 11 신규 회귀 테스트 (`barrier_route_coverage` + `useBarrierRoutes`). `docs/openrouteservice_key_note.md` 운영 가이드.
- [x] commerce type-map geom WGS84 정규화 — **2026-05-05 46a5287** `backend/api/commerce.py` SRID 4326 강제. 잘못된 좌표계 노드 차단.
- [x] 검증 보고 토글 헤더 클리어런스 — **2026-05-05 299a0ab** ValidationView 토글이 상단 헤더를 가리지 않도록 위치 조정.
- [x] commerce boundary URL 빌더 추출 + 빈 API_BASE 허용 — **2026-05-05 1a4bff0** refactor + 단위 테스트.
- [x] 미사용 컴포넌트/구 GRI 유틸 정리 — **2026-05-05 9d13e04** gri.ts → percentile.ts 마이그레이션. 빈 스타일 파일 삭제. 런타임 미사용 확인 후 제거.

### Dev-C
- [x] Module C 시계열 갭 알고리즘 + flow_barriers 적재 — **2026-04-30 PR #29** Module C 풀 구현 대체. `compute_flow_gaps(od_q3, od_q4, mapping, threshold=0.5)` 18 tests. Supabase Q4 200건 적재 (decline 0.587~1.000)
- [x] commerce_type 분류기 v1.1 임계 조정 — **2026-04-30 PR #31** unclassified 902→687(-13.1%p), 방출형 0→117 / 안정형 1→98 신규 분류
- [x] commerce_sales 2025Q3 적재 + run_analysis Q3 실행 — **2026-04-30** Q3 commerce_analysis 1650 + policy_cards 419 적재 (trend_penalty/H3 활성)
- [x] H1 검증 실데이터 — **2026-04-30 PR #30** Q4 net_flow vs Q4 sales Pearson **r=0.106 / p=2.83e-05 / n=1565** (방향 ✓ 효과 약함, FAIL r<0.5)
- [x] H3 검증 실데이터 — **2026-04-30 PR #30** Q3 GRI 상위 20% Q4 폐업률 vs 하위 80% **gap=0.75pp / p=5.26e-36 / n=1650** (방향 ✓ 절대 격차 작음, FAIL gap<2.0pp). 한계: closure_rate 자치구 단위 매핑 → 분산 부족
- [x] H2 검증 함수 구현 — **2026-05-03** `backend/analysis/verification_h2.py` (`aggregate_barrier_intensity` + `compute_h2_alignment`, Pearson/Spearman, 임계 r ≥ 0.3 + p < 0.05). 10 tests pass. 실데이터 산출은 `scripts/run_validation_all.py --quarter 2025Q4 --previous 2025Q3` (H1·H2·H3·B1 통합) 또는 `scripts/run_validation_h2_b1.py` (H2+B1 좁은 범위)
- [x] 베이스라인 B1 코드 구현 — **2026-05-03** `backend/analysis/baseline_b1.py` (`load_change_index_csv` utf-8/utf-8-sig/cp949 자동 + `compute_b1_baseline` 상권쇠퇴 binary + `compare_priority_to_b1` Jaccard). 15 tests pass. 정적 CSV 절차 `data/baselines/README.md`. 기존 산출(Jaccard 0.58, 14건) 재현 가능
- [x] 베이스라인 B3 (기존 매출 추세 모델) — **PR #36** Jaccard 0.151 (PASS, 추가 위험 231건)
- [x] 검증 결과 패널 콘텐츠 작성 — **2026-05-03 b763b20+88adc9f** `ValidationView` 5카드 (H1 r=0.106 / H2 함수+카드 / H3 gap=0.746%p / B1 J=0.58 / B3 J=0.151) + 백엔드 `GET /api/insights/validation` (`backend/api/validation.py`, 5 tests, env override 가능). 단일 소스 `frontend/src/data/validation_results.json` — backend 가 동일 파일 응답
- [x] 프론트 Tier 1 — **2026-04-30 PR #32** 가치 명제 헤더 2단 + MVP 강남·관악 자동 줌 (center [127.0, 37.49], zoom 11.5)

**주차 완료 기준**: 3분 발표 시나리오 1회 시연 통과, H1~H3 수치 확정.

---

## Week 5 (5/6 ~ 5/12) — 마감 + 발표 준비

### 기능 마감
- [ ] 서울 전역 데이터 확장 가능성 검토 (Dev-A)
- [x] 배포 환경 구성 (시연 서버 또는 Docker) (Dev-A) — **2026-05-09 PR #44~#47** Railway Dockerfile + `railway.toml` + `requirements-api.txt` (geopandas 제거 경량화) + PORT 환경변수 대응 + `.dockerignore`. Vercel(`frontend/vercel.json`)과 별개 백엔드 단독 배포 경로 확보
- [ ] 3분 발표 시나리오 애니메이션 최종 조정 (Dev-B)
- [ ] 태블릿 반응형 최종 확인 (Dev-B)

### 검증 실측 (2025Q4 D-3)
- [x] H1·H2·H3·B1 실측 수치 반영 — **2026-05-09 PR #48** `data/baselines/validation_2025Q4.json` + `frontend/src/data/validation_results.json` 현행화. H1 r=0.106 / p=2.83e-05 / n=1565, H2 r=-0.595 / p=6.51e-05 / n=39 (방향 반대 — selection bias 가능, v2에서 표본 확장 필요), H3 gap=0.746%p / p≈5e-36 / top n=330·bottom n=1320, B1 Jaccard=0.157 / 추가 식별 187건
- [x] `/api/barriers` centroid 좌표 응답 — **2026-05-09 PR #43~#48** `backend/api/barriers.py` + `schemas/barriers.py`에 from/to centroid 좌표 추가 (프론트 흐름 단절 라인 anchor)
- [x] README · FR_Workflow 현행화 — **2026-05-09 PR #49** 배포 URL·실측 수치·차별점 강화
- [x] closure_rate 동일값 버그 수정 — 업종 매출 가중평균 — **2026-05-10 D-2** `backend/pipeline/run_analysis.py`에 `_closure_via_industry_weighted` 추가. 자치구×업종 close_rate를 (상권×업종) 매출 비중으로 가중평균 → 같은 자치구라도 업종 mix가 다르면 상권별 분산 발생. fallback 체인: weighted(1) → spatial broadcast(2) → heuristic(3) → median fill(4). schema 무변경. `tests/pipeline/test_run_analysis.py` 32/32 PASS (신규 5 케이스 — TestIndustryWeightedClosure: top precedence·spatial fallback·empty fallback·SQLite SQL 실패·가중평균 변동 sanity)
- [x] **Supabase Q4 재계산 + ValidationView 갱신** — **2026-05-10 D-2** Supabase 직결 `run_analysis --quarter 2025Q4 --previous 2025Q3` 실행 → `commerce_analysis` 1,650행 + `policy_cards` 414건 DELETE+INSERT, GRI/priority_score 모두 새 closure_rate 입력으로 일관 재계산. **MVP 자치구 closure_rate 분포**: 강남(11680) n=104·distinct=99·std=0.780 / 관악(11620) n=74·distinct=72·std=0.910 (이전: 사실상 broadcast 단일값). MVP 외 23개 자치구는 `store_info` 데이터 부재로 0.0 broadcast 유지(raw 적재 한계). `scripts/run_validation_all` H1·H2·H3 재산출 → `data/baselines/validation_2025Q4.json` 갱신: **H3 gap 0.746%p → 1.009%p (+35%), p≈8e-31 (top_avg 1.084·bottom_avg 0.075, 14.5배 ratio 유지)**. H2 r=-0.595→-0.558 (분산 증가로 약간 약화), spearman -0.812→-0.558. `frontend/src/data/validation_results.json` H2/H3 카드 narrative 갱신 + frontend build PASS (1492 modules, gzip 618KB). 백업 테이블 `commerce_analysis_backup_20260510` 보존 (롤백용, 발표 시연 후 사용자 DROP)

### 제출 산출물
- [~] 웹 데모 최종 버전 배포 — **2026-05-03** Vercel(`frontend/vercel.json`) + Netlify(`frontend/netlify.toml`) 정적 호스팅 설정 + `.env.production.example` + `docs/deployment_guide.md` (절차/검증/일정) + `scripts/preflight_check.py` (시연 안전 점검 25 항목, files/files+server/remote 모드, 10 tests) + `scripts/export_openapi.py` → `docs/api_openapi.json` 8 경로. D-3 preview, D-1 production promote 권장. 실제 배포는 V-World 도메인 등록 후 Dev-B 수동
- [ ] 시연 영상 녹화 (Dev-B 주도)
- [x] PDF 정책 요약 리포트 예시 2종 — **2026-05-03** `docs/policy_report_gangnam_apgujeong.md` (R4 젠트리피케이션) + `docs/policy_report_gwanak_sillim.md` (Hero shot 기준 상권, R4 흐름 단절 회복). pandoc 변환으로 PDF 산출 가능
- [x] 데이터 결합 구조도 1장 — **2026-05-03** `docs/data_integration_diagram.md` (Mermaid: 공공API 6 → PostGIS 11 테이블 → 분석 5모듈 → API 6 → 프론트)
- [x] KPI/검증 결과 표 1장 — **2026-05-03** `docs/kpi_summary.md` (가설 H1·H2·H3, 베이스라인 B1·B3, 시스템 KPI, 정책 규칙 활성표, 한계 보고)
- [x] 발표 Q&A 대응 자료 — **2026-05-03** `docs/qa_briefing.md` (13개 예상 질문 + 출처 인용 답변, A 정량 한계 / B 베이스라인 신뢰성 / C 데이터 갭 / D 정책 규칙 / E 운영·윤리 / F 기술 스택)

---

## 에스컬레이션 이력

- 2026-04-16: Dev-A 응답 대기 시한 (od_flows 등 3종 적재)
- 2026-04-17: 미완료 시 범위 축소 검토 조건 (서울 전역 → 강남·관악만)

---

## 진행 중 작업 (Dev-B): 상권 유형별 색상 구분 복원 (2026-04-29)

### 문제

지도 노드들이 `commerce type`이 아닌 `startup fitColor`(4단계)로 색칠되고, 후보 필터(`fitLevel === 'recommended'`)로 인해 표시 노드 다수가 녹색 1색으로 수렴 → 범례의 6 유형 색상 약속과 불일치.

### 근본 원인

`frontend/src/layers/CommerceNodeLayer.ts:22-26` `getCandidateColor()`가 `deriveStartupSummary(node).fitColor`를 사용 (startup fit 색상). 컨텍스트 레이어도 고정 회색(`[92,111,128,60]`)이라 유형 식별 불가.

### 설계 결정

| 시각 채널 | 인코딩 |
|---|---|
| 색상 | 상권 유형 (6종, `COMMERCE_COLORS[node.type].fill`) |
| 크기 | 창업 적합도 (`deriveStartupSummary().fitScore`, 후보만 8~16px) |
| 테두리 | 선택 상태 (기존 유지) |

색각 이상 대응(FR-11): 1차에서는 색+크기+테두리 + 호버 카드의 심볼로 대응, 항시 IconLayer 심볼은 후속.

### 단계

- [x] Phase 1: `colorUtils.ts` 추출 (hexToRgb 분리 + 단위 테스트)
- [x] Phase 2: `CommerceNodeLayer.ts` 색상 로직 변경 + 테스트
  - 후보 노드: `COMMERCE_COLORS[type].fill` (alpha 230, 선택 시 255)
  - 컨텍스트 노드: 동일 유형색 (alpha 90)
- [ ] Phase 3: 시각 검증 (`npm run dev`)

### 영향 파일

- `frontend/src/utils/colorUtils.ts` (신규)
- `frontend/src/utils/colorUtils.test.ts` (신규)
- `frontend/src/layers/CommerceNodeLayer.ts` (수정)
- `frontend/src/layers/griNodeStyle.test.ts` (확장)

---

## Week 4 후반 — Dev-B 보완·미완성 분담 계획 (2026-05-03 확정)

> CommerceLegend / CLASSIFIED_TYPES는 보류. 보완 10항 + 미완성 5항을 Codex와 Claude가 분담.
> 마감: P0 5/5, P1 5/7, P2 5/10, P3 5/12 (대회 제출일).

### Phase 1 — P0 발표 임팩트 (5/4~5/5)

| ID | 작업 | 담당 | 추정 |
|----|------|------|------|
| 1-1 | 상단 해설바 통일 (Map.tsx → summaryFormatter) | Codex-1 | 30분 |
| 1-2 | 초기 자치구 선택 (강남·관악 기본 선택) | Codex-2 | 30분 |
| 1-3 | PolicyCard 상세 패널 연결 | Claude-A | 1.5시간 |
| 1-4 | GRI 위험도 테두리 (70+/40~69/<40 임계값) | Codex-3 | 1시간 |
| 1-5 | 선택 상권 OD 강조 (admCd 매핑 설계 포함) | Claude-B | 2~3시간 |

### Phase 2 — P1 신뢰 보강 (5/6~5/7)

| ID | 작업 | 담당 | 추정 |
|----|------|------|------|
| 2-1 | "준비중"/"데이터 없음" 문구 정리 | Claude-C | 1시간 |
| 2-2 | CSV 다운로드 실패 토스트 | Claude-D (컴포넌트) → Codex-8 (통합) | 1.5시간 |
| 2-3 | 색각 시뮬 검증 | Claude-H 수동 | 1.5시간 |
| 2-4 | aria-label 보강 | Codex-4 | 1시간 |

### Phase 3 — P2 신규 기능 (5/8~5/10)

| ID | 작업 | 담당 | 추정 |
|----|------|------|------|
| 3-1 | 흐름 단절 레이어 (toggle/점선/툴팁) | Claude-E (훅·통합) → Codex-9 (mock·Layer) | 4~5시간 |
| 3-2 | 분기 비교 KPI delta (듀얼 슬라이더는 미룸) | Claude-F | 4시간 |

### Phase 4 — P3 발표용 폴리시 (5/11~5/12)

| ID | 작업 | 담당 | 추정 |
|----|------|------|------|
| 4-1 | 상권 경계 폴리곤 (BoundaryLayerManager 패턴 복제) | Codex-5 | 2시간 |
| 4-2 | 시각화 상수 재조정 (실데이터 분포 기준) | Codex-6 | 1시간 |
| 4-3 | 지도 로딩 성능 측정 (performance.mark) | Codex-7 | 30분 |
| 4-4 | 발표 시나리오 애니메이션 (?demo=scenario) | Claude-G | 3시간 |
| 4-5 | 태블릿 1024px / 실데이터 E2E | Claude-H 수동 | 2시간 |

### 분담 원칙

- Codex: 단일 파일·기계적 변경·테스트 추가·mock JSON. 발주문에 "Surgical change. 요청 외 변경 금지" 명시.
- Claude: 멀티 파일 통합·데이터 매핑 설계·신규 컴포넌트 아키텍처·UX 판단.

### 의존성 / 블로커

- 1-5 OD 강조: `CommerceNode.admCd` 추가 후 `OD.sourceId/targetId`(adm_cd)와 매칭. Dev-A 응답에 adm_cd 추가 요청 동반 (그동안 mock 우선).
- 3-1 흐름 단절: `/api/barriers` 가용성. 미가용 시 mock 우선.
- 4-1 상권 경계: `commerce_boundary` 적재 (Dev-A 블로커). 그 전에는 mock GeoJSON.

### 진행 상태

- [x] 1-1 (Codex) / [x] 1-2 (Codex) / [x] 1-3 (Claude-A) / [x] 1-4 (Codex) / [x] 1-5 (Claude-B) — **2026-05-03 P0 전체 완료**
- [x] 2-1 (Claude-C) / [x] 2-2 (Claude-D + 직접 통합) / [x] 2-3 (수동 색각 확인) / [x] 2-4 (Codex) — **2026-05-03 P1 완료**
- [x] 3-1 (Claude-E + 직접 통합) / [x] 3-2 (Claude-F) — **2026-05-03 P2 완료**
- [x] 4-1 (Codex) / [x] 4-2 (Codex) / [x] 4-3 (Codex) / [x] 4-4 (직접 통합) / [x] 4-5 (1024px·실사용 확인) — **2026-05-03 P3 완료**

---

## Dev-B 종료 검토 메모 (2026-05-03)

- [x] 색각 구분 수동 확인 완료
- [x] CSV 다운로드 확인 완료
- [x] 흐름 단절 카드 겹침 수정 확인 완료
- [x] 상권 경계 폴리곤 레이어 구현 및 선택 하이라이트 보완
- [x] `/api/barriers` live row 좌표 보존 보완
- [x] OD 하이라이트용 `adm_cd` 계약 보완
- [x] API 상권 경계 선택 매칭 `comm_cd` 대응
- [x] `commerce_analysis` NaN metric NULL 변환 보완

남은 항목은 발표 준비와 운영 DB 기준 최종 확인입니다.

---

## Week 5 추가 작업: 3D 뷰 개선 (2026-05-07)

> 요구사항: 폴리곤 라인대로 상권구역별 지형그래프가 위아래로 솟아오르며, 강도에 따라 따로따로 높낮이; 픽토그램은 1~3개·강도별 크기 변화·줌인줌아웃 자동 스케일.

### 결정 사항
- 솟아오르는 애니메이션: 0 → 목표 높이, 600ms ease-out (out: 300ms)
- 픽토그램 줌 스케일: `sizeUnits: 'meters'` (60~140m), `sizeMinPixels: 10` / `sizeMaxPixels: 56` 가드
- 픽토그램 카운트: 카드 + 지도 위 모두 1~3개로 통일

### Dev-B
- [x] Phase 1: `PolygonExtrusionLayer`에 `progress` 파라미터, `Map.tsx` extrude-progress 연결, `use3DView`에 RAF 애니메이션 (`utils/threeDUtils.ts`의 `easeOutCubic` / `interpolateProgress` 추출)
- [x] Phase 2: `CommerceColumnLayer.MAX_COUNT` 5→3, `getMetricPictogramStats` 1~3 클램프
- [x] Phase 3: `sizeUnits` `'pixels'`→`'meters'`, `OFFSET_STEP` 0.0009 (~80m)로 키워 픽토그램 분리 보장
- [x] Phase 4: vitest 367/367 PASS

### Dev-B (2026-05-07 추가) — 자치구 단위 3D + 빨간 핀 (mockup/map.png 매칭)
> 사용자 피드백: 상권이 아닌 **자치구** 단위로 솟아야 하고, 픽토그램은 **빨간 위치 핀**이어야 함

- [x] A. `utils/districtAggregation.ts` — 자치구별 평균 metric, centroid, dong→district 매핑 (테스트 7개)
- [x] B. `layers/AdminPolygonExtrusionLayer.ts` — 행정동 폴리곤을 자치구 단위 elevation으로 솟게, `stroked: false`로 자치구처럼 보이게, 라벤더 톤 (테스트 7개)
- [x] C. `layers/DistrictPinLayer.ts` — 자치구 centroid에 빨간 핀 1~3개, `radiusUnits: 'meters'` 줌 스케일 (테스트 7개)
- [x] D. `use3DView`에 `adminBoundaries` 추가, `Map.tsx` polygon 모드를 자치구 extrusion + 빨간 핀 동시 표시로 전환, 사용 안 하는 `createPolygonExtrusionLayer` import 제거
- [x] E. vitest 388/388 PASS, vite build 성공
- [x] F. ThreeDMode 재정의 `'off' | 'admin' | 'commerce'`, ThreeDViewControl 토글 라벨 'OFF' / '자치구 3D' / '상권 3D'. `Map.tsx`에서 모드별 분기 — admin: AdminPolygonExtrusion + DistrictPin / commerce: PolygonExtrusion(상권) + CommerceColumnLayer(픽토그램). 두 모드 모두 솟아오르는 애니메이션 적용. CommerceBoundaryLayer는 commerce 모드에서만 숨김(z-fighting 방지). vitest 390/390 PASS, build 성공
- [ ] (사전 결함) `ThreeDViewControl.tsx`의 `getMetricPictogramStats` export — `react-refresh/only-export-components` lint 에러: 별도 파일 분리 필요 (작업 외 수정으로 보류)
- [ ] (수동 검증) `npm run dev`로 자치구 솟음·빨간 핀 위치·줌 스케일링 시각 확인

---

## Week 5 추가 작업: AI 창업 입지 분석 (Startup Advisor) (2026-05-10)

> 공모전 창업 부문 필수 조건(AI 기술 활용) 충족 + 정책 지원 → 창업 의사결정 지원 도구로 포지셔닝 전환.
> 설계: `docs/superpowers/specs/2026-05-10-llm-startup-advisor-design.md`
> 계획: `docs/superpowers/plans/2026-05-10-llm-startup-advisor.md`

### 백엔드 (PR #51 nik)
- [x] Pydantic 스키마 + 스키마 회귀 — `backend/schemas/advisor.py` (`AdvisorIndustriesResponse`, `StartupAdvisorRequest`, `AdvisorTier`, `StartupAdvisorResponse`)
- [x] `GET /api/advisor/industries` — `store_info` DISTINCT industry_nm (분기 필터)
- [x] `POST /api/advisor/startup` — 점수 산출 + Claude API LLM 통합 (`compute_advisor_score`/`assign_tiers` + `anthropic` SDK), `comm_cd` LLM context 포함, JSON 코드블록 마크다운 제거 후 파싱
- [x] `backend/config.py` — `anthropic_api_key` 필드 + `ANTHROPIC_API_KEY` 환경변수
- [x] `backend/main.py` — advisor 라우터 등록
- [x] `requirements*.txt` — `anthropic>=0.30.0` 추가
- [x] 테스트 4종 — `test_schemas_advisor.py`·`test_advisor_industries.py`·`test_advisor_scoring.py`·`test_advisor_startup.py`

### 프론트 (PR #52, #53 kbh)
- [x] `useStartupAdvisor` 훅 — API 호출 + 상태 + `BASE_URL` 빈 문자열 차단(데모 모드 처리)
- [x] `FounderPanelSections.tsx` — 우측 결과 패널 (792 lines, 추천·주의·비추천 3-tier)
- [x] `MetricExplanationCard` — 지표 해설 카드 컴포넌트
- [x] `FlowControlPanel` 어드바이저 섹션 — 업종 드롭다운 + 분석 버튼 (FlowControlPanel 950→reduced + 142 tests 신설)
- [x] `App.tsx`/`Map.tsx` 통합 — `advisorTiers` prop으로 노드 색상 오버레이, `tierMap`을 `use3DView`/훅 내부에서 생성(import 충돌 회피), `advisorTiers` `useMemo` 파생화(훅 순서 위반 수정)
- [x] mock 데모 — `mock_advisor_industries.json`·`mock_advisor_startup.json`
- [x] 추천 상권 영역 폴리곤 제거(2026-05-10 PR #52 a28bd44) — 노드 색상으로만 시각화

### 백엔드 데이터 정합성
- [x] `store_info.year_quarter` 형식 변환(`2025Q4` → `20254`, 4debc65) — DB raw 포맷과 API 입력 정규화

---

## Week 5 추가 작업: Module C non-OD barriers 풀 구현 (2026-05-09~10)

> 기존 `compute_flow_gaps`(OD 기반) 외에 OD 데이터가 없는 상권에 대해 시계열·공간 기반 barriers 추출.

- [x] `backend/analysis/module_c_barriers.py` (188 lines) — non-OD barriers 알고리즘 + `tests/analysis/test_module_c_barriers.py`
- [x] `backend/pipeline/build_non_od_barriers.py` (258 lines) — flow_barriers 적재 파이프라인 + `tests/pipeline/test_build_non_od_barriers.py`
- [x] `backend/pipeline/run_analysis.py` 통합 — non-OD barriers 단계 추가 + 회귀 보강
- [x] `backend/api/barriers.py` 응답에 `from_centroid`/`to_centroid` 추가, `schemas/barriers.py` 확장 (PR #43 87b993b)

---

## Week 5 추가 작업: 3D UX·시각 정밀화 + Advisor v2 (2026-05-10 D-2 후반)

> 3D 뷰 1차 구현 후 UX 가독성·시각 정밀화. Advisor 결과 품질 강화.

### 3D UX·시각 (PR #55 kbh)
- [x] 설계 문서 — `docs/plan_3d_ux.md` (160 lines), `docs/plan_3d_visual.md` (275 lines)
- [x] `frontend/src/utils/colorRamp.ts` 신규 (60 lines + 60 tests) — 강도→색상 그라데이션 보간 헬퍼
- [x] `PolygonExtrusionLayer`·`AdminPolygonExtrusionLayer`·`CommerceColumnLayer` 모두 colorRamp 통합 — 3D 강도 시각 일관화
- [x] `Map.tsx` 148 lines 갱신 — 3D 모드별 분기 + 좌측 분석 패널 가독성
- [x] `CommerceDetailPanel` 정밀화 — `MetricExplanationCard` 129 lines 갱신
- [x] `frontend/src/utils/numberFormat.ts` 신규 (5 lines) — 매출/카운트 포맷팅
- [x] `frontend/src/utils/founderUx.ts` 30 lines 추가 — 창업자 UX 헬퍼
- [x] `frontend/src/utils/threeDUtils.ts` 26 lines 추가 — 3D 보간/스케일

### Advisor v2 — 품질 강화 (PR #54 nik, PR #55 kbh)
- [x] `backend/api/advisor.py` 117 lines 갱신 — 추천/주의/비추천 **각 3개씩 반환** (이전 단일 결과) + 점포 수 **역 U 커브 보정** (포화 시장 패널티)
- [x] `tests/api/test_advisor_scoring.py` 12 lines 갱신 — 새 점수 공식 + 3-tier 균등 분배 회귀
- [x] 추천/주의 상권 확인 후 선택 시 카메라 이동 (kbh bbe0372) — UX 흐름 일체화
- [x] 계산 방식 강화 (kbh bbe0372) — 업종 점포수 + 업종 폐업률 영향 강화

### closure_rate 가중평균 fix (Dev-C, 본 세션)
- [x] `backend/pipeline/run_analysis.py` `_closure_via_industry_weighted` 추가 — 자치구×업종 close_rate × 상권×업종 매출 비중 가중평균
- [x] Supabase Q4 재계산 적용 — strange가 위에 검증 실측 (2025Q4 D-3) 섹션에 기록됨
- [x] H3 gap 0.746%p → 1.009%p (+35%) 갱신 — `frontend/src/data/validation_results.json` H2/H3 카드 narrative 동기화 + frontend build PASS

## Week 5 추가 작업: D-1 막바지 보정 (2026-05-11 D-1)

### 백엔드 API·배포 보정
- [x] **OD flows `purpose` 파라미터 추가** (PR #61) — `backend/api/od.py` 강남구 퇴근 흐름 누락 해결. 출근/퇴근/여가 등 목적별 필터링 가능.
- [x] **Vercel tsc 빌드 복구** (PR #60) — `App.tsx` 미사용 import 제거 + `FlowControlPanel.test.tsx`에서 제거된 `compareMode`·`onToggleCompare` prop 정리.
- [x] **`requirements-api.txt`에 numpy 추가** (PR #58) — `advisor.py` 의존성 누락으로 인한 배포 404 해결.

### 데이터·UI 보정
- [x] **창업 어드바이저 UI 개선 + Q1/Q2 백필 스크립트** (PR #59) — `scripts/backfill_q1q2_estimates.py` (189 lines) 신규. `FounderPanelSections`/`PolicyCard`/`CommerceDetailPanel` UI 정밀화.
- [x] **상권 추천/주의/비추천 색상 변경** (PR #57, 머지: 2026-05-11 직전). `CommerceBoundaryLayerManager` + `seoulDistricts` 보강.
- [x] **`frontend/vitest.config.ts` 신규** — frontend 테스트 설정 분리.

## Week 5 추가 작업: D-Day 시연·발표 자료 정비 (2026-05-12 D-Day)

### 발표 산출물 작성
- [x] **공모전 제출 양식 사실 카드** (PR #64) — `docs/competition_submission_facts.md` 신규. 열린데이터광장 4종(OA-14991/15577/15572/15576) + 공공데이터포털 OA-22300, AI 3계층(Claude Haiku 4.5 + NetworkX DiGraph + scipy 3종), 5분야 데이터 결합(adm_cd↔comm_cd EPSG:5179 overlay) 사실을 backend 코드/`validation_2025Q4.json`에서 직접 인용.
- [x] **발표용 핵심 기능 5선 치트시트** — `docs/presentation_features.md` (162 lines) 신규. 30초 도입부 + 기능 5종 한 줄·차별점·동작 정리.
- [x] **활용 방안 및 기대 효과** — `docs/Usagaeplan/usage_and_effects.md` (137 lines) 신규. 자치구청 정책담당자·소상공인 지원기관·창업자 페르소나별 활용 시나리오.
- [x] **Preview 인덱스 정비** — `docs/preview/` 디렉토리 신설, `hero_shot_scenario.md`·`hero_shot_assets/` 이동 + `demo_storyline_gangnam_gwanak.md` (104 lines) 신규 시연 촬영 대본 + `README.md` 인덱스.

### 시연 UX 보정
- [x] **OD flow 호버 상태 알람카드** (PR #66 kbh, 36acb0c) — `frontend/src/components/Map.tsx` +114줄. 흐름 호버 시 상태 알림 표시.
- [x] **Barrier routes 자치구 정렬** (a707ad3) — `frontend/src/hooks/useBarrierRoutes.ts` 선택 자치구와 barrier 경로 정합. 신규 테스트 `useBarrierRoutes.test.tsx` (57 lines).
- [x] **파비콘 설정** (0acbe31) — `frontend/public/favicon.svg` 브랜드 일관성.
- [x] **단절영역 flow 색상 변경 + 폴리곤 라인 재수정** (PR #67 kbh, 3529325) — `FlowBarrierLayer`·`FlowParticleLayer`·`ODFlowLayer`·`PolygonExtrusionLayer`·`DisruptedBarrierParticleLayer`·`BoundaryLayerManager`·`CommerceBoundaryLayerManager` 등 13개 파일 시각 정밀화 (Hero shot 가독성 강화).

### 배포 안정성
- [x] **Railway 503 핫픽스 — type-map 자치구 fetch 직렬화** (PR #68, 061ae8c) — `frontend/src/hooks/useCommerceData.ts:54-61` `Promise.all(districts.map(...))` → 직렬 `for-await`. 5개 자치구 부분 선택 시 백엔드 PostGIS LATERAL ST_Contains 동시 5건이 SQLAlchemy 풀(기본 15) 고갈 + 싱글 워커로 503을 유발하던 패턴 차단. tsc 통과, 라이브 검증(5/5 200 OK, 2.3~3.3s) 후 머지. 후속(발표 후): 옵션 B(`backend/db.py` 풀 명시 + `Dockerfile --workers 2`), 옵션 C(`adm_comm_mapping` JOIN으로 LATERAL 제거).
