# 공모전 제출 양식 사실 카드 (D-1, 2026-05-11)

> 2026 서울시 빅데이터 활용 경진대회 (시각화 부문) 제출 양식의 필수·가점 3개 항목을 **Supabase 코드 + 백엔드 소스 직접 인용**으로 정리한 사실 모음.
> 발표 작성자가 슬라이드/PDF/제출 양식에 **그대로 복사**할 수 있도록 카드 형식으로 정리.
> 출처: `backend/pipeline/seoul_client.py:14` · `backend/models.py` · `backend/api/advisor.py` · `backend/analysis/` · `data/baselines/validation_2025Q4.json`.

---

## 1. 공공데이터 데이터셋명 제출용 정리

`backend/pipeline/seoul_client.py:14` `BASE_URL = "http://openapi.seoul.go.kr:8088"` 호출 = **서울 열린데이터광장 OpenAPI**.

> 제출 양식이 `서울 열린데이터광장 - 데이터셋 명`, `공공데이터포털 - 데이터셋 명`으로 분리되어 있으면 아래 두 블록을 그대로 입력한다.  
> 기존 메모의 `OA-15577 / 점포-자치구`는 공식 데이터셋 기준으로 정정 필요: 현재 수집 코드의 `VwsmSignguStorW`는 **OA-22173 서울시 상권분석서비스(점포-자치구)** 이다. `OA-15577`은 별도 데이터셋인 **서울시 상권분석서비스(점포-상권)** 명칭에 해당한다.

### 제출 양식 입력값

**서울 열린데이터광장 - 데이터셋 명**

```text
행정동 단위 서울 생활인구(내국인)
서울시 상권분석서비스(점포-자치구)
서울시 상권분석서비스(추정매출-상권)
서울시 상권분석서비스(상권변화지표-상권)
서울시 상권분석서비스(영역-상권)
서울시 상권분석서비스(영역-행정동)
```

**공공데이터포털 - 데이터셋 명**

```text
서울특별시_수도권 생활이동 (출발_도착지 기준)
```

### 내부 근거표

| 출처 | 코드/포털 ID | 데이터셋 정식명칭 | 서비스 ID/비고 | 적재 코드·용도 | Supabase 테이블 |
|------|-------------|------------------|----------------|---------------|----------------|
| 서울 열린데이터광장 | **OA-14991** | 행정동 단위 서울 생활인구(내국인) | `SPOP_LOCAL_RESD_DONG` | `backend/pipeline/collect_living_pop.py:2` | `living_population` |
| 서울 열린데이터광장 | **OA-22173** | 서울시 상권분석서비스(점포-자치구) | `VwsmSignguStorW` | `backend/pipeline/collect_store_info.py:2` | `store_info` |
| 서울 열린데이터광장 | **OA-15572** | 서울시 상권분석서비스(추정매출-상권) | `VwsmTrdarSelngQq` | `backend/pipeline/collect_commerce_sales.py:2` | `commerce_sales` |
| 서울 열린데이터광장 | **OA-15576** | 서울시 상권분석서비스(상권변화지표-상권) | B1 정적 CSV | `backend/analysis/baseline_b1.py:1` + `data/baselines/seoul_change_index_2025Q4.csv` | 적재 없음 |
| 서울 열린데이터광장 | **OA-15560** | 서울시 상권분석서비스(영역-상권) | SHP/공간 결합 | `backend/pipeline/load_spatial.py` | `commerce_boundary` |
| 서울 열린데이터광장 | **OA-22160** | 서울시 상권분석서비스(영역-행정동) | SHP/공간 결합 | `backend/pipeline/load_spatial.py` | `admin_boundary` |
| 공공데이터포털 | **15145618** | 서울특별시_수도권 생활이동 (출발_도착지 기준) | 원천 URL `OA-22300` | `backend/pipeline/collect_od_flows.py:14`, `backend/pipeline/download_od_files.py` | `od_flows`, `od_flows_aggregated` |

※ 공공데이터포털의 파일데이터명에는 갱신일 suffix가 붙어 `서울특별시_수도권 생활이동 (출발_도착지 기준)_20250726`처럼 표시될 수 있다. 제출 양식의 "데이터셋 명" 칸에는 일반 제목인 `서울특별시_수도권 생활이동 (출발_도착지 기준)`을 입력한다.

### 제출 양식 "데이터셋명" 칸 복사용

