# Module A — 상권 흐름 네트워크 설계

> 작성: 2026-04-21 / Dev-C
> 상태: Week 2 설계 확정 (degree 계열) / Week 3~4 betweenness 확장 예정
> 근거: `docs/week2_decisions.md` Section 3
> 구현 파일: `backend/analysis/module_a_graph.py` (예정)

---

## 1. 책임

OD 이동 데이터를 **상권 단위 유향 그래프**로 변환하고, 각 상권의 흐름 특성을 수치화한다.

- 입력: `od_flows` (행정동↔행정동 이동), `admin_boundary`, `commerce_boundary`
- 출력: 상권별 {in_degree, out_degree, net_flow, degree_centrality}
- 소비자: Module B (GRI 산출), Module C (단절 탐지), Dev-B 노드 시각화

## 2. 그래프 모델

### 2.1 노드

- **단위**: 상권 코드 (`commerce_code`)
- **좌표**: `commerce_boundary`의 PostGIS `ST_Centroid`
- **속성**: 상권명, 자치구 (옵션: 업종 구성)

### 2.2 엣지

- **방향**: 기점 상권 → 종점 상권
- **가중치**: 집계된 이동 인구 수 (인/일 또는 인/분기)
- **생성 절차**:
  1. `od_flows` 원본: 행정동(기점) → 행정동(종점)
  2. `spatial_join` 결과로 각 행정동을 관련 상권에 매핑
     (`docs/spatial_join_design.md` — 폴리곤 교차 면적 기준, 면적 임계값 이상만 채택)
  3. 상권×상권 이동량으로 재집계
  4. 자기 루프(동일 상권 내 이동) 제외

## 3. 산출 지표

### 3.1 Week 2 (degree 계열)

| 지표 | 정의 | NetworkX API |
|------|------|-------------|
| `in_degree` | 상권으로 들어오는 이동량 합 | `G.in_degree(weight="weight")` |
| `out_degree` | 상권에서 나가는 이동량 합 | `G.out_degree(weight="weight")` |
| `net_flow` | `in_degree - out_degree` | 직접 계산 |
| `degree_centrality` | 정규화 degree [0, 1] | `nx.degree_centrality(G)` |

### 3.2 Week 3~4 (Module C 연동 시 추가)

| 지표 | 정의 | 용도 |
|------|------|------|
| `betweenness_centrality` | 매개 중심성 | Module C 단절 탐지 입력 |
| `edge_betweenness` | 엣지 매개 중심성 | 단절 후보 엣지 식별 |

**보류 근거**: O(n³) 복잡도 → 서울 전역(424 상권) 확장 시 수 분 소요. Week 2 범위 초과.

## 4. 구현 스켈레톤

```python
# backend/analysis/module_a_graph.py
import networkx as nx
import pandas as pd

def build_commerce_flow_graph(
    od_flows: pd.DataFrame,
    admin_to_commerce: pd.DataFrame,
) -> nx.DiGraph:
    """OD 행정동 이동을 상권 유향 그래프로 변환."""
    # 1. 행정동→상권 매핑 (폴리곤 교차 면적 기준)
    od_mapped = (
        od_flows
        .merge(admin_to_commerce, left_on="origin_adm_cd", right_on="adm_cd")
        .rename(columns={"commerce_code": "origin_commerce"})
        .drop(columns=["adm_cd"])
        .merge(admin_to_commerce, left_on="dest_adm_cd", right_on="adm_cd")
        .rename(columns={"commerce_code": "dest_commerce"})
        .drop(columns=["adm_cd"])
    )

    # 2. 상권×상권 재집계 (자기 루프 제외)
    agg = (
        od_mapped[od_mapped["origin_commerce"] != od_mapped["dest_commerce"]]
        .groupby(["origin_commerce", "dest_commerce"])["flow_count"]
        .sum()
        .reset_index()
    )

    # 3. 유향 그래프 구축
    G = nx.DiGraph()
    for _, row in agg.iterrows():
        G.add_edge(row["origin_commerce"], row["dest_commerce"], weight=row["flow_count"])
    return G


def compute_degree_metrics(G: nx.DiGraph) -> pd.DataFrame:
    """그래프에서 degree 계열 지표 산출."""
    in_deg  = dict(G.in_degree(weight="weight"))
    out_deg = dict(G.out_degree(weight="weight"))
    # DiGraph의 degree_centrality는 최대 2까지 나올 수 있으므로 무방향 변환 후 산출
    cent    = nx.degree_centrality(G.to_undirected(as_view=True))

    return pd.DataFrame({
        "commerce_code":     list(G.nodes()),
        "in_degree":         [in_deg.get(n, 0) for n in G.nodes()],
        "out_degree":        [out_deg.get(n, 0) for n in G.nodes()],
        "net_flow":          [in_deg.get(n, 0) - out_deg.get(n, 0) for n in G.nodes()],
        "degree_centrality": [cent.get(n, 0.0) for n in G.nodes()],
    })
```

