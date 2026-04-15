# Week 2 의사결정 기록

> 작성일: 2026-04-15
> 작성자: Dev-C (pangvelop)
> 검토자: — (Dev-A, Dev-B 확인 필요)
> 상태: DRAFT — Dev-A 응답 후 확정

---

## 1. Week 1 이월 블로커 해제 방침

### 결정: Dev-A 응답 대기

| 항목 | 결정 |
|------|------|
| 적재 주체 | **Dev-A** (원 담당자) |
| Dev-C 직접 적재 | ❌ 보류 |
| 근거 | 역할 분배 원칙 유지 (Dev-A: 수집·적재, Dev-C: 분석) |

### 대기 대상 적재 (3종)

| 테이블 | 현재 | 스크립트 |
|--------|------|---------|
| `od_flows` | 0건 | `backend/pipeline/download_od_files.py` → `load_od_flows.py` |
| `admin_boundary` | 0건 | `backend/pipeline/load_spatial.py admin <shp>` |
| `commerce_boundary` | 0건 | `backend/pipeline/load_spatial.py commerce <shp>` |

### 대기 중 Dev-C 선행 작업

블로커 해제 전까지 Dev-C는 아래 선행 작업으로 전환:

1. `docs/gri_formula.md` 작성 (Section 2 결정 반영)
2. `docs/module_a_design.md` 작성 (Section 3 결정 반영)
3. Module A NetworkX 스켈레톤 + 더미 데이터 TDD
4. 분기 커버리지 실측 (`commerce_sales`, `store_info` 적재 분기 범위)

### 에스컬레이션 조건

- **2026-04-16 EOD까지 Dev-A 무응답** → Dev-C가 직접 적재 전환 + 별도 기록
- **2026-04-17까지 미완료** → 범위 축소 검토 (서울 전역 → 강남·관악만)

---

## 2. GRI 임대료 항목 처리

### 결정: **가중치 재분배** (옵션 B)

임대료 데이터 미확보 상태에서 GRI v1.0은 4항목 기준으로 가중치를 재분배하여 총합 1.0을 유지한다.

### 근거

| 옵션 | 장점 | 단점 | 채택 |
|------|------|------|------|
| A. 항목 제외 (총합 0.75) | 단순 | GRI 절대값 해석 왜곡 | ❌ |
| **B. 가중치 재분배** | 총합 1.0 유지, 해석 일관성 | 임대료 시그널 손실 | ✅ |
| C. 대체 지표 도입 | 임대료 근사 가능 | 추가 설계 1~2일 | 🕐 v1.1 검토 |

**핵심 근거**: MVP 목표는 **상대 순위 산출**(우선순위 80+ 상권 식별)이므로, 절대값 정확도보다 항목 간 비교 일관성이 중요.

### GRI v1.0 가중치 (4항목 재분배)

기존 비율 유지하며 재정규화:

| 항목 | 기존 가중치 | v1.0 재분배 | 근거 |
|------|------------|------------|------|
| 폐업률 | 0.30 | **0.40** | 직접 피해 지표 |
| 순유출 | 0.25 | **0.33** | 구조적 원인 지표 (수요) |
| 고립도/연결 단절 | 0.20 | **0.27** | 구조적 원인 지표 (네트워크) |
| ~~임대료 부담~~ | ~~0.25~~ | **제외** | 데이터 미확보 |
| **총합** | 1.00 | **1.00** | |

재분배 공식: `new_weight = old_weight / (1 - 0.25) = old_weight / 0.75`

### 검증 방법

- **z-score 정규화** 적용 후 가중 평균으로 GRI 산출
- 상위/하위 10% 상권 스팟 체크 — 현장 맥락과 일치하는지
- Week 3 H1 검증(GRI-매출 상관계수 r ≥ 0.5) 통과 여부로 타당성 확인

### v1.1 확장 검토 (Week 4 이후)

임대료 대체 지표 후보:
- 공시지가 (국토부) — 장점: 공공데이터 / 단점: 분기 갱신 아님
- 주변 매출 대비 임대료 지수 — 장점: 부담률 근사 / 단점: 파생 지표 복잡도
- 상권 변화 지수 (서울시 기존) — 장점: 검증됨 / 단점: 자체 분석과 중복

---

## 3. Module A Centrality 알고리즘

### 결정: **Degree → Betweenness 2단계 도입**

Week 2에는 `degree` 계열만 구현하고, Module C(흐름 단절)와 함께 `betweenness`를 Week 3~4에 추가한다.

### 근거

| 알고리즘 | 계산 복잡도 | 해석 난이도 | 발표 설명 | Week 2 |
|---------|-----------|-----------|---------|--------|
| **Degree ✅** | O(n) | 낮음 | "진입/진출 허브" 1문장 | ✅ |
| Betweenness | O(n³) | 중간 | "흐름의 길목" 설명 가능 | 🕐 Week 3~4 |
| Eigenvector | O(n²) | 높음 | 3분 발표 부적합 | ❌ |

**핵심 근거**:
1. **발표 적합도**: 심사위원에게 "진입/진출 허브 상권"을 1문장으로 설명 가능
2. **성능 안전**: 서울 전역 424개 상권 확장 시 betweenness는 수 분 소요
3. **단계적 검증**: degree 기반 결과가 안정된 후 betweenness로 Module C(단절 탐지) 강화

### Week 2 구현 범위

```python
# backend/analysis/module_a_graph.py (예정)
- in_degree   : 해당 상권으로 들어오는 흐름 수
- out_degree  : 해당 상권에서 나가는 흐름 수
- net_flow    : in - out (순유입)
- degree_centrality : NetworkX 정규화 degree
```

### Week 3~4 확장 범위

```python
- betweenness_centrality : Module C(흐름 단절) 입력
- edge_betweenness       : 단절 후보 edge 탐지
```

### 노드 시각화 매핑 (Dev-B 연계)

| 시각 요소 | 데이터 | Week 2 |
|----------|--------|--------|
| 마커 크기 | `net_flow` 절대값 | ✅ |
| 색상 | 순유입 양/음 (green/red) | ✅ |
| 하이라이트 | `degree_centrality` 상위 10% | ✅ |
| 연결선 굵기 | `betweenness` (Week 3~4) | 🕐 |

---

## 4. 후속 조치

### 즉시 반영 문서

- [ ] `docs/gri_formula.md` 신규 작성 — Section 2 반영
- [ ] `docs/module_a_design.md` 신규 작성 — Section 3 반영
- [ ] `docs/FR_Role_Workflow.md` Week 2 GRI 섹션에 재분배 방식 1줄 각주 추가

### Dev-A 응답 후 반영

- [ ] 본 문서 상태 `DRAFT` → `CONFIRMED` 변경
- [ ] Section 1 "에스컬레이션" 결과 기록

### Dev-B 협의 필요

- [ ] `frontend/src/utils/gri.ts` 역할 확인 — 백엔드 산출값 표시 전용 vs 재계산?
- [ ] Section 3 노드 시각화 매핑 합의

---

## 5. 변경 이력

| 날짜 | 버전 | 변경 |
|------|------|------|
| 2026-04-15 | v0.1 DRAFT | 3개 의사결정 초안 작성 (Dev-C) |
| 2026-04-15 | v0.2 DRAFT | Section 3 변경 — Betweenness 보류, Degree+Eigenvector 병용 결정 |
| 2026-04-15 | v0.3 DRAFT | Section 3 정정 — v0.1 결정(Degree → Betweenness 2단계)으로 복귀 |
