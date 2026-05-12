# 창업 타이밍 분석 + 두 상권 비교 설계 문서

> 작성일: 2026-05-12
> 상태: **기각 (미구현)** — 문서 보존 목적으로만 기록
> 기존 Startup Advisor(llm-startup-advisor) 위에 올라가는 확장 기능

---

## 개요

사용자가 Startup Advisor 랭킹에서 특정 상권을 클릭하면, 해당 상권 + 선택된 업종 기준으로 분기별 트렌드와 AI 창업 타이밍 분석을 드릴다운 뷰로 제공한다.

---

## 확정된 흐름

1. 기존 어드바이저에서 업종 선택 → 상권 랭킹 표시
2. 랭킹 목록에서 특정 상권 클릭
3. StartupAdvisorPanel이 `'timing'` 뷰로 전환 (드릴다운)
4. 분기별 트렌드 수치 + Claude AI 타이밍 해설 표시
5. ← 뒤로가기 → 랭킹 목록 복귀

---

## Phase 1 MVP: 창업 타이밍 분석 (단일 상권)

### 백엔드

**엔드포인트:** `GET /api/advisor/timing`

| 파라미터 | 설명 |
|----------|------|
| `comm_cd` | 상권 코드 |
| `industry_nm` | 업종명 |
| `gu_nm` | 자치구명 (store_info JOIN용) |

**처리:**
1. `commerce_analysis`에서 해당 `comm_cd`의 전 분기 GRI/유동인구/폐업률 조회
2. `store_info`에서 해당 `gu_nm` + `industry_nm`의 전 분기 점포수/업종폐업률 조회
3. 두 데이터를 Claude Haiku에 전달 → 최적 개업 분기 + 이유 생성
4. 분기별 수치 + AI 해설 반환

**응답 스키마:**
```python
class QuarterData(BaseModel):
    quarter: str           # "2025Q2"
    flow_volume: int | None
    gri_score: float | None
    store_count: int | None
    close_rate: float | None

class TimingResponse(BaseModel):
    comm_cd: str
    comm_nm: str
    industry_nm: str
    quarters: list[QuarterData]
    best_quarter: str | None   # AI 추천 분기
    ai_summary: str            # 2~3문장 트렌드 해설
    ai_caution: str            # 주의사항 1문장
    model_used: str
```

**데이터 범위:** Q3 2024 ~ Q4 2025 (백필 포함 6개 분기)

### 프론트엔드

**UI 레이아웃 (드릴다운 뷰):**
```
┌─────────────────────────────┐
│ ← 뒤로       역삼1동 · 커피음료 │
├─────────────────────────────┤
│ 분기별 트렌드                  │
│ 2024Q3  유동 11,200  GRI 32 │
│ 2025Q2  유동 14,200  GRI 28 │ ← 최적 분기 (초록 테두리)
│ ...                         │
├─────────────────────────────┤
│ 🤖 AI 타이밍 분석             │
│ [추천 개업 시기: 2025 Q2]     │
│ Q2~Q3 유동인구 피크...        │
│ ⚠️ Q4 폐업률 소폭 상승...     │
└─────────────────────────────┘
```

**상태 전환:**
- `StartupAdvisorPanel` 내부에 `view: 'ranking' | 'timing'` 상태 추가
- 상권 클릭 → `view: 'timing'`, 선택된 상권 정보 저장
- 뒤로가기 → `view: 'ranking'` 복귀

**신규 파일:**

| 파일 | 역할 |
|------|------|
| `backend/api/advisor.py` | `GET /api/advisor/timing` 추가 |
| `backend/schemas/advisor.py` | `TimingResponse`, `QuarterData` 추가 |
| `frontend/src/hooks/useTimingAnalysis.ts` | 타이밍 API 호출 훅 |
| `frontend/src/components/TimingAnalysisView.tsx` | 드릴다운 뷰 컴포넌트 |
| `frontend/public/data/mock_timing.json` | 데모 모드 mock 데이터 |

**수정 파일:**
- `frontend/src/components/StartupAdvisorPanel.tsx` — view 상태 + 클릭 핸들러 수정

---

## Phase 2: 두 상권 비교 + 타이밍 통합

Phase 1 완성 후 확장. 사용자가 두 상권을 선택하면 AI가 비교 분석 + 타이밍을 한 번에 제공.

**흐름:** 두 상권 선택 → 업종 선택(기존 어드바이저 재사용) → AI 비교 해설 + 각 상권 최적 타이밍

**예시 출력:**
> "역삼동 vs 봉천동에서 커피숍 열기: 역삼동이 유동인구 우위, 개점 최적 시기는 Q2. 봉천동은 경쟁 밀도 낮고 Q3 진입 유리."

---

## 기각 사유

기록 없음 (브레인스토밍 중 기각 결정).
