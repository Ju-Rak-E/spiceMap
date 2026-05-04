# CSV Export 스키마 (`/api/export/csv`)

> 발표 시연 산출물의 단일 진실 문서 — `backend/api/export.py:14-17` `_CSV_HEADERS` 와 1:1 정렬.
> Hero shot 시연 단축키 `3` (CSV toast) 의 결과 파일이 본 스키마를 따른다.

## 엔드포인트

```
GET /api/export/csv?quarter=2025Q4&gu=관악구&min_priority=80
```

| 파라미터 | 기본값 | 설명 |
|---------|------|------|
| `quarter` | `2025Q4` | 대상 분기 (`commerce_analysis.year_quarter`) |
| `gu` | (전체) | 자치구 필터 (예: 강남구, 관악구). LATERAL `ST_Contains` 매칭 |
| `min_priority` | `80.0` | 우선순위 하한 (즉시개입 임계 = 80) |

## 응답

- `Content-Type: text/csv; charset=utf-8-sig`
- `Content-Disposition: attachment; filename="spicemap_<quarter>_<gu>.csv"`
- 파일 첫 byte 에 UTF-8 BOM (`\\ufeff`) — Excel 한글 깨짐 방지
- 정렬: `priority_score DESC NULLS LAST`

## 9 컬럼

| # | 컬럼 헤더 | 타입 | 형식 | 출처 (DB) | 비고 |
|---|---------|------|----|---------|----|
| 1 | 상권코드 | str | `gw_001` | `commerce_analysis.comm_cd` | 분석 단위 PK |
| 2 | 상권명 | str | `신림 골목상권` | `commerce_boundary.comm_nm` | LATERAL JOIN |
| 3 | 자치구 | str | `관악구` | `admin_boundary.gu_nm` | LATERAL `ST_Contains(geom, ST_PointOnSurface(cb.geom))` |
| 4 | 상권유형 | str | `방출형_침체` | `commerce_analysis.commerce_type` | Module D commerce_type v1.1 (5 유형 + unclassified) |
| 5 | GRI점수 | float | `78.0` (소수점 1자리) | `commerce_analysis.gri_score` | Module B v1.0 (0~100 percentile) |
| 6 | 우선순위점수 | float | `87.3` (소수점 1자리) | `commerce_analysis.priority_score` | Module E (0.60×GRI + 0.25×매출 + 0.15×추세) |
| 7 | 폐업률 | float | `4.2` (소수점 1자리, %p) | `commerce_analysis.closure_rate` | `store_info.close_rate` 자치구 매핑 |
| 8 | 순유입량 | int | `-250` (소수 X) | `commerce_analysis.net_flow` | Module A (in_degree − out_degree) |
| 9 | 정책권고요약 | str | `현장 조사… \| 임대료 안정화…` | `policy_cards.policy_text` LATERAL `STRING_AGG` (severity ASC) | 다중 카드를 ` \| ` 로 합침 |

## 샘플 출력 (1행)

```
상권코드,상권명,자치구,상권유형,GRI점수,우선순위점수,폐업률,순유입량,정책권고요약
gw_001,신림 골목상권,관악구,방출형_침체,78.0,87.3,4.2,-250,"현장 조사 + 금융 지원 (방출형 침체 대응) | 골목 상권 활성화 프로그램"
```

## NULL 처리

| 원본 NULL | CSV 출력 |
|----------|--------|
| `gu_nm` 매핑 실패 | 빈 문자열 |
| `commerce_type` 미분류 | 빈 문자열 |
| 모든 수치 NULL | 빈 문자열 (포맷팅 생략) |
| `policy_summary` (정책 카드 0건) | 빈 문자열 |

## 활용 시나리오

### 페르소나 (관악구 경제과 담당자)

1. `?gu=관악구&min_priority=80` 으로 즉시개입 상권만 추출
2. Excel 에서 9 컬럼을 그대로 결재 라인 자료로 활용
3. 정책권고요약 컬럼은 R4~R7 다중 카드를 한 줄로 합치므로 분기별 정책 패키지 design 입력으로 직접 사용

### Hero shot 시연 (단축키 `3`)

- `docs/hero_shot_scenario.md` §1-3 1:30~2:15 구간
- toast: "추천 상권 N건 + 정책 R4~R7 한 줄 요약 다운로드"
- 실데이터 N (적재 후): commerce_analysis Q4 우선순위 ≥ 80 상권 수

## 회귀 테스트

`tests/api/test_export.py` — 헤더 9개·UTF-8 BOM·`Content-Disposition`·정렬 확인.

## 향후 확장 (v2)

- `format=xlsx` 옵션 — openpyxl 로 시트별 분류
- `include=metrics` 옵션 — net_flow, degree_centrality 추가 컬럼
- 분기 비교 (Q3 vs Q4) 모드 — 각 컬럼에 `_q3`, `_q4`, `_delta` 접미사
- LLM 정책 설명 — `policy_summary` 를 LLM 으로 자연어 요약 (현재는 규칙 기반 templated)
