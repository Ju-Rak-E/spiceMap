# spiceMap 문서 인덱스

> 문서 카테고리별 정리
> 최종 갱신: 2026-04-21

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

> Module C (흐름 단절 탐지) 설계 문서는 `od_flows` 적재 후 추가.

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

## 작업 이력 / 에스컬레이션

| 문서 | 설명 |
|------|------|
| [dev_a_escalation_draft.md](dev_a_escalation_draft.md) | Dev-A 블로커 해제 요청 메시지 초안 |

## 브레인스토밍

| 문서 | 설명 |
|------|------|
| [brainstorm_pm.md](brainstorm_pm.md) | PM 관점 아이디어 |
| [brainstorm_qa.md](brainstorm_qa.md) | QA 관점 아이디어 |
| [brainstorm_user.md](brainstorm_user.md) | 사용자 관점 아이디어 |

## 설계 명세 아카이브

- [superpowers/specs/](superpowers/specs/) — brainstorming 결과물 설계 문서
