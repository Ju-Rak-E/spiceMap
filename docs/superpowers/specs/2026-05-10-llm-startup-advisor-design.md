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

### 3-2. `POST /api/advisor/startup`

```
Body: { industry_nm: string, quarter: string }
Response: AdvisorResponse
```

**처리 순서:**

1. `store_info`에서 `industry_nm` + `quarter`로 자치구별 `close_rate` 조회
2. `commerce_analysis`에서 해당 `quarter` 전체 상권 지표 조회 (`gri_score`, `flow_volume`, `net_flow`, `closure_rate`, `degree_centrality`, `priority_score`)
3. 각 상권에 어드바이저 점수 계산:
   ```
   # 모든 항목을 0~100 스케일로 통일 후 가중합
   advisor_score =
     (100 - gri_score)                    × 0.40  # 위험도 낮을수록 유리
     + minmax_0_100(flow_volume)           × 0.30  # 유동인구 많을수록 유리 (분기 내 min-max 정규화)
     + (100 - closure_rate × 10)           × 0.20  # 폐업률 낮을수록 유리 (closure_rate는 % 단위)
     + degree_centrality × 100             × 0.10  # 네트워크 중심성 (0~1 → 0~100)
   ```
4. 점수 내림차순 정렬 후 티어 분류:
   - 상위 30% → `"추천"`
   - 중간 40% → `"주의"`
   - 하위 30% → `"비추천"`
5. 어드바이저 점수 상위 5개 + 하위 3개 상권 지표를 컨텍스트로 Claude API 호출 (티어와 무관하게 점수 기준 선택)
6. LLM 응답(JSON)을 파싱해 `AdvisorResponse`에 병합 후 반환

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

```
system: "당신은 서울시 상권 데이터를 분석하는 창업 컨설턴트입니다."

user:
  {업종} 창업을 고려하는 분을 위한 상권 분석 데이터입니다.

  [추천 상권]
  - {comm_nm} (GRI {gri_score}, 유동인구 {flow_volume}, 폐업률 {closure_rate}%)
  ...

  [비추천 상권]
  - {comm_nm} (GRI {gri_score}, 유동인구 {flow_volume}, 폐업률 {closure_rate}%)
  ...

  다음 JSON 형식으로만 응답하세요:
  {
    "summary": "전체 상황 2~3문장 요약",
    "reasons": [{"comm_cd": "...", "reason": "추천 이유 1~2문장"}],
    "caution": "주의사항 1문장"
  }
```

모델: `claude-haiku-4-5` (빠른 응답, 저비용)
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
