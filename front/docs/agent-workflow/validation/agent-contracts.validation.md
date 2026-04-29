# Validation: Agent Contracts

## Purpose
- front가 수신하는 agent payload의 pass/fail 기준 정의

## Required Checks
| Contract | Must Have | Reject If |
|---|---|---|
| `UserIntentPayload` | `version`, `intent_id`, `query` | `intent_id` 없음, non-string query |
| `PMPlanPayload` | `version`, `goal`, `priority_items[]` | missing goal, array 대신 object |
| `DesignerSpecPayload` | `version`, `layout`, `sections[]` | unknown layout type, missing sections |

## Field Policy
- `version`: semver string
- identifier: non-empty string
- arrays: `[]` 허용, `null` 불가
- enum: 정의 외 값이면 warning이 아니라 fail
- timestamps: ISO 8601 string 권장, 미존재 허용

## Validation Result
- `pass`: 모든 required field 유효
- `warn`: optional field 문제, fallback 가능
- `fail`: required field 문제 또는 enum 위반

## Evidence
- payload snapshot
- failing field path
- error code
- fallback 사용 여부

## QA Gate
- required contract 3종 모두 `pass`여야 `completed`
- 하나라도 `fail`이면 `failed` 또는 `partial_failed`
- warn-only payload는 render 허용

## Notes
- validation은 render 이전에 단일 entrypoint에서 수행
- 문서와 코드의 field 이름은 1:1 유지