> **서울 열린데이터광장**: 행정동 단위 서울 생활인구(내국인), 서울시 상권분석서비스(점포-자치구), 서울시 상권분석서비스(추정매출-상권), 서울시 상권분석서비스(상권변화지표-상권), 서울시 상권분석서비스(영역-상권), 서울시 상권분석서비스(영역-행정동)
>
> **공공데이터포털**: 서울특별시_수도권 생활이동 (출발_도착지 기준)

---

## 2. AI 기술 활용 내역 (필수) — 3계층 종합

### 2-1. 생성형 AI — Anthropic Claude API

| 항목 | 값 | 코드 위치 |
|------|-----|----------|
| 모델 | **`claude-haiku-4-5-20251001`** | `backend/api/advisor.py:164` |
| 라이브러리 | `anthropic` ≥ 0.30.0 | `requirements-api.txt` |
| 호출 함수 | `_call_claude(industry_nm, scored)` | `backend/api/advisor.py:153-181` |
| 시스템 프롬프트 | "당신은 서울시 상권 데이터를 분석하는 창업 컨설턴트입니다. 요청받은 JSON 형식으로만 응답합니다." | `advisor.py:166` |
| 입력 | 추천/주의/비추천 3-tier × 상권 9개의 GRI · 유동인구 · 폐업률 (`_build_llm_context`) | `advisor.py:122-150` |
| 출력 JSON | `{summary, reasons[{comm_cd, reason}], caution}` | `advisor.py:176-178` |
| 비즈니스 가치 | **AI Startup Advisor** — 창업 입지 추천에 자연어 해설 부가 | `/api/advisor/startup` endpoint |
| 회피 전략 | API 키 없거나 호출 실패 → `("", "", {})` 반환 + `model_used="none"` | `advisor.py:158-181, 279` |
| 환경변수 | `ANTHROPIC_API_KEY` (pydantic-settings) | `backend/config.py` |

### 2-2. 그래프 네트워크 분석 — NetworkX

| 항목 | 값 | 코드 위치 |
|------|-----|----------|
| 라이브러리 | `networkx` ≥ 3.2, < 4 | `import networkx as nx` — `backend/analysis/module_a_graph.py:13` |
| 그래프 구조 | `DiGraph` (유향 그래프). 노드 = 상권, 엣지 = 행정동 OD 이동량을 면적비율로 배분 | `build_commerce_flow_graph()` `module_a_graph.py:79` |
| 산출 지표 | `in_degree`, `out_degree`, `net_flow`, `degree_centrality` (0~1) | `compute_degree_metrics()` `module_a_graph.py:128` |
| 활용처 | Module B GRI v1.0의 "순유출"·"고립도" 입력 (가중치 0.33 + 0.27) | `module_b_gri.py:40-81` |

### 2-3. 통계 검증 — scipy

| 검정 기법 | scipy 함수 | 사용처 | 결과 (2025Q4 D-2, `validation_2025Q4.json`) |
|---------|-----------|--------|-------------------------------------------|
| Pearson 상관 | `stats.pearsonr` | `verification_h1.py:58` — H1 순유입 vs 매출 | r=**0.106** / p=2.82×10⁻⁵ / n=1,565 (통계 유의, 효과 약함) |
| Pearson 상관 | `stats.pearsonr` | `verification_h2.py:115` — H2 흐름단절 vs 폐업 | r=**-0.558** / p=2.2×10⁻⁴ / n=39 (방향 반대, 표본 한계) |
| Welch t-test | `stats.ttest_ind` | `verification_h3.py:81` — H3 Q3 GRI 상위 vs 하위 Q4 폐업 | gap=**1.009%p** / t=12.76 / p=8.0×10⁻³¹ / n_top=330·n_bottom=1,320 (**14.5배** 격차) |
| z-score 정규화 | `stats.zscore` | `module_b_gri.py:37` (`_safe_zscore`) | GRI v1.0 가중합 입력 |
| Percentile rank | `stats.rankdata` | `module_b_gri.py`, `module_e_priority.py` | GRI/priority_score 0~100 변환 |
| Spearman 순위상관 | `stats.spearmanr` | `baseline_comparison.py` | H2 단조성·B3 비교 |

### 2-4. 정직성 라벨 (FR-07 준수)

