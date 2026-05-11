# 3D뷰 UX 개선 계획 — "한눈에 보이게"

> 작성일: 2026-05-10 (Week 5 Day 2 / D-5)
> 담당: Dev-B (kbh)
> 상태: ✅ 사용자 승인 완료, 구현 대기

---

## 배경

현재 `ThreeDViewControl.tsx` + `use3DView.ts` 기반의 3D뷰는 기능적으로 동작하지만, **정책 담당자(페르소나: 관악구 경제과)가 5초 안에 무엇을·어떻게 해석해야 할지 파악하기 어렵다**.

### 사용자 시점 진단

| # | 문제 | 사용자 시점 |
|---|---|---|
| 1 | 3D 진입 버튼이 안 보임 | 우하단 작은 패널 — "이 앱에 3D가 있는지조차" 모름 |
| 2 | 모드 명칭이 어려움 | "자치구 3D" vs "상권 3D" 차이 즉시 안 잡힘 |
| 3 | 높이 의미 자동 노출 부재 | 막대가 솟아도 "80점 = 위험 상위 20%"가 안 떠 있음 |
| 4 | 컨트롤 중복 | 드롭다운 + 픽토그램 그리드가 같은 4지표를 두 번 표현 |
| 5 | 회전·기울기 안내 없음 | 마우스 드래그로 회전 가능한지 모름 |
| 6 | 색상 정보 부족 | 높이로만 인코딩 — 위험/추천 색이 동시에 안 들어옴 |
| 7 | 모바일 미지원 | `width >= 520` 가드로 컨트롤 자체 사라짐 |
| 8 | OFF 상태에 영구 표시 | 안 쓰는 동안에도 우하단 자리 차지 |

---

## 목표

- 진입 비용 ↓ — 어디 누르는지 즉시 보임
- 의미 해석 비용 ↓ — 높이=무엇, 색=무엇이 화면에 떠 있음
- 조작 비용 ↓ — 회전/리셋 안내, 원클릭 프리셋

---

## 구현 단계

### Phase 1: 진입점 개선 — 3D 토글의 발견성

**File: `frontend/src/components/ThreeDViewControl.tsx`**

- OFF 상태일 때: **둥근 FAB** 1개만 표시
  - 56×56 원형 버튼 + isometric 빌딩 SVG 아이콘 + "3D로 보기" 라벨
  - 기존 196px 패널 → FAB로 축소
- ON 상태일 때만: 풀 컨트롤 패널 펼침
- 위치: bottom-right 유지, **모바일에서도 표시** (320×56 변형)

**File: `frontend/src/components/Map.tsx` L1195**
- `containerSize.width >= 520` 가드 → 모바일에서 FAB만 표시하도록 분기

### Phase 2: 모드 라벨 일상어로 변경

| 현재 | 변경 |
|---|---|
| OFF | 평면으로 |
| 자치구 3D | 자치구별 비교 |
| 상권 3D | 상권별 상세 |

**File: `ThreeDViewControl.tsx` `MODE_LABELS`**
- 보조 설명 1줄 추가:
  - "자치구별 비교 — 25개 구를 한눈에"
  - "상권별 상세 — 줌인해서 보세요"

### Phase 3: 자동 노출 범례 — "높이가 뭘 의미하나"

**새 파일: `frontend/src/components/ThreeDLegend.tsx`**

3D 활성 시 좌하단 자동 표시:
```
┌─────────────────────────┐
│ 막대 높이 = 상권 위험도 │
│                         │
│  ▮ 95점 (상위 5%)       │
│  ▮ 70점                 │
│  ▮ 40점                 │
│  ▯ 0점 (가장 안전)      │
│                         │
│ 💡 마우스 드래그로 회전 │
└─────────────────────────┘
```
- 실제 데이터의 min/max 기반 동적 스케일
- 4초 후 자동 축소 (작은 라벨로)
- 메트릭 변경 시 다시 펼침

