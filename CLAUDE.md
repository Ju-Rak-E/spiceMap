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

## 원칙

- MVP 범위: 강남·관악 2개 자치구 (서울 전역 아님)
- 지표는 상대 순위 > 절대값 (GRI v1.0 4항목 재분배)
- 집계 데이터만 사용, 개인 이동 추적 없음

## 상세 규칙

- 핵심 문서 인덱스 → `docs/rules/key-docs.md`
- 프로젝트 진행 상태 (주차/블로커/카운트/narrative) → `docs/rules/project-status.md`
