# Validation: Workflow

## Purpose
- orchestration event와 state 전이의 QA 기준 정의

## Core Checks
| Check | Pass Criteria |
|---|---|
| ordering | 같은 `intent_id` 내 이벤트 순서가 재현 가능 |
| dedupe | 동일 `correlation_id` 재수신 시 no-op |
| stale guard | old `intent_id` 응답이 UI에 commit되지 않음 |
| retry | soft retry 1회만 수행 |
| reset | 어느 상태에서든 `idle` 복귀 가능 |

## Failure Modes
- late PM response after new intent
- Designer spec missing after PM success
- same event duplicated by transport layer
- timeout 후 retry 성공 또는 실패
- invalid payload가 completed state를 오염시키는 경우

## Pass Rules
- 최신 `intent_id`가 항상 winner
- `partial_failed`에서도 valid section 유지
- hard retry는 새 `correlation_id` 생성
- reset 시 warning, stale, retry counter 초기화

## Evidence
- event log sequence
- state transition log
- retry counter
- discarded response record

## QA Decision
- ordering, stale guard, retry 중 하나라도 실패하면 blocker
- partial section degradation은 blocker 아님
