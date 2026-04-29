# 상권 유형(`comm_type`) 정상화 계획

> 작성일: 2026-04-27 (Week 3 Day 1)
> 작성자: Dev-B
> 관련 이슈: 지도 노드가 전부 “안정형”으로만 표시되는 현상
> 영향 범위: Dev-A (API), Dev-C (분석 파이프라인), Dev-B (프론트)

---

## 1. 결론 (Conclusion First)

지금 노드가 전부 “안정형”으로 보이는 직접 원인은 **두 개**다.

1. `commerce_analysis` 테이블이 비어 있어 Dev-C 5유형 분류값이 없다 (`gri_score 있는 상권: 0`).
2. API는 5유형이 아닌 **원천** `commerce_boundary.comm_type`(골목상권/발달상권 등 — 게다가 일부 인코딩 깨짐)을 `comm_type`으로 내려주고 있다.

프론트의 `resolveType`이 알 수 없는 값을 전부 `'안정형'`으로 폴백하기 때문에 **문제가 가려진다**. 폴백을 제거하고, API 필드를 분리하고, 분석 결과를 적재하는 3축 작업으로 정상화한다.

---

## 2. 진단 (Diagnosis)

### 2.1 현재 API 응답 (실측)

`GET /api/commerce/type-map?quarter=2025Q4`
```
total: 1650
gri_score 있는 상권: 0
flow_volume 있는 상권: 0
comm_type 샘플: 'e¢¥€e¢¥?i?©öe¥ì¡þ' 등 (인코딩 깨진 한글)
```

### 2.2 코드상의 원인

| 파일 | 라인 | 현재 동작 | 문제 |
|------|------|----------|------|
| `backend/api/commerce.py` | 48 | `cb.comm_type` 그대로 SELECT | Dev-C의 분석 5유형이 아닌 원천 상권 구분(골목/발달 등) |
| `backend/api/commerce.py` | 63-65 | `LEFT JOIN commerce_analysis` | 우측 테이블이 0행이라 `gri_score`/`flow_volume` 항상 NULL |
| `backend/schemas/commerce.py` | 13 | `comm_type: str \| None` 단일 | 분석 유형/원천 유형 구분 불가 |
| `frontend/src/types/commerce.ts` | 45-48 | 알 수 없는 raw → `'안정형'` 폴백 | 데이터 부재를 안정형으로 위장 |
| `commerce_analysis` 테이블 | — | 0행 | Dev-C Module B 미실행 (Week 2 이월) |

### 2.3 파급 영향

- `useCommerceData` → `featuresToNodes` → `Map.tsx` 노드 색상 일률 녹색.
- `CommerceLegend` 범례와 실제 분포 불일치 (5색 다 나와야 하는데 1색).
- `usePolicyInsights`, `getNodeInterpretation` 등 유형별 분기 로직이 무의미.
- H1 검증(상위 흐름 자치구 일치율) 산출 자체 불가 — `gri_score`가 없음.

---

## 3. 정상화 목표 (Done Definition)

- [ ] API `comm_type` 의미가 분리된다: **`commerce_type`**(Dev-C 5유형) + **`source_comm_type`**(원천 골목/발달).
- [ ] `commerce_analysis`에 `commerce_type`/`gri_score`/`flow_volume`이 적재된다 (최소 강남·관악 MVP 범위).
- [ ] 미분석 상권은 프론트에서 `'안정형'`이 아닌 **`'미분류'`(분석 대기)** 로 명시 표시된다.
- [ ] 인코딩 깨진 원천 한글이 더 이상 노드 색상 결정에 영향을 주지 않는다.
- [ ] 기존 5유형 색상 테스트(`tokens.test.ts`, `commerce.test.ts`, `filters.test.ts`)가 통과한다.

---

## 4. 작업 분해 (Work Breakdown)

세 팀의 의존 관계가 있어 **동시 착수**할 수 있는 부분과 **직렬**로 가야 하는 부분을 구분한다.

```
[Dev-A] API 분리         ──┐
[Dev-B] 미분류 도입       ──┼──> 통합 검증(스테이징)
[Dev-C] 분석 적재         ──┘
        ↑ Dev-A의 스키마 합의가 선행
```

