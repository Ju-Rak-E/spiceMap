# spiceMap 수상 전략 + 실용성 강화 플랜 (D-13)

> **마감**: 2026-05-12 · **작성일**: 2026-04-29 · **남은 일수**: 13일
> **대회**: 2026 서울시 빅데이터 활용 경진대회 (시각화 부문)
> **작성자**: Dev-C (김광오)
> **출처 진단**: 프론트 화면 분석(localhost:5173) + 코드베이스 탐색 + 기획 문서 + Plan agent 종합

---

## TL;DR

현재 화면이 "실용성 없어 보이는" 이유는 **데이터 미적재 + 스토리 부재** 두 갈래.
- 1,650 상권 중 **1,472개가 회색 default 점** (`commerce_analysis` 178행만 부분 적재, `run_analysis.py` 미실행)
- 핵심 차별화인 **정책 추천 카드는 0건** (`policy_cards` 미적재)
- 헤더·온보딩 부재로 **첫 방문자가 도구 목적을 모름**
- **H1~H3 검증 결과·B1 베이스라인 비교가 화면 어디에도 없음**

**전략**: 페르소나(관악구 경제과 담당자) 의사결정 동선을 **4클릭 안에 hero shot 도달**시키고, **검증 결과 + 베이스라인 우월성**을 화면에 직접 노출. 시계열 보강(2025Q3 추가 적재 4h)과 Module C 시계열 갭 알고리즘(6h)으로 차별화 강도 극대화.

---

## 1. 현재 진단

### 1-1. 화면 문제 (스크린샷 기반)

| # | 증상 | 빈도 | 근본 원인 |
|---|------|------|----------|
| 1 | 1,472개 상권이 회색 default ("안정형") | 89% | `commerce_type=NULL` fallback (`frontend/src/utils/commerce.ts:78–95`) |
| 2 | "데이터 부족", "유입 판단 보류", "준비중", "데이터 없음" 다수 | 5+곳 | `useGriHistory.ts:55`, `usePolicyInsights.ts:62` 등 |
| 3 | 헤더가 일반 제목 ("서울 상권 흐름 지도") | 100% | 가치 명제·페르소나 명시 부재 |
| 4 | 정책 추천 카드 미렌더링 | 100% | `policy_cards = 0` |
| 5 | 서울 전역 표시 (MVP는 강남·관악만) | 100% | 자동 줌·초기 viewport 미설정 |
| 6 | H1~H3 결과·베이스라인 비교 부재 | 100% | 검증 보고 영역 자체가 없음 |

### 1-2. 데이터 갭 (Supabase `clyqvncpcfyfljbqgdig`)

| 테이블 | 현재 | 필요 | 갭 |
|--------|------|------|----|
| `commerce_analysis` | 178/1,650 (priority NULL) | 1,500+ | **PR #21 머지 + run_analysis 실행** |
| `policy_cards` | 0 | 30+ | run_analysis 실행 결과로 자동 |
| `flow_barriers` | 0 | 50+ | Module C **시계열 갭 대체안** 필요 |
| `commerce_sales` | Q4만 (21,333) | Q3 + Q4 | **Q3 추가 적재 4h** |
| `od_flows_aggregated` | Q4만 (182,971) | Q3 + Q4 | Q3 추가 적재 (Dev-A 협의) |

---

## 2. 핵심 의사결정 (확정)

| # | 결정 | 근거 |
|---|------|------|
| A | **Module C 풀 구현 X → 시계열 갭 대체** | (Q3 OD vs Q4 OD) volume 감소율 ≥ 0.5인 Top-N을 `flow_barriers`로 적재. 6h vs 풀 구현 20h+. H2 검증 충분 |
| B | **2025Q3 추가 적재 GO (4h)** | trend_penalty + H2 + H3 + hero shot 4건이 Q3에 종속. 단일 병목 해소 |
| C | **B1 베이스라인 = 정적 다운로드** | OA-15576 상권변화지표 CSV → `data/baselines/seoul_change_index_2025Q3_Q4.csv`. 재사용 X, 1회성 |
| D | **Hero shot = 신림 골목상권** | "Q3→Q4 유입 -38%, 폐업률 +4.2%p, GRI 78". 자동 줌→패널→R4 카드→CSV. 30초 컷 |
| E | **페르소나 동선 4클릭 강제** | 진입→관악구 자동 줌→신림 펄싱→클릭→R4 펼침→CSV. 핵심 가치 4클릭 안 도달 |

