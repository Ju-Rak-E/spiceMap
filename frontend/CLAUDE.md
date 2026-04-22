# CLAUDE.md — Dev-B (프론트엔드)

## 프로젝트 개요
spiceMap: 서울 상권 인구·소비 흐름 네트워크 시각화 정책 지원 플랫폼
대회: 2026 서울시 빅데이터 활용 경진대회 (시각화 부문)
팀: Dev-A(백엔드/파이프라인) · Dev-B(프론트엔드) · Dev-C(데이터 분석)

## 역할
Dev-B는 React 기반 인터랙티브 지도 앱 전담.
지도 렌더링 · 필터 UI · 상세 패널 · 타임라인 슬라이더 구현.

## 기술 스택
- React + Vite
- MapLibre GL (베이스 지도, 행정동 경계 레이어)
- Deck.gl + @deck.gl/mapbox (OD 흐름 곡선, 상권 노드, 파티클 애니메이션)
- D3.js (추세 그래프, 시계열 차트)

## 디렉토리 구조
`frontend/src/components/` UI 컴포넌트 (Map, AdminBoundaryLayer, FlowControlPanel, CommerceLegend, CommerceDetailPanel, TrendChart, PolicyCard)
`frontend/src/layers/` Deck.gl 레이어 정의 (CommerceNodeLayer, ODFlowLayer, FlowParticleLayer)
`frontend/src/hooks/` 데이터 페칭 훅 (useCommerceData, useFlowData, useGriHistory, usePolicyInsights, useTimelineControl, useAnimationFrame)
`frontend/src/styles/` 디자인 토큰 (색상 팔레트 — COMMERCE_COLORS에 description 필드 포함)
`frontend/src/types/` 공유 타입 정의 (CommerceNode 등)
`frontend/src/utils/` 유틸리티 (gri, BoundaryLayerManager, boundaryLayerConfig, flowBezier, summaryFormatter, demoMode, filters)

## 정적 데이터 (public/data/)
`seoul_admin_boundary.geojson` 서울 행정동 경계 (BoundaryLayerManager 런타임 의존, 230KB)
`mock_commerce.json` 상권 노드 mock (강남구 7 + 관악구 5, `district` 필드 포함)
`mock_flows.json` OD 흐름 mock (12개)
`mock_gri_history.json` GRI 시계열 mock (nodeId gc_001~gc_007, gw_001~gw_005 + __default__)
`mock_policy_insights.json` 정책 추천 mock (12개 + __default__)

> demo mode: `VITE_API_BASE_URL` 미설정 시 `isDemoMode()` → mock 파일 사용. 부분 폴백 없음.

## 환경 변수
`VITE_VWORLD_API_KEY` V-World 지도 API 키 (필수)
`VITE_API_BASE_URL` 백엔드 API 베이스 URL (선택 — 미설정 시 mock 데이터 자동 폴백)

## API 엔드포인트 (Dev-A 제공)
`GET /api/od/flows` OD 흐름 데이터
`GET /api/commerce/type-map` 상권 유형 + 위치
`GET /api/gri/history` GRI 시계열
`GET /api/barriers` 흐름 단절 구간
`GET /api/insights/policy` 정책 추천 카드
`GET /api/export/csv` CSV 다운로드

## 이동 목적 (FlowPurpose)

`'출근' | '쇼핑' | '여가' | '귀가'` — 4종 고정 (관광·등교 제외)

목적별 피크 시간대 (mock 단계에서 hour 슬라이더가 volume을 Gaussian 감쇠로 스케일링):
- 출근: 08시 피크 / 쇼핑: 14시 피크 / 여가: 20시 피크 / 귀가: 19시 피크
- `getHourScale(purpose, hour)` → 0.1~1.0 배율 (`useFlowData.ts` 내 유틸)
- Week 3 API 연동 후: 프론트 스케일링 제거 → 백엔드 파라미터(`?purpose=출근`)로 교체

## 애니메이션 동작 규칙

