# spiceMap 문서 인덱스

> 문서 카테고리별 정리
> 최종 갱신: 2026-05-03 (D-9, Week 4 Day 5)

---

## 기획 / 요구사항

| 문서 | 설명 |
|------|------|
| [FR_Role_Workflow.md](FR_Role_Workflow.md) | 기능·요구사항·5주 일정 포괄 spec |
| [../prompt_plan.md](../prompt_plan.md) | 주차별 진행 체크리스트 |

## 데이터 설계

| 문서 | 설명 |
|------|------|
| [schema.md](schema.md) | DB 스키마 (테이블·컬럼·데이터셋 OA-ID) |
| [spatial_join_design.md](spatial_join_design.md) | 행정동↔상권 공간 결합 (폴리곤 교차 면적 기준) |
| [time_alignment_design.md](time_alignment_design.md) | 월별→분기 시계열 정렬 |

## 분석 설계 (Module A~E)

| 문서 | 설명 |
|------|------|
| [module_a_design.md](module_a_design.md) | Module A — 상권 흐름 유향 그래프 |
| [gri_formula.md](gri_formula.md) | Module B — GRI v1.0 공식 |
| [module_d_design.md](module_d_design.md) | Module D — 규칙 기반 정책 추천 (8 규칙) |
| [module_e_design.md](module_e_design.md) | Module E — 정책 우선순위 점수 (0.60 GRI + 0.25 size + 0.15 trend) |
| [week2_implementation_plan.md](week2_implementation_plan.md) | Module A/B + H1 구현 계획 (완료) |
| [week3_implementation_plan.md](week3_implementation_plan.md) | Module E 설계 + Module D R4~R7 구현 계획 |
| [od_flows_aggregation.md](od_flows_aggregation.md) | od_flows 분기 집계본 스키마·집계 SQL·Module A 어댑터 |

> Module C 풀 구현은 시계열 갭 알고리즘으로 대체 (`backend/analysis/module_c_barriers.py:80-139`, strategy_d13.md §2 결정 A).

## API / UI 설계

| 문서 | 설명 |
|------|------|
| [api_spec.md](api_spec.md) | FastAPI 엔드포인트 명세 |
| [map_ui_redesign.md](map_ui_redesign.md) | 지도 UI 디자인 정제 3단계 |

## 의사결정 기록

| 문서 | 설명 |
|------|------|
| [week2_decisions.md](week2_decisions.md) | Week 2 의사결정 (적재 주체, GRI 가중치, Centrality 단계) |

## 리포트

| 문서 | 설명 |
|------|------|
| [data_quality_report.md](data_quality_report.md) | 데이터 품질 검토 리포트 (2026-04-15) |
| [quarter_coverage_report.md](quarter_coverage_report.md) | 분기 커버리지 실측 (2026-04-22) |

## 발표 산출물 (D-9, 2026-05-03)

| 문서 | 설명 |
|------|------|
| [preview/hero_shot_scenario.md](preview/hero_shot_scenario.md) | 3 분 발표 시간축 (단일 진실 문서) |
| [preview/demo_storyline_gangnam_gwanak.md](preview/demo_storyline_gangnam_gwanak.md) | 강남·관악 중심 3분 시연 영상 촬영 대본 |
| [preview/hero_shot_assets/README.md](preview/hero_shot_assets/README.md) | PNG/MP4 자산 인벤토리 |
| [data_integration_diagram.md](data_integration_diagram.md) | 데이터 결합 구조도 (Mermaid) |
| [kpi_summary.md](kpi_summary.md) | KPI / 검증 결과 표 1 장 |
| [qa_briefing.md](qa_briefing.md) | 발표 Q&A 13 종 대응 자료 |
| [policy_report_gangnam_apgujeong.md](policy_report_gangnam_apgujeong.md) | 강남 압구정 정책 리포트 (R4 젠트리피케이션) |
| [policy_report_gwanak_sillim.md](policy_report_gwanak_sillim.md) | 관악 신림 정책 리포트 (R4 흐름 단절 회복) |
| [strategy_d13.md](strategy_d13.md) | D-13 수상 전략 + 실용성 강화 플랜 |
| [verification_h2.md](verification_h2.md) | H2 가설 검증 설계 (흐름 단절 → 폐업 상관) |
| [deployment_guide.md](deployment_guide.md) | 발표/심사용 웹 데모 배포 (Vercel/Netlify 정적 + 풀 옵션) |
| [api_openapi.json](api_openapi.json) | FastAPI app.openapi() 정적 export (8 경로, scripts/export_openapi.py) |
| [csv_schema.md](csv_schema.md) | `/api/export/csv` 9 컬럼 스키마 + 활용 시나리오 |
| [v2_backlog.md](v2_backlog.md) | 발표 후 v2 작업 P0~P5 (30 항목, 우선순위 매트릭스) |
| [PR_DRAFT.md](PR_DRAFT.md) | PR 본문 템플릿 (옵션 A/B 머지 전략) |
| [../CHANGELOG.md](../CHANGELOG.md) | Keep a Changelog 형식 변경 이력 |

## 작업 이력 / 에스컬레이션

| 문서 | 설명 |
|------|------|
| [dev_a_escalation_draft.md](dev_a_escalation_draft.md) | Dev-A 블로커 해제 요청 메시지 초안 (D-9 patch 포함) |
| [team_report_dev_a_d8.md](team_report_dev_a_d8.md) | Dev-A D-8 진행 보고 (적재 완료 + 협의 3건) |
| [team_report_dev_b_d8.md](team_report_dev_b_d8.md) | Dev-B D-8 진행 보고 (Hero shot + 배포 + 잔여 작업) |

## 브레인스토밍

| 문서 | 설명 |
|------|------|
| [brainstorm_pm.md](brainstorm_pm.md) | PM 관점 아이디어 |
| [brainstorm_qa.md](brainstorm_qa.md) | QA 관점 아이디어 |
| [brainstorm_user.md](brainstorm_user.md) | 사용자 관점 아이디어 |

## 설계 명세 아카이브

- [superpowers/specs/](superpowers/specs/) — brainstorming 결과물 설계 문서
