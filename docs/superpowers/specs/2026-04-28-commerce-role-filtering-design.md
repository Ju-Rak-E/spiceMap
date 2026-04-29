# 상권 역할 분류 및 수요 공급 분석 설계

> 상태: **작업 중** — DB 명세서 수령 후 섹션 3~5 완성 예정
> 작성일: 2026-04-28
> 배경: commerce_boundary 1,650개 노드 중 학교·주거지·시장이 일반 상권과 섞여 오분류 발생

---

## 문제 정의

현재 `commerce_boundary` 테이블에는 골목상권·발달상권뿐 아니라
학교, 주거지역, 전통시장이 동일한 상권 코드로 포함되어 있음.
이로 인해 GRI·유형 분류가 무의미한 노드에도 적용되어 분석 신뢰도 저하.

---

## 페르소나

| 페르소나 | 활용 목적 |
|---------|---------|
| 정책 담당자 (관악구 경제과) | 침체 상권 개입 우선순위, demand_gap 높은 곳 = 흐름 단절 |
| 예비 창업자 | demand_gap 높음 + GRI 낮음 = 수요 있고 과열 전 기회 상권 |

---

## 확정된 설계 결정

### 1. area_role 분류 체계

`comm_type` 필드를 복구해 Dev-A 파이프라인에서 `area_role` enum으로 1회 변환.
이후 원본 `comm_type` 직접 참조 금지.

| area_role | 원천 comm_type | 처리 방식 |
|-----------|--------------|---------|
| `COMMERCE` | 골목상권, 발달상권 | 5유형 분류 + GRI + 우선순위 점수 |
| `MARKET` | 전통시장 | 유동인구 흐름만, 별도 토글 레이어, GRI 제외 |
| `RESIDENTIAL` | 주거지역 | 소비 잠재력 공급원, 반투명 노드 시각화 |
| `SCHOOL` | 교육시설 | 유동인구 참고, 배경 레이어 |

### 2. 주거지 = 소비 잠재력 공급원

주거지를 분석에서 제외하는 것이 아니라 **수요의 출발점**으로 활용.

```
주거지 (RESIDENTIAL)
    ↓ 반경 500m PostGIS 집계
demand_potential (상권 기준 잠재 수요 인구)
    ↓
demand_gap = (demand_potential - net_flow) / demand_potential
    ↓
GRI v2.0에 반영
```

### 3. GRI v2.0 공식 방향 (세부 가중치는 미확정)

```
GRI v2.0 =
  기존 항목 (폐업률, 순유출, 고립도) 재분배
+ demand_gap 20% 추가

→ "수요는 있는데 사람이 안 오는 상권"을 포착
```

### 4. 분석 모델 선택: A안 (멀티 레이어 집계)

C안(수요-공급 이분 그래프)과 비교 검토 후 A안 채택.
- C안은 OD 데이터가 행정동 단위라 주거지 단위 분해 불가 → 정밀도 한계
- Week 4 흐름 단절 레이어(F-08)에서 C안 부분 구현 예정

---

## DB 변경 요청 (Dev-A에게 전달)

### 확정 요청

```sql
-- commerce_boundary
ADD COLUMN area_role VARCHAR(20) NOT NULL DEFAULT 'COMMERCE'

-- commerce_analysis
ADD COLUMN area_role        VARCHAR(20)
ADD COLUMN demand_potential FLOAT    -- 반경 500m 주거지 추정 인구 (명)
ADD COLUMN demand_gap       FLOAT    -- 0~1, COMMERCE 노드만, 나머지 NULL
```

### API 응답 추가 필드

`GET /api/commerce/type-map` properties에 추가:
```json
{
  "area_role": "COMMERCE",
  "demand_potential": 28400,
  "demand_gap": 0.73
}
```

---

## 보류 항목 — DB 명세서 수령 후 결정

### commerce_character (상권 성격 분류)

예비 창업자·공무원 페르소나를 위한 세부 성격 필드.
현재 후보: 역세권 / 대학가 / 오피스 / 관광 / 주택가 / 일반골목

**명세서에서 확인할 질문:**
1. `comm_type` 실제 값 목록 전체 (인코딩 복구 후)
2. 역세권/대학가 등 입지 특성 필드가 별도로 있는가?
3. 상권 면적, 업종 구성 비율 등 추가 속성 있는가?
4. 공간 좌표계 (EPSG 코드)
5. 분기별 스냅샷인가, 현재 시점 단일 테이블인가?

---

## 미완성 섹션 (명세서 수령 후 작성)

- [ ] 섹션 3: GRI v2.0 세부 가중치 및 분석 모듈 변경
- [ ] 섹션 4: commerce_character 분류 체계
- [ ] 섹션 5: 프론트엔드 레이어 설계 (MARKET/RESIDENTIAL/SCHOOL 시각화)
- [ ] 섹션 6: 예비 창업자 UI 기능 설계
