# Dev-B 보고 — D-8 시점 프론트엔드 진행 보고 (2026-05-04)

> 작성: 김광오 (Dev-C, @pangvelop)
> 수신: Dev-B (프론트엔드 담당)
> 마감: 2026-05-12 (D-day)
> 근거: `docs/hero_shot_scenario.md` v1.1 · `docs/deployment_guide.md` · 본 브랜치 13 커밋 (`feature/d9-validation-coverage`)

---

## 슬랙/디스코드용 (짧은 DM)

```
디비님, 김광오입니다. D-8 시점 프론트엔드 영역 진행 정리 공유드립니다.

[추가/완료 — Dev-C 가 진행]
- ValidationView 컴포넌트 신규 (검증 보고 5카드 H1·H2·H3·B1·B3, auto-fit grid)
- Hero shot 시연 모드 정밀화 (?hero=1 + 단축키 1~4 + 펄싱·R4 강조·CSV toast)
- Hero pulse 1.5s halo helper 추출 + 7 단위 테스트 (createHeroPulseLayer + computeHeroPulseFrame)
- ValidationView 8 / PolicyCard 10 단위 테스트 추가 (vitest 178 → 203, +25)
- frontend build 2.0MB / gzip 562KB OK / tsc -b 통과
- Vercel/Netlify 배포 설정 + .env.production.example 작성

[Dev-B 잔여 작업 — D-1까지]
1) Hero shot PNG 5종 캡처 (브라우저 + ?hero=1 + 단축키)
2) Vercel preview 배포 (D-3, 5/9) — V-World 도메인 등록 필요
3) 시연 영상 녹화 (D-2~D-1, 5/10~11)
4) 흐름 단절 레이어 토글 / 분기 비교 뷰 / 색각 시뮬 / 태블릿 반응형 (Week 4 잔여)

상세는 docs/team_report_dev_b_d8.md 참조. 도움 필요하신 부분 알려주세요.
```

---

## 상세 메시지 (이메일/노션 게시용)

### 1. Dev-C 가 추가/완료한 프론트엔드 영역 (D-9 ~ D-8, 13 커밋)

#### 컴포넌트 신규/확장

| 컴포넌트 | 변경 | 커밋 |
|---------|------|------|
| `ValidationView.tsx` (신규) | 검증 보고 탭 5카드 (H1·H2·H3·B1·B3) auto-fit grid + 백엔드 fetch + 정적 fallback | `2e75fce` `1288ca1` |
| `Map.tsx` | `heroNodeId` prop + heroPulseRef + handleFrame 통합 | `b763b20` |
| `CommerceDetailPanel.tsx` | usePolicyInsights 호출 + 정책카드 섹션 + R4 우선 정렬 | `b763b20` |
| `PolicyCard.tsx` | `highlight` prop (노란 outline + fadeIn 300ms) | `b763b20` |
| `FlowControlPanel.tsx` | csvToast 상태 + `data-testid="hero-csv-export"` | `b763b20` |
| `InsightStrip.tsx` | `colors` 타입 union 확장 (light theme 호환 fix) | `0d8feda` |
| `App.tsx` | `?hero=1` 토글 + view 토글(map/validation) + 단축키 1~4 | `b763b20` |
| `index.css` | `heroPolicyFadeIn` keyframe | `b763b20` |

#### 레이어/유틸

| 파일 | 변경 |
|------|------|
| `layers/CommerceNodeLayer.ts` | `createHeroPulseLayer` 1.5s halo (`?hero=1` 시 전 zoom 가시) + `computeHeroPulseFrame` helper 분리 (단위 테스트 가능) |
| `data/validation_results.json` (신규) | H1/H2/H3/B1/B3 5카드 fixture (정적 fallback) |

#### 컴포넌트 회귀 강화 (단위 테스트 +25)

| 테스트 | 항목 |
|--------|------|
| `ValidationView.test.tsx` | 헤더 부제, 5카드 ID, H1 r=0.106 / H2 산출 대기 / B1 J=0.58 / B3 J=0.151, onClose, 출처 |
| `PolicyCard.test.tsx` | highlight 동작, fadeIn animation, 노란 outline, priority 아이콘 4종, rule_based 라벨 (FR-07) |
| `heroPulse.test.ts` | phase/radius/alpha 계산 정확도, multi-cycle wrap, monotonic 검증, null target |

