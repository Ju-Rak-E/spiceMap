# spiceMap 배포 가이드 (D-9 → D-1)

> 발표/심사용 웹 데모 호스팅 절차. **frontend 단독 정적 호스팅 (demo mode)** 을 기본 권장한다.
> Backend 까지 풀 호스팅은 옵션 — Supabase 연결 + CORS + RLS 추가 검증 비용 큼.

## 1. 권장 시나리오: Vercel 정적 + demo mode (D-2 30 분)

```
[빌드] frontend/npm run build → dist/
[배포] Vercel 정적 호스팅 (vercel.json 자동 인식)
[데이터] mock JSON + validation_results.json fixture (실 DB 미연결)
[Hero shot] ?hero=1 + 단축키 1~4 정상 작동 (demo mode 영향 없음)
```

### 1-1. 사전 준비

- Vercel 계정 (GitHub 로그인)
- V-World API 키 발급 (https://www.vworld.kr) — 도메인 등록 시 Vercel preview/production 도메인 추가

### 1-2. 절차

```bash
# 1. Vercel CLI 설치 (선택, 대시보드 import 도 가능)
npm i -g vercel

# 2. frontend 디렉토리 기준 배포
cd frontend
vercel

# 프롬프트:
#   Set up and deploy "frontend"? [Y/n]  Y
#   Which scope?                          (개인 계정)
#   Link to existing project?             N
#   Project name?                         spicemap (또는 임의)
#   In which directory is your code?      ./
#   Framework detected: Vite              (자동)
#   Override settings?                    N
```

배포 후 Preview URL 노출. 환경 변수는 Vercel 대시보드 Settings → Environment Variables 에서 `VITE_VWORLD_API_KEY` 만 등록 (다른 변수 미설정 → demo mode).

### 1-3. 시연 URL

- Preview: `https://spicemap-<hash>.vercel.app/?hero=1`
- Production: 후 promote 시 (D-1 권장).

## 2. 대안 시나리오: Netlify 정적

`frontend/netlify.toml` 자동 인식. Netlify 대시보드에서 GitHub repo 연결 → Site settings → Environment variables 에서 V-World 키 등록.

## 3. 풀 백엔드 호스팅 (옵션)

### 3-1. 권장 스택

- **Backend**: Render / Railway / Fly.io (FastAPI + Redis)
- **DB**: 기존 Supabase (`clyqvncpcfyfljbqgdig`) 그대로
- **CORS**: 배포 frontend 도메인 명시

### 3-2. 백엔드 환경 변수

```bash
DB_HOST=aws-1-ap-northeast-2.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.clyqvncpcfyfljbqgdig
DB_PASSWORD=<팀장 발급>
REDIS_URL=<Render Redis URL>
PUBLIC_DATA_API_KEY=<선택, 정기 수집 cron 시>
SEOUL_API_KEY=<선택>
```

### 3-3. CORS 추가 (frontend 도메인)

`backend/main.py` 의 CORSMiddleware allow_origins 에 배포 도메인 추가:

```python
allow_origins=[
    "http://localhost:5173",
    "https://spicemap-*.vercel.app",
    "https://spicemap.example.com",
]
```

### 3-4. frontend 환경 변수 갱신

Vercel 대시보드에서 `VITE_API_BASE_URL=https://<backend host>` 추가 → re-deploy.

## 4. 시연 안전 점검 (D-1)

| 항목 | 확인 방법 |
|------|----------|
| Vercel/Netlify URL 응답 200 | `curl -I https://<url>` |
| `?hero=1` 진입 시 펄싱 작동 | 브라우저 5 초 후 신림 halo |
| 단축키 `1`~`4` 작동 (modifier 없이) | 키보드 입력 |
| ValidationView 5 카드 노출 | 단축키 `4` |
| CSV 다운로드 (CSV toast) | 단축키 `3` |
| V-World 지도 타일 로딩 | 강남·관악 폴리곤 가시 |
| mock_commerce.json 로드 (demo mode 시) | DevTools Network |

라이브 실패 백업: `docs/hero_shot_assets/hero_shot_30s.mp4` 즉시 재생 (`docs/hero_shot_scenario.md` §5).

## 5. 빌드 검증

배포 전 로컬에서:

```bash
cd frontend
npm run build      # tsc -b + vite build (dist/ 생성)
npm run preview    # Vercel 환경 시뮬레이션 (localhost:4173)
```

현재 빌드 사이즈: 2.0 MB (gzip 562 KB). `vite-reporter` 가 청크 분리 권장 — 발표용 단일 페이지 SPA 라 우선순위 낮음.

## 6. 잘못된 도메인 / API 키 troubleshooting

- **V-World 키 도메인 불일치** → 지도 회색 화면. 콘솔 401 / 403. Vercel 도메인을 V-World 대시보드에 추가.
- **demo mode 인데 API 호출 시도** → `frontend/src/utils/demoMode.ts:isDemoMode()` 가 `VITE_API_BASE_URL` 비어 있으면 자동 mock fallback. 환경 변수 미설정 확인.
- **TypeScript 빌드 실패** → `tsc -b` 로 재현. PR `0d8feda` (InsightStrip light theme fix) 회귀 여부 확인.

## 7. 배포 일정 권장

| 일자 | 작업 |
|------|------|
| D-3 (5/9) | Vercel preview 배포 + V-World 도메인 등록 |
| D-2 (5/10) | 시연 영상 녹화 (preview URL 사용) |
| D-1 (5/11) | Production promote + 라이브 점검 |
| D-day (5/12) | 발표 (preview/production 모두 가용 상태 유지) |
