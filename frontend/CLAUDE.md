# CLAUDE.md - Dev-B (프론트엔드)

## 프로젝트 개요
spiceMap: 서울 상권 인구·소비 흐름 네트워크 시각화 정책 지원 플랫폼

대회: 2026 서울시 빅데이터 활용 경진대회 (시각화 부문)

팀: Dev-A(백엔드/파이프라인) · Dev-B(프론트엔드) · Dev-C(데이터 분석)

## 역할
Dev-B는 React 기반 인터랙티브 지도 앱을 담당한다.
지도 렌더링, 필터 UI, 상세 패널, 타임라인, 상권 경계, 흐름 단절 레이어, CSV 다운로드 진입점을 구현한다.
구현되어 있는 상권영역에 대한 폴리곤 라인은 절대 수정하지 않는다.

## 기술 스택
- React + Vite
- MapLibre GL (베이스 지도, 행정동/상권 경계 레이어)
- Deck.gl + @deck.gl/mapbox (OD 흐름 곡선, 상권 노드, 파티클, 흐름 단절)
- D3.js (추세 그래프, 시계열 차트)
- Vitest (단위 테스트)

## 디렉토리 구조
`src/components/` Map, AdminBoundaryLayer, CommerceBoundaryLayer, FlowControlPanel, CommerceLegend, CommerceDetailPanel, TrendChart, PolicyCard, ValidationView, InsightStrip

`src/data/` 정적 fixture (validation_results.json — H1/H2/H3/B1/B3)

`src/layers/` CommerceNodeLayer, ODFlowLayer, FlowParticleLayer, FlowBarrierLayer, DisruptedBarrierParticleLayer

`src/hooks/` useCommerceData, useFlowData, useBarriers, useGriHistory, usePolicyInsights, useTimelineControl, useViewportMode, useAnimationFrame

`src/utils/` BoundaryLayerManager, CommerceBoundaryLayerManager, boundaryLayerConfig, flowBezier, barrierRouteAnimation, summaryFormatter, demoMode, filters, mapPerformance, visualScore

## 정적 데이터 (public/data/)
`seoul_admin_boundary.geojson` · `mock_commerce.json` · `mock_commerce_boundary.geojson` (`comm_id`) · `mock_flows.json` · `mock_barriers.json` · `mock_gri_history.json` · `mock_policy_insights.json`

## 데이터 모드
`VITE_API_BASE_URL` 없음 → demo mode (mock 파일).
`VITE_API_BASE_URL` 있음 → API mode (FastAPI 응답 정규화).
OD 강조: `adm_cd` 기준. `/api/barriers`: sourceCoord/targetCoord 있는 row만 그릴 수 있다.

## 상세 가이드
→ `.claude/rules/dev-b-guide.md` (API 엔드포인트, UI 원칙, 완료 기준, Hero shot, 주의사항, 남은 운영 확인)