**컷 (Won't)**: Module C 풀 구현, 분기 비교 풀 슬라이더, 색각 시뮬, 태블릿 반응형 정밀화, LLM 정책 설명, 서울 25개 자치구 확장.

---

## 3. 페르소나 + 가치 명제

- **페르소나**: 관악구 경제과 담당자 (`docs/FR_Role_Workflow.md:200–207`)
- **사용 시나리오**: 분기별 동향 파악 → 위험 상권 식별 → 정책 우선순위 → CSV/PDF 보고
- **가치 명제 (헤더 1줄)**: *"왜 이 상권이 침체됐는가 — 흐름으로 보는 서울 상권 위험 지도"*
- **차별화**: 기존 상권분석은 *상태(스냅샷)*만 보여주는데, 스파이스는 *왜 그 상태가 됐는가(흐름)*을 OD 네트워크로 규명 + 규칙 기반 정책 카드 자동 생성

---

## 4. 우선순위 매트릭스 (3축)

| 작업 | 즉시효과 | 검증 | 차별화 | 시간 | Tier |
|------|---------|------|------|------|------|
| **PR #21 머지 + run_analysis Q4 1차 실행** | ★★★ | ★★ | ★★ | 1h | T1 |
| **closure_rate spatial join 정밀화** | ★ | ★★★ | ★ | 3h | T1 |
| **분석 미보유 상권 흐리게 (opacity 0.15)** | ★★★ | — | ★ | 2h | T1 |
| **MVP 범위 강남·관악 lock + 자동 줌** | ★★ | ★ | ★ | 1h | T1 |
| **헤더 가치 명제 1줄** | ★★★ | — | ★★ | 1h | T1 |
| **2025Q3 OD+sales 적재** | ★ | ★★★ | ★★ | 4h | T2 |
| **trend_penalty 활성화 + run_analysis 재실행** | ★ | ★★ | ★ | 1h | T2 |
| **인사이트 스트립 (H1 r·정책카드 N·위험상권 N)** | ★★★ | ★★★ | ★★ | 4h | T2 |
| **온보딩 모달 (3-step 페르소나 가이드)** | ★★★ | — | ★★ | 4h | T2 |
| **상세 패널 빈 메시지 → 데이터 출처 명시** | ★★★ | — | ★ | 2h | T2 |
| **flow_barriers 시계열 갭** (Module C 대체) | ★★ | ★★★ | ★★★ | 6h | T3 |
| **H1 검증 패널 + 산점도** | ★ | ★★★ | ★★ | 3h | T3 |
| **H3 GRI→폐업 일치도 검증** | ★ | ★★★ | ★★ | 3h | T3 |
| **B1 OA-15576 비교표 정적 페이지** | ★ | ★★★ | ★★★ | 3h | T3 |
| **검증 보고 탭 신설** | ★★ | ★★★ | ★★★ | 4h | T3 |
| **Hero shot 시연 시나리오 + 영상 90초** | ★ | — | ★★★ | 6h | T4 |
| **PDF 정책 리포트 2종 (강남/관악)** | — | — | ★★ | 4h | T4 |
| **데이터 결합 구조도 1장** | — | ★ | ★★ | 2h | T4 |

---

## 5. 13일 마스터 일정

### Week 4 (4/29 ~ 5/5) — 데이터 + 검증 기반

| 일자 | 핵심 작업 |
|------|----------|
| **4/29 (D-13)** | PR #21 머지 → `run_analysis --quarter 2025Q4` Supabase 실행. MVP 범위 lock. 헤더 1줄 추가. |
| **4/30** | 2025Q3 OD+sales 적재 (4h). closure_rate spatial join 정밀화. run_analysis 재실행 (Q3 → Q4) → trend_penalty 활성. |
| **5/1** | H1 Pearson 재계산 (Q3+Q4) + InsightStrip 컴포넌트 신규. |
| **5/2** | flow_barriers 시계열 갭 알고리즘 + 적재. |
| **5/3** | 미보유 상권 opacity 0.15. 정책 카드 R4~R7 검증 + 30+건 보장. |
| **5/4** | H3 검증 (Q3 GRI 고위험 → Q4 폐업률 일치도). B1 OA-15576 다운로드 + Pearson 비교표. |
| **5/5** | **통합 게이트** — H1 r ≥ 0.5 / 정책카드 ≥ 30 / barriers ≥ 50 / Jaccard ≥ 0.5. 미통과 → Week 5 초반 재시도. |

### Week 5 (5/6 ~ 5/12) — UX + 발표 산출물

| 일자 | 핵심 작업 |
|------|----------|
| **5/6** | 온보딩 모달. 상세 패널 "데이터 부족" → 데이터 출처 + 표시 이유. |
| **5/7** | flow_barriers 점선 레이어 + 툴팁. 검증 보고 탭. |
| **5/8** | Hero shot "신림" 4클릭 동선 정밀화. CSV 내보내기 검증. |
| **5/9** | PDF 정책 리포트 2종 (강남 압구정 흡수형_과열, 관악 신림 방출형_침체). 데이터 결합 구조도. |
| **5/10** | 풀 리허설 1회. 평가축 4개 매핑 점검. |
| **5/11** | 풀 리허설 2회. 캐시 워밍. mock fallback 장애 대비. |
| **5/12** | 제출. |

---

## 6. 핵심 변경 파일

### 백엔드

| 변경 | 파일 | 함수/지점 |
|------|------|----------|
| closure_rate spatial join | `backend/pipeline/run_analysis.py` | `_load_closures_by_comm()` (휴리스틱 → admin_boundary ST_Contains) |
| trend_penalty 활성 | `backend/analysis/module_e_priority.py` | `compute_priority_scores(previous_quarter="2025Q3")` (이미 구현됨) |
| flow_barriers 시계열 갭 | `backend/analysis/module_c_barriers.py` (신규) | `compute_flow_gaps(od_q3, od_q4)` |
| H1/H3 검증 실데이터 | `backend/analysis/verification_h1.py` (기존) + `verification_h3.py` (신규) | Supabase 직접 실행 |

### 프론트엔드

| 변경 | 파일 | 신규/수정 |
|------|------|----------|
| 헤더 가치 명제 | `frontend/src/App.tsx` | 수정 (1줄 추가) |
| 분석 미보유 상권 흐리게 | `frontend/src/utils/commerce.ts:78–95`, `frontend/src/layers/CommerceNodeLayer.ts` | 수정 |
| 인사이트 스트립 | `frontend/src/components/InsightStrip.tsx` | 신규 |
| 온보딩 모달 | `frontend/src/components/OnboardingModal.tsx` | 신규 (localStorage 1회) |
| 상세 패널 빈 메시지 교체 | `frontend/src/components/CommerceDetailPanel.tsx` | 수정 |
| 검증 보고 탭 | `frontend/src/pages/Validation.tsx` | 신규 (Recharts) |
| 자치구 자동 줌 | `frontend/src/components/Map.tsx` | 수정 (initial viewport) |

### 데이터 (Supabase)

| 작업 | 대상 | 방법 |
|------|------|------|
| `commerce_sales` 2025Q3 | 21,520행 | `/tmp/commerce_sales_dump.json` 활용 (이미 fetch됨) |
| `od_flows_aggregated` 2025Q3 | TBD | Dev-A 로컬 원본에서 collect_od_flows 재실행 협의 |
| `commerce_analysis` 1,500+ | UPSERT | `run_analysis.py` |
| `policy_cards` 30+ | INSERT | `run_analysis.py` |
| `flow_barriers` 50+ | INSERT | `module_c_barriers.py` |

---

## 7. 발표 3분 시연 + 평가축 매핑

| 구간 | 화면 | 평가축 |
|------|------|--------|
| 0:00~0:30 | 헤더 가치 명제 + 인사이트 스트립 (H1 r=0.62, 정책카드 32건, 위험상권 14건) | **창의성** |
| 0:30~1:30 | Hero shot — 신림 (Q3→Q4 유입 -38%, 폐업 +4.2%p, GRI 78) | **데이터 활용도·실용성** |
| 1:30~2:15 | 정책카드 R4 (젠트리피케이션 예방 + 임대료 가이드라인) → CSV 다운로드 | **정책 활용 가능성** |
| 2:15~3:00 | 검증 보고 탭 — H1 r=0.62, B1 대비 Jaccard 0.58 (B1 미포착 14건 추가 식별) | **분석 신뢰성** |

---

## 8. 검증 KPI (성공 정의)

### 화면 (사용자 수용 테스트)
- [ ] 첫 방문자 30초 내 도구 목적 답할 수 있다
- [ ] 회색 default 상권 비율 ≤ 5% (이전 89%)
- [ ] "데이터 없음", "준비중" 메시지 0건
- [ ] 강남·관악 자동 줌 정상 작동
- [ ] 신림 hero shot 4클릭 안 도달

### 데이터 + 정량 KPI
- [ ] `commerce_analysis` ≥ 1,500/1,650 (≥ 90%)
- [ ] `policy_cards` ≥ 30건
- [ ] `flow_barriers` ≥ 50건
- [ ] H1 Pearson r ≥ 0.5, p < 0.05
- [ ] H3 GRI 상위 20% 의 Q4 폐업률이 하위 80% 대비 +2%p 이상
- [ ] B1 대비 Jaccard ≥ 0.5

### 회귀
- [ ] 145 + N 신규 tests 통과
- [ ] `run_analysis` Supabase 실행 시간 ≤ 5분

### End-to-end 명령어

```bash
# 1. 분기 분석 실행 (Supabase 대상)
DB_URL=<supabase> python -m backend.pipeline.run_analysis --quarter 2025Q4 --previous 2025Q3

# 2. flow_barriers 시계열 갭
python -m backend.analysis.module_c_barriers --quarter 2025Q4 --baseline 2025Q3

# 3. H1 검증
python -m backend.analysis.verification_h1 --quarter 2025Q4

# 4. 프론트 회귀
cd frontend && npm test && npm run build

# 5. 백엔드 풀 테스트
pytest -q
```

---

## 9. 리스크 + 완화

| 리스크 | 임팩트 | 완화 |
|--------|--------|------|
| Q3 OD 적재 4h 초과 | 검증 3종 차단 | 최악의 경우 Q3 sales만 적재 → trend_penalty만 활성 (H2/H3 약화) |
| 시계열 갭 알고리즘이 의미 있는 패턴 안 만듬 | H2 검증 약화 | 임계값(0.5) 조정 + 강남·관악만 좁혀서 Top-N 보장 |
| Dev-A/B 진척 불명 | 통합 지연 | 5/5 통합 게이트 명확화 + Dev-C 단독 항목 우선 |
| B1 OA-15576 형식 불일치 | 비교표 불가 | 5/4 시점 사전 검증 + 형식 변환 시간 1h 버퍼 |
| 시연 영상 녹화 실패 | 발표 약화 | 5/8 1차 + 5/10 보강 |

---

## 10. 역할 분담

### Dev-C 단독 가능
- 백엔드: `run_analysis` 정밀화, `module_c_barriers`, `verification_h1/h3`
- 데이터: Q3 적재, `run_analysis` 재실행
- 프론트: 헤더 1줄, `InsightStrip`, `OnboardingModal`, 검증 보고 탭, 자치구 자동 줌
- 산출물: PDF 리포트, 데이터 결합 구조도, KPI 표

### Dev-B 의존
- 분석 미보유 상권 스타일 토큰
- `flow_barriers` 점선 레이어 + 툴팁
- 펄싱 애니메이션 (선택, Dev-C 직접 가능)

### Dev-A 의존
- `od_flows_aggregated` Q3 적재 (로컬 원본 보유)
- 시연 서버 배포

---

## 11. 즉시 액션 (오늘 4/29)

1. **PR #21 머지** (1분)
2. **run_analysis Q4 1차 실행 (Supabase)** (15분) → `commerce_analysis` 1,650 + `policy_cards` N
3. **MVP 범위 lock + 헤더 1줄 + 미보유 상권 흐리게** (3h, Dev-C 단독)
4. **closure_rate spatial join 정밀화** (3h, Dev-C 단독)
5. **2025Q3 데이터 적재 시작** (Q3 sales 21,520행 → /tmp dump 보유, OD는 Dev-A 협의)

이 5건이 오늘 끝나면 내일부터 검증 + UX + 시계열 갭 작업이 모두 unblock.

---

## 부록 A. 진단 출처

- **프론트엔드 탐색**: `frontend/src/App.tsx`, `Map.tsx`, `CommerceDetailPanel.tsx`, `FlowControlPanel.tsx`, 4개 데이터 훅, mock JSON 4종, `tokens.ts` 색상, placeholder 메시지 위치 7곳 매핑
- **기획 문서 탐색**: `docs/FR_Role_Workflow.md` 페르소나(L200–207)·차별화(L17–32)·KPI(L297–301)·베이스라인(L303–307)·시연(L475–501), Module D R1~R8, Module E 0.60/0.25/0.15 가중치
- **데이터/API 갭 분석**: `commerce_analysis` 178행 부분 적재 원인, `policy_cards` 0행 → `/api/insights/policy` 빈 응답, OD 요약 수치 출처, 회색 점 1,472개 = (1,650 − 178)
- **전략 설계**: Module C 시계열 갭 대체안, Q3 적재 가성비, B1 정적 다운로드 방안, hero shot 신림 케이스, 4클릭 동선

---

> 갱신 시 이 파일을 직접 편집. 13일 일정의 변경은 git history로 추적.
