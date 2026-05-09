# spiceMap — 스파이스 흐름 지도

> **서울 상권 인구·소비 흐름 네트워크 시각화 정책 지원 플랫폼**
> 2026 서울시 빅데이터 활용 경진대회 (시각화 부문) 제출작
> 마감 2026-05-12 · MVP 범위 강남·관악 1,650 상권

[![backend](https://img.shields.io/badge/backend-266_pass-green)]()
[![frontend](https://img.shields.io/badge/frontend-323_pass-green)]()
[![preflight](https://img.shields.io/badge/preflight-31%2F31-green)]()
[![demo](https://img.shields.io/badge/demo-live-brightgreen)](https://spice-map.vercel.app)

---

## 라이브 데모

**[https://spice-map.vercel.app](https://spice-map.vercel.app)**

> `?hero=1` 파라미터로 접속하면 발표 시나리오 모드 진입. 키보드 `1`~`4`로 4구간 시연 가능.

---

## 한 줄 요약

> *"왜 이 상권이 침체됐는가 — 흐름으로 보는 서울 상권 위험 지도"*

기존 상권 분석이 **매출·폐업률 스냅샷**을 보여준다면,
스파이스 흐름 지도는 **왜 그 상태가 됐는가(흐름)** 를 보여준다.

---

## 기존 서비스 대비 차별점

| 기존 상권분석 서비스 | 스파이스 흐름 지도 |
|---|---|
| 매출·폐업률 스냅샷 제공 | 인구 이동 흐름 기반 **원인** 분석 |
| 단일 지표 조회 | OD + 생활인구 + 매출 **복합** 분석 |
| 수동 보고서 작성 | 규칙 기반 정책 추천 카드 **자동** 생성 |
| 사후 대응 지원 | 흐름 단절 구간 **조기 탐지** |
| 상권변화지표(B1) 단독 사용 | 네트워크 중심성 + GRI 복합 진단 → **187개 추가 위험 상권** 발굴 |
| 결과만 제공 | H1·H2·H3·B1·B3 통계 검증 결과 **투명 공개** |

---

## 핵심 강점

### 1. 흐름 기반 위험 탐지 (Module A·C)
매출이 안정적으로 보여도 **순유입이 감소하고 OD 네트워크 단절이 발생한 상권**을 사전에 포착한다.
강남 압구정·청담처럼 기존 모델이 "안전"으로 분류하는 상권에서도 흐름 신호로 침체 징후를 식별.

### 2. 젠트리피케이션 위험지수 GRI (Module B)
순유입 증가율·임대료·프랜차이즈 비중·매출 급증률을 결합한 0~100 복합 지수.
**Q3 GRI 상위 20% 상권의 Q4 폐업률이 하위 80%의 14.5배** (p ≈ 5×10⁻³⁶) — 선제 개입의 통계적 근거.

### 3. 자동 정책 추천 카드 (Module D)
규칙 기반 엔진(R4·R5·R6·R7)으로 상권 유형별 정책을 자동 매칭.
**생성형 AI 미사용** — 환각 없음, 수치 근거 명시, 즉시 결재 라인 제출 가능한 CSV 출력.

### 4. 실 도로 경로 기반 흐름 단절 시각화 (ORS + fallback)
단순 직선이 아닌 **OpenRouteService 실 도로 경로**로 단절 구간을 표시.
API 장애 시 자동 fallback + 정적 캐시 재생 모드 지원.

### 5. 이중 베이스라인 검증으로 차별화 정량 입증
- **B1**: 서울시 공식 OA-15576 상권변화지표 대비 → **187개 추가 위험 상권 식별** (공식 지표 미포착)
- **B3**: 기존 매출 추세 모델 대비 Jaccard 0.151 → 본질적으로 **다른 신호**를 포착함을 증명

---

## 검증 결과 (2025Q4 실측, 2026-05-09)

| ID | 가설 / 베이스라인 | 실측 결과 | 판정 |
|----|----------------|---------|------|
| H1 | 순유입↑ → 매출↑ | r=0.106, p=2.83×10⁻⁵, n=1,565 | 방향성 통계 유의 |
| H2 | 흐름 단절↑ → 폐업↑ | Spearman r=−0.812, p<0.001, n=39 | 방향 역전 (hub 상권 selection bias) |
| H3 | Q3 GRI 상위 20% → Q4 폐업↑ | gap=0.746%p, **14.5배 차이**, p≈5×10⁻³⁶ | 방향성 매우 강함 |
| B1 | OA-15576 공식 지표 대비 | Jaccard 0.157, **187개 추가 식별** | 보완 신호 입증 |
| B3 | 기존 매출 추세 모델 대비 | Jaccard 0.151, **231개 추가 위험** | 차별화 신호 입증 |

---

## 빠른 시작

### 라이브 데모 (설치 불필요)

```
https://spice-map.vercel.app/?hero=1
```

| 단축키 | 동작 |
|--------|------|
| `1` | 인트로 — 강남·관악 색대비 + InsightStrip |
| `2` | 신림 골목상권 상세 패널 + R4 정책 카드 |
| `3` | CSV 다운로드 toast |
| `4` | 검증 보고 — H1·H2·H3·B1·B3 5카드 |

### 로컬 데모 모드 (mock 데이터, 백엔드 불필요)

```bash
git clone https://github.com/Ju-Rak-E/spiceMap.git
cd spiceMap/frontend
npm install
npm run dev
# → http://localhost:5173/?hero=1
```

`VITE_API_BASE_URL` 미설정 시 `mock_*.json` + `validation_results.json` fixture로 전체 화면 동작.

### 풀 스택 로컬 실행 (Supabase DB 연결)

```bash
# 환경 변수 설정
cp .env.example .env   # DB_HOST, DB_PASSWORD 입력

# Redis (캐시)
docker-compose up -d redis

# 백엔드
pip install -r requirements.txt
uvicorn backend.main:app --reload   # http://localhost:8000

# 프론트엔드 (별도 터미널)
cd frontend && npm run dev
```

---

## 아키텍처

```
공공 API 6종            적재 파이프라인        분석 모듈            FastAPI            React
      ↓                      ↓                    ↓                  ↓                  ↓
OA-22300 OD            collect_od_flows  → Module A NetworkX  → /api/od/flows    → Map (Deck.gl)
OA-22160 admin SHP     load_spatial      → Module B GRI       → /api/gri/history → 상세 패널
OA-15560 commerce SHP  load_spatial      → Module C 시계열 갭  → /api/barriers    → 단절 레이어
OA-14991 생활인구      collect_living    → Module D 정책 R4~R7 → /api/insights/policy → R4 카드
OA-15577 점포정보      collect_store     → Module E priority   → /api/commerce/type-map → 노드 색상
OA-15572 추정매출      collect_sales     → commerce_type v1.1  → /api/export/csv  → CSV
                                          H1·H2·H3·B1·B3     → /api/insights/validation → 검증 5카드
```

**인프라**: FastAPI → Railway / React+Vite → Vercel / PostgreSQL+PostGIS+Redis → Supabase

---

## 디렉토리

```
spiceMap/
├── backend/
│   ├── api/        FastAPI 엔드포인트 8종
│   ├── pipeline/   공공데이터 수집·적재 스크립트
│   └── analysis/   Module A~E + H1/H2/H3/B1/B3 검증
├── frontend/src/
│   ├── components/ Map, DetailPanel, PolicyCard, ValidationView 등
│   ├── hooks/      useCommerceData, useBarrierRoutes 등
│   └── data/       validation_results.json (실측 수치)
├── scripts/        run_validation_all.py, preflight_check.py
├── tests/          pytest 266 / vitest 323
└── docs/           기획·설계·발표 자료
```

---

## 검증 실행

```bash
# 백엔드 테스트
python -m pytest tests/                          # 266 tests

# 프론트엔드 테스트
cd frontend && npm test -- --run                 # 323 tests

# 시연 안전 점검 (오프라인 31항목)
python -m scripts.preflight_check --mode files

# 가설+베이스라인 실측 산출 (DB 필요)
python -m scripts.run_validation_all \
    --quarter 2025Q4 --previous 2025Q3 \
    --b1-csv data/baselines/seoul_change_index_2025Q4.csv \
    --out data/baselines/validation_2025Q4.json
```

---

## 팀

| 역할 | 담당 |
|------|------|
| Dev-A (백엔드 / 파이프라인) | 데이터 수집·적재, FastAPI, 배포 인프라 |
| Dev-B (프론트엔드) | React + MapLibre + Deck.gl, UI/UX |
| Dev-C (데이터 분석) | Module A~E, 검증 KPI, 정책 추천 엔진 |

---

## 주요 문서

| 문서 | 설명 |
|------|------|
| [`docs/hero_shot_scenario.md`](docs/hero_shot_scenario.md) | 3분 발표 시나리오 (4구간 시간축 + 대사 풀) |
| [`docs/FR_Role_Workflow.md`](docs/FR_Role_Workflow.md) | 기능·요구 명세 + 5주 개발 계획 전체 |
| [`docs/strategy_d13.md`](docs/strategy_d13.md) | D-13 수상 전략 |
| [`docs/schema.md`](docs/schema.md) | DB 스키마 |

---

## 원칙

- MVP 범위: 강남·관악 2개 자치구 (서울 전역 아님)
- 집계 데이터만 사용 — **개인 이동 추적 없음** (행정동·상권 단위 집계)
- 정책 추천은 규칙 기반 — **생성형 AI 미사용**, 환각 없음
- 지표는 상대 순위 > 절대값 (자치구 내 백분위 병행)

---

*2026 서울시 빅데이터 활용 경진대회 제출작 · 공공데이터 라이선스: 서울 열린데이터광장 / 공공데이터포털 정책 준수*
