# Feature: Agent Contracts

## Goal
- PM, User, Designer Agent와 `front` 사이의 소비 계약 고정
- front는 producer 내부 로직이 아니라 payload shape만 신뢰한다

## Inputs
| Source | Trigger | Required Fields |
|---|---|---|
| User Agent | user query, selection change, approval | `intent_id`, `query`, `selected_scope` |
| PM Agent | plan ready, reprioritize | `goal`, `priority_items`, `next_actions` |
| Designer Agent | layout ready, spec refresh | `layout`, `sections`, `component_hints` |

## Outputs To UI
| Contract | UI Target | Fallback |
|---|---|---|
| `UserIntentPayload` | filter bar, intent chip, run context | last valid intent 유지 |
| `PMPlanPayload` | summary panel, priority list | empty summary + warning |
| `DesignerSpecPayload` | panel order, cards, section visibility | default layout 사용 |

## Payload Rules
- 모든 payload는 `version` 포함
- 식별자는 `intent_id` 또는 `correlation_id`로 추적
- 배열 필드는 빈 배열 허용, `null` 금지
- 텍스트 필드는 빈 문자열 대신 omission 사용
- `priority_items[]`는 label, score, reason 포함
- `sections[]`는 `id`, `title`, `component`, `priority` 포함

## Interaction Contract
1. User Agent가 최신 intent를 생성한다
2. PM Agent는 같은 `intent_id` 기준으로 plan을 반환한다
3. Designer Agent는 plan context를 반영한 spec을 반환한다
4. front는 세 payload를 merge해 단일 render model을 만든다

## Minimal JSON Shape
```json
{
  "intent_id": "intent-042",
  "goal": "Show policy-ready summary",
  "priority_items": [{"label": "risk", "score": 88, "reason": "GRI high"}],
  "sections": [{"id": "summary", "title": "Summary", "component": "SummaryCard", "priority": 1}]
}
```

## Edge Cases
- User payload만 있고 PM/Designer 없음: `awaiting_input` 또는 `running`
- PM만 최신이고 Designer 구버전: layout stale 처리
- Designer spec에 unknown component 포함: render deny + warning banner
- score type mismatch: priority list skip, page 유지

## UI Notes
- contract mismatch는 crash 대신 local degradation으로 처리
- warning copy는 agent 이름과 필드명을 함께 표시
