# Front Agent Workflow Codex

## Purpose
- Scope: `front`가 소비하는 multi-agent workflow spec 정의
- Sources: `docs/FR_Role_Workflow.md`, brainstorm docs
- Audience: Dev-B, front implementer, UI reviewer
- Style: concise, reusable, contract-first

## Agent Boundary
| Agent | Responsibility | Front Input | Front Output Use |
|---|---|---|---|
| PM Agent | plan, priority, rationale 생성 | `PMPlanPayload` | summary, priority panel, status badge |
| User Agent | user intent, delta, approval 정규화 | `UserIntentPayload` | filter state, action queue, invalidation trigger |
| Designer Agent | layout, component composition 명세 | `DesignerSpecPayload` | panel order, card schema, render hints |

## Canonical Interfaces
- `PMPlanPayload`: `version`, `goal`, `priority_items[]`, `rationale`, `next_actions[]`
- `UserIntentPayload`: `version`, `intent_id`, `query`, `selected_scope`, `decision_delta[]`
- `DesignerSpecPayload`: `version`, `layout`, `sections[]`, `component_hints[]`, `empty_state`
- `AgentEvent`: `agent`, `event_type`, `payload`, `created_at`, `correlation_id`
- `WorkflowState`: `idle | awaiting_input | ready | running | completed | partial_failed | failed | stale`
- `ValidationResult`: `status`, `errors[]`, `warnings[]`, `fallback_allowed`

## Execution Order
1. User Agent event 수신
2. front가 `UserIntentPayload` validate 후 local state 반영
3. PM Agent plan 수신 후 priority context merge
4. Designer Agent spec 수신 후 render schema merge
5. validation gate 통과 시 UI commit
6. contract error 시 section 단위 fallback 적용

## State Rules
- `idle`: 입력 대기
- `awaiting_input`: user refinement 필요
- `ready`: 최소 contract 확보
- `running`: agent 응답 대기 또는 merge 진행
- `completed`: UI 반영 완료
- `partial_failed`: 일부 section만 실패
- `failed`: 핵심 contract 부재
- `stale`: 최신 user intent 이후 오래된 응답

## Failure Policy
- Missing payload: 이전 valid snapshot 유지
- Schema violation: offending section만 차단
- Timeout: 1차 soft retry, 이후 stale fallback
- Duplicate event: `correlation_id` 기준 dedupe
- Late response: latest `intent_id` 불일치 시 discard

## Document Set
- `agents/pm-agent.md`
- `agents/user-agent.md`
- `agents/designer-agent.md`
- `agents/front-worker-agent.md`
- `beginner-subagents.md`
- `feature/agent-contracts.md`
- `feature/workflow-state-machine.md`
- `feature/interaction-surfaces.md`
- `tdd/*.md`
- `validation/*.md`

## Delivery Rule
- 모든 문서는 50~70 lines 이하 유지
- 표준 용어는 위 interface names 재사용
- backend internal logic는 문서 범위에서 제외