vitest 결과: **178 → 203 (+25)**, 22 → 23 test files.

### 2. 배포 인프라 (정적 호스팅 즉시 가능)

| 파일 | 용도 |
|------|------|
| `frontend/vercel.json` | Vite framework 자동 인식 + SPA rewrites + 정적 자산 캐시 (1년 immutable / 5분) |
| `frontend/netlify.toml` | 동등 SPA fallback + NODE_VERSION 20 |
| `frontend/.env.production.example` | VITE_VWORLD_API_KEY (필수) / VITE_API_BASE_URL (선택, 미설정 시 demo mode) / VITE_USE_DEMO_POLICY |
| `docs/deployment_guide.md` | Vercel 정적 + demo mode 권장 시나리오 / Netlify 대안 / 풀 백엔드 옵션 / D-3·D-2·D-1 일정 / 시연 안전 점검표 / troubleshooting |

#### 권장 배포 시나리오 (D-3, 5/9)

```bash
cd frontend
vercel
# 프롬프트:
#   Set up and deploy?       Y
#   Project name?            spicemap
#   Framework detected: Vite (자동)
#   Override settings?       N
```

배포 후 Preview URL 노출. Vercel 대시보드 Settings → Environment Variables 에서 `VITE_VWORLD_API_KEY` 만 등록 (다른 변수 미설정 → demo mode).

### 3. Hero shot 시연 모드 (`?hero=1` + 단축키 1~4)

#### 진입

```
http://localhost:5173/?hero=1
또는 https://spicemap-xxx.vercel.app/?hero=1
```

#### 동작

| 키 | 동작 | App.tsx 위치 |
|----|------|--------------|
| 클릭 1 (진입) | 강남·관악 자동 줌 + 신림 (`gw_001`) 펄싱 halo (1.5s 주기, 14→34px 금색) | `App.tsx:47-48` |
| 단축키 `1` | 인트로 (selectedNode=null, view='map') | `App.tsx:89` |
| 단축키 `2` | 신림 펄싱+패널 (gw_001 클릭 시뮬) → R4 정책카드 노란 outline + fadeIn | `App.tsx:90` |
| 단축키 `3` | CSV export + toast 3초 노출 | `App.tsx:97` (data-testid=hero-csv-export) |
| 단축키 `4` | 검증 보고 탭 (ValidationView 5카드) | view 토글 |

modifier (Alt/Cmd/Ctrl) 누르면 단축키 비활성 — `App.tsx:81`. (이전 `Cmd+1~4` 표기 오류 v1.1 정정)

#### 시간축 (3분 발표)

| 구간 | 내용 | 대사 풀 |
|------|------|--------|
| 0:00~0:30 | 가치 명제 + 강남·관악 대비 | A-1 (28초, 권장) / A-2 / A-3 |
| 0:30~1:30 | Hero — 신림 (Q3→Q4 -38%, 폐업 +4.2%p, GRI 78) | B-1 (58초, 권장) / B-2 / B-3 |
| 1:30~2:15 | 정책 활용 (R4 카드 + CSV) | C-1 (42초, 권장) / C-2 / C-3 |
| 2:15~3:00 | 분석 신뢰 (H1·H2·H3·B1·B3 5카드) | D-1 (42초, 권장) / D-2 / D-3 |

상세: [`docs/hero_shot_scenario.md`](hero_shot_scenario.md) v1.1.

### 4. Dev-B 잔여 작업 (D-1 까지)

#### 즉시 (D-7 ~ D-3)

