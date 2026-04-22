# Current Status (2026-04-22)

`spiceMap` 저장소의 현재 구현 상태를 코드 기준으로 정리한 스냅샷 문서입니다.
기획 문서가 아니라, 실제 동작 중인 범위와 아직 남은 공백을 빠르게 확인하기 위한 참고용입니다.

---

## 1. 백엔드 상태

### 구현 완료

- FastAPI 앱 진입점 구성: `backend/main.py`
- CORS 허용 설정
- `GET /health`
- `GET /api/commerce/type-map`
- `GET /api/gri/history`
- Redis 캐시 키 적용
  - `type-map:{gu|all}:{quarter}`
  - `gri-history:{comm_cd}`
- 수집/적재용 파이프라인 스크립트 골격
  - `backend/pipeline/collect_*`
  - `backend/pipeline/load_*`
  - `backend/pipeline/init_db.py`

### 현재 제약

- `GET /api/commerce/type-map`
  - `gu` 파라미터는 받아도 아직 실제 필터링에는 반영되지 않음
  - 응답 형식은 GeoJSON `FeatureCollection`
- `GET /api/gri/history`
  - 쿼리 파라미터는 `comm_cd`
  - 응답 형식은 `{ comm_cd, comm_nm, history: [...] }`
- 아래 엔드포인트는 아직 placeholder 상태
  - `GET /api/od/flows`
  - `GET /api/barriers`
  - `GET /api/insights/policy`
  - `GET /api/export/csv`
- placeholder 엔드포인트는 현재 공통적으로 아래 형태를 반환

```json
{
  "status": "not_implemented",
  "week": 3
}
```

---

## 2. 프론트엔드 상태

### 구현 완료

- React + Vite + TypeScript 기반 앱 구성
- MapLibre 지도 렌더링
- 서울 행정경계 GeoJSON 레이어 로딩
- Deck.gl 기반 상권 노드/OD 흐름 시각화
- 시간대 슬라이더
- 재생/일시정지/배속 타임라인 제어
- 흐름 강도(top-N) 제어
- 자치구 필터
- 상권 유형 필터
- 상권 hover 툴팁
- 상권 클릭 상세 패널
- GRI 추세 차트 렌더링
- 정책 추천 카드 렌더링
- Vitest 기반 단위 테스트 추가
- mock JSON 기반 demo mode

### 현재 제약

- 기본 동작은 demo mode
  - `VITE_API_BASE_URL`이 없으면 자동으로 mock 데이터 사용
- mock 데이터 파일
  - `frontend/public/data/mock_commerce.json`
  - `frontend/public/data/mock_flows.json`
  - `frontend/public/data/mock_gri_history.json`
  - `frontend/public/data/mock_policy_insights.json`
- 현재 프론트 타입/호출 방식과 백엔드 응답 계약이 완전히 맞지 않음
  - `useCommerceData`는 `{ nodes, updatedAt }`를 기대하지만 백엔드는 GeoJSON 반환
  - `useGriHistory`는 `nodeId`를 보내지만 백엔드는 `comm_cd`를 기대
  - `useFlowData`는 배열 형태 흐름 데이터를 기대하지만 백엔드는 아직 미구현
  - `usePolicyInsights`는 단일 카드 응답을 기대하지만 백엔드는 아직 미구현

---

## 3. 현재 기준 통합 판단

- 프론트 단독 데모/목업 진행도는 높음
- 백엔드 기본 뼈대와 일부 조회 API는 준비됨
- 실제 DB 기반 end-to-end 연동은 아직 미완료
- 따라서 2026-04-22 기준 저장소 상태는
  - 프론트: Week 3 일부 선행 구현까지 진행
  - 백엔드: Week 2 일부 완료 + Week 3 placeholder 유지

---

## 4. 검증 상태

- `frontend`: `npm test` 통과
- `frontend`: `npm run build` 실패
  - 원인: `src/utils/gri.test.ts`가 제거된 `rentalPriceGrowthRate` 필드를 아직 사용 중
  - 현재 `src/utils/gri.ts`의 `GriInput`은 4항목 버전으로 정리되어 있음

---

## 5. 다음 우선 작업

1. 프론트와 백엔드의 응답 계약 통일
2. `od/flows`, `insights/policy`, `barriers`, `export/csv` 실제 구현
3. `type-map`의 `gu` 필터 실제 반영
4. demo mode와 API mode 전환 절차를 문서/환경 변수 기준으로 명확화
5. DB 적재 상태 기준으로 API 응답 예시 재검증
