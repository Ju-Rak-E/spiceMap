# spiceMap — 프론트엔드 (Dev-B)

서울 상권 인구·소비 흐름 네트워크 시각화 정책 지원 플랫폼  
**2026 서울시 빅데이터 활용 경진대회 — 시각화 부문**

## 실행 방법

```bash
# 의존성 설치 (처음 한 번만)
npm install

# 개발 서버 시작
npm run dev
# → http://localhost:5173
```

### 환경 변수

`frontend/` 디렉토리에 `.env.local` 파일 생성 후 아래 값 설정:

```env
VITE_VWORLD_API_KEY=발급받은_키
```

> V-World API 키: https://www.vworld.kr (회원가입 → API 신청)

## 주요 명령어

```bash
npm run dev           # 개발 서버 (HMR)
npm run build         # 프로덕션 빌드
npm run preview       # 빌드 결과 미리보기
npm run test          # 테스트 실행 (vitest)
npm run test:watch    # 테스트 워치 모드
npm run test:coverage # 커버리지 포함 테스트
npm run lint          # ESLint 검사
```

## 기술 스택

| 역할 | 라이브러리 |
|------|-----------|
| 프레임워크 | React 19 + Vite |
| 베이스 지도 | MapLibre GL |
| 흐름 시각화 | Deck.gl (OD 곡선, 상권 노드) |
| 차트 | D3.js (GRI 추세, 시계열) |
| 언어 | TypeScript |
| 테스트 | Vitest |

## 디렉토리 구조

```
src/
├── components/     # UI 컴포넌트 (Map, AdminBoundaryLayer, ...)
├── layers/         # Deck.gl 레이어 정의
├── hooks/          # 데이터 페칭 훅
├── styles/         # 디자인 토큰 (색상 팔레트)
└── utils/          # 유틸리티 (GRI 계산 등)
```

## MVP 범위

- 대상 자치구: **강남구·관악구** 2개 (서울 전역 아님)
- 상권 유형 5종: 흡수형_과열 / 흡수형_성장 / 방출형_침체 / 고립형_단절 / 안정형

## 주차별 목표

| 주차 | 기간 | 목표 |
|------|------|------|
| Week 1 | 4/8~4/14 | React+Vite+MapLibre 스캐폴딩, 행정동 경계 렌더링, 색상 토큰 |
| Week 2 | 4/15~4/21 | 상권 노드 레이어, OD 흐름 곡선 |
| Week 3 | 4/22~4/28 | 상권 클릭→상세 패널, 타임라인 슬라이더, 필터 UI |
| Week 4 | 4/29~5/5  | 흐름 단절 레이어 토글, 분기 비교 뷰 |
| Week 5 | 5/6~5/12  | 발표 시나리오 애니메이션, 반응형, 웹 데모 배포 |

## 성능 기준

- 지도 초기 로딩: **≤ 5초** (캐시 시 ≤ 3초)
- 상권 클릭 반응: **≤ 1초** (캐시 시 ≤ 500ms)
