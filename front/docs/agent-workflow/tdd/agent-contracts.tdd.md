# TDD: Agent Contracts

## Target
- `PMPlanPayload`, `UserIntentPayload`, `DesignerSpecPayload`
- 목적: contract parsing과 graceful degradation 검증

## Scenario 1
- Given valid user, PM, Designer payload
- When front merge를 수행하면
- Then `completed` 상태와 full render model이 생성된다

## Scenario 2
- Given `UserIntentPayload`에 `intent_id`가 없다
- When parser가 실행되면
- Then 상태는 `failed`가 되고 UI commit은 중단된다

## Scenario 3
- Given PM payload에 `priority_items`가 빈 배열이다
- When summary panel을 생성하면
- Then 페이지는 유지되고 priority panel만 empty state를 노출한다

## Scenario 4
- Given Designer payload에 unknown `component`가 있다
- When section build를 수행하면
- Then placeholder card를 렌더하고 warning을 기록한다

## Scenario 5
- Given 동일 `correlation_id` 이벤트가 두 번 들어온다
- When dedupe가 동작하면
- Then 두 번째 이벤트는 no-op 처리된다

## Scenario 6
- Given 배열 필드에 `null`이 포함된다
- When validation을 수행하면
- Then 해당 section은 invalid 처리되고 `partial_failed`로 전이된다

## Acceptance Criteria
- required field 누락은 crash가 아니라 typed failure로 귀결된다
- optional field 누락은 default/fallback으로 복구된다
- late response, duplicate event, type mismatch를 모두 식별한다
- error reason은 field 단위로 남는다