## 5. 의존성 현황

| 의존 | 상태 | 대응 |
|------|------|------|
| `od_flows` 테이블 | 0건 (Dev-A 적재 대기) | 더미 데이터 TDD 선행 |
| `admin_boundary` | 0건 (Dev-A 적재 대기) | 더미 GeoJSON fixture |
| `commerce_boundary` | 0건 (Dev-A 적재 대기) | 더미 GeoJSON fixture |
| `spatial_join` 구현 | `backend/analysis/spatial_join.py` 스텁 | 실데이터 적재 후 연동 |

## 6. TDD 전략 (od_flows 0건 상태 대응)

### 6.1 더미 데이터 스키마

```python
# tests/fixtures/dummy_od.py
DUMMY_OD = pd.DataFrame([
    {"origin_adm_cd": "1168010100", "dest_adm_cd": "1168010200", "flow_count": 1000},
    {"origin_adm_cd": "1168010200", "dest_adm_cd": "1168010100", "flow_count": 500},
    # ... 강남·관악 대표 행정동 10개로 커버
])

DUMMY_MAPPING = pd.DataFrame([
    {"adm_cd": "1168010100", "commerce_code": "C001"},
    {"adm_cd": "1168010200", "commerce_code": "C002"},
])
```

### 6.2 테스트 케이스

- `test_build_graph_excludes_self_loops` — 동일 상권 내 이동은 엣지 생성 안 됨
- `test_compute_degree_metrics_net_flow` — `in - out == net_flow`
- `test_centrality_range` — `degree_centrality` ∈ [0, 1]
- `test_isolated_node_returns_zero` — 고립 노드는 모든 지표 0
- `test_empty_graph_returns_empty_df` — 빈 그래프는 빈 DataFrame 반환

## 7. Dev-B 시각화 인터페이스

Module A 출력은 `/api/commerce/type-map` 응답의 다음 필드로 매핑된다:

| 시각 요소 | Module A 지표 | Dev-B 처리 |
|----------|--------------|-----------|
| 마커 크기 | `abs(net_flow)` | 정규화 후 반경 스케일 |
| 색상 | `net_flow` 부호 + 유형 분류 | 5유형 팔레트 (`COMMERCE_COLORS`) |
| 하이라이트 | `degree_centrality` 상위 10% | 테두리 강조 |
| 연결선 굵기 | (Week 3~4) `betweenness` | 단절 레이어 점선 강도 |

## 8. 출력 스키마

| 컬럼 | 타입 | 설명 |
|------|------|------|
| commerce_code | VARCHAR | 상권 코드 |
| quarter | VARCHAR(6) | YYYYQn |
| in_degree | NUMERIC | 유입량 합 |
| out_degree | NUMERIC | 유출량 합 |
| net_flow | NUMERIC | in - out |
| degree_centrality | NUMERIC(4,3) | 정규화 [0, 1] |
| computed_at | TIMESTAMP | 산출 시각 |