- 정책 카드 R4~R7은 **규칙 기반 생성** (`generation_mode="rule_based"`, `backend/analysis/module_d_policy.py`).
- 생성형 AI(Claude)는 **Startup Advisor의 자연어 해설에만** 사용 (정책 카드 본문에는 미사용).

### 제출 양식 "AI 기술" 칸 복사용

> spiceMap은 3계층 AI 기술을 활용한다. ① **생성형 AI**: Anthropic Claude Haiku 4.5(`claude-haiku-4-5-20251001`)로 창업 입지 3-tier 추천에 자연어 해설 JSON을 생성한다(`backend/api/advisor.py:164`). ② **그래프 네트워크 분석**: NetworkX 유향 그래프로 상권 OD 이동 네트워크의 `degree_centrality`·`net_flow`를 계산한다(`backend/analysis/module_a_graph.py:13,79,128`). ③ **통계 검증**: scipy로 Pearson 상관(H1 r=0.106 p=2.8×10⁻⁵), Welch t-test(H3 gap 1.009%p p=8×10⁻³¹ 14.5배 격차), z-score 정규화로 가설 3건을 정량 검증했다. 정책 카드 본문은 생성형 AI 없이 규칙 기반(FR-07) 생성하여 신뢰성을 확보했다.

---

## 3. 서로 다른 분야 데이터 결합 (가점 2점) — 핵심 3건 + 기반 2건

### 3-1. 핵심 결합 ① — 교통/이동(OD) × 상업/매출 (H1 검증)

| 항목 | 값 |
|------|-----|
| 데이터 A | `od_flows_aggregated` (분야: **교통/이동**, 원천 OA-22300 공공데이터포털) |
| 데이터 B | `commerce_sales` (분야: **상업/매출**, 원천 OA-15572 열린데이터광장) |
| 결합 키 | 상권 코드(`comm_cd`) — 행정동 OD 이동량을 면적비율(`comm_area_ratio`)로 상권에 배분 후 매출과 매칭 |
| 결합 방법 | Module A의 `net_flow`(상권별 순유입) ↔ `commerce_sales.salng_amt` **Pearson 상관** |
| 결과 | H1 검증 **r=0.106, p=2.82×10⁻⁵, n=1,565** — 통계 유의 |
| 코드 | `backend/analysis/verification_h1.py:58`, `module_a_graph.py:79,128` |

### 3-2. 핵심 결합 ② — 사업체(폐업) × 상업/매출 (closure_rate 가중평균 fix)

| 항목 | 값 |
|------|-----|
| 데이터 A | `store_info` (분야: **사업체/점포**, 자치구×업종 폐업률, 원천 OA-22173) |
| 데이터 B | `commerce_sales` (분야: **상업/매출**, 상권×업종 매출 비중, 원천 OA-15572) |
| 결합 키 | (`signgu_cd`, 업종 코드) ↔ (`comm_cd`, 업종 코드) — 자치구·업종 단위 |
| 결합 방법 | SQL CTE `gu_industry`에서 **자치구×업종 폐업률 × 상권×업종 매출 비중의 가중평균** |
| 결과 | 같은 자치구라도 업종 mix가 다르면 상권별 폐업률 분산 발생 → H3 gap **0.746%p → 1.009%p (+35%)** |
| 코드 | `backend/pipeline/run_analysis.py:378` `_closure_via_industry_weighted()` |

### 3-3. 핵심 결합 ③ — 다분야 통합 GRI v1.0 (3개 분야)

| 항목 | 값 |
|------|-----|
| 데이터 A | 폐업률 (**사업체 분야**) — `store_info` 가중평균 |
| 데이터 B | 순유출 (**교통/이동 분야**) — Module A `net_flow` (NetworkX 산출) |
| 데이터 C | 고립도 (**네트워크 분야**) — Module A `degree_centrality` 역수 |
| 결합 키 | 상권 코드(`comm_cd`) — 세 지표를 상권 단위 **z-score** 정규화 |
| 결합 방법 | 가중합 `0.40 × z(폐업률) + 0.33 × z(순유출) + 0.27 × z(고립도)` → **percentile rank 0~100** |
| 결과 | `gri_score` (젠트리피케이션·침체 위험도). H3 가설로 통계 검증 완료 |
| 코드 | `backend/analysis/module_b_gri.py:40` `compute_gri()` |

### 3-4. 모든 결합의 기반 — 공간 결합 2건

