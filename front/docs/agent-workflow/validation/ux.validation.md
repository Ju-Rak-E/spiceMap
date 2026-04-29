# Validation: UX

## Purpose
- agent workflow가 사용자에게 이해 가능한 UI로 노출되는지 검증

## UX Checks
| Area | Pass Criteria |
|---|---|
| loading | skeleton 또는 spinner가 즉시 보임 |
| partial failure | 실패 section만 warning, 전체 페이지 유지 |
| stale state | badge로 표시되고 dismiss 가능 |
| retry | 실패 위치 근처에 action 존재 |
| empty state | first load와 empty payload를 구분 |
| mobile | filter bar, banner, summary 순서 유지 |

## Message Rules
- warning copy는 agent 이름을 포함
- technical field name은 최소화
- recovery action 텍스트는 동사형 사용
- full failure에서는 다음 액션 1개만 제시

## Accessibility Checks
- badge와 warning에 text label 포함
- 색상만으로 상태 전달 금지
- skeleton 종료 후 focus 이동이 깨지지 않음

## Evidence
- desktop screenshot
- mobile screenshot
- failure-state screenshot
- stale-state screenshot

## QA Decision
- loading, failure recovery, stale visibility 중 하나라도 없으면 fail
- copy tone mismatch는 warn
