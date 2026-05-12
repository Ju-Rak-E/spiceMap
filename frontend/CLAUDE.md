# CLAUDE.md - Dev-B (프론트엔드)

## 프로젝트 개요
spiceMap: 서울 상권 인구·소비 흐름 네트워크 시각화 정책 지원 플랫폼

대회: 2026 서울시 빅데이터 활용 경진대회 (시각화 부문)

팀: Dev-A(백엔드/파이프라인) · Dev-B(프론트엔드) · Dev-C(데이터 분석)

## 역할
Dev-B는 React 기반 인터랙티브 지도 앱을 담당한다.
지도 렌더링, 필터 UI, 상세 패널, 타임라인, 상권 경계, 흐름 단절 레이어, CSV 다운로드 진입점을 구현한다.

## 🚫 폴리곤 라인 절대 수정 금지 (CRITICAL)

상권/행정동 경계 폴리곤 라인은 여러 차례 회귀 사고로 손실됐다 복구된 영역이다.
다른 작업을 하더라도 아래 파일 안의 라인 렌더링 코드(line layer, line-color, line-width, line-opacity, minzoom, BOUNDARY_LINE_LAYOUT, buildBoundaryColorExpression, getBoundaryPaintConfig 등)는 절대 건드리지 않는다.

### 보호 대상 파일
- `frontend/src/utils/CommerceBoundaryLayerManager.ts` — 상권 폴리곤 라인 (commerce-boundary-line, commerce-boundary-line-glow, commerce-boundary-selected-line)
- `frontend/src/utils/BoundaryLayerManager.ts` — 자치구 폴리곤 라인 (admin-boundary-line, admin-boundary-highlight)
- `frontend/src/utils/boundaryLayerConfig.ts` — 라인 페인트/줌 보간식 (LINE_WIDTH_ZOOM_EXPR, LINE_OPACITY_ZOOM_EXPR, FILL_OPACITY_ZOOM_EXPR, getBoundaryPaintConfig)
- `frontend/src/components/CommerceBoundaryLayer.tsx` · `frontend/src/components/AdminBoundaryLayer.tsx` — 매니저 마운트/언마운트 계약
- `frontend/src/layers/PolygonExtrusionLayer.ts` — 3D 모드 폴리곤 외곽선 (createPolygonOutlineLayer, depthCompare/depthWriteEnabled 파라미터)

### 절대 하지 말 것
- 위 파일들의 line/stroke 관련 코드 수정 (색상, 굵기, opacity, 줌 보간, minzoom 변경 포함)
- 위 파일들의 layer id, source id, BOUNDARY_LINE_LAYOUT 변경
- 위 파일들에서 line layer의 추가/삭제/순서 변경
- "단순 정리"·"리팩터링"·"같이 손보기" 명목의 동시 수정
- Map.tsx에서 `<CommerceBoundaryLayer />` / `<AdminBoundaryLayer />` 마운트 조건이나 prop을 무관한 작업 도중 변경

### 예외 (수정해도 되는 경우)
- 사용자가 명시적으로 "폴리곤 라인 수정해줘"라고 요청한 경우만
- 그 외에는 무관한 작업이라 판단되면 즉시 손을 떼고 사용자에게 확인받는다.

### 수정이 정말 필요할 때 절차
1. 사용자에게 명시적 승인 요청 ("폴리곤 라인 수정해도 됩니까?")
2. 수정 전 현재 상태 git stash/branch로 백업
3. 변경 후 반드시 다음 테스트 통과 확인
   - `npx vitest run src/utils/CommerceBoundaryLayerManager.test.ts`
   - `npx vitest run src/utils/BoundaryLayerManager.test.ts`
   - `npx vitest run src/layers/PolygonExtrusionLayer.test.ts`
4. 브라우저에서 줌 9 → 14 전체 구간에서 라인이 보이는지 시각 검증
5. 2D / 3D '상권 3D' 모드 전환 시 라인이 정상 표시되는지 확인

### 회귀 이력 (참고)
- `02b7154` fix: remove polygon stroke and hide CommerceBoundaryLayer in 3D polygon mode to fix z-fighting
- `ed249e3` fix: restore commerce boundary visibility
- `86fc6df` 상권영역 폴리곤 라인 고정
- `ff4480c` feat: zoom-interpolated boundary line width and fill opacity
- `42ecb30` fix: preserve fill-opacity zoom expr on theme change and setFillOpacity
- `3529325` 단절영역 flow들 색상변경 및 폴리곤 라인 재수정
- `4413f6b` CSV다운로드 복구 (3D 모드 createPolygonOutlineLayer 추가)

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
