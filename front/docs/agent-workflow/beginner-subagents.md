# Beginner Guide: Sub-Agents

## What It Is
- 서브에이전트는 메인 에이전트가 일을 나눠 맡기는 작은 작업자다.
- 목적은 속도를 올리는 것이지, 책임을 버리는 것이 아니다.
- 메인 에이전트는 항상 전체 방향, 통합, 최종 검토를 맡는다.

## When To Use
- 코드 수정 범위가 서로 겹치지 않을 때
- 조사 작업과 구현 작업을 동시에 돌릴 때
- 결과가 당장 없어도 메인 작업을 계속할 수 있을 때

## When Not To Use
- 바로 다음 행동이 그 결과에 막혀 있을 때
- 작업 설명이 아직 흐릴 때
- 같은 파일을 여러 에이전트가 동시에 고쳐야 할 때

## Basic Rules
- 한 서브에이전트에는 한 가지 책임만 준다.
- 수정 가능한 파일이나 영역을 꼭 적어준다.
- 기대 산출물을 짧게 고정한다.
- 다른 사람이 같은 코드베이스에서 작업 중이라고 알려준다.
- 결과를 기다리는 동안 메인 에이전트는 다른 일을 한다.

## Core Commands
- `spawn_agent`: 새 서브에이전트를 시작할 때 쓴다.
- `send_input`: 이미 만든 서브에이전트에 추가 지시를 보낼 때 쓴다.
- `wait_agent`: 지금 결과가 꼭 필요할 때만 쓴다.
- `close_agent`: 결과를 받았고 더 안 쓸 때 닫는다.

## Good Prompt Pattern
```text
Role: Front worker
Task: summary panel UI 구현
Files: front/src/components/summary/*
Output: 변경 파일 목록 + 핵심 동작 설명
Constraints: 다른 작업자 변경을 되돌리지 말 것
```

## Bad Pattern
- "프론트 전체 알아서 해줘" 같이 범위가 너무 넓은 지시
- 파일 범위 없이 "고쳐줘"라고만 말하는 지시
- 메인 에이전트도 같은 파일을 동시에 수정하는 행동
- 결과가 급한데 습관적으로 `wait_agent`부터 호출하는 행동

## How To Start
1. 먼저 메인 에이전트가 전체 일을 2~3개로 나눈다.
2. 지금 바로 필요한 일은 메인 에이전트가 직접 잡는다.
3. 병렬 가능한 일만 서브에이전트에 보낸다.
4. 각 서브에이전트마다 책임 범위를 겹치지 않게 적는다.

## How To Work
1. `spawn_agent`로 역할과 작업 범위를 준다.
2. 메인 에이전트는 기다리지 말고 다른 조사나 통합 준비를 한다.
3. 추가 정보가 생기면 `send_input`으로 보낸다.
4. 정말 막혔을 때만 `wait_agent`로 결과를 받는다.
5. 받은 결과는 메인 에이전트가 검토하고 통합한다.

## spiceMap Example
- PM sub-agent: 요구사항 요약, 우선순위 정리
- Designer sub-agent: 패널 순서, 카드 구조, 상태 표현 제안
- Front worker sub-agent: 실제 UI 구현
- Main agent: 문서 기준 검토, 충돌 조정, 최종 합치기

## Quick Examples
- 조사 + 구현 병렬: 한 명은 `feature` 문서 확인, 한 명은 UI 뼈대 구현
- UI + contract 분리: 한 명은 payload shape 확인, 한 명은 화면 컴포넌트 구현
- 직접 처리: state machine 핵심 설계처럼 바로 막히는 일은 메인 에이전트가 직접 수행

## Before You Spawn
- 이 작업이 정말 병렬 가능한가?
- 결과가 없어도 내가 다음 일을 할 수 있는가?
- 파일 범위를 한 줄로 적을 수 있는가?
- 기대 산출물을 한 문장으로 말할 수 있는가?

## One-Line Summary
- 서브에이전트는 "애매한 큰 일"에 쓰지 말고, "명확한 작은 일"에만 써라.
