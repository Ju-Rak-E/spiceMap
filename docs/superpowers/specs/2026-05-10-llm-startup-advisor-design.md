# AI 창업 입지 분석 (Startup Advisor) 설계 문서

> 작성일: 2026-05-10
> 기능: 창업 희망 업종 입력 시 Claude API 기반 상권 추천/주의/비추천 분류 + 자연어 해설 제공
> 목적: 공모전 창업 부문 필수 조건(AI 기술 활용) 충족 + 정책 지원 플랫폼 → 창업 의사결정 지원 도구로 포지셔닝 전환

---

## 1. 개요

사용자가 창업하고 싶은 업종을 드롭다운으로 선택하면, 백엔드가 `store_info` + `commerce_analysis` 데이터를 통계적으로 분석해 상권을 추천/주의/비추천으로 분류하고, Claude API가 창업자 친화적인 한국어 해설을 생성한다. 결과는 지도 노드 색상 오버레이 + 우측 결과 패널로 동시 표시된다.

---

## 2. 신규 파일 목록

```
backend/
  api/advisor.py          ← 새 FastAPI 라우터
  schemas/advisor.py      ← Pydantic 요청/응답 스키마

frontend/src/
  hooks/useStartupAdvisor.ts       ← 어드바이저 상태 + API 호출 훅
  components/StartupAdvisorPanel.tsx  ← 우측 결과 패널 컴포넌트
```

**기존 파일 수정:**

| 파일 | 변경 내용 |
|------|---------|
| `backend/config.py` | `anthropic_api_key: str = ""` 필드 추가 |
| `backend/main.py` | advisor 라우터 등록 |
| `frontend/src/App.tsx` | advisorResults 상태 + 지도/패널 연결 |
| `frontend/src/components/FlowControlPanel.tsx` | AI 어드바이저 섹션 추가 (드롭다운 + 버튼) |
| `frontend/src/components/Map.tsx` | `advisorTiers` prop 추가 → 노드 색상 오버레이 |

---

## 3. 백엔드 API

### 3-1. `GET /api/advisor/industries`

```
Query params: quarter (default: "2025Q4")
Response: { industries: string[] }
```

`store_info` 테이블에서 해당 분기의 `DISTINCT industry_nm`을 가나다순 정렬해 반환한다. 프론트 드롭다운을 이 목록으로 채운다.

> **분기 코드 변환**: API 파라미터는 `"2025Q4"` 형식이나 `store_info.year_quarter`는 `"20254"` 형식을 사용한다. 내부에서 `_to_store_info_quarter()`로 자동 변환한다.

### 3-2. `POST /api/advisor/startup`

```
Body: { industry_nm: string, quarter: string, districts?: string[] }
Response: AdvisorResponse
```

**처리 순서:**

1. SQL로 상권별 지표를 한 번에 조회 (JOIN 3개):
   - `commerce_analysis` — 상권 단위 분기 지표 (GRI, 유동인구, 폐업률, 중심성)
   - `commerce_boundary` → `admin_boundary` — 상권이 속한 자치구명(`gu_nm`) 결정 (`ST_Contains` + `ST_PointOnSurface` 공간 조인)
   - `store_info` — 선택 업종의 자치구별 폐업률(`close_rate`)·점포 수(`store_count`) (LEFT JOIN, 없으면 NULL)
2. `districts` 파라미터가 있으면 `gu_nm` 기준 필터링
3. 어드바이저 점수 계산 (`_compute_advisor_scores`) → 4절 상세
4. 점수 내림차순 정렬 후 티어 분류 (`_assign_tiers`) → 5절 상세
5. tier별 상위 3개씩 선택 (`_select_top_per_tier`) → 추천 3 + 주의 3 + 비추천 3 = 총 9개
6. 9개 상권 지표를 Claude API 컨텍스트로 구성해 호출
7. LLM 응답(JSON)을 파싱해 `comm_cd` 기준으로 `llm_reason` 매핑 후 `AdvisorResponse` 반환

---

## 3-a. 분석 근거 및 판정 로직

### 입력 데이터 출처

| 지표 | 출처 테이블 | 컬럼 | 설명 |
|------|------------|------|------|
| 상권 위험도 | `commerce_analysis` | `gri_score` | 0~100, 높을수록 위험. 폐업률·유동인구·연결성을 종합한 GRI 지수 |
| 유동인구 | `commerce_analysis` | `flow_volume` | 해당 분기 상권 내 유동인구 합계 (OD 집계) |
| 상권 전체 폐업률 | `commerce_analysis` | `closure_rate` | 업종 무관 전체 폐업 비율 (%) |
| 네트워크 중심성 | `commerce_analysis` | `degree_centrality` | 상권 간 OD 흐름 네트워크에서의 연결 허브 정도 (0~1) |
| 업종별 폐업률 | `store_info` | `close_rate` | **선택한 업종** 기준 자치구 폐업률 (%). 없으면 `closure_rate`로 대체 |
| 업종 점포 수 | `store_info` | `store_count` | **선택한 업종** 기준 자치구 내 기존 점포 수 |

