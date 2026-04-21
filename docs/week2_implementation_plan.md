# Week 2 Module A/B + H1 구현 계획

> 작성: 2026-04-21 / Dev-C
> 근거: `docs/gri_formula.md`, `docs/module_a_design.md`, `docs/FR_Role_Workflow.md` §3.5

---

## 산출물

| # | 파일 | 내용 |
|---|------|------|
| 1 | `backend/analysis/module_a_graph.py` | 상권 흐름 유향 그래프 + degree 지표 |
| 2 | `backend/analysis/module_b_gri.py` | GRI v1.0 4항목 재분배 산출 |
| 3 | `backend/analysis/verification_h1.py` | H1 순유입-매출 Pearson 상관 |
| 4 | `tests/analysis/test_module_a_graph.py` | Module A 단위 테스트 |
| 5 | `tests/analysis/test_module_b_gri.py` | Module B 단위 테스트 |
| 6 | `tests/analysis/test_verification_h1.py` | H1 단위 테스트 |
| 7 | `tests/conftest.py` | 공용 fixture (dummy OD, dummy mapping) |
| 8 | `requirements.txt` | +networkx, +scipy, +pytest |

## 인터페이스

### Module A
```python
def build_commerce_flow_graph(
    od_flows: pd.DataFrame,   # origin_adm_cd, dest_adm_cd, trip_count
    mapping: pd.DataFrame,     # adm_cd, comm_cd, comm_area_ratio
) -> nx.DiGraph

def compute_degree_metrics(G: nx.DiGraph) -> pd.DataFrame
# 출력: commerce_code, in_degree, out_degree, net_flow, degree_centrality
```

### Module B
```python
def compute_gri(df: pd.DataFrame) -> pd.DataFrame
# 입력: commerce_code, quarter, closure_rate, net_flow, degree_centrality
# 출력: + gri_score (0~100 percentile), risk_*_z 3종
```

### H1
```python
def compute_h1_correlation(
    analysis_df: pd.DataFrame,  # commerce_code, net_flow
    sales_df: pd.DataFrame,      # trdar_cd, sales_amount
) -> dict
# 반환: {"pearson_r": float, "p_value": float, "n": int, "passes_threshold": bool}
```

## TDD 순서

1. Module A (A가 B의 net_flow·degree_centrality를 공급)
2. Module B (B가 H1의 gri_score를 공급 — 부가)
3. H1 (A 출력 기반)

## 결정 사항

- **행정동→상권 매핑**: `adm_comm_mapping.comm_area_ratio` 곱해 trip_count를 상권에 배분 (기존 `spatial_join.py` 패턴)
- **자기 루프 제외**: 같은 상권 내 이동은 엣지 생성 안 함
- **빈 그래프 대응**: 빈 DataFrame 반환
- **H1 임계값**: `r ≥ 0.5` AND `p < 0.05` → `passes_threshold=True`

## Acceptance Criteria

- pytest 전체 통과
- Module A: 5 테스트 이상
- Module B: 4 테스트 이상
- H1: 3 테스트 이상
- `networkx`, `scipy`, `pytest` requirements.txt 반영
