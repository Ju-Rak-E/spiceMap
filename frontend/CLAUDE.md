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
`frontend/src/components/` UI 컴포넌트 (Map, AdminBoundaryLayer, FlowControlPanel)
`frontend/src/layers/` Deck.gl 레이어 정의 (CommerceNodeLayer, ODFlowLayer, FlowParticleLayer)
`frontend/src/hooks/` 데이터 페칭 훅 (useCommerceData, useFlowData, useAnimationFrame)
`frontend/src/styles/` 디자인 토큰 (색상 팔레트)
`frontend/src/types/` 공유 타입 정의 (CommerceNode 등)
`frontend/src/utils/` 유틸리티 (GRI 계산, BoundaryLayerManager)

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

## 상권 유형 색상 토큰
흡수형_과열 `#E53935` · 흡수형_성장 `#FB8C00` · 방출형_침체 `#9E9E9E`
고립형_단절 `#424242` · 안정형 `#43A047`
색각 이상 대응: 색상 단독 금지, 아이콘/패턴 병행 필수 (FR-11)

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
- [ ] 상권 노드 색상·크기 인코딩 정확
- [ ] 상세 패널 API 연동 동작
- [ ] 타임라인 슬라이더 → 지도·패널 실시간 갱신
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
