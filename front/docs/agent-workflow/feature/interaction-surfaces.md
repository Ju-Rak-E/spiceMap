# Feature: Interaction Surfaces

## Goal
- agent 산출물이 어떤 UI surface에 매핑되는지 정의
- front는 render surface 기준으로 contract를 분리 소비한다

## Surfaces
| Surface | Primary Agent | Data |
|---|---|---|
| Global Filter Bar | User Agent | `query`, `selected_scope`, `decision_delta` |
| Summary Panel | PM Agent | `goal`, `rationale`, `next_actions` |
| Priority Panel | PM Agent | `priority_items[]` |
| Layout Shell | Designer Agent | `layout`, `sections[]` |
| Section Cards | Designer Agent + PM Agent | `component_hints`, `priority_items` |
| Status Banner | all | `WorkflowState`, warnings, retries |

## Render Mapping
1. User intent가 filter bar와 page header를 결정한다
2. PM payload가 summary와 ranking context를 채운다
3. Designer spec이 card order와 section visibility를 결정한다
4. validation result가 banner, badge, disabled state를 제어한다

## Composition Rules
- layout 우선권은 Designer Agent가 가진다
- content 우선권은 PM Agent가 가진다
- user explicit choice는 layout/content보다 우선한다
- 같은 section id 충돌 시 최신 `intent_id` + 높은 `priority` 조합 채택

## Empty And Loading
- first load: shell + empty state copy
- running: banner spinner + section skeleton
- partial failure: 실패 section에 inline warning
- full failure: summary 영역에 recovery action 노출

## Error Surface Policy
- contract error는 global toast가 아니라 section inline 우선
- stale 상태는 dismissible badge로만 표기
- retry 버튼은 failed surface 가까이에 배치

## UX Constraints
- page 전체 reflow보다 section-level patch 우선
- mobile에서도 filter bar, status banner, summary 순서 유지
- unknown component는 placeholder card로 대체

## Reusable Pattern
```text
intent -> plan -> design spec -> validate -> surface patch -> confirm
```

## Notes
- surface 정의는 component 구현과 분리 유지
- 화면 copy는 agent raw text를 그대로 노출하지 않고 front tone으로 정제
