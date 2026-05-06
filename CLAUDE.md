# spiceMap

> 서울 상권 인구·소비 흐름 네트워크 시각화 정책 지원 플랫폼
> 2026 서울시 빅데이터 활용 경진대회 (시각화 부문) 제출작

## 팀

| 역할 | GitHub |
|------|--------|
| Dev-A (백엔드/파이프라인) | — |
| Dev-B (프론트엔드) | — |
| Dev-C (데이터 분석) | @pangvelop |

## 아키텍처

```
수집 파이프라인 (Python)
  → PostgreSQL + PostGIS + Redis
  → FastAPI (backend/api)
  → React + Vite + MapLibre + Deck.gl (frontend)
```

## 디렉토리

- `backend/pipeline/` — 공공데이터 수집·적재 (Dev-A)
- `backend/analysis/` — Module A~E 분석 (Dev-C)
- `backend/api/` — FastAPI 엔드포인트 (Dev-A)
- `backend/schemas/` — API 응답 스키마
- `frontend/src/` — React 앱 (Dev-B)
- `docs/` — 기획·설계·결정 기록
- `docker-compose.yml` — PostgreSQL/PostGIS/Redis 기동

## 주요 명령어

```bash
docker-compose up -d                              # DB 기동
python -m backend.pipeline.init_db                # 스키마 생성
python -m backend.pipeline.collect_living_pop     # 생활인구 수집
python -m backend.pipeline.collect_store_info     # 점포 수집
python -m backend.pipeline.collect_commerce_sales # 매출 수집
python -m backend.pipeline.batch --type monthly   # 월간 배치 (cron 등록용)
python -m backend.pipeline.aggregate_od_flows     # od_flows 분기 집계 (UPSERT)
uvicorn backend.main:app --reload                 # API 서버
cd frontend && npm run dev                        # 프론트엔드
```

## Git 워크플로우

레포: `Ju-Rak-E/spiceMap` · 브랜치: `feature/<주차>-<담당>` or `docs/<주제>` → PR → `main`
커밋 타입: feat / fix / refactor / docs / test / chore

## 핵심 문서

- `docs/FR_Role_Workflow.md` — 기능/요구/5주 일정 포괄 spec
- `prompt_plan.md` — 5주 체크리스트
- `docs/strategy_d13.md` — D-13 수상 전략 + 실용성 강화 플랜
- `docs/hero_shot_scenario.md` — 3분 발표 4구간 시간축 + Hero shot 시연 동선 (단일 진실 문서)
- `docs/openrouteservice_key_note.md` — 흐름단절 실 도로 경로 ORS 키 운영 가이드
- `docs/schema.md` — DB 스키마 (commerce_analysis 5컬럼 확장 + policy_cards)
- `docs/od_flows_aggregation.md` — od_flows 분기 집계본 설계
- `docs/admin_boundary_gu_backfill.md` — gu_nm 백필 SQL + 검증
- `docs/week2_decisions.md` — Week 2 주요 의사결정
- `docs/README.md` — 전체 문서 인덱스

## 현재 주차

- **Week 2 (4/15~4/21)**: 완료.
- **Week 3 (4/22~4/28)**: 완료. API 5종, Module A/B/D/E, run_analysis 파이프라인, closure_rate spatial join, admin_boundary 백필, type-map gu 필터, Dev-B 상세패널·타임라인·자치구필터.
- **Week 4 (4/29~5/5)**: 완료. Module C·H1·H3·분류기 v1.1·프론트 Tier 1·B1/B3·검증 5카드·Hero shot 동선·H2/B1 코드+25 tests·`/api/insights/validation`·통합 검증·배포 인프라·발표 자료·흐름단절 실 도로 경로(`/api/barrier-routes` ORS+fallback, `useBarrierRoutes`, polyline 파티클).
- **Week 5 (5/6~5/12)**: 진행 중 (Day 1 / D-6). 사용자 잔여: H2/B1 실측 산출(scripts/run_validation_all)·OA-15576 CSV·Hero shot PNG 5종·시연 영상·Vercel 배포·`OPENROUTESERVICE_API_KEY` 등록 결정. backend pytest 266 / frontend vitest 323 / preflight 31/31 ALL PASS.
- **이월 블로커**: 원본 `od_flows`만 Dev-A 로컬 (집계본으로 우회). admin/commerce boundary 모두 Supabase 적재 완료.

## 원칙

- MVP 범위: 강남·관악 2개 자치구 (서울 전역 아님)
- 지표는 상대 순위 > 절대값 (GRI v1.0 4항목 재분배)
- 집계 데이터만 사용, 개인 이동 추적 없음
