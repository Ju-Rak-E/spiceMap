# CLAUDE.md - Dev-B (프론트엔드)

## 프로젝트 개요
spiceMap: 서울 상권 인구·소비 흐름 네트워크 시각화 정책 지원 플랫폼

대회: 2026 서울시 빅데이터 활용 경진대회 (시각화 부문)

팀: Dev-A(백엔드/파이프라인) · Dev-B(프론트엔드) · Dev-C(데이터 분석)

## 역할
Dev-B는 React 기반 인터랙티브 지도 앱을 담당한다.
지도 렌더링, 필터 UI, 상세 패널, 타임라인, 상권 경계, 흐름 단절 레이어, CSV 다운로드 진입점을 구현한다.

## 기술 스택
- React + Vite
- MapLibre GL (베이스 지도, 행정동/상권 경계 레이어)
- Deck.gl + @deck.gl/mapbox (OD 흐름 곡선, 상권 노드, 파티클, 흐름 단절)
- D3.js (추세 그래프, 시계열 차트)
- Vitest (단위 테스트)

## 디렉토리 구조
`frontend/src/components/` UI 컴포넌트 (Map, AdminBoundaryLayer, CommerceBoundaryLayer, FlowControlPanel, CommerceLegend, CommerceDetailPanel, TrendChart, PolicyCard)

`frontend/src/layers/` Deck.gl 레이어 정의 (CommerceNodeLayer, ODFlowLayer, FlowParticleLayer, BarrierLayer)

`frontend/src/hooks/` 데이터 페칭/상태 훅 (useCommerceData, useFlowData, useBarriers, useGriHistory, usePolicyInsights, useTimelineControl, useScenarioPlayer, useViewportMode)

`frontend/src/styles/` 디자인 토큰 (COMMERCE_COLORS 등)

`frontend/src/types/` 공유 타입 정의 (CommerceNode 등)

`frontend/src/utils/` 유틸리티 (BoundaryLayerManager, CommerceBoundaryLayerManager, boundaryLayerConfig, flowBezier, summaryFormatter, demoMode, filters, mapPerformance, visualScore)

## 정적 데이터
`seoul_admin_boundary.geojson` 서울 행정동 경계

`mock_commerce.json` 상권 노드 mock

`mock_commerce_boundary.geojson` 상권 경계 폴리곤 mock (`comm_id` 기준)

`mock_flows.json` OD 흐름 mock

`mock_barriers.json` 흐름 단절 mock

`mock_gri_history.json` GRI 시계열 mock

`mock_policy_insights.json` 정책 추천 mock

## 데이터 모드
`VITE_API_BASE_URL`이 없으면 demo mode로 동작하고 mock 파일을 사용한다.

`VITE_API_BASE_URL`이 있으면 API mode로 동작하고 FastAPI 응답을 프론트 타입으로 정규화한다.

API mode 주의사항:
- `/api/commerce/type-map`의 상권 식별자는 `comm_cd`, mock 경계 식별자는 `comm_id`다.
- OD 강조는 `adm_cd` 기준으로 매칭한다. API flow의 `origin_adm_cd`/`dest_adm_cd`가 프론트 `sourceId`/`targetId`가 된다.
- `/api/barriers`는 `sourceCoord`/`targetCoord`가 있는 row만 그릴 수 있다. API 성공 시 빈 결과를 mock으로 대체하지 않는다.

## API 엔드포인트
`GET /api/commerce/type-map` 상권 유형, 위치, 경계, 행정동 키

`GET /api/od/flows` OD 흐름 데이터

`GET /api/barriers` 흐름 단절 구간

`GET /api/gri/history` GRI 시계열

`GET /api/insights/policy` 정책 추천 카드

`GET /api/export/csv` 우선순위 상권 CSV 다운로드

## UI 설계 원칙
- 상단 해설바는 현재 선택값(시간, 목적, 밀도, 유형, 위험 상권 수)을 1문장으로 요약한다.
- 상권 노드는 색상으로 유형, 크기로 창업 적합도/흐름 중요도를 표현한다.
- 선택 상권과 관련된 OD 흐름은 `adm_cd`로 강조하고, 무관한 흐름은 흐리게 표시한다.
- 상권 경계는 줌 13 이상에서 보이되 선택된 상권은 별도 스타일로 강조한다.
- 흐름 단절 레이어는 기본 OFF이며, 토글 ON 시 점선과 분리된 hover 카드로 설명한다.
- 색각 보조 구분은 색상 단독 의존을 피하고 대비, 테두리, 라벨, 툴팁을 함께 사용한다.

## 완료 기준 체크리스트
- [x] 상권 노드 색상·크기 인코딩
- [x] 상세 패널 API/demo 연동
- [x] 타임라인 슬라이더와 재생 제어
- [x] 자치구/상권 유형 필터
- [x] 선택 상권 OD 흐름 강조
- [x] 상권 경계 폴리곤 레이어
- [x] 흐름 단절 레이어 토글과 툴팁
- [x] CSV 다운로드
- [x] 분기 비교 KPI delta
- [x] 색각 구분 수동 확인
- [x] 태블릿 1024px 반응형 확인
- [x] 지도 로딩 성능 측정 훅

## 남은 운영 확인
- 실제 DB에 `commerce_boundary`, `commerce_analysis`, `flow_barriers`, `od_flows_aggregated`가 기대 범위로 적재되어야 한다.
- 배포 환경에서 `VITE_API_BASE_URL`과 V-World API key를 확인한다.
- 발표 전 3분 시나리오 동선을 실제 화면으로 리허설한다.
