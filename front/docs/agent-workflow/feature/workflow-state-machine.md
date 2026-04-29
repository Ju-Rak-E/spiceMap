# Feature: Workflow State Machine

## Goal
- agent 이벤트를 front state로 변환하는 규칙 고정
- 실행 순서, 상태 전이, retry/cancel/fallback을 결정 완료 상태로 문서화

## States
| State | Meaning | Exit Condition |
|---|---|---|
| `idle` | 아직 입력 없음 | user intent 수신 |
| `awaiting_input` | refinement 필요 | valid intent 입력 |
| `ready` | 실행 가능한 최소 context 확보 | run request 시작 |
| `running` | agent 응답/merge 진행 중 | success or error |
| `completed` | 화면 반영 완료 | new intent 또는 refresh |
| `partial_failed` | 일부 section 실패 | retry 또는 new intent |
| `failed` | core contract 실패 | retry 또는 reset |
| `stale` | 오래된 응답이 남아 있음 | latest payload 확보 |

## Transition Order
1. `idle -> awaiting_input` when empty query submitted
2. `idle -> ready` when valid `UserIntentPayload` arrives
3. `ready -> running` when PM/Designer orchestration starts
4. `running -> completed` when required contracts validate
5. `running -> partial_failed` when optional section invalid
6. `running -> failed` when required contract invalid
7. `completed -> stale` when newer `intent_id` appears
8. any state -> `idle` on explicit reset

## Required Contracts By State
- `ready`: valid `UserIntentPayload`
- `running`: valid user payload + in-flight tracker
- `completed`: user + PM + Designer payload 모두 valid
- `partial_failed`: required payload valid, optional section invalid
- `failed`: user 또는 PM core contract invalid

## Retry Strategy
- soft retry: timeout 1회, same `correlation_id`
- hard retry: user action으로 재요청, new `correlation_id`
- retry 대상은 실패 section만 한정
- 2회 연속 실패 시 page state는 `partial_failed` 고정

## Cancellation Strategy
- new `intent_id` 도착 시 old run cancel
- reset action은 pending merge 폐기
- duplicate event는 no-op 처리

## Fallback Strategy
- PM 없음: summary skeleton
- Designer 없음: default layout
- stale response: badge 표시 후 hidden commit 차단
- validation warning만 존재: render 허용

## Observability Notes
- state 변경마다 `agent`, `intent_id`, `from`, `to` 로깅
- `failed`와 `partial_failed`는 reason code 저장