| # | 작업 | 마감 | 비고 |
|---|------|------|------|
| 1 | **Hero shot PNG 5종 캡처** | D-7 (5/5) | `docs/hero_shot_assets/README.md` D-8/D-7 절차. 진입 / 펄싱 / R4 카드 / CSV toast / 검증 5카드 = 5장 |
| 2 | **Vercel preview 배포** | D-3 (5/9) | V-World API 도메인 등록 필요 (https://www.vworld.kr). Vercel CLI 1회 또는 GitHub import |
| 3 | **시연 안전 점검** | D-3 ~ D-1 | `python -m scripts.preflight_check --mode remote --base-url https://<vercel-url>` |

#### 시연 영상 녹화 (D-2 ~ D-1, 5/10~5/11)

- **30초 컷**: A-3 + B-3 + C-3 + D-3 = 18+38+22+24 = 102초 (단축안). 라이브 백업으로도 사용.
- **3분 풀**: A-1 + B-1 + C-1 + D-1 = 28+58+42+42 = 170초.
- 녹화 도구: OBS Studio / QuickTime Screen Recording.
- 출력: `docs/hero_shot_assets/hero_shot_30s.mp4` + 풀 영상 별도.
- 백업 트리거: 라이브 실패 시 즉시 영상 재생 (`hero_shot_scenario.md` §5).

#### Week 4 Dev-B 미완료 (D-day 후 v1.1 으로 이전 가능)

| 항목 | 우선순위 |
|------|--------|
| 흐름 단절 레이어 토글 (점선 강조 + 툴팁) | P2 (v2 backlog #10) |
| 분기 비교 뷰 (두 핸들 슬라이더) | P2 (v2 backlog #11) |
| 접근성 검토 (색각 이상 시뮬레이션) + 수정 | P2 (v2 backlog #12) |
| 태블릿 반응형 정밀화 | P2 (v2 backlog #13) |

발표 후 v1.1 patch 또는 v2 일정. 발표 전 무리해서 추가 안 해도 안전 (Hero shot 시연이 데스크톱 기준).

### 5. 협의 사항 3 건

1. **V-World API 도메인 등록**
   - https://www.vworld.kr 대시보드에서 Vercel preview/production 도메인을 V-World 키에 추가.
   - 미등록 시 지도 회색 화면 (콘솔 401/403). troubleshooting: `docs/deployment_guide.md §6`.

2. **시연 도구 / 환경 협의**
   - 데스크톱 1920×1080 / Chrome 또는 Edge 권장.
   - 발표 노트북에 V-World 도메인 추가된 키 사전 설정.
   - **회신 부탁: D-3 까지 시연 환경 (브라우저 / 해상도 / 백업 영상 위치) 알려주세요.**

3. **30초 컷 영상 채택안**
   - 현 시나리오 §3 D-1 (권장) vs D-3 (최단). Dev-B 가 녹화 후 결정.
   - 녹화 시점 결정 후 Dev-C 에게 공유 → KPI 게이트 점검 (`hero_shot_scenario.md` §6).

### 6. 시연 안전 점검 (D-1 자동)

```bash
# 오프라인 31 항목 (파일/구성)
python -m scripts.preflight_check --mode files

# 배포 URL 점검 (브라우저 단계는 수동)
python -m scripts.preflight_check --mode remote --base-url https://<vercel-url>
```

발표 직전 통과 필요 (`hero_shot_scenario.md` §6 KPI 게이트):
- [ ] commerce_analysis ≥ 1,500/1,650 — 현재 Q3 1,650 적재됨
- [ ] policy_cards ≥ 30 — 현재 Q3 419 적재됨
- [ ] flow_barriers ≥ 50 — 현재 Q4 200 적재됨
- [ ] H1 r 통계 유의 — r=0.106, p<0.0001 (방향성 지지)
- [ ] H3 방향성 강함 — gap 0.75%p, 14.5배 격차
- [ ] B1 Jaccard ≥ 0.5 — J=0.58 PASS
- [ ] 라이브 동선 4클릭 30초 컷 이내
- [ ] 백업 자산 5종(PNG) + 30초 영상 + 단축키 `1`~`4` 작동 ⏳ Dev-B 캡처 후

### 7. 감사 + 마무리

PR #19 (상세 패널 API 연동), PR #32 (가치 명제 헤더 2단 + 자동 줌), 그리고 Hero shot precision (PR `b763b20`) 까지 프론트 영역 완성도 끌어올려 주신 덕에 발표 시연 동선이 명확해졌습니다. D-day 까지 남은 PNG 캡처 + 영상 + 배포만 안전하게 진행되면 Dev-C 측 잔여 (Q4 실측 산출 + JSON 갱신, 30분) 와 함께 100% 완성됩니다.

D-3 시연 환경 협의 + D-1 영상 점검 메시지 다시 드릴게요.

감사합니다.
김광오
