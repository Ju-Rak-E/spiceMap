# spiceMap 프론트엔드 (Dev-B)

서울 상권 인구·소비 흐름 네트워크 시각화 정책 지원 플랫폼  
**2026 서울시 빅데이터 활용 경진대회 시각화 부문**

## 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev
```

기본 개발 서버 주소는 `http://localhost:5173`입니다.

## 환경 변수

`frontend/.env.local` 파일에 아래 값을 설정합니다.

```env
VITE_VWORLD_API_KEY=발급받은_키
VITE_API_BASE_URL=http://localhost:8000
```

- `VITE_VWORLD_API_KEY`: V-World 베이스맵용
- `VITE_API_BASE_URL`: 백엔드 API 호출 기준 주소

## demo mode

현재 프론트는 `VITE_API_BASE_URL`이 없으면 자동으로 demo mode로 동작합니다.

- demo mode: `frontend/public/data/*.json` mock 데이터 사용
- API mode: 백엔드 호출 시도

2026-04-22 기준 주의사항:

- 안정적인 시연 경로는 demo mode입니다.
- 일부 프론트 타입/응답 가정이 백엔드 실제 응답과 아직 완전히 맞지 않습니다.
- 따라서 API mode는 연동 확인용에 가깝고, 추가 어댑터 작업이 필요합니다.

## 주요 명령어

```bash
npm run dev
npm run build
npm run preview
npm run test
npm run test:watch
npm run test:coverage
npm run lint
```

## 기술 스택

| 역할 | 라이브러리 |
|------|-----------|
| 프레임워크 | React 19 + Vite |
| 지도 | MapLibre GL |
| 시각화 | Deck.gl |
| 차트 | D3.js |
| 언어 | TypeScript |
| 테스트 | Vitest |

## 디렉토리 구조

```text
src/
├── components/   UI 컴포넌트
├── hooks/        데이터 페칭/상태 훅
├── layers/       Deck.gl 레이어
├── styles/       디자인 토큰
├── types/        프론트 타입 정의
└── utils/        필터/계산/데모 모드 유틸
```

## MVP 범위

- 대상 자치구: 강남구, 관악구
- 상권 유형 5종
  - 흡수형_과열
  - 흡수형_성장
  - 방출형_침체
  - 고립형_단절
  - 안정형

## 현재 구현 상태

### 구현됨

- 지도 렌더링
- 서울 행정경계 GeoJSON 오버레이
- 상권 노드 레이어
- OD 흐름 곡선 및 파티클 애니메이션
- 시간대 슬라이더
- 재생/일시정지/배속 제어
- 흐름 강도(top-N) 제어
- 자치구 필터
- 상권 유형 필터
- 상권 hover 툴팁
- 상권 클릭 상세 패널
- GRI 추세 차트
- 정책 추천 카드
- Vitest 단위 테스트

### 아직 남음

- 백엔드 실제 응답 형식과 프론트 타입 정합화
- `od/flows`, `insights/policy`, `barriers`, `export/csv` 실제 API 연동
- 분기 비교 뷰
- 흐름 단절 레이어 토글
- 발표용 시나리오 애니메이션 다듬기

## 주차별 목표

| 주차 | 기간 | 목표 |
|------|------|------|
| Week 1 | 4/8~4/14 | React+Vite+MapLibre 스캐폴딩, 행정경계 렌더링, 색상 토큰 |
| Week 2 | 4/15~4/21 | 상권 노드 레이어, OD 흐름 곡선 |
| Week 3 | 4/22~4/28 | 상세 패널, 타임라인 슬라이더, 필터 UI, API 계약 정리 |
| Week 4 | 4/29~5/5 | 흐름 단절 레이어 토글, 분기 비교 뷰 |
| Week 5 | 5/6~5/12 | 발표 시나리오 애니메이션, 반응형, 웹 데모 배포 |

## 성능 기준

- 지도 초기 로딩: 5초 이하
- 상권 클릭 반응: 1초 이하
