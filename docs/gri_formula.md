# GRI v1.0 공식 설계

> 젠트리피케이션 위험 지수 (Gentrification Risk Index)
> 작성: 2026-04-21 / Dev-C
> 상태: v1.0 Week 2 확정
> 근거: `docs/week2_decisions.md` Section 2

---

## 1. 정의

GRI는 상권별 젠트리피케이션 위험도를 **0~100 스케일**로 표현하는 복합 지표다.
4개 구성 요소를 z-score 정규화 후 가중 평균하고, 최종값은 percentile rank로 변환한다.

## 2. 가중치 (v1.0 — 4항목 재분배)

| 항목 | 가중치 | 데이터 출처 |
|------|--------|------------|
| 폐업률 | 0.40 | `store_info.closure_rate` |
| 순유출 | 0.33 | Module A `net_flow` (부호 반전) |
| 고립도/연결 단절 | 0.27 | Module A `degree_centrality` (부호 반전) |
| ~~임대료 부담~~ | 제외 | 데이터 미확보 (v1.1 확장 후보) |
| **총합** | **1.00** | — |

**재분배 공식**: `new_weight = old_weight / (1 - 0.25) = old_weight / 0.75`
원 설계의 임대료 0.25를 제거하고 나머지 3항목을 비율 보존하며 재정규화한다.

## 3. 산출 절차

```python
import numpy as np
import pandas as pd
from scipy import stats

def compute_gri(df: pd.DataFrame) -> pd.DataFrame:
    """
    df columns:
      - commerce_code     : 상권 코드
      - quarter           : 분기 (YYYYQn)
      - closure_rate      : 폐업률 (%)
      - net_flow          : Module A 순유입 (양수=유입)
      - degree_centrality : Module A 정규화 degree [0, 1]
    returns: DataFrame with `gri_score`, 구성요소 z-score 포함.
    """
    # 1. 방향성 통일 — 위험도 높을수록 값이 커지도록
    risk_closure  = df["closure_rate"]
    risk_outflow  = -df["net_flow"]              # 순유출 커질수록 위험
    risk_isolate  = -df["degree_centrality"]     # 고립될수록 위험

    # 2. z-score 정규화 (서울 전역 기준 — 자치구 간 비교 가능성 확보)
    z_closure = stats.zscore(risk_closure, nan_policy="omit")
    z_outflow = stats.zscore(risk_outflow, nan_policy="omit")
    z_isolate = stats.zscore(risk_isolate, nan_policy="omit")

    # 3. 가중 평균
    gri_raw = 0.40 * z_closure + 0.33 * z_outflow + 0.27 * z_isolate

    # 4. percentile rank [0, 100]
    df["gri_score"]      = stats.rankdata(gri_raw, method="average") / len(gri_raw) * 100
    df["risk_closure_z"] = z_closure
    df["risk_outflow_z"] = z_outflow
    df["risk_isolate_z"] = z_isolate
    return df
```

## 4. 정규화 기준 선택

**채택**: 서울 전역 z-score
**근거**:
- 자치구 내부 정규화는 강남구와 관악구 간 비교를 불가능하게 함
- MVP 범위(강남·관악)에서도 자치구 간 비교가 정책 우선순위 산출의 핵심
- 서울 전역 확장 시에도 재계산 없이 범위만 확장 가능

## 5. 검증 방법

### 5.1 스팟 체크 (Week 2)
- 상위 10% 고위험 상권 → 현장 맥락(뉴스, 기존 상권변화지표)과 일치 여부
- 하위 10% 저위험 상권 → 안정 상권으로 알려진 곳과 일치 여부

### 5.2 H1 검증 연동 (Week 3)
- GRI와 다음 분기 매출 변화율의 Pearson 상관 r
- 기준: r ≥ 0.5, p < 0.05 (`docs/FR_Role_Workflow.md` 3.5절)

## 6. v1.1 확장 후보 (Week 4 이후)

임대료 대체 지표 3종:

| 후보 | 장점 | 단점 | 평가 |
|------|------|------|------|
| 공시지가 (국토부) | 공공데이터 확보 용이 | 분기 갱신 아님 | 우선 후보 |
| 주변 매출 대비 임대료 지수 | 부담률 근사 가능 | 파생 지표 복잡도 | 2순위 |
| 상권 변화 지수 (OA-15576) | 검증된 지표 | 자체 분석과 중복 | 보조 |

## 7. 산출 주기

- 분기별 1회 (`commerce_sales` 갱신 주기와 일치)
- 결과는 `commerce_analysis.gri_score` 컬럼에 저장

## 8. 출력 스키마

| 컬럼 | 타입 | 설명 |
|------|------|------|
| commerce_code | VARCHAR | 상권 코드 |
| quarter | VARCHAR(6) | YYYYQn |
| gri_score | NUMERIC(5,2) | 0~100 percentile rank |
| risk_closure_z | NUMERIC | 폐업률 z-score |
| risk_outflow_z | NUMERIC | 순유출 z-score |
| risk_isolate_z | NUMERIC | 고립도 z-score |
| computed_at | TIMESTAMP | 산출 시각 |
