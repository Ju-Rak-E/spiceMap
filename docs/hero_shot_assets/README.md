# Hero Shot 백업 자산

> 발표 라이브 실패 시 폴백 자산. `docs/hero_shot_scenario.md` 의 시간축과 1:1 매칭.
> 이 디렉토리는 자산 슬롯이며 실제 파일은 일정에 따라 생성한다.

## 자산 인벤토리

| 파일 | 시점 | 매칭 구간 | 촬영/제작 일자 | 위치 |
|------|------|----------|--------------|------|
| `00_intro.png` | 0:00 | InsightStrip 3칸 + B3 대비 카피 | D-8 (5/5) | 본 디렉토리 |
| `01_hero_silim_pulsing.png` | 0:30 | 신림 펄싱 + 강남 대비 색대비 | D-8 (5/5) | 본 디렉토리 |
| `02_panel_r4.png` | 1:00 | 패널 슬라이드-인 + R4 카드 노란 border | D-8 (5/5) | 본 디렉토리 |
| `03_csv_toast.png` | 1:45 | CSV 다운로드 toast + 첫 5행 ASCII | D-8 (5/5) | 본 디렉토리 |
| `04_validation_tab.png` | 2:30 | 검증 보고 탭 H1/H3/B1/B3 4카드 | D-8 (5/5) | 본 디렉토리 |
| `hero_shot_30s.mp4` | 0:00~0:30 | 30초 라이브 컷 영상 | D-7 (5/6) | **GWS**: `gdrive://QJC/미디어/영상/spiceMap_hero_30s.mp4` |

## 촬영 환경

- 진입 URL: `http://localhost:5173/?hero=1`
- 화면 비율: 1920 × 1080
- 줌 100%
- 캐시 데이터(`VITE_API_BASE_URL` 미설정) 또는 실데이터(API 연결) 둘 중 시연일 컨디션 좋은 쪽 선택
- 데이터 미적재 fallback: `mock_policy_insights.json` gw_001 R4 카드 사용

## 단축키 (라이브 실패 시 점프)

`?hero=1` 모드에서 입력 포커스가 없을 때 활성:
- `1` — 0:00 인트로 (선택 해제 + 지도 뷰)
- `2` — 0:30 신림 펄싱 + 패널 강제 오픈
- `3` — 1:30 CSV 다운로드 + toast
- `4` — 2:15 검증 보고 탭

## GWS 위치 정책

`.claude/rules/data-policy.md` 규정에 따라 영상(100MB+)은 GWS로 저장.
GitHub에는 경로 참조만 보관. 본 README가 그 참조이다.

## 후속 작업 (D-8/D-7)

```bash
# D-8 (5/5): PNG 5종 촬영
# 1. 백엔드 + 프론트 dev 서버 기동
docker-compose up -d
uvicorn backend.main:app --reload &
cd frontend && npm run dev &

# 2. 브라우저에서 ?hero=1 진입
open "http://localhost:5173/?hero=1"

# 3. 단축키 1~4 누르며 OS 스크린샷 (Cmd+Shift+4 영역) 5종 촬영
# 파일명: 00_intro.png ~ 04_validation_tab.png
# 저장: docs/hero_shot_assets/

# D-7 (5/6): 30초 영상 녹화
# OBS 또는 Mac 화면 녹화로 1920x1080@30fps 캡처
# 저장: GWS gdrive://QJC/미디어/영상/spiceMap_hero_30s.mp4
```