### 4.1 Dev-A — API/스키마 분리 (Owner: 백엔드)

**파일**: `backend/api/commerce.py`, `backend/schemas/commerce.py`, `tests/api/test_commerce.py`

**변경**:
1. SELECT 절에 두 컬럼을 명확히 분리한다.
   ```sql
   ca.commerce_type        AS commerce_type,
   cb.comm_type            AS source_comm_type
   ```
   - `COALESCE(...)`는 **쓰지 않는다.** 의미가 다른 두 값을 합치면 디버깅이 더 어려워진다.
2. 응답 properties에 두 필드를 모두 포함하고, 기존 `comm_type` 키는 **하위 호환 위해 1주만 유지**한다 (값=`commerce_type`). Week 4 클린업 PR에서 제거.
3. 인코딩 깨진 원천 값은 **API 레이어에서 정상화하지 않는다.** 표시 단계에서 처리한다 (Dev-B). 단, `commerce_type`은 ASCII 라벨(`흡수형_과열` 등)이라 인코딩 영향 없음.
4. `gu` 필터: 기존 주석대로 현재는 무시 — 별도 작업.

**Pydantic 스키마**:
```python
class CommerceProperties(BaseModel):
    comm_cd: str
    comm_nm: str
    gu_nm: str | None = None
    commerce_type: str | None = None       # NEW: Dev-C 5유형 (또는 'unclassified')
    source_comm_type: str | None = None    # NEW: 원천 골목/발달 (디버그용)
    comm_type: str | None = None           # DEPRECATED: 1주 유지, commerce_type 미러
    gri_score: float | None = None
    flow_volume: int | None = None
    dominant_origin: str | None = None
    analysis_note: str | None = None
    centroid_lng: float | None = None
    centroid_lat: float | None = None
```

**테스트**:
- `commerce_analysis`가 비어 있을 때 `commerce_type`은 NULL로 내려가는지.
- 더미 행 1건 삽입 시 `commerce_type`이 그대로 노출되는지.
- `comm_type`(deprecated)이 `commerce_type`과 동일 값을 미러링하는지.

### 4.2 Dev-C — 분석 결과 적재 (Owner: 데이터 분석)

**파일**: `backend/analysis/commerce_type.py` (이미 존재), `backend/analysis/module_b_gri.py`, 적재 스크립트

**변경**:
1. `module_b_gri` 산출(`gri_score`, `flow_volume`, `dominant_origin`) → `commerce_analysis` UPSERT.
2. `classify_commerce_types` 결과(`commerce_type` 컬럼) → 동일 테이블 같은 row에 합치기 (없으면 `'unclassified'`).
3. 분기 키: 우선 `2025Q4` 단일. 강남(`1168xxxx`)·관악(`1162xxxx`) 자치구 범위만.
4. `commerce_analysis.commerce_type` 컬럼이 스키마에 없다면 마이그레이션:
   ```sql
   ALTER TABLE commerce_analysis ADD COLUMN IF NOT EXISTS commerce_type VARCHAR(30);
   ```
5. 적재 후 검증:
   ```sql
   SELECT commerce_type, COUNT(*) FROM commerce_analysis
   WHERE year_quarter = '2025Q4' GROUP BY 1;
   ```
   기대: 5유형 + `unclassified` 합 ≥ 1 (강남·관악 상권 수).

**리스크**: 임대료/프랜차이즈 미확보로 `흡수형_초기` 미정의(설계상 v1.0). `unclassified` 비율이 30%를 넘으면 `closure_rate`/`degree_centrality` 입력 점검.

### 4.3 Dev-B — 프론트엔드 미분류 처리 (Owner: 본인)

**파일**: `frontend/src/styles/tokens.ts`, `frontend/src/types/commerce.ts`, `frontend/src/utils/summaryFormatter.ts`, 관련 테스트

**변경**:
1. `COMMERCE_COLORS`에 `미분류` 토큰 추가:
   ```ts
   미분류: {
     fill: '#5C6F80',          // 채도 낮은 슬레이트
     icon: 'help-circle',
     symbol: '?',
     label: '미분류 (분석 대기)',
     badgeColor: 'rgba(92,111,128,0.18)',
     textColor: '#B0BEC5',
     outline: '#37474F',
     description: 'Dev-C 분석 결과가 아직 산출되지 않은 상권',
   },
   ```
