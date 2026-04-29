# Project Agents Guide

## Purpose
- 이 파일은 프로젝트 루트 공통 규칙을 정의한다.
- 세션이 바뀌어도 다시 참고할 수 있는 기준 문서로 쓴다.
- 서브에이전트 자체는 세션 한정이지만, 이 문서는 재사용한다.

## Core Principle
- 메인 에이전트는 항상 전체 방향과 최종 통합을 맡는다.
- 서브에이전트는 범위가 명확한 작은 작업만 맡는다.
- 병렬 작업은 파일 범위와 책임이 겹치지 않을 때만 허용한다.

## When To Spawn
- 조사와 구현을 동시에 돌릴 수 있을 때
- UI와 contract 확인처럼 책임 분리가 쉬울 때
- 메인 에이전트가 기다리지 않고 다른 일을 계속할 수 있을 때

## When Not To Spawn
- 바로 다음 행동이 그 결과에 막혀 있을 때
- 같은 파일을 여러 작업자가 동시에 수정해야 할 때
- 요구사항이 아직 흐려서 작업 경계를 못 정할 때

## Common Rules
- 각 서브에이전트에는 한 가지 책임만 준다.
- 수정 가능 경로를 프롬프트에 명시한다.
- 기대 산출물과 금지사항을 함께 적는다.
- 다른 작업자의 변경을 되돌리지 말라고 명시한다.
- 결과를 받은 뒤 메인 에이전트가 검토 후 통합한다.

## Standard Prompt Shape
```text
Role:
Task:
Files:
Output:
Constraints:
```

## Session Rule
- 서브에이전트는 현재 세션에서만 살아 있는 작업 단위로 본다.
- 다른 세션에서도 같은 방식으로 일하려면 역할 문서를 다시 사용해 새로 생성한다.

## Project Layout
- Root common rule: `AGENTS.md`
- Front role docs: `front/docs/agent-workflow/agents/*.md`
- Front workflow spec: `front/docs/agent-workflow/codex.md`

## Front Sub-Agent Set
- PM Agent
- User Agent
- Designer Agent
- Front Worker Agent

## Final Rule
- 애매한 큰 일은 메인 에이전트가 쪼개고, 명확한 작은 일만 서브에이전트에 맡긴다.