| 결합 케이스 | A 분야 | B 분야 | 결합 키 / 방법 | 코드 |
|-----------|-------|-------|--------------|------|
| 행정동 ↔ 상권 매핑 | 행정 경계 (`admin_boundary`, 행안부 SHP) | 상업 경계 (`commerce_boundary`, 열린데이터광장 SHP) | GeoPandas `gpd.overlay()` + **EPSG:5179 투영** → 폴리곤 교차 면적 → `adm_comm_mapping` (`comm_area_ratio`, `adm_area_ratio`) | `backend/analysis/spatial_join.py:54-93` `compute_mapping()` |
| OD → 상권 변환 | 교통 OD (행정동 단위) | 행정-상권 매핑 (`adm_comm_mapping`) | 행정동 OD 이동량 × `comm_area_ratio` 가중 배분 → 상권 단위 흐름 | `backend/analysis/module_a_graph.py:79` `build_commerce_flow_graph()` |

### 제출 양식 "데이터 결합" 칸 복사용

> spiceMap은 **교통/이동(OA-22300/공공데이터포털 수도권 생활이동)** · **상업/매출(OA-15572)** · **사업체/점포(OA-22173)** · **인구(OA-14991)** · **행정/상권 경계(OA-22160/OA-15560)** **5개 분야 데이터셋을 결합**한다. 핵심 결합 키는 행정동 코드(`adm_cd`) ↔ 상권 코드(`comm_cd`)이며, **GeoPandas `gpd.overlay()` 공간 결합(EPSG:5179)**으로 `adm_comm_mapping` 테이블을 생성해 모든 결합의 기반으로 활용한다. 가장 임팩트 있는 사례는 **자치구×업종 폐업률 × 상권×업종 매출 비중의 가중평균**으로 산출한 `closure_rate`인데, 이로써 H3 검증 격차가 0.746%p → 1.009%p (+35%, 14.5배)로 강화되었다(`backend/pipeline/run_analysis.py:378`).

---

## 4. 활용(계획)방안 및 기대효과

### 활용 방안

**① 자치구청 정책 담당자 — 상권 활성화 예산 배분**
강남구·관악구 등 자치구 경제진흥과의 분기별 예산 배분 및 골목상권 활성화 공모 심사에 활용한다. GRI 상위 20% 상권을 우선 지원 대상으로 자동 추출하고, PolicyCard(R4~R7)를 그대로 결재 문서로 전환하여 보고서 작성 시간을 단축한다. 자치구 내 백분위 순위로 공정 배분 근거를 확보할 수 있다.

**② 소상공인 지원기관 — 선제 폐업 모니터링**
서울신용보증재단·서울산업진흥원(SBA) 등의 보증·대출 심사 및 폐업 위험 사전 경보에 활용한다. 흐름 단절 신호가 잡힌 상권에 선제 컨설팅을 투입하고, 공식 상권변화지표(B1)가 놓친 **187개 상권**을 추가 관리 대상으로 편입한다.

**③ 예비 창업자·소상공인 — AI 창업 입지 의사결정**
AI Startup Advisor(`/api/advisor/startup`, Claude Haiku 4.5)를 통해 입력 업종에 대해 추천/주의/비추천 3-tier 상권과 자연어 해설을 제공한다. 점포 계약 전 입지 안전성 판단과 업종 전환 검토에 활용한다.

**④ 도시재생 전문가 — 흐름 단절 진단**
서울연구원·도시재생지원센터 등의 활성화 지역 지정 및 가로 환경 개선 사업에 활용한다. 실 도로 경로 기반 단절 시각화(ORS + fallback)로 물리적 가로 단절 위치를 식별하고, OD 네트워크 중심성 저하 상권을 재생 우선 후보로 선정한다.

### 기대 효과

**① 사전 개입 행정 전환 (핵심 수치 기반)**
GRI 상위 20% 상권의 다음 분기 폐업률이 하위 80%의 **14.5배** (gap=1.009%p, p=8×10⁻³¹, n=1,650). 폐업 발생 후 긴급 지원하는 사후 대응 모델에서 **3~6개월 선행 지표로 사전 개입하는 행정**으로 전환한다. 공식 지표가 탐지하지 못한 **187개 상권(B1) · 231개 상권(B3)** 의 정책 사각지대를 해소한다.