### 점수 계산식 (가중합, 최대 100점)

```
advisor_score =
  (100 - gri_score)              × 0.35   ① 위험도 역산
  + norm_flow                    × 0.25   ② 유동인구 (min-max 정규화)
  + (100 - close_rate × 10)      × 0.20   ③ 업종 폐업률 역산
  + store_market_fit             × 0.10   ④ 업종 점포 수 (역 U 커브)
  + degree_centrality × 100      × 0.10   ⑤ 네트워크 중심성
```

### 각 항목의 판단 근거

**① 상권 위험도 (GRI) — 가중치 0.35**
- GRI가 높다는 것은 폐업 압력·유동 감소·연결 약화가 복합적으로 나타난다는 뜻이다.
- 창업 후 단기 생존율과 가장 직접 연관된 지표이므로 가중치를 가장 높게 설정한다.
- `(100 - gri)` 변환으로 "위험 낮음 = 고점수" 방향으로 정렬한다.

**② 유동인구 — 가중치 0.25**
- 잠재 고객 수의 절대 규모를 나타낸다. 유동인구 없이는 매출 가능성이 없다.
- 상권 간 절대값 차이가 크므로 분기 내 min-max 정규화(0~100)로 스케일을 맞춘다.
- GRI 다음으로 중요한 입지 요소이나, 유동인구가 높아도 위험도가 높으면 GRI 항목에서 페널티를 받는다.

**③ 업종 폐업률 — 가중치 0.20**
- 선택한 업종 한정으로 해당 자치구에서 실제로 얼마나 폐업했는지를 반영한다.
- `store_info`에 해당 업종·분기 데이터가 없으면 상권 전체 폐업률(`closure_rate`)로 대체한다 (보수적 처리).
- 폐업률 1%p = 점수 10점 감점(`100 - rate × 10`)이며, 10% 이상이면 0점이 된다.

**④ 업종 점포 수 (역 U 커브) — 가중치 0.10**
- 점포가 적으면 → 시장이 검증되지 않은 미개척 상태 (리스크)
- 점포가 많으면 → 경쟁 포화 상태 (리스크)
- 중앙값 근처 = 수요가 검증됐고 아직 여지가 있는 시장으로 본다.
- 구현: `(1 - |store_count - median| / max_deviation) × 100` — 중앙값에서 멀수록 0에 수렴한다.

**⑤ 네트워크 중심성 — 가중치 0.10**
- OD 흐름 네트워크에서 허브 역할을 하는 상권은 다른 상권과 고객을 교환하는 동선상에 있다.
- 유입 흐름의 다양성을 간접적으로 나타내며, 단일 동선 의존 리스크가 낮다는 신호이다.
- 0~1 값을 × 100으로 스케일 맞춤.

### 티어 분류 (상대 순위)

점수 내림차순 전체 목록에서 위치 비율(`i / (n-1)`)로 분류한다.

| 구간 | 티어 |
|------|------|
| 0% ~ 30% 미만 | **추천** |
| 30% ~ 70% 미만 | **주의** |
| 70% ~ 100% | **비추천** |

> **주의**: 절대 기준이 아닌 상대 순위다. 서울 전역 분석 vs 특정 구 필터 시 동일 상권이 다른 티어로 분류될 수 있다.

### 반환 범위

`_select_top_per_tier(n=3)` 으로 tier별 상위 3개씩 선택한다.

- 추천 3개 + 주의 3개 + 비추천 3개 = **총 9개** 고정
- 각 tier 내부 순서는 `advisor_score` 내림차순
- 프론트엔드는 이 9개에 자치구 필터만 적용해 표시한다

---

## 4. Pydantic 스키마

```python
class StartupAdvisorRequest(BaseModel):
    industry_nm: str
    quarter: str = "2025Q4"

class RankedCommerce(BaseModel):
    comm_cd: str
    comm_nm: str
    gu_nm: str
    tier: Literal["추천", "주의", "비추천"]
    advisor_score: float
    gri_score: float | None
    flow_volume: int | None
    closure_rate: float | None
    llm_reason: str | None  # LLM 생성 이유 (어드바이저 점수 상위 5개에만 생성, 나머지 None)

class AdvisorResponse(BaseModel):
    industry_nm: str
    quarter: str
    summary: str        # LLM 전체 요약 (2~3문장)
    caution: str        # LLM 주의사항 (1문장)
    commerces: list[RankedCommerce]
    model_used: str     # "claude-haiku-4-5"
```

