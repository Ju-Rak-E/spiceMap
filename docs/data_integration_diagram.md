# spiceMap 데이터 결합 구조도 (D-9, 2026-05-03)

> 발표 산출물 1장 — 공공API 6종 → PostGIS 11테이블 → 분석 모듈 5종 → API 6종 → 프론트
> 출처: `backend/models.py` · `docs/schema.md` · `backend/api/*.py` · `frontend/src/`

## 전체 파이프라인

```mermaid
flowchart LR
  subgraph 공공_API["공공 API 6종"]
    A1[OA-22300<br/>수도권 광역 OD<br/>일별 80M 행]
    A2[OA-22160<br/>행정동 경계 SHP]
    A3[OA-15560<br/>상권 경계 SHP]
    A4[OA-14991<br/>생활인구]
    A5[OA-15577<br/>점포정보 자치구 분기]
    A6[OA-15572<br/>추정매출 상권 분기]
  end

  subgraph 적재["적재 파이프라인 (Python)"]
    P1[collect_od_flows.py<br/>+ aggregate_od_flows.py]
    P2[load_spatial.py]
    P3[collect_living_pop.py]
    P4[collect_store_info.py]
    P5[collect_commerce_sales.py]
  end

  subgraph PostGIS["Supabase PostgreSQL + PostGIS<br/>11 테이블"]
    T1[(admin_boundary 425)]
    T2[(commerce_boundary 1,650)]
    T3[(od_flows 80M, Dev-A 로컬)]
    T4[(od_flows_aggregated<br/>Q3 183K + Q4 183K)]
    T5[(living_population 95K)]
    T6[(store_info 5,599)]
    T7[(commerce_sales Q3+Q4)]
    T8[(adm_comm_mapping<br/>1,650 LATERAL)]
    T9[(commerce_analysis<br/>Q3 1,650)]
    T10[(flow_barriers Q4 200)]
    T11[(policy_cards Q3 419)]
  end

  subgraph 분석["분석 모듈 (run_analysis.py 통합)"]
    M_A[Module A<br/>NetworkX OD graph<br/>net_flow · degree_centrality]
    M_B[Module B<br/>GRI v1.0<br/>0.40 폐업률 + 0.33 순유출 + 0.27 고립도]
    M_C[Module C<br/>시계열 갭 알고리즘<br/>Q3→Q4 -50%]
    M_D[Module D<br/>R4~R7 정책 규칙<br/>R1~R3·R8 비활성]
    M_E[Module E<br/>priority_score<br/>0.60 GRI + 0.25 매출 + 0.15 추세]
    CT[commerce_type v1.1<br/>5 유형 + unclassified]
  end

  subgraph 검증["검증 + 베이스라인"]
    V1[H1: net_flow vs sales<br/>r=0.106 / p=2.83e-05]
    V2[H2: barrier vs closure<br/>구현 완료, 실측 대기]
    V3[H3: GRI top vs closure<br/>gap=0.746%p / p≈5e-36]
    B1[B1: OA-15576 vs priority<br/>Jaccard 0.58]
    B3[B3: 추세 모델 vs priority<br/>Jaccard 0.151]
  end

  subgraph API["FastAPI 6 엔드포인트"]
    E1[GET /api/commerce/type-map]
    E2[GET /api/gri/history]
    E3[GET /api/od/flows]
    E4[GET /api/barriers]
    E5[GET /api/insights/policy]
    E6[GET /api/export/csv]
  end

  subgraph 프론트["React + MapLibre + Deck.gl"]
    F1[지도 탭<br/>상권 노드 + OD 곡선 + 파티클]
    F2[상세 패널<br/>GRI · 폐업률 · 추세 · 정책카드]
    F3[검증 보고 탭<br/>5 카드 H1·H2·H3·B1·B3]
    F4[Hero shot 모드<br/>?hero=1 + 단축키 1~4]
  end

  A1 --> P1 --> T3 --> T4
  A2 --> P2 --> T1
  A3 --> P2 --> T2
  P2 --> T8
  A4 --> P3 --> T5
  A5 --> P4 --> T6
  A6 --> P5 --> T7

  T4 --> M_A
  T6 --> M_B
  T8 --> M_B
  M_A --> M_B
  M_B --> CT
  M_B --> M_D
  M_B --> M_E
  T7 --> M_E
  T4 --> M_C
  T8 --> M_C

  M_A --> T9
  M_B --> T9
  CT --> T9
  M_E --> T9
  M_D --> T11
  M_C --> T10

  T9 --> V1
  T9 --> V3
  T10 --> V2
  T9 --> B1
  T9 --> B3
  T7 --> B3

  T9 --> E1
  T9 --> E2
  T4 --> E3
  T10 --> E4
  T11 --> E5
  T9 --> E6

  E1 --> F1
  E1 --> F2
  E2 --> F2
  E3 --> F1
  E4 --> F1
  E5 --> F2
  E6 --> F1
  V1 --> F3
  V2 --> F3
  V3 --> F3
  B1 --> F3
  B3 --> F3
  F1 --> F4
  F2 --> F4
```

## 핵심 수치 (D-9 시점)

| 단계 | 지표 |
|------|------|
| 공공 API | 6종 (OA-22300/22160/15560/14991/15577/15572) |
| 적재 row 수 | 80M+ (od_flows 원본), 366K+ (분기 집계), 1,650 (상권 폴리곤) |
| 분석 분기 | 2025Q3 + 2025Q4 (동등 척도, Q3·Q4 비율 0.94~1.05) |
| 분석 모듈 | A·B·C·D·E + commerce_type v1.1 |
| 검증 | H1·H2·H3 + 베이스라인 B1·B3 |
| 정책 규칙 | R4·R5·R6·R7 활성 (R1~R3·R8 보류) |
| API | FastAPI 6 엔드포인트 (Redis 1h 캐시) |
| 프론트 테스트 | 178/178 vitest, build 2.0MB / gzip 562KB |
| 백엔드 테스트 | 228 pass |
| MVP 범위 | 강남구·관악구 — 1,650 상권 중 178 (강남 104 + 관악 74) |

## 차별화 포인트

1. **흐름 기반 위험 탐지** — 기존 상권분석은 *상태 스냅샷*만, spiceMap은 *왜 그 상태가 됐는가(흐름 단절)*까지
2. **자동 정책 카드** — 규칙 기반(R4~R7) + 생성형 AI 미사용 라벨 (FR-07)
3. **이중 베이스라인 검증** — 공식 OA-15576(B1, J=0.58) + 단순 매출 추세(B3, J=0.151) 모두 우월
4. **Hero shot 시연 동선** — `?hero=1` + 단축키 1~4 → 4클릭 안에 가치 입증