2. `VALID_TYPES`에 `미분류` 추가, `resolveType` 시그니처 교체:
   ```ts
   function resolveType(raw: string | null): CommerceType {
     if (raw && VALID_TYPES.has(raw)) return raw as CommerceType
     return '미분류'   // ← 안정형 폴백 제거
   }
   ```
3. `featuresToNodes`에서 입력 키를 `commerce_type`(신규) 우선, 없으면 `comm_type`(deprecated) 폴백:
   ```ts
   const raw = f.properties.commerce_type ?? f.properties.comm_type ?? null
   type: resolveType(raw),
   ```
4. `getNodeInterpretation`에 `'미분류'` case 추가 — 문구: “Dev-C 분석 산출 전입니다”.
5. `CommerceLegend`: `미분류`를 별도 그룹(또는 끝)에 회색 톤으로 표시. 5유형과 시각적으로 분리.
6. `usePolicyInsights` 등 유형 의존 로직에서 `'미분류'`는 추천 카드 대상에서 **제외**.

**테스트**:
- `commerce.test.ts`: 알 수 없는 raw → `'미분류'` (기존 `'안정형'` 케이스 변경).
- `tokens.test.ts`: 6개 키(`5유형 + 미분류`)에 대해 fill/icon/label 모두 정의.
- `filters.test.ts`: `미분류` 필터 동작 검증 (기본 ON으로 둘지 OFF로 둘지 결정 필요 — §6 참고).
- 새 테스트: API 응답에 `commerce_type=null`인 feature가 섞였을 때 노드가 회색으로 렌더되는지 (`featuresToNodes` 단위 테스트).

---

## 5. 단계별 실행 계획 (Phased Rollout)

| Phase | Day | 담당 | 산출물 | 차단 조건 |
|-------|-----|------|--------|----------|
| P0 | 4/27 (오늘) | Dev-B | 본 계획서 PR + 미분류 토큰 정의 (테스트 먼저, RED) | — |
| P1 | 4/27~28 | Dev-A | `commerce_type`/`source_comm_type` 필드 분리, 스키마/테스트 통과 | — |
| P2 | 4/27~28 | Dev-C | `commerce_analysis` 적재 (강남·관악 2025Q4), `unclassified` 비율 보고 | 마이그레이션 합의 |
| P3 | 4/28 | Dev-B | `featuresToNodes` 신규 키 사용, 폴백 제거, 테스트 GREEN | P1 머지 |
| P4 | 4/29 | 3인 | 스테이징 통합 검증: `gri_score 있는 상권 ≥ 1`, 5유형 분포 차트 확인 | P1·P2·P3 |
| P5 | 5/4 | Dev-A | `comm_type`(deprecated) 키 제거, 스키마 v1 확정 | P4 통과 |

> Week 3 마감(5/4) 전에 P5까지 닫는 것이 목표. 지연 시 P5만 Week 4로 이월.

---

## 6. 결정 필요 항목 (Open Decisions)

1. **`미분류` 필터 기본 상태**: ON(전부 보임) vs OFF(분석 완료된 상권만).
   - 추천: **ON** — 데이터 부재가 사용자에게 명시적으로 보여야 함. 단, 발표 시연 모드에서는 OFF 토글 권장.
2. **`unclassified`(백엔드) ↔ `미분류`(프론트) 매핑 위치**: API에서 한글로 변환해 내릴지, 프론트에서 매핑할지.
   - 추천: **프론트에서 매핑.** API는 영어 enum 유지(국제화/로깅 친화). `featuresToNodes`에서 `'unclassified' → '미분류'` 1줄 매핑.
3. **`source_comm_type` 인코딩 복구 시점**: Week 3 범위 외로 미루고, 상세 패널 디버그 영역에만 표시.
   - 추천: **미룸.** 정상화는 Dev-A 파이프라인 재수집 이슈 (별도 티켓).

---

## 7. 검증 (Verification)

