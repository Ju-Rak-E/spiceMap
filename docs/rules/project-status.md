# spiceMap 프로젝트 진행 상태

> CLAUDE.md(60줄 권장)에서 분리. 시점성 정보(주차 진행, 블로커, 검증 카운트)는 여기에 누적한다.

## 주차별 진행

- **Week 1 (4/8~4/14)**: 완료. 공공데이터 수집 스크립트 3종, PostgreSQL+PostGIS 구축, 데이터 품질 리포트.
- **Week 2 (4/15~4/21)**: 완료. FastAPI 초기 구축, 상권 노드/OD/파티클 레이어, GRI 공식, Module A/B.
- **Week 3 (4/22~4/28)**: 완료. API 5종, Module A/B/D/E, run_analysis 파이프라인, closure_rate spatial join, admin_boundary 백필, type-map gu 필터, Dev-B 상세패널·타임라인·자치구필터.
- **Week 4 (4/29~5/5)**: 완료. Module C·H1·H3·분류기 v1.1·프론트 Tier 1·B1/B3·검증 5카드·Hero shot 동선·H2/B1 코드+25 tests·`/api/insights/validation`·통합 검증·배포 인프라·발표 자료·흐름단절 실 도로 경로(`/api/barrier-routes` ORS+fallback, `useBarrierRoutes`, polyline 파티클).
- **Week 5 (5/6~5/12)**: 진행 중 (Day 6 / D-1). H1·H2·H3·B1 실측 수치 확정(2026-05-09), Railway 배포 인프라, `/api/barriers` centroid 좌표, **AI 창업 입지 분석(Startup Advisor) — `/api/advisor/industries`·`/api/advisor/startup` Claude API + `FounderPanelSections`·mock 데모**, **3D 뷰(자치구/상권 모드 + DistrictPin·CommerceColumn 픽토그램 + extrude-progress 애니메이션)**, **Module C non-OD barriers 풀구현**, **closure_rate 가중평균 fix(자치구×업종 매출) Supabase 적용 → H3 gap 0.746%p → 1.009%p (+35%)**, README·FR_Workflow 현행화. **D-1 보정(2026-05-11)**: OD flows `purpose` 파라미터 추가(PR #61, 강남 퇴근 흐름 복구) · Vercel tsc 빌드 복구(PR #60) · numpy 의존성 추가로 advisor 배포 404 해결(PR #58) · Q1/Q2 estimates 백필 스크립트(PR #59) · 상권 추천 색상 변경(PR #57) · `frontend/vitest.config.ts` 분리. 사용자 잔여: Hero shot PNG 5종·시연 영상·Vercel/Railway 실배포·`OPENROUTESERVICE_API_KEY`/`ANTHROPIC_API_KEY` 등록 결정.

## 검증 카운트 (최신)

- backend pytest: 304 passed (test_baseline_b1::test_label_constant 1건은 별건 결함, fix 작업 무관)
- frontend vitest: 390+ PASS
- preflight: 31/31 ALL PASS
- frontend build: 1,492 modules, 2.0MB / gzip ~618KB

## 이월 블로커 / 한계

- 원본 `od_flows`만 Dev-A 로컬 (집계본으로 우회). admin/commerce boundary 모두 Supabase 적재 완료.
- closure_rate 가중평균은 MVP 강남(11680)·관악(11620) 자치구에서만 작동. 기타 23개 자치구는 `store_info` 데이터 자체가 0건이라 0.0 broadcast 유지 (raw 적재 한계).
- Q4 백업 테이블 `commerce_analysis_backup_20260510` 보존 (롤백 안전망, 발표 시연 후 DROP 권장).

## 발표 narrative 핵심 메시지

- **H3 gap 0.746%p → 1.009%p (+35%)**: 자치구×업종 매출 가중평균으로 closure_rate 분산을 정밀화한 결과. GRI 상위 20%가 하위 80%의 14.5배 폐업률, p≈8×10⁻³¹.
- **자치구 내 진짜 분산**: 강남 99 distinct (n=104, std=0.78), 관악 72 distinct (n=74, std=0.91). 이전엔 사실상 broadcast 단일값.
- **B1 차별화**: OA-15576 공식 지표 미탐지 187건 추가 식별 (보완 신호 PASS).
