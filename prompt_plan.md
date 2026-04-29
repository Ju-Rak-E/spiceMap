# spiceMap 5주 개발 진행 체크리스트

> 대회: 2026 서울시 빅데이터 활용 경진대회 (제출 마감 2026-05-12)
> 상세 스펙: `docs/FR_Role_Workflow.md`
> 최종 갱신: 2026-04-29

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

**주차 완료 기준**: 필터 작동, 상세 패널 데이터 연동, 우선순위 80+ 목록 표시, CSV 다운로드 동작.

---

## Week 4 (4/29 ~ 5/5) — 완성도 + 검증

### Dev-A
- [ ] 데이터 출처 아이콘 API 연동 (각 지표별 공공데이터포털 OA-ID 매핑)
- [ ] 캐시 데이터 폴백 + "캐시 데이터로 표시 중" 안내
- [ ] 재생 모드 (정적 캐시 데이터 시연용)

### Dev-B
- [ ] 흐름 단절 레이어 토글 (점선 강조 + 툴팁)
- [ ] 분기 비교 뷰 (두 핸들 슬라이더 → 나란히 비교)
- [ ] 접근성 검토 (색각 이상 시뮬레이션) + 수정

### Dev-C
- [ ] H2 검증: 흐름 단절 → 폐업 정합도
- [ ] H3 검증: GRI 고위험 → 다음 분기 임대료/프랜차이즈 방향성
- [ ] 베이스라인 B1~B3 vs 제안 모델 성능 비교 표
- [ ] 검증 결과 패널 콘텐츠 작성 (상관계수·방향성 일치 수치)

**주차 완료 기준**: 3분 발표 시나리오 1회 시연 통과, H1~H3 수치 확정.

---

## Week 5 (5/6 ~ 5/12) — 마감 + 발표 준비

### 기능 마감
- [ ] 서울 전역 데이터 확장 가능성 검토 (Dev-A)
- [ ] 배포 환경 구성 (시연 서버 또는 Docker) (Dev-A)
- [ ] 3분 발표 시나리오 애니메이션 최종 조정 (Dev-B)
- [ ] 태블릿 반응형 최종 확인 (Dev-B)

### 제출 산출물
- [ ] 웹 데모 최종 버전 배포 (Dev-B)
- [ ] 시연 영상 녹화 (Dev-B 주도)
- [ ] PDF 정책 요약 리포트 예시 2종 (Dev-C)
- [ ] 데이터 결합 구조도 1장 (Dev-C)
- [ ] KPI/검증 결과 표 1장 (Dev-C)
- [ ] 발표 Q&A 대응 자료 (Dev-C)

---

## 에스컬레이션 이력

- 2026-04-16: Dev-A 응답 대기 시한 (od_flows 등 3종 적재)
- 2026-04-17: 미완료 시 범위 축소 검토 조건 (서울 전역 → 강남·관악만)
