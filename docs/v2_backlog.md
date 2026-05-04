# spiceMap v2 Backlog (발표 후 작업)

> 발표 (2026-05-12, v1.0) 이후 작업 우선순위. v1 의 Won't 결정·한계·자동화 잔여를 통합한다.
> 출처: `docs/strategy_d13.md` Won't / `docs/kpi_summary.md §5` 한계 / 본 ralph loop 중 식별된 갭.
> 형식: 우선순위 · 영역 · 한 줄 요약 · 근거.

---

## P0 — 데이터 정밀도 (학술/심사 신뢰성 직결)

| # | 작업 | 근거 | 추정 |
|---|------|------|------|
| 1 | `closure_rate` 상권 단위 직접 적재 (자치구 매핑 한계 해소) | `kpi_summary.md §5`, `verification_h2.md §6` 한계 1, H3 gap=0.746%p 의 절대값 미달 원인 | 1주 (자치구 → 업종/상권 분해 전수조사 + 회귀 테스트 갱신) |
| 2 | H2 실데이터 산출 + ValidationView H2 카드 갱신 | `scripts/run_validation_all.py` 동작 가능, Q4 flow_barriers 200 + Q4 closure 데이터 적재 완료 | 1h (DB 인증 + 실행 + JSON 반영) |
| 3 | OA-15576 정적 CSV 다운로드 + B1 Jaccard 재현 | `data/baselines/README.md` 절차, baseline_b1.py 함수 + 15 tests 준비됨. 현재 J=0.58 fixture 의 재현성 확보 | 2h |
| 4 | 업종 mix 통제 변수 추가 회귀 (H1 r=0.106 → 부분 효과 추정) | `qa_briefing.md` Q1 답변 — 단순 Pearson 의 한계 | 1주 (statsmodels 다중회귀 + 새 검증 가설 H1') |

## P1 — 분석 모듈 확장

| # | 작업 | 근거 | 추정 |
|---|------|------|------|
| 5 | Module C 풀 구현 (공간/네트워크 기반 흐름 단절) | `strategy_d13.md §2` 결정 A — 시계열 갭 대체. 도로/물리 장벽 데이터 추가 시 재구성 | 2주 |
| 6 | 정책 규칙 R1·R2·R3·R8 활성화 | `module_d_policy.py` 비활성 — flow_barriers / OD 다목적 / 시간대 / 외국인 데이터 활용 | 3일 |
| 7 | LLM 정책 카드 v2 (생성형 자연어 요약) | `kpi_summary.md §5` 한계, `csv_schema.md` v2 확장 — 현재 rule_based templated. FR-07 라벨 변경 필요 (`rule_based + llm_summary`) | 1주 |
| 8 | barrier_intensity 집계 sensitivity 분석 (max vs mean vs sum) | `verification_h2.md §3-1` 본 v1.0 max 단일 고정 | 2일 |
| 9 | Module C 시계열 갭 임계 sensitivity (decline 0.3/0.5/0.7) | `verification_h2.md §6` 한계 2 | 2일 |

## P2 — UI/UX 확장

| # | 작업 | 근거 | 추정 |
|---|------|------|------|
| 10 | 흐름 단절 레이어 토글 (점선 강조 + 툴팁) | prompt_plan.md Week 4 Dev-B | 3일 |
| 11 | 분기 비교 뷰 (두 핸들 슬라이더) | 동상 | 1주 |
| 12 | 색각 이상 시뮬레이션 + 수정 | 동상 | 3일 |
| 13 | 태블릿 반응형 정밀화 | 동상 | 1주 |
| 14 | LLM 정책 카드 본문 자연어 요약 (P1-7 후속 UI) | qjc-content 스킬 연계 가능 | 3일 |
| 15 | CSV export `format=xlsx` + `include=metrics` 옵션 | `csv_schema.md` v2 확장 | 2일 |

## P3 — 데이터 확장 (서울 전역 / 시계열 늘리기)

| # | 작업 | 근거 | 추정 |
|---|------|------|------|
| 16 | MVP 강남·관악 → 서울 25 자치구 확장 | `strategy_d13.md §1-1` Won't 결정 D — 시연 안정성 우선했음. v2 에서 해제 | 1주 (od_flows 80M → 800M, aggregate_od_flows.py cron 재실행) |
| 17 | 분기 시계열 늘리기 (2024Q1~2025Q4 → 8 분기) | 추세 분석 정확도 향상 | 3일 (Q3 Q4 패턴으로 타 분기 적재) |
| 18 | living_population 시간대 분기 집계 | 현재는 일자별 (분석 부적합) | 1주 |
| 19 | 임대료 데이터 결합 (R4 정밀도 향상) | `policy_report_gangnam_apgujeong.md §7` 한계 2 | 1주 (외부 데이터 협의) |

## P4 — 운영 / 인프라

| # | 작업 | 근거 | 추정 |
|---|------|------|------|
| 20 | 백엔드 클라우드 배포 (Render/Railway/Fly.io) + CORS 강화 | `deployment_guide.md §3` 옵션. 발표 시점은 정적 + demo mode 로 우회 | 2일 |
| 21 | Hero shot Playwright 자동 캡처 스크립트 | 본 ralph loop 보류 결정 — Playwright dependency 무거움 | 1일 |
| 22 | scripts/preflight_check.py `--mode all` (browser snapshot 포함) | 본 ralph loop 보류 결정 | 1일 |
| 23 | CI/CD GitHub Actions (pytest + vitest + build) | 현재 로컬 검증만 — 발표 후 v1.x patch release 부터 권장 | 2일 |
| 24 | Supabase RLS 정책 점검 + 익명 read 분리 | 현재 service_role 만 사용. 정책/심사관 직접 접근 시 | 3일 |

## P5 — 한계 / Backlog (v3+)

| # | 작업 | 근거 |
|---|------|------|
| 25 | 임대료 + 프랜차이즈 결합한 본격 H2 가설 (`verification_h3.py:5-7` 의 v1.0 대체 명시) | data/임대료 미연동 |
| 26 | 시점 lag 인과 추론 (Q3 단절 → Q5 폐업) | `verification_h2.md §6` 한계 3 |
| 27 | 페어 비대칭 단절 (from / to 분리 다중회귀) | 동상 한계 2 |
| 28 | 다른 광역시 확장 (부산/대구/인천 OA-22300 활용) | 서울 전역 (P3-16) 후속 |
| 29 | 정책 효과 사후 검증 (intervention → 분기 후 GRI 변화) | DiD/Synthetic Control 설계 필요 |
| 30 | 외국인 관광 활성 R8 모듈 + `in_forn_div` 활용 | `module_d_policy.py` R8 비활성 |

---

## 우선순위 매트릭스 (영향 vs 노력)

```
영향 ↑
높음 │ 1, 2, 3      │ 4, 5         │
     │ (P0 정밀도)  │ (1주~)       │
─────┼──────────────┼──────────────┤
중간 │ 6, 7, 10     │ 11, 16, 19   │
     │ (P1 모듈)    │              │
─────┼──────────────┼──────────────┤
낮음 │ 14, 15, 21   │ 23, 24, 28   │
     │ (UX 확장)    │              │
     └──────────────┴──────────────┘
        노력 →
       낮음          높음
```

## v1.0 발표 직후 첫 PR 후보 (D+1 ~ D+7)

1. **P0-2**: H2 실데이터 산출 + 카드 갱신 (1h, 즉시 효과)
2. **P0-3**: B1 정적 CSV 재현 (2h)
3. **P0-1**: closure_rate 상권 단위 적재 시작 (1주, 핵심 정밀도 향상)

위 3건이 끝나면 v1.1 patch release. 그 다음 P1·P2 항목 분기 단위 묶음.

## 관련 문서

- `docs/strategy_d13.md` §1-1 Won't 결정
- `docs/kpi_summary.md` §5 한계 5종
- `docs/verification_h2.md` §6 한계 4종
- `docs/qa_briefing.md` E·F 운영·기술 답변
- `prompt_plan.md` Week 4 잔여 (P2 영역)