- **속도**: `Map.tsx` RAF 루프에서 `flows` 총 이동량으로 속도 스케일 계산 (`sqrt(totalVolume / 10000)`, 범위 0.3×~2.0×)
- **파티클 수**: 흐름별 volume 비율(0~1)에 따라 1~4개 동적 조정 (`FlowParticleLayer.ts`)
- **파티클 크기**: volume 비례 200~700m, `radiusMinPixels:3` / `radiusMaxPixels:14` 보장
- **경로 공유**: OD 선(PathLayer)·파티클 모두 `flowBezier.ts`의 동일 베지어 함수 사용 → 파티클이 선 위를 달림
- Week 3 API 연동 후 속도·크기 스케일링 제거 예정 (백엔드에서 실제 volume 제공)

## 상권 유형 색상 토큰
흡수형_과열 `#E53935` · 흡수형_성장 `#FB8C00` · 방출형_침체 `#9E9E9E`
고립형_단절 `#424242` · 안정형 `#43A047`
색각 이상 대응: 색상 단독 금지, 아이콘/패턴 병행 필수 (FR-11)
`COMMERCE_COLORS` 각 항목에 `description` 필드 포함 — CommerceLegend에서 유형 설명 표시에 사용

## UI 설계 원칙 (디자인 정제 3단계)
- **상단 해설바**: Map 상단 고정 영역에 현재 선택값(시간·목적·밀도·유형)을 1문장으로 해설 (summaryFormatter.ts)
- **가시화 밀도**: FlowControlPanel에서 "흐름 강도" 대신 사용하는 용어. 슬라이더 아래에 "상위 N개 흐름 표시" 보조 문구 병기 필수
- **상권 영역 투명도**: 사용자 UI에서 제거. `App.tsx`의 `BOUNDARY_OPACITY = 0.2` 상수로 고정 (개발자 전용)
- **툴팁**: 상권명·유형·GRI·순유입·1줄 상태 해석 5요소 구성 (getNodeInterpretation)

## 주차별 목표
Week 1 (4/8~4/14):  React+Vite+MapLibre 스캐폴딩, 서울 행정동 경계 렌더링, 색상 토큰 정의
Week 2 (4/15~4/21): 상권 노드 레이어(크기=순유입, 색상=유형), OD 흐름 곡선(자치구 top-N)
Week 3 (4/22~4/28): 상권 클릭→상세 패널(GRI·폐업률·추세 그래프), 타임라인 슬라이더, 필터 UI
Week 4 (4/29~5/5):  흐름 단절 레이어 토글(점선+툴팁), 분기 비교 뷰(두 핸들), 접근성 수정
Week 5 (5/6~5/12):  발표 시나리오 애니메이션, 태블릿 반응형 최종 확인, 웹 데모 배포

## 성능 기준 (NFR)
지도 초기 로딩 ≤ 5초 (캐시 ≤ 3초) · 상권 클릭 반응 ≤ 1초 (캐시 ≤ 500ms)
OD 렌더링: 자치구 top-N 흐름만 표시 (전체 아님)

## 완료 기준 체크리스트
- [x] 상권 노드 색상·크기 인코딩 정확
- [x] 상세 패널 API 연동 동작 (demo mode 포함)
- [x] 타임라인 슬라이더 → 지도·패널 실시간 갱신
- [ ] 흐름 단절 레이어 토글 (기본 OFF)
- [ ] 색각 이상 시뮬레이션 통과
- [ ] 태블릿 반응형 확인 (패널 접기/펼치기)
- [ ] 지도 로딩 5초 이내 측정 완료

## 주의 사항
- 정책 추천 카드에 "규칙 기반 | 생성형 AI 미사용" 라벨 명시 (FR-07)
- 각 지표에 데이터 출처 아이콘 표시 (공공데이터포털 ID) (FR-06)
- 데이터 로딩 실패 시 "캐시 데이터로 표시 중" 안내 문구 표시
- MVP 범위: 강남구·관악구 2개 자치구 (서울 전역 아님)
- UX 검토 기준: 관악구 경제과 담당자 페르소나 (분기별 상권 동향 → 사업 우선순위 선정)
