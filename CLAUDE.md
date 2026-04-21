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
uvicorn backend.main:app --reload                 # API 서버
cd frontend && npm run dev                        # 프론트엔드
```

## Git 워크플로우

레포: `Ju-Rak-E/spiceMap` · 브랜치: `feature/<주차>-<담당>` or `docs/<주제>` → PR → `main`
커밋 타입: feat / fix / refactor / docs / test / chore

## 핵심 문서

- `docs/FR_Role_Workflow.md` — 기능/요구/5주 일정 포괄 spec
- `prompt_plan.md` — 5주 체크리스트
- `docs/schema.md` — DB 스키마
- `docs/week2_decisions.md` — 주요 의사결정
- `docs/README.md` — 전체 문서 인덱스

## 현재 주차

- **Week 2 (4/15~4/21)**: 마감일. Module A·B·C 착수.
- **이월 블로커**: `od_flows`, `admin_boundary`, `commerce_boundary` 미적재 (Dev-A 대응 중)
- **Week 3 (4/22~4/28)**: API 연동 + 상세 패널 + Module D·E + H1 검증

## 원칙

- MVP 범위: 강남·관악 2개 자치구 (서울 전역 아님)
- 지표는 상대 순위 > 절대값 (GRI v1.0 4항목 재분배)
- 집계 데이터만 사용, 개인 이동 추적 없음
