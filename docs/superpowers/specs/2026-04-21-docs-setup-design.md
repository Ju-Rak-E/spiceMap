# spiceMap 프로젝트 문서 셋업 설계

> 작성일: 2026-04-21 (Week 2 마감일)
> 작성자: Dev-C (pangvelop)
> 상태: APPROVED — 옵션 2 채택

---

## 배경

`/sync` 실행 결과 루트 `CLAUDE.md`, `prompt_plan.md`, `spec.md`, `.claude/rules/` 부재가 감지됨.
단순 스캐폴딩 대신 실질 가치 중심의 최소 셋(옵션 2)을 채택한다.

`FR_Role_Workflow.md`(559줄)가 이미 포괄적 spec 역할을 수행하므로 루트 `spec.md`를 신규 생성하지 않고 CLAUDE.md에서 참조한다. `.claude/rules/` 규칙 파일은 실제 팀 컨벤션 충돌이 발생하기 전까지 생성을 지연한다.

## 범위

5개 문서 신규 생성:

| # | 경로 | 분량 | 출처/근거 |
|---|------|------|----------|
| 1 | `CLAUDE.md` | ~55줄 | 3인 팀 공통 Claude 컨텍스트 |
| 2 | `prompt_plan.md` | ~120줄 | FR_Role_Workflow.md 섹션 5 체크리스트 변환 |
| 3 | `docs/gri_formula.md` | ~60줄 | week2_decisions.md Section 2 이행 |
| 4 | `docs/module_a_design.md` | ~80줄 | week2_decisions.md Section 3 이행 |
| 5 | `docs/README.md` | ~40줄 | `docs/` 내부 12개 문서 인덱스 |

## 핵심 결정사항

### D1. spec.md 미생성 — FR_Role_Workflow.md 재사용
FR_Role_Workflow.md가 기능 명세·요구사항·5주 일정까지 포함한 포괄 spec이다. 루트 spec.md 신규 생성은 문서 중복과 동기화 부담만 증가시킨다. CLAUDE.md의 "핵심 문서 포인터" 섹션에서 경로 참조.

### D2. .claude/rules/ 미생성 — 실충돌 시점까지 지연
3인 5주 대회 프로젝트 범위에서 선제적 규칙 문서화는 과잉. 충돌 발생 시 해당 주제만 타겟형으로 생성.

### D3. CLAUDE.md 팀원 표기
pangvelop(Dev-C)만 GitHub 핸들 명시. Dev-A, Dev-B는 역할 라벨만.

### D4. Module A의 행정동→상권 매핑
`docs/spatial_join_design.md` 따름 (폴리곤 교차 면적 기준).

### D5. GRI v1.0 가중치
week2_decisions.md Section 2 채택: 폐업률 0.40 / 순유출 0.33 / 고립도·연결단절 0.27 / 임대료 제외.

### D6. Centrality 2단계 도입
Week 2는 degree 계열만. betweenness는 Week 3~4 Module C와 함께 추가.

## 각 파일 구성

### CLAUDE.md
- 프로젝트 개요 (1줄 요약 + 대회 정보)
- 팀 구성 (3인 역할, Dev-C만 핸들)
- 아키텍처 (Pipeline → PostgreSQL/PostGIS → FastAPI → React)
- 디렉토리 구조
- 주요 명령어 (docker-compose, pipeline, npm run dev)
- Git 워크플로우 (Ju-Rak-E/spiceMap, feature/* → main)
- 핵심 문서 포인터 (FR_Role_Workflow.md, prompt_plan.md, schema.md)
- 현재 주차 상태 (Week 2 → 3 전환)
- 핵심 원칙 3줄 (MVP=강남·관악, 상대 순위 우선, 개인정보 미추적)

### prompt_plan.md
주차별 체크리스트 `- [x]` / `- [ ]` + 담당자 태그.
Week 1 완료 상태 + 이월 블로커(od_flows/admin_boundary/commerce_boundary 미적재).
Week 2 진행 상태 (오늘 마감일 기준).
Week 3~5 계획.
금번 pull 반영(backend/api/*, CommerceDetailPanel, useGriHistory 등).

### docs/gri_formula.md
- GRI v1.0 정의 및 4항목 재분배 근거
- 가중치 표
- z-score 정규화 (서울 전역 기준 채택 근거)
- Python pseudo-code
- 입력 컬럼 스키마 매핑
- 검증 방법 (상위/하위 10% 스팟 체크, H1 검증 연동)
- v1.1 확장 후보 (임대료 대체 지표 3종)

### docs/module_a_design.md
- 책임 정의
- 노드(상권 코드 + 좌표) / 엣지(OD 집계 후 행정동→상권 매핑) 정의
- 산출 지표 4종 (in_degree, out_degree, net_flow, degree_centrality)
- NetworkX API 매핑
- 의존성 (od_flows, spatial_join 결과)
- 더미 데이터 TDD 전략 (od_flows 0건 상태 대응)
- 노드 시각화 매핑 (Dev-B 인터페이스)
- Week 3~4 확장 (betweenness_centrality → Module C 입력)
- 구현 파일: `backend/analysis/module_a_graph.py`

### docs/README.md
카테고리별 인덱스 (기획/요구·데이터 설계·분석 설계·API/UI 설계·의사결정·리포트·브레인스토밍·진행 관리).

## 의도적 제외

- 루트 `spec.md` (D1)
- `.claude/rules/*.md` (D2)
- `docs/` 디렉토리 재편 (기존 구조 유지, git 히스토리 보존)

## 성공 기준

- 5개 파일 생성 완료
- CLAUDE.md 60줄 이하
- 모든 내용이 기존 문서(FR_Role_Workflow.md, week2_decisions.md, spatial_join_design.md)와 일관
- Dev-A/B가 세션 시작 시 루트 CLAUDE.md로 프로젝트 컨텍스트 즉시 파악 가능