**② 의사결정 시간 단축**
수기 분석 보고서 작성(수일 소요) → PolicyCard 자동 생성 + CSV 즉시 다운로드(수 초)로 자치구 분기 보고 리드타임을 대폭 단축한다. 동일 시간에 더 많은 상권을 검토하여 정책 커버리지를 확대한다.

**③ 데이터 기반·투명한 행정**
모든 정책 카드에 수치 근거 명시(생성형 AI 미사용 → 환각 없음, FR-07 준수). 5장의 검증 카드(H1·H2·H3·B1·B3) 공개 및 H2 방향 역전 등 한계까지 정직하게 공개하는 데이터 거버넌스로 시민 신뢰도를 제고한다.

**④ 확장 가능성**
강남·관악 1,650 상권 → 서울 25개 자치구 → 광역시·전국 확장이 가능하다. 동일 파이프라인(서울 열린데이터광장 6종 + 공공데이터포털 1종)으로 추가 데이터 수집을 자동화하며, 자치구별 GRI 가중치 튜닝으로 지역 특성을 반영할 수 있다. 오픈소스(GitHub: Ju-Rak-E/spiceMap)로 후속 연구 재현 가능한 기준 모델로 제공한다.

### 제출 양식 "활용(계획)방안 및 기대효과" 칸 복사용

> **[활용 방안]**
> spiceMap은 4개 수요 주체를 대상으로 한다. ① **자치구청 정책 담당자**: GRI 상위 20% 상권 자동 추출 + PolicyCard(R4~R7) 즉시 결재 전환으로 분기 예산 배분 리드타임 단축. ② **소상공인 지원기관(신용보증재단·SBA)**: 흐름 단절 신호 기반 선제 컨설팅 투입 + 공식 지표 미탐지 187개 상권 추가 관리. ③ **예비 창업자**: AI Startup Advisor(Claude Haiku 4.5)로 입력 업종의 추천/주의/비추천 3-tier 입지 자연어 해설 제공. ④ **도시재생 전문가**: 실 도로 경로(ORS) 기반 흐름 단절 위치 시각화로 재생 우선 후보 선정.
>
> **[기대 효과]**
> H3 검증 결과(n=1,650, p=8×10⁻³¹) 기준 GRI 상위 20%의 폐업률이 하위 80%의 14.5배로, **사후 대응에서 3~6개월 선행 사전 개입 행정으로 전환**하는 정량 근거를 확보했다. PolicyCard 자동 생성으로 수기 보고서 대비 수일 → 수 초의 의사결정 단축, 공식 지표 대비 187~231개 추가 위험 상권 식별로 정책 사각지대를 해소한다. 생성형 AI 미사용 규칙 기반 정책 카드(FR-07)와 검증 결과 전면 공개로 신뢰 가능한 데이터 기반 행정을 실현하며, 동일 파이프라인으로 서울 25개 자치구 → 전국 확장이 가능하다.

---

## 5. 검증 출처 (재현 명령)

| 검증 항목 | 명령 | 결과 |
|---------|------|------|
| 열린데이터광장 endpoint | `grep -n "openapi.seoul.go.kr" backend/pipeline/seoul_client.py` | `BASE_URL = "http://openapi.seoul.go.kr:8088"` (line 14) |
| OA 코드 5종 | `grep -rEn "OA-(14991\|15577\|15572\|15576\|22300)" backend/` | 5건 모두 코드/models에서 발견 |
| Claude 모델 | `grep -n "claude-haiku" backend/api/advisor.py` | line 164 + 279 |
| NetworkX | `grep -n "import networkx" backend/analysis/module_a_graph.py` | line 13 |
| scipy 3종 | `grep -rEn "pearsonr\|ttest_ind\|zscore" backend/analysis/` | pearsonr(h1:58, h2:115), ttest_ind(h3:81), zscore(b_gri:37) |
| closure 가중평균 | `grep -n "_closure_via_industry_weighted" backend/pipeline/run_analysis.py` | 정의: line 378, 호출: line 365 |
| H3 gap 수치 | `cat data/baselines/validation_2025Q4.json` | `gap_pp: 1.0089579943403033`, `p_value: 7.99×10⁻³¹`, `n_top: 330, n_bottom: 1,320` |
| spatial_join | `head backend/analysis/spatial_join.py` | EPSG:5179 투영, gpd.overlay (line 79) |

모든 사실은 2026-05-11 검증으로 재확인됨.
