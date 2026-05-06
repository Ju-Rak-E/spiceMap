# spiceMap

> **서울 상권 인구·소비 흐름 네트워크 시각화 정책 지원 플랫폼**
> 2026 서울시 빅데이터 활용 경진대회 (시각화 부문) 제출작
> 마감 2026-05-12 · MVP 범위 강남·관악 1,650 상권 → 분석 178 상권

[![tests](https://img.shields.io/badge/backend-248_pass-green)]() [![tests](https://img.shields.io/badge/frontend-196_pass-green)]() [![preflight](https://img.shields.io/badge/preflight-30%2F30-green)]()

---

## 한 줄 요약

> *"왜 이 상권이 침체됐는가 — 흐름으로 보는 서울 상권 위험 지도"*
>
> 기존 모델이 매출 안정으로 분류하는 강남 압구정·청담을 **흐름 단절 + GRI 결합**으로 위험 식별. 베이스라인 대비 231 개 추가 위험 상권 발굴.

## 핵심 차별화

| # | 기능 | 출처 |
|---|------|------|
| 1 | **흐름 기반 위험 탐지** — 기존 상태 스냅샷이 아닌 *왜 그 상태가 됐는가(흐름 단절)* 까지 | Module A·C |
| 2 | **자동 정책 카드** — 규칙 기반 (R4·R5·R6·R7) + 생성형 AI 미사용 명시 (FR-07) | Module D |
| 3 | **이중 베이스라인 검증** — 공식 OA-15576 (B1, J=0.58) + 단순 매출 추세 (B3, J=0.151) | `baseline_b1.py` + `baseline_comparison.py` |
| 4 | **Hero shot 4 클릭 시연** — `?hero=1` + 단축키 `1`~`4` → 페르소나(관악구 경제과) 가치 도달 | `App.tsx` + `hero_shot_scenario.md` v1.1 |

## 빠른 시작 (시연용)

### 1) 데모 모드 (백엔드 없이, 정적 mock)

```bash
git clone <repo-url>
cd spiceMap/frontend
npm install
npm run dev
# → http://localhost:5173/?hero=1  (단축키 1~4 사용)
```

`VITE_API_BASE_URL` 미설정 시 `mock_*.json` + `validation_results.json` fixture 로 모든 화면 동작.

### 2) 풀 스택 (DB + 백엔드)

```bash
# 1. 환경 변수
cp .env.example .env  # DB_PASSWORD 설정 (Supabase 팀 비밀번호)

# 2. 백엔드 + Redis
docker-compose up -d redis           # Redis 캐시
source .venv/bin/activate
uvicorn backend.main:app --reload    # http://localhost:8000

# 3. 프론트엔드 (별도 터미널)
cd frontend && npm run dev
```

## 아키텍처

```
공공 API 6종            적재 파이프라인        분석 모듈            FastAPI            React
                              ↓                    ↓                  ↓                  ↓
OA-22300 OD            collect_od_flows  ─→  Module A NetworkX  ─→  /api/od/flows  ─→  Map (Deck.gl)
OA-22160 admin SHP     load_spatial      ─→  Module B GRI       ─→  /api/gri/history → 상세 패널
OA-15560 commerce SHP  load_spatial      ─→  Module C 시계열 갭  ─→  /api/barriers   → 단절 레이어
OA-14991 생활인구      collect_living    ─→  Module D 정책 R4~R7 ─→  /api/insights/policy → R4 카드
OA-15577 점포정보      collect_store     ─→  Module E priority   ─→  /api/commerce/type-map → 노드 색상
OA-15572 추정매출      collect_sales     ─→  commerce_type v1.1  ─→  /api/export/csv → CSV
                                              H1·H2·H3·B1·B3    ─→  /api/insights/validation → 검증 5카드
```

상세: [`docs/data_integration_diagram.md`](docs/data_integration_diagram.md)

## 검증 결과

| ID | 가설/베이스라인 | 결과 | 임계 | 판정 |
|----|---------------|------|------|------|
| H1 | net_flow ↑ → sales ↑ | r=0.106 / p=2.83×10⁻⁵ / n=1,565 | r ≥ 0.5 | FAIL (방향성 지지) |
| H2 | barrier ↑ → closure ↑ | 함수 구현 완료 | r ≥ 0.3 | PENDING (실측 대기) |
| H3 | Q3 GRI top → Q4 closure ↑ | gap=0.746%p / p≈5×10⁻³⁶ | gap ≥ 2.0%p | FAIL (방향성 매우 강함) |
| B1 | OA-15576 vs priority | Jaccard 0.58 / 추가 식별 14 | J ≥ 0.5 | PASS |
| B3 | 매출 추세 vs priority | Jaccard 0.151 / 추가 위험 231 | 차별화 신호 | PASS |

자세한 한계 보고: [`docs/kpi_summary.md`](docs/kpi_summary.md) · [`docs/qa_briefing.md`](docs/qa_briefing.md)

## 발표 산출물

| 문서 | 설명 |
|------|------|
| [`docs/hero_shot_scenario.md`](docs/hero_shot_scenario.md) | 3 분 발표 단일 진실 문서 (4 구간 시간축 + 대사 풀 3 안 × 4 구간) |
| [`docs/kpi_summary.md`](docs/kpi_summary.md) | KPI / 검증 결과 표 1 장 |
| [`docs/qa_briefing.md`](docs/qa_briefing.md) | 13 개 예상 Q&A + 4 답변 원칙 |
| [`docs/data_integration_diagram.md`](docs/data_integration_diagram.md) | 데이터 결합 구조도 (Mermaid) |
| [`docs/policy_report_gangnam_apgujeong.md`](docs/policy_report_gangnam_apgujeong.md) | 강남 압구정 R4 정책 리포트 |
| [`docs/policy_report_gwanak_sillim.md`](docs/policy_report_gwanak_sillim.md) | 관악 신림 R4 흐름 단절 회복 |
| [`docs/csv_schema.md`](docs/csv_schema.md) | `/api/export/csv` 9 컬럼 스키마 |
| [`docs/verification_h2.md`](docs/verification_h2.md) | H2 분석 설계 |
| [`docs/strategy_d13.md`](docs/strategy_d13.md) | D-13 수상 전략 |
| [`docs/deployment_guide.md`](docs/deployment_guide.md) | 발표 배포 가이드 (Vercel 정적 + 풀 옵션) |
| [`docs/v2_backlog.md`](docs/v2_backlog.md) | 발표 후 v2 작업 30 항목 우선순위 |
| [`docs/api_openapi.json`](docs/api_openapi.json) | FastAPI 8 경로 정적 spec |

## 검증 (CI 시뮬레이션)

```bash
# Backend
source .venv/bin/activate && python -m pytest tests/        # 248 tests

# Frontend
cd frontend && npm test -- --run                            # 196 tests
cd frontend && npm run build                                # 2.0 MB / gzip 562 KB

# 시연 안전 점검 (오프라인 30 항목)
python -m scripts.preflight_check --mode files

# 가설+베이스라인 실측 산출 (DB 필요)
python -m scripts.run_validation_all --quarter 2025Q4 --previous 2025Q3 \
    --b1-csv data/baselines/seoul_change_index_2025Q4.csv
```

## 팀

| 역할 | GitHub |
|------|--------|
| Dev-A (백엔드 / 파이프라인) | — |
| Dev-B (프론트엔드) | — |
| Dev-C (데이터 분석) | [@pangvelop](https://github.com/pangvelop) |

## 변경 이력

[`CHANGELOG.md`](CHANGELOG.md) — Keep a Changelog 형식.

## 라이선스

본 프로젝트는 2026 서울시 빅데이터 활용 경진대회 제출작이며 발표 후 라이선스 별도 결정.
공공데이터(OA-* 데이터셋) 라이선스는 서울 열린데이터광장 / 공공데이터포털 정책을 따른다.

---

*개인 이동 추적 없음 — 모든 OD 데이터는 행정동/상권 단위 집계 (FR-12).*