### Phase 4: 컨트롤 단순화 — 드롭다운 제거

**File: `ThreeDViewControl.tsx` L94-114**
- `<select>` 제거 (픽토그램 그리드와 중복)
- 픽토그램 그리드 카드 72px → 90px로 확대
- 메트릭당 한 줄 한글 설명 추가:
  - "상권 위험도 — 매출↓·폐업↑ 종합"
  - "순유입 인구 — 들어온−나간 사람"
  - "폐업률 — 최근 분기 종업"
  - "연결 중심성 — 다른 상권과 연결도"

### Phase 5: 카메라 회전·리셋 가이드

**File: `ThreeDViewControl.tsx`**
- 패널 하단 액션 2개 추가:
  - `↻ 정면 보기` — pitch 45 → 0으로 일시 평면화
  - `🎯 강남·관악 다시 맞추기` — `flyTo({ center: [127.0, 37.49], zoom: 11.5 })`
- 첫 활성 시 1회 toast: "지도를 우클릭+드래그하면 회전합니다"
  - localStorage 키: `spice.3d.rotation_hint_seen`

### Phase 6: 색상 동시 인코딩 (옵셔널)

**File: `frontend/src/layers/AdminPolygonExtrusionLayer.ts`, `PolygonExtrusionLayer.ts`**
- 현재: 높이로만 메트릭 표현, fill은 단색
- 변경: 높이 + 색상 그라데이션
  - `griScore`: 안전 #66BB6A → 경고 #FFA726 → 위험 #EF5350
- 색맹 대응: 높이라는 redundant channel 존재 → 안전

### Phase 7: 검증

- `ThreeDViewControl.test.tsx` 갱신: FAB / 펼친 모드 분기
- `use3DView.test.ts` 행동 변경 없음 — 유지
- 신규 `ThreeDLegend.test.tsx`: 동적 스케일, 자동 축소 타이머
- Playwright e2e (선택): FAB → 펼침 → 메트릭 변경 → legend 갱신

---

## 의존성

- 기존 `interpolateProgress`, `MetricPictogram`, `MAP_THEME` 토큰 재사용
- 신규 외부 의존성 없음
- localStorage 플래그: `spice.3d.rotation_hint_seen`

## 리스크

| 등급 | 리스크 | 완화책 |
|---|---|---|
| MEDIUM | 색상 인코딩(Phase 6) 추가 시 boundary fill과 시각 충돌 | Phase 6 옵셔널 — 5까지 머지 후 별도 PR로 검토 |
| MEDIUM | FAB가 단절 패널·클러스터 패널과 z-index 충돌 (현 z=15) | bottom-right 16px gap, 단절 패널은 left 영역 — 검증 필요 |
| LOW | Hero shot 시연 영상이 기존 3D 컨트롤 캡처 사용 중 | 시연 영상 재촬영 시 D-5 일정 영향 — 사전 확인 필요 |
| LOW | `containerSize.width >= 520` 가드 제거 시 모바일 레이아웃 깨짐 | 320×56 FAB 변형 별도 분기 |

## 복잡도 추정

| Phase | 작업 | 시간 |
|---|---|---|
| 1 | FAB | 1.5h |
| 2 | 라벨 | 0.5h |
| 3 | Legend | 2h |
| 4 | 드롭다운 제거 | 0.5h |
| 5 | 가이드 | 1h |
| 6 | 색상 (옵셔널) | 2h |
| 7 | 테스트 | 1.5h |
| | **합계** | **6.5~8.5h** |

## 우선순위

D-5 일정 고려 시 **Phase 1 + 2 + 3 + 4가 핵심** (약 4시간). Phase 5-6은 시간 여유 있을 때.

---

## 다음 액션

1. `/tdd` — TDD 방식으로 Phase 1부터 구현
2. 또는 `/auto` — 한 번에 자동 실행
3. Hero shot 영향도 확인 필요 시 `docs/preview/hero_shot_scenario.md` 사전 검토
