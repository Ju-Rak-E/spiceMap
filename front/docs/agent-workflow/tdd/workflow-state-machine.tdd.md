# TDD: Workflow State Machine

## Target
- `WorkflowState` 전이와 retry/cancel 정책

## Scenario 1
- Given 초기 상태가 `idle`
- When valid user intent가 도착하면
- Then 상태는 `ready`가 된다

## Scenario 2
- Given 상태가 `ready`
- When orchestration이 시작되면
- Then 상태는 `running`이 된다

## Scenario 3
- Given `running` 중 PM, Designer contract가 모두 유효하다
- When merge가 끝나면
- Then 상태는 `completed`가 된다

## Scenario 4
- Given `running` 중 optional section validation만 실패한다
- When merge 결과를 반영하면
- Then 상태는 `partial_failed`가 되고 valid section은 유지된다

## Scenario 5
- Given `running` 중 required contract가 실패한다
- When retry 전 상태를 계산하면
- Then 상태는 `failed`가 된다

## Scenario 6
- Given `completed` 이후 새 `intent_id`가 도착한다
- When 기존 응답이 늦게 들어오면
- Then old response는 discard되고 상태는 `stale` 또는 `running`으로 유지된다

## Scenario 7
- Given timeout이 1회 발생한다
- When soft retry를 수행하면
- Then 같은 `correlation_id`로 1회만 재시도한다

## Acceptance Criteria
- 정의된 모든 상태가 최소 1회 이상 테스트된다
- old intent와 new intent 충돌 시 최신 intent가 항상 우선한다
- reset action은 어디서든 `idle`로 복귀시킨다
