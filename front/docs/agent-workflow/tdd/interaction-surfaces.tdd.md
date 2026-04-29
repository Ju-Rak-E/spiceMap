# TDD: Interaction Surfaces

## Target
- filter bar, summary panel, priority panel, status banner, section cards

## Scenario 1
- Given valid `UserIntentPayload`
- When 화면이 초기화되면
- Then filter bar와 header가 intent 기준으로 채워진다

## Scenario 2
- Given valid PM payload
- When summary panel을 렌더하면
- Then `goal`, `rationale`, `next_actions`가 고정 순서로 표시된다

## Scenario 3
- Given Designer layout가 `summary -> priority -> details` 순서다
- When shell을 구성하면
- Then 화면도 같은 순서를 유지한다

## Scenario 4
- Given `partial_failed` 상태다
- When surface patch를 수행하면
- Then 실패 section만 inline warning을 보여주고 나머지는 유지한다

## Scenario 5
- Given `stale` 응답이 있다
- When status banner를 갱신하면
- Then dismissible stale badge가 나타나고 stale payload는 commit되지 않는다

## Scenario 6
- Given mobile viewport다
- When layout를 재배치하면
- Then filter bar, status banner, summary 순서가 유지된다

## Acceptance Criteria
- surface별 primary data source가 명확히 분리된다
- unknown component도 placeholder로 가시성이 유지된다
- full-page crash 없이 section patch 전략이 유지된다