### 7.1 백엔드
```bash
curl -s "http://localhost:8000/api/commerce/type-map?quarter=2025Q4" \
  | jq '.features[0].properties | {commerce_type, source_comm_type, gri_score}'
```
기대(P4 이후):
```json
{ "commerce_type": "흡수형_성장", "source_comm_type": "골목상권", "gri_score": 42.1 }
```

### 7.2 DB
```sql
SELECT commerce_type, COUNT(*)
FROM commerce_analysis
WHERE year_quarter = '2025Q4'
GROUP BY 1 ORDER BY 2 DESC;
```
기대: 5유형 중 최소 3유형 + `unclassified` 함께 등장.

### 7.3 프론트
- `npm test` (vitest) 모두 GREEN.
- 지도 줌인 시 노드 색이 5색 + 회색(미분류) 혼재로 보임.
- 범례에서 `미분류` 클릭 → 회색 노드만 남음.

### 7.4 회귀(Regression) 테스트
- demo mode (`VITE_API_BASE_URL` 미설정)에서 mock 데이터는 5유형만 → `미분류` 0건. 기존 동작 변하지 않음.
- mock 파일에 의도적으로 `comm_type: null`을 1개 섞어 회색 표시 확인 후 원복.

---

## 8. 리스크 & 롤백

| 리스크 | 가능성 | 영향 | 대응 |
|--------|--------|------|------|
| Dev-C 적재가 4/29까지 지연 | 중 | 발표용 시연 데이터 없음 | mock seed로 `commerce_analysis` 5건 임시 삽입(스테이징 한정), 발표 시 “데모” 라벨 표기 |
| `unclassified` 비율 50% 초과 | 중 | 지도가 회색 압도 → 시각적 신뢰 저하 | Dev-C 임계값(P25/P75) 재튜닝 또는 강남·관악 한정 보강 |
| API 키 변경(`comm_type` → `commerce_type`) 누락 호출자 발생 | 낮 | 401/500은 아니고 표시 깨짐 | deprecated 키 1주 유지(P5에서 제거) |
| 프론트 신규 `미분류` 토큰이 색각 이상 시뮬레이션 실패 | 낮 | FR-11 위반 | 회색 + `?` 심볼 병행 — 이미 적용 |

**롤백 방침**: Dev-A 변경은 키 추가만 하고 기존 `comm_type` 유지하므로 무중단 롤백 가능. Dev-B는 `resolveType`만 1라인 되돌리면 종전 동작.

---

## 9. 후속 작업(별도 티켓)

- `commerce_boundary.comm_type` 한글 인코딩 깨짐 — 수집 파이프라인 재정비 (Dev-A).
- `flow_volume`만으로 `netFlow`를 표시하는 현재 동작 검토 — 부호(in/out) 분리 필요할 수 있음 (Dev-B + Dev-C).
- `degreeCentrality`를 0 폴백 중 — Module A 산출 후 연결.

---

## 부록: 변경 파일 목록

| 영역 | 파일 | 변경 종류 |
|------|------|----------|
| 백엔드 | `backend/api/commerce.py` | SELECT 컬럼 분리, 응답 properties |
| 백엔드 | `backend/schemas/commerce.py` | `commerce_type`/`source_comm_type` 필드 추가 |
| 백엔드 | `tests/api/test_commerce.py` | 신규 케이스 |
| 분석 | `backend/analysis/module_b_gri.py` | UPSERT에 `commerce_type` 포함 |
| 분석(스키마) | `commerce_analysis` 테이블 | `commerce_type` 컬럼 추가 마이그레이션 |
| 프론트 | `frontend/src/styles/tokens.ts` | `미분류` 토큰 추가 |
| 프론트 | `frontend/src/types/commerce.ts` | 폴백 제거, `commerce_type` 키 우선 |
| 프론트 | `frontend/src/utils/summaryFormatter.ts` | `미분류` case 추가 |
| 프론트 | `frontend/src/styles/tokens.test.ts` | 6키 검증 |
| 프론트 | `frontend/src/types/commerce.test.ts` | 폴백 케이스 변경 |
| 프론트 | `frontend/src/utils/filters.test.ts` | 미분류 필터 케이스 |
| 프론트 | `frontend/src/components/CommerceLegend.tsx` | 미분류 표시 |
| 문서 | `docs/commerce_type_normalization_plan.md` | 본 문서 |