---

## 5. Claude API 프롬프트 설계

tier별 3개씩 선택한 9개 상권을 tier 구분 섹션으로 전달한다. LLM이 추천·주의·비추천 맥락을 구분해 이유를 생성할 수 있도록 섹션을 명시한다.

```
system:
  "당신은 서울시 상권 데이터를 분석하는 창업 컨설턴트입니다.
   요청받은 JSON 형식으로만 응답합니다."

user:
  {업종} 창업을 위한 서울 상권 분석 데이터입니다.

  [추천 상권]
  - [{comm_cd}] {comm_nm} ({gu_nm}): GRI {gri_score}, 유동인구 {flow_volume}, 폐업률 {closure_rate}%
  ...

  [주의 상권]
  - [{comm_cd}] {comm_nm} ({gu_nm}): GRI {gri_score}, 유동인구 {flow_volume}, 폐업률 {closure_rate}%
  ...

  [비추천 상권]
  - [{comm_cd}] {comm_nm} ({gu_nm}): GRI {gri_score}, 유동인구 {flow_volume}, 폐업률 {closure_rate}%
  ...

  다음 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요:
  {
    "summary": "전체 상황 2~3문장 요약",
    "reasons": [{"comm_cd": "상권코드", "reason": "추천/주의/비추천 이유 1~2문장"}],
    "caution": "가장 중요한 주의사항 1문장"
  }
```

**LLM 응답 파싱 주의사항:**
- Claude가 응답을 마크다운 코드블록(` ```json ``` `)으로 감싸는 경우가 있다.
- ` ``` ` 로 시작하면 블록 제거 후 `json.loads()` 한다.
- 파싱 실패 또는 API 키 미설정 시 `("", "", {})` 반환 → `summary=""`, `llm_reason=null`로 통계 결과만 전달.

모델: `claude-haiku-4-5-20251001` (빠른 응답, 저비용)
`ANTHROPIC_API_KEY` 환경변수로 주입, 미설정 시 LLM 해설 없이 통계 결과만 반환.

---

## 6. 프론트엔드 설계

### useStartupAdvisor 훅

```typescript
interface AdvisorState {
  industries: string[]           // 드롭다운 목록
  selectedIndustry: string | null
  isLoading: boolean
  result: AdvisorResponse | null
  error: string | null
}
// 제공 함수: loadIndustries(), analyze(industry, quarter)
```

### FlowControlPanel 변경

기존 패널 상단에 AI 어드바이저 섹션 추가:
- 업종 드롭다운 (`<select>`)
- [분석하기] 버튼
- `isLoading` 시 드롭다운 + 버튼 `disabled`, 버튼 텍스트 "분석 중..." + 스피너

### StartupAdvisorPanel 컴포넌트

`result !== null` 일 때 우측 패널 상단에 렌더링:
- LLM 요약 텍스트
- 주의사항 (주황 박스)
- 상권 랭킹 리스트 (티어 배지 + GRI/유동인구 수치)
- 항목 클릭 → `onSelectNode(comm_cd)` 호출 → 지도 이동 + 노드 강조
- [초기화] 버튼 → `result = null` → 지도 오버레이 해제

### Map 변경

```typescript
// 기존 노드 색상 로직에 advisorTier 오버라이드 추가
// advisorTiers: Map<comm_cd, "추천" | "주의" | "비추천"> | null
// null이면 기존 GRI 기반 색상 유지
```

---

## 7. 에러 처리

| 상황 | 처리 |
|------|------|
| DB에 해당 업종 없음 | 422 + "해당 분기에 업종 데이터가 없습니다" (드롭다운이 DB 기반이므로 사실상 미발생) |
| Anthropic API 실패 | 통계 랭킹만 반환, `summary=""`, `llm_reason=null`. 프론트: "AI 해설을 불러올 수 없습니다" 안내 |
| DEMO_MODE=true | static mock JSON fallback (기존 패턴 동일) |
| 분석 가능 상권 3개 미만 | 있는 데이터만 반환, 빈 티어는 프론트에서 "해당 없음" 표시 |
| 로딩 중 재입력 | 드롭다운 + [분석하기] 버튼 disabled, 응답 완료 후 활성화 |

---

## 8. 테스트 범위

- `tests/test_advisor.py` — pytest: 점수 계산, 티어 분류, LLM fallback
- `tests/test_schemas_advisor.py` — Pydantic validation
- `frontend/src/hooks/useStartupAdvisor.test.ts` — vitest: fetch mock, 로딩 상태, 에러 처리

---

## 9. 환경변수

```
ANTHROPIC_API_KEY=sk-ant-...   # Claude API 키 (미설정 시 LLM 해설 비활성화)
```

Railway 배포 환경에서 환경변수 등록 필요.
